"use strict";
angular.module('LUP').
service('UserSrvc', function($q, $rootScope, WebsocketSrvc, EnumSrvc, RequestSrvc) {
	var UserSrvc = this;

	UserSrvc.CACHE = {};

	////////////
	// Logout //
	////////////
	UserSrvc.loggedIn = function(user) {
		console.log('UserSrvc.loggedIn()');
		UserSrvc.CACHE[user.id()] = user;
	};

	UserSrvc.logout = function() {
		console.log('UserSrvc.logout()');
		var gwsMessage = new GWS_Message().cmd(0x0104).sync();
		return WebsocketSrvc.sendBinary(gwsMessage).then(UserSrvc.loggedOut);
	};

	UserSrvc.loggedOut = function(gwsMessage) {
		console.log('UserSrvc.loggedOut()', gwsMessage);
		window.GWF_USER.update(JSON.parse(gwsMessage));
	};

	///////////////////////////
	// --- Binary Parser --- //
	///////////////////////////
	UserSrvc.parseUserMessage = function(gwsMessage) {
		console.log('UserSrvc.parseUserMessage()', gwsMessage);
		if (gwsMessage.hasMore()) {
			return {
				user_id: gwsMessage.read32(),
				user_type: EnumSrvc.userTypeToEnum(gwsMessage.read16()),
				user_level: gwsMessage.read32(),
				user_name: gwsMessage.readString(),
				user_guest_name: gwsMessage.readString(),
				avatar_version: gwsMessage.read32(),
				user_gender: EnumSrvc.genderToEnum(gwsMessage.read16()),
				lup_sexo: EnumSrvc.sexoToEnum(gwsMessage.read16()),
				lup_interest: EnumSrvc.interestToEnum(gwsMessage.read16()),
				relationship: EnumSrvc.relationshipToEnum(gwsMessage.read16()),
				relation_pending: gwsMessage.read8(),
				user_country: gwsMessage.readString(),
				lup_friends: gwsMessage.read32(),
				lup_status: gwsMessage.readString(),
				lup_vip: gwsMessage.read8(),
				lup_likes: gwsMessage.read32(),
				lup_chat_sent: gwsMessage.read32(),
				lup_query_sent: gwsMessage.read32(),
				lup_query_received: gwsMessage.read32(),
				lup_visits: gwsMessage.read32(),
				lup_cuddles: gwsMessage.read32(),
			};
		}
	};

	UserSrvc.parseGWFUserMessage = function(gwsMessage) {
		console.log('UserSrvc.parseGWFUserMessage()', gwsMessage);
		if (gwsMessage.hasMore()) {
			return {
				user_id: gwsMessage.read32(),
				user_type: EnumSrvc.userTypeToEnum(gwsMessage.read16()),
				user_name: gwsMessage.readString(),
				user_guest_name: gwsMessage.readString(),
				user_real_name: gwsMessage.readString(),
				user_email: gwsMessage.readString(),
				user_level: gwsMessage.read32(),
				user_credits: gwsMessage.read32(),
				user_email_fmt: EnumSrvc.emailFormatToEnum(gwsMessage.read16()),
				user_gender: EnumSrvc.genderToEnum(gwsMessage.read16()),
				user_birthdate: gwsMessage.read32(),
				user_country: gwsMessage.readString(),
				user_language: gwsMessage.readString(),
				user_deleted_at: gwsMessage.read32(),
				user_last_activity: gwsMessage.read32(),
				user_register_time: gwsMessage.read32(),
			};
		}
	};

	UserSrvc.parseGender = function(byte) {
		console.log('UserSrvc.parseGender()', byte);
		switch (byte) {
		case 109: return 'male';
		case 102: return 'female';
		case 120: return 'no_gender';
		}
	};

	////////////////////////
	// --- User query --- //
	////////////////////////
	UserSrvc.refresh = function() {
		console.log('UserSrvc.refresh()');
		return RequestSrvc.send(window.LUP_CONFIG.server + '/index.php?mo=Websocket&me=GetSecret&_ajax=1&_fmt=json&count=0').
		then(UserSrvc.parseRefreshMessage);
	};

	UserSrvc.parseRefreshMessage = function(response) {
		console.log('UserSrvc.parseRefreshMessage()', response);
		window.GWF_USER.update(response.data.data.user);
	};

	UserSrvc.withUser = function(userId, refresh) {
		console.log('UserSrvc.withUser() ID='+userId+' refresh='+refresh);
		var deferred = $q.defer();

		if (userId == 0) {
			deferred.resolve(window.GWF_USER);
		}
		else if ((UserSrvc.CACHE[userId]) && (!refresh) && UserSrvc.CACHE[userId].loaded()) {
			deferred.resolve(UserSrvc.CACHE[userId]);
		}
		else {
			if (!UserSrvc.CACHE[userId]) {
				UserSrvc.CACHE[userId] = GWF_User.ghost(userId);
			}
			UserSrvc.withRequestUser(userId, deferred);
		}
		return deferred.promise;
	};

	UserSrvc.withRequestUser = function(userId, deferred) {
		console.log('UserSrvc.withRequestUser()', userId);
		var gwsMessage = new GWS_Message().cmd(0x1106).sync().write32(userId);
		var gotUser = UserSrvc.gotUser.bind(UserSrvc, deferred);
		return WebsocketSrvc.sendBinary(gwsMessage).then(gotUser, deferred.reject.bind(deferred));
	};

	UserSrvc.gotUser = function(deferred, gwsMessage) {
		var user = UserSrvc.gotUserMessage(gwsMessage);
		console.log('UserSrvc.gotUser()', gwsMessage, user);
//		$rootScope.$broadcast('lup-got-user', user);
		deferred.resolve(user);
	};

	UserSrvc.gotUserMessage = function(gwsMessage) {
		console.log('UserSrvc.gotUserMessage()', gwsMessage);
		var json = UserSrvc.parseUserMessage(gwsMessage);
		var user = UserSrvc.getOrCreate(json.user_id);
		user.update(json);
		return user;
	};

	UserSrvc.getOrCreate = function(userId) {
		if (!UserSrvc.CACHE[userId]) {
			console.log('UserSrvc.getOrCreate()', userId);
			UserSrvc.CACHE[userId] = GWF_User.ghost(userId);
			UserSrvc.withUser(userId, true);
		}
		return UserSrvc.CACHE[userId];
	};

	UserSrvc.getUser = function(userId) {
		return UserSrvc.CACHE[userId];
	};

	/** User Search **/
	UserSrvc.searchUsers = function(query) {
		console.log('UserSrvc.searchUsers()', query);
		var gwsMessage = new GWS_Message().cmd(0x1161).sync().writeString(query);
		return WebsocketSrvc.sendBinary(gwsMessage).then(UserSrvc.searchedUsers);

	};

	UserSrvc.searchedUsers = function(gwsMessage) {
		console.log('UserSrvc.searchedUsers()', gwsMessage);
		var users = [];
		while (gwsMessage.hasMore()) {
			var user = UserSrvc.gotUserMessage(gwsMessage);
			users.push(user);
		}
		return users;
	};

	///////////////////////////////////////
	// --- Sort based on match score --- //
	///////////////////////////////////////
	UserSrvc.sortedUsers = function(users) {
		users.sort(function(a,b){
			return UserSrvc.sortScore(b) -
				UserSrvc.sortScore(a);
		});
		return users;
	};

	UserSrvc.likeScore = [1, 10, 20, 50, 100, 1000, 5000, 10000];

	UserSrvc.sortScore = function(user) {
		if (user.isSelf()) {
			return 10000;
		}
		var score = 0;
		if (user.isMember()) {
			return score += 5;
		}

		var likes = user.likes();
		for (var i in UserSrvc.likeScore) {
			var need = UserSrvc.likeScore[i];
			if (likes >= need) {
				score++;
			}
		}

		return score;
	};


	return UserSrvc;
});
