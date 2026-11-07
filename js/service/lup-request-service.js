'use strict';
angular.module('LUP').
service('RequestSrvc', function($http, LoadingSrvc) {
	
	var RequestSrvc = this;

	//////////////////
	// Send request //
	//////////////////
	/**
	 * Request a gdo page as ajax html. (impressum, tos, privacy, etc.)
	 */
	RequestSrvc.gwfPage = function(module, method, data) {
		var cors = encodeURIComponent(LUP_CONFIG.cors);
		var url = sprintf('%sindex.php?_mo=%s&_me=%s&_ajax=1&_cors=%s',
				LUP_CONFIG.server, module, method, cors);
		return RequestSrvc.send(url, data, 'GET');
	};
	
	/**
	 * Send a GET or POST request to a gdo method.
	 */
	RequestSrvc.sendGWF = function(module, method, data, httpMethod) {
		var cors = encodeURIComponent(window.LUP_CONFIG.cors);
		var url = sprintf('%sindex.php?_mo=%s&_me=%s&_ajax=1&_cors=%s&_fmt=json',
				window.LUP_CONFIG.server, module, method, cors);
		return RequestSrvc.send(url, data, httpMethod);
	};

	RequestSrvc.get = function(url, data) {
		return RequestSrvc.send(url, data, 'GET');
	};

	RequestSrvc.send = function(url, data, method, noCredentials) {
		// Request bodies may contain credentials; never log them.
		method = method || (data ? 'POST' : 'GET');
		let headers = {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		};
		if (LUP_CONFIG.basic_auth) {
			headers['Authorization'] = LUP_CONFIG.basic_auth;
		}
		LoadingSrvc.addTask('http');
		return $http({
			method: method,
			url: url,
			data: data,
			withCredentials: true,
			headers: headers,
			transformRequest: RequestSrvc.transformPostData
		})['finally'](function() {
			LoadingSrvc.removeTask('http');
		});
	};
	
	RequestSrvc.transformPostData = function(obj) {
		return JSON.stringify(obj);
	};
	
});
