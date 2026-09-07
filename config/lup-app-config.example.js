/**
 * Application config
 */
var LUP_CONFIG = {
	debug: false,
	ws_url: 'ws://localhost:61221',
	error_url: 'http://localhost/phpgdo/failure.html',
	cors: 'localhost', // the CORS allow origin
	ig_redirect_url: 'http://app.localhost/ig_redirect.php',
	server: 'http://localhost/phpgdo/', // Mit / Ende!
	server_domain: ".linkuup.de", // exclusively for cookie domain setting 
	basic_auth: 'Basic Z2RvNjpnZG82',
	fb_app_id: '1542733319095563',
	cookie: '', // will contain user cookie. not needed?
	ig_client_id: '56a0cdbb322d46009d39ae653d3d29b1',
	
	avatars: [
		'default',
		'male',
		'female',
	],
	
	positionPatch: null, // Development only: { lat: 51.2, lng: 10.4 }; keep null in production
	positionInterval: 60, // null to disable. default: 60 seconds
	
};
