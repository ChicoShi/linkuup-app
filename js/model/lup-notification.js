/**
 * @author gizmore@wechall.net
 */
function LUPNotification() {
	console.log('new LUPNotification()');
	
	this.JSON = {};
	
	// Services 
	this.q = function() { return LUPNotification['$q']; };
	this.us = function() { return LUPNotification.UserSrvc; };
	this.rs = function() { return LUPNotification.RoomSrvc; };

	// Notification raw data
	this.id = function() { return this.JSON.note_id; };
	this.data = function() { return this.JSON.note_data; };
	this.created = function() { return this.JSON.note_created; };
	this.date = function() { return new Date(this.created()); };
	this.read_at = function() { return this.JSON.note_read; }
	this.read = function() { return !!this.read_at(); }
	this.unread = function() { return !this.read_at(); }
	
	this.displayDate = function() { return moment(this.created(), 'X').format(window.t('FMT_LONG')); };
	
	// Helper
	this.type = function() { return this.data().type; };
	
	// Result
//	this.html = '';
//	this.html = JSON.stringify(this.data());
	
	//
	// HTML resolve Funcs
	// HTML is asynchroniously built from ids.
	// 
	this.resolveData = function(recaching) {
		console.log('LUPNotification.resolveData()', this, recaching);
		
		this.recaching = recaching;
//		this.friend = GWF_USER;
//		this.other = GWF_USER;
//		this.room = this.rs().NEW_BLANK_ROOM(0);
		
		this.TYPE = 0;
		
		switch(this.type()) {
		case 'join': this.resolveRoomJoin(); break;
		case 'commented': this.resolveRoomCommented(); break;
		case 'friendrequest': this.resolveFriendRequest(); break;
		case 'friendrequested': this.resolveFriendRequested(); break;
		case 'friends': this.resolveFriendAccept(); break;
		case 'nofriends': this.resolveFriendRemoved(); break;
		}
	};
	
	this.resolveRoomJoin = function() {
		console.log('LUPNotification.resolveRoomJoin()', this);
		this.TYPE = 1;
		var that = this;
		var Quser = this.us().withUser(this.data().user);
		var Qroom = this.rs().withRoom(this.data().room);
		this.resolved = this.q().all([Quser, Qroom]).then(function(values){
			that.friend = values[0];
			that.room = values[1];
			return that;
		});
		return this.resolved;
	};
	
	this.resolveRoomCommented = function() {
		console.log('LUPNotification.resolveRoomCommented()', this);
		this.TYPE = 2;
		var that = this;
		var Quser = this.us().withUser(this.data().user);
		var Qroom = this.rs().withRoom(this.data().room);
		this.q().all([Quser, Qroom]).then(function(values){
			that.friend = values[0];
			that.room = values[1];
		});
	};
	
	this.resolveFriendRequest = function() {
		console.log('LUPNotification.resolveFriendRequest()', this);
		this.TYPE = 3;
		var that = this;
		this.us().withUser(this.data().user).then(function(friend){
			var nid = that.id();
			var uid = that.data().user;
			var fid = that.data().friend;
			that.frqid = ""+nid+","+uid+","+fid;
			that.friend = friend;
		});
	};

	this.resolveFriendRequested = function() {
		console.log('LUPNotification.resolveFriendRequested()', this);
		this.TYPE = 4;
		var that = this;
		this.us().withUser(this.data().friend).then(function(friend){
			that.friend = friend;
		});
	};

	/**
	 * Asynchroniously resolve users from friend message.
	 * Build html for this notification.
	 * @see UserSrvc
	 */
	this.resolveFriendAccept = function() {
		console.log('LUPNotification.resolveFriendAccept()', this);
		this.TYPE = 5;
		var that = this;
		var one = this.us().withUser(this.data().user);   // user1
		var two = this.us().withUser(this.data().friend); // user2
		this.q().all([one, two]).then(function(users) {
			// Myself involved
			if ( (users[0] === GWF_USER) ||
				 (users[1] === GWF_USER) ) {
				that.friend = users[0] === GWF_USER ? users[1] : users[0];
				that.other = GWF_USER;
				if (that.recaching) {
					that.us().withUser(that.friend.id(), true); // Recache friend
				}
			}
			else {
				that.other = users[0].isFriend() ? users[0] : users[1];
				that.friend = users[0].isFriend() ? users[1] : users[0];
			}
		});
	};
	
	/**
	 * Asynchroniously resolve users from friend message.
	 * Build html for this notification.
	 * @see UserSrvc
	 */
	this.resolveFriendRemoved = function() {
		console.log('LUPNotification.resolveFriendRemoved()', this);
		this.TYPE = 6;
		var that = this;
		var one = this.us().withUser(this.data().user);   // user1
		var two = this.us().withUser(this.data().friend); // user2
		this.q().all([one, two]).then(function(users) {
			// Myself involved
			if ( (users[0] == GWF_USER) ||
				 (users[1] == GWF_USER) ) {
				that.friend = users[0] === GWF_USER ? users[1] : users[0];
				that.other = GWF_USER;
				if (that.recaching) {
					that.us().withUser(that.friend.id(), true); // Recache friend
				}
			}
			else {
				that.other = users[0].isFriend() ? users[0] : users[1];
				that.friend = users[0].isFriend() ? users[1] : users[0];
			}
		});
	};
}
