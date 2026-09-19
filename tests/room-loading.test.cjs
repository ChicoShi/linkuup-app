const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function setup() {
 const services = {};
 const context = vm.createContext({
  console, window: {}, ArrayBuffer, DataView, Uint8Array,
  angular: {module: () => ({service(name, ctor) { services[name] = ctor; }})},
 });
 for (const file of ['js/model/gws-message.js', 'js/model/lup-room.js',
   'js/service/lup-type-service.js', 'js/service/lup-room-service.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
 }
 const q = {when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)};
 const type = new services.TypeSrvc(q, {}, {});
 type.TYPES = {'GDO\\Maps\\GDT_Polygon': ['GDO\\Core\\GDT_JSON', 'GDO\\Core\\GDT_String']};
 type.FIELDS = {};
 const socket = {sendBinary: () => Promise.resolve(null)};
 const position = {hasPosition: () => true, CURRENT: {lat: 52.27, lng: 10.53}};
 const rooms = new services.RoomSrvc(q, {getOrCreate: id => ({id: () => id})}, {}, {},
  position, socket, type);
 return {context, type, rooms, socket, position};
}

function message(context, ...strings) {
 const m = new context.GWS_Message();
 for (const value of strings) m.writeString(value);
 return new context.GWS_Message(m.binaryBuffer());
}

test('Missing room distance flag keeps the server default visible', () => {
 const {context} = setup();
 const missing = new context.LUPRoom({room_id: 1});
 const hidden = new context.LUPRoom({room_id: 2, room_show_distance: 0});
 const visible = new context.LUPRoom({room_id: 3, room_show_distance: 1});
 assert.equal(missing.showDistance(), true);
 assert.equal(hidden.showDistance(), false);
 assert.equal(visible.showDistance(), true);
});

test('Nullable JSON and Array read the next field without losing byte alignment', () => {
 const {context, type} = setup();
 for (const klass of ['GDO\\Core\\GDT_JSON', 'GDO\\Core\\GDT_Array']) {
  for (const value of ['', 'null']) {
   const m = message(context, value, 'Nächster Ort');
   assert.equal(type.parseBinaryType(klass, m, klass, {}), null);
   assert.equal(m.readString(), 'Nächster Ort');
   assert.equal(m.hasMore(), false);
  }
 }
});

test('Polygon subclasses remain in room_polygon and do not flatten into the room', () => {
 const {context, type} = setup();
 type.FIELDS.Room = {
  room_polygon: {type: 'GDO\\Maps\\GDT_Polygon', options: {}},
  room_name: {type: 'GDO\\Core\\GDT_String', options: {}},
 };
 const polygon = {type: 'Polygon', coordinates: [[[10, 52], [11, 52], [10, 53], [10, 52]]]};
 for (const value of [null, polygon]) {
  const room = {JSON: {}};
  const m = message(context, value === null ? '' : JSON.stringify(value), 'Café');
  type.parseBinaryGDO(m, 'Room', room);
  assert.equal(JSON.stringify(room.JSON.room_polygon), JSON.stringify(value));
  assert.equal(room.JSON.room_name, 'Café');
  assert.equal(room.JSON.coordinates, undefined);
  assert.equal(m.hasMore(), false);
 }
});

test('Malformed nonempty JSON still rejects instead of silently replacing data', () => {
 const {context, type} = setup();
 assert.throws(() => type.parseBinaryType('GDO\\Core\\GDT_JSON', message(context, '{broken'), '', {}),
  {name: 'SyntaxError'});
});

for (const includeAll of [false, true]) {
 test(`Parser failure releases the ${includeAll ? 'catalogue' : 'nearby'} request for retry`, async () => {
  const {context, rooms, socket} = setup();
  let calls = 0;
  socket.sendBinary = () => {
   calls++;
   // Every current page starts with its total before room parsing can fail.
   return Promise.resolve(new context.GWS_Message(new context.GWS_Message().write32(1).binaryBuffer()));
  };
  rooms.parseRoomsMessage = () => { throw new SyntaxError('invalid room JSON'); };
  const first = rooms.withRooms(includeAll);
  assert.equal(rooms.withRooms(includeAll), first);
  let timer;
  try {
   await assert.rejects(Promise.race([first, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('request remained pending')), 250);
   })]), /invalid room JSON/);
  } finally { clearTimeout(timer); }
  const key = includeAll ? 'ALL_ROOMS_LOADING' : 'ROOMS_LOADING';
  assert.equal(rooms[key], null);
  const expected = [{id: () => 17}];
  rooms.parseRoomsMessage = () => expected;
  assert.equal(await rooms.withRooms(includeAll), expected);
  assert.equal(calls, 2);
  assert.equal(rooms[key], null);
 });
}

if (process.env.LUP_BINARY_ROOMS_JSON && process.env.LUP_TYPES_JSON) {
 test('Actual backend room/address binary records parse completely in the frontend', () => {
  const {context, type, rooms} = setup();
  const metadata = JSON.parse(fs.readFileSync(process.env.LUP_TYPES_JSON, 'utf8')).data;
  type.TYPES = metadata.types;
  type.FIELDS = metadata.fields;
  const rows = JSON.parse(fs.readFileSync(process.env.LUP_BINARY_ROOMS_JSON, 'utf8')).rows;
  assert.ok(rows.length >= 100);
  const payloads = rows.map(row => Buffer.concat([Buffer.from(row.payload_base64, 'base64'), Buffer.alloc(4)]));
  const bytes = Uint8Array.from(Buffer.concat(payloads));
  const m = new context.GWS_Message(bytes.buffer);
  const parsed = rooms.parseRoomsMessage(m);
  assert.equal(parsed.length, rows.length);
  parsed.forEach((room, i) => {
   assert.equal(room.id(), Number(rows[i].room_id));
   assert.equal(room.name(), rows[i].name);
   assert.equal(room.city(), rows[i].address.address_city);
   assert.equal(room.street(), rows[i].address.address_street);
  });
  assert.equal(m.hasMore(), false);
  assert.equal(m.TRUNCATED, false);
 });
}

test('Complete catalogue uses the backend discovery sentinel and stays separate from nearby GPS', async () => {
 const {context, rooms, socket, position} = setup();
 let request;
 socket.sendBinary = message => {
  request = message;
  return Promise.resolve(new context.GWS_Message(new ArrayBuffer(0)));
 };
 rooms.parseRoomsMessage = () => [];
 position.hasPosition = () => false;

 assert.deepEqual(await rooms.withRooms(true), []);
 const wire = new context.GWS_Message(request.binaryBuffer());
 assert.equal(wire.readCmd(), 0x1101);
 wire.readMid();
 assert.equal(wire.readFloat(), 0);
 assert.equal(wire.readFloat(), 0);
 await assert.rejects(rooms.withRooms(false), /GPS position required/);
});

test('A single room failure rejects, releases its request and retries its blank placeholder', async () => {
 const {rooms,socket}=setup();let calls=0;
 socket.sendBinary=()=>{calls++;return Promise.resolve(null)};
 rooms.parseRoomMessage=()=>{throw new SyntaxError('bad room')};
 const first=rooms.withRoom(9);assert.equal(rooms.withRoom(9),first);
 await assert.rejects(first,/bad room/);assert.equal(rooms.ROOM_LOADING[9],undefined);
 const expected={id:()=>9,name:()=> 'Bar'};rooms.parseRoomMessage=()=>expected;
 assert.equal(await rooms.withRoom(9),expected);assert.equal(calls,2);
 assert.equal(await rooms.withRoom(9),expected);assert.equal(calls,2);
 socket.sendBinary=()=>Promise.reject(new Error('offline'));
 await assert.rejects(rooms.withRoom(9,true),/offline/);
 assert.equal(rooms.ROOM_LOADING[9],undefined);
});
