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
	
	$scope.gotRooms = function(rooms) {
		console.log('LocationsCtrl.gotRooms()', rooms);
		$scope.data.rooms = rooms;
		// A reinstall replaces category records. Never carry a stale category or
		// search term into the freshly received location list, otherwise every
		// new room can appear to be missing until the user manually clears it.
		$scope.data.searchvalue = '';
		$scope.data.category = [];
		LoadingSrvc.addTask('slick_rooms');
		// Let Angular render ng-repeat before Slick reads its slides.
		$timeout($scope.slick, 0);
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
			return window.jQuery(this).hasClass('lup-hidden-slide');
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
		var s = $scope.data.searchvalue.trim().toLowerCase();
		var categoryMatches = !$scope.data.category.length || $scope.data.category.indexOf(String(room.category())) >= 0;
		if (!categoryMatches) {
			return false;
		}
		// TODO: Split s by spaces and do an AND match for each of them.
		if (room.name().toLowerCase().indexOf(s) >= 0) {
//			console.log("LocationCtrl.filteredRoom()", room.name());
			return true;
		} 
//		console.log("LocationCtrl.notFilteredRoom()", room.name());
		return false;
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
	
	/**
	 * This one was tricky!
	 * on a keyup we restore slick slide by calling unfilter.
	 * Then we untouch slick and reset it by calling slick again.
	 */
	$scope.searchLocation = function(query) {
		console.log("LocationCtrl.searchLocation()", query);
		var $slick = window.jQuery('.slickit');
		if (!$slick.hasClass('slick-initialized')) {
			return;
		}
		$slick.slick('slickUnfilter'); // Restore
		// Reset
		$slick.slick('unslick');
		LoadingSrvc.addTask('slick_rooms');
		$scope.slick(true);
		// Slick can lose its init callback after unslick/filter cycles. Never let
		// that third-party callback keep the whole page in a loading state.
		$timeout(function() {
			LoadingSrvc.removeTask('slick_rooms');
		}, 450);
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
		var remaining = Math.max(0, (room.USERS || []).length - 3);
		return remaining > 99 ? '99+' : remaining;
	};
	

});
