const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../preview/gastro/app.js','utf8');
function fn(name,next,context){vm.runInNewContext(source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'(')),context);return context[name];}
const esc=s=>String(s??'').replaceAll('<','&lt;');
test('public card escapes names and contains neither wallet nor operator controls',()=>{
 const c={state:{venue:{name:'<script>'},menu:[],menuPublished:true,orderingEnabled:true},esc,euro:x=>x,emoji:()=>''};const html=fn('publicCard','guest',c)();assert.match(html,/&lt;script>/);assert.match(html,/enter-ordering/);assert.doesNotMatch(html,/topup|save-menu|tables-form|data-transition/);
 c.state.orderingEnabled=false;assert.doesNotMatch(c.publicCard(),/enter-ordering/);
});
test('admin menu workspace has audit but no order table or balance',()=>{
 const c={state:{venue:{name:'Bar'},menuReviewHistory:[{revision:2,at:'today',reason:'<reason>'}]},esc,editor:()=>'<section>Editor</section>'};const html=fn('moderator','renderMfa',c)();assert.match(html,/&lt;reason>/);assert.match(html,/Editor/);assert.doesNotMatch(html,/data-transition|topup|tables-form|publish-menu/);
});
test('card publication available before tables; order publication remains blocked',()=>{
 const c={state:{venue:{name:'Bar'},menuReady:true,menu:[{available:true}],tablesReady:false,tableCount:20,orderingEnabled:false,menuPublished:false},esc};const html=fn('setup','board',c)();assert.match(html,/<button id="publish-menu" >Karte sichtbar machen/);assert.match(html,/<button id="publish" class="primary" disabled>/);
});
