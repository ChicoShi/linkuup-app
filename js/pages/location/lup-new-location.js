angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/new-location', {
		templateUrl: 'js/pages/location/lup-new-location.html?v='+window.LUP_BUILD,
		controller: 'NewLocationCtrl'
	});
}).controller('NewLocationCtrl', function($scope, $location, WebsocketSrvc, PositionSrvc) {
	
	$scope.data = {
		room: {
			name: '',
		},
	};
	
	$scope.init = function() {
		console.log('NewLocationCtrl.init()');
	};
	
	$scope.createRoom = function() {
		console.log('NewLocationCtrl.createRoom()');
		WebsocketSrvc.sendCommand('lup_create_room', JSON.stringify($scope.data.room)).then($scope.createdRoom)['catch']($scope.catchUnknown);
	};
	
	$scope.createdRoom = function() {
		console.log('NewLocationCtrl.createdRoom()');

	};
	
	$scope.$on('lup-inited', $scope.init);
});
