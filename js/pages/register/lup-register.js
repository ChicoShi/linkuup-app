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

	$scope.initGoogleAuth = function() {
		var result = AuthSrvc.google(ConfigSrvc.CACHE);
		if (result) result.catch(function(message) { ErrorSrvc.showMessage(message, 'Google-Anmeldung'); });
	};
	$scope.register = function() {
		if ($scope.data.registerPending) return;
		$scope.data.registerPending = true;
		$scope.data.error = null; $scope.data.errors = {};
		var data = $scope.data;
		return AuthSrvc.register({user_name:data.username,user_password:data.password,
			password_retype:data.password_retype,user_email:data.email,tos:data.tos?'1':'0',captcha:data.captcha})
			.then($scope.registerSuccess, $scope.registerFailure)['finally'](function() { $scope.data.registerPending = false; });
	};

	$scope.registerSuccess = function(msg) {
		if (!msg.pendingActivation) window.GWF_USER.update(JSON.parse(msg));
		if (!msg.pendingActivation && window.GWF_USER.authenticated(true)) {
			$rootScope.$broadcast('lup-authenticated', window.GWF_USER);
		} else {
			$scope.data.tos  = null;
			$scope.data.captcha  = '';
			$scope.data.username  = '';
			$scope.data.password  = '';
			$scope.data.password_retype  = '';
			$scope.data.email  = '';
			ErrorSrvc.showMessage(
					"Registrierung übermittelt. Falls eine Freigabe erforderlich ist, folge der Bestätigungsnachricht. Danach kannst du dich anmelden.",
					$translate.instant("TITLE_SIGNUP"));
		}
	};

	$scope.registerFailure = function(response) {
		ErrorSrvc.populateScope($scope, response);
	};
	
	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
