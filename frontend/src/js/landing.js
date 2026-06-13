const API_BASE = 'http://localhost:8000';
const DEFAULT_CLASSES = ['Warrior', 'Mage', 'Rogue', 'Healer'];

const CLASS_META = {
  Warrior:{ico:'\u2694',desc:'Brute strength & steel'},
  Mage:{ico:'\u2726',desc:'Arcane wisdom & power'},
  Rogue:{ico:'\u25C8',desc:'Stealth & cunning'},
  Healer:{ico:'\u271A',desc:'Restoration & support'}
};

async function apiPost(endpoint, body){
  const r = await fetch(`${API_BASE}${endpoint}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

let selectedClass = null;
let selectedCampaign = null;
let uploadedFileContent = null;

async function loadClasses(){
  let classes = DEFAULT_CLASSES;
  try {
    const r = await fetch(`${API_BASE}/character-types`, {signal:AbortSignal.timeout(2000)});
    if(r.ok) classes = await r.json();
  } catch {}
  renderClasses(classes);
}

function renderClasses(list){
  const grid = document.getElementById('classGrid');
  grid.innerHTML = '';
  list.forEach(cls => {
    const meta = CLASS_META[cls] || {ico:'?',desc:''};
    const card = document.createElement('div');
    card.className = 'class-card' + (selectedClass === cls ? ' selected' : '');
    card.dataset.class = cls;
    card.innerHTML = `<span class="ico">${meta.ico}</span><span class="cname">${cls.toUpperCase()}</span><span class="cdesc">${meta.desc}</span>`;
    card.onclick = () => {
      document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedClass = cls;
      validateForm();
    };
    grid.appendChild(card);
  });
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
    item.innerHTML = `<div class="ci-title">${state.campaign || 'Unknown'}</div><div class="ci-detail">\uD83D\uDCCD ${state.location || '?'} — ${state.active_quest || '?'}</div>`;
    item.onclick = () => {
      document.querySelectorAll('.camp-item').forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      selectedCampaign = state;
      validateForm();
    };
    list.appendChild(item);
  } catch {
    list.innerHTML = '<div class="error-text">\u26A0 Backend unreachable</div>';
  }
}

document.getElementById('uploadZone').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = (e) => {
  const f = e.target.files[0];
  if(!f) return;
  document.getElementById('uploadStatus').textContent = `\uD83D\uDCC4 ${f.name} (${(f.size/1024).toFixed(1)} KB) — upload coming soon`;
};

function validateForm(){
  const name = document.getElementById('charName').value.trim();
  const valid = name.length > 0 && selectedClass !== null;
  document.getElementById('startBtn').disabled = !valid;
}
document.getElementById('charName').oninput = validateForm;

document.getElementById('startBtn').onclick = async () => {
  const name = document.getElementById('charName').value.trim();
  if(!name || !selectedClass) return;

  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  btn.textContent = '\u27F3 INITIALIZING...';

  const campaignName = selectedCampaign?.campaign || 'The Lost Sigil';
  const location = selectedCampaign?.location || 'Whispering Woods';
  const quest = selectedCampaign?.active_quest || 'A new adventure';

  const defaultNames = {Warrior:'Thorn', Mage:'Elara', Rogue:'Vex', Healer:'Luna'};
  const defaultInv = {Warrior:[], Mage:['Staff'], Rogue:['Dagger','Lockpicks'], Healer:['Herbs']};
  const agents = ['Warrior','Mage','Rogue','Healer'];
  const party = agents.map(agent => ({
    agent,
    name: agent === selectedClass ? name : (defaultNames[agent] || agent),
    health: 20, max_health: 20,
    inventory: agent === selectedClass ? [] : (defaultInv[agent] || [])
  }));

  try {
    await apiPost('/reset', {campaign: campaignName, location, active_quest: quest, party, world_flags: {}});
  } catch {}

  localStorage.setItem('opencode_playerName', name);
  localStorage.setItem('opencode_playerClass', selectedClass);
  localStorage.setItem('opencode_campaign', campaignName);
  localStorage.setItem('opencode_location', location);
  localStorage.setItem('opencode_quest', quest);
  if(uploadedFileContent) localStorage.setItem('opencode_uploadedRules', uploadedFileContent);

  window.location.href = 'game.html';
};

loadClasses();
loadExistingCampaign();
