// Choosy catalogs registry.
// Each catalog is a static JSON file (built by the manual console extractor).
// To add a pool: drop the JSON in this folder and require() it here.
// require() with a static path is bundled reliably by Vercel.

module.exports = [
  require('./terminalx-boy-0-2-tops.json')
];
