"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/likes/:id', {
		templateUrl: 'js/pages/likes/lup-likes.html?v='+window.LUP_BUILD,
		controller: 'LikesCtrl',
		params: { authCheck: true }
	});
}).controller('LikesCtrl', function($scope, $routeParams, $q, UserSrvc, LikeSrvc) {
	$scope.data.title = 'TITLE_UPS';
	$scope.data.likeuser = null;
	$scope.data.upConnections = [];
	$scope.data.totalUps = 0;
	$scope.data.upsLoading = false;
	$scope.data.upsError = false;
	$scope.data.isOwnLikeList = false;
	var pending = null, destroyed = false;

	$scope.init = function() {
		if (!$scope.data.authenticated || destroyed) return;
		if (pending) return pending;
		var requestedId = Number($routeParams.id);
		$scope.data.upConnections = [];
		$scope.data.totalUps = 0;
		$scope.data.upsError = false;
		$scope.data.upsLoading = true;
		pending = UserSrvc.withUser(requestedId).then(function(user) {
			if (destroyed) return;
			$scope.data.likeuser = user;
			$scope.data.isOwnLikeList = user.isSelf();
			// The current command returns the complete list, without a pager.
			return LikeSrvc.getLikeList(user, 1);
		}).then(function(message) {
			if (destroyed) return;
			if (!message || Number(message.read32()) !== requestedId) throw new Error('Ups profile mismatch');
			var counts = {};
			while (message.hasMore()) {
				var id = message.read32(), count = message.read32();
				if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(count) || count < 0) throw new Error('Invalid Ups record');
				counts[id] = count;
			}
			// IDs alone render blank portraits. Resolve the actual users, keeping
			// per-profile counts out of the globally shared user cache.
			return $q.all(Object.keys(counts).map(function(id) {
				return UserSrvc.withUser(Number(id)).then(function(user) { return {user:user, count:counts[id]}; });
			}));
		}).then(function(connections) {
			if (destroyed) return;
			connections.sort(function(a,b) { return b.count-a.count || a.user.id()-b.user.id(); });
			$scope.data.upConnections = connections;
			$scope.data.totalUps = connections.reduce(function(total, connection) { return total+connection.count; },0);
		}).catch(function() {
			if (!destroyed) $scope.data.upsError = true;
		}).finally(function() {
			pending = null;
			if (!destroyed) $scope.data.upsLoading = false;
		});
		return pending;
	};
	$scope.$on('$destroy', function() { destroyed = true; });
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
