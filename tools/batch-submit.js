// Upload the batch input file and create the batch job.
'use strict';
const fs = require('fs'); const path = require('path');
const KEY = process.env.OPENAI_API_KEY; if (!KEY) { console.error('Set OPENAI_API_KEY'); process.exit(1); }
const file = path.join(__dirname,'..','data','batch-input.jsonl');
(async () => {
  const fd = new FormData();
  fd.append('purpose','batch');
  fd.append('file', new Blob([fs.readFileSync(file)]), 'batch-input.jsonl');
  let r = await fetch('https://api.openai.com/v1/files',{method:'POST',headers:{'Authorization':'Bearer '+KEY},body:fd});
  let j = await r.json();
  if (!j.id) { console.error('upload failed: ' + JSON.stringify(j).slice(0,300)); process.exit(1); }
  console.log('uploaded file ' + j.id);
  r = await fetch('https://api.openai.com/v1/batches',{method:'POST',
    headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({input_file_id:j.id,endpoint:'/v1/chat/completions',completion_window:'24h'})});
  j = await r.json();
  if (!j.id) { console.error('batch create failed: ' + JSON.stringify(j).slice(0,300)); process.exit(1); }
  fs.writeFileSync(path.join(__dirname,'..','data','batch-id.txt'), j.id);
  console.log('BATCH CREATED: ' + j.id + ' | status: ' + j.status);
  console.log('Check later with: node tools/batch-fetch.js');
})();
