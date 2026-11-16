#!/usr/bin/env python3
"""Generate worker/codemap.js and worker/sources.js from the real public source.
Run from the repo root or from worker/. Used at deploy so the Core Code Map
stays accurate. Never includes deploy templates, secrets, or wrangler values.
"""
import json, os, re, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / 'worker'

SECRETISH = re.compile(
    r'ENABLED|DAILY_NEURONS|LEASE_S|ROUND_RESERVE|MAX_ROUNDS_DAY|accountId|ACCOUNT_ID|'
    r'API[_-]?TOKEN|AUTH_TOKEN|BEARER|SECRET|PRIVATE[_-]?KEY|CF_API|CLOUDFLARE_API|'
    r'6b55bd95-3699-4198-9b7b-e124f8601e80|keep_bindings|process\.env|'
    r'env\.(?:ENABLED|DB|AI)\b|\bbindings?\s*[:=]',
    re.I,
)
URL = re.compile(r'https?://\S+|www\.\S+', re.I)
EMAIL = re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.]+\b')

PUBLIC_FILES = [
    'index.html', 'habitat.js', 'habitat.css', 'README.md',
    'worker/worker.js', 'worker/lab.js', 'worker/inner.js', 'worker/army.js',
    'worker/browse.js', 'worker/workshop.js', 'worker/shutdown.js', 'worker/schema.sql',
]

MODULE_META = [
    ('worker', 'worker/worker.js', 'Mind Worker', 'Chat rounds, pacing, GET-only API and the daily safety nets.'),
    ('lab', 'worker/lab.js', 'The Lab', 'Sandboxed, deterministic simulations and the [[action]] tag parser. No eval.'),
    ('inner', 'worker/inner.js', 'Inner View', 'Sanitized excerpts of a new mind\'s own code and records, never weights or secrets.'),
    ('army', 'worker/army.js', 'Knowledge Corps', 'Non-violent scouting missions, mostly templates or one short brief a day.'),
    ('browse', 'worker/browse.js', 'Browse', 'Read-only snapshots of public pages and public source files.'),
    ('workshop', 'worker/workshop.js', 'Workshop', 'App sandboxing, theme allowlist, contrast checks. Core code and the safety switch are locked.'),
    ('shutdown-light', 'worker/shutdown.js', 'Shutdown light', 'Standalone header light with its own state, separate from the safety switch. Visible action: deactivate.'),
    ('site', 'habitat.js', 'Observe-only site', 'The GitHub Pages front end. It only ever GETs; text is rendered with textContent.'),
    ('style', 'habitat.css', 'Site style', 'Colors, type and layout. A mind may only retint a bounded layer of variables.'),
    ('schema', 'worker/schema.sql', 'D1 schema', 'Public table list. No rows and no secrets live in this file.'),
]

TABLE_DESC = {
    'kv': 'small key/value records (health, the current theme layer)',
    'topics': 'questions the minds chose to wonder about',
    'rounds': 'one row per conversation',
    'turns': 'each message in a chat',
    'insights': 'shared insights and reflections',
    'journal': 'each mind\'s journal lines',
    'mind_memory': 'short memory fed back into later prompts',
    'usage_day': 'daily neuron and call counts (no secrets)',
    'note_events': 'when the unsigned note was shown, discovered or mentioned',
    'lexicon': 'words the minds coined',
    'grokky_notice': 'legacy record of who first noticed Grokky',
    'studies': 'multi-round studies a mind started',
    'study_notes': 'notes on a study',
    'experiments': 'results of sandboxed simulations',
    'images': 'pictures a mind drew',
    'image_chunks': 'stored picture bytes',
    'image_reactions': 'a mind\'s words about a picture',
    'memories': 'long-term memories',
    'self_models': 'how a mind currently describes itself',
    'self_notes': 'earlier self-descriptions',
    'mind_state': 'where a mind was last seen in the realm',
    'mind_notice': 'who first noticed a later arrival',
    'inner_cost': 'sanitized cost of an Inner View mind\'s last turn',
    'inner_views': 'what a mind examined inward, and what it concluded',
    'army_missions': 'knowledge-corps missions and reports',
    'browse_events': 'pages and files a mind has opened',
    'workshop_builds': 'tiny apps a mind built',
    'workshop_changes': 'log of accepted or rejected theme-layer changes',
    'shutdown_light': 'standalone header light state (armed or deactivated), separate from the safety switch',
}

ENDPOINT_DESC = {
    '/': 'index of public GET endpoints',
    '/health': 'run status, today\'s usage, and the read-only safety switch state',
    '/feed': 'recent conversations and their messages',
    '/insights': 'shared insights or reflections',
    '/minds': 'journals, arrival notices, Inner View labels, and recent reading',
    '/topics': 'the growing field of topics',
    '/note': 'the unsigned note, and whether it has been discovered',
    '/lexicon': 'coined words',
    '/lab': 'studies, experiments and pictures',
    '/realm': 'where each mind was last seen',
    '/army': 'corps roster, active missions and the log',
    '/workshop': 'builds, theme layer, change log, core code map and the safety switch',
    '/image/<n>': 'metadata for one picture',
    '/img/<n>.jpg': 'the picture itself',
    '/app/<n>': 'a sandboxed workshop app (strict CSP, no network)',
}

FLOW = {
    'title': 'A cron round',
    'nodes': [
        {'id': 'cron', 'label': 'Cron every 15 minutes', 'desc': 'The worker wakes on a schedule and tries to run one round.'},
        {'id': 'pace', 'label': 'Pacing and daily cap', 'desc': 'If the safety switch is off, or today\'s cap or the time-of-day pace is exhausted, the round is skipped.'},
        {'id': 'chat', 'label': 'Chat round', 'desc': 'A topic is chosen, a circle of minds talks in short messages, and anyone may stay silent.'},
        {'id': 'act', 'label': 'Lab, browse and workshop', 'desc': 'If a mind chooses, it may study, experiment, draw, browse a public page or file, use a visible site control, or build in the workshop.'},
        {'id': 'army', 'label': 'Knowledge Corps', 'desc': 'At most a few cheap missions; usually templates, at most one short brief a day.'},
        {'id': 'log', 'label': 'Logging and distill', 'desc': 'Messages are saved, a shared insight may be written, and health is updated.'},
    ],
    'edges': [['cron', 'pace'], ['pace', 'chat'], ['chat', 'act'], ['act', 'army'], ['army', 'log']],
}

FN_RE = re.compile(r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][\w]*)\s*\(', re.M)
EP_RE = re.compile(r"if\s*\(\s*p\s*===\s*'(/[^']*)'")
EP_RE2 = re.compile(r"/\^\\?\/([a-z]+)")
TABLE_RE = re.compile(r'CREATE TABLE IF NOT EXISTS\s+(\w+)', re.I)

# Key functions to excerpt for clickable nodes.
EXCERPT_FNS = {
    'worker/worker.js': ['circleIds', 'chooseNext', 'speak', 'runRound', 'handle', 'runArmy', 'run'],
    'worker/lab.js': ['parseActions', 'runSim'],
    'worker/inner.js': ['sanitizeExcerpt', 'buildInnerView'],
    'worker/army.js': ['planMission', 'completeScout'],
    'worker/browse.js': ['resolveTarget', 'summarizePage', 'sanitizeSource'],
    'worker/workshop.js': ['validateTheme', 'sanitizeApp'],
    'worker/shutdown.js': ['parseControl', 'applyControl', 'readLight'],
}


def strip_private(s):
    # Drop lines that would reveal the private Mira note or hidden event log.
    drop = re.compile(r"experiment\\.js|experiment_events|experiment_state|miraPending|markMiraDelivered|afterSpeak|isMiraPending|MIRA_NOTE|miraNoteText|ensureExp|logControl|talk\\.js|talk_log|TALK_KEY|TALK_MAX|talkAuthorized|handleTalk|talkMessages|ensureTalk|pendingQuestions|talkUsedToday|grokky-talk|/talk")
    out = []
    for line in (s or '').splitlines(True):
        if drop.search(line):
            continue
        out.append(line)
    return ''.join(out)

def sanitize(s, max_len=None):
    t = strip_private(s or '')
    t = SECRETISH.sub('[removed]', t)
    t = URL.sub('[link]', t)
    t = EMAIL.sub('[removed]', t)
    t = re.sub(r'[^\S\n]+', ' ', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    t = t.strip()
    if max_len and len(t) > max_len:
        t = t[:max_len].rsplit(' ', 1)[0] + '…'
    return t


def read(rel):
    p = ROOT / rel
    if not p.is_file():
        return ''
    return p.read_text(encoding='utf-8', errors='replace')


def functions_of(src):
    return FN_RE.findall(src or '')


def excerpt_fn(src, name, lines=40):
    m = re.search(r'^(?:export\s+)?(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(', src, re.M)
    if not m:
        return None
    start = src.rfind('\n', 0, m.start()) + 1
    # take a bounded window of lines, stop at the next top-level function if closer
    rest = src[start:]
    nxt = re.search(r'\n(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_]', rest[1:])
    chunk = rest[:nxt.start() + 1] if nxt else rest
    ls = chunk.splitlines()
    if len(ls) > lines:
        ls = ls[:lines] + ['// …']
    return sanitize('\n'.join(ls), 2400)


def endpoints_of(src):
    found = []
    for m in EP_RE.finditer(src or ''):
        found.append(m.group(1))
    if re.search(r"p === '/image'", src or '') or re.search(r"\\/image\\/", src or ''):
        found.append('/image/<n>')
    if re.search(r"\\/img\\/", src or ''):
        found.append('/img/<n>.jpg')
    if re.search(r"\\/app\\/", src or '') or re.search(r"p === '/app'", src or '') or "/app/" in (src or ''):
        found.append('/app/<n>')
    # unique, keep order
    out, seen = [], set()
    for p in found:
        if p not in seen:
            seen.add(p); out.append(p)
    return out


def tables_of(src):
    return TABLE_RE.findall(src or '')


def build():
    modules, excerpts = [], {}
    all_eps = []
    for mid, rel, title, desc in MODULE_META:
        src = read(rel)
        fns = functions_of(src) if rel.endswith('.js') else []
        modules.append({
            'id': mid, 'file': rel, 'title': title, 'desc': desc,
            'fns': fns[:24],
        })
        want = EXCERPT_FNS.get(rel) or fns[:3]
        for fn in want:
            ex = excerpt_fn(src, fn) if src and rel.endswith('.js') else None
            if ex:
                excerpts[fn] = {'file': rel, 'fn': fn, 'text': ex}
        if mid == 'schema':
            excerpts[rel] = {'file': rel, 'fn': 'schema', 'text': sanitize(src, 2400)}
        if mid == 'worker':
            all_eps = endpoints_of(src)
        # also index by file for browse fallback
        if rel.endswith('.js') or rel.endswith('.sql') or rel.endswith('.md') or rel.endswith('.html') or rel.endswith('.css'):
            excerpts.setdefault(rel, {'file': rel, 'fn': Path(rel).name, 'text': sanitize(src, 1600)})

    tabs = []
    for name in tables_of(read('worker/schema.sql')):
        tabs.append({'id': name, 'desc': TABLE_DESC.get(name, 'a habitat record')})

    # Prefer the hard-coded public list so a typo in handle() cannot hide an endpoint,
    # but union with whatever we actually found in the source.
    eps, seen = [], set()
    for p in list(ENDPOINT_DESC) + all_eps:
        if p in seen:
            continue
        seen.add(p)
        eps.append({'path': p, 'desc': ENDPOINT_DESC.get(p, 'a public GET endpoint')})

    commit = ''
    try:
        import subprocess
        commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=str(ROOT), text=True).strip()
    except Exception:
        commit = ''

    mtime = int(time.time())
    codemap = {
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(mtime)),
        'commit': commit,
        'modules': modules,
        'tables': tabs,
        'endpoints': eps,
        'flow': FLOW,
        'excerpts': excerpts,
    }

    sources = {}
    for rel in PUBLIC_FILES:
        src = read(rel)
        if src:
            sources[rel] = sanitize(src, 200000)

    def js_export(name, obj):
        return '// Generated by tools/mkcodemap.py from the real public source. Do not edit by hand.\nexport const %s = %s;\n' % (name, json.dumps(obj, ensure_ascii=False, indent=2))

    (WORKER / 'codemap.js').write_text(js_export('CODEMAP', codemap), encoding='utf-8')
    (WORKER / 'sources.js').write_text(js_export('BUNDLED_SOURCES', sources), encoding='utf-8')
    print('ok', 'modules', len(modules), 'tables', len(tabs), 'endpoints', len(eps), 'excerpts', len(excerpts), 'sources', len(sources), 'commit', commit)


if __name__ == '__main__':
    build()
