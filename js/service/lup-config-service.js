"use strict";
angular.module('LUP').
service('ConfigSrvc', function(RequestSrvc) {
	
	var ConfigSrvc = this;
	ConfigSrvc.CACHE = {
		Account: {},
		Avatar: {},
		Core: {},
		Register: {},
		Recovery: {},
	};
	
	ConfigSrvc.withConfig = function() {
		console.log('ConfigSrvc.withConfig()');
		return RequestSrvc.sendGWF('Core', 'Config').then(ConfigSrvc.gotConfig);
	};
	
	ConfigSrvc.gotConfig = function(config) {
		console.log('ConfigSrvc.gotConfig()', config);
		ConfigSrvc.CACHE = config.data.data;
		return ConfigSrvc.CACHE;
	};
	
	/////////////////
	// Convinience //
	/////////////////
	ConfigSrvc.systemUser = function() {
		var result = ConfigSrvc.CACHE.Core.system_user;
		console.log('ConfigSrvc.systemUser() === ', result);
		return result;
	};

	ConfigSrvc.bool = function(value) {
		return value === true || value === 1 || value === '1';
	};

	ConfigSrvc.signupCaptcha = function() {
		var result = ConfigSrvc.CACHE.Register.captcha;
//		console.log('ConfigSrvc.signupCaptcha() === ', result);
		return ConfigSrvc.bool(result);
	};
	
	ConfigSrvc.tosForced = function() {
		var result = ConfigSrvc.CACHE.Register.force_tos;
//		console.log('ConfigSrvc.tosForced() === ', result);
		return ConfigSrvc.bool(result);
	};

	ConfigSrvc.emailActivation = function() {
		var result = ConfigSrvc.CACHE.Register.email_activation;
//		console.log('ConfigSrvc.emailActivation() === ', result);
		return ConfigSrvc.bool(result);
	};
	
	ConfigSrvc.guestAvatars = function() {
		var result = ConfigSrvc.CACHE.Avatar.avatar_guests;
//		console.log('ConfigSrvc.guestAvatars() === ', result);
		return ConfigSrvc.bool(result);
	};
	
	ConfigSrvc.passwordRetype = function() {
		var result = ConfigSrvc.CACHE.Register.signup_password_retype;
		console.log('ConfigSrvc.passwordRetype() === ', result);
		return ConfigSrvc.bool(result);
	};

	ConfigSrvc.recoveryCaptcha = function() {
		var result = ConfigSrvc.CACHE.Recovery.recovery_captcha;
		console.log('ConfigSrvc.recoveryCaptcha() === ', result);
		return ConfigSrvc.bool(result);
	};
	ConfigSrvc.recoveryEmail = function() {
		var result = ConfigSrvc.CACHE.Recovery.recovery_email;
		console.log('ConfigSrvc.recoveryEmail() === ', result);
		return ConfigSrvc.bool(result);
	};
	ConfigSrvc.recoveryLogin = function() {
		var result = ConfigSrvc.CACHE.Recovery.recovery_login;
		console.log('ConfigSrvc.recoveryLogin() === ', result);
		return ConfigSrvc.bool(result);
	};
	
	ConfigSrvc.ipp = function() {
		var result = ConfigSrvc.CACHE.Table.ipp_http;
		console.log('ConfigSrvc.ipp() === ', result);
		return result;
	};

	////////////////
	// --- LinkUUp --- //
	////////////////
	ConfigSrvc.roomCost = function() {
		return Number((ConfigSrvc.CACHE.LinkUUp || {}).room_cost || 0);
	};

	ConfigSrvc.roomViewCost = function() {
		return Number((ConfigSrvc.CACHE.LinkUUp || {}).room_cost_view || 0);
	};

	ConfigSrvc.roomViewCostUnit = function() {
		var unit = Number((ConfigSrvc.CACHE.LinkUUp || {}).room_cost_view_unit || .5);
		return unit > 0 ? unit : .5;
	};

	ConfigSrvc.shoutCost = function() {
		return Number((ConfigSrvc.CACHE.LinkUUp || {}).shout_cost || 0);
	};

	ConfigSrvc.roomCreationCost = function(viewRadius) {
		var radius = Math.max(0, Number(viewRadius) || 0);
		var viewCost = radius * ConfigSrvc.roomViewCost() / ConfigSrvc.roomViewCostUnit();
		return ConfigSrvc.roomCost() + Math.ceil(viewCost);
	};
	
	ConfigSrvc.singleACL = function() {
		var result = ConfigSrvc.CACHE.Profile.profile_single_acl;
		console.log('ConfigSrvc.singleACL() === ', result);
		return ConfigSrvc.bool(result);
	};
	
	/////////////
	// Account //
	/////////////
	ConfigSrvc.realname = function() {
		var result = ConfigSrvc.CACHE.Account.allow_real_name;
//		console.log('ConfigSrvc.realname() === ', result);
		return ConfigSrvc.bool(result);
	};
	
	ConfigSrvc.emailChange = function() {
		var result = ConfigSrvc.CACHE.Account.allow_email_change;
		console.log('ConfigSrvc.emailChange() === ', result);
		return ConfigSrvc.bool(result);
	};

	ConfigSrvc.emailFormatChange = function() {
		var result = ConfigSrvc.CACHE.Account.allow_email_fmt_change;
		console.log('ConfigSrvc.emailFormatChange() === ', result);
		return ConfigSrvc.bool(result);
	};

	ConfigSrvc.guestSettings = function() {
		var result = ConfigSrvc.CACHE.Account.allow_guest_settings;
		console.log('ConfigSrvc.guestSettings() === ', result);
		return ConfigSrvc.bool(result);
	};
	ConfigSrvc.countryChange = function() {
		var result = ConfigSrvc.CACHE.Account.allow_country_change;
		console.log('ConfigSrvc.countryChange() === ', result);
		return ConfigSrvc.bool(result);
	};
	ConfigSrvc.languageChange = function() {
		var result = ConfigSrvc.CACHE.Account.allow_lang_change;
		console.log('ConfigSrvc.languageChange() === ', result);
		return ConfigSrvc.bool(result);
	};
	ConfigSrvc.birthdayChange = function() {
		var result = ConfigSrvc.CACHE.Account.allow_birthday_change;
		console.log('ConfigSrvc.birthdayChange() === ', result);
		return ConfigSrvc.bool(result);
	};
	ConfigSrvc.genderChange = function() {
		var result = ConfigSrvc.CACHE.Account.allow_gender_change;
		console.log('ConfigSrvc.genderChange() === ', result);
		return ConfigSrvc.bool(result);
	};

	return ConfigSrvc;
});
