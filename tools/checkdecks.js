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
    Object.keys(ru).forEach(k => { const p = ru[k] / m; if (verbose) console.log(d.id, 'tell rule', k, (p * 100).toFixed(1) + '%'); if (p > 0.45) errs.push(d.id + ': tell rule ' + k + ' ' + (p * 100).toFixed(1) + '% (limit 45%)'); });
  });
  return [...new Set(errs)];
}
exports.check = check;
if (require.main === module) { const e = check(true); if (e.length) { console.error(e.join('\n')); process.exit(1); } console.log('ok deck checker: herbs', L.load().decks.herbs.cards.length, 'cards'); }
