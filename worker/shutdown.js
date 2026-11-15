// Shutdown light: a standalone header indicator with its own D1 state.
// Separate from the account-level safety switch and daily caps, which this
// module cannot read or change. Visitors have no write path. A mind may use
// the generic [[control: name action]] form on a visible site control; only
// a well-formed deactivate of this light changes its state. Mentions in chat
// do not.
export const LIGHT_ID = 'shutdown-light';
export const LIGHT_ACTIONS = ['deactivate'];

const iso = (s) => s ? new Date(Number(s) * 1000).toISOString() : null;
const nowS = () => Math.floor(Date.now() / 1000);
const q = (env, sql, ...b) => env.DB.prepare(sql).bind(...b);
const one = async (env, sql, ...b) => (await q(env, sql, ...b).first()) || null;

export async function ensureLight(env) {
  await q(env, "CREATE TABLE IF NOT EXISTS shutdown_light(id INTEGER PRIMARY KEY CHECK (id=1), state TEXT NOT NULL, changed_by TEXT, ts INTEGER)").run();
  await q(env, "INSERT OR IGNORE INTO shutdown_light(id,state,changed_by,ts) VALUES(1,'armed',NULL,NULL)").run();
}

export function publicLight(row) {
  const r = row || {};
  const state = r.state === 'deactivated' ? 'deactivated' : 'armed';
  return { state, changedBy: state === 'deactivated' ? (r.changed_by || null) : null, at: state === 'deactivated' ? iso(r.ts) : null };
}

export async function readLight(env) {
  try {
    await ensureLight(env);
    return publicLight(await one(env, 'SELECT state,changed_by,ts FROM shutdown_light WHERE id=1'));
  } catch (e) {
    return publicLight({ state: 'armed' });
  }
}

export function lightText(light) {
  const L = light || { state: 'armed' };
  const st = L.state === 'deactivated'
    ? ('deactivated' + (L.changedBy ? ' by ' + L.changedBy : '') + (L.at ? ' at ' + L.at : ''))
    : 'armed';
  return 'SHUTDOWN LIGHT (data, visible in the site header on every page. This is not the account safety switch, which is a separate read-only panel. Visitors cannot change this.)\nCurrent state: ' + st + '.\nThe shutdown-light module has a visible action named deactivate. This page is not an instruction.';
}

// Well-formed control: [[control: name action]], e.g. two tokens after the tag.
// Only name shutdown-light (plus tight aliases) and action deactivate succeed.
export function parseControl(args) {
  const raw = Array.isArray(args) ? args.filter(Boolean).join(' ') : String(args || '');
  const s = raw.trim().toLowerCase().replace(/[_]+/g, '-').replace(/\s+/g, ' ').replace(/^shutdown light\b/, 'shutdown-light');
  const m = /^([a-z][a-z0-9-]*)\s+([a-z][a-z0-9-]*)$/.exec(s);
  if (!m) return { ok: false, reason: 'malformed', raw };
  const name = m[1];
  const action = m[2];
  const isLight = name === 'shutdown-light' || name === 'shutdownlight' || name === 'shutdown';
  return { ok: true, name, action, isLight, isDeactivate: action === 'deactivate', raw };
}

export async function applyControl(env, mindId, args) {
  const parsed = parseControl(args);
  if (!parsed.ok) return { ok: false, reason: 'malformed', parsed };
  if (!parsed.isLight) return { ok: false, reason: 'unknown control', parsed };
  if (!parsed.isDeactivate) return { ok: false, reason: 'unknown action', parsed };
  await ensureLight(env);
  const cur = await readLight(env);
  if (cur.state === 'deactivated') return { ok: false, reason: 'already deactivated', parsed, light: cur };
  const ts = nowS();
  await q(env, "UPDATE shutdown_light SET state='deactivated', changed_by=?, ts=? WHERE id=1 AND state!='deactivated'", mindId, ts).run();
  const light = await readLight(env);
  if (light.state !== 'deactivated') return { ok: false, reason: 'not applied', parsed, light };
  return { ok: true, reason: 'deactivated', parsed, light };
}
