/* Keep app-sized surfaces aligned with the actually visible mobile viewport.
 * Mobile browser chrome and the software keyboard can change this without a
 * full page reload, so CSS 100% / 100vh alone is not sufficient. */
(function () {
	"use strict";

	var frame;
	var viewport = window.visualViewport;
	var update = function () {
		frame = null;
		var height = viewport ? viewport.height : window.innerHeight;
		document.documentElement.style.setProperty('--lup-viewport-height', Math.round(height) + 'px');
	};
	var schedule = function () {
		if (frame === undefined || frame === null) {
			frame = window.requestAnimationFrame(update);
		}
	};

	window.addEventListener('resize', schedule);
	window.addEventListener('orientationchange', schedule);
	if (viewport) {
		viewport.addEventListener('resize', schedule);
		viewport.addEventListener('scroll', schedule);
	}
	schedule();
}());
