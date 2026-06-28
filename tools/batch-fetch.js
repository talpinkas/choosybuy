// Check batch status; if completed, download output and merge into classifications.json.
'use strict';
const fs = require('fs'); const path = require('path');
const KEY = process.env.OPENAI_API_KEY; if (!KEY) { console.error('Set OPENAI_API_KEY'); process.exit(1); }
const id = fs.readFileSync(path.join(__dirname,'..','data','batch-id.txt'),'utf8').trim();
const CATS=['tops','bottoms','dresses','bodysuits','swim','outerwear','nightwear','sets','shoes','accessories'];
const one = v => Array.isArray(v)?String(v[0]||''):String(v==null?'':v).split(/[|\/,]/)[0].trim();
(async () => {
  let r = await fetch('https://api.openai.com/v1/batches/'+id,{headers:{'Authorization':'Bearer '+KEY}});
  const b = await r.json();
  console.log('status: ' + b.status + ' | counts: ' + JSON.stringify(b.request_counts||{}));
  if (['failed','expired','cancelling','cancelled'].includes(b.status)) {
    console.log('BATCH ERROR DETAILS:');
    console.log(JSON.stringify(b.errors || {note:'no errors field'}, null, 2).slice(0, 1200));
    if (b.error_file_id) {
      const er = await fetch('https://api.openai.com/v1/files/'+b.error_file_id+'/content',{headers:{'Authorization':'Bearer '+KEY}});
      console.log('ERROR FILE (first lines):\n' + (await er.text()).slice(0, 800));
    }
    return;
  }
  if (b.status !== 'completed') { console.log('not ready yet — run again later.'); return; }
  r = await fetch('https://api.openai.com/v1/files/'+b.output_file_id+'/content',{headers:{'Authorization':'Bearer '+KEY}});
  const text = await r.text();
  let cls = {}; try { cls = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','classifications.json'),'utf8')); } catch(e){}
  let added=0, bad=0;
  text.split('\n').filter(Boolean).forEach(line => {
    try {
      const row = JSON.parse(line);
      const txt = row.response.body.choices[0].message.content;
      const o = JSON.parse(txt);
      const gender = ['boy','girl','unisex'].includes(o.gender)?o.gender:null;
      const cat = CATS.includes(o.category)?o.category:null;
      if (!gender && !cat) { bad++; return; }
      cls[row.custom_id] = { gender, category:cat, color:one(o.color), color2:one(o.color2),
        pattern:one(o.pattern), theme:String(o.theme||'').slice(0,24), style:one(o.style), kids:o.kids!==false };
      added++;
    } catch(e){ bad++; }
  });
  fs.writeFileSync(path.join(__dirname,'..','data','classifications.json'), JSON.stringify(cls));
  console.log('merged ' + added + ' classifications (bad ' + bad + ') | total in file ' + Object.keys(cls).length);
  console.log('Next: node tools/import-next-data.js  then  node tools/gen-gallery.js');
})();
