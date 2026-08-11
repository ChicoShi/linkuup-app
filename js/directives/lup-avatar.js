"use strict";
angular.module('LUP').
directive('lupAvatar', function() {
	return {
		restrict: 'E',
		replace: true,
		templateUrl: 'js/directives/lup-avatar.html?v='+window.LUP_BUILD,
		scope: {
			ngUser: '=',
		},
	};
});
