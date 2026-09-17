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
		WebsocketSrvc, ErrorSrvc, DialogSrvc, HelpSrvc, PositionSrvc, ConfigSrvc, ShoutSrvc) {
	
	$scope.LikeSrvc = LikeSrvc;
	$scope.FriendSrvc = FriendSrvc;
	$scope.ChatSrvc = ChatSrvc;
	
	$scope.data.room = $scope.data.room||RoomSrvc.BLANK_ROOM;
	$scope.data.message = '';
	$scope.data.roomReady = false;
	$scope.data.roomLoadFailed = false;
	$scope.data.newRoomMessages = $scope.data.newRoomMessages || false;
	$scope.data.topComments = $scope.data.topComments || [];
	$scope.data.selectedTab = $scope.data.selectedTab || 0;
	$scope.data.selectedTab2 = $scope.data.selectedTab2 || 0;
	$scope.data.manualLocationTab = false;
 $scope.isPresencePreview = function(){return RoomSrvc.isPreviewRoom ? RoomSrvc.isPreviewRoom($scope.data.room) : false;};
 $scope.previewGuests = function(){return RoomSrvc.displayUsers ? RoomSrvc.displayUsers($scope.data.room) : [];};
	$scope.data.rating = 3;
	$scope.data.commentText = '';
	$scope.data.commentInput = '';
	$scope.data.showInput = true;
	var visitorCache = {source: null, signature: '', users: []};
	var chatScrollElement = null;

	function getChatScrollElement() {
		return document.querySelector('.location-chat-surface .chat-msgs');
	}

	function isChatAtBottom(element) {
		return element && element.scrollHeight - element.scrollTop - element.clientHeight <= 24;
	}

	function bindChatScroll(attempt) {
		// The location template is inserted asynchronously. Bind once it exists,
		// and clear the catch-up affordance as soon as the reader reaches bottom.
		$timeout(function() {
			var element = getChatScrollElement();
			if (!element) {
				// ng-include may finish after the route controller. Retry briefly so
				// manual scrolling always clears the unseen-message indicator.
				if ((attempt || 0) < 20) {
					$timeout(function() { bindChatScroll((attempt || 0) + 1); }, 50, false);
				}
				return;
			}
			if (element === chatScrollElement) {
				return;
			}
			if (chatScrollElement) {
				window.jQuery(chatScrollElement).off('.lupRoomMessages');
			}
			chatScrollElement = element;
			window.jQuery(element).on('scroll.lupRoomMessages', function() {
				if ($scope.data.newRoomMessages && isChatAtBottom(this)) {
					$scope.$evalAsync(function() {
						$scope.data.newRoomMessages = false;
					});
				}
			});
		}, 0, false);
	}
	
	$scope.init = function() {
		console.log('LocationCtrl.init()', $routeParams.id);
		bindChatScroll();
		if ($scope.data.authenticated) {
			$scope.data.user = GWF_USER;
			$scope.data.roomLoadFailed = false;
			RoomSrvc.withRoom($routeParams.id).then($scope.loadedRoom)['catch'](function(error) {
				$scope.data.roomLoadFailed = true;
				$scope.catchUnknown(error);
			});
			$scope.data.topComments = $scope.data.topComments || [CommentSrvc.BLANK_COMMENT()];
			HelpSrvc.showHelp('help_location', $translate.instant('HELP_LOCATION'));
		}
	};
	
	$scope.loadedRoom = function(room) {
		console.log('LocationCtrl.loadedRoom()', room);
		$scope.data.room = room;
		$scope.data.roomReady = true;
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
			if (tab === 1 && !$scope.inChatRange() && !$scope.isPresencePreview()) {
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
		var oldRating = Number($scope.data.rating);
		if (!Number.isFinite(oldRating) || oldRating < 1 || oldRating > 10) { oldRating = 3; }
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
				// The rating component has an isolate scope. Keep the selected value
				// explicitly on this dialog scope before it is destroyed.
				$scope.data.rating = Number($scope.data.rating) || 0;
				if ($scope.data.rating < 1 || $scope.data.rating > 10) {
					return;
				}
				$mdDialog.cancel();
				scope.onRoomVoteComment($scope.data.rating, $scope.data.comment);
			};
			$scope.setRating = function(rating) {
				$scope.data.rating = Number(rating) || 0;
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
		commentText = (commentText || '').trim();
		$scope.data.rating = rating;
		$scope.data.commentInput = commentText;
		return $scope.onVoteRoom(rating).then(function() {
			// A rating is useful on its own. Only create/update a comment when the
			// visitor actually wrote one; an empty review must not block voting.
			return commentText ? CommentSrvc.saveComment($scope.data.room, commentText) : null;
		}).then($scope.savedComment)['catch'](ErrorSrvc.websocketError);
	};
	

	$scope.onVoteRoom = function(rating) {
		console.log('LocationCtrl.onVoteRoom()', rating);
		var roomId = $scope.data.room.id();
		var gwsMessage = new GWS_Message().cmd(0x1120).sync().write32(roomId).write8(rating);
		return WebsocketSrvc.sendBinary(gwsMessage).then($scope.onVoted);
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
        if ($scope.isPresencePreview()) return;
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
	// Use the existing location check and server membership flow for the new CTA.
	$scope.primaryLocationAction = function(event) {
		if ($scope.inChatRange() || $scope.isRegionalRoom($scope.data.room)) {
			event.preventDefault();
			return $scope.openPlaceChat(event);
		}
		// Outside a venue this remains an ordinary directions link. Chat's
		// separate GPS and server membership checks are unchanged.
	};

	$scope.openPlaceChat = function(event) {
		var selectChat = function() {
			if ($scope.inChatRange()) {
				$scope.data.manualLocationTab = true;
				$scope.data.selectedTab = 1;
			}
		};
		if ($scope.inChatRange()) { selectChat(); return; }
		var result = $scope.joinChat(event);
		return result && result.then ? result.then(selectChat) : result;
	};

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
		$scope.data.newRoomMessages = false;
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
        if ($scope.isPresencePreview()) return;
		console.log('LocationCtrl.sendMessage()');
		var message = ($scope.data.message || '').trim();
		if (message) {
			ChatSrvc.sendMessage($scope.data.room, message);
		}
		jQuery('.chatbottom button').removeClass('sendmessage');
		$scope.data.message = '';
		$scope.scrollChatToBottom(true);
	};

	$scope.leaveChat = function() {
		var room = $scope.data.room;
		if (!room || !room.id() || !ChatSrvc.CHATROOM || ChatSrvc.CHATROOM.id() !== room.id()) {
			return $location.path('/locations');
		}
		return ChatSrvc.part(room).then(function() {
			$location.path('/locations');
		})['catch']($scope.catchUnknown);
	};

	$scope.sendShout = function() {
		var message = ($scope.data.message || '').trim();
		if (!message) {
			return;
		}
		return ShoutSrvc.open(message).then(function(result) {
			$scope.data.message = '';
			return ErrorSrvc.showMessage('Gesendet im Umkreis von ' + result.radius + ' km an ' + result.locations + ' Locations (' + result.recipients + ' Empfänger).', 'Shout');
		})['catch'](angular.noop);
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
		if (!room || room.id() !== $scope.data.room.id()) {
			return;
		}
		if (!(message && message.isOwnMessage())) {
			// Incoming chat must never move the reader. The explicit arrow is the
			// only way to catch up with unseen lines.
			$scope.data.newRoomMessages = true;
		}
	});
	$scope.$on('$destroy', function() {
		if (chatScrollElement) {
			window.jQuery(chatScrollElement).off('.lupRoomMessages');
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
		return DialogSrvc.confirm('js/pages/location/html/lup-room-qr-dialog.html', {url: url, target: target, room: $scope.data.room});
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
		var users = RoomSrvc.displayUsers ? RoomSrvc.displayUsers($scope.data.room) : ($scope.data.room && $scope.data.room.USERS) || [];
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
		var users = RoomSrvc.displayUsers ? RoomSrvc.displayUsers($scope.data.room) : ($scope.data.room && $scope.data.room.USERS) || [];
		return users.length;
	};

	// Listing visible visitors is read-only until both people share this room.
	// Recheck at the time of the action as well as when rendering its control:
	// GPS and the server's room membership can change while the tab stays open.
	$scope.visitorActionsAvailable = function() {
		var room = $scope.data.room;
		return !!($scope.data.authenticated && $scope.data.roomReady && room &&
			PositionSrvc.hasPosition(true) && $scope.inChatRange() && room.isSelfInRoom());
	};
	$scope.canContactVisitor = function(user) {
		return !!(user && !user.isPreview && !user.isSelf() && $scope.visitorActionsAvailable() &&
			$scope.data.room.USERS.some(function(present) {return present.id() === user.id();}));
	};
	$scope.openVisitorProfile = function(user) {
		if ($scope.canContactVisitor(user)) return $scope.gotoProfile(user);
	};
	$scope.openVisitorChat = function(user) {
		if ($scope.canContactVisitor(user)) return $scope.gotoQuery(user);
	};
	$scope.visitorFriendState = function(user) {
		if (user.isFriend()) return 'friend';
		if (user.JSON.relation_incoming) return 'incoming';
		return user.JSON.relation_pending ? 'pending' : 'new';
	};
	$scope.visitorActionPending = {};
	$scope.changeVisitorFriend = function(user, action) {
		if (!$scope.canContactVisitor(user) || !user.isMember() ||
			!$scope.data.user.isMember() || $scope.visitorActionPending[user.id()]) return;
		var state = $scope.visitorFriendState(user);
		var methods = {new:'addFriend', pending:'cancelFriendRequest', incoming:'acceptFriendRequest', friend:'removeFriend'};
		if (action === 'decline' && state !== 'incoming') return;
		var method = action === 'decline' ? 'denyFriendRequest' : methods[state];
		$scope.visitorActionPending[user.id()] = true;
		return FriendSrvc[method](user, function() {return $scope.canContactVisitor(user);})
			.finally(function() {delete $scope.visitorActionPending[user.id()];})
			['catch']($scope.catchUnknown);
	};

});
