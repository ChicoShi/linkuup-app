<?php
require "config/lup-php-config.php";
// This HTML document carries the asset build number. Never let a browser keep
// an older copy of it, otherwise it can request yesterday's CSS/JS once before
// the user manually refreshes.
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$v = sprintf("?v=%s", LUPConfig::$VERSION);
$min = LUPConfig::$MIN;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1" />

  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">

  <link rel="stylesheet" href="node_modules/angular-material/angular-material<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/md-color-picker/dist/mdColorPicker<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/angular-jk-rating-stars/dist/jk-rating-stars<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/slick-carousel/slick/slick<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/slick-carousel/slick/slick-theme<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/unitegallery/dist/css/unite-gallery.css<?=$v?>">

  <link rel="stylesheet" href="css/lup3.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-avatar.css<?=$v?>">
  <link rel="stylesheet" href="css/lup.css<?=$v?>">
  <link rel="stylesheet" href="css/header.css<?=$v?>">
  <link rel="stylesheet" href="css/style.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/login/lup-login.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/location/lup-location.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/locations/lup-locations.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/notifications/lup-notifications.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/profile/lup-profile.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/recovery/lup-recovery.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/settings/lup-settings.css<?=$v?>">
  <link rel="stylesheet" href="js/pages/sidenav/lup-sidenav.css<?=$v?>">
  <link rel="stylesheet" href="css/linkuup-design-system.css<?=$v?>">

</head>

<body ng-app="LUP" ng-cloak ng-controller="LUPCtrl">

  <ng-view flex layout-fill layout="row"></ng-view>

  <div ng-if="isLoading()" class="lup-loading" layout="column" layout-align="center center" flex layout-fill>
    <md-progress-circular md-mode="indeterminate"></md-progress-circular>
  </div>

  <script type="text/javascript">
  window.LUP_BUILD = <?=LUPConfig::$VERSION?>;
  </script>

  <script src="node_modules/jquery/dist/jquery.js<?=$v?>"></script>
  <script src="js/3p/jquery-visible.js<?=$v?>"></script>
  <script src="node_modules/jquery.finger/dist/jquery.finger.js<?=$v?>"></script>
  <script src="node_modules/slick-carousel/slick/slick.min.js<?=$v?>"></script>

  <script src="node_modules/moment/min/moment-with-locales.min.js<?=$v?>"></script>
  <script src="node_modules/moment-timezone/builds/moment-timezone-with-data.js<?=$v?>"></script>
  <script src="node_modules/angular/angular.js<?=$v?>"></script>
  <script src="node_modules/angular-animate/angular-animate.js<?=$v?>"></script>
  <script src="node_modules/angular-aria/angular-aria.js<?=$v?>"></script>
  <script src="node_modules/angular-messages/angular-messages.js<?=$v?>"></script>
  <script src="node_modules/angular-route/angular-route.js<?=$v?>"></script>
  <script src="node_modules/angular-sanitize/angular-sanitize.js<?=$v?>"></script>
  <script src="node_modules/angular-translate/dist/angular-translate.js<?=$v?>"></script>
  <script src="node_modules/angular-translate-loader-static-files/angular-translate-loader-static-files.js<?=$v?>"></script>
  <script src="node_modules/angular-material/angular-material.js<?=$v?>"></script>
  <script src="node_modules/tinycolor2/tinycolor.js<?=$v?>"></script>
  <script src="node_modules/md-color-picker/dist/mdColorPicker.js<?=$v?>"></script>
  <script src="node_modules/angular-jk-rating-stars/dist/jk-rating-stars.js<?=$v?>"></script>
  <script src="node_modules/angular-inview/angular-inview.js<?=$v?>"></script>

  <script src="node_modules/opening_hours/build/opening_hours.js"></script>

  <script src="node_modules/@flowjs/flow.js/dist/flow.js<?=$v?>"></script>
  <script src="node_modules/ng-flow/dist/ng-flow.js<?=$v?>"></script>

  <script src="node_modules/unitegallery/dist/js/unitegallery.js<?=$v?>"></script>
  <script src="node_modules/unitegallery/dist/themes/tiles/ug-theme-tiles.js<?=$v?>"></script>

  <script src="config/lup-app-config.js<?=$v?>"></script>

  <script src="js/util/gwf-debug.js<?=$v?>"></script>
  <script src="js/util/gwf-string-util.js<?=$v?>"></script>

  <script src="js/model/gdo-profile.js<?=$v?>"></script>
  <script src="js/model/lup-comment.js<?=$v?>"></script>
  <script src="js/model/lup-message.js<?=$v?>"></script>
  <script src="js/model/gwf-user.js<?=$v?>"></script>
  <script src="js/model/gwf-pagination.js<?=$v?>"></script>
  <script src="js/model/gws-message.js<?=$v?>"></script>
  <script src="js/model/lup-room.js<?=$v?>"></script>
  <script src="js/model/lup-room-visit.js<?=$v?>"></script>
  <script src="js/model/lup-query.js<?=$v?>"></script>
  <script src="js/model/lup-query-message.js<?=$v?>"></script>
  <script src="js/model/lup-notification.js<?=$v?>"></script>
  <script src="js/model/lup-gallery.js<?=$v?>"></script>
  <script src="js/model/lup-gallery-image.js<?=$v?>"></script>

  <script src="config/lup-module.js<?=$v?>"></script>
  <script src="config/lup-config.js<?=$v?>"></script>

  <script src="js/directives/compile.js<?=$v?>"></script>
  <script src="js/directives/lup-avatar.js<?=$v?>"></script>
  <script src="js/directives/lup-message-state.js<?=$v?>"></script>
  <script src="js/directives/ng-enter.js<?=$v?>"></script>
  <script src="js/directives/ng-file-select.js<?=$v?>"></script>
  <script src="js/directives/on-long-press.js<?=$v?>"></script>

  <script src="js/filters/lup-msg-date-filter.js<?=$v?>"></script>
  <script src="js/filters/lup-vote-percent-filter.js<?=$v?>"></script>

  <script src="js/service/lup-auth-service.js<?=$v?>"></script>
  <script src="js/service/lup-category-service.js<?=$v?>"></script>
  <script src="js/service/lup-chat-service.js<?=$v?>"></script>
  <script src="js/service/lup-config-service.js<?=$v?>"></script>
  <script src="js/service/lup-country-service.js<?=$v?>"></script>
  <script src="js/service/lup-course-service.js<?=$v?>"></script>
  <script src="js/service/lup-comment-service.js<?=$v?>"></script>
  <script src="js/service/lup-dialog-service.js<?=$v?>"></script>
  <script src="js/service/lup-enum-service.js<?=$v?>"></script>
  <script src="js/service/lup-error-service.js<?=$v?>"></script>
  <script src="js/service/lup-exception-service.js<?=$v?>"></script>
  <script src="js/service/lup-friend-service.js<?=$v?>"></script>
  <script src="js/service/lup-fx-service.js<?=$v?>"></script>
  <script src="js/service/lup-gallery-service.js<?=$v?>"></script>
  <script src="js/service/lup-help-service.js<?=$v?>"></script>
  <script src="js/service/lup-like-service.js<?=$v?>"></script>
  <script src="js/service/lup-loading-service.js<?=$v?>"></script>
  <script src="js/service/lup-logo-service.js<?=$v?>"></script>
  <script src="js/service/lup-notification-service.js<?=$v?>"></script>
  <script src="js/service/lup-position-service.js<?=$v?>"></script>
  <script src="js/service/lup-profile-service.js<?=$v?>"></script>
  <script src="js/service/lup-render-service.js<?=$v?>"></script>
  <script src="js/service/lup-request-interceptor.js<?=$v?>"></script>
  <script src="js/service/lup-request-service.js<?=$v?>"></script>
  <script src="js/service/lup-room-service.js<?=$v?>"></script>
  <script src="js/service/lup-settings-service.js<?=$v?>"></script>
  <script src="js/service/lup-storage-service.js<?=$v?>"></script>
  <script src="js/service/lup-timezone-service.js<?=$v?>"></script>
  <script src="js/service/lup-type-service.js<?=$v?>"></script>
  <script src="js/service/lup-user-service.js<?=$v?>"></script>
  <script src="js/service/lup-websocket-service.js<?=$v?>"></script>

  <script src="js/controller/lup-ctrl.js<?=$v?>"></script>
  <script src="js/controller/gwf-upload-ctrl.js<?=$v?>"></script>

  <script src="js/pages/account/lup-account.js<?=$v?>"></script>
  <script src="js/pages/debug/lup-debug.js<?=$v?>"></script>
  <script src="js/pages/login/lup-login.js<?=$v?>"></script>
  <script src="js/pages/register/lup-register.js<?=$v?>"></script>
  <script src="js/pages/recovery/lup-recovery.js<?=$v?>"></script>
  <script src="js/pages/comments/lup-comments.js<?=$v?>"></script>
  <script src="js/pages/course/lup-course.js<?=$v?>"></script>
  <script src="js/pages/location/lup-location.js<?=$v?>"></script>
  <script src="js/pages/location/lup-room-vote-ctrl.js<?=$v?>"></script>
  <script src="js/pages/location/lup-new-location.js<?=$v?>"></script>
  <script src="js/pages/locations/lup-locations.js<?=$v?>"></script>
  <script src="js/pages/profile/lup-profile.js<?=$v?>"></script>
  <script src="js/pages/profile/lup-profile-settings.js<?=$v?>"></script>
  <script src="js/pages/settings/lup-settings.js<?=$v?>"></script>
  <script src="js/pages/query/lup-query.js<?=$v?>"></script>
  <script src="js/pages/notifications/lup-notification.js<?=$v?>"></script>
  <script src="js/pages/friends/lup-friends.js<?=$v?>"></script>
  <script src="js/pages/friends/lup-search-friends.js<?=$v?>"></script>
  <script src="js/pages/likes/lup-likes.js<?=$v?>"></script>

</body>
</html>
