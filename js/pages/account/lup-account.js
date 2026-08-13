"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/account', {
		templateUrl: 'js/pages/account/lup-account.html?v='+window.LUP_BUILD,
		controller: 'AccountCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('AccountCtrl', function($scope, $translate,
		UserSrvc, CountrySrvc, ConfigSrvc, EnumSrvc, 
		TypeSrvc, ErrorSrvc, WebsocketSrvc, HelpSrvc,
		TimezoneSrvc) {

	$scope.data.title = "TITLE_ACCOUNT";
	
	$scope.ConfigSrvc = ConfigSrvc;
	
	$scope.data.countries = CountrySrvc.CACHE||[];
	$scope.data.timezones = TimezoneSrvc.CACHE||[];
	
	//////////////////
	// --- Init --- //
	//////////////////
	$scope.init = function() {
		console.log('AccountCtrl.init()');
		if ($scope.data.authenticated) {
			$scope.data.user = window.GWF_USER;
			$scope.resetForm();
			HelpSrvc.showHelp('account', $translate.instant('HELP_ACCOUNT'));
			CountrySrvc.withCountries().then(function(countries){
				$scope.data.countries = countries;
			});
			TimezoneSrvc.withTimezones().then(function(timezones){
				$scope.data.timezones = timezones;
			});
		}
	};
	$scope.resetForm = function() {
		console.log('AccountCtrl.resetForm()', $scope.data.user);
		$scope.data.account = JSON.parse(JSON.stringify($scope.data.user.JSON));
		$scope.data.user_birthdate = TypeSrvc.intToDate($scope.data.account.user_birthdate);
	};
	
	/////////////////////
	// --- Country --- //
	/////////////////////´
	$scope.countryStyle = function(country) {
		return CountrySrvc.flagStyle(country.id);
	};
	$scope.countryStyleZZ = function() {
		return CountrySrvc.flagStyle('zz');
	};
	
	//////////////////////
	// --- Timezone --- //
	//////////////////////
	$scope.displayTimezone = function(timezone) {
		let off = timezone.tz_offset;
		return sprintf('%s %s%02d%02d',
			timezone.tz_name,
			off >= 0 ? '+' : '-',
			off / 60, off % 60);
	};
	
	//////////////////
	// --- Save --- //
	//////////////////
	$scope.save = function() {
		console.log('AccountCtrl.save()');
		var oldData = $scope.data.user.JSON;
		var newData = $scope.data.account;
		newData.user_birthdate = TypeSrvc.dateToInt($scope.data.user_birthdate);
		if (JSON.stringify(oldData) != JSON.stringify(newData)) {
			$scope.saveAccount(newData, oldData);
		}
	};
	
	$scope.saveAccount = function(newData, oldData) {
		console.log('AccountCtrl.saveAccount()', newData, oldData);
		var user = $scope.data.user;
		var gwsMessage = new GWS_Message().cmd(0x0121).sync();
		// Name
		if (!$scope.isGuest()) {
			gwsMessage.writeString(newData.user_name);
			gwsMessage.writeString(newData.user_real_name);
		}
		else {
			gwsMessage.writeString(newData.user_guest_name);
		}
		// Email
		gwsMessage.writeString(newData.user_email);
//		gwsMessage.write16(EnumSrvc.emailFormatToInt(newData.user_email_fmt));
//		gwsMessage.write8(0); // Allow people to mail you
		gwsMessage.writeString(newData.user_timezone?newData.user_timezone:'');
		gwsMessage.writeString(newData.user_language?newData.user_language:'');
		gwsMessage.writeString(newData.user_country?newData.user_country:'');
		gwsMessage.write16(EnumSrvc.genderToInt(newData.user_gender));
//		gwsMessage.write32(newData.user_birthdate);
		
		return WebsocketSrvc.sendBinary(gwsMessage).
			then($scope.savedAccount, function(response) {
				console.log(response);
				ErrorSrvc.populateScope($scope, response);
				$scope.resetForm();
			});
	};
	
	$scope.savedAccount = function(gwsMessage) {
		console.log('AccountCtrl.savedAccount()', gwsMessage);
		if (gwsMessage.hasMore()) {
			var message = '';
			while (gwsMessage.hasMore()) {
				message += gwsMessage.readString();
			}
			ErrorSrvc.showMessage(message, $translate.instant('MSGT_ACCOUNT'));
		}
		UserSrvc.refresh().then($scope.resetForm);
	};

	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
