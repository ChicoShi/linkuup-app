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
			CountrySrvc.CACHE = response.data.data;
			CountrySrvc.CACHE.sort(function(a,b) {
				return a.text.localeCompare(b.text);
			});
			return CountrySrvc.CACHE;
		});
	};
	
	CountrySrvc.countryURL = function(id) {
		return window.LUP_CONFIG.server + "GDO/Country/img/" + id.toUpperCase() + ".png";
	};
	
	return CountrySrvc;
});
