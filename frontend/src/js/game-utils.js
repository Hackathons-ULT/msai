const $ = id => document.getElementById(id);

const agentView = $('agentView');
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

function spriteFallback(img, role){
  const key = role.toLowerCase();
  img.outerHTML = AGENT_SPRITES[key] || AGENT_SPRITES.warrior;
}

function portraitFallback(img, role){
  const key = role.toLowerCase();
  const svgContent = PORTRAITS[key] || PORTRAITS.warrior;
  img.outerHTML = `<svg width="72" height="86" viewBox="0 0 72 86" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;display:block;">${svgContent}</svg>`;
}

function agentSpriteHTML(role){
  const lc = role.toLowerCase();
  const file = PNG_FILE[lc] || lc;
  return `<img src="${API_BASE}/assets/characters/${file}.png" alt="${role}" style="image-rendering:pixelated" onerror="spriteFallback(this,'${role}')">`;
}

function portraitSpriteHTML(role){
  const lc = role.toLowerCase();
  const file = PNG_FILE[lc] || lc;
  return `<img src="${API_BASE}/assets/characters/${file}.png" alt="${role}" style="image-rendering:pixelated" onerror="portraitFallback(this,'${role}')">`;
}

function resetDie(){
  if(lastDieResultText){
    dieNum.textContent = lastDieRoll;
    dieHint.style.display = 'none';
    dieResult.textContent = lastDieResultText;
    dieResult.style.color = lastDieColor;
    dieResult.style.display = 'block';
  } else {
    dieNum.textContent = dieMax;
    dieResult.style.display = 'none';
  }
  dieLabel.textContent = 'D20 ROLL HISTORY';
  dieRolling = false;
  renderDieHistory();
}

function renderDieHistory(){
  const histEl = document.getElementById('dieHistory');
  if(!histEl || typeof dieHistory === 'undefined') return;
  if(!dieHistory.length){ histEl.innerHTML = ''; return; }
  histEl.innerHTML = dieHistory.map(function(d){
    const modStr = d.modifier > 0 ? ' +'+d.modifier : d.modifier < 0 ? ' '+d.modifier : '';
    const ok = d.result === 'success';
    const label = ok ? 'SUCCESS' : 'FAIL';
    const col = ok ? '#5aaa44' : '#cc4444';
    return '<div class="dh-row" style="border-left:3px solid '+col+'">'
      +'<span class="dh-actor">'+(d.actor||'?').toUpperCase()+' - '+(d.check||'CHECK').toUpperCase()+'</span>'
      +'<span class="dh-result" style="color:'+col+'">'+d.roll+modStr+' = '+d.total+' ('+label+')</span>'
      +(d.consequence ? '<span class="dh-con">'+d.consequence+'</span>' : '')
      +'</div>';
  }).join('');
}
