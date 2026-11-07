const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({type='member',same=false,rejected=false,pending=false,wsFailure=false}={}){
 let ctor;const calls=[],old='1-'+'a'.repeat(32),fresh=same?old:'1-'+'b'.repeat(32),config={ws_secret:old,server:'http://qa.local/'};
 const context={angular:{module:()=>({service(n,f){ctor=f}})},window:{LUP_CONFIG:config,location:{assign:u=>calls.push(['redirect',u])}},DOMParser:class{parseFromString(){return {querySelector:()=>({value:'synthetic-csrf'})}}},console:{log(){}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../js/service/lup-auth-service.js','utf8'),context);
 let get=0;
 const req={gwfPage:(m,a)=>{calls.push([m,a,'form']);return Promise.resolve({data:'<form>'})},sendGWF:(m,a,d,v)=>{calls.push([m,a,d,v]);if(m==='Register')return Promise.resolve({data:rejected?{form:{form_error:'invalid'}}:{message:'accepted'}});get++;return Promise.resolve({data:{data:{secret:get===1?old:fresh,user:{user_type:pending?'guest':type}}}})}};
 const ws={disconnect:()=>calls.push(['disconnect']),withConnection:()=>{calls.push(['connect']);return wsFailure?Promise.reject('offline'):Promise.resolve()}};
 return {s:new ctor({reject:Promise.reject.bind(Promise)},null,null,ws,null,req),calls,config};
}
test('Registration obtains real form token then verifies rotated HTTP cookie before WS',async()=>{const {s,calls}=fixture();assert.equal(JSON.parse(await s.register({user_name:'qa',user_password:'test'})).user_type,'member');assert.deepEqual(calls.map(c=>c[0]+'.'+(c[1]||'')),['Websocket.GetSecret','Register.Form','Register.Form','Websocket.GetSecret','disconnect.','connect.']);assert.equal(calls[2][2].xsrf,'synthetic-csrf');assert.equal(calls[2][2].user_name,'qa');});
test('Guest login uses HTTP and rotated cookie',async()=>{const {s,calls}=fixture({type:'guest'});assert.equal(JSON.parse(await s.guest({user_guest_name:'qa'})).user_type,'guest');assert.equal(calls[2][1],'Guest');});
test('Activation-required response never announces authenticated user or reconnects',async()=>{const {s,calls}=fixture({pending:true});assert.equal((await s.register({})).pendingActivation,true);assert.equal(calls.some(c=>c[0]==='disconnect'),false);});
test('Invalid form is not confused with pending activation',async()=>{const {s,calls}=fixture({rejected:true,pending:true});await assert.rejects(s.register({}),e=>/invalid/.test(e));assert.equal(calls.filter(c=>c[0]==='Websocket').length,1);});
test('Unrotated registration cookie and WS failure reject',async()=>{for(const o of [{same:true},{wsFailure:true}])await assert.rejects(fixture(o).s.register({}));});
test('Unconfigured Google never redirects; configured flow goes to backend only',async()=>{const {s,calls}=fixture();await assert.rejects(s.google({}),e=>/nicht eingerichtet/.test(e));assert.equal(calls.length,0);s.google({GoogleAuth:{google_auth:'1'}});assert.equal(calls[0][1],'http://qa.local/index.php?_mo=GoogleAuth&_me=Auth');});
