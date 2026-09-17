const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const q={resolve:Promise.resolve.bind(Promise),when:Promise.resolve.bind(Promise),reject:Promise.reject.bind(Promise),defer(){let resolve,reject;let promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise};}};
const quiet={log(){},warn(){},error(){}};
function load(file,window={},extras={}){
 let ctor;const context={window,console:quiet,Date,Array,Set,URLSearchParams,angular:{noop(){},module:()=>({service(n,c){ctor=c;}})},...extras};
 context.GWS_Message=class {constructor(){this.words=[];}cmd(n){this.command=n;return this;}sync(){return this;}write32(n){this.words.push(n);return this;}write16(n){this.words.push(n);return this;}writeString(n){this.words.push(n);return this;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/service',file),'utf8'),context);return {ctor,context};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('Help is remembered per profile, survives failed writes and synchronizes later without duplicate popups',async()=>{
 let id=1,fail=true,close,shows=0,handler;const stored=new Map(),sent=[];
 const window={GWF_USER:{id:()=>id},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}};
 const {ctor}=load('lup-help-service.js',window);
 const socket={sendBinary:m=>{sent.push(m);if(m.command===0x1190)return Promise.resolve('[]');return fail?Promise.reject('offline'):Promise.resolve();}};
 const help=new ctor({$on:(n,f)=>handler=f},q,socket,{confirm:()=>{shows++;return new Promise(r=>close=r);}});
 const a=help.showHelp('locations','hint');help.showHelp('locations','hint');await tick();assert.equal(shows,1);close();await a;
 handler();await help.showHelp('locations','hint');assert.equal(shows,1);
 id=2;const b=help.showHelp('locations','hint');await tick();assert.equal(shows,2);close();await b;
 fail=false;id=1;handler();await help.withReads();await tick();assert.ok(sent.filter(m=>m.command===0x1191).length>=3);
});
test('An old help response cannot dismiss or display onboarding for a different signed-in profile',async()=>{
 let id=1,resolve;const {ctor}=load('lup-help-service.js',{GWF_USER:{id:()=>id},localStorage:{getItem:()=>null,setItem(){}}});
 let shown=0;const help=new ctor({$on(){}},q,{sendBinary:()=>new Promise(r=>resolve=r)},{confirm(){shown++;return Promise.resolve();}});
 const request=help.showHelp('chat','hint');id=2;resolve('[]');await request;assert.equal(shown,0);
});
test('Friend actions stay pending until acknowledged; errors keep the old relation and release the lock',async()=>{
 const user={id:()=>2,JSON:{relation_pending:0}};let calls=0,reject,resolve;
 const {ctor}=load('lup-friend-service.js',{GWF_USER:{id:()=>1},t:k=>k});
 const socket={sendBinary:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b});}};
 const service=new ctor(q,socket,{showMessage(){}},{},{withUser:()=>Promise.resolve(),gotUserMessage(){}});
 const first=service.addFriend(user),second=service.addFriend(user);assert.equal(first,second);assert.equal(calls,1);assert.equal(user.JSON.relation_pending,0);
 reject('denied');await assert.rejects(first);assert.equal(user.JSON.relation_pending,0);assert.equal(service.busy[2],undefined);
 const next=service.addFriend(user);resolve({});await next;assert.equal(user.JSON.relation_pending,1);
 const cancelled=service.cancelFriendRequest(user);reject('offline');await assert.rejects(cancelled);assert.equal(user.JSON.relation_pending,1);
 const demo={id:()=>-1,isPreview:true,JSON:{}};await assert.rejects(service.addFriend(demo));assert.equal(calls,3);
});
test('Notifications paginate in seconds plus an id cursor, preserve unread totals and retry after failures',async()=>{
 const {ctor}=load('lup-notification-service.js',{}, {GWFPagination:class{reset(){}},LUPNotification:class{}});
 let sent,fail=true;const service=new ctor({$on(){},updateNotificationCount(){}},q,{sendBinary:m=>{sent=m;return fail?Promise.reject('offline'):Promise.resolve();}},{},{},{});
 service.COUNT=40;service.UNREAD=30;service.SORTED=[{id:()=>100,created:()=>1789550000000}];service.OLDEST=service.SORTED[0];
 await assert.rejects(service.loadMore());assert.deepEqual(sent.words,[1789550000,100]);assert.equal(service.WORKING,false);assert.equal(service.unreadNotificationCount(),30);
 fail=false;service.gotPage=()=>service.SORTED;await service.loadMore();assert.equal(service.WORKING,false);
 const unread={id:()=>101,read(){return !!this.JSON.note_read;},JSON:{}};service.CACHE[101]=unread;
 service.markedRead({read32:()=>101});service.markedRead({read32:()=>101});assert.equal(service.UNREAD,29);
});
test('Local guest preview never changes real membership and is unavailable on production hosts',()=>{
 function make(host){const {ctor}=load('lup-room-service.js',{location:{hostname:host,search:'?preview=presence'},sessionStorage:{getItem:()=>null,setItem(){}},t:k=>k},{LUPRoom:class{constructor(json){this.JSON=json;}}});return new ctor(q,{}, {},{}, {},{},{});}
 const realUsers=[{id:()=>7}],room={name:()=> 'Braunschweig Chat',USERS:realUsers};
 const local=make('app.localhost');assert.equal(local.displayUsers(room).length,20);assert.ok(local.displayUsers(room).every(u=>u.isPreview&&u.id()<0));assert.equal(room.USERS,realUsers);local.togglePreview();assert.equal(local.displayUsers(room),realUsers);
 const prod=make('app.linkuup.de');assert.equal(prod.displayUsers(room),realUsers);prod.togglePreview();assert.equal(prod.isPreviewRoom(room),false);
});

test('Five-minute avatar rehearsal keeps real users intact, caps faces at twenty and can pause or stop',()=>{
 function make(host){const {ctor}=load('lup-room-service.js',{location:{hostname:host,search:'?preview=balloons'},sessionStorage:{getItem:()=>null},t:k=>k},{LUPRoom:class{constructor(json){this.JSON=json;}}});return new ctor(q,{},{},{},{},{},{});}
 const realUsers=[{id:()=>7}],room={name:()=> 'Braunschweig Chat',USERS:realUsers};
 const local=make('app.localhost'),simulation=local.createPresenceSimulation(room);
 assert.equal(local.displayUsers(room).length,0);
 assert.equal(local.createPresenceSimulation(room),null); // One owner, no competing clocks.
 simulation.advance(39000); assert.equal(local.displayUsers(room).length,20);
 const firstTwenty=local.displayUsers(room).slice();
 simulation.advance(13000); assert.equal(local.displayUsers(room).length,19);
 assert.equal(local.displayUsers(room).includes(firstTwenty[3]),false); // Departure from the middle.
 simulation.running=false;simulation.advance(20000);assert.equal(simulation.elapsed,52000);
 simulation.running=true;
 for(let time=52500;time<=300000;time+=500){simulation.advance(500);const guests=local.displayUsers(room);assert.ok(guests.length<=20);assert.equal(new Set(guests.map(u=>u.id())).size,guests.length);assert.equal(room.USERS,realUsers);}
 assert.equal(simulation.done,true);assert.equal(simulation.elapsed,300000);assert.equal(local.displayUsers(room).length,20);
 simulation.stop();assert.equal(local.PREVIEW.simulating,false);assert.equal(local.displayUsers(room).length,20);
 const prod=make('app.linkuup.de');assert.equal(prod.createPresenceSimulation(room),null);assert.equal(prod.displayUsers(room),realUsers);
 assert.equal(local.createPresenceSimulation({name:()=> 'Another room',USERS:[]}),null);
});

test('Escape and outside dismissal settle the public confirm/menu promise',async()=>{
 for(const method of ['confirm','menu']){
  const {ctor,context}=load('lup-dialog-service.js',{LUP_BUILD:'test'});
  context.document={body:{}};context.angular.element=v=>v;
  let dismiss;const dialogs={show:()=>new Promise((resolve,reject)=>dismiss=reject)};
  const service=new ctor(q,dialogs,()=>({}),{});
  const pending=service[method]('dialog.html',{});
  dismiss('escape');await assert.rejects(pending,r=>r==='escape');
  assert.equal(service.lastDialog.length,0);
 }
});

test('Friendship frames and replayed notifications refresh server totals without counting twice',async()=>{
 let ctor,total=3;const requests=[],own={JSON:{},id:()=>1,isSelf:()=>true,friends:()=>total};
 const scope={$on(){},$watch(){},$broadcast(){}};
 const root={$on(){},$broadcast(){}};
 const globals={document:{cookie:''},window:{LUP_CONFIG:{server:'http://localhost/',cors:'local'},location:{hash:''},GWF_USER:own},console:quiet,
  angular:{noop(){},module:()=>({controller(n,c){ctor=c;}})}};
 for(const name of ['LUPRoom','LUPRoomVisit','LUPNotification','LUPComment','LUP_QueryThread','LUP_QueryMessage'])globals[name]={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/controller/lup-ctrl.js'),'utf8'),globals);
 const deps={$scope:scope,$rootScope:root,$q:q,$interval:()=>0,$translate:{instant:k=>k,use:()=>Promise.resolve()},
  RequestSrvc:{sendGWF:()=>new Promise(()=>{})},
  UserSrvc:{withUser(id,refresh){requests.push({id,refresh});return Promise.resolve(id===1?own:{isSelf:()=>false});}}};
 const args=ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(s=>s.trim());
 ctor(...args.map(arg=>deps[arg]||{}));
 const note={id:()=>99,data:()=>({user:1,friend:2}),type:()=> 'friends'};
 scope.applyFriendCountNotification(note);scope.applyFriendCountNotification(note);await tick();
 assert.equal(requests.length,1);assert.equal(scope.data.friendsCount,3);
 total=2;const ids=[1,2];scope.cmd_0602({read32:()=>ids.shift()});await tick();
 assert.equal(scope.data.friendsCount,2);assert.deepEqual(requests.slice(1),[{id:1,refresh:true},{id:2,refresh:true}]);
});
