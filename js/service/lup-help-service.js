"use strict";
angular.module('LUP').
/**
 * Show a help dialog with optional show again.
 */
service('HelpSrvc', function($rootScope, $q, WebsocketSrvc, DialogSrvc, ErrorSrvc) {

	var HelpSrvc = this;
	
	HelpSrvc.READ = null;
	
	/**
	 * Clear cache on new login
	 */
	$rootScope.$on('lup-clear-cache', function(event) {
		console.log('HelpSrvc.$on-lup-clear-cache()');
		HelpSrvc.READ = null;
	});
	
	/**
	 * Get read help keys. cached.
	 */
	HelpSrvc.withReads = function() {
		console.log('HelpSrvc.withReads()');
		// cache
		if (HelpSrvc.READ !== null) {
			return $q.resolve(HelpSrvc.READ);
		};
		var gwsMessage = new GWS_Message().cmd(0x1190).sync();
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				HelpSrvc.gotReads,
				ErrorSrvc.websocketMaybeJSONError);
	};
	
	HelpSrvc.gotReads = function(result) {
		console.log('HelpSrvc.gotReads()', result);
		// A newly created account has no help rows. Some database drivers encode
		// that empty result as `null`; the client contract is always an array so
		// first use of a screen can never prevent the rest of its initialization.
		var reads = JSON.parse(result || '[]');
		HelpSrvc.READ = Array.isArray(reads) ? reads : [];
		return HelpSrvc.READ;
	};
	
	/**
	 * Show a help dialog.
	 * The key is to remember which helps have been shown already.
	 * The html is the dialog html content.
	 */
	HelpSrvc.lastKey = null; // Dont show twice workaround.
	HelpSrvc.showHelp = function(key, html) {
		console.log('HelpSrvc.showHelp()', key);
		HelpSrvc.withReads().then(function(helps){
			// A disconnected first WebSocket attempt is reported as undefined by
			// the generic error adapter. Help is optional, so it must never block a
			// screen from loading while the socket finishes authenticating.
			helps = Array.isArray(helps) ? helps : [];
			HelpSrvc.READ = helps;
			console.log('HelpSrvc.showHelp() old: ', helps);
			if (helps.indexOf(key) === -1) {
				if (HelpSrvc.lastKey != key) {
					HelpSrvc.lastKey = key;
					DialogSrvc.confirm("js/service/tpl/lup-help-dialog.html", {html:html}).then(
							HelpSrvc.confirmed.bind(HelpSrvc, key), angular.noop)['catch'](HelpSrvc.catchUnknown);
				}
			}
		})['catch'](HelpSrvc.catchUnknown);
	};

	HelpSrvc.catchUnknown = function(error) {
		if ($rootScope.catchUnknown) {
			return $rootScope.catchUnknown(error);
		}
		return ErrorSrvc.websocketMaybeJSONError(error);
	};
	
	HelpSrvc.confirmed = function(key) {
		console.log('HelpSrvc.confirmed()', key);
		var gwsMessage = new GWS_Message().cmd(0x1191).sync().writeString(key);
		return WebsocketSrvc.sendBinary(gwsMessage).then(function(){
			HelpSrvc.READ.push(key);
		}, ErrorSrvc.websocketMaybeJSONError);
	};
	
	HelpSrvc.reset = function() {
		console.log('HelpSrvc.reset()');
		var gwsMessage = new GWS_Message().cmd(0x1192).sync();
		var promise = WebsocketSrvc.sendBinary(gwsMessage);
		promise['catch'](ErrorSrvc.websocketMaybeJSONError);
		return promise;
	};
	
	return HelpSrvc;
});
