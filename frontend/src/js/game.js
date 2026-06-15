let gameState = null;
let currentRole = 'warrior';
let playerName = '';
let playerClass = '';
let dieRolling = false;
let dieEverRolled = false;
const dieMax = 20;
let lastDieRoll = 20;
let lastDieTotal = 20;
let lastDieResultText = '';
let lastDieColor = '';
let dialogueHistory = [];
let dieHistory = [];

// --- Dynamic lore ---
const LORE_ENTRIES = {
  aethelgard:{title:'AETHELGARD',body:'A vast steampunk city powered by coal and aether-steam. Five vertical districts rise from The Undergrid to the Upper-Spire.'},
  the_sump:{title:'THE SUMP',body:'The lowest inhabited district. Choking smog, rusted pipes, desperate workers scraping to survive beneath the weight of the city above.'},
  clockwork_plague:{title:'CLOCKWORK PLAGUE',body:'A mysterious corruption spreading through the city\'s machinery. Automatons malfunction, pressure cores overheat, and workers fall sick from toxic discharge.'},
  pressure_core:{title:'PRESSURE CORE (SECTOR-04)',body:'Giant steam regulators that power each district. The Sector-04 core has been deliberately sabotaged.'},
  engineers:{title:'THE ENGINEERS',body:'The ruling class of the Upper-Spire. They control the pressure systems - and may be behind the Plague to clear out the lower districts.'},
  brass_cylinder:{title:'BRASS CYLINDER',body:'A legendary override device. Whoever controls it can reset the master console and halt the Plague - or unleash it entirely.'},
  upper_spire:{title:'UPPER-SPIRE',body:'The topmost district where the Engineers live in relative clean air above the smog layer. Access tightly controlled.'},
  undergrid:{title:'UNDERGRID',body:'The labyrinth of tunnels, pipes, and maintenance shafts beneath The Sump. Few people go down willingly.'},
  zenith_wards:{title:'ZENITH WARDS',body:'A mid-city district of guild halls, merchant houses, and the few citizens wealthy enough to breathe filtered air.'},
  glass_arch:{title:'GLASS ARCH',body:'A trade hub spanning two districts, known for its aether-lit marketplace and back-alley information brokers.'},
  sunken_market:{title:'SUNKEN MARKET',body:'A flooded lower market district where swampfolk and Sump residents trade salvage, contraband, and rumours.'},
  hidden_blade:{title:'HIDDEN BLADE',body:'A concealed weapon favoured by smugglers and spies. Compact, quiet, and easy to deny.'},
  aether_core:{title:'AETHER-CORE',body:'A crystallised form of condensed aether used to power advanced machinery. Extremely volatile if corrupted.'},
};

const LORE_TERM_MAP = {
  'Aethelgard':'aethelgard','The Sump':'the_sump','Clockwork Plague':'clockwork_plague',
  'Pressure Core':'pressure_core','Sector-04':'pressure_core','Engineers':'engineers',
  'Brass Cylinder':'brass_cylinder','brass cylinder':'brass_cylinder',
  'Upper-Spire':'upper_spire','Undergrid':'undergrid','Zenith Wards':'zenith_wards',
  'Glass Arch':'glass_arch','Sunken Market':'sunken_market',
  'Hidden Blade':'hidden_blade','hidden blade':'hidden_blade',
  'aether-core':'aether_core','Aether-core':'aether_core',
};

const unlockedLore = new Set(['aethelgard','the_sump','clockwork_plague']);

function renderLore(){
  const loreEl = document.getElementById('loreBody');
  if(!loreEl) return;
  const entries = Object.entries(LORE_ENTRIES);
  const unlockedHtml = entries.filter(([k])=>unlockedLore.has(k))
    .map(([,e])=>'<div class="lore-entry"><div class="lore-title">'+e.title+'</div>'+e.body+'</div>')
    .join('');
  const locked = entries.filter(([k])=>!unlockedLore.has(k));
  const lockedHtml = locked.length
    ? '<div class="lore-sep">-- '+locked.length+' entr'+(locked.length===1?'y':'ies')+' undiscovered --</div>'
      + locked.map(()=>'<div class="lore-entry lore-locked"><div class="lore-title">[ ??? ]</div><span class="lore-hint">Explore Aethelgard to unlock this entry.</span></div>').join('')
    : '';
  loreEl.innerHTML = unlockedHtml + lockedHtml || 'The world awaits discovery.';
}

function scanForLore(text){
  let added = 0;
  Object.entries(LORE_TERM_MAP).forEach(([term,key])=>{
    if(!unlockedLore.has(key) && text.toLowerCase().includes(term.toLowerCase())){
      unlockedLore.add(key); added++;
    }
  });
  if(added > 0){ renderLore(); showToast('[W] New lore discovered!'); }
}

// --- Map ---
const MAP_DISTRICTS = [
  {id:'upper-spire',  label:'UPPER-SPIRE',    tag:'ENGINEERS',    col:'#c090d8', dark:'#1a0828', icon:'^^^', note:'Sealed towers above the smog. Access tightly controlled.'},
  {id:'zenith wards', label:'ZENITH WARDS',   tag:'GUILD HALLS',  col:'#6ea8d0', dark:'#0a1828', icon:'[H]', note:'Filtered air. Guild halls and upper-class housing.'},
  {id:'glass arch',   label:'GLASS ARCH',     tag:'TRADE HUB',    col:'#44c898', dark:'#082820', icon:'/ \\', note:'Aether-lit markets and black-market info brokers.'},
  {id:'sunken market',label:'SUNKEN MARKET',  tag:'FLOODED ZONE', col:'#c89050', dark:'#281808', icon:'~~~', note:'Partially flooded. Salvagers and swampfolk trade here.'},
  {id:'the sump',     label:'THE SUMP',        tag:'PLAGUE ZONE',  col:'#cc4422', dark:'#220808', icon:'###', note:'Industrial slums. Choking smog. The plague started here.'},
  {id:'undergrid',    label:'UNDERGRID',       tag:'UNDERGROUND',  col:'#5a4030', dark:'#080806', icon:':::', note:'Maintenance tunnels deep below the city. Few return.'},
];

function renderMap(){
  const mapEl = document.getElementById('mapBody');
  if(!mapEl) return;
  const loc = ((gameState && gameState.location) || '').toLowerCase();
  const ia = id => loc.includes(id);
  const W = 520, H = 320, L = 16, R = 400, CX = 208;

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;max-height:320px;display:block;">
  <defs>
    <style>.mp{animation:mp 2s ease-in-out infinite}@keyframes mp{0%,100%{opacity:1}50%{opacity:0.25}}</style>
    <filter id="fg"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#060416"/><stop offset="55%" stop-color="#100808"/><stop offset="100%" stop-color="#0e0806"/></linearGradient>
    <pattern id="hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#1a1008" stroke-width="1.5"/></pattern>
    <pattern id="gr" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="rgba(80,60,20,0.07)" stroke-width="0.5"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#gr)"/>`;

  // Stars
  [30,75,120,160,210,280,340,380,420,460,490].forEach((x,i)=>{ s+=`<circle cx="${x}" cy="${4+i%4*3}" r="0.7" fill="white" opacity="${0.15+i%3*0.1}"/>`; });

  // Label helper
  const lbl = (x,y,text,col,size,cls='',op=1)=> `<text x="${x}" y="${y}" fill="${col}" font-size="${size}" font-family="monospace" letter-spacing="1" ${cls?'class="'+cls+'"':''} opacity="${op}">${text}</text>`;
  const tag = (text,col,active,y2)=> active ? lbl(R+14,y2,text,col,7,'mp') : lbl(R+14,y2,text,'#5a4828',6,'',0.6);
  const lline = (y,col,op)=>`<line x1="${R}" y1="${y}" x2="${R+10}" y2="${y}" stroke="${col}" stroke-width="1" opacity="${op}"/>`;

  // === UPPER-SPIRE (y 12-78) ===
  const uC='#c090d8', uA=ia('upper-spire'), uOp=uA?1:0.55;
  // base platform
  s+=`<rect x="${L}" y="68" width="${R-L}" height="12" fill="${uA?'#220a40':'#100418'}" stroke="${uC}" stroke-width="${uA?1.5:0.7}" opacity="${uOp}"/>`;
  // towers
  [[CX,14,16],[CX-55,28,13],[CX+55,28,13],[CX-105,38,11],[CX+105,38,11],[CX-148,46,9],[CX+148,46,9]].forEach(([tx,ty,tw])=>{
    s+=`<polygon points="${tx},${ty} ${tx+tw/2},68 ${tx-tw/2},68" fill="${uA?'#2a0e48':'#150820'}" stroke="${uC}" stroke-width="${uA?1.2:0.6}" opacity="${uOp}"/>`;
    if(uA&&tw>10) s+=`<rect x="${tx-2}" y="${ty+18}" width="4" height="5" fill="${uC}" opacity="0.5"/>`;
  });
  if(uA){ s+=`<rect x="${L}" y="12" width="${R-L}" height="68" fill="${uC}" opacity="0.06" filter="url(#fg)"/>`; s+=`<rect x="${L}" y="68" width="5" height="12" fill="${uC}"/>`; }
  s+=lbl(R+14,78,'UPPER-SPIRE',uA?uC:'#907090',uA?9:7,'',uOp);
  s+=tag(uA?'>> YOU ARE HERE':'Engineers domain',uC,uA,88)+lline(74,uC,uOp);

  // === ZENITH WARDS (y 82-118) ===
  const zC='#6ea8d0', zA=ia('zenith wards'), zOp=zA?1:0.55;
  s+=`<rect x="${L}" y="82" width="${R-L}" height="36" fill="${zA?'#0a1828':'#060e18'}" stroke="${zC}" stroke-width="${zA?1.5:0.7}" opacity="${zOp}"/>`;
  [[70,22],[130,28],[200,24],[270,30],[335,22],[380,26]].forEach(([bx,bh])=>{
    s+=`<rect x="${bx}" y="${118-bh}" width="26" height="${bh}" fill="${zA?'#0c1e30':'#060c18'}" stroke="${zC}" stroke-width="0.6" opacity="${zOp*0.9}"/>`;
    s+=`<rect x="${bx+5}" y="${118-bh+5}" width="6" height="5" fill="${zC}" opacity="${zA?0.5:0.2}"/>`;
    s+=`<rect x="${bx+15}" y="${118-bh+5}" width="6" height="5" fill="${zC}" opacity="${zA?0.5:0.2}"/>`;
  });
  if(zA){ s+=`<rect x="${L}" y="82" width="${R-L}" height="36" fill="${zC}" opacity="0.07" filter="url(#fg)"/>`; s+=`<rect x="${L}" y="82" width="5" height="36" fill="${zC}"/>`; }
  s+=lbl(R+14,100,'ZENITH WARDS',zA?zC:'#607090',zA?9:7,'',zOp);
  s+=tag(zA?'>> YOU ARE HERE':'Guild halls',zC,zA,110)+lline(100,zC,zOp);

  // === GLASS ARCH (y 120-148) ===
  const gC='#44c898', gA=ia('glass arch'), gOp=gA?1:0.55;
  s+=`<rect x="${L}" y="120" width="${R-L}" height="28" fill="${gA?'#0a2820':'#061810'}" stroke="${gC}" stroke-width="${gA?1.5:0.7}" opacity="${gOp}"/>`;
  s+=`<path d="M ${L+18} 148 Q ${CX} 118 ${R-18} 148" fill="none" stroke="${gC}" stroke-width="${gA?2:1}" opacity="${gOp}"/>`;
  s+=`<path d="M ${L+32} 148 Q ${CX} 126 ${R-32} 148" fill="none" stroke="${gC}" stroke-width="${gA?1:0.5}" opacity="${gOp*0.5}"/>`;
  [[L+16,28],[R-24,28]].forEach(([px,ph])=>s+=`<rect x="${px}" y="120" width="10" height="${ph}" fill="${gA?'#0a2820':'#061810'}" stroke="${gC}" stroke-width="0.7" opacity="${gOp*0.9}"/>`);
  if(gA){ s+=`<rect x="${L}" y="120" width="${R-L}" height="28" fill="${gC}" opacity="0.07" filter="url(#fg)"/>`; s+=`<rect x="${L}" y="120" width="5" height="28" fill="${gC}"/>`; }
  s+=lbl(R+14,134,'GLASS ARCH',gA?gC:'#408878',gA?9:7,'',gOp);
  s+=tag(gA?'>> YOU ARE HERE':'Trade hub',gC,gA,144)+lline(134,gC,gOp);

  // === SUNKEN MARKET (y 150-182) ===
  const smC='#c89050', smA=ia('sunken market'), smOp=smA?1:0.6;
  s+=`<rect x="${L}" y="150" width="${R-L}" height="32" fill="${smA?'#281808':'#160e04'}" stroke="${smC}" stroke-width="${smA?1.5:0.7}" opacity="${smOp}"/>`;
  for(let wx=L;wx<R-10;wx+=22){ s+=`<path d="M${wx} 165 Q${wx+8} 159 ${wx+16} 165 Q${wx+20} 169 ${wx+22} 165" fill="none" stroke="${smC}" stroke-width="${smA?1:0.5}" opacity="${smOp*0.5}"/>`; }
  if(smA){ s+=`<rect x="${L}" y="150" width="${R-L}" height="32" fill="${smC}" opacity="0.07" filter="url(#fg)"/>`; s+=`<rect x="${L}" y="150" width="5" height="32" fill="${smC}"/>`; }
  s+=lbl(R+14,165,'SUNKEN MARKET',smA?smC:'#907040',smA?9:7,'',smOp);
  s+=tag(smA?'>> YOU ARE HERE':'Flooded markets',smC,smA,175)+lline(165,smC,smOp);

  // === THE SUMP (y 184-245) ===
  const tC='#cc4422', tA=ia('the sump'), tOp=tA?1:0.65;
  s+=`<rect x="${L}" y="184" width="${R-L}" height="60" fill="${tA?'#220808':'#120404'}" stroke="${tC}" stroke-width="${tA?2:0.8}" opacity="${tOp}"/>`;
  if(tA){ s+=`<rect x="${L}" y="184" width="${R-L}" height="60" fill="${tC}" opacity="0.1" filter="url(#fg)"/>`; s+=`<rect x="${L}" y="184" width="5" height="60" fill="${tC}"/>`; }
  // Pipes
  [65,118,175,232,290,345,385].forEach((px,i)=>{
    const ph=14+(i%3)*10;
    s+=`<rect x="${px}" y="${184-ph}" width="9" height="${ph+4}" fill="${tA?'#2a0808':'#160404'}" stroke="${tC}" stroke-width="0.8" opacity="${tOp*0.9}"/>`;
    s+=`<circle cx="${px+4.5}" cy="${184-ph}" r="5.5" fill="${tA?'#220606':'#100202'}" stroke="${tC}" stroke-width="0.8" opacity="${tOp*0.9}"/>`;
    if(tA) s+=`<ellipse cx="${px+4.5}" cy="${184-ph-7}" rx="6" ry="3" fill="${tC}" opacity="0.14"/>`;
  });
  // Smog layer
  [90,190,290,360].forEach(sx=>s+=`<ellipse cx="${sx}" cy="188" rx="28" ry="7" fill="${tC}" opacity="${tA?0.1:0.04}"/>`);
  s+=lbl(R+14,208,'THE SUMP',tA?tC:'#904030',tA?9:7,'',tOp);
  s+=tag(tA?'>> YOU ARE HERE':'Plague epicentre',tC,tA,220)+lline(208,tC,tOp);
  if(tA) s+=lbl(26,238,'PLAGUE EPICENTRE',tC,6,'mp');

  // === UNDERGRID (y 247-305) ===
  const ugC='#6a5038', ugA=ia('undergrid'), ugOp=ugA?0.9:0.4;
  s+=`<rect x="${L}" y="247" width="${R-L}" height="56" fill="#060604"/><rect x="${L}" y="247" width="${R-L}" height="56" fill="url(#hx)" opacity="0.55"/>`;
  s+=`<rect x="${L}" y="247" width="${R-L}" height="56" fill="none" stroke="${ugC}" stroke-width="${ugA?1.5:0.6}" opacity="${ugOp}"/>`;
  [[110,275,28,18],[220,275,28,18],[330,275,28,18]].forEach(([cx,cy,rx,ry])=>{
    s+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${ugC}" stroke-width="${ugA?1:0.5}" opacity="${ugOp}"/>`;
    s+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx-7}" ry="${ry-5}" fill="#080806"/>`;
  });
  if(ugA){ s+=`<rect x="${L}" y="247" width="${R-L}" height="56" fill="${ugC}" opacity="0.07" filter="url(#fg)"/>`; s+=`<rect x="${L}" y="247" width="5" height="56" fill="${ugC}"/>`; }
  s+=lbl(R+14,268,'UNDERGRID',ugA?ugC:'#5a4028',ugA?9:7,'',ugOp);
  s+=tag(ugA?'>> YOU ARE HERE':'Deep tunnels',ugC,ugA,279)+lline(268,ugC,ugOp);

  // Right panel divider
  s+=`<line x1="${R+10}" y1="12" x2="${R+10}" y2="305" stroke="#2a1e0c" stroke-width="0.5"/>`;

  // Bottom label
  s+=`<text x="${CX}" y="${H-5}" text-anchor="middle" fill="#2a1e0c" font-size="6" font-family="monospace" letter-spacing="2">AETHELGARD - CITY CROSS-SECTION</text>`;
  s+=`</svg>`;
  mapEl.innerHTML = s;
}

function pushDialogue(speaker, text){
  dialogueHistory.push({speaker, text});
  renderRecap();
}

function showHelp(){
  setStage('agents');
  narrText.innerHTML = HELP_TEXT+'<br><br><b>SLASH COMMANDS:</b><br>/lore /map /party /recap /trace /status<span class="cursor"></span>';
}
window.showHelp = showHelp;

function showGameOver(){
  let el = document.getElementById('gameOverScreen');
  if(el) return;
  el = document.createElement('div');
  el.id = 'gameOverScreen';
  el.className = 'end-screen';
  el.innerHTML = '<div class="end-title" style="color:#cc4422">[ PARTY DEFEATED ]</div>'
    +'<div class="end-body">Your entire party has fallen. The Clockwork Plague spreads unchecked.<br><br>The city of Aethelgard descends into darkness.</div>'
    +'<button class="end-btn" onclick="window.location.href=\'landing.html\'">RESTART &gt;</button>';
  document.body.appendChild(el);
}

function showVictory(){
  let el = document.getElementById('victoryScreen');
  if(el) return;
  el = document.createElement('div');
  el.id = 'victoryScreen';
  el.className = 'end-screen';
  el.innerHTML = '<div class="end-title" style="color:#44dd88">[ VICTORY ]</div>'
    +'<div class="end-body">The Clockwork Plague has been stopped. Aethelgard breathes again.<br><br>The city will remember your party.</div>'
    +'<button class="end-btn" onclick="window.location.href=\'landing.html\'">PLAY AGAIN &gt;</button>';
  document.body.appendChild(el);
}

function checkEndConditions(){
  if(!gameState) return;
  const totalHp = (gameState.party||[]).reduce((s,m)=>s+m.health,0);
  if(totalHp <= 0){ showGameOver(); return; }
  if(gameState.world_flags && gameState.world_flags.victory){ showVictory(); }
}

const LORE_TERMS = ['Clockwork Plague','The Sump','Aethelgard','Pressure Core','Sector-04','Upper-Spire','Undergrid','brass cylinder','aether-core','pressure valves','emergency grid-lock','holo-display','swampfolk','automaton','Zenith Wards','master console','steam pipes','Engineers','Hidden Blade'];

function highlightTerms(html){
  let result = html;
  LORE_TERMS.slice().sort((a,b)=>b.length-a.length).forEach(t=>{
    const safe = t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp('(?<![\'">])\\b('+safe+')\\b(?![^<]*>)','gi');
    result = result.replace(re,'<span class="narr-link" onclick="askAbout(this)">$1</span>');
  });
  return result;
}

window.askAbout = function(el){
  const term = el.textContent;
  pInput.value = 'Tell me more about '+term;
  pInput.focus();
  if(typeof _sfx !== 'undefined') _sfx.send();
};

function appendNarration(html){
  let current = narrText.innerHTML;
  current = current.replace('<span class="cursor"></span>', '');
  narrText.innerHTML = current + highlightTerms(html) + '<span class="cursor"></span>';
  narrText.scrollTop = 0;
}

function renderRecap(){
  if(!gameState) return;
  const members = gameState.party || [];
  let totalHp = 0, totalMax = 0;
  members.forEach(m => { totalHp += m.health; totalMax += m.max_health; });
  const meta = (gameState.location || '?')+' - '+(gameState.active_quest || '?')+'<br>'+(gameState.campaign || '?')+'  |  \u2694 HP '+totalHp+'/'+totalMax;
  const lines = dialogueHistory.map(e => {
    const cls = e.speaker === 'You' ? 'dl-player' : 'dl-gm';
    return '<div class="dl-entry '+cls+'"><span class="dl-speaker">['+e.speaker+']:</span> '+e.text+'</div>';
  }).join('');
  recapBody.innerHTML = meta + '<br><hr style="border-color:#8a6030;margin:6px 0">' + lines;
  recapBody.scrollTop = recapBody.scrollHeight;
}

const HELP_TEXT = '<b>[ GAME MASTER - HELP ]</b><br><br>'
  +'Type any action and hit ACT. The AI party reacts and the story unfolds.<br><br>'
  +'<b>EXAMPLE ACTIONS:</b><br>'
  +'"I look around The Sump for clues about the Clockwork Plague"<br>'
  +'"I ask Kael what he knows about this area"<br>'
  +'"I investigate the nearest pressure pipe"<br>'
  +'"I try to sneak past the guard"<br>'
  +'"I talk to the locals about the plague symptoms"<br><br>'
  +'<b>HOW IT WORKS:</b><br>'
  +'Risky actions trigger a D20 dice roll. Roll high = success, roll low = complications. '
  +'Each party member then reacts in character.<br><br>'
  +'<b>TIPS:</b><br>'
  +'Click any <span class="narr-link">highlighted word</span> to ask the GM about it.<br>'
  +'[S] RECAP = full dialogue history<br>'
  +'[W] LORE = world encyclopedia (unlocks as you explore)<br>'
  +'[M] MAP = Aethelgard city map<br>'
  +'[T] TRACE = see the AI reasoning chain';

function unlockDie(){
  const btn = document.getElementById('dieBtn');
  if(btn) btn.classList.remove('locked');
}

function showDieIntroPopup(){
  let popup = document.getElementById('dieIntroPopup');
  if(popup) return;
  popup = document.createElement('div');
  popup.id = 'dieIntroPopup';
  popup.className = 'die-intro-popup';
  popup.innerHTML = '<div class="dip-title">[ WHAT IS A DICE ROLL? ]</div>'
    +'<div class="dip-body">'
    +'When you attempt something risky, the GM calls for a <b>D20 check</b> - a 20-sided die rolled by the system.<br><br>'
    +'<b>The number shown</b> is your raw roll (1-20).<br>'
    +'<b>WARRIOR CHECK</b> means your Warrior\'s STR modifier is added to the roll.<br><br>'
    +'<b>HIGH roll</b> = full success<br>'
    +'<b>MID roll</b> = partial success with complications<br>'
    +'<b>LOW roll</b> = failure - things get worse<br><br>'
    +'The [!] DIE ROLL tab keeps a history of all rolls.'
    +'</div>'
    +'<button class="dip-close" onclick="document.getElementById(\'dieIntroPopup\').remove()">GOT IT &gt;</button>';
  document.body.appendChild(popup);
}

async function sendAct(){
  const val = pInput.value.trim();
  if(!val) return;
  pInput.value = '';

  if(val.toLowerCase() === 'help' || val === '/help'){
    narrText.innerHTML = HELP_TEXT + '<br><br><b>SLASH COMMANDS:</b><br>/lore - open world lore panel<br>/map - open city map<br>/party - view party stats<br>/recap - session history<br>/trace - AI reasoning chain<br>/status - show current HP and quest<span class="cursor"></span>';
    pushDialogue('GM', 'HELP: commands and tips shown.');
    return;
  }
  if(val === '/lore'){ setStage('lore'); narrText.innerHTML += '<br><em style="color:#8a6a3a;font-size:0.85em">[ Opened WORLD LORE ]</em><span class="cursor"></span>'; return; }
  if(val === '/map'){ setStage('map'); narrText.innerHTML += '<br><em style="color:#8a6a3a;font-size:0.85em">[ Opened MAP ]</em><span class="cursor"></span>'; return; }
  if(val === '/party'){ setStage('agents'); narrText.innerHTML += '<br><em style="color:#8a6a3a;font-size:0.85em">[ Opened PARTY ]</em><span class="cursor"></span>'; return; }
  if(val === '/recap'){ setStage('recap'); narrText.innerHTML += '<br><em style="color:#8a6a3a;font-size:0.85em">[ Opened RECAP ]</em><span class="cursor"></span>'; return; }
  if(val === '/trace'){ setStage('trace'); narrText.innerHTML += '<br><em style="color:#8a6a3a;font-size:0.85em">[ Opened TRACE ]</em><span class="cursor"></span>'; return; }
  if(val === '/status'){
    if(gameState){
      const hp = (gameState.party||[]).reduce((s,m)=>s+m.health,0);
      const maxHp = (gameState.party||[]).reduce((s,m)=>s+m.max_health,0);
      narrText.innerHTML = '<b>STATUS</b><br>Location: '+(gameState.location||'?')+'<br>Quest: '+(gameState.active_quest||'?')+'<br>Party HP: '+hp+'/'+maxHp+'<span class="cursor"></span>';
    }
    return;
  }

  pushDialogue('You', val);
  narrText.innerHTML = '<em style="color:#8a6a3a;font-size:0.8em">\u00BB '+val+'</em><br><br><span style="color:#a09070">\u2026the agents confer\u2026</span><br><br><span class="cursor"></span>';
  try {
    const res = await apiPost('/turn', {action: val, session_id: "default"});
    gameState = res.state;
    renderParty();
    if(res.trace) renderTrace(res.trace);
    showGM();
    const setup = res.narration_setup || '';
    const outcome = res.narration_outcome || '';
    const narrationText = (res.narration_setup || '') + ' ' + (res.narration_outcome || '');
    scanForLore(narrationText);
    if(res.dice) {
      dieHistory.unshift({actor:res.dice.actor||'', check:res.dice.check||'', roll:res.dice.roll, modifier:res.dice.modifier||0, total:res.dice.total, result:res.dice.result, consequence:res.dice.consequence||''});
      if(!dieEverRolled){
        dieEverRolled = true;
        unlockDie();
        setTimeout(showDieIntroPopup, 2200);
      }
      appendNarration(setup || 'The Game Master calls for a die roll.');
      pushDialogue('GM', setup || '');
      setStage('die');
      const diceActor = (res.dice.actor || currentRole).toUpperCase();
      const diceCheck = (res.dice.check || 'ability check').toUpperCase();
      dieLabel.textContent = diceActor + ' - ' + diceCheck + ' (D20 ROLL)';
      startDieAnimation(res.dice.roll, res.dice.total, res.dice.modifier, res.dice.result, res.dice.consequence, function(){
        if(outcome){
          appendNarration('<br><br>' + outcome);
          pushDialogue('GM', outcome);
        }
        if(res.followups && res.followups.length){
          setTimeout(function(){
            const agentTexts = res.followups.map(f=>{
              const mem = gameState&&gameState.party&&gameState.party.find(m=>m.agent.toLowerCase()===f.agent.toLowerCase());
              return '<span style="color:#c8922a">'+(mem?mem.name:f.agent)+':</span> '+highlightTerms(f.narration);
            }).join('<br>');
            appendNarration('<br><br>' + agentTexts);
            res.followups.forEach(f => pushDialogue(f.agent, f.narration));
            setTimeout(function(){ setStage('agents'); }, 2000);
          }, 1500);
        } else {
          setTimeout(function(){ setStage('agents'); }, 1500);
        }
      });
    } else {
      const combined = setup + (setup && outcome ? '<br><br>' : '') + outcome;
      appendNarration(combined);
      if (setup) pushDialogue('GM', setup);
      if (outcome) pushDialogue('GM', outcome);
      if(res.followups && res.followups.length){
        setTimeout(function(){
          const agentTexts = res.followups.map(f => {
            const mem = gameState&&gameState.party&&gameState.party.find(m=>m.agent.toLowerCase()===f.agent.toLowerCase());
            return '<span style="color:#c8922a">'+(mem?mem.name:f.agent)+':</span> '+highlightTerms(f.narration);
          }).join('<br>');
          appendNarration('<br><br>' + agentTexts);
          res.followups.forEach(f => pushDialogue(f.agent, f.narration));
          setTimeout(function(){ setStage('agents'); }, 2000);
        }, 800);
      } else {
        setTimeout(function(){ setStage('agents'); }, 800);
      }
    }
  } catch(e){
    narrText.innerHTML = '<span style="color:#cc4444">\u26A0 Error: '+e.message+'</span><span class="cursor"></span>';
    showToast('Action failed: '+e.message);
  }
}

function startDieAnimation(finalRoll, finalTotal, modifier, finalResult, finalConsequence, onComplete){
  if(dieRolling) return;
  dieRolling = true;
  dieHint.textContent = '\u27F3 rolling...';
  dieResult.style.display = 'none';
  const max = dieMax;
  let ticks = 0;
  const totalTicks = 28;
  const numEl = dieNum;
  const outcome = finalResult === 'success';
  const outcomeLabel = outcome ? 'SUCCESS' : 'FAIL';
  function getDelay(tick){
    if(tick<8) return 40;
    if(tick<16) return 60;
    if(tick<22) return 110;
    if(tick<26) return 200;
    return 350;
  }
  function tick(){
    if(ticks < totalTicks - 1){
      numEl.textContent = Math.floor(Math.random() * max) + 1;
      ticks++;
      setTimeout(tick, getDelay(ticks));
    } else {
      numEl.textContent = finalRoll;
      dieHint.style.display = 'none';
      lastDieRoll = finalRoll;
      lastDieTotal = finalTotal;
      const modStr = modifier > 0 ? ' +'+modifier : modifier < 0 ? ' '+modifier : '';
      lastDieResultText = 'ROLLED '+finalRoll+modStr+' = '+finalTotal+' - '+outcomeLabel + (finalConsequence ? ' - '+finalConsequence : '');
      lastDieColor = outcome ? '#2a5a22' : '#7a2222';
      dieResult.textContent = lastDieResultText;
      dieResult.style.color = lastDieColor;
      dieResult.style.display = 'block';
      dieRolling = false;
      const line = document.createElement('div');
      line.className = 'tl roll';
      line.textContent = 'd'+max+' \u2192 '+finalRoll+modStr+' = '+finalTotal+' ('+outcomeLabel.toLowerCase()+')';
      traceFeed.appendChild(line);
      while(traceFeed.children.length > 8) traceFeed.removeChild(traceFeed.firstChild);
      fetchTrace();
      setTimeout(function(){ if(onComplete) onComplete(); }, 1500);
    }
  }
  tick();
}

async function fetchTrace(){
  try {
    const data = await apiGet('/trace');
    renderTrace(data);
  } catch {}
}

async function fetchState(){
  try {
    gameState = await apiGet('/state');
  } catch(e){
    showToast('Failed to load game state: '+e.message);
    const pName = localStorage.getItem('opencode_playerName') || 'Adventurer';
    const pClass = localStorage.getItem('opencode_playerClass') || 'Warrior';
    const campaign = localStorage.getItem('opencode_campaign') || 'The Lost Sigil';
    const location = localStorage.getItem('opencode_location') || 'Whispering Woods';
    const quest = localStorage.getItem('opencode_quest') || 'Find the ancient artifact';
    gameState = {
      campaign, location, active_quest: quest,
      party: [
        {agent:'Warrior', name: pClass === 'Warrior' ? pName : 'Thorn', health:20, max_health:20, inventory:[]},
        {agent:'Mage', name: pClass === 'Mage' ? pName : 'Elara', health:16, max_health:20, inventory:['Staff']},
        {agent:'Bard', name: pClass === 'Bard' ? pName : 'Seren', health:16, max_health:20, inventory:['Lute']},
        {agent:'Healer', name: pClass === 'Healer' ? pName : 'Luna', health:14, max_health:20, inventory:['Herbs']}
      ],
      world_flags: {}
    };
  }
}

async function checkIntro(){
  try {
    const r = await apiGet('/intro');
    if(r.pending && r.narration){
      showGM();
      narrText.innerHTML = r.narration + '<span class="cursor"></span>';
      const parts = r.narration.split('. ');
      parts.forEach(p => {
        const trimmed = p.trim();
        if(!trimmed) return;
        const colonIdx = trimmed.indexOf(':');
        if(colonIdx > 0 && colonIdx < 25){
          const speaker = trimmed.substring(0, colonIdx);
          const text = trimmed.substring(colonIdx + 1).replace(/\.$/, '');
          if(speaker && text) pushDialogue(speaker.trim(), text.trim());
        } else {
          pushDialogue('GM', trimmed.replace(/\.$/, ''));
        }
      });
      pInput.disabled = true;
      return true;
    }
  } catch {}
  return false;
}

async function initGame(){
  playerName = localStorage.getItem('opencode_playerName') || 'Adventurer';
  playerClass = localStorage.getItem('opencode_playerClass') || 'Warrior';
  currentRole = playerClass.toLowerCase();
  await fetchState();
  renderParty();
  setRole(currentRole);
  renderLore();
  renderMap();
  try {
    const traceData = await apiGet('/trace');
    renderTrace(traceData);
  } catch {}
  const hasIntro = await checkIntro();
  if(!hasIntro && gameState){
    const loc = gameState.location || 'the starting point';
    const quest = gameState.active_quest || 'Your quest awaits';
    const welcome = playerName+' steps into '+loc+'. The air is thick with smog and the distant groan of failing machinery. Somewhere beneath the city, the Clockwork Plague spreads. Your party is assembled. Mission: '+quest+'.';
    narrText.innerHTML = highlightTerms(welcome) + '<span class="cursor"></span>';
    pushDialogue('GM', welcome);
  }
  loadingOverlay.classList.add('hidden');
  setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
  pInput.addEventListener('keydown', e => { if(e.key === 'Enter') sendAct(); });
  if(hasIntro){
    setTimeout(function(){
      pInput.disabled = false;
      pInput.focus();
      if(gameState){
        const loc = gameState.location || 'the starting point';
        const quest = gameState.active_quest || 'Your quest awaits';
        const welcome = playerName+' steps into '+loc+'. The air is thick with smog and the distant groan of failing machinery. Somewhere beneath the city, the Clockwork Plague spreads. Your party is assembled. Mission: '+quest+'.';
        narrText.innerHTML = welcome + '<span class="cursor"></span>';
        pushDialogue('GM', welcome);
      }
    }, 2500);
  }
}

initGame();


// -- Panel resizer --
(function(){
  const resizer = document.getElementById('panelResizer');
  const shell = document.querySelector('.shell');
  const top = document.querySelector('.top');
  const textbox = document.getElementById('textbox');
  if(!resizer || !top || !textbox) return;
  let dragging = false, startY = 0, startTopH = 0;
  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    startTopH = top.getBoundingClientRect().height;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  });
  document.addEventListener('mousemove', e => {
    if(!dragging) return;
    const totalH = shell.getBoundingClientRect().height;
    const delta = e.clientY - startY;
    const newTopH = Math.min(Math.max(startTopH + delta, totalH * 0.2), totalH * 0.8);
    const pct = (newTopH / totalH * 100).toFixed(1);
    top.style.flex = '0 0 ' + pct + '%';
    textbox.style.flex = '0 0 ' + (100 - pct) + '%';
  });
  document.addEventListener('mouseup', () => {
    if(!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
})();

// -- Retro sounds (Web Audio API) --
const _sfx = (function(){
  let ctx = null;
  function getCtx(){ if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; }
  function tone(freq, dur, type='square', vol=0.08){
    try {
      const c = getCtx(), g = c.createGain(), o = c.createOscillator();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch {}
  }
  return {
    click(){ tone(440, 0.05); },
    send(){ tone(520, 0.06); setTimeout(() => tone(660, 0.08), 60); },
    dice(){ [220,180,260,200,300].forEach((f,i) => setTimeout(() => tone(f, 0.04, 'sawtooth'), i*40)); },
    success(){ tone(523, 0.1); setTimeout(() => tone(659, 0.1), 100); setTimeout(() => tone(784, 0.18), 200); },
    fail(){ tone(300, 0.1); setTimeout(() => tone(200, 0.15), 100); }
  };
})();

const _origSendAct = sendAct;
window.sendAct = function(){ _sfx.send(); _origSendAct(); };
