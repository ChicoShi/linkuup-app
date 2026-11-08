const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(__dirname+'/../preview/gastro/app.js','utf8');
test('initial failure remains visible and retry replaces it with verified state',async()=>{
 const nodes={'#request-return':{},'#request-retry':{addEventListener(e,f){this.click=f}}};let fail=true,rendered=0,returned=false;
 const c={app:{innerHTML:''},$:k=>nodes[k],icon:()=>'',returnToLocation(){returned=true},run:f=>f(),state:undefined,api:async()=>{if(fail)throw Error('offline');return {tableCount:20}},table:'',Date,render(){rendered++}};
 vm.runInNewContext(s.slice(s.indexOf('function renderRequestState('),s.indexOf('function lines()')),c);
 await assert.rejects(c.refresh(),/offline/);assert.match(c.app.innerHTML,/Gerade keine Verbindung/);assert.match(c.app.innerHTML,/aria-busy="false"/);assert.equal(rendered,0);
 nodes['#request-return'].onclick();assert.equal(returned,true);
 fail=false;await nodes['#request-retry'].click();assert.equal(rendered,1);assert.equal(c.state.tableCount,20);
});
test('failed refresh preserves previously verified content',async()=>{
 const original={tableCount:10};const c={state:original,api:async()=>{throw Error('offline')},renderRequestState(){throw Error('must not erase content')},table:'',Date,render(){throw Error('must not render')}};
 vm.runInNewContext(s.slice(s.indexOf('async function refresh(){'),s.indexOf('function lines()')),c);
 await assert.rejects(c.refresh(),/offline/);assert.equal(c.state,original);
});
