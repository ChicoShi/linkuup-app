"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.
	when('/notifications', {
		templateUrl: 'js/pages/notifications/lup-notifications.html?v='+window.LUP_BUILD,
		controller: 'NotificationCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('NotificationCtrl', function($scope, $rootScope, $q, $translate,
		ErrorSrvc, WebsocketSrvc, TypeSrvc, UserSrvc, RoomSrvc,
		ChatSrvc, NotificationSrvc, HelpSrvc, DialogSrvc) {
	// Hook Service into view
	$scope.UserSrvc = UserSrvc;
	$scope.NotificationSrvc = NotificationSrvc;
	
	// Hook services into model.
	LUPNotification['$q'] = $q;
	LUPNotification['UserSrvc'] = UserSrvc;
	LUPNotification['RoomSrvc'] = RoomSrvc;
	LUPNotification.prototype.t = $translate.instant;

	// Notifications may have arrived while this route was not active. Resolve
	// those cached raw records now that their user/room services are available.
	angular.forEach(NotificationSrvc.CACHE, function(notification) {
		if (!notification.TYPE) {
			notification.resolveData(true);
		}
	});

	// Override defaults
	$scope.data.title = "TITLE_NOTIFICATIONS";
	
	$scope.data.activeTab3 = $scope.data.activeTab3 === undefined ? 0 : $scope.data.activeTab3;
	$scope.data.loadingChats = $scope.data.loadingChats ? $scope.data.loadingChats : null;

	// Notifications data for virtual repeat
	$scope.data.notifications = $scope.data.notifications ? $scope.data.notifications : {
		items: [],
		reset: function() {
			console.log("NotificationCtrl$notifications.reset()");
			this.items = [];
			NotificationSrvc.OLDEST = null;
			NotificationSrvc.WORKING = false;
		},
		getItemAtIndex: function (index) {
			if (this.items[index]) {
//				console.log("NotificationCtrl$notifications.getItemAtIndex()", index, this.items[index]);
				return this.items[index];
			}
			if ($scope.data.authenticated) {
				if (NotificationSrvc.shouldLoadMore()) {
					NotificationSrvc.loadMore().then(this.loadedMore.bind(this));
				}
			}
		},
		
		getLength: function () {
			return NotificationSrvc.COUNT;
		},
		loadedMore: function(notifications) {
			console.log("NotificationCtrl$notifications.loadedMore()", notifications);
			this.items = notifications;
		},
	};

	///////////////////////////
	// --- Notifications --- //
	///////////////////////////
	$scope.onNotification = function(event, notification) {
		console.log('NotificationCtrl.onNotification()', notification);
		$scope.data.notifications.items.unshift(notification);
		NotificationSrvc.COUNT++;
		setTimeout($scope.updateTabHighlights);
		$scope.showNotifications();
	};
	$scope.$on('lup-notification', $scope.onNotification);
	
	
	$scope.onQueryMessage = function(event, message) {
		console.log('NotificationCtrl.onQueryMessage()', message);
		setTimeout($scope.updateTabHighlights);
	};
	$scope.$on('lup-query-message', $scope.onQueryMessage);


	//////////////////////////////
	// --- Private Messages --- //
	//////////////////////////////
	$scope.sortedQueries = function() {
		var queries = ChatSrvc.QUERIES;
		queries = queries.sort(function(a,b){
			return b.lastDate() - a.lastDate();
		});
		return queries;
	};
	
	$scope.unreadMessages = function() {
		return ChatSrvc.unreadMessages();
	};
	
	/////////////////////
	// --- Actions --- //
	/////////////////////
	$scope.acceptFriendRequest = function(ids) {
		console.log('NotificationCtrl.acceptFriendRequest()', ids);
		var data = ids.split(',');
		var gwsMessage = new GWS_Message().cmd(0x1132).sync();
		gwsMessage.write32(data[1]).write32(data[2]);
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				$scope.acceptedFriendRequest.bind($scope, data[0]),
				ErrorSrvc.websocketError);
	};
	
	$scope.acceptedFriendRequest = function(notificationid, gwsMessage) {
		console.log('NotificationCtrl.acceptedFriendRequest()', notificationid, gwsMessage);
		UserSrvc.gotUserMessage(gwsMessage);
		var notification = NotificationSrvc.CACHE[notificationid];
		if (notification) {
			$scope.deleteNotification(notification);
		}
		return gwsMessage;
	};
	
	///////////////////////
	// --- Mark Read --- //
	///////////////////////
	/**
	 * Mark a notification as read via websocket.
	 */
	$scope.markRead = function(lupNotification) {
		console.log('NotificationCtrl.markRead()', lupNotification);
		if ((!lupNotification) || // Bug?
			lupNotification.read() || // already read
			lupNotification.loading ||  // loading
			($scope.data.activeTab3 != 1) ) { // not visible
			return; // is a bailout
		}
		lupNotification.loading = true;
		// Build websocket payload
		var gwsMessage = new GWS_Message().cmd(0x1142).sync().write32(lupNotification.id());
		// Send and set success/failure handlers.
		WebsocketSrvc.sendBinary(gwsMessage).then(
				$scope.markedRead, WebsocketSrvc.onError);
	};
	
	$scope.markedRead = function(gwsMessage) {
		console.log('NotificationCtrl.markedRead()', gwsMessage);
		NotificationSrvc.markedRead(gwsMessage);
		$scope.updateTabHighlights();
	};

	////////////////////////
	// --- Tab Alerts --- //
	////////////////////////
	$scope.hasUnreadQueries = function() {
		var result = !!ChatSrvc.unreadMessages();
		console.log('NotificationCtrl.hasUnreadQueries()', result);
		return result;
	};

	$scope.hasNotifications = function() {
		var result = !!NotificationSrvc.unreadNotificationCount();
		console.log('NotificationCtrl.hasNotifications()', result);
		return result;
	};
	
	/**
	 * This function updates the tab buttons with highlight dots.
	 */
	$scope.updateTabHighlights = function() {
		console.log('NotificationCtrl.updateTabHighlights()');
		
		var $ = window.jQuery;
		
		// Queries tab
		var htmlText = $translate.instant('TAB_QUERIES');
		if ($scope.hasUnreadQueries()) {
			htmlText = "<span class=\"lup-tab-alerted\"></span>" +
				htmlText;
		}
		$('.lup-queries-tab').html(htmlText);
		
		// Notification tab
		var htmlText = $translate.instant('TAB_NOTIFICATIONS');
		if ($scope.hasNotifications()) {
			htmlText = "<span class=\"lup-tab-alerted\"></span>" +
				htmlText;
		}
		$('.lup-notifications-tab').html(htmlText);
	};

	/////////////////////
	// --- Queries --- //
	/////////////////////
	$scope.loadChats = function() {
		console.log('NotificationCtrl.loadChats()', $scope.data);
		if ($scope.data.authenticated) {
			if ($scope.data.loadingChats === null) {
				$scope.data.loadingChats = true;
				ChatSrvc.loadChats(window.GWF_USER.id()).
					then($scope.loadedChats);
			}
		}
	};
	
	$scope.loadedChats = function(chats) {
		console.log('NotificationCtrl.loadedChats()', chats);
	};
	
	$scope.deleteChat = function(chat) {
		console.log('NotificationCtrl.deleteChat()', chat);
		var dialogURL = "js/pages/notifications/lup-chat-delete.html?v="+window.LUP_BUILD;
		var dialogData = {
			chat: chat,
		};
		var confirmed = $scope.reallyDeleteChat.bind($scope, chat);
		DialogSrvc.confirm(dialogURL, dialogData).then(confirmed);
	};
	
	$scope.reallyDeleteChat = function(chat) {
		console.log('NotificationCtrl.reallyDeleteChat()', chat);
		ChatSrvc.deleteQuery(chat).then($scope.deletedChat.bind($scope, chat));
	};

	$scope.deletedChat = function(chat) {
		console.log('NotificationCtrl.deletedChat()', chat);
	};
	
	//////////////////////////////////
	// --- Notification Readfix --- //
	//////////////////////////////////
	/*
	 * The readfix is executed when tab is selected or on init when tab is preselected.
	 * It uses the "jquery visible" plugin in "js/3p" folder.
	 * It is executed a while after tab selection, as the virtual-scroll reqiures time to load the notifications.
	 */
	$scope.showNotifications = function() {
		console.log('NotificationCtrl.showNotifications()');
		setTimeout($scope.readfix, 800);
	};
	
	/**
	 * Check every notification list item if it is visible.
	 * If so, mark it read.
	 * Finds notification via virtual-scroll index integer which matches $scope.notifications.items
	 */
	$scope.readfix = function() {
		console.log('NotificationCtrl.readfix()');
		var list = $('#lup-notification-list');
		list.find('md-list-item').each(function(index){
			var item = $(this);
			if (item.visible(true)) {
				var lupNotification = $scope.data.notifications.items[index];
				$scope.markRead(lupNotification);
			}
		});
	};
	
	/////////////////////////////////
	// --- Notification delete --- //
	/////////////////////////////////
	$scope.deleteNotificationIndex = function(index) {
		console.log('NotificationCtrl.deleteNotificationIndex()', index, $scope.data.notifications.items);
		var lupNotification = $scope.data.notifications.items[index];
		return $scope.deleteNotification(lupNotification);
	};

	$scope.deleteNotification = function(lupNotification) {
		console.log('NotificationCtrl.deleteNotification()', lupNotification);
		return NotificationSrvc.deleteNotification(lupNotification).then(
				$scope.deletedNotification, ErrorSrvc.websocketMaybeJSONError);
	};

	$scope.deletedNotification = function(lupNotification) {
		console.log('NotificationCtrl.deletedNotification()', lupNotification);
		setTimeout(function(){
			var items = $scope.data.notifications.items;
			var index = items.indexOf(lupNotification);
			if (index > -1) {
				items.splice(index, 1);
			}
			$scope.$apply();
		});
	};
	
	//////////////////
	// --- Init --- //
	//////////////////
	
	$rootScope.$on('lup-clear-cache', function() {
		console.log('NotificationCtrl.$on-lup-clear-cache()');
		$scope.data.loadingChats = null;
		$scope.data.notifications.reset();
		ChatSrvc.reset();
	});

	$scope.init = function() {
		console.log('NotificationCtrl.init()');
		if ($scope.data.authenticated) {
			
			$scope.data.user = GWF_USER; // TODO: make it data.me in root controller	
			
//			$scope.data.notifications.reset();
			$scope.data.notifications.items = NotificationSrvc.SORTED;
			
			HelpSrvc.showHelp('notifications', $translate.instant('HELP_NOTIFICATIONS'));
			
			// Update tab notification highlights
			setTimeout($scope.updateTabHighlights);
			
			// Init preselected tab
			if ($scope.data.activeTab3 === 0) {
				$scope.loadChats();
			}
			else if ($scope.data.activeTab3 === 1) {
				$scope.showNotifications();
			}

			// Make initSwipeHandlers an interval once.
			if (!NotificationSrvc.initedHandlers) {
				setInterval($scope.initSwipeHandlers, 1500);
				NotificationSrvc.initedHandlers = true;
			}
			
			setTimeout(function(){
				$('#lup-notification-list .md-virtual-repeat-scroller').
					animate({scrollTop: NotificationSrvc.notificationScrollTop}, 1000, 'swing', function(){
						
					});
			});
			
		}
	};
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);

	///////////////////
	// --- Swipe --- //
	///////////////////
	$scope.swipeStart = null;
	$scope.swipeDelete = -1;
	$scope.initSwipeHandlers = function() {
		console.log('NotificationCtrl.initSwipeHandlers()');
		
		$('#lup-notification-list .md-virtual-repeat-scroller').scroll(function(event){
			NotificationSrvc.notificationScrollTop = $(this).scrollTop();
		});

		$('.lup-swipeable').on('touchstart mousedown', function(evt){
//			console.log('NotificationCtrl$touchstart()', evt);
			$(this).css('left', 0);
			var x = evt.originalEvent.changedTouches ? evt.originalEvent.changedTouches[0].clientX : evt.originalEvent.clientX;
			$scope.swipeStart = x;
			var id = $(this).attr('data-index');
			$scope.swipeDelete = id;
		});
		$('.lup-swipeable').on('touchend mouseup', function(evt){
//			console.log('NotificationCtrl$touchend()', evt);
			$scope.swipeStart = null;
			$scope.swipeDelete = null;
			$('.lup-swipeable').css('left', 0);
		});
		$('.lup-swipeable').on('touchmove mousemove', function(evt){
//			console.log('NotificationCtrl$touchmove()', evt);
			if ($scope.swipeStart === null) {
				return;
			}

			var x = evt.originalEvent.changedTouches ? evt.originalEvent.changedTouches[0].clientX : evt.originalEvent.clientX;
			var left = x - $scope.swipeStart;
			if (Math.abs(left) > 5) {
				$(this).css('left', left);
			}
			if ($scope.swipeStart) {
				if (Math.abs(left) > 128) {
					$scope.swipeStart = null;
					var id = $(this).attr('data-index');
					if ($scope.swipeDelete === id) {
						$scope.swipeStart = null;
						$scope.swipeDelete = null;
						$('.lup-swipeable').css('left', 0);
						$scope.animateDeletion(id, this, left);
					}
				}
			}
			
			// Changed item.... scrolling
//			var id = $(this).attr('data-index');
//			console.log(id, $scope.swipeDelete);
//			if ($scope.swipeDelete !== id) {
//				$scope.swipeStart = null;
//				$scope.swipeDelete = null;
//				$('.lup-swipeable').css('left', 0);
//			}
		});
	};
	
	$scope.animateDeletion = function(id, listItem, left) {
		console.log('NotificationCtrl.animateDeletion()', id, listItem, left);

		// Animate, then delete
		var completed = function() {
			var that = this;
			$scope.deleteNotificationIndex(id).then(function(){
				$(that).css('left', 0).css('opacity', '1.0');
				$scope.swipeDelete = -1;
			});
		};
		
		// Direction
		var mul = left > 0 ? 1 : -1;
		
		// Animate, then delete
		$(listItem).animate({
			left: mul * 320,
			opacity: '0.0',
		}, 250, 'swing', completed);
	};
	
	////////////////////////////////////////
	// --- Notification comment popup --- //
	////////////////////////////////////////
	$rootScope.showComment = function(commentText, rating) {
		console.log('NotificationCtrl.showComment()', commentText, rating);
		var templateUrl = 'js/pages/notifications/lup-room-comment-dialog.html?v='+window.LUP_BUILD;
		function DialogController($scope, $mdDialog) {
			$scope.data = {
				commentText: commentText,
				rating: rating,
			};
			$scope.ok = function() {
				$mdDialog.cancel();
			};
		}
		DialogSrvc.show({
			controller: ['$scope', '$mdDialog', DialogController],
			templateUrl: templateUrl,
			parent: angular.element(document.body),
			targetEvent: window.event,
			clickOutsideToClose: false,
		});

	};
	
});
