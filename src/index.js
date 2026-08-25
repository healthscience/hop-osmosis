// hop-osmosis/index.js
import { resolveEntry } from './lib/resolver.js';
import { setupSwarmListener, joinTopicSwarm } from './lib/swarm.js';
import { evaluateManifest, filterCues } from './lib/membrane.js';
import { replicateHyperdrivePaths } from './lib/cascade.js';

export default function createOsmosisMembrane(networkOptions, localEnergyBudget) {
  return {
    // HOSTING: Peer A serves a bundle
    hostBundle: (rootHash, manifest, hyperdriveKeys, salt = null) => {
      return setupSwarmListener(networkOptions, rootHash, manifest, hyperdriveKeys, salt);
    },

    // INGESTING: Peer B or C pulls computational knowledge
    triggerOsmosis: async (inputString, seedLibrary) => {
      // 1. Parse input (hash, keyword, or Life-Strap extraction)
      const target = resolveEntry(inputString, seedLibrary);
      
      // 2. Connect to derived swarm topic (handles Heli Clock sliding / salts)
      const peer = await joinTopicSwarm(networkOptions, target);
      
      // 3. Request upfront manifest and evaluate energy budget
      const manifest = await peer.requestManifest();
      if (!evaluateManifest(manifest, localEnergyBudget)) {
        throw new Error('[osmosis] Abort: Bundle exceeds local energy budget.');
      }

      // 4. Filter cues via datatype regex
      const rawCues = await peer.fetchFilteredCues(target.datatypeRegex);
      const filteredCues = filterCues(rawCues, target.datatypeRegex);

      // 5. Atomic cascade replication for exoCues (orgo / gelle)
      await replicateHyperdrivePaths(peer, filteredCues);

      // Return the ordered array ready for hop-gradient sorting
      return filteredCues;
    }
  };
}