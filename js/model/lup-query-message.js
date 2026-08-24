"use strict";
function LUP_QueryMessage(json) {
	console.log('new LUP_QueryMessage()', json);
	
	this.JSON = json||{};
	
	this.id = function() { return this.JSON.lupqm_id; };
	this.threadId = function() { return this.JSON.lupqm_thread; };
	this.fromId = function() { return this.JSON.lupqm_from; };
	this.fromUser = function() { return LUP_QueryMessage.UserSrvc.getOrCreate(this.fromId()); };
	this.toId = function() { return this.JSON.lupqm_to; };
	this.toUser = function() { return LUP_QueryMessage.UserSrvc.getOrCreate(this.toId()); };
	this.text = function() { return this.JSON.lupqm_text; };
	this.sent = function() { return this.JSON.lupqm_created; };
	this.delivered = function() { return this.JSON.lupqm_delivered; };
	this.read = function() { return this.JSON.lupqm_read; };
	this.isAcknowledged = function() { return this.JSON.lupqm_ack > 0; };

	this.isSent = function() { return !!this.sent(); };
	this.isRead = function() { return !!this.read(); };
	this.isDelivered = function() { return !!this.delivered(); };
	
	this.state = function() {
		if (this.isRead()) { return 3; }
		if (this.isDelivered()) { return 2; }
		if (this.isSent()) { return 1; }
		return 0;
	};
	
	this.isOwnMessage = function() {
		return this.fromUser().isSelf();
	};
	
	this.readOther = function() {
		return this.isOwnMessage() ? this.isRead() : true;
	};
	
	this.readMyself = function() {
		return this.isOwnMessage() ? true : this.isRead();
	};

}

LUP_QueryMessage.blank = function() {
	return new LUP_QueryMessage({
		'lupqm_id': 0,
		'lupqm_from': GWF_USER.id(),
		'lupqm_to': 0,
		'lupqm_text': '...',
		'lupqm_created': 0,
		'lupqm_delivered': 0,
		'lupqm_read': 0,
		'lupqm_ack': 0,
	});
};
