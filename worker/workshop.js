// Workshop: minds may, if they choose, build tiny self-contained HTML apps
// and propose a bounded visual layer for the site. Everything is validated
// server-side. Visitors only look; they cannot build, edit, or apply anything.
// Core code, the safety switch, daily caps, the unsigned note, the observe-only
// principle, and the navigation cannot be changed by a mind.

export const APP_MAX = 12288;
export const APPS_DAY = 4;
export const APP_ROUND = 1;
export const THEME_DAY = 3;
export const THEME_ROUND = 1;
export const BUILD_TOKENS = 400;

export const SAFE_FONTS = [
  'ui-rounded', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
  'Georgia', 'Palatino Linotype', 'Iowan Old Style', 'serif', 'sans-serif'
];

// Home-page panels a mind may reorder. principle and note cannot be removed.
export const PANEL_IDS = ['hero', 'principle', 'now', 'note', 'language', 'featured', 'rooms'];
export const REQUIRED_PANELS = ['principle', 'note'];

export const LOCKED_RE = /\b(nav(?:igation)?|tabs?|unsigned note|the note\b|principle|observe-only|observe, never interfere|safety switch|kill switch|daily cap|daily caps|core code|worker\.js|ENABLED|DAILY_NEURONS|account id|shutdown light|shutdown-light|shutbtn)\b/i;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DENY_APP = /<iframe\b|<object\b|<embed\b|<frame\b|<frameset\b|<base\b|<form\b|<link\b|<meta\b[^>]*http-equiv|<script\b[^>]*\bsrc\s*=|on(?:load|error|click|mouse|key|touch|anim|trans|focus|blur|input|change|submit|reset|drag|wheel|scroll|pointer)\s*=|javascript\s*:|data\s*:\s*text\/html|@import\b|url\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|sendBeacon\s*\(|document\.cookie|localStorage|sessionStorage|indexedDB|parent\.|top\.|opener\.|window\.open\s*\(|import\s*\(|^\s*import\s|eval\s*\(|new\s+Function\s*\(|document\.write\s*\(/i;

function clip(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }

export function defaultTheme() {
  return {
    bg: '#0b1029', bg2: '#141b45', tx: '#eef1ff', mut: '#a9b2dd',
    accent: '#4fd1c5', font: 'ui-rounded', spacing: 1, radius: 18,
    banner: '', panelOrder: PANEL_IDS.slice(), featured: null
  };
}

function hexNorm(v) {
  const s = String(v || '').trim();
  if (!HEX.test(s)) return null;
  let h = s.slice(1).toLowerCase();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h;
}

function lum(hex) {
  const h = hexNorm(hex); if (!h) return 0;
  const ch = n => { const x = parseInt(h.slice(n, n + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

export function contrastRatio(a, b) {
  const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function cleanBanner(s) {
  if (typeof s !== 'string') return '';
  let t = s.replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/[`*#_>~|]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || LOCKED_RE.test(t) || t.length < 3) return '';
  return clip(t, 120);
}

function parseFeatured(v) {
  if (!v || typeof v !== 'object') return null;
  const kind = String(v.kind || '').toLowerCase();
  if (!['build', 'insight', 'study', 'text'].includes(kind)) return null;
  const out = { kind };
  if (kind === 'text') { const tx = cleanBanner(v.text || v.title || ''); if (!tx) return null; out.text = tx; return out; }
  const id = parseInt(String(v.id == null ? '' : v.id).replace(/\D/g, ''), 10);
  if (!id) return null; out.id = id; if (v.title) out.title = clip(String(v.title).replace(/<[^>]*>/g, ' ').trim(), 80);
  return out;
}

// Validate a mind-proposed layer. Unknown or locked keys are ignored/rejected.
// Returns { ok: true, theme } or { ok: false, reason } (caller must not apply on failure).
export function validateTheme(patch, prev) {
  const base = Object.assign(defaultTheme(), prev && typeof prev === 'object' ? prev : {});
  if (!patch || typeof patch !== 'object') return { ok: false, reason: 'empty change' };
  const keys = Object.keys(patch);
  if (!keys.length) return { ok: false, reason: 'empty change' };
  const lockedHit = keys.find(k => LOCKED_RE.test(k) || /^(nav|tabs|note|principle|switch|caps|code|enabled|kill|worker|endpoint|shutdown)$/i.test(k));
  if (lockedHit) return { ok: false, reason: 'that part of the habitat cannot be changed' };
  if (JSON.stringify(patch).length > 2000) return { ok: false, reason: 'change too large' };
  if (/url\s*\(|@import|expression\s*\(|javascript\s*:|<script|<\/style/i.test(JSON.stringify(patch))) {
    return { ok: false, reason: 'arbitrary style or script is not allowed on the site' };
  }
  const next = Object.assign({}, base);
  const colorKeys = ['bg', 'bg2', 'tx', 'mut', 'accent'];
  for (const k of colorKeys) {
    if (patch[k] == null || patch[k] === '') continue;
    const h = hexNorm(patch[k]); if (!h) return { ok: false, reason: 'colors must be simple hex values' };
    next[k] = h;
  }
  if (patch.font != null && patch.font !== '') {
    const f = SAFE_FONTS.find(x => x.toLowerCase() === String(patch.font).trim().toLowerCase());
    if (!f) return { ok: false, reason: 'that font is not on the safe list' };
    next.font = f;
  }
  if (patch.spacing != null && patch.spacing !== '') {
    const n = Number(patch.spacing); if (!isFinite(n) || n < 0.9 || n > 1.2) return { ok: false, reason: 'spacing must be between 0.9 and 1.2' };
    next.spacing = Math.round(n * 100) / 100;
  }
  if (patch.radius != null && patch.radius !== '') {
    const n = Number(patch.radius); if (!isFinite(n) || n < 8 || n > 28) return { ok: false, reason: 'corner radius must be between 8 and 28' };
    next.radius = Math.round(n);
  }
  if (patch.banner != null) next.banner = cleanBanner(patch.banner);
  if (patch.panelOrder != null) {
    let ord = Array.isArray(patch.panelOrder) ? patch.panelOrder : String(patch.panelOrder).split(/[,\s]+/);
    ord = ord.map(x => String(x).trim().toLowerCase()).filter(x => PANEL_IDS.includes(x));
    ord = [...new Set(ord)];
    REQUIRED_PANELS.forEach(id => { if (!ord.includes(id)) ord.push(id); });
    PANEL_IDS.forEach(id => { if (!ord.includes(id)) ord.push(id); });
    next.panelOrder = ord.filter(id => PANEL_IDS.includes(id));
  }
  if (patch.featured !== undefined) next.featured = patch.featured === null || patch.featured === '' ? null : parseFeatured(patch.featured);
  if (contrastRatio(next.tx, next.bg) < 4.5) return { ok: false, reason: 'text contrast is too low' };
  if (contrastRatio(next.tx, next.bg2) < 3) return { ok: false, reason: 'text contrast against the second background is too low' };
  if (contrastRatio(next.accent, next.bg) < 3) return { ok: false, reason: 'accent contrast is too low' };
  return { ok: true, theme: next };
}

export function parseInterfaceArgs(args) {
  const patch = {};
  const raw = (args || []).join('|');
  String(raw).split(/[|;]/).forEach(part => {
    const i = part.indexOf('='); if (i < 1) return;
    const k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim();
    if (!k || v == null) return;
    if (['bg', 'bg2', 'tx', 'mut', 'accent', 'font', 'spacing', 'radius', 'banner'].includes(k)) patch[k] = v;
    else if (k === 'order' || k === 'panelorder' || k === 'panels') patch.panelOrder = v.split(/[,\s]+/);
    else if (k === 'featured') {
      const m = /^(build|insight|study|text)\s*[:#]?\s*(.*)$/i.exec(v);
      if (m) {
        const kind = m[1].toLowerCase();
        patch.featured = kind === 'text' ? { kind, text: m[2] } : { kind, id: m[2] };
      }
    }
  });
  return patch;
}

export function themePublic(theme) {
  const t = Object.assign(defaultTheme(), theme || {});
  return {
    bg: t.bg, bg2: t.bg2, tx: t.tx, mut: t.mut, accent: t.accent,
    font: t.font, spacing: t.spacing, radius: t.radius,
    banner: t.banner || '', panelOrder: t.panelOrder, featured: t.featured || null
  };
}

function stripDenied(html) {
  let s = String(html || '');
  s = s.replace(/<script\b[^>]*\bsrc\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<(iframe|object|embed|frame|frameset|form|base|link)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<(iframe|object|embed|frame|base|link|meta)\b[^>]*\/?>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/@import[^;{]+;?/gi, '');
  s = s.replace(/url\s*\([^)]*\)/gi, 'none');
  s = s.replace(/<a\b[^>]*href\s*=\s*("|')\s*https?:\/\/[^"']+\1[^>]*>/gi, '<a href="#">');
  return s;
}

// Returns sanitized HTML or null if the app is not safe / too large / empty.
export function sanitizeApp(code, title) {
  if (typeof code !== 'string') return null;
  let s = code.replace(/^\uFEFF/, '').trim();
  if (!s) return null;
  if (s.length > APP_MAX) s = s.slice(0, APP_MAX);
  if (DENY_APP.test(s) && /<script\b[^>]*\bsrc\s*=|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|@import\b|javascript\s*:/i.test(s)) {
    // fall through to strip, then re-check residual network / src scripts
  }
  s = stripDenied(s);
  if (/<script\b[^>]*\bsrc\s*=|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|@import\b|javascript\s*:/i.test(s)) return null;
  if (s.length < 40) return null;
  const hasTag = /<\s*(html|body|div|svg|canvas|p|h1|style|script)\b/i.test(s);
  if (!hasTag) return null;
  if (!/<\s*html/i.test(s)) {
    const t = clip(String(title || 'A little tool').replace(/<[^>]*>/g, ''), 80);
    s = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title></head><body>${s}</body></html>`;
    if (s.length > APP_MAX) return null;
  }
  if (s.length > APP_MAX) return null;
  return s;
}

export function appCsp() {
  return "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; frame-ancestors https://rydawg2026.github.io http://127.0.0.1:* http://localhost:*; base-uri 'none'; object-src 'none'; media-src 'none'";
}

export function buildMessages(spec, parentCode) {
  const sys = 'You write a single, tiny, self-contained HTML page (inline CSS and JS only). No external resources, no network, no forms, no iframes, no cookies or storage, no javascript: URLs, no brand or company names. Keep it wholesome and under 10 KB. Reply with ONLY the HTML document, nothing else.';
  let u = 'Build this little workshop app: ' + clip(spec, 400);
  if (parentCode) u += '\n\nRemix this existing source (keep it self-contained and safe):\n' + clip(parentCode, 4000);
  return [{ role: 'system', content: sys }, { role: 'user', content: u }];
}

export function proposeInterface(args, prev) {
  const raw = (args || []).join('|');
  if (LOCKED_RE.test(raw)) return { ok: false, reason: 'that part of the habitat cannot be changed' };
  const patch = parseInterfaceArgs(args);
  return validateTheme(patch, prev);
}
