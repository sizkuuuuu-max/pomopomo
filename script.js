// ==========================================
// Supabase設定
// ==========================================
const SUPABASE_URL = "https://ypztnrpngebhecrdaccg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwenRucnBuZ2ViaGVjcmRhY2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMjM1MTcsImV4cCI6MjEwMjc5OTUxN30.Q52VZ0G4bVGUiH7JtzwCq5IauS43tsfxxrmev5MJi3U";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Supabaseに作業時間を送信する関数
async function saveToSupabase(seconds) {
  if (!supabaseClient) return;
  if (seconds < 1) return;

  try {
    const { error } = await supabaseClient
      .from('work_sessions')
      .insert([{ seconds: seconds }]);

    if (error) {
      console.error('Supabase保存エラー:', error);
    } else {
      console.log('Supabaseに作業時間を保存したよ！');
      fetchAndRenderChart();
    }
  } catch (err) {
    console.error('通信エラー:', err);
  }
}

// HTMLだけで棒グラフを描画する安全な関数
async function fetchAndRenderChart() {
  const chartBox = document.getElementById('customChart');
  if (!chartBox) return;

  if (!supabaseClient) {
    chartBox.innerHTML = '<p style="color:#999;font-size:12px;margin:auto;">Supabase未接続</p>';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('work_sessions')
      .select('seconds, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('データ取得エラー:', error);
      chartBox.innerHTML = '<p style="color:#ff6b6b;font-size:12px;margin:auto;">データ取得エラー</p>';
      return;
    }

    if (!data || data.length === 0) {
      chartBox.innerHTML = '<p style="color:#999;font-size:12px;margin:auto;">まだグラフデータがないよ</p>';
      return;
    }

    // 最大の作業時間を取得（高さの計算用）
    const maxSeconds = Math.max(...data.map(d => d.seconds || 0), 60);

    chartBox.innerHTML = data.map(item => {
      const min = Math.round((item.seconds || 0) / 60 * 10) / 10;
      const heightPercent = Math.max(10, Math.min(100, ((item.seconds || 0) / maxSeconds) * 100));
      const d = new Date(item.created_at);
      const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

      return `
        <div style="display:flex; flex-direction:column; align-items:center; flex:1; min-width:30px; height:100%; justify-content:flex-end;">
          <span style="font-size:10px; color:#888; margin-bottom:2px;">${min}分</span>
          <div style="width:100%; max-width:24px; height:${heightPercent}%; background:linear-gradient(180deg, #f0a2b8, #d87093); border-radius:4px 4px 0 0;"></div>
          <span style="font-size:9px; color:#aaa; margin-top:4px;">${timeStr}</span>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('グラフ描画エラー:', err);
    chartBox.innerHTML = '<p style="color:#ff6b6b;font-size:12px;margin:auto;">表示エラー</p>';
  }
}

// ==========================================
// タイマー本体の処理
// ==========================================
const WORK_SECONDS=25*60,BREAK_SECONDS=5*60,KEY="shizukuPomodoro.v1";
let mode="work",running=false,startTime=null,elapsedBeforeStart=0,interval=null,hasAlerted=false,audioCtx=null;
const $=id=>document.getElementById(id);
const todayKey=()=>new Date().toISOString().slice(0,10);

function loadData(){try{const d=JSON.parse(localStorage.getItem(KEY)||"{}");return d.date===todayKey()?d:{date:todayKey(),sessions:[]}}catch{return{date:todayKey(),sessions:[]}}}
function saveData(d){localStorage.setItem(KEY,JSON.stringify(d))}
function fmt(s){s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`}
function jp(s){s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}時間${m}分`:m?`${m}分`:`${s}秒`}

function chime(){try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();const n=audioCtx.currentTime;[0,.18,.36].forEach((o,i)=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type="sine";osc.frequency.value=i===1?880:660;g.gain.setValueAtTime(.0001,n+o);g.gain.exponentialRampToValueAtTime(.18,n+o+.015);g.gain.exponentialRampToValueAtTime(.0001,n+o+.16);osc.connect(g).connect(audioCtx.destination);osc.start(n+o);osc.stop(n+o+.18)})}catch{}if(navigator.vibrate)navigator.vibrate([120,70,120])}
function elapsed(){return running&&startTime!==null?elapsedBeforeStart+Math.floor((Date.now()-startTime)/1000):elapsedBeforeStart}

function render(){const e=elapsed();if(mode==="work"){$("timer").textContent=fmt(e);$("phase").textContent=e>=WORK_SECONDS?"作業中・超過":"作業";$("overtime").textContent=e>=WORK_SECONDS?`25分を ${fmt(e-WORK_SECONDS)} 超過中`:"25分を超えても、そのまま続けられます";$("progressBar").style.width=`${Math.min(100,e/WORK_SECONDS*100)}%`;if(e>=WORK_SECONDS&&!hasAlerted){hasAlerted=true;chime()}}else{const r=Math.max(0,BREAK_SECONDS-e);$("timer").textContent=fmt(r);$("phase").textContent="休憩";$("overtime").textContent=r===0?"休憩おわり。おつかれさま":"ゆっくり休もう";$("progressBar").style.width=`${Math.min(100,e/BREAK_SECONDS*100)}%`;if(e>=BREAK_SECONDS&&!hasAlerted){hasAlerted=true;chime();stop(false)}}stats()}

function start(){if(running)return;try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume()}catch{}running=true;startTime=Date.now();$("startBtn").disabled=true;$("stopBtn").disabled=false;$("breakBtn").disabled=true;interval=setInterval(render,250);render()}

function stop(save=true){
  const e=elapsed();
  if(interval)clearInterval(interval);
  interval=null;running=false;startTime=null;elapsedBeforeStart=0;
  $("startBtn").disabled=false;$("stopBtn").disabled=true;$("breakBtn").disabled=false;
  
  if(save&&mode==="work"&&e>=1){
    const d=loadData();
    d.sessions.push({seconds:e,endedAt:new Date().toISOString()});
    saveData(d);
    chime();
    
    // Supabaseへ保存
    saveToSupabase(e);
  }
  
  if(mode==="break"){mode="work";document.body.classList.remove("break-mode")}
  hasAlerted=false;
  render();
}

function breakStart(){if(running)return;mode="break";document.body.classList.add("break-mode");startTime=null;elapsedBeforeStart=0;hasAlerted=false;start()}

function stats(){const d=loadData(),total=d.sessions.reduce((a,s)=>a+s.seconds,0),longest=d.sessions.reduce((a,s)=>Math.max(a,s.seconds),0);$("todayTime").textContent=jp(total);$("sessions").textContent=`${d.sessions.length}回`;$("longest").textContent=jp(longest);if(!d.sessions.length){$("history").className="history-empty";$("history").textContent="まだ作業記録がないよ";return}$("history").className="history-list";$("history").innerHTML=d.sessions.slice().reverse().map((s,i)=>{const t=new Date(s.endedAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});return`<div class="history-row"><span>${d.sessions.length-i}回目　${t}</span><strong>${jp(s.seconds)}</strong></div>`}).join("")}

$("startBtn").onclick=start;
$("stopBtn").onclick=()=>stop(true);
$("breakBtn").onclick=breakStart;
$("resetBtn").onclick=()=>{if(confirm("今日の作業記録を全部消す？")){localStorage.removeItem(KEY);stats()}};

// 初回読み込みでグラフを表示
fetchAndRenderChart();

stats();
render();
