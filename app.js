// FocusFlow — no backend, all data in localStorage
const ding = document.getElementById('ding');
const timeDisplay = document.getElementById('timeDisplay');
const sessionLabel = document.getElementById('sessionLabel');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

const focusMin = document.getElementById('focusMin');
const breakMin = document.getElementById('breakMin');
const longMin = document.getElementById('longMin');
const intervals = document.getElementById('intervals');
const autoContinue = document.getElementById('autoContinue');
const soundToggle = document.getElementById('soundToggle');

// tasks
const taskForm = document.getElementById('taskForm');
const taskText = document.getElementById('taskText');
const taskDue = document.getElementById('taskDue');
const taskTag = document.getElementById('taskTag');
const taskList = document.getElementById('taskList');
const search = document.getElementById('search');
const filterTag = document.getElementById('filterTag');
const filterState = document.getElementById('filterState');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// stats
const statFocus = document.getElementById('statFocus');
const statBreak = document.getElementById('statBreak');
const statTime = document.getElementById('statTime');
const weeklyChart = document.getElementById('weeklyChart');
const ctx = weeklyChart.getContext('2d');

let state = {
  mode: 'focus', // 'focus' | 'break' | 'long'
  remaining: 25*60,
  running: false,
  focusCount: 0,
  cycleCount: 0
};

let tasks = JSON.parse(localStorage.getItem('ff_tasks') || '[]');
let history = JSON.parse(localStorage.getItem('ff_history') || '[]'); // {date, type:'focus'|'break', seconds}

function save(){
  localStorage.setItem('ff_tasks', JSON.stringify(tasks));
  localStorage.setItem('ff_history', JSON.stringify(history));
}

function format(sec){
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function setMode(mode){
  state.mode = mode;
  sessionLabel.textContent = mode === 'focus' ? 'Focus' : (mode==='break' ? 'Break' : 'Long Break');
  const mins = mode==='focus' ? +focusMin.value : mode==='break' ? +breakMin.value : +longMin.value;
  state.remaining = mins * 60;
  updateDisplay();
}

function updateDisplay(){
  timeDisplay.textContent = format(state.remaining);
}

let ticker = null;
function start(){
  if(state.running) return;
  state.running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  ticker = setInterval(()=>{
    state.remaining--;
    updateDisplay();
    if(state.remaining <= 0){
      clearInterval(ticker); ticker=null;
      state.running=false;
      startBtn.disabled=false; pauseBtn.disabled=true;
      try{ if(soundToggle.checked) ding.play(); }catch(e){}
      sessionDone();
    }
  }, 1000);
}

function pause(){
  if(!state.running) return;
  clearInterval(ticker); ticker=null;
  state.running=false;
  startBtn.disabled=false; pauseBtn.disabled=true;
}

function reset(){
  pause();
  setMode(state.mode);
}

function sessionDone(){
  const now = new Date();
  const secs = (state.mode==='focus' ? +focusMin.value : state.mode==='break' ? +breakMin.value : +longMin.value) * 60;
  history.push({date: now.toISOString(), type: state.mode, seconds: secs});
  if(state.mode==='focus'){
    state.focusCount++;
    state.cycleCount++;
  }else{
    // break
  }
  save();
  renderStats();
  if(state.mode==='focus'){
    // after focus: normal break or long break
    if(state.cycleCount % (+intervals.value) === 0){
      setMode('long');
    }else{
      setMode('break');
    }
  }else{
    // after break go to focus
    setMode('focus');
  }
  if(autoContinue.checked){
    start();
  }
}

// Event bindings
startBtn.onclick = start;
pauseBtn.onclick = pause;
resetBtn.onclick = reset;
[focusMin, breakMin, longMin, intervals].forEach(el=>{
  el.addEventListener('change', ()=>{
    if(!state.running) setMode(state.mode);
  });
});

// Tasks
function addTask(text, due, tag){
  tasks.push({ id: crypto.randomUUID(), text, due: due||'', tag: tag||'', done:false, created: new Date().toISOString() });
  save(); renderTasks();
}

function toggleTask(id){
  tasks = tasks.map(t=> t.id===id ? {...t, done:!t.done} : t);
  save(); renderTasks();
}

function removeTask(id){
  tasks = tasks.filter(t=> t.id!==id);
  save(); renderTasks();
}

function renderTasks(){
  const q = search.value.toLowerCase();
  const tag = filterTag.value;
  const stateF = filterState.value;
  const items = tasks.filter(t=>{
    if(q && !t.text.toLowerCase().includes(q)) return false;
    if(tag && t.tag!==tag) return false;
    if(stateF==='open' && t.done) return false;
    if(stateF==='done' && !t.done) return false;
    return true;
  }).sort((a,b)=> (a.done===b.done?0:(a.done?1:-1)) || (a.due||'').localeCompare(b.due||''));

  taskList.innerHTML = items.map(t=>`
    <li class="item">
      <div class="left">
        <input type="checkbox" ${t.done?'checked':''} onclick="toggleTask('${t.id}')">
        <div>
          <div>${t.text} ${t.tag?`<span class="tag">${t.tag}</span>`:''}</div>
          ${t.due?`<div class="due">Due: ${t.due}</div>`:''}
        </div>
      </div>
      <div>
        <button onclick="removeTask('${t.id}')">Delete</button>
      </div>
    </li>
  `).join('');
}

taskForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const text = taskText.value.trim();
  if(!text) return;
  addTask(text, taskDue.value, taskTag.value);
  taskText.value=''; taskDue.value=''; taskTag.value='';
});

search.oninput = renderTasks;
filterTag.onchange = renderTasks;
filterState.onchange = renderTasks;

document.getElementById('clearDoneBtn').onclick = ()=>{
  tasks = tasks.filter(t=> !t.done);
  save(); renderTasks();
};

exportBtn.onclick = ()=>{
  const data = JSON.stringify({tasks, history}, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'focusflow-data.json';
  a.click();
};

importBtn.onclick = ()=> importFile.click();
importFile.onchange = (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(obj.tasks) tasks = obj.tasks;
      if(obj.history) history = obj.history;
      save(); renderTasks(); renderStats();
    }catch(err){ alert('Invalid JSON'); }
  };
  reader.readAsText(file);
};

// Stats & chart (vanilla canvas)
function renderStats(){
  const focusSessions = history.filter(h=>h.type==='focus').length;
  const breakSessions = history.filter(h=>h.type!=='focus').length;
  const totalFocusSec = history.filter(h=>h.type==='focus').reduce((s,h)=>s+h.seconds,0);
  statFocus.textContent = focusSessions;
  statBreak.textContent = breakSessions;
  statTime.textContent = Math.round(totalFocusSec/60) + 'm';
  drawWeeklyChart();
}

function drawWeeklyChart(){
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate()-6); start.setHours(0,0,0,0);
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = d.toISOString().slice(0,10);
    const mins = Math.round(history.filter(h=>{
      const hd = new Date(h.date);
      const same = hd.toISOString().slice(0,10)===key;
      return same && h.type==='focus';
    }).reduce((s,h)=>s+h.seconds,0)/60);
    days.push({x:key, y:mins});
  }

  // clear
  ctx.clearRect(0,0,weeklyChart.width, weeklyChart.height);
  // axes
  ctx.beginPath(); ctx.moveTo(40,10); ctx.lineTo(40,230); ctx.lineTo(580,230); ctx.strokeStyle='#556'; ctx.stroke();
  const maxY = Math.max(30, ...days.map(d=>d.y)); // minutes
  const sx = x => 40 + (580-40)*(x/6);
  const sy = y => 230 - (220) * (y/maxY);

  // grid
  ctx.strokeStyle='#223'; ctx.font='12px system-ui';
  for(let i=0;i<=maxY;i+=Math.max(10, Math.ceil(maxY/5))){
    const y=sy(i);
    ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(580,y); ctx.stroke();
    ctx.fillStyle='#9aa'; ctx.fillText(i+'m', 5, y+4);
  }

  // line
  ctx.strokeStyle='#9dbbff'; ctx.fillStyle='#9dbbff';
  ctx.beginPath();
  days.forEach((d,i)=>{
    const X = sx(i), Y = sy(d.y);
    if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y);
  });
  ctx.stroke();
  days.forEach((d,i)=>{
    const X = sx(i), Y = sy(d.y);
    ctx.beginPath(); ctx.arc(X,Y,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#cfd4ff'; ctx.fillText(d.x.slice(5), X-12, 245);
  });
}

function init(){
  setMode('focus');
  renderTasks();
  renderStats();
}
init();
