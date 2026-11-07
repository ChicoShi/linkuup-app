"use strict";
angular.module('LUP').
service('AuthSrvc', function($q, $location, $translate, WebsocketSrvc, LoadingSrvc) {
	
	var AuthSrvc = this;
	
//	AuthSrvc.authenticated = function(callback) {
//		console.log('AuthSrvc.authenticated()');
////		if (window.GWF_USER.authenticated(true)) {
////			callback();
////		}
////		else {
////			$location.path('/login');
////		}
//	};
	
	/////////////////
	// --- TOS --- //
	/////////////////
	AuthSrvc.tosLine = function() {
		console.log('AuthSrvc.tosLine()');
		// I18n some links
		var link_tos = sprintf('<a ng-click="gotoTOS();" class="toslink">%s</a>', $translate.instant('TOS_TOS'));
		var link_privacy = sprintf('<a ng-click="gotoPrivacy();" class="toslink">%s</a>', $translate.instant('TOS_PRIVACY'));
		var line = $translate.instant('TOS_LINE');
		line = line.replace('{link_tos}', link_tos);
		line = line.replace('{link_privacy}', link_privacy);
		console.log(line);
		return line;
	};
	

	//////////////////////
	// --- Facebook --- //
	//////////////////////
	
	AuthSrvc.getCookie = function(name) {
		var value = "; " + document.cookie;
		var parts = value.split("; " + name + "=");
		if (parts.length == 2) return parts.pop().split(";").shift();
	}
	
	AuthSrvc.initFacebook = function($scope) {
		console.log('AuthSrvc.initFacebook()');
		LoadingSrvc.addTask('fbinit');
		window.fbAsyncInit = function() {
			FB.init({ appId: window.LUP_CONFIG.fb_app_id, xfbml: true, cookie: true, version: 'v2.9'});
			setTimeout(function(){LoadingSrvc.removeTask('fbinit');$scope.$apply();},1000);
//			FB.AppEvents.logPageView();
		};
		(function(d, s, id){
			var js, fjs = d.getElementsByTagName(s)[0];
			if (d.getElementById(id)) {return;}
			js = d.createElement(s); js.id = id;
			js.src = "//connect.facebook.net/en_US/sdk.js";
			fjs.parentNode.insertBefore(js, fjs);
		}(window.document, 'script', 'facebook-jssdk'));
	};

	
	AuthSrvc.afterFacebookLogin = function() {
		console.log('AuthSrvc.afterFacebookLogin()');
		var defer = $q.defer();
		window.FB.getLoginStatus(AuthSrvc.gotLoginStatus.bind(AuthSrvc, defer));
		return defer.promise;
	};

	AuthSrvc.gotLoginStatus = function(defer, response) {
		console.log('AuthSrvc.gotLoginStatus()', response);
		if ( (response.status !== 'connected') || (!response.authResponse) ) {
			return defer.reject(response);
		}

		var ar = FB.getAuthResponse();
		
		var cookie = AuthSrvc.getCookie('fbsr_'+window.LUP_CONFIG.fb_app_id);
		
		var r = response.authResponse;
		var gwsMessage = new GWS_Message().cmd(0x0111).sync().writeString(r.userID).write32(r.expiresIn).writeString(r.accessToken);
		gwsMessage.writeString(cookie);
		var success = AuthSrvc.afterWSAuth.bind(AuthSrvc, defer);
		WebsocketSrvc.sendBinary(gwsMessage).then(success, defer.reject);
	};
	
	AuthSrvc.afterWSAuth = function(defer, gwsMessage) {
		console.log('AuthSrvc.afterWSAuth()', gwsMessage);
		defer.resolve(gwsMessage);
	};
	
	return AuthSrvc;
});
