const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(require.resolve('../preview/gastro/app.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function chronologicalOrders'),src.indexOf('function orderTime')),ctx);
test('newest creation goes below older orders regardless of response order, without mutation',()=>{const input=[{id:'new',created:'2026-11-09T10:00:00Z'},{id:'old',created:'2026-11-09T09:00:00Z'}];assert.equal(ctx.chronologicalOrders(input).map(o=>o.id).join(','),'old,new');assert.equal(input[0].id,'new')});
test('equal timestamps retain server insertion order; status changes do not reorder',()=>{const rows=[{id:'a',created:'2026-11-09T09:00:00Z',status:'preparing'},{id:'b',created:'2026-11-09T09:00:00Z',status:'new'}];assert.equal(ctx.chronologicalOrders(rows).map(o=>o.id).join(','),'a,b')});
test('legacy missing and invalid timestamps have deterministic stable placement',()=>{const rows=[{id:'c',created:'2026-11-09T09:00:00Z'},{id:'a'},{id:'b',created:'invalid'}];assert.equal(ctx.chronologicalOrders(rows).map(o=>o.id).join(','),'a,b,c')});
