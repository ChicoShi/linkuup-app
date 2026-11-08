const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../js/pages/location/lup-location.js','utf8');
function setup(host='localhost'){
 const requests=[],events=[],handlers={},dialogs=[];let timer;
 const scope={data:{room:{id:()=>1,name:()=> 'A'}},$evalAsync:f=>f(),$emit:(...x)=>events.push(x),$on:(k,f)=>handlers[k]=f};
 vm.runInNewContext(src.slice(src.indexOf('    var gastroDestroyed'),src.indexOf('\t$scope.loadedRoom')),{$scope:scope,Promise,AbortController,setTimeout:f=>{timer=f;return 1},clearTimeout(){},fetch:(url,opts)=>new Promise((resolve,reject)=>{requests.push({url,resolve,reject});opts.signal.addEventListener('abort',()=>reject(new Error('timeout')))}),location:{hostname:host,origin:'http://'+host},window:{addEventListener(){},removeEventListener(){}},document:{body:{},getElementById:()=>null},angular:{element:x=>x},$mdDialog:{show:d=>dialogs.push(d)}});
 return {scope,requests,events,handlers,dialogs,timeout:()=>timer()};
}
const reply=(r,g,ok=true)=>r.resolve({ok,json:async()=>g});
test('loading is not an empty menu; a genuine empty response is ready',async()=>{
 const x=setup();const p=x.scope.refreshGastro();assert.equal(x.scope.data.gastroState,'loading');x.scope.openGastro();assert.equal(x.dialogs[0].locals.cardData.gastroState,'loading');reply(x.requests[0],{canManage:false,menuPublished:false});await p;assert.equal(x.scope.data.gastroState,'ready');assert.equal(x.scope.data.gastroAvailable,false);
});
test('network/HTTP/malformed failures remain errors and retry recovers',async()=>{
 for(const mode of ['network','http','malformed']){const x=setup();let p=x.scope.refreshGastro();if(mode==='network')x.requests[0].reject(Error());else reply(x.requests[0],{},mode!=='http');await p;assert.equal(x.scope.data.gastroState,'error');p=x.scope.refreshGastro();reply(x.requests[1],{canManage:false,menuPublished:true});await p;assert.equal(x.scope.data.gastroState,'ready');assert.equal(x.scope.data.gastroAvailable,true);}
});
test('timeout exits loading',async()=>{const x=setup();const p=x.scope.refreshGastro();x.timeout();await p;assert.equal(x.scope.data.gastroState,'error');});
test('old request and navigation teardown cannot overwrite new state',async()=>{
 const x=setup();const old=x.scope.refreshGastro();x.scope.data.room={id:()=>2,name:()=> 'B'};const next=x.scope.refreshGastro();reply(x.requests[1],{canManage:true});await next;reply(x.requests[0],{canManage:false});await old;assert.equal(x.scope.data.gastroAvailable,true);assert.equal(x.events.length,1);assert.equal(x.events[0][1].id,'2');
 const late=x.scope.refreshGastro();x.handlers.$routeChangeStart();reply(x.requests[2],{canManage:false});await late;assert.equal(x.events.length,1);
});
test('unsupported host explicitly unavailable without issuing pilot request',async()=>{const x=setup('public.example');await x.scope.refreshGastro();assert.equal(x.scope.data.gastroState,'unavailable');assert.equal(x.requests.length,0);});
