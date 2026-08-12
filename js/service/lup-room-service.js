"use strict";
/**
 * Rooms cache.
 */
angular.module('LUP').
service('RoomSrvc', function($q, UserSrvc, LogoSrvc, CategorySrvc, PositionSrvc, WebsocketSrvc, TypeSrvc) {
	var RoomSrvc = this;

	// Assign services to LUPRoom model.
	LUPRoom.LogoSrvc = LogoSrvc;
	LUPRoom.UserSrvc = UserSrvc;
	LUPRoom.CategorySrvc = CategorySrvc;
	
	////////////////////
	// --- Static --- //
	////////////////////
	RoomSrvc.NEW_BLANK_ROOM = function(roomId) {
		return new LUPRoom({
			room_id: roomId,
			room_creator_id: 0,
			room_pos_lat: null,
			room_pos_lng: null,
			room_color: '000000',
			room_category: null,
		});
	};
	
	RoomSrvc.CACHE = {};
	// One shared request prevents the initial screen and a background preload
	// from asking the WebSocket for the same location catalogue twice.
	RoomSrvc.ROOMS_LOADING = null;
	RoomSrvc.BLANK_ROOM = RoomSrvc.NEW_BLANK_ROOM(0);

	///////////////////////////
	// --- Binary Parser --- //
	///////////////////////////
	RoomSrvc.parseRoomsMessage = function(gwsMessage) {
		var rooms = [];
		while (gwsMessage.hasMore()) {
			var room = RoomSrvc.parseRoomMessage(gwsMessage);
			RoomSrvc.CACHE[room.id()] = room;
			rooms.push(room);
		}
		return rooms;
	};
	
	RoomSrvc.parseRoomMessage = function(gwsMessage) {
		var roomid = gwsMessage.read32();
		gwsMessage.moveIndex(-4);
		var room = RoomSrvc.CACHE[roomid] ? RoomSrvc.CACHE[roomid] : new LUPRoom({room_id: roomid});
		TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\LinkUUp\\LUP_Room", room);
		TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\Address\\GDO_Address", room);
		RoomSrvc.parseRoomMessageUsers(room, gwsMessage);
		return room;
	};
	
	RoomSrvc.parseRoomMessageUsers = function(room, gwsMessage) {
		// A room-list response is authoritative. Rebuild its visitor list rather
		// than appending to a stale one left over from a previous screen or socket.
		room.USERS = [];
		var uid = 0;
		while (uid = gwsMessage.read32()) {
			var user = UserSrvc.getOrCreate(uid);
			room.addUser(user);
		}
	};
	
	////////////////////////
	// --- Room query --- //
	////////////////////////
	RoomSrvc.withRoom = function(roomId, refresh) {
		console.log('RoomSrvc.withRoom()', roomId, !!refresh);
		console.log(RoomSrvc.CACHE);
		var deferred = $q.defer();
		if ( (!refresh) && RoomSrvc.CACHE[roomId]) {
//			console.log('RoomSrvc.withRoom() was cached.');
			deferred.resolve(RoomSrvc.CACHE[roomId]);
		}
		else {
			if (!RoomSrvc.CACHE[roomId]) {
				RoomSrvc.CACHE[roomId] = RoomSrvc.NEW_BLANK_ROOM(roomId);
			}
//			console.log('RoomSrvc.withRoom() load from websocket.', roomId);
			RoomSrvc.withRequestRoom(roomId, deferred);
		}
		return deferred.promise;
	};
	
	RoomSrvc.withRequestRoom = function(roomId, deferred) {
		console.log('RoomSrvc.withRequestRoom()', roomId);
		var gwsMessage = new GWS_Message().cmd(0x1102).sync().write32(roomId);
		var success = RoomSrvc.gotRoom.bind(RoomSrvc, deferred);
		return WebsocketSrvc.sendBinary(gwsMessage).then(success, function(){
			deferred.resolve(RoomSrvc.CACHE[roomId]);
		});
	};

	RoomSrvc.gotRoom = function(deferred, gwsMessage) {
		console.log('RoomSrvc.gotRoom()', gwsMessage);
		var room = RoomSrvc.parseRoomMessage(gwsMessage);
		RoomSrvc.CACHE[room.id()] = room;
		return deferred.resolve(room);
	};
	
	RoomSrvc.getOrCreate = function(roomId) {
//		console.log('RoomSrvc.getOrCreate()', roomId);
		if (RoomSrvc.CACHE[roomId]) {
//			console.log('RoomSrvc.getOrCreate() cached', roomId);
			return RoomSrvc.CACHE[roomId];
		}
		else {
			RoomSrvc.withRoom(roomId);
			return RoomSrvc.CACHE[roomId];
		}
	};
	
	RoomSrvc.withUsers = function(room) {
		console.log('RoomSrvc.withUsers()', room);
		var defer = $q.defer();
		var gwsMessage = new GWS_Message().cmd(0x1125).sync().write32(room.id());
		var success = RoomSrvc.gotRoomUsers.bind(RoomSrvc, defer);
		return WebsocketSrvc.sendBinary(gwsMessage).then(success, defer.reject);
	};
	
	RoomSrvc.gotRoomUsers = function(defer, gwsMessage) {
		console.log('RoomSrvc.gotRoomUsers()', gwsMessage.dump());
		var roomId = gwsMessage.read32();
		var room = RoomSrvc.CACHE[roomId];
		if (!room) {
			return defer.reject("no such room");
		}
		room.USERS = [];
		while (gwsMessage.hasMore()) {
			var user = UserSrvc.getOrCreate(gwsMessage.read32());
			room.addUser(user);
		}
		defer.resolve(room);
	};
	
	RoomSrvc.getRoomsForUser = function(user) {
		var rooms = [];
		for (var roomId in RoomSrvc.CACHE) {
			var room = RoomSrvc.CACHE[roomId];
			if (room.isUserInRoom(user)) {
				rooms.push(room);
			}
		}
		console.log('RoomSrvc.getRoomsForUser()', user, rooms);
		return rooms;
	};
	
	
	RoomSrvc.sortDistance = function(a, b) {
		if (b.inChatRange() == a.inChatRange()) {
			return a.distance() - b.distance();
		}
		else if (b.inChatRange()) {
			return 1;
		}
		else if (a.inChatRange()) {
			return -1;
		}
	};
	
	RoomSrvc.withRooms = function(includeAll) {
		if (!includeAll && RoomSrvc.ROOMS_LOADING) {
			return RoomSrvc.ROOMS_LOADING;
		}
		var defer = $q.defer();
		if (!includeAll) {
			RoomSrvc.ROOMS_LOADING = defer.promise;
			defer.promise['finally'](function() {
				RoomSrvc.ROOMS_LOADING = null;
			});
		}
		var loadRooms = function(p) {
			var gwsMessage = new GWS_Message().cmd(0x1101).sync().writeFloat(p.lat).writeFloat(p.lng);
			WebsocketSrvc.sendBinary(gwsMessage).then(function(msg){
				var rooms = RoomSrvc.parseRoomsMessage(msg);
				rooms = rooms.sort(RoomSrvc.sortDistance);
//				rooms = rooms.sort(RoomSrvc.sortJoinable);
				defer.resolve(rooms);
			}, defer.reject);
		};
		// Do not make the location catalogue depend on the browser's GPS dialog
		// or its retry timeout. A known position is used immediately; otherwise
		// the server receives (0,0) and returns the public discovery list.
		var position = PositionSrvc.CURRENT;
		if (!includeAll && PositionSrvc.hasPosition(false)) {
			loadRooms(position);
		}
		else {
			console.warn('LinkUUp: loading full location catalogue.');
			loadRooms({lat: 0, lng: 0});
		}
		return defer.promise;
	};

	RoomSrvc.searchRooms = function(query) {
		var gwsMessage = new GWS_Message().cmd(0x1163).sync().writeString(query);
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(msg) {
			return RoomSrvc.parseRoomsMessage(msg);
		});
	};
	
	RoomSrvc.part = function(room) {
		console.log('RoomSrvc.part()', room);
		var gwsMessage = new GWS_Message().cmd(0x1104).write32(room.id());
		return WebsocketSrvc.sendBinary(gwsMessage);
	};

	
	return RoomSrvc;
});
