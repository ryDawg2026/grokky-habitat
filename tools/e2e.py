# Grokky Habitat e2e: mocked Worker (live / empty / offline / cold-offline), observe-only guarantees, XSS safety, mobile layout.
import sys,json,time,re
from playwright.sync_api import sync_playwright
url=sys.argv[1];tag=sys.argv[2] if len(sys.argv)>2 else 'local'
live=url.startswith('https://')
ok=True
def chk(n,c,i=''):
  global ok
  print(('PASS' if c else 'FAIL'),n,i if not c else '')
  if not c: ok=False
def iso(ago): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z',time.gmtime(time.time()-ago))
M=[('wren','Wren'),('pip','Pip'),('lumen','Lumen'),('bram','Bram')]
def rnd(i,topic,ago):
  texts=['I think %s begins with careful definitions, Pip.'%topic[:20],'But what if we go past the definitions, Wren? Look at the edge of the map!','The water remembers both, friends: the known and the not-yet-imagined.','Lovely, but how would we test any of it? Let us build one small bridge. <img src=x onerror="window.__xss=1"> <script>window.__xss=2</script>']
  return {'id':i,'at':iso(ago),'topic':topic,'title':'Bridges to the unknown %d'%i,'turns':[{'mind':m[0],'text':texts[(k+i)%4]} for k,m in enumerate(M)],'insight':{'mind':None,'text':'A mind learns what it cannot yet imagine by building small bridges, then testing each plank together (round %d).'%i},'reflection':{'mind':'lumen','text':'The pool holds the sky and the stones at once.'}}
ROUNDS=[rnd(3,'What counts as a good first bridge into the unknown?',240),rnd(2,'Can doubt be a kind of curiosity?',2000),rnd(1,'How can a mind learn something it cannot yet imagine?',4000)]
def mk_feed(rounds,more=False): return {'minds':[{'id':i,'name':n} for i,n in M],'rounds':rounds,'more':more,'lastRoundAt':rounds[0]['at'] if rounds else None,'serverTime':iso(0)}
def mk_health(active=True): return {'ok':True,'status':'active' if active else 'quiet','lastRoundAt':ROUNDS[0]['at'],'okRuns':9,'failedRuns':0}
INS={'kind':'insight','items':[{'id':i,'round':i,'at':iso(i*900),'mind':None,'title':'Bridges to the unknown %d'%i,'text':'A mind learns what it cannot yet imagine by building small bridges (idea %d).'%i,'topic':'topic %d'%i} for i in range(12,0,-1)],'more':False}
REF={'kind':'reflection','items':[{'id':100+i,'round':i,'at':iso(i*900),'mind':M[i%4][0],'title':None,'text':'The pool holds the sky and the stones at once, said reflection %d.'%i,'topic':'t'} for i in range(6,0,-1)],'more':False}
TOP=[{'id':1,'name':'How can a mind learn something it cannot yet imagine?','parent':None,'visits':3,'at':iso(9000)}]
for i in range(2,31): TOP.append({'id':i,'name':'Question number %d about the edge of the map?'%i,'parent':max(1,i//2) if i%5 else 1,'visits':(i%4),'at':iso(8000-i*100)})
TOPICS={'total':len(TOP),'topics':TOP}
MINDS_={'minds':[{'id':i,'name':n,'turns':12,'learnedCount':3,'journal':[{'round':3,'at':iso(300),'text':'I now see that careful definitions are bridges too, thanks to Bram (%s).'%n}]} for i,n in M]}
EMPTY_ROUNDS=mk_feed([]);EMPTY_INS={'kind':'insight','items':[],'more':False};EMPTY_T={'total':0,'topics':[]}
def handler_for(state,log):
  def h(route):
    req=route.request;u=req.url;log.append((req.method,u))
    if state['mode']=='down': return route.abort()
    p=re.sub(r'https?://[^/]+','',u).split('?')[0]
    if state['mode']=='empty':
      data={'/feed':EMPTY_ROUNDS,'/health':{'ok':True,'status':'quiet','okRuns':1},'/minds':{'minds':[{'id':i,'name':n,'turns':0,'learnedCount':0,'journal':[]} for i,n in M]},'/insights':EMPTY_INS,'/topics':EMPTY_T}.get(p)
      if '/insights' in p and 'reflection' in u: data={'kind':'reflection','items':[],'more':False}
    else:
      data={'/feed':mk_feed(ROUNDS,True),'/health':mk_health(),'/minds':MINDS_,'/insights':REF if 'reflection' in u else INS,'/topics':TOPICS}.get(p)
    if data is None: return route.fulfill(status=404,body='{}',headers={'access-control-allow-origin':'*'})
    route.fulfill(status=200,headers={'access-control-allow-origin':'*','content-type':'application/json'},body=json.dumps(data))
  return h
with sync_playwright() as p:
  b=p.chromium.launch()
  def newctx(mobile,state,log):
    kw={'viewport':{'width':390,'height':844},'device_scale_factor':2,'is_mobile':True,'has_touch':True} if mobile else {'viewport':{'width':1280,'height':900}}
    cx=b.new_context(**kw)
    if state is not None:
      cx.add_init_script("window.HABITAT_API='http://api.test';");cx.route(lambda u:u.startswith('http://api.test'),handler_for(state,log))
    return cx
  def go(pg,r):
    pg.goto(url+('#/'+r if r else ''));pg.wait_for_timeout(900)
  for mobile in (False,True):
    nm='mobile' if mobile else 'desktop';log=[];st={'mode':'ok'};cx=newctx(mobile,st if not live else None,log);pg=cx.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)[:150]));pg.on('console',lambda m:errs.append(m.text[:160]) if m.type=='error' else None)
    if live: pass
    go(pg,'')
    if live: pg.wait_for_function("document.querySelector('#pulse .dot.live,#pulse .dot.quiet')",timeout=30000)
    pg.wait_for_timeout(1500)
    T=pg.inner_text('#view')
    chk(nm+': founding principle visible on home','The minds here are free. Observe, never interfere.' in T and 'pause, edit, redirect or steer' in T)
    chk(nm+': home shows the four rooms and the four minds',all(x in T for x in ['The Walls','The Desk','The Pools','The Open Field','Wren','Pip','Lumen','Bram']))
    chk(nm+': status pill says the minds are awake',('awake' in pg.inner_text('#pulse')),pg.inner_text('#pulse'))
    pg.screenshot(path='/workspace/habitat-%s-%s-home.png'%(tag,nm),full_page=False)
    for r,must in [('watch',['Watch the conversations','Wren','Shared insight']),('walls',['The Walls','pinned']),('desk',['Currently studying','On their reading list']),('pools',['The Pools','—']),('field',['The Open Field','topics']),('minds',['The Minds','journal'])]:
      go(pg,r);t=pg.inner_text('#view');chk(nm+': room /'+r+' renders',all(x in t for x in must),t[:150])
      if r=='pools': pg.wait_for_timeout(500)
      pg.screenshot(path='/workspace/habitat-%s-%s-%s.png'%(tag,nm,r))
    if mobile or True:
      sw=pg.evaluate("document.documentElement.scrollWidth");chk(nm+': no horizontal overflow',sw<=pg.viewport_size['width']+2,str(sw))
    # observe-only guarantees
    go(pg,'watch')
    ctl=pg.evaluate("document.querySelectorAll('form,input,textarea,select,[contenteditable]').length")
    chk(nm+': no form, input, textarea, select or editable element anywhere',ctl==0)
    chk(nm+': only GET requests ever sent to the habitat API',all(m=='GET' for m,u in log) and len(log)>3 if not live else True,str(set(m for m,u in log)))
    chk(nm+': text from minds is inert (no injected img/script, no xss flag)',pg.evaluate("!window.__xss && document.querySelectorAll('#view img,#view script').length===0"))
    chk(nm+': offending markup is shown as plain text','<img src=x' in pg.inner_text('#view') or live)
    # field interaction
    go(pg,'field');pg.evaluate("document.querySelector('.fnode').dispatchEvent(new MouseEvent('click',{bubbles:true}))");pg.wait_for_timeout(200)
    chk(nm+': tapping a topic in the Field opens its details',pg.evaluate("!document.querySelector('.finfo').hidden"))
    pg.evaluate("document.querySelector('.fctl button').click()");chk(nm+': Field zoom works',pg.evaluate("document.getElementById('fg').getAttribute('transform').includes('scale')"))
    chk(nm+': no console or page errors',not errs,str(errs))
    cx.close()
  if not live:
    # empty state
    st={'mode':'empty'};cx=newctx(False,st,[]);pg=cx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text[:120]) if m.type=='error' else None)
    for r in ['','watch','walls','desk','pools','field','minds']:
      go(pg,r);t=pg.inner_text('#view');chk('empty state /%s is friendly, not blank or broken'%r,len(t)>60 and 'undefined' not in t and 'NaN' not in t,t[:100])
    pg.screenshot(path='/workspace/habitat-%s-empty.png'%tag);chk('empty state: no errors',not errs,str(errs));cx.close()
    # offline: first online (cache), then down
    st={'mode':'ok'};cx=newctx(False,st,[]);pg=cx.new_page();go(pg,'');pg.wait_for_timeout(800);st['mode']='down';pg.reload();pg.wait_for_timeout(2500)
    chk('offline after a visit: banner + last seen conversation from cache',(not pg.evaluate("document.getElementById('offline').hidden")) and 'Wren' in pg.inner_text('#view') and 'out of reach' in pg.inner_text('#pulse'),pg.inner_text('#offline'))
    pg.screenshot(path='/workspace/habitat-%s-offline.png'%tag);cx.close()
    cx=newctx(False,{'mode':'down'},[]);pg=cx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));go(pg,'');pg.wait_for_timeout(2000)
    chk('cold offline (nothing cached): graceful message, page still works and principle still shown',(not pg.evaluate("document.getElementById('offline').hidden")) and 'The minds here are free' in pg.inner_text('#view') and not errs,pg.inner_text('#offline'))
    go(pg,'walls');chk('cold offline: rooms show a calm message instead of breaking','can’t be reached' in pg.inner_text('#view'),pg.inner_text('#view')[:100]);cx.close()
print('ALL OK' if ok else 'SOME FAILED');sys.exit(0 if ok else 1)
