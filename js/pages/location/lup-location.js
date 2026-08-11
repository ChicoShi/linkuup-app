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
}).controller('LocationCtrl', function($scope, $location, $route, $routeParams, $mdDialog, $translate,
		RoomSrvc, CommentSrvc, ChatSrvc, UserSrvc, AuthSrvc, LikeSrvc, FriendSrvc,
		WebsocketSrvc, ErrorSrvc, DialogSrvc, HelpSrvc) {
	
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
	$scope.onVoteDialog = function() {
		console.log('LocationCtrl.onVoteDialog()');
		// Ugly wrap.
		var room = $scope.data.room;
		var oldRating = $scope.data.rating;
		var oldComment = $scope.data.commentInput;
		var scope = $scope;
		
		function DialogController($scope, $mdDialog) {
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
		};
		
		// Return promise
		return $mdDialog.show({
			controller: DialogController,
			templateUrl: 'js/dialogs/lup-room-vote-dialog.html?v='+window.LUP_BUILD,
			parent: angular.element(document.body),
			targetEvent: window.event,
			clickOutsideToClose:true,
//			fullscreen: true, //$scope.customFullscreen // Only for -xs, -sm breakpoints.
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
		ChatSrvc.join($scope.data.room).then($scope.joinedRoom);
	};
	
	$scope.joinedRoom = function() {
		console.log('LocationCtrl.joinedRoom()');
		HelpSrvc.showHelp('help_chat', $translate.instant('HELP_CHAT'));
	};

	$scope.sendMessage = function() {
		console.log('LocationCtrl.sendMessage()');
		if($scope.data.message){
			ChatSrvc.sendMessage($scope.data.room, $scope.data.message);
		}
		jQuery('.chatbottom input').val('');
		jQuery('.chatbottom button').removeClass('sendmessage');
		$scope.data.message = null;
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
//	$scope.$on('lup-room-message', function(event, room, message) {
//		console.log('LocationCtrl.$on-lup-room-message', room, message);
//	});

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
