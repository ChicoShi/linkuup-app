"use strict";
angular.module('LUP').
directive('lupAvatar', function() {
	return {
		restrict: 'E',
		replace: true,
		templateUrl: 'js/directives/lup-avatar.html?v='+window.LUP_BUILD,
		scope: {
			ngUser: '=',
		},
	};
});

/* A read-only presence preview. It uses the same room.USERS as the Online tab;
 * no polling, synthetic visitors, profile links or membership changes. */
angular.module('LUP').directive('lupPresence', function(RoomSrvc, $timeout) {
	return {
		restrict: 'E',
		scope: {ngRoom: '=', compact: '@', simulate: '@'},
		template: '<span class="lup-presence" ng-class="{\'is-compact\':compact === \'true\'}">' +
			'<span class="lup-presence-avatars" ng-if="compact !== \'true\' && (renderedFaces.length || simulate === \'true\')" aria-hidden="true" ng-style="stackStyle">' +
			'<span class="lup-presence-face" ng-repeat="face in renderedFaces track by face.key" data-presence-id="{{face.key}}" ng-class="{\'is-leaving\':face.leaving}" ng-style="face.motion">' +
			'<span class="lup-presence-float"><span class="lup-presence-balloon"><lup-avatar ng-user="face.user"></lup-avatar></span></span></span></span>' +
			'<span class="lup-presence-summary" aria-live="polite" aria-atomic="true">' +
			'<span class="lup-presence-number">{{count}}</span> <span>{{\'TAB_ONLINE\'|translate}}</span></span>' +
			'<span class="lup-presence-demo" ng-if="demo"><span>{{(demo.done ? \'PREVIEW_BALLOONS_DONE\' : \'PREVIEW_BALLOONS\')|translate}} · {{remaining}}</span>' +
			'<button type="button" ng-if="!demo.done" ng-click="pauseDemo()" aria-label="{{(demo.running ? \'PREVIEW_PAUSE\' : \'PREVIEW_RESUME\')|translate}}"><i class="material-icons" aria-hidden="true">{{demo.running ? \'pause\' : \'play_arrow\'}}</i></button>' +
			'<button type="button" ng-click="restartDemo()" aria-label="{{\'PREVIEW_REPLAY\'|translate}}"><i class="material-icons" aria-hidden="true">replay</i></button></span></span>',
		link: function(scope, element) {
			var initialized = false, animation = null, roomKey, destroyed = false;
			var departures = {}, frame = null, demoTimer = null, visible = true;
			var root = element[0], doc = root.ownerDocument;
			scope.faces = [];
			scope.renderedFaces = [];
			scope.count = 0;
			var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
			// A fixed rail and transform-only positions let survivors close each gap
			// without animating layout or restarting their independent float cycles.
			function layout() {
				frame = null;
				var rail = root.querySelector('.lup-presence-avatars');
				if (destroyed || !rail || !rail.clientWidth) return;
				var active = scope.renderedFaces.filter(function(face) { return !face.leaving; });
				var n = active.length, overlap = Math.max(0, Math.min(1, (n - 8) / 12)) * .45;
				var gap = 2 * (1 - overlap / .45);
				var size = Math.min(26, Math.max(20, (window.innerWidth || 390) * .065),
					(rail.clientWidth - gap * Math.max(0, n - 1)) / Math.max(1, n - Math.max(0, n - 1) * overlap));
				var step = size * (1 - overlap) + gap, width = n ? size + (n - 1) * step : 0;
				Array.prototype.forEach.call(rail.children, function(node) {
					var index = active.findIndex(function(face) { return face.key === node.getAttribute('data-presence-id'); });
					if (index < 0) return; // Departing bubbles stay at their last position.
					node.style.setProperty('--presence-size', size + 'px');
					node.style.transform = 'translateX(' + ((rail.clientWidth - width) / 2 + index * step) + 'px)';
				});
			}
			function queueLayout() {
				if (!destroyed && window.requestAnimationFrame && frame === null) frame = window.requestAnimationFrame(layout);
			}
			function forgetDeparture(key) {
				if (departures[key]) { $timeout.cancel(departures[key]); delete departures[key]; }
			}
			function stopMotion() {
				if (reduced.matches && animation) animation.cancel();
				if (reduced.matches) {
					Object.keys(departures).forEach(forgetDeparture);
					scope.$evalAsync(function() { scope.renderedFaces = scope.renderedFaces.filter(function(face) { return !face.leaving; }); });
				}
			}
			if (reduced.addEventListener) reduced.addEventListener('change', stopMotion);
			var unwatch = scope.$watchCollection(function() {
				return RoomSrvc && RoomSrvc.displayUsers ? RoomSrvc.displayUsers(scope.ngRoom) : scope.ngRoom && scope.ngRoom.USERS;
			}, function(users) {
				users = users || [];
				var nextRoom = scope.ngRoom && scope.ngRoom.id ? scope.ngRoom.id() : null;
				if (nextRoom !== roomKey) {
					Object.keys(departures).forEach(forgetDeparture);
					scope.renderedFaces = []; initialized = false; roomKey = nextRoom;
				}
				var previous = scope.count;
				scope.count = users.length;
				scope.faces = users.slice(0, 20);
				var nextKeys = {}, stagger = 0;
				scope.faces.forEach(function(user) {
					var key = String(user.id()), seed = Math.abs(Number(key) || 1);
					nextKeys[key] = true;
					var face = scope.renderedFaces.find(function(item) { return item.key === key; });
					if (face) { forgetDeparture(key); face.user = user; face.leaving = false; return; }
					scope.renderedFaces.push({key:key, user:user, leaving:false, motion:{
						'--arrival-delay': Math.min(stagger++ * 60, 480) + 'ms',
						'--float-duration': (3.8 + seed % 9 * .23) + 's',
						'--float-delay': -(seed % 17 * .31) + 's',
						'--float-side': (seed % 2 ? 1 : -1) + 'px'
					}});
				});
				scope.renderedFaces.slice().forEach(function(face) {
					if (nextKeys[face.key] || face.leaving) return;
					if (reduced.matches || !visible) {
						scope.renderedFaces.splice(scope.renderedFaces.indexOf(face), 1); return;
					}
					face.leaving = true;
					departures[face.key] = $timeout(function() {
						scope.renderedFaces = scope.renderedFaces.filter(function(item) { return item !== face; });
						delete departures[face.key];
					}, 440);
				});
				// Eight separate faces, then gradual compression to 45% at twenty.
				var compression = Math.max(0, Math.min(1, (scope.faces.length - 8) / 12));
				scope.stackStyle = {'--presence-overlap': String(compression * .45),
						'--presence-gap': (2 * (1 - compression)) + 'px'};
				if (scope.$$postDigest) scope.$$postDigest(queueLayout);
				if (initialized && scope.count !== previous && !reduced.matches) {
					var number = element[0].querySelector('.lup-presence-number');
					if (number && typeof number.animate === 'function') {
						if (animation) animation.cancel();
						animation = number.animate([
							{transform: 'translateY(' + (scope.count > previous ? 7 : -7) + 'px) scale(.86)', opacity: .3},
							{transform: 'translateY(-1px) scale(1.12)', opacity: 1, offset: .55},
							{transform: 'translateY(0) scale(1)', opacity: 1}
						], {duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)'});
					}
				}
				initialized = true;
			});
			var resize = window.ResizeObserver ? new window.ResizeObserver(queueLayout) : null;
			if (resize) resize.observe(root);
			function rest() { if (root.classList) root.classList.toggle('presence-resting', !visible || (doc && doc.hidden)); }
			var visibility = window.IntersectionObserver ? new window.IntersectionObserver(function(entries) {
				visible = entries[0].isIntersecting; rest(); if (visible) queueLayout();
			}) : null;
			if (visibility) visibility.observe(root);
			if (doc) doc.addEventListener('visibilitychange', rest);
			// Only the explicitly labelled, loopback-only chat preview owns a clock.
			var lastTick;
			function tickDemo() {
				var now = Date.now();
				if (visible && !(doc && doc.hidden)) scope.demo.advance(now - lastTick);
				lastTick = now;
				var seconds = Math.ceil((scope.demo.duration - scope.demo.elapsed) / 1000);
				scope.remaining = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
				if (!scope.demo.done) demoTimer = $timeout(tickDemo, 250);
			}
			scope.restartDemo = function() {
				if (demoTimer) $timeout.cancel(demoTimer);
				if (scope.demo) scope.demo.stop();
				scope.demo = RoomSrvc.createPresenceSimulation(scope.ngRoom);
				if (scope.demo) { lastTick = Date.now(); tickDemo(); }
			};
			scope.pauseDemo = function() { scope.demo.running = !scope.demo.running; lastTick = Date.now(); };
			if (scope.simulate === 'true' && RoomSrvc && RoomSrvc.createPresenceSimulation) scope.restartDemo();
			scope.$on('$destroy', function() {
				destroyed = true;
				unwatch();
				Object.keys(departures).forEach(forgetDeparture);
				if (frame !== null) window.cancelAnimationFrame(frame);
				if (resize) resize.disconnect();
				if (visibility) visibility.disconnect();
				if (doc) doc.removeEventListener('visibilitychange', rest);
				if (demoTimer) $timeout.cancel(demoTimer);
				if (scope.demo) scope.demo.stop();
				if (reduced.removeEventListener) reduced.removeEventListener('change', stopMotion);
				if (animation) animation.cancel();
			});
		}
	};
});
