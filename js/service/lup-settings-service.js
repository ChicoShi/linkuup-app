"use strict";
angular.module('LUP').
service('SettingsSrvc', function($rootScope, RequestSrvc, WebsocketSrvc) {
	
	var SettingsSrvc = this;
	SettingsSrvc.CACHE = null;
	
	SettingsSrvc.withConfig = function() {
		console.log('SettingsSrvc.withConfig()');
		return RequestSrvc.sendGWF('Account', 'AjaxSettings').then(SettingsSrvc.gotConfig);
	};
	
	SettingsSrvc.gotConfig = function(config) {
		console.log('SettingsSrvc.gotConfig()', config);
		SettingsSrvc.CACHE = config.data.data;
		return SettingsSrvc.CACHE;
	};
	
	SettingsSrvc.settingVar = function(setting) {
		const config = SettingsSrvc.setting(setting);
		const val = config.options.var !== undefined && config.options.var !== null ? config.options.var : config.options.selected;
		// console.log('SettingsSrvc.settingVar()', setting, val);
		return val;
	}
	
	SettingsSrvc.setting = function(setting) {
		var cache = SettingsSrvc.CACHE;
		if (!cache) {
			console.warn("SettingsSrvc.setting() before settings were loaded", setting);
			return null;
		}
		for (var module in cache) {
			var settings = cache[module];
			if (settings[setting]) {
				// console.log("SettingsSrvc.setting()", setting, settings[setting]);
				settings[setting].module = module;
				return settings[setting];
			}
		}
		console.error("SettingsSrvc.setting() yields null", setting);
	};

	/** Convert browser date controls to the compact wire format PHP expects. */
	SettingsSrvc.valueForTransport = function(setting, value) {
		var inputType = setting.renderer && setting.renderer.input_type;
		if (!inputType || !(value instanceof Date) || isNaN(value.getTime())) {
			return value;
		}
		var twoDigits = function(number) { return String(number).padStart(2, '0'); };
		var date = value.getFullYear() + '-' + twoDigits(value.getMonth() + 1) + '-' + twoDigits(value.getDate());
		var time = twoDigits(value.getHours()) + ':' + twoDigits(value.getMinutes());
		if (inputType === 'date') {
			return date;
		}
		if (inputType === 'time') {
			return time;
		}
		if (inputType === 'datetime-local') {
			return date + 'T' + time;
		}
		return value;
	};
	
	SettingsSrvc.changeSetting = function(setting, value, relation, visibilityOnly) {
		var config = typeof setting === 'string' ? SettingsSrvc.setting(setting) : setting;
		value = SettingsSrvc.valueForTransport(config, value);
		// A value change must not be rejected just because its unchanged ACL is
		// currently stricter than the profile default. Only put ACL data on the
		// wire when the user actually changed it.
		if (relation === config.initialACL) {
			relation = null;
		}
		var gwsMessage = new GWS_Message().cmd(0x0107).sync();
		var module = config.module;
		var key = config.name || setting;
		console.log("SettingSrvc.changeSetting()", module, key, value, relation);
		gwsMessage.writeString(module);
		gwsMessage.writeString(key);
		gwsMessage.writeString(value);
		if (relation !== undefined && relation !== null) {
			gwsMessage.writeString(relation);
		}
		if (visibilityOnly) {
			gwsMessage.writeString('visibility-only');
		}
		// Settings are loaded through HTTP and can outlive a reconnect.  Ensure
		// the binary write has a live socket instead of silently rejecting it.
		return WebsocketSrvc.withConnection().then(function() {
			return WebsocketSrvc.sendBinary(gwsMessage);
		}).then(function(){
			config.options = config.options || {};
			config.options.var = value;
			config.options.selected = value;
			if (relation !== undefined && relation !== null) {
				config.acl = relation;
			}
			// A profile can remain open behind the settings route on mobile. Tell
			// that view immediately that a saved public value is available instead
			// of leaving the old cards on screen until a full browser reload.
			$rootScope.$broadcast('lup-profile-setting-saved', config);
		});
	};

	return SettingsSrvc;
});
