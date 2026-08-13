"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/settings', {
		templateUrl: 'js/pages/settings/lup-settings.html?v='+window.LUP_BUILD,
		controller: 'SettingsCtrl',
		params: {
			authCheck: true,
		},
	});
;
}).controller('SettingsCtrl', function($scope, $q, $translate, SettingsSrvc, CountrySrvc, TimezoneSrvc, GDTRendererSrvc, ErrorSrvc) {

	$scope.data.title = 'TITLE_SETTINGS';
	$scope.data.groups = [];
	const ACLS = ['acl_all', 'acl_guests', 'acl_members', 'acl_friend_friends', 'acl_friends', 'acl_noone'];
	const HIDDEN_SETTINGS = {
		Date: {activity_accuracy: true},
		Friends: {friends_level: true},
		// The location-bound profile visibility policy is not implemented yet.
		// Keep the stored setting out of the generic renderer until it is.
		LinkUUp: {lup_profile_outside_visible: true},
	};

	$scope.moduleLabel = function(module) {
		return 'module_' + module.toLowerCase();
	};

	$scope.enumLabel = function(value) {
		return value;
	};

	$scope.data.countries = CountrySrvc.CACHE || [];
	$scope.data.timezones = TimezoneSrvc.options();

	$scope.controlIs = function(setting, control) {
		return setting.renderer.control === control;
	};

	$scope.isCountry = function(setting) {
		return $scope.controlIs(setting, 'select') && setting.renderer.source === 'countries';
	};

	$scope.isTimezone = function(setting) {
		return $scope.controlIs(setting, 'select') && setting.renderer.source === 'timezones';
	};

	$scope.displayTimezone = function(timezone) {
		return TimezoneSrvc.renderTimezone(timezone.tz_id);
	};

	$scope.inputType = function(setting) {
		return setting.renderer && setting.renderer.input_type || 'text';
	};

	$scope.countryStyle = function(country) {
		return CountrySrvc.flagStyle(country.id);
	};

	$scope.aclChoices = function(setting) {
		return setting.acl === null ? [] : ACLS;
	};

	$scope.aclAllowed = function(setting, relation) {
		var profile = SettingsSrvc.setting('profile_visibility');
		var profileRelation = profile && profile.options && (profile.options.var || profile.options.selected);
		var profileRank = ACLS.indexOf(profileRelation);
		var relationRank = ACLS.indexOf(relation);
		return profileRank < 0 || relationRank < 0 || relationRank >= profileRank || setting.acl === relation;
	};
	
	$scope.init = function() {
		// This controller is recreated on every route visit.  Keep its loaded
		// state local: the shared data object survives a visit to the legacy
		// profile-settings route, while this view still needs to rebuild itself.
		if ($scope.data.authenticated && !$scope.settingsInitialized) {
			console.log('SettingsCtrl.init()');
			$scope.data.user = window.GWF_USER;
			$scope.settingsInitialized = true;
			SettingsSrvc.withConfig().then(function(cache) {
				var groups = {};
				$scope.data.profileVisibility = cache.User && cache.User.profile_visibility;
				if ($scope.data.profileVisibility) {
					var profile = $scope.data.profileVisibility;
					profile.module = 'User';
					profile.name = 'profile_visibility';
					profile.options = profile.options || {};
					profile.renderer = GDTRendererSrvc.forSetting(profile);
					var profileValue = profile.options.var !== undefined && profile.options.var !== null ? profile.options.var : profile.options.selected;
					profile.value = GDTRendererSrvc.valueForSetting(profile, profileValue);
					profile.initialValue = profile.value;
					profile.initialACL = profile.acl;
				}
				for (var module in cache) {
					if (module === 'user') { continue; }
					for (var key in cache[module]) {
						var setting = cache[module][key];
						if (module === 'User' && key === 'profile_visibility') { continue; }
						if (!setting.writeable || (HIDDEN_SETTINGS[module] && HIDDEN_SETTINGS[module][key])) { continue; }
						setting.module = setting.module || module;
						setting.name = setting.name || key;
						setting.options = setting.options || {};
						setting.renderer = GDTRendererSrvc.forSetting(setting);
						var selected = setting.options.var !== undefined && setting.options.var !== null ? setting.options.var : setting.options.selected;
						setting.value = selected && typeof selected === 'object' && selected.id !== undefined ? selected.id : selected;
						setting.value = GDTRendererSrvc.valueForSetting(setting, setting.value);
						if (setting.renderer.source === 'enum' && !setting.options.notNull && (setting.value === null || setting.value === '')) {
							setting.value = '0';
						}
						setting.initialValue = setting.value;
						setting.initialACL = setting.acl;
						groups[module] = groups[module] || {
							module: module,
							sort: setting.module_sort > 0 ? setting.module_sort : 1000,
							settings: [],
						};
						groups[module].settings.push(setting);
					}
				}
				$scope.data.groups = Object.keys(groups).map(function(module) { return groups[module]; });
				$scope.data.groups.sort(function(a, b) {
					return a.sort - b.sort || a.module.localeCompare(b.module);
				});
				$scope.data.groups.forEach(function(group) {
					group.settings.sort(function(a, b) { return a.name.localeCompare(b.name); });
				});
				return $q.all([CountrySrvc.withCountries(), TimezoneSrvc.withTimezones()]);
			}).then(function(results) {
				$scope.data.countries = results[0];
				$scope.data.timezones = TimezoneSrvc.options();
			})['catch'](function(error) {
				$scope.settingsInitialized = false;
				ErrorSrvc.showError(error, 'Settings');
			});
		}
	};
	
	$scope.changeSetting = function(setting) {
		console.log('SettingsCtrl.changeSetting()', setting.module, setting.name, setting.value, setting.acl);
		SettingsSrvc.changeSetting(setting, setting.value, setting.acl)['catch'](function(gwsMessage){
			setting.value = setting.initialValue;
			setting.acl = setting.initialACL;
			ErrorSrvc.showError(gwsMessage, 'Settings');
		}).then(function() {
			setting.initialValue = setting.value;
			setting.initialACL = setting.acl;
		});
	};
	
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
