"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/location/:id', {
		templateUrl: 'js/pages/location/html/lup-location.html?v='+window.LUP_BUILD,
		controller: 'LocationCtrl',
		params: {
			authCheck: true,
			gotoTab: 0,
		}
	});
	$routeProvider.when('/location/:id/chat', {
		templateUrl: 'js/pages/location/html/lup-location.html?v='+window.LUP_BUILD,
		controller: 'LocationCtrl',
		params: {
			authCheck: true,
			gotoTab: 1,
		},
	});
	$routeProvider.when('/location/:id/visitors', {
		templateUrl: 'js/pages/location/html/lup-location.html?v='+window.LUP_BUILD,
		controller: 'LocationCtrl',
		params: {
			authCheck: true,
			gotoTab: 2,
		},
	});
}).controller('LocationCtrl', function($scope, $location, $route, $routeParams, $mdDialog, $translate, $timeout,
		RoomSrvc, CommentSrvc, ChatSrvc, UserSrvc, AuthSrvc, LikeSrvc, FriendSrvc,
		WebsocketSrvc, ErrorSrvc, DialogSrvc, HelpSrvc, PositionSrvc) {
	
	$scope.LikeSrvc = LikeSrvc;
	$scope.FriendSrvc = FriendSrvc;
	
	$scope.data.room = $scope.data.room||RoomSrvc.BLANK_ROOM;
	$scope.data.message = '';
	$scope.data.topComments = $scope.data.topComments || [];
	$scope.data.selectedTab = $scope.data.selectedTab || 0;
	$scope.data.selectedTab2 = $scope.data.selectedTab2 || 0;
	$scope.data.manualLocationTab = false;
	$scope.data.rating = 3;
	$scope.data.commentText = '';
	$scope.data.commentInput = '';
	$scope.data.showInput = true;
	var visitorCache = {source: null, signature: '', users: []};
	
	$scope.init = function() {
		console.log('LocationCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.user = GWF_USER;
			RoomSrvc.withRoom($routeParams.id).then($scope.loadedRoom)['catch']($scope.catchUnknown);
			$scope.data.topComments = $scope.data.topComments || [CommentSrvc.BLANK_COMMENT()];
			HelpSrvc.showHelp('help_location', $translate.instant('HELP_LOCATION'));
		}
	};
	
	$scope.loadedRoom = function(room) {
		console.log('LocationCtrl.loadedRoom()', room);
		$scope.data.room = room;
		$scope.afterLoadedRoom();
	};
	
	$scope.inChatRange = function() {
		return !!($scope.data.room && $scope.data.room.inChatRange && $scope.data.room.inChatRange());
	};

	$scope.headerRoomName = function() {
		var name = $scope.data.room && $scope.data.room.name ? $scope.data.room.name() : '';
		if (!name) {
			return '';
		}
		// Test rooms such as "Braunschweig Chat" are named for the chat, but
		// an out-of-range visitor is only viewing the place and its comments.
		return $scope.inChatRange() ? name : name.replace(/\s+Chat$/i, '');
	};

	// A room without an individually supplied photo must not inherit the generic
	// Braunschweig artwork. The detail hero uses the room's own category instead.
	$scope.locationVisual = function(room) {
		var visuals = {
			'1': {icon:'public', class:'location-category-country'},
			'2': {icon:'location_city', class:'location-category-city'},
			'3': {icon:'local_bar', class:'location-category-bar'},
			'4': {icon:'sports_bar', class:'location-category-bar'},
			'5': {icon:'local_cafe', class:'location-category-cafe'},
			'11': {icon:'nightlife', class:'location-category-club'},
			'12': {icon:'theater_comedy', class:'location-category-culture'},
			'13': {icon:'sports_soccer', class:'location-category-sport'},
			'14': {icon:'restaurant', class:'location-category-food'},
			'15': {icon:'park', class:'location-category-outdoors'},
			'16': {icon:'school', class:'location-category-education'},
			'17': {icon:'account_balance', class:'location-category-education'},
			'18': {icon:'local_hospital', class:'location-category-health'},
		};
		var category = room && room.category ? room.category() : null;
		return visuals[String(category)] || {icon:'place', class:'location-category-default'};
	};

	// City and country rooms are regional conversations, not a single physical
	// doorstep. Venue-only QR Cuddles and directions stay reserved for places.
	$scope.isRegionalRoom = function(room) {
		var category = Number(room && room.category && room.category());
		return category === 1 || category === 2;
	};

	$scope.showNearbyLocations = function() {
		return $location.path('/locations');
	};
	
	$scope.afterLoadedRoom = function() {
		console.log('LocationCtrl.afterLoadedRoom()', $scope.data.room.id());
		/* Do not read the tab from Angular's internal route object.  That object
		 * is rebuilt while a room payload arrives and can lose our custom
		 * `gotoTab` value.  Reading the actual route keeps Chat/Online selected
		 * after the asynchronous room request has completed. */
		var currentPath = $location.path();
		var requestedTab = /\/chat$/.test(currentPath) ? 1 :
			(/\/visitors$/.test(currentPath) ? 2 : 0);
		var applyTab = function() {
			/* A person can select Online while the room request is still in flight.
			 * In that case the route is still /location/:id (gotoTab 0), so never
			 * overwrite their deliberate selection with the route's default tab. */
			if (requestedTab === 0 && $scope.data.manualLocationTab) {
				return;
			}
			var tab = requestedTab;
			/* Reading who is visibly present is an information view. Only Chat is
			 * access-controlled by the physical radius; otherwise Online visibly
			 * opens and then gets reset to Location after the room payload arrives. */
			if (tab === 1 && !$scope.inChatRange()) {
				tab = 0;
			}
			$scope.data.selectedTab = tab;
			$scope.data.selectedTab2 = tab;
		};

		/* Do not briefly render Online and then kick the person back to Location
		 * while the browser is still resolving GPS.  A requested chat/online tab
		 * now waits for that one decisive position result; range protection stays
		 * exactly as strict once a position is known or denied. */
		if (requestedTab === 1 && !PositionSrvc.hasPosition(true)) {
			PositionSrvc.probe().then(applyTab, applyTab)['catch']($scope.catchUnknown);
		}
		else {
			applyTab();
		}

		$scope.loadTopComments();
		CommentSrvc.withOwnComment($scope.data.room).
			then($scope.loadedOwnComment)['catch']($scope.catchUnknown);
	};
	
	$scope.loadTopComments = function() {
		return CommentSrvc.withTopComments($scope.data.room).then($scope.loadedTopComments)['catch']($scope.catchUnknown);
	};
	
	$scope.loadedOwnComment = function(gwsMessage) {
		console.log('LocationCtrl.loadedOwnComment()', gwsMessage.dump());
		var ownComment = CommentSrvc.parseOwnCommentMessage(gwsMessage);
		if (!ownComment) {
			return;
		}
		$scope.data.rating = ownComment.rating;
		$scope.data.commentText = ownComment.commentText;
		$scope.data.commentInput = ownComment.commentInput;
		$scope.data.likes = ownComment.likes;
	};
	
	$scope.saveComment = function() {
		console.log('LocationCtrl.saveComment()');
		CommentSrvc.saveComment($scope.data.room, $scope.data.commentInput).
			then($scope.savedComment, ErrorSrvc.websocketFormError)['catch']($scope.catchUnknown);
	};
	
	$scope.savedComment = function() {
		console.log('LocationCtrl.savedComment()');
		$scope.data.showInput = false;
		// Refresh comments and the aggregate rating immediately after saving.
		// The vote response updates the server immediately. Force a fresh room
		// payload here instead of reusing the previous card from the local cache,
		// otherwise the visible vote counter can remain at its old value.
		return RoomSrvc.withRoom($scope.data.room.id(), true).then(function(room) {
			$scope.data.room = room;
			return $scope.loadTopComments();
		}).then(function() {
			return CommentSrvc.withOwnComment($scope.data.room);
		}).then($scope.loadedOwnComment).then(function() {
			return ErrorSrvc.showMessage("Deine Stimme wurde aktualisiert.", "Danke");
		})['catch']($scope.catchUnknown);
	};

	$scope.loadedTopComments = function(topComments) {
		console.log('LocationCtrl.loadedTopComments()', topComments);
		$scope.data.topComments = topComments.length ? topComments : [CommentSrvc.BLANK_COMMENT()];
	};
	
	$scope.gotoComments = function(room) {
		console.log('LocationCtrl.gotoComments()', room);
		$location.path("/location/"+room.id()+"/comments");
	};

	/* A location cuddle is intentionally verified at the physical place.  The
	 * dialog explains the QR step; it does not pretend that a local click has
	 * already produced a counted cuddle. */
	$scope.showLocationCuddle = function(event) {
		if (event) {
			event.stopPropagation();
		}
		return DialogSrvc.confirm('js/pages/locations/lup-location-cuddle-dialog.html', {
			room: $scope.data.room,
		});
	};

	/* The field is optional until QR-confirmed venue cuddles are stored by the
	 * backend. Returning zero is intentional: a missing server value must never
	 * be replaced with visitor counts or a decorative number. */
	$scope.roomCuddles = function(room) {
		return Math.max(0, Number(room && room.JSON && room.JSON.room_cuddles) || 0);
	};

	$scope.ratingTier = function(rating) {
		rating = Number(rating) || 0;
		if (rating >= 10) { return 'crystal'; }
		if (rating >= 8) { return 'azure'; }
		if (rating >= 5) { return 'gold'; }
		if (rating >= 3) { return 'amber'; }
		return 'ember';
	};

	//////////////////
	// --- Vote --- //
	//////////////////
	$scope.onVoteDialog = function(event) {
		console.log('LocationCtrl.onVoteDialog()');
		var room = $scope.data.room;
		var oldRating = $scope.data.rating;
		var oldComment = $scope.data.commentInput;
		var scope = $scope;
		
		var DialogController = ['$scope', '$mdDialog', function($scope, $mdDialog) {
			$scope.room = room;
			$scope.data = {};
			$scope.data.rating = oldRating;
			$scope.data.comment = oldComment;
			$scope.scope = scope;
			$scope.cancel = function() {
				$mdDialog.cancel();
			};
			$scope.vote = function() {
				$mdDialog.cancel();
				scope.onRoomVoteComment($scope.data.rating, $scope.data.comment);
			};
		}];
		
		// Return promise
		return $mdDialog.show({
			controller: DialogController,
			templateUrl: 'js/dialogs/lup-room-vote-dialog.html?v='+window.LUP_BUILD,
			parent: angular.element(document.body),
			targetEvent: event,
			clickOutsideToClose:true,
//			fullscreen: true, //$scope.customFullscreen // Only for -xs, -sm breakpoints.
		}).catch(function(reason) {
			// Angular Material resolves a normal close with an undefined reason.
			// Do not turn that into a false console error.
			if (reason) {
				console.error('Location vote dialog could not open', reason);
			}
		});

	};

	$scope.onRoomVoteComment = function(rating, commentText) {
		console.log('LocationCtrl.onRoomVoteComment()', rating, commentText);
		$scope.data.rating = rating;
		$scope.data.commentInput = commentText;
		return $scope.onVoteRoom(rating).then(function() {
			return CommentSrvc.saveComment($scope.data.room, commentText);
		}).then($scope.savedComment, ErrorSrvc.websocketError)['catch']($scope.catchUnknown);
	};
	

	$scope.onVoteRoom = function(rating) {
		console.log('LocationCtrl.onVoteRoom()', rating);
		var roomId = $scope.data.room.id();
		var gwsMessage = new GWS_Message().cmd(0x1120).sync().write32(roomId).write8(rating);
		return WebsocketSrvc.sendBinary(gwsMessage).then($scope.onVoted, ErrorSrvc.websocketJSONError)['catch']($scope.catchUnknown);
	};
	
	$scope.onVoted = function(gwsMessage) {
		console.log('LocationCtrl.onVoted()', gwsMessage);
		RoomSrvc.parseRoomsMessage(gwsMessage);
	};

	//////////////////
	// --- Chat --- //
	//////////////////
	$scope.joinChat = function(event) {
		let room = $scope.data.room;
		// A location check only makes sense with a real browser position. Ask at
		// the moment the person actually enters the chat; this is a user gesture,
		// so Chromium can show a fresh permission prompt after an F5 reload.
		if (!PositionSrvc.hasPosition(true)) {
			return PositionSrvc.probe().then(function(position) {
				return $scope.updatePosition(position);
			}).then(function() {
				return $scope.joinChat(event);
			}, function(error) {
				return DialogSrvc.openHTMLDialog(
					'<p>Bitte erlaube den Standort im Browser, damit Entfernung und Chat-Radius geprüft werden können.</p>',
					'Standort aktivieren');
			})['catch']($scope.catchUnknown);
		}
		if (room.inChatRange()) {
			return $scope.chatVisible();
		}
		let msg = $translate.instant('MSG_JOIN_TOO_FAR', {
			current_distance: Number(room.distance()).toFixed(1),
			needed_distance: Number(room.radius()).toFixed(1),
			room_name: room.name(),
		});
		return DialogSrvc.openHTMLDialog(`<p>${msg}</p>`, room.name());
	};

	$scope.chatVisible = function() {
		console.log('LocationCtrl.chatVisible()', $scope.data.room);
		// The room payload can briefly still show the own avatar after a route or
		// websocket transition.  That visual state is not proof of a live server
		// membership. Re-join idempotently so the server remains authoritative and
		// a visible composer can never point at a room that was already parted.
		if (!$scope.inChatRange() || $scope.data.chatJoining) {
			return;
		}
		$scope.data.chatJoining = true;
		return ChatSrvc.join($scope.data.room).then(function() {
			$scope.joinedRoom();
			$scope.scrollChatToBottom(true);
		}).finally(function() {
			$scope.data.chatJoining = false;
		})['catch']($scope.catchUnknown);
	};

	// The top "Chat" control is always a valid way to inspect a location's
	// conversation. Joining remains protected by the same GPS radius check as
	// the primary "Chat betreten" action.
	$scope.openChatTab = function() {
		if ($scope.inChatRange()) {
			return $scope.chatVisible();
		}
	};
	
	$scope.joinedRoom = function() {
		console.log('LocationCtrl.joinedRoom()');
		HelpSrvc.showHelp('help_chat', $translate.instant('HELP_CHAT'));
	};

	$scope.scrollChatToBottom = function(focusInput) {
		// Wait for Angular to render the newest ng-repeat message before reading
		// the scroll height. This also preserves the cursor after Enter/send.
		return $timeout(function() {
			var $chat = window.jQuery('.location-chat-surface .chat-msgs:visible');
			$chat.each(function() {
				this.scrollTop = this.scrollHeight;
			});
			if (focusInput) {
				window.jQuery('.location-chat-surface .chatbottom input:visible').first().focus();
			}
		}, 0, false);
	};

	$scope.sendMessage = function() {
		console.log('LocationCtrl.sendMessage()');
		var message = ($scope.data.message || '').trim();
		if (message) {
			ChatSrvc.sendMessage($scope.data.room, message);
		}
		jQuery('.chatbottom button').removeClass('sendmessage');
		$scope.data.message = '';
		$scope.scrollChatToBottom(true);
	};

	$scope.onMessageRead = function(lupMessage) {
		console.log('LocationCtrl.onMessageRead()', lupMessage);
		ChatSrvc.markRead(lupMessage);
	};
	
	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
	$scope.$on('gwf-position-changed', function(event, position){
		console.log('LocationCtrl.$on-gwf-position-changed', position);
	});
	$scope.$on('lup-room-message', function(event, room, message) {
		if (message && message.isOwnMessage() && room && room.id() === $scope.data.room.id()) {
			$scope.scrollChatToBottom(false);
		}
	});
	var leaveHandled = false;
	var leaveDialogOpen = false;
	var isSameLocationPath = function(path) {
		return new RegExp('^/location/' + $scope.data.room.id() + '(?:/(?:chat|visitors))?$').test(path);
	};
	var routeFromUrl = function(url) {
		var marker = '#!';
		var index = url.indexOf(marker);
		return index >= 0 ? url.substring(index + marker.length) : '';
	};
	$scope.$on('$locationChangeStart', function(event, nextUrl) {
		var room = $scope.data.room;
		if (leaveHandled || leaveDialogOpen || !room || !room.id() ||
			!ChatSrvc.CHATROOM || ChatSrvc.CHATROOM.id() !== room.id()) {
			return;
		}
		var nextPath = routeFromUrl(nextUrl);
		if (!nextPath || isSameLocationPath(nextPath)) {
			return;
		}
		event.preventDefault();
		leaveDialogOpen = true;
		// Leaving a venue is different from changing its tabs.  Let the visitor
		// deliberately choose whether their presence should be removed now.
		DialogSrvc.confirm('js/pages/location/html/lup-location-leave-dialog.html', {}).then(function() {
			leaveHandled = true;
			leaveDialogOpen = false;
			return ChatSrvc.part(room).finally(function() {
				$location.url(nextPath);
			});
		}, function() {
			// "Im Chat bleiben": mark this before navigating. The LocationCtrl is
			// destroyed by that navigation and must not turn a declined dialog into
			// an implicit PART.
			leaveHandled = true;
			leaveDialogOpen = false;
			$location.url(nextPath);
		})['catch']($scope.catchUnknown);
	});
	$scope.$on('$destroy', function() {
		// Switching between Location, Chat and Online recreates this controller in
		// Angular. That is still the same physical place, so it must not emit PART
		// between the join and the first typed message.
		var sameLocationView = isSameLocationPath($location.path());
		if (sameLocationView) {
			return;
		}
		if (leaveHandled) {
			return;
		}
		// Navigating away really does mean leaving the live-presence room.
		// The server broadcasts the part event, removing the mini avatar at once.
		if (ChatSrvc.CHATROOM && ChatSrvc.CHATROOM.id() === $scope.data.room.id()) {
			ChatSrvc.part($scope.data.room);
		}
	});

	//////////
	// Maps //
	//////////
	/**
	 * @see https://developers.google.com/maps/documentation/urls/guide
	 */
	$scope.mapsHref = function(room) {
//		console.log("LocationCtrl.mapsHref()", room);
		var destination = $scope.mapsDestination(room);
		return "https://www.google.com/maps/dir/?api=1&dir_action=navigate&travelmode=walking&destination=" + encodeURIComponent(destination);
	};
	
	$scope.mapsDestination = function(room) {
//		console.log("LocationCtrl.mapsDestination()", room);
		var lat = Number(room.lat());
		var lng = Number(room.lng());
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			return lat + "," + lng;
		}
		return [room.street(), room.zip(), room.city()].filter(Boolean).join(', ');
	};

	/////////////////////
	// --- QR-Code --- //
	/////////////////////
	$scope.onShowQRCode = function() {
		var roomId = $scope.data.room.id();
		var url = LUP_CONFIG.server + 'linkuup.qrforroom.room_id.' + roomId + '.html?_lang=en';
		var target = window.location.href.split('#')[0] + '#!/location/' + roomId + '/chat';
		return DialogSrvc.confirm('js/pages/location/html/lup-room-qr-dialog.html', {url: url, target: target});
	}

	///////////////////////
	// --- OpenTimes --- //
	///////////////////////
	$scope.showOpenTimes = function(event) {
		console.log("LocationCtrl.showOpenTimes()", event);

		// Ugly wrap.
		var room = $scope.data.room;

		function DialogController($scope, $mdDialog) {
			$scope.room = room;
			$scope.cancel = function() {
				$mdDialog.cancel();
			};
		};

		// Return promise
		return $mdDialog.show({
			controller: DialogController,
			templateUrl: 'js/dialogs/lup-open-times-dialog.html?v='+window.LUP_BUILD,
			parent: angular.element(document.body),
			targetEvent: event,
			clickOutsideToClose:true,
//			fullscreen: true, //$scope.customFullscreen // Only for -xs, -sm breakpoints.
		});
	};

	$scope.onOpenPhone = function(event) {
		console.log("LocationCtrl.showPhone()", event);

		// Ugly wrap.
		var room = $scope.data.room;

		function DialogController($scope, $mdDialog) {
			$scope.room = room;
			$scope.cancel = function() {
				$mdDialog.cancel();
			};
		};

		// Return promise
		return $mdDialog.show({
			controller: DialogController,
			templateUrl: 'js/dialogs/lup-location-phone-dialog.html?v='+window.LUP_BUILD,
			parent: angular.element(document.body),
			targetEvent: event,
			clickOutsideToClose: true,
		});
	};

	//////////////////////
	// --- Visitors --- //
	//////////////////////
	$scope.visitorsVisible = function() {
		console.log('LocationCtrl.visitorsVisible()');
		HelpSrvc.showHelp('help_visitors', $translate.instant('HELP_VISITORS'));
	};

	$scope.openVisitorsTab = function() {
		$scope.data.manualLocationTab = true;
		$scope.data.selectedTab = 2;
		$scope.data.selectedTab2 = 2;
		return $scope.visitorsVisible();
	};
	
	$scope.sortedVisitors = function() {
		/* The server refreshes the room object in place. Returning an empty list
		 * during that very short hand-over avoids a render error.  More
		 * importantly, do not sort the same live array during every Angular digest:
		 * with a busy room that caused visibly jerky visitor cards. */
		var users = ($scope.data.room && $scope.data.room.USERS) || [];
		var signature = users.map(function(user) {
			return user.id() + ':' + user.likes() + ':' + (user.isFriend() ? '1' : '0');
		}).join('|');
		if (visitorCache.source === users && visitorCache.signature === signature) {
			return visitorCache.users;
		}
		visitorCache = {
			source: users,
			signature: signature,
			users: UserSrvc.sortedUsers(users.slice()),
		};
		return visitorCache.users;
	};

	$scope.visitorCount = function() {
		var users = ($scope.data.room && $scope.data.room.USERS) || [];
		return users.length;
	};

});
