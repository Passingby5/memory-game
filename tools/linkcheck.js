// Checks every source URL in all decks. Wikipedia titles are checked in batches with the MediaWiki API (exists, not a missing page);
// other URLs with a GET (HTTP 200). homegrownherbalist.net blocks the box (403) and was checked by page fetch; listed in MANUAL.
// Writes tools/verified-links.json, which the deck checker requires every card URL to appear in.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const vm = require('vm'); const ctx = {}; vm.createContext(ctx);
require('../tests/load.js').ORDER.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx));
const urls = new Set(); Object.values(ctx.MG.decks).forEach(d => { (d.cards || []).forEach(c => (c.src || []).forEach(u => urls.add(u))); (d.formulas || []).forEach(f => urls.add(f.url)); (d.dropped || []).forEach(x => urls.add(x.src)); (d.sources || []).forEach(s => urls.add(s[1])); });
(ctx.MG.herbSources || []).forEach(s => urls.add(s[1]));
const MANUAL = /^https:\/\/homegrownherbalist\.net\//;
const out = {}, wiki = {}; const file = path.join(__dirname, 'verified-links.json'); const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
[...urls].forEach(u => { const m = u.match(/^https:\/\/(en|vi)\.(wikipedia|wiktionary)\.org\/wiki\/(.+)$/); if (m) (wiki[m[1] + '.' + m[2]] = wiki[m[1] + '.' + m[2]] || []).push([u, decodeURIComponent(m[3])]); });
const curl = args => execFileSync('curl', ['-s', '-m', '25', '-A', 'MemoryGameLinkCheck/1.0 (family app)'].concat(args)).toString();
Object.entries(wiki).forEach(([host, list]) => { for (let i = 0; i < list.length; i += 40) { const part = list.slice(i, i + 40);
  const j = JSON.parse(curl(['https://' + host + '.org/w/api.php?action=query&format=json&redirects=1&titles=' + encodeURIComponent(part.map(p => p[1].replace(/_/g, ' ')).join('|'))]));
  const missing = new Set(Object.values(j.query.pages).filter(p => 'missing' in p || 'invalid' in p).map(p => p.title));
  const norm = {}; (j.query.normalized || []).forEach(n => norm[n.from] = n.to); const red = {}; (j.query.redirects || []).forEach(n => red[n.from] = n.to);
  part.forEach(([u, t]) => { let x = t.replace(/_/g, ' '); x = norm[x] || x; out[u] = missing.has(x) ? 'MISSING' : 200; }); } });
[...urls].filter(u => !(u in out)).forEach(u => { if (MANUAL.test(u)) { out[u] = 'manual-200'; return; } if (prev[u] === 200) { out[u] = 200; return; } let c = '000'; try { c = curl(['-o', '/dev/null', '-w', '%{http_code}', '-L', u]); } catch (e) { } out[u] = +c || c; });
fs.writeFileSync(file, JSON.stringify(out, null, 1));
const bad = Object.entries(out).filter(([u, c]) => c !== 200 && c !== 'manual-200'); console.log('links', Object.keys(out).length, 'bad', bad.length); bad.forEach(b => console.log(b[1], b[0]));
