"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/debug', {
		templateUrl: 'js/pages/debug/lup-debug.html?v='+window.LUP_BUILD,
		controller: 'DebugCtrl',
		params: {
			authCheck: 'debug',
		},
	});
}).controller('DebugCtrl', function($scope, $window, $rootScope, $injector,
		$templateCache, $cacheFactory,
		RoomSrvc, HelpSrvc, ErrorSrvc, WebsocketSrvc, StorageSrvc, ChatSrvc, UserSrvc) {

	$scope.$window = $window;
	$scope.debug = {};

	var SECRET_KEY = /(pass|secret|token|authorization|credential)/i;
	var SERVICE_NAMES = [
		'AuthSrvc', 'CategorySrvc', 'ChatSrvc', 'CommentSrvc', 'ConfigSrvc',
		'CountrySrvc', 'CourseSrvc', 'DialogSrvc', 'EnumSrvc', 'ErrorSrvc',
		'ExceptionSrvc', 'FXSrvc', 'FriendSrvc', 'GallerySrvc', 'HelpSrvc',
		'LikeSrvc', 'LoadingSrvc', 'LogoSrvc', 'NotificationSrvc', 'PositionSrvc',
		'ProfileSrvc', 'RenderSrvc', 'RequestInterceptor', 'RequestSrvc', 'RoomSrvc',
		'SettingsSrvc', 'StorageSrvc', 'TimezoneSrvc', 'TypeSrvc', 'UserSrvc',
		'WebsocketSrvc'
	];
	var CACHE_KEY = /(cache|cached|messages|queries|tasks|sync_msgs|read|types|fields)/i;

	function safeValue(value, key, seen, depth) {
		if (SECRET_KEY.test(key || '')) {
			return '[redacted]';
		}
		if (value === null || value === undefined) {
			return value;
		}
		if (typeof value === 'function') {
			return '[function '+(value.name || 'anonymous')+']';
		}
		if (typeof value !== 'object') {
			return value;
		}
		if (depth > 5) {
			return '[max depth]';
		}
		if (value === window) {
			return '[window]';
		}
		if (value.nodeType) {
			return '[DOM '+(value.nodeName || 'node')+']';
		}
		if (typeof WebSocket !== 'undefined' && value instanceof WebSocket) {
			return {
				url: value.url,
				readyState: value.readyState,
				bufferedAmount: value.bufferedAmount,
				protocol: value.protocol,
			};
		}
		if (seen.indexOf(value) >= 0) {
			return '[circular]';
		}
		seen.push(value);

		var result = Array.isArray(value) ? [] : {};
		Object.keys(value).sort().forEach(function(childKey) {
			try {
				result[childKey] = safeValue(value[childKey], childKey, seen, depth + 1);
			}
			catch (e) {
				result[childKey] = '[unreadable: '+e.message+']';
			}
		});
		seen.pop();
		return result;
	}

	function snapshot(value) {
		return safeValue(value, '', [], 0);
	}

	function storageSnapshot(storage) {
		var result = {};
		try {
			for (var i = 0; i < storage.length; i++) {
				var key = storage.key(i);
				var value = storage.getItem(key);
				try {
					result[key] = JSON.parse(value);
				}
				catch (e) {
					result[key] = value;
				}
			}
		}
		catch (e) {
			result.error = e.message;
		}
		return result;
	}

	function globalSnapshot() {
		var result = {};
		Object.keys(window).sort().forEach(function(key) {
			if (/^(GWF_|GDO_|GWS_|LUP_)/.test(key)) {
				try {
					result[key] = snapshot(window[key]);
				}
				catch (e) {
					result[key] = '[unreadable: '+e.message+']';
				}
			}
		});
		return result;
	}

	function serviceSnapshot(name) {
		try {
			return $injector.has(name) ? snapshot($injector.get(name)) : '[not registered]';
		}
		catch (e) {
			return '[error: '+e.message+']';
		}
	}

	function allServiceSnapshots() {
		var result = {};
		SERVICE_NAMES.forEach(function(name) {
			result[name] = serviceSnapshot(name);
		});
		return result;
	}

	function allServiceCaches() {
		var result = {};
		SERVICE_NAMES.forEach(function(name) {
			try {
				if (!$injector.has(name)) {
					result[name] = '[not registered]';
					return;
				}
				var service = $injector.get(name);
				var caches = {};
				Object.keys(service).sort().forEach(function(key) {
					if (CACHE_KEY.test(key)) {
						caches[key] = snapshot(service[key]);
					}
				});
				result[name] = Object.keys(caches).length ? caches : '[no cache-like properties]';
			}
			catch (e) {
				result[name] = '[error: '+e.message+']';
			}
		});
		return result;
	}

	$scope.data.currentRooms = function() {
		var currentRooms = [];
		var rooms = RoomSrvc.getRoomsForUser(window.GWF_USER);
		for (var i in rooms) {
			currentRooms.push(rooms[i].name());
		}
		return currentRooms;
	};

	$scope.refreshDebug = function() {
		var userId = window.GWF_USER && window.GWF_USER.id ? window.GWF_USER.id() : null;
		$scope.debug = {
			capturedAt: new Date().toISOString(),
			location: window.location.href,
			cookie: document.cookie || '[none or HttpOnly]',
			user: snapshot(window.GWF_USER),
			userIdentity: {
				id: userId,
				isCachedAsCurrent: !!(userId !== null && UserSrvc.CACHE[userId] === window.GWF_USER),
				cacheEntry: snapshot(UserSrvc.CACHE[userId]),
			},
			userCache: snapshot(UserSrvc.CACHE),
			localStorage: storageSnapshot(window.localStorage),
			sessionStorage: storageSnapshot(window.sessionStorage),
			angularCaches: snapshot($cacheFactory.info()),
			templateCache: {
				info: snapshot($templateCache.info()),
				keys: Object.keys($templateCache).sort(),
			},
			websocket: {
				connected: WebsocketSrvc.CONNECTED,
				messagesSent: WebsocketSrvc.MSGS_SENT,
				messagesReceived: WebsocketSrvc.MSGS_RECV,
				pendingSyncIds: Object.keys(WebsocketSrvc.SYNC_MSGS).filter(function(key) {
					return !!WebsocketSrvc.SYNC_MSGS[key];
				}),
				socket: snapshot(WebsocketSrvc.SOCKET),
				config: snapshot(WebsocketSrvc.CONFIG),
			},
			rootData: snapshot($rootScope.data),
			serviceCaches: allServiceCaches(),
			services: allServiceSnapshots(),
			globals: globalSnapshot(),
		};
		$scope.debugJSON = JSON.stringify($scope.debug, null, 2);
		console.log('DebugCtrl.refreshDebug()', $scope.debug);
	};

	$scope.init = function() {
		$scope.data.user = window.GWF_USER;
		$scope.refreshDebug();
	};

	$scope.copyDebug = function() {
		var text = $scope.debugJSON || '';
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function() {
				ErrorSrvc.showMessage('Debug snapshot copied.');
			})['catch']($scope.catchUnknown);
		}
		else {
			window.prompt('Copy debug snapshot:', text);
		}
	};

	$scope.resetHelp = function() {
		HelpSrvc.reset();
		ErrorSrvc.showMessage('All help popups will reappear for you.');
	};

	$scope.resetQueries = function() {
		ChatSrvc.resetQueryStorage();
		ErrorSrvc.showMessage('Queries wurden geleert.');
	};

	$scope.showCurrentRooms = function() {
		console.log('DebugCtrl.showCurrentRooms()', RoomSrvc.getRoomsForUser(window.GWF_USER));
	};

	$scope.partAllRooms = function() {
		var rooms = RoomSrvc.getRoomsForUser(window.GWF_USER);
		for (var i in rooms) {
			RoomSrvc.part(rooms[i]).then($scope.updateRooms)['catch']($scope.catchUnknown);
		}
	};

	$scope.debugCommand = function() {
		var gwsMessage = new GWS_Message().cmd(0x0108).sync();
		WebsocketSrvc.sendBinary(gwsMessage).then(function(gwsMessage){
			var text = JSON.parse(gwsMessage);
			ErrorSrvc.showMessage('<h3>Server</h3><pre>'+JSON.stringify(text, null, 2)+'</pre>');
		})['catch']($scope.catchUnknown);
	};

	$scope.logStorage = function() {
		StorageSrvc.logAllToConsole();
	};

	$scope.resetStorage = function() {
		StorageSrvc.flush();
		$scope.refreshDebug();
	};

	$scope.$on('lup-inited', $scope.init);
	$scope.$on('lup-authenticated', $scope.refreshDebug);
	$scope.$on('gws-ws-open', $scope.refreshDebug);
	$scope.$on('gws-ws-close', $scope.refreshDebug);
	$scope.$on('$viewContentLoaded', $scope.init);
});
