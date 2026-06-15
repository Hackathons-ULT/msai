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
const discoveredLocations = new Set(['the sump']);

function renderMap(){
  const mapEl = document.getElementById('mapBody');
  if(!mapEl) return;
  if(!mapEl.querySelector('img')){
    mapEl.innerHTML = '<img src="'+API_BASE+'/assets/map.png" alt="Aethelgard Map" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated">';
  }
  if(gameState && gameState.location && typeof discoveredLocations !== 'undefined'){
    discoveredLocations.add(gameState.location.toLowerCase());
  }
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
  try { _sfx.dice(); } catch {}
  try { _bgm.setTension(1); } catch {}
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
      try { outcome ? _sfx.success() : _sfx.fail(); } catch {}
      try { setTimeout(() => _bgm.setTension(0), 1800); } catch {}
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

// -- Objectives --
const STATUS_ICON = { active:'[*]', todo:'[ ]', done:'[X]', failed:'[!]' };
let objOpen = false;

function renderObjectives(){
  const panel = document.getElementById('objPanel');
  const toggle = document.getElementById('objToggle');
  if(!panel) return;
  const objs = (gameState && gameState.objectives) || [];
  if(!objs.length){ panel.classList.remove('open'); return; }
  const doneCount = objs.filter(o=>o.status==='done').length;
  if(toggle) toggle.textContent = '['+doneCount+'/'+objs.length+']';
  if(!objOpen){ panel.classList.remove('open'); return; }
  panel.innerHTML = objs.map(o=>{
    const s = o.status||'todo';
    return '<div class="obj-row obj-'+s+'"><span class="obj-icon">'+STATUS_ICON[s]+'</span>'+o.text+'</div>';
  }).join('');
  panel.classList.add('open');
}

function toggleObjectives(){
  objOpen = !objOpen;
  renderObjectives();
}
window.toggleObjectives = toggleObjectives;

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
  document.querySelectorAll('.sb-btn').forEach(btn => {
    btn.addEventListener('click', () => { try { _sfx.click(); } catch {} });
  });
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

// -- Ambient background music (dynamic — reacts to game events) --
const _bgm = (function(){
  let ctx = null, started = false, masterGain = null, _lfo = null, _tensionGain = null;
  function init(){
    if(started) return;
    started = true;
    try {
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);
      masterGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 4);

      // Low industrial bass drone
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sine'; bass.frequency.value = 55;
      bassGain.gain.value = 0.5;
      bass.connect(bassGain); bassGain.connect(masterGain);
      bass.start();

      // Mid hum layer (slight detune for thickness)
      const mid = ctx.createOscillator();
      const midGain = ctx.createGain();
      mid.type = 'sine'; mid.frequency.value = 110.4;
      midGain.gain.value = 0.25;
      mid.connect(midGain); midGain.connect(masterGain);
      mid.start();

      // Slow LFO wobble on bass (sped up during tension)
      _lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      _lfo.type = 'sine'; _lfo.frequency.value = 0.12;
      lfoGain.gain.value = 3;
      _lfo.connect(lfoGain); lfoGain.connect(bass.frequency);
      _lfo.start();

      // Tension layer — sawtooth growl, starts silent, fades in during dice rolls
      const tensionOsc = ctx.createOscillator();
      _tensionGain = ctx.createGain();
      tensionOsc.type = 'sawtooth'; tensionOsc.frequency.value = 165;
      const tensionFilt = ctx.createBiquadFilter();
      tensionFilt.type = 'lowpass'; tensionFilt.frequency.value = 700;
      _tensionGain.gain.value = 0;
      tensionOsc.connect(tensionFilt); tensionFilt.connect(_tensionGain); _tensionGain.connect(masterGain);
      tensionOsc.start();

      // Rhythmic steam pulse (every ~2.4s)
      function steamPulse(){
        if(!ctx) return;
        try {
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.6;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.06, ctx.currentTime+0.04);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.18);
          const filt = ctx.createBiquadFilter();
          filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 0.8;
          src.connect(filt); filt.connect(g); g.connect(masterGain);
          src.start();
        } catch {}
        setTimeout(steamPulse, 2200 + Math.random()*800);
      }
      setTimeout(steamPulse, 3000);

      // Slow clock-tick rhythm
      function clockTick(){
        if(!ctx) return;
        try {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'square'; o.frequency.value = 800;
          g.gain.setValueAtTime(0.03, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.04);
          o.connect(g); g.connect(masterGain);
          o.start(); o.stop(ctx.currentTime+0.04);
        } catch {}
        setTimeout(clockTick, 1800 + Math.random()*400);
      }
      setTimeout(clockTick, 1500);
    } catch {}
  }
  // Call setTension(1) to ramp up tension music during dice rolls, setTension(0) to calm down
  function setTension(level){
    if(!ctx || !_tensionGain || !_lfo) return;
    try {
      const now = ctx.currentTime;
      _tensionGain.gain.cancelScheduledValues(now);
      _tensionGain.gain.setValueAtTime(_tensionGain.gain.value, now);
      _lfo.frequency.cancelScheduledValues(now);
      _lfo.frequency.setValueAtTime(_lfo.frequency.value, now);
      if(level >= 1){
        _tensionGain.gain.linearRampToValueAtTime(0.14, now + 0.8);
        _lfo.frequency.linearRampToValueAtTime(0.55, now + 1.5);
      } else {
        _tensionGain.gain.linearRampToValueAtTime(0, now + 2.5);
        _lfo.frequency.linearRampToValueAtTime(0.12, now + 3.0);
      }
    } catch {}
  }
  return { init, setTension };
})();

// Start BGM on first user interaction
document.addEventListener('click', function startBGM(){ _bgm.init(); document.removeEventListener('click', startBGM); }, {once:true});
