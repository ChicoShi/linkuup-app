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
			room_name: '',
			room_info: '',
			room_hours: '',
			room_phone: '',
			room_www: '',
			room_pos_lat: null,
			room_pos_lng: null,
			room_color: '000000',
			room_category: null,
			address_zip: '',
			address_street: '',
			address_city: '',
		});
	};
	
	RoomSrvc.CACHE = {};
	// One shared request prevents the initial screen and a background preload
	// from asking the WebSocket for the same location catalogue twice.
	RoomSrvc.ROOMS_LOADING = null;
	// The nearby list and the complete discovery catalogue serve different UI
	// moments. Cache the latter as well: category changes must be local filters,
	// never a second visible network wait.
	RoomSrvc.ALL_ROOMS = null;
	RoomSrvc.ALL_ROOMS_LOADING = null;
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
		// Keep live RoomAdded events in exactly the same predictable order as a
		// freshly fetched room list: chat-range first, then nearest distance. A
		// missing GPS position must not turn the comparator into NaN/undefined,
		// because browsers are then free to leave the newly appended room anywhere.
		var aInRange = a.inChatRange();
		var bInRange = b.inChatRange();
		if (aInRange !== bInRange) {
			return aInRange ? -1 : 1;
		}
		var aDistance = a.distance();
		var bDistance = b.distance();
		aDistance = Number.isFinite(aDistance) ? aDistance : Number.POSITIVE_INFINITY;
		bDistance = Number.isFinite(bDistance) ? bDistance : Number.POSITIVE_INFINITY;
		if (aDistance !== bDistance) {
			return aDistance - bDistance;
		}
		var nameOrder = String(a.name() || '').localeCompare(String(b.name() || ''));
		return nameOrder || (a.id() - b.id());
	};
	
	RoomSrvc.withRooms = function(includeAll) {
		// Discovery is location based. Do not silently substitute a global room
		// catalogue when the browser has not supplied a real GPS position: that is
		// both expensive for the carousel and misleading for a nearby view.
		if (!PositionSrvc.hasPosition()) {
			return $q.reject('GPS position required for locations.');
		}
		if (includeAll && RoomSrvc.ALL_ROOMS) {
			return $q.when(RoomSrvc.ALL_ROOMS);
		}
		if (includeAll && RoomSrvc.ALL_ROOMS_LOADING) {
			return RoomSrvc.ALL_ROOMS_LOADING;
		}
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
		else {
			RoomSrvc.ALL_ROOMS_LOADING = defer.promise;
			defer.promise.then(function(rooms) {
				RoomSrvc.ALL_ROOMS = rooms;
				return rooms;
			})['finally'](function() {
				RoomSrvc.ALL_ROOMS_LOADING = null;
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
		// The backend applies every room's visibility radius and orders the result
		// from this concrete position.  There is deliberately no (0,0) discovery
		// fallback; callers wait for GPS instead of rendering every public room.
		var position = PositionSrvc.CURRENT;
		loadRooms(position);
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
