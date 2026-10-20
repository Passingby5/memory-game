// Deck checker (run by build.js and npm test). Checks every herb card for required fields, sources, warnings, no em-dashes,
// and answer tells: (1) the clue never contains the answer's name, (2) generated questions are not guessable by
// surface rules (longest/shortest choice, first/last position, Chinese-sounding name) above 45% (chance 33%),
// (3) Chinese or adaptogen clues only use Chinese herbs as wrong choices, (4) no duplicate wrong choices.
const L = require('../tests/load.js');
function check(verbose) {
  const MG = L.load(), D = MG.decks.herbs, E = MG.E, errs = [], ids = {};
  if (D.cards.length < 50) errs.push('herbs: need at least 50 cards, have ' + D.cards.length);
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
  return [...new Set(errs)];
}
exports.check = check;
if (require.main === module) { const e = check(true); if (e.length) { console.error(e.join('\n')); process.exit(1); } console.log('ok deck checker: herbs', L.load().decks.herbs.cards.length, 'cards'); }
