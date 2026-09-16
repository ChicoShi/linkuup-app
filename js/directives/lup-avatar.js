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
angular.module('LUP').directive('lupPresence', function(RoomSrvc) {
	return {
		restrict: 'E',
		scope: {ngRoom: '=', compact: '@'},
		template: '<span class="lup-presence" ng-class="{\'is-compact\':compact === \'true\'}">' +
			'<span class="lup-presence-avatars" ng-if="compact !== \'true\' && faces.length" aria-hidden="true" ng-style="stackStyle">' +
			'<lup-avatar ng-repeat="user in faces track by user.id()" ng-user="user"></lup-avatar></span>' +
			'<span class="lup-presence-summary" aria-live="polite" aria-atomic="true">' +
			'<span class="lup-presence-number">{{count}}</span> <span>{{\'TAB_ONLINE\'|translate}}</span></span></span>',
		link: function(scope, element) {
			var initialized = false, animation = null;
			scope.faces = [];
			scope.count = 0;
			var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
			var stopMotion = function() { if (reduced.matches && animation) animation.cancel(); };
			if (reduced.addEventListener) reduced.addEventListener('change', stopMotion);
			var unwatch = scope.$watchCollection(function() {
				return RoomSrvc && RoomSrvc.displayUsers ? RoomSrvc.displayUsers(scope.ngRoom) : scope.ngRoom && scope.ngRoom.USERS;
			}, function(users) {
				users = users || [];
				var previous = scope.count;
				scope.count = users.length;
				scope.faces = users.slice(0, 20);
				// Eight separate faces, then gradual compression to 45% at twenty.
				var compression = Math.max(0, Math.min(1, (scope.faces.length - 8) / 12));
				scope.stackStyle = {'--presence-overlap': String(compression * .45),
					'--presence-gap': (2 * (1 - compression)) + 'px'};
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
			scope.$on('$destroy', function() {
				unwatch();
				if (reduced.removeEventListener) reduced.removeEventListener('change', stopMotion);
				if (animation) animation.cancel();
			});
		}
	};
});

angular.module('LUP').directive('lupPresencePreview',function(RoomSrvc){return {
 restrict:'E',scope:{ngRoom:'='},
 template:'<div class="place-preview-note" ng-if="possible()"><span ng-if="active()">{{"PREVIEW_GUESTS"|translate}}</span><button type="button" ng-click="toggle()">{{(active()?"PREVIEW_GUESTS_OFF":"PREVIEW_GUESTS_ON")|translate}}</button><small ng-if="active()">{{"PREVIEW_NOTE"|translate}}</small></div>',
 link:function(scope){scope.possible=function(){return RoomSrvc.previewPossible(scope.ngRoom);};scope.active=function(){return RoomSrvc.isPreviewRoom(scope.ngRoom);};scope.toggle=RoomSrvc.togglePreview;}
};});
