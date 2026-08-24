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
}).controller('QueryCtrl', function($scope, $rootScope, $routeParams,
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
		$('#lup-query-list-'+$scope.data.user.id()).
			scroll($scope.onScroll).
			bind('touchstart click', $scope.onScroll);
	};
	
	/**
	 * Threads are complete responses; scrolling does not request a time cursor.
	 */
	$scope.onScroll = function() {
		var element = $scope.getList();
		console.log('QueryCtrl.onScroll()', element.scrollTop, element.scrollHeight, element.clientHeight);
	};

	$scope.scrollToMessage = function(message) {
		console.log('QueryCtrl.scrollToMessage()', message);
	};
	
	$scope.getList = function() {
		return window.document.getElementById('lup-query-list-'+$scope.data.user.id());
	};

	$scope.scrollToBottom = function() {
		console.log('QueryCtrl.scrollToBottom()');
		var element = $scope.getList();
		if (element.scrollHeight >= element.clientHeight) {
			element.scrollTop = element.scrollHeight - element.clientHeight;
		}
	};

	$scope.sendMessage = function() {
		console.log('QueryCtrl.sendMessage()', $scope.data.user, $scope.data.message);
		if($scope.data.message){
			ChatSrvc.sendQuery($scope.data.user, $scope.data.message)['catch']($scope.catchUnknown);
		}
		jQuery('.chatbottom input').val('');
		jQuery('.chatbottom button').removeClass('sendmessage');
		$scope.data.message = null;
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
	$rootScope.$on('lup-query-message', function(event, message){
		var thread = ChatSrvc.forMessage(message);
		thread.addNewMessage(message);
		if (thread.user().id() === $scope.data.user.id()) {
			$scope.data.chat = thread;
			setTimeout($scope.scrollToBottom);
		}
	});

	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
