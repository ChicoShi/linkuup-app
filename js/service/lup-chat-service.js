'use strict';
angular.module('LUP').service('ChatSrvc', function($rootScope, $q,
		UserSrvc, WebsocketSrvc, StorageSrvc, TypeSrvc, ErrorSrvc) {
	
	var ChatSrvc = this;
	
	ChatSrvc.MESSAGES = {};
	ChatSrvc.QUERIES = [];
	ChatSrvc.CHATROOM = null;
	$rootScope.$on('gws-ws-disconnect', function() {
		ChatSrvc.CHATROOM = null;
	});
	// Small, live event summary shown above a room conversation. Keep only the
	// newest relevant event of each type; full history remains in the chat.
	ChatSrvc.EVENTS = {shout: null, join: null};
	ChatSrvc.UNREAD = 0;
	ChatSrvc.CHATS_LOADED = false;
	ChatSrvc.CHATS_LOADING = null;

	ChatSrvc.noteEvent = function(type, room, user, text, time) {
		ChatSrvc.EVENTS[type] = {room: room, user: user, text: text || '', time: time};
		if (type === 'join' || type === 'shout') {
			$rootScope.$broadcast('lup-room-activity', room);
		}
	};

	ChatSrvc.eventForRoom = function(type, room) {
		var event = ChatSrvc.EVENTS[type];
		return event && room && event.room && event.room.id() === room.id() ? event : null;
	};
	
	/**
	 * Join a channel
	 */
	ChatSrvc.join = function(room, password) {
		if (!room.id()) {
			return $q.reject("Cannot join blank dummy Room");
		}
		return WebsocketSrvc.withConnection().then(function() {
		console.log('ChatSrvc.join()', room.id());
		// Routes and websocket refreshes can recreate the Room object. Presence is
		// keyed by room id, not by that transient JavaScript object identity.
		if (ChatSrvc.CHATROOM && room.id() === ChatSrvc.CHATROOM.id()) {
			console.log('ChatSrvc.join() nothing todo');
			var defer = $q.defer();
			defer.resolve();
			return defer.promise;
		} else {
			var previousRoom = ChatSrvc.CHATROOM;
			var sendJoin = function() {
			var pos = window.GWF_POSITION;
			var gwsMessage = new GWS_Message().cmd(0x1103);
			gwsMessage.write32(room.id());
			gwsMessage.writeFloat(pos.lat).writeFloat(pos.lng);
			gwsMessage.writeString(password||"");
			return WebsocketSrvc.sendBinary(gwsMessage).then(function(){
				ChatSrvc.CHATROOM = room;
			}, function(error) {
				ChatSrvc.CHATROOM = null;
				// Do not turn a rejected GPS/server join into a false success. The
				// caller must keep the composer closed until membership is confirmed.
				return $q.reject(error);
			});
			};
			// Presence is exclusive: moving to another venue always parts the old
			// room first, so a person cannot remain shown as online in both cards.
			if (previousRoom) {
				return ChatSrvc.part(previousRoom).then(sendJoin, sendJoin);
			}
			return sendJoin();
		}
		});
	};
	
	ChatSrvc.part = function(room) {
		console.log('ChatSrvc.part()', room);
		ChatSrvc.CHATROOM = null; // Clear active chate beforehand... can't hurt, or might even fix out of sync?
		var gwsMessage = new GWS_Message().cmd(0x1104).write32(room.id()); // Send PART command
		return WebsocketSrvc.sendBinary(gwsMessage);
	};

	/* Server-side radius enforcement can part us without a local button click.
	 * Keep the client-side active-room marker in the same state as presence, or
	 * a later Join button would incorrectly resolve as "already joined". */
	ChatSrvc.leftRoom = function(room, user) {
		if (user && user.isSelf && user.isSelf() && ChatSrvc.CHATROOM &&
			ChatSrvc.CHATROOM.id() === room.id()) {
			ChatSrvc.CHATROOM = null;
		}
	};
	
	ChatSrvc.sendMessage = function(room, message) {
		console.log('ChatSrvc.sendMessage()', room, message);
		var gwsMessage = new GWS_Message().cmd(0x1107);
		gwsMessage.write32(room.id());
		gwsMessage.writeString(message);
		return WebsocketSrvc.sendBinary(gwsMessage);
	};

	/** Send a paid broadcast without pretending the sender joined every room. */
	ChatSrvc.sendShout = function(radius, message, center) {
		var radiusKM = Math.max(0.001, Number(radius) || 0);
		/* The leading integer is the legacy whole-kilometre radius. */
		var gwsMessage = new GWS_Message().cmd(0x1166).sync().write32(Math.ceil(radiusKM)).writeString(message);
		/* Optional centre follows the legacy payload, keeping older clients valid. */
		if (center && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng))) {
			gwsMessage.writeFloat(Number(center.lat)).writeFloat(Number(center.lng));
			gwsMessage.write32(Math.round(radiusKM * 1000));
		}
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(reply) {
			var result = {
				credits: reply.read32(),
				radius: reply.read32() / 1000,
				locations: reply.read32(),
				recipients: reply.read32()
			};
			window.GWF_USER.JSON.user_credits = result.credits;
			$rootScope.$broadcast('lup-credits-changed', result.credits);
			return result;
		});
	};

	///////////
	// Query //
	///////////
	ChatSrvc.forMessage = function(message) {
		var thread = ChatSrvc.forThreadId(message.threadId());
		if (!thread) {
			thread = new LUP_QueryThread({
				lupqt_id: message.threadId(),
				lupqt_user_a: message.fromId(),
				lupqt_user_b: message.toId(),
				lupqt_updated: message.sent(),
				lupqt_last_text: message.text()
			});
			ChatSrvc.QUERIES.push(thread);
		}
		return thread;
	};

	ChatSrvc.forThreadId = function(threadId) {
		for (var i in ChatSrvc.QUERIES) {
			if (String(ChatSrvc.QUERIES[i].id()) === String(threadId)) {
				return ChatSrvc.QUERIES[i];
			}
		}
		return null;
	};

	ChatSrvc.forUser = function(user) {
		var thread = null;
		for (var i in ChatSrvc.QUERIES) {
			var candidate = ChatSrvc.QUERIES[i];
			if (candidate.user().id() === user.id() && (!thread || candidate.updated() > thread.updated())) {
				thread = candidate;
			}
		}
		return thread;
	};

	ChatSrvc.draftForUser = function(user) {
		var ownId = Number(window.GWF_USER.id());
		var otherId = Number(user.id());
		return new LUP_QueryThread({
			lupqt_id: 0,
			lupqt_user_a: Math.min(ownId, otherId),
			lupqt_user_b: Math.max(ownId, otherId),
			lupqt_updated: 0,
			lupqt_last_text: ''
		});
	};
	ChatSrvc.sendQuery = function(user, message) {
		console.log('ChatSrvc.sendQuery()', user, message);
		// The sender inserts the authoritative stored message from this reply.
		// Without a sync id sendBinary() resolves immediately with undefined,
		// so loadMessage() would try to read a frame that does not exist.
		var gwsMessage = new GWS_Message().cmd(0x1108).sync();
		gwsMessage.write32(user.id());
		gwsMessage.writeString(message);
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(response) {
			// The sender receives this as a synchronous reply, not as the normal
			// asynchronous 0x1108 event. Add it locally so own PMs render at once.
			var sent = ChatSrvc.loadMessage(response);
			sent.effect = 'blubble';
			var thread = ChatSrvc.forMessage(sent);
			thread.addNewMessage(sent);
			$rootScope.updateNotificationCount();
			$rootScope.$broadcast('lup-query-message', sent);
			return sent;
		});
	};
	
	ChatSrvc.reset = function() {
		console.log('ChatSrvc.reset()');
		ChatSrvc.QUERIES = [];
		ChatSrvc.MESSAGES = {};
		ChatSrvc.loadingState = null;
		ChatSrvc.CHATS_LOADED = false;
		ChatSrvc.CHATS_LOADING = null;
	};
	
	ChatSrvc.unreadMessages = function() {
		var count = 0;
		for (var i in ChatSrvc.QUERIES) {
			var query = ChatSrvc.QUERIES[i];
			count += query.unreadCount();
		}
		ChatSrvc.UNREAD = count;
		console.log('ChatSrvc.unreadMessages()', count);
		return count;
	};
	
	ChatSrvc.parseQueryMessageRead = function(gwsMessage) {
		console.log('ChatSrvc.parseQueryMessageRead()', gwsMessage);
		var msgId = gwsMessage.read32();
		var message = ChatSrvc.getMessage(msgId);
		if (message) {
			message.JSON.lupqm_delivered = gwsMessage.read32();
			message.JSON.lupqm_read = gwsMessage.read32();
			message.JSON.lupqm_ack = gwsMessage.read8();
			message.pending = false;
		}
		return message;
	};
	
	ChatSrvc.updateReadState = function(queryMessage) {
		console.log('ChatSrvc.updateReadState()', queryMessage);
		if ( (queryMessage.pending) || (queryMessage.isRead()) ) {
			return $q.resolve(queryMessage);
		}
		queryMessage.pending = true;
		var gwsMessage = new GWS_Message().cmd(0x1109).sync().write32(queryMessage.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				function(gwsMessage) {
					var message = ChatSrvc.parseQueryMessageRead(gwsMessage);
					$rootScope.updateNotificationCount();
					return message;
				});
	};
	
	ChatSrvc.markRead = function(lupMessage) {
		console.log('ChatSrvc.markRead()', lupMessage);
		lupMessage.read = true;
	};
	
	////////////////////////////
	// --- new DB queries --- //
	////////////////////////////
	ChatSrvc.loadChats = function(userId) {
		console.log('ChatSrvc.loadChats()', userId);
		if (ChatSrvc.CHATS_LOADED) {
			return $q.when(ChatSrvc.QUERIES);
		}
		if (ChatSrvc.CHATS_LOADING) {
			return ChatSrvc.CHATS_LOADING;
		}
		var gwsMessage = new GWS_Message().cmd(0x110A).sync();
		ChatSrvc.CHATS_LOADING = WebsocketSrvc.sendBinary(gwsMessage).then(function(response) {
			var chats = ChatSrvc.loadedChats(response);
			ChatSrvc.CHATS_LOADED = true;
			ChatSrvc.CHATS_LOADING = null;
			return chats;
		}, function(error) {
			ChatSrvc.CHATS_LOADING = null;
			return $q.reject(error);
		});
		return ChatSrvc.CHATS_LOADING;
	};
	
	ChatSrvc.loadedChats = function(response) {
		console.log('ChatSrvc.loadedChats()', response);
		while(response.hasMore()) {
			var thread = ChatSrvc.loadThread(response);
			if (!ChatSrvc.forThreadId(thread.id())) {
				ChatSrvc.QUERIES.push(thread);
			}
		}
		return ChatSrvc.QUERIES;
	};

	ChatSrvc.loadThread = function(response) {
		var thread = new LUP_QueryThread();
		TypeSrvc.parseBinaryGDO(response, "GDO\\LinkUUp\\LUP_QueryThread", thread);
		return thread;
	};
	
	ChatSrvc.getMessage = function(messageId) {
		console.log('ChatSrvc.getMessage()', messageId);
		if (ChatSrvc.MESSAGES[messageId]) {
			return ChatSrvc.MESSAGES[messageId];
		}
		var message = LUP_QueryMessage.blank();
		message.JSON.lupqm_id = messageId;
		ChatSrvc.MESSAGES[messageId] = message;
		return message;
	};
	
	ChatSrvc.loadMessage = function(response) {
		console.log('ChatSrvc.loadMessage()', response);
		var id = response.read32();
		response.moveIndex(-4);
		var message = ChatSrvc.getMessage(id);
		TypeSrvc.parseBinaryGDO(response, "GDO\\LinkUUp\\LUP_QueryMessage", message);
		console.log('ChatSrvc.loadMessage()', message);
		return message;
	};
	
	ChatSrvc.loadThreadMessages = function(thread) {
		if (!thread || !thread.id()) {
			return $q.resolve(thread);
		}
		if (thread.loading) {
			return thread.loading;
		}
		var gwsMessage = new GWS_Message().cmd(0x110B).sync();
		gwsMessage.write32(thread.id());
		thread.loading = WebsocketSrvc.sendBinary(gwsMessage).then(function(response) {
			while (response.hasMore()) {
				thread.addMessage(ChatSrvc.loadMessage(response));
			}
			thread.loading = null;
			return thread;
		}, function(error) {
			thread.loading = null;
			return $q.reject(error);
		});
		return thread.loading;
	};
	
	ChatSrvc.deleteQuery = function(chat) {
		console.log('ChatSrvc.deleteQuery()', chat);
		var gwsMessage = new GWS_Message().cmd(0x110C).sync();
		gwsMessage.write32(chat.id());
		var success = ChatSrvc.deletedQuery.bind(ChatSrvc, chat);
		return WebsocketSrvc.sendBinary(gwsMessage).then(success);
	};
	
	ChatSrvc.deletedQuery = function(chat, gwsMessage) {
		console.log('ChatSrvc.deletedQuery()', chat);
		var numDeleted = gwsMessage.read32();
		var index = ChatSrvc.QUERIES.indexOf(chat);
		if (index > -1) {
			ChatSrvc.QUERIES.splice(index, 1);
		}
		ErrorSrvc.showMessage(t('MSG_CHAT_DELETED', {amount:numDeleted}));
		return gwsMessage;
	};
	
	return ChatSrvc;
});
