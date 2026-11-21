const express=require("express"),http=require("http"),{Server}=require("socket.io"),crypto=require("crypto");
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static("public"));
const rooms=new Map(),chipsStart=1000;
const code=()=>crypto.randomBytes(3).toString("hex").toUpperCase();
const clean=s=>String(s||"Người chơi").replace(/[<>]/g,"").trim().slice(0,18)||"Người chơi";
function snapshot(r){return {code:r.code,game:r.game,hostId:r.hostId,status:r.status,message:r.message,players:[...r.players.values()].map(p=>({...p})),bets:r.bets,dice:r.dice};}
function emit(r){io.to(r.code).emit("room:update",snapshot(r));}
function err(s,m){s.emit("app:error",m);}
function deck(){let a=[];for(let suit of ["♠","♥","♦","♣"])for(let n=2;n<=14;n++)a.push({n,suit,v:n===14?"A":n===13?"K":n===12?"Q":n===11?"J":String(n)});return a;}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}}
function rank(hand){
  const values=hand.map(c=>c.n).sort((a,b)=>a-b);
  const counts={}; values.forEach(n=>counts[n]=(counts[n]||0)+1);
  const groups=Object.entries(counts).map(([n,k])=>({n:Number(n),k})).sort((a,b)=>b.k-a.k||b.n-a.n);
  const flush=hand.every(c=>c.suit===hand[0].suit);
  const wheel=values.join(",")==="2,3,4,5,14";
  const straight=values.every((x,i)=>!i||x===values[i-1]+1)||wheel;
  const straightHigh=wheel?5:values[4];
  let score=0,label="Mậu thầu",tie=[...values].sort((a,b)=>b-a);
  if(flush&&straight){score=8;label="Sảnh đồng chất";tie=[straightHigh];}
  else if(groups[0].k===4){score=7;label="Tứ quý";tie=[groups[0].n,groups[1].n];}
  else if(groups[0].k===3&&groups[1].k===2){score=6;label="Cù lũ";tie=[groups[0].n,groups[1].n];}
  else if(flush){score=5;label="Thùng";}
  else if(straight){score=4;label="Sảnh";tie=[straightHigh];}
  else if(groups[0].k===3){score=3;label="Sám cô";tie=[groups[0].n,...groups.slice(1).map(g=>g.n).sort((a,b)=>b-a)];}
  else if(groups[0].k===2&&groups[1].k===2){score=2;label="Hai đôi";tie=[Math.max(groups[0].n,groups[1].n),Math.min(groups[0].n,groups[1].n),groups[2].n];}
  else if(groups[0].k===2){score=1;label="Một đôi";tie=[groups[0].n,...groups.slice(1).map(g=>g.n).sort((a,b)=>b-a)];}
  return {score,label,tie};
}
function cmp(a,b){if(a.score!==b.score)return a.score-b.score;for(let i=0;i<Math.max(a.tie.length,b.tie.length);i++){let d=(a.tie[i]||0)-(b.tie[i]||0);if(d)return d;}return 0;}
io.on("connection",s=>{
s.on("room:create",d=>{let c=code(),p={id:s.id,name:clean(d.name),chips:chipsStart,connected:true};let r={code:c,game:d.game==="poker"?"poker":"taixiu",hostId:s.id,players:new Map([[s.id,p]]),status:"waiting",bets:[],dice:null,message:"Phòng đã tạo. Mời bạn bè tham gia!"};rooms.set(c,r);s.join(c);s.data.room=c;s.emit("room:joined",{room:snapshot(r),playerId:s.id});emit(r);});
s.on("room:join",d=>{let r=rooms.get(String(d.code||"").toUpperCase());if(!r)return err(s,"Không tìm thấy phòng.");if(r.players.size>=8)return err(s,"Phòng đã đủ 8 người.");if(r.status==="playing")return err(s,"Ván đang diễn ra, thử lại sau.");let p={id:s.id,name:clean(d.name),chips:chipsStart,connected:true};r.players.set(s.id,p);s.join(r.code);s.data.room=r.code;s.emit("room:joined",{room:snapshot(r),playerId:s.id});r.message=p.name+" đã tham gia.";emit(r);});
s.on("game:select",g=>{let r=rooms.get(s.data.room);if(!r||s.id!==r.hostId||r.status==="playing")return;r.game=g==="poker"?"poker":"taixiu";r.message="Đã đổi trò chơi.";emit(r);});
s.on("taixiu:bet",d=>{let r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!r||r.game!=="taixiu"||!p||r.status==="playing")return err(s,"Hiện không thể cược.");let n=Math.floor(Number(d.amount));if(!["tai","xiu"].includes(d.side)||!Number.isFinite(n)||n<10||n>p.chips)return err(s,"Mức cược không hợp lệ.");let old=r.bets.find(x=>x.playerId===s.id);if(old){p.chips+=old.amount;r.bets=r.bets.filter(x=>x.playerId!==s.id);}p.chips-=n;r.bets.push({playerId:s.id,name:p.name,side:d.side,amount:n});r.message=p.name+" đã đặt cược.";emit(r);});
s.on("taixiu:roll",()=>{let r=rooms.get(s.data.room);if(!r||r.game!=="taixiu"||s.id!==r.hostId||r.status==="playing")return err(s,"Chỉ chủ phòng được tung xúc xắc.");if(!r.bets.length)return err(s,"Chưa có cược nào.");r.status="playing";let dice=[1,2,3].map(()=>crypto.randomInt(1,7)),sum=dice.reduce((a,b)=>a+b,0),triple=dice.every(x=>x===dice[0]),result=sum>=11?"tai":"xiu";r.bets.forEach(b=>{let p=r.players.get(b.playerId);if(p&&!triple&&b.side===result)p.chips+=b.amount*2;});r.dice={dice,sum,triple,result};r.message=triple?"Bộ ba!":result.toUpperCase()+" · "+sum+" điểm";r.bets=[];emit(r);setTimeout(()=>{r.status="waiting";emit(r);},4000);});
s.on("poker:deal",()=>{let r=rooms.get(s.data.room);if(!r||r.game!=="poker"||s.id!==r.hostId||r.status==="playing")return err(s,"Chỉ chủ phòng được chia bài.");let ps=[...r.players.values()].filter(p=>p.connected);if(ps.length<2)return err(s,"Poker cần ít nhất 2 người.");r.status="playing";let d=deck();shuffle(d);let rows=ps.map(p=>({p,hand:Array.from({length:5},()=>d.pop())})).map(x=>({...x,rank:rank(x.hand)})).sort((a,b)=>cmp(b.rank,a.rank));let winners=rows.filter(x=>cmp(x.rank,rows[0].rank)===0);winners.forEach(x=>x.p.chips+=Math.floor(100/winners.length));ps.forEach(p=>io.to(p.id).emit("poker:hand",{cards:rows.find(x=>x.p.id===p.id).hand,results:rows.map(x=>({name:x.p.name,rank:x.rank.label,winner:winners.includes(x)}))}));r.message="Thắng ván: "+winners.map(x=>x.p.name).join(", ")+". Thưởng 100 chip ảo.";emit(r);setTimeout(()=>{r.status="waiting";emit(r);},5500);});
s.on("chat:send",m=>{let r=rooms.get(s.data.room),p=r?.players.get(s.id),msg=String(m||"").trim().slice(0,160);if(r&&p&&msg)io.to(r.code).emit("chat:message",{name:p.name,message:msg});});
s.on("disconnect",()=>{let r=rooms.get(s.data.room);if(!r)return;let p=r.players.get(s.id);if(p)p.connected=false;if(r.hostId===s.id){let n=[...r.players.values()].find(x=>x.connected);if(n)r.hostId=n.id;}if(![...r.players.values()].some(x=>x.connected))rooms.delete(r.code);else emit(r);});
});
server.listen(process.env.PORT||3000,()=>console.log("Mini Casino listening"));
