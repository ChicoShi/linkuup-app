"use strict";
angular.module('LUP').
service('FriendSrvc', function($q, WebsocketSrvc, ErrorSrvc, DialogSrvc, UserSrvc) {
	
	var FriendSrvc = this;
	
	FriendSrvc.addFriend = function(user) {
		console.log('FriendSrvc.addFriend()', user);
		// Request::createForm() expects frq_friend, frq_message and
		// frq_relation in that order. GDT_FriendRelation is a 16-bit enum.
		var gwsMessage = new GWS_Message().cmd(0x1131).sync()
			.write32(user.id())
			.writeString('')
			.write16(1); // friend
		return WebsocketSrvc.sendBinary(gwsMessage).then(
			FriendSrvc.sentRequest.bind(FriendSrvc, user),
			FriendSrvc.cannnotAddFriend);
	};
	
	FriendSrvc.sentRequest = function(user) {
		console.log('FriendSrvc.sentRequest()', user);
		user.JSON.relation_pending = 1;
		UserSrvc.withUser(user.id(), true);
		ErrorSrvc.showMessage(
				window.t('MSGP_SENT_FRIEND_REQUEST'),
				window.t('MSGT_SENT_FRIEND_REQUEST'));
	};

	// A request belongs to its sender. While it is still unanswered, the
	// location presence card lets that sender revoke it without treating it
	// like an existing friendship.
	FriendSrvc.cancelFriendRequest = function(user) {
		console.log('FriendSrvc.cancelFriendRequest()', user);
		var gwsMessage = new GWS_Message().cmd(0x1136).sync().write32(user.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(response) {
			user.JSON.relation_pending = 0;
			UserSrvc.withUser(user.id(), true);
			return response;
		}, ErrorSrvc.websocketJSONError);
	};

	FriendSrvc.acceptFriendRequest = function(user) {
		console.log('FriendSrvc.acceptFriendRequest()', user);
		var gwsMessage = new GWS_Message().cmd(0x1132).sync()
			.write32(user.id()).write32(window.GWF_USER.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(response) {
			UserSrvc.gotUserMessage(response);
			user.JSON.relation_incoming = 0;
			return response;
		}, ErrorSrvc.websocketJSONError);
	};

	FriendSrvc.denyFriendRequest = function(user) {
		console.log('FriendSrvc.denyFriendRequest()', user);
		var gwsMessage = new GWS_Message().cmd(0x1137).sync().write32(user.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(response) {
			UserSrvc.gotUserMessage(response);
			user.JSON.relation_incoming = 0;
			return response;
		}, ErrorSrvc.websocketJSONError);
	};
	
	FriendSrvc.cannnotAddFriend = function(response) {
		console.log('FriendSrvc.cannnotAddFriend()', response);
		ErrorSrvc.showErrorsForWSFields(null, response);
	};
	
	FriendSrvc.getFriendList = function(user, page) {
		console.log('FriendSrvc.getFriendList()', user, page);
		var gwsMessage = new GWS_Message().cmd(0x0603).sync().write32(user.id()).write16(page);
		return WebsocketSrvc.sendBinary(gwsMessage);
	};
	
	// --- Delete with Confirm --- //
	FriendSrvc.removeFriend = function(friend) {
		console.log("FriendSrvc.removeFriend()", friend);
		var defer = $q.defer();
		var dialogURL = "js/pages/friends/lup-friend-delete.html";
		var dialogData = {
			friend: friend,
		};
		DialogSrvc.confirm(dialogURL, dialogData).then(
				FriendSrvc.reallyRemoveFriend.bind(FriendSrvc, friend, defer),
				defer.reject.bind(defer));
		return defer.promise;
	};
	
	FriendSrvc.reallyRemoveFriend = function(friend, defer) {
		console.log("FriendSrvc.reallyRemoveFriend()", friend, defer);
		var gwsMessage = new GWS_Message().cmd(0x1134).sync().write32(friend.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				FriendSrvc.removedFriend.bind(FriendSrvc, friend, defer),
				ErrorSrvc.websocketJSONError);
	};
	
	FriendSrvc.removedFriend = function(friend, defer, gwsMessage) {
		console.log('FriendSrvc.removedFriend()', friend, gwsMessage);
		friend.JSON.relationship = null; // unfriended
		friend.JSON.relation_pending = 0;
		return defer.resolve(gwsMessage);
	};
	
	//////////////////////////////
	// --- Check permission --- //
	//////////////////////////////
	FriendSrvc.isFriendListAllowed = function(user) {
		console.log("FriendSrvc.isFriendListAllowed()", user);
		var gwsMessage = new GWS_Message().cmd(0x1135).sync().write32(user.id());
		return WebsocketSrvc.sendBinary(gwsMessage);
	};
	
	return FriendSrvc;
});
