"use strict";
angular.module('LUP').

/**
 * Gallery Service.
 * 
 * @author gizmore@wechall.net
 */
service('GallerySrvc', function(WebsocketSrvc, TypeSrvc, EnumSrvc, SettingsSrvc, ErrorSrvc) {
	
	var GallerySrvc = this;

	GallerySrvc.OWN_GALLERY = null;
	
	/////////////////
	// --- Get --- //
	/////////////////
	
	/**
	 * Request users gallery.
	 */
	GallerySrvc.withGalleryForUser = function(user) {
		console.log('GallerySrvc.withGalleryForUser()', user);
		var gwsMessage = new GWS_Message().cmd(0x1151).sync().write32(user.id());
		return WebsocketSrvc.sendBinary(gwsMessage).
			then(GallerySrvc.parseGalleryMessage);
	};
	
	/**
	 * Parse response via type service.
	 */
	GallerySrvc.parseGalleryMessage = function(gwsMessage) {
		console.log('GallerySrvc.parseGalleryMessage()', gwsMessage);

		// Parse gallery object
		var gallery = new LUPGallery({});
		TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\Gallery\\GDO_Gallery", gallery);
		GallerySrvc.OWN_GALLERY = gallery;
		
		// Parse all images
		while (gwsMessage.hasMore()) {
			// Parse image
			var image = new LUPGalleryImage({})
			TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\Gallery\\GDO_GalleryImage", image);
			// Add to gallery
			gallery.addImage(image);
		}
		
		return gallery;
	};
	
	//////////////////
	// --- POST --- //
	//////////////////
	/**
	 * Triggers the upload finalization on the websocket after flow upload.
	 * This saves the file and copies the image data after the flow process.
	 */
	GallerySrvc.onGalleryUpload = function() {
		console.log('GallerySrvc.onGalleryUpload()');
		// Call 0x1152 LUPWS_GalleryUpload
		var gwsMessage = new GWS_Message().cmd(0x1152).sync();
		gwsMessage.write32(GallerySrvc.OWN_GALLERY.id());
		gwsMessage.writeString('LinkUUp_App'); // Title is notNull.
		gwsMessage.writeString(''); // Description empty
		gwsMessage.write16(EnumSrvc.galleryACLToInt(GallerySrvc.OWN_GALLERY.JSON['gallery_acl']));
//		gwsMessage.write32(0) // This is enoguh stub data to not raise exceptions on the backend :)
		return WebsocketSrvc.sendBinary(gwsMessage); // return promise
	};

	GallerySrvc.deleteImage = function(image) {
		console.log('GallerySrvc.deleteImage()', image);
		var gwsMessage = new GWS_Message().cmd(0x1153).sync();
		gwsMessage.write32(image.fileId());
		gwsMessage.writeString('LinkUUp_App');
		gwsMessage.writeString('');
		gwsMessage.write16(EnumSrvc.galleryACLToInt(GallerySrvc.OWN_GALLERY.JSON['gallery_acl']));
		return WebsocketSrvc.sendBinary(gwsMessage).then(()=>true, ErrorSrvc.websocketFormError);
	};

	return GallerySrvc;
});
