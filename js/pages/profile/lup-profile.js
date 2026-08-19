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
	ConfigSrvc, ProfileSrvc, WebsocketSrvc, RoomSrvc, ErrorSrvc, DialogSrvc, HelpSrvc, RenderSrvc) {
	
	$scope.data.title = 'TITLE_PROFILE';
	
	$scope.LikeSrvc = LikeSrvc;
	$scope.FriendSrvc = FriendSrvc;
	$scope.CountrySrvc = CountrySrvc;
	$scope.RenderSrvc = RenderSrvc;

	// The legacy UniteGallery renderer is optional and has historically been
	// fragile with changed image data. Open profiles on the stable About tab;
	// load the gallery only after the user explicitly selects it.
	$scope.data.selectedTab = 0;
	
	$scope.galleryAPI = null; // gallery handle for unitegallery
	
	$scope.data.course = {
		page: 0,
		nPages: 1,
		visits: [],
		working: false,
	};
	
	$scope.data.profile = new GDO_Profile();
	// Gallery data belongs to one profile. Keeping it while the user switches
	// tabs prevents an empty-grid flash and needless websocket round trips.
	$scope.data.galleryLoadedFor = null;
	$scope.data.galleryImages = [];
	$scope.init = function() {
		console.log('ProfileCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.data.ownUser = window.GWF_USER;
			// Do not request the optional timezone catalogue on profile entry. The
			// legacy Date endpoint can stall and its global HTTP loader would hide
			// an otherwise fully usable profile.
			UserSrvc.withUser($routeParams.id, true).then(
				$scope.loadedUser,
				ErrorSrvc.websocketError);
		}
	};
	
	$scope.loadedUser = function(user) {
		console.log('ProfileCtrl.loadedUser()', user);
		if ($scope.data.galleryLoadedFor !== user.id()) {
			$scope.data.galleryLoadedFor = null;
			$scope.data.galleryImages = [];
			$scope.data.galleryReady = false;
		}
		$scope.data.user = user;
		// The legacy help-read websocket command can reject on newer backends and
		// surface an unhelpful "undefined" dialog. Profile loading must not depend
		// on this optional onboarding hint.
		if ($scope.data.selectedTab === 0) {
			$scope.loadInformation();
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
		return $scope.sendAvatarUploadCommand($file.uniqueIdentifier).then(function(response) {
			$flow.removeFile($file);
			return $scope.avatarUploadSuccess(response);
			}, $scope.avatarUploadFailure);
	};

	$scope.sendAvatarUploadCommand = function(flowIdentifier) {
		console.log('ProfileCtrl.sendAvatarUploadCommand()');
		var gwsMessage = new GWS_Message().cmd(0x0402).sync() // Upload Form
		gwsMessage.writeString(flowIdentifier || '');
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
		// A Cuddle belongs to the currently active room. The profile is the
		// deliberate place where its owner shows the code; we never create one for
		// somebody else's profile or without a real room context.
		var rooms = RoomSrvc.getRoomsForUser($scope.data.ownUser);
		var room = rooms.length ? rooms[0] : null;
		if (!room) {
			return ErrorSrvc.showError($translate.instant('err_lup_cuddle_room'), $translate.instant('CUDDLES'));
		}
		var url = LUP_CONFIG.server + 'index.php?_mo=LinkUUp&_me=QRForCuddle&room=' + encodeURIComponent(room.id());
		return DialogSrvc.confirm('js/pages/profile/lup-profile-cuddles-dialog.html', {url: url, room: room});
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
			CourseSrvc.getCourse($scope.data.user).then(
				$scope.gotCourse,
				function(error) {
					$scope.data.course.working = false;
					ErrorSrvc.websocketMaybeJSONError(error);
				});
		}
	};
	
	$scope.gotCourse = function(gwsMessage) {
		console.log('ProfileCtrl.gotCourse()', gwsMessage);
		var visits = [];
		// 0x1160 returns room id, number of visits and last visit timestamp.
		// The old profile code expected an unrelated paginated HTTP response,
		// so it discarded the persisted websocket data after every reload.
		while (gwsMessage.hasMore()) {
			var roomId = gwsMessage.read32();
			var count = gwsMessage.read32();
			var lastVisit = gwsMessage.read32();
			visits.push(new LUPRoomVisit({
				visit_id: 'room-' + roomId,
				visit_user: $scope.data.user.id(),
				visit_room: roomId,
				visit_at: lastVisit,
				visit_count: count,
			}));
		}
		$scope.data.course.page = 1;
		$scope.data.course.nPages = 1;
		$scope.data.course.visits = visits;
		$scope.data.course.working = false;
	};
	
	/////////////////////
	// --- Gallery --- //
	/////////////////////
	$scope.data.galleryAction = window.LUP_CONFIG.server + "index.php?_mo=Gallery&_me=Crud&_ajax=1&_fmt=json&_cors=" + encodeURIComponent(window.LUP_CONFIG.cors);
	
	$scope.showGallery = function(forceReload) {
		console.log('GalleryCtrl.showGallery()');
		if ($scope.data.galleryLoading) {
			return $scope.data.galleryRequest;
		}
		if (!forceReload &&
			$scope.data.galleryLoadedFor === $scope.data.user.id()) {
			return $q.when($scope.data.galleryImages);
		}
		$scope.data.galleryLoading = true;
		$scope.data.galleryError = undefined;
		// Keep the last rendered image grid visible until the replacement data is
		// ready. Clearing it here made tab changes visibly stutter on phones.
		$scope.data.galleryRequest = GallerySrvc.withGalleryForUser($scope.data.user).
			then($scope.withGallery, $scope.galleryError).
			finally(function() {
				$scope.data.galleryLoading = false;
				$scope.data.galleryRequest = null;
			});
		return $scope.data.galleryRequest;
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
			// Keep the gallery image objects intact. Besides their display URLs,
			// they carry the file id required by the delete command.
			$scope.data.galleryImages = gallery.IMAGES;
			$scope.data.galleryLoadedFor = $scope.data.user.id();
			// Native grid rendering is reliable on desktop and phone alike.
		}
	};

	$scope.onGalleryUploaded = function($file, $flow, $msg) {
		console.log('GalleryCtrl.onGalleryUploaded()');
		return GallerySrvc.onGalleryUpload($file.uniqueIdentifier).
			then(function(response) {
				// Allow selecting the very same file again after it was removed
				// from the gallery; otherwise Flow treats it as a duplicate.
				$flow.removeFile($file);
				return $scope.showGallery(true);
			}, ErrorSrvc.websocketFormError);
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
				$scope.showGallery.bind($scope, true),
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
		if (!user) {
			return;
		}
		if (user.isSelf()) {
			return DialogSrvc.confirm('js/pages/profile/lup-profile-cuddle-menu-dialog.html', {
				showQRCode: $scope.showQRCode,
				showCuddles: $scope.gotoCuddles.bind($scope, user),
			});
		}
		return $scope.gotoCuddles(user);
	};

	////////////////////
	// --- Events --- //
	////////////////////
	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);
});
