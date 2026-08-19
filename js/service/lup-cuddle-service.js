"use strict";
angular.module('LUP').
service('CuddleSrvc', function(WebsocketSrvc) {

	var CuddleSrvc = this;

	CuddleSrvc.getUserCuddles = function(user) {
		console.log('CuddleSrvc.getUserCuddles()', user);
		var gwsMessage = new GWS_Message().cmd(0x1164).sync();
		gwsMessage.write32(user.id());
		return WebsocketSrvc.sendBinary(gwsMessage);
	};

	return CuddleSrvc;
});
