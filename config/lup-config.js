angular.module('LUP').config(function($routeProvider, $locationProvider, $translateProvider) {
	$routeProvider.otherwise('/locations');
	
	$translateProvider.useStaticFilesLoader({
	    prefix: 'locale/locale-',
	    suffix: '.json'
	});
	
	$translateProvider.useSanitizeValueStrategy('escapeParameters');
	
	$translateProvider.preferredLanguage('de');
	
	moment.locale('de');
});
