const container = document.createElement('div');
container.style.position = 'fixed';
container.style.bottom = '80px';
container.style.left = '20px';
container.style.zIndex = '9999';
container.style.background = '#ffffff';
container.style.padding = '16px';
container.style.borderRadius = '16px';
container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
container.style.fontFamily = 'sans-serif';
container.style.textAlign = 'center';
container.style.width = '140px';
container.style.transition = 'all 0.3s ease';

container.innerHTML = `
  <div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 4px;">ペースメーカー</div>
  <div id="rabbit-svg-wrap" style="display: inline-block; margin: 8px 0; width: 60px; height: 60px;">
    <svg id="rabbit-svg" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="60" height="60">
      <rect id="spin-rect" x="15" y="15" width="30" height="30" rx="4" fill="#333" style="transform-origin:30px 30px;" />
    </svg>
  </div>
  <div id="speaker-name" style="font-size: 12px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">話者: 準備中...</div>
  <div id="cps-display" style="font-size: 14px; margin-top: 4px; font-weight: bold; color: #333;">0 CPS</div>
  <div id="room-status" style="font-size: 12px; margin-top: 2px; color: #2ed573; font-weight: bold;">🐰快適</div>
  <button id="wait-btn" style="background: #ff4757; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-top: 12px; font-weight: bold; width: 100%; box-shadow: 0 2px 6px rgba(255,71,87,0.3);">
    待って！
  </button>
`;
document.body.appendChild(container);

const style = document.createElement('style');
style.innerHTML = `
  @keyframes blink-alert {
    0% { border: 2px solid #ff4757; background-color: #ffffff; }
    100% { border: 2px solid #ff4757; background-color: #ffebee; }
  }

`;
document.head.appendChild(style);

const BACKEND_URL = 'http://localhost:8787';

// [data-self-name] は Google Meet が自分の名前に付与する属性
const MY_NAME = document.querySelector('[data-self-name]')?.innerText || "参加者_" + Math.floor(Math.random() * 100);

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
    animationInterval = setInterval(() => {
      currentRotation += 4;
      rect.style.transform = `rotate(${currentRotation}deg)`;
    }, 30);
  } else if (level === 'fast') {
    container.style.animation = 'blink-alert 0.5s infinite alternate';
    animationInterval = setInterval(() => {
      currentRotation += 12;
      rect.style.transform = `rotate(${currentRotation}deg)`;
    }, 16);
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.continuous = true;

  let segmentStartTime = null;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      if (!result.isFinal) {
        // 発話開始時刻を記録（初回interimのみ）
        if (segmentStartTime === null) segmentStartTime = Date.now();
      } else {
        // 確定時: 文字数 ÷ 発話時間 = 実際のCPS
        const chars = result[0].transcript.trim().length;
        const elapsed = segmentStartTime !== null ? (Date.now() - segmentStartTime) / 1000 : null;
        segmentStartTime = null;

        if (chars > 0 && elapsed > 0.1) {
          const cps = Math.round(chars / elapsed);
          fetch(`${BACKEND_URL}/api/speed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: MY_NAME, cps })
          }).catch(e => console.log('CPS送信失敗:', e));
        }
      }
    }
  };

  // 無音で切れても自動再起動
  recognition.onend = () => { segmentStartTime = null; recognition.start(); };
  recognition.start();
} else {
  console.error('このブラウザはWeb Speech APIをサポートしていません。');
}

setInterval(async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/room-status`);
    const data = await res.json();

    const speakerEl = document.getElementById('speaker-name');
    const cpsEl = document.getElementById('cps-display');
    const roomStatusEl = document.getElementById('room-status');

    if (speakerEl) speakerEl.innerText = `話者: ${data.currentSpeaker}`;
    if (cpsEl) cpsEl.innerText = `${data.speakerCps} CPS`;
    if (roomStatusEl) {
      roomStatusEl.innerText = `${data.status} (${data.waitCount})`;
      roomStatusEl.style.color = data.waitCount > 3 ? '#ff4757' : data.waitCount > 0 ? '#ffa502' : '#2ed573';
    }

    animateRabbit(data.speedLevel);

  } catch (e) {
    console.error('サーバー同期エラー:', e);
    const roomStatusEl = document.getElementById('room-status');
    if (roomStatusEl) {
      roomStatusEl.innerText = '❌ 切断中';
      roomStatusEl.style.color = '#747d8c';
    }
    animateRabbit('stop');
  }
}, 1000);

document.getElementById('wait-btn')?.addEventListener('click', async () => {
  try {
    await fetch(`${BACKEND_URL}/api/wait`, { method: 'POST' });
  } catch (e) {
    console.error('「待って」の送信に失敗しました:', e);
  }
});
