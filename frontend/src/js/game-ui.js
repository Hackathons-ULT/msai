function renderParty(){
  if(!gameState) return;
  const members = gameState.party || [];
  const activeKey = currentRole;
  let html = '';
  members.forEach(m => {
    const key = m.agent.toLowerCase();
    const isLit = key === activeKey;
    const STAT_ABBR = {strength:'STR',dexterity:'DEX',constitution:'CON',intelligence:'INT',wisdom:'WIS',charisma:'CHA'};
    const statRows = Object.keys(STAT_ABBR).map(s =>
      '<tr><td class="st-name">'+STAT_ABBR[s]+'</td><td class="st-val">'+(m[s]??10)+'</td></tr>'
    ).join('');
    html += '<div class="agent-card'+(isLit?' lit':'')+'" data-role="'+m.agent+'"><div class="sprite-container">'+agentSpriteHTML(m.agent)+'</div><div class="agent-lbl">'+m.agent.toUpperCase()+'<span>'+m.name+' '+(isLit?'\u2694 active':'\u25C8 standby')+'</span></div><table class="stat-table">'+statRows+'</table></div>';
  });
  agentView.innerHTML = html;
  updateHUD();
  agentView.onclick = (e) => {
    const card = e.target.closest('.agent-card');
    if(!card) return;
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
    if(type === 'dice') text = t.actor+' '+t.check+' \u2192 '+t.total;
    else if(type === 'narration') text = '\u270E '+t.text;
    else if(type === 'state_update') text = '\u21B3 '+(t.location?t.location:'')+(t.health_changes?' HP*':'')+(t.flags_set?' [F]':'');
    else text = '\u2022 '+JSON.stringify(t).slice(0,40);
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
    } else {
      text = '\u2022 '+JSON.stringify(t);
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
  speakerName.textContent = member ? member.name+' ('+member.agent+')' : (d.badge || roleKey.toUpperCase());
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
  portraitContainer.innerHTML = '<img src="../assets/game-master.png" alt="GM" style="image-rendering:pixelated" onerror="portraitFallback(this,\'gm\')">';
  pInput.addEventListener('input', showPlayer, { once: true });
}

function showPlayer(){
  setRole(currentRole);
}

const VIEWS = {agents:'agentView',die:'dieView',trace:'traceFull',recap:'recapView',lore:'loreView'};

function setStage(name){
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
  const idx = Object.keys(VIEWS).indexOf(name);
  const btns = document.querySelectorAll('.sb-btn');
  if(btns[idx]) btns[idx].classList.add('active');
  if(name === 'die') resetDie();
}
