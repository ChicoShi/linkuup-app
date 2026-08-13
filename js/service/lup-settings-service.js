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
		console.log('SettingsSrvc.settingVar()', setting, val);
		return val;
	}
	
	SettingsSrvc.setting = function(setting) {
		var cache = SettingsSrvc.CACHE;
		for (var module in cache) {
			var settings = cache[module];
			if (settings[setting]) {
				console.log("SettingsSrvc.setting()", setting, settings[setting]);
				settings[setting].module = module;
				return settings[setting];
			}
		}
		console.error("SettingsSrvc.setting() yields null", setting);
	};
	
	SettingsSrvc.changeSetting = function(setting, value, relation) {
		var config = typeof setting === 'string' ? SettingsSrvc.setting(setting) : setting;
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
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(){
			config.options = config.options || {};
			config.options.var = value;
			config.options.selected = value;
			if (relation !== undefined && relation !== null) {
				config.acl = relation;
			}
		});
	};

	return SettingsSrvc;
});
