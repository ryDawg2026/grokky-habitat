import json,sys
cron=sys.argv[1] if len(sys.argv)>1 else '*/15 * * * *'
DB='6b55bd95-3699-4198-9b7b-e124f8601e80'
code=open('worker.js').read()
tpl=open('deploy.tpl.js').read()
open('/workspace/habitat_deploy.js','w').write(tpl.replace('__CODE__',json.dumps(code)).replace('__LAB__',json.dumps(open('lab.js').read())).replace('__INNER__',json.dumps(open('inner.js').read())).replace('__ARMY__',json.dumps(open('army.js').read())).replace('__DB__',DB).replace('__CRON__',cron))
print('ok',len(code),cron)
