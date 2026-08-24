'use strict';

/* Execute a named DOM effect only when a controller explicitly marks it. */
angular.module('LUP').directive('lupEffect', function($timeout) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			var cancel = null;
			scope.$watch(attrs.lupEffect, function(name) {
				if (!name) {
					return;
				}
				if (cancel) {
					cancel();
				}
				cancel = $timeout(function() {
					cancel = null;
					// Room-chat repeaters span the full rail width, hence their p.msg
					// target. Private-message markup puts the directive on its compact
					// complete bubble/card, so it naturally remains the target here.
					var target = element[0].querySelector('p.msg') || element[0];
					window.LUPEffects.run(target, name);
				}, 0, false);
			});
			scope.$on('$destroy', function() {
				if (cancel) {
					cancel();
				}
			});
		}
	};
});
