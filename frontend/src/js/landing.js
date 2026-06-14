const API_BASE = 'http://localhost:8000';
const MAX_PARTY = 4;

async function apiPost(endpoint, body){
  const r = await fetch(`${API_BASE}${endpoint}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

let myClass = null;
let allyClasses = [];
let selectedCampaign = null;
let uploadedFileContent = null;
let availableClasses = [];
let classMeta = {};

async function loadClasses(){
  try {
    const r = await fetch(`${API_BASE}/character-types`, {signal:AbortSignal.timeout(2000)});
    if(r.ok) {
      const data = await r.json();
      availableClasses = data.map(c => c.name);
      classMeta = Object.fromEntries(data.map(c => [c.name, {ico: c.ico, desc: c.desc}]));
    }
  } catch {}
  renderClasses();
}

function handleClassClick(cls){
  if(myClass === cls){
    myClass = null;
    allyClasses = [];
  } else {
    myClass = cls;
    allyClasses = availableClasses.filter(c => c !== cls);
  }
  renderClasses();
  validateForm();
}

function renderClasses(){
  const grid = document.getElementById('classGrid');
  grid.innerHTML = '';
  availableClasses.forEach(cls => {
    const meta = classMeta[cls] || {ico:'?',desc:''};
    const card = document.createElement('div');
    card.className = 'class-card';
    if(myClass === cls) card.classList.add('you');
    if(allyClasses.includes(cls)) card.classList.add('ally');
    card.dataset.class = cls;
    let badge = '';
    if(myClass === cls) badge = '<span class="c-badge you-badge">YOU</span>';
    else if(allyClasses.includes(cls)) badge = '<span class="c-badge ally-badge">ALLY</span>';
    card.innerHTML = `<span class="ico">${meta.ico}</span><span class="cname">${cls.toUpperCase()}</span><span class="cdesc">${meta.desc}</span>${badge}`;
    card.onclick = () => handleClassClick(cls);
    grid.appendChild(card);
  });
  let counter = document.getElementById('partyCounter');
  if(!counter){
    counter = document.createElement('div');
    counter.id = 'partyCounter';
    counter.className = 'party-counter';
    grid.parentNode.insertBefore(counter, grid.nextSibling);
  }
  const total = myClass ? 1 + allyClasses.length : 0;
  counter.textContent = 'PARTY: '+total+'/'+MAX_PARTY;
}

async function loadExistingCampaign(){
  const list = document.getElementById('campList');
  try {
    const r = await fetch(`${API_BASE}/state`, {signal:AbortSignal.timeout(3000)});
    if(!r.ok) throw new Error('not found');
    const state = await r.json();
    list.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'camp-item';
    item.innerHTML = `<div class="ci-title">${state.campaign || 'Unknown'}</div><div class="ci-detail">${state.location || '?'} - ${state.active_quest || '?'}</div>`;
    item.onclick = () => {
      document.querySelectorAll('.camp-item').forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      selectedCampaign = state;
      validateForm();
    };
    list.appendChild(item);
    item.click();
  } catch {
    list.innerHTML = '<div class="error-text">\u26A0 Backend unreachable</div>';
  }
}

document.getElementById('uploadZone').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = (e) => {
  const f = e.target.files[0];
  if(!f) return;
  document.getElementById('uploadStatus').textContent = `${f.name} (${(f.size/1024).toFixed(1)} KB) - upload coming soon`;
};

function validateForm(){
  const name = document.getElementById('charName').value.trim();
  const valid = name.length > 0 && myClass !== null;
  document.getElementById('startBtn').disabled = !valid;
}
document.getElementById('charName').oninput = validateForm;

document.getElementById('startBtn').onclick = async () => {
  const name = document.getElementById('charName').value.trim();
  if(!name || !myClass) return;

  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  btn.textContent = '\u27F3 INITIALIZING...';

  const campaignName = selectedCampaign?.campaign || 'The Lost Sigil';
  const location = selectedCampaign?.location || 'Whispering Woods';
  const quest = selectedCampaign?.active_quest || 'A new adventure';

  const defaultNames = {Warrior:'Jax', Mage:'Lyra', Healer:'Bram', Bard:'Seren', Rival:'Kael'};
  const defaultInv = {Warrior:[], Mage:['Staff'], Healer:['Medkit'], Bard:['Lute'], Rival:['Hidden Blade']};
  const allSelected = [myClass, ...allyClasses.filter(c => c !== myClass)];
  if(!allSelected.includes('Rival')) allSelected.push('Rival');
  const party = allSelected.map(agent => ({
    agent,
    name: agent === myClass ? name : (defaultNames[agent] || agent),
    health: 20, max_health: 20,
    inventory: agent === myClass ? [] : (defaultInv[agent] || [])
  }));

  try {
    await apiPost('/reset', {campaign: campaignName, location, active_quest: quest, party, world_flags: {}, player_character: myClass});
  } catch {}

  localStorage.setItem('opencode_playerName', name);
  localStorage.setItem('opencode_playerClass', myClass);
  localStorage.setItem('opencode_campaign', campaignName);
  localStorage.setItem('opencode_location', location);
  localStorage.setItem('opencode_quest', quest);
  if(uploadedFileContent) localStorage.setItem('opencode_uploadedRules', uploadedFileContent);

  window.location.href = 'game.html';
};

loadClasses();
loadExistingCampaign();
