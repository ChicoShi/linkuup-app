'use strict';

/* Small local sound bank for optional LinkUUp interface effects. */
(function(window) {
	var lastPlayedAt = 0;
	var sounds = {
		message: 'js/effects/audio/message-droplet.wav'
	};

	window.LUPAudio = {
		play: function(name) {
			var source = sounds[name];
			if (!source || typeof window.Audio !== 'function') {
				return Promise.resolve(false);
			}
			var now = Date.now();
			if (now - lastPlayedAt < 120) {
				return Promise.resolve(false);
			}
			lastPlayedAt = now;
			var audio = new window.Audio(source);
			audio.volume = 0.38;
			return audio.play().then(function() {
				return true;
			})['catch'](function() {
				// Browsers may require a user gesture before audio is allowed.
				return false;
			});
		}
	};
})(window);
