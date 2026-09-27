(() => {
  const clean = s => String(s || '').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[private]').replace(/(?:\d[ -]?){12,}/g,'[private]').trim().slice(0,200);
  function price(s) {
    s=String(s||'').trim();
    if (!/^(?:(?:USD|US\$|\$)\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?:\s*USD)?$/.test(s)) return null;
    const n=Number(s.replace(/USD|US\$|\$|,|\s/g,'')); return Number.isFinite(n)&&n>0&&n<=10000000?n.toFixed(2):null;
  }
  function extract(doc, href, domains=[]) {
    const u=new URL(href); u.search='';u.hash='';
    const visible=e=>e && !e.closest('form,[contenteditable],input,textarea,[hidden]') && e.getClientRects().length>0;
    const texts=selector=>Array.from(doc.querySelectorAll(selector)).filter(visible).slice(0,12).map(e=>clean(e.innerText));
    const headings=texts('h1,h2');
    const buttons=texts('button,[role=button]');
    const title=clean(doc.title);
    let result={url:u.href,title,product_name:headings[0]||title,price:null,currency:'',page_type:'unrelated',confidence:0,snippets:[]};
    const known=domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));
    const words=(title+' '+headings.join(' ')+' '+buttons.join(' ')).toLowerCase();
    if(known || (/sportsbook|betting|wager/.test(words) && /wager|bet slip|sportsbook/.test(words))) return {...result,page_type:'gambling',confidence:known?.95:.86};
    let products=[];
    function walk(obj,depth=0){if(depth>6||!obj||typeof obj!=='object')return;if(Array.isArray(obj)){obj.slice(0,15).forEach(x=>walk(x,depth+1));return;}if(obj['@type']==='Product')products.push(obj);if(obj['@graph'])walk(obj['@graph'],depth+1);}
    for(const e of Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(0,8)){if(e.textContent.length>40000)continue;try{walk(JSON.parse(e.textContent));}catch{/* invalid merchant metadata */}}
    if(/sportsbook|betting|wager|casino/.test(words))return {...result,page_type:'gambling',confidence:.55,snippets:headings};
    const totals=texts('[data-cart-total],.cart-total,.order-total,[data-testid="order-total"]');
    const checkout=/checkout|place order/.test(words) && /checkout|cart/.test(u.pathname.toLowerCase());
    if(totals.length===1 && price(totals[0])) result={...result,page_type:checkout?'checkout':'cart',price:price(totals[0]),currency:/USD|US\$/.test(totals[0])?'USD':'',confidence:.9,product_name:'Cart total'};
    else if(products.length===1){const p=products[0],o=Array.isArray(p.offers)?(p.offers.length===1?p.offers[0]:{}):(p.offers||{});result={...result,page_type:'product',product_name:clean(p.name)||result.product_name,price:price(String(o.price||'')),currency:clean(o.priceCurrency).toUpperCase(),confidence:price(String(o.price||''))&&o.priceCurrency?.toUpperCase()==='USD'?.95:.6};}
    else if(/add to cart|buy now|checkout|place order/.test(words)){const m=doc.querySelector('meta[property="product:price:amount"],meta[property="og:price:amount"]');const c=doc.querySelector('meta[property="product:price:currency"],meta[property="og:price:currency"]');result={...result,page_type:checkout?'checkout':'product',price:price(m?.content),currency:c?.content||'',confidence:.55};}
    if(result.page_type!=='unrelated') result.snippets=[...headings,...totals,...texts('[itemprop="price"],.product-price,[data-testid="price"]')].slice(0,12);
    return result;
  }
  globalThis.SpendShieldExtract={extract,price,clean};
})();
