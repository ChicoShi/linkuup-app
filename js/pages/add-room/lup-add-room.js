"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/add-room', {
		templateUrl: 'js/pages/add-room/lup-add-room.html?v=' + window.LUP_BUILD,
		controller: 'AddRoomCtrl',
		params: { authCheck: true },
	});
}).controller('AddRoomCtrl', function($scope, $location, $translate,
		CategorySrvc, PositionSrvc, RoomSrvc, WebsocketSrvc, ErrorSrvc) {
	$scope.data.title = 'TITLE_ADD_ROOM';
	$scope.data.categories = [];
	$scope.data.room = { name: '', category: '', info: '', radius: 50 };
	$scope.data.radiusPresets = [10, 25, 50, 100, 150, 250];
	$scope.data.locationReady = false;

	$scope.setRadius = function(radius) {
		$scope.data.room.radius = radius;
	};

	$scope.init = function() {
		if (!window.GWF_USER.isVIP()) {
			ErrorSrvc.showError($translate.instant('ERR_VIP_ONLY'), $translate.instant('TITLE_ADD_ROOM'));
			return $location.path('/locations');
		}
		CategorySrvc.withCategories().then(function(response) {
			var categories = response.data ? response.data.data : response;
			$scope.data.categories = Object.keys(categories).map(function(id) {
				return categories[id];
			});
		})['catch']($scope.catchUnknown);
		PositionSrvc.probe().then(function() {
			$scope.data.locationReady = PositionSrvc.hasPosition(true);
		})['catch'](function() {
			$scope.data.locationReady = false;
			return ErrorSrvc.showError($translate.instant('ERR_GPS_REQUIRED'), $translate.instant('TITLE_ADD_ROOM'));
		})['catch']($scope.catchUnknown);
	};

	$scope.create = function() {
		var room = $scope.data.room;
		var position = PositionSrvc.CURRENT;
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
			.writeFloat(position.lat)
			.writeFloat(position.lng)
			.writeFloat(Number(room.radius));
		return WebsocketSrvc.sendBinary(request).then(function(reply) {
			var roomId = reply.read32();
			RoomSrvc.ALL_ROOMS = null;
			/* The room exists immediately, but the locations view deliberately
			 * keeps one shared nearby-list instance. Refresh that instance now so
			 * returning to discovery never needs a browser reload to show the room. */
			return RoomSrvc.withRooms().then(function(rooms) {
				$scope.data.rooms = rooms;
				return RoomSrvc.withRoom(roomId, true);
			}).then(function() {
				return $location.path('/location/' + roomId);
			});
		}, function(error) {
			return ErrorSrvc.websocketError(error);
		});
	};

	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
