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
	$scope.data.slickedEvents = false;
	$scope.data.locationsRoomsRendered = false;
	$scope.data.locationsInitialized = false;
	$scope.data.currentRoom = null;
	$scope.data.currentRoomIndex = -1;

	$scope.init = function(event) {
		console.log('LocationsCtrl.init()', event);
		if (!$scope.data.authenticated) {
			return;
		}
		if ($scope.data.locationsInitialized) {
			return;
		}
		$scope.data.locationsInitialized = true;
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
		if ($scope.data.locationsInitialized && rooms && rooms.length) {
			$scope.gotRooms(rooms);
		}
	});
	$scope.requestLocation = function(room, event) {
		if (PositionSrvc.hasPosition(false)) {
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
		if ($scope.data.locationsRoomsRendered && $scope.data.rooms === rooms) {
			return;
		}
		$scope.data.rooms = rooms;
		$scope.data.locationsRoomsRendered = true;
		LoadingSrvc.addTask('slick_rooms');
		$timeout($scope.slick, 0);
		$timeout($scope.slick, 180);
		// Never leave the discovery view blank if the third-party carousel
		// fails to emit its init event. A plain list is always better than
		// an invisible, apparently stuck screen.
		$timeout(function() {
			var $slick = window.jQuery('.slickit');
			if ($slick.length && !$slick.hasClass('slick-inited')) {
				$slick.addClass('slick-inited');
				LoadingSrvc.removeTask('slick_rooms');
			}
		}, 1200);
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
			LoadingSrvc.removeTask('slick_rooms');
			return;
		}
		if ($slick.hasClass('slick-initialized')) {
			$slick.addClass('slick-inited');
			LoadingSrvc.removeTask('slick_rooms');
			return;
		}

		if (!$scope.data.slickedEvents) {
			$scope.data.slickedEvents = true;
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
				$scope.focusRoom(nextSlide);
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
			infinite: false,
			swipeToSlide: false,
			waitForAnimate: true,
			edgeFriction: 0.22,
			speed: 360,
			cssEase: 'cubic-bezier(.22,.78,.24,1)',
			touchThreshold: 6,
		}).slick('slickFilter', function() {
			// Slick keeps the slides for which this callback returns true. Hidden
			// search/category results must therefore be excluded, not selected.
			return !window.jQuery(this).hasClass('lup-hidden-slide');
		});
		} catch (error) {
			console.warn('LinkUUp carousel unavailable; showing the room list instead.', error);
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
		$scope.data.category = categories;
		// Do not retain a focus object from the previously filtered carousel.
		$scope.data.currentRoom = null;
		$scope.data.currentRoomIndex = -1;
		// Let Angular update the slide classes before Slick reads them again.
		// Without this small delay, tapping a new category could retain the
		// previous list and make Bar/Café appear identical.
		// If the catalogue is still arriving, gotRooms() will apply this category
		// during the first Slick initialisation. Do not wake the old carousel in
		// between; that was the brief loading/flicker seen after tapping a filter.
		if (!$scope.data.rooms.length) {
			return;
		}
		$timeout(function() {
			$scope.searchLocation($scope.data.searchvalue);
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
		var $slick = window.jQuery('.slickit');
		if ($slick.hasClass('slick-initialized')) {
			// Local category changes keep the current result set; only then do we
			// need Slick's filter. No room data or asynchronous response is replaced.
			try {
				$slick.slick('slickUnfilter').slick('slickFilter', function() {
					return !window.jQuery(this).hasClass('lup-hidden-slide');
				});
				// The old index can belong to a card that the new category removed.
				// Start with the first valid result, rather than briefly rendering an
				// empty Slick track while it tries to recover that stale position.
				if ($slick.find('.slick-slide:not(.slick-cloned)').length) {
					$slick.slick('slickGoTo', 0, true);
				}
				// Filtering temporarily rebuilds Slick's track. Keep the already
				// rendered discovery view visible throughout that short operation.
				$slick.addClass('slick-inited');
				$timeout(function() {
					if ($slick.hasClass('slick-initialized')) {
						$slick.slick('setPosition').addClass('slick-inited');
					}
				}, 0, false);
			}
			catch (error) {
				console.warn('LinkUUp: category filter could not refresh the carousel.', error);
				$slick.addClass('slick-inited');
			}
		}
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
		// Six faces are visible in the stack; the badge shows only the rest.
		var remaining = Math.max(0, (room.USERS || []).length - 6);
		return remaining > 99 ? '99+' : remaining;
	};
	

});
