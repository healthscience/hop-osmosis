// hop-osmosis/lib/cascade.js

/**
 * Enforces the deep cascade replication rule.
 * Replicates associated Hyperbee stores (metadata/index) and 
 * Hyperdrive paths (Orgo organon state / Gelle overlay data) 
 * atomically before execution.
 * 
 * @param {object} peer - The connected Holepunch peer interface
 * @param {Array} filteredCues - The array of cues that passed the membrane
 * @returns {Promise<object>} Summary of replicated keys, paths, and durations
 */
export async function replicateHyperdrivePaths(peer, filteredCues) {
  const startTime = Date.now();

  if (!Array.isArray(filteredCues) || filteredCues.length === 0) {
    console.warn('[osmosis:cascade:trace] Abort: filteredCues is empty or non-array.');
    return { syncedBees: [], syncedDrives: [], durationMs: 0 };
  }

  console.log(`[osmosis:cascade:trace] Inspecting ${filteredCues.length} cue(s) for hyper-resources...`);

  const driveQueue = new Map(); // Deduplicate Hyperdrive paths
  const beeQueue = new Map();   // Deduplicate Hyperbee keys/manifests

  // 1. Scan matched cues for Hyperdrive paths and Hyperbee keys
  filteredCues.forEach((cue, index) => {
    if (!cue) {
      console.warn(`[osmosis:cascade:trace] Cue at index ${index} is null or undefined.`);
      return;
    }

    const ref = cue.referenceContract || cue;

    // Extract Hyperdrive paths
    const orgoPath = ref.orgoPath || ref.orgoSpecs?.path;
    const gellePath = ref.gellePath || ref.gelleSpecs?.path;
    if (orgoPath) driveQueue.set(orgoPath, { type: 'orgo', cueIndex: index });
    if (gellePath) driveQueue.set(gellePath, { type: 'gelle', cueIndex: index });

    // Extract Hyperbee keys or public library manifests
    const beeKey = ref.beeKey || ref.publicLibraryKey || ref.beeSpecs?.key || cue.beeKey;
    if (beeKey) beeQueue.set(beeKey, { type: 'hyperbee', cueIndex: index });

    console.log(`[osmosis:cascade:trace] Cue [${index}] keys extracted -> beeKey: ${beeKey || 'none'} | orgoPath: ${orgoPath || 'none'} | gellePath: ${gellePath || 'none'}`);
  });

  if (driveQueue.size === 0 && beeQueue.size === 0) {
    console.warn('[osmosis:cascade:trace] No external Hyperdrive or Hyperbee resources extracted from cues.');
    return { syncedBees: [], syncedDrives: [], durationMs: Date.now() - startTime };
  }

  console.log(`[osmosis:cascade:trace] Enforcing atomic replication for ${beeQueue.size} Hyperbee(s) and ${driveQueue.size} Hyperdrive path(s).`);

  const syncPromises = [];
  const syncedBees = [];
  const syncedDrives = [];

  // 2. Queue Hyperbee replications
  for (const [beeKey, meta] of beeQueue.entries()) {
    const beeStart = Date.now();
    console.log(`[osmosis:cascade:trace] Syncing ${meta.type} [Key: ${beeKey}]`);

    const syncBee = (async () => {
      let dispatchedBranch = 'none';

      if (peer && typeof peer.syncHyperbee === 'function') {
        dispatchedBranch = 'peer.syncHyperbee()';
        await peer.syncHyperbee(beeKey);
      } else if (peer && typeof peer.replicatePublicLibrary === 'function') {
        dispatchedBranch = 'peer.replicatePublicLibrary()';
        await peer.replicatePublicLibrary(beeKey);
      } else if (peer && peer.hyperbee && typeof peer.hyperbee.update === 'function') {
        dispatchedBranch = 'peer.hyperbee.update()';
        await peer.hyperbee.update();
      } else {
        dispatchedBranch = 'UNHANDLED_FALLTHROUGH';
        console.warn(`[osmosis:cascade:trace] WARNING: Peer interface has no valid sync handler for Hyperbee key: ${beeKey}`);
      }

      const elapsed = Date.now() - beeStart;
      console.log(`[osmosis:cascade:trace] Completed ${meta.type} [Key: ${beeKey}] via ${dispatchedBranch} in ${elapsed}ms`);
      syncedBees.push({ key: beeKey, branch: dispatchedBranch, durationMs: elapsed });
    })().catch(err => {
      console.error(`[osmosis:cascade:trace] ERROR: Failed to replicate ${meta.type} key ${beeKey}:`, err.stack || err.message);
      throw err;
    });

    syncPromises.push(syncBee);
  }

  // 3. Queue Hyperdrive path replications
  for (const [drivePath, meta] of driveQueue.entries()) {
    const driveStart = Date.now();
    console.log(`[osmosis:cascade:trace] Syncing ${meta.type} [Path: ${drivePath}]`);

    const syncDrive = (async () => {
      let dispatchedBranch = 'none';

      if (peer && typeof peer.syncHyperdrivePath === 'function') {
        dispatchedBranch = 'peer.syncHyperdrivePath()';
        await peer.syncHyperdrivePath(drivePath);
      } else if (peer && peer.drive && typeof peer.drive.download === 'function') {
        dispatchedBranch = 'peer.drive.download()';
        await peer.drive.download(drivePath);
      } else {
        dispatchedBranch = 'UNHANDLED_FALLTHROUGH';
        console.warn(`[osmosis:cascade:trace] WARNING: Peer interface has no valid sync handler for path: ${drivePath}`);
      }

      const elapsed = Date.now() - driveStart;
      console.log(`[osmosis:cascade:trace] Completed ${meta.type} [Path: ${drivePath}] via ${dispatchedBranch} in ${elapsed}ms`);
      syncedDrives.push({ path: drivePath, branch: dispatchedBranch, durationMs: elapsed });
    })().catch(err => {
      console.error(`[osmosis:cascade:trace] ERROR: Failed to replicate ${meta.type} path ${drivePath}:`, err.stack || err.message);
      throw err;
    });

    syncPromises.push(syncDrive);
  }

  // 4. Await full atomic completion for both Bees and Drives
  await Promise.all(syncPromises);

  const totalDuration = Date.now() - startTime;
  console.log(`[osmosis:cascade:trace] Atomic replication complete in ${totalDuration}ms. (Bees: ${syncedBees.length}, Drives: ${syncedDrives.length})`);

  return {
    syncedBees,
    syncedDrives,
    durationMs: totalDuration
  };
}