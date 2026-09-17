"use strict";
/** Paid local broadcast composer with a visual centre and radius preview. */
angular.module('LUP').service('ShoutSrvc', function($mdDialog, $q, $timeout, $translate,
		ChatSrvc, ConfigSrvc, ErrorSrvc, PositionSrvc, RoomSrvc) {
	var ShoutSrvc = this;
	var mapsLoader = null;

	function loadMaps() {
		if (window.google && window.google.maps) { return $q.when(); }
		if (mapsLoader) { return mapsLoader; }
		var key = window.LUP_GOOGLE_MAPS_API_KEY;
		if (!key) { return $q.reject(new Error('missing-google-maps-key')); }
		var deferred = $q.defer();
		mapsLoader = deferred.promise;
		var existing = document.getElementById('lup-google-maps');
		if (existing) {
			existing.addEventListener('load', function() { deferred.resolve(); }, {once:true});
			existing.addEventListener('error', function() { deferred.reject(new Error('google-maps-load')); }, {once:true});
			return mapsLoader;
		}
		var script = document.createElement('script');
		script.id = 'lup-google-maps';
		script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key);
		script.async = true;
		script.defer = true;
		script.onload = deferred.resolve;
		script.onerror = function() { deferred.reject(new Error('google-maps-load')); };
		document.head.appendChild(script);
		return mapsLoader;
	}

	ShoutSrvc.open = function(message) {
		message = String(message || '').trim();
		if (!PositionSrvc.hasPosition(true)) {
			return PositionSrvc.probe().then(function() { return ShoutSrvc.open(message); });
		}
		return $mdDialog.show({
			controller: ShoutDialogController,
			templateUrl: 'js/dialogs/lup-shout-dialog.html?v=' + window.LUP_BUILD,
			parent: angular.element(document.body),
			clickOutsideToClose: false,
			locals: {initialMessage: message},
		});
	};

	ShoutDialogController.$inject = ['$scope', '$mdDialog', 'initialMessage'];
	function ShoutDialogController($scope, $mdDialog, initialMessage) {
		var map, centerMarker, radiusCircle, pointers = [];
		$scope.data = {
			message: initialMessage,
			radius: 1,
			creditsPerKM: ConfigSrvc.shoutCreditsKM(),
			cost: 0,
			mapStatus: $translate.instant('SHOUT_MAP_LOADING'),
			mapReady: false,
		};
		$scope.cancel = function() { $mdDialog.cancel(); };
		$scope.cost = function() {
			return Math.ceil(Math.max(0.001, Number($scope.data.radius) || 0.001) * $scope.data.creditsPerKM);
		};
		$scope.updateRadius = function() {
			$scope.data.radius = Math.max(0.001, Math.round((Number($scope.data.radius) || 0.001) * 1000) / 1000);
			$scope.data.cost = $scope.cost();
			if (radiusCircle) { radiusCircle.setRadius($scope.data.radius * 1000); }
		};
		$scope.send = function() {
			var text = String($scope.data.message || '').trim();
			if (!text) { return; }
			$scope.updateRadius();
			var center = radiusCircle && radiusCircle.getCenter();
			var position = center ? {lat:center.lat(), lng:center.lng()} : PositionSrvc.CURRENT;
			return ChatSrvc.sendShout($scope.data.radius, text, position).then(function(result) {
				$mdDialog.hide(result);
			}, ErrorSrvc.websocketError);
		};

		function setCenter(latLng) {
			centerMarker.setPosition(latLng);
			radiusCircle.setCenter(latLng);
		}
		function addPointers(rooms) {
			(rooms || []).forEach(function(room) {
				var lat = Number(room.lat && room.lat()), lng = Number(room.lng && room.lng());
				if (!Number.isFinite(lat) || !Number.isFinite(lng)) { return; }
				pointers.push(new google.maps.Marker({
					map: map, position: {lat:lat, lng:lng}, clickable: false, zIndex: 1,
					icon: {path: google.maps.SymbolPath.CIRCLE, scale: 3.5, fillColor:'#f4f6ff', fillOpacity:.8, strokeOpacity:0},
				}));
			});
		}
		function initMap() {
			var element = document.getElementById('lup-shout-map');
			if (!element || map) { return; }
			var origin = {lat:Number(PositionSrvc.CURRENT.lat), lng:Number(PositionSrvc.CURRENT.lng)};
			map = new google.maps.Map(element, {
				center: origin, zoom: 13, mapTypeControl: false, streetViewControl: false,
				fullscreenControl: false, clickableIcons: false,
			});
			centerMarker = new google.maps.Marker({
				map: map, position: origin, draggable: true, clickable: false, zIndex: 3,
				icon: {path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor:'#fff4f4', fillOpacity:1, strokeColor:'#9e2339', strokeWeight:2},
			});
			radiusCircle = new google.maps.Circle({
				map: map, center: origin, radius: $scope.data.radius * 1000,
				strokeColor:'#d43b51', strokeOpacity:.95, strokeWeight:2,
				fillColor:'#5e0717', fillOpacity:.43, editable: true, clickable: false, zIndex: 2,
			});
			map.addListener('click', function(event) { setCenter(event.latLng); $scope.$applyAsync(); });
			centerMarker.addListener('dragend', function(event) { setCenter(event.latLng); $scope.$applyAsync(); });
			radiusCircle.addListener('radius_changed', function() {
				$scope.data.radius = Math.max(0.001, Math.round(radiusCircle.getRadius()) / 1000);
				$scope.data.cost = $scope.cost();
				$scope.$applyAsync();
			});
			RoomSrvc.withRooms(true).then(addPointers);
			$scope.data.mapReady = true;
			$scope.data.mapStatus = $translate.instant('SHOUT_MAP_HINT');
			$scope.$applyAsync();
		}

		$scope.updateRadius();
		loadMaps().then(function() { $timeout(initMap); }, function() {
			$scope.data.mapStatus = $translate.instant('SHOUT_MAP_UNAVAILABLE');
		});
		$scope.$on('$destroy', function() { pointers.forEach(function(pointer) { pointer.setMap(null); }); });
	}
});
