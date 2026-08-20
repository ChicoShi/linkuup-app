'use strict';
angular.module('LUP')
.service('ErrorSrvc', function($q, $mdDialog, ExceptionSrvc, LoadingSrvc, DialogSrvc) {
	
	var ErrorSrvc = this;
	ErrorSrvc.isProximityError = function(text) {
		return /err_user_not_near|nicht\s+in\s+(?:ihrer|deiner)\s+n[aä]he|not\s+near/i.test(String(text || ''));
	};
	ErrorSrvc.showProximityError = function() {
		return DialogSrvc.confirm('js/dialogs/lup-proximity-dialog.html', {}).catch(function() {});
	};

	// --- Dialogs --- //
	ErrorSrvc.showMessage = function(text, title) {
		return DialogSrvc.show($mdDialog.alert()
			.clickOutsideToClose(true)
			.title(title)
			.htmlContent('<div class="lup-message">'+text+'</div>')
			.ariaLabel(title)
			.ok("OK")
		);
	};
	
	ErrorSrvc.showError = function(text, title) {
		console.log(title, text);
		if (ErrorSrvc.isProximityError(text)) {
			return ErrorSrvc.showProximityError();
		}
		if (title === 'Protocol error' && (text === undefined || text === null || text === 'undefined' || text === 'ERR: undefined')) {
			console.warn('Ignoring empty legacy protocol error.');
			return $q.resolve();
		}
		return DialogSrvc.show(
					$mdDialog.alert()
					.clickOutsideToClose(false)
					.title(title)
					.htmlContent('<div class="lup-error">'+text+'</div>')
					.ariaLabel(title)
					.ok(window.t('BTN_AWW'))
					);
	};
	
	// --- Titles --- //
	ErrorSrvc.show404Error = function(error) {
		return ErrorSrvc.showError(error, 'Server Error');
	};
	ErrorSrvc.showNetworkError = function(error) {
		return ErrorSrvc.showError(error, 'Netz doof');
	};
	ErrorSrvc.showServerError = function(error) {
		return ErrorSrvc.showError(error, 'Server Error');
	};
	ErrorSrvc.showUserError = function(error) {
		return ErrorSrvc.showError(error, "User error");
	};
	
	// --- Exceptions --- //

	/**
	 * Populates $scope.data with field errors from Websocket error.
	 */
	ErrorSrvc.populateScope = function($scope, response) {
		let text = "Fehler!";
		let title = t('form_error_title');
		try {
			var data = JSON.parse(response);
		} catch (e) {
			text = response;
		}
		try {
			if (data['global']) {
				text = data['global'];
			}
			let form = data.form;
			text += $scope.data.error = form.form_error;
			for (let field in form.errors) {
				let error = form.errors[field];
				if (error) {
					$scope.data.errors[field] = error; 
				}
			}
			title = form.form_title;
		} catch (e) {
		}
		if (data.form.top) {
			text += data.form.top;
		}
		return ErrorSrvc.showError(text, title);
	};
	
	// --- GDO Ajax errors --- //
	ErrorSrvc.showGDOAjaxError = function(response, title) {
		console.log("ErrorSrvc.showGDOAjaxError()", response);
		return ErrorSrvc.websocketJSONError(response, title);
	};

	// --- Websocket error default --- //
	ErrorSrvc.websocketError = function(gwsMessage) {
		console.log('ErrorSrvc.websocketError()', gwsMessage);
		// Older optional websocket calls sometimes reject without a payload. Do not
		// turn that empty value into a modal literally saying "undefined".
		if (gwsMessage === undefined || gwsMessage === null || gwsMessage === 'undefined') {
			return $q.resolve();
		}
		return ErrorSrvc.showError(gwsMessage, "Fehler");
	};
	
	ErrorSrvc.websocketFormError = function(json) {
		console.log('ErrorSrvc.websocketFormError()', json);
		return ErrorSrvc.showError(json, "Fehler");
	};
	
	ErrorSrvc.showErrorsForWSFields = function(fields, response, title) {
		console.log('ErrorSrvc.showErrorsForWSFields()', fields, response);
		var errors = [];
		try {
			response = JSON.parse(response);
			ErrorSrvc.showErrorsForWSFieldsRec(fields, response.data.data, errors);
			return ErrorSrvc.showError(errors.join("\n"), title||"Fehler");
		} catch (ex) {
			return ErrorSrvc.showError(response, title||"Fehler");
		}
	};
	
	ErrorSrvc.showErrorsForWSFieldsRec = function(fields, response, errors) {
		for (var key in response) {
			// Key found!
			if ( (fields === null) || (fields.indexOf(key)>=0) ) {
				if ( (response[key]) && (response[key].error) ) {
					errors.push(response[key].error);
				}
			}
			// More recursion
			else if ( (Array.isArray(response[key])) ||
				 ((typeof response[key] === 'object') && (response[key] !== null)) ) {
				ErrorSrvc.showErrorsForWSFieldsRec(fields, response[key], errors);
			}
		}
	};
	
	ErrorSrvc.websocketJSONError = function(response, title) {
		console.log("ErrorSrvc.websocketJSONError()", response);
		title = title || t('LUP');
		if (response === undefined) {
			return ErrorSrvc.showError(t('err_no_connection'), title);
		}
		response = JSON.parse(response);
		return ErrorSrvc.showError(response.json.error, title);
	};
	
	ErrorSrvc.websocketFormError = function(response, title) {
		console.log("ErrorSrvc.websocketFormError()", response, title);
		ErrorSrvc.showErrorsForWSFields(null, response, title);
	};
	
	ErrorSrvc.websocketMaybeJSONError = function(response, title) {
		console.log("ErrorSrvc.websocketMaybeJSONError()", response);
		if (response[0]=='{') {
			return ErrorSrvc.websocketJSONError(response, title);
		} else {
			return ErrorSrvc.websocketError(response, title);
		}
	};

	ErrorSrvc.ajaxError = function(response) {
		console.log('ErrorSrvc.ajaxError()', response);
		return ErrorSrvc.showError(response, response);
	};
	
	return ErrorSrvc;
});
