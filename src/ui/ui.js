// UI: screens, debounced taps, save/resume. Reads decks from MG.decks and logic from MG.E.
(function () {
  var E = MG.E, D = MG.decks.herbs, app = document.getElementById('app'), st, lastTap = 0, lastAct = '', q = null;
  function load() { try { st = E.migrate(localStorage.getItem(E.SAVE_KEY)); } catch (e) { st = E.newState(); } }
  function save() { try { localStorage.setItem(E.SAVE_KEY, JSON.stringify(st)); } catch (e) { } }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var btn = function (act, label, extra, cls) { return '<button data-act="' + act + '"' + (extra || '') + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>'; };
  var back = function (to) { return btn(to || 'home', 'Back', '', 'back'); };
  function srcs(c) { return '<div class="src">' + c.src.map(function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + esc(u.replace('https://www.', '')) + '</a>'; }).join('<br>') + '</div>'; }
  function herbCard(c) { return '<div class="card"><h2>' + esc(c.name) + '</h2><p><i>' + esc(c.latin) + '</i>' + (c.pinyin ? ' | ' + esc(c.pinyin) + (c.nature ? ' (' + c.nature + ')' : '') : '') + '</p><p><b>Body system:</b> ' + esc(c.system) + '</p><p><b>Uses:</b> ' + esc(c.uses) + '</p><p><b>How:</b> ' + esc(c.how) + '</p><div class="warn"><b>Warning:</b> ' + esc(c.caution) + '</div><p class="doc">' + esc(D.doctor) + '</p><p><b>Monographs:</b></p>' + srcs(c) + '</div>'; }
  var S = {
    home: function () { return '<h1>Memory Game</h1><p class="ver" id="ver">' + esc(MG_BUILD.label) + '</p>' + (st.session ? btn('resume', 'Resume ' + esc(MG.decks[st.session.deck || 'herbs'].title) + ' practice<small>Question ' + (st.session.i + 1) + ' of ' + st.session.ids.length + '</small>') : '') + '<div class="grid">' + MG.SECTIONS.map(function (s) { return s.ready ? btn('sec', s.title + '<small>' + s.blurb + '</small>', ' data-id="' + s.id + '"') : btn('soon', s.title + ' (coming soon)<small>' + s.blurb + '</small>', ' data-id="' + s.id + '"', 'soon'); }).join('') + '</div>' + btn('about', 'About and sources'); },
    herbs: function () { var due = E.dueCards(st, D.cards, Date.now()).length; return '<h1>Herbs</h1><p>' + D.cards.length + ' herbs. ' + due + ' due for practice. Right ' + st.stats.right + ', wrong ' + st.stats.wrong + '.</p><p class="doc">' + esc(D.doctor) + '</p><div class="grid">' + btn('start', 'Practice (spaced recall)<small>10 questions, missed herbs come back sooner</small>', ' data-deck="herbs"') + btn('lookup', 'Symptom lookup<small>Pick a problem, see herbs used for it</small>') + btn('browse', 'Browse all herbs<small>' + D.cards.filter(function (c) { return c.set === 'jones'; }).length + ' Dr. Jones herbs plus Chinese herbs</small>') + btn('formulas', 'Dr. Jones combo formulas<small>What goes in each, in our own words</small>') + btn('chinese', 'Chinese herbs: hot and cold') + btn('body', 'Body systems<small>How one problem affects the whole body</small>') + btn('dropped', 'Herbs left out and why') + '</div>' + back(); },
    quiz: function () { var s = st.session; q = s.q; return '<p>Question ' + (s.i + 1) + ' of ' + s.ids.length + '</p><div class="card"><p id="prompt">' + esc(q.prompt) + '</p></div>' + q.choices.map(function (c, i) { return btn('pick', esc(c), ' data-i="' + i + '"'); }).join('') + btn('deck', 'Back', ' data-id="' + ((st.session && st.session.deck) || 'herbs') + '"', 'back'); },
    lookup: function () { return '<h1>Symptom lookup</h1><div class="grid">' + E.allSymptoms(D.cards).map(function (s) { return btn('sym', esc(s), ' data-s="' + esc(s) + '"'); }).join('') + '</div>' + back('herbs'); },
    browse: function () { return '<h1>All herbs</h1><div class="grid">' + D.cards.map(function (c) { return btn('herb', esc(c.name) + '<small>' + esc(c.system) + '</small>', ' data-id="' + c.id + '"'); }).join('') + '</div>' + back('herbs'); },
    chinese: function () { var order = ['hot', 'warm', 'neutral', 'cool', 'cold']; return '<h1>Chinese hot and cold</h1><p>Traditional Chinese medicine sorts herbs by "temperature". Warm herbs are used for cold signs (chills, pale, tired); cool herbs for heat signs (fever, redness, thirst). Adaptogens like ginseng, rhodiola, eleuthero and schisandra are said to help the body handle stress.</p>' + order.map(function (n) { var l = D.cards.filter(function (c) { return c.nature === n; }); return '<div class="card"><b>' + n + ':</b> ' + l.map(function (c) { return esc(c.name) + ' (' + esc(c.pinyin) + ')'; }).join(', ') + '</div>'; }).join('') + back('herbs'); },
    body: function () { return '<h1>Body systems</h1><p>The body works as one. A problem in one system pulls on the others.</p>' + MG.bodySystems.map(function (b) { var l = D.cards.filter(function (c) { return c.system === b[0]; }); return '<div class="card"><b>' + b[0] + '</b><p>' + esc(b[1]) + '</p><p><i>Herbs here:</i> ' + l.map(function (c) { return esc(c.name); }).join(', ') + '</p></div>'; }).join('') + back('herbs'); },
    formulas: function () { return '<h1>Combo formulas</h1><p>Dr. Patrick Jones (HomeGrown Herbalist) sells these blends. Below is what each is for and what is in it. Herbs we left out for safety are marked.</p>' + D.formulas.map(function (f) { return '<div class="card"><b>' + esc(f.name) + '</b><p>For: ' + esc(f.for) + '</p><p>Herbs: ' + f.herbs.map(function (h) { var out = D.dropped.some(function (d) { return d.name.toLowerCase().indexOf(h.toLowerCase()) === 0; }); return esc(h) + (out ? ' (left out, see list)' : ''); }).join(', ') + '</p>' + srcs({ src: [f.url] }) + '</div>'; }).join('') + back('herbs'); },
    dropped: function () { return '<h1>Left out on purpose</h1>' + D.dropped.map(function (d) { return '<div class="card"><b>' + esc(d.name) + '</b><p>' + esc(d.why) + '</p>' + srcs({ src: [d.src] }) + '</div>'; }).join('') + back('herbs'); },
    deck: function () { var d = MG.decks[curDeck], due = E.dueCards(st, d.cards, Date.now()).length; return '<h1>' + esc(d.title) + '</h1><p>' + d.cards.length + ' cards. ' + due + ' due for practice.</p><p class="doc">' + esc(d.note) + '</p><div class="grid">' + btn('start', 'Practice all (spaced recall)<small>10 questions, missed cards come back sooner</small>', ' data-deck="' + d.id + '"') + d.sets.map(function (x) { var n = d.cards.filter(function (c) { return c.set === x; }).length; return btn('start', 'Practice: ' + esc(x) + '<small>' + n + ' cards' + (d.setNotes && d.setNotes[x] ? '. ' + esc(d.setNotes[x]) : '') + '</small>', ' data-deck="' + d.id + '" data-set="' + esc(x) + '"'); }).join('') + btn('cards', 'Browse all cards and sources', ' data-deck="' + d.id + '"') + '</div>' + back(); },
    cards: function () { var d = MG.decks[curDeck]; return '<h1>' + esc(d.title) + ' cards</h1>' + d.sets.map(function (x) { return '<h2>' + esc(x) + '</h2>' + d.cards.filter(function (c) { return c.set === x; }).map(function (c) { return '<div class="card"><p>' + esc(c.q) + '</p><p><b>' + esc(c.a) + '</b></p><p>' + esc(c.why) + '</p>' + srcs(c) + '</div>'; }).join(''); }).join('') + btn('deck', 'Back', ' data-id="' + d.id + '"', 'back'); },
    about: function () { return '<h1>About</h1><p>Memory Game is a family learning app. Herbs are the ones Dr. Patrick Jones (HomeGrown Herbalist) uses most in his formulas, cross-checked with Mrs. Grieve\'s A Modern Herbal, Memorial Sloan Kettering and NIH monographs for uses and warnings. Recommended books for deeper study: David Hoffmann, Medical Herbalism (2003); Rosemary Gladstar, Medicinal Herbs: A Beginner\'s Guide (2012); Matthew Wood, The Earthwise Herbal (2008); Bone and Mills, Principles and Practice of Phytotherapy (2013). Nothing here is medical advice.</p><h2>Herb sources</h2>' + MG.herbSources.map(function (s) { return '<div class="card">' + esc(s[0]) + srcs({ src: [s[1]] }) + '</div>'; }).join('') + '<p>Practice uses the Leitner box method of spaced repetition (Leitner, 1972; review in Cepeda et al., 2006, Psychological Bulletin).</p><p class="ver">' + esc(MG_BUILD.label) + '</p>' + back(); }
  };
  var cur = 'home', extra = '', curDeck = 'herbs';
  function show(n, html) { cur = n; app.innerHTML = html || S[n](); window.scrollTo(0, 0); }
  function startSession(deck, set) { var all = MG.decks[deck].cards.filter(function (c) { return !set || c.set === set; }), r = E.rng(st.seed++), due = E.dueCards(st, all, Date.now()); if (due.length < 10) due = due.concat(E.shuffle(all.filter(function (c) { return due.indexOf(c) < 0; }), r)); var ids = due.slice(0, 10).map(function (c) { return c.id; }); st.session = { deck: deck, ids: ids, i: 0 }; st.session.q = mk(ids[0]); save(); show('quiz'); }
  function card(deck, id) { return MG.decks[deck].cards.filter(function (c) { return c.id === id; })[0]; }
  function mk(id) { var r = E.rng(st.seed++), dk = (st.session && st.session.deck) || 'herbs', c = card(dk, id); return dk === 'herbs' ? E.question(c, D.cards, r) : E.mcq(c, r); }
  app.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return; var a = b.getAttribute('data-act'), d = b.dataset, now = Date.now(); if (now - lastTap < (a === 'digit' ? 120 : 350) && (a === lastAct || a === 'pick' || a === 'next')) return; lastTap = now; lastAct = a;
    if (a === 'formulas' || a === 'home' || a === 'about' || a === 'herbs' || a === 'lookup' || a === 'browse' || a === 'chinese' || a === 'body' || a === 'dropped') return show(a);
    var Tr = MG.trainers; if (Tr && a !== 'digit' && a !== 'undo' && a !== 'nbmatch') Tr.stop();
    if (a === 'memory' || ((a === 'sec' || a === 'deck') && d.id === 'memory')) { cur = 'memory'; app.innerHTML = Tr.menu(st); window.scrollTo(0, 0); return; }
    if (a === 'span') { cur = 'span'; return Tr.spanStart(st, E.rng(st.seed++)); }
    if (a === 'digit') { if (Tr.span.typed.length < 30) Tr.span.typed += d.d; document.getElementById('typed').textContent = Tr.span.typed; return; }
    if (a === 'undo') { Tr.span.typed = Tr.span.typed.slice(0, -1); document.getElementById('typed').innerHTML = esc(Tr.span.typed) || '&nbsp;'; return; }
    if (a === 'spandone') { Tr.spanCheck(st); save(); return; }
    if (a === 'nback') { cur = 'nback'; return Tr.nbStart(E.rng(st.seed++)); }
    if (a === 'nbmatch') return Tr.nbTap();
    if (a === 'palace') { cur = 'palace'; return Tr.palStart(E.rng(st.seed++)); }
    if (a === 'palready') return Tr.palAsk();
    if (a === 'palpick') return Tr.palPick(d.v);
    if (a === 'sec' || a === 'deck') { if (MG.decks[d.id] && d.id !== 'herbs') { curDeck = d.id; return show('deck'); } return show(d.id); }
    if (a === 'cards') { curDeck = d.deck; return show('cards'); }
    if (a === 'soon') { b.querySelector('small').textContent = 'Coming soon. Being built and source checked now.'; return; }
    if (a === 'start') return startSession(d.deck || 'herbs', d.set);
    if (a === 'resume') { if (st.session.answered) return next(); return show('quiz'); }
    if (a === 'herb') return show('herb', herbCard(D.cards.filter(function (c) { return c.id === d.id; })[0]) + back('browse'));
    if (a === 'sym') return show('sym', '<h1>' + esc(d.s) + '</h1>' + E.lookup(D.cards, d.s).map(herbCard).join('') + back('lookup'));
    if (a === 'pick') {
      var s = st.session; if (!s || s.answered) return; var i = +d.i, ok = i === s.q.answer; s.answered = true;
      E.grade(st, s.q.id, ok, Date.now()); save();
      [].forEach.call(app.querySelectorAll('[data-act=pick]'), function (x, j) { x.disabled = true; if (j === s.q.answer) x.className = 'right'; else if (j === i) x.className = 'wrong'; });
      var dk = s.deck || 'herbs', c = card(dk, s.q.id), body = dk === 'herbs' ? herbCard(c) : (MG.fb && MG.fb[dk] ? MG.fb[dk](c, esc) : '') + '<div class="card"><p>' + esc(c.why) + '</p><p><b>Sources:</b></p>' + srcs(c) + '</div>';
      app.insertAdjacentHTML('beforeend', '<div id="fb"><h2>' + (ok ? 'Right!' : 'Not quite. It is ' + esc(c.name || c.a) + '.') + '</h2>' + body + btn('next', s.i + 1 < s.ids.length ? 'Next question' : 'Finish') + '</div>');
      return;
    }
    if (a === 'next') return next();
  });
  function next() { var s2 = st.session; s2.answered = false; s2.i++; if (s2.i >= s2.ids.length) { st.session = null; save(); return show('done', '<h1>Done!</h1><p>Right ' + st.stats.right + ', wrong ' + st.stats.wrong + ' all time. Missed cards come back first next time.</p>' + btn('deck', 'Back to ' + esc(MG.decks[s2.deck || 'herbs'].title), ' data-id="' + (s2.deck || 'herbs') + '"')); } s2.q = mk(s2.ids[s2.i]); save(); return show('quiz'); }
  load(); show('home');
  MG.UI = { save: save, state: function () { return st; } };
})();
