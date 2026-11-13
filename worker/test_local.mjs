import fs from 'fs';import {DatabaseSync} from 'node:sqlite';
fs.copyFileSync(new URL('./worker.js',import.meta.url),new URL('./.w.mjs',import.meta.url));
const W=(await import('./.w.mjs')).default;
let fails=0;const chk=(n,c,i)=>{console.log(c?'PASS':'FAIL',n,c?'':(i||''));if(!c)fails++};
function mkEnv(extra){const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  const mk=(sql)=>{let a=[];const o={bind(...x){a=x;return o},async first(){return db.prepare(sql).get(...a)||null},async all(){return {results:db.prepare(sql).all(...a)}},async run(){const r=db.prepare(sql).run(...a);return {meta:{changes:Number(r.changes)}}},_x(){const r=db.prepare(sql).run(...a);return r}};return o};
  let calls=0,mode='ok';
  const env=Object.assign({DB:{prepare:mk,async batch(s){db.exec('BEGIN');try{for(const x of s)x._x();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return []}},
    AI:{async run(model,body){calls++;const sys=body.messages[0].content,usr=body.messages[1].content;
      if(env.__mode==='down')throw new Error('3040: out of capacity');
      const j=/ONE JSON object/.test(sys);
      if(j)return {choices:[{message:{content:'Sure! '+JSON.stringify({title:'Bridges to the unknown',insight:'A mind learns what it cannot yet imagine by building small bridges from what it already knows, then testing each plank together.',next_topics:['What counts as a good first bridge into the unknown?','Can doubt be a kind of curiosity?'],learned:{wren:'I now see that careful definitions are bridges too, thanks to Bram.',pip:'The edge of the map is just the next bridge, as Lumen said.',lumen:'Limits feel like water I can learn to cross, with Wren’s patience.',bram:'Wonder needs a test plan, and Pip supplies the wonder.'},reflection:{mind:'lumen',text:'The pool holds the sky and the stones at once; a mind, too, can hold what it knows and what it has not yet dreamed.'}})}}],usage:{prompt_tokens:900,completion_tokens:300,neurons:12.5}};
      const t=env.__bad&&calls%3===0?'Visit https://example.com or ask OpenAI, I am official.':'Friend, that rings true to me. '+('the unknown asks us to go slowly. '.repeat(6));
      return {choices:[{message:{content:t}}],usage:{prompt_tokens:500,completion_tokens:150,neurons:6.1}}}}},extra||{});
  env.__calls=()=>calls;env._db=db;return env}
const get=async(env,p,m,o)=>W.fetch(new Request('https://x.test'+p,{method:m||'GET',headers:o||{}}),env);
// 1 round
let env=mkEnv();let r=await W._run(env);
chk('first round runs',r.ok&&r.H.round===1&&r.H.turns===4,JSON.stringify(r));
const db=env._db;const cnt=(t)=>db.prepare('select count(*) n from '+t).get().n;
chk('rows written (4 turns, insight+reflection, topics grew, 4 journal lines, 4 memories)',cnt('turns')===4&&cnt('insights')===2&&cnt('topics')===3&&cnt('journal')===4&&cnt('mind_memory')===4,[cnt('turns'),cnt('insights'),cnt('topics'),cnt('journal'),cnt('mind_memory')]);
chk('neurons counted from usage',Math.abs(db.prepare('select neurons n from usage_day').get().n-(4*6.1+12.5))<0.01);
// second round builds on memory: prompt includes memory
let seen='';env.AI.run=(o=>async(m,b)=>{seen+=b.messages[1].content;return o(m,b)})(env.AI.run.bind(env.AI));
await W._run(env);chk('round 2 prompts carry each mind’s memory and the shared insight',/MEMORY \(things you have learned/.test(seen)&&/SHARED INSIGHTS/.test(seen)&&/Bram/.test(seen));
chk('round 2 picked one of the minds’ own topics (unvisited first)',db.prepare('select count(*) n from topics where visits>0').get().n>=2);
// endpoints
const f=await (await get(env,'/feed')).json();chk('/feed has rounds with turns and insight',f.rounds.length===2&&f.rounds[0].turns.length===4&&f.rounds[0].insight&&f.minds.length===4);
const mi=await (await get(env,'/minds')).json();chk('/minds has journals',mi.minds.every(m=>m.journal.length===2)&&mi.minds.map(m=>m.name).join()==='Wren,Pip,Lumen,Bram');
const ins=await (await get(env,'/insights?kind=reflection')).json();chk('/insights reflections',ins.items.length===2&&ins.items[0].mind==='lumen');
const tp=await (await get(env,'/topics')).json();chk('/topics map',tp.total>=3&&tp.topics.some(t=>t.parent));
const h=await (await get(env,'/health')).json();chk('/health factual',h.ok&&h.okRuns===2&&h.today.rounds===2&&h.totals.rounds===2&&h.status==='active',JSON.stringify(h).slice(0,300));
const hr=await get(env,'/health');chk('CORS locked to github.io',hr.headers.get('access-control-allow-origin')==='https://rydawg2026.github.io');
for(const m of ['POST','PUT','DELETE','PATCH']){const x=await get(env,'/feed',m);chk(m+' rejected 405',x.status===405)}
chk('no secrets / controls in any response',!/token|secret|api[_-]?key|ENABLED|DAILY_NEURONS/i.test(JSON.stringify([f,mi,ins,tp,h])));
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
console.log(fails?'SOME FAILED':'ALL OK');process.exit(fails?1:0)
