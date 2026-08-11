"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/likes/:id', {
		templateUrl: 'js/pages/likes/lup-likes.html?v='+window.LUP_BUILD,
		controller: 'LikesCtrl',
		params: {
			authCheck: true,
		}
	});
}).controller('LikesCtrl', function($scope, $routeParams, $translate,
		HelpSrvc, UserSrvc, LikeSrvc, ErrorSrvc) {
	
	// Main
	$scope.data.title = 'TITLE_LIKES';
	
	// Data to work on
	$scope.data.pagemenu = new GWFPagination();
	$scope.data.likes = []; 

	// Hook services into template
	$scope.LikeSrvc = LikeSrvc;
	
	$scope.init = function() {
		console.log('LikesCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.likes = [];
			$scope.data.user = window.GWF_USER;
			$scope.data.pagemenu = new GWFPagination();
			UserSrvc.withUser($routeParams.id).then($scope.loadedUser);
			HelpSrvc.showHelp('likes', $translate.instant('HELP_LIKES'));
		}
	};
	
	$scope.loadedUser = function(user) {
		console.log('LikesCtrl.loadedUser()', user);
		$scope.data.likeuser = user;
		$scope.data.isOwnLikeList = $scope.data.user && user.id() === $scope.data.user.id();
		$scope.loadLikers();
	};
	
	$scope.loadLikers = function() {
		console.log("LikesCtrl.loadLikers()", $scope.data.pagemenu.page+1);
		var page = $scope.data.pagemenu.nextPage();
		if (page) {
			LikeSrvc.getLikeList($scope.data.likeuser, page).
			then($scope.loadedLikers, ErrorSrvc.websocketError);
		}
	};
	
	$scope.loadedLikers = function(gwsMessage) {
		var forUser = gwsMessage.read32(); // stub
//		$scope.data.pagemenu = GWFPagination.fromGWSMessage(gwsMessage); // pager
		console.log("LikesCtrl.loadedLikers()", $scope.data.pagemenu);
		while (gwsMessage.hasMore()) {
			var friend = UserSrvc.getOrCreate(gwsMessage.read32());
			friend.likedMe = gwsMessage.read32();
			$scope.data.likes.push(friend);
		}
	};
	
	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
