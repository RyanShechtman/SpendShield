const $=id=>document.getElementById(id);let saved;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0);
async function api(op,body,extra={}){const r=await chrome.runtime.sendMessage({op,body,...extra});if(!r?.ok)throw Error(r?.error||'SpendShield unavailable');return r.data;}
function notice(t,error=false){$('notice').textContent=t;$('notice').className=error?'error':'';}
async function run(fn){try{await fn();}catch(e){notice(e.message,true);}}
function bind(id,fn){if($(id))$(id).onclick=()=>run(fn);}
const booleans=['purchase_enabled','auto_analyze','guard_enabled','shield_enabled','block_limit','block_cooldown'];
async function load(){const s=await api('status');saved=s.settings;if($('summary')){$('summary').hidden=false;$('rescued').textContent=money(s.money_rescued);$('goal').textContent=s.goal.name+': '+money(s.goal.saved)+' saved · '+money(s.goal.planned)+' protected, not confirmed';$('progress').value=s.goal.progress;$('budget').textContent=money(s.available)+' discretionary budget remaining';$('guard').textContent='Gambling Guard: '+(s.settings.guard_enabled?'on':'off');$('shield').textContent='Shield Mode: '+(s.settings.shield_enabled?'on':'off');$('purchase').textContent=(saved.purchase_enabled?'Disable':'Enable')+' purchase insights';$('guard-toggle').textContent=(saved.guard_enabled?'Disable':'Enable')+' Gambling Guard';}else{$('fields').disabled=false;booleans.forEach(k=>$(k).checked=saved[k]);$('weekly_limit').value=saved.weekly_limit;$('wait_hours').value=saved.wait_hours;$('domains').value=saved.domains.join('\n');}notice(s.demo?'Connected to isolated demo profile.':'Connected to your local plan.');}
bind('open',()=>api('open'));bind('options',()=>api('options'));
bind('inspect',async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.tabs.sendMessage(tab.id,{op:'inspect'});window.close();});
bind('purchase',async()=>{if(!saved)throw Error('Connect the app first.');await api('saveSettings',{...saved,purchase_enabled:!saved.purchase_enabled});await load();});
bind('guard-toggle',async()=>{if(!saved)throw Error('Connect the app first.');await api('saveSettings',{...saved,guard_enabled:!saved.guard_enabled});await load();});
bind('cooldown',async()=>{await api('cooldown',{enable_shield:false});await load();notice('24-hour cooldown started. Shield Mode changes only when you enable it.');});
bind('copy-id',async()=>{await navigator.clipboard.writeText(chrome.runtime.id);notice('Extension ID copied. Paste it into My Plan in SpendShield.');});
bind('connect',async()=>{await api('backend',null,{value:$('backend').value});await load();});
if($('settings'))$('settings').onsubmit=e=>{e.preventDefault();void run(async()=>{const values={...saved};booleans.forEach(k=>values[k]=$(k).checked);values.weekly_limit=$('weekly_limit').value;values.wait_hours=Number($('wait_hours').value);values.domains=$('domains').value.split('\n').filter(Boolean);await api('saveSettings',values);await load();notice('Your safeguards are saved. Refresh an open page to apply all changes.');});};
void run(async()=>{const cfg=await api('config');if($('backend')){$('backend').value=cfg.backend;$('extension-id').textContent=cfg.id;}await load();});
