import { resolveEntry } from './lib/resolver.js';
import { setupSwarmListener, joinTopicSwarm } from './lib/swarm.js';
import { evaluateManifest, filterCues } from './lib/membrane.js';
import { replicateHyperdrivePaths } from './lib/cascade.js';

export default function createOsmosisMembrane(swarm, localEnergyBudget = 100, solarCycle = 0) {

  return {
    // Unbypassable ingress filter for incoming peer replication payloads
    filterIngress: async (libraryType, payload) => {
      if (!payload) return null;
      if (Array.isArray(payload)) {
        const filtered = payload.filter((item) => evaluateManifest(item?.manifest || item, localEnergyBudget));
        return filtered.length > 0 ? filtered : null;
      }
      return evaluateManifest(payload?.manifest || payload, localEnergyBudget) ? payload : null;
    },

    // HOSTING: Peer A serves a bundle on a derived topic
    hostBundle: (rootHash, manifest, hyperdriveKeys, salt = null) => {
      return setupSwarmListener(swarm, rootHash, manifest, hyperdriveKeys, salt, solarCycle);
    },

    // INGESTING: Peer B or C pulls computational knowledge through membrane checks
    triggerOsmosis: async (inputString, seedLibrary) => {
      const target = resolveEntry(inputString, seedLibrary);
      if (!target) {
        throw new Error(`[hop-osmosis] Abort: Unable to resolve target "${inputString}".`);
      }

      const peer = await joinTopicSwarm(swarm, target, solarCycle);

      try {
        const manifest = await peer.requestManifest();
        if (!evaluateManifest(manifest, localEnergyBudget)) {
          throw new Error('[hop-osmosis] Abort: Payload exceeds local energy budget.');
        }

        const rawCues = await peer.fetchFilteredCues(target.datatypeRegex);
        const filteredCues = filterCues(rawCues, target.datatypeRegex);

        // 1. Await full block replication
        const replicatedDrives = await replicateHyperdrivePaths(peer, filteredCues);

        // 2. Deterministically flush view headers on all Hyperbees
        if (Array.isArray(replicatedDrives)) {
          await Promise.all(
            replicatedDrives.map(async (drive) => {
              if (drive?.bee && typeof drive.bee.update === 'function') {
                await drive.bee.update();
              }
            })
          );
        }

        return filteredCues;
      } finally {
        if (peer.close) await peer.close();
      }
    }
  };
}