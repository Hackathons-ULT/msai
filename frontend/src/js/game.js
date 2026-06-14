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
  const activeIdx = MAP_DISTRICTS.findIndex(d => loc.includes(d.id));

  const W = 460, dH = 78, gap = 4, y0 = 36, liftX = 406;
  const totalH = y0 + MAP_DISTRICTS.length * (dH + gap) + 36;

  let svg = `<svg viewBox="0 0 ${W} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
  <defs>
    <style>.mp{animation:mpulse 2s ease-in-out infinite}@keyframes mpulse{0%,100%{opacity:1}50%{opacity:0.45}}</style>
    <filter id="mg"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="hx" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#2a1c0c" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${totalH}" fill="#0c0a06"/>
  <rect width="${W}" height="28" fill="#141008"/>
  <text x="${W/2}" y="18" text-anchor="middle" fill="#6a5030" font-size="8" font-family="monospace" letter-spacing="3">[ AETHELGARD - CITY CROSS-SECTION ]</text>
  <rect x="${liftX}" y="${y0}" width="18" height="${MAP_DISTRICTS.length*(dH+gap)-gap}" fill="#0e0c08" stroke="#2a1e0c" stroke-width="1"/>
  <text x="${liftX+9}" y="${y0-5}" text-anchor="middle" fill="#2a1e0c" font-size="6" font-family="monospace">LIFT</text>`;

  MAP_DISTRICTS.forEach((d,i)=>{
    const y = y0 + i*(dH+gap);
    const w = liftX - 6;
    const isActive = i === activeIdx;
    const op = (activeIdx >= 0 && i > activeIdx) ? 0.38 : 1;

    if(i === MAP_DISTRICTS.length-1){
      svg += `<rect x="0" y="${y}" width="${w}" height="${dH}" fill="${d.dark}" opacity="${op}"/>`;
      svg += `<rect x="0" y="${y}" width="${w}" height="${dH}" fill="url(#hx)" opacity="${op*0.5}"/>`;
    } else {
      svg += `<rect x="0" y="${y}" width="${w}" height="${dH}" fill="${d.dark}" opacity="${op}"/>`;
    }
    if(isActive){
      svg += `<rect x="0" y="${y}" width="${w}" height="${dH}" fill="${d.col}" opacity="0.1" filter="url(#mg)"/>`;
      svg += `<rect x="0" y="${y}" width="5" height="${dH}" fill="${d.col}"/>`;
    }
    svg += `<rect x="0" y="${y}" width="${w}" height="${dH}" fill="none" stroke="${d.col}" stroke-width="${isActive?2:0.7}" opacity="${op}"/>`;
    svg += `<text x="14" y="${y+28}" fill="${d.col}" font-size="11" font-family="monospace" opacity="${op}">${d.icon}</text>`;
    svg += `<text x="52" y="${y+24}" fill="${isActive?d.col:'#a09070'}" font-size="${isActive?11:9}" font-family="monospace" letter-spacing="1" opacity="${op}">${d.label}</text>`;
    svg += `<text x="${w-6}" y="${y+24}" text-anchor="end" fill="${d.col}" font-size="6.5" font-family="monospace" opacity="${op*0.55}">${d.tag}</text>`;
    const note = d.note.length > 54 ? d.note.substring(0,54)+'...' : d.note;
    svg += `<text x="12" y="${y+44}" fill="#7a6040" font-size="7.5" font-family="monospace" opacity="${op}">${note}</text>`;
    if(isActive){
      svg += `<text x="${w-6}" y="${y+dH-9}" text-anchor="end" fill="${d.col}" font-size="8" font-family="monospace" class="mp">&gt;&gt; YOU ARE HERE</text>`;
    }
    // steam puffs above The Sump
    if(d.id==='the sump'){
      [80,160,240,310].forEach(sx=>{
        svg += `<ellipse cx="${sx}" cy="${y-7}" rx="14" ry="5" fill="${d.col}" opacity="0.1"/>`;
      });
    }
    const ly = y + dH/2;
    svg += `<line x1="${w}" y1="${ly}" x2="${liftX}" y2="${ly}" stroke="${d.col}" stroke-width="${isActive?1.5:0.5}" stroke-dasharray="${isActive?'none':'4,3'}" opacity="${op}"/>`;
    svg += `<circle cx="${liftX+9}" cy="${ly}" r="${isActive?6:3.5}" fill="${isActive?d.col:'#141008'}" stroke="${d.col}" stroke-width="${isActive?1.5:0.8}" opacity="${op}"/>`;
  });

  svg += `<text x="8" y="${totalH-8}" fill="#3a2c10" font-size="6.5" font-family="monospace">Active = current location  |  Dim = not yet reached</text>`;
  svg += `</svg>`;
  mapEl.innerHTML = svg;
}

function pushDialogue(speaker, text){
  dialogueHistory.push({speaker, text});
  renderRecap();
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
  narrText.scrollTop = narrText.scrollHeight;
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
