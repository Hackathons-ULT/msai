const AGENT_DESC = {
  warrior:'Jax - Former factory enforcer. Best for combat, forcing doors, and head-on confrontations.',
  mage:'Lyra - Self-taught scholar. Best for deciphering runes, investigation, and arcane problems.',
  healer:'Bram - Field medic. Best for keeping the party alive, negotiating peacefully, and moral dilemmas.',
  bard:'Seren - Wandering minstrel. Best for persuasion, info-gathering, and social manipulation.',
  rival:'Kael - A smuggler who knows The Sump\'s back routes. His true allegiance is unknown.',
};

function renderParty(){
  if(!gameState) return;
  const members = gameState.party || [];
  const activeKey = currentRole;
  let html = '';
  members.forEach(m => {
    const key = m.agent.toLowerCase();
    const isLit = key === activeKey;
    const STAT_ABBR = {strength:'STRENGTH',dexterity:'AGILITY',constitution:'ENDURANCE',intelligence:'INTELLECT',wisdom:'WISDOM',charisma:'CHARM'};
    const STAT_TIP = {strength:'Physical power: melee attacks and forced actions',dexterity:'Agility and reflexes: stealth, speed, dodging',constitution:'Toughness: endurance and resistance to harm',intelligence:'Knowledge and reasoning: arcana and investigation',wisdom:'Perception and judgement: awareness and willpower',charisma:'Social force: persuasion, deception and charm'};
    const isRival = key === 'rival';
    const isRevealed = isRival && gameState.world_flags && gameState.world_flags.kael_revealed;
    const isRivalStats = isRival && isRevealed;
    const statRows = Object.keys(STAT_ABBR).map(s =>
      '<tr class="st-row" data-tip="'+STAT_TIP[s]+'"><td class="st-name">'+STAT_ABBR[s]+'</td><td class="st-val">'+(isRivalStats ? '???' : (m[s]??10))+'</td></tr>'
    ).join('');
    const cardCls = 'agent-card'+(isLit?' lit':'')+(isRival && isRevealed?' rival-card':'');
    const displayName = m.name.toUpperCase();
    const displayRole = isRival ? (isRevealed ? 'RIVAL' : 'SMUGGLER') : m.agent.toUpperCase();
    const statusLabel = isLit ? '* active' : (isRival && isRevealed ? '! exposed' : '- standby');
    const tipText = AGENT_DESC[key] || '';
    html += '<div class="'+cardCls+'" data-role="'+m.agent+'" data-tip="'+tipText+'"><div class="sprite-container">'+agentSpriteHTML(m.agent)+'</div><div class="agent-lbl">'+displayName+'<span>'+displayRole+' '+statusLabel+'</span></div><table class="stat-table">'+statRows+'</table></div>';
  });
  agentView.innerHTML = html;
  updateHUD();
  agentView.onclick = (e) => {
    const card = e.target.closest('.agent-card');
    if(!card) return;
    const myClass = (localStorage.getItem('opencode_playerClass') || 'Warrior').toLowerCase();
    if(card.dataset.role.toLowerCase() !== myClass) return;
    setRole(card.dataset.role.toLowerCase());
  };
}

function updateHUD(){
  if(!gameState) return;
  const members = gameState.party || [];
  let totalHp = 0, totalMax = 0;
  members.forEach(m => { totalHp += m.health; totalMax += m.max_health; });
  const pct = totalMax > 0 ? (totalHp / totalMax * 100) : 0;
  hpDisplay.innerHTML = 'HP '+totalHp+'/'+totalMax+'<div class="hp-bar"><div class="hp-fill" id="hpFill" style="width:'+pct+'%"></div></div>';
  turnText.textContent = (gameState.location || '?')+' - '+(gameState.active_quest || '?');
  renderRecap();
}

function renderTrace(traceData){
  const lines = traceData || [];
  const feedHtml = lines.slice(-8).map(t => {
    const type = t.type || 'info';
    const cls = type === 'dice' ? 'roll' : type === 'state_update' ? 'info' : 'done';
    let text;
    if(type === 'dice') text = (t.actor||'?')+' '+t.check+' \u2192 '+t.total;
    else if(type === 'narration') text = '\u270E '+(t.text||'').slice(0,60);
    else if(type === 'state_update') text = '\u21B3 '+(t.location?t.location:'')+(t.health_changes?' HP*':'')+(t.flags_set?' [F]':'');
    else if(type === 'agent_intro'){ const mem = gameState&&gameState.party&&gameState.party.find(m=>m.agent===(t.agent||'')); text = '\u25B6 '+(mem?mem.name:t.agent||'?')+' ready'; }
    else if(type === 'agent_action'){ const mem = gameState&&gameState.party&&gameState.party.find(m=>m.agent===(t.agent||'')); text = '\u25B6 '+(mem?mem.name:t.agent||'?')+': '+(t.action||'').slice(0,35); }
    else if(type === 'plan') text = '[*] '+(t.intent||t.text||'planning').slice(0,45);
    else if(type === 'lore') text = '[W] lore: '+(t.query||'').slice(0,35);
    else text = '\u2022 '+(t.text||t.action||t.agent||type).toString().slice(0,45);
    return '<div class="tl '+cls+'">'+text+'</div>';
  }).join('');
  traceFeed.innerHTML = feedHtml || '<div class="tl info">\u27F3 Awaiting actions...</div>';

  const fullHtml = lines.map(t => {
    const type = t.type || 'info';
    const cls = type === 'dice' ? 'roll' : type === 'state_update' ? 'info' : 'done';
    let text = '';
    if(type === 'dice'){
      text = t.actor+' - '+t.check+' vs DC '+t.difficulty+' \u2192 rolled '+t.roll+(t.modifier?' +'+t.modifier:'')+' = '+t.total+' ('+t.result.toUpperCase()+')';
      if(t.consequence) text += '<br><span style="color:#6a5030;font-size:0.9em">\u21B3 '+t.consequence+'</span>';
    } else if(type === 'narration'){
      text = '\u270E '+(t.text || '');
    } else if(type === 'state_update'){
      text = '\u21B3 STATE';
      if(t.location) text += ' - '+t.location;
      if(t.health_changes) text += ' - HP: '+Object.entries(t.health_changes).map(([k,v]) => k+' '+(v>0?'+':'')+v).join(', ');
      if(t.flags_set) text += ' - '+Object.keys(t.flags_set).join(', ');
    } else if(type === 'agent_intro'){
      const mem = gameState&&gameState.party&&gameState.party.find(m=>m.agent===(t.agent||''));
      text = '\u25b6 '+(mem?mem.name:t.agent||'?')+' is ready';
    } else if(type === 'agent_action'){
      const mem = gameState&&gameState.party&&gameState.party.find(m=>m.agent===(t.agent||''));
      text = '\u25b6 '+(mem?mem.name:t.agent||'?')+': '+(t.action||'');
    } else if(type === 'plan'){
      text = '[*] PLAN: '+(t.intent||t.text||'');
    } else if(type === 'lore'){
      text = '[W] LORE FETCH: '+(t.query||'');
    } else {
      text = '\u2022 '+(t.text||t.action||t.agent||type)+' '+JSON.stringify(t).slice(0,60);
    }
    return '<div class="tf-line '+cls+'">'+text+'</div>';
  }).join('');
  traceFullBody.innerHTML = fullHtml || '<div class="tf-line info">No trace entries yet.</div>';
  traceFullHd.textContent = '\u25C8 AGENT REASONING TRACE ('+lines.length+')';
}

function setRole(roleKey){
  currentRole = roleKey;
  const d = ROLE_DATA[roleKey] || ROLE_DATA.warrior;
  const member = gameState && gameState.party && gameState.party.find(m => m.agent.toLowerCase() === roleKey);
  roleAccent.className = 'role-accent ' + d.accent;
  roleBadge.textContent = member ? member.name.toUpperCase() : (d.badge || roleKey.toUpperCase());
  portraitEl.style.borderColor = d.borderColor;
  speakerName.className = 'speaker ' + (d.speakerCls || '');
  speakerName.style.color = d.speakerColor;
  speakerName.textContent = member ? member.name : (d.badge || roleKey.toUpperCase());
  portraitContainer.innerHTML = portraitSpriteHTML(roleKey);
  document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('lit'));
  if(member){
    const card = document.querySelector('.agent-card[data-role="'+member.agent+'"]');
    if(card) card.classList.add('lit');
  }
}

function showGM(){
  roleAccent.className = 'role-accent gm-acc';
  roleBadge.textContent = 'GM';
  portraitEl.style.borderColor = '#7a5228';
  speakerName.className = 'speaker';
  speakerName.style.color = '#c8922a';
  speakerName.textContent = 'GAME MASTER';
  portraitContainer.innerHTML = `<img src="${API_BASE}/assets/game-master.png" alt="GM" style="image-rendering:pixelated" onerror="portraitFallback(this,'gm')">`;
  pInput.addEventListener('input', showPlayer, { once: true });
}

function showPlayer(){
  setRole(currentRole);
}

const VIEWS = {agents:'agentView',die:'dieView',trace:'traceFull',recap:'recapView',lore:'loreView',map:'mapView'};

function setStage(name){
  if(name === 'die'){
    const dieBtn = document.querySelector('.sb-btn[data-view="die"]');
    if(dieBtn && dieBtn.classList.contains('locked')) return;
  }
  Object.values(VIEWS).forEach(id => {
    const el = $(id);
    if(el) el.style.display = 'none';
  });
  const target = $(VIEWS[name]);
  if(target){
    target.style.display = 'flex';
    target.style.flexDirection = (name === 'agents' || name === 'die') ? '' : 'column';
  }
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.sb-btn[data-view="'+name+'"]');
  if(btn) btn.classList.add('active');
  if(name === 'die') resetDie();
  if(name === 'map' && typeof renderMap === 'function') renderMap();
}
