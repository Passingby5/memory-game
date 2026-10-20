// Memory trainer screens: digit span, 2-back, memory palace. Spaced recall uses the generic deck practice on the memory research cards.
(function () {
  var E = MG.E, T = MG.trainers = {}, app = document.getElementById('app');
  T.speed = function () { return window.MG_TRAIN_MS || 1000; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var b = function (act, label, extra, cls) { return '<button data-act="' + act + '"' + (extra || '') + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>'; };
  var timer = null; T.stop = function () { clearTimeout(timer); timer = null; };
  T.menu = function (st) { var d = MG.decks.memory; return '<h1>Memory Trainers</h1><p class="doc">' + esc(d.note) + '</p><div class="grid">' +
    b('start', 'Spaced recall<small>Research cards with Leitner boxes</small>', ' data-deck="memory"') +
    b('palace', 'Memory palace<small>Best: ' + (st.best.palace || 0) + ' of 8</small>') +
    b('span', 'Digit span<small>Best: ' + (st.best.span || 0) + ' digits</small>') +
    b('nback', '2-back<small>Best: ' + (st.best.nback || 0) + '%</small>') +
    b('cards', 'Research notes and sources', ' data-deck="memory"') + '</div>' + b('home', 'Back', '', 'back'); };
  // Digit span
  T.span = { len: 3, strikes: 0, cur: '', typed: '' };
  T.spanStart = function (st, r) { var S = T.span; S.cur = E.digits(r, S.len); S.typed = ''; var i = 0;
    app.innerHTML = '<h1>Digit span</h1><p>Watch the digits, then type them in order. Length: ' + S.len + '</p><div class="card big" id="flash">Get ready</div>';
    (function tick() { var f = document.getElementById('flash'); if (!f) return; if (i < S.cur.length) { f.textContent = S.cur[i++]; timer = setTimeout(function () { f.textContent = ''; timer = setTimeout(tick, 200); }, T.speed()); } else T.spanPad(); })(); };
  T.spanPad = function () { var S = T.span; app.innerHTML = '<h1>Digit span</h1><p>Type the ' + S.len + ' digits.</p><div class="card big" id="typed">' + (esc(S.typed) || '&nbsp;') + '</div><div class="pad">' + '1234567890'.split('').map(function (d) { return b('digit', d, ' data-d="' + d + '"'); }).join('') + b('undo', 'Delete') + b('spandone', 'Done') + '</div>' + b('memory', 'Quit', '', 'back'); };
  T.spanCheck = function (st) { var S = T.span, ok = S.typed === S.cur, msg; if (ok) { st.best.span = Math.max(st.best.span || 0, S.len); S.strikes = 0; } else S.strikes++;
    msg = ok ? 'Right! ' + S.len + ' digits.' : 'It was ' + S.cur + '.'; S.len = E.spanNext(S.len, ok);
    var end = S.strikes >= 2; if (end) { S.len = 3; S.strikes = 0; }
    app.innerHTML = '<h1>Digit span</h1><div class="card"><h2 id="spanres">' + esc(msg) + '</h2><p>' + (end ? 'Two misses in a row. Round over. Best: ' + (st.best.span || 0) + ' digits.' : 'Next length: ' + S.len) + '</p><p class="doc">Tip: group digits in chunks of 3, like a phone number. Research: practice raises digit span, but mostly for digits (Ericsson, Chase and Faloon, 1980).</p></div>' + (end ? '' : b('span', 'Next')) + b('memory', 'Back', '', 'back'); };
  // 2-back
  T.nb = null;
  T.nbStart = function (r) { var seq = E.nback(r, 2, 20, 0.3); T.nb = { seq: seq, i: -1, taps: [] }; app.innerHTML = '<h1>2-back</h1><p>Tap Match when the letter is the same as the one 2 letters back.</p><div class="card big" id="nbl">Ready</div>' + b('nbmatch', 'Match') + '<p id="nbpos"></p>' + b('memory', 'Quit', '', 'back');
    (function step() { var N = T.nb, el = document.getElementById('nbl'); if (!el || !N) return; N.i++; if (N.i >= N.seq.length) return T.nbEnd(); el.textContent = N.seq[N.i]; document.getElementById('nbpos').textContent = (N.i + 1) + ' of ' + N.seq.length; timer = setTimeout(step, T.speed() * 2); })(); };
  T.nbTap = function () { var N = T.nb; if (N && N.i >= 0 && N.taps.indexOf(N.i) < 0) { N.taps.push(N.i); var el = document.getElementById('nbl'); if (el) el.classList.add('tapped'); setTimeout(function () { if (el) el.classList.remove('tapped'); }, 200); } };
  T.nbEnd = function () { var st = MG.UI.state(), N = T.nb, sc = E.nbackScore(N.seq, 2, N.taps); st.best.nback = Math.max(st.best.nback || 0, sc.pct); MG.UI.save();
    app.innerHTML = '<h1>2-back</h1><div class="card"><h2 id="nbres">Score ' + sc.pct + '%</h2><p>Hits ' + sc.hits + ', missed ' + sc.misses + ', false taps ' + sc.falseAlarms + '.</p><p class="doc">Honest note: n-back practice makes you better at n-back and similar tasks. Reviews (Melby-Lervag and Hulme, 2013) found no convincing gains in general intelligence.</p></div>' + b('nback', 'Play again') + b('memory', 'Back', '', 'back'); };
  // Memory palace
  T.pal = null;
  T.palStart = function (r) { T.pal = { pairs: E.palaceRound(r, MG.palace), i: 0, right: 0, r: r };
    app.innerHTML = '<h1>Memory palace</h1><p>Walk through a home in your mind. Picture each item at its place in a silly, vivid way (eggs cracking on the front door). Study the list, then tap Ready.</p>' + T.pal.pairs.map(function (p, i) { return '<div class="card">' + (i + 1) + '. <b>' + esc(p.place) + '</b>: ' + esc(p.item) + '</div>'; }).join('') + b('palready', 'Ready') + b('memory', 'Back', '', 'back'); };
  T.palAsk = function () { var P = T.pal, p = P.pairs[P.i], others = E.shuffle(P.pairs.filter(function (x) { return x !== p; }), P.r).slice(0, 2).map(function (x) { return x.item; }), ch = E.shuffle([p.item].concat(others), P.r);
    app.innerHTML = '<h1>Memory palace</h1><p>Place ' + (P.i + 1) + ' of ' + P.pairs.length + '</p><div class="card big">' + esc(p.place) + '</div><p>What did you put here?</p>' + ch.map(function (c) { return b('palpick', esc(c), ' data-v="' + esc(c) + '"'); }).join('') + b('memory', 'Quit', '', 'back'); };
  T.palPick = function (v) { var st = MG.UI.state(), P = T.pal; if (v === P.pairs[P.i].item) P.right++; P.i++; if (P.i < P.pairs.length) return T.palAsk();
    st.best.palace = Math.max(st.best.palace || 0, P.right); MG.UI.save();
    app.innerHTML = '<h1>Memory palace</h1><div class="card"><h2 id="palres">' + P.right + ' of ' + P.pairs.length + '</h2><p class="doc">Research: ordinary people trained in the method of loci for 40 days more than doubled their recall of word lists (Dresler and others, 2017).</p></div>' + b('palace', 'Play again') + b('memory', 'Back', '', 'back'); };
})();
