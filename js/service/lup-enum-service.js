"use strict";
angular.module('LUP').
service('EnumSrvc', function(RequestSrvc) {
	
	var EnumSrvc = this;
	EnumSrvc.CACHE = {};
	
	EnumSrvc.withEnums = function() {
		console.log('EnumSrvc.withEnums()');
		return RequestSrvc.sendGWF('Core', 'GetEnums').then(EnumSrvc.gotEnums);
	};
	
	EnumSrvc.gotEnums = function(enums) {
		console.log('EnumSrvc.gotEnums()', enums);
		EnumSrvc.CACHE = enums.data.data;
	};
	
	/////////////////
	// Convinience //
	/////////////////
	EnumSrvc.categories = function() { return EnumSrvc.CACHE['GDO\\LinkUUp\\LUP_Room.room_category']; };
	EnumSrvc.categoryToInt = function(_enum) { return EnumSrvc.toInt(_enum, 'GDO\\LinkUUp\\LUP_Room.room_category'); };
	EnumSrvc.categoryToEnum = function(integer) { return EnumSrvc.toEnum(integer, 'GDO\\LinkUUp\\LUP_Room.room_category'); };

	EnumSrvc.genderToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'User.settings.gender');
	};
	EnumSrvc.genderToInt = function(_enum) {
		 return EnumSrvc.toInt(_enum, 'User.settings.gender');
	};
	
	EnumSrvc.sexoToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'LinkUUp.settings.lup_sexo');
	};
	EnumSrvc.sexoToInt = function(_enum) {
		return EnumSrvc.toInt(_enum, 'LinkUUp.settings.lup_sexo');
	};
	
	EnumSrvc.interestToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'LinkUUp.settings.lup_interest');
	};
	EnumSrvc.interestToInt = function(integer) {
		return EnumSrvc.toInt(_enum, 'LinkUUp.settings.lup_interest');
	};
	
	EnumSrvc.relationshipToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'GDO\\Friends\\GDO_Friendship.friend_relation');
	};
	EnumSrvc.relationshipToInt = function(_enum) {
		return EnumSrvc.toInt(_enum, 'GDO\\Friends\\GDO_Friendship.friend_relation');
	};

	EnumSrvc.emailFormatToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'GDO\\User\\GDO_User.user_email_fmt');
	};
	EnumSrvc.emailFormatToInt = function(_enum) {
		 return EnumSrvc.toInt(_enum, 'GDO\\User\\GDO_User.user_email_fmt');
	};
	
	EnumSrvc.userTypeToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'GDO\\User\\GDO_User.user_type');
	};

	EnumSrvc.emailFormatToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'GDO\\User\\GDO_User.user_email_fmt');
	};
	EnumSrvc.relationToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'GDO\\Friends\\GDO_Friendship.friend_relation');
	};
	
	EnumSrvc.eyeColors = function() {
		return EnumSrvc.CACHE['LinkUUp.settings.lup_eyecolor'];
	};
	
	EnumSrvc.galleryACLToEnum = function(integer) {
		return EnumSrvc.toEnum(integer, 'GDO\\Gallery\\GDO_Gallery.gallery_acl');
	};
	EnumSrvc.galleryACLToInt = function(_enum) {
		 return EnumSrvc.toInt(_enum, 'GDO\\Gallery\\GDO_Gallery.gallery_acl');
	};

	EnumSrvc.aclToEnum = function(integer) {
		return integer === 0 ? null : EnumSrvc.toEnum(integer, 'GDO\\User\\GDO_UserSetting.uset_relation');
	};

	/////////////
	// Convert //
	/////////////
	EnumSrvc.toInt = function(value, type) {
		var _integer = value === null ? 0 : EnumSrvc.CACHE[type].indexOf(value) + 1;
//		console.log('EnumSrvc.toInt()', value, type, _integer);
		return _integer;
	};
	
	EnumSrvc.toEnum = function(integer, type) {
		var _enum = integer === 0 ? 'Not specified' : EnumSrvc.CACHE[type][integer-1];
//		console.log('EnumSrvc.toEnum()', integer, type, _enum);
		return _enum;
	};
	
	return EnumSrvc;
});
