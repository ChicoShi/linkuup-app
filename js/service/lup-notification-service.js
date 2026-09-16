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
  return !NotificationSrvc.WORKING && NotificationSrvc.SORTED.length < NotificationSrvc.COUNT;
 };
 NotificationSrvc.loadMore = function() {
  if (NotificationSrvc.WORKING) return NotificationSrvc.WORKING;
  if (!NotificationSrvc.shouldLoadMore()) return $q.resolve(NotificationSrvc.SORTED);
  // The wire uses Unix seconds, the decoded model uses milliseconds.
  var oldest=NotificationSrvc.OLDEST;
  var time=oldest ? Math.floor(Number(oldest.created())/1000) : 0;
  var message=new GWS_Message().cmd(0x1141).sync().write32(time).write32(oldest ? oldest.id() : 0);
  var request=WebsocketSrvc.sendBinary(message).then(NotificationSrvc.gotPage);
  NotificationSrvc.WORKING=request;
  request.then(function(){NotificationSrvc.WORKING=false;},function(){NotificationSrvc.WORKING=false;});
  return request;
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
			 ((NotificationSrvc.OLDEST.created() > NotificationSrvc.CACHE[id].created() || (NotificationSrvc.OLDEST.created() === NotificationSrvc.CACHE[id].created() && Number(NotificationSrvc.OLDEST.id()) > Number(id)))) ) {
				NotificationSrvc.OLDEST = NotificationSrvc.CACHE[id];
		}

		// A repeated push updates its object, never duplicates the row or badge.
  if (fresh && recaching) {
   NotificationSrvc.COUNT++;
   if (!NotificationSrvc.CACHE[id].read()) NotificationSrvc.UNREAD++;
  }
  return NotificationSrvc.CACHE[id];
	};
	
	NotificationSrvc.markedRead = function(gwsMessage) {
		console.log('NotificationSrvc.markedRead()', gwsMessage);
		var notification = NotificationSrvc.CACHE[gwsMessage.read32()];
		if (notification) {
			if (!notification.read()) NotificationSrvc.UNREAD=Math.max(0,NotificationSrvc.UNREAD-1);
			notification.JSON.note_read = new Date().toISOString();
			notification.loading=false;
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
			return b.created() - a.created() || Number(b.id())-Number(a.id());
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
  // A loaded page is only part of the inbox, not the server's unread total.
  return NotificationSrvc.UNREAD;
 };

	////////////////////
	// --- Delete --- //
	////////////////////
	NotificationSrvc.deleteNotification = function(notification) {
		console.log('NotificationSrvc.deleteNotification()', notification);
		var gwsMessage = new GWS_Message().cmd(0x1144).sync().write32(notification.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				NotificationSrvc.deletedNotification.bind(NotificationSrvc, notification));

	};
	
	NotificationSrvc.deletedNotification = function(notification, gwsMessage) {
		console.log('NotificationSrvc.deletedNotification()', notification);
		if (!notification.read()) NotificationSrvc.UNREAD=Math.max(0,NotificationSrvc.UNREAD-1);
		delete NotificationSrvc.CACHE[notification.id()];
		NotificationSrvc.COUNT=Math.max(0,NotificationSrvc.COUNT-1);
		NotificationSrvc.resort();
		$rootScope.updateNotificationCount();
		// A visible event may have been marked read before its action completes.
		// Reconcile the badge with the authoritative server counter so an accepted
		// friendship request cannot leave a stale notification dot behind.
		return NotificationSrvc.queryUnreadNotificationCount().then(function() {
			$rootScope.updateNotificationCount();
			return notification;
		});
	};


	return NotificationSrvc;
});
