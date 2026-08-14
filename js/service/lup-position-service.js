'use strict';
angular.module('LUP').
service('PositionSrvc', function($q, $rootScope, LoadingSrvc, RequestSrvc) {

	var PositionSrvc = this;
	
	PositionSrvc.MAX_TRY = 0;
	PositionSrvc.MAX_TRIES = 5;
	PositionSrvc.MAX_TRY_TIMEOUT = 15 * 1000;
	PositionSrvc.PERMISSION_DENIED = 1;
	PositionSrvc.POSITION_UNAVAILABLE = 2;
	PositionSrvc.TIMEOUT = 3;

	PositionSrvc.PROBED = false;
	PositionSrvc.PROBING = null;
	PositionSrvc.HIGH_PRECISION = true;

	PositionSrvc.OPTIONS = {
			enableHighAccuracy: PositionSrvc.HIGH_PRECISION,
			// A recent position gives the discovery rail an immediate distance after
			// refresh. The watch below still replaces it with a fresh GPS fix.
			maximumAge: 300000,
			timeout: 12000
	};

	PositionSrvc.UNKNOWN = 1;
	PositionSrvc.KNOWN = 2;
	PositionSrvc.PATCHED = 3;
	
	PositionSrvc.WATCH = null;
	PositionSrvc.INTERVAL = null;
	PositionSrvc.REFRESHING = false;
	PositionSrvc.LAST_REFRESH = 0;
	PositionSrvc.REFRESH_INTERVAL = 5000;
	
	window.GWF_POSITION = PositionSrvc.CURRENT = {
			latlng: null,   // google maps
			position: { coords: { latitude: null, longitude: null} }, // browser
			patch: { lat: null, lng: null },
			real: { timestamp: 0, lat: null, lng: null },
			state: {
				val: PositionSrvc.UNKNOWN,
				text: 'unknown',
			},
			lat: null,
			lng: null
	};
	
	PositionSrvc.age = function() {
		console.log('PositionSrvc.age()');
		var c = PositionSrvc.CURRENT;
		return c.real.timestamp <= 0? 1999999999 : new Date().getTime() - c.real.timestamp;
	};
	
	PositionSrvc.togglePrecision = function() {
		console.log('PositionSrvc.togglePrecision()');
		PositionSrvc.OPTIONS.enableHighAccuracy = !PositionSrvc.OPTIONS.enableHighAccuracy;
	};
	
	////////////
	// Getter //
	////////////
	PositionSrvc.unknown = function() { return PositionSrvc.CURRENT.state.val === PositionSrvc.UNKNOWN; };
	
	///////////
	// Probe //
	///////////
	PositionSrvc.probe = function() {
		console.log('PositionSrvc.probe()', PositionSrvc.PROBED);
		var defer = $q.defer();
		if (PositionSrvc.PROBED) {
			defer.resolve(PositionSrvc.CURRENT);
		}
		else if (PositionSrvc.PROBING) {
			// Several controllers can ask for GPS while the app connects. Reuse
			// the same browser request; never create a stack of permission prompts.
			return PositionSrvc.PROBING;
		}
		else if (!navigator.geolocation) {
			defer.reject('Browser has no geolocation');
		}
		else {
			PositionSrvc.PROBING = defer.promise;
			defer.promise['finally'](function() {
				PositionSrvc.PROBING = null;
			});
			PositionSrvc.MAX_TRY = 0;
			PositionSrvc.sendProbe(defer);
		}
		return defer.promise;
	};

	// Refresh after navigation or interaction without another permission prompt.
	// It is throttled so quick taps and swipes cannot queue GPS requests.
	PositionSrvc.refresh = function(force) {
		if (!navigator.geolocation || !PositionSrvc.PROBED || PositionSrvc.PROBING) {
			return PositionSrvc.probe();
		}
		var now = Date.now();
		if (PositionSrvc.REFRESHING || (!force && now - PositionSrvc.LAST_REFRESH < PositionSrvc.REFRESH_INTERVAL)) {
			return;
		}
		PositionSrvc.REFRESHING = true;
		PositionSrvc.LAST_REFRESH = now;
		navigator.geolocation.getCurrentPosition(function(position) {
			PositionSrvc.REFRESHING = false;
			$rootScope.$evalAsync(function() {
				PositionSrvc.setReal(position.coords.latitude, position.coords.longitude);
			});
		}, function(error) {
			PositionSrvc.REFRESHING = false;
			console.debug('LinkUUp: silent GPS refresh unavailable.', error);
		}, {
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 6000
		});
	};
	
	PositionSrvc.sendProbe = function(defer) {
		console.log('PositionSrvc.sendProbe()');
		LoadingSrvc.addTask('positioning');
		navigator.geolocation.getCurrentPosition(
				PositionSrvc.probeSuccess.bind(PositionSrvc, defer), 
				PositionSrvc.probeFailure.bind(PositionSrvc, defer),
				PositionSrvc.OPTIONS);
	};
	
	PositionSrvc.probeSuccess = function(defer, position) {
		console.log('PositionSrvc.probeSuccess()', defer, position);
		$rootScope.$evalAsync(function() {
			LoadingSrvc.stopTask('positioning');
			PositionSrvc.PROBED = true;
			var p = position.coords;
			PositionSrvc.setReal(p.latitude, p.longitude);
			PositionSrvc.start();
			defer.resolve(PositionSrvc.CURRENT);
		});
	};

	PositionSrvc.probeFailure = function(defer, error) {
		console.log('PositionSrvc.probeFailure()', defer, error);
		LoadingSrvc.stopTask('positioning');
		if (error && error.code === PositionSrvc.PERMISSION_DENIED) {
			return defer.reject(error);
		}
		PositionSrvc.MAX_TRY++;
		if (PositionSrvc.MAX_TRY >= PositionSrvc.MAX_TRIES) {
			defer.reject(error);
		}
		else {
			PositionSrvc.togglePrecision();
			// On desktop and on phones waking from standby, high precision can time
			// out despite a usable network position being available. Try that normal
			// fallback immediately once instead of leaving distances blank for 15s.
			var retryDelay = PositionSrvc.MAX_TRY === 1 ? 0 : PositionSrvc.MAX_TRY_TIMEOUT;
			setTimeout(PositionSrvc.sendProbe.bind(this, defer), retryDelay);
		}
	};
	
	///////////
	// Watch //
	///////////
	PositionSrvc.start = function() {
		console.log('PositionSrvc.start()');
		if (PositionSrvc.WATCH === null) {
			PositionSrvc.WATCH = navigator.geolocation.watchPosition(PositionSrvc.watchSuccess, PositionSrvc.watchFailure, PositionSrvc.OPTIONS);
		}
		PositionSrvc.startInterval();
	};

	PositionSrvc.startInterval = function() {
		var seconds = Number(window.LUP_CONFIG.positionInterval);
		if (seconds > 0 && PositionSrvc.INTERVAL === null) {
			PositionSrvc.INTERVAL = setInterval(PositionSrvc.intervalCalled, seconds * 1000);
		}
	};

	// A stationary device does not necessarily trigger watchPosition again.
	// Keep the server-side presence fresh at the explicitly configured cadence,
	// but only after the user has already granted a real GPS position.
	PositionSrvc.intervalCalled = function() {
		if (PositionSrvc.PROBED && PositionSrvc.hasPosition(true)) {
			console.log('PositionSrvc.intervalCalled()');
			$rootScope.$broadcast('gwf-position-changed', PositionSrvc.CURRENT);
		}
	};
	
	PositionSrvc.stop = function() {
		console.log('PositionSrvc.stop()');
		if (PositionSrvc.WATCH !== null) {
			navigator.geolocation.clearWatch(PositionSrvc.WATCH);
			PositionSrvc.WATCH = null;
		}
		if (PositionSrvc.INTERVAL !== null) {
			clearInterval(PositionSrvc.INTERVAL);
			PositionSrvc.INTERVAL = null;
		}
	};
	
	PositionSrvc.watchSuccess = function(position) {
		console.log('PositionSrvc.watchSuccess()', position);
		$rootScope.$evalAsync(function() {
			var p = position.coords;
			PositionSrvc.setReal(p.latitude, p.longitude);
		});
	};
	
	PositionSrvc.watchFailure = function(error) {
		console.log('PositionSrvc.watchFailure()', error);
//		PositionSrvc.PROBED = false;
//		PositionSrvc.probe();
	};
	
	//////////////
	// Patching //
	//////////////
	PositionSrvc.patching = function() {
		return PositionSrvc.CURRENT.state.val === PositionSrvc.PATCHED;
	};
	
	PositionSrvc.startPatching = function(lat, lng) {
		console.log('PositionSrvc.startPatching()', lat, lng);
		var c = PositionSrvc.CURRENT;
		c.patch.lat = lat;
		c.patch.lng = lng;
		PositionSrvc.setCurrent(lat, lng, PositionSrvc.PATCHED);
		PositionSrvc.PROBED = true;
		PositionSrvc.startInterval();
	};
	
	PositionSrvc.stopPatching = function() {
		console.log('PositionSrvc.stopPatching()');
		var c = PositionSrvc.CURRENT;
		c.patch.lat = null;
		c.patch.lng = null;
		PositionSrvc.setState(c.real.lat === null ? PositionSrvc.UNKNOWN : PositionSrvc.KNOWN);
		if (c.real.lat !== null) {
			PositionSrvc.setCurrent(c.real.lat, c.real.lng, PositionSrvc.KNOWN);
		}
		else {
			PositionSrvc.probe();
		}
	};
	
	/////////
	// Set //
	/////////
	PositionSrvc.setReal = function(lat, lng) {
		console.log('PositionSrvc.setReal()', lat, lng);
		var c = PositionSrvc.CURRENT;
		c.real.timestamp = new Date().getTime();
		c.real.lat = lat;
		c.real.lng = lng;
		PositionSrvc.setCurrent(lat, lng, PositionSrvc.CURRENT.state.val === PositionSrvc.UNKNOWN ? PositionSrvc.KNOWN : PositionSrvc.CURRENT.state.val);
	};
	
	PositionSrvc.setCurrent = function(lat, lng, state) {
		console.log('PositionSrvc.setCurrent()', lat, lng, state);
		var c = PositionSrvc.CURRENT;
		PositionSrvc.setState(state);
		switch (c.state.val) {
		case PositionSrvc.PATCHED:
			PositionSrvc.setCoordinates(c.patch.lat, c.patch.lng);
			break;
		case PositionSrvc.KNOWN:
			PositionSrvc.setCoordinates(lat, lng);
			break;
		case PositionSrvc.UNKNOWN:
			break;
		default:
			console.error('Invalid state: '+state);
		}
	};
	
	// No coordinate has been sent yet. The first valid position must always
	// refresh rooms, including an explicitly configured debug patch.
	PositionSrvc.LAST = null;
	PositionSrvc.EVENT_TOLERANCE_KM = 0.025;
	PositionSrvc.setCoordinates = function(lat, lng) {
		console.log('PositionSrvc.setCoordinates()', lat, lng);
		var c = PositionSrvc.CURRENT;
		c.lat = lat;
		c.lng = lng;
//		c.latlng = new google.maps.LatLng({lat:lat, lng:lng});
		c.position = {coords:{latitude: lat, longitude:lng}};
		if (PositionSrvc.hasPositionChangedSignificantly(c)) {
			$rootScope.$broadcast('gwf-position-changed', PositionSrvc.CURRENT);
		}
	};

	PositionSrvc.hasPositionChangedSignificantly = function(current) {
		
		// Always announce the first valid coordinate. Further updates need an
		// actual 25 metre movement, whether they originate from GPS or a patch.
		var last = PositionSrvc.LAST;
		if (last === null) {
			PositionSrvc.LAST = { lat: current.lat, lng: current.lng };
			console.log('PositionSrvc.hasPositionChangedSignificantly() FIRST');
			return true;
		}

		// Only notify the server after moving at least 25 metres.
		var distance = PositionSrvc.distanceBetween(current.lat, current.lng, last.lat, last.lng);
		if (distance >= PositionSrvc.EVENT_TOLERANCE_KM) {
			console.log('PositionSrvc.hasPositionChangedSignificantly()', distance);
			last.lat = current.lat;
			last.lng = current.lng;
			return true;
		}
		console.log('PositionSrvc.hasPositionChangedSignificantly() NO', distance);
		return false;
	};
	
	PositionSrvc.setState = function(state) {
		console.log('PositionSrvc.setState()', state);
		var c = PositionSrvc.CURRENT;
		c.state.val = state;
		switch (state) {
		case PositionSrvc.UNKNOWN: c.state.text = 'unknown'; break;
		case PositionSrvc.KNOWN: c.state.text = 'known'; break;
		case PositionSrvc.PATCHED: c.state.text = 'patched'; break;
		default:
			c.state.text = 'errorneous'; break;
			console.error('Invalid state: '+state);
		}
	};
	
	///////////////////
	// With Position //
	///////////////////
	PositionSrvc.hasPosition = function(allowPatched) {
		var c = PositionSrvc.CURRENT;
		return c.real.lat !== null || (allowPatched && c.patch.lat !== null);
	};
	
	PositionSrvc.withPosition = function(allowPatched) {
		var c = PositionSrvc.CURRENT;
		if (PositionSrvc.hasPosition(allowPatched)) {
			var defer = $q.defer();
			defer.resolve(c);
			return defer.promise;
		}
		return PositionSrvc.probe();
	};

	PositionSrvc.distanceTo = function(lat, lng) {
		var p = PositionSrvc.CURRENT;
		return PositionSrvc.distanceBetween(p.lat, p.lng, lat, lng);
	};

	/**
	 * Distance in km.
	 */
	PositionSrvc.distanceBetween = function(lat1, lng1, lat2, lng2) {
		var sin = Math.sin, acos = Math.acos, cos = Math.cos;
		var deg2rad = function(deg) { return deg * Math.PI / 180.0; }
		var rad2deg = function(rad) { return rad * 180.0 / Math.PI; }
		var degrees = rad2deg(acos((sin(deg2rad(lat1))*sin(deg2rad(lat2))) + (cos(deg2rad(lat1))*cos(deg2rad(lat2))*cos(deg2rad(lng1-lng2)))));
		var distance = degrees * 111.13384;
		return distance;
	};
	
	//////////////
	// City API //
	//////////////
	PositionSrvc.withGeocoding = function() {
		console.log('PositionSrvc.withGeocoding()');
		var defer = $q.defer();
		PositionSrvc.withPosition().then(function(p){
			var url = "https://maps.googleapis.com/maps/api/geocode/json?latlng="+p.lat+","+p.lng+"&sensor=false";
			RequestSrvc.get(url).then(function(result) {
				defer.resolve(result.data.results[1].formatted_address);
			}, defer.reject);
		}, defer.reject);
		return defer.promise;
	};
});
