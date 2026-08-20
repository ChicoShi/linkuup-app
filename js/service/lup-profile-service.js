"use strict";
angular.module('LUP').
/**
 * Profile loader service.
 */
service('ProfileSrvc', function(WebsocketSrvc, TypeSrvc, UserSrvc, SettingsSrvc, EnumSrvc) {

	const ProfileSrvc = this;

	ProfileSrvc.withProfile = function(user) {
		console.log('ProfileSrvc.withProfile()', user);
		const gwsMessage = new GWS_Message().cmd(0x0901).sync().write32(user.id());
		return WebsocketSrvc.sendBinary(gwsMessage).
			then(ProfileSrvc.loadedProfile, WebsocketSrvc.onError);
	};
	
	ProfileSrvc.loadedProfile = function(gwsMessage) {
		console.log('ProfileSrvc.loadedProfile()', gwsMessage);

		// Parse profile via TypeSrvc.
		const profile = new GDO_Profile();
		profile.user = UserSrvc.getOrCreate(gwsMessage.read32());
		profile.related = gwsMessage.read8();

		const global = gwsMessage.read8();
		profile.globallyVisible = !!global;
		if (!global) {
			console.log('ALL HIDDEN!');
			return profile;
		}

		for (let moduleName in SettingsSrvc.CACHE) {
			if (moduleName === 'user') {
				continue; // This is the user object. we have that elsewhere.
			}
			let moduleSettings = SettingsSrvc.CACHE[moduleName];
			for (let key in moduleSettings) {
				console.log('Trying to parse ' + moduleName + "." + key);
				let setting = moduleSettings[key];
				var status = gwsMessage.read8();
				// GWS_Profile frames every field as status, stored target ACL enum, payload.
				// Keep the ACL even for empty/denied fields so the view can explain the
				// profile contract without guessing module defaults.
				profile.ACL[key] = EnumSrvc.aclToEnum(gwsMessage.read8());
				if (status === 0) {
					profile.JSON[key] = TypeSrvc.parseBinaryTypeHierarchy(gwsMessage, setting);
					console.log(`Parsed ${setting.module}.${setting.name} to ${profile.JSON[key]}`);
				} else if (status === 1) {
					profile.ERRORS[key] = gwsMessage.readString();
				} else if (status === 2) {
					profile.EMPTY[key] = true;
				} else {
					console.warn('Unknown profile field status', status, moduleName, key);
				}
			}
		}
		// TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\Profile\\GDO_Profile", profile);
		// Init enums with 0 instead of null
		profile.JSON.lup_sexo = profile.JSON.lup_sexo||'0';
		profile.JSON.lup_interest = profile.JSON.lup_interest||'0';
		profile.JSON.lup_eyecolor = profile.JSON.lup_eyecolor||'0';
		profile.JSON.lup_has_pet = profile.JSON.lup_has_pet||'0';
		profile.JSON.lup_drinks = profile.JSON.lup_drinks||'0';
		profile.JSON.lup_smokes = profile.JSON.lup_smokes||'0';
		profile.JSON.lup_sporty = profile.JSON.lup_sporty||'0';
		profile.JSON.lup_profile_outside_visible = String(profile.JSON.lup_profile_outside_visible) === '1' ? '1' : '0';

		// Fix floats
		if (profile.JSON.lup_height) {
			profile.JSON.lup_height = parseFloat(profile.JSON.lup_height.toPrecision(3));
		}
		// Fix country
		// profile.JSON.lup_origin = profile.JSON.lup_origin||'null';
		// Success
		console.log('ProfileSrvc.loadedProfile() profile=', profile);
		return profile;
	};
	
	return ProfileSrvc;
});
