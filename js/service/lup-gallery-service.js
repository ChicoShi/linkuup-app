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
		// Keep this legacy reference for old callers, but all profile operations
		// below receive their gallery explicitly. A late reply for another profile
		// must never redirect an upload or delete request.
		GallerySrvc.OWN_GALLERY = gallery;
		
		// Parse all images
		while (gwsMessage.hasMore()) {
			// Parse image
			var image = new LUPGalleryImage({});
			try {
				TypeSrvc.parseBinaryGDO(gwsMessage, "GDO\\Gallery\\GDO_GalleryImage", image);
				if (gwsMessage.TRUNCATED) {
					console.warn('Ignoring truncated gallery image payload.');
					break;
				}
			} catch (error) {
				// Older servers can append an incomplete optional image tail. Keep
				// the valid gallery instead of turning this into a broken profile.
				console.warn('Ignoring incomplete gallery image payload.', error);
				gwsMessage.index(gwsMessage.LENGTH);
				break;
			}
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
	GallerySrvc.onGalleryUpload = function(flowIdentifier, gallery) {
		console.log('GallerySrvc.onGalleryUpload()');
		gallery = gallery || GallerySrvc.OWN_GALLERY;
		if (!gallery || !gallery.id()) {
			return Promise.reject(new Error('Gallery is not ready for upload.'));
		}
		// Call 0x1152 LUPWS_GalleryUpload
		var gwsMessage = new GWS_Message().cmd(0x1152).sync();
		gwsMessage.write32(gallery.id());
		gwsMessage.writeString('LinkUUp_App'); // Title is notNull.
		gwsMessage.writeString(''); // Description empty
		gwsMessage.write16(EnumSrvc.galleryACLToInt(gallery.JSON['gallery_acl']));
		gwsMessage.writeString(flowIdentifier || '');
//		gwsMessage.write32(0) // This is enoguh stub data to not raise exceptions on the backend :)
		return WebsocketSrvc.sendBinary(gwsMessage); // return promise
	};

	GallerySrvc.deleteImage = function(image, gallery) {
		console.log('GallerySrvc.deleteImage()', image);
		gallery = gallery || GallerySrvc.OWN_GALLERY;
		if (!gallery || !gallery.id()) {
			return Promise.reject(new Error('Gallery is not ready for deletion.'));
		}
		var gwsMessage = new GWS_Message().cmd(0x1153).sync();
		gwsMessage.write32(image.fileId());
		gwsMessage.writeString('LinkUUp_App');
		gwsMessage.writeString('');
		gwsMessage.write16(EnumSrvc.galleryACLToInt(gallery.JSON['gallery_acl']));
		return WebsocketSrvc.sendBinary(gwsMessage).then(()=>true, ErrorSrvc.websocketFormError);
	};

	return GallerySrvc;
});
