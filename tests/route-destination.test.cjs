const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['location/lup-location.js','locations/lup-locations.js']){
 const src=fs.readFileSync(require.resolve('../js/pages/'+file),'utf8');const start=src.indexOf('$scope.mapsHref ='),end=src.indexOf('\n\t};',src.indexOf('$scope.mapsDestination ='))+5;
 const x={$scope:{}};vm.createContext(x);vm.runInContext(src.slice(start,end),x);
 const room=(lat,lng,street='',zip='',city='')=>({lat:()=>lat,lng:()=>lng,street:()=>street,zip:()=>zip,city:()=>city});
 test(file+': valid coordinates including equator remain usable',()=>{assert.equal(new URL(x.$scope.mapsHref(room(0,10))).searchParams.get('destination'),'0,10');assert.equal(new URL(x.$scope.mapsHref(room(52.27,10.53))).searchParams.get('destination'),'52.27,10.53')});
 test(file+': missing, invalid and sentinel coordinates never navigate to zero',()=>{for(const pair of [[null,null],['',''],[undefined,undefined],[0,0],[91,20],[20,181],['x','y']])assert.equal(x.$scope.mapsHref(room(...pair)),undefined)});
 test(file+': fallback needs an address, encodes punctuation; city alone is not a venue',()=>{assert.equal(new URL(x.$scope.mapsHref(room(null,null,'A & B 4','38100','Braunschweig'))).searchParams.get('destination'),'A & B 4, 38100, Braunschweig');assert.equal(x.$scope.mapsHref(room(null,null,'','','Berlin')),undefined)});
}
