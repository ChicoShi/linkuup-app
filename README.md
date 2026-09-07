# linkuup-app

## Production build

Run `php build.php` after a production app update. It merges and minifies the
CSS and JavaScript into `app/linkuup.css` and `app/linkuup.js`, then increments
the build version used for browser-cache invalidation.

`clean-css` can report recoverable CSS warnings (for example an ignored invalid
selector or font value) while still producing a valid bundle. Treat warnings as
review items, not a failed release: the build is successful when `build.php`
finishes with exit code 0 and both generated assets exist. A non-zero exit code
or missing/empty generated asset is a failed build and must not be deployed.

## Local development: cache and GPS

Use `index_debug.php`. Do not increment `$VERSION` or append `local-ui` counters
for development edits. The root `.htaccess` disables HTTP caching for assets,
templates and locale JSON on `localhost`, `127.0.0.1` and `app.localhost` (with
optional ports). It requires Apache 2.4, `mod_headers` and `AllowOverride FileInfo`.
Public hosts receive no additional cache headers from this rule. With another
server or hostname, configure the equivalent **development-vhost-only** no-store
policy; alternatively enable Chromium DevTools → Network → Disable cache while
DevTools is open. Verify the response headers of a JS file, template and locale
file. Reload once with cache disabled to discard previously cached responses.
Angular's in-memory template cache lasts until reload; it is not a disk cache.

For GPS simulation, edit only the ignored local `config/lup-app-config.js`:
set `positionPatch` to `{ lat: 51.2, lng: 10.4 }` for a deliberate test location.
Keep it `null` for real browser geolocation and in production. The existing
`LUPCtrl.setupGPSFaker()` passes this configuration to `PositionSrvc`; no position
belongs in `index_debug.php` or a `window.LUP_DEBUG_POSITION` override. This does
not grant real GPS permission or change the application's location/radius rules.
Do not commit local configuration or credentials. The example defaults to `null`.
Production releases still use the version managed by `php build.php`.
