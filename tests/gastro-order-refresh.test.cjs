const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../preview/gastro/app.js'),'utf8').split('// Automatic order refresh:')[1];
function fixture(){
 const events={}, label={}, x={state:{orders:[]},view:'operator',tab:'menu',activityEpoch:0,lastOrderSync:0,busy:false,integrated:false,csrf:'',calls:0,renders:0};
 x.notices=[];Object.assign(x,{notice:text=>x.notices.push(text),document:{documentElement:{lang:"de"},hidden:false,activeElement:null,addEventListener:(k,f)=>events[k]=f},dialog:{open:false,addEventListener:(k,f)=>events[k]=f},window:{addEventListener:(k,f)=>events[k]=f},$ :()=>label,render:()=>x.renders++,setInterval:(f,ms)=>{x.tick=f;x.interval=ms},api:async()=>{x.calls++;return {orders:[{id:'new',status:'new'}]}}});
 vm.createContext(x);vm.runInContext('// Automatic order refresh:'+source,x);return {x,events,label};
}
test('open board receives new orders; unchanged data does not redraw; guest receives status',async()=>{
 const {x}=fixture();await x.tick();assert.equal(x.calls,1);assert.equal(x.renders,1);assert.equal(x.state.orders[0].id,'new');assert.deepEqual(x.notices,['Neue Bestellung eingegangen']);await x.tick();assert.equal(x.renders,1);assert.equal(x.notices.length,1);
 x.view='guest';x.tab='orders';x.api=async()=>({orders:[{id:'new',status:'delivered'}]});await x.tick();assert.equal(x.state.orders[0].status,'delivered');assert.equal(x.renders,2);assert.equal(x.interval,5000);
});
test('no calls from hidden pages, editor, dialogs, mutations or departed page',async()=>{
 const {x,events}=fixture();x.document.hidden=true;await x.tick();x.document.hidden=false;x.tab='editor';await x.tick();x.tab='menu';x.dialog.open=true;await x.tick();x.dialog.open=false;x.busy=true;await x.tick();x.busy=false;events.pagehide();await x.tick();assert.equal(x.calls,0);
 events.pageshow();await new Promise(setImmediate);assert.equal(x.calls,1);
});
test('one pending request; a later user action invalidates its result',async()=>{
 const {x}=fixture();let resolve;x.api=()=>{x.calls++;return new Promise(r=>resolve=r)};const first=x.tick();await x.tick();assert.equal(x.calls,1);x.activityEpoch++;resolve({orders:[{id:'stale'}]});await first;assert.equal(x.renders,0);assert.equal(x.state.orders.length,0);
});
test('view switch or opened dialog prevents stale background redraw',async()=>{
 for(const change of [x=>x.tab='editor',x=>x.dialog.open=true,x=>x.document.hidden=true]){const {x}=fixture();let resolve;x.api=()=>new Promise(r=>resolve=r);const p=x.tick();change(x);resolve({orders:[{id:'stale'}]});await p;assert.equal(x.renders,0);}
});
test('error remains visible, retry recovers without parallel requests',async()=>{
 const {x,label}=fixture();x.api=async()=>{throw Error('offline')};await x.tick();assert.match(label.textContent,/fehlgeschlagen/);x.api=async()=>({orders:[]});await x.tick();assert.match(label.textContent,/alle 5 Sekunden/);
});

test('open sidebar pauses polling, including a response already in flight',async()=>{
 const {x}=fixture();let nav=true;x.document.body={classList:{contains:()=>nav}};
 await x.tick();assert.equal(x.calls,0);nav=false;
 let resolve;x.api=()=>new Promise(r=>resolve=r);const pending=x.tick();nav=true;
 resolve({orders:[{id:'new'}]});await pending;assert.equal(x.renders,0);
 nav=false;x.api=async()=>({orders:[{id:'new'}]});await x.tick();assert.equal(x.renders,1);
});

test('closed host sheet does not poll and resumes on reopening',async()=>{
 const {x}=fixture();x.hostVisible=false;await x.tick();assert.equal(x.calls,0);
 x.hostVisible=true;await x.tick();assert.equal(x.calls,1);
});
