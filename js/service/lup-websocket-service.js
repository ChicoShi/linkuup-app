'use strict';
angular.module('LUP').
service('WebsocketSrvc', function($q, $rootScope, ErrorSrvc, LoadingSrvc) {
	
	var WebsocketSrvc = this;
	
	WebsocketSrvc.SYNC_MSGS = {};
	WebsocketSrvc.SOCKET = null;
	WebsocketSrvc.CONNECTED = false;
	WebsocketSrvc.CONNECTING = null;
	
	WebsocketSrvc.MSGS_SENT = 0;
	WebsocketSrvc.MSGS_RECV = 0;
	WebsocketSrvc.TRACE_BINARY = false;

	// Native WebSocket callbacks run outside Angular's digest cycle.  Schedule
	// UI broadcasts inside it, otherwise a received update can stay visually
	// stale until the next unrelated tap/click happens.
	WebsocketSrvc.broadcast = function(event, payload) {
		$rootScope.$evalAsync(function() {
			$rootScope.$broadcast(event, payload);
		});
	};
	
	////////////
	// Config //
	////////////
	WebsocketSrvc.CONFIG = {
		url: LUP_CONFIG.ws_url,
		binary: true,
		autoConnect: false,
		reconnect: true, // @TODO reconnect
		reconnectTimeout: 10000,
		keepQueue: true, // @TODO Try to resend queue after reconnect 
	};
	WebsocketSrvc.configure = function(config) {
		console.log('WebsocketSrvc.configure()', config);
		WebsocketSrvc.CONFIG = config;
		if (config.autoConnect) {
			return WebsocketSrvc.connect();
		}
	};
	WebsocketSrvc.configure(WebsocketSrvc.CONFIG);
	
	
	////////////////
	// Connection //
	////////////////
	WebsocketSrvc.withConnection = function(url) {
		console.log('WebsocketSrvc.withConnection()', url);
		WebsocketSrvc.CONFIG.url = url || WebsocketSrvc.CONFIG.url;
		if (WebsocketSrvc.connected()) {
			var defer = $q.defer();
			defer.resolve();
			return defer.promise;
		}
		return WebsocketSrvc.connect(url);
	};
	
	WebsocketSrvc.withConn = function(callback) {
		return WebsocketSrvc.withConnection().then(callback, WebsocketSrvc.connectionFailure);
	};
	
	WebsocketSrvc.connectionFailure = function(error) {
		ErrorSrvc.showError(error, 'Websocket');
	}
	
	WebsocketSrvc.connect = function(url) {
		url = url || WebsocketSrvc.CONFIG.url;
		console.log('WebsocketSrvc.connect()', url);
		if (WebsocketSrvc.connected()) {
			return $q.resolve();
		}
		if (WebsocketSrvc.CONNECTING) {
			return WebsocketSrvc.CONNECTING;
		}
		var defer = $q.defer();
		WebsocketSrvc.CONNECTING = defer.promise;
		if (WebsocketSrvc.SOCKET == null) {
			LoadingSrvc.addTask('wsconnect');
			var ws = WebsocketSrvc.SOCKET = new WebSocket(url);
			if (WebsocketSrvc.CONFIG.binary) {
				ws.binaryType = 'arraybuffer';
			}
			ws.onopen = function() {
				WebsocketSrvc.CONNECTING = null;
				LoadingSrvc.stopTask('wsconnect');
				WebsocketSrvc.startQueue();
		    	WebsocketSrvc.CONNECTED = true;
		    	WebsocketSrvc.MSGS_SENT = 0;
		    	WebsocketSrvc.MSGS_RECV = 0;
		    	defer.resolve();
		    	WebsocketSrvc.authenticate().then(function(result){
					WebsocketSrvc.broadcast('gws-ws-open');
		    	});
			};
		    ws.onclose = function() {
				WebsocketSrvc.CONNECTING = null;
				LoadingSrvc.stopTask('wsconnect');
		    	WebsocketSrvc.disconnect(true);
		    	if (WebsocketSrvc.CONNECTED) {
			    	WebsocketSrvc.CONNECTED = false;
					WebsocketSrvc.broadcast('gws-ws-close');
		    	}
		    };
		    ws.onerror = function(error) {
				WebsocketSrvc.CONNECTING = null;
		    	WebsocketSrvc.disconnect(true);
				defer.reject(error);
		    };
		    ws.onmessage = function(message) {
		    	WebsocketSrvc.MSGS_RECV += 1;
		    	if (message.data instanceof ArrayBuffer) {
		    		WebsocketSrvc.onBinaryMessage(message);
		    	}
		    	else {
		    		WebsocketSrvc.onMessage(message);
		    	}
		    };
		}
		else {
			WebsocketSrvc.CONNECTING = null;
			defer.reject();
		}
		return defer.promise;
	};
	
	WebsocketSrvc.onMessage = function(message) {
    	console.log('WebsocketSrvc.onMessage()', message.data);
    	if (message.data.indexOf('ERR:') === 0) {
    		ErrorSrvc.showError(message.data, 'Protocol error');
    	}
    	else if (message.data.indexOf(':MID:') >= 0) {
    		if (!WebsocketSrvc.syncMessage(message.data)) {
    			WebsocketSrvc.processMessage(mesage.data);
    		}
    	} else {
			WebsocketSrvc.processMessage(message.data);
    	}
	};

	WebsocketSrvc.onBinaryMessage = function(message) {
		var gwsMessage = new GWS_Message(message.data);
		var command = gwsMessage.readCmd();
		var mid = gwsMessage.isSync() ? gwsMessage.readMid() : 0;
		var error = command > 0 ? 0 : gwsMessage.read16();
//		console.log(sprintf('WebsocketSrvc.onBinaryMessage() CMD %04X, MID %04X, ERR=%04X', command, mid, error));
		// Binary and ASCII dumps are protocol-debug tools only. Creating them for
		// every complete room list can block rendering on phones.
		if (WebsocketSrvc.TRACE_BINARY === true) {
			console.log('WebsocketSrvc.onBinaryMessage() BINARY', gwsMessage.dump());
			console.log('WebsocketSrvc.onBinaryMessage() ASCII:', gwsMessage.asciiDump());
		}
		if (mid > 0) {
			if (WebsocketSrvc.SYNC_MSGS[mid]) {
				if (error) {
					var errorMsg = gwsMessage.readString();
					var defer = WebsocketSrvc.SYNC_MSGS[mid];
//					console.log(defer);
//					if (!defer.promise['catch']) {
//						ErrorSrvc.showError(sprintf('Code: %04X<br/>%s', error, errorMsg), 'Protocol error');
//					}
					defer.reject(errorMsg);
				}
				else {
					WebsocketSrvc.SYNC_MSGS[mid].resolve(gwsMessage);
				}
				WebsocketSrvc.SYNC_MSGS[mid] = undefined; // TODO delete array element
				return;
			}
		}
		if (!error) {
//			var method = sprintf('xcmd_%04X', command);
//			if (CommandSrvc[method]) {
//				setTimeout(CommandSrvc[method].bind(CommandSrvc, gwsMessage), 1);
//			}
//			else {
				WebsocketSrvc.broadcast('gws-ws-message', gwsMessage);
//			}
		}
		else {
			ErrorSrvc.showError(sprintf('Code: %04X<br/>%s', error, gwsMessage.readString()), 'Protocol error');
		}
	};
	
	WebsocketSrvc.onError = function(errorText) {
		ErrorSrvc.showError(errorText, 'Protocol error');
	};

	WebsocketSrvc.processMessage = function(messageText) {
		console.log('ConnectCtrl.processMessage()', messageText);
//		var command = messageText.substrUntil(':');
//		if (CommandSrvc[command]) {
//			CommandSrvc[command](messageText.substrFrom(':'));
//		}
//		else {
		WebsocketSrvc.broadcast('gws-ws-text-message', messageText);
//		}
	};

	WebsocketSrvc.disconnect = function(event) {
//		console.log('WebsocketSrvc.disconnect()');
		if (WebsocketSrvc.SOCKET != null) {
			WebsocketSrvc.SOCKET.close();
			WebsocketSrvc.SOCKET = null;
			WebsocketSrvc.SYNC_MSGS = {};
			if (event) {
				WebsocketSrvc.broadcast('gws-ws-disconnect');
			}
		}
	};
	
	//////////
	// Auth //
	//////////
	WebsocketSrvc.connected = function() {
		return WebsocketSrvc.CONNECTED;
	};
	
	WebsocketSrvc.authenticate = function() {
		console.log('WebsocketSrvc.authenticate', LUP_CONFIG.ws_secret);
		var w = WebsocketSrvc;
		return w.sendBinary(GWS_Message().cmd(0x0001).sync().writeString(LUP_CONFIG.ws_secret)).then(w.authenticated, w.authFailure);
	};

	WebsocketSrvc.authenticated = function(payload) {
//		console.log('WebsocketSrvc.authenticated()', payload);
		GWF_USER.update(JSON.parse(payload));
	};

	WebsocketSrvc.authFailure = function(error) {
		console.log('WebsocketSrvc.authFailure()', error);
		ErrorSrvc.showError(error, 'Websocket Authentication');
	};

	////////////////////////
	// Sync Protocol part //
	////////////////////////
	WebsocketSrvc.syncMessage = function(messageText) {
		var parts = explode(':', messageText, 4);
		var cmd = parts[0];
		if (parts[1] !== 'MID') {
			return false;
		}
		var mid = parts[2];
		var payload = parts[3];
		
		if (WebsocketSrvc.SYNC_MSGS[mid]) {
			WebsocketSrvc.SYNC_MSGS[mid].resolve(payload);
			WebsocketSrvc.SYNC_MSGS[mid] = undefined;
		}
		
		return true;
	};
	
	/////////////////////////////
	// Send Queue on reconnect //
	/////////////////////////////
	WebsocketSrvc.startQueue = function() {
//		console.log('WebsocketSrvc.startQueue()');
		if (WebsocketSrvc.QUEUE_INTERVAL === null) {
			WebsocketSrvc.QUEUE_INTERVAL = setInterval(WebsocketSrvc.flushQueue, WebsocketSrvc.QUEUE_SEND_MILLIS);
		}
	};
	
	WebsocketSrvc.flushQueue = function() {
		if (!WebsocketSrvc.connected()) {
			// TODO: Recon?
		}
		else {
			WebsocketSrvc.sendQueue();
		}
	};
	
	WebsocketSrvc.sendQueue = function() {
		if (WebsocketSrvc.QUEUE.length > 0) {
//			console.log('WebsocketSrvc.sendQueue()');
		}
	};
	
	//////////
	// Send //
	//////////
	WebsocketSrvc.sendCommand = function(command, payload, async) {
		async = async === false ? false : true;
		payload = payload === undefined ? '' : payload;
		var d = $q.defer();
		if (!WebsocketSrvc.connected()) {
//			WebsocketSrvc.QUEUE.push(messageText);
			d.reject();
		}
		else {
			if (!async) {
				var mid = GWS_Message.nextMid();
				WebsocketSrvc.SYNC_MSGS[mid] = d;
				payload = sprintf('MID:%s:%s', mid, payload);
			}
			WebsocketSrvc.send(command+":"+payload);
			if (async) {
				d.resolve();
			}
		}
		return d.promise;
	};
	
	WebsocketSrvc.send = function(messageText) {
		console.log('WebsocketSrvc.send()', messageText);
		WebsocketSrvc.MSGS_SENT += 1;
		WebsocketSrvc.SOCKET.send(messageText);
	};
	
	////////////////////
	// --- Binary --- //
	////////////////////
	WebsocketSrvc.sendBinary = function(gwsMessage) {
		var d = $q.defer();
		if (WebsocketSrvc.connected()) {

			// Remember sync msg id
			if (gwsMessage.SYNC > 0) {
				WebsocketSrvc.SYNC_MSGS[gwsMessage.SYNC] = d;
			}

			// send it 
			if (WebsocketSrvc.TRACE_BINARY === true) {
				console.log('WebsocketSrvc.sendBinary()', gwsMessage.dump());
			}
			WebsocketSrvc.MSGS_SENT += 1;
			WebsocketSrvc.SOCKET.send(gwsMessage.binaryBuffer());
			
			// Unsync immediately resolves
			if (gwsMessage.SYNC == 0) {
				return $q.resolve();
			}
		}
		else {
			d.reject();
		}
		
		// Resolves when sync reply arrives
		return d.promise;
	};

	return WebsocketSrvc;
});
