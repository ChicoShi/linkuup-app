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
					// Chat repeaters span the full rail width. Animate the actual
					// message bubble instead, so it folds into its own middle.
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
