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
			CountrySrvc.CACHE = Array.isArray(countries) ? countries : Object.keys(countries).map(function(id) {
				return countries[id];
			});
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
			'background-image': 'url(images/country-sprite.png?v=' + window.LUP_BUILD + ')',
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
