"use strict";
angular.module('LUP').service('CategorySrvc', function(RequestSrvc, EnumSrvc) {
	
	var CategorySrvc = this;
	
	CategorySrvc.CACHE = null;
	
	CategorySrvc.withCategories = function() {
		console.log('CategorySrvc.withCategories()');
		return RequestSrvc.sendGWF('LinkUUp', 'CategoryJSON').then(CategorySrvc.gotCategories);

	};
	CategorySrvc.gotCategories = function(response) {
		console.log('CategorySrvc.gotCategories()', response);
		CategorySrvc.CACHE = response.data.data;
		console.log(CategorySrvc.CACHE);
		return response;
	};
	
	CategorySrvc.nameForId = function(id) {
		var category = CategorySrvc.CACHE && CategorySrvc.CACHE[id];
		return category ? category.cat_name : '';
	};
	
	CategorySrvc.displayName = function(id) {
		return CategorySrvc.nameForId(id);
	};
	CategorySrvc.displayColor = function(id) {
		var category = CategorySrvc.CACHE && CategorySrvc.CACHE[id];
		return category ? category.cat_color : '';
	};
	
	CategorySrvc.displayIcon = function(id) {
		var url = window.LUP_CONFIG.server + '/index.php?_mo=LinkUUp&_me=CategoryIcon&_ajax=1&id='+id;
		return sprintf('<img src="%s" />', url);
	};
	
	return CategorySrvc;
});
