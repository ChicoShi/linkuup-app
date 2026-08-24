'use strict';
angular.module('LUP')
.service('FXSrvc', function($q, $mdDialog) {
	
	var FXSrvc = this;
	
	FXSrvc.vibrate = function(ms) {
		console.log('FXSrvc.vibrate()', ms);
		if (window.navigator.vibrate) {
			window.navigator.vibrate(ms);
		}
	};

	FXSrvc.play = function(name) {
		if (window.LUPAudio) {
			return window.LUPAudio.play(name);
		}
	};
	
	FXSrvc.onChat = function(user, room) {
		console.log('FXSrvc.onChat()', user, room);
		if (!user.isSelf()) {
			FXSrvc.vibrate(100);
			FXSrvc.play('message');
		}
	};

	FXSrvc.onQuery = function(message) {
		console.log('FXSrvc.onQuery()', message);
		if (message.toUser().isSelf()) {
			FXSrvc.play('message');
			FXSrvc.onNotification();
		}
	};
	
	FXSrvc.onNotification = function() {
		console.log('FXSrvc.onNotification()');
		FXSrvc.vibrate(500);
		
		// TODO: make notification icon in top bar turn red. Can be done with jquery as well
		
	};

	return FXSrvc;
});
