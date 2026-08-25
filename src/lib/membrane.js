// hop-osmosis/lib/membrane.js

export function evaluateManifest(manifest, currentBudget) {
  if (!manifest) return false;

  const totalBytes = manifest.totalBytes || manifest.size || 0;
  const energyCost = manifest.energyCost ?? 0;
  const budget = typeof currentBudget === 'number' ? currentBudget : Infinity;

  console.log(`[osmosis] Manifest Size: ${totalBytes} bytes, Cost: ${energyCost} (Available Budget: ${budget})`);
  return energyCost <= budget;
}

export function filterCues(cues, datatypeRegex) {
  if (!Array.isArray(cues)) return [];
  if (!datatypeRegex) return [...cues];

  // Safely handle string patterns passed from network targets
  const regex = typeof datatypeRegex === 'string' ? new RegExp(datatypeRegex) : datatypeRegex;

  return cues.filter(cue => {
    const targetType = cue?.datatype || cue?.type || '';
    return regex.test(targetType);
  });
}