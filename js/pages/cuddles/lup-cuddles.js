"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/cuddles/:id', {
		templateUrl: 'js/pages/cuddles/lup-cuddles.html?v='+window.LUP_BUILD,
		controller: 'CuddlesCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('CuddlesCtrl', function($scope, $routeParams,
		UserSrvc, CuddleSrvc, ErrorSrvc) {

	$scope.data.title = 'TITLE_CUDDLES';
	$scope.data.cuddleUser = GWF_User.ghost();
	$scope.data.cuddles = [];

	$scope.init = function() {
		console.log('CuddlesCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.cuddles = [];
			UserSrvc.withUser($routeParams.id).then($scope.loadedUser, ErrorSrvc.websocketMaybeJSONError);
		}
	};

	$scope.loadedUser = function(user) {
		$scope.data.cuddleUser = user;
		return CuddleSrvc.getUserCuddles(user).then($scope.loadedCuddles, ErrorSrvc.websocketMaybeJSONError);
	};

	$scope.loadedCuddles = function(gwsMessage) {
		while (gwsMessage.hasMore()) {
			$scope.data.cuddles.push({
				partner: UserSrvc.getOrCreate(gwsMessage.read32()),
				day: gwsMessage.read32() * 1000,
			});
		}
	};

	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
