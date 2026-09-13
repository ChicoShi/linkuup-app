"use strict";
angular.module('LUP').filter('msgDate', function() {
	return function(input, format) {
		return moment(input).format(format || window.t("FMT_LONG"));
	};
});
