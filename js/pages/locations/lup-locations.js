"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/locations', {
		templateUrl: 'js/pages/locations/lup-locations.html?v='+window.LUP_BUILD,
		controller: 'LocationsCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('LocationsCtrl', function($scope, $location, $translate, $timeout, $mdDialog, $q,
		LoadingSrvc, WebsocketSrvc, PositionSrvc, RoomSrvc, AuthSrvc, HelpSrvc, UserSrvc, ErrorSrvc, DialogSrvc, CategorySrvc) {
	
	$scope.data.title = "Entdecken";
	// Stage one of the new discovery flow: exactly one nearby page.  Filtering,
	// selection and pagination will be added only after this basic request and
	// rendering path is stable.
	$scope.data.rooms = $scope.data.rooms || [];
	$scope.data.filteredRooms = $scope.data.filteredRooms || [];
	$scope.data.categoryIds = Array.isArray($scope.data.categoryIds) ? $scope.data.categoryIds : [];
	$scope.data.navigatorCategories = $scope.data.navigatorCategories || [];
	$scope.data.page = $scope.data.page || 1;
	$scope.data.per_page = $scope.data.per_page || 10;
	$scope.data.roomsTotal = $scope.data.roomsTotal || 0;
	$scope.data.currentRoomIndex = $scope.data.currentRoomIndex || 0;
	$scope.data.hasMoreLocations = $scope.data.hasMoreLocations !== false;
	$scope.data.loadingNextPage = false;
	$scope.data.pullDistance = 0;
	$scope.data.refreshing = false;
	var firstPageRequested = !!$scope.data.locationsInitialized;
	var categoriesRequested = false;
	var roomsPosition = $scope.data.roomsPosition || null;
	var railElement = null;
	var railScrollFrame = null;
	var discoveryGlass = null;
	var resetAnimations = [];
	var restoringRail = false;
	var swipeStart = null;
	var pullStart = null;
	var pullThreshold = 72;
	var stopRailGesture = function() {
		window.removeEventListener('pointermove', onRailPointerMove, true);
		window.removeEventListener('pointerup', onRailPointerUp, true);
		window.removeEventListener('pointercancel', onRailPointerCancel, true);
	};

	var syncRailSelection = function() {
		railScrollFrame = null;
		var rooms = $scope.data.filteredRooms || [];
		if (restoringRail || !railElement || !railElement.clientWidth || !rooms.length) {
			return;
		}
		if (discoveryGlass) discoveryGlass.paint();
		var index = Math.round(railElement.scrollLeft / railElement.clientWidth);
		index = Math.max(0, Math.min(rooms.length - 1, index));
		if ($scope.data.currentRoomIndex !== index) {
			$scope.$evalAsync(function() {
				$scope.data.currentRoomIndex = index;
				$scope.data.selectedRoomId = String(rooms[index].id());
			});
		}
		if (index === rooms.length - 1) {
			$scope.loadNextPage();
		}
	};

	var onRailScroll = function() {
		if (railScrollFrame === null) {
			railScrollFrame = window.requestAnimationFrame(syncRailSelection);
		}
	};

	var stepRail = function(direction) {
		if (!railElement || !railElement.children.length) {
			return;
		}
		if (direction > 0 && $scope.data.currentRoomIndex === railElement.children.length - 1) {
			$scope.loadNextPage();
			return;
		}
		var index = Math.max(0, Math.min(
			railElement.children.length - 1,
			$scope.data.currentRoomIndex + direction,
		));
		var card = railElement.children[index];
		var left = card.offsetLeft - (railElement.clientWidth - card.offsetWidth) / 2;
		railElement.scrollTo({left: Math.max(0, left), top: 0, behavior: 'smooth'});
	};

	var restoreRailSelection = function(attempt) {
		bindRail();
		if (!railElement || railElement.closest('.ng-leave') || !railElement.children.length) {
			if ((attempt || 0) < 4) {
				window.requestAnimationFrame(function() { restoreRailSelection((attempt || 0) + 1); });
			} else {
				restoringRail = false;
			}
			return;
		}
		var index = $scope.data.filteredRooms.findIndex(function(room) {
			return String(room.id()) === String($scope.data.selectedRoomId);
		});
		index = index < 0 ? $scope.data.currentRoomIndex : index;
		index = Math.max(0, Math.min(railElement.children.length - 1, index));
		var card = railElement.children[index];
		// A returning route paints at scrollLeft=0 first. Do not let its initial
		// scroll event replace the saved room with card zero; wait until the card
		// has its real layout before restoring the offset.
		if (!railElement.clientWidth || !card || !card.offsetWidth) {
			if ((attempt || 0) < 12) {
				window.requestAnimationFrame(function() { restoreRailSelection((attempt || 0) + 1); });
			} else {
				restoringRail = false;
			}
			return;
		}
		restoringRail = true;
		$scope.data.currentRoomIndex = index;
		$scope.data.selectedRoomId = String($scope.data.filteredRooms[index].id());
		var left = card.offsetLeft - (railElement.clientWidth - card.offsetWidth) / 2;
		railElement.scrollLeft = Math.max(0, left);
		window.requestAnimationFrame(function() {
			if (railElement === getActiveRail()) {
				railElement.scrollLeft = Math.max(0, left);
			}
			restoringRail = false;
		});
	};

	var onRailPointerDown = function(event) {
		if (!event.isPrimary) {
			return;
		}
		// Controls always win over navigation: beginning a tap on a button or
		// link must never turn into a rail gesture.
		if (event.target.closest('button, a, input, select, textarea, label')) {
			swipeStart = null;
			pullStart = null;
			return;
		}
		stopRailGesture();
		swipeStart = {x: event.clientX, y: event.clientY};
		pullStart = {x: event.clientX, y: event.clientY};
		// The finger may be released outside the horizontally scrolling rail.
		// Observe that one gesture globally, then remove these listeners again.
		window.addEventListener('pointermove', onRailPointerMove, {capture: true, passive: false});
		window.addEventListener('pointerup', onRailPointerUp, {capture: true, passive: false});
		window.addEventListener('pointercancel', onRailPointerCancel, {capture: true, passive: false});
	};

	var onRailPointerMove = function(event) {
		if (!pullStart || !event.isPrimary || $scope.data.refreshing) {
			return;
		}
		var dx = event.clientX - pullStart.x;
		var dy = event.clientY - pullStart.y;
		if (dy > 8 && dy > Math.abs(dx)) {
			event.preventDefault();
			$scope.$evalAsync(function() {
				$scope.data.pullDistance = Math.min(96, dy);
			});
		}
	};

	var onRailPointerUp = function(event) {
		if (!swipeStart || !event.isPrimary) {
			return;
		}
		var dx = event.clientX - swipeStart.x;
		var dy = event.clientY - swipeStart.y;
		swipeStart = null;
		var shouldRefresh = pullStart && dy >= pullThreshold && dy > Math.abs(dx);
		pullStart = null;
		$scope.data.pullDistance = 0;
		stopRailGesture();
		if (shouldRefresh) {
			$scope.refreshRooms();
		} else if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) {
			stepRail(dx < 0 ? 1 : -1);
		}
	};

	var onRailPointerCancel = function() {
		swipeStart = null;
		pullStart = null;
		$scope.data.pullDistance = 0;
		stopRailGesture();
	};

	var getActiveRail = function() {
		// Angular keeps the leaving view around for the transition. Selecting the
		// first matching rail would then restore the old DOM instead of the view
		// the visitor just returned to.
		var rails = Array.prototype.filter.call(document.querySelectorAll('.location-rail'), function(rail) {
			return !rail.closest('.ng-leave');
		});
		return rails.find(function(rail) { return rail.children.length; }) || rails[0] || null;
	};

	var bindRail = function() {
		var rail = getActiveRail();
		if (!rail || rail === railElement) {
			return;
		}
		if (railElement) {
			railElement.removeEventListener('scroll', onRailScroll);
			railElement.removeEventListener('pointerdown', onRailPointerDown, true);
		}
		railElement = rail;
		railElement.addEventListener('scroll', onRailScroll, {passive: true});
		railElement.addEventListener('pointerdown', onRailPointerDown, {capture: true, passive: true});
		if (discoveryGlass) discoveryGlass.destroy();
		if (window.LupDiscoveryGlass) discoveryGlass = new window.LupDiscoveryGlass(rail);
	};

	$scope.init = function(event) {
		console.log('LocationsCtrl.init()', event);
		if (!$scope.data.authenticated) {
			return;
		}
		$scope.loadCategories();
		if ($scope.data.locationsInitialized) {
			restoringRail = true;
			$timeout(function() {
				bindRail();
				restoreRailSelection();
			}, 0);
			return;
		}
		if (!PositionSrvc.hasPosition(true)) {
			return;
		}
		$scope.loadFirstPage();
	};
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
	$scope.$on('lup-rooms-ready', function(event, rooms) {
	});
	$scope.$on('lup-rooms-resorted', function(event, roomId) {
	});
	$scope.$on('gwf-position-changed', function() {
		// Browsing must never jump because GPS produced another sample. A visitor
		// explicitly refreshes the nearby page when they want this position used.
	});
	$scope.$on('$destroy', function() {
		resetAnimations.forEach(function(animation) { animation.cancel(); });
		if (discoveryGlass) discoveryGlass.destroy();
		if (railScrollFrame !== null) {
			window.cancelAnimationFrame(railScrollFrame);
		}
		if (railElement) {
			railElement.removeEventListener('scroll', onRailScroll);
			railElement.removeEventListener('pointerdown', onRailPointerDown, true);
		}
		stopRailGesture();
	});

	////////////////
	// Load Rooms //
	////////////////

	$scope.loadCategories = function() {
		if (categoriesRequested) {
			return;
		}
		categoriesRequested = true;
		CategorySrvc.withCategories().then(function() {
			$scope.data.navigatorCategories = CategorySrvc.locationGroups().filter(function(category) {
				return category.ids.length > 0;
			});
		}, function(error) {
			console.warn('LinkUUp: loading location categories failed.', error);
			categoriesRequested = false;
		});
	};

	var sameIds = function(left, right) {
		return left.length === right.length && left.every(function(id, index) { return id === right[index]; });
	};

	var categoryKey = function() {
		return $scope.data.categoryIds.join(',');
	};

	var applyCategoryFilter = function(resetRail) {
		var ids = $scope.data.categoryIds;
		$scope.data.filteredRooms = !ids.length ? $scope.data.rooms.slice() : $scope.data.rooms.filter(function(room) {
			return ids.indexOf(String(room.category())) !== -1;
		});
		if (resetRail) {
			$scope.data.currentRoomIndex = 0;
			$scope.data.selectedRoomId = $scope.data.filteredRooms.length ? String($scope.data.filteredRooms[0].id()) : null;
		}
		$timeout(function() {
			bindRail();
			if (resetRail && railElement) {
				railElement.scrollLeft = 0;
			}
		}, 0);
	};

	$scope.isCategoryActive = function(ids) {
		return sameIds($scope.data.categoryIds, ids.map(String));
	};

	$scope.selectCategory = function(ids) {
		ids = ids.map(String);
		$scope.data.categoryIds = $scope.isCategoryActive(ids) ? [] : ids;
		applyCategoryFilter(true);
		// A category may have no hit on Page 1. Keep the same small paged
		// request until a complete visible page is filled or this nearby list ends.
		if ($scope.data.categoryIds.length && $scope.data.filteredRooms.length < $scope.data.per_page) {
			$scope.loadNextPage($scope.data.per_page);
		}
	};

	$scope.resetCategories = function(event) {
		$scope.data.categoryIds = [];
		applyCategoryFilter(true);
        resetAnimations.forEach(function(animation) { animation.cancel(); });
        resetAnimations = [];
        if (!event || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var button = event.currentTarget;
        var animate = function(element, frames, duration, delay) {
            if (element && element.animate) resetAnimations.push(element.animate(frames, {
                duration:duration, delay:delay || 0, easing:'cubic-bezier(.22,.7,.25,1)'
            }));
        };
        animate(button.querySelector('.nav-reset-pins'), [
            {transform:'rotate(0deg) scale(1)',opacity:1},
            {transform:'rotate(180deg) scale(.12)',opacity:0,offset:.5},
            {transform:'rotate(360deg) scale(1.14)',opacity:1,offset:.82},
            {transform:'rotate(360deg) scale(1)',opacity:1}
        ], 620);
        animate(button.querySelector('.nav-reset-burst'), [
            {transform:'scale(.2)',opacity:0}, {transform:'scale(.7)',opacity:.7,offset:.25},
            {transform:'scale(1.6)',opacity:0}
        ], 360, 240);
        button.closest('.nav-categories').querySelectorAll('.nav-category-glint').forEach(function(icon, index) {
            animate(icon, [{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1.08)',offset:.4},{opacity:0,transform:'scale(1)'}], 300, 160 + index * 85);
        });
	};

	$scope.openRoom = function(room) {
		var index = $scope.data.filteredRooms.indexOf(room);
		if (index >= 0) {
			$scope.data.currentRoomIndex = index;
		}
		$scope.data.selectedRoomId = String(room.id());
		return $scope.gotoRoom(room);
	};

	var loadPage = function(page, replace, minimumMatches) {
		if (LoadingSrvc.hasTask('ws_rooms_page') || (!replace && !$scope.data.hasMoreLocations)) {
			return;
		}
		if (replace) {
			roomsPosition = PositionSrvc.CURRENT;
		} else {
			$scope.data.loadingNextPage = true;
		}
		LoadingSrvc.addTask('ws_rooms_page');
		var requestedCategory = categoryKey();
		var loadFurtherForFilter = false;
		RoomSrvc.loadRoomsPage(roomsPosition, page, $scope.data.per_page).then(function(rooms) {
			rooms = Array.isArray(rooms) ? rooms : [];
			var previousCount = replace ? 0 : $scope.data.rooms.length;
			var uniqueRooms = new Map();
			(replace ? rooms : $scope.data.rooms.concat(rooms)).forEach(function(room) {
				uniqueRooms.set(String(room.id()), room);
			});
			$scope.data.rooms = Array.from(uniqueRooms.values());
			if (replace) $scope.data.currentRoomIndex = 0;
			$scope.data.page = page;
			$scope.data.roomsTotal = RoomSrvc.NUM_ROOMS;
			$scope.data.hasMoreLocations = $scope.data.rooms.length > previousCount && $scope.data.rooms.length < $scope.data.roomsTotal;
			$scope.data.roomsPosition = roomsPosition;
			$scope.data.locationsInitialized = true;
			applyCategoryFilter(replace);
			minimumMatches = minimumMatches || (replace ? $scope.data.per_page : $scope.data.filteredRooms.length + 1);
			loadFurtherForFilter = requestedCategory !== '' && requestedCategory === categoryKey() &&
				$scope.data.filteredRooms.length < minimumMatches && $scope.data.hasMoreLocations;
		}, function(error) {
			if (replace) {
				firstPageRequested = false;
			}
			console.warn('LinkUUp: loading location page failed.', error);
		})['finally'](function() {
			LoadingSrvc.removeTask('ws_rooms_page');
			$scope.data.loadingNextPage = false;
			if (loadFurtherForFilter) {
				$scope.loadNextPage(minimumMatches);
			} else {
				$scope.data.refreshing = false;
			}
		});
	};

	$scope.loadFirstPage = function() {
		if (firstPageRequested) {
			return;
		}
		firstPageRequested = true;
		loadPage(1, true);
	};

	$scope.refreshRooms = function() {
		if ($scope.data.refreshing) {
			return;
		}
		$scope.data.refreshing = true;
		WebsocketSrvc.expectPageUnload();
		window.location.reload();
	};

	$scope.loadNextPage = function(minimumMatches) {
		if (!firstPageRequested) {
			return;
		}
		minimumMatches = minimumMatches || $scope.data.filteredRooms.length + 1;
		loadPage($scope.data.page + 1, false, minimumMatches);
	};

	///////////
	// Votes //
	///////////

	$scope.openRoomVote = function(room, event) {
		function VoteDialogController($scope, $mdDialog) {
			$scope.room = room;
			$scope.data = {rating: Math.max(1, Math.round(Number(room.rating()) || 0))};
			$scope.cancel = function() { $mdDialog.cancel(); };
			$scope.save = function() {
				$scope.working = true;
				WebsocketSrvc.sendBinary(new GWS_Message().cmd(0x1120).sync().write32(room.id()).write8($scope.data.rating)).
					then(function(message) {
						RoomSrvc.parseRoomsMessage(message);
						$mdDialog.hide();
					}, function(error) {
						$scope.working = false;
						ErrorSrvc.websocketJSONError(error);
					});
			};
		}

		return $mdDialog.show({
			controller: VoteDialogController,
			templateUrl: 'js/dialogs/lup-room-quick-vote-dialog.html?v=' + window.LUP_BUILD,
			parent: angular.element(document.body),
			targetEvent: event,
			clickOutsideToClose: true,
		});
	};

	////////////////
	// Categories //
	////////////////

	$scope.categoryVisual = function(room) {
		var visuals = {
			'1': {icon: 'public', class: 'lup-discovery--country'},
			'2': {icon: 'location_city', class: 'lup-discovery--city'},
			'3': {icon: 'local_bar', class: 'lup-discovery--bar'},
			'4': {icon: 'sports_bar', class: 'lup-discovery--pub'},
			'5': {icon: 'local_cafe', class: 'lup-discovery--cafe'},
			'6': {icon: 'business', class: 'lup-discovery--business'},
			'7': {icon: 'shopping_cart', class: 'lup-discovery--shop'},
			'8': {icon: 'account_balance', class: 'lup-discovery--religion'},
			'9': {icon: 'content_cut', class: 'lup-discovery--salon'},
			'10': {icon: 'map', class: 'lup-discovery--town'},
			'11': {icon: 'nightlife', class: 'lup-discovery--club'},
			'12': {icon: 'theater_comedy', class: 'lup-discovery--culture'},
			'13': {icon: 'sports_soccer', class: 'lup-discovery--sport'},
			'14': {icon: 'restaurant', class: 'lup-discovery--food'},
			'15': {icon: 'park', class: 'lup-discovery--outdoors'},
			'16': {icon: 'school', class: 'lup-discovery--education'},
			'17': {icon: 'account_balance', class: 'lup-discovery--university'},
			'18': {icon: 'local_hospital', class: 'lup-discovery--health'},
			'19': {icon: 'hotel', class: 'lup-discovery--hotel'},
		};
		return visuals[String(room.category())] || {icon: 'place', class: 'lup-discovery--default'};
	};

	//////////
	// Maps //
	//////////
	/**
	 * @see https://developers.google.com/maps/documentation/urls/guide
	 */
	$scope.mapsHref = function(room) {
//		console.log("LocationsCtrl.mapsHref()", room);
		var destination = $scope.mapsDestination(room);
		return "https://www.google.com/maps/dir/?api=1&dir_action=navigate&travelmode=walking&destination=" + encodeURIComponent(destination);
	};
	
	$scope.mapsDestination = function(room) {
//		console.log("LocationsCtrl.mapsDestination()", room);
		var lat = Number(room.lat());
		var lng = Number(room.lng());
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			return lat + "," + lng;
		}
		return [room.street(), room.zip(), room.city()].filter(Boolean).join(', ');
	};

	////////
	// QR //
	////////
	$scope.showRoomQRCode = function(room, event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		var roomId = room.id();
		var url = LUP_CONFIG.server + 'linkuup.qrforroom.room_id.' + roomId + '.html?_lang=en';
		var target = window.location.href.split('#')[0] + '#!/location/' + roomId + '/chat';
		return DialogSrvc.confirm('js/pages/location/html/lup-room-qr-dialog.html', {url: url, target: target, room: room});
	};


});
