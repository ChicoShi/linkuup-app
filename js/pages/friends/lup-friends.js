"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/friends/:id', {
		templateUrl: 'js/pages/friends/lup-friends.html?v='+window.LUP_BUILD,
		controller: 'FriendsCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('FriendsCtrl', function($scope, $routeParams, $translate,
		HelpSrvc, UserSrvc, WebsocketSrvc, FriendSrvc, LikeSrvc, ErrorSrvc, DialogSrvc) {
	
	// Main
	$scope.data.title = 'TITLE_FRIENDS';

	// Hook services into template
	$scope.LikeSrvc = LikeSrvc;
	$scope.FriendSrvc = FriendSrvc;
	
	// Data to work on
	$scope.data.frienduser = null;
	$scope.data.friends = [];
	$scope.data.pagemenu = new GWFPagination();
	
	$scope.init = function() {
		console.log('FriendsCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.user = window.GWF_USER;
			$scope.data.pagemenu = new GWFPagination();
			$scope.data.friends = [];
			UserSrvc.withUser($routeParams.id).then($scope.loadedUser)['catch']($scope.catchUnknown);
			HelpSrvc.showHelp('friends', $translate.instant('HELP_FRIENDS'));
		}
	};
	
	$scope.loadedUser = function(user) {
		console.log('FriendsCtrl.loadedUser()', user);
		$scope.data.frienduser = user;
		$scope.translationData = { username: user.displayName(), friends: 0 };
		$scope.loadFriends();
	};
	
	$scope.loadFriends = function() {
		console.log("FriendsCtrl.loadFriends()", $scope.data.pagemenu.page+1);
		var page = $scope.data.pagemenu.nextPage();
		if (page) {
			FriendSrvc.getFriendList($scope.data.frienduser, page).
				then($scope.loadedFriends, $scope.loadError);
		}
	};
	
	$scope.loadError = function(response) {
		ErrorSrvc.websocketError(response).then(function(){
			$scope.gotoReferrer();
		})['catch']($scope.catchUnknown);
	};
	
	$scope.loadedFriends = function(gwsMessage) {
		console.log("FriendsCtrl.loadedFriends()");
		$scope.data.pagemenu = GWFPagination.fromGWSMessage(gwsMessage);
		$scope.translationData.friends = $scope.data.pagemenu.nItems;
		while (gwsMessage.hasMore()) {
			UserSrvc.withUser(gwsMessage.read32()).then(function(friend){
				$scope.data.friends.push(friend);
			})['catch']($scope.catchUnknown);
		}
	};
	
	$scope.sortedFriends = function() {
		return UserSrvc.sortedUsers($scope.data.friends);
	};
	
	////////////////////
	// --- Delete --- //
	////////////////////
	$scope.deleteFriend = function(friend) {
		console.log("FriendsCtrl.deleteFriend()", friend);
		FriendSrvc.removeFriend(friend).then($scope.deletedFriend.bind($scope, friend))['catch']($scope.catchUnknown);
	};
	
	$scope.deletedFriend = function(friend, gwsMessage) {
		console.log("FriendsCtrl.deletedFriend()", friend, gwsMessage);
		var friends = $scope.data.friends;
		var index = friends.indexOf(friend);
		if (index >= 0) {
			friends.splice(index, 1);
			$scope.data.pagemenu.nItems--;
		} else {
			console.error('Could not find friend to delete');
		}
	};

	////////////////////
	// --- QRCode --- //
	////////////////////
	$scope.showQRCode = function() {
		const user = $scope.data.ownUser;
		const url = LUP_CONFIG.server + 'linkuup.qrforprofile.user_id.' + user.id() + '.html?lang=en';
		const target = window.location.href.split('#')[0] + '#!/profile/' + user.id();
		return DialogSrvc.confirm('js/pages/friends/lup-friends-qr-dialog.html', {url: url, target: target});
	}

	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
