"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/profile/:id', {
		templateUrl: 'js/pages/profile/lup-profile.html?v='+window.LUP_BUILD,
		controller: 'ProfileCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('ProfileCtrl', function($scope, $routeParams, $translate, $q,
		UserSrvc, LikeSrvc, FriendSrvc, GallerySrvc, CourseSrvc, CountrySrvc, TimezoneSrvc,
		ConfigSrvc, ProfileSrvc, WebsocketSrvc, ErrorSrvc, DialogSrvc, HelpSrvc, RenderSrvc) {
	
	$scope.data.title = 'TITLE_PROFILE';
	
	$scope.LikeSrvc = LikeSrvc;
	$scope.FriendSrvc = FriendSrvc;
	$scope.CountrySrvc = CountrySrvc;
	$scope.RenderSrvc = RenderSrvc;

	$scope.data.selectedTab = $scope.data.selectedTab === undefined ? 1 : $scope.data.selectedTab;
	
	$scope.galleryAPI = null; // gallery handle for unitegallery
	
	$scope.data.course = {
		page: 0,
		nPages: 1,
		visits: [],
		working: false,
	};
	
	$scope.data.profile = new GDO_Profile();
	$scope.profileDetailIcon = function(key) {
		var k = String(key || '').toLowerCase();
		if (k.indexOf('sport') >= 0) return 'fitness_center';
		if (k.indexOf('smok') >= 0) return 'smoking_rooms';
		if (k.indexOf('drink') >= 0 || k.indexOf('alcohol') >= 0) return 'local_bar';
		if (k.indexOf('work') >= 0 || k.indexOf('job') >= 0) return 'work';
		if (k.indexOf('student') >= 0 || k.indexOf('school') >= 0) return 'school';
		if (k.indexOf('relig') >= 0) return 'auto_awesome';
		if (k.indexOf('pet') >= 0) return 'pets';
		if (k.indexOf('city') >= 0 || k.indexOf('origin') >= 0 || k.indexOf('country') >= 0) return 'place';
		if (k.indexOf('gender') >= 0 || k.indexOf('sexo') >= 0 || k.indexOf('interest') >= 0) return 'favorite';
		return 'push_pin';
	};
	
	$scope.init = function() {
		console.log('ProfileCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.ownUser = window.GWF_USER;
			const timezones = TimezoneSrvc.withTimezones()
			const user = UserSrvc.withUser($routeParams.id, true).catch(ErrorSrvc.websocketError);
			$q.all({
				timezones: timezones,
				user: user,
			}).then(function(result) {
				$scope.loadedUser(result.user);
			});
		}
	};
	
	$scope.loadedUser = function(user) {
		console.log('ProfileCtrl.loadedUser()', user);
		$scope.data.user = user;
		$scope.showHelp();
		if ($scope.data.selectedTab === 0) {
			$scope.loadInformation();
		}
		if ($scope.data.selectedTab === 1) {
			$scope.showGallery();
		}
	};

	$scope.showHelp = function() {
		console.log('ProfileCtrl.showHelp()');
		if ($scope.data.user.isSelf()) {
			HelpSrvc.showHelp('own_profile', $translate.instant('HELP_OWN_PROFILE'));
		} else {
			HelpSrvc.showHelp('other_profile', $translate.instant('HELP_OTHER_PROFILE'));
		}
	};

	$scope.openQuery = function(user) {
		console.log('ProfileCtrl.openQuery()', user);
		$scope.gotoQuery(user);
	};
	
	///////////////////
	// Avatar Upload //
	///////////////////
	$scope.canUploadProfile = function() {
		let user = $scope.data.ownUser;
		if ( (!user) || (!user.isSelf()) ) {
			return false;
		}
		if ( (!ConfigSrvc.guestAvatars()) && (user.isGuest()) ) {
			return false;
		}
		return true;
	};
	
	$scope.clickAvatarError = function() {
		if ($scope.data.ownUser.isSelf()) {
			ErrorSrvc.showError($translate.instant('err_no_guest_avatar'), 'Avatar');
		}
	};
	
	$scope.onFileUploaded = function($file, $flow, $msg) {
		console.log('ProfileCtrl.onFileUploaded()', $file, $flow, $msg);
		return $scope.sendAvatarUploadCommand().then(function(response) {
			$flow.removeFile($file);
			return $scope.avatarUploadSuccess(response);
			}, $scope.avatarUploadFailure);
	};

	$scope.sendAvatarUploadCommand = function() {
		console.log('ProfileCtrl.sendAvatarUploadCommand()');
		var gwsMessage = new GWS_Message().cmd(0x0402).sync() // Upload Form
		gwsMessage.write32(0); // Needed stub byte for GDT_File.
		return WebsocketSrvc.sendBinary(gwsMessage);
	};

	$scope.avatarUploadSuccess = function() {
		console.log('ProfileCtrl.avatarUploadSuccess()');
	};

	$scope.avatarUploadFailure = function(response) {
		console.log('ProfileCtrl.avatarUploadFailure()', response);
		return ErrorSrvc.websocketError(response);
	};

	////////////////////
	// --- QRCode --- //
	////////////////////
	$scope.showQRCode = function() {
		let url = LUP_CONFIG.server + 'linkuup;qrforprofile;user_id;' + $scope.data.ownUser.id() + '.html?lang=en';
		return DialogSrvc.confirm('js/pages/profile/lup-profile-cuddles-dialog.html', {url: url});
	}

	/////////////////////////
	// --- Information --- //
	/////////////////////////
	$scope.loadInformation = function() {
		console.log('ProfileCtrl.loadInformation()');
		return ProfileSrvc.withProfile($scope.data.user).then(
				$scope.loadedInformation, ErrorSrvc.websocketError);
	};
	$scope.loadedInformation = function(profile) {
		console.log('ProfileCtrl.loadedInformation()', profile);
		$scope.data.profile = profile;
	};
	
	$scope.countryURL = function(user) {
		return CountrySrvc.countryURL(user.countryId());
	};

	////////////////////
	// --- Course --- //
	////////////////////
	$scope.showCourse = function() {
		console.log('ProfileCtrl.showCourse()');
		HelpSrvc.showHelp('profile_course', $translate.instant('HELP_COURSE'));
		$scope.data.course.page = 0;
		$scope.data.course.nPages = 1;
		$scope.data.course.visits = [];
		$scope.showNextCoursePage();
	};
	
	$scope.showNextCoursePage = function() {
		console.log('ProfileCtrl.showNextCoursePage()', $scope.data.course.page+1);
		if ( (!$scope.data.course.working) &&
			 ($scope.data.user) &&
			 ($scope.data.course.page < $scope.data.course.nPages) ) {
			$scope.data.course.working = true;
			CourseSrvc.getCourse($scope.data.user, $scope.data.course.page+1).then(
					$scope.gotCourse);
		}
	};
	
	$scope.gotCourse = function(data) {
		console.log('ProfileCtrl.gotCourse()', data);
		// Copy pagemenu
		var pagemenu = data[0];
		$scope.data.course.page = pagemenu.page;
		$scope.data.course.nPages = pagemenu.nPages;
		// Merge visits
		var course = data[1];
		$scope.data.course.visits = $scope.data.course.visits.concat(course);
		$scope.data.course.working = false;
	};
	
	/////////////////////
	// --- Gallery --- //
	/////////////////////
	$scope.data.galleryAction = window.LUP_CONFIG.server + "index.php?_mo=Gallery&_me=Crud&_ajax=1&_fmt=json&_cors=" + encodeURIComponent(window.LUP_CONFIG.cors);
	
	$scope.showGallery = function() {
		console.log('GalleryCtrl.showGallery()');
		// Query websocket
		$scope.data.galleryImages = [];
		$scope.data.galleryError = undefined;
		$scope.data.galleryReady = false;
		$('#gallery-list *').remove();
		GallerySrvc.withGalleryForUser($scope.data.user).
			then($scope.withGallery, $scope.galleryError);
	};
	
	$scope.galleryError = function(response) {
		console.log('GalleryCtrl.galleryError()', response);
		$scope.data.galleryError = response;
	};

	$scope.withGallery = function(gallery) {
		console.log('GalleryCtrl.withGallery()', gallery);
		if (gallery) {
			// Flow uploads must target the persisted gallery, otherwise the file
			// reaches the server without being attached to this user's gallery.
			$scope.data.galleryAction = window.LUP_CONFIG.server + "index.php?_mo=Gallery&_me=Crud&id=" +
				encodeURIComponent(gallery.id()) + "&edit=1&_ajax=1&_fmt=json&_cors=" +
				encodeURIComponent(window.LUP_CONFIG.cors);
			$scope.data.galleryReady = !!gallery.id();
			const images = gallery.IMAGES;
			$scope.data.galleryImages = images.map(function(image) {
				return {
					id: image.id(),
					description: image.description(),
					imageURL: image.imageURL(),
					thumbURL: image.thumbURL(),
				};
			});
			// Native grid rendering is reliable on desktop and phone alike.
		}
	};

	$scope.onGalleryUploaded = function($file, $flow, $msg) {
		console.log('GalleryCtrl.onGalleryUploaded()');
		return GallerySrvc.onGalleryUpload().
			then($scope.showGallery, ErrorSrvc.websocketFormError);
	};
	
	/**
	 * Enable slick mode.
	 */
	$scope.slickGallery = function(nofocus) {
		console.log('LocationsCtrl.slickGallery()');
		if (!$scope.data.slicked) {
			$scope.data.slicked = true;
			$scope.galleryAPI = $('#gallery-list').unitegallery({
				tiles_type:"nested",
				gallery_theme:"tiles"
			});
			window.jQuery('#gallery-list').on('press', '.ug-tile', function(e) {
				// Find image by source and call delete
				var src = $(this).find('img').attr('src');
				for (var i in $scope.data.galleryImages) {
					var image = $scope.data.galleryImages[i];
					if (image.thumbURL() == src) {
						return $scope.deleteGalleryImage(image);
					}
				}
			});
		}
		// Apply new DOM to angular
		setTimeout($scope.$apply.bind($scope), 1);
	};

	/**
	 * Delete gallery image.
	 */
	$scope.deleteGalleryImage = function(image) {
		console.log('GalleryCtrl.deleteGalleryImage()', image);
		var dialogURL = "js/pages/profile/lup-gallery-delete.html";
		var dialogData = {
			image: image,
		};
		return DialogSrvc.confirm(dialogURL, dialogData).then(
				$scope.reallyDeleteGalleryImage.bind($scope, image));
	};
	
	$scope.reallyDeleteGalleryImage = function(image) {
		console.log('GalleryCtrl.deleteGalleryImage()', image);
		return GallerySrvc.deleteImage(image).then(
				$scope.showGallery, 
				ErrorSrvc.websocketFormError);
	};
	
	///////////////////////////
	// --- Delete Friend --- //
	///////////////////////////
	
	////////////////////////////////////////
	// --- Goto with permission check --- //
	////////////////////////////////////////
	$scope.gotoUserCourse = function(user) {
		console.log('ProfileCtrl.gotoUserCourse()', user);
		CourseSrvc.getCourseAllowed(user).then(
				$scope.gotoCourse.bind($scope, user),
				ErrorSrvc.websocketMaybeJSONError.bind(ErrorSrvc)
			);
	};
	
	$scope.gotoUserFriends = function(user) {
		console.log('ProfileCtrl.gotoUserFriends()', user);
		FriendSrvc.isFriendListAllowed(user).then(
				$scope.gotoFriends.bind($scope, user),
				ErrorSrvc.websocketMaybeJSONError.bind(ErrorSrvc)
			);
	};

	$scope.gotoUserCuddles = function(user) {
		console.log('ProfileCtrl.gotoUserCuddles()', user);
		if (user && user.isSelf()) {
			$scope.showQRCode();
		}
	};

	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
