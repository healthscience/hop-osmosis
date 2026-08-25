// hop-osmosis/lib/resolver.js

/**
 * Resolves an input string from BeeBee dialogue or Life-Strap 
 * into a standardized network target for the osmosis membrane.
 * 
 * @param {string} inputString - e.g. "osmosis:kitesurfing", "share:1234abc#mySalt", or "kitesurfing"
 * @param {object} seedLibrary - Local seed dictionary for hashing
 * @returns {object} { rootHash, salt, datatypeRegex }
 */
export function resolveEntry(inputString, seedLibrary) {
  if (typeof inputString !== 'string') {
    throw new Error('[osmosis:resolver] Input must be a string.');
  }

  let rawTarget = inputString.trim();
  let salt = null;

  // 1. Strip known protocol prefixes
  if (rawTarget.toLowerCase().startsWith('osmosis:')) {
    rawTarget = rawTarget.slice(8).trim();
  } else if (rawTarget.toLowerCase().startsWith('share:')) {
    rawTarget = rawTarget.slice(6).trim();
  }

  // 2. Extract capability salt if present (format: target#salt)
  const saltSplit = rawTarget.split('#');
  if (saltSplit.length > 1) {
    rawTarget = saltSplit[0].trim();
    salt = saltSplit[1].trim();
  }

  let rootHash;
  let datatypeRegex;

  // 3. Determine if target is already a hex hash or a keyword
  // Matches standard 64-char (sha256) or 32-char hex strings
  const isHexHash = /^[a-fA-F0-9]{64}$/.test(rawTarget) || /^[a-fA-F0-9]{32}$/.test(rawTarget);

  if (isHexHash) {
    rootHash = rawTarget;
    // If pulling an explicit bundle via hash, default to open regex 
    // to allow the core cues and exoCues bundled by Peer A to pass.
    datatypeRegex = /.*/i; 
  } else {
    // It's a keyword (e.g., 'kitesurfing')
    // hop-osmosis/src/lib/resolver.js:47
    const seed = seedLibrary.resolve(rawTarget);
    if (!seed) {
      throw new Error(`[osmosis:resolver] Keyword '${rawTarget}' not found in Seed Library.`);
    }
    rootHash = seed.hash;
    
    // Generate a regex to specifically capture cues within this datatype, 
    // plus mandatory boundaries like 'exoBoundary' or 'orgoData'.
    datatypeRegex = new RegExp(`(${rawTarget}|exoBoundary|orgoData)`, 'i');
  }

  console.log(`[osmosis:resolver] Target Resolved -> Hash: ${rootHash.substring(0,8)}..., Salt: ${salt ? 'yes' : 'no'}`);

  return {
    rootHash,
    salt,
    datatypeRegex
  };
}