// Game logic: seeded RNG, Leitner spaced repetition, question builder, save versioning. No content here.
var MG = typeof MG !== 'undefined' ? MG : {};
(function () {
  var E = MG.E = {};
  E.SAVE_VERSION = 2; E.SAVE_KEY = 'mg_save';
  E.rng = function (seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  E.shuffle = function (a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  // Leitner: 5 boxes; box n is due again after INTERVAL[n] days. Right moves up one box, wrong goes back to box 1.
  E.INTERVAL = [0, 0, 1, 3, 7, 14]; E.DAY = 86400000;
  E.newState = function () { return { v: E.SAVE_VERSION, seed: 12345, boxes: {}, stats: { right: 0, wrong: 0 }, session: null, best: {} }; };
  E.grade = function (st, id, ok, now) { var b = st.boxes[id] || { box: 1, due: 0 }; b.box = ok ? Math.min(5, b.box + 1) : 1; b.due = now + E.INTERVAL[b.box] * E.DAY; st.boxes[id] = b; st.stats[ok ? 'right' : 'wrong']++; return b; };
  E.dueCards = function (st, cards, now) { return cards.filter(function (c) { var b = st.boxes[c.id]; return !b || b.due <= now; }).sort(function (a, b) { var x = st.boxes[a.id], y = st.boxes[b.id]; return (x ? x.box : 0) - (y ? y.box : 0); }); };
  // Save versioning: v1 kept a flat {leitner:{id:box}}; v2 stores {box,due}. Unknown or broken saves start fresh.
  E.migrate = function (raw) {
    var s; try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return E.newState(); }
    if (!s || typeof s !== 'object') return E.newState();
    if (s.v === 1) { var n = E.newState(); Object.keys(s.leitner || {}).forEach(function (k) { n.boxes[k] = { box: s.leitner[k], due: 0 }; }); n.stats = s.stats || n.stats; return n; }
    if (s.v !== E.SAVE_VERSION) return E.newState();
    if (!s.best) s.best = {};
    return s;
  };
  // Question kinds. Choices are always 3 herb names, so the right answer cannot be spotted by wording or length alone.
  E.question = function (card, cards, r) {
    var kinds = ['uses', 'symptom', 'caution']; if (card.nature) kinds.push('nature');
    var k = kinds[Math.floor(r() * kinds.length)], prompt, bad;
    if (k === 'uses') { prompt = 'Which herb fits this? ' + card.uses; bad = function (c) { return c.system === card.system; }; }
    else if (k === 'symptom') { var s = card.symptoms[Math.floor(r() * card.symptoms.length)]; prompt = 'Which herb is used for: ' + s + '?'; bad = function (c) { return c.symptoms.indexOf(s) >= 0; }; }
    else if (k === 'caution') { prompt = 'Which herb has this warning? ' + card.caution; bad = function (c) { return c.system === card.system; }; }
    else { prompt = 'Which Chinese herb is ' + card.nature + ' in nature?'; bad = function (c) { return !c.nature || c.nature === card.nature; }; }
    var cn = /Chinese|Asia|adaptogen/i.test(prompt + (k === 'uses' ? '' : ''));
    var pool = E.shuffle(cards.filter(function (c) { return c.id !== card.id && !bad(c) && (!cn || c.pinyin); }), r).slice(0, 2);
    var choices = E.shuffle([card].concat(pool), r).map(function (c) { return c.name; });
    return { kind: k, id: card.id, prompt: E.mask(prompt, card), choices: choices, answer: choices.indexOf(card.name) };
  };
  // Remove the herb's own name from the clue so the prompt never gives away the answer.
  E.mask = function (t, card) { var n = card.name.replace(/\s*\(.*\)/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return t.replace(new RegExp('\\b' + n + '\\b', 'gi'), 'this herb'); };
  // Generic multiple choice card {q, a, w:[2]}: choices are the answer plus two wrong answers, shuffled by the seeded RNG.
  E.mcq = function (card, r) { var ch = E.shuffle([card.a].concat(card.w), r); return { kind: 'mcq', id: card.id, prompt: card.q, choices: ch, answer: ch.indexOf(card.a) }; };
  // Trainers. Digit span: random digits; length goes up after a right answer, down after a wrong one (minimum 3).
  E.digits = function (r, n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(r() * 10); return s; };
  E.spanNext = function (len, ok) { return ok ? len + 1 : Math.max(3, len - 1); };
  // N-back: sequence of letters where about rate of the positions (from n on) repeat the letter n back.
  E.nback = function (r, n, len, rate) { var L = 'BCDFGHJKLMNPRSTV', s = []; for (var i = 0; i < len; i++) { if (i >= n && r() < rate) s.push(s[i - n]); else { var c; do { c = L[Math.floor(r() * L.length)]; } while (i >= n && c === s[i - n]); s.push(c); } } return s; };
  E.nbackScore = function (seq, n, taps) { var hits = 0, misses = 0, fa = 0; seq.forEach(function (c, i) { var t = i >= n && seq[i - n] === c, p = taps.indexOf(i) >= 0; if (t && p) hits++; else if (t) misses++; else if (p) fa++; }); return { hits: hits, misses: misses, falseAlarms: fa, pct: Math.round(100 * hits / Math.max(1, hits + misses + fa)) }; };
  E.palaceRound = function (r, P) { var items = E.shuffle(P.items, r).slice(0, P.places.length); return P.places.map(function (pl, i) { return { place: pl, item: items[i] }; }); };
  E.lookup = function (cards, sym) { return cards.filter(function (c) { return c.symptoms.indexOf(sym) >= 0; }); };
  E.allSymptoms = function (cards) { var s = {}; cards.forEach(function (c) { c.symptoms.forEach(function (x) { s[x] = 1; }); }); return Object.keys(s).sort(); };
})();
if (typeof module !== 'undefined') module.exports = MG;
