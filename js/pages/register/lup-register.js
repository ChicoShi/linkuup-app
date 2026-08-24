angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/signup', {
		templateUrl: 'js/pages/register/lup-register.html?v='+window.LUP_BUILD,
		controller: 'RegisterCtrl',
		params: {
			authCheck: false,
		},
	});
}).controller('RegisterCtrl', function($scope, $rootScope, $location, $translate,
		AuthSrvc, WebsocketSrvc, ConfigSrvc, TypeSrvc, ErrorSrvc) {
	
	$scope.data.title = 'TITLE_SIGNUP';
	$scope.data.tos  = null;
	$scope.data.captcha  = '';
	$scope.data.username  = '';
	$scope.data.password  = '';
	$scope.data.password_retype  = '';
	$scope.data.email  = '';
	
	$scope.data.error = null;
	$scope.data.errors = {};
	
	$scope.ConfigSrvc = ConfigSrvc;
	
	$scope.init = function() {
//		if ($scope.data.authenticated) {
			console.log('RegisterCtrl.init()');
			$scope.data.tosLine = AuthSrvc.tosLine();
//		}
	};
	
	$scope.captchaUrl = function() {
		return window.LUP_CONFIG.server + '/index.php?_mo=Captcha&_me=Image&_ajax=1';
	};
	
	$scope.register = function() {
		console.log('RegisterCtrl.register()');
		$scope.withPosition().then(function(pos){
			$scope.data.error = null;
			$scope.data.errors = {};
			var data = $scope.data;
			var gwsMessage = new GWS_Message().cmd(0x0102).sync();
			gwsMessage.writeString(data.username).writeString(data.password);
			
			if (ConfigSrvc.passwordRetype()) {
				gwsMessage.writeString(data.password_retype);
			}
			gwsMessage.writeString(data.email);
			if (ConfigSrvc.tosForced()) {
				gwsMessage.write16(data.tos?1:0);
			}
			if (ConfigSrvc.signupCaptcha()) {
				gwsMessage.writeString(data.captcha);
			}
			return WebsocketSrvc.sendBinary(gwsMessage).then($scope.registerSuccess, $scope.registerFailure);
		}, $scope.failedPosition)['catch']($scope.catchUnknown);
	};
	
	$scope.registerSuccess = function(msg) {
		console.log('RegisterCtrl.registerSuccess()', msg);
		window.GWF_USER.update(JSON.parse(msg));
		if (window.GWF_USER.authenticated(true)) {
			$rootScope.$broadcast('lup-authenticated', window.GWF_USER);
		} else {
			$scope.data.tos  = null;
			$scope.data.captcha  = '';
			$scope.data.username  = '';
			$scope.data.password  = '';
			$scope.data.password_retype  = '';
			$scope.data.email  = '';
			ErrorSrvc.showMessage(
					$translate.instant("MSG_ACTIVATE_MAIL"),
					$translate.instant("TITLE_SIGNUP"));
		}
	};

	$scope.registerFailure = function(response) {
		console.log('RegisterCtrl.registerFailure()', response);
		ErrorSrvc.populateScope($scope, response);
	};
	
	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
