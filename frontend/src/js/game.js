let gameState = null;
let currentRole = 'warrior';
let playerName = '';
let playerClass = '';
let dieRolling = false;
const dieMax = 20;
let lastDieRoll = 20;
let lastDieTotal = 20;
let lastDieResultText = '';
let lastDieColor = '';
let dialogueHistory = [];

function pushDialogue(speaker, text){
  dialogueHistory.push({speaker, text});
  renderRecap();
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

async function sendAct(){
  const val = pInput.value.trim();
  if(!val) return;
  pInput.value = '';
  pushDialogue('You', val);
  narrText.innerHTML = '<em style="color:#8a6a3a;font-size:0.8em">\u00BB '+val+'</em><br><br><span style="color:#a09070">\u2026the agents confer\u2026</span><span class="cursor"></span>';
  try {
    const res = await apiPost('/turn', {action: val, session_id: "default"});
    gameState = res.state;
    renderParty();
    if(res.trace) renderTrace(res.trace);
    showGM();
    if(res.dice) {
      narrText.innerHTML = (res.narration_setup || 'The Game Master calls for a die roll.') + '<span class="cursor"></span>';
      setStage('die');
      startDieAnimation(res.dice.roll, res.dice.total, res.dice.modifier, res.dice.result, res.dice.consequence, function(){
        if(res.narration_outcome){
          narrText.innerHTML = res.narration_outcome + '<span class="cursor"></span>';
          pushDialogue('GM', res.narration_outcome);
        }
        if(res.followups && res.followups.length){
          const agentTexts = res.followups.map(f =>
            '<span style="color:#c8922a">'+f.agent+':</span> '+f.narration
          ).join('<br>');
          narrText.innerHTML = agentTexts + '<span class="cursor"></span>';
          res.followups.forEach(f => pushDialogue(f.agent, f.narration));
          setTimeout(function(){ setStage('agents'); }, 2000);
        } else {
          setStage('agents');
        }
      });
    } else {
      const narration = res.narration || 'The agents responded.';
      narrText.innerHTML = narration + '<span class="cursor"></span>';
      pushDialogue('GM', narration);
      if(res.followups && res.followups.length){
        setTimeout(function(){
          const agentTexts = res.followups.map(f =>
            '<span style="color:#c8922a">'+f.agent+':</span> '+f.narration
          ).join('<br>');
          narrText.innerHTML = agentTexts + '<span class="cursor"></span>';
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
        {agent:'Rogue', name: pClass === 'Rogue' ? pName : 'Vex', health:18, max_health:20, inventory:['Dagger','Lockpicks']},
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
  try {
    const traceData = await apiGet('/trace');
    renderTrace(traceData);
  } catch {}
  const hasIntro = await checkIntro();
  if(!hasIntro && gameState){
    const welcome = 'Welcome, '+playerName+'. The '+(gameState.campaign || 'adventure')+' begins. You stand at '+(gameState.location || 'the starting point')+'. '+(gameState.active_quest || 'Your quest awaits.');
    narrText.innerHTML = welcome + '<span class="cursor"></span>';
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
        const welcome = 'Welcome, '+playerName+'. The '+(gameState.campaign || 'adventure')+' begins. Your party awaits your lead.';
        narrText.innerHTML = welcome + '<span class="cursor"></span>';
        pushDialogue('GM', welcome);
      }
    }, 2500);
  }
}

initGame();
