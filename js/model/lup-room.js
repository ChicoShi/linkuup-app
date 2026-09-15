"use strict";
function LUPRoom(json) {
	this.USERS = [];
	this.MESSAGES = [];

	this.setJSON = function(json) {
		this.JSON = json;
		this.room_rating = this.JSON.room_rating; // copy writable for rating
	};
	this.setJSON(json);

	this.id = function() { return this.JSON.room_id; };
	this.name = function() { return this.JSON.room_name; };
	// Keep raw import provenance in JSON for administration. Public descriptions
	// must not expose the importer's diagnostics as if they described the venue.
	this.info = function() {
		return String(this.JSON.room_info || '')
			.replace(/Quelle:\s*(?:©\s*)?OpenStreetMap contributors\s*\(ODbL(?: 1\.0)?\)\.?\s*(?:\[osm-(?:way|node|relation)-\d+\])?\s*(?:https?:\/\/(?:www\.)?openstreetmap\.org\/[^\s|]+)?/gi, '')
			.replace(/(?:^|\s*\|\s*)Lokaler Test:[^\n]*/gi, '')
			.split('\n').filter(function(line) {
				return !/^(?:Braunschweig-Testlokalität|Präzise Testlokalität|Geprüfte regionale Testlokalität)\b/.test(line.trim());
			}).join('\n').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim();
	};
	this.hasOSMSource = function() {
		return /OpenStreetMap|openstreetmap\.org|\[osm-(?:way|node|relation)-/i.test(String(this.JSON.room_info || ''));
	};
	this.mapsListingHref = function() {
		var query = [this.name(), this.street(), this.zip(), this.city()].filter(Boolean).join(' ');
		return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
	};
	this.color = function() { return this.JSON.room_color; };
	this.www = function() { return this.JSON.room_www; };
	this.zip = function() { return this.JSON.address_zip; };
	this.street = function() { return this.JSON.address_street; };
	this.city = function() { return this.JSON.address_city; };
	this.addressDisplay = function() {
		var firstLine = [this.street(), this.zip()].filter(Boolean).join(', ');
		return [firstLine, this.city()].filter(Boolean).join(' · ');
	};
	this.openTimes = function() { return this.JSON.room_hours; };
	// Older WebSocket schemas did not include this optional privacy flag. Treat a
	// missing value as the database default (visible), but honour an explicit 0.
	this.showDistance = function() {
		return this.JSON.room_show_distance === undefined || this.JSON.room_show_distance > 0;
	};

	this.isOpen = function() {
		const hours = this.openTimes();
		// A missing schedule is normal for community locations. Avoid parsing the
		// empty value again on every Angular redraw.
		if (!hours || !String(hours).trim()) {
			return null;
		}
		if (this._openHoursValue === hours && this._openHoursAt && Date.now() - this._openHoursAt < 30000) {
			return this._openHoursState;
		}
		try {
			const parser = new opening_hours(hours);
			this._openHoursValue = hours;
			this._openHoursAt = Date.now();
			this._openHoursState = parser.getState(new Date());
			return this._openHoursState;
		}
		catch (e) {
			this._openHoursValue = hours;
			this._openHoursAt = Date.now();
			this._openHoursState = null;
			return null;
		}
	};

	this.phone = function() { return this.JSON.room_phone; };
	
	this.votes = function() { return this.JSON.room_votes; };
	this.rating = function() { return this.JSON.room_rating; };
	this.comments = function() { return this.JSON.room_comments; };
	
	this.hasAddress = function() { return this.zip() || this.city() || this.street(); };
	
	this.category = function() { return this.JSON.room_category; };
	this.categoryName = function() { return LUPRoom.CategorySrvc.displayName(this.category()); };
	this.categoryColor = function() { return LUPRoom.CategorySrvc.displayColor(this.category()); };
	this.categoryIcon = function() { return LUPRoom.CategorySrvc.displayIcon(this.category()); };
	
	this.image = function() { return this.largeImageURI(''); };
	this.iconImageURI = function() { return this.imageURI('icon'); };
	this.largeImageURI = function() { return this.imageURI('large'); };
	this.originalImageURI = function() { return this.imageURI(''); };
	this.imageURI = function(variant) {
		return sprintf("%s/index.php?_mo=LinkUUp&_me=RoomImage&id=%s&variant=%s",
				window.LUP_CONFIG.server, this.id(), variant); 
	};
	
	this.lat = function() { return this.JSON.room_pos_lat; };
	this.lng = function() { return this.JSON.room_pos_lng; };
	this.view = function() { return this.JSON.room_view; };
	this.radius = function() { return this.JSON.room_radius; };
	this.distance = function() {
		return LUPRoom.PositionSrvc.hasPosition(true) ? LUPRoom.PositionSrvc.distanceTo(this.lat(), this.lng()) : null;
	};
	this.inChatRange = function() {
		// The Germany test chat is intentionally a non-physical, nationwide room.
		// Every actual location remains controlled by its GPS radius.
		const distance = this.distance();
		return distance !== null && distance <= this.radius();
	};
	this.displayDistance = function() {
		const km = this.distance();
		if (km === null || !Number.isFinite(km)) {
			return '----';
		}
		if (km < 1) {
			return `${Math.round(km * 1000)}m`;
		}
		return `${km.toFixed(1)}km`;
	};

	this.addUser = function(user) {
		console.log('LUPRoom.addUser()', this, user);
		if (this.USERS.indexOf(user) < 0) {
			this.USERS.push(user);
		}
	};

	this.removeUser = function(user) {
		var index = this.USERS.indexOf(user);
		// A delayed leave message may arrive after the user was already removed.
		// Never splice(-1, 1): that would remove the wrong last visitor.
		if (index >= 0) {
			this.USERS.splice(index, 1);
		}
		console.log('LUPRoom.removeUser()', user, index);
	};
	
	this.addMessage = function(time, user, room, messageText, isSystem) {
		console.log('LUPRoom.addMessage()', time, user, room, messageText, isSystem);
		var message = new LUP_Message(time, user, room, messageText, isSystem);
		this.MESSAGES.push(message);
		return message;
	};
	
	this.isUserInRoom = function(user) {
		const result = this.USERS.indexOf(user) >= 0;
		// console.log('LUPRoom.isInRoom()', result, user);
		return result;
	};
	
	this.isSelfInRoom = function() {
		return this.isUserInRoom(window.GWF_USER);
	};

}
