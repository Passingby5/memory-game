// Deck checker (run by build.js and npm test). Checks every herb card for required fields, sources, warnings, no em-dashes,
// and answer tells: (1) the clue never contains the answer's name, (2) generated questions are not guessable by
// surface rules (longest/shortest choice, first/last position, Chinese-sounding name) above 45% (chance 33%),
// (3) Chinese or adaptogen clues only use Chinese herbs as wrong choices, (4) no duplicate wrong choices.
const L = require('../tests/load.js');
function check(verbose) {
  const MG = L.load(), D = MG.decks.herbs, E = MG.E, errs = [], ids = {};
  if (D.cards.filter(c => c.set === 'jones').length < 30) errs.push('herbs: need 30 Dr. Jones herbs');
  if (D.cards.length < 45) errs.push('herbs: need at least 45 cards, have ' + D.cards.length);
  D.formulas.forEach(f => { if (!/^https:/.test(f.url) || f.herbs.length < 2) errs.push('formula ' + f.name + ' needs herbs and link'); });
  D.cards.forEach(c => {
    if (ids[c.id]) errs.push('duplicate id ' + c.id); ids[c.id] = 1;
    ['name', 'latin', 'system', 'uses', 'how', 'caution'].forEach(k => { if (!c[k]) errs.push(c.id + ': missing ' + k); });
    if (!c.src.length || c.src.some(u => !/^https:\/\//.test(u))) errs.push(c.id + ': needs https monograph source');
    if (!c.symptoms.length) errs.push(c.id + ': needs symptoms');
    if (!MG.bodySystems.some(b => b[0] === c.system)) errs.push(c.id + ': unknown body system ' + c.system);
    if (c.nature && !c.pinyin) errs.push(c.id + ': nature without Chinese name');
    if (/\u2014|\u2013/.test(JSON.stringify(c))) errs.push(c.id + ': em or en dash');
  });
  if (D.cards.filter(c => c.pinyin && c.nature).length < 20) errs.push('herbs: need about 20 Chinese herbs with hot/cold nature');
  const rules = { longest: 0, shortest: 0, first: 0, last: 0, chineseName: 0 }; let n = 0;
  for (let seed = 1; seed <= 20; seed++) { const r = E.rng(seed); D.cards.forEach(c => {
    const q = E.question(c, D.cards, r); n++;
    if (q.choices.length !== 3 || new Set(q.choices).size !== 3) errs.push(c.id + ': bad choices ' + q.choices);
    const nm = c.name.toLowerCase(); if (q.prompt.toLowerCase().includes(nm)) errs.push(c.id + ': clue names the answer');
    { const pw = q.prompt.toLowerCase(); q.choices[q.answer].toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4).forEach(w => { const st = w.replace(/s$/, ''); if (new RegExp('\\b' + st).test(pw) && !q.choices.some((x, i) => i !== q.answer && x.toLowerCase().includes(st))) errs.push(c.id + ': clue word "' + w + '" is in the right choice'); }); }
    if (/Chinese|adaptogen/i.test(q.prompt)) q.choices.forEach(ch => { const x = D.cards.find(k => k.name === ch); if (!x.pinyin) errs.push(c.id + ': Chinese clue with non-Chinese choice ' + ch); });
    const len = q.choices.map(s => s.length), mx = Math.max(...len), mn = Math.min(...len);
    if (len[q.answer] === mx) rules.longest++; if (len[q.answer] === mn) rules.shortest++; if (q.answer === 0) rules.first++; if (q.answer === 2) rules.last++;
    const cn = q.choices.map(ch => !!D.cards.find(k => k.name === ch).pinyin); if (cn[q.answer] && cn.filter(Boolean).length === 1) rules.chineseName++;
  }); }
  Object.keys(rules).forEach(k => { const p = rules[k] / n; if (verbose) console.log('tell rule', k, (p * 100).toFixed(1) + '%'); if (p > 0.45) errs.push('tell rule ' + k + ' picks the answer ' + (p * 100).toFixed(1) + '% (limit 45%)'); });
  // Every source URL must be in tools/verified-links.json with 200 (run node tools/linkcheck.js after adding sources).
  const fs = require('fs'), VL = JSON.parse(fs.readFileSync(__dirname + '/verified-links.json'));
  Object.values(MG.decks).forEach(d => (d.cards || []).forEach(c => (c.src || []).forEach(u => { if (VL[u] !== 200 && VL[u] !== 'manual-200') errs.push(d.id + ' ' + c.id + ': link not verified ' + u); })));
  // Generic multiple choice decks: same surface rules, plus answer text appearing in the question, and exact-length ties.
  Object.values(MG.decks).filter(d => d.cards && d.cards[0] && d.cards[0].q).forEach(d => {
    const minCards = d.min || 50; if (d.cards.length < minCards) errs.push(d.id + ': need at least ' + minCards + ' cards, have ' + d.cards.length);
    const ru = { longest: 0, shortest: 0, middle: 0, first: 0, mostWords: 0 }; let m = 0;
    d.cards.forEach(c => { if (!c.src || !c.src.length) errs.push(d.id + ' ' + c.id + ': no source'); if (!c.why) errs.push(d.id + ' ' + c.id + ': no why');
      if (new Set([c.a].concat(c.w)).size !== 3) errs.push(d.id + ' ' + c.id + ': duplicate choices');
      if (/\u2014/.test(JSON.stringify(c))) errs.push(d.id + ' ' + c.id + ': em-dash');
      if (c.a.length > 3 && c.q.toLowerCase().includes(c.a.toLowerCase())) errs.push(d.id + ' ' + c.id + ': question contains the answer'); });
    for (let seed = 1; seed <= 20; seed++) { const r = E.rng(seed); d.cards.forEach(c => { const q = E.mcq(c, r); m++; const L = q.choices.map(x => x.length), Wd = q.choices.map(x => x.split(' ').length);
      if (L[q.answer] === Math.max(...L) && L.filter(x => x === Math.max(...L)).length === 1) ru.longest++; if (L[q.answer] === Math.min(...L) && L.filter(x => x === Math.min(...L)).length === 1) ru.shortest++; if (q.answer === 0) ru.first++; { const so = L.slice().sort((x, y) => x - y); if (L[q.answer] === so[1] && so[0] !== so[1] && so[1] !== so[2]) ru.middle++; }
      if (Wd[q.answer] === Math.max(...Wd) && Wd.filter(x => x === Math.max(...Wd)).length === 1) ru.mostWords++; }); }
    // Absolute-word tell (QA M-6): guess among choices WITHOUT words like always/never/only/all; expected hit rate must stay <= 45%.
    const ABS = /\b(always|never|only|all|every|none|nobody|nothing|forever|zero|entirely|completely|totally|any|ever)\b/i; let ab = 0;
    d.cards.forEach(c => { const ch = [c.a].concat(c.w), clean = ch.map(x => !ABS.test(x)), n = clean.filter(Boolean).length; ab += (n === 0 || n === 3) ? 1 / 3 : (clean[0] ? 1 / n : 0); });
    const abp = ab / d.cards.length; if (verbose) console.log(d.id, 'tell rule absoluteWord', (abp * 100).toFixed(1) + '%'); if (abp > 0.45) errs.push(d.id + ': absolute-word tell ' + (abp * 100).toFixed(1) + '% (limit 45%)');
    // Opening tell (QA N-1): choices that open with Yes vs a negation (No, Not, It does not, They never...).
    const YES = /^yes\b/i, NEG = /^(no|not|none|never|nothing|nobody)\b|^(it|they|you|he|she|we|this|that) (does|do|did|is|are|was|were|has|have|can|could|will|would) ?n[o']t\b|^(it|they|you|he|she|we) never\b|^(it|they|this) (is|are|was|were) not\b/i;
    const strat = (pref, avoid) => { let h = 0; d.cards.forEach(c => { const ch = [c.a].concat(c.w); let pool = ch.map((x, i) => i).filter(i => pref.test(ch[i])); if (!pool.length) pool = ch.map((x, i) => i).filter(i => !avoid.test(ch[i])); if (!pool.length) pool = [0, 1, 2]; h += pool.includes(0) ? 1 / pool.length : 0; }); return h / d.cards.length; };
    [['negFirst', NEG, YES], ['yesFirst', YES, NEG]].forEach(([k, p, a]) => { const v = strat(p, a); if (verbose) console.log(d.id, 'tell rule opening', k, (v * 100).toFixed(1) + '%'); if (v > 0.45) errs.push(d.id + ': opening tell ' + k + ' ' + (v * 100).toFixed(1) + '% (limit 45%)'); });
    // Clue words (QA N-2): a 5+ letter word of the right answer that also appears in the question, on more than 10% of cards.
    const STOP = new Set(['which','there','their','about','other','these','those','would','could','people','first','after','before','where','still','being']); let cw = 0;
    d.cards.forEach(c => { const q = c.q.toLowerCase(); if (c.a.toLowerCase().split(/[^a-z\u00c0-\u1ef9]+/).some(w => w.length >= 5 && !STOP.has(w) && new RegExp('\\b' + w.replace(/s$/, '')).test(q) && !c.w.some(x => x.toLowerCase().includes(w)))) { cw++; if (verbose) console.log(d.id, c.id, 'clue word in answer'); } });
    if (cw / d.cards.length > 0.1) errs.push(d.id + ': ' + cw + ' cards have a question word only in the right answer');
    // Exact-text tell: a first word that shows up in 6+ choices and is the right answer 70%+ of the time (or never).
    const fw = {}; d.cards.forEach(c => [c.a].concat(c.w).forEach((x, i) => { const k = x.split(/[ ,]/)[0].toLowerCase(); fw[k] = fw[k] || [0, 0]; fw[k][0]++; if (i === 0) fw[k][1]++; }));
    Object.entries(fw).forEach(([k, v]) => { if (v[0] >= 6 && (v[1] / v[0] >= 0.7)) errs.push(d.id + ': first word "' + k + '" is the answer ' + v[1] + ' of ' + v[0] + ' times'); });
    Object.keys(ru).forEach(k => { const p = ru[k] / m; if (verbose) console.log(d.id, 'tell rule', k, (p * 100).toFixed(1) + '%'); if (p > 0.45) errs.push(d.id + ': tell rule ' + k + ' ' + (p * 100).toFixed(1) + '% (limit 45%)'); });
  });
  // No Wikipedia or wiki mirrors anywhere (Tom, Oct 27).
  const WIKI = /wikipedia|wikimedia|wiktionary|wikiwand|wikidata|wikibooks|wikisource|wikivoyage|newworldencyclopedia|fandom\.com|\/wiki\//i;
  Object.values(MG.decks).forEach(d => { (d.cards || []).forEach(c => (c.src || []).forEach(u => { if (WIKI.test(u)) errs.push(d.id + ' ' + c.id + ': wiki source ' + u); })); (d.formulas || []).concat(d.dropped || []).forEach(x => { if (WIKI.test(x.url || x.src || '')) errs.push(d.id + ': wiki source ' + (x.url || x.src)); }); });
  (MG.herbSources || []).forEach(s => { if (WIKI.test(s[1])) errs.push('herbSources: wiki source ' + s[1]); });
  // Right-answer position must be about uniform per deck and per set, the way the app builds questions (consecutive seeds).
  const POS = {}; Object.values(MG.decks).filter(d => d.cards && d.cards.length).forEach(d => { const groups = { all: d.cards }; (d.sets || []).forEach(s => groups[s] = d.cards.filter(c => c.set === s));
    Object.entries(groups).forEach(([g, cards]) => { if (!cards.length) return; const cnt = [0, 0, 0]; let seed = 1000; const rounds = Math.ceil(3000 / cards.length);
      for (let k = 0; k < rounds; k++) cards.forEach(c => { const r = E.rng(seed++), q = d.id === 'herbs' ? E.question(c, d.cards, r) : E.mcq(c, r); cnt[q.answer]++; });
      const tot = cnt[0] + cnt[1] + cnt[2], pct = cnt.map(x => x / tot); if (g === 'all') POS[d.id] = pct.map(x => (x * 100).toFixed(1) + '%').join(' / ');
      if (pct.some(x => x < 0.28 || x > 0.39)) errs.push(d.id + ' ' + g + ': answer position not uniform ' + pct.map(x => (x * 100).toFixed(1)).join('/'));
      const st = [0, 0, 0]; cards.forEach(c => { if (c.q) st[E.mcq(c).answer]++; }); if (cards[0].q && cards.length >= 30 && st.some(x => x / cards.length > 0.45)) errs.push(d.id + ' ' + g + ': stored answer slots unbalanced ' + st); }); });
  if (verbose) Object.entries(POS).forEach(([k, v]) => console.log('answer position A/B/C', k, v));
  return [...new Set(errs)];
}
exports.check = check;
if (require.main === module) { const e = check(true); if (e.length) { console.error(e.join('\n')); process.exit(1); } console.log('ok deck checker: herbs', L.load().decks.herbs.cards.length, 'cards'); }
