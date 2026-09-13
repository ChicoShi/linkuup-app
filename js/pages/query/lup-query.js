"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/query/thread/:thread', {
		templateUrl: 'js/pages/query/lup-query.html?v='+window.LUP_BUILD,
		controller: 'QueryCtrl',
		params: { authCheck: true },
	}).when('/query/user/:user', {
		templateUrl: 'js/pages/query/lup-query.html?v='+window.LUP_BUILD,
		controller: 'QueryCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('QueryCtrl', function($scope, $rootScope, $routeParams, $timeout,
		UserSrvc, ChatSrvc, WebsocketSrvc) {
	
	$scope.data.title = 'TITLE_QUERY';
	$scope.data.me = window.GWF_USER;
	$scope.data.message = '';
	
	$scope.data.scrollPoint = null;
	
	$scope.ChatSrvc = ChatSrvc; // Plug ChatSrvc into view
	
	$scope.init = function() {
		console.log('QueryCtrl.init()', $routeParams);
		if ($scope.data.authenticated) {
			$scope.data.me = window.GWF_USER;
			if ($routeParams.thread) {
				$scope.data.chat = ChatSrvc.forThreadId($routeParams.thread);
				if ($scope.data.chat) {
					$scope.loadedThread($scope.data.chat);
				}
				else {
					ChatSrvc.loadChats(window.GWF_USER.id()).then(function() {
						$scope.loadedThread(ChatSrvc.forThreadId($routeParams.thread));
					})['catch']($scope.catchUnknown);
				}
			}
			else {
				UserSrvc.withUser($routeParams.user).then($scope.loadedUser)['catch']($scope.catchUnknown);
			}
		}
	};
	
	$scope.loadedUser = function(user) {
		console.log('QueryCtrl.loadedUser()', user);
		$scope.data.user = user;
		$scope.loadedThread(ChatSrvc.forUser(user) || ChatSrvc.draftForUser(user));
	};

	$scope.loadedThread = function(thread) {
		if (!thread) { return; }
		$scope.data.chat = thread;
		$scope.data.user = thread.user();
		setTimeout(function(){
			$scope.initScrollHandlers();
			$scope.loadThreadMessages();
		});
	};
	
	$scope.loadThreadMessages = function() {
		ChatSrvc.loadThreadMessages($scope.data.chat).then(function(thread) {
			window.setTimeout($scope.scrollToBottom);
			return thread;
		})['catch']($scope.catchUnknown);
	};
	
	$scope.initScrollHandlers = function() {
		console.log('QueryCtrl.initScrollHandlers()');
		var $ = window.jQuery;
		$( $scope.getList() ).off('.placeQuery').on('scroll.placeQuery touchstart.placeQuery click.placeQuery', $scope.onScroll);
	};
	
	/**
	 * Threads are complete responses; scrolling does not request a time cursor.
	 */
	$scope.onScroll = function() {
		var element = $scope.getList();
		if (!element) { return; }
	};

	$scope.scrollToMessage = function(message) {
		console.log('QueryCtrl.scrollToMessage()', message);
	};
	
	$scope.getList = function() {
		return $scope.data.chat ?
			window.document.getElementById('lup-query-list-'+$scope.data.chat.id()) : null;
	};

	$scope.scrollToBottom = function() {
		console.log('QueryCtrl.scrollToBottom()');
		var element = $scope.getList();
		if (element) {
			element.scrollTop = element.scrollHeight;
		}
	};

	$scope.scrollToBottomAfterRender = function() {
		return $timeout($scope.scrollToBottom, 0, false);
	};

	$scope.sendMessage = function() {
		var text = String($scope.data.message || '').trim();
		if (!text || $scope.data.querySending) { return; }
		var draft = $scope.data.message;
		$scope.data.querySending = true;
		return ChatSrvc.sendQuery($scope.data.user, text).then(function() {
			if ($scope.data.message === draft) { $scope.data.message = ''; }
			return $scope.scrollToBottomAfterRender();
		})['catch']($scope.catchUnknown)['finally'](function() {
			$scope.data.querySending = false;
		});
	};

	$scope.onMessageRead = function(lupMessage) {
		console.log('QueryCtrl.onMessageRead()', lupMessage);
		ChatSrvc.updateReadState(lupMessage).then(function(queryMessage){
			console.log('HERE');
		})['catch']($scope.catchUnknown);
	};
	
	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-query-message', function(event, message){
		var thread = ChatSrvc.forMessage(message);
		thread.addNewMessage(message);
		if (message && message.isOwnMessage() && thread.user().id() === $scope.data.user.id()) {
			$scope.data.chat = thread;
			$scope.scrollToBottomAfterRender();
		}
	});

	$scope.$on('$destroy', function() { jQuery($scope.getList()).off('.placeQuery'); });
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
