"use strict";
/**
 * Rooms cache.
 */
angular.module('LUP').
service('RoomSrvc', function($q, UserSrvc, LogoSrvc, CategorySrvc, PositionSrvc, WebsocketSrvc, TypeSrvc) {
	var RoomSrvc = this;
	// Presence always reflects the server roster, including on local hosts.
	RoomSrvc.displayUsers = function(room) { return room && room.USERS || []; };


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
	RoomSrvc.ROOM_LOADING = {};
	RoomSrvc.withRoom = function(roomId, refresh) {
		if (RoomSrvc.ROOM_LOADING[roomId]) return RoomSrvc.ROOM_LOADING[roomId];
		var cached = RoomSrvc.CACHE[roomId];
		// getOrCreate installs a blank immediately for legacy model references.
		// That placeholder is not a completed room and must not mask a retry.
		if (!refresh && cached && cached.name()) return $q.when(cached);
		if (!cached) RoomSrvc.CACHE[roomId] = RoomSrvc.NEW_BLANK_ROOM(roomId);
		var message = new GWS_Message().cmd(0x1102).sync().write32(roomId);
		var request = WebsocketSrvc.sendBinary(message).then(function(response) {
			var room = RoomSrvc.parseRoomMessage(response);
			RoomSrvc.CACHE[room.id()] = room;
			return room;
		});
		RoomSrvc.ROOM_LOADING[roomId] = request;
		function finished() {delete RoomSrvc.ROOM_LOADING[roomId];}
		request.then(finished, finished);
		return request;
	};

	RoomSrvc.getRoom = function(roomId) {
		const room = RoomSrvc.CACHE[roomId] ? RoomSrvc.CACHE[roomId] : null;
		console.log('RoomSrvc.getRoom()', roomId, room);
		return room
	};

	RoomSrvc.getOrCreate = function(roomId) {
		if (RoomSrvc.CACHE[roomId]) {
			return RoomSrvc.CACHE[roomId];
		}
		else {
			RoomSrvc.withRoom(roomId).then(null, function() { /* Background placeholder; explicit loads can retry. */ });
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
		// Nearby discovery is location based. The complete public catalogue is a
		// separate, explicit search/category action and uses the backend's 0,0
		// discovery sentinel. It may therefore be browsed without GPS; entering a
		// room and every presence action still enforce the real location radius.
		if (!includeAll && !PositionSrvc.hasPosition(true)) {
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
		// The backend applies every room's visibility radius for a nearby request.
		// For a full catalogue request it recognises (0,0) as a public discovery
		// query and deliberately skips that radius filter. Do not use a user's real
		// coordinates here or category/search results silently lose distant rooms.
		var position = includeAll ? {lat: 0.0, lng: 0.0} : PositionSrvc.CURRENT;
		var gwsMessage = new GWS_Message().cmd(0x1101).sync().writeFloat(position.lat).writeFloat(position.lng);
		// Return the parser's promise as well. An exception must reject this
		// request instead of leaving a separate deferred pending forever.
		var request = WebsocketSrvc.sendBinary(gwsMessage).then(function(msg) {
			return RoomSrvc.parseRoomsMessage(msg).sort(RoomSrvc.sortDistance);
		});
		var loadingKey = includeAll ? 'ALL_ROOMS_LOADING' : 'ROOMS_LOADING';
		RoomSrvc[loadingKey] = request;
		request.then(function(rooms) {
			RoomSrvc[loadingKey] = null;
			if (includeAll) RoomSrvc.ALL_ROOMS = rooms;
		}, function() {
			RoomSrvc[loadingKey] = null;
		});
		return request;
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
