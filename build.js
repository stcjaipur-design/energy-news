// Fetches fresh headlines from Google News RSS and builds the static site into ./public
const fs = require('fs');
const path = require('path');

const FEEDS = [
  { cat:'crude', q:'crude oil OR Brent OR WTI OR OPEC oil price' },
  { cat:'base',  q:'"base oil" OR "base stock" OR lubricant base oil' },
  { cat:'ref',   q:'oil refinery OR refining OR refiner' },
  { geo:true,    q:'oil geopolitics OR Strait of Hormuz OR Iran oil OR Russia oil sanctions OR OPEC' },
  { co:true,     q:'ExxonMobil' },
  { co:true,     q:'Shell oil company' },
  { co:true,     q:'BP oil OR Castrol' },
  { co:true,     q:'Indian Oil IOCL' },
  { co:true,     q:'HPCL Hindustan Petroleum' },
  { co:true,     q:'BPCL Bharat Petroleum' },
];

function decode(s){
  return (s||'')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}
function isoDate(s){ const d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); }

async function fetchFeed(f){
  const url='https://news.google.com/rss/search?q='+encodeURIComponent(f.q)+'&hl=en-IN&gl=IN&ceid=IN:en';
  try{
    const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; EnergyNewsBot/1.0)'}});
    if(!res.ok){ console.error('feed failed',f.q,res.status); return []; }
    const xml=await res.text();
    const items=[];
    const re=/<item>([\s\S]*?)<\/item>/g; let m;
    while((m=re.exec(xml))){
      const block=m[1];
      const t=(block.match(/<title>([\s\S]*?)<\/title>/)||[])[1];
      const link=(block.match(/<link>([\s\S]*?)<\/link>/)||[])[1];
      const pub=(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)||[])[1];
      let title=decode(t); const url2=decode(link);
      if(!title||!url2) continue;
      // Google titles end with " - Publisher"
      let src='Google News';
      const idx=title.lastIndexOf(' - ');
      if(idx>10){ src=title.slice(idx+3).trim(); title=title.slice(0,idx).trim(); }
      const it={ title, url:url2, date:isoDate(pub)||'', src };
      if(f.cat) it.cat=f.cat;
      if(f.geo) it.geo=true;
      if(f.co)  it.co=true;
      items.push(it);
    }
    return items.slice(0,18); // cap per feed
  }catch(e){ console.error('feed error',f.q,e.message); return []; }
}

(async()=>{
  const all=[]; const seen=new Set();
  for(const f of FEEDS){
    const items=await fetchFeed(f);
    for(const it of items){
      const key=it.title.toLowerCase().slice(0,60);
      if(seen.has(key)) continue; seen.add(key);
      all.push(it);
    }
  }
  console.log('collected', all.length, 'headlines');
  if(all.length < 10){
    console.error('Too few headlines fetched; keeping previous build if present.');
    if(fs.existsSync('public/index.html')) process.exit(0);
  }
  const ver=String(Date.now());
  const tpl=fs.readFileSync('template.html','utf8')
    .replace('__SEED__', JSON.stringify(all))
    .replace('__VER__', ver);
  const sw=fs.readFileSync('sw.template.js','utf8').replace('__VER__', ver);

  fs.mkdirSync('public',{recursive:true});
  fs.writeFileSync('public/index.html', tpl);
  fs.writeFileSync('public/sw.js', sw);
  for(const a of ['manifest.webmanifest','icon-192.png','icon-512.png']){
    fs.copyFileSync(a, path.join('public',a));
  }
  console.log('build complete -> public/ (version '+ver+')');
})();
