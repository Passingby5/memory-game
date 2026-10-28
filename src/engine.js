// Game logic: seeded RNG, Leitner spaced repetition, question builder, save versioning. No content here.
var MG = typeof MG !== 'undefined' ? MG : {};
(function () {
  var E = MG.E = {};
  E.SAVE_VERSION = 2; E.SAVE_KEY = 'mg_save';
  // Seeds are mixed (murmur3 finalizer) and the first outputs dropped, so nearby seeds (12345, 12346...) do not give
  // nearly the same first numbers. Before v10 they did, which put the right answer in the same slot again and again.
  E.mix = function (h) { h = (h >>> 0) ^ 0x9e3779b9; h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) || 1; };
  E.rng = function (seed) { var s = E.mix(seed); for (var k = 0; k < 4; k++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; } return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  E.shuffle = function (a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  // Leitner: 5 boxes; box n is due again after INTERVAL[n] days. Right moves up one box, wrong goes back to box 1.
  E.INTERVAL = [0, 0, 1, 3, 7, 14]; E.DAY = 86400000;
  // Each new install starts from a random seed so question order differs between people and sessions (tests pass their own seed).
  E.freshSeed = function () { try { if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] || 1; } catch (e) {} return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0 || 1; };
  E.newState = function () { return { v: E.SAVE_VERSION, seed: E.freshSeed(), boxes: {}, stats: { right: 0, wrong: 0 }, session: null, best: {} }; };
  E.grade = function (st, id, ok, now) { var b = st.boxes[id] || { box: 1, due: 0 }; b.box = ok ? Math.min(5, b.box + 1) : 1; b.due = now + E.INTERVAL[b.box] * E.DAY; st.boxes[id] = b; st.stats[ok ? 'right' : 'wrong']++; return b; };
  E.dueCards = function (st, cards, now) { return cards.filter(function (c) { var b = st.boxes[c.id]; return !b || b.due <= now; }).sort(function (a, b) { var x = st.boxes[a.id], y = st.boxes[b.id]; return (x ? x.box : 0) - (y ? y.box : 0); }); };
  // Session picker: due cards first, lowest Leitner box first; ties and unseen cards are shuffled, so each session gets a new mix.
  E.pickSession = function (st, all, now, r, n) { var bx = function (c) { var b = st.boxes[c.id]; return b ? b.box : 0; };
    var due = E.shuffle(E.dueCards(st, all, now), r).sort(function (a, b) { return bx(a) - bx(b); });
    var seen = due.filter(function (c) { return st.boxes[c.id]; }), fresh = due.filter(function (c) { return !st.boxes[c.id]; });
    var out = seen.concat(fresh); if (out.length < n) out = out.concat(E.shuffle(all.filter(function (c) { return out.indexOf(c) < 0; }), r));
    out = out.slice(0, n); var missed = out.filter(function (c) { return bx(c) === 1; });
    return missed.concat(E.shuffle(out.filter(function (c) { return bx(c) !== 1; }), r)).map(function (c) { return c.id; }); };
  // Save versioning: v1 kept a flat {leitner:{id:box}}; v2 stores {box,due}. Unknown or broken saves start fresh.
  E.migrate = function (raw, decks) {
    var s; try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return E.newState(); }
    if (!s || typeof s !== 'object' || Array.isArray(s)) return E.newState();
    if (s.v === 1) { var n = E.newState(); Object.keys(s.leitner || {}).forEach(function (k) { n.boxes[k] = { box: s.leitner[k], due: 0 }; }); n.stats = s.stats || n.stats; return E.sanitize(n, decks); }
    if (s.v !== E.SAVE_VERSION) return E.newState();
    return E.sanitize(s, decks);
  };
  // Repairs any v2-shaped save: bad or missing fields get defaults; a session pointing at a missing deck or card is dropped.
  E.sanitize = function (s, decks) {
    var o = E.newState(), num = function (x) { return typeof x === 'number' && isFinite(x); };
    if (num(s.seed)) o.seed = s.seed >>> 0 || 1;
    if (s.stats && typeof s.stats === 'object') { o.stats.right = num(s.stats.right) && s.stats.right >= 0 ? s.stats.right : 0; o.stats.wrong = num(s.stats.wrong) && s.stats.wrong >= 0 ? s.stats.wrong : 0; }
    if (s.boxes && typeof s.boxes === 'object' && !Array.isArray(s.boxes)) Object.keys(s.boxes).forEach(function (k) { var b = s.boxes[k]; if (b && num(b.box) && b.box >= 1 && b.box <= 5 && num(b.due)) o.boxes[k] = { box: Math.floor(b.box), due: b.due }; });
    if (s.best && typeof s.best === 'object' && !Array.isArray(s.best)) ['span', 'nback', 'palace'].forEach(function (k) { if (num(s.best[k]) && s.best[k] >= 0) o.best[k] = s.best[k]; });
    var ss = s.session; if (ss && decks && E.validSession(ss, decks)) o.session = { deck: ss.deck, ids: ss.ids.slice(), i: ss.i, q: ss.q, answered: !!ss.answered };
    return o;
  };
  E.validSession = function (ss, decks) {
    if (!ss || typeof ss !== 'object' || !decks[ss.deck] || !Array.isArray(ss.ids) || !ss.ids.length) return false;
    var ids = {}; (decks[ss.deck].cards || []).forEach(function (c) { ids[c.id] = 1; });
    if (!ss.ids.every(function (x) { return ids[x]; })) return false;
    if (typeof ss.i !== 'number' || ss.i < 0 || ss.i >= ss.ids.length || ss.i % 1) return false;
    var q = ss.q; return !!(q && q.id === ss.ids[ss.i] && Array.isArray(q.choices) && q.choices.length === 3 && typeof q.answer === 'number' && q.answer >= 0 && q.answer < 3 && typeof q.prompt === 'string');
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
  E.mcq = function (card, r) { var ch; if (r) ch = E.shuffle([card.a].concat(card.w), r); else { ch = card.w.slice(); ch.splice(E.slot(card.id), 0, card.a); } return { kind: 'mcq', id: card.id, prompt: card.q, choices: ch, answer: ch.indexOf(card.a) }; };
  // Stored (no-RNG) answer slot, from a hash of the card id, so stored order is balanced too (about a third each).
  E.slot = function (id) { var h = 7; for (var i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return E.mix(h) % 3; };
  // Trainers. Digit span: random digits; length goes up after a right answer, down after a wrong one (minimum 3).
  E.digits = function (r, n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(r() * 10); return s; };
  E.spanNext = function (len, ok) { return ok ? len + 1 : Math.max(3, len - 1); };
  // N-back: sequence of letters where about rate of the positions (from n on) repeat the letter n back.
  E.nback = function (r, n, len, rate) { var L = 'BCDFGHJKLMNPRSTV', s = []; for (var i = 0; i < len; i++) { if (i >= n && r() < rate) s.push(s[i - n]); else { var c; do { c = L[Math.floor(r() * L.length)]; } while (i >= n && c === s[i - n]); s.push(c); } } return s; };
  E.nbackScore = function (seq, n, taps) { var hits = 0, misses = 0, fa = 0; seq.forEach(function (c, i) { var t = i >= n && seq[i - n] === c, p = taps.indexOf(i) >= 0; if (t && p) hits++; else if (t) misses++; else if (p) fa++; }); return { hits: hits, misses: misses, falseAlarms: fa, pct: Math.round(100 * hits / Math.max(1, hits + misses + fa)) }; };
  E.palaceRound = function (r, P) { var items = E.shuffle(P.items, r).slice(0, P.places.length); return P.places.map(function (pl, i) { return { place: pl, item: items[i] }; }); };
  // Builds the vocab deck from MG.vocabData. Wrong choices use fixed offsets so the deck is the same every build.
  E.buildVocab = function (VD) { var V = VD.words, bad = VD.alsoFits || {};
    var art = function (v) { var m = v[5].match(/\b(a|an) ____/i); return m ? m[1].toLowerCase() : ''; }, vow = function (w) { return /^[aeiou]/i.test(w) ? 'an' : 'a'; };
    function okArt(me, x) { var a = art(me); return !a || vow(x[0]) === a; }
    function wrongs(i) { var me = V[i], out = [], no = (bad[me[0]] || []).concat(V.filter(function (x) { return !okArt(me, x); }).map(function (x) { return x[0]; })); for (var k = 7; k < 7 + V.length * 11 && out.length < 2; k += 11) { var x = V[(i + k) % V.length]; if (x[1] === me[1] && x[2] !== me[2] && out.indexOf(x[0]) < 0 && x[0] !== me[0] && no.indexOf(x[0]) < 0) out.push(x[0]); }
      for (var j = 1; j < V.length && out.length < 2; j++) { var y = V[(i + j) % V.length]; if (y[1] === me[1] && y[2] !== me[2] && out.indexOf(y[0]) < 0 && y[0] !== me[0] && no.indexOf(y[0]) < 0) out.push(y[0]); } return out; }
    return { id: 'vocab', title: VD.title, note: VD.note, sets: ['Verbs', 'Adjectives', 'Nouns'],
      cards: V.map(function (v, i) { return { id: 'v' + (i + 1), set: { verb: 'Verbs', adj: 'Adjectives', noun: 'Nouns' }[v[1]], q: v[5], a: v[0], w: wrongs(i), pos: v[1], def: v[3], vi: v[4],
        why: v[0] + ' (' + v[1] + '): ' + v[3] + '. Tiếng Việt: ' + v[4] + '.', src: ['https://dictionary.cambridge.org/dictionary/english/' + v[0], 'https://vdict.com/' + v[0] + ',1,0,0.html'] }; }) }; };
  if (MG.vocabData && MG.decks) MG.decks.vocab = E.buildVocab(MG.vocabData);
  E.lookup = function (cards, sym) { return cards.filter(function (c) { return c.symptoms.indexOf(sym) >= 0; }); };
  E.allSymptoms = function (cards) { var s = {}; cards.forEach(function (c) { c.symptoms.forEach(function (x) { s[x] = 1; }); }); return Object.keys(s).sort(); };
})();
if (typeof module !== 'undefined') module.exports = MG;
