// --- 設定 ---
const SETTINGS_KEY = 'pacemakerSettings';
const defaultSettings = {
  showSpinner: true,
  showSpeaker: true,
  showCps: true,
  showStatus: true,
  showShares: true,
  showSilence: true,
};
function loadSettings() {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { ...defaultSettings }; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
let settings = loadSettings();

// --- ウィジェット本体 ---
const container = document.createElement('div');
container.style.cssText = `
  position:fixed; top:${window.innerHeight - 80 - 300}px; left:20px;
  z-index:9999; background:#ffffff; padding:14px 16px 14px;
  border-radius:16px; box-shadow:0 8px 24px rgba(0,0,0,0.15);
  font-family:sans-serif; text-align:center; width:148px;
  cursor:grab; user-select:none;
`;

container.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <span style="font-size:11px;font-weight:bold;color:#666;">ペースメーカー</span>
    <span id="settings-btn" style="font-size:14px;cursor:pointer;color:#aaa;" title="表示設定">⚙</span>
  </div>
  <div id="my-name-display" style="font-size:11px;color:#aaa;margin-bottom:2px;cursor:pointer;" title="クリックして名前を変更"></div>

  <div id="section-spinner">
    <div id="rabbit-svg-wrap" style="display:inline-block;margin:6px 0;width:60px;height:60px;">
      <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="60" height="60">
        <rect id="spin-rect" x="15" y="15" width="30" height="30" rx="4" fill="#333" style="transform-origin:30px 30px;"/>
      </svg>
    </div>
  </div>

  <div id="section-speaker">
    <div id="speaker-name" style="font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">話者: 準備中...</div>
  </div>
  <div id="section-cps">
    <div id="cps-display" style="font-size:14px;margin-top:4px;font-weight:bold;color:#333;">0 CPS</div>
  </div>
  <div id="section-status">
    <div id="room-status" style="font-size:12px;margin-top:2px;color:#2ed573;font-weight:bold;">快適</div>
  </div>
  <div id="section-shares" style="margin-top:6px;">
    <div id="shares-display" style="font-size:11px;color:#555;text-align:left;"></div>
  </div>
  <div id="section-silence" style="margin-top:4px;">
    <div id="silence-display" style="font-size:11px;color:#aaa;"></div>
  </div>

  <button id="wait-btn" style="background:#ff4757;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;margin-top:10px;font-weight:bold;width:100%;box-shadow:0 2px 6px rgba(255,71,87,0.3);">
    待って！
  </button>
`;
document.body.appendChild(container);

// --- 設定パネル ---
const settingsPanel = document.createElement('div');
settingsPanel.style.cssText = `
  display:none; position:absolute; top:0; left:160px;
  background:white; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.15);
  padding:12px 14px; width:140px; font-family:sans-serif; font-size:12px; z-index:10000;
`;
const settingsItems = [
  ['showSpinner',  '回転アニメ'],
  ['showSpeaker',  '話者名'],
  ['showCps',      'CPS'],
  ['showStatus',   'ルーム状態'],
  ['showShares',   '発話占有率'],
  ['showSilence',  '無言インジケーター'],
];
const inputCss = 'width:100%;font-size:11px;border:1px solid #ccc;border-radius:4px;padding:3px 4px;box-sizing:border-box;margin-top:2px;';
settingsPanel.innerHTML =
  `<div style="font-weight:bold;color:#666;margin-bottom:8px;">表示設定</div>` +
  settingsItems.map(([key, label]) => `
    <label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" data-key="${key}" ${settings[key] ? 'checked' : ''} style="cursor:pointer;">
      <span>${label}</span>
    </label>
  `).join('') +
  `<hr style="border:none;border-top:1px solid #eee;margin:8px 0;">
  <div style="font-weight:bold;color:#666;margin-bottom:6px;">接続設定</div>
  <div style="margin-bottom:6px;">
    <div style="font-size:11px;color:#888;">Backend URL</div>
    <input id="setting-url" type="text" placeholder="http://localhost:8787" style="${inputCss}">
  </div>
  <div style="margin-bottom:6px;">
    <div style="font-size:11px;color:#888;">API Secret</div>
    <input id="setting-secret" type="password" placeholder="(未設定)" style="${inputCss}">
  </div>
  <button id="setting-save" style="width:100%;font-size:11px;padding:4px;border:none;border-radius:4px;background:#3742fa;color:white;cursor:pointer;">保存</button>
  <div id="setting-saved" style="font-size:10px;color:#2ed573;text-align:center;margin-top:4px;display:none;">保存しました</div>`;
container.appendChild(settingsPanel);

// 現在値を反映
settingsPanel.querySelector('#setting-url').value = localStorage.getItem('pacemakerBackendUrl') || '';
settingsPanel.querySelector('#setting-secret').value = localStorage.getItem('pacemakerApiSecret') || '';

settingsPanel.querySelector('#setting-save').addEventListener('click', (e) => {
  e.stopPropagation();
  const url = settingsPanel.querySelector('#setting-url').value.trim();
  const secret = settingsPanel.querySelector('#setting-secret').value.trim();
  if (url) localStorage.setItem('pacemakerBackendUrl', url);
  else localStorage.removeItem('pacemakerBackendUrl');
  if (secret) localStorage.setItem('pacemakerApiSecret', secret);
  else localStorage.removeItem('pacemakerApiSecret');
  const saved = settingsPanel.querySelector('#setting-saved');
  saved.style.display = 'block';
  setTimeout(() => { saved.style.display = 'none'; }, 2000);
});

settingsPanel.querySelectorAll('input[type=checkbox]').forEach(cb => {
  cb.addEventListener('change', () => {
    settings[cb.dataset.key] = cb.checked;
    saveSettings(settings);
    applySettings();
  });
});

document.getElementById('settings-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
});
document.addEventListener('click', () => { settingsPanel.style.display = 'none'; });
settingsPanel.addEventListener('click', e => e.stopPropagation());

function applySettings() {
  document.getElementById('section-spinner').style.display  = settings.showSpinner  ? '' : 'none';
  document.getElementById('section-speaker').style.display  = settings.showSpeaker  ? '' : 'none';
  document.getElementById('section-cps').style.display      = settings.showCps      ? '' : 'none';
  document.getElementById('section-status').style.display   = settings.showStatus   ? '' : 'none';
  document.getElementById('section-shares').style.display   = settings.showShares   ? '' : 'none';
  document.getElementById('section-silence').style.display  = settings.showSilence  ? '' : 'none';
}
applySettings();

// --- ドラッグ ---
(function initDrag() {
  let startX, startY, startLeft, startTop;
  container.addEventListener('mousedown', (e) => {
    if (['wait-btn', 'settings-btn'].includes(e.target.id)) return;
    if (e.target.closest('#settings-panel')) return;
    startX = e.clientX; startY = e.clientY;
    startLeft = parseInt(container.style.left, 10);
    startTop  = parseInt(container.style.top, 10);
    container.style.cursor = 'grabbing';
    function onMove(e) {
      container.style.left = `${Math.max(0, Math.min(window.innerWidth  - container.offsetWidth,  startLeft + e.clientX - startX))}px`;
      container.style.top  = `${Math.max(0, Math.min(window.innerHeight - container.offsetHeight, startTop  + e.clientY - startY))}px`;
    }
    function onUp() {
      container.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// --- CSS ---
const style = document.createElement('style');
style.innerHTML = `
  @keyframes blink-alert {
    0%   { border:2px solid #ff4757; background-color:#ffffff; }
    100% { border:2px solid #ff4757; background-color:#ffebee; }
  }
`;
document.head.appendChild(style);

// --- 定数 ---
const SILENCE_THRESHOLD = 5;
// meet.google.com/xxx-yyyy-zzz からルームIDを取得
const ROOM_ID = location.pathname.replace('/', '');

function getBackendUrl()  { return localStorage.getItem('pacemakerBackendUrl')  || 'http://localhost:8787'; }
function getApiSecret()   { return localStorage.getItem('pacemakerApiSecret')   || ''; }

function apiFetch(path, options = {}) {
  return fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: { 'x-api-secret': getApiSecret(), ...(options.headers ?? {}) },
  });
}

// --- ユーザー名 ---
if (!localStorage.getItem('pacemakerUserId')) {
  localStorage.setItem('pacemakerUserId', 'user_' + Math.random().toString(36).slice(2, 8));
}
let MY_NAME = localStorage.getItem('pacemakerUserId');

function updateMyNameDisplay() {
  const el = document.getElementById('my-name-display');
  if (el) el.innerText = MY_NAME;
}
updateMyNameDisplay();

document.addEventListener('click', (e) => {
  if (e.target.id !== 'my-name-display') return;
  const input = document.createElement('input');
  input.value = MY_NAME;
  input.style.cssText = 'width:100%;font-size:11px;text-align:center;border:1px solid #ccc;border-radius:4px;padding:2px;box-sizing:border-box;';
  e.target.replaceWith(input);
  input.focus(); input.select();
  function commit() {
    const name = input.value.trim();
    if (name) { MY_NAME = name; localStorage.setItem('pacemakerUserId', name); }
    const div = document.createElement('div');
    div.id = 'my-name-display';
    div.style.cssText = 'font-size:11px;color:#aaa;margin-bottom:2px;cursor:pointer;';
    div.title = 'クリックして名前を変更';
    div.innerText = MY_NAME;
    input.replaceWith(div);
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
});

// --- アニメーション ---
let animationInterval = null;
let currentRotation = 0;

function animateRabbit(level) {
  if (animationInterval) clearInterval(animationInterval);
  animationInterval = null;
  const rect = document.getElementById('spin-rect');
  if (!rect) return;
  if (level === 'stop') {
    rect.style.transform = 'rotate(0deg)';
    container.style.animation = 'none';
    container.style.border = '2px solid transparent';
  } else if (level === 'normal') {
    container.style.animation = 'none';
    container.style.border = '2px solid transparent';
    animationInterval = setInterval(() => { currentRotation += 4; rect.style.transform = `rotate(${currentRotation}deg)`; }, 30);
  } else if (level === 'fast') {
    container.style.animation = 'blink-alert 0.5s infinite alternate';
    animationInterval = setInterval(() => { currentRotation += 12; rect.style.transform = `rotate(${currentRotation}deg)`; }, 16);
  }
}

// --- 音声認識 ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.continuous = true;

  let lastSendTime = 0;
  let lastInterimChars = 0;
  let charHistory = [];
  const SEND_INTERVAL_MS = 500;
  const WINDOW_MS = 3000;
  const WARMUP_MS = 2000;

  function computeCps(now) {
    charHistory = charHistory.filter(e => now - e.time <= WINDOW_MS);
    if (charHistory.length < 2) return null;
    const duration = (now - charHistory[0].time) / 1000;
    const total = charHistory.reduce((s, e) => s + e.delta, 0);
    if (duration < 0.3) return null;
    if (now - charHistory[0].time < WARMUP_MS) return null;
    return Math.round(total / duration);
  }

  function sendCps(cps) {
    apiFetch('/api/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: MY_NAME, cps, roomId: ROOM_ID })
    }).catch(e => console.log('CPS送信失敗:', e));
  }

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      const chars = result[0].transcript.trim().length;
      const now = Date.now();
      if (!result.isFinal) {
        const delta = chars - lastInterimChars;
        lastInterimChars = chars;
        if (delta > 0) charHistory.push({ time: now, delta });
        const cps = computeCps(now);
        console.log(`[interim] "${result[0].transcript}" | ${chars}文字 | ${cps ?? '?'} CPS`);
        if (cps !== null && now - lastSendTime >= SEND_INTERVAL_MS) {
          sendCps(cps); lastSendTime = now;
        }
      } else {
        const delta = chars - lastInterimChars;
        if (delta > 0) charHistory.push({ time: now, delta });
        const cps = computeCps(now);
        console.log(`[final] "${result[0].transcript}" | ${chars}文字 | ${cps ?? '?'} CPS`);
        lastInterimChars = 0; lastSendTime = 0;
        if (cps !== null) sendCps(cps);
      }
    }
  };

  let isRunning = false;
  let restartPending = false;

  function restartRecognition() {
    if (restartPending) return;
    lastInterimChars = 0; lastSendTime = 0; charHistory = [];
    if (isRunning) {
      restartPending = true;
      return;
    }
    isRunning = true;
    recognition.start();
  }

  recognition.onerror = (e) => {
    console.error('[SpeechRecognition] error:', e.error);
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      console.error('マイクへのアクセスが拒否されています。');
      isRunning = false;
      return;
    }
    if (e.error === 'network') {
      // network エラーは onend も呼ばれるので onend に任せる
      return;
    }
  };
  recognition.onend = () => {
    isRunning = false;
    restartPending = false;
    lastInterimChars = 0; lastSendTime = 0; charHistory = [];
    setTimeout(() => { isRunning = true; recognition.start(); }, 300);
  };
  isRunning = true;
  recognition.start();
} else {
  console.error('このブラウザはWeb Speech APIをサポートしていません。');
}

// --- ポーリング ---
setInterval(async () => {
  try {
    const res = await apiFetch(`/api/room-status?roomId=${encodeURIComponent(ROOM_ID)}`);
    const data = await res.json();

    const speakerEl  = document.getElementById('speaker-name');
    const cpsEl      = document.getElementById('cps-display');
    const statusEl   = document.getElementById('room-status');
    const sharesEl   = document.getElementById('shares-display');
    const silenceEl  = document.getElementById('silence-display');

    if (speakerEl) speakerEl.innerText = `話者: ${data.currentSpeaker}`;
    if (cpsEl)     cpsEl.innerText = `${data.speakerCps} CPS`;
    if (statusEl) {
      statusEl.innerText = `${data.status} (${data.waitCount})`;
      statusEl.style.color = data.waitCount > 3 ? '#ff4757' : data.waitCount > 0 ? '#ffa502' : '#2ed573';
    }

    if (sharesEl) {
      const shares = data.speakingShares ?? {};
      const entries = Object.entries(shares);
      if (entries.length === 0) {
        sharesEl.innerHTML = '<span style="color:#bbb;">発話データなし</span>';
      } else {
        sharesEl.innerHTML = entries.map(([name, pct]) => {
          const isMe = name === MY_NAME;
          const bar = '█'.repeat(Math.round(pct / 10)).padEnd(10, '░');
          return `<div style="margin-bottom:2px;${isMe ? 'color:#3742fa;font-weight:bold;' : ''}">
            <span style="font-size:10px;">${name}</span><br>
            <span style="font-size:10px;letter-spacing:-1px;">${bar}</span>
            <span style="font-size:10px;"> ${pct}%</span>
          </div>`;
        }).join('');
      }
    }

    if (silenceEl) {
      const sec = data.silenceDuration;
      if (sec !== null && sec >= SILENCE_THRESHOLD) {
        silenceEl.innerHTML = `<span style="color:#2ed573;font-weight:bold;">🙋 話せます (${sec}s)</span>`;
      } else {
        silenceEl.innerText = '';
      }
    }

    animateRabbit(data.speedLevel);

  } catch (e) {
    console.error('サーバー同期エラー:', e);
    const statusEl = document.getElementById('room-status');
    if (statusEl) { statusEl.innerText = '❌ 切断中'; statusEl.style.color = '#747d8c'; }
    animateRabbit('stop');
  }
}, 1000);

// --- 待ってボタン ---
document.getElementById('wait-btn')?.addEventListener('click', async () => {
  try {
    await apiFetch('/api/wait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: ROOM_ID }),
    });
  } catch (e) {
    console.error('「待って」の送信に失敗しました:', e);
  }
});
