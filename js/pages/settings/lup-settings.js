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
}).controller('SettingsCtrl', function($scope, $translate, SettingsSrvc, ErrorSrvc) {

	$scope.data.title = 'TITLE_SETTINGS';
	$scope.data.groups = [];
	const ACLS = ['acl_all', 'acl_guests', 'acl_members', 'acl_friend_friends', 'acl_friends', 'acl_noone'];

	$scope.moduleLabel = function(module) {
		return 'module_' + (module === 'User' ? 'user' : module);
	};

	$scope.enumLabel = function(value) {
		return 'enum_' + value;
	};

	$scope.isTextarea = function(setting) {
		return /GDT_(Message|Text)$/.test(setting.type || '');
	};

	$scope.isCheckbox = function(setting) {
		return /GDT_Checkbox$/.test(setting.type || '');
	};

	$scope.isChoice = function(setting) {
		return !!(setting.options && setting.options.enumValues);
	};

	$scope.inputType = function(setting) {
		return /GDT_(Int|UInt|Float|Decimal)$/.test(setting.type || '') ? 'number' : 'text';
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
		if ($scope.data.authenticated && !$scope.data.settingsLoaded) {
			console.log('SettingsCtrl.init()');
			$scope.data.user = window.GWF_USER;
			$scope.data.settingsLoaded = true;
			SettingsSrvc.withConfig().then(function(cache) {
				var groups = {};
				for (var module in cache) {
					if (module === 'user') { continue; }
					for (var key in cache[module]) {
						var setting = cache[module][key];
						if (!setting.writeable) { continue; }
						setting.module = setting.module || module;
						setting.name = setting.name || key;
						setting.options = setting.options || {};
						setting.value = setting.options.var !== undefined ? setting.options.var : setting.options.selected;
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
			})['catch'](function(error) {
				$scope.data.settingsLoaded = false;
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
