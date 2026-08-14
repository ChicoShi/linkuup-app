"use strict";
function LUPComment(json) {
	console.log('new LUPComment()', json);
	this.setJSON = function(json) {
		this.JSON = json;
	};
	this.setJSON(json);
	
	this.id = function() { return this.JSON.rc_id; };
	this.userId = function() { return this.JSON.rc_user_id; };
	
	this.user = function() { return LUPComment.UserSrvc.getOrCreate(this.userId()); };
	this.text = function() { return this.JSON.rc_text; };
	this.date = function() { return this.JSON.rc_created_at; };
	this.rating = function() { return this.JSON.rc_rating || 0; };
	
	this.isOwn = function() { return this.user() === window.GWF_USER; };
	
	this.displayDate = function() { return window.moment(this.date()).format(LUPComment.t('FMT_LONG')); };
	
	this.isBlankComment = function() { return !!this.JSON.blank_comment; };
}
