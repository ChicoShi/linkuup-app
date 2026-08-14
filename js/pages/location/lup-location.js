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
	$scope.data.rating = 3;
	$scope.data.commentText = '';
	$scope.data.commentInput = '';
	$scope.data.showInput = true;
	
	$scope.init = function() {
		console.log('LocationCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.user = GWF_USER;
			RoomSrvc.withRoom($routeParams.id).then($scope.loadedRoom);
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
//		try {
			return $scope.data.room.inChatRange();
//		} catch (e) {
//			return false;
//		}
	};

	$scope.headerRoomName = function() {
		var name = $scope.data.room.name();
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
		return visuals[String(room.category())] || {icon:'place', class:'location-category-default'};
	};
	
	$scope.afterLoadedRoom = function() {
		console.log('LocationCtrl.afterLoadedRoom()', $scope.data.room.id());
		var params = $route.current.$$route.params;
		var tab = params.gotoTab;
		switch (params.gotoTab) {
		case 0: break; // all fine
		case 1: case 2:
			// Fixed to location tab if not in range
			if (!$scope.inChatRange()) {
				tab = 0;
			}
			break;
		}

		$scope.data.selectedTab = tab;
		$scope.data.selectedTab2 = tab;

		$scope.loadTopComments();
		CommentSrvc.withOwnComment($scope.data.room).
			then($scope.loadedOwnComment);
	};
	
	$scope.loadTopComments = function() {
		return CommentSrvc.withTopComments($scope.data.room).then($scope.loadedTopComments);
	};
	
	$scope.loadedOwnComment = function(gwsMessage) {
		console.log('LocationCtrl.loadedOwnComment()', gwsMessage.dump());
		var roomId = gwsMessage.read32();
		var userId = gwsMessage.read32();
		$scope.data.rating = gwsMessage.read8();
		$scope.data.commentText = gwsMessage.readString();
		$scope.data.commentInput = gwsMessage.readString();
		$scope.data.likes = gwsMessage.read32();
	};
	
	$scope.saveComment = function() {
		console.log('LocationCtrl.saveComment()');
		CommentSrvc.saveComment($scope.data.room, $scope.data.commentInput).
			then($scope.savedComment, ErrorSrvc.websocketFormError);
	};
	
	$scope.savedComment = function() {
		console.log('LocationCtrl.savedComment()');
		$scope.data.showInput = false;
		ErrorSrvc.showMessage("Vielen Dank für Ihre Bewertung.", "Vielen Dank").
			then($scope.loadTopComments);
	};

	$scope.loadedTopComments = function(topComments) {
		console.log('LocationCtrl.loadedTopComments()', topComments);
		$scope.data.topComments = topComments.length ? topComments : [CommentSrvc.BLANK_COMMENT()];
	};
	
	$scope.gotoComments = function(room) {
		console.log('LocationCtrl.gotoComments()', room);
		$location.path("/location/"+room.id()+"/comments");
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
		$scope.onVoteRoom(rating);
		CommentSrvc.saveComment($scope.data.room, commentText).
			then($scope.savedComment, ErrorSrvc.websocketError);
	};
	

	$scope.onVoteRoom = function(rating) {
		console.log('LocationCtrl.onVoteRoom()', rating);
		var roomId = $scope.data.room.id();
		var gwsMessage = new GWS_Message().cmd(0x1120).sync().write32(roomId).write8(rating);
		WebsocketSrvc.sendBinary(gwsMessage).then($scope.onVoted, ErrorSrvc.websocketJSONError);
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
			});
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
		if (!$scope.inChatRange() || $scope.data.room.isSelfInRoom() || $scope.data.chatJoining) {
			return;
		}
		$scope.data.chatJoining = true;
		return ChatSrvc.join($scope.data.room).then(function() {
			$scope.joinedRoom();
			$scope.scrollChatToBottom(true);
		}).finally(function() {
			$scope.data.chatJoining = false;
		});
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
		if (room && room.id() === $scope.data.room.id()) {
			$scope.scrollChatToBottom(false);
		}
	});
	$scope.$on('$destroy', function() {
		// Leaving a location page also means leaving its live-presence room.
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
		let url = LUP_CONFIG.server + 'linkuup;qrforroom;room_id;'+$scope.data.room.id()+'.html?_lang=en';
		return DialogSrvc.confirm('js/pages/location/html/lup-room-qr-dialog.html', {url: url});
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
	
	$scope.sortedVisitors = function() {
		return UserSrvc.sortedUsers($scope.data.room.USERS);
	};

});
