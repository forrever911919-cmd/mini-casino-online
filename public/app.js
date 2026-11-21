const socket=io(),$=id=>document.getElementById(id);let room=null,me=null;
function error(t){$("error").textContent=t||""}function safe(t){return String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const playerName=()=>$("name").value.trim()||"Người chơi";
$("createPoker").onclick=()=>socket.emit("room:create",{name:playerName(),game:"poker"});
$("createTai").onclick=()=>socket.emit("room:create",{name:playerName(),game:"taixiu"});
$("join").onclick=()=>socket.emit("room:join",{name:playerName(),code:$("roomCode").value.trim()});
$("copy").onclick=()=>navigator.clipboard.writeText(room.code).then(()=>error("Đã sao chép mã phòng."));
$("tabPoker").onclick=()=>socket.emit("game:select","poker");$("tabTai").onclick=()=>socket.emit("game:select","taixiu");
$("deal").onclick=()=>socket.emit("poker:deal");$("roll").onclick=()=>socket.emit("taixiu:roll");
$("betTai").onclick=()=>socket.emit("taixiu:bet",{side:"tai",amount:$("amount").value});
$("betXiu").onclick=()=>socket.emit("taixiu:bet",{side:"xiu",amount:$("amount").value});
function send(){let m=$("chatInput").value.trim();if(m){socket.emit("chat:send",m);$("chatInput").value=""}}$("send").onclick=send;$("chatInput").onkeydown=e=>{if(e.key==="Enter")send()};
socket.on("room:joined",d=>{me=d.playerId;room=d.room;$("lobby").classList.add("hide");$("table").classList.remove("hide");$("code").textContent=room.code;draw(room)});
socket.on("room:update",draw);socket.on("app:error",error);
function draw(r){room=r;let self=r.players.find(p=>p.id===me);$("balance").textContent=(self?.chips||0).toLocaleString("vi-VN")+" chip";$("status").textContent=r.message||"Đang chờ người chơi";
$("players").innerHTML=r.players.map(p=>`<div class="player"><b>${safe(p.name)} ${p.id===r.hostId?"👑":""}</b><small>${p.chips.toLocaleString("vi-VN")} chip · ${p.connected?"Online":"Offline"}</small></div>`).join("");
$("poker").classList.toggle("hide",r.game!=="poker");$("taixiu").classList.toggle("hide",r.game!=="taixiu");$("tabPoker").className=r.game==="poker"?"":"alt";$("tabTai").className=r.game==="taixiu"?"":"alt";
$("deal").disabled=me!==r.hostId||r.status==="playing";$("roll").disabled=me!==r.hostId||r.status==="playing";
$("bets").innerHTML=(r.bets||[]).map(b=>`<p>${safe(b.name)} · ${b.side.toUpperCase()} · ${b.amount} chip</p>`).join("");
if(r.dice){$("dice").textContent=r.dice.dice.map(n=>["⚀","⚁","⚂","⚃","⚄","⚅"][n-1]).join("　");$("diceText").textContent=`${r.dice.sum} điểm · ${r.dice.triple?"BỘ BA":r.dice.result.toUpperCase()}`}}
socket.on("poker:hand",d=>{$("myCards").innerHTML=d.cards.map(c=>`<div class="card ${["♥","♦"].includes(c.suit)?"red":""}">${c.v}<br>${c.suit}</div>`).join("");$("pokerResults").innerHTML="<h3>Kết quả bàn</h3>"+d.results.map(r=>`<p>${safe(r.name)}: <b>${r.rank}</b> ${r.winner?"🏆":""}</p>`).join("")});
socket.on("chat:message",m=>{let p=document.createElement("p");p.textContent=m.name+": "+m.message;$("messages").append(p);$("messages").scrollTop=$("messages").scrollHeight});
socket.on("disconnect",()=>error("Mất kết nối, đang thử kết nối lại..."));
