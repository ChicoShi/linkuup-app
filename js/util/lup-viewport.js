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
		var offsetTop = viewport ? viewport.offsetTop : 0;
		/* On iOS, innerHeight generally remains the layout viewport while the
		 * keyboard reduces visualViewport.height. Expose that fact without
		 * guessing from focus events; browser chrome alone is below this limit. */
		var keyboardHeight = Math.max(0, window.innerHeight - height - offsetTop);
		document.documentElement.style.setProperty('--lup-viewport-height', Math.round(height) + 'px');
		document.documentElement.style.setProperty('--lup-keyboard-height', Math.round(keyboardHeight) + 'px');
		document.documentElement.classList.toggle('lup-soft-keyboard-open', keyboardHeight > 110);
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
