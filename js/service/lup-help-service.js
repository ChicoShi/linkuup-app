"use strict";
angular.module('LUP').service('HelpSrvc', function($rootScope, $q, WebsocketSrvc, DialogSrvc) {
 var help=this, account=null, loading=null, showing={};
 help.READ=null;
 function uid(){return window.GWF_USER && window.GWF_USER.id();}
 function local(id){try {var value=JSON.parse(window.localStorage.getItem('lup-help-seen:'+id)||'[]');return Array.isArray(value)?value:[];}catch(e){return [];}}
 function save(id,keys){try{window.localStorage.setItem('lup-help-seen:'+id,JSON.stringify(keys));}catch(e){/* The server still persists completion when device storage is unavailable. */}}
 function prepare(){var id=uid();if(account!==id){account=id;help.READ=null;loading=null;showing={};}return id;}
 function remember(id,key){var keys=local(id);if(keys.indexOf(key)<0)keys.push(key);save(id,keys);if(id===account){help.READ=help.READ||[];if(help.READ.indexOf(key)<0)help.READ.push(key);}}
 function sendRead(id,key){if(id!==uid())return $q.resolve();return WebsocketSrvc.sendBinary(new GWS_Message().cmd(0x1191).sync().writeString(key));}
 $rootScope.$on('lup-clear-cache',function(){account=null;help.READ=null;loading=null;showing={};});
 help.withReads=function(){
  var id=prepare();if(!id)return $q.resolve([]);
  if(help.READ!==null)return $q.resolve(help.READ);
  if(loading)return loading;
  loading=WebsocketSrvc.sendBinary(new GWS_Message().cmd(0x1190).sync()).then(function(result){
   var remote;try{remote=JSON.parse(result||'[]');}catch(e){remote=[];}
   remote=Array.isArray(remote)?remote:[];
   if(id!==uid()||id!==account)return [];
   var cached=local(id),merged=Array.from(new Set(remote.concat(cached)));
   help.READ=merged;save(id,merged);
   cached.filter(function(key){return remote.indexOf(key)<0;}).forEach(function(key){sendRead(id,key).catch(angular.noop);});
   return merged;
  },function(){return local(id);});
  var request=loading;request.finally(function(){if(id===account)loading=null;}).catch(angular.noop);return request;
 };
 help.showHelp=function(key,html){
  var id=prepare();if(!id||showing[key])return;
  showing[key]=true;
  return help.withReads().then(function(keys){
   if(id!==uid()||id!==account||keys.indexOf(key)>=0)return;
   // Completion belongs to this account. Closing or acknowledging a hint
   // dismisses it permanently; a network failure cannot make it reappear.
   var complete=function(){remember(id,key);return sendRead(id,key).catch(angular.noop);};
   return DialogSrvc.confirm('js/service/tpl/lup-help-dialog.html',{html:html}).then(complete,complete);
  }).finally(function(){if(id===account)delete showing[key];});
 };
 help.confirmed=function(key){var id=prepare();remember(id,key);return sendRead(id,key);};
 help.reset=function(){var id=prepare();return WebsocketSrvc.sendBinary(new GWS_Message().cmd(0x1192).sync()).then(function(){save(id,[]);if(id===account)help.READ=[];});};
});
