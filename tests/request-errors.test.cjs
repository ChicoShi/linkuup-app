const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(){
 let ctor;const chain={factory(n,fn){ctor=fn;return chain;},config(){return chain;}};
 const context=vm.createContext({console:{log(){}},t:()=> 'Keine Verbindung',angular:{module:()=>chain}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/service/lup-request-interceptor.js'),'utf8'),context);
 const calls=[];const service={};for(const name of ['showNetworkError','showServerError','show404Error'])service[name]=text=>calls.push([name,text]);
 return {interceptor:ctor({reject:reason=>Promise.reject(reason)},{get:()=>service}),calls};
}
test('Failed HTTP responses without JSON preserve their original rejection',async()=>{
 for(const value of [undefined,null,{status:0,data:null},{status:500,data:'<html>failure</html>'},{status:404,data:{}},{status:403,data:{topResponse:{error:'Forbidden'}}}]){
  const {interceptor,calls}=setup();let caught=false;
  await interceptor.responseError(value).catch(reason=>{caught=true;assert.equal(reason,value);});
  assert.equal(caught,true);assert.equal(calls.length,1);assert.equal(typeof calls[0][1],'string');
 }
});
test('A cancelled HTTP request produces no dialog, while a request setup error stays rejected',async()=>{
 const {interceptor,calls}=setup();const aborted={status:-1,xhrStatus:'abort'};
 await interceptor.responseError(aborted).catch(reason=>assert.equal(reason,aborted));assert.equal(calls.length,0);
 const error=new Error('network setup');await interceptor.requestError(error).catch(reason=>assert.equal(reason,error));
 assert.deepEqual(calls,[['showNetworkError','Keine Verbindung']]);
});

test('Queued dialogs continue in order after cancellation without an orphan rejection',async()=>{
 let ctor;const context=vm.createContext({console:{log(){}},window:{},angular:{module:()=>({service(n,fn){ctor=fn}})}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/service/lup-dialog-service.js'),'utf8'),context);
 const q={defer(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{resolve,reject,promise}}};
 const shown=[];const dialogs={show(config){const d=q.defer();shown.push({config,...d});return d.promise}};
 const service=new ctor(q,dialogs,()=>({}),{});
 const first=service.show('first').catch(reason=>reason),second=service.show('second');
 assert.equal(shown.length,1);shown[0].reject('cancelled');
 assert.equal(await first,'cancelled');assert.equal(shown.length,2);assert.equal(shown[1].config,'second');
 shown[1].resolve('done');assert.equal(await second,'done');assert.equal(service.lastDialog.length,0);
});
