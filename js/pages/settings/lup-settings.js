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
		// These values are internal moderation/progression data, not choices a
		// LinkUUp member can make. Showing a naked number made the profile page
		// both confusing and misleading.
		Friends: {friends_level: true},
		// The location-bound profile visibility policy is not implemented yet.
		// Keep the stored setting out of the generic renderer until it is.
		LinkUUp: {lup_profile_outside_visible: true, lup_cuddles: true},
	};
	// Newer backend responses no longer add a `writeable: true` flag to every
	// regular setting. Only keeping explicit false values hidden is important:
	// otherwise the old `!setting.writeable` condition hides the entire table.
	// These are genuine system counters/timestamps and are not member choices.
	const READ_ONLY_SETTINGS = {
		User: {last_activity: true, profile_views: true, level_spent: true},
		Votes: {likes: true},
		Friends: {friends_level: true},
		Register: {register_date: true},
	};
	const SETTING_SECTIONS = {
		User: 'identity',
		AboutMe: 'identity',
		LinkUUp: 'identity',
		Language: 'local',
		Date: 'local',
		Country: 'local',
		Birthday: 'privacy',
		Friends: 'privacy',
		Gallery: 'privacy',
		Contact: 'contact',
	};
	const SECTION_ORDER = {identity: 10, local: 20, privacy: 30, contact: 40};
	/* The settings endpoint is intentionally generic and a few older modules
	 * return no display label at all.  A blank title turns a real setting into a
	 * confusing anonymous control.  Keep the user-facing profile vocabulary in
	 * one place and fall back to a readable name for future backend settings. */
	const SETTING_LABELS = {
		language: 'language',
		gender: 'SETTING_LABEL_GENDER',
		color: 'SETTING_LABEL_PROFILE_COLOUR',
		timezone: 'SETTING_LABEL_TIMEZONE',
		country_of_living: 'country_of_living',
		country_of_origin: 'country_of_origin',
		friend_who: 'friend_who',
		friends_show: 'friends_show',
		birthday: 'SETTING_LABEL_BIRTHDAY',
		age_visible: 'age_visible',
		announce_my_birthday: 'announce_my_birthday',
		announce_me_birthdays: 'announce_me_birthdays',
		whatsapp_number: 'whatsapp_number',
		gallery_acl: 'SETTING_LABEL_GALLERY_VISIBILITY',
		about_me: 'SETTING_LABEL_ABOUT_ME',
		lup_status: 'SETTING_LABEL_STATUS',
		lup_state: 'SETTING_LABEL_STATE',
		lup_city: 'SETTING_LABEL_CITY',
		lup_eyecolor: 'SETTING_LABEL_EYE_COLOR',
		lup_height: 'SETTING_LABEL_HEIGHT',
		lup_interest: 'SETTING_LABEL_INTEREST',
		lup_sexo: 'SETTING_LABEL_ORIENTATION',
		lup_has_pet: 'SETTING_LABEL_PET',
		lup_drinks: 'SETTING_LABEL_DRINKS',
		lup_smokes: 'SETTING_LABEL_SMOKES',
		lup_sporty: 'SETTING_LABEL_SPORT',
		lup_religion: 'SETTING_LABEL_RELIGION'
	};

	$scope.settingDisplayLabel = function(setting) {
		if (!setting) { return ''; }
		if (SETTING_LABELS[setting.name]) { return SETTING_LABELS[setting.name]; }
		if (setting.label && setting.label !== setting.name) { return setting.label; }
		return String(setting.name || '').replace(/^lup_/, '').replace(/_/g, ' ').replace(/\b\w/g, function(letter) {
			return letter.toUpperCase();
		});
	};

	$scope.moduleLabel = function(module) {
		return 'module_' + module.toLowerCase();
	};

	$scope.sectionTitle = function(section) {
		return 'SETTINGS_SECTION_' + section.toUpperCase();
	};

	$scope.sectionHint = function(section) {
		return 'SETTINGS_SECTION_' + section.toUpperCase() + '_HINT';
	};

	$scope.settingIcon = function(setting) {
		var icons = {
			about_me: 'edit_note', gender: 'person_outline', color: 'palette',
			lup_status: 'chat_bubble_outline', lup_city: 'location_city', lup_state: 'map',
			lup_eyecolor: 'visibility', lup_height: 'height', lup_interest: 'auto_awesome',
			lup_sexo: 'favorite_outline', lup_has_pet: 'pets', lup_drinks: 'local_bar',
			lup_smokes: 'smoke_free', lup_sporty: 'directions_run', lup_religion: 'self_improvement',
			language: 'translate', timezone: 'schedule', country_of_living: 'home',
			country_of_origin: 'public', birthday: 'cake', age_visible: 'visibility',
			announce_my_birthday: 'celebration', announce_me_birthdays: 'campaign',
			friend_who: 'person_add', friends_show: 'group', gallery_acl: 'photo_library',
			whatsapp_number: 'chat'
		};
		return icons[setting && setting.name] || 'tune';
	};

	$scope.isDateSetting = function(setting) {
		return $scope.inputType(setting) === 'date';
	};

	$scope.enumLabel = function(value) {
		return value;
	};

	$scope.data.countries = CountrySrvc.CACHE || [];
	$scope.data.timezones = TimezoneSrvc.options();
	// LinkUUp deliberately ships these five UI languages. Language ISO codes do
	// not always map to a country, hence the explicit flag mapping for English.
	$scope.data.languages = [
		{id: 'en', text: 'English', flag: 'gb'},
		{id: 'de', text: 'Deutsch', flag: 'de'},
		{id: 'it', text: 'Italiano', flag: 'it'},
		{id: 'fr', text: 'Français', flag: 'fr'},
		{id: 'es', text: 'Español', flag: 'es'},
	];

	$scope.controlIs = function(setting, control) {
		return setting.renderer.control === control;
	};

	$scope.isCountry = function(setting) {
		return $scope.controlIs(setting, 'select') && setting.renderer.source === 'countries';
	};

	$scope.isTimezone = function(setting) {
		return $scope.controlIs(setting, 'select') && setting.renderer.source === 'timezones';
	};

	$scope.isLanguage = function(setting) {
		return $scope.controlIs(setting, 'select') && setting.renderer.source === 'languages';
	};

	$scope.displayTimezone = function(timezone) {
		return TimezoneSrvc.renderTimezone(timezone.tz_id);
	};

	$scope.inputType = function(setting) {
		return setting.renderer && setting.renderer.input_type || 'text';
	};

	// Keep emojis intentional: they enrich the personal text fields without
	// turning every practical account setting into a decorative control.
	$scope.hasEmojiPicker = function(setting) {
		return !!setting && ['about_me', 'lup_status'].indexOf(setting.name) >= 0;
	};

	$scope.emojiChoices = function(setting) {
		return setting && setting.name === 'lup_status'
			? ['✨', '📍', '☕', '🎵', '🌙', '💬']
			: ['✨', '😊', '📍', '🎵', '☕', '🌙', '💬', '🌿'];
	};

	$scope.appendEmoji = function(setting, emoji, event) {
		if (event) { event.preventDefault(); event.stopPropagation(); }
		if (!setting || !emoji) { return; }
		var value = String(setting.value || '');
		setting.value = value + (value && !/\s$/.test(value) ? ' ' : '') + emoji;
		// A blur-save may already be in flight when a mobile tap reaches this
		// handler. changeSetting queues this exact new value instead of losing it.
		$scope.changeSetting(setting);
	};

	$scope.countryStyle = function(country) {
		return CountrySrvc.flagStyle(country.id);
	};

	$scope.languageStyle = function(language) {
		return CountrySrvc.flagStyle(language.flag);
	};

	$scope.aclChoices = function(setting) {
		// profile_visibility is itself an ACL enum. It has no *separate*
		// field-visibility relation, so its own enum values are the choices.
		if (setting.name === 'profile_visibility') {
			// acl_hidden is an internal backend marker, not a user-facing
			// visibility choice. acl_noone is the explicit "nobody" option.
			return (setting.options.enumValues || ACLS).filter(function(relation) {
				return relation !== 'acl_hidden';
			});
		}
		return setting.acl === null ? [] : ACLS;
	};

	$scope.aclAllowed = function(setting, relation) {
		var profile = SettingsSrvc.setting('profile_visibility');
		var profileRelation = profile && profile.options && (profile.options.var || profile.options.selected);
		var profileRank = ACLS.indexOf(profileRelation);
		var relationRank = ACLS.indexOf(relation);
		return profileRank < 0 || relationRank < 0 || relationRank >= profileRank || setting.acl === relation;
	};
	
	$scope.settingsLoading = false;
	$scope.canLoadSettings = function() {
		// A route change briefly resets data.authenticated while the root
		// controller checks the already logged-in session again. The settings
		// controller used to miss that short window and consequently rendered an
		// empty page when it was opened from "Über mich ergänzen".
		return !!($scope.data.authenticated ||
			(window.GWF_USER && window.GWF_USER.authenticated && window.GWF_USER.authenticated(true)));
	};
	$scope.init = function() {
		// Rebuild the setting groups whenever this route is opened. A previous
		// controller could leave an inherited "initialized" flag behind, which
		// made the settings view look empty after using “Über mich ergänzen”.
		if ($scope.canLoadSettings() && !$scope.settingsLoading) {
			console.log('SettingsCtrl.init()');
			$scope.data.user = window.GWF_USER;
			$scope.settingsLoading = true;
			$scope.data.groups = [];
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
						if (!setting || !setting.type || setting.writeable === false ||
							(HIDDEN_SETTINGS[module] && HIDDEN_SETTINGS[module][key]) ||
							(READ_ONLY_SETTINGS[module] && READ_ONLY_SETTINGS[module][key])) { continue; }
						setting.module = setting.module || module;
						setting.name = setting.name || key;
						setting.displayLabel = $scope.settingDisplayLabel(setting);
						setting.options = setting.options || {};
						setting.renderer = GDTRendererSrvc.forSetting(setting);
						var selected = setting.options.var !== undefined && setting.options.var !== null ? setting.options.var : setting.options.selected;
						setting.value = selected && typeof selected === 'object' && selected.id !== undefined ? selected.id : selected;
						setting.value = GDTRendererSrvc.valueForSetting(setting, setting.value);
						if (setting.renderer.source === 'enum' && !setting.options.notNull && (setting.value === null || setting.value === '')) {
							setting.value = '0';
						}
						if (setting.renderer.source === 'timezones' && (setting.value === null || setting.value === '')) {
							setting.value = '0';
						}
						setting.initialValue = setting.value;
						setting.initialACL = setting.acl;
						var section = SETTING_SECTIONS[module] || 'identity';
						groups[section] = groups[section] || {
							section: section,
							sort: SECTION_ORDER[section] || 1000,
							settings: [],
						};
						groups[section].settings.push(setting);
					}
				}
				$scope.data.groups = Object.keys(groups).map(function(section) { return groups[section]; });
				$scope.data.groups.sort(function(a, b) {
					return a.sort - b.sort || a.section.localeCompare(b.section);
				});
				$scope.data.groups.forEach(function(group) {
					group.settings.sort(function(a, b) {
						return a.module.localeCompare(b.module) || a.name.localeCompare(b.name);
					});
				});
				return $q.all([CountrySrvc.withCountries(), TimezoneSrvc.withTimezones()]);
			}).then(function(results) {
				$scope.data.countries = results[0];
				$scope.data.timezones = TimezoneSrvc.options();
			})['catch'](function(error) {
				ErrorSrvc.showError(error, 'Settings');
			})['finally'](function() {
				$scope.settingsLoading = false;
			});
		}
	};
	
	$scope.changeSetting = function(setting, visibilityOnly) {
		if (!setting) {
			return;
		}
		if (setting.saving) {
			// Never discard fast typing or an emoji tap while the preceding value
			// is on its way through the WebSocket. A value update outranks a pure
			// visibility update when both happen in one short interaction.
			if (!setting.pendingSave || !visibilityOnly) {
				setting.pendingSave = {visibilityOnly: !!visibilityOnly};
			}
			return;
		}
		// Leaving a text field to open its visibility menu also fires blur. That
		// used to submit an unchanged value first and show a false error after the
		// actual visibility update had already succeeded.
		var inputType = setting.renderer && setting.renderer.input_type;
		if (!visibilityOnly && inputType !== 'date' && inputType !== 'time' && inputType !== 'datetime-local' &&
			String(setting.value === undefined || setting.value === null ? '' : setting.value) === String(setting.initialValue === undefined || setting.initialValue === null ? '' : setting.initialValue) &&
			setting.acl === setting.initialACL) {
			return;
		}
		var savedValue = setting.value;
		var savedACL = setting.acl;
		console.log('SettingsCtrl.changeSetting()', setting.module, setting.name, savedValue, savedACL);
		setting.saving = true;
		SettingsSrvc.changeSetting(setting, savedValue, savedACL, visibilityOnly).then(function() {
			if (setting.value === savedValue) { setting.initialValue = savedValue; }
			if (setting.acl === savedACL) { setting.initialACL = savedACL; }
		}, function(gwsMessage) {
			// Do not overwrite text that was entered after this request started.
			if (setting.value === savedValue) { setting.value = setting.initialValue; }
			if (setting.acl === savedACL) { setting.acl = setting.initialACL; }
			ErrorSrvc.showError(gwsMessage, 'Settings');
		})['finally'](function() {
			setting.saving = false;
			if (setting.pendingSave) {
				var pending = setting.pendingSave;
				setting.pendingSave = null;
				$scope.changeSetting(setting, pending.visibilityOnly);
			}
		});
	};

	$scope.changeVisibility = function(setting) {
		// Keep visibility as a deliberate, field-bound action. It must never be
		// interpreted as the next row's value control on compact mobile layouts.
		if (setting.acl === setting.initialACL) {
			return;
		}
		$scope.changeSetting(setting, true);
	};

	$scope.visibilityLabel = function(setting) {
		return setting && (setting.acl || setting.initialACL) || 'acl_all';
	};

	$scope.toggleVisibility = function(setting, event) {
		if (event) { event.preventDefault(); event.stopPropagation(); }
		if (!setting || setting.saving) { return; }
		setting.visibilityOpen = !setting.visibilityOpen;
	};

	$scope.selectVisibility = function(setting, relation, event) {
		if (event) { event.preventDefault(); event.stopPropagation(); }
		if (!setting || setting.saving || !relation) { return; }
		setting.acl = relation;
		setting.visibilityOpen = false;
		$scope.changeVisibility(setting);
	};

	$scope.toggleProfileVisibility = function(event) {
		if (event) { event.preventDefault(); event.stopPropagation(); }
		var setting = $scope.data.profileVisibility;
		if (!setting || setting.saving) { return; }
		setting.visibilityOpen = !setting.visibilityOpen;
	};

	$scope.selectProfileVisibility = function(relation, event) {
		if (event) { event.preventDefault(); event.stopPropagation(); }
		var setting = $scope.data.profileVisibility;
		if (!setting || setting.saving || !relation) { return; }
		setting.value = relation;
		setting.visibilityOpen = false;
		$scope.changeSetting(setting);
	};

	/* Native date/time controls do not consistently emit a useful blur event on
	 * mobile browsers. Save their completed value from ng-change instead. */
	$scope.changeDateSetting = function(setting) {
		var inputType = setting.renderer && setting.renderer.input_type;
		if (inputType === 'date' || inputType === 'time' || inputType === 'datetime-local') {
			$scope.changeSetting(setting);
		}
	};

	$scope.blurSetting = function(setting) {
		var inputType = setting.renderer && setting.renderer.input_type;
		if (inputType !== 'date' && inputType !== 'time' && inputType !== 'datetime-local') {
			$scope.changeSetting(setting);
		}
	};
	
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
	// Also react to the authentication result itself. This covers direct route
	// navigation after the one-time "lup-inited" broadcast has already run.
	$scope.$watch('data.authenticated', function(authenticated) {
		if (authenticated) {
			$scope.init();
		}
	});
});
