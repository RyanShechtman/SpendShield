const {chromium,expect}=require('../../frontend/node_modules/@playwright/test');
const path=require('node:path');const fs=require('node:fs');
const base='http://127.0.0.1:8003';
async function req(route,body){const r=await fetch(base+'/api/'+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});if(!r.ok)throw Error(route+': '+r.status+' '+await r.text());return r.json();}
(async()=>{
 await req('test/reset',{});
 await req('profile/setup',{name:'Alex',budget:'465',goal_name:'Emergency fund',goal_target:'1500',goal_saved:'1130',goal_monthly:'600'});
 await req('transactions',{date:new Date().toLocaleDateString('en-CA'),merchant:'Fictional prior gambling spending',amount:'84',category:'Gambling'});
 const extension=path.resolve(__dirname,'../dist');
 const ctx=await chromium.launchPersistentContext('',{channel:process.env.LIVE_BROWSER_CHANNEL||'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1440,height:1000}});
 try{
 const browserSession=await ctx.browser().newBrowserCDPSession();await browserSession.send('Extensions.loadUnpacked',{path:extension});
 let [worker]=ctx.serviceWorkers();if(!worker)worker=await ctx.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 let settings=await req('live/settings');await req('live/settings',{...settings,extension_id:id,guard_enabled:true,weekly_limit:'100',shield_enabled:false});
 await worker.evaluate(async(base)=>{await chrome.storage.local.set({backend:base,cached:null});},base);
 const errors=[];ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const dashboard=await ctx.newPage();await dashboard.goto(base);await expect(dashboard.getByRole('heading',{name:'Looking ahead, Alex.'})).toBeVisible();
 const page=await ctx.newPage();const cdp=await ctx.newCDPSession(page);await cdp.send('Accessibility.enable');
 async function node(name,role='button'){let target;await expect.poll(async()=>{const {nodes}=await cdp.send('Accessibility.getFullAXTree');target=nodes.find(n=>n.role?.value===role&&n.name?.value===name);return !!target;},{timeout:10000,message:'Find '+name}).toBeTruthy();return target;}
 async function click(name){const n=await node(name);await cdp.send('DOM.scrollIntoViewIfNeeded',{backendNodeId:n.backendDOMNodeId});const {model}=await cdp.send('DOM.getBoxModel',{backendNodeId:n.backendDOMNodeId});const q=model.content;await page.mouse.click((q[0]+q[2]+q[4]+q[6])/4,(q[1]+q[3]+q[5]+q[7])/4);}
 async function text(value){await expect.poll(async()=>{const {nodes}=await cdp.send('Accessibility.getFullAXTree');return nodes.some(n=>n.name?.value?.includes(value));},{timeout:10000,message:'Visible '+value}).toBeTruthy();}
 fs.mkdirSync(path.resolve(__dirname,'../../frontend/test-results'),{recursive:true});
 await page.goto(base+'/demo-sites/store.html');await click('◈ SpendShield · Check $179.00');await click('Show my tradeoff');await text('47%');await text('9 days');
 await page.screenshot({path:path.resolve(__dirname,'../../frontend/test-results/live-purchase.png')});
 await click('Find a cheaper option');await text('DEMO CATALOG RESULT');await click('Demo headphones · $119.00 · protect $60.00');await text('$60.00 protected');
 await expect.poll(async()=>(await req('dashboard')).money_rescued.this_month).toBe(60);
 await page.goto(base+'/demo-sites/sportsbook.html');await click('◈ SpendShield · Your chosen safeguards');await text('$14.00');await click('Start 24-hour Shield Mode');await text('Shield Mode is on');
 await page.reload();await text('Shield Mode is on');expect(await page.evaluate(()=>document.body.inert)).toBeTruthy();
 await worker.evaluate(()=>{globalThis.realFetch=globalThis.fetch;globalThis.fetch=()=>Promise.reject(Error('Simulated offline backend'));});await page.reload();await text('Shield Mode is on');await text('Offline safeguard');await worker.evaluate(()=>{globalThis.fetch=globalThis.realFetch;});await page.reload();await text('Shield Mode is on');await page.screenshot({path:path.resolve(__dirname,'../../frontend/test-results/live-shield.png')});
 await click('Put this amount toward my goal instead');await text('$30.00 protected');
 const d=await req('dashboard');expect(d.money_rescued.this_month).toBe(90);expect(d.goal.planned_saved).toBe(1220);expect(d.goal.saved).toBe(1130);
 await dashboard.bringToFront();await expect(dashboard.getByText('$90',{exact:true}).first()).toBeVisible({timeout:10000});
 const popup=await ctx.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);await expect(popup.locator('#rescued')).toHaveText('$90.00');
 const options=await ctx.newPage();await options.goto(`chrome-extension://${id}/options.html`);await expect(options.locator('#fields')).toBeEnabled();await options.locator('#shield_enabled').uncheck();await options.getByRole('button',{name:'Save safeguards'}).click();await expect(options.locator('#notice')).toContainText('saved');
 await page.goto(base+'/demo-sites/checkout.html');await click('◈ SpendShield · Check $179.00');await click('Show my tradeoff');await click('Wait 24 hours');await text('You chose to wait');await page.reload();await click('◈ SpendShield · Check $179.00');await click('Show my tradeoff');await text('Continue waiting');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.resolve(__dirname,'../../frontend/test-results/live-mobile.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 // The page cannot read the financial overlay through the DOM.
 expect(await page.evaluate(()=>document.querySelector('spendshield-live').shadowRoot)).toBeNull();
 await worker.evaluate(()=>{globalThis.realFetch=globalThis.fetch;globalThis.fetch=()=>Promise.reject(Error('Simulated offline backend'));});await page.goto(base+'/demo-sites/store.html');await click('◈ SpendShield · Check $179.00');await click('Show my tradeoff');await text('Simulated offline backend');expect(await page.evaluate(()=>document.body.inert)).toBeFalsy();await click('Dismiss SpendShield');expect(await page.locator('spendshield-live').count()).toBe(0);await worker.evaluate(()=>{globalThis.fetch=globalThis.realFetch;});
 expect(errors).toEqual([]);
 console.log('PASS: real MV3 extension; product/cart detection; $60 + $30 = $90; voluntary Shield reload; popup; settings; wait persistence; mobile; closed shadow privacy.');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
