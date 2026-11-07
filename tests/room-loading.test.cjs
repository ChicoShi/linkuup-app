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
 const q = {resolve: Promise.resolve.bind(Promise), when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)};
 const type = new services.TypeSrvc(q, {}, {});
 type.TYPES = {'GDO\\Maps\\GDT_Polygon': ['GDO\\Core\\GDT_JSON', 'GDO\\Core\\GDT_String']};
 type.FIELDS = {'GDO\\LinkUUp\\LUP_Room':{},'GDO\\Address\\GDO_Address':{}};
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

test('Parser failure after the count header releases the nearby request for retry', async () => {
 const {context,rooms,socket}=setup();let calls=0;
 socket.sendBinary=()=>{calls++;const m=new context.GWS_Message().write32(1);return Promise.resolve(new context.GWS_Message(m.binaryBuffer()));};
 rooms.parseRoomsMessage=()=>{throw new SyntaxError('invalid room JSON');};
 const first=rooms.withRooms();assert.equal(rooms.withRooms(),first);
 await assert.rejects(first,/invalid room JSON/);assert.equal(rooms.ROOMS_LOADING,null);
 const expected=[{id:()=>17}];rooms.parseRoomsMessage=()=>expected;
 assert.equal(await rooms.withRooms(),expected);assert.equal(calls,2);assert.equal(rooms.NUM_ROOMS,1);assert.equal(rooms.ROOMS_LOADING,null);
});

test('Nearby transport failure releases its request before retry',async()=>{
 const {rooms,socket}=setup();socket.sendBinary=()=>Promise.reject(new Error('offline'));
 await assert.rejects(rooms.withRooms(),/offline/);assert.equal(rooms.ROOMS_LOADING,null);
});

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

test('Nearby page requires GPS and sends its position and bounded page request, never a public sentinel',async()=>{
 const {context,rooms,socket,position}=setup();let request,calls=0;
 socket.sendBinary=message=>{calls++;request=message;const reply=new context.GWS_Message().write32(0);return Promise.resolve(new context.GWS_Message(reply.binaryBuffer()));};
 rooms.parseRoomsMessage=()=>[];position.hasPosition=()=>false;
 await assert.rejects(rooms.withRooms(),/GPS position required/);assert.equal(calls,0);
 position.hasPosition=()=>true;assert.deepEqual(await rooms.withRooms(),[]);
 const wire=new context.GWS_Message(request.binaryBuffer());assert.equal(wire.readCmd(),0x1101);wire.readMid();
 // Outgoing floats use network byte order; the PHP reader reverses these bytes.
 assert.ok(Math.abs(wire.BUFFER.getFloat32(wire.index(),false)-52.27)<0.001);wire.moveIndex(4);
 assert.ok(Math.abs(wire.BUFFER.getFloat32(wire.index(),false)-10.53)<0.001);wire.moveIndex(4);
 assert.equal(wire.read32(),1);assert.equal(wire.read32(),10);assert.equal(wire.hasMore(),false);
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

for(const method of ['single','page','search']) {
 test(`${method} response waits for delayed type metadata before consuming binary data`,async()=>{
  const {rooms,type,socket,context}=setup();let resolveTypes,parsed=0;
  const fields=type.FIELDS;type.FIELDS=null;type.withTypes=()=>new Promise(resolve=>resolveTypes=()=>{type.FIELDS=fields;resolve(fields);});
  const message=new context.GWS_Message(new context.GWS_Message().write32(1).binaryBuffer());socket.sendBinary=()=>Promise.resolve(message);
  const expected={id:()=>42,name:()=> 'Loaded'};
  rooms.parseRoomMessage=()=>{parsed++;return expected;};rooms.parseRoomsMessage=()=>{parsed++;return [expected];};
  const request=method==='single'?rooms.withRoom(42):method==='page'?rooms.withRooms():rooms.searchRooms('Bar');
  await new Promise(r=>setImmediate(r));assert.equal(parsed,0);assert.equal(message.index(),0);
  resolveTypes();const result=await request;assert.equal(parsed,1);assert.equal(method==='single'?result:result[0],expected);
  if(method==='page')assert.equal(rooms.NUM_ROOMS,1);
 });
 test(`${method} metadata failure rejects without parsing and the next request can retry`,async()=>{
  const {rooms,type,socket,context}=setup();let parsed=0,calls=0;
  socket.sendBinary=()=>{calls++;return Promise.resolve(new context.GWS_Message(new context.GWS_Message().write32(0).binaryBuffer()));};
  rooms.parseRoomMessage=()=>{parsed++;return {id:()=>42,name:()=> 'Loaded'};};rooms.parseRoomsMessage=()=>{parsed++;return [];};
  const load=()=>method==='single'?rooms.withRoom(42):method==='page'?rooms.withRooms():rooms.searchRooms('Bar');
  type.withTypes=()=>Promise.reject(Error('metadata offline'));await assert.rejects(load(),/metadata offline/);assert.equal(parsed,0);
  if(method==='single')assert.equal(rooms.ROOM_LOADING[42],undefined);if(method==='page')assert.equal(rooms.ROOMS_LOADING,null);
  type.withTypes=()=>Promise.resolve(type.FIELDS);await load();assert.equal(parsed,1);assert.equal(calls,2);
 });
}
test('Resolved but incomplete room metadata is rejected rather than producing a cached blank',async()=>{
 const {rooms,type,socket}=setup();type.FIELDS={};type.withTypes=()=>Promise.resolve({});socket.sendBinary=()=>Promise.resolve(null);
 rooms.parseRoomMessage=()=>assert.fail('incomplete metadata must not reach parser');
 await assert.rejects(rooms.withRoom(42),/Room metadata unavailable/);assert.equal(rooms.ROOM_LOADING[42],undefined);assert.equal(rooms.CACHE[42].name(),'');
});
