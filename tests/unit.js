// Unit tests for engine and deck data.
const assert = require('assert'), MG = require('./load.js').load(), E = MG.E, D = MG.decks.herbs; let n = 0; const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); const t = (name, f) => { f(); n++; console.log('ok', name); };
t('seeded rng repeats', () => { const a = E.rng(7), b = E.rng(7); for (let i = 0; i < 5; i++) assert.strictEqual(a(), b()); });
t('shuffle keeps items', () => { const s = E.shuffle([1, 2, 3, 4], E.rng(3)); same(s.slice().sort(), [1, 2, 3, 4]); });
t('leitner right moves up, wrong resets', () => { const st = E.newState(); E.grade(st, 'x', true, 0); assert.strictEqual(st.boxes.x.box, 2); E.grade(st, 'x', true, 0); assert.strictEqual(st.boxes.x.box, 3); assert.strictEqual(st.boxes.x.due, 3 * E.DAY); E.grade(st, 'x', false, 0); assert.strictEqual(st.boxes.x.box, 1); });
t('leitner caps at box 5', () => { const st = E.newState(); for (let i = 0; i < 9; i++) E.grade(st, 'y', true, 0); assert.strictEqual(st.boxes.y.box, 5); });
t('due cards: new and overdue first, low box first', () => { const st = E.newState(), c = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; st.boxes.a = { box: 3, due: 0 }; st.boxes.b = { box: 2, due: 1e15 }; const d = E.dueCards(st, c, 10); same(d.map(x => x.id), ['c', 'a']); });
t('save v1 migrates to v2', () => { const s = E.migrate(JSON.stringify({ v: 1, leitner: { ginger: 3 } })); assert.strictEqual(s.v, 2); assert.strictEqual(s.boxes.ginger.box, 3); });
t('broken or future save starts fresh', () => { assert.strictEqual(E.migrate('{bad').v, 2); same(E.migrate(JSON.stringify({ v: 99 })).boxes, {}); assert.strictEqual(E.migrate(null).v, 2); });
t('every card makes a valid question with 3 choices', () => { const r = E.rng(1); D.cards.forEach(c => { const q = E.question(c, D.cards, r); assert.strictEqual(q.choices.length, 3); assert.strictEqual(q.choices[q.answer], c.name); }); });
t('symptom lookup finds herbs', () => { assert(E.lookup(D.cards, 'nausea').some(c => c.id === 'ginger')); assert(E.allSymptoms(D.cards).length > 30); });
t('50+ herbs, 20+ Chinese, all with warning and source', () => { assert(D.cards.length >= 50); assert(D.cards.filter(c => c.nature).length >= 20); D.cards.forEach(c => { assert(c.caution.length > 20); assert(c.src.length >= 1); }); });
t('dropped list has reasons and sources', () => { assert(D.dropped.length >= 3); D.dropped.forEach(d => assert(d.why && d.src)); });
t('6 sections, only herbs ready', () => { assert.strictEqual(MG.SECTIONS.length, 6); same(MG.SECTIONS.filter(s => s.ready).map(s => s.id), ['herbs']); });
t('deck checker clean', () => same(require('../tools/checkdecks.js').check(), []));
t('no em-dashes in src or docs', () => { const fs = require('fs'), p = require('path'); const walk = d => fs.readdirSync(d).flatMap(f => { const x = p.join(d, f); return fs.statSync(x).isDirectory() ? walk(x) : [x]; }); walk(p.join(__dirname, '../src')).concat(walk(p.join(__dirname, '../docs'))).filter(f => /\.(js|css|html|md)$/.test(f)).forEach(f => assert(!/\u2014/.test(fs.readFileSync(f, 'utf8')), 'em-dash in ' + f)); });
console.log('unit: ' + n + ' passed');
