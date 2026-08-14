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
	$scope.data.searchvalue = $scope.data.searchvalue || '';
	$scope.data.category = Array.isArray($scope.data.category) ? $scope.data.category : [];
	// These flags belong to this concrete screen instance. Keeping them on the
	// shared root data object made a return from profile/course reuse stale Slick
	// state from a destroyed view.
	var slickedEvents = false;
	var locationsRoomsRendered = false;
	var locationsInitialized = false;
	$scope.data.currentRoom = null;
	$scope.data.currentRoomIndex = -1;

	// The discovery surface is a rail, never a vertically stacked feed.  Browser
	// resizing (especially device emulation) can make Slick recalculate its track;
	// explicitly restore the horizontal geometry instead of allowing a raw list.
	var restoreHorizontalRail = function() {
		var $slick = window.jQuery('.slickit');
		if (!$slick.length) {
			return;
		}
		if ($slick.hasClass('slick-initialized')) {
			try {
				$slick.slick('setPosition').addClass('slick-inited');
			}
			catch (error) {
				console.warn('LinkUUp: could not restore the location rail.', error);
			}
		}
		else if ($scope.data.rooms.length) {
			$scope.slick(true);
		}
	};
	// A sidenav and route change briefly render the new page at its old width.
	// Let that transition settle, then make Slick measure the real viewport again.
	var settleHorizontalRail = function() {
		[0, 80, 180, 360, 650].forEach(function(delay) {
			$timeout(restoreHorizontalRail, delay);
		});
	};
	angular.element(window).off('resize.lupLocations orientationchange.lupLocations').on('resize.lupLocations orientationchange.lupLocations', function() {
		$timeout(restoreHorizontalRail, 80);
	});
	$scope.$on('$destroy', function() {
		angular.element(window).off('resize.lupLocations orientationchange.lupLocations');
	});

	$scope.init = function(event) {
		console.log('LocationsCtrl.init()', event);
		if (!$scope.data.authenticated) {
			return;
		}
		if (locationsInitialized) {
			// Angular recreated this view after navigating back from the sidebar.
			// The room data is still cached, but its Slick DOM is new and must be
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
			var promise = RoomSrvc.withRooms().then($scope.gotRooms);
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
			LoadingSrvc.stopTask('slick_rooms');
		}, 3200);
	};
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
	$scope.$on('lup-rooms-ready', function(event, rooms) {
		if (locationsInitialized && rooms && rooms.length) {
			$scope.gotRooms(rooms);
		}
	});
	$scope.$on('gwf-position-changed', function() {
		// Distance labels are calculated live on the room model. Ensure this
		// screen receives an Angular render immediately when GPS arrives, even if
		// it was opened from the sidenav while the first probe was pending.
		$timeout(settleHorizontalRail, 0);
	});
	$scope.requestLocation = function(room, event) {
		if (PositionSrvc.hasPosition(true)) {
			return; // Normal case: keep the route link working.
		}
		// A user gesture is the correct time to request browser geolocation. It
		// avoids repeated startup dialogs and gives the distance button a clear,
		// honest purpose until the exact position is available.
		event.preventDefault();
		event.stopPropagation();
		PositionSrvc.probe().then(function(position) {
			$scope.updatePosition(position);
			return RoomSrvc.withRooms();
		}).then($scope.gotRooms, function(error) {
			console.warn('LinkUUp: location permission was not granted.', error);
		});
	};
	
	$scope.gotRooms = function(rooms) {
		// Both the page and the background preload can observe the same promise.
		// Render that result once; Slick otherwise performs needless work and can
		// keep its visibility guard active longer than necessary.
		var $slick = window.jQuery('.slickit');
		if (locationsRoomsRendered && $scope.data.rooms === rooms &&
			$slick.length && $slick.hasClass('slick-initialized')) {
			return;
		}
		$scope.data.rooms = rooms;
		locationsRoomsRendered = true;
		LoadingSrvc.addTask('slick_rooms');
		// Angular renders the repeated rooms asynchronously. Never reveal the
		// raw repeated cards as a vertical list while that render is catching up:
		// retry the horizontal carousel until it has real slides to initialise.
		$timeout(function() {
			$scope.slick(true);
			settleHorizontalRail();
		}, 0);
	};
	
	$scope.maybeGotoRoom = function(room) {
		console.log('LocationsCtrl.maybeGotoRoom()', room);
		// Slick indexes its filtered slides, while data.rooms keeps the complete
		// list. Comparing a visible room with currentRoom can therefore reject a
		// valid tap after selecting a category. The clicked card is authoritative.
		// Chat and Online still enforce the location radius in the detail view.
		RoomSrvc.CACHE[room.id()] = room;
		$scope.gotoRoom(room);
	};

	// Room cuddles will be supplied by the QR check-in protocol.  Until then the
	// counter remains an honest zero instead of borrowing unrelated visitor data.
	$scope.roomCuddles = function(room) {
		return Math.max(0, Number(room && room.JSON && room.JSON.room_cuddles) || 0);
	};

	$scope.showRoomCuddleQRCode = function(room, event) {
		if (event) {
			event.stopPropagation();
		}
		return DialogSrvc.confirm('js/pages/locations/lup-location-cuddle-dialog.html', {room: room});
	};
	
	$scope.slick = function(nofocus) {
		console.log('LocationsCtrl.slick()');
		var $slick = window.jQuery('.slickit');
		if (!$slick.length) {
			LoadingSrvc.removeTask('slick_rooms');
			return;
		}
		if (!$slick.children().length) {
			return;
		}
		if ($slick.hasClass('slick-initialized')) {
			try {
				$slick.slick('setPosition');
			}
			catch (error) {
				console.warn('LinkUUp: could not relayout the location rail.', error);
			}
			$slick.addClass('slick-inited');
			LoadingSrvc.removeTask('slick_rooms');
			return;
		}

		if (!slickedEvents) {
			slickedEvents = true;
			$slick.off('.lupSlick').on('init.lupSlick', function(){
				console.log('slickit.onInit()');
				if ($scope.data.currentRoomIndex >= 0) {
					setTimeout(function(){
						window.jQuery('.slickit').slick('slickGoTo', $scope.data.currentRoomIndex, true);
					}, 10);
				}
				window.jQuery('.slickit').addClass('slick-inited');
				LoadingSrvc.removeTask('slick_rooms');
			}).on('beforeChange.lupSlick', function(event, slick, currentSlide, nextSlide) {
				// Give every change of place a clear direction. The CSS uses this
				// lightweight state to stage the destination rather than merely
				// sliding a static card sideways.
				$slick.removeClass('lup-swipe-forward lup-swipe-backward')
					.addClass(nextSlide > currentSlide ? 'lup-swipe-forward' : 'lup-swipe-backward');
				$scope.focusSlide(slick.$slides.eq(nextSlide));
			});
		}
		
		try {
		$slick.slick({
			arrows: false,
			centerMode: false,
			slidesToShow: 1,
			slidesToScroll: 1,
			focusOnSelect: false,
			mobileFirst: true,
			variableWidth: false,
			// Discovery should never appear to stop at the last city. A location
			// catalogue is explored continuously; the active filter still limits
			// the rail to its selected category.
			infinite: true,
			swipe: true,
			touchMove: true,
			draggable: true,
			vertical: false,
			verticalSwiping: false,
			swipeToSlide: true,
			waitForAnimate: false,
			edgeFriction: 0.22,
			speed: 155,
			cssEase: 'cubic-bezier(.22,.78,.24,1)',
			touchThreshold: 4,
		}).slick('slickFilter', function() {
			// Filter by stable data attributes, not an Angular class that can be
			// between digest updates while Slick rebuilds its slides.
			var category = String(window.jQuery(this).attr('data-room-category'));
			return !$scope.data.category.length || $scope.data.category.indexOf(category) >= 0;
		});
		} catch (error) {
			console.warn('LinkUUp carousel unavailable; keeping the place rail hidden.', error);
			LoadingSrvc.removeTask('slick_rooms');
			return;
		}
		
		if (!nofocus) {
//			$scope.focusRoom(0);
			$scope.$apply();
		}
	};
	
	$scope.focusRoom = function(roomIndex) {
		console.log('LocationsCtrl.focusRoom()', roomIndex);
		if ($scope.data.currentRoomIndex != roomIndex) {
			var room = $scope.data.rooms[roomIndex];
			if (room) {
				$scope.data.currentRoom = room;
				$scope.data.currentRoomIndex = roomIndex;
				RoomSrvc.withUsers(room);
			}
		}
	};

	$scope.focusSlide = function($slide) {
		var roomId = String($slide && $slide.attr('data-room-id') || '');
		var room = $scope.data.rooms.find(function(candidate) {
			return String(candidate.id()) === roomId;
		});
		if (room) {
			$scope.data.currentRoom = room;
			$scope.data.currentRoomIndex = $scope.data.rooms.indexOf(room);
			RoomSrvc.withUsers(room);
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

	$scope.isCategoryActive = function(categories) {
		return $scope.data.category.join(',') === categories.join(',');
	};

	$scope.selectCategory = function(categories) {
		$scope.data.category = categories.slice(0);
		// Do not retain a focus object from the previously filtered carousel.
		$scope.data.currentRoom = null;
		$scope.data.currentRoomIndex = -1;
		// Let Angular update slide classes, then always use the same Slick path.
		// Previously "Alle" and the other categories used competing recovery
		// paths, which could leave the filter bar visually active but inert.
		$timeout(function() {
			$scope.refreshCategoryFilter();
		}, 0);
	};

	$scope.refreshCategoryFilter = function() {
		var $slick = window.jQuery('.slickit');
		if (!$slick.length || !$scope.data.rooms.length) {
			return;
		}
		if (!$slick.hasClass('slick-initialized')) {
			return $scope.slick();
		}
		try {
			$slick.slick('slickUnfilter');
			if ($scope.data.category.length) {
				var categories = $scope.data.category.slice(0);
				$slick.slick('slickFilter', function() {
					return categories.indexOf(String(window.jQuery(this).attr('data-room-category'))) >= 0;
				});
			}
			$slick.slick('slickGoTo', 0, true);
			$slick.slick('setPosition').addClass('slick-inited');
		}
		catch (error) {
			console.warn('LinkUUp: category filter could not refresh the carousel.', error);
			$slick.addClass('slick-inited');
		}
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
	
	/**
	 * This one was tricky!
	 * on a keyup we restore slick slide by calling unfilter.
	 * Then we untouch slick and reset it by calling slick again.
	 */
	$scope.searchLocation = function(query) {
		console.log("LocationCtrl.searchLocation()", query);
		query = (query || '').trim();
		// Nearby discovery stays within the 6 km visibility radius. Searches go
		// to the server and return only matching rooms, never the full catalogue.
		if (query && $scope.data.searchSource !== query) {
			$scope.data.searchSource = query;
			RoomSrvc.searchRooms(query).then(function(rooms) {
				// Requests for earlier keystrokes can resolve after the user has
				// already typed more. Never let an old answer replace the current one.
				if (($scope.data.searchvalue || '').trim() !== query) {
					return;
				}
				$scope.data.rooms = rooms;
				$timeout(function() { $scope.searchLocation(query); }, 180);
			}, function(error) {
				if (($scope.data.searchvalue || '').trim() === query) {
					$scope.data.searchSource = null;
				}
				console.warn('LinkUUp: location search failed.', error);
			});
			return;
		}
		if (!query && $scope.data.searchSource) {
			$scope.data.searchSource = null;
			RoomSrvc.withRooms().then($scope.gotRooms, function(error) {
				console.warn('LinkUUp: nearby location refresh failed.', error);
			});
			return;
		}
		$scope.refreshCategoryFilter();
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
		// Five faces remain recognisable on a phone; the badge represents the rest.
		var remaining = Math.max(0, (room.USERS || []).length - 5);
		return remaining > 99 ? '99+' : remaining;
	};

	$scope.visitorCountLabel = function(room) {
		var count = (room.USERS || []).length;
		return count > 99 ? '99+' : count;
	};
	

});
