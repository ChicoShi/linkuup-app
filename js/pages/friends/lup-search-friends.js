"use strict";
angular.module('LUP').controller('SearchFriendsCtrl', function($scope,
		UserSrvc) {
	
	$scope.data.friendsearch = '';
	$scope.data.friendsearchusers = [];
	
	$scope.searchFriends = function(query) {
		console.log('SearchFriendsCtrl.searchFriends()', query);
		$scope.data.friendsearchusers = [];
		if (query) {
			UserSrvc.searchUsers(query).then($scope.gotNewFriends, $scope.gotNewFriendsError)['catch']($scope.catchUnknown);
		}
	};
	
	$scope.gotNewFriends = function(users) {
		console.log('SearchFriendsCtrl.gotNewFriends()', users);
		$scope.data.friendsearchusers = users;
	};
	$scope.gotNewFriendsError = function(gwsMessage) {
		console.log('SearchFriendsCtrl.gotNewFriendsError()', gwsMessage);

	};
});
