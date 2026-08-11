"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/profilesettings', {
		templateUrl: 'js/pages/profile/lup-profile-settings.html?v='+window.LUP_BUILD,
		controller: 'ProfileSettingsCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('ProfileSettingsCtrl', function($scope,
		ProfileSrvc, HelpSrvc, SettingsSrvc, ErrorSrvc, EnumSrvc, WebsocketSrvc, CountrySrvc) {
	
	$scope.data.title = 'TITLE_PROFILE_SETTINGS';
	
	$scope.EnumSrvc = EnumSrvc;
	
	$scope.data.profile = new GDO_Profile();
	$scope.initial = {};
	
	$scope.CountrySrvc = CountrySrvc;
	
	$scope.init = function() {
		console.log('ProfileSettingsCtrl.init()');
		if ($scope.data.authenticated) {
			HelpSrvc.showHelp('profile_settings', window.t('HELP_PROFILE_SETTINGS'));
			ProfileSrvc.withProfile(GWF_USER).then($scope.loadedProfile);
			CountrySrvc.withCountries().then(function(countries){
				$scope.data.countries = countries;
			});
		}
	};
	
	$scope.loadedProfile = function(profile) {
		console.log('ProfileSettingsCtrl.loadedProfile()', profile);
		$scope.data.profile = profile;
		$scope.initial = JSON.parse(JSON.stringify(profile.JSON));
		$scope.data.status = GWF_USER.status();
	};
	
	$scope.changeSetting = function(key) {
		console.log('ProfileSettingsCtrl.changeSetting()', key, $scope.data.profile.JSON[key]);
		if ($scope.data.profile.JSON[key] != $scope.initial[key]) {
			SettingsSrvc.changeSetting(key, $scope.data.profile.JSON[key]).then(function(){
				$scope.initial[key] = $scope.data.profile.JSON[key];
			}, function(gwsMessage){
				$scope.data.profile.JSON[key] = $scope.initial[key];
				ErrorSrvc.showError(gwsMessage, 'Settings');
			});
		}
	};
	
	$scope.changeStatus = function() {
		console.log('ProfileSettingsCtrl.changeStatus()', $scope.data.status);
		if ($scope.data.status !== GWF_USER.status()) {
			var gwsMessage = new GWS_Message().cmd(0x1110).sync().writeString($scope.data.status);
			return WebsocketSrvc.sendBinary(gwsMessage).then(
					$scope.savedStatus, WebsocketSrvc.onError);
		}
	};
	
	$scope.savedStatus = function(gwsMessage) {
		console.log('ProfileSettingsCtrl.savedStatus()', gwsMessage);
	};
	
	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
