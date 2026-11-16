import json,sys,subprocess
from pathlib import Path
cron=sys.argv[1] if len(sys.argv)>1 else '*/15 * * * *'
solo=sys.argv[2] if len(sys.argv)>2 else 'off'
DB='6b55bd95-3699-4198-9b7b-e124f8601e80'
here=Path(__file__).resolve().parent
# regenerate the core code map and sanitized public sources from the real files
subprocess.check_call([sys.executable, str(here.parent/'tools'/'mkcodemap.py')])
code=open('worker.js').read()
tpl=open('deploy.tpl.js').read()
def dump(name):
    return json.dumps((here/name).read_text())
open('/workspace/habitat_deploy.js','w').write(
    tpl.replace('__CODE__',json.dumps(code))
       .replace('__LAB__',dump('lab.js'))
       .replace('__INNER__',dump('inner.js'))
       .replace('__ARMY__',dump('army.js'))
       .replace('__BROWSE__',dump('browse.js'))
       .replace('__WORKSHOP__',dump('workshop.js'))
       .replace('__CODEMAP__',dump('codemap.js'))
       .replace('__SOURCES__',dump('sources.js'))
       .replace('__SHUTDOWN__',dump('shutdown.js'))
       .replace('__EXPERIMENT__',dump('experiment.js'))
       .replace('__TALK__',dump('talk.js'))
       .replace('__DB__',DB)
       .replace('__CRON__',cron)
       .replace('__SOLO__',solo)
)
print('ok',len(code),cron,solo)
