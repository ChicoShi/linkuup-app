'use strict';
angular.module('LUP').service('NotificationSrvc', function($rootScope, $q,
		WebsocketSrvc, TypeSrvc, ErrorSrvc, ChatSrvc) {
	
	var NotificationSrvc = this;
	
	//////////////////
	// --- Data --- //
	//////////////////
	NotificationSrvc.UNREAD = 0;
	NotificationSrvc.COUNT = 2;
	NotificationSrvc.CACHE = {};
	NotificationSrvc.SORTED = [];
	NotificationSrvc.WORKING = false;
	NotificationSrvc.PAGEMENU = new GWFPagination();
	NotificationSrvc.OLDEST = null;
	
	$rootScope.$on('lup-clear-cache', function(event) {
		console.log('NotificationSrvc$lup-clear-cache()', event);
		NotificationSrvc.COUNT = 1;
		NotificationSrvc.UNREAD = 0;
		NotificationSrvc.OLDEST = null;
		NotificationSrvc.CACHE = {};
		NotificationSrvc.PAGEMENU.reset();
		NotificationSrvc.WORKING = false;
		NotificationSrvc.SORTED = [];
	});
	
	NotificationSrvc.shouldLoadMore = function() {
		var time = NotificationSrvc.OLDEST ? NotificationSrvc.OLDEST.created() : 0;
		var result = NotificationSrvc.WORKING !== time;
		console.log('NotificationSrvc.shouldLoadMore()', time, result);
		return result;
	};
	
	NotificationSrvc.loadMore = function() {
		var time = NotificationSrvc.OLDEST ? NotificationSrvc.OLDEST.created() : 0;
		console.log('NotificationSrvc.loadMore()', time);
		if (NotificationSrvc.WORKING === time) {
			return $q.resolve(NotificationSrvc.SORTED);
		}
		NotificationSrvc.WORKING = time;
		var gwsMessage = new GWS_Message().cmd(0x1141).sync().write32(time);
		var promise = WebsocketSrvc.sendBinary(gwsMessage).then(
				NotificationSrvc.gotPage, WebsocketSrvc.onError);
		promise['catch'](function(response){
//			NotificationSrvc.WORKING = false;
			return response;
		});
		return promise;
	};
	
	NotificationSrvc.gotPage = function(gwsMessage) {
		console.log('NotificationSrvc.gotPage()', gwsMessage);
		NotificationSrvc.COUNT = gwsMessage.read32();
		while (gwsMessage.hasMore()) {
			var notification = NotificationSrvc.parseNotification(gwsMessage);
		}
		$rootScope.updateNotificationCount();
		NotificationSrvc.resort();
		return NotificationSrvc.SORTED;
	};

	NotificationSrvc.parseNotification = function(gwsMessage, recaching) {
		console.log('NotificationSrvc.parseNotification()', gwsMessage, recaching);
		
		// Get Id and reset msg pointer, because later it gets parsed again
		var id = gwsMessage.read32();
		gwsMessage.moveIndex(-4);
		
		// Init item in cache
		var fresh = false;
		if (!NotificationSrvc.CACHE[id]) {
			NotificationSrvc.CACHE[id] = new LUPNotification();
			fresh = true; // Completely new, more init later
		}
		
		// Parse notification via TypeSrvc into cache object
		TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\LinkUUp\\LUP_Notification", NotificationSrvc.CACHE[id]);
		
		// A push may arrive before NotificationCtrl has attached the model
		// resolvers. Keep the raw record then and resolve it when the page opens.
		if ((fresh || !NotificationSrvc.CACHE[id].TYPE) && LUPNotification.UserSrvc) {
			NotificationSrvc.CACHE[id].resolveData(recaching);
		}

		// Remember oldest note for load more
		if ( (!NotificationSrvc.OLDEST) || 
			 (NotificationSrvc.OLDEST.created() > NotificationSrvc.CACHE[id].created()) ) {
				NotificationSrvc.OLDEST = NotificationSrvc.CACHE[id];
		}

		// Return it
		return NotificationSrvc.CACHE[id];
	};
	
	NotificationSrvc.markedRead = function(gwsMessage) {
		console.log('NotificationSrvc.markedRead()', gwsMessage);
		var notification = NotificationSrvc.CACHE[gwsMessage.read32()];
		if (notification) {
			notification.JSON.note_read = new Date().toISOString();
			$rootScope.updateNotificationCount();
		}
	};
	
	//////////////////
	// --- Sort --- //
	//////////////////
	NotificationSrvc.resort = function() {
		console.log('NotificationSrvc.resort()');
		var notifications = [];
		for (var i in NotificationSrvc.CACHE) {
			var notification = NotificationSrvc.CACHE[i];
			notifications.push(notification);
		}
		NotificationSrvc.SORTED = NotificationSrvc.sort(notifications);
		return NotificationSrvc.SORTED;
	};

	NotificationSrvc.sort = function(notifications) {
		console.log('NotificationSrvc.sort()', notifications);
		return notifications.sort(function(a, b) {
			return b.created() - a.created();
		});
	};
	
	////////////////////
	// --- Unread --- //
	////////////////////
	NotificationSrvc.queryUnreadNotificationCount = function() {
		console.log('NotificationSrvc.queryUnreadNotificationCount()');
		var gwsMessage = new GWS_Message().cmd(0x1143).sync();
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				NotificationSrvc.gotUnreadCount);
	};

	NotificationSrvc.gotUnreadCount = function(gwsMessage) {
		var countNotifications = gwsMessage.read32();
		var countQueries = gwsMessage.read32();
		NotificationSrvc.UNREAD = countNotifications;
		ChatSrvc.UNREAD = countQueries;
		console.log('NotificationSrvc.gotUnreadCount()', countNotifications, countQueries);
		return countNotifications + countQueries;
	};
	
	NotificationSrvc.unreadNotificationCount = function() {
		var gotOne = false;
		var count = 0;
		var notes = NotificationSrvc.CACHE;
		for (var i in notes) {
			count += notes[i].read() ? 0 : 1;
			gotOne = true;
		}
		console.log('NotificationSrvc.unreadNotificationCount()', count);
		if (gotOne) {
			NotificationSrvc.UNREAD = count;
			return count;
		}
		return NotificationSrvc.UNREAD;
	};
	
	////////////////////
	// --- Delete --- //
	////////////////////
	NotificationSrvc.deleteNotification = function(notification) {
		console.log('NotificationSrvc.deleteNotification()', notification);
		var gwsMessage = new GWS_Message().cmd(0x1144).sync().write32(notification.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				NotificationSrvc.deletedNotification.bind(NotificationSrvc, notification),
				ErrorSrvc.websocketMaybeJSONError);

	};
	
	NotificationSrvc.deletedNotification = function(notification, gwsMessage) {
		console.log('NotificationSrvc.deletedNotification()', notification);
		delete NotificationSrvc.CACHE[notification.id()];
		NotificationSrvc.COUNT--;
		return notification;
	};


	return NotificationSrvc;
});
