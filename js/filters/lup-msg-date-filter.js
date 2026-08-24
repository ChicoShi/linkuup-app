"use strict";
angular.module('LUP').filter('msgDate', function() {
	return function(input) {
		return moment(input).format(window.t("FMT_LONG"));
	};
});
