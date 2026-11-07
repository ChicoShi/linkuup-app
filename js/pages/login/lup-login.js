"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.
	when('/login', {
		templateUrl: 'js/pages/login/lup-login.html?v='+window.LUP_BUILD,
		controller: 'LoginCtrl',
		params: {
			authCheck: false,
		},
	}).
	when('/guest-login', {
		templateUrl: 'js/pages/login/lup-guest-login.html?v='+window.LUP_BUILD,
		controller: 'LoginCtrl',
		params: {
			authCheck: false,
		},
	});
}).controller('LoginCtrl', function($rootScope, $scope, $location, $mdDialog,
		$translate, AuthSrvc, WebsocketSrvc, UserSrvc, ErrorSrvc, ConfigSrvc, LoadingSrvc) {

	$scope.data.title = 'TITLE_LOGIN';

	$scope.ConfigSrvc = ConfigSrvc;

	$scope.data.error = null;
	$scope.data.errors = {};
	$scope.data.tosLine = AuthSrvc.tosLine();
	$scope.data.loginPending = false;

	$scope.init = function() {
		console.log('LoginCtrl.init()', window.GWF_USER);
		$scope.data.tosLine = AuthSrvc.tosLine();
	};
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', function () {
		setTimeout(function () {
			requestAnimationFrame(function () {
				setTimeout(function () {
					$scope.showGuestDialog();
				}, 200);
			});
		}, 200);
	});

	$scope.showGuestDialog = function () {
		// if (window.localStorage.getItem('lup_guest')) {
		// 	return;
		// }
		// else {
		// 	window.localStorage.setItem('lup_guest', '1');
		// }

		// const $scope2 = $scope;
		// function DialogController($scope, $mdDialog) {
		// 	$scope.gotoGuestLogin = function () {
		// 		$mdDialog.cancel();
		// 		$scope2.goto('/guest-login');
		// 	};
		// 	$scope.cancel = function() {
		// 		$mdDialog.cancel();
		// 	};
		// };
		//
		// // Return promise
		// return $mdDialog.show({
		// 	controller: DialogController,
		// 	templateUrl: 'js/dialogs/lup-login-choice-dialog.html',
		// 	parent: angular.element(document.body),
		// 	// targetEvent: event,
		// 	clickOutsideToClose: true,
		// });

	};

	////////////////
	/// Register ///
	///////////////
	$scope.switchToSignUp = function() {
		console.log('LoginCtrl.switchToSignUp()');
		$location.path('/signup');
	};

	$scope.login = function() {
		console.log('LoginCtrl.login()');
		if ($scope.data.loginPending) {
			return;
		}
		$scope.data.loginPending = true;
		var submitLogin = function(pos) {
			console.log('LoginCtrl.login() has position', pos);
			$scope.data.error = null;
			$scope.data.errors = {};
			var data = $scope.data;
			// Some local keyboard layouts emit æ for AltGr+Q. Normalise it here so
			// an e-mail login reaches the server as an actual e-mail address.
			var login = String(data.email || '').trim().replace(/[æÆ]/g, '@');
			data.email = login;
			AuthSrvc.login(login, data.password).then($scope.loginSuccess, $scope.loginFailure)['catch']($scope.catchUnknown);
		};
		// A location is helpful for nearby places, but must never delay login.
		// It is requested again after authentication for nearby rooms.
		submitLogin(null);
	};

	$scope.loginSuccess = function(response) {
		$scope.data.loginPending = false;
		window.GWF_USER.update(JSON.parse(response));
		LoadingSrvc.stopTask('oauth');
		$rootScope.$broadcast('lup-authenticated', window.GWF_USER);
	};
	$scope.loginFailure = function(response) {
		console.log('LoginCtrl.loginFailure()', response);
		$scope.data.loginPending = false;
		LoadingSrvc.stopTask('oauth');
		// A native WebSocket failure rejects with an Event object. It is not a
		// form response, so never feed it into populateScope() (which would turn
		// it into the unhelpful "[object Event]" modal).
		if (response === undefined || response === null || response === 'err_websocket_connection' ||
			(response && typeof response === 'object' &&
				(typeof Event === 'undefined' || response instanceof Event || response.type === 'error'))) {
			ErrorSrvc.showError(t('err_websocket_connection'));
		} else {
			ErrorSrvc.populateScope($scope, response);
		}
	};

	$scope.setCookie = function(name, value, days) {
		var expires = "";
		if (days) {
			var date = new Date();
			date.setTime(date.getTime() + (days*24*60*60*1000));
			expires = "; expires=" + date.toUTCString();
		}
		window.document.cookie = name + "=" + value + expires + "; path=/";
	}

	/////////////////////////
	// --- Guest login --- //
	/////////////////////////
	$scope.switchToGuestLogin = function() {
		$scope.data.error = null;
		$scope.data.errors = {};
		$location.path('/guest-login');
	};
	$scope.loginAsGuest = function() {
		if ($scope.data.loginPending) return;
		$scope.data.loginPending = true;
		$scope.data.error = null; $scope.data.errors = {};
		return AuthSrvc.guest({user_guest_name:$scope.data.nickname,tos:$scope.data.tos?'1':'0',captcha:$scope.data.captcha || ''})
			.then($scope.loginSuccess, $scope.loginFailure)['finally'](function() { $scope.data.loginPending = false; });
	};

	//////////////////////////
	// --- Google sign-in --- //
	//////////////////////////
	$scope.initGoogleAuth = function() {
		var result = AuthSrvc.google(ConfigSrvc.CACHE);
		if (result) result.catch(function(message) { ErrorSrvc.showMessage(message, 'Google-Anmeldung'); });
	};

	//////////////////
	// --- Init --- //
	//////////////////
	$scope.init = function() {
		console.log('LoginCtrl.init()');
		$scope.data.email = '';
		$scope.data.password = '';
		$scope.data.nickname = '';
		$scope.data.loginPending = false;
		if ($scope.data.authenticated) {
			console.log('LoginCtrl.init()');
			let link_tos = sprintf('<a ng-click="gotoTOS();" class="toslink">%s</a>', $translate.instant('TOS_TOS'));
			let link_privacy = sprintf('<a ng-click="gotoPrivacy();" class="toslink">%s</a>', $translate.instant('TOS_PRIVACY'));
			let line = $translate.instant('TOS_LINE');
			line = line.replace('{link_tos}', link_tos);
			line = line.replace('{link_privacy}', link_privacy);
			$scope.data.tosLine = line;
		}
	};
	// The root data object is shared between routes. Always clear stale guest
	// values when this controller is created after a logout.
	$scope.init();
});
