"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/add-room', {
		templateUrl: 'js/pages/add-room/lup-add-room.html?v=' + window.LUP_BUILD,
		controller: 'AddRoomCtrl',
		params: { authCheck: true },
	});
}).controller('AddRoomCtrl', function($scope, $location, $translate, $timeout, $window,
		CategorySrvc, ConfigSrvc, PositionSrvc, RoomSrvc, WebsocketSrvc, ErrorSrvc) {
	$scope.data.title = 'TITLE_ADD_ROOM';
	$scope.data.categories = [];
	$scope.data.room = { name: '', category: '', info: '', viewRadius: .28, cost: 0 };
	$scope.data.mapStatus = $translate.instant('INFO_ROOM_AREA_LOADING');
	$scope.data.mapReady = false;
	let map, polygon, marker, viewCircle, position, mapLoader, originChosen = false;

	function updateCost() {
		$scope.data.room.cost = ConfigSrvc.roomCreationCost($scope.data.room.viewRadius);
	}

	function setOrigin(latLng, movePolygon) {
		const oldPosition = position;
		position = {lat: latLng.lat(), lng: latLng.lng()};
		marker.setPosition(latLng);
		viewCircle.setCenter(latLng);
		/* While choosing the initial place, map clicks must not be swallowed by
		 * the preview hexagon. It becomes editable after that first choice. */
		if (originChosen) {
			/* Keep the preview transparent to the second click of a double-click. */
			$timeout(function() { polygon.setOptions({clickable: true}); }, 300, false);
		}
		if (movePolygon && oldPosition) {
			const latDelta = position.lat - oldPosition.lat;
			const lngDelta = position.lng - oldPosition.lng;
			polygon.getPath().forEach(function(point, index) {
				polygon.getPath().setAt(index, new google.maps.LatLng(point.lat() + latDelta, point.lng() + lngDelta));
			});
		}
	}

	function defaultPolygon(lat, lng, radiusMeters) {
		const points = [];
		const radiusKm = radiusMeters / 1000;
		const latDegrees = radiusKm / 111.32;
		const lngDegrees = radiusKm / (111.32 * Math.max(.01, Math.cos(lat * Math.PI / 180)));
		for (let i = 0; i < 6; i++) {
			const angle = (2 * Math.PI * i) / 6;
			points.push({lat: lat + (latDegrees * Math.cos(angle)), lng: lng + (lngDegrees * Math.sin(angle))});
		}
		return points;
	}

	function geoJSON() {
		if (!polygon) { return null; }
		const coordinates = polygon.getPath().getArray().map(function(point) {
			return [Number(point.lng().toFixed(7)), Number(point.lat().toFixed(7))];
		});
		if (coordinates.length < 3) { return null; }
		coordinates.push(coordinates[0]);
		return {type: 'Polygon', coordinates: [coordinates]};
	}

	function nearestSegment(path, point) {
		let winner = 0, distance = Infinity;
		const scale = Math.cos(point.lat() * Math.PI / 180);
		for (let i = 0; i < path.getLength(); i++) {
			const a = path.getAt(i), b = path.getAt((i + 1) % path.getLength());
			const ax = (a.lng() - point.lng()) * scale, ay = a.lat() - point.lat();
			const bx = (b.lng() - point.lng()) * scale, by = b.lat() - point.lat();
			const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
			const t = length ? Math.max(0, Math.min(1, -((ax * dx) + (ay * dy)) / length)) : 0;
			const candidate = (ax + t * dx) ** 2 + (ay + t * dy) ** 2;
			if (candidate < distance) { winner = i; distance = candidate; }
		}
		return winner;
	}

	function stopMapDoubleClick(event) {
		if (!event) { return; }
		if (typeof event.stop === 'function') { event.stop(); }
		const domEvent = event.domEvent;
		if (domEvent) {
			domEvent.preventDefault();
			if (typeof domEvent.stopImmediatePropagation === 'function') {
				domEvent.stopImmediatePropagation();
			}
			else {
				domEvent.stopPropagation();
			}
		}
	}

	function loadMapScript() {
		if ($window.google && $window.google.maps) { return Promise.resolve(); }
		if (mapLoader) { return mapLoader; }
		const key = $window.LUP_GOOGLE_MAPS_API_KEY;
		if (!key) { return Promise.reject(new Error('missing-key')); }
		mapLoader = new Promise(function(resolve, reject) {
			const existing = document.getElementById('lup-google-maps');
			if (existing) { existing.addEventListener('load', resolve); existing.addEventListener('error', reject); return; }
			const script = document.createElement('script');
			script.id = 'lup-google-maps';
			script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key);
			script.async = true;
			script.defer = true;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
		return mapLoader;
	}

	function initMap() {
		const element = document.getElementById('lup-add-room-map');
		if (!element || !position || map) { return; }
		const center = {lat: Number(position.lat), lng: Number(position.lng)};
		map = new google.maps.Map(element, {
			center: center, zoom: 17, mapTypeId: google.maps.MapTypeId.HYBRID,
			mapTypeControl: false, streetViewControl: false, disableDoubleClickZoom: true,
		});
		polygon = new google.maps.Polygon({
			paths: defaultPolygon(center.lat, center.lng, 150),
			strokeColor: '#7c63ff', strokeOpacity: 1, strokeWeight: 3,
			fillColor: '#7c63ff', fillOpacity: .30, editable: true, draggable: false,
			clickable: false, map: map,
		});
		marker = new google.maps.Marker({position: center, draggable: true, map: map, title: $translate.instant('LABEL_ROOM_ORIGIN')});
		viewCircle = new google.maps.Circle({
			center: center,
			radius: $scope.data.room.viewRadius * 1000,
			strokeColor: '#aa95ff', strokeOpacity: .95, strokeWeight: 3,
			fillColor: '#826cff', fillOpacity: .14,
			editable: true, draggable: false, clickable: false, zIndex: 0, map: map,
		});
		marker.addListener('dragend', function(event) {
			setOrigin(event.latLng, false);
			$scope.$applyAsync();
		});
		// A double-click on the origin marker belongs to the marker, not to the
		// map underneath it. Otherwise Maps also receives it and resets the
		// editable hexagon as though the user had double-clicked free map space.
		marker.addListener('dblclick', function(event) {
			stopMapDoubleClick(event);
			return false;
		});
		map.addListener('click', function(event) {
			if (originChosen) { return; }
			originChosen = true;
			setOrigin(event.latLng, true);
			$scope.$applyAsync();
		});
		map.addListener('dblclick', function(event) {
			/* A double-click on free map space starts a clean, six-corner room area. */
			originChosen = true;
			setOrigin(event.latLng, false);
			polygon.setPath(defaultPolygon(position.lat, position.lng, 150));
			$scope.$applyAsync();
		});
		polygon.addListener('dblclick', function(event) {
			stopMapDoubleClick(event);
			polygon.getPath().insertAt(nearestSegment(polygon.getPath(), event.latLng) + 1, event.latLng);
			return false;
		});
		polygon.addListener('rightclick', function(event) {
			if (event.vertex === undefined) { return; }
			const path = polygon.getPath();
			if (path.getLength() > 3) { path.removeAt(event.vertex); }
		});
		viewCircle.addListener('radius_changed', function() {
			$scope.data.room.viewRadius = viewCircle.getRadius() / 1000;
			updateCost();
			$scope.$applyAsync();
		});
		$scope.data.mapStatus = $translate.instant('INFO_ROOM_AREA_EDIT');
		$scope.data.mapReady = true;
		$scope.$applyAsync();
	}

	$scope.init = function() {
		if (!window.GWF_USER.isVIP()) {
			ErrorSrvc.showError($translate.instant('ERR_VIP_ONLY'), $translate.instant('TITLE_ADD_ROOM'));
			return $location.path('/locations');
		}
		updateCost();
		CategorySrvc.withCategories().then(function(response) {
			var categories = response.data ? response.data.data : response;
			$scope.data.categories = Object.keys(categories).map(function(id) { return categories[id]; });
		})['catch']($scope.catchUnknown);
		PositionSrvc.probe().then(function() {
			position = PositionSrvc.CURRENT;
			return loadMapScript();
		}).then(function() {
			$timeout(initMap);
		})['catch'](function(error) {
			if (position || (error && error.message === 'missing-key')) {
				$scope.data.mapStatus = $translate.instant('ERR_ROOM_MAP_UNAVAILABLE');
				return;
			}
			return ErrorSrvc.showError($translate.instant('ERR_GPS_REQUIRED'), $translate.instant('TITLE_ADD_ROOM'));
		})['catch']($scope.catchUnknown);
	};

	$scope.create = function() {
		var room = $scope.data.room;
		var currentPosition = position || PositionSrvc.CURRENT;
		if (!room.name || !room.category) {
			return ErrorSrvc.showError($translate.instant('ERR_ADD_ROOM_REQUIRED'), $translate.instant('TITLE_ADD_ROOM'));
		}
		if (!PositionSrvc.hasPosition(true)) {
			return ErrorSrvc.showError($translate.instant('ERR_GPS_REQUIRED'), $translate.instant('TITLE_ADD_ROOM'));
		}
		var request = new GWS_Message().cmd(0x1165).sync()
			.writeString(room.name)
			.write32(Number(room.category))
			.writeString(room.info || '')
			.writeFloat(currentPosition.lat)
			.writeFloat(currentPosition.lng)
			/* Kept for older servers; polygon is the actual chat boundary now. */
			.writeFloat(150)
			.writeString(JSON.stringify(geoJSON()))
			.writeFloat(Number(room.viewRadius));
		return WebsocketSrvc.sendBinary(request).then(function(reply) {
			var roomId = reply.read32();
			RoomSrvc.ALL_ROOMS = null;
			return RoomSrvc.withRooms().then(function(rooms) {
				$scope.data.rooms = rooms;
				return RoomSrvc.withRoom(roomId, true);
			}).then(function() { return $location.path('/location/' + roomId); });
		}, function(error) { return ErrorSrvc.websocketError(error); });
	};

	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
