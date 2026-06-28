// Print current classifications next to product titles for eyeball QA.
'use strict';
const fs=require('fs'); const path=require('path');
const prods=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','next-data.json'),'utf8')).products;
const byId={}; prods.forEach(p=>byId[p.id]=p);
const cls=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','classifications.json'),'utf8'));
const ids=Object.keys(cls);
console.log('classified: '+ids.length+'\n');
ids.slice(0,60).forEach(id=>{
  const c=cls[id]; const t=(byId[id]?byId[id].name:'').slice(0,40);
  console.log([c.gender||'-', (c.category||'-').padEnd(10), (c.color||'').padEnd(8), (c.pattern||'').padEnd(9), (c.theme||'').padEnd(10), t].join(' | '));
});
// quick distribution
const g={},cat={}; ids.forEach(id=>{const c=cls[id];g[c.gender]=(g[c.gender]||0)+1;cat[c.category]=(cat[c.category]||0)+1;});
console.log('\ngender:',JSON.stringify(g));
console.log('category:',JSON.stringify(cat));
