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
	};
	
	SettingsSrvc.settingVar = function(setting) {
		const val = SettingsSrvc.setting(setting)['var'];
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
	
	SettingsSrvc.changeSetting = function(setting, value) {
		var gwsMessage = new GWS_Message().cmd(0x0107).sync();
		var module = SettingsSrvc.setting(setting).module;
		console.log("SettingSrvc.changeSetting()", module, setting, value);
		gwsMessage.writeString(module);
		gwsMessage.writeString(setting);
		gwsMessage.writeString(value);
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(){
			SettingsSrvc.setting(setting)['selected'] = value;
		});
	};

	return SettingsSrvc;
});
