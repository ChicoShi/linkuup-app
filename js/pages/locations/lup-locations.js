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
		LoadingSrvc, WebsocketSrvc, PositionSrvc, RoomSrvc, AuthSrvc, HelpSrvc, UserSrvc, ErrorSrvc, DialogSrvc) {
	
	$scope.data.title = "Entdecken";
	$scope.data.rooms = $scope.data.rooms || [];
	// The rail contains only the currently visible cards. Keeping that list as
	// Angular data prevents category and search results from fighting the DOM.
	$scope.data.visibleRooms = $scope.data.visibleRooms || [];
	$scope.data.searchvalue = $scope.data.searchvalue || '';
	$scope.data.category = Array.isArray($scope.data.category) ? $scope.data.category : [];
	// The compact rail deliberately groups the full catalogue into useful
	// discovery paths. Culture includes education, so a library is one tap away.
	$scope.navigatorCategories = [
		{ids: ['3', '4', '5', '14'], icon: 'local_cafe', label: 'NAV_CAFE'},
		{ids: ['11'], icon: 'nightlife', label: 'NAV_NIGHT'},
		{ids: ['12', '16', '17', '18', '19'], icon: 'theater_comedy', label: 'NAV_CULTURE'},
		{ids: ['13', '15', '20'], icon: 'park', label: 'NAV_OUTDOORS'},
		{ids: ['2', '10'], icon: 'location_city', label: 'NAV_CITIES'},
	];
	// These flags belong to this concrete screen instance. Keeping them on the
	// shared root data object made a return from profile/course reuse stale rail
	// state from a destroyed view.
	var locationsRoomsRendered = false;
	var locationsInitialized = false;
	var initialRoomsTimer = null;
	var initialRoomsRequested = false;
	var initialRoomsPromise = null;
	var fullCataloguePromise = null;
	var categoryRefreshTimer = null;
	// A category choice may start the one-time full-catalogue request. Keep a
	// serial so an older response cannot repaint the rail after a newer choice.
	var categorySelectionSerial = 0;
	var searchBaseRooms = null;
	// Every usable GPS fix turns the current discovery order into a local one.
	// Only the first fix selects the nearest room automatically; later updates
	// must not pull a visitor away from their deliberate selection.
	var nearestRoomInitiallySelected = false;
	// Mobile browsers may emit a click on the card immediately after the rail has
	// completed a horizontal drag. Keep taps working, but discard that trailing
	// synthetic click so a swipe cannot accidentally enter the location.
	var suppressRoomOpenUntil = 0;
	var nativeRailScrollTimer = null;
	var nativeRailFrame = null;
	var nativeRailSelectionFrame = null;
	var doorEntryTimer = null;
	// The selected room belongs to the shared app state, not one concrete
	// LocationsCtrl instance. Preserve it when returning from a room detail.
	$scope.data.currentRoom = $scope.data.currentRoom || null;
	$scope.data.currentRoomIndex = $scope.data.currentRoomIndex === undefined ? -1 : $scope.data.currentRoomIndex;
	$scope.data.doorOpeningRoomId = null;

	// During a route transition Angular can keep a retiring view in the DOM for
	// one digest. Prefer the active rail which already owns cards; `.last()`
	// alone can otherwise select the leaving, empty view and make the live rail
	// appear to have timed out.
	var getRail = function() {
		var $rails = window.jQuery('ng-view .location-rail').filter(function() {
			return !window.jQuery(this).closest('.ng-leave').length;
		});
		var $withSlides = $rails.filter(function() {
			return window.jQuery(this).children('.lup-room-slide-outer').length ||
				window.jQuery(this).find('.lup-room-slide-outer').length;
		});
		return ($withSlides.length ? $withSlides : $rails).last();
	};
	var getLocationRail = function() {
		return getRail().get(0);
	};
	// Each visible card receives a continuous depth value from the actual scroll
	// position. This is deliberately requestAnimationFrame-driven and writes
	// only compositor-friendly custom properties: a fast finger swipe stays one
	// flowing movement instead of becoming a sequence of discrete slider steps.
	var updateRailDepth = function(rail) {
		nativeRailFrame = null;
		// Flat glass cards need no per-frame style writes across the full catalogue.
		if (rail && rail.closest('.navigator-view')) return;
		if (!rail || !rail.clientWidth) {
			return;
		}
		var center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
		var span = Math.max(rail.clientWidth * .72, 1);
		Array.prototype.forEach.call(rail.querySelectorAll('.lup-room-slide-outer[data-room-id]'), function(card) {
			var rect = card.getBoundingClientRect();
			var offset = ((rect.left + rect.width / 2) - center) / span;
			var distance = Math.min(1, Math.abs(offset));
			card.style.setProperty('--lup-rail-scale', (1 - distance * .115).toFixed(3));
			card.style.setProperty('--lup-rail-lift', (distance * 13).toFixed(2) + 'px');
			card.style.setProperty('--lup-rail-tilt', (-Math.max(-1, Math.min(1, offset)) * 5.5).toFixed(2) + 'deg');
			card.style.setProperty('--lup-rail-opacity', (1 - distance * .35).toFixed(3));
			card.classList.toggle('lup-room-slide-current', distance < .18);
		});
	};
	var scheduleRailDepth = function(rail) {
		if (nativeRailFrame !== null) {
			return;
		}
		nativeRailFrame = window.requestAnimationFrame(function() {
			updateRailDepth(rail);
		});
	};
	// Center relative to the rail itself. scrollIntoView() may scroll an ancestor
	// too, and the final card can produce an unnecessary sideways brake.
	var centerRailCard = function(rail, card, behavior) {
		if (!rail || !card) {
			return;
		}
		var maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
		var target = rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left -
			(rail.clientWidth - card.offsetWidth) / 2;
		target = Math.max(0, Math.min(maxScroll, target));
		rail.scrollTo({left: target, top: 0, behavior: behavior || 'auto'});
	};
	var scrollSelectedRoomIntoView = function(behavior) {
		$timeout(function() {
			var rail = getLocationRail();
			if (!rail || !$scope.data.currentRoom) {
				return;
			}
			var roomId = String($scope.data.currentRoom.id());
			var card = rail.querySelector('.lup-room-slide-outer[data-room-id="' + roomId + '"]');
			if (card) {
				centerRailCard(rail, card, behavior);
			}
		}, 0);
	};
	var nearestRailCard = function(rail) {
		var cards = rail.querySelectorAll('.lup-room-slide-outer[data-room-id]');
		if (cards.length && rail.closest('.navigator-view') && rail.clientWidth) {
			return cards[Math.max(0, Math.min(cards.length - 1, Math.round(rail.scrollLeft / rail.clientWidth)))];
		}
		if (!cards.length) {
			return null;
		}
		var center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
		var nearest = null;
		var nearestDistance = Infinity;
		Array.prototype.forEach.call(cards, function(card) {
			var rect = card.getBoundingClientRect();
			var distance = Math.abs((rect.left + rect.width / 2) - center);
			if (distance < nearestDistance) {
				nearest = card;
				nearestDistance = distance;
			}
		});
		return nearest;
	};
	var syncSelectedRoomFromRail = function(rail) {
		var nearest = nearestRailCard(rail);
		if (!nearest) {
			return;
		}
		var roomId = String(nearest.getAttribute('data-room-id'));
		var roomIndex = $scope.data.visibleRooms.findIndex(function(room) {
			return String(room.id()) === roomId;
		});
		if (roomIndex >= 0 && roomIndex !== $scope.data.currentRoomIndex) {
			$scope.$evalAsync(function() {
				$scope.focusRoom(roomIndex);
			});
		}
	};
	// Keep the category indicator in step with the centred card while a native
	// scroll is still moving; the debounce below remains the final settle.
	var scheduleRailSelection = function(rail) {
		if (nativeRailSelectionFrame !== null) {
			return;
		}
		nativeRailSelectionFrame = window.requestAnimationFrame(function() {
			nativeRailSelectionFrame = null;
			syncSelectedRoomFromRail(rail);
		});
	};
	var settleNativeRail = function(rail, target) {
		rail.classList.remove('location-rail-dragging');
		var nearest = target || nearestRailCard(rail);
		if (nearest) centerRailCard(rail, nearest, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
	};
	var initialiseNativeRail = function(rail) {
		if (rail.dataset.lupNativeRail) return;
		rail.dataset.lupNativeRail = '1';
		var gesture = new window.LupLocationGesture();
		var startScroll = 0, startCard = null, activePointer = null;
		var begin = function(x, y) {
			gesture.start(x, y);
			startScroll = rail.scrollLeft;
			startCard = nearestRailCard(rail);
		};
		var move = function(x, y, event) {
			if (!gesture.move(x, y)) return;
			rail.classList.add('location-rail-dragging');
			if (event.cancelable) event.preventDefault();
			var travel = Math.max(-rail.clientWidth * .95, Math.min(rail.clientWidth * .95, gesture.dx));
			rail.scrollLeft = startScroll - travel;
			suppressRoomOpenUntil = Date.now() + 450;
		};
		var finish = function(cancelled) {
			var dragged = gesture.horizontal;
			var step = cancelled ? 0 : gesture.step();
			gesture.cancel();
			if (dragged) {
				var cards = Array.prototype.slice.call(rail.querySelectorAll('.lup-room-slide-outer[data-room-id]'));
				var index = cards.indexOf(startCard);
				var target = cards[Math.max(0, Math.min(cards.length - 1, index + step))];
				suppressRoomOpenUntil = Date.now() + 450;
				settleNativeRail(rail, target);
			}
			startCard = null;
		};
		rail.addEventListener('touchstart', function(event) {
			if (event.touches.length !== 1) { finish(true); return; }
			var touch = event.touches[0]; begin(touch.clientX, touch.clientY);
		}, {passive:true});
		rail.addEventListener('touchmove', function(event) {
			if (event.touches.length !== 1) { finish(true); return; }
			var touch = event.touches[0]; move(touch.clientX, touch.clientY, event);
		}, {passive:false});
		rail.addEventListener('touchend', function() { finish(false); }, {passive:true});
		rail.addEventListener('touchcancel', function() { finish(true); }, {passive:true});
		rail.addEventListener('pointerdown', function(event) {
			if (event.pointerType === 'touch' || event.button !== 0 || event.isPrimary === false) return;
			activePointer = event.pointerId; begin(event.clientX, event.clientY);
		});
		rail.addEventListener('pointermove', function(event) {
			if (event.pointerId !== activePointer) return;
			move(event.clientX, event.clientY, event);
			if (gesture.horizontal && !rail.hasPointerCapture(event.pointerId)) rail.setPointerCapture(event.pointerId);
		});
		var finishPointer = function(event) {
			if (event.pointerId !== activePointer) return;
			activePointer = null;
			finish(event.type !== 'pointerup');
			if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
		};
		rail.addEventListener('pointerup', finishPointer);
		rail.addEventListener('pointercancel', finishPointer);
		rail.addEventListener('lostpointercapture', finishPointer);
		rail.addEventListener('pointerleave', function(event) {
			if (!rail.hasPointerCapture(event.pointerId)) finishPointer(event);
		});
		// All card controls ignore the synthetic click after a drag, not only
		// the primary room button. Normal taps and keyboard activation remain.
		rail.addEventListener('click', function(event) {
			if (event.detail && Date.now() < suppressRoomOpenUntil) {
				event.preventDefault(); event.stopImmediatePropagation();
			}
		}, true);
		rail.addEventListener('scroll', function() {
			scheduleRailDepth(rail);
			scheduleRailSelection(rail);
			if (nativeRailScrollTimer) {
				$timeout.cancel(nativeRailScrollTimer);
			}
			nativeRailScrollTimer = $timeout(function() {
				nativeRailScrollTimer = null;
				syncSelectedRoomFromRail(rail);
			}, 70);
		}, {passive: true});
	};
	// The discovery surface is a rail, never a vertically stacked feed.
	var resizeRecovery = null;
	var railSettleTimer = null;
	var restoreHorizontalRail = function() {
		if ($scope.data.rooms.length) {
			$scope.initialiseRail();
		}
	};
	// A sidenav and route change briefly render the new page at its old width.
	// Let that transition settle, then restore the selected native card.
	var settleHorizontalRail = function() {
		// Several old delayed relayouts used to fire after each category tap.
		// Keep one final selection restore after Angular has painted the changed set.
		if (railSettleTimer) {
			$timeout.cancel(railSettleTimer);
		}
		railSettleTimer = $timeout(function() {
			railSettleTimer = null;
			restoreHorizontalRail();
		}, 120);
	};
	angular.element(window).off('resize.lupLocations orientationchange.lupLocations').on('resize.lupLocations orientationchange.lupLocations', function() {
		// Debounce the many intermediate width values emitted by F12 and phones
		// rotating. Rebuilding once at the final width keeps the rail horizontal.
		if (resizeRecovery) {
			$timeout.cancel(resizeRecovery);
		}
		resizeRecovery = $timeout(function() {
			resizeRecovery = null;
			restoreHorizontalRail(true);
			settleHorizontalRail();
		}, 180);
	});
	$scope.$on('$destroy', function() {
		if (nativeRailScrollTimer) {
			$timeout.cancel(nativeRailScrollTimer);
		}
		if (nativeRailFrame !== null) {
			window.cancelAnimationFrame(nativeRailFrame);
			nativeRailFrame = null;
		}
		if (nativeRailSelectionFrame !== null) {
			window.cancelAnimationFrame(nativeRailSelectionFrame);
			nativeRailSelectionFrame = null;
		}
		if (resizeRecovery) {
			$timeout.cancel(resizeRecovery);
		}
		if (railSettleTimer) {
			$timeout.cancel(railSettleTimer);
		}
		if (initialRoomsTimer) {
			$timeout.cancel(initialRoomsTimer);
		}
		if (categoryRefreshTimer) {
			$timeout.cancel(categoryRefreshTimer);
		}
		angular.element(window).off('resize.lupLocations orientationchange.lupLocations');
	});

	var loadInitialRooms = function() {
		if (initialRoomsRequested) {
			return;
		}
		initialRoomsRequested = true;
		var load = function() {
			if (initialRoomsPromise) {
				return initialRoomsPromise;
			}
			if (initialRoomsTimer) {
				$timeout.cancel(initialRoomsTimer);
				initialRoomsTimer = null;
			}
			initialRoomsPromise = RoomSrvc.withRooms().then($scope.gotRooms, function(error) {
				// The view can be constructed a moment before WebSocket auth completes.
				// That attempt is intentionally retried on the subsequent init event,
				// rather than leaving an empty Locations screen for the entire session.
				initialRoomsRequested = false;
				initialRoomsPromise = null;
				return $q.reject(error);
			})['catch']($scope.catchUnknown);
			return initialRoomsPromise;
		};
		if (PositionSrvc.hasPosition(true)) {
			return load();
		}
		// Locations are meaningful only with a real position.  Waiting here also
		// prevents the former (0,0) fallback from constructing a carousel for the
		// complete public catalogue before GPS has answered.
		return PositionSrvc.withPosition().then(load, angular.noop)['catch']($scope.catchUnknown);
	};
	var requestInitialRooms = function() {
		LoadingSrvc.addTask('ws_rooms');
		var promise = loadInitialRooms();
		if (promise) {
			promise['finally'](function() {
				LoadingSrvc.removeTask('ws_rooms');
			})['catch']($scope.catchUnknown);
		}
		return promise;
	};

	$scope.init = function(event) {
		console.log('LocationsCtrl.init()', event);
		if (!$scope.data.authenticated) {
			return;
		}
		if (locationsInitialized) {
			// Angular recreated this view after navigating back from the sidebar.
			// The room data is still cached, but its rail DOM is new and must be
			// built again; otherwise the discovery view appears broken or stacked.
			if ($scope.data.rooms.length) {
				$timeout(function() { $scope.gotRooms($scope.data.rooms); }, 0);
			}
			else if (!initialRoomsRequested) {
				requestInitialRooms();
			}
			return;
		}
		locationsInitialized = true;
		console.log('LocationsCtrl.init() runs...');
		HelpSrvc.showHelp('help_locations', $translate.instant('HELP_LOCATIONS'));
		if (!$scope.data.rooms.length) {
			$scope.data.user = window.GWF_USER;
			requestInitialRooms();
		}
		else {
			$scope.gotRooms($scope.data.rooms);
		}
		// A visual carousel is optional. Never let one stalled async callback keep
		// the whole discovery page behind the global loading curtain forever.
		$timeout(function() {
			LoadingSrvc.stopTask('ws_rooms');
			LoadingSrvc.stopTask('location_rail');
		}, 3200);
	};
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
	$scope.$on('lup-rooms-ready', function(event, rooms) {
		if (locationsInitialized && rooms && rooms.length) {
			$scope.gotRooms(rooms);
		}
	});
	$scope.$on('lup-rooms-resorted', function(event, roomId) {
		if (!locationsInitialized || !roomId) {
			return;
		}
		// Sorting must never throw the visitor back to the first card.
		$timeout(function() {
			if (!restoreSelectedRoom(roomId, false)) {
				return; // It is intentionally hidden by the active category/search.
			}
			scrollSelectedRoomIntoView('auto');
		}, 40);
	});
	$scope.$on('gwf-position-changed', function() {
		// Distance labels are calculated live on the room model. Ensure this
		// screen receives an Angular render immediately when GPS arrives, even if
		// it was opened from the sidenav while the first probe was pending.
		if (sortAndSelectNearestRoom()) {
			// Restore the selected card after Angular has applied the sorted list.
			$timeout(function() {
				$scope.refreshCategoryFilter();
				settleHorizontalRail();
			}, 0);
		}
		else {
			$timeout(settleHorizontalRail, 0);
		}
	});
	$scope.requestLocation = function(room, event) {
		event.stopPropagation();
		if (PositionSrvc.hasPosition(true)) {
			return; // Normal case: keep the route link working.
		}
		// A user gesture is the correct time to request browser geolocation. It
		// avoids repeated startup dialogs and gives the distance button a clear,
		// honest purpose until the exact position is available.
		event.preventDefault();
		PositionSrvc.probe().then(function(position) {
			$scope.updatePosition(position);
			return RoomSrvc.withRooms();
		}).then($scope.gotRooms, function(error) {
			console.warn('LinkUUp: location permission was not granted.', error);
		})['catch']($scope.catchUnknown);
	};
	
	$scope.gotRooms = function(rooms) {
		var roomId = selectedRoomId();
		// Both the page and the background preload can observe the same promise.
		if (locationsRoomsRendered && $scope.data.rooms === rooms) {
			$scope.updateVisibleRooms();
			sortAndSelectNearestRoom();
			return $scope.refreshCategoryFilter();
		}
		$scope.data.rooms = rooms;
		$scope.updateVisibleRooms();
		sortAndSelectNearestRoom();
		// A newly loaded category may exclude the previous room. Its first
		// visible card must own pagination immediately, even before a scroll.
		restoreSelectedRoom(roomId, true);
		locationsRoomsRendered = true;
		LoadingSrvc.addTask('location_rail');
		$timeout(function() {
			$scope.initialiseRail();
			settleHorizontalRail();
		}, 16);
	};
	
	$scope.maybeGotoRoom = function(room, event) {
		if (Date.now() < suppressRoomOpenUntil) {
			if (event) {
				event.preventDefault();
				event.stopPropagation();
			}
			return;
		}
		console.log('LocationsCtrl.maybeGotoRoom()', room);
		// data.rooms keeps the complete list while the rail is filtered. The clicked
		// card is authoritative after selecting a category.
		// Chat and Online still enforce the location radius in the detail view.
		RoomSrvc.CACHE[room.id()] = room;
		$scope.data.currentRoom = room;
		$scope.data.currentRoomIndex = $scope.data.visibleRooms.indexOf(room);
		$scope.gotoRoom(room);
	};

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

	// Entering a room is the one deliberate transition on the discovery card.
	// The short delay gives the physical door gesture time to close before the
	// route changes; tapping the handle remains equivalent to pulling it.
	$scope.enterChatDoor = function(room) {
		if (!room || !room.inChatRange() || $scope.data.doorOpeningRoomId) {
			return;
		}
		$scope.data.doorOpeningRoomId = room.id();
		doorEntryTimer = $timeout(function() {
			$scope.data.doorOpeningRoomId = null;
			$scope.gotoChat(room);
		}, 330, false);
	};
	$scope.$on('$destroy', function() {
		if (doorEntryTimer) {
			$timeout.cancel(doorEntryTimer);
		}
	});

	$scope.initialiseRail = function() {
		var rail = getLocationRail();
		if (!rail) {
			LoadingSrvc.removeTask('location_rail');
			return;
		}
		// This name remains temporarily because the surrounding data flow calls it,
		// but it now only prepares the native rail. No plugin state, cloning or
		// reinitialisation is involved.
		initialiseNativeRail(rail);
		rail.classList.add('location-rail-ready');
		rail.classList.remove('lup-category-refreshing');
		scheduleRailDepth(rail);
		LoadingSrvc.removeTask('location_rail');
		scrollSelectedRoomIntoView('auto');
	};
	
	$scope.focusRoom = function(roomIndex) {
		console.log('LocationsCtrl.focusRoom()', roomIndex);
		if ($scope.data.currentRoomIndex != roomIndex) {
			var room = $scope.data.visibleRooms[roomIndex];
			if (room) {
				$scope.data.currentRoom = room;
				$scope.data.currentRoomIndex = roomIndex;
			}
		}
	};

	$scope.focusSlide = function($slide) {
		var roomId = String($slide && $slide.attr('data-room-id') || '');
		var room = $scope.data.visibleRooms.find(function(candidate) {
			return String(candidate.id()) === roomId;
		});
		if (room) {
			$scope.data.currentRoom = room;
			$scope.data.currentRoomIndex = $scope.data.visibleRooms.indexOf(room);
			// The initial room catalogue already carries its presence list and
			// WebSocket join/part events keep it current. A round trip for every
			// swipe made longer city rails visibly stutter after a few cards.
		}
	};

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
	// Suchfilter //
	////////////////
	$scope.filteredRoom = function(room) {
		var categoryMatches = !$scope.data.category.length || $scope.data.category.indexOf(String(room.category())) >= 0;
		if (!categoryMatches) {
			return false;
		}
		return true;
	};

	$scope.navigatorHasGPS = function() { return PositionSrvc.hasPosition(true); };
	$scope.navigatorCategories = [
		{ids:[], icon:'explore', label:'NAV_ALL'},
		{ids:['3','4','5','14'], icon:'local_cafe', label:'NAV_CAFE'},
		{ids:['11'], icon:'nightlife', label:'NAV_NIGHT'},
		{ids:['12','16','17'], icon:'account_balance', label:'NAV_CULTURE'},
		{ids:['13','15','18'], icon:'park', label:'NAV_OUTDOORS'},
		{ids:['1','2','10'], icon:'location_city', label:'NAV_CITIES'}
	];
	$scope.resetNavigator = function() {
		$scope.data.searchvalue = '';
		$scope.selectCategory([]);
		$scope.searchLocation('');
	};
	$scope.stepNavigator = function(direction) {
		var index = Math.max(0, Math.min($scope.data.visibleRooms.length - 1, $scope.data.currentRoomIndex + direction));
		if (!$scope.data.visibleRooms[index]) return;
		$scope.focusRoom(index);
		scrollSelectedRoomIntoView(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
	};
	var normalizeSearch = function(value) {
		return String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
	};
	$scope.updateVisibleRooms = function() {
		var categories = $scope.data.category;
		var terms = normalizeSearch($scope.data.searchvalue).trim().split(/\s+/).filter(Boolean);
		$scope.data.visibleRooms = $scope.data.rooms.filter(function(room) {
			var categoryMatches = !categories.length || categories.indexOf(String(room.category())) >= 0;
			if (!categoryMatches) return false;
			var haystack = normalizeSearch([room.name(), room.city(), room.street(), room.zip(), room.categoryName()]
				.filter(Boolean).join(' '));
			return terms.every(function(term) { return haystack.indexOf(term) >= 0; });
		});
	};

	var selectedRoomId = function() {
		return $scope.data.currentRoom ? String($scope.data.currentRoom.id()) : '';
	};
	var restoreSelectedRoom = function(roomId, fallback) {
		var roomIndex = $scope.data.visibleRooms.findIndex(function(room) {
			return String(room.id()) === String(roomId);
		});
		if (roomIndex < 0 && fallback && $scope.data.visibleRooms.length) {
			roomIndex = 0;
		}
		if (roomIndex < 0) {
			$scope.data.currentRoom = null;
			$scope.data.currentRoomIndex = -1;
			return false;
		}
		$scope.data.currentRoom = $scope.data.visibleRooms[roomIndex];
		$scope.data.currentRoomIndex = roomIndex;
		return true;
	};

	var sortAndSelectNearestRoom = function() {
		if (!PositionSrvc.hasPosition(true) || !$scope.data.rooms.length) {
			return false;
		}
		var orderBefore = $scope.data.rooms.map(function(room) { return room.id(); }).join(',');
		$scope.data.rooms.sort(RoomSrvc.sortDistance);
		$scope.updateVisibleRooms();
		if (!$scope.data.visibleRooms.length) {
			return false;
		}
		var reordered = orderBefore !== $scope.data.rooms.map(function(room) { return room.id(); }).join(',');
		if (!nearestRoomInitiallySelected) {
			nearestRoomInitiallySelected = true;
			$scope.data.currentRoom = $scope.data.visibleRooms[0];
			$scope.data.currentRoomIndex = 0;
			return true;
		}
		if ($scope.data.currentRoom) {
			$scope.data.currentRoomIndex = $scope.data.visibleRooms.findIndex(function(room) {
				return room.id() === $scope.data.currentRoom.id();
			});
		}
		// Tell the caller whether the rendered list changed order.
		return reordered;
	};

	// The selected filter and the centred room category are distinct states.
	// A rail swipe must not look like a category filter choice.
	$scope.isCategoryFilterActive = function(categories) {
		return $scope.data.category.join(',') === categories.join(',');
	};

	$scope.isCurrentRoomCategory = function(categories) {
		return categories.length > 0 && !!$scope.data.currentRoom &&
			categories.indexOf(String($scope.data.currentRoom.category())) >= 0;
	};

	var scheduleCategoryRefresh = function(selectionSerial) {
		// Coalesce a quick category burst: only the final choice is rendered.
		if (categoryRefreshTimer) {
			$timeout.cancel(categoryRefreshTimer);
		}
		categoryRefreshTimer = $timeout(function() {
			categoryRefreshTimer = null;
			if (selectionSerial !== undefined && selectionSerial !== categorySelectionSerial) {
				return;
			}
			$scope.refreshCategoryFilter(selectionSerial);
		}, 16);
	};

	$scope.selectCategory = function(categories) {
		var categoryKey = categories.join(',');
		if ($scope.isCategoryFilterActive(categories)) {
			// Repeating the active category is a small navigation shortcut: keep
			// its filter (and any current search) but return to its first card.
			if ($scope.data.visibleRooms.length) {
				$scope.data.currentRoom = $scope.data.visibleRooms[0];
				$scope.data.currentRoomIndex = 0;
				$timeout(function() {
					scrollSelectedRoomIntoView('smooth');
				}, 0);
			}
			return;
		}
		var selectionSerial = ++categorySelectionSerial;
		var needsFullCatalogue = categories.length && !$scope.data.fullCatalogue;
		// The chip reacts immediately; Angular replaces direct native rail cards.
		$scope.data.category = categories.slice(0);
		if (needsFullCatalogue) {
			$scope.data.categoryLoading = true;
			var $currentRail = getRail();
			if ($currentRail.length) {
				$currentRail.addClass('lup-category-refreshing');
			}
			if (!fullCataloguePromise) {
				fullCataloguePromise = RoomSrvc.withRooms(true).then(function(rooms) {
					$scope.data.fullCatalogue = rooms;
					return rooms;
				}).finally(function() {
					fullCataloguePromise = null;
				});
			}
			fullCataloguePromise.then(function(rooms) {
				if (selectionSerial === categorySelectionSerial &&
					$scope.data.category.join(',') === categoryKey) {
					$scope.gotRooms(rooms);
				}
			}, function(error) {
				console.warn('LinkUUp: full location catalogue could not be loaded.', error);
				if (selectionSerial === categorySelectionSerial) {
					$scope.updateVisibleRooms();
					$scope.refreshCategoryFilter();
				}
			}).finally(function() {
				if (selectionSerial === categorySelectionSerial) {
					$scope.data.categoryLoading = false;
				}
			})['catch']($scope.catchUnknown);
			return;
		}
		// If "Alle" is selected while that optional request is still pending,
		// the existing local rail already is the desired view. Leave it alone.
		if (!categories.length && fullCataloguePromise && !$scope.data.fullCatalogue) {
			return;
		}
		$scope.updateVisibleRooms();
		// The first explicit category loads the full catalogue once.  If the
		// visitor changed tabs while that request was in flight, the catalogue is
		// already cached but the old nearby room list may still be on screen.
		// Promote the cached list before filtering it; otherwise a category can
		// appear to have missing cards or briefly select the wrong chip.
		if ($scope.data.category.length && $scope.data.fullCatalogue &&
			$scope.data.rooms !== $scope.data.fullCatalogue) {
			$scope.gotRooms($scope.data.fullCatalogue);
			return;
		}
		// Let Angular paint the filtered direct children before restoring selection.
		scheduleCategoryRefresh(selectionSerial);
	};

	$scope.refreshCategoryFilter = function(selectionSerial) {
		if (selectionSerial !== undefined && selectionSerial !== categorySelectionSerial) {
			return;
		}
		restoreSelectedRoom(selectedRoomId(), true);
		if (!$scope.data.rooms.length) {
			return;
		}
		$timeout(function() {
			if (selectionSerial === undefined || selectionSerial === categorySelectionSerial) {
				$scope.initialiseRail();
				settleHorizontalRail();
			}
		}, 0);
	};

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

	// Long real-world venue names need a deliberate typographic tier, not a
	// one-size-fits-all headline that runs beyond the card on smaller phones.
	$scope.roomNameClass = function(room) {
		var name = (room.name() || '').trim();
		var length = name.length;
		var longestWord = name.split(/\s+/).reduce(function(longest, word) {
			return Math.max(longest, word.length);
		}, 0);
		if (longestWord > 15) {
			return 'room-hero-name--longword';
		}
		if (length > 25) {
			return 'room-hero-name--long';
		}
		if (length > 14) {
			return 'room-hero-name--compact';
		}
		return 'room-hero-name--regular';
	};
	
	$scope.searchLocation = function(query) {
		console.log("LocationCtrl.searchLocation()", query);
		query = (query || '').trim();
		var render = function(rooms) {
			if ($scope.data.rooms === rooms) {
				$scope.updateVisibleRooms();
				return $scope.refreshCategoryFilter();
			}
			return $scope.gotRooms(rooms);
		};
		// Searching is an explicit discovery action. Load the public catalogue
		// once, then filter it locally for every keystroke. This keeps category
		// state intact and avoids a WebSocket request/rail rebuild per character.
		if (query) {
			if (!searchBaseRooms) {
				searchBaseRooms = $scope.data.rooms;
			}
			if ($scope.data.fullCatalogue) {
				return render($scope.data.fullCatalogue);
			}
			if (!fullCataloguePromise) {
				fullCataloguePromise = RoomSrvc.withRooms(true).then(function(rooms) {
					$scope.data.fullCatalogue = rooms;
					return rooms;
				}).finally(function() {
					fullCataloguePromise = null;
				});
			}
			return fullCataloguePromise.then(function(rooms) {
				// Several keystrokes can share the same loading promise. Only the
				// final query may render when that one catalogue request completes.
				if (($scope.data.searchvalue || '').trim() === query) {
					render(rooms);
				}
			}, function(error) {
				console.warn('LinkUUp: full location catalogue could not be loaded for search.', error);
			})['catch']($scope.catchUnknown);
		}
		if (searchBaseRooms) {
			var restoreRooms = $scope.data.category.length && $scope.data.fullCatalogue ?
				$scope.data.fullCatalogue : searchBaseRooms;
			searchBaseRooms = null;
			return render(restoreRooms);
		}
		$scope.updateVisibleRooms();
		return $scope.refreshCategoryFilter();
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

	$scope.sortedVisitors = function(room) {
		return UserSrvc.sortedUsers(room.USERS);
	};

	$scope.visitorOverflowLabel = function(room) {
		// Two compact rows keep ten faces recognisable on a phone; the badge
		// represents everyone beyond the visible preview.
		var remaining = Math.max(0, (room.USERS || []).length - 10);
		return remaining > 99 ? '99+' : remaining;
	};

	$scope.visitorCountLabel = function(room) {
		var count = (room.USERS || []).length;
		return count > 99 ? '99+' : count;
	};
	

});
