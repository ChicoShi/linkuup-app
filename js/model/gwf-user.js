"use strict";
var GWF_User = function(json) {

	this.JSON = json;

	this.hasPermission = function(permission) { var p = this.JSON.permissions; return p && !!p[permission]; };
	this.authenticated = function(allowGuest) { return this.isMember() || (this.hasGuestName() && allowGuest); };
	this.isMember = function() { return this.JSON.user_type === 'member'; };
	this.isGuest = function() { return this.JSON.user_type === 'guest'; };
	this.isAuthed = function() { return this.authenticated(true); }; // TODO: read allow_guest core config.
	this.isSelf = function() { return window.GWF_USER.id() == this.id(); };
	this.isNotSelf = function() { return !this.isSelf(); };
	this.isMale = function() { return this.gender() === 'male'; };
	this.isFemale = function() { return this.gender() === 'female'; };
	this.isFriend = function() {
		return this.JSON.relationship !== null && this.JSON.relationship !== 'Not specified';
	};

	this.likes = function() { return this.JSON.lup_likes||0; };
	this.isVIP = function() { return Number(this.JSON.lup_vip || 0) > 0; };
	this.friends = function() { return this.JSON.lup_friends||0; };
	this.visits = function() { return this.JSON.lup_visits||0; };
	this.avatarVersion = function() { return this.JSON.avatar_version||0; };

	this.id = function(id) { if(id) this.JSON.user_id = id; return this.JSON.user_id; };
	this.secret = function() { return window.GWF_CONFIG.wss_secret; };
	this.name = function(name) { if(name) this.JSON.user_name = name; return this.JSON.user_name; };
	this.gender = function(gender) { if(gender) this.JSON.user_gender = gender; return this.JSON.user_gender; };
	this.guestName = function(name) { if(name) this.JSON.user_guest_name = name; return this.JSON.user_guest_name; };
	this.hasGuestName = function() { return !!this.JSON.user_guest_name; };
	this.realName = function() { return this.JSON.user_real_name; };
	this.hasRealName = function() { return !!this.JSON.user_real_name; };

	this.displayName = function() {
		if (this.hasGuestName()) { return this.guestName(); }
		if (this.JSON.user_real_name) { return this.realName(); }
		if (this.JSON.user_name) { return this.name(); }
		return this.id();
	};

	this.city = function() { return 'Braunschweiggg'; };
	this.email = function() { return this.JSON.user_email; };
	this.displayGender = function() { return this.gender() === 'no_gender' ? '' : this.gender(); };
	this.ghost = function(isGhost) { if (isGhost !== undefined) this.GHOST = isGhost; return this.GHOST; };
	this.update = function(json) {
		console.log('GWF_User.update()', json);
		for (var i in json) {
			this.JSON[i] = json[i];
		}
		this.GHOST = undefined;
	};
	this.status = function() { return this.JSON.lup_status; };
	this.avatarURI = function() {
		if (this.id() === 0 || this.id() === '0') {
			return window.LUP_CONFIG.server +
				'index.php?_mo=Avatar&_me=Image&nodisposition=1';
		}
		return window.LUP_CONFIG.server +
			'index.php?_mo=Avatar&_me=ForUser&id='+this.id()+'&v='+this.avatarVersion() +
			'&nodisposition=1';
	};
	this.countryId = function() { return this.JSON.user_country; };
	this.countryURL = function() { return window.LUPSERVICE.CountrySrvc.countryURL(this.countryId()||'zz'); };

	this.loaded = function() { return !!this.JSON.user_name; };
};

GWF_User.ghost = function(userId) {
	var user = new GWF_User({
		user_id: userId,
//		user_guest_id: 0,
		avatar_version: 0,
	});
	user.GHOST = true;
	return user;
};
