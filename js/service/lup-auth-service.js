"use strict";
angular.module('LUP').
service('AuthSrvc', function($q, $location, $translate, WebsocketSrvc, LoadingSrvc, RequestSrvc) {
	
	var AuthSrvc = this;

	// Cookie rotation belongs to HTTP. Reconnect WS only after verifying that
	// the browser has accepted the new server-issued authentication cookie.
	AuthSrvc.httpAuthentication = function(method, data, expectedType) {
		var previous = window.LUP_CONFIG.ws_secret;
		return RequestSrvc.sendGWF('Login', method, data, 'POST').then(function(formResponse) {
			return RequestSrvc.sendGWF('Websocket', 'GetSecret').then(function(response) {
				var session = response && response.data && response.data.data;
				if (!session || !session.user || session.user.user_type !== expectedType ||
					!/^\d+-[a-zA-Z0-9]{32}$/.test(session.secret || '') || session.secret === previous) {
					return $q.reject(formResponse.data || 'err_authentication_required');
				}
				WebsocketSrvc.disconnect();
				window.LUP_CONFIG.ws_secret = session.secret;
				window.LUP_CONFIG.cookie = session.secret;
				// Logout must remain usable even when the realtime service is down.
				if (expectedType === 'ghost') return JSON.stringify(session.user);
				return WebsocketSrvc.withConnection().then(function() {
					return JSON.stringify(session.user);
				});
			});
		});
	};
	AuthSrvc.login = function(login, password) {
		return AuthSrvc.httpAuthentication('Form', {login:login,password:password,bind_ip:'0',submit:'Login'}, 'member');
	};
	AuthSrvc.logout = function() {
		return AuthSrvc.httpAuthentication('Logout', {}, 'ghost');
	};
	// Register and guest creation also rotate the browser cookie. Bootstrap the
	// real form first so installations with rotating CSRF protection work too.
	AuthSrvc.registerHTTP = function(method, data, expectedType, allowPending) {
		var previous = window.LUP_CONFIG.ws_secret;
		return RequestSrvc.sendGWF('Websocket', 'GetSecret').then(function() {
			return RequestSrvc.gwfPage('Register', method);
		}).then(function(response) {
			var doc = new DOMParser().parseFromString(String(response.data || ''), 'text/html');
			var token = doc.querySelector('input[name="xsrf"]');
			if (!token) return $q.reject('Registrierungsformular ist nicht verfügbar.');
			return RequestSrvc.sendGWF('Register', method, Object.assign({}, data, {xsrf:token.value,submit:'Register'}), 'POST');
		}).then(function(response) {
			var result = response && response.data;
			if (!result || result.error || (result.form && (result.form.form_error || Object.values(result.form.errors || {}).some(Boolean)))) {
				return $q.reject(JSON.stringify(result || {global:'Registrierung fehlgeschlagen.'}));
			}
			return RequestSrvc.sendGWF('Websocket', 'GetSecret').then(function(fresh) {
				var session = fresh && fresh.data && fresh.data.data;
				if (!session || !session.user || !/^\d+-[a-zA-Z0-9]{32}$/.test(session.secret || '')) return $q.reject('Sitzung konnte nicht bestätigt werden.');
				if (session.user.user_type !== expectedType) {
					if (allowPending && ['ghost','guest'].includes(session.user.user_type)) return {pendingActivation:true};
					return $q.reject('Registrierung konnte nicht bestätigt werden.');
				}
				if (session.secret === previous) return $q.reject('Sitzung wurde nicht erneuert.');
				WebsocketSrvc.disconnect();
				window.LUP_CONFIG.ws_secret = session.secret;
				window.LUP_CONFIG.cookie = session.secret;
				return WebsocketSrvc.withConnection().then(function() { return JSON.stringify(session.user); });
			});
		}, function(error) { return $q.reject(error && error.data ? JSON.stringify(error.data) : error); });
	};
	AuthSrvc.register = function(data) { return AuthSrvc.registerHTTP('Form', data, 'member', true); };
	AuthSrvc.guest = function(data) { return AuthSrvc.registerHTTP('Guest', data, 'guest', false); };
	AuthSrvc.google = function(config) {
		var enabled = config && config.GoogleAuth && config.GoogleAuth.google_auth;
		if (![true,1,'1'].includes(enabled)) return $q.reject('Google-Anmeldung ist hier noch nicht eingerichtet. Bitte nutze E-Mail und Passwort.');
		window.location.assign(window.LUP_CONFIG.server + 'index.php?_mo=GoogleAuth&_me=Auth');
	};

	
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
