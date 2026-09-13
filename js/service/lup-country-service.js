"use strict";
angular.module('LUP').
service('CountrySrvc', function($q, RequestSrvc) {
	
	var CountrySrvc = this;
	
	CountrySrvc.CACHE = null;
	
	CountrySrvc.withCountries = function() {
		console.log('CountrySrvc.withCountries()');
		if (CountrySrvc.CACHE) {
			return $q.resolve(CountrySrvc.CACHE);
		}
		return RequestSrvc.sendGWF('Country', 'AjaxList').then(function(response){
			console.log('CountrySrvc.withCountries() response', response);
			var countries = response.data.data || {};
			var rawCountries = Array.isArray(countries) ? countries : Object.keys(countries).map(function(id) {
				return countries[id];
			});
			// Older endpoints return GDO_Country instances.  The settings select
			// needs plain scalar values, never a server-side object representation.
			CountrySrvc.CACHE = rawCountries.map(function(country) {
				var id = country && typeof country.id === 'function' ? country.id() : country && country.id;
				var text = country && typeof country.text === 'function' ? country.text() : country && (country.text || country.name);
				if ((!id || !text) && country && country.JSON) {
					id = id || country.JSON.id || country.JSON.country_code || country.JSON.code;
					text = text || country.JSON.text || country.JSON.name;
				}
				return {id: String(id || ''), text: String(text || id || '')};
			});
			// Kosovo is commonly represented as XK in application country lists.
			// Keep it selectable when an older backend catalogue omits the entry.
			if (!CountrySrvc.CACHE.some(function(country) { var id = typeof country.id === 'function' ? country.id() : country.id; return String(id).toUpperCase() === 'XK'; })) {
				CountrySrvc.CACHE.push({id: 'XK', text: window.t('country_XK') || 'Kosovo'});
			}
			CountrySrvc.CACHE.sort(function(a,b) {
				return a.text.localeCompare(b.text);
			});
			return CountrySrvc.CACHE;
		});
	};
	
	CountrySrvc.countryURL = function(id) {
		return window.LUP_CONFIG.server + "GDO/Country/img/" + id.toUpperCase() + ".png";
	};

	CountrySrvc.flagStyle = function(id) {
		var code = String(id || '').toUpperCase();
		if (!/^[A-Z]{2}$/.test(code)) {
			return {};
		}
		var x = code.charCodeAt(0) - 65;
		var y = code.charCodeAt(1) - 65;
		return {
			'background-image': 'url(' + window.LUP_CONFIG.server + 'GDO/Country/img/country-sprite.png?v=' + window.LUP_BUILD + ')',
			'background-position': (-x * 32) + 'px ' + (-y * 24) + 'px',
		};
	};

	CountrySrvc.flagStyleAttribute = function(id) {
		var style = CountrySrvc.flagStyle(id);
		return Object.keys(style).map(function(key) {
			return key + ':' + style[key];
		}).join(';');
	};
	
	return CountrySrvc;
});
