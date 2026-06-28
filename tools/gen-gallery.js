// Build a visual QA gallery from the REAL built catalogs (run locally, then open next-catalog-check.html).
'use strict';
const fs = require('fs'); const path = require('path');
const DIR = path.join(__dirname, '..', 'catalogs');
const OUT = path.join(__dirname, '..', 'next-catalog-check.html');
const CATHE = { tops:'חולצות', bottoms:'מכנסיים', bodysuits:'בגדי גוף', dresses:'שמלות', swim:'בגדי ים', outerwear:'מעילים', nightwear:'שינה', sets:'סטים', shoes:'נעליים', accessories:'אקססוריז' };
const files = fs.readdirSync(DIR).filter(f => /^next-.*\.json$/.test(f));
let cards = [];
files.forEach(f => {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const m = c.catalog_id.match(/^next-(boy|girl)-(0-2|2-8)-(\w+)$/); if (!m) return;
  const g = m[1], age = m[2], cat = CATHE[m[3]] || m[3];
  const arr = c.products, step = Math.max(1, Math.floor(arr.length / 18));
  for (let i = 0, n = 0; i < arr.length && n < 18; i += step, n++) {
    const p = arr[i];
    cards.push({ img:p.image, t:p.title, pr:p.price, sp:p.sale_price, g, age, c:cat, col:p.color||'', pk:!!p.in_pack });
  }
});
// shuffle for visual mix
for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]]; }
const total = files.reduce((s,f)=>s+JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8')).products.length,0);
const html = '<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">'
+ '<meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXT — בדיקת קטלוג</title>'
+ '<style>'
+ '*{box-sizing:border-box}body{font-family:Heebo,Arial,sans-serif;background:#fbf5ea;color:#3a2a1a;margin:0;padding:16px}'
+ 'h1{font-size:20px;margin:0 0 4px}.sub{color:#7a6a55;font-size:13px;margin:0 0 14px}'
+ '.bar{position:sticky;top:0;background:#fbf5ea;padding:8px 0;z-index:5;border-bottom:1px solid #e6d9c2;margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap}'
+ '.bar button{border:1px solid #ce551f;background:#fff;color:#ce551f;border-radius:18px;padding:5px 13px;font-size:13px;cursor:pointer}'
+ '.bar button.on{background:#ce551f;color:#fff}'
+ '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}'
+ '.card{background:#fff;border:1px solid #ece0cb;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}'
+ '.card img{width:100%;aspect-ratio:3/4;object-fit:cover;background:#f1ece1}'
+ '.card .b{padding:7px 8px 9px}.tt{font-size:11.5px;line-height:1.35;height:48px;overflow:hidden;margin:0 0 5px}'
+ '.meta{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px}'
+ '.tag{font-size:9.5px;padding:1px 6px;border-radius:8px;background:#f3ead8;color:#8a6a3a}'
+ '.tag.g{background:#e8f0e6;color:#4a6a45}.tag.a{background:#ede6f3;color:#6a4a8a}.tag.pk{background:#fde6d8;color:#ce551f}'
+ '.pr{font-weight:700;font-size:13px}.old{color:#aa9;text-decoration:line-through;font-size:11px;font-weight:400;margin-inline-start:5px}'
+ '</style></head><body>'
+ '<h1>בדיקת קטלוג NEXT — מדגם ' + cards.length + ' מתוך ' + total + '</h1>'
+ '<p class="sub">תמונות אמיתיות מ-NEXT, שם, מחיר, מגדר, גיל, קטגוריה וצבע כפי שהמערכת מסווגת ומגישה. סנן ובדוק שהתמונות תואמות לסיווג.</p>'
+ '<div class="bar" id="bar"></div><div class="grid" id="grid"></div>'
+ '<script>'
+ 'var D=' + JSON.stringify(cards) + ';'
+ 'var cats=Array.from(new Set(D.map(function(d){return d.c}))).sort();'
+ 'var ages=["0-2","2-8"];'
+ 'var bar=document.getElementById("bar"),grid=document.getElementById("grid");'
+ 'var fG="all",fC="all",fA="all";'
+ 'function chip(label,val,kind){var b=document.createElement("button");b.textContent=label;b.dataset.k=kind;b.dataset.v=val;b.onclick=function(){if(kind=="g")fG=val;else if(kind=="c")fC=val;else fA=val;render()};return b}'
+ '["all","boy","girl"].forEach(function(g){bar.appendChild(chip(g=="all"?"כל המגדרים":g=="boy"?"בנים":"בנות",g,"g"))});'
+ 'bar.appendChild(chip("כל הגילאים","all","a"));ages.forEach(function(a){bar.appendChild(chip(a,a,"a"))});'
+ 'var sep=document.createElement("span");sep.style="width:100%;height:0";bar.appendChild(sep);'
+ 'bar.appendChild(chip("כל הקטגוריות","all","c"));cats.forEach(function(c){bar.appendChild(chip(c,c,"c"))});'
+ 'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")}'
+ 'function render(){'
+ 'Array.prototype.forEach.call(bar.children,function(b){if(b.dataset&&b.dataset.k)b.classList.toggle("on",(b.dataset.k=="g"&&b.dataset.v==fG)||(b.dataset.k=="c"&&b.dataset.v==fC)||(b.dataset.k=="a"&&b.dataset.v==fA))});'
+ 'var items=D.filter(function(d){return (fG=="all"||d.g==fG)&&(fC=="all"||d.c==fC)&&(fA=="all"||d.age==fA)});'
+ 'grid.innerHTML=items.map(function(d){'
+ 'var old=d.sp?(" <span class=old>₪"+d.pr+"</span>"):"";var price=d.sp?d.sp:d.pr;'
+ 'var pk=d.pk?"<span class=\\"tag pk\\">מארז</span>":"";'
+ 'var col=d.col?("<span class=tag>"+esc(d.col)+"</span>"):"";'
+ 'return "<div class=card><img loading=lazy src=\\""+d.img+"\\" onerror=\\"this.style.opacity=.2\\"><div class=b><p class=tt>"+esc(d.t)+"</p><div class=meta><span class=\\"tag g\\">"+(d.g=="boy"?"בנים":"בנות")+"</span><span class=\\"tag a\\">"+d.age+"</span><span class=tag>"+d.c+"</span>"+col+pk+"</div><div class=pr>₪"+price+old+"</div></div></div>"'
+ '}).join("")}'
+ 'render();'
+ '</script></body></html>';
fs.writeFileSync(OUT, html);
console.log('gallery written: ' + cards.length + ' cards from ' + total + ' products -> next-catalog-check.html');
