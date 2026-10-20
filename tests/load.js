// Loads the browser scripts into one shared context for Node tests and tools.
const vm = require('vm'), fs = require('fs'), path = require('path');
exports.ORDER = ['sections.js', 'decks/herbs.js', 'decks/history.js', 'engine.js'];
exports.load = () => { const ctx = { module: undefined }; vm.createContext(ctx); exports.ORDER.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx, { filename: f })); return ctx.MG; };
