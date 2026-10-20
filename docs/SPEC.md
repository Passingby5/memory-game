# Memory Game: Design Spec (v1)

For Tom Flinch and family. Phone-first web game that teaches real, sourced facts. Plain words, no em-dashes, family friendly.

## Architecture (copied from Life Skills Academy)
- Single-file PWA. `node build.js` checks decks, then concatenates `src/` into `site/index.html` plus `sw.js`, `version.json`, `manifest.webmanifest`, icons.
- Service worker is network-first for the page and version.json, so new versions load right away; the cache is only the offline fallback. The page polls version.json and reloads (after saving) when the build id changes.
- Visible version label on home: `vN - Mon D - commit` (example `v1 - Oct 20 - 6e94e0f`).
- Data decks live in `src/decks/*.js` (data only). Logic lives in `src/engine.js`. UI in `src/ui/`.
- Seeded RNG (xorshift) for all shuffles so tests repeat. Leitner spaced repetition (5 boxes, intervals 0, 1, 3, 7, 14 days).
- Save in localStorage key `mg_save` with a version number; older saves migrate, broken or unknown saves start fresh.
- Taps debounced (350 ms) and each question locks after the first answer.
- Layout tested at 390x844 portrait and 844x390 landscape. All buttons and links at least 48x48 px. No sideways scroll.
- `tools/checkdecks.js` is the answer-tell checker (port of the idea in life-skills-academy tools/checkdecks.js and tools/tellqa.js). It fails the build if any surface rule picks the right answer over 45% of the time (chance is 33%).
- Single-file test copy: `MG_SINGLE=/workspace/memory-game-test.html node build.js`.
- Git is local only. No push until Tom's GitHub account is cleared. Never force-push.

## Sections
1. **History.** Real, sourced events of seizing power and uprisings: leaders, tactics, brutality told without gore. Regions: North America, China, Europe, Middle East, Vietnam. Vietnam set is about Vietnam itself and how neighbors shaped it: about 1000 years of Chinese rule, French colonial rule, Japan in WWII, the US war, the Khmer Rouge border war, the 1979 China war. Neighbors only as they affected Vietnam. Plus a Bible timeline set where Bible narratives line up with recorded history and later empires (Roman, French, Russian, British, Ottoman).
2. **Herbs.** From Tom's spreadsheet, cross-checked with independent monographs (MSK About Herbs, NCCIH, well-known herbalists). Each herb: uses, how used, warnings and toxicity, monograph links. About 20 common Chinese herbs with hot/cold nature and adaptogens. Body system primer and how one problem affects the whole body. Symptom to herb lookup. Herbs with a high chance of being wrong or poisonous are left out and listed with the reason. Every herb shows a talk-to-a-doctor note.
3. **Memory Trainers.** Spaced recall, memory palace (method of loci), digit span, n-back. Honest research notes: training mostly improves the trained task (near transfer); broad IQ gains are not well supported.
4. **Survival Science.** Water: settling, sand/gravel/charcoal and biosand filters, coagulation with alum or moringa seed, SODIS, chlorine, boiling, with honest safety levels (filtering alone does not make sewage water safe). Wood-ash lye and soap steps, rendering and pressing oil, salt, vinegar, charcoal. Seed saving and storage, drying, salting, smoking, fermenting. Basic reactions, physics, calculations. Dangerous reactions are taught only as recognize and avoid; no weapon or poison steps. Worldwide sources.
5. **Truth or Lies.** Claims where people's views differ but one fact-based answer is true, with sources.
6. **GRE Vocab.** English word with Vietnamese meaning. After the final choice, the correct word is shown filled into the sentence.

## Acceptance checklist (numbered, testable)
Shell and platform
1. `npm test` runs the deck checker, unit tests, build, Playwright click-through and single-file test; all pass.
2. Home shows a version label matching `version.json` in the form `vN - Mon D - commit`.
3. Home lists all 6 sections; unbuilt ones say coming soon when tapped.
4. 390x844 and 844x390: no sideways scroll; every visible button and link is at least 48x48 px.
5. No console errors or warnings during the click-through.
6. A double tap on an answer is graded once.
7. Reloading mid-session shows Resume and returns to the same question.
8. Save has a version number; a v1 save migrates and a broken save starts fresh.
9. The same seed gives the same question order and choices.
10. Service worker serves the page network-first; a new build id triggers a save and reload.
11. `/workspace/memory-game-test.html` opens from file:// and plays with no errors.
12. No em-dashes in any source, deck or doc file.
13. About page lists sources for every live section.
14. Data decks hold no game logic; engine holds no content.
15. Deck checker fails the build if any surface rule picks the answer over 45%, if a clue names its answer, or if a card lacks a source.

Herbs
16. At least 50 herb cards, each with uses, how, warning, body system, symptoms and at least one https monograph link.
17. At least 20 Chinese herbs with pinyin name and hot/warm/neutral/cool/cold nature; adaptogens explained.
18. Every herb screen shows the talk-to-a-doctor note and the warning box.
19. Symptom lookup: picking a symptom (example nausea) lists matching herbs (Ginger).
20. Body systems page covers 12 systems with how one problem affects others, and lists herbs per system.
21. Left-out herbs page lists each dropped herb with reason and source.
22. Practice uses Leitner boxes: right moves up a box, wrong goes back to box 1, missed cards come first.
23. Clues that say Chinese or adaptogen only offer Chinese herbs as choices.
24. Each herb is cross-checked against Tom's spreadsheet (PENDING: sheet not yet readable from the build box).

History
25. At least 40 cards per region set (North America, China, Europe, Middle East, Vietnam) and a Bible timeline set; each card has a date and at least one credible source.
26. Vietnam cards cover all six eras listed above; neighbor history appears only where it affected Vietnam.
27. No graphic gore; brutality described in plain factual terms.
28. Bible timeline marks which points have outside records (example: Tel Dan stele, Cyrus Cylinder, Pilate stone) and which do not.

Memory Trainers
29. Digit span, n-back, memory palace and spaced recall each playable on a phone with scores saved.
30. Each trainer shows an honest research note with citation, stating near transfer.

Survival Science
31. Water lessons show a safety level for each method and state which steps are needed to make sewage-grade water drinkable.
32. Soap, oil, salt, vinegar, charcoal, seed saving and food keeping lessons cite at least one source each (example: WHO, CAWST, FAO, university extension).
33. Dangerous reactions appear only as recognize/avoid cards; a checker blocks step-by-step weapon or poison content.

Truth or Lies
34. Each claim has one fact-based answer, a short why, and a source; the checker passes the tell gate.

GRE Vocab
35. Each word has English definition, Vietnamese meaning and an example sentence.
36. After the final pick, the sentence is shown with the correct word filled in.

## Herbs data notes
- Fields: id, name, latin, pinyin, nature, system, uses, how, caution, symptoms, src.
- Sources checked by HTTP 200 on Oct 20, 2026: mskcc.org About Herbs pages and nccih.nih.gov fact sheets.
- Dropped on purpose: ephedra, aristolochia, comfrey by mouth, unprocessed butterbur, kava.
