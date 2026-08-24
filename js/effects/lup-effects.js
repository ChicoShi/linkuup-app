'use strict';

/*
 * Small, dependency-free DOM effects for LinkUUp.
 *
 * Effects deliberately operate on one existing element and leave application
 * state alone.  This keeps them safe to use after Angular has rendered a
 * fresh chat message.
 */
(function(window) {
	var activeAnimations = new WeakMap();
	var Effects = window.LUPEffects = window.LUPEffects || {};

	Effects.reducedMotion = function() {
		return !!(window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	};

	Effects.run = function(element, name, options) {
		if (!element || typeof Effects[name] !== 'function') {
			return null;
		}
		var previous = activeAnimations.get(element);
		if (previous) {
			previous.cancel();
		}
		var animation = Effects[name](element, options || {});
		if (animation) {
			activeAnimations.set(element, animation);
			animation.onfinish = animation.oncancel = function() {
				if (activeAnimations.get(element) === animation) {
					activeAnimations.delete(element);
				}
			};
		}
		return animation;
	};

	/*
	 * A new message arrives tiny, briefly grows past its natural size, and then
	 * settles at 100%.  The animation is intentionally transform-only so it
	 * does not force layout while a chat is scrolling.
	 */
	Effects.blubble = function(element, options) {
		if (Effects.reducedMotion() || typeof element.animate !== 'function') {
			return null;
		}
		var animation = element.animate([
			{ transform: 'scale(0.18)', transformOrigin: 'center center', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
			{ transform: 'scale(1.25)', transformOrigin: 'center center', easing: 'cubic-bezier(0.34, 1.28, 0.64, 1)', offset: 0.48 },
			{ transform: 'scale(0.93)', transformOrigin: 'center center', easing: 'cubic-bezier(0.22, 0.85, 0.36, 1)', offset: 0.70 },
			{ transform: 'scale(1.06)', transformOrigin: 'center center', easing: 'cubic-bezier(0.34, 1.15, 0.64, 1)', offset: 0.86 },
			{ transform: 'scale(1)', transformOrigin: 'center center' }
		], {
			duration: options.duration || 560,
			easing: 'cubic-bezier(0.22, 0.9, 0.36, 1)',
			fill: 'none'
		});
		return animation;
	};
})(window);
