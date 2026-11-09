const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let renderer;
const x={console,window:{},angular:{module:()=>({service:(_,ctor)=>{renderer=new ctor();}})}};
vm.createContext(x);
vm.runInContext(fs.readFileSync('js/service/lup-gdt-renderer-service.js','utf8'),x);
vm.runInContext(fs.readFileSync('js/model/lup-room.js','utf8'),x);
test('Numeric settings received as strings fit Angular number inputs; blanks do not become zero',()=>{
 const setting={renderer:{input_type:'number'}};
 assert.equal(renderer.valueForSetting(setting,'1.78'),1.78);
 assert.equal(renderer.valueForSetting(setting,'0'),0);
 for(const v of [null,undefined,'',' ','NaN','Infinity']) assert.equal(renderer.valueForSetting(setting,v),null);
 assert.equal(renderer.valueForSetting({renderer:{input_type:'text'}},'001'),'001');
});
test('Missing room coordinates cannot produce a distance or radius-based entry',()=>{
 x.LUPRoom.PositionSrvc={hasPosition:()=>true,distanceTo:()=>0};
 for(const [lat,lng] of [[0,0],[null,null],['',''],[undefined,undefined],[91,10],[52,181],['x',10]]){
  const room=new x.LUPRoom({room_pos_lat:lat,room_pos_lng:lng,room_radius:1});
  assert.equal(room.distance(),null); assert.equal(room.inChatRange(),false);
 }
 const valid=new x.LUPRoom({room_pos_lat:0,room_pos_lng:10,room_radius:1});
 assert.equal(valid.distance(),0); assert.equal(valid.inChatRange(),true);
});

test('Fractional settings allow decimals while integer settings keep integer steps',()=>{assert.equal(renderer.forSetting({type:'GDO\\User\\GDT_PersonHeight'}).step,'any');assert.equal(renderer.forSetting({type:'GDO\\Core\\GDT_Int'}).step,'1');});
