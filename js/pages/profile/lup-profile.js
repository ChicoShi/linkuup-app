"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/profile/:id', {
		templateUrl: 'js/pages/profile/lup-profile.html?v='+window.LUP_BUILD,
		controller: 'ProfileCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('ProfileCtrl', function($scope, $routeParams, $translate, $q, $timeout, $location,
	UserSrvc, LikeSrvc, FriendSrvc, GallerySrvc, CourseSrvc, CountrySrvc, TimezoneSrvc,
	ConfigSrvc, ProfileSrvc, SettingsSrvc, WebsocketSrvc, ErrorSrvc, DialogSrvc, HelpSrvc, RenderSrvc) {
	
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
	$scope.data.profileGroups = [];
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
		$scope.data.profileGroups = [];
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

	$scope.openProfileSettings = function(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		// Use the local route directly. The generic delayed navigation can be
		// swallowed by the surrounding legacy list item on this profile view.
		$location.path('/settings');
	};

	// An Up is intentionally a deliberate pull on the yellow profile marker,
	// not another crowded action button. The server stays authoritative for the
	// number; this state only locks the gesture until its request has settled.
	$scope.profilePullUp = function() {
		var user = $scope.data.user;
		if (!user || $scope.data.profileUpWorking) {
			return;
		}
		if (user.isSelf()) {
			var selfUpHintKey = 'lup-profile-self-up-hint';
			if (!window.localStorage.getItem(selfUpHintKey)) {
				window.localStorage.setItem(selfUpHintKey, '1');
				DialogSrvc.openHTMLDialog('<p>Du kannst dir selbst keinen Up geben.</p>', 'Up');
			}
			return;
		}
		$scope.data.profileUpWorking = true;
		LikeSrvc.likeUser(user).finally(function() {
			$timeout(function() {
				$scope.data.profileUpWorking = false;
			}, 440);
		});
	};
	$scope.profilePullLocations = function() { return $scope.gotoUserCourse($scope.data.user); };
	$scope.profilePullFriends = function() {
		var user = $scope.data.user;
		if (!user) {
			return;
		}
		// Friend lists are private by default. The Friends marker on another
		// profile is therefore a deliberate relationship gesture, not a route
		// into a list the visitor may not see.
		if (user.isSelf()) {
			return $scope.gotoUserFriends(user);
		}
		if (!user.isMember() || !$scope.data.ownUser || !$scope.data.ownUser.isMember()) {
			return;
		}
		if (user.isFriend()) {
			return FriendSrvc.removeFriend(user);
		}
		if (user.JSON.relation_pending) {
			return FriendSrvc.cancelFriendRequest(user);
		}
		return FriendSrvc.addFriend(user);
	};
	$scope.profilePullCuddles = function() { return $scope.gotoUserCuddles($scope.data.user); };
	$scope.profilePullMessage = function() { return $scope.openQuery($scope.data.user); };
	// A short tap remains navigation. Pulling is the deliberate gesture; it can
	// perform a distinct action (the Up) without hiding any profile overview.
	$scope.profileOpenLocations = function() { return $scope.gotoUserCourse($scope.data.user); };
	$scope.profileOpenUps = function() { return $scope.gotoLikes($scope.data.user); };
	$scope.profileOpenFriends = function() {
		if ($scope.data.user && $scope.data.user.isSelf()) {
			return $scope.gotoUserFriends($scope.data.user);
		}
	};
	$scope.profileOpenCuddles = function() { return $scope.gotoUserCuddles($scope.data.user); };
	$scope.profileOpenMessage = function() { return $scope.openQuery($scope.data.user); };
	
	///////////////////
	// Avatar Upload //
	///////////////////
	$scope.canUploadProfile = function() {
		// The rendered profile, not merely the signed-in account, decides whether
		// an upload control may exist. Otherwise a foreign profile could briefly
		// expose the current user's Flow uploader while the route is changing.
		let profileUser = $scope.data.user;
		let ownUser = $scope.data.ownUser;
		if (!profileUser || !ownUser || !profileUser.isSelf() || profileUser.id() !== ownUser.id()) {
			return false;
		}
		if ( (!ConfigSrvc.guestAvatars()) && (ownUser.isGuest()) ) {
			return false;
		}
		return true;
	};
	
	$scope.clickAvatarError = function() {
		if ($scope.data.user && $scope.data.user.isSelf() && $scope.data.ownUser && $scope.data.ownUser.isGuest()) {
			ErrorSrvc.showError($translate.instant('err_no_guest_avatar'), 'Avatar');
		}
	};
	
	$scope.onFileUploaded = function($file, $flow, $msg) {
		console.log('ProfileCtrl.onFileUploaded()', $file, $flow, $msg);
		if (!$scope.canUploadProfile()) {
			$flow.removeFile($file);
			return $q.reject($translate.instant('ERR_OWN_AVATAR_ONLY'));
		}
		return $scope.sendAvatarUploadCommand($file.uniqueIdentifier).then(function(response) {
			$flow.removeFile($file);
			return $scope.avatarUploadSuccess(response);
			}, $scope.avatarUploadFailure);
	};

	$scope.sendAvatarUploadCommand = function(flowIdentifier) {
		console.log('ProfileCtrl.sendAvatarUploadCommand()');
		if (!$scope.canUploadProfile()) {
			return $q.reject($translate.instant('ERR_OWN_AVATAR_ONLY'));
		}
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
		// A Cuddle is bound to two users and the UTC day, not to a room. The profile
		// is the deliberate place where its owner chooses to show the short-lived QR.
		var url = LUP_CONFIG.server + 'index.php?_mo=LinkUUp&_me=QRForCuddle';
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
		$scope.rebuildProfileGroups();
		// Profile values and their human labels arrive through two independent
		// endpoints. If the settings catalogue was still loading, the old code
		// rendered anonymous/empty cards and never revisited them.
		if (!SettingsSrvc.CACHE) {
			SettingsSrvc.withConfig().then(function() {
				$scope.rebuildProfileGroups();
			}, angular.noop);
		}
	};

	$scope.rebuildProfileGroups = function() {
		$scope.data.profileGroups = $scope.buildProfileGroups($scope.data.profile);
	};

	$scope.$on('lup-profile-setting-saved', function(event, setting) {
		// Only the signed-in person's profile can be affected by Settings. Reload
		// its server-filtered public data so privacy changes are reflected too.
		if ($scope.data.user && $scope.data.user.isSelf() && setting) {
			$scope.loadInformation();
		}
	});

	$scope.moduleLabel = function(module) {
		return 'module_' + String(module).toLowerCase();
	};

	$scope.buildProfileGroups = function(profile) {
		/* “About me” is a public profile, not a mirror of account settings.
		 * Privacy rules, activity preferences and friendship policies belong in
		 * Settings.  Only voluntary, person-facing facts are useful to a visitor. */
		var profileSections = {
			User: {label: 'PROFILE_SECTION_BASICS', sort: 10, fields: ['gender']},
			LinkUUp: {label: 'PROFILE_SECTION_LOCAL', sort: 20, fields: ['lup_status', 'lup_state', 'lup_city']},
			About: {label: 'PROFILE_SECTION_ABOUT', sort: 30, fields: [
				'lup_eyecolor', 'lup_height', 'lup_interest', 'lup_sexo',
				'lup_has_pet', 'lup_drinks', 'lup_smokes', 'lup_sporty', 'lup_religion'
			]},
		};
		var fieldOrder = {};
		Object.keys(profileSections).forEach(function(section) {
			profileSections[section].fields.forEach(function(key, index) {
				fieldOrder[key] = {section: section, sort: index};
			});
		});
		var groups = {};
		var profileLabels = {
			gender: 'SETTING_LABEL_GENDER', lup_status: 'SETTING_LABEL_STATUS',
			lup_state: 'SETTING_LABEL_STATE', lup_city: 'SETTING_LABEL_CITY',
			lup_eyecolor: 'SETTING_LABEL_EYE_COLOR', lup_height: 'SETTING_LABEL_HEIGHT',
			lup_interest: 'SETTING_LABEL_INTEREST', lup_sexo: 'SETTING_LABEL_ORIENTATION',
			lup_has_pet: 'SETTING_LABEL_PET', lup_drinks: 'SETTING_LABEL_DRINKS',
			lup_smokes: 'SETTING_LABEL_SMOKES', lup_sporty: 'SETTING_LABEL_SPORT',
			lup_religion: 'SETTING_LABEL_RELIGION'
		};
		var cache = SettingsSrvc.CACHE || {};
		for (var module in cache) {
			for (var key in cache[module]) {
				var setting = cache[module][key];
				var placement = fieldOrder[key];
				if (!placement || !setting) {
					continue;
				}
				// Legacy display helpers initialise a few optional enums with "0".
				// The profile frame still knows that they were actually absent, and
				// an absent field must not turn into a visible "not specified" row.
				if (profile.EMPTY[key]) {
					continue;
				}
				var value = (profile.JSON || {})[key];
				// Do not turn an absent optional enum (often represented as 0 by a
				// legacy endpoint) into an empty profile card.
				var hasValue = value !== undefined && value !== null && value !== '' && value !== '0';
				var error = (profile.ERRORS || {})[key];
				// Only values and meaningful ACL errors deserve a row. Empty settings
				// are intentionally omitted from the public profile.
				if (!hasValue && !error) {
					continue;
				}
				var section = profileSections[placement.section];
				groups[placement.section] = groups[placement.section] || {
					module: placement.section,
					label: section.label,
					sort: section.sort,
					fields: [],
				};
				groups[placement.section].fields.push({
					key: key,
					sort: placement.sort,
					setting: setting,
					label: profileLabels[key] || setting.label || key,
					value: value,
					error: error,
					// This is the target user's stored ACL relation from GWS_Profile,
					// not the module default carried by SettingsSrvc.CACHE.
					acl: profile.ACL[key],
				});
			}
		}
		var result = Object.keys(groups).map(function(module) { return groups[module]; }).sort(function(a, b) {
			return a.sort - b.sort || a.module.localeCompare(b.module);
		});
		result.forEach(function(group) {
			group.fields.sort(function(a, b) { return a.sort - b.sort; });
		});
		return result;
	};

	$scope.renderProfileSetting = function(field) {
		return RenderSrvc.renderClass(field.setting, field.value);
	};

	$scope.profileFieldIcon = function(key) {
		var icons = {
			gender: 'person_outline',
			lup_status: 'chat_bubble_outline',
			lup_state: 'explore',
			lup_city: 'location_city',
			lup_eyecolor: 'visibility',
			lup_height: 'height',
			lup_interest: 'auto_awesome',
			lup_sexo: 'favorite_outline',
			lup_has_pet: 'pets',
			lup_drinks: 'local_bar',
			lup_smokes: 'smoke_free',
			lup_sporty: 'directions_run',
			lup_religion: 'self_improvement'
		};
		return icons[key] || 'tune';
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
		// 0x1160 can carry an empty legacy tail. A visit always contains three
		// uint32 values, so never begin parsing unless the full record is present.
		while (gwsMessage.LENGTH - gwsMessage.INDEX >= 12) {
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
		if (gwsMessage.hasMore()) {
			console.warn('Ignoring incomplete profile-course payload tail.');
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
			$scope.data.gallery = gallery;
			// Keep the gallery image objects intact. Besides their display URLs,
			// they carry the file id required by the delete command.
			$scope.data.galleryImages = gallery.IMAGES;
			$scope.data.galleryLoadedFor = $scope.data.user.id();
			// Native grid rendering is reliable on desktop and phone alike.
		}
	};

	$scope.onGalleryUploaded = function($file, $flow, $msg) {
		console.log('GalleryCtrl.onGalleryUploaded()');
		return GallerySrvc.onGalleryUpload($file.uniqueIdentifier, $scope.data.gallery).
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
		return GallerySrvc.deleteImage(image, $scope.data.gallery).then(
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
		// Your own visit history is always private-to-you and the server's
		// optional ACL preflight can reject an empty legacy response. Go directly
		// to the course view for the signed-in profile; the course endpoint itself
		// remains the authoritative access check for every other profile.
		if (user && user.isSelf()) {
			return $scope.gotoCourse(user);
		}
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

/* A small physical pull interaction for the profile Up marker. Pointer events
 * cover mouse, touch and pen without a second mobile-only event path. */
angular.module('LUP').directive('lupPullAction', function($timeout) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			var node = element[0];
			var pointerId = null;
			var startY = 0;
			var pull = 0;
			var threshold = 26;
			var maximum = 42;
			var pointerInteraction = false;
			var pullEffect = attrs.lupPullEffect || '';

			var openOverview = function() {
				scope.$applyAsync(function() {
					scope.$eval(attrs.lupPullOpen || attrs.lupPullAction);
				});
			};

			var setPull = function(value) {
				pull = Math.max(0, Math.min(maximum, value));
				element.css('--lup-up-pull', pull + 'px');
				element.toggleClass('is-pulling', pull > 2);
			};
			var release = function(event) {
				if (pointerId === null || (event && event.pointerId !== pointerId)) {
					return;
				}
				var accepted = pull >= threshold;
				pointerId = null;
				if (accepted) {
					// Complete the physical pull before the spring-back animation so the
					// visible cord reaches its latch even if the finger stopped early.
					setPull(maximum);
					element.addClass('is-released');
					if (pullEffect) {
						element.addClass(pullEffect);
					}
					scope.$applyAsync(function() { scope.$eval(attrs.lupPullAction); });
					$timeout(function() {
						setPull(0);
						element.removeClass('is-released ' + pullEffect);
					}, 460, false);
				}
				else {
					setPull(0);
					openOverview();
				}
				$timeout(function() { pointerInteraction = false; }, 0, false);
			};

			element.on('pointerdown', function(event) {
				if (scope.data.profileUpWorking || event.button > 0) {
					return;
				}
				pointerId = event.pointerId;
				pointerInteraction = true;
				startY = event.clientY;
				setPull(0);
				if (node.setPointerCapture) {
					node.setPointerCapture(pointerId);
				}
				event.preventDefault();
			});
			element.on('pointermove', function(event) {
				if (pointerId !== event.pointerId) {
					return;
				}
				setPull(event.clientY - startY);
				event.preventDefault();
			});
			element.on('pointerup pointercancel', release);
			element.on('click', function(event) {
				event.preventDefault();
				event.stopPropagation();
				// Pointer taps already opened their overview on pointerup. Keyboard
				// activation reaches this handler directly and stays accessible.
				if (!pointerInteraction) {
					openOverview();
				}
			});
			scope.$on('$destroy', function() {
				element.off('pointerdown pointermove pointerup pointercancel click');
			});
		},
	};
});
