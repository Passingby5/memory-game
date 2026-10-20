// Home screen section list (data only).
var MG = typeof MG !== 'undefined' ? MG : {};
MG.SECTIONS = [
  { id: 'herbs', title: 'Herbs', blurb: 'Dr. Patrick Jones herbs and formulas, Chinese hot and cold, symptom lookup', ready: true },
  { id: 'history', title: 'History', blurb: 'Uprisings, leaders and empires; Vietnam; Bible timeline', ready: true },
  { id: 'memory', title: 'Memory Trainers', blurb: 'Spaced recall, memory palace, digit span, n-back', ready: false },
  { id: 'survival', title: 'Survival Science', blurb: 'Clean water, soap, food keeping, basic chemistry', ready: false },
  { id: 'truth', title: 'Truth or Lies', blurb: 'Claims people argue about, with the facts', ready: false },
  { id: 'vocab', title: 'GRE Vocab', blurb: 'English and Vietnamese word practice', ready: false }
];
if (typeof module !== 'undefined') module.exports = MG;
