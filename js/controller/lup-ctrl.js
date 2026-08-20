/**
 * Base controller that catches some nav/auth/connection events.
 */
angular.module('LUP').
controller('LUPCtrl', function($scope, $rootScope, $q, $timeout, $location, $mdMedia, $mdSidenav, $mdToast, $translate,
		WebsocketSrvc, RequestSrvc, LoadingSrvc, PositionSrvc, ErrorSrvc,
		UserSrvc, RoomSrvc, ChatSrvc, EnumSrvc, TypeSrvc,
		SettingsSrvc, ConfigSrvc, FXSrvc, DialogSrvc,
		CategorySrvc, NotificationSrvc, CountrySrvc, TimezoneSrvc) {
	
	// Hook Services into model globals;
	LUPRoom.ConfigSrvc = ConfigSrvc;
	LUPRoom.PositionSrvc = PositionSrvc;
	LUPRoomVisit.RoomSrvc = RoomSrvc;
	LUPRoomVisit.UserSrvc = UserSrvc;
	LUPNotification['$q'] = $q;
	LUPNotification.RoomSrvc = RoomSrvc;
	LUPNotification.UserSrvc = UserSrvc;
	LUPComment.t = window.t = $translate.instant;
	LUP_Query.UserSrvc = UserSrvc;
	LUP_QueryMessage.UserSrvc = UserSrvc;
	
	window.LUPSERVICE = {
		CountrySrvc: CountrySrvc,
		RoomSrvc: RoomSrvc,
		UserSrvc: UserSrvc,
	};
	
	$scope.V = window.LUP_BUILD;
	$scope.LUP_CONFIG = window.LUP_CONFIG;

	// Hook DialogSrvc in main scope
	$scope.DialogSrvc = DialogSrvc;
	
	// Hook media queries into main scope
	$scope.$mdMedia = $mdMedia;

	// Remember if init was called once.
	$scope.initedOnce = false;
	
	//
	// Warning. Never override $scope.data completely in your controllers.
	// ALWAYS just append, because scope.data is inherited a lot. 
	$scope.data = {
		title: 'LOADING',
		authCheck: true,
		authenticated: false,
		inited: false,
		notificationcount: 0,
		navstack: [],
		initialUrl: null,
	};
	// A notification id is unique. Remembering it prevents duplicate arrival
	// pop-ups if the WebSocket reconnects while the same payload is replayed.
	$scope.friendArrivalShown = {};
	$scope.showFriendArrival = function(notification) {
		if (!notification || notification.type() !== 'join' ||
			$scope.friendArrivalShown[notification.id()]) {
			return;
		}
		var friend = notification.friend;
		var room = notification.room;
		if (!friend || !room || friend.isSelf()) {
			return;
		}
		$scope.friendArrivalShown[notification.id()] = true;
		var toast = $mdToast.simple()
			.toastClass('lup-friend-arrival-toast')
			.textContent(friend.displayName() + ' ist jetzt bei ' + room.name())
			.action('Ansehen')
			.highlightAction(true)
			.hideDelay(6500)
			.position('top right');
		$mdToast.show(toast).then(function(response) {
			if (response === 'ok') {
				$scope.gotoRoom(room);
			}
		});
	};
	
	/////////////////
	// Alert Badge //
	/////////////////
	/**
	 * Update the topnav/notifications icon by setting notificatincount > 0
	 */
	$rootScope.updateNotificationCount = function() {
		let count = 0;
		
		count += NotificationSrvc.unreadNotificationCount(); // Add Notifications
		
		count += ChatSrvc.unreadMessages(); // Add PM/Query Messages
		
		$scope.data.notificationcount = count;
	
		console.log('$rootScope.updateNotificationCount()', count);
	};
	
	////////////////////////
	// --- Init chain --- //
	////////////////////////
	/**
	 * 1. Check server for cookie.
	 */
	$scope.initConnection = function(count, attempt) {
		console.log('LUPCtrl.initConnection()');
		$scope.data.initialUrl = window.location.hash.substr(2);
		$scope.data.inited = false;
		console.log('LUPCtrl.initConnection()', count, $scope.data.initialUrl);
		attempt = attempt || 0;
		return RequestSrvc.sendGWF('Websocket', 'GetSecret&count='+(count||0)).then(
			$scope.gotCookie,
			function(error) {
				// A fresh page can briefly race Apache/session setup or a just restarted
				// WebSocket service. Do not strand the user on failure.html for that.
				if (attempt < 2) {
					console.warn('LinkUUp: startup request failed, retrying.', error);
					return $timeout(function() {
						return $scope.initConnection(count, attempt + 1);
					}, 700 * (attempt + 1));
				}
				return $scope.fatalError();
			});
	};
	
	$scope.fatalError = function() {
		console.log('LUPCtrl.fatalError()');
		console.trace();
		/* A momentary service or session race must never strand somebody on the
		 * static failure page. The next normal screen is the login route, where
		 * the connection can be established again without losing the application
		 * shell or requiring a browser restart. */
		$scope.gotoLogin();
		return $q.resolve();
	};
	
	/**
	 * 2. Check for GeoPosition + Websocket.
	 */
	$scope.gotCookie = function(response) {
		console.log('LUPCtrl.gotCookie()', response);
		// Set user values
		LUP_CONFIG.cookie = response.data.data.secret;
		LUP_CONFIG.ws_secret = response.data.data.secret;
		$scope.setCookie(LUP_CONFIG.ws_secret, response.data.data.cookie);
		if (window.LUP_CONFIG.ws_secret === 'GDO_like_16_byte') {
			console.log('GOT resend. Trying again to get a cookie');
			if (response.data.data.count === 0) {
				$scope.initConnection(1);
			}
			else {
				ErrorSrvc.showError($translate.instant('err_no_cookie'));
				$scope.fatalError();
			} 
		}
		else {
			GWF_USER = new GWF_User(response.data.data.user);
			$scope.data.user = GWF_USER;
			$scope.data.ownUser = GWF_USER;
			$scope.data.authenticated = GWF_USER.authenticated(true);
			console.log('Got user', GWF_USER);
			UserSrvc.CACHE[GWF_USER.id()] = GWF_USER;
			
			// Init
			$scope.setupGPSFaker();

			// Connect chain
			var timezone = TimezoneSrvc.withTimezoneFor(window.GWF_USER);
			// Timezone is supplementary profile data. It must never block the whole
			// app from opening when the browser or a background request stalls.
			timezone['catch'](function(error) {
				console.warn('Timezone unavailable; continuing application startup.', error);
			});
			var connection = WebsocketSrvc.connect();
			connection['catch']($scope.failedConnection);
			// One shared startup probe makes the distance labels available as soon
			// as the discovery view renders. PositionSrvc deduplicates this request,
			// so navigating through the app cannot create additional prompts.
			var position = PositionSrvc.probe();
			// GPS is useful for nearby rooms, but a temporary browser timeout must
			// never abort the whole application or throw the user back to login.
			// PositionSrvc will retry through its normal refresh cycle.
			position['catch'](function(error) {
				console.warn('LinkUUp: initial GPS position unavailable; continuing.', error);
				return null;
			});
			var types = TypeSrvc.withTypes();
			types['catch']($scope.failedTypes);
			var enums = EnumSrvc.withEnums();
			enums['catch']($scope.failedTypes);
			var config = ConfigSrvc.withConfig();
			config['catch']($scope.failedTypes);
			var settings = SettingsSrvc.withConfig();
			settings['catch']($scope.failedTypes);
			var categories = CategorySrvc.withCategories();
			categories['catch']($scope.failedCategories);
			// All at once
			$q.all([connection, types, enums, config, settings, categories]).then(
					$scope.initedConnection,
					$scope.fatalError);
		}
	};

	$scope.setCookie = function(cookie, name) {
		console.log('LUPCtrl.setCookie()', cookie);
		cookie = name + "=" + cookie + "; path=/; domain=" + LUP_CONFIG.server_domain;
		console.log('LUPCtrl.setCookie()', cookie);
		document.cookie = cookie;
	};
	
	$scope.setupGPSFaker = function() {
		console.log('LUPCtrl.setupGPSFaker()', window.LUP_CONFIG.positionPatch);
		if (window.LUP_CONFIG.positionPatch) {
			var p = window.LUP_CONFIG.positionPatch;
			PositionSrvc.startPatching(p.lat, p.lng);
		}
	};
	
	$scope.failedConnection = function(error) {
		console.log('LUPCtrl.failedConnection()', error);
		return ErrorSrvc.showError($translate.instant('err_websocket_connection'), 'Connection').then(function() {
			$scope.fatalError().
				then($scope.gotoLogin);
		});
	};
	
	$scope.failedTimezone = function(error) {
		console.log('LUPCtrl.failedTimezone()', error);
		return ErrorSrvc.showError("Ihre Zeitzone wurde nicht ermittelt: " + error.message, 'Timezone').
			then(function(){
				$scope.gotoLogin();
			});
	};
	
	$scope.failedPosition = function(error) {
		console.log('LUPCtrl.failedPosition()', error);
		var key = 'err_position_unavailable';
		if (error && error.code === PositionSrvc.PERMISSION_DENIED) {
			key = 'err_position_permission_denied';
		}
		else if (error && error.code === PositionSrvc.TIMEOUT) {
			key = 'err_position_timeout';
		}
		return ErrorSrvc.showError($translate.instant(key), 'Position').
			then(function(){
				$scope.gotoLogin();
				throw "GPS Error";
			});
	};
	
	$scope.failedTypes = function(error) {
		$scope.fatalError();
	};

	$scope.failedCategories = function(error) {
		$scope.fatalError();
	};

	/**
	 * 4. Redirect to page depending on user state.
	 */
	$scope.initedConnection = function() {
		console.log('LUPCtrl.initedConnection()', window.GWF_USER);
		var finished = false;
		var finish = function() {
			if (finished) {
				return;
			}
			finished = true;
			$scope.data.inited = true;
			// Begin fetching locations before the visitor opens the discovery view.
			// The locations controller reuses this promise, so the first visit is as
			// quick as returning from the profile screen without duplicate traffic.
			RoomSrvc.withRooms().then(function(rooms) {
				$scope.data.rooms = rooms;
				// The discovery page may already be open while this background
				// request resolves. Tell it to initialise its carousel immediately.
				$rootScope.$broadcast('lup-rooms-ready', rooms);
				// Keep the first category tap instant.  This deliberately starts only
				// after the nearby start view is ready, so it never delays the app.
				$timeout(function() {
					RoomSrvc.withRooms(true).then(function(allRooms) {
						$scope.data.fullCatalogue = allRooms;
					}, function(error) {
						console.warn('LinkUUp: discovery catalogue preload failed.', error);
					});
				}, 900, false);
			}, function(error) {
				console.warn('LinkUUp: location preload failed; it will retry on opening the view.', error);
			});
			// The app is usable once the authenticated user is available. A stale
			// optional background task must never keep the whole interface covered
			// by the loading screen after a data reinstall.
			LoadingSrvc.stopTasks();
			GWFPagination.IPP = ConfigSrvc.ipp();
			$scope.doAuthCheck();
		};
		UserSrvc.withUser(window.GWF_USER.id(), true).then(finish, function(error) {
			console.warn('LUP: Could not refresh the current user; continuing with the authenticated session.', error);
			finish();
		});
	};
	
	/////////////////
	// --- GPS --- //
	/////////////////
	$scope.withPosition = function(silent) {
		console.log('LUPCtrl.withPosition()');
		return PositionSrvc.probe().then(function(pos){
//			PositionSrvc.start();
			$scope.updatePosition(pos);
		}, silent ? function(error) { return $q.reject(error); } : $scope.failedPosition);
	};
	
	$scope.updatePosition = function(pos) {
		console.log('LUPCtrl.updatePosition()', pos);
		if ($scope.authenticated()) {
			var gwsMessage = new GWS_Message().cmd(0x1112).writeFloat(pos.lat).writeFloat(pos.lng);
			return WebsocketSrvc.sendBinary(gwsMessage);
		}
	};
	
	////////////////////////////
	// --- Event handlers --- //
	////////////////////////////
	/**
	 * Websocket close shows error.
	 */
	$scope.$on('gws-ws-close', function(event) {
		console.log('LUPCtrl.$on-gws-ws-close', event);
		$scope.data.inited = false;
		ErrorSrvc.showError('Connection Failed', 'Websocket').then(function() {
//			$scope.gotoLogin();
			setTimeout($scope.initConnection, 500);
		});
	});
	
	/**
	 * When authenticated, show locations.
	 */
	$rootScope.$on('lup-authenticated', function(event) {
		console.log('LUPCtrl.$on-lup-authenticated');
		$scope.onAuthenticated();
	});
	
	$scope.onAuthenticated = function() {
		console.log('LUPCtrl.onAuthenticated()');
		$scope.clearCache();
		$scope.data.user = window.GWF_USER;
		$scope.data.ownUser = window.GWF_USER;
		$scope.data.authenticated = window.GWF_USER.authenticated(true);
		UserSrvc.loggedIn(window.GWF_USER);
		$rootScope.$broadcast('lup-menu-refresh', window.GWF_USER);
		SettingsSrvc.withConfig().then(function(){
			if ($scope.data.initialUrl?.includes('login') || $scope.data.initialUrl === '/signup') {
				$scope.data.initialUrl = '/locations';
			}
			var path = $scope.data.initialUrl ? $scope.data.initialUrl : '/locations';
			$scope.data.initialUrl = undefined;
			console.log('redirects to ' + path);
			$location.path(path);
		});
	};
	
	//////////////////////
	// --- Sidebars --- //
	//////////////////////
	$scope.openLeft = function() { $mdSidenav('left').open(); };
	$scope.closeLeft = function() { $mdSidenav('left').close(); };

	/////////////////////
	// --- Routing --- //
	/////////////////////
	$scope.isLoading = function() {
		// The full-screen loader belongs only to the initial connection. Once the
		// app has an authenticated session, optional requests must stay local to
		// their view and may never block navigation or the complete interface.
		return !$scope.data.inited && LoadingSrvc.isLoading();
	};

	/** These 3 are subject to be removed soon **/
	$scope.gotoHome = function() { $scope.goto('/home'); };
	$scope.gotoDebug = function() { $scope.goto('/debug'); };
	$scope.gotoBackend = function() { window.location.href = window.LUP_CONFIG.server; };
	$scope.gotoAddRoom = function() {
		if (!window.GWF_USER.isVIP()) {
			return ErrorSrvc.showError($translate.instant('ERR_VIP_ONLY'), $translate.instant('TITLE_ADD_ROOM'));
		}
		window.location.href = window.LUP_CONFIG.server + '/index.php?mo=LinkUUp&me=AddRoom';
	};
	$scope.gotoNavpage = function() { $scope.goto('/navigate'); };
	$scope.gotoCityMap = function() { $scope.goto("/citymap"); };

	$scope.gotoTOS = function() { return DialogSrvc.openTermsOfService(); };
	$scope.gotoPrivacy = function() { return DialogSrvc.openPrivacyInformation(); };
	$scope.gotoImpressum = function() { return DialogSrvc.openImpressum(); };

	$scope.gotoLogin = function() { return $scope.goto('/login'); };
	$scope.gotoRegister = function() { return $scope.goto('/signup'); };
	$scope.gotoRecovery = function() { return $scope.goto('/recovery'); };
	$scope.gotoRooms = function() { return $scope.goto('locations'); };
	$scope.gotoNearbyRooms = function() { return $scope.goto('locations'); };
	$scope.gotoRoom = function(room) { return $scope.goto("/location/"+room.id()); };
	$scope.gotoRoomId = function(roomId) { return $scope.goto("/location/"+roomId); };
	$scope.gotoChat = function(room) { return $scope.goto("/location/"+room.id()+'/chat'); };
	$scope.gotoVisitors = function(room) { return $scope.goto("/location/"+room.id()+'/visitors'); };
	$scope.gotoRoomComments = function(room) { return $scope.goto('/location/'+room.id()+'/comments'); };
	$scope.gotoAccount = function() { return $scope.goto("/account"); };
	$scope.gotoQuery = function(user) { return $scope.goto("/query/"+user.id()); };
	$scope.gotoProfile = function(user) { return $scope.goto("/profile/"+user.id()); };
	$scope.gotoProfileId = function(userId) { return $scope.goto("/profile/"+userId); };
	$scope.gotoFriends = function(user) { return $scope.goto("/friends/"+user.id()); };
	$scope.gotoLikes = function(user) { return $scope.goto("/likes/"+user.id()); };
	$scope.gotoOwnProfile = function() { return $scope.gotoProfile(window.GWF_USER); };
	$scope.gotoProfileSettings = function() { return $scope.goto('/settings'); };
	$scope.gotoSettings = function() { return $scope.goto('/settings'); };
	$scope.gotoSearch = function() { return $scope.goto('/search'); };
	$scope.gotoNotification = function() { return $scope.goto('/notifications'); };
	$scope.gotoCourse = function(user) { return $scope.goto('/course/'+user.id()); };
	$scope.gotoCuddles = function(user) { return $scope.goto('/cuddles/'+user.id()); };
	$scope.goto = function(url) {
		console.log('LUPCtrl.goto()', url);
		$scope.closeLeft();
		var defer = $q.defer();
		setTimeout(function(){
			$location.path(url);
			defer.resolve();
			$scope.$apply();
		}, 1);
		return defer.promise;
	};

	$scope.gotoReferrer = function() {
		console.log('LUPCtrl.gotoReferrer()', $scope.data.navstack);
		if ($scope.data.navstack.length <= 1) {
			$scope.gotoRooms();
		}
		else {
			var url = $scope.data.navstack.pop();
			url = $scope.data.navstack.pop();
			window.history.back();
//			$scope.goto(url);
		}
	};
	
	$scope.logout = function() {
		console.log('LUPCtrl.logout()');
		UserSrvc.logout().then(function(){
			$scope.clearCache();
			$scope.data.authenticated = false;
			$scope.gotoLogin();
		});
	};
	
	$scope.clearCache = function() {
		console.log('LUPCtrl.clearCache()');
		UserSrvc.CACHE = {};
		RoomSrvc.CACHE = {};
		// The discovery catalogue contains room models from the previous session.
		// Do not retain it across logout or a newly authenticated account.
		RoomSrvc.ALL_ROOMS = null;
		RoomSrvc.ALL_ROOMS_LOADING = null;
		$scope.data.fullCatalogue = null;
		SettingsSrvc.CACHE = null;
		$rootScope.$broadcast('lup-clear-cache');
	};

	$scope.scrollToTop = function() {
		console.log('LUPCtrl.scrollToTop()');
		var body = $(".user-profile-page");
		body.animate({scrollTop:0}, '500');
	};	
	
	////////////////////////
	// --- Start init --- //
	////////////////////////
	$scope.initConnection();

	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('$routeChangeStart', function(event, route) {
		if (route.$$route) {
			console.log('LUPCtrl.$on-$routeChangeStart()', route.$$route.originalPath, event, route);
			$scope.data.authCheck = route.$$route.params.authCheck;
			if ($scope.data.inited) {
				$scope.doAuthCheck();
			}
		}
	});
	$scope.$on('$locationChangeSuccess', function(event, url) {
		$scope.data.navstack.push(url);
		PositionSrvc.refresh();
//		console.log('LUPCtrl.$on-$$locationChangeSuccess()', $scope.data.navstack);
	});

	
	$scope.$on('$viewContentLoaded', function(event) {
		console.log('LUPCtrl.$on-$viewContentLoaded()', event);
//		$scope.doAuthCheck();
	});
	// Keep distance labels current while the user moves through the app. The
	// service throttles this, so fast taps or a swipe never start GPS spam.
	var refreshPositionAfterInteraction = function() {
		PositionSrvc.refresh();
	};
	angular.element(document).on('pointerup.lupPosition touchend.lupPosition focus.lupPosition', refreshPositionAfterInteraction);
	$scope.$on('$destroy', function() {
		angular.element(document).off('.lupPosition');
	});

	var roomRefreshTimer = null;
	$scope.refreshRoomsForPosition = function() {
		if (!$scope.data.inited) {
			return;
		}
		if (roomRefreshTimer) {
			$timeout.cancel(roomRefreshTimer);
		}
		roomRefreshTimer = $timeout(function() {
			roomRefreshTimer = null;
			RoomSrvc.withRooms().then(function(rooms) {
				$scope.data.rooms = rooms;
				$rootScope.$broadcast('lup-rooms-ready', rooms);
			}, function(error) {
				console.warn('LinkUUp: nearby location refresh failed.', error);
			});
		}, 250);
	};
	
	$scope.$on('gwf-position-changed', function(event, pos) {
		console.log('LUPCtrl.$on-gwf-position-changed()', pos);
		$scope.updatePosition(pos);
		$scope.refreshRoomsForPosition();
	});
	
	////////////////////////
	// --- Auth Check --- //
	////////////////////////
	$scope.doAuthCheck = function() {
		console.log('LUPCtrl.doAuthCheck()', $scope.data);
		if ($scope.data.inited) {
			if ($scope.data.authCheck) {
				// $scope.authCheck();
				setTimeout($scope.authCheck, 1);
			}
			else if (window.GWF_USER.authenticated(true)) {
				$scope.passedAuthCheck();
				$location.path('/locations');
			}
			else if (!$scope.data.authCheck) {
				// Login, Signup, etc do not authenticate. they are inited here.
				if (!$scope.initedOnce) {
					$scope.initedOnce = true;
					$scope.$broadcast('lup-inited');
				}
			}
		}
	};
	
	$scope.passesAuthCheck = function() {
		var perm = $scope.data.authCheck;
		var result = false;
		if (perm === true) {
			result = window.GWF_USER.authenticated(true);
		}
		else if (perm === 'debug') {
			result = !!window.LUP_CONFIG.debug;
		}
		else if (perm === 'member') {
			result = window.GWF_USER.authenticated(false);
		}
		else {
			result = window.GWF_USER.hasPermission(perm);
		}
		console.log('$scope.passesAuthCheck()', window.GWF_USER, perm, result);
		return result;
	};
	
	$scope.passedAuthCheck = function() {
		console.log('LUPCtrl.passedAuthCheck()');
		$scope.data.authenticated = true;
		var initialize = function() {
			if (!$scope.initedOnce) {
				console.log('LUPCtrl.passedAuthCheck() broadcasts init...');
				$scope.initedOnce = true;
				$scope.$broadcast('lup-inited');
			}
		};
		// Opening the app must not wait for the browser's GPS retry cycle (which
		// can take minutes if permission is undecided). GPS continues in the
		// background; discovery starts immediately and can use its safe fallback.
		initialize();
		$scope.withPosition(true)['catch'](function(error) {
			console.warn('LinkUUp: GPS unavailable during startup.', error);
		});
	};
	
	$scope.authCheck = function() {
		console.log('LUPCtrl.authCheck()', window.GWF_USER);
		$scope.data.authenticated = false;
		if ($scope.passesAuthCheck()) {
			$scope.passedAuthCheck();
		}
		else {
			$scope.gotoLogin();
		}
	};
	
	/**
	 * Check if a user is already authenticated.
	 * It also returns true for guestusers who chose a nick already.
	 * @return boolean
	 */
	$scope.authenticated = function() {
		var result = window.GWF_USER && window.GWF_USER.authenticated(true);
		console.log('LUPCtrl.authenticated()', result, window.GWF_USER);
		return result;
	};
	
	$scope.hasPermission = function(permission) {
		var result = window.GWF_USER && window.GWF_USER.hasPermission(permission);
//		console.log('LUPCtrl.hasPermission()', permission, result);
		return result;
	};
	
	$scope.isGuest = function() {
		var result = window.GWF_USER.isGuest();
		console.log('LUPCtrl.isGuest()', result);
		return result;
	};
	
	//
	$scope.$on('lup-inited', function(event) {
		console.log('LUPCtrl$lup-inited()', event);
		NotificationSrvc.queryUnreadNotificationCount().then(
				$scope.updateNotificationCount);
	});
	
	/////////////////////////////
	// --- Async WS Events --- //
	/////////////////////////////
	$scope.$on('gws-ws-message', function(event, gwsMessage) {
		var cmd = sprintf('cmd_%04X', gwsMessage.readCmd());
		console.log('LUPCtrl.$on-gws-ws-message()', cmd, gwsMessage);
		if ($scope[cmd]) {
			$scope[cmd](gwsMessage);
			$scope.$apply();
		}
		else {
			console.error('Missing command: '+cmd);
		}
	});

	$scope.cmd_0601 = function friendRequest(gwsMessage) {
		console.log('LUPCtrl.friendRequest()', gwsMessage.dump());
		UserSrvc.withUser(gwsMessage.read32()).then(function(user){
			alert('You got a friend request from ' + user.displayName());
		});
	};

	
	$scope.cmd_1103 = function userJoined(gwsMessage) {
		console.log('LUPCtrl.userJoined()', gwsMessage.dump());
		var time = gwsMessage.read32();
		var room = RoomSrvc.getOrCreate(gwsMessage.read32());
		var user = UserSrvc.getOrCreate(gwsMessage.read32());
		room.addUser(user);
		var message = room.addMessage(time, user, room, $translate.instant('has joined'), true);
		$rootScope.$broadcast('lup-room-message', room, message);
	};
	
	$scope.cmd_1104 = function userLeft(gwsMessage) {
		console.log('LUPCtrl.userLeft()', gwsMessage.dump());
		var time = gwsMessage.read32();
		var room = RoomSrvc.getOrCreate(gwsMessage.read32());
		var user = UserSrvc.getOrCreate(gwsMessage.read32());
		room.removeUser(user);
		var message = room.addMessage(time, user, room, $translate.instant('has left'), true);
		$rootScope.$broadcast('lup-room-message', room, message);
	};
	
	$scope.cmd_1105 = function userList(gwsMessage) {
		console.log('LUPCtrl.userList()', gwsMessage.dump());
		var room = RoomSrvc.getOrCreate(gwsMessage.read32());
		// This is a complete snapshot from the server, not a delta.
		room.USERS = [];
		while (gwsMessage.hasMore()) {
			var user = UserSrvc.getOrCreate(gwsMessage.read32());
			room.addUser(user);
		}
	};
	
	$scope.cmd_1106 = function userData(gwsMessage) {
		console.log('LUPCtrl.userData()', gwsMessage.dump());
		UserSrvc.gotUserMessage(gwsMessage);
	};
	
	$scope.cmd_1107 = function chatMessage(gwsMessage) {
		console.log('LUPCtrl.chatMessage()', gwsMessage.dump());
		var time = gwsMessage.read32();
		var user = UserSrvc.getOrCreate(gwsMessage.read32());
		var room = RoomSrvc.getOrCreate(gwsMessage.read32());
		room.addUser(user);
		var message = room.addMessage(time, user, room, gwsMessage.readString());
		FXSrvc.onChat(user, room);
		$rootScope.$broadcast('lup-room-message', room, message);
	};

	$scope.cmd_1108 = function queryMessage(gwsMessage) {
		console.log('LUPCtrl.queryMessage()', gwsMessage);
		var message = ChatSrvc.loadMessage(gwsMessage);
		var chat = ChatSrvc.forMessage(message);
		chat.addNewMessage(message);
		$rootScope.updateNotificationCount();
		FXSrvc.onQuery(message);
		$rootScope.$broadcast('lup-query-message', message);
	};
	
	$scope.cmd_1109 = function queryMessageRead(gwsMessage) {
		console.log('LUPCtrl.queryMessageRead()', gwsMessage);
		var message = ChatSrvc.parseQueryMessageRead(gwsMessage);
		$rootScope.updateNotificationCount();
	};

	$scope.cmd_1110 = function userStatusChanged(gwsMessage) {
		console.log('LUPCtrl.userStatusChanged()', gwsMessage.dump());
		var user = UserSrvc.getOrCreate(gwsMessage.read32());
		user.JSON.lup_status = gwsMessage.readString();
	};
	
	/**
	 * A single notification arrived.
	 */
	$scope.cmd_1141 = function notificationArrived(gwsMessage) {
		console.log('LUPCtrl.notificationArrived()', gwsMessage.dump());
		// Get parsed instance
		var notification = NotificationSrvc.parseNotification(gwsMessage, true);
		if (notification && notification.type() === 'join') {
			var ready = notification.resolved;
			if (ready && angular.isFunction(ready.then)) {
				ready.then($scope.showFriendArrival);
			}
		}
		// Update cache
		NotificationSrvc.resort();
		// Announce via FX module
		FXSrvc.onNotification(notification);
		// Broadcast as event?
		$scope.$broadcast('lup-notification', notification);
		// Update Pöppel
		$rootScope.updateNotificationCount();
	};

	/**
	 * A user has changed their avatar.
	 */
	$scope.cmd_0401 = function avatarSet(gwsMessage) {
		console.log('LUPCtrl.avatarSet()', gwsMessage.dump());
		$scope.cmd_0402(gwsMessage);
	};

	/**
	 * A user has changed their avatar.
	 */
	$scope.cmd_0402 = function avatarUpdate(gwsMessage) {
		console.log('LUPCtrl.avatarUpdate()', gwsMessage.dump());
		// only update known users
		var user = UserSrvc.getUser(gwsMessage.read32());
		console.log('LUPCtrl.avatarUpdate()', user);
		if (user) {
			var avatarFileId = gwsMessage.read32();
			console.log('LUPCtrl.avatarUpdate()', avatarFileId);
			user.JSON.avatar_version = avatarFileId;
		}
	};
	
	/**
	 * Avatar upload
	 * XXX: Move to profile
	 */
	// LUP_CONFIG.server already ends in a slash. A second slash sends Flow to a
	// different backend URL on the local reverse proxy, so the websocket cannot
	// find the completed upload afterwards.
	$scope.data.avatarAction = window.LUP_CONFIG.server + "index.php?_mo=Avatar&_me=Upload&_ajax=1&_fmt=json&_cors=" + encodeURIComponent(window.LUP_CONFIG.cors);

	/**
	 * Hook main ctrl into window.
	 */
	window.scope = $scope;
	window.rootScope = $rootScope;
});
