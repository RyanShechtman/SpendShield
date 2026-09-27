const routes={status:['GET','/status'],settings:['GET','/settings'],saveSettings:['POST','/settings'],classify:['POST','/classify-page'],analyze:['POST','/analyze-purchase'],protect:['POST','/protect-purchase'],wait:['POST','/start-cooldown'],cooldown:['POST','/gambling-cooldown']};
let cache=new Map();
async function config(){return chrome.storage.local.get({backend:'http://127.0.0.1:8000',cached:null});}
function validBackend(value){const u=new URL(value);if(u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use a local backend origin, such as http://127.0.0.1:8000');return u.origin;}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(sender.id!==chrome.runtime.id)return;
 (async()=>{
  const cfg=await config();
  if(msg.op==='config')return {...cfg,id:chrome.runtime.id};
  const extensionPage=sender.url?.startsWith(chrome.runtime.getURL(''));
  if(msg.op==='backend'){if(!extensionPage)throw Error('Open extension settings.');const backend=validBackend(msg.value);await chrome.storage.local.set({backend,cached:null});cache.clear();return {backend};}
  if(msg.op==='open'){await chrome.tabs.create({url:validBackend(cfg.backend)});return {};}
  if(msg.op==='options'){await chrome.runtime.openOptionsPage();return {};}
  if(!routes[msg.op])throw Error('Unsupported action.');
  if(msg.op==='saveSettings' && !extensionPage)throw Error('Use extension settings to change safeguards.');
  const [method,path]=routes[msg.op];
  const key=msg.op==='classify'?JSON.stringify(msg.body):null;
  if(key&&cache.has(key)&&Date.now()-cache.get(key).time<300000)return cache.get(key).value;
  const url=validBackend(cfg.backend)+'/api/live'+path+(msg.op==='status'?'?proposed='+encodeURIComponent(msg.proposed||'0'):'');
  const res=await fetch(url,{method,headers:{'Content-Type':'application/json','X-SpendShield-Extension':chrome.runtime.id},...(method==='POST'?{body:JSON.stringify(msg.body||{})}:{}),signal:AbortSignal.timeout(55000),credentials:'omit'});
  const data=await res.json();if(!res.ok)throw Error(data.detail||'SpendShield unavailable');
  if(msg.op==='status'||msg.op==='cooldown')await chrome.storage.local.set({cached:data});
  if(msg.op==='protect')await chrome.storage.local.set({cached:data.status});
  if(msg.op==='saveSettings'){cache.clear();const fresh=await fetch(validBackend(cfg.backend)+'/api/live/status',{headers:{'X-SpendShield-Extension':chrome.runtime.id},signal:AbortSignal.timeout(10000)});await chrome.storage.local.set({cached:fresh.ok?await fresh.json():null});}
  if(key){if(cache.size>30)cache.clear();cache.set(key,{time:Date.now(),value:data});}
  return data;
 })().then(data=>reply({ok:true,data})).catch(e=>reply({ok:false,error:e.message||'SpendShield unavailable'}));
 return true;
});
