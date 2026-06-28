// Build an OpenAI Batch input file for vision classification of remaining products.
'use strict';
const fs = require('fs'); const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','next-data.json'),'utf8')).products;
let done = {}; try { done = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','classifications.json'),'utf8')); } catch(e){}
const CATS=['tops','bottoms','dresses','bodysuits','swim','outerwear','nightwear','sets','shoes','accessories'];
const PATS=['solid','stripes','floral','polkadot','graphic','character','hearts','animal','camo','plaid','other'];
const STYLES=['casual','dressy','sporty','holiday','beach','sleep','school','other'];
const PROMPT =
  "You analyze a CHILDREN'S clothing/footwear/accessory product from its IMAGE and Hebrew title. " +
  'Return STRICT JSON only, choosing EXACTLY ONE value per field (never arrays, never pipes, never multiple options). Keys: ' +
  'gender (one of: boy, girl, unisex), category (one of: ' + CATS.join(', ') + '), ' +
  'color (dominant color as ONE Hebrew word), color2 (secondary color ONE Hebrew word or empty), ' +
  'pattern (one of: ' + PATS.join(', ') + '), ' +
  'theme (short Hebrew motif if any e.g. דינוזאור / חד-קרן / כדורגל / לבבות, else empty), ' +
  'style (one of: ' + STYLES.join(', ') + '), kids (true or false; false ONLY if clearly NOT a child item). ' +
  'gender = who the item is visually designed for; unisex only if genuinely neutral. Judge mainly from the IMAGE. JSON only.';
const out = path.join(__dirname,'..','data','batch-input.jsonl');
const ws = fs.createWriteStream(out);
let n=0;
products.forEach(p => {
  if (!p.image || !p.id || done[p.id]) return;
  ws.write(JSON.stringify({ custom_id: p.id, method:'POST', url:'/v1/chat/completions',
    body:{ model:'gpt-4o-mini', max_tokens:150, temperature:0, response_format:{type:'json_object'},
      messages:[{role:'user',content:[
        {type:'text',text:PROMPT+'\nTitle: '+(p.name||'').slice(0,120)},
        {type:'image_url',image_url:{url:p.image,detail:'low'}}]}] } }) + '\n');
  n++;
});
ws.end(() => console.log('wrote ' + n + ' requests -> data/batch-input.jsonl (already-done skipped: ' + Object.keys(done).length + ')'));
