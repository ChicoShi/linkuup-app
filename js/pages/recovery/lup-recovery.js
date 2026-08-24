angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/recovery', {
		templateUrl: 'js/pages/recovery/lup-recovery.html?v='+window.LUP_BUILD,
		controller: 'RecoveryCtrl',
		params: {
			authCheck: false,
		},
	});
}).controller('RecoveryCtrl', function($scope, $location, WebsocketSrvc, ConfigSrvc, ErrorSrvc) {
	
	$scope.data.title = 'TITLE_RECOVERY';
	
	$scope.data.identifier = '';
	$scope.data.captcha = '';

	$scope.data.error = null;
	$scope.data.errors = {};

	$scope.ConfigSrvc = ConfigSrvc;
	
	$scope.init = function() {
		console.log('RecoveryCtrl.init()');
	};
	
	$scope.captchaUrl = function() {
		return window.LUP_CONFIG.server + '/index.php?_mo=Captcha&_me=Image&_ajax=1';
	};
	
	$scope.recover = function() {
		console.log('RecoveryCtrl.recover()');
		var gwsMessage = new GWS_Message().cmd(0x0106).sync();
		var identifier = String($scope.data.identifier || '').trim();
		var isEmail = identifier.indexOf('@') !== -1;
		if (ConfigSrvc.recoveryLogin()) {
			gwsMessage.writeString(isEmail && ConfigSrvc.recoveryEmail() ? '' : identifier);
		}
		if (ConfigSrvc.recoveryEmail()) {
			gwsMessage.writeString(isEmail || !ConfigSrvc.recoveryLogin() ? identifier : '');
		}
		if (ConfigSrvc.recoveryCaptcha()) {
			gwsMessage.writeString($scope.data.captcha);
		}
		return WebsocketSrvc.sendBinary(gwsMessage).then(
				$scope.recoverySuccess,
				$scope.recoveryFailure)['catch']($scope.catchUnknown);
	};

	$scope.recoverySuccess = function(data) {
		console.log('RecoveryCtrl.recoverySuccess()', data);
		ErrorSrvc.showMessage("Wir haben eine E-Mail mit weiteren Anweisungen versendet.", 'Recovery');
	};

	$scope.recoveryFailure = function(response) {
		console.log('RecoveryCtrl.recoveryFailure()', response);
		ErrorSrvc.populateScope($scope, response)
	};
	
});
