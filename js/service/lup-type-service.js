"use strict";
angular.module('LUP').
service('TypeSrvc', function($q, RequestSrvc, ErrorSrvc) {
	
	var TypeSrvc = this;

	TypeSrvc.TYPES = null;
	TypeSrvc.FIELDS = null;
	
	TypeSrvc.withTypes = function() {
		console.log('TypeSrvc.withTypes()');
		if (TypeSrvc.FIELDS) {
			return $q.resolve(TypeSrvc.FIELDS);
		} else {
			return RequestSrvc.sendGWF('Core', 'GetTypes').then(TypeSrvc.gotTypes);
		}
	};
	
	TypeSrvc.gotTypes = function(response) {
		console.log('TypeSrvc.gotTypes()', response);
		TypeSrvc.TYPES = response.data.data.types;
		TypeSrvc.FIELDS = response.data.data.fields;
		return response;
	};
	
	TypeSrvc.withType = function(classname) {
		return TypeSrvc.withTypes().then(function(){
			if (TypeSrvc.FIELDS[classname]) {
				return $q.resolve(TypeSrvc.FIELDS[classname]);
			} else {
				ErrorSrvc.showError('TypeSrvc', 'Unknown classname: ' + classname).
					then(defer.reject);
			}
		}, function(){
			ErrorSrvc.showError('TypeSrvc', 'Unknown classname: ' + classname).
				then(defer.reject);
		});
	};

	/**
	 * Fill a gdo by parsing a binary websocket message.
	 */
	TypeSrvc.parseBinaryGDO = function(gwsMessage, classname, gdo) {
//		return TypeSrvc.withType(classname).then(function(fields) {
			var fields = TypeSrvc.FIELDS[classname];
			if (fields === undefined) {
				console.error('TypeSrvc.parseBinaryGDO() has no fields for '+classname);
				return;
			}
			// Room lists contain many objects. Logging every field turns a fast binary
			// response into thousands of expensive browser console operations.
			for (var key in fields) {
				var field = fields[key];
				if (TypeSrvc.isTypeSubmitted(field)) {
					var value = TypeSrvc.parseBinaryTypeHierarchy(gwsMessage, field);
					if (value === undefined) {
						console.error('TypeSrvc.parseBinaryType: Cannot convert '+key+' which is a '+field.type);
					} else {
//						console.log("SET", key, value);
						// Composite binary types such as GDT_Position intentionally expand
						// into several columns. A JSON field, however, is one named value;
						// flattening it loses that field (notably LUP_Notification.note_data).
						if ((value instanceof Object) &&
							(field.type !== 'GDO\\Core\\GDT_JSON') &&
							(field.type !== 'GDO\\Core\\GDT_Array')) {
							for (var i in value) {
								gdo.JSON[i] = value[i];
							}
						}
						else {
							gdo.JSON[key] = value;
						}
					}
				}
			}
//		}, function(err) {
//			alert(classname);
//			console.log(TypeSrvc.FIELDS);
//		});
	};
	
	/**
	 * Filter some gdt that are not transmitted.
	 * passwords and secrets.
	 */
	TypeSrvc.isTypeSubmitted = function(field) {
		switch (field.type) {
		case 'GDO\\User\\GDT_Password':
		case 'GDO\\User\\GDT_Secret':
		case 'GDO\\Net\\GDT_IP':
			return false;
		}
		return true;
	};
	
	/**
	 * Parse a portion of a binary websocket message.
	 * The parsing is determined by the gdt type and its options.
	 * The type and options meta data is retrieved by Core/GetTypes and Core/GetEnums
	 * The parsing target format is the json equivalent of a response.
	 */
	TypeSrvc.parseBinaryTypeHierarchy = function(gwsMessage, field) {
		const options = field.options; // field options
		const gdtType = field.type; // field type
		const hierarc = TypeSrvc.TYPES[gdtType]; // Class hierarchy
		let value = TypeSrvc.parseBinaryType(gdtType, gwsMessage, gdtType, options);
		if (value === undefined) {
			for (let i in hierarc) {
				value = TypeSrvc.parseBinaryType(hierarc[i], gwsMessage, gdtType, options);
				if (value !== undefined) {
					break;
				}
			}
		}
		if (value === undefined) {
			console.error(field);
			alert('OUCH');
		}
		return value;
	};
	
	TypeSrvc.parseBinaryType = function(klass, gwsMessage, gdtType, options) {
		let s = null;
		switch (klass) {
		case 'GDO\\LinkUUp\\GDT_ICQ': s = gwsMessage.readString(); return s ? parseInt(s) : null;
		case 'GDO\\Core\\GDT_Array': s = gwsMessage.readString(); return JSON.parse(s);
		case 'GDO\\Core\\GDT_JSON': s = gwsMessage.readString(); return JSON.parse(s);
		case 'GDO\\Date\\GDT_Timestamp':
			const t = gwsMessage.readDouble();
			return Number.isNaN(t) ? null : t * 1000.0;
		case 'GDO\\Core\\GDT_Decimal': return gwsMessage.readDouble();
		case 'GDO\\Core\\GDT_Float': return gwsMessage.readFloat();
		case 'GDO\\Core\\GDT_Object':
		case 'GDO\\Core\\GDT_ObjectSelect':
			let gid = '';
			for (let gdt in TypeSrvc.FIELDS[options.table]) {
				gdt = TypeSrvc.FIELDS[options.table][gdt]
				if (gdt.options.primary) {
					gid += gid ? ':' : '';
					gid += TypeSrvc.parseBinaryTypeHierarchy(gwsMessage, gdt);
				}
			}
			return gid;
		case 'GDO\\Core\\GDT_Int': return gwsMessage.readN(options.bytes);
		case 'GDO\\Core\\GDT_String': return gwsMessage.readString();
		case 'GDO\\Core\\GDT_Enum':
			let integer = gwsMessage.read16();
			return integer === 0 ? null : options.enumValues[integer-1];
		case 'GDO\\Maps\\GDT_Position':
			const n = options.name;
			let o = {};
			o[n+'_lat'] = gwsMessage.readFloat();
			o[n+'_lng'] = gwsMessage.readFloat();
			return o;
		}
	};
	
	TypeSrvc.dateToInt = function(date) {
		console.log('TypeSrvc.dateToInt()', date);
		return date ? window.moment(date).unix() : null;
	};
	
	TypeSrvc.strToDate = function(str) {
		console.log('TypeSrvc.strToDate()', str);
		return new Date(str);
	};

	TypeSrvc.intToDate = function(int) {
		console.log('TypeSrvc.intToDate()', int);
		return int ? new Date(int*1000) : null;
//		return window.moment.unix(int).format("MM/DD/YYYY H:i:s");
	};
	
	return TypeSrvc;
});
