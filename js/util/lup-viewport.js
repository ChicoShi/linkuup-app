/* Keep app-sized surfaces aligned with the actually visible mobile viewport.
 * Mobile browser chrome and the software keyboard can change this without a
 * full page reload, so CSS 100% / 100vh alone is not sufficient. */
(function () {
	"use strict";

	var frame;
	var viewport = window.visualViewport;
	var restingHeight = window.innerHeight;
	var restingWidth = window.innerWidth;
	var update = function () {
		frame = null;
		// Pinch zoom must remain a browser operation, not reflow the app.
		if (viewport && viewport.scale && Math.abs(viewport.scale - 1) > .01) return;
		var height = viewport ? viewport.height : window.innerHeight;
		var offsetTop = viewport ? Math.max(0, viewport.offsetTop) : 0;
		var active = document.activeElement;
		var editing = active && (active.matches('input,textarea') || active.isContentEditable);
		if (!editing || Math.abs(window.innerWidth - restingWidth) > 80) {
			restingHeight = window.innerHeight;
			restingWidth = window.innerWidth;
		}
		// Safari pans the visual viewport; Android may resize the layout viewport.
		// Height AND offset must follow the same frame, without a CSS transition.
		var keyboardHeight = Math.max(0, Math.max(restingHeight, window.innerHeight) - height - offsetTop);
		document.documentElement.style.setProperty('--lup-viewport-height', height + 'px');
		document.documentElement.style.setProperty('--lup-viewport-top', offsetTop + 'px');
		document.documentElement.classList.toggle('lup-soft-keyboard-open', !!editing && keyboardHeight > 110);
	};
	var schedule = function () {
		if (frame === undefined || frame === null) {
			frame = window.requestAnimationFrame(update);
		}
	};

	window.addEventListener('resize', schedule);
	window.addEventListener('orientationchange', schedule);
	document.addEventListener('focusin', schedule);
	document.addEventListener('focusout', schedule);
	// A touch on Send must not blur the composer and dismiss the keyboard first.
	// Click/submit and keyboard activation keep their normal behaviour.
	document.addEventListener('pointerdown', function(event) {
		var button = event.target.closest && event.target.closest('.place-composer button');
		var input = document.activeElement;
		if (button && !button.disabled && input && input.matches('input,textarea') && button.form === input.form) {
			event.preventDefault();
		}
	});
	if (viewport) {
		viewport.addEventListener('resize', schedule);
		viewport.addEventListener('scroll', schedule);
	}
	schedule();
}());
