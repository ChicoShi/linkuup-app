"use strict";
function GDO_Profile(json) {
	console.log('new GDO_Profile()', json);
	json = json||{};

	this.JSON = json;
	this.ERRORS = {};
	this.EMPTY = {};
	this.user = null;
	this.relation = 0;

	this.setJSON = function(json) {
		this.JSON = json;
	};
	
	this.setJSON(json); // Init

	
	/////////////////
	// --- ACL --- //
	/////////////////
	this.has = function(setting) {
		var _setting = !!this.JSON[setting] && (this.JSON[setting] !== '0');
		console.log('GDO_Profile.has()', setting, this.JSON[setting], _setting);
		return _setting;
	};

	this.canGloballySee = function() {
		return this._canSee("profile_visible");
	};
	this.canSee = function(setting) {
		// TODO: Check if gdo6 is in single_ACL profile mode
		return true;
//		return this._canSee("profile_" + setting + "_visible");
	};
	this._canSee = function(setting) {
		var result = false;
		var acl = this.JSON[setting];
		if (this.user === window.GWF_USER) {
			result = true;
		}
		else {
			switch(acl) {
			case 'acl_all': result = true; break;
			case 'acl_members': result = window.GWF_USER.isMember(); break;
			case 'acl_friends': result = !!this.relation; break;
			case 'acl_noone': result = false; break;
			default:
				if (acl !== undefined) {
					console.error('Invalid ACL value: '+acl);
				}
			}
		}
//		console.log("GDO_Profile._canSee()", setting, acl, result);
		return result;
	};

	/////////////////////
	// --- Display --- //
	/////////////////////
	this.displayAbout = function() { return this.JSON.about_me; };
	this.displayEyeColor = function() { return t(this.JSON.lup_eyecolor); };
	this.displayICQ = function() { return this.JSON.lup_icq; };
	this.displayHeight = function() { return sprintf('%.02fm', this.JSON.lup_height); };
	this.displaySexO = function() { 
		var sexo = this.JSON.lup_sexo;
		return sexo != 0 ? window.t('sexo_'+sexo) : window.t('LBL_NOT_SPECIFIED');
	};
	this.displayInterest = function() {
		return this.displayEnum('lup_interest');
	};
	this.displayEnum = function(field) {
		field = this.JSON[field];
		return field != 0 ? window.t(field) : window.t('LBL_NOT_SPECIFIED');
	};
	
	this.hasOrigin = function() {
		return this.JSON.lup_origin !== 'null';
	};
	
	this.originId = function() {
		return this.JSON.lup_origin;
	};
	
	this.hasCountry = function() {
		var result = this.user.JSON.user_country;
		result = result != 0 && result != 'zz';
		console.log('GDO_User.hasCountry()', result);
		return result;
	};
	
}
