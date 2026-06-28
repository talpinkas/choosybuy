// Diagnostic v2: sample products spread across the catalog, full error logging.
'use strict';
const fs = require('fs'); const path = require('path');
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('Set OPENAI_API_KEY'); process.exit(1); }
const products = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','next-data.json'),'utf8')).products.filter(p=>p.image&&p.id);
const N = products.length;
const idx = [0, Math.floor(N*0.15), Math.floor(N*0.3), Math.floor(N*0.45), Math.floor(N*0.6), Math.floor(N*0.75), Math.floor(N*0.9), N-1];
const sample = idx.map(i => products[i]);
console.log('catalog size ' + N + ', testing indices ' + idx.join(','));
(async () => {
  let okCount=0, failCount=0;
  for (const p of sample) {
    const body = { model:'gpt-4o-mini', max_tokens:80, temperature:0, response_format:{type:'json_object'},
      messages:[{role:'user',content:[
        {type:'text',text:'Return JSON {"gender":"...","category":"...","color":"..."} for this kids item. JSON only.\nTitle: '+(p.name||'').slice(0,80)},
        {type:'image_url',image_url:{url:p.image,detail:'low'}}]}] };
    const t0=Date.now();
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',
        headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
      const txt = await r.text(); const dt=((Date.now()-t0)/1000).toFixed(1);
      if (r.status===200){okCount++;console.log('OK   '+p.id+' '+dt+'s  '+JSON.parse(txt).choices[0].message.content.replace(/\s+/g,' '));}
      else {failCount++;console.log('FAIL '+p.id+' HTTP '+r.status+' '+dt+'s  img='+p.image.slice(-26));console.log('     '+txt.slice(0,200));}
    } catch(e){failCount++;console.log('THREW '+p.id+' '+e.message);}
  }
  console.log('\nsummary: ok '+okCount+' / fail '+failCount);
})();
