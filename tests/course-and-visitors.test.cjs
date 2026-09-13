const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const summary=require('../js/model/lup-course-summary.js');
const visit=(id,count,last,category)=>({roomId:id,visit_count:count,visit_last:last,room:{category:()=>category,name:()=>`Ort ${id}`}});

test('Recorded counts, category filter and frequent bar use real visits without a favourite claim',()=>{
 const visits=[visit(1,12,100,5),visit(2,6,200,3),visit(3,4,300,11),visit(4,1,400,17)];
 const result=summary(visits,'all','frequent');
 assert.equal(result.visits,23);assert.equal(result.places,4);assert.equal(result.bars,2);
 assert.equal(result.featured.roomId,2);assert.equal(result.featuredIsBar,true);
 assert.equal(result.items[0].roomId,1);assert.equal(result.favourite,undefined);
 assert.deepEqual(summary(visits,'bars','recent').items.map(v=>v.roomId),[3,2]);
 assert.deepEqual(visits.map(v=>v.roomId),[1,2,3,4]);
});
test('Empty visits, non-bar collections and frequency ties are deterministic',()=>{
 assert.equal(summary([]).featured,null);assert.equal(summary([]).visits,0);
 assert.equal(summary([visit(0,8,100,3),visit(1,0,100,3)]).places,0);
 const result=summary([visit(3,2,100,5),visit(2,2,200,17),visit(1,2,200,5)]);
 assert.equal(result.featured.roomId,1);assert.equal(result.featuredIsBar,false);
});
function controller(file,name,deps){
 let ctor;
 const chain={config(){return chain},controller(n,fn){if(n===name)ctor=fn;return chain}};
 const context=vm.createContext({window:{LupCourseSummary:summary},console:{log(){}},angular:{module:()=>chain}});
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const args=ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(s=>s.trim());
 ctor(...args.map(arg=>deps[arg]||{}));return deps.$scope;
}
function scope(){return {data:{authenticated:true},$on(){},catchUnknown(error){throw error}};}
function courseSetup(existing){
 const state={calls:0,fail:false,words:[8,3,1789329600],roomFail:false};
 const data=existing||scope();
 controller('js/pages/course/lup-course.js','CourseCtrl',{
  $scope:data,$routeParams:{id:1},$q:{all:Promise.all.bind(Promise)},
  UserSrvc:{withUser:()=>Promise.resolve({id:()=>1})},
  CourseSrvc:{getCourse:()=>{state.calls++;if(state.fail)return Promise.reject(new Error('private'));
   const values=state.words.slice();return Promise.resolve({LENGTH:values.length*4,INDEX:0,read32(){this.INDEX+=4;return values.shift()},hasMore(){return this.INDEX<this.LENGTH}})}},
  RoomSrvc:{withRoom:()=>state.roomFail?Promise.reject(new Error('room failed')):Promise.resolve({name:()=> 'Bar',category:()=>3})}
 });return {state,s:data};
}
test('Course waits for actual rooms and releases loading after privacy/room failures and retry',async()=>{
 const {s,state}=courseSetup();await s.loadCourses();assert.equal(s.journey.visits,3);assert.equal(s.data.courseLoading,false);
 state.fail=true;await s.loadCourses();assert.equal(s.data.courseError,true);assert.equal(s.journey.places,0);
 state.fail=false;state.roomFail=true;await s.loadCourses();assert.equal(s.data.courseError,false);assert.equal(s.data.course[0].room,null);assert.equal(s.journey.visits,3);
 state.roomFail=false;await s.loadCourses();assert.equal(s.data.courseError,false);assert.equal(s.journey.places,1);
 state.words=[8,3];await s.loadCourses();assert.equal(s.data.courseError,true);assert.equal(s.data.courseLoading,false);
});
test('Opening course again loads again even when shared data carries a legacy initialized flag',async()=>{
 const s=scope();s.data.courseInitialized=true;const first=courseSetup(s);await first.s.loadCourses();
 const second=courseSetup(s);second.s.init();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(second.state.calls,1);assert.equal(s.journey.visits,3);
});
function visitorSetup(){
 const s=scope(),state={gps:true,range:true,joined:true,calls:[]};
 const own={id:()=>1,isSelf:()=>true,isMember:()=>true};
 const user={id:()=>2,isSelf:()=>false,isMember:()=>true,isFriend:()=>!!user.JSON.relationship,JSON:{relationship:null}};
 const room={USERS:[own,user],inChatRange:()=>state.range,isSelfInRoom:()=>state.joined};
 s.data.room=room;s.data.user=own;s.gotoProfile=()=>state.calls.push('profile');s.gotoQuery=()=>state.calls.push('chat');
 const friends={};for(const method of ['addFriend','cancelFriendRequest','acceptFriendRequest','denyFriendRequest','removeFriend'])friends[method]=()=>{state.calls.push(method);return Promise.resolve()};
 controller('js/pages/location/lup-location.js','LocationCtrl',{$scope:s,RoomSrvc:{BLANK_ROOM:room},PositionSrvc:{hasPosition:()=>state.gps},FriendSrvc:friends});
 s.data.roomReady=true;return {s,state,user,room};
}
test('Outside/no GPS/no server membership: visitor profile, chat and friendship handlers do nothing',()=>{
 for(const missing of ['gps','range','joined']){
  const {s,state,user}=visitorSetup();state[missing]=false;
  assert.equal(s.canContactVisitor(user),false);s.openVisitorProfile(user);s.openVisitorChat(user);s.changeVisitorFriend(user);
  assert.deepEqual(state.calls,[]);
 }
});
test('Same-place actions work; leaving either side immediately closes them',async()=>{
 const {s,state,user,room}=visitorSetup();assert.equal(s.canContactVisitor(user),true);
 s.openVisitorProfile(user);s.openVisitorChat(user);await s.changeVisitorFriend(user);
 assert.deepEqual(state.calls,['profile','chat','addFriend']);
 state.range=false;s.openVisitorChat(user);s.changeVisitorFriend(user);assert.equal(state.calls.length,3);
 state.range=true;room.USERS=[];assert.equal(s.canContactVisitor(user),false);s.openVisitorProfile(user);assert.equal(state.calls.length,3);
});
test('Friendship controls choose request/cancel/accept/decline/remove and prevent duplicate sends',async()=>{
 const {s,state,user}=visitorSetup();
 user.JSON.relation_pending=1;const sending=s.changeVisitorFriend(user);s.changeVisitorFriend(user);await sending;
 user.JSON.relation_pending=0;user.JSON.relation_incoming=1;await s.changeVisitorFriend(user);await s.changeVisitorFriend(user,'decline');
 user.JSON.relation_incoming=0;user.JSON.relationship='Friend';await s.changeVisitorFriend(user);
 assert.deepEqual(state.calls,['cancelFriendRequest','acceptFriendRequest','denyFriendRequest','removeFriend']);
});

test('A confirmation opened on site cannot remove a friend after leaving',async()=>{
 let ctor,confirm;const calls=[];
 const q={defer(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise}}};
 const context=vm.createContext({console:{log(){}},angular:{module:()=>({service(n,fn){ctor=fn}})}});
 vm.runInContext(fs.readFileSync(path.join(root,'js/service/lup-friend-service.js'),'utf8'),context);
 const service=new ctor(q,{}, {},{confirm:()=>new Promise(resolve=>{confirm=resolve})},{});
 service.reallyRemoveFriend=()=>calls.push('remove');let onSite=true;
 const operation=service.removeFriend({id:()=>2},()=>onSite);onSite=false;confirm();
 assert.equal(await operation,null);assert.deepEqual(calls,[]);
});
