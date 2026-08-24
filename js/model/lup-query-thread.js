'use strict';
/* One private-message thread. A pair can deliberately have several threads. */
function LUP_QueryThread(json) {
	this.JSON = json || {};
	this.messages = [];
	this.loading = null;

	this.id = function() { return this.JSON.lupqt_id || 0; };
	this.userAId = function() { return this.JSON.lupqt_user_a; };
	this.userBId = function() { return this.JSON.lupqt_user_b; };
	this.user = function() {
		var ownId = String(window.GWF_USER.id());
		var other = String(this.userAId()) === ownId ? this.userBId() : this.userAId();
		return LUP_QueryThread.UserSrvc.getOrCreate(other);
	};
	this.updated = function() { return this.JSON.lupqt_updated || 0; };
	this.lastDate = function() { return this.updated(); };
	this.lastText = function() { return this.JSON.lupqt_last_text || ''; };
	this.addMessage = function(message) {
		if (this.messages.indexOf(message) === -1) {
			this.messages.push(message);
			this.messages.sort(function(a, b) { return a.sent() - b.sent(); });
		}
		if (message.sent() >= this.updated()) {
			this.JSON.lupqt_updated = message.sent();
			this.JSON.lupqt_last_text = message.text();
		}
	};
	this.addNewMessage = this.addMessage;
	this.unreadCount = function() {
		var unread = 0;
		for (var i in this.messages) {
			unread += this.messages[i].readMyself() ? 0 : 1;
		}
		return unread;
	};
}
