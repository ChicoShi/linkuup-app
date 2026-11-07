const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../preview/gastro/app.js'),'utf8');
const loc=fs.readFileSync(path.join(__dirname,'../js/pages/location/lup-location.js'),'utf8');
test('unconfigured operator login offers explicit retry and return without enrollment',()=>{
 const els={'#sidebar':{},'#mfa-retry':{},'#operator-return':{}};let calls=0,message;
 const app={innerHTML:''},parent={postMessage(m,o){message={m,o};}};
 const context={app,$:s=>els[s],state:{venue:{name:'Testbar'},mfa:{ready:false}},showNav(){},esc:s=>s,integrated:true,parent,window:{},location:{origin:'http://app.localhost'},refresh(){calls++;},run:f=>f()};
 vm.runInNewContext(ui.slice(ui.indexOf('function renderMfa(){'),ui.indexOf('function render(){')),context);
 context.renderMfa();assert.match(app.innerHTML,/Ein neuer Antrag ist nicht nötig/);assert.doesNotMatch(app.innerHTML,/Zugang wird vorbereitet|type="password"/);
 els['#mfa-retry'].onclick();assert.equal(calls,1);els['#operator-return'].onclick();assert.equal(message.m.type,'gastro-close');assert.equal(message.o,'http://app.localhost');
});
test('embedded return accepts only current same-origin iframe',()=>{
 let closed=0;const frame={contentWindow:{}},d={querySelector:()=>frame,close(){closed++;}};
 const ctx={gastroDestroyed:false,document:{getElementById:()=>d},location:{origin:'http://app.localhost'}};
 vm.runInNewContext(loc.slice(loc.indexOf('    function closeGastroFromFrame('),loc.indexOf("    window.addEventListener('message',closeGastroFromFrame)")),ctx);
 const good={origin:ctx.location.origin,source:frame.contentWindow,data:{type:'gastro-close'}};
 ctx.closeGastroFromFrame({...good,origin:'https://external.invalid'});ctx.closeGastroFromFrame({...good,source:{}});assert.equal(closed,0);
 ctx.closeGastroFromFrame(good);assert.equal(closed,1);ctx.gastroDestroyed=true;ctx.closeGastroFromFrame(good);assert.equal(closed,1);
});
