import crypto from 'crypto';

/**
 * Derives the dynamic topic based on the root hash, optional salt, and Heli Clock solar cycle.
 */
export function deriveTopicHash(rootHash, salt = null, currentSolarCycle = 0) {
  if (salt) {
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(rootHash);
    return hmac.digest('hex');
  } else {
    const hashObj = crypto.createHash('sha256');
    hashObj.update(`${rootHash}:${currentSolarCycle}`);
    return hashObj.digest('hex');
  }
}

/**
 * Sets up a Hyperswarm listener to host a bundle on a derived topic.
 */
export async function setupSwarmListener(networkOptions, rootHash, manifest, hyperdriveKeys, salt = null) {
  const swarm = networkOptions?.swarm || networkOptions;
  const topicHex = deriveTopicHash(rootHash, salt, networkOptions?.solarCycle || 0);
  const topicBuffer = Buffer.from(topicHex, 'hex');

  let discovery = null;
  if (swarm && typeof swarm.join === 'function') {
    discovery = swarm.join(topicBuffer, { server: true, client: false });
    if (discovery.flushed) await discovery.flushed();
  }

  return {
    topic: topicHex,
    manifest,
    hyperdriveKeys,
    discovery,
    close: async () => {
      if (discovery && typeof discovery.destroy === 'function') {
        await discovery.destroy();
      }
    }
  };
}

/**
 * Joins a topic swarm to pull computational knowledge and request bundle data.
 */
export async function joinTopicSwarm(networkOptions, target) {
  const swarm = networkOptions?.swarm || networkOptions;
  const rootHash = target.rootHash || target.hash || target.target || target;
  const topicHex = deriveTopicHash(rootHash, target.salt || null, networkOptions?.solarCycle || 0);
  const topicBuffer = Buffer.from(topicHex, 'hex');

  let discovery = null;
  if (swarm && typeof swarm.join === 'function') {
    discovery = swarm.join(topicBuffer, { server: false, client: true });
    if (discovery.flushed) await discovery.flushed();
  }

  // Peer stream RPC wrapper interface
  return {
    topic: topicHex,
    discovery,
    requestManifest: async () => {
      if (target.manifest) return target.manifest;
      return {
        energyBudget: target.energyBudget || 100,
        size: target.size || 0,
        cuesCount: target.cues?.length || 0
      };
    },
    fetchFilteredCues: async (datatypeRegex) => {
      const cues = target.cues || target.rawCues || [];
      if (!datatypeRegex) return cues;
      
      const re = typeof datatypeRegex === 'string' ? new RegExp(datatypeRegex) : datatypeRegex;
      return cues.filter(cue => re.test(cue.datatype || cue.type || ''));
    }
  };
}