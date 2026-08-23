angular.module('LUP').config(function($routeProvider, $locationProvider, $translateProvider) {
	$routeProvider.otherwise('/locations');
	
	$translateProvider.useStaticFilesLoader({
	    prefix: 'locale/locale-',
	    // Keep visible texts in sync with the same deploy marker as templates.
	    // Otherwise a browser can render newly added keys as their raw names
	    // while it still holds an older locale JSON response in its cache.
	    suffix: '.json?v=' + window.LUP_BUILD
	});
	
	$translateProvider.useSanitizeValueStrategy('escapeParameters');
	
	$translateProvider.preferredLanguage('de');
	
	moment.locale('de');
});
