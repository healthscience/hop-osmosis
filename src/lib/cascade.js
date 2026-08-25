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
  const syncQueue = new Map(); // Use Map to deduplicate shared paths

  // 1. Scan matched cues for exoCue reference contracts
  for (const cue of filteredCues) {
    if (cue.type === 'exoCue' && cue.referenceContract) {
      const { orgoPath, gellePath } = cue.referenceContract;
      
      // Queue paths if they exist
      if (orgoPath) {
        syncQueue.set(orgoPath, 'orgo');
      }
      if (gellePath) {
        syncQueue.set(gellePath, 'gelle');
      }
    }
  }

  // If nothing to cascade, resolve immediately
  if (syncQueue.size === 0) {
    console.log(`[osmosis:cascade] No external Hyperdrive paths to replicate.`);
    return;
  }

  console.log(`[osmosis:cascade] Enforcing deep replication for ${syncQueue.size} Hyperdrive path(s).`);

  // 2. Execute parallel atomic sync via the peer connection
  const syncPromises = [];
  
  for (const [path, type] of syncQueue.entries()) {
    console.log(`[osmosis:cascade] Queueing ${type} data sync from path: ${path}`);
    
    // Call the underlying network layer to replicate the hyperdrive/corestore key
    const syncAction = peer.syncHyperdrivePath(path).catch(err => {
      console.error(`[osmosis:cascade] Failed to replicate ${type} path ${path}:`, err.message);
      // Throwing here breaks the Promise.all, ensuring atomicity 
      // (we don't pass broken knowledge to the physics engine)
      throw err; 
    });
    
    syncPromises.push(syncAction);
  }

  // 3. Await full atomic completion
  await Promise.all(syncPromises);
  
  console.log(`[osmosis:cascade] Atomic replication of overlay-data complete.`);
}