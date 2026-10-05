import crypto from 'crypto';

export function deriveTopicHash(rootHash, salt = null, currentSolarCycle = 0) {
  if (salt) {
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(rootHash);
    return hmac.digest('hex');
  }
  const hashObj = crypto.createHash('sha256');
  hashObj.update(`${rootHash}:${currentSolarCycle}`);
  return hashObj.digest('hex');
}

export async function setupSwarmListener(swarm, rootHash, manifest, hyperdriveKeys, salt = null, solarCycle = 0) {
  const topicHex = deriveTopicHash(rootHash, salt, solarCycle);
  const topicBuffer = Buffer.from(topicHex, 'hex');

  const discovery = swarm.join(topicBuffer, { server: true, client: false });
  if (discovery.flushed) await discovery.flushed();

  return {
    topic: topicHex,
    manifest,
    hyperdriveKeys,
    discovery,
    close: async () => {
      if (discovery?.destroy) await discovery.destroy();
    }
  };
}

export async function joinTopicSwarm(swarm, target, solarCycle = 0) {
  const rootHash = target.rootHash || target.hash || target.target || target;
  const topicHex = deriveTopicHash(rootHash, target.salt || null, solarCycle);
  const topicBuffer = Buffer.from(topicHex, 'hex');

  const discovery = swarm.join(topicBuffer, { server: false, client: true });
  if (discovery.flushed) await discovery.flushed();

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
      return cues.filter((cue) => re.test(cue.datatype || cue.type || ''));
    },
    close: async () => {
      if (discovery?.destroy) await discovery.destroy();
    }
  };
}