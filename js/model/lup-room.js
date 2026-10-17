"use strict";
// Mirrors GDT_Polygon::containsOrNear for the importer's single closed ring.
// Unsupported/malformed shapes must never fall back to the display radius.
LUPRoom.containsReviewedPosition = function(polygon, lat, lng, tolerance) {
	const finiteNumber = value => (typeof value === 'number' ||
		(typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
	if (![lat, lng, tolerance].every(finiteNumber)) return false;
	lat = Number(lat); lng = Number(lng); tolerance = Number(tolerance);
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || tolerance < 0) return false;
	if (typeof polygon === 'string') {
		try { polygon = JSON.parse(polygon); } catch (_) { return false; }
	}
	if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) ||
		polygon.coordinates.length !== 1) return false;
	const ring = polygon.coordinates[0];
	if (!Array.isArray(ring) || ring.length < 4 || !ring.every(point =>
		Array.isArray(point) && point.length === 2 && point.every(finiteNumber) &&
		Math.abs(Number(point[0])) <= 180 && Math.abs(Number(point[1])) <= 90)) return false;
	const points = ring.map(point => point.map(Number));
	const last = points.length - 1;
	if (points[0][0] !== points[last][0] || points[0][1] !== points[last][1]) return false;
	// Translate before the area sum to avoid cancellation for small venues.
	let area = 0;
	for (let i = 1; i < last; i++) {
		area += (points[i][0] - points[0][0]) * (points[i + 1][1] - points[0][1]) -
			(points[i + 1][0] - points[0][0]) * (points[i][1] - points[0][1]);
	}
	if (area === 0) return false;
	let inside = false;
	for (let i = 0, j = last; i <= last; j = i++) {
		const [xi, yi] = points[i], [xj, yj] = points[j];
		const crossProduct = (lng - xi) * (yj - yi) - (lat - yi) * (xj - xi);
		if (Math.abs(crossProduct) < 1e-10 && lng >= Math.min(xi, xj) &&
			lng <= Math.max(xi, xj) && lat >= Math.min(yi, yj) && lat <= Math.max(yi, yj)) return true;
		if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
	}
	if (inside) return true;
	const longitudeKm = 111.32 * Math.max(.01, Math.cos(lat * Math.PI / 180));
	let minDistance = Infinity;
	for (let i = 1; i <= last; i++) {
		const ax = (points[i - 1][0] - lng) * longitudeKm, ay = (points[i - 1][1] - lat) * 111.32;
		const bx = (points[i][0] - lng) * longitudeKm, by = (points[i][1] - lat) * 111.32;
		const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy;
		const factor = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
		minDistance = Math.min(minDistance, Math.hypot(ax + factor * dx, ay + factor * dy));
	}
	return minDistance <= tolerance;
};

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
		// Nullable binary FLOAT arrives as NaN; NULL/missing is also legacy.
		// Explicit zero opts into the
		// reviewed polygon just like a positive per-room tolerance (kilometres).
		const tolerance = this.JSON.room_join_tolerance;
		if (tolerance !== undefined && tolerance !== null && !Number.isNaN(tolerance)) {
			const position = LUPRoom.PositionSrvc;
			if (!position.hasPosition(true)) return false;
			const current = position.CURRENT;
			return !!current && LUPRoom.containsReviewedPosition(
				this.JSON.room_polygon, current.lat, current.lng, tolerance);
		}
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
