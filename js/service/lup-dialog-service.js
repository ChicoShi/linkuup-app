"use strict";
angular.module('LUP').
service('DialogSrvc', function($q, $mdDialog, $mdSidenav, RequestSrvc) {
	
	var DialogSrvc = this;
	DialogSrvc.versionedTemplate = function(templateUrl) {
		return templateUrl.indexOf('?') === -1 ? templateUrl + '?v=' + window.LUP_BUILD : templateUrl;
	};
	
	//////////////////
	// --- Base --- //
	//////////////////
	DialogSrvc.lastDialog = [];
	DialogSrvc.show = function(config) {
		console.log('DialogSrvc.show()', config, DialogSrvc.lastDialog);
		var dlgs = DialogSrvc.lastDialog;
		var q = $q.defer();
		var last = dlgs.length ? dlgs[dlgs.length-1] : null;
		var next = { config: config, q: q };
		dlgs.push(next)
		if (last) {
			last.q.promise['finally'](function() {
				var next = dlgs[0];
				$mdDialog.show(next.config).then(function(){
					dlgs[0].q.resolve();
					dlgs.shift();
				}, function(){
					dlgs[0].q.reject();
					dlgs.shift();
				});
			});
		}
		else
		{
			$mdDialog.show(config).then(function(){
				dlgs[0].q.resolve();
				dlgs.shift();
			},
			function(){
				dlgs[0].q.reject();
				dlgs.shift();
			});
		}
		
		return q.promise;
	};
	
	/////////////////
	// --- API --- //
	/////////////////
	DialogSrvc.openAjaxDialog = function(module, method, title) {
		console.log('DialogSrvc.openAjaxDialog()', module, method);
		var ErrorSrvc = window.angular.element(window.document.body).injector().get('ErrorSrvc')
		$mdSidenav('left').close();
//		$mdSidenav('right').close();
		return RequestSrvc.gwfPage(module, method).then(
				DialogSrvc.loadedPage.bind(DialogSrvc, title), 
				ErrorSrvc.showGDOAjaxError);
	};

	DialogSrvc.loadedPage = function(title, response) {
		console.log('DialogSrvc.loadedPage()', title, response);
		var html = response.data; // wrap html into DialogController (ugly)
		function DialogController($scope, $mdDialog) {
			$scope.data = {
				html: html,
				title: title,
			};
			$scope.cancel = function() {
				$mdDialog.cancel();
			};
		}
		var config = {
			controller: ['$scope', '$mdDialog', DialogController],
			templateUrl: DialogSrvc.versionedTemplate('js/dialogs/lup-ajax-dialog.html'),
			parent: angular.element(document.body),
			targetEvent: window.event,
			clickOutsideToClose:true,
		};
		return DialogSrvc.show(config);
	};

	/////////////////////
	// --- Dialogs --- //
	/////////////////////
	DialogSrvc.openImpressum = function() {
		console.log('DialogSrvc.openImpressum()');
		return DialogSrvc.openAjaxDialog('Core', 'Impressum', 'IMPRESSUM');
	};

	DialogSrvc.openTermsOfService = function() {
		console.log('DialogSrvc.openTermsOfService()');
		return DialogSrvc.openAjaxDialog('Register', 'TOS', 'TOS');
	};

	DialogSrvc.openPrivacyInformation = function() {
		console.log('DialogSrvc.openPrivacyInformation()');
		return DialogSrvc.openAjaxDialog('Core', 'Privacy', 'PRIVACY');
	};

	DialogSrvc.openHTMLDialog = function(body, title) {
		console.log('DialogSrvc.openHTMLDialog()');
		let data = { body: body, title: title };
		return DialogSrvc.confirm("js/service/tpl/lup-html-dialog.html", data);
	}

	/////////////////////
	// --- Confirm --- //
	/////////////////////
	DialogSrvc.confirm = function(templateUrl, data) {
		console.log('DialogSrvc.confirm()');
		
		var defer = $q.defer();
		
		function DialogController($scope, $mdDialog) {
			$scope.data = data;
			$scope.ok = function() {
				defer.resolve();
				$mdDialog.cancel();
			};
			$scope.cancel = function() {
				defer.reject();
				$mdDialog.cancel();
			};
		}
		
		DialogSrvc.show({
			controller: ['$scope', '$mdDialog', DialogController],
			templateUrl: DialogSrvc.versionedTemplate(templateUrl),
			parent: angular.element(document.body),
			targetEvent: window.event,
			clickOutsideToClose: false,
		})['catch'](angular.noop);

		return defer.promise;
	};
	
	return DialogSrvc;
});
