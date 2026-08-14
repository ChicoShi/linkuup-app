"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/location/:id/comments', {
		templateUrl: 'js/pages/comments/lup-comments.html?v='+window.LUP_BUILD,
		controller: 'CommentsCtrl',
		params: {
			authCheck: true,
		},
	});
	$routeProvider.when('/location/:id/comments/page/:page', {
		templateUrl: 'js/pages/comments/lup-comments.html?v='+window.LUP_BUILD,
		controller: 'CommentsCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('CommentsCtrl', function($scope, $controller, $location, $routeParams, $translate,
		RoomSrvc, UserSrvc, CommentSrvc, ErrorSrvc) {

	$controller('LocationCtrl', {$scope: $scope});

	// Reviews always have one unambiguous exit: back to the location itself.
	// Browser history can otherwise land on an unrelated page after opening a
	// comment room from a location preview.
	$scope.gotoLocation = function() {
		return $location.path('/location/' + $routeParams.id);
	};
	
	$scope.data.comments = {
		loading: null,
		pagination: new GWFPagination(),
		items: [],
		getItemAtIndex: function (index) {
//			console.log("CommentsCtrl$comments.getItemAtIndex()", index);
			if (this.items[index]) {
				return this.items[index];
			}
			this.loadNextPage();
		},
		
		loadNextPage: function() {
//			console.log("CommentsCtrl$comments.loadNextPage()");
			if (!this.loading) {
				var page = this.pagination.nextPage();
				if (page) {
					this.loading = true;
					CommentSrvc.withCommentsPage($scope.data.room, page).
					then(this.loadedComments.bind(this), this.failedComments.bind(this));
				}
			};
		},
		
		getLength: function () {
//			console.log("CommentsCtrl$comments.getLength()", this.pagination.nItems);
			if ( (this.loading === null) && ($scope.data.authenticated) && ($scope.data.room.id()) ) {
				this.loadNextPage();
			}
			return this.pagination.nItems;
		},
		loadedComments: function(comments) {
			console.log("CommentsCtrl$comments.loadedComments()", comments);
			this.loading = false;
			$scope.data.comments.items = $scope.data.comments.items.concat(comments);
			$scope.data.comments.pagination = comments.pagination;
		},
		failedComments: function(error) {
			console.log("CommentsCtrl$comments.failedComments()", error);
			this.loading = false;
			return ErrorSrvc.showError(error, 'LinkUUp');
		},
	};

	$scope.afterLoadedRoom = function() {
		console.log('CommentsCtrl.afterLoadedRoom()', $scope.data.room);
		CommentSrvc.withOwnComment($scope.data.room).then($scope.loadedOwnComment);
		$scope.reloadComments();
	};

	// The virtual list only asks for data after it knows a total length.  After
	// saving a vote that left the old list untouched, so a new comment looked as
	// if it had vanished.  Refresh the first page explicitly instead.
	$scope.reloadComments = function() {
		var comments = $scope.data.comments;
		comments.loading = false;
		comments.items = [];
		comments.pagination = new GWFPagination();
		comments.loadNextPage();
	};
	
	$scope.savedComment = function() {
		console.log('CommentsCtrl.savedComment()');
		ErrorSrvc.showMessage($translate.instant('MSG_THX_VOTE'), $translate.instant('MSGT_THX')).
			then(function() {
				CommentSrvc.withOwnComment($scope.data.room).then($scope.loadedOwnComment);
				$scope.reloadComments();
			});
	};
	
	$scope.deleteComment = function(comment) {
		console.log('CommentsCtrl.deleteComment()', comment);
		return CommentSrvc.deleteComment(comment).
			then($scope.successDeleteComment.bind($scope, comment), ErrorSrvc.websocketError);
	};
	
	$scope.successDeleteComment = function(comment, gwsMessage) {
		console.log('CommentsCtrl.successDeleteComment()', comment);
		comment.deleted = true;
		// remove from page
		var items = $scope.data.comments.items;
		var index = items.indexOf(comment);
		if (index >= 0) {
			items.splice(index, 1);
			$scope.data.comments.pagination.nItems--;
		}
	};
	
});
