# Builds a src/decks/*.js data file from pipe-separated source text in tools/content (one card per line):
# set|question|answer|wrong1|wrong2|why|sources (space separated)|[extra fields...]
# Source shorthand: B:x = britannica.com/x, A:x = archives.gov/milestone-documents/x, S:x = history.state.gov/milestones/x.
import json, sys, glob
PRE = {'B:': 'https://www.britannica.com/', 'A:': 'https://www.archives.gov/milestone-documents/', 'S:': 'https://history.state.gov/milestones/'}
def url(u):
    for k, v in PRE.items():
        if u.startswith(k): return v + u[len(k):]
    return u
def load(files):
    out = []
    for f in files:
        for ln, line in enumerate(open(f, encoding='utf8'), 1):
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'): continue
            p = line.split('|')
            assert len(p) >= 7, (f, ln, line)
            out.append(p[:6] + [[url(u) for u in p[6].split()]] + p[7:])
    return out

HEAD = {
 'history': (['h_na','h_cn','h_eu','h_me','h_vn','h_bi'], """// History deck data only. Generated from tools/content/h_*.txt by tools/gendeck.py (edit the text files, then run: python3 tools/gendeck.py).
// Each card: [set, question, answer, wrong1, wrong2, why, [source URLs], record, dates]. record and dates only for the Bible Timeline set.
// Sources: Encyclopaedia Britannica, US National Archives, US State Department Office of the Historian, Library of Congress, UNESCO,
// US Holocaust Memorial Museum, British Museum, British Library, Yale Avalon Project and others. No Wikipedia or wiki mirrors.
// Contested modern events give the main numbers and views from both sides, as in these sources.
var MG = typeof MG !== 'undefined' ? MG : {}; MG.decks = MG.decks || {};
(function () {
var C = [
""", """
];
MG.decks.history = { id: 'history', title: 'History', min: 300, note: 'Real events of the last 1,000 years, told plainly without gore. Each card links to its sources (Britannica, national archives, the State Department historian, museums). No Wikipedia.',
  sets: SETS,
  setNotes: { 'Vietnam': 'Vietnam itself, and how its neighbors shaped it: Chinese rule and wars with China, the Mongols, Champa and Siam, French colonial rule, Japan in World War II, the US war, the Khmer Rouge, the 1979 war with China, and Doi Moi.', 'Bible Timeline': 'Places where Bible accounts line up with records found outside the Bible, and later empires (Roman, Muslim caliphs, Crusaders, Ottoman, French, Russian, British) in the Holy Land.' },
  cards: C.map(function (b) { var id = b[0], a = b.slice(1), c = { id: 'h' + id, set: a[0], q: a[1], a: a[2], w: [a[3], a[4]], why: a[5], src: a[6] }; if (a[7]) { c.record = a[7]; c.dates = a[8]; } return c; }) };
})();
if (typeof module !== 'undefined') module.exports = MG;
"""),
 'survival': (['s_water','s_san','s_sup','s_chem','s_food','s_power'], """// Survival science and town-building deck data only. Generated from tools/content/s_*.txt by tools/gendeck.py.
// [set, question, answer, wrong1, wrong2, why, [sources], water safety level (water cards only)].
// Sources: CDC, EPA, WHO, USGS, OSHA, NFPA, USDA and the National Center for Home Food Preservation, SODIS (Eawag), CAWST,
// Seed Savers Exchange, US Department of Energy, FHWA, Portland Cement Association, Encyclopaedia Britannica. No wiki sources.
// Dangerous chemistry appears only as recognize-and-avoid safety cards. No weapon or poison steps.
var MG = typeof MG !== 'undefined' ? MG : {}; MG.decks = MG.decks || {};
(function () {
var C = [
""", """
];
MG.decks.survival = { id: 'survival', title: 'Survival Science', min: 200, note: 'Practical chemistry, physics and engineering for daily life and rebuilding a town, from methods used worldwide. Safety levels are honest. Dangerous reactions are taught only as recognize and avoid.',
  sets: SETS,
  setNotes: { 'Water Treatment': 'Honest safety levels: settling and alum or moringa only clear water. Filters reduce germs. Boiling, chlorine or full SODIS disinfect. No home method removes chemical pollution.' },
  cards: C.map(function (b) { var a = b.slice(1), c = { id: 's' + b[0], set: a[0], q: a[1], a: a[2], w: [a[3], a[4]], why: a[5], src: a[6] }; if (a[7]) c.level = a[7]; return c; }) };
})();
if (typeof module !== 'undefined') module.exports = MG;
"""),
'truth': (['t_sci','t_body','t_ani','t_hist','t_misc'], """// Truth or Lies deck data only. Popular beliefs vs. the fact-based answer. Generated from tools/content/t_*.txt by tools/gendeck.py.
// [topic, question, true answer, myth1, myth2, why, [sources]]. Sources: Britannica, NASA, NOAA, USGS, CDC, FDA, USDA, NIH/PubMed studies,
// National Park Service, Smithsonian, Library of Congress, National Archives, Mayo Clinic and others. No Wikipedia or wiki mirrors.
var MG = typeof MG !== 'undefined' ? MG : {}; MG.decks = MG.decks || {};
(function () {
var C = [
""", """
];
MG.decks.truth = { id: 'truth', title: 'Truth or Lies', min: 250, note: 'Things many people believe, and what the facts show. Pick the true answer.',
  sets: ['Science', 'Body', 'Health', 'Animals', 'History', 'Earth', 'Space', 'Food', 'Books'],
  cards: C.map(function (b) { var a = b.slice(1); return { id: 't' + b[0], set: a[0], q: a[1], a: a[2], w: [a[3], a[4]], why: a[5], src: a[6] }; }) };
})();
if (typeof module !== 'undefined') module.exports = MG;
"""),
}
import os
D = os.path.dirname(os.path.abspath(__file__))
def build(name):
    files, head, tail = HEAD[name]
    rows = load([os.path.join(D, 'content', f + '.txt') for f in files])
    sets = []
    for r in rows:
        if r[0] not in sets: sets.append(r[0])
    # Stable card ids (v11): tools/content/ids.json maps question text -> id number, so adding or removing cards never renumbers
    # others and saved progress stays on the same question. New questions get the next unused number. Reworded questions: edit the key.
    idf = os.path.join(D, 'content', 'ids.json'); ids = json.load(open(idf)) if os.path.exists(idf) else {}
    m = ids.setdefault(name, {}); nxt = max([0] + list(m.values())) + 1
    for r in rows:
        if r[1] not in m: m[r[1]] = nxt; nxt += 1
        r.insert(0, m[r[1]])
    json.dump(ids, open(idf, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
    body = ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)
    open(os.path.join(D, '..', 'src', 'decks', name + '.js'), 'w', encoding='utf8').write(head + body + tail.replace('SETS', json.dumps(sets)))
    print(name, len(rows))
if __name__ == '__main__':
    for n in (sys.argv[1:] or list(HEAD)): build(n)
