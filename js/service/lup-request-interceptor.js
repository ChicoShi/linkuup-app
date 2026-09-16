'use strict';
angular.module('LUP').
factory('RequestInterceptor', function($q, $injector) {
	var ErrorSrvc;
	var errorText = function(rejection) {
		var data = rejection && rejection.data;
		var message = data && (data.error || (data.topResponse && data.topResponse.error));
		return typeof message === 'string' ? message : null;
	};
	return {
		'request': function(config) {
			  return config;
		},
		'requestError': function(rejection) {
	        if (!ErrorSrvc) { ErrorSrvc = $injector.get('ErrorSrvc'); }
	        console.log(rejection);
			ErrorSrvc.showNetworkError(errorText(rejection) || t('err_no_connection'));
			return $q.reject(rejection);
		},
		'response': function(response) {
			return response;
		},
		'responseError': function(rejection) {
	        if (!ErrorSrvc) { ErrorSrvc = $injector.get('ErrorSrvc'); }
	        console.log(rejection);
			// Cancelled requests and non-JSON responses must preserve the original
			// rejection, not throw a second TypeError while reading its payload.
			if (rejection && rejection.xhrStatus === 'abort') return $q.reject(rejection);
			let code = rejection && rejection.status;
			let msg = errorText(rejection);
			if (!msg && (code == 404)) {
				ErrorSrvc.show404Error('HTTP 404');
			}
			else if (msg) {
				ErrorSrvc.showServerError(msg);
			}
			else if (code > 0) {
				ErrorSrvc.showServerError('HTTP ' + code);
			}
			else {
				ErrorSrvc.showNetworkError(t('err_no_connection'));
			}
			return $q.reject(rejection);
		}
	};
}).
config(function($httpProvider) {  
	$httpProvider.interceptors.push('RequestInterceptor');
});
