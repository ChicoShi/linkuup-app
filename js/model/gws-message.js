function GWS_Message(buffer) {
	//////////
	// Init //
	//////////
	this.SYNC = 0; 
	this.INDEX = 0;
	this.LENGTH = 0;
	this.CMD = -1;

	if (buffer) {
		this.BUFFER = new DataView(buffer);
		this.LENGTH = buffer.byteLength;
	}
	else {
		this.BUFFER = [];
	}
	
	/////////////////////
	// Setter / Getter //
	/////////////////////
	this.hasMore = function() { return this.INDEX < this.LENGTH; };
	this.isSync = function() { return this.LENGTH > 0 ? (this.BUFFER.getUint8(0) & 0x80) > 0 : false; };
	this.index = function(index) { if (index !== undefined) this.INDEX = index; return this.INDEX; };
	this.moveIndex = function(by) { this.INDEX += by; return this.INDEX; };
	this.binaryBuffer = function()
	{
		var len = this.BUFFER.length;
		var buff = new Uint8Array(len);
		for (var i = 0; i < len; i++) {
			buff[i] = this.BUFFER[i];
		}
		return buff.buffer;
	};

	////////////
	// Reader //
	////////////
	this.read8 = function(index) { return this.readN(1, index); };
	this.read16 = function(index) { return this.readN(2, index); };
	this.read24 = function(index) { return this.readN(3, index); };
	this.read32 = function(index) { return this.readN(4, index); };
	this.read64 = function(index) { return this.readN(8, index); };
	this.readN = function(bytes, index) {
		if (bytes < 1) {
			alert("Cannot read 0 bytes.");
		}
		index = index === undefined ? this.INDEX : index;
		var back = 0;
		for (var i = 0; i < bytes; i++) {
			back <<= 8;
			back |= this.BUFFER.getUint8(index++);
		}
		this.INDEX = index;
		console.log('GWS_Message.read'+(bytes*8)+" == " + back);
		return back;
	};
	this.readString = function(index) {
		this.index(index);
		let back = '';
		while (code = this.read8()) {
			back += String.fromCharCode(code);
		}
		back = decodeURIComponent(back.replace(/\+/g, '%20'));
		console.log('GWS_Message.readString == ' + back);
		return back;
	};
	this.readFloat = function(index) {  let f = this.BUFFER.getFloat32(this.index(index), true); this.INDEX += 4; return f; };
	this.readDouble = function(index) {
		index = index === undefined ? this.INDEX : index;
		const buffer = new ArrayBuffer(8);
		const view = new DataView(buffer);
		for (let i = 0; i < 8; i++) {
			view.setUint8(i, this.BUFFER[index + i]);
		}
		const value = view.getFloat64(0, true); // true = little-endian
		this.INDEX = index + 8;
		return value;
	};
	this.readCmd = function() { this.CMD = this.CMD < 0 ? (this.read16() & 0x7FFF) : this.CMD; return this.CMD; };
	this.readMid = function() { return this.read24(); };

	////////////
	// Writer //
	////////////
	this.write8 = function(value, index) { return this.writeN(1, value, index); };
	this.write16 = function(value, index) { return this.writeN(2, value, index); };
	this.write24 = function(value, index) { return this.writeN(3, value, index); };
	this.write32 = function(value, index) { return this.writeN(4, value, index); };
	this.write64 = function(value, index) { return this.writeN(8, value, index); };
	this.writeN = function(bytes, value, index) {
		index = index === undefined ? this.INDEX : index;
		value = parseInt(value);
		var jindex = index + bytes - 1;
		for (var i = 0; i < bytes; i++) {
			this.BUFFER[jindex--] = value & 0xFF;
			index++;
			value >>= 8;
		}
		this.LENGTH = this.BUFFER.length;
		this.INDEX = index;
		return this;
	};
	this.writeString = function(string, index) {
		if (string) {
			var s = encodeURIComponent(string);
			var len = s.length, i = 0;
			while (i < len) {
				this.write8(s.charCodeAt(i++));
			}
		}
		return this.write8(0);
	};
	this.writeFloat = function(float, index) {
		return this.write32(GWS_Message.FloatToInt32(float));
	};

	this.writeDouble = function(value, index) {
		index = index === undefined ? this.INDEX : index;

		const buffer = new ArrayBuffer(8);
		const view = new DataView(buffer);

		view.setFloat64(0, Number(value), true); // true = little-endian

		for (let i = 0; i < 8; i++) {
			this.BUFFER[index + i] = view.getUint8(i);
		}

		this.INDEX = index + 8;
		this.LENGTH = Math.max(this.LENGTH, this.INDEX);

		return this;
	};

	this.cmd = function(cmd) {
		return this.write16(cmd);
	};
	this.async = function() {
		this.SYNC = 0;
		return this.write32()
	};
	this.sync = function() {
		this.BUFFER[0] |= 0x80;
		this.SYNC = GWS_Message.nextMid();
		return this.write24(this.SYNC);
	};
	
	///////////
	// Debug //
	///////////
	this.dump = function() {
		var dump = '', i = 0;
		while (i < this.LENGTH) {
			dump += sprintf(' %02X', this.BUFFER.getUint8 ? this.BUFFER.getUint8(i++): this.BUFFER[i++]);
		}
		return dump;
	};
	
	this.asciiDump = function() {
		var dump = '', i = 0;
		while (i < this.LENGTH) {
			dump += String.fromCharCode(this.BUFFER.getUint8 ? this.BUFFER.getUint8(i++): this.BUFFER[i++]);
		}
//		dump = decodeURIComponent(dump);
		return dump;
	};


	// yeah
	return this;
}

/////////////
// Factory //
/////////////
GWS_Message.NEXT_MID = 1;
GWS_Message.nextMid = function() {
	let mid = GWS_Message.NEXT_MID++;
	if (GWS_Message.NEXT_MID > 0xFFFFFF) {
		GWS_Message.NEXT_MID = 1;
	}
	return mid;
};
GWS_Message.FLOATBUF = new DataView(new ArrayBuffer(8));
GWS_Message.FloatToInt32 = function(float) {
	var fb = GWS_Message.FLOATBUF;
	fb.setFloat32(0, float);
	return fb.getUint32(0);
}
GWS_Message.DoubleToInt64 = function(double) {
	var fb = GWS_Message.FLOATBUF;
	fb.setFloat64(0, double);
	return [fb.getUint32(4), fb.getUint32(0)];
}
