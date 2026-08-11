"use strict";

/**
 * Gallery image.
 */
function LUPGalleryImage(json) {
	console.log('new LUPGalleryImage()', json);
	this.JSON = json;
	this.setJSON = function(json) { this.JSON = json; };
	
	this.isAddButton = false;

	this.id = function() { return this.JSON.files_id; };
	this.fileId = function() { return this.JSON.files_file; };
	// Variants are created asynchronously. Use the original immediately so a
	// freshly uploaded image is visible even before its thumbnail exists.
	this.thumbURL = function() { return window.LUP_CONFIG.server + "index.php?_mo=Gallery&_me=Image&nodisposition=1&id=" + this.id(); };
	this.imageURL = function() { return window.LUP_CONFIG.server + "index.php?_mo=Gallery&_me=Image&nodisposition=1&id=" + this.id(); };
	this.description = function() { return "Gallery Image"; }
}

/**
 * Fake add button
 */
function LUPGalleryAddImage() {
	this.isAddButton = true;
	this.thumbURL = function() { return "images/add-image.png"; };
	this.imageURL = function() { return "images/add-image.png"; };
}
