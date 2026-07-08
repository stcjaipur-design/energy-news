// Fetches fresh headlines (last 7 days) from Google News RSS and builds the site into ./public
const fs = require('fs');
const path = require('path');

const WHEN = 'when:7d';
const CAPS = { crude:15, base:5, ref:5, geo:20, co:30 };

const FEEDS = [
  { cat:'crude', q:'crude oil OR Brent OR WTI OR OPEC oil price' },
  { cat:'base',  q:'"base oil" OR "base stock" OR lubricant base oil' },
  { cat:'ref',   q:'oil refinery OR refining OR refiner' },
  { cat:'geo',   q:'oil geopolitics OR Strait of Hormuz OR Iran oil OR Russia oil sanctions OR OPEC' },
  { cat:'co', co:true, q:'ExxonMobil' },
  { cat:'co', co:true, q:'Shell oil company' },
  { cat:'co', co:true, q:'BP oil OR Castrol' },
  { cat:'co', co:true, q:'Indian Oil IOCL' },
  { cat:'co', co:true, q:'HPCL Hindustan Petroleum' },
  { cat:'co', co:true, q:'BPCL Bharat Petroleum' },
];

function decode(s){
  return (s||'')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}
function tsOf(s){ const d=new Date(s); return isNaN(d)?0:d.getTime(); }
function isoDate(s){ const d=new Date(s); return isNaN(d)?'':d.toISOString().slice(0,10); }

async function fetchFeed(f){
  const url='https://news.google.com/rss/search?q='+encodeURIComponent(f.q+' '+WHEN)+'&hl=en-IN&gl=IN&ceid=IN:en';
  try{
    const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; EnergyNewsBot/1.0)'}});
    if(!res.ok){ console.error('feed failed',f.q,res.status); return []; }
    const xml=await res.text();
    const items=[]; const re=/<item>([\s\S]*?)<\/item>/g; let m;
    while((m=re.exec(xml))){
      const block=m[1];
      const t=(block.match(/<title>([\s\S]*?)<\/title>/)||[])[1];
      const link=(block.match(/<link>([\s\S]*?)<\/link>/)||[])[1];
      const pub=(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)||[])[1];
      let title=decode(t); const url2=decode(link);
      if(!title||!url2) continue;
      let src='Google News'; const idx=title.lastIndexOf(' - ');
      if(idx>10){ src=title.slice(idx+3).trim(); title=title.slice(0,idx).trim(); }
      const it={ title, url:url2, date:isoDate(pub), src, cat:f.cat, ts:tsOf(pub) };
      if(f.cat==='geo') it.geo=true;
      if(f.co) it.co=true;
      items.push(it);
    }
    return items.slice(0,40);
  }catch(e){ console.error('feed error',f.q,e.message); return []; }
}

(async()=>{
  const byCat={crude:[],base:[],ref:[],geo:[],co:[]};
  const seen=new Set();
  for(const f of FEEDS){
    const items=await fetchFeed(f);
    for(const it of items){
      const key=it.title.toLowerCase().slice(0,60);
      if(seen.has(key)) continue; seen.add(key);
      (byCat[it.cat]||byCat.crude).push(it);
    }
  }
  const all=[];
  const summary={};
  for(const cat of Object.keys(CAPS)){
    const arr=byCat[cat].sort((a,b)=>b.ts-a.ts).slice(0,CAPS[cat]);
    summary[cat]=arr.length;
    for(const it of arr){ delete it.ts; if(it.cat!=='crude'&&it.cat!=='base'&&it.cat!=='ref') delete it.cat; all.push(it); }
  }
  console.log('kept per section:', JSON.stringify(summary), 'total', all.length);
  if(all.length < 5){
    console.error('Too few headlines; keeping previous build if present.');
    if(fs.existsSync('public/index.html')) process.exit(0);
  }
  const ver=String(Date.now());
  const tpl=fs.readFileSync('app.html','utf8').replace('__SEED__', JSON.stringify(all)).replace('__VER__', ver);
  const sw=fs.readFileSync('sw.template.js','utf8').replace('__VER__', ver);
  fs.mkdirSync('public',{recursive:true});
  fs.writeFileSync('public/index.html', tpl);
  fs.writeFileSync('public/sw.js', sw);
  for(const a of ['manifest.webmanifest','icon-192.png','icon-512.png']) fs.copyFileSync(a, path.join('public',a));
  console.log('build complete -> public/ (version '+ver+')');
})();
