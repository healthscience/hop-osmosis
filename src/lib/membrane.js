// hop-osmosis/lib/membrane.js
export function evaluateManifest(manifest, currentBudget) {
  console.log(`[osmosis] Manifest Size: ${manifest.totalBytes}, Cost: ${manifest.energyCost}`);
  return manifest.energyCost <= currentBudget;
}

export function filterCues(cues, datatypeRegex) {
  return cues.filter(cue => datatypeRegex.test(cue.datatype));
}