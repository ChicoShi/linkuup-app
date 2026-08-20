"use strict";
angular.module('LUP').
service('CommentSrvc', function($q, $translate, WebsocketSrvc, UserSrvc, ConfigSrvc) {
	var CommentSrvc = this;
	
	LUPComment.UserSrvc = UserSrvc;

	CommentSrvc.BLANK_COMMENT = function() {
		return new LUPComment({
			rc_id: 0,
			rc_room_id: 0,
			rc_user_id: ConfigSrvc.systemUser(),
			rc_lang_id: 0,
			rc_text: $translate.instant('NO_COMMENT_YET'),
			rc_created_at: moment.unix(0),
			blank_comment: true,
		});
	};
//	CommentSrvc.CACHE = {};
	///////////////////////////
	// --- Binary Parser --- //
	///////////////////////////
	CommentSrvc.parseCommentsMessage = function(gwsMessage) {
		console.log('CommentSrvc.parseCommentsMessage()', gwsMessage);
		var comments = [];
		while (gwsMessage.hasMore()) {
			var comment = CommentSrvc.parseCommentMessage(gwsMessage);
//			CommentSrvc.CACHE[comment.id()] = comment;
			comments.push(comment);
		}
		return comments;
	};
	
	CommentSrvc.parseCommentMessage = function(gwsMessage) {
		console.log('CommentSrvc.parseCommentMessage()', gwsMessage);
//		if (!gwsMessage.hasMore()) {
//			return CommentSrvc.BLANK_COMMENT;
//		}
		var json = {
			rc_id: gwsMessage.read32(),
			rc_user_id: gwsMessage.read32(),
//			rc_lang_id: gwsMessage.read32(),
			rc_text: gwsMessage.readString(),
			rc_created_at: moment.unix(gwsMessage.read32()),
		};
		var rcid = json.rc_id;
//		var comment = CommentSrvc.CACHE[rcid] ? CommentSrvc.CACHE[rcid] : new LUPComment(json);
		var comment = new LUPComment(json);
//		comment.setJSON(json);
		return comment;
	};
	
	////////////////////////////
	// --- Comments query --- //
	////////////////////////////
	CommentSrvc.withCommentsPage = function(room, page, refresh) {
		console.log('CommentSrvc.withCommentsPage()', room, page, refresh);
		if (refresh) {
//			RoomSrvc.CACHE[roomId] = null;
		}
		var deferred = $q.defer();
//		if (RoomSrvc.CACHE[roomId]) {
//			deferred.resolve(RoomSrvc.CACHE[roomId]);
//		}
//		else {
			CommentSrvc.withRequestCommentPage(room, page, deferred);
//		}
		return deferred.promise;
	};
	
	CommentSrvc.withRequestCommentPage = function(room, page, deferred) {
		console.log('CommentSrvc.withRequestCommentPage()', room, page);
		var gwsMessage = new GWS_Message().cmd(0x1121).sync().write32(room.id()).write16(page);
		var success = CommentSrvc.gotComments.bind(CommentSrvc, deferred);
		return WebsocketSrvc.sendBinary(gwsMessage).then(success, deferred.reject);
	};

	CommentSrvc.gotComments = function(deferred, gwsMessage) {
		console.log('CommentSrvc.gotComments()', gwsMessage);
		var pagination = GWFPagination.fromGWSMessage(gwsMessage);
		var comments = CommentSrvc.parseCommentsMessage(gwsMessage);
		comments.pagination = pagination;
		return deferred.resolve(comments);
	};
	
	CommentSrvc.withTopComments = function(room) {
		var gwsMessage = new GWS_Message().cmd(0x1126).sync().
			write32(room.id());
		return WebsocketSrvc.sendBinary(gwsMessage).then(CommentSrvc.parseTopComments);
	};

	CommentSrvc.parseTopComments = function(gwsMessage) {
		console.log('CommentSrvc.parseTopComments()', gwsMessage.dump());
		var comments = [];
		while (gwsMessage.hasMore()) {
			comments.push(CommentSrvc.parseCommentMessage(gwsMessage));
		}
		return comments;
	};

	CommentSrvc.withOwnComment = function(room) {
		console.log('CommentSrvc.withOwnComment()', room);
		var gwsMessage = new GWS_Message().cmd(0x1123).sync().write32(room.id());
		return WebsocketSrvc.sendBinary(gwsMessage);
	};
	
	CommentSrvc.saveComment = function(room, commentTxt) {
		console.log('CommentSrvc.saveComment()', room, commentTxt);
		var gwsMessage = new GWS_Message().cmd(0x1124).sync().write32(room.id()).writeString(commentTxt);
		return WebsocketSrvc.sendBinary(gwsMessage);
	};
	
	CommentSrvc.deleteComment = function(comment) {
		console.log('CommentSrvc.deleteComment()', comment);
		var gwsMessage = new GWS_Message().cmd(0x1127).sync().write32(comment.id());
		return WebsocketSrvc.sendBinary(gwsMessage);
	}
	
	return CommentSrvc;
});
