"use strict";
angular.module('LUP').
service('TimezoneSrvc', function($q, RequestSrvc, ErrorSrvc) {
	
	var TimezoneSrvc = this;
	
	TimezoneSrvc.CACHE = null;
	
	TimezoneSrvc.withTimezones = function() {
		console.log('TimezoneSrvc.withTimezones()');
		if (TimezoneSrvc.CACHE) {
			return $q.resolve(TimezoneSrvc.CACHE);
		}
		return RequestSrvc.sendGWF('Date', 'Timezones').then(function(response) {
			console.log('TimezoneSrvc.withTimezones() response', response);
			TimezoneSrvc.CACHE = response.data.data;
			return TimezoneSrvc.CACHE;
		}, ErrorSrvc.showGDOAjaxError);
	};
	
	TimezoneSrvc.withTimezoneFor = function(user) {
		console.log('TimezoneSrvc.withTimezoneFor()', user);
		if (user.user_timezone > 1) {
			return $q.resolve(user);
		}
		let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		let data = { timezone: tz, submit: 1 };
		return RequestSrvc.sendGWF('Date', 'TimezoneDetect', data).then(function(response) {
			user.JSON.timezone = response.data.tz_id;
			return user;
		}, function(e) {
			alert(e);
		});
	};

	TimezoneSrvc.renderTimezone = function(tzId) {
		const cache = TimezoneSrvc.CACHE || {};
		// The catalogue endpoint is a JSON list; retain support for the old
		// ID-keyed map while resolving current list entries by tz_id.
		const tz = Array.isArray(cache) ? cache.find(function(entry) {
			return String(entry.tz_id) === String(tzId);
		}) : cache[tzId];
		if (!tz) {
			return '---';
		}
		const name = tz.tz_name;
		let clock = '---';
		try {
			clock = moment().tz(name).format('HH:mm');
		}
		catch (ex) {
			console.error(ex);
		}
		return `${name} (${clock})`;
	};

	TimezoneSrvc.options = function() {
		var timezones = TimezoneSrvc.CACHE || {};
		var options = Array.isArray(timezones) ? timezones : Object.keys(timezones).map(function(id) {
			return timezones[id];
		});
		// Ajax payloads may contain an auxiliary/non-timezone value. Do not let
		// one malformed entry make the whole Settings or Account page unusable.
		options = options.filter(function(timezone) {
			return timezone && (typeof timezone.tz_name === 'string') && timezone.tz_name.length;
		});
		return options.sort(function(a, b) {
			return a.tz_name.localeCompare(b.tz_name);
		});
	};
	
	return TimezoneSrvc;
});
