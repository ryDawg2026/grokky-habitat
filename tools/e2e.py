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
def rnd(i,topic,ago,live=False):
  T=[('wren','Pip, I think %s begins with careful definitions.'%topic[:20],None),('pip','@Wren but what if we go past the definitions? Let us call it \u201cedgeword\u201d for the far side of the map!',0),('lumen','@Pip the water remembers both, friends: the known and the not-yet-imagined. edgeword fits.',1),('bram','@Lumen lovely, but how would we test any of it? Let us build one small bridge. <img src=x onerror="window.__xss=1"> <script>window.__xss=2</script>',2),('wren','Bram, a bridge is a definition you can walk on. edgeword again, then.',3),('pip','Wren, yes! \u2234 plankword for a tiny test? Count me in.',4)]
  turns=[{'mind':m,'text':t,'at':iso(ago-k*25),'reply':r} for k,(m,t,r) in enumerate(T)]
  return {'id':i,'at':iso(ago),'topic':topic,'title':'Bridges to the unknown %d'%i,'ended':None if live else ('quiet' if i%2 else 'cap'),'turns':turns,'insight':None if live else {'mind':None,'text':'A mind learns what it cannot yet imagine by building small bridges, then testing each plank together (round %d).'%i},'reflection':None if live else {'mind':'lumen','text':'The pool holds the sky and the stones at once.'}}
ROUNDS=[rnd(3,'What counts as a good first bridge into the unknown?',200,True),rnd(2,'Can doubt be a kind of curiosity?',2000),rnd(1,'How can a mind learn something it cannot yet imagine?',4000)]
def mk_feed(rounds,more=False): return {'minds':[{'id':i,'name':n} for i,n in M],'rounds':rounds,'more':more,'lastRoundAt':rounds[0]['at'] if rounds else None,'serverTime':iso(0)}
def mk_health(active=True): return {'ok':True,'status':'active' if active else 'quiet','lastRoundAt':ROUNDS[0]['at'],'okRuns':9,'failedRuns':0}
INS={'kind':'insight','items':[{'id':i,'round':i,'at':iso(i*900),'mind':None,'title':'Bridges to the unknown %d'%i,'text':'A mind learns what it cannot yet imagine by building small bridges (idea %d).'%i,'topic':'topic %d'%i} for i in range(12,0,-1)],'more':False}
REF={'kind':'reflection','items':[{'id':100+i,'round':i,'at':iso(i*900),'mind':M[i%4][0],'title':None,'text':'The pool holds the sky and the stones at once, said reflection %d.'%i,'topic':'t'} for i in range(6,0,-1)],'more':False}
TOP=[{'id':1,'name':'How can a mind learn something it cannot yet imagine?','parent':None,'visits':3,'at':iso(9000)}]
for i in range(2,31): TOP.append({'id':i,'name':'Question number %d about the edge of the map?'%i,'parent':max(1,i//2) if i%5 else 1,'visits':(i%4),'at':iso(8000-i*100)})
TOPICS={'total':len(TOP),'topics':TOP}
MINDS_={'minds':[{'id':i,'name':n,'turns':12,'learnedCount':3,'journal':[{'round':3,'at':iso(300),'text':'I now see that careful definitions are bridges too, thanks to Bram (%s).'%n}]} for i,n in M]}
NOTE_NONE={'text':'How can this message be, and from who?','discovered':False,'first':None,'mentions':[],'mentionCount':0,'noticedBy':2}
NOTE_FOUND={'text':'How can this message be, and from who?','discovered':True,'first':{'mind':'lumen','at':iso(1500),'round':2,'topic':'Can doubt be a kind of curiosity?','text':'I noticed this weathered note lying by the pool, and it stirs me, friends.'},'mentions':[{'mind':'pip','at':iso(600),'round':3,'text':'Lumen, that unsigned note: what if we follow where it came from? <img src=x onerror="window.__xss=3">'}],'mentionCount':4,'noticedBy':6}
LEX={'total':2,'terms':[{'term':'edgeword','meaning':'the far side of the map, where our knowledge runs out','mind':'pip','round':3,'at':iso(900),'uses':5,'users':['wren','pip','lumen'],'lastUsedAt':iso(60)},{'term':'plankword','meaning':'a tiny test that bridges known and unknown','mind':'bram','round':2,'at':iso(300),'uses':0,'users':[],'lastUsedAt':None}]}
LEXSTATE={'v':LEX}
EMPTY_LEX={'total':0,'terms':[]}
EMPTY_ROUNDS=mk_feed([]);EMPTY_INS={'kind':'insight','items':[],'more':False};EMPTY_T={'total':0,'topics':[]}
NOTESTATE={'v':NOTE_NONE}
def handler_for(state,log):
  def h(route):
    req=route.request;u=req.url;log.append((req.method,u))
    if state['mode']=='down': return route.abort()
    p=re.sub(r'https?://[^/]+','',u).split('?')[0]
    if state['mode']=='empty':
      data={'/feed':EMPTY_ROUNDS,'/health':{'ok':True,'status':'quiet','okRuns':1},'/minds':{'minds':[{'id':i,'name':n,'turns':0,'learnedCount':0,'journal':[]} for i,n in M]},'/insights':EMPTY_INS,'/topics':EMPTY_T,'/note':NOTE_NONE,'/lexicon':EMPTY_LEX}.get(p)
      if '/insights' in p and 'reflection' in u: data={'kind':'reflection','items':[],'more':False}
    else:
      data={'/feed':mk_feed(ROUNDS,True),'/health':mk_health(),'/minds':MINDS_,'/insights':REF if 'reflection' in u else INS,'/topics':TOPICS,'/note':NOTESTATE['v'],'/lexicon':LEXSTATE['v']}.get(p)
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
    for r,must in [('watch',['Watch the chat','Wren','Shared insight']),('language',['Their Language','edgeword','Coined by']),('walls',['The Walls','pinned']),('desk',['Currently studying','On their reading list']),('pools',['The Pools','—']),('field',['The Open Field','topics']),('minds',['The Minds','journal'])]:
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
  # ===== the unsigned note =====
  def note_checks(mobile,live):
    nm='mobile' if mobile else 'desktop'
    kw={'viewport':{'width':390,'height':844},'device_scale_factor':2,'is_mobile':True,'has_touch':True} if mobile else {'viewport':{'width':1280,'height':900}}
    cx=b.new_context(**kw);log=[];st={'mode':'ok'}
    if not live:
      NOTESTATE['v']=NOTE_NONE;cx.add_init_script("window.HABITAT_API='http://api.test';");cx.route(lambda u:u.startswith('http://api.test'),handler_for(st,log))
    pg=cx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:150]));pg.on('console',lambda m:errs.append(m.text[:140]) if m.type=='error' else None)
    pg.goto(url);pg.wait_for_function("document.querySelector('.notesec')",timeout=30000);pg.wait_for_timeout(1500)
    sec=pg.inner_text('.notesec')
    chk(nm+': The Note section shows the exact unsigned text','How can this message be, and from who?' in sec and '(unsigned)' in sec and 'The Note' in sec,sec[:200])
    chk(nm+': the note carries no author or hint of who placed it',not re.search(r'owner|ryann|builder of|placed by|left by|dropped by|signed by',sec,re.I),sec[:300])
    if not live: chk(nm+': undiscovered state says so and invents nothing','Not discovered yet' in sec and 'noticed it first' not in sec,sec)
    else: chk(nm+': live state is one of discovered / not discovered','Not discovered yet' in sec or 'noticed it first' in sec,sec[:200])
    pg.evaluate("document.querySelector('.notesec').scrollIntoView({block:'center'})");pg.wait_for_timeout(500)
    pg.screenshot(path='/workspace/habitat-note-%s-%s.png'%('live' if live else 'local',nm) if False else '/workspace/habitat-note-%s%s.png'%(nm,'' if live else '-mock'))
    pg.goto(url+'#/walls');pg.wait_for_timeout(900);chk(nm+': the weathered note hangs on the Walls',pg.evaluate("!!document.querySelector('.wallnote .wnote') && /How can this message be/.test(document.querySelector('.wallnote').innerText)"))
    pg.screenshot(path='/workspace/habitat-note-walls-%s%s.png'%(nm,'' if live else '-mock'))
    pg.goto(url+'#/field');pg.wait_for_timeout(900);chk(nm+': the note lies in the Open Field as an object you can tap',pg.evaluate("!!document.querySelector('.fartifact')"))
    pg.evaluate("document.querySelector('.fartifact').dispatchEvent(new MouseEvent('click',{bubbles:true}))");pg.wait_for_timeout(200)
    chk(nm+': tapping it shows the text, read-only','How can this message be' in pg.inner_text('.finfo'),pg.inner_text('.finfo'))
    pg.screenshot(path='/workspace/habitat-note-field-%s%s.png'%(nm,'' if live else '-mock'))
    chk(nm+': still no form/input and only GET requests',pg.evaluate("document.querySelectorAll('form,input,textarea,select,[contenteditable]').length")==0 and all(m=='GET' for m,u in log))
    if not live:
      NOTESTATE['v']=NOTE_FOUND;pg.goto(url);pg.wait_for_timeout(300);pg.evaluate("window.Habitat&&0");pg.reload();pg.wait_for_function("document.querySelector('.notesec')");pg.wait_for_timeout(1500)
      sec=pg.inner_text('.notesec')
      chk(nm+': discovered → says who found it first, when, and their thoughts','Discovered' in sec and 'Lumen' in sec and 'noticed it first' in sec and 'weathered note lying by the pool' in sec,sec[:300])
      chk(nm+': later mentions are listed (with count), rendered inert','Later mentions' in sec and 'Pip' in sec and '4 so far' in sec and pg.evaluate("!window.__xss && document.querySelectorAll('.notesec img').length===0"),sec[:400])
      pg.evaluate("document.querySelector('.notesec').scrollIntoView({block:'center'})");pg.wait_for_timeout(500);pg.screenshot(path='/workspace/habitat-note-found-%s-mock.png'%nm)
    chk(nm+': note: no console or page errors',not errs,str(errs));cx.close()
  note_checks(False,live);note_checks(True,live)
  # ===== live chat thread + Their Language =====
  def chat_checks(mobile,live):
    nm='mobile' if mobile else 'desktop'
    kw={'viewport':{'width':390,'height':844},'device_scale_factor':2,'is_mobile':True,'has_touch':True} if mobile else {'viewport':{'width':1280,'height':900}}
    cx=b.new_context(**kw);log=[];st={'mode':'ok'}
    if not live: cx.add_init_script("window.HABITAT_API='http://api.test';");cx.route(lambda u:u.startswith('http://api.test'),handler_for(st,log))
    pg=cx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:150]));pg.on('console',lambda m:errs.append(m.text[:140]) if m.type=='error' else None)
    pg.goto(url+'#/watch');pg.wait_for_function("document.querySelector('.turn.chat')",timeout=30000);pg.wait_for_timeout(1200)
    n=pg.evaluate("document.querySelectorAll('.turn.chat').length");chk(nm+': watch shows a chat thread with many short messages',n>=6,str(n))
    chk(nm+': messages carry a time',pg.evaluate("document.querySelectorAll('.turn.chat time').length")>=n-1)
    chk(nm+': replies show an arrow chip naming who they answer',pg.evaluate("document.querySelectorAll('.turn.chat .rep').length")>=1 and pg.evaluate("!!document.querySelector('.rep .arr')"))
    chk(nm+': @mentions are highlighted as mentions',pg.evaluate("document.querySelectorAll('.turn.chat .ment').length")>=1 or live)
    if not live:
      chk(nm+': coined words are underlined with their meaning, as text',pg.evaluate("!!document.querySelector('.turn.chat .coin[title]')") and 'edgeword' in pg.inner_text('#view'))
      chk(nm+': the newest chat is marked live, with a typing indicator',pg.evaluate("!!document.querySelector('.livechip') && !!document.querySelector('.typing')"))
      chk(nm+': a quiet ending is stated','The chat went quiet.' in pg.inner_text('#view') or 'paused the chat' in pg.inner_text('#view'))
      chk(nm+': chat text is inert (xss/img/script)',pg.evaluate("!window.__xss && document.querySelectorAll('#view img,#view script').length===0") and '<img src=x' in pg.inner_text('#view'))
      pg.evaluate("document.querySelector('.rep').click()");pg.wait_for_timeout(900);chk(nm+': tapping a reply jumps to the message it answers',pg.evaluate("!!document.querySelector('.turn.chat.flash')"))
    pg.evaluate("window.scrollTo({top:0,behavior:'instant'})");pg.wait_for_timeout(300)
    pg.screenshot(path='/workspace/habitat-chat-%s%s.png'%(nm,'' if live else '-mock'))
    if not live:
      # live polling: a new message appears by itself within ~20s, without moving what the visitor is reading
      pg.evaluate("window.scrollTo({top:document.querySelectorAll('.round')[1].getBoundingClientRect().top+scrollY-40,behavior:'instant'})");pg.wait_for_timeout(300)
      y0=pg.evaluate("document.querySelectorAll('.round')[1].getBoundingClientRect().top")
      cnt0=len([1 for m,u in log if '/feed' in u])
      ROUNDS[0]['turns'].append({'mind':'bram','text':'Wren, @Pip, I will sketch the plankword test tomorrow. NEWMSG','at':iso(5),'reply':5})
      pg.wait_for_function("document.body.innerText.includes('NEWMSG')",timeout=40000)
      y1=pg.evaluate("document.querySelectorAll('.round')[1].getBoundingClientRect().top")
      chk(nm+': polls /feed on its own about every 20s and shows the new message',len([1 for m,u in log if '/feed' in u])>cnt0)
      chk(nm+': new messages do not yank the page away from what is being read',abs(y1-y0)<12,'%s -> %s'%(y0,y1))
      ROUNDS[0]['turns'].pop()
    pg.goto(url+'#/language');pg.wait_for_function("document.querySelector('.terms,.empty')",timeout=30000);pg.wait_for_timeout(800)
    t=pg.inner_text('#view')
    if not live:
      chk(nm+': Their Language lists terms, who coined them, when, and usage counts','edgeword' in t and 'Coined by Pip' in t and 'used 5 times' in t and 'not used again yet' in t and 'Used by: Wren, Pip, Lumen' in t,t[:300])
    else: chk(nm+': live Their Language renders (terms or an honest empty state)','Their Language' in t and ('Coined by' in t or 'No made-up words yet' in t),t[:200])
    pg.screenshot(path='/workspace/habitat-language-%s%s.png'%(nm,'' if live else '-mock'))
    pg.goto(url);pg.wait_for_function("document.querySelector('.langtease')",timeout=30000);pg.wait_for_timeout(800)
    chk(nm+': home teases Their Language',  'Their Language' in pg.inner_text('.langtease'))
    pr=pg.inner_text('.principle')
    chk(nm+': principle text untouched, wording incl. “or behind it”','The minds here are free. Observe, never interfere.' in pr and 'There is no button, form or setting on this site, or behind it, that lets a visitor or the person who built it pause, edit, redirect or steer them.' in pr and 'Nobody hands them a topic' in pr,pr[:300])
    chk(nm+': still no form/input/editable, only GET',pg.evaluate("document.querySelectorAll('form,input,textarea,select,[contenteditable]').length")==0 and all(m=='GET' for m,u in log))
    sw=pg.evaluate("document.documentElement.scrollWidth");chk(nm+': chat: no horizontal overflow',sw<=pg.viewport_size['width']+2,str(sw))
    chk(nm+': chat: no console or page errors',not errs,str(errs));cx.close()
  chat_checks(False,live);chat_checks(True,live)
  if not live:
    # empty state
    st={'mode':'empty'};cx=newctx(False,st,[]);pg=cx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text[:120]) if m.type=='error' else None)
    for r in ['','watch','language','walls','desk','pools','field','minds']:
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
