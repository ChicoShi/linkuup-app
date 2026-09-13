const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ctx=vm.createContext({console,window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'js/model/lup-room.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js/pages/locations/lup-location-gesture.js'),'utf8'),ctx);
const Room=ctx.LUPRoom,Gesture=ctx.window.LupLocationGesture;
test('Hide known import diagnostics while keeping provenance and actual description',()=>{
 const info='Ein Café am Park.\nQuelle: OpenStreetMap contributors (ODbL). [osm-node-123] https://www.openstreetmap.org/node/123 | Lokaler Test: Kreis innerhalb OSM-Gebäude; Betreiber ungeprüft.';
 const room=new Room({room_info:info});assert.equal(room.info(),'Ein Café am Park.');assert.equal(room.hasOSMSource(),true);assert.equal(room.JSON.room_info,info);
 assert.equal(new Room({room_info:'Quelle: unser eigener Garten. Kaffee & Kuchen.'}).info(),'Quelle: unser eigener Garten. Kaffee & Kuchen.');
});
test('The Google Maps link retains a complete address and escapes punctuation',()=>{
 const r=new Room({room_name:'Café & Bar',address_street:'Am Markt 4',address_zip:'38100',address_city:'Braunschweig'});
 const u=new URL(r.mapsListingHref());assert.equal(u.origin,'https://www.google.com');assert.equal(u.searchParams.get('query'),'Café & Bar Am Markt 4 38100 Braunschweig');
});
test('No real GPS or an outside position never opens room access',()=>{
 const r=new Room({room_pos_lat:52.27,room_pos_lng:10.53,room_radius:0.003});
 Room.PositionSrvc={hasPosition:()=>false};assert.equal(r.inChatRange(),false);
 Room.PositionSrvc={hasPosition:()=>true,distanceTo:()=>.020};assert.equal(r.inChatRange(),false);
 Room.PositionSrvc.distanceTo=()=>.001;assert.equal(r.inChatRange(),true);
});
test('Tap jitter stays a tap; a horizontal swipe suppresses a room click',()=>{
 const g=new Gesture();g.start(0,0);assert.equal(g.move(4,2),false);assert.equal(g.end(),false);
 g.start(0,0);assert.equal(g.move(30,2),true);assert.equal(g.end(),true);assert.equal(g.move(80,0),false);
});
test('A vertical gesture keeps its intent even when the finger later moves sideways',()=>{
 const g=new Gesture();g.start(100,100);assert.equal(g.move(102,140),false);assert.equal(g.move(180,141),false);assert.equal(g.end(),false);
});
if(process.env.LUP_IMPORTED_ROOMS_JSON){
 test('All 100 backend payload records populate address, pin and public description',()=>{
  const rows=JSON.parse(fs.readFileSync(process.env.LUP_IMPORTED_ROOMS_JSON,'utf8')).rows;assert.equal(rows.length,100);
  for(const x of rows){
   const r=new Room({...x.address,room_id:Number(x.room_id),room_name:x.name,room_info:x.info,room_pos_lat:x.binary_lat,room_pos_lng:x.binary_lng,room_radius:x.radius_km});
   assert.ok(r.id()>0);assert.equal(r.lat(),x.binary_lat);assert.equal(r.lng(),x.binary_lng);assert.ok(r.street()&&r.city()&&r.zip());assert.equal(r.info(),'');assert.equal(r.hasOSMSource(),true);assert.ok(new URL(r.mapsListingHref()).searchParams.get('query').includes(x.name));
  }
 });
}
