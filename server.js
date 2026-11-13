'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const DIR = path.join(__dirname, 'public');
const rooms = new Map();
const MAX_PLAYERS = 10;
const randomId = (bytes=12) => crypto.randomBytes(bytes).toString('hex');
const makeCode = () => { let c; do { c = String(crypto.randomInt(100000,999999)); } while(rooms.has(c)); return c; };
const QUIZ = [
  {q:'Hvilket år vandt Danmark EM i fodbold?',options:['1988','1992','1996','2000'],correct:1},
  {q:'Hvor mange felter er der på et almindeligt skakbræt?',options:['48','56','64','72'],correct:2},
  {q:'Hvilket grundstof har symbolet Au?',options:['Sølv','Guld','Aluminium','Argon'],correct:1},
  {q:'Hvilken by var vært for sommer-OL i 2012?',options:['Beijing','Rio','London','Athen'],correct:2},
  {q:'Hvor mange sider har en regulær dodekaeder?',options:['8','10','12','20'],correct:2}
];
const MINORITY = [
  {q:'Du skal vælge én fordel til resten af spillet:',options:['Se modstandernes valg','Få dobbelt point i næste runde']},
  {q:'Hvad ville være mest værd i en finale?',options:['Et sikkert forspring','Et sidste stort sats']},
  {q:'Hvad vælger du i en duel?',options:['Den stærkeste makker','Den svageste modstander']},
  {q:'Du får et hemmeligt kort. Hvad håber du på?',options:['Stjæl 100 point','Beskyt 200 point']}
];
const DILEMMA = [
  {q:'Runde 1: Kan din makker stoles på?'},
  {q:'Runde 2: Løfter gælder kun, hvis du holder dem.'},
  {q:'Runde 3: Nu begynder alliancerne at knage.'},
  {q:'Runde 4: Sidste chance for at være loyal ... eller iskold.'}
];
const FINAL = [
  {q:'Hvad er det mindste primtal større end 100?',options:['101','103','107','109'],correct:0},
  {q:'Hvor mange lande har en landegrænse med Tyskland?',options:['7','8','9','10'],correct:2},
  {q:'Hvilket år faldt Berlinmuren?',options:['1987','1988','1989','1991'],correct:2}
];
const ROUNDS = [
  {name:'Høj risiko',type:'quiz',prompts:QUIZ,seconds:45,description:'Svar rigtigt: +80 bonus og din indsats. Svar forkert: du mister indsatsen. Sats 0-200 point.'},
  {name:'Mindretallet bestemmer',type:'minority',prompts:MINORITY,seconds:35,description:'Vælg A eller B. Det mindste hold får +250. Det største får +50. Lige store hold får +120 hver.'},
  {name:'Tillid eller forræderi',type:'dilemma',prompts:DILEMMA,seconds:45,description:'I spiller parvis. Begge deler: +200 hver. En stjæler: +350 til tyven og -100 til den anden. Begge stjæler: -150 hver.'},
  {name:'Alt eller intet',type:'quiz',prompts:FINAL,seconds:50,description:'Sidste 3 spørgsmål. Sats op til 600 point! Rigtigt: +100 bonus og din indsats. Forkert: minus indsatsen.'}
];
const send = (res,status,obj) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
function roomView(room,token,host=false) {
 const p=room.players.find(x=>x.token===token);
 const round=ROUNDS[room.roundIndex] || null;
 const prompt=round && round.prompts[room.questionIndex] || null;
 const reveal = room.phase==='reveal' || room.phase==='finished';
 const tally={}; for (const [id,answer] of Object.entries(room.answers)) tally[id]=!!answer;
 const players=room.players.map(x=>({id:x.id,name:x.name,score:x.score,answered:!!room.answers[x.id],online:Date.now()-x.seen<120000}));
 const obj={code:room.code,phase:room.phase,roundIndex:room.roundIndex,questionIndex:room.questionIndex,totalRounds:ROUNDS.length,round:round&&{name:round.name,type:round.type,description:round.description,length:round.prompts.length,seconds:round.seconds},prompt:prompt&&{q:prompt.q,options:prompt.options||null},players,answered:Object.keys(room.answers).length,deadline:room.deadline,events:room.events.slice(-10),maxPlayers:MAX_PLAYERS,results:reveal?room.results:null,me:p?{id:p.id,name:p.name,score:p.score}:null,host};
 if(room.phase==='open' && round?.type==='dilemma' && p) {
   const pair=room.pairs.find(g=>g.includes(p.id)); const other=pair&&pair.find(id=>id!==p.id);
   obj.opponent=other ? room.players.find(x=>x.id===other)?.name : null;
   obj.bye=!!pair && pair.length===1;
 }
 if(p && room.phase==='open') obj.myAnswer=room.answers[p.id] || null;
 if(host && room.phase==='open' && round?.type==='dilemma') obj.pairs=room.pairs.map(pair=>pair.map(id=>room.players.find(x=>x.id===id)?.name));
 return obj;
}
function notify(room) {for(const cl of Array.from(room.clients)) {try {cl.res.write('data: '+JSON.stringify(roomView(room,cl.token,cl.host))+'\n\n');}catch{room.clients.delete(cl);}}}
function log(room,message){room.events.push(message); if(room.events.length>30)room.events.shift();}
function beginQuestion(room){
 clearTimeout(room.timer);room.answers={};room.results=null;room.phase='open';
 const round=ROUNDS[room.roundIndex];
 if(round.type==='dilemma'){
  const ids=room.players.map(p=>p.id);
  // Rotate order so that unmatched player varies with odd player counts.
  const offset=room.questionIndex%ids.length;
  const rotated=ids.slice(offset).concat(ids.slice(0,offset));
  room.pairs=[];for(let i=0;i<rotated.length;i+=2)room.pairs.push(rotated.slice(i,i+2));
 }else room.pairs=[];
 room.deadline=Date.now()+round.seconds*1000;
 room.timer=setTimeout(()=>{if(room.phase==='open') reveal(room);},round.seconds*1000);
 log(room,round.name+' — '+(room.questionIndex+1)+'/'+round.prompts.length);
 notify(room);
}
function reveal(room){
 if(room.phase!=='open')return;
 clearTimeout(room.timer);const round=ROUNDS[room.roundIndex];const answers=room.answers;
 const results=[];
 const change=(p,delta,detail)=>{const before=p.score;p.score=Math.max(0,p.score+delta);results.push({id:p.id,name:p.name,delta:p.score-before,detail});};
 if(round.type==='quiz'){
  const correct=round.prompts[room.questionIndex].correct;
  for(const p of room.players){const a=answers[p.id];if(!a){change(p,0,'Intet svar');continue;}
   const right=a.choice===correct;change(p,right?(room.roundIndex===3?100:80)+a.bet:-a.bet,right?'Rigtigt':'Forkert');}
  room.correct=correct;
 } else if(round.type==='minority'){
  const count=[0,0];Object.values(answers).forEach(a=>{if(a.choice===0||a.choice===1)count[a.choice]++;});
  for(const p of room.players){const a=answers[p.id];if(!a){change(p,0,'Intet svar');continue;}
   const other=1-a.choice;const pts=count[a.choice]===count[other]?120:count[a.choice]<count[other]?250:50;
   change(p,pts,pts===250?'Mindretal!':pts===50?'Flertal':'Uafgjort');}
  room.correct=null;
 }else{
  for(const pair of room.pairs){if(pair.length===1){const p=room.players.find(x=>x.id===pair[0]);change(p,100,'Frirunde +100');continue;}
   const [a,b]=pair.map(id=>room.players.find(x=>x.id===id));
   const ca=answers[a.id]?.choice,cb=answers[b.id]?.choice;
   const pts=(mine,theirs)=>mine===undefined?0:mine==='share'?(theirs==='share'?200:theirs==='steal'?-100:0):(theirs==='steal'?-150:theirs==='share'?350:0);
   change(a,pts(ca,cb),`${b.name}: ${cb==='share'?'Delte':cb==='steal'?'Stjal':'Intet svar'}`);
   change(b,pts(cb,ca),`${a.name}: ${ca==='share'?'Delte':ca==='steal'?'Stjal':'Intet svar'}`);
  }
  room.correct=null;
 }
 room.results={changes:results,correct:room.correct,answersCount:Object.keys(answers).length};
 room.phase='reveal';room.deadline=null;notify(room);
}
function next(room){
 if(room.phase==='lobby'){if(room.players.length<2)throw Error('Mindst 2 spillere skal være med.');room.roundIndex=0;room.questionIndex=0;beginQuestion(room);return;}
 if(room.phase!=='reveal')throw Error('Afslør svarene først.');
 room.questionIndex++;
 if(room.questionIndex>=ROUNDS[room.roundIndex].prompts.length){room.roundIndex++;room.questionIndex=0;}
 if(room.roundIndex>=ROUNDS.length){room.phase='finished';room.deadline=null;log(room,'Vinderen er fundet!');notify(room);return;}
 beginQuestion(room);
}
function requireHost(room,key){if(!room||room.hostKey!==key)throw Error('Ugyldig vært-adgang.');}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>20000){reject(Error('For meget data'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'));}catch{reject(Error('Ugyldig JSON'));}});req.on('error',reject);});}
function requestIp(){const nets=os.networkInterfaces();const ips=[];for(const vals of Object.values(nets))for(const v of vals)if(v.family==='IPv4'&&!v.internal)ips.push(v.address);return ips;}
const server=http.createServer(async(req,res)=>{
 let url;try{url=new URL(req.url,'http://local');}catch{return send(res,400,{error:'Ugyldig URL'});}
 try {
  if(url.pathname==='/api/info')return send(res,200,{ips:requestIp(),port:PORT});
  if(url.pathname==='/api/new'&&req.method==='POST'){
   const code=makeCode(),hostKey=randomId(20);
   const room={code,hostKey,players:[],phase:'lobby',roundIndex:0,questionIndex:0,answers:{},pairs:[],results:null,deadline:null,events:[],clients:new Set(),timer:null};rooms.set(code,room);
   return send(res,200,{code,hostKey});
  }
  if(url.pathname==='/api/join'&&req.method==='POST'){
   const b=await readBody(req),room=rooms.get(String(b.code||''));if(!room)throw Error('Rum ikke fundet. Tjek koden.');
   const name=String(b.name||'').trim().slice(0,20).replace(/[<>]/g,'');if(name.length<2)throw Error('Skriv et navn på mindst 2 tegn.');
   let p=room.players.find(x=>x.token===b.token);
   if(!p){if(room.phase!=='lobby')throw Error('Spillet er i gang. Kun tidligere spillere kan genindtræde.');if(room.players.length>=MAX_PLAYERS)throw Error('Rummet er fyldt.');if(room.players.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Navnet er allerede taget.');p={id:randomId(5),token:randomId(16),name,score:500,seen:Date.now()};room.players.push(p);log(room,name+' er med!');}
   p.seen=Date.now();notify(room);return send(res,200,{token:p.token,code:room.code});
  }
  if(url.pathname==='/api/state'){
   const room=rooms.get(url.searchParams.get('code'));if(!room)throw Error('Rum ikke fundet.');
   const host=url.searchParams.get('key')===room.hostKey;
   const token=url.searchParams.get('token');const p=room.players.find(x=>x.token===token);
   if(!host&&!p)throw Error('Du er ikke tilmeldt dette rum.');if(p)p.seen=Date.now();
   return send(res,200,roomView(room,token,host));
  }
  if(url.pathname==='/api/stream'){
   const room=rooms.get(url.searchParams.get('code'));if(!room)return send(res,404,{error:'Rum ikke fundet'});
   const host=url.searchParams.get('key')===room.hostKey;
   const token=url.searchParams.get('token');const p=room.players.find(x=>x.token===token);
   if(!host&&!p)return send(res,403,{error:'Ingen adgang'});
   if(p)p.seen=Date.now();
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});
   const cl={res,token,host};room.clients.add(cl);res.write('retry: 2000\ndata: '+JSON.stringify(roomView(room,token,host))+'\n\n');
   const heartbeat=setInterval(()=>{try{res.write(': ping\n\n');}catch{}},25000);
   req.on('close',()=>{clearInterval(heartbeat);room.clients.delete(cl);});return;
  }
  if(url.pathname==='/api/answer'&&req.method==='POST'){
   const b=await readBody(req),room=rooms.get(String(b.code||''));if(!room)throw Error('Rummet findes ikke.');
   const p=room.players.find(x=>x.token===b.token);if(!p)throw Error('Log ind som spiller først.');
   if(room.phase!=='open')throw Error('Runden er lukket.');
   const round=ROUNDS[room.roundIndex];
   if(round.type==='dilemma'){
    if(!room.pairs.find(pair=>pair.length===2&&pair.includes(p.id)))throw Error('Du har frirunde.');
    if(!['share','steal'].includes(b.choice))throw Error('Ugyldigt valg.');
    room.answers[p.id]={choice:b.choice};
   } else {
    const choice=Number(b.choice);
    if(!Number.isInteger(choice)||choice<0||choice>=(round.type==='minority'?2:4))throw Error('Ugyldigt svar.');
    const bet=round.type==='quiz'?Number(b.bet):0;
    if(round.type==='quiz'&&(!Number.isInteger(bet)||bet<0||bet>Math.min(p.score,room.roundIndex===3?600:200)||bet%50!==0))throw Error('Ugyldig indsats.');
    room.answers[p.id]={choice,bet};
   }
   p.seen=Date.now();notify(room);return send(res,200,{ok:true});
  }
  if(url.pathname==='/api/host'&&req.method==='POST'){
   const b=await readBody(req),room=rooms.get(String(b.code||''));requireHost(room,b.key);
   if(b.action==='next')next(room);
   else if(b.action==='reveal')reveal(room);
   else if(b.action==='reset'){
    clearTimeout(room.timer);room.phase='lobby';room.roundIndex=0;room.questionIndex=0;room.answers={};room.results=null;room.deadline=null;room.pairs=[];room.players.forEach(p=>p.score=500);log(room,'Spillet blev nulstillet.');notify(room);
   }else throw Error('Ukendt handling.');
   return send(res,200,{ok:true});
  }
  if(req.method!=='GET')return send(res,405,{error:'Metode ikke tilladt'});
  let file=url.pathname==='/'?'index.html':url.pathname==='/host'?'host.html':url.pathname.slice(1);
  if(!['index.html','host.html','app.js','style.css'].includes(file))return send(res,404,{error:'Ikke fundet'});
  const full=path.join(DIR,file);const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache'});fs.createReadStream(full).pipe(res);
 }catch(e){if(!res.headersSent)send(res,400,{error:e.message||'Der skete en fejl'});}
});
server.listen(PORT,'0.0.0.0',()=>{
 console.log('\n🎄 JULEFROKOST ROYALE ER KLAR');
 console.log('Vært (på denne computer): http://localhost:'+PORT+'/host');
 for(const ip of requestIp())console.log('Lokalt spillerlink: http://'+ip+':'+PORT);
 console.log('Hold dette terminalvindue åbent under spillet.\n');
});
