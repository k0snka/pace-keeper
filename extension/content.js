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
  <div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 4px;">うさぎメーター</div>
  <div id="rabbit-icon" style="font-size: 48px; display: inline-block; transition: transform 0.1s linear; margin: 8px 0;">🐰</div>
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

let charCountInLastSecond = 0;
let currentRotation = 0;
let animationInterval = null;

function animateRabbit(level) {
  if (animationInterval) clearInterval(animationInterval);

  const icon = document.getElementById('rabbit-icon');
  if (!icon) return;

  if (level === 'stop') {
    icon.style.transform = 'rotate(0deg)';
    container.style.animation = 'none';
    container.style.border = '2px solid transparent';
  } else if (level === 'normal') {
    animationInterval = setInterval(() => {
      currentRotation += 5;
      icon.style.transform = `rotate(${currentRotation}deg)`;
    }, 50);
    container.style.animation = 'none';
    container.style.border = '2px solid transparent';
  } else if (level === 'fast') {
    animationInterval = setInterval(() => {
      currentRotation += 30;
      icon.style.transform = `rotate(${currentRotation}deg)`;
    }, 20);
    container.style.animation = 'blink-alert 0.5s infinite alternate';
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.continuous = true;

  let lastLength = 0;
  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      interimTranscript += event.results[i][0].transcript;
    }

    if (event.results[event.resultIndex].isFinal) {
      lastLength = 0;
    } else {
      const currentLength = interimTranscript.length;
      const diff = currentLength - lastLength;
      if (diff > 0) charCountInLastSecond += diff;
      lastLength = currentLength;
    }
  };

  // 無音で切れても自動再起動
  recognition.onend = () => recognition.start();
  recognition.start();

  setInterval(async () => {
    if (charCountInLastSecond > 0) {
      await fetch(`${BACKEND_URL}/api/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: MY_NAME, cps: charCountInLastSecond })
      }).catch(e => console.log('CPS送信失敗:', e));
    }
    charCountInLastSecond = 0;
  }, 1000);
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
