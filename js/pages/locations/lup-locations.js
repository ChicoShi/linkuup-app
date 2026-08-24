"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/locations', {
		templateUrl: 'js/pages/locations/lup-locations.html?v='+window.LUP_BUILD,
		controller: 'LocationsCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('LocationsCtrl', function($scope, $location, $translate, $timeout, $mdDialog,
		LoadingSrvc, WebsocketSrvc, PositionSrvc, RoomSrvc, AuthSrvc, HelpSrvc, UserSrvc, ErrorSrvc, DialogSrvc) {
	
	$scope.data.title = "Entdecken";
	$scope.data.rooms = $scope.data.rooms || [];
	// The rail contains only the currently visible cards. Keeping that list as
	// Angular data prevents category and search results from fighting the DOM.
	$scope.data.visibleRooms = $scope.data.visibleRooms || [];
	$scope.data.searchvalue = $scope.data.searchvalue || '';
	$scope.data.category = Array.isArray($scope.data.category) ? $scope.data.category : [];
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
	$scope.data.currentRoom = null;
	$scope.data.currentRoomIndex = -1;

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
	var scrollSelectedRoomIntoView = function(behavior) {
		$timeout(function() {
			var rail = getLocationRail();
			if (!rail || !$scope.data.currentRoom) {
				return;
			}
			var roomId = String($scope.data.currentRoom.id());
			var card = rail.querySelector('.lup-room-slide-outer[data-room-id="' + roomId + '"]');
			if (card) {
				card.scrollIntoView({behavior: behavior || 'auto', block: 'nearest', inline: 'center'});
			}
		}, 0);
	};
	var nearestRailCard = function(rail) {
		var cards = rail.querySelectorAll('.lup-room-slide-outer[data-room-id]');
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
	var settleNativeRail = function(rail) {
		rail.classList.remove('location-rail-dragging');
		$timeout(function() {
			var nearest = nearestRailCard(rail);
			if (nearest) {
				nearest.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
			}
		}, 0);
	};
	var initialiseNativeRail = function(rail) {
		if (rail.dataset.lupNativeRail) {
			return;
		}
		rail.dataset.lupNativeRail = '1';
		var touchStartX = null;
		var touchStartY = null;
		var touchStartScrollLeft = 0;
		var draggingHorizontally = false;
		rail.addEventListener('touchstart', function(event) {
			var touch = event.touches[0];
			touchStartX = touch ? touch.clientX : null;
			touchStartY = touch ? touch.clientY : null;
			touchStartScrollLeft = rail.scrollLeft;
			draggingHorizontally = false;
		}, {passive: true});
		rail.addEventListener('touchmove', function(event) {
			var touch = event.touches[0];
			if (touchStartX === null || !touch) {
				return;
			}
			var deltaX = touch.clientX - touchStartX;
			var deltaY = touch.clientY - touchStartY;
			if (!draggingHorizontally && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
				draggingHorizontally = true;
				rail.classList.add('location-rail-dragging');
			}
			if (draggingHorizontally) {
				// Take ownership of horizontal drags so nested card click handlers
				// cannot turn a short swipe into opening the location.
				event.preventDefault();
				rail.scrollLeft = touchStartScrollLeft - deltaX;
				suppressRoomOpenUntil = Date.now() + 450;
			}
		}, {passive: false});
		rail.addEventListener('touchend', function() {
			touchStartX = null;
			touchStartY = null;
			if (draggingHorizontally) {
				suppressRoomOpenUntil = Date.now() + 450;
				settleNativeRail(rail);
			}
		}, {passive: true});
		// Desktop users used Slick's mouse dragging too. Keep the same affordance
		// for every PointerEvent-capable browser without involving a slider plugin.
		var pointerStartX = null;
		var pointerStartY = null;
		var pointerStartScrollLeft = 0;
		var draggingPointer = false;
		rail.addEventListener('pointerdown', function(event) {
			if (event.pointerType === 'touch') {
				return; // The touch fallback above owns this gesture.
			}
			pointerStartX = event.clientX;
			pointerStartY = event.clientY;
			pointerStartScrollLeft = rail.scrollLeft;
			draggingPointer = false;
		});
		rail.addEventListener('pointermove', function(event) {
			if (pointerStartX === null) {
				return;
			}
			var deltaX = event.clientX - pointerStartX;
			var deltaY = event.clientY - pointerStartY;
			if (!draggingPointer && Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
				draggingPointer = true;
				rail.setPointerCapture(event.pointerId);
				rail.classList.add('location-rail-dragging');
			}
			if (draggingPointer) {
				event.preventDefault();
				rail.scrollLeft = pointerStartScrollLeft - deltaX;
				suppressRoomOpenUntil = Date.now() + 500;
			}
		});
		rail.addEventListener('pointerup', function(event) {
			if (draggingPointer) {
				suppressRoomOpenUntil = Date.now() + 500;
				settleNativeRail(rail);
			}
			pointerStartX = null;
			pointerStartY = null;
			if (rail.hasPointerCapture(event.pointerId)) {
				rail.releasePointerCapture(event.pointerId);
			}
		});
		rail.addEventListener('scroll', function() {
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
			initialRoomsPromise = RoomSrvc.withRooms().then($scope.gotRooms);
			return initialRoomsPromise;
		};
		if (PositionSrvc.hasPosition()) {
			return load();
		}
		// Locations are meaningful only with a real position.  Waiting here also
		// prevents the former (0,0) fallback from constructing a carousel for the
		// complete public catalogue before GPS has answered.
		return PositionSrvc.withPosition().then(load, angular.noop);
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
			return;
		}
		locationsInitialized = true;
		console.log('LocationsCtrl.init() runs...');
		HelpSrvc.showHelp('help_locations', $translate.instant('HELP_LOCATIONS'));
		if (!$scope.data.rooms.length) {
			$scope.data.user = window.GWF_USER;
			LoadingSrvc.addTask('ws_rooms');
			var promise = loadInitialRooms();
			promise['finally'](function(){
				LoadingSrvc.removeTask('ws_rooms');
			});
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
		});
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
		restoreSelectedRoom(roomId, !roomId && nearestRoomInitiallySelected);
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
		$scope.gotoRoom(room);
	};

	$scope.showRoomQRCode = function(room, event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		var roomId = room.id();
		var url = LUP_CONFIG.server + 'linkuup;qrforroom;room_id;' + roomId + '.html?_lang=en';
		var target = window.location.href.split('#')[0] + '#!/location/' + roomId + '/chat';
		return DialogSrvc.confirm('js/pages/location/html/lup-room-qr-dialog.html', {url: url, target: target});
	};

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

	$scope.updateVisibleRooms = function() {
		var categories = $scope.data.category;
		var query = ($scope.data.searchvalue || '').trim().toLocaleLowerCase();
		$scope.data.visibleRooms = $scope.data.rooms.filter(function(room) {
			var categoryMatches = !categories.length || categories.indexOf(String(room.category())) >= 0;
			if (!categoryMatches || !query) {
				return categoryMatches;
			}
			var haystack = [room.name(), room.city(), room.street(), room.zip(), room.categoryName()]
				.filter(Boolean).join(' ').toLocaleLowerCase();
			return haystack.indexOf(query) >= 0;
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

	$scope.isCategoryActive = function(categories) {
		return $scope.data.category.join(',') === categories.join(',');
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
		if ($scope.isCategoryActive(categories) && !$scope.data.searchvalue) {
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
			});
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
			'1': {icon: 'public', class: 'category-country'},
			'2': {icon: 'location_city', class: 'category-city'},
			'3': {icon: 'local_bar', class: 'category-bar'},
			'4': {icon: 'sports_bar', class: 'category-pub'},
			'5': {icon: 'local_cafe', class: 'category-cafe'},
			'6': {icon: 'business', class: 'category-business'},
			'7': {icon: 'shopping_cart', class: 'category-shop'},
			'8': {icon: 'account_balance', class: 'category-religion'},
			'9': {icon: 'content_cut', class: 'category-salon'},
			'10': {icon: 'map', class: 'category-town'},
			'11': {icon: 'nightlife', class: 'category-club'},
			'12': {icon: 'theater_comedy', class: 'category-culture'},
			'13': {icon: 'sports_soccer', class: 'category-sport'},
			'14': {icon: 'restaurant', class: 'category-food'},
			'15': {icon: 'park', class: 'category-outdoors'},
			'16': {icon: 'school', class: 'category-community'},
			'17': {icon: 'account_balance', class: 'category-university'},
			'18': {icon: 'local_hospital', class: 'category-health'},
			'19': {icon: 'hotel', class: 'category-hotel'},
		};
		return visuals[String(room.category())] || {icon: 'place', class: 'category-default'};
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
			});
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
