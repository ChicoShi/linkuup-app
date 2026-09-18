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
		CategorySrvc.CACHE = {};
		angular.forEach(response.data.data, function(category) {
			CategorySrvc.CACHE[String(category.cat_id)] = category;
		});
		console.log(CategorySrvc.CACHE);
		return response;
	};

	var categoryIcons = {
		'2': 'location_city',
		'3': 'local_bar',
		'4': 'sports_bar',
		'5': 'local_cafe',
		'6': 'business',
		'7': 'local_grocery_store',
		'8': 'church',
		'9': 'content_cut',
		'10': 'location_city',
		'11': 'nightlife',
		'12': 'theater_comedy',
		'13': 'sports_soccer',
		'14': 'restaurant',
		'15': 'park',
		'16': 'school',
		'17': 'account_balance',
		'18': 'local_hospital',
		'19': 'hotel',
		'20': 'spa',
		'21': 'medical_services',
		'30': 'local_cafe',
		'31': 'nightlife',
		'32': 'theater_comedy',
		'33': 'park',
		'34': 'location_city',
	};

	/** Return top-level category groups with all descendant category ids. */
	CategorySrvc.locationGroups = function() {
		if (!CategorySrvc.CACHE) {
			return [];
		}
		var children = {}, roots = [];
		angular.forEach(CategorySrvc.CACHE, function(category) {
			var parent = category.cat_parent === null || category.cat_parent === '' ? null : String(category.cat_parent);
			if (!parent) {
				roots.push(category);
			} else if (CategorySrvc.CACHE[parent]) {
				(children[parent] = children[parent] || []).push(String(category.cat_id));
			}
		});
		var descendants = function(id) {
			var ids = [], todo = [String(id)];
			while (todo.length) {
				var current = todo.shift();
				var direct = children[current] || [];
				direct.forEach(function(child) { ids.push(child); todo.push(child); });
			}
			return ids;
		};
		return roots.map(function(group) {
			var id = String(group.cat_id);
			return {
				ids: descendants(id),
				icon: categoryIcons[id] || 'place',
				label: group.cat_label || group.cat_name,
			};
		});
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
