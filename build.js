// Fetches fresh headlines (last 7 days) from Google News RSS and builds the site into ./public
const fs = require('fs');
const path = require('path');

const WHEN = 'when:7d';                 // only articles from the last 7 days
const CAPS = { crude:15, base:5, ref:5, geo:20, co:30 };  // max items per section

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
  const url='https://news.google.com/rss/s
