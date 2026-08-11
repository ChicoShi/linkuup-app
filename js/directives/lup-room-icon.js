"use strict";
angular.module('LUP').
directive('lupRoomIcon', function() {
	return {
		restrict: 'E',
		replace: true,
		templateUrl: 'js/directives/lup-room-icon.html?v='+window.LUP_BUILD,
		scope: {
			ngRoom: '=',
		},		
	};
});
