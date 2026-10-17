const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({console, window: {}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/model/lup-room.js'), 'utf8'), context);
const Room = context.LUPRoom;
const polygon = {type: 'Polygon', coordinates: [[[10, 52], [10.002, 52], [10.002, 52.002], [10, 52.002], [10, 52]]]};
function room(overrides = {}) {
  return new Room({room_pos_lat: 52.001, room_pos_lng: 10.001, room_radius: .001,
    room_polygon: polygon, room_join_tolerance: 0, ...overrides});
}
function position(lat, lng, distance = 10, known = true) {
  Room.PositionSrvc = {CURRENT: {lat, lng}, hasPosition: () => known, distanceTo: () => distance};
}
test('Explicit zero uses the polygon even beyond display radius; edges are inside', () => {
  const r = room();
  for (const [lat, lng] of [[52.001,10.001], [52,10.001], [52,10]]) {
    position(lat,lng); assert.equal(r.inChatRange(),true);
  }
  position(52.0021,10.001,0); assert.equal(r.inChatRange(),false);
});
test('Tolerance is kilometres from the nearest edge, including corners and reversed rings', () => {
  const r = room({room_join_tolerance:.01});
  position(52.002 + .009/111.32,10.001); assert.equal(r.inChatRange(),true);
  position(52.002 + .011/111.32,10.001); assert.equal(r.inChatRange(),false);
  const lat = 52.002 + .008/111.32;
  position(lat,10.002 + .008/(111.32*Math.cos(lat*Math.PI/180)));
  assert.equal(r.inChatRange(),false); // diagonal distance is over 10 m
  position(52.001,10.001);
  assert.equal(room({room_polygon:JSON.stringify({type:'Polygon',coordinates:[polygon.coordinates[0].slice().reverse()]}), room_join_tolerance:'0'}).inChatRange(),true);
});
test('Concave cutouts are outside even inside the bounding rectangle', () => {
  const concave={type:'Polygon',coordinates:[[[10,52],[10.002,52],[10.002,52.001],[10.001,52.001],[10.001,52.002],[10,52.002],[10,52]]]};
  position(52.0015,10.0015); assert.equal(room({room_polygon:concave}).inChatRange(),false);
  position(52.0015,10.0005); assert.equal(room({room_polygon:concave}).inChatRange(),true);
});
test('Unknown or invalid position, tolerance and polygon fail closed without radius fallback', () => {
  position(52.001,10.001,0,false); assert.equal(room().inChatRange(),false);
  for (const value of [null,undefined,NaN,Infinity,'']) {
    position(value,10.001,0); assert.equal(room().inChatRange(),false);
  }
  position(52.001,10.001,0);
  for (const tolerance of [-1,Infinity,'',false,'bad']) assert.equal(room({room_join_tolerance:tolerance}).inChatRange(),false);
  for (const shape of [null,undefined,'','{',{}, {type:'Point',coordinates:[10,52]},
    {type:'Polygon',coordinates:[[[10,52],[10.002,52],[10.002,52.002],[10,52.002]]]},
    {type:'Polygon',coordinates:[[[10,52],[10,52],[10,52],[10,52]]]},
    {type:'Polygon',coordinates:[[[10,52],[null,52],[10,52.002],[10,52]]]},
    {type:'Polygon',coordinates:[polygon.coordinates[0],polygon.coordinates[0]]}]) {
    assert.equal(room({room_polygon:shape}).inChatRange(),false);
  }
});
test('Legacy missing/null/binary-NaN tolerance preserves the old radius-only contract', () => {
  for (const tolerance of [undefined,null,NaN]) {
    const r=room({room_join_tolerance:tolerance,room_polygon:null,room_radius:.02});
    position(0,0,.01); assert.equal(r.inChatRange(),true);
    position(52.001,10.001,.03); assert.equal(r.inChatRange(),false);
    position(52.001,10.001,0,false); assert.equal(r.inChatRange(),false);
  }
});
