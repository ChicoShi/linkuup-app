"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/locations', {
		templateUrl: 'js/pages/locations/lup-locations.html?v='+window.LUP_BUILD,
		controller: 'LocationsCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('LocationsCtrl', function($scope, $location, $translate, $timeout,
		LoadingSrvc, WebsocketSrvc, PositionSrvc, RoomSrvc, AuthSrvc, HelpSrvc, UserSrvc) {
	
	$scope.data.title = "Entdecken";
	$scope.data.rooms = $scope.data.rooms || [];
	$scope.data.searchvalue = $scope.data.searchvalue || '';
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
	};
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
	
	$scope.gotRooms = function(rooms) {
		console.log('LocationsCtrl.gotRooms()', rooms);
		$scope.data.rooms = rooms;
		LoadingSrvc.addTask('slick_rooms');
		// Let Angular render ng-repeat before Slick reads its slides.
		$timeout($scope.slick, 0);
	};
	
	$scope.maybeGotoRoom = function(room) {
		console.log('LocationsCtrl.maybeGotoRoom()', room);
		if ($scope.data.currentRoom == room) { // Prevent desktop goto too early.
			$scope.gotoRoom(room);
		}
	};
	
	$scope.slick = function(nofocus) {
		console.log('LocationsCtrl.slick()');
		var $slick = window.jQuery('.slickit');
		if (!$slick.length || $slick.hasClass('slick-initialized')) {
			return;
		}

		if (!$scope.data.slickedEvents) {
			$scope.data.slickedEvents = true;
			$slick.off('.lupSlick').on('init.lupSlick', function(){
				console.log('slickit.onInit()');
				if ($scope.data.currentRoomIndex >= 0) {
					setTimeout(function(){
						window.jQuery('.slickit').slick('goTo', $scope.data.currentRoomIndex, true);
					}, 10);
				}
				window.jQuery('.slickit').addClass('slick-inited');
				LoadingSrvc.removeTask('slick_rooms');
			}).on('beforeChange.lupSlick', function(event, slick, currentSlide, nextSlide) {
				$scope.focusRoom(nextSlide);
			});
		}
		
		$slick.slick({
			arrows: false,
			centerMode: true,
			slidesToShow: 1,
			focusOnSelect: true,
			mobileFirst: true,
			variableWidth: false,
			infiniteScroll: false,
			speed:50,
			responsive: [
				{
					breakpoint: 480,
					settings: {
						slidesToShow: 2,
						slidesToScroll: 2,
					}
				},
				{
					breakpoint: 800,
					settings: {
						slidesToShow: 3,
						slidesToScroll: 3,
					}
				},
				{
					breakpoint: 1024,
					settings: {
						slidesToShow: 4,
						slidesToScroll: 4,
					}
				},
				{
					breakpoint: 1400,
					settings: {
						slidesToShow: 5,
						slidesToScroll: 5,
					}
				},
			],
		}).slick('slickFilter', function() {
			return window.jQuery(this).hasClass('lup-hidden-slide');
		});
		
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

	////////////////
	// Suchfilter //
	////////////////
	$scope.filteredRoom = function(room) {
		var s = $scope.data.searchvalue.trim().toLowerCase();
		// TODO: Split s by spaces and do an AND match for each of them.
		if (room.name().toLowerCase().indexOf(s) >= 0) {
//			console.log("LocationCtrl.filteredRoom()", room.name());
			return true;
		} 
//		console.log("LocationCtrl.notFilteredRoom()", room.name());
		return false;
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
	};

	//////////
	// Maps //
	//////////
	/**
	 * @see https://developers.google.com/maps/documentation/urls/guide
	 */
	$scope.mapsHref = function(room) {
//		console.log("LocationsCtrl.mapsHref()", room);
		var dest = $scope.mapsDestination(room);
		return "https://www.google.com/maps/dir/?api=1&destination=" + dest;
	};
	
	$scope.mapsDestination = function(room) {
//		console.log("LocationsCtrl.mapsDestination()", room);
		return room.lat() + "," + room.lng(); // TODO: Use street if available?
	};
	
	$scope.sortedVisitors = function(room) {
		return UserSrvc.sortedUsers(room.USERS);
	};
	

});
