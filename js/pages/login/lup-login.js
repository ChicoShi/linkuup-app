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
		AuthSrvc, WebsocketSrvc, UserSrvc, ErrorSrvc, ConfigSrvc, LoadingSrvc) {

	$scope.data.title = 'TITLE_LOGIN';

	$scope.ConfigSrvc = ConfigSrvc;

	$scope.data.facebookMode = false;

	$scope.data.error = null;
	$scope.data.errors = {};
	$scope.data.tosLine = AuthSrvc.tosLine();

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
		$scope.data.facebookMode = false;
		$location.path('/signup');
	};

	///////////////////////
	// --- LUP Login --- //
	///////////////////////
	$scope.switchToLogin = function() {
		console.log('LoginCtrl.switchToLogin()');
		$scope.data.error = null;
		$scope.data.errors = {};
		$scope.data.facebookMode = false;
	};

	$scope.login = function() {
		console.log('LoginCtrl.login()');
		$scope.withPosition().then(function(pos){
			console.log('LoginCtrl.login() has pos', pos);
			$scope.data.error = null;
			$scope.data.errors = {};
			var data = $scope.data;
			var gwsMessage = new GWS_Message().cmd(0x0103).sync().writeString(data.email).writeString(data.password).write16(1).writeString("");
			WebsocketSrvc.sendBinary(gwsMessage).then($scope.loginSuccess, $scope.loginFailure);
		});
	};

	$scope.loginSuccess = function(response) {
		console.log('LoginCtrl.loginSuccess()', response);
		window.GWF_USER.update(JSON.parse(response));
		LoadingSrvc.stopTask('oauth');
		$rootScope.$broadcast('lup-authenticated', window.GWF_USER);
	};
	$scope.loginFailure = function(response) {
		console.log('LoginCtrl.loginFailure()', response);
		LoadingSrvc.stopTask('oauth');
		if (response === undefined) {
			ErrorSrvc.showError(t('err_websocket_connection'));
		} else {
			ErrorSrvc.populateScope($scope, response);
		}
	};

	$scope.setCookie = function(name, value, days) {
		console.log('LoginCtrl.setCookie()', name, value, days);
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
		console.log('LoginCtrl.loginAsGuest()', $scope.data.nickname);
		return $scope.withPosition().then(function(pos) {
			$scope.data.error = null;
			$scope.data.errors = {};
			var gwsMessage = new GWS_Message().cmd(0x0101).sync().writeString($scope.data.nickname);
			if (ConfigSrvc.tosForced()) {
				gwsMessage.write16($scope.data.tos?1:0);
			}
			return WebsocketSrvc.sendBinary(gwsMessage).then($scope.loginSuccess, $scope.loginFailure);
		});
	};

	////////////////////////////
	// --- Facebook login --- //
	////////////////////////////
	$scope.initFacebook = function() {
		console.log('LoginCtrl.initFacebook()');
		$scope.data.error = null;
		$scope.data.errors = {};
		if (!$scope.data.fbInited) {
			$scope.data.fbInited = true;
			AuthSrvc.initFacebook($scope);
		}
		$scope.data.facebookMode = true;
	};

	$scope.afterFacebookLogin = function() {
		console.log('LoginCtrl.afterFacebookLogin()');
		LoadingSrvc.addTask('oauth');
		AuthSrvc.afterFacebookLogin().then($scope.loginSuccess, $scope.loginFailure);
	};
	window.afterFacebookLogin = $scope.afterFacebookLogin;

	/////////////////////////////
	// --- Instagram login --- //
	/////////////////////////////
	$scope.initInstagram = function() {
//		console.log('LoginCtrl.initInstagram()');
//		$scope.goto('/instagram-login').then(function() {
			console.log('LoginCtrl.initInstagram()');
			var clientId = window.LUP_CONFIG.ig_client_id;
			var redirectURL = encodeURIComponent(window.LUP_CONFIG.ig_redirect_url);
			var instagramURL = 'https://instagram.com/oauth/authorize/?client_id='+clientId+'&redirect_uri='+redirectURL+'&response_type=token';
			$scope.instagramWindow = window.open(instagramURL);
			$scope.initInstagramInterval();
			LoadingSrvc.addTask('oauth');
//		});
	};

	$scope.intervalRuns = 0;
	$scope.initInstagramInterval = function() {
		console.log('LoginCtrl.initInstagramInterval()');
		if ($scope.instagramInterval) {
            clearInterval($scope.instagramInterval);
		}
		$scope.instagramInterval = setInterval(function() {
            try {
                // Check if hash exists
                if($scope.instagramWindow.location.hash.length) {
                    // Hash found, that includes the access token
                    clearInterval($scope.instagramInterval);
                    $scope.instagramInterval = null;
                    var hash = $scope.instagramWindow.location.hash;
                    $scope.instagramToken = hash.substrFrom('#access_token=');
                    $scope.instagramWindow.close();
                    $scope.afterInstagram($scope.instagramToken);
                }
            }
            catch(evt) {
                // Permission denied
            }
            if ($scope.instagramWindow.closed) {
        		console.log('LoginCtrl.initInstagramInterval() CLEARED');
        		clearInterval($scope.instagramInterval);
        		$scope.instagramInterval = null;
            }
        }, 100);

	};

	$scope.afterInstagram = function(token) {
		console.log('LoginCtrl.afterInstagram()', token);
		var gwsMessage = new GWS_Message().cmd(0x0112).sync().writeString(token);
		WebsocketSrvc.sendBinary(gwsMessage).then($scope.loginSuccess, $scope.loginFailure);
	};


	//////////////////
	// --- Init --- //
	//////////////////
	$scope.init = function() {
		console.log('LoginCtrl.init()');
		$scope.data.email = '';
		$scope.data.password = '';
		$scope.data.nickname = '';
		$scope.data.fbInited = false;
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
});
