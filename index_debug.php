<?php
require "config/lup-php-config.php";
// This HTML document carries the asset build number. Never let a browser keep
// an older copy of it, otherwise it can request yesterday's CSS/JS once before
// the user manually refreshes.
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
/* Keep a deployable cache marker in tracked code.  The local PHP config is
 * intentionally ignored by git, so a view repair must not depend on a local
 * version bump to reach browsers after a pull request is deployed. */
$v = sprintf("?v=%s-local-ui298", LUPConfig::$VERSION);
$min = LUPConfig::$MIN;
$publicBase = 'https://app.www.linkuup.de';
$shareImage = "{$publicBase}/images/lup-wapp-icon.png";
?>
<!DOCTYPE html>
<html lang="de" translate="no">
<head>
  <meta charset="utf-8" />
	<meta name="google" content="notranslate" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
  <title>LinkUUp – Zusammen unterwegs</title>
  <meta name="description" content="LinkUUp bringt Menschen, Orte und gemeinsame Erlebnisse zusammen." />
  <meta name="application-name" content="LinkUUp" />
  <meta name="theme-color" content="#171a2d" />
  <meta name="color-scheme" content="dark" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="LinkUUp" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="msapplication-TileColor" content="#171a2d" />
  <meta name="msapplication-TileImage" content="images/icon-192.png" />
  <meta name="msapplication-config" content="browserconfig.xml" />
  <meta itemprop="name" content="LinkUUp – Zusammen unterwegs" />
  <meta itemprop="description" content="Entdecke Orte, triff Menschen und erlebe gemeinsam mehr." />
  <meta itemprop="image" content="<?=$shareImage?>" />

  <link rel="canonical" href="<?=$publicBase?>/" />
  <link rel="manifest" href="manifest.webmanifest<?=$v?>" />
  <link rel="shortcut icon" href="favicon.ico<?=$v?>" />
  <link rel="icon" href="favicon.ico<?=$v?>" sizes="any" />
  <link rel="icon" type="image/png" href="images/favicon-16.png<?=$v?>" sizes="16x16" />
  <link rel="icon" type="image/png" href="images/favicon.png<?=$v?>" sizes="32x32" />
  <link rel="apple-touch-icon" href="images/apple-touch-icon.png<?=$v?>" sizes="180x180" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="LinkUUp" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:url" content="<?=$publicBase?>/" />
  <meta property="og:title" content="LinkUUp – Zusammen unterwegs" />
  <meta property="og:description" content="Entdecke Orte, triff Menschen und erlebe gemeinsam mehr." />
  <meta property="og:image" content="<?=$shareImage?>" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="879" />
  <meta property="og:image:height" content="773" />
  <meta property="og:image:alt" content="LinkUUp App-Icon" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="LinkUUp – Zusammen unterwegs" />
  <meta name="twitter:description" content="Entdecke Orte, triff Menschen und erlebe gemeinsam mehr." />
  <meta name="twitter:image" content="<?=$shareImage?>" />
  <meta name="twitter:image:alt" content="LinkUUp App-Icon" />


  <link rel="stylesheet" href="node_modules/angular-material/angular-material<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/md-color-picker/dist/mdColorPicker<?=$min?>.css<?=$v?>">
  <link rel="stylesheet" href="node_modules/angular-jk-rating-stars/dist/jk-rating-stars<?=$min?>.css<?=$v?>">
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
  <link rel="stylesheet" href="css/linkuup-discovery-v2.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-venue-final.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-online-core.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-mira.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-location-tabs.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-location-stage.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-location-voices.css<?=$v?>">
  <link rel="stylesheet" href="css/lup-location-discovery-card.css<?=$v?>">

</head>

<body ng-app="LUP" ng-cloak ng-controller="LUPCtrl">

  <ng-view flex layout-fill layout="row"></ng-view>

  <div ng-if="isLoading()" class="lup-loading" layout="column" layout-align="center center" flex layout-fill>
    <md-progress-circular md-mode="indeterminate"></md-progress-circular>
  </div>

<script type="text/javascript">
window.LUP_BUILD = <?=json_encode(LUPConfig::$VERSION . '-local-ui298')?>;
// Local development only: the desktop has no usable GPS provider.  Keep the
// complete discovery and radius flow testable around Braunschweig without
// changing production behaviour or inventing a position in the live app.
window.LUP_DEBUG_POSITION = [52.268874, 10.526769];
</script>

  <script src="node_modules/jquery/dist/jquery.js<?=$v?>"></script>
  <script src="js/3p/jquery-visible.js<?=$v?>"></script>
  <script src="node_modules/jquery.finger/dist/jquery.finger.js<?=$v?>"></script>

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
	<script src="js/util/lup-viewport.js<?=$v?>"></script>

  <script src="js/model/gdo-profile.js<?=$v?>"></script>
  <script src="js/model/lup-comment.js<?=$v?>"></script>
  <script src="js/model/lup-message.js<?=$v?>"></script>
  <script src="js/model/gwf-user.js<?=$v?>"></script>
  <script src="js/model/gwf-pagination.js<?=$v?>"></script>
  <script src="js/model/gws-message.js<?=$v?>"></script>
  <script src="js/model/lup-room.js<?=$v?>"></script>
  <script src="js/model/lup-room-visit.js<?=$v?>"></script>
  <script src="js/model/lup-query-thread.js<?=$v?>"></script>
  <script src="js/model/lup-query-message.js<?=$v?>"></script>
  <script src="js/model/lup-notification.js<?=$v?>"></script>
  <script src="js/model/lup-gallery.js<?=$v?>"></script>
  <script src="js/model/lup-gallery-image.js<?=$v?>"></script>

  <script src="config/lup-module.js<?=$v?>"></script>
  <script src="config/lup-config.js<?=$v?>"></script>

  <script src="js/effects/lup-effects.js<?=$v?>"></script>
  <script src="js/effects/lup-audio.js<?=$v?>"></script>
  <script src="js/effects/lup-effect.js<?=$v?>"></script>
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
  <script src="js/service/lup-cuddle-service.js<?=$v?>"></script>
  <script src="js/service/lup-dialog-service.js<?=$v?>"></script>
  <script src="js/service/lup-enum-service.js<?=$v?>"></script>
  <script src="js/service/lup-error-service.js<?=$v?>"></script>
  <script src="js/service/lup-exception-service.js<?=$v?>"></script>
  <script src="js/service/lup-friend-service.js<?=$v?>"></script>
  <script src="js/service/lup-fx-service.js<?=$v?>"></script>
	<script src="js/service/lup-gdt-renderer-service.js<?=$v?>"></script>
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
	<script src="js/pages/add-room/lup-add-room.js<?=$v?>"></script>
  <script src="js/pages/debug/lup-debug.js<?=$v?>"></script>
  <script src="js/pages/login/lup-login.js<?=$v?>"></script>
  <script src="js/pages/register/lup-register.js<?=$v?>"></script>
  <script src="js/pages/recovery/lup-recovery.js<?=$v?>"></script>
  <script src="js/pages/comments/lup-comments.js<?=$v?>"></script>
  <script src="js/pages/course/lup-course.js<?=$v?>"></script>
  <script src="js/pages/cuddles/lup-cuddles.js<?=$v?>"></script>
  <script src="js/pages/location/lup-location.js<?=$v?>"></script>
  <script src="js/pages/location/lup-room-vote-ctrl.js<?=$v?>"></script>
  <script src="js/pages/location/lup-new-location.js<?=$v?>"></script>
  <script src="js/pages/locations/lup-locations.js<?=$v?>"></script>
  <script src="js/pages/profile/lup-profile.js<?=$v?>"></script>
  <script src="js/pages/settings/lup-settings.js<?=$v?>"></script>
  <script src="js/pages/query/lup-query.js<?=$v?>"></script>
  <script src="js/pages/notifications/lup-notification.js<?=$v?>"></script>
  <script src="js/pages/friends/lup-friends.js<?=$v?>"></script>
  <script src="js/pages/friends/lup-search-friends.js<?=$v?>"></script>
  <script src="js/pages/likes/lup-likes.js<?=$v?>"></script>

</body>
</html>
