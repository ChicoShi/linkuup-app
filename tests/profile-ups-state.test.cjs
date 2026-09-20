const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const q = {all: Promise.all.bind(Promise)};
function setup(file, name, deps, extras = {}) {
 let ctor;
 const chain = {config(){return chain}, controller(n,fn){if(n===name)ctor=fn;return chain}, directive(){return chain}};
 const context = {window:{GWF_USER:{id:()=>1},LUP_CONFIG:{server:"http://localhost/",cors:"local"}}, console:{log(){}}, angular:{module:()=>chain}, GDO_Profile:class{}, ...extras};
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const args = ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(s=>s.trim());
 ctor(...args.map(n=>deps[n]||{}));
 return deps.$scope;
}
function scope() { const handlers={}; return {data:{authenticated:true},$on(n,f){handlers[n]=f},handlers}; }
const user = (id) => ({id:()=>id, isSelf:()=>id===1, JSON:{}});
function profile(own=false, savedInterest='owner default') {
 const s=scope();
 setup('js/pages/profile/lup-profile.js','ProfileCtrl',{$scope:s,SettingsSrvc:{CACHE:{About:{lup_interest:{options:{var:savedInterest}},lup_drinks:{},lup_has_pet:{}}},setting:()=>null},RenderSrvc:{renderClass:(_,value)=>value}});
 s.data.user=user(own?1:2); return s;
}
test('Profile light states honour server denials for guests/members and permitted friends without fallback leaks',()=>{
 for(const role of ['guest','member','friend']){
  const s=profile(),p={JSON:{lup_interest:'sensitive',lup_drinks:'tea'},ACL:{lup_interest:'acl_friends',lup_drinks:'acl_members'},EMPTY:{},ERRORS:{}};
  if(role!=='friend')p.ERRORS.lup_interest='not allowed';
  if(role==='guest')p.ERRORS.lup_drinks='not allowed';
  const fields=s.buildProfileGroups(p).flatMap(g=>g.fields),interest=fields.find(f=>f.key==='lup_interest'),drink=fields.find(f=>f.key==='lup_drinks');
  assert.equal(interest.visible,role==='friend');assert.equal(drink.visible,role!=='guest');
  if(!interest.visible){assert.equal(interest.value,undefined);assert.equal(s.renderProfileSetting(interest),'');}
  const empty=fields.find(f=>f.key==='lup_has_pet');assert.equal(empty.visible,false);assert.equal(empty.value,undefined);
 }
});
test('Stored privacy restricts visitors while owners see their own populated facts',()=>{
 for(const acl of ['acl_noone','acl_hidden','acl_friends','acl_members']){
  for(const own of [true,false]){
   const s=profile(own),p={JSON:{lup_interest:'saved fact'},ACL:{lup_interest:acl},ERRORS:{}};
   if(!own)p.ERRORS.lup_interest='not allowed';
   const field=s.buildProfileGroups(p).flatMap(g=>g.fields).find(f=>f.key==='lup_interest');
   assert.equal(field.visible,own,`${acl}, owner=${own}`);
   assert.equal(field.value,own?'saved fact':undefined);
   assert.equal(s.renderProfileSetting(field),own?'saved fact':'');
   assert.equal(field.acl,acl);
  }
 }
});
test('Owner denials, explicit emptiness and unset enum values remain unlit',()=>{
 const s=profile(true, '');
 for(const p of [
  {JSON:{lup_interest:'stale'},ERRORS:{lup_interest:'not allowed'}},
  {JSON:{lup_interest:'stale'},EMPTY:{lup_interest:true}},
  {JSON:{lup_interest:0}},
  {JSON:{lup_interest:'0'}}
 ]){
  const field=s.buildProfileGroups(p).flatMap(g=>g.fields).find(f=>f.key==='lup_interest');
  assert.equal(field.visible,false);assert.equal(field.value,undefined);
  assert.equal(s.renderProfileSetting(field),'');
 }
 assert.doesNotThrow(()=>s.buildProfileGroups({JSON:{lup_interest:'readable'}}));
});
test('Missing legacy enum placeholders use saved facts only in the owner view',()=>{
 for(const value of [undefined,0,'0']){
  for(const own of [true,false]){
   const s=profile(own),p={JSON:{lup_interest:value}};
   const field=s.buildProfileGroups(p).flatMap(g=>g.fields).find(f=>f.key==='lup_interest');
   assert.equal(field.visible,own);
   assert.equal(field.value,own?'owner default':undefined);
  }
 }
});
test('Explicit server denials and empty markers override saved owner fallbacks',()=>{
 const s=profile(true);
 for(const p of [
  {JSON:{lup_interest:'0'},ERRORS:{lup_interest:'not allowed'}},
  {JSON:{lup_interest:'0'},EMPTY:{lup_interest:true}}
 ]){
  const field=s.buildProfileGroups(p).flatMap(g=>g.fields).find(f=>f.key==='lup_interest');
  assert.equal(field.visible,false);assert.equal(field.value,undefined);
 }
});
test('Visitors never recover private facts from cached owner settings',()=>{
 const s=profile();
 for(const acl of ['acl_noone','acl_hidden']){
  const p={JSON:{lup_interest:'must stay private'},ACL:{lup_interest:acl}};
  const field=s.buildProfileGroups(p).flatMap(g=>g.fields).find(f=>f.key==='lup_interest');
  assert.equal(field.visible,false);assert.equal(field.value,undefined);
  assert.equal(s.renderProfileSetting(field),'');
 }
 const field=s.buildProfileGroups({JSON:{}}).flatMap(g=>g.fields).find(f=>f.key==='lup_interest');
 assert.equal(field.visible,false);assert.equal(field.value,undefined);
});
const packet=(values)=>({read32:()=>values.shift(),hasMore:()=>values.length>0});
test('Unset account basics do not light up as completed profile facts',()=>{
 const s=profile(true);
 s.data.user.gender=()=> 'no_gender';s.data.user.countryId=()=> 'zz';
 const fields=s.buildProfileGroups({JSON:{},ACL:{}}).flatMap(g=>g.fields);
 for(const key of ['gender','country_of_origin']){
  const field=fields.find(f=>f.key===key);
  assert.equal(field.visible,false);assert.equal(field.value,undefined);assert.equal(s.renderProfileSetting(field),'');
 }
});
function likesSetup(){
 const s=scope(),state={calls:0,fail:false,values:[2,7,3,8,5]},users=new Map([1,2,7,8].map(id=>[id,user(id)]));
 setup('js/pages/likes/lup-likes.js','LikesCtrl',{$scope:s,$routeParams:{id:2},$q:q,UserSrvc:{withUser:async id=>users.get(id)},LikeSrvc:{getLikeList:()=>{state.calls++;return state.fail?Promise.reject('denied'):Promise.resolve(packet(state.values.slice()))}}});
 return {s,state,users};
}
test('Ups coalesce entry events, resolve real portraits, replace refreshes and never store counts on shared users',async()=>{
 const {s,state,users}=likesSetup();const first=s.init();assert.equal(s.init(),first);await first;
 assert.equal(state.calls,1);assert.equal(s.data.totalUps,8);assert.deepEqual(Array.from(s.data.upConnections,c=>c.user.id()),[8,7]);
 assert.equal(users.get(8).likedMe,undefined);assert.equal(s.data.upsLoading,false);
 state.values=[2,7,1];await s.init();assert.equal(s.data.totalUps,1);assert.equal(s.data.upConnections.length,1);
 state.fail=true;await s.init();assert.equal(s.data.upsError,true);assert.equal(s.data.upConnections.length,0);
 state.fail=false;await s.init();assert.equal(s.data.upsError,false);
});
test('Ups reject mismatched/truncated responses and cannot repaint a page after leaving it',async()=>{
 const {s,state}=likesSetup();state.values=[3,7,5];await s.init();assert.equal(s.data.upsError,true);assert.equal(s.data.totalUps,0);
 state.values=[2,7];await s.init();assert.equal(s.data.upsError,true);
 state.values=[2,7,5];const pending=s.init();s.handlers.$destroy();s.data.upConnections=['new page'];await pending;
 assert.deepEqual(s.data.upConnections,['new page']);
});
