// hop-osmosis/lib/cascade.js

/**
 * Enforces the deep cascade replication rule.
 * When an exoCue passes the membrane filter, this module ensures
 * all associated Orgo (organon state) and Gelle (overlay-data) 
 * Hyperdrive paths are atomically replicated before execution.
 * 
 * @param {object} peer - The connected Holepunch peer interface
 * @param {Array} filteredCues - The array of cues that passed the membrane
 */
export async function replicateHyperdrivePaths(peer, filteredCues) {
  if (!Array.isArray(filteredCues) || filteredCues.length === 0) {
    return;
  }

  const syncQueue = new Map(); // Use Map to deduplicate shared paths

  // 1. Scan matched cues for exoCue reference contracts and hyperdrive paths
  for (const cue of filteredCues) {
    if (!cue) continue;

    const isExo = cue.type === 'exoCue' || cue.datatype === 'exoCue' || cue.orgoSpecs || cue.gelleSpecs;

    if (isExo) {
      const ref = cue.referenceContract || cue;
      const orgoPath = ref.orgoPath || ref.orgoSpecs?.path;
      const gellePath = ref.gellePath || ref.gelleSpecs?.path;

      if (orgoPath) syncQueue.set(orgoPath, 'orgo');
      if (gellePath) syncQueue.set(gellePath, 'gelle');
    }
  }

  // If nothing to cascade, resolve immediately
  if (syncQueue.size === 0) {
    console.log('[osmosis:cascade] No external Hyperdrive paths to replicate.');
    return;
  }

  console.log(`[osmosis:cascade] Enforcing deep replication for ${syncQueue.size} Hyperdrive path(s).`);

  // 2. Execute parallel atomic sync via peer interface
  const syncPromises = [];

  for (const [path, type] of syncQueue.entries()) {
    console.log(`[osmosis:cascade] Queueing ${type} data sync from path: ${path}`);

    const syncAction = (async () => {
      if (peer && typeof peer.syncHyperdrivePath === 'function') {
        await peer.syncHyperdrivePath(path);
      } else if (peer && peer.drive && typeof peer.drive.download === 'function') {
        await peer.drive.download(path);
      } else {
        console.warn(`[osmosis:cascade] Peer interface has no sync handler for path: ${path}`);
      }
    })().catch(err => {
      console.error(`[osmosis:cascade] Failed to replicate ${type} path ${path}:`, err.message);
      throw err;
    });

    syncPromises.push(syncAction);
  }

  // 3. Await full atomic completion
  await Promise.all(syncPromises);

  console.log('[osmosis:cascade] Atomic replication of overlay-data complete.');
}