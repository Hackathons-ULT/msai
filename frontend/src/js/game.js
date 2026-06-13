const API_BASE = 'http://localhost:8000';

const AGENT_SPRITES = {
  gm:'<svg width="100%" height="100%" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="24" y="4" width="16" height="4" fill="#9a8820"/><rect x="20" y="8" width="24" height="16" fill="#c8aa30"/><rect x="22" y="10" width="4" height="6" fill="#2a1a06"/><rect x="38" y="10" width="4" height="6" fill="#2a1a06"/><rect x="24" y="22" width="16" height="2" fill="#9a8820"/><rect x="22" y="24" width="20" height="20" fill="#7a5a9a"/><rect x="18" y="28" width="4" height="12" fill="#5a3a7a"/><rect x="42" y="28" width="4" height="12" fill="#5a3a7a"/><rect x="24" y="44" width="6" height="14" fill="#5a3a7a"/><rect x="34" y="44" width="6" height="14" fill="#5a3a7a"/><rect x="20" y="56" width="6" height="4" fill="#3a2050"/><rect x="38" y="56" width="6" height="4" fill="#3a2050"/><rect x="28" y="2" width="4" height="4" fill="#cc3322"/><rect x="20" y="6" width="4" height="3" fill="#c87820"/><rect x="40" y="6" width="4" height="3" fill="#c87820"/></svg>',
  warrior:'<svg width="100%" height="100%" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="20" y="4" width="24" height="4" fill="#787878"/><rect x="16" y="8" width="32" height="14" fill="#a0a0a0"/><rect x="14" y="10" width="4" height="8" fill="#787878"/><rect x="46" y="10" width="4" height="8" fill="#787878"/><rect x="22" y="10" width="8" height="6" fill="#1e1408"/><rect x="34" y="10" width="8" height="6" fill="#1e1408"/><rect x="22" y="14" width="20" height="2" fill="#c8a040"/><rect x="18" y="22" width="28" height="22" fill="#909090"/><rect x="20" y="24" width="24" height="18" fill="#b8b8b8"/><rect x="10" y="22" width="10" height="10" fill="#787878"/><rect x="44" y="22" width="10" height="10" fill="#787878"/><rect x="10" y="30" width="8" height="14" fill="#a0a0a0"/><rect x="46" y="30" width="8" height="14" fill="#a0a0a0"/><rect x="54" y="16" width="4" height="30" fill="#c0c0c0"/><rect x="52" y="24" width="8" height="4" fill="#a07820"/><rect x="20" y="44" width="10" height="18" fill="#686868"/><rect x="34" y="44" width="10" height="18" fill="#686868"/><rect x="18" y="60" width="12" height="6" fill="#484848"/><rect x="34" y="60" width="12" height="6" fill="#484848"/><rect x="28" y="28" width="8" height="8" fill="#c84422"/></svg>',
  mage:'<svg width="100%" height="100%" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="28" y="0" width="8" height="4" fill="#3a1a78"/><rect x="24" y="4" width="16" height="4" fill="#4a2a8a"/><rect x="16" y="8" width="32" height="4" fill="#5a3a9a"/><rect x="20" y="12" width="24" height="14" fill="#d4a878"/><rect x="24" y="16" width="4" height="4" fill="#1e1408"/><rect x="36" y="16" width="4" height="4" fill="#1e1408"/><rect x="16" y="26" width="32" height="26" fill="#4a2a8a"/><rect x="18" y="28" width="28" height="22" fill="#5a3a9a"/><rect x="16" y="26" width="4" height="26" fill="#8a6ab8"/><rect x="44" y="26" width="4" height="26" fill="#8a6ab8"/><rect x="8" y="16" width="4" height="44" fill="#6a3a18"/><rect x="4" y="10" width="12" height="8" fill="#9090d8"/><rect x="28" y="34" width="4" height="8" fill="#c8b8f0"/><rect x="26" y="36" width="8" height="4" fill="#c8b8f0"/><rect x="22" y="52" width="8" height="14" fill="#3a1a78"/><rect x="34" y="52" width="8" height="14" fill="#3a1a78"/><rect x="20" y="64" width="10" height="4" fill="#281060"/><rect x="34" y="64" width="10" height="4" fill="#281060"/></svg>',
  rogue:'<svg width="100%" height="100%" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="20" y="4" width="24" height="4" fill="#142014"/><rect x="18" y="8" width="28" height="12" fill="#1e301e"/><rect x="16" y="10" width="6" height="10" fill="#142014"/><rect x="42" y="10" width="6" height="10" fill="#142014"/><rect x="22" y="12" width="20" height="10" fill="#c4a070"/><rect x="24" y="16" width="4" height="3" fill="#28aa58"/><rect x="36" y="16" width="4" height="3" fill="#28aa58"/><rect x="16" y="22" width="32" height="26" fill="#182818"/><rect x="20" y="24" width="24" height="22" fill="#1e301e"/><rect x="26" y="28" width="3" height="14" fill="#b0b0b0" transform="rotate(-20 27 34)"/><rect x="36" y="28" width="3" height="14" fill="#b0b0b0" transform="rotate(20 37 34)"/><rect x="24" y="30" width="6" height="3" fill="#987818"/><rect x="34" y="30" width="6" height="3" fill="#987818"/><rect x="16" y="22" width="4" height="26" fill="#286040"/><rect x="44" y="22" width="4" height="26" fill="#286040"/><rect x="20" y="48" width="10" height="18" fill="#142014"/><rect x="34" y="48" width="10" height="18" fill="#142014"/><rect x="18" y="62" width="12" height="6" fill="#0c180c"/><rect x="34" y="62" width="12" height="6" fill="#0c180c"/></svg>',
  healer:'<svg width="100%" height="100%" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="20" y="6" width="24" height="4" fill="#e8e8c0"/><rect x="18" y="10" width="28" height="12" fill="#f0f0d0"/><rect x="16" y="12" width="4" height="10" fill="#d8d8b0"/><rect x="44" y="12" width="4" height="10" fill="#d8d8b0"/><rect x="22" y="14" width="20" height="10" fill="#e8c090"/><rect x="24" y="16" width="4" height="4" fill="#4878b8"/><rect x="36" y="16" width="4" height="4" fill="#4878b8"/><rect x="16" y="24" width="32" height="28" fill="#d8e8d8"/><rect x="20" y="26" width="24" height="24" fill="#e8f0e8"/><rect x="28" y="30" width="8" height="4" fill="#cc2222"/><rect x="30" y="28" width="4" height="8" fill="#cc2222"/><rect x="10" y="26" width="8" height="18" fill="#d8e8d8"/><rect x="46" y="26" width="8" height="18" fill="#d8e8d8"/><rect x="16" y="24" width="4" height="28" fill="#c0a030"/><rect x="44" y="24" width="4" height="28" fill="#c0a030"/><rect x="22" y="52" width="8" height="16" fill="#c0d0c0"/><rect x="34" y="52" width="8" height="16" fill="#c0d0c0"/><rect x="20" y="66" width="10" height="4" fill="#a09028"/><rect x="34" y="66" width="10" height="4" fill="#a09028"/></svg>'
};

const PORTRAITS = {
  warrior:'<rect width="72" height="86" fill="#1a1008"/><rect x="8" y="4" width="56" height="8" fill="#888"/><rect x="4" y="12" width="64" height="28" fill="#a8a8a8"/><rect x="0" y="16" width="8" height="20" fill="#888"/><rect x="64" y="16" width="8" height="20" fill="#888"/><rect x="12" y="18" width="18" height="14" fill="#1e1408"/><rect x="42" y="18" width="18" height="14" fill="#1e1408"/><rect x="12" y="26" width="48" height="4" fill="#c8a040"/><rect x="4" y="36" width="64" height="4" fill="#888"/><rect x="8" y="40" width="56" height="16" fill="#999"/><rect x="10" y="42" width="52" height="12" fill="#b8b8b8"/><rect x="24" y="56" width="24" height="12" fill="#c8a070"/><rect x="0" y="68" width="20" height="18" fill="#888"/><rect x="52" y="68" width="20" height="18" fill="#888"/><rect x="16" y="68" width="40" height="18" fill="#c84422"/><rect x="30" y="72" width="12" height="12" fill="#e85533"/><rect x="32" y="70" width="8" height="16" fill="#e85533"/>',
  mage:'<rect width="72" height="86" fill="#0e081e"/><rect x="28" y="0" width="16" height="8" fill="#3a1a78"/><rect x="20" y="8" width="32" height="6" fill="#4a2a8a"/><rect x="12" y="14" width="48" height="8" fill="#5a3a9a"/><rect x="10" y="22" width="52" height="20" fill="#d4a070"/><rect x="14" y="26" width="10" height="10" fill="#1e1408"/><rect x="48" y="26" width="10" height="10" fill="#1e1408"/><rect x="14" y="30" width="10" height="4" fill="#9090d8" opacity="0.7"/><rect x="48" y="30" width="10" height="4" fill="#9090d8" opacity="0.7"/><rect x="10" y="42" width="52" height="28" fill="#4a2a8a"/><rect x="14" y="44" width="44" height="24" fill="#5a3a9a"/><rect x="0" y="44" width="14" height="28" fill="#3a1a78"/><rect x="58" y="44" width="14" height="28" fill="#3a1a78"/><rect x="30" y="50" width="12" height="4" fill="#c8b8f0"/><rect x="32" y="48" width="8" height="8" fill="#c8b8f0"/><rect x="0" y="66" width="14" height="20" fill="#5a3a9a"/><rect x="58" y="66" width="14" height="20" fill="#5a3a9a"/>',
  rogue:'<rect width="72" height="86" fill="#081208"/><rect x="8" y="4" width="56" height="10" fill="#142014"/><rect x="4" y="14" width="64" height="20" fill="#1e301e"/><rect x="0" y="14" width="10" height="24" fill="#142014"/><rect x="62" y="14" width="10" height="24" fill="#142014"/><rect x="12" y="24" width="48" height="14" fill="#c4a070"/><rect x="16" y="28" width="10" height="8" fill="#0a0a0a" opacity="0.6"/><rect x="16" y="30" width="8" height="5" fill="#28aa58" opacity="0.9"/><rect x="48" y="30" width="8" height="5" fill="#28aa58" opacity="0.9"/><rect x="4" y="38" width="64" height="32" fill="#182818"/><rect x="8" y="40" width="56" height="28" fill="#1e301e"/><rect x="0" y="38" width="8" height="32" fill="#286040"/><rect x="64" y="38" width="8" height="32" fill="#286040"/><rect x="28" y="46" width="16" height="4" fill="#c0c0c0"/><rect x="26" y="42" width="6" height="12" fill="#c0c0c0"/><rect x="40" y="42" width="6" height="12" fill="#c0c0c0"/><rect x="22" y="48" width="10" height="4" fill="#987818"/><rect x="40" y="48" width="10" height="4" fill="#987818"/><rect x="4" y="70" width="64" height="16" fill="#142014"/>',
  healer:'<rect width="72" height="86" fill="#080e08"/><rect x="8" y="4" width="56" height="10" fill="#e8e8c0"/><rect x="4" y="14" width="64" height="20" fill="#f0f0d0"/><rect x="0" y="14" width="10" height="24" fill="#d8d8b0"/><rect x="62" y="14" width="10" height="24" fill="#d8d8b0"/><rect x="12" y="24" width="48" height="14" fill="#e8c090"/><rect x="16" y="28" width="10" height="6" fill="#4878b8"/><rect x="46" y="28" width="10" height="6" fill="#4878b8"/><rect x="4" y="38" width="64" height="32" fill="#d8e8d8"/><rect x="8" y="40" width="56" height="28" fill="#e8f0e8"/><rect x="0" y="38" width="8" height="32" fill="#c0a030"/><rect x="64" y="38" width="8" height="32" fill="#c0a030"/><rect x="30" y="46" width="12" height="4" fill="#cc2222"/><rect x="34" y="44" width="4" height="8" fill="#cc2222"/><rect x="28" y="48" width="16" height="4" fill="#cc2222"/><rect x="4" y="70" width="64" height="16" fill="#a09028"/>'
};

const ROLE_DATA = {
  warrior:{badge:'WARRIOR',accent:'warrior-acc',speakerCls:'',speakerColor:'#c8922a',borderColor:'#7a5228'},
  mage:{badge:'MAGE',accent:'mage-acc',speakerCls:'mage-spk',speakerColor:'#9966ff',borderColor:'#4a2a8a'},
  rogue:{badge:'ROGUE',accent:'rogue-acc',speakerCls:'rogue-spk',speakerColor:'#44cc88',borderColor:'#1a4422'},
  healer:{badge:'HEALER',accent:'healer-acc',speakerCls:'healer-spk',speakerColor:'#44ddbb',borderColor:'#1a4433'}
};

let gameState = null;
let currentRole = 'warrior';
let playerName = '';
let playerClass = '';
let dieRolling = false;
const dieMax = 20;

const $ = id => document.getElementById(id);
const agentView = $('agentView');
const traceFeed = $('traceFeed');
const traceFullBody = $('traceFullBody');
const traceFullHd = $('traceFullHd');
const narrText = $('narrText');
const pInput = $('pInput');
const hpDisplay = $('hpDisplay');
const turnText = $('turnText');
const portraitContainer = $('portraitContainer');
const roleBadge = $('roleBadge');
const roleAccent = $('roleAccent');
const speakerName = $('speakerName');
const portraitEl = $('portrait');
const dieNum = $('dieNum');
const dieLabel = $('dieLabel');
const dieHint = $('dieHint');
const dieResult = $('dieResult');
const roleSwitcher = $('roleSwitcher');
const loadingOverlay = $('loadingOverlay');
const toast = $('toast');
const recapBody = $('recapBody');

let toastTimer = null;
function showToast(msg, color){
  if(!color) color = '#cc4444';
  toast.textContent = msg;
  toast.style.borderColor = color;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

async function apiGet(endpoint){
  const r = await fetch(`${API_BASE}${endpoint}`);
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function apiPost(endpoint, body){
  const r = await fetch(`${API_BASE}${endpoint}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const spriteBackendMap = {};

async function probeSprite(role){
  const key = role.toLowerCase();
  try {
    const r = await fetch(`${API_BASE}/assets/characters/${role}.png`, {method:'HEAD', signal:AbortSignal.timeout(1500)});
    if(r.ok){ spriteBackendMap[key] = true; return; }
  } catch {}
  spriteBackendMap[key] = false;
}

function agentSpriteHTML(role){
  const key = role.toLowerCase();
  if(spriteBackendMap[key]){
    return `<img src="${API_BASE}/assets/characters/${role}.png" alt="${role}" style="width:100%;height:100%;image-rendering:pixelated">`;
  }
  return AGENT_SPRITES[key] || AGENT_SPRITES.warrior;
}

function portraitSpriteHTML(role){
  const key = role.toLowerCase();
  if(spriteBackendMap[key]){
    return `<img src="${API_BASE}/assets/characters/${role}.png" alt="${role}" style="width:100%;height:100%;image-rendering:pixelated">`;
  }
  const svgContent = PORTRAITS[key] || PORTRAITS.warrior;
  return `<svg viewBox="0 0 72 86" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;display:block;width:100%;height:100%;">${svgContent}</svg>`;
}

async function probeAllSprites(roles){
  const tasks = roles.map(r => probeSprite(r));
  await Promise.allSettled(tasks);
}

function renderParty(){
  if(!gameState) return;
  const members = gameState.party || [];
  const activeKey = playerClass.toLowerCase();
  let html = '<div class="agent-card" data-role="gm"><div class="sprite-container">'+agentSpriteHTML('gm')+'</div><div class="agent-lbl">MASTER<span>GM</span></div></div>';
  members.forEach(m => {
    const key = m.agent.toLowerCase();
    const isLit = key === activeKey;
    html += '<div class="agent-card'+(isLit?' lit':'')+'" data-role="'+m.agent+'"><div class="sprite-container">'+agentSpriteHTML(m.agent)+'</div><div class="agent-lbl">'+m.agent.toUpperCase()+'<span>'+m.name+' '+(isLit?'\u2694 active':'\u25C8 standby')+'</span></div></div>';
  });
  agentView.innerHTML = html;
  updateHUD();
}

function updateHUD(){
  if(!gameState) return;
  const members = gameState.party || [];
  let totalHp = 0, totalMax = 0;
  members.forEach(m => { totalHp += m.health; totalMax += m.max_health; });
  const pct = totalMax > 0 ? (totalHp / totalMax * 100) : 0;
  hpDisplay.innerHTML = 'HP '+totalHp+'/'+totalMax+'<div class="hp-bar"><div class="hp-fill" id="hpFill" style="width:'+pct+'%"></div></div>';
  turnText.textContent = (gameState.location || '?')+' \u2014 '+(gameState.active_quest || '?');
  recapBody.innerHTML = '\uD83D\uDCCD '+(gameState.location || 'Unknown location')+'<br>\uD83D\uDCDC '+(gameState.active_quest || 'No active quest')+'<br>\uD83C\uDFC1 '+(gameState.campaign || 'Unknown campaign');
}

function renderTrace(traceData){
  const lines = traceData || [];
  const feedHtml = lines.slice(-8).map(t => {
    const type = t.type || 'info';
    const cls = type === 'dice' ? 'roll' : type === 'state_update' ? 'info' : 'done';
    let text;
    if(type === 'dice') text = '\uD83C\uDFB2 '+t.actor+' '+t.check+' \u2192 '+t.total;
    else if(type === 'narration') text = '\u270E '+t.text;
    else if(type === 'state_update') text = '\u21B3 '+(t.location?'\uD83D\uDCCD '+t.location:'')+(t.health_changes?' HP\u0394':'')+(t.flags_set?' \uD83D\uDEA9':'');
    else text = '\u2022 '+JSON.stringify(t).slice(0,40);
    return '<div class="tl '+cls+'">'+text+'</div>';
  }).join('');
  traceFeed.innerHTML = feedHtml || '<div class="tl info">\u27F3 Awaiting actions...</div>';

  const fullHtml = lines.map(t => {
    const type = t.type || 'info';
    const cls = type === 'dice' ? 'roll' : type === 'state_update' ? 'info' : 'done';
    let text = '';
    if(type === 'dice'){
      text = '\uD83C\uDFB2 '+t.actor+' \u2014 '+t.check+' vs DC '+t.difficulty+' \u2192 rolled '+t.roll+(t.modifier?' +'+t.modifier:'')+' = '+t.total+' ('+t.result.toUpperCase()+')';
      if(t.consequence) text += '<br><span style="color:#6a5030;font-size:0.9em">\u21B3 '+t.consequence+'</span>';
    } else if(type === 'narration'){
      text = '\u270E '+(t.text || '');
    } else if(type === 'state_update'){
      text = '\u21B3 STATE';
      if(t.location) text += ' \u2014 \uD83D\uDCCD '+t.location;
      if(t.health_changes) text += ' \u2014 HP: '+Object.entries(t.health_changes).map(([k,v]) => k+' '+(v>0?'+':'')+v).join(', ');
      if(t.flags_set) text += ' \u2014 \uD83D\uDEA9 '+Object.keys(t.flags_set).join(', ');
    } else {
      text = '\u2022 '+JSON.stringify(t);
    }
    return '<div class="tf-line '+cls+'">'+text+'</div>';
  }).join('');
  traceFullBody.innerHTML = fullHtml || '<div class="tf-line info">No trace entries yet.</div>';
  traceFullHd.textContent = '\u25C8 AGENT REASONING TRACE ('+lines.length+')';
}

function renderRoleSwitcher(){
  if(!gameState) return;
  const members = gameState.party || [];
  roleSwitcher.innerHTML = members.map(m => {
    const key = m.agent.toLowerCase();
    const label = m.agent.slice(0,3).toUpperCase();
    return '<button class="r-btn'+(key === currentRole?' active':'')+'" data-role="'+key+'" onclick="setRole(\''+key+'\')">'+label+'</button>';
  }).join('');
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
  portraitContainer.innerHTML = portraitSpriteHTML(roleKey);
  document.querySelectorAll('.r-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.r-btn[data-role="'+roleKey+'"]');
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('lit'));
  if(member){
    const card = document.querySelector('.agent-card[data-role="'+member.agent+'"]');
    if(card) card.classList.add('lit');
  }
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

async function sendAct(){
  const val = pInput.value.trim();
  if(!val) return;
  pInput.value = '';
  narrText.innerHTML = '<em style="color:#8a6a3a;font-size:0.8em">\u00BB '+val+'</em><br><br><span style="color:#a09070">\u2026the agents confer\u2026</span><span class="cursor"></span>';
  try {
    const res = await apiPost('/action', {text: val});
    gameState = res.state;
    renderParty();
    renderRoleSwitcher();
    if(res.trace) renderTrace(res.trace);
    narrText.innerHTML = (res.narration || 'The agents responded.') + '<span class="cursor"></span>';
  } catch(e){
    narrText.innerHTML = '<span style="color:#cc4444">\u26A0 Error: '+e.message+'</span><span class="cursor"></span>';
    showToast('Action failed: '+e.message);
  }
}

function resetDie(){
  dieResult.style.display = 'none';
  dieHint.style.display = 'block';
  dieHint.textContent = '[ click to roll ]';
  dieNum.textContent = dieMax;
  dieLabel.textContent = 'D'+dieMax+' \u2014 '+currentRole.toUpperCase()+' CHECK';
  dieRolling = false;
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
  const roles = ['gm'].concat(gameState && gameState.party ? gameState.party.map(m => m.agent) : []);
  probeAllSprites(roles);
  renderParty();
  renderRoleSwitcher();
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
