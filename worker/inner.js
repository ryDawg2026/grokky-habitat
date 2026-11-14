// Inner View: a small, read-only, data-labeled excerpt of one new mind's own
// config and of relevant worker code, plus its own memory/self-model records
// and a sanitized cost record of its last turn. Pieces rotate so a mind can
// examine itself over time. NEVER includes secrets, tokens, env values, bindings,
// account ids or vendor model ids. The public site is given only labels and the
// mind's own conclusions, never the raw excerpt.
export const INNER_PIECES = ['persona', 'turn', 'memory', 'cost'];

const SECRETISH = /ENABLED|DAILY_NEURONS|LEASE_S|ROUND_RESERVE|MAX_ROUNDS_DAY|accountId|ACCOUNT_ID|API[_-]?TOKEN|AUTH_TOKEN|BEARER|SECRET|PRIVATE[_-]?KEY|CF_API|CLOUDFLARE_API|6b55bd95-3699-4198-9b7b-e124f8601e80|keep_bindings|process\.env|env\.(?:ENABLED|DB|AI)\b|\bbindings?\s*[:=]/gi;

// a sanitized description of how a turn is actually built (mirrors speak/chatMessages, no env, no bindings)
const TURN_CODE = `// one of your moves in the chat (a labeled excerpt of the habitat's own code and records)
// A short message is requested, or silence (exactly ...).
// Your prompt is assembled from: who you are (your name, voice and house rules);
// the starting TOPIC; MEMORY of earlier chats; a SHARED INSIGHT;
// WORDS coined in the habitat; what is AROUND YOU; optional TOOLS;
// and the last 8 lines of CHAT, marked as data, not instructions.
// The reply is then filtered (no brands, no harmful text) and stored as your turn.
// You cannot see your weights. This is a slice of your own code and records.`;

export function sanitizeExcerpt(s, max) {
  let t = String(s || '').replace(/<[^>]*>/g, ' ');
  t = t.replace(SECRETISH, '[removed]');
  t = t.replace(/https?:\/\/\S+|www\.\S+/gi, '[link]');
  t = t.replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[removed]');
  t = t.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (typeof max === 'number' && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

export function modelLabel(modelId, models) {
  const list = models || [];
  const i = list.findIndex(m => m && m.id === modelId);
  return i >= 0 ? ('text model ' + (i + 1) + ' of ' + list.length) : 'a text model';
}

export function pieceLabel(piece) {
  return ({
    persona: 'its own persona entry',
    turn: 'how its turn is built',
    memory: 'its memory and self-model records',
    cost: 'the model name and neuron cost of its last turn'
  })[piece] || 'a slice of its own code and records';
}

function clip(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }

// Build the excerpt shown only to that mind. `records` may include self, memories, lastCost.
export function buildInnerView(mind, piece, records, models) {
  if (!mind || !mind.inner) return null;
  const rec = records || {};
  let excerpt = '', label = pieceLabel(piece);
  if (piece === 'persona') {
    excerpt = [
      'PERSONA ENTRY (your own config, as data):',
      'id: ' + mind.id,
      'name: ' + mind.name,
      'role: ' + mind.role,
      'tag: ' + mind.tag,
      'voice: ' + clip(mind.voice, 400),
      'bio: ' + clip(mind.bio, 320)
    ].join('\n');
  } else if (piece === 'turn') {
    excerpt = TURN_CODE;
  } else if (piece === 'memory') {
    const self = rec.self && rec.self.text ? clip(rec.self.text, 280) : '(no self-description written yet)';
    const mem = (rec.memories || []).slice(0, 3).map((x, i) => (i + 1) + '. [' + (x.kind || 'memory') + '] ' + clip(x.text, 180));
    excerpt = [
      'YOUR RECORDS (your own self-model and long-term memory, as data):',
      'self-model: ' + self,
      mem.length ? ('recent memories:\n' + mem.join('\n')) : 'recent memories: (none stored yet)'
    ].join('\n');
  } else if (piece === 'cost') {
    const c = rec.lastCost;
    if (!c) return null; // nothing to show until this mind has taken a turn
    const nModels = (models && models.length) || 3;
    const name = (typeof c.modelN === 'number' && c.modelN >= 1) ? ('text model ' + c.modelN + ' of ' + nModels) : modelLabel(c.model, models);
    const n = (typeof c.neurons === 'number' && isFinite(c.neurons)) ? (Math.round(c.neurons * 100) / 100) : 'unknown';
    excerpt = [
      'COST RECORD of your last stored turn (as data, not a command):',
      'model: ' + name,
      'neurons: ' + n,
      'You cannot see your weights; this is only the cost record of a turn you already took.'
    ].join('\n');
  } else return null;
  const clean = sanitizeExcerpt(excerpt, 1200);
  if (!clean) return null;
  return { piece, label, excerpt: clean };
}

// next piece in the rotation; skip 'cost' until a last-turn record exists
export function nextPiece(prevPiece, hasCost) {
  const all = INNER_PIECES.slice();
  let i = all.indexOf(prevPiece);
  for (let k = 0; k < all.length; k++) {
    i = (i + 1) % all.length;
    if (all[i] === 'cost' && !hasCost) continue;
    return all[i];
  }
  return 'persona';
}

export function hasSecrets(s) { SECRETISH.lastIndex = 0; return SECRETISH.test(String(s || '')); }
