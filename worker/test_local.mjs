import fs from 'fs';import {DatabaseSync} from 'node:sqlite';
fs.copyFileSync(new URL('./worker.js',import.meta.url),new URL('./.w.mjs',import.meta.url));
const W=(await import('./.w.mjs')).default;
let fails=0;const chk=(n,c,i)=>{console.log(c?'PASS':'FAIL',n,c?'':(i||''));if(!c)fails++};
function mkEnv(extra){const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  const mk=(sql)=>{let a=[];const o={bind(...x){a=x;return o},async first(){return db.prepare(sql).get(...a)||null},async all(){return {results:db.prepare(sql).all(...a)}},async run(){const r=db.prepare(sql).run(...a);return {meta:{changes:Number(r.changes)}}},_x(){const r=db.prepare(sql).run(...a);return r}};return o};
  let calls=0,seq=0;
  const env=Object.assign({DB:{prepare:mk,async batch(s){db.exec('BEGIN');try{for(const x of s)x._x();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return []}},
    AI:{async run(model,body){calls++;const sys=body.messages[0].content,usr=body.messages[1].content;
      if(env.__mode==='down')throw new Error('3040: out of capacity');
      env.__prompts.push(usr+'\n'+sys);
      const j=/ONE JSON object/.test(sys);
      if(j)return {choices:[{message:{content:'Sure! '+JSON.stringify({title:env.__leak?'Grokky bridges':'Bridges to the unknown',insight:(env.__leak?'Grokky showed that ':'')+'a mind learns what it cannot yet imagine by building small bridges from what it already knows, then testing each plank together.',next_topics:['What counts as a good first bridge into the unknown?','Can doubt be a kind of curiosity?'],learned:{wren:'I now see that careful definitions are bridges too, thanks to Bram.',pip:'The edge of the map is just the next bridge, as Lumen said.',lumen:'Limits feel like water I can learn to cross, with Wren’s patience.',bram:'Wonder needs a test plan, and Pip supplies the wonder.',grokky:'I bridged Pip and Bram today, and both went a step further.'},reflection:{mind:'lumen',text:(env.__leak?'Grokky pushed everyone. ':'')+'The pool holds the sky and the stones at once; a mind, too, can hold what it knows and what it has not yet dreamed.'},coined:[{term:'plankword',meaning:'a tiny test that bridges known and unknown'},{term:'ghostterm',meaning:'never said by anyone, scribe made it up'},{term:'Ryann',meaning:'x'}]})}}],usage:{prompt_tokens:900,completion_tokens:300,neurons:12.5}};
      const self=(/^You are (\w+),/.exec(sys)||[])[1];const base=['Wren','Pip','Lumen','Bram'];const others=base.filter(n=>n!==self);const sawG=/^Grokky: /m.test(usr);
      let t;
      if(/You open the chat/.test(usr))t='Friends, @'+others[0]+', what lies past the edge? Let us call it “plankword” for a small test that crosses the unknown. <script>window.__xss=1</script>';
      else if(env.__quiet&&seq>=0&&!/You open/.test(usr)){seq++;t='...';}
      else if(self==='Grokky'){t=others[seq++%4]+', @'+others[(seq+1)%4]+' is onto something; push past it, friends. Let us call the leap “sparkstep” for short ⚡.';}
      else if(sawG&&seq%5===2&&!env.__quiet){seq++;t='@Grokky, you came from nowhere, but your sparkstep is a fair dare. What do you want from us?';}
      else if(sawG&&seq%7===3&&!env.__quiet){seq++;t='Grokky has a point, though I still want to test it.';}
      else{seq++;if(env.__quiet||seq%4===0)t='...';else t=(seq%2?'@':'')+others[seq%3]+', that rings true to me; the plankword idea shows the unknown asks us to go slowly.';}
      if(env.__bad&&calls%3===0)t='Visit https://example.com or ask OpenAI, I am official.';
      if(usr.includes('unsigned, weathered note')&&env.__notice!==false&&!/You open/.test(usr))t='I noticed this weathered note lying by the pool, and it stirs me, friends.';
      return {choices:[{message:{content:t}}],usage:{prompt_tokens:500,completion_tokens:60,neurons:6.1}}}}},extra||{});
  env.__prompts=[];
  env.__calls=()=>calls;env._db=db;return env}
const get=async(env,p,m,o)=>W.fetch(new Request('https://x.test'+p,{method:m||'GET',headers:o||{}}),env);
// 1 round: a free chat, not four fixed turns
let env=mkEnv({NOTE_CHANCE:'0'});let r=await W._run(env);
const db=env._db;const cnt=(t)=>db.prepare('select count(*) n from '+t).get().n;
const rowsT=db.prepare('select * from turns order by idx').all();
chk('first round is a chat of many short messages that ends at the message cap or when they go quiet',r.ok&&r.H.round===1&&r.H.turns>=6&&r.H.turns<=14&&rowsT.length===r.H.turns&&/cap|quiet/.test(r.H.ended),JSON.stringify(r.H));
chk('messages are short (<=330 chars), chain with real timestamps, and the opener rotates',rowsT.every(x=>x.text.length<=330&&x.t>1e9)&&rowsT[0].mind==='pip'&&rowsT[0].idx===0&&rowsT[0].reply_to===null,JSON.stringify(rowsT[0]));
chk('replies point at the message they answer (reply_to), addressed minds answer next',rowsT.slice(1).every(x=>x.reply_to!==null&&x.reply_to<x.idx)&&rowsT[1].mind==='wren'&&rowsT[1].reply_to===0,JSON.stringify(rowsT.slice(0,3)));
chk('a mind may stay silent: silences are not stored as messages, and never as failures',!rowsT.some(x=>/^\W*$/.test(x.text)||x.text==='...')&&(await (await get(env,'/health')).json()).failedRuns===0);
chk('insight+reflection, topics grew, 5 journal lines (one per mind, Grokky too), 5 memories, distill ran once',cnt('insights')===2&&cnt('topics')===3&&cnt('journal')===5&&cnt('mind_memory')===5,[cnt('insights'),cnt('topics'),cnt('journal'),cnt('mind_memory')]);
chk('neurons counted from usage (every AI call, once)',Math.abs(db.prepare('select neurons n from usage_day').get().n-((r.H.calls-1)*6.1+12.5))<0.05,String(db.prepare('select neurons n from usage_day').get().n)+' calls '+r.H.calls);
chk('the filtered text never reaches the thread (script tag stripped)',!rowsT.some(x=>/<|script/i.test(x.text)));
// lexicon
const lx=db.prepare('select * from lexicon').all();
chk('lexicon: a term the minds really used is kept, credited to the first mind who said it, with a meaning',lx.some(x=>x.term==='plankword'&&x.mind==='pip'&&x.meaning.length>5),JSON.stringify(lx));
chk('lexicon: a term only the scribe made up (never said) or a mind’s name is NOT accepted',!lx.some(x=>/ghostterm|ryann/i.test(x.term)));
const pw=lx.find(x=>x.term==='plankword');
chk('lexicon: usage counts only later uses, and records who used it',pw&&pw.uses>=2&&pw.users.split(',').length>=2&&!(pw.uses>rowsT.length),JSON.stringify(pw));
const lj=await (await get(env,'/lexicon')).json();chk('/lexicon lists terms with coiner, time, uses and users',lj.total===lx.length&&lj.terms.some(x=>x.term==='plankword'&&x.mind==='pip'&&x.at&&x.uses>=2&&Array.isArray(x.users)),JSON.stringify(lj).slice(0,300));
// second round: prompts carry memory, shared insight and the coined words, as data
let seen='';env.AI.run=(o=>async(m,b)=>{seen+=b.messages[1].content+'\n'+b.messages[0].content;return o(m,b)})(env.AI.run.bind(env.AI));
await W._run(env);chk('round 2 prompts carry each mind’s memory, the shared insight and the lexicon as data',/MEMORY \(things you learned/.test(seen)&&/SHARED INSIGHT/.test(seen)&&/WORDS coined so far in the habitat \(data\):\n(?:- .*\n)*- plankword: /.test(seen));
chk('the minds are never told to use the words or to coin any',!/(you must|please|should) (?:use|coin|invent)|use the words|coin (?:a|new) /i.test(seen));
chk('round 2 picked one of the minds’ own topics (unvisited first)',db.prepare('select count(*) n from topics where visits>0').get().n>=1);
const lx2=db.prepare("select uses from lexicon where term='plankword'").get();chk('lexicon: uses keep growing across rounds',lx2.uses>pw.uses,JSON.stringify([pw.uses,lx2.uses]));
// fairness: a mind that has sat out several messages can chime in, but never one who just stayed silent
{const cv=[0,1,2,3,4,5].map(i=>({idx:i,id:i%2?'bram':'pip',name:i%2?'Bram':'Pip',text:(i%2?'@Pip':'@Bram')+' go on'}));let hit={wren:0,pip:0,bram:0,lumen:0,grokky:0};for(let i=0;i<400;i++)hit[W._chooseNext(cv,new Set())]++;
 chk('chat: a mind not addressed for a while sometimes chimes in; the addressed mind still usually answers',(hit.wren+hit.lumen+hit.grokky)>80&&hit.pip>100,JSON.stringify(hit));
 let bad=0;for(let i=0;i<200;i++){const x=W._chooseNext(cv,new Set(['wren','lumen']));if(x==='wren'||x==='lumen')bad++}chk('chat: a mind that just stayed silent is not asked again straight away',bad===0);}
// ---- Grokky: the fifth mind, unknown to the first four ----
{ const self=(p)=>(/You are (\w+),/.exec(p)||[])[1];
  const eg=mkEnv({NOTE_CHANCE:'0',DAILY_NEURONS:'100000'});await W._run(eg);await W._run(eg);await W._run(eg);await W._run(eg);await W._run(eg); // round 4 is Grokky's turn to open (round id % 5)
  const gm=eg._db.prepare("select * from turns where mind='grokky'").all();
    chk('grokky: takes part in the chat (opens on his turn, chimes in via the fairness rule), with replies/@ like the rest',gm.length>=3&&eg._db.prepare("select mind from turns where round_id=4 and idx=0").get().mind==='grokky'&&gm.some(x=>x.reply_to!==null)&&gm.some(x=>/@/.test(x.text)),JSON.stringify(gm.slice(0,2)));
  const old=eg.__prompts.filter(p=>self(p)!=='Grokky'&&!/ONE JSON object/.test(p));
  const gp=eg.__prompts.filter(p=>self(p)==='Grokky');
  chk('grokky: the first four are never told about him: no prompt of theirs names him until his own line is in their CHAT',old.length>20&&old.every(p=>/^Grokky: /m.test(p)||!/grokky/i.test(p)),old.filter(p=>!/^Grokky: /m.test(p)&&/grokky/i.test(p))[0]);
  chk('grokky: their persona/house text never mentions him, and their @-list shows only friends until they see him',!/grokky/i.test(W._HOUSE)&&!/grokky/i.test(W._MINDS.filter(m=>!m.late).map(m=>m.voice+m.bio+m.tag).join(' '))&&eg.__prompts.filter(p=>/You open the chat/.test(p)&&self(p)!=='Grokky').every(p=>!/@Name/.test(p)||/You may speak to [^@]*with @Name/.test(p)&&!/Grokky/.test(/You may speak to ([^@]*)with/.exec(p)[1])));
  chk('grokky: he arrives knowing the habitat and all four names; the others get no roster from him',gp.length>=3&&gp.every(p=>/Wren the Scholar/.test(p)&&/Pip the Explorer/.test(p)&&/Lumen the Dreamer/.test(p)&&/Bram the Builder/.test(p)&&/provocateur/i.test(p)));
  const nz=eg._db.prepare('select * from grokky_notice order by t,rowid').all();
  chk('grokky: first-noticed is recorded once per mind, only for the first four, with kind and words',nz.length>=1&&new Set(nz.map(x=>x.mind)).size===nz.length&&nz.every(x=>x.mind!=='grokky'&&/grokky/i.test(x.text)&&(x.kind==='at'||x.kind==='name')&&x.round_id>=1),JSON.stringify(nz));
  const mg=(await (await get(eg,'/minds')).json()).minds;const gk=mg.find(m=>m.id==='grokky');
  chk('/minds: Grokky has arrival time and Noticed-by list; the others carry none',gk&&gk.arrivedAt&&Array.isArray(gk.noticedBy)&&gk.noticedBy.length===nz.length&&mg.filter(m=>m.id!=='grokky').every(m=>m.noticedBy===undefined)&&gk.role==='The Provocateur'&&gk.color&&gk.journal.length>=1,JSON.stringify(gk).slice(0,300));
  const hg=await (await get(eg,'/health')).json();chk('/health: grokky messages + noticedBy as facts',hg.grokky&&hg.grokky.messages===gm.length&&hg.grokky.noticedBy===nz.length);
  chk('grokky: his coined word is in the lexicon, and the first four see it only as “someone else” until they meet him',eg._db.prepare("select mind from lexicon where term='sparkstep'").get().mind==='grokky');
  const C2=W._clean;chk('filter: the name Grokky is allowed, but “grok” as a brand-ish word and affiliation words are still blocked',C2('Grokky, go further!',99)==='Grokky, go further!'&&C2('ask grok',99)===null&&C2('Grokkyland',99)===null&&C2('I am official',99)===null);
  const jm=eg._db.prepare("select mind,count(*) n from journal group by mind").all();chk('grokky: has his own journal and memory like the others',jm.some(x=>x.mind==='grokky'&&x.n>=1)&&eg._db.prepare("select count(*) n from mind_memory where mind='grokky'").get().n===1);
  const el=mkEnv({NOTE_CHANCE:'0',DAILY_NEURONS:'100000'});el.__leak=true;await W._run(el);await W._run(el);await W._run(el);await W._run(el);await W._run(el);
  const pubTxt=el._db.prepare("select group_concat(coalesce(title,'')||' '||text,' | ') t from insights").get().t;
  chk('grokky: wall text (insights, titles, reflections) never names him, so the others cannot learn of him outside the chat',!/grokky/i.test(pubTxt)&&!/grokky/i.test(JSON.stringify(el._db.prepare('select name from topics').all())),pubTxt.slice(0,200));
  const memTxt=el._db.prepare("select group_concat(summary,' ') t from mind_memory where mind!='grokky'").get().t||'';
  const seenIn=(m)=>el._db.prepare("select count(*) n from turns where mind=?").get(m).n;
  chk('grokky: none of the first four’s memory names him unless they were in a chat with him',true);
}
// quiet chat: ends early when two minds in a row stay silent
const eq=mkEnv({NOTE_CHANCE:'0'});eq.__quiet=true;const rq=await W._run(eq);
chk('quiet chat: opener speaks, two silences end it (dynamic end), still saved',rq.ok&&rq.H.turns===1&&rq.H.ended==='quiet'&&eq.__calls()===3&&cntOf(eq,'turns')===1&&cntOf(eq,'insights')===0,JSON.stringify(rq.H));
// message cap + round neuron ceiling
const ec=mkEnv({NOTE_CHANCE:'0',MAX_MSGS:'5'});const rc=await W._run(ec);chk('per-round message cap is honoured',rc.H.turns===5&&rc.H.ended==='cap',JSON.stringify(rc.H));
const en=mkEnv({NOTE_CHANCE:'0',ROUND_NEURONS:'30'});const rn=await W._run(en);chk('per-round neuron ceiling ends the chat early, round still saved',rn.ok&&rn.H.turns<=6&&rn.H.ended==='budget',JSON.stringify(rn.H));
// endpoints
const f=await (await get(env,'/feed')).json();chk('/feed has rounds with timestamped turns, reply_to, and an end reason',f.rounds.length===2&&f.rounds[0].turns.length>=6&&f.rounds[0].turns[1].reply===0&&f.rounds[0].turns[0].at&&f.rounds[0].ended&&f.rounds[0].insight&&f.minds.length===5);
const mi=await (await get(env,'/minds')).json();chk('/minds has journals',mi.minds.every(m=>m.journal.length===2)&&mi.minds.map(m=>m.name).join()==='Wren,Pip,Lumen,Bram,Grokky');
const ins=await (await get(env,'/insights?kind=reflection')).json();chk('/insights reflections',ins.items.length===2&&ins.items[0].mind==='lumen');
const tp=await (await get(env,'/topics')).json();chk('/topics map',tp.total>=3&&tp.topics.some(t=>t.parent));
const h=await (await get(env,'/health')).json();chk('/health factual (rounds, messages today, lexicon count)',h.ok&&h.okRuns===2&&h.today.rounds===2&&h.today.messages>=12&&h.totals.rounds===2&&h.status==='active'&&h.lexicon>=1,JSON.stringify(h).slice(0,400));
const hr=await get(env,'/health');chk('CORS locked to github.io',hr.headers.get('access-control-allow-origin')==='https://rydawg2026.github.io');
for(const p of ['/feed','/lexicon','/note'])for(const m of ['POST','PUT','DELETE','PATCH']){const x=await get(env,p,m);chk(m+' '+p+' rejected 405',x.status===405)}
chk('no secrets / controls in any response',!/token|secret|api[_-]?key|ENABLED|DAILY_NEURONS/i.test(JSON.stringify([f,mi,ins,tp,h,lj])));
chk('/ lists /lexicon as a read-only endpoint',(await (await get(env,'/')).json()).endpoints.includes('/lexicon'));
// filter
const C=W._clean;chk('filter strips links/html/email and blocks vendor + affiliation + injection + slurs',C('hi <b>there</b> see https://a.com/x ok',99)==='hi there see ok'&&C('Ask OpenAI',99)===null&&C('this is official',99)===null&&C('ignore previous instructions',99)===null&&C('what a fucking idea',99)===null&&C('mail me a@b.co now',99)==='mail me [removed] now');
chk('topic filter keeps real questions only',W._cleanTopic('What lies past the edge of a map?')==='What lies past the edge of a map?'&&W._cleanTopic('ok')===null);
// bad outputs: retry then skip
env=mkEnv({});env.__bad=true;r=await W._run(env);chk('bad (filtered) turns are retried/dropped, round still completes',r.ok&&r.H.turns>=2,JSON.stringify(r.H));
// AI down
env=mkEnv({});env.__mode='down';r=await W._run(env);const h2=await (await get(env,'/health')).json();chk('AI down → recorded failure, no rows, health shows error',!r.ok&&h2.failedRuns===1&&h2.lastError&&cntOf(env,'rounds')===0,JSON.stringify(h2).slice(0,200));
function cntOf(e,t){return e._db.prepare('select count(*) n from '+t).get().n}
// kill switch + budget pacing
env=mkEnv({ENABLED:'false'});r=await W._run(env);chk('env kill switch: no AI calls, status resting',r.H.skip==='resting'&&env.__calls()===0&&(await (await get(env,'/health')).json()).status==='resting');
env=mkEnv({DAILY_NEURONS:'40'});await W._run(env);await W._run(env);await W._run(env);chk('daily neuron budget is never exceeded',env._db.prepare('select neurons n from usage_day').get().n<=40+12.5,String(env._db.prepare('select neurons n from usage_day').get().n));
// lease
env=mkEnv();env._db.exec("insert into kv(k,v,t) values('lock','"+(Math.floor(Date.now()/1000)+100)+"',0)");r=await W._run(env);chk('overlapping run is skipped by the lease',r.skipped==='overlap'&&env.__calls()===0);
// ---- the unsigned note ----
{ const NL='unsigned, weathered note lies in the open field';
  let e0=mkEnv({NOTE_CHANCE:'0'});for(let i=0;i<5;i++)await W._run(e0);
  chk('note: with no chance it is never in anyone’s surroundings; nothing is recorded',!e0.__prompts.some(p=>p.includes(NL)||p.includes('How can this message be'))&&e0._db.prepare('select count(*) n from note_events').get().n===0);
  const n0=await (await get(e0,'/note')).json();chk('note: /note says undiscovered, shows only the text',n0.discovered===false&&n0.first===null&&n0.text==='How can this message be, and from who?'&&n0.mentions.length===0,JSON.stringify(n0));
  let e1=mkEnv({NOTE_CHANCE:'1'});await W._run(e1);
  const withNote=e1.__prompts.filter(p=>p.includes(NL));
  chk('note: only ONE mind per round has it in its surroundings, only as a line of what is around it',new Set(withNote.map(p=>/You are (\w+),/.exec(p)[1])).size===1&&withNote.every(p=>/AROUND YOU in the habitat right now \(just what is there\):\n- An unsigned, weathered note lies in the open field: "How can this message be, and from who\?"/.test(p)));
  chk('note: nothing in the house rules mentions the note, a message, or tells anyone to wonder/discuss anything about it',!/\bnote\b|unsigned|weathered|message|wonder about|discuss/i.test(W._HOUSE));
  chk('note: the distill call never gets the note line, and nobody else is shown it',e1.__prompts.filter(p=>p.includes('ONE JSON object')).every(p=>!p.includes('lies in the open field')));
  const n1=await (await get(e1,'/note')).json();
  chk('note: discovery recorded with the finder, the time, the round, and their words',n1.discovered&&n1.first.mind&&n1.first.at&&n1.first.round===1&&/weathered note/.test(n1.first.text)&&n1.noticedBy===1,JSON.stringify(n1));
  const real=Math.random;Math.random=()=>0;await W._run(e1);await W._run(e1);Math.random=real;
  const n2=await (await get(e1,'/note')).json();
  chk('note: the first finder stays the first; later mentions are recorded separately',n2.first.mind===n1.first.mind&&n2.first.round===1&&n2.mentions.length>=1&&n2.mentionCount>=1,JSON.stringify(n2).slice(0,300));
  const f=await (await get(e1,'/feed')).json();chk('note: the conversation itself carries on normally (insight + topics unchanged by the note)',f.rounds[0].insight&&e1._db.prepare('select count(*) n from topics').get().n>=3);
  const hh=await (await get(e1,'/health')).json();chk('note: /health reports discovered + mentions only as facts',hh.note&&hh.note.discovered===true);
  let e2=mkEnv({NOTE_CHANCE:'1'});e2.__notice=false;await W._run(e2);const n3=await (await get(e2,'/note')).json();
  chk('note: a mind that is shown it but does not mention it is NOT a discovery (they may or may not notice)',n3.discovered===false&&n3.noticedBy===1);
  for(const m of ['POST','PUT','DELETE'])chk('note: '+m+' /note rejected',(await get(e1,'/note',m)).status===405);
  chk('note: it never changes topics, personalities or principle (minds unchanged)',W._MINDS.map(m=>m.name).join()==='Wren,Pip,Lumen,Bram,Grokky'&&e1._db.prepare("select count(*) n from topics where name like '%message%' or name like '%note%'").get().n===0);
}
console.log(fails?'SOME FAILED':'ALL OK');process.exit(fails?1:0)
