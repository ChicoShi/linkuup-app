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
