// Checks every source URL in all decks and writes tools/verified-links.json (the deck checker requires each card URL there).
// Wikipedia and every wiki mirror are refused outright (Tom, Oct 27). Plain GET with curl first (HTTP 200).
// Sites behind a bot wall (Britannica, Merriam-Webster, CDC...) are opened in a real Chrome window (DISPLAY) and pass only when
// the page title is a real article, not a challenge or error page. Cambridge returns 200 for unknown words, so its pages must
// contain the headword; vdict.com (English-Vietnamese) pages must hold a definition block. doi.org links are confirmed through the Crossref API (publishers often block bots). homegrownherbalist.net blocks the box and was checked by page fetch (MANUAL).
// Usage: node tools/linkcheck.js [--recheck]   (without --recheck, URLs already verified 200 are kept).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const vm = require('vm'); const ctx = {}; vm.createContext(ctx);
require('../tests/load.js').ORDER.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx));
const WIKI = exports.WIKI = /wikipedia|wikimedia|wiktionary|wikiwand|wikidata|wikibooks|wikisource|wikivoyage|newworldencyclopedia|fandom\.com|\/wiki\//i;
if (require.main !== module) return;
const urls = new Set(); Object.values(ctx.MG.decks).forEach(d => { (d.cards || []).forEach(c => (c.src || []).forEach(u => urls.add(u))); (d.formulas || []).forEach(f => urls.add(f.url)); (d.dropped || []).forEach(x => urls.add(x.src)); (d.sources || []).forEach(s => urls.add(s[1])); });
(ctx.MG.herbSources || []).forEach(s => urls.add(s[1]));
const MANUAL = /^https:\/\/homegrownherbalist\.net\//, BROWSER = /britannica\.com|merriam-webster\.com|cdc\.gov|collinsdictionary|etymonline|nature\.com|science\.org|sciencedirect|jstor|wsj\.com|nytimes\.com|heritage\.org|cfr\.org/;
const file = path.join(__dirname, 'verified-links.json'), prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}, out = {}, recheck = process.argv.includes('--recheck');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const curl = args => execFileSync('curl', ['-s', '-m', '25', '-L', '-A', UA, '-H', 'Accept: text/html', '-H', 'Accept-Language: en-US'].concat(args), { maxBuffer: 64e6 }).toString();
const todo = [];
[...urls].forEach(u => { if (WIKI.test(u)) { out[u] = 'WIKI-REFUSED'; return; } if (MANUAL.test(u)) { out[u] = 'manual-200'; return; } if (!recheck && prev[u] === 200) { out[u] = 200; return; } todo.push(u); });
const browserList = [];
todo.forEach(u => { if (BROWSER.test(u)) return browserList.push(u); let c = '000';
  try { if (/dictionary\.cambridge\.org/.test(u)) { const w = decodeURIComponent(u.split('/').pop()).toLowerCase(), h = curl([u]).toLowerCase(); c = h.includes('class="hw dhw">' + w) || h.includes('<span class="hw dhw">' + w) ? 200 : 'NO-HEADWORD'; }
    else if (/nchfp\.uga\.edu/.test(u)) { const h = curl([u]); c = /<title>\s*\|/.test(h) || !/<title>/.test(h) ? 'NO-PAGE' : 200; }
    else if (/^https:\/\/doi\.org\//.test(u)) { const j = JSON.parse(execFileSync('curl', ['-s', '-m', '25', 'https://api.crossref.org/works/' + u.slice(16)]).toString() || '{}'); c = j.status === 'ok' && j.message && j.message.title ? 200 : 'NO-DOI'; }
    else if (/vdict\.com/.test(u)) { const h = curl([u]); c = (h.match(/meaning/g) || []).length >= 3 ? 200 : 'NO-ENTRY'; }
    else c = +curl(['-o', '/dev/null', '-w', '%{http_code}', u]) || 'ERR'; } catch (e) { c = 'ERR'; }
  if (c !== 200 && c !== 'NO-HEADWORD' && c !== 'NO-ENTRY' && c !== 'NO-PAGE' && c !== 'NO-DOI') browserList.push(u); else out[u] = c; });
const done = () => { fs.writeFileSync(file, JSON.stringify(out, null, 1)); const bad = Object.entries(out).filter(([u, c]) => c !== 200 && c !== 'manual-200'); console.log('links', Object.keys(out).length, 'bad', bad.length); bad.forEach(b => console.log(b[1], b[0])); };
if (!browserList.length) return done();
(async () => { const { chromium } = require('playwright-core'); const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f));
  const b = await chromium.launch({ executablePath: exe, headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] }); 
  let p = await b.newPage();
  for (const u of browserList) { let c = 'ERR';
    for (let attempt = 0; attempt < 2 && c === 'ERR'; attempt++) { try { const r = await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); let t = await p.title();
      for (let k = 0; k < 12 && /just a moment|attention required/i.test(t); k++) { await p.waitForTimeout(1500); t = await p.title(); }
      const st = r ? r.status() : 0, bad = /^(just a moment|attention required|error|page not found|404)|page not found|^error \|/i.test(t.trim());
      c = bad || st === 404 || st === 410 || st >= 500 ? 'BAD:' + st + ':' + t.slice(0, 40) : 200; } catch (e) { try { await p.close(); } catch (x) {} p = await b.newPage(); } }
    out[u] = c; process.stdout.write(c === 200 ? '.' : 'x'); }
  await b.close(); console.log(); done(); })();
