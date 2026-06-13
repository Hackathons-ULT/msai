let gameState = null;
let currentRole = 'warrior';
let playerName = '';
let playerClass = '';
let dieRolling = false;
const dieMax = 20;

async function sendAct(){
  const val = pInput.value.trim();
  if(!val) return;
  pInput.value = '';
  narrText.innerHTML = '<em style="color:#8a6a3a;font-size:0.8em">\u00BB '+val+'</em><br><br><span style="color:#a09070">\u2026the agents confer\u2026</span><span class="cursor"></span>';
  try {
    const res = await apiPost('/turn', {action: val, session_id: "default"});
    gameState = res.state;
    renderParty();
    if(res.trace) renderTrace(res.trace);
    narrText.innerHTML = (res.narration || 'The agents responded.') + '<span class="cursor"></span>';
    showGM();
  } catch(e){
    narrText.innerHTML = '<span style="color:#cc4444">\u26A0 Error: '+e.message+'</span><span class="cursor"></span>';
    showToast('Action failed: '+e.message);
  }
}

async function rollDie(){
  if(dieRolling) return;
  dieRolling = true;
  dieHint.textContent = '\u27F3 rolling...';
  dieResult.style.display = 'none';
  const member = gameState && gameState.party && gameState.party.find(m => m.agent.toLowerCase() === currentRole);
  const actor = member ? member.agent : currentRole;
  const check = 'Heroism';
  const difficulty = 12;
  let finalTotal = 0, finalRoll = 0, finalResult = '', finalConsequence = '';
  try {
    const res = await apiPost('/roll', {actor, check, difficulty, modifier: 0});
    finalRoll = res.roll || 1;
    finalTotal = res.total || finalRoll;
    finalResult = res.result || (finalTotal >= difficulty ? 'success' : 'fail');
    finalConsequence = res.consequence || '';
  } catch(e){
    finalRoll = Math.floor(Math.random() * dieMax) + 1;
    finalTotal = finalRoll;
    finalResult = finalTotal >= difficulty ? 'success' : 'fail';
    finalConsequence = 'Offline roll \u2014 backend unreachable.';
    showToast('Backend unreachable, using local roll: '+e.message);
  }
  const max = dieMax;
  let ticks = 0;
  const totalTicks = 28;
  const numEl = dieNum;
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
      numEl.textContent = finalTotal;
      dieHint.style.display = 'none';
      const outcome = finalResult === 'success';
      const outcomeLabel = outcome ? 'SUCCESS' : 'FAIL';
      dieResult.textContent = 'ROLLED '+finalTotal+' \u2014 '+outcomeLabel + (finalConsequence ? ' \u2014 '+finalConsequence : '');
      dieResult.style.color = outcome ? '#2a5a22' : '#7a2222';
      dieResult.style.display = 'block';
      dieRolling = false;
      const line = document.createElement('div');
      line.className = 'tl roll';
      line.textContent = '\uD83C\uDFB2 d'+max+' \u2192 '+finalTotal+' ('+outcomeLabel.toLowerCase()+')';
      traceFeed.appendChild(line);
      while(traceFeed.children.length > 8) traceFeed.removeChild(traceFeed.firstChild);
      fetchTrace();
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
  if(gameState){
    narrText.innerHTML = 'Welcome, '+playerName+'. The '+(gameState.campaign || 'adventure')+' begins. You stand at '+(gameState.location || 'the starting point')+'. '+(gameState.active_quest || 'Your quest awaits.')+'<span class="cursor"></span>';
  }
  loadingOverlay.classList.add('hidden');
  setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
  pInput.addEventListener('keydown', e => { if(e.key === 'Enter') sendAct(); });
}

initGame();
