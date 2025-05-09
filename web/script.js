// script.js

// === Socket.IO ===
const socket = io();

// === DOM ELEMENTS ===
const container        = document.getElementById('plugin-container');
const dragBar          = document.getElementById('drag-bar');
const micButton        = document.getElementById('mic-button');
const transcriptionBox = document.getElementById('transcription');
const resetBtn         = document.getElementById('reset-btn');
const generateBtn      = document.getElementById('generate-btn');
const popup            = document.getElementById('popup');
const popupContent     = document.getElementById('popup-content');
const popupClose       = document.getElementById('popup-close');

// === Persistence helpers ===
function saveAtajos(obj) { localStorage.setItem('atajos', JSON.stringify(obj)); }
function loadAtajos() { return JSON.parse(localStorage.getItem('atajos') || '{}'); }
function saveHistorial(arr) { localStorage.setItem('historial', JSON.stringify(arr)); }
function loadHistorial() { return JSON.parse(localStorage.getItem('historial') || '[]'); }

// === State ===
let isRecording = false;
let mediaRecorder;
let atajos = loadAtajos();
let historial = loadHistorial();

// === Drag & Drop (only via dragBar) ===
let dragging = false, startX, startY, origX, origY;
function onStart(x, y) {
  dragging = true;
  startX = x; startY = y;
  const r = container.getBoundingClientRect();
  origX = r.left; origY = r.top;
  document.body.style.userSelect = 'none';
}
function onMove(x, y) {
  if (!dragging) return;
  container.style.left = origX + (x - startX) + 'px';
  container.style.top  = origY + (y - startY) + 'px';
}
function onEnd() {
  dragging = false;
  document.body.style.userSelect = '';
}

dragBar.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
document.addEventListener('mouseup', onEnd);

dragBar.addEventListener('touchstart', e => {
  const t = e.touches[0]; onStart(t.clientX, t.clientY);
});
document.addEventListener('touchmove', e => {
  const t = e.touches[0]; onMove(t.clientX, t.clientY);
});
document.addEventListener('touchend', onEnd);

// === Streaming Whisper (partial transcripts) ===
socket.on('connect', () => console.log('🔗 Socket conectado'));
socket.on('transcription', ({ text }) => {
  if (text) {
    transcriptionBox.innerHTML += text + '<br>';
    transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
    sessionStorage.setItem('dictado', transcriptionBox.innerHTML);
  }
});

// === Mic control: send 5s chunks ===
micButton.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start(5000);
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          e.data.arrayBuffer().then(buf => {
            socket.emit('audio_chunk', { chunk: new Uint8Array(buf) });
          });
        }
      };
      mediaRecorder.onstart = () => { micButton.classList.add('active'); isRecording = true; };
      mediaRecorder.onstop = () => { micButton.classList.remove('active'); isRecording = false; };
    } catch (err) {
      alert('Error accediendo al micrófono: ' + err.message);
    }
  } else {
    mediaRecorder.stop();
  }
});

// === New dictation (reset) ===
resetBtn.addEventListener('click', () => {
  transcriptionBox.innerHTML = '';
  sessionStorage.removeItem('dictado');
});

// === Render and manage Atajos ===
function renderAtajos() {
  const ul = document.getElementById('atajos-guardados');
  ul.innerHTML = '';
  Object.entries(atajos).forEach(([clave, valor]) => {
    const li = document.createElement('li');
    li.textContent = `${clave} → ${valor}`;
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.addEventListener('click', () => {
      delete atajos[clave];
      saveAtajos(atajos);
      renderAtajos();
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

// Create atajo
document.getElementById('crear-atajo-button').addEventListener('click', () => {
  const c = document.getElementById('atajo-clave').value.trim();
  const v = document.getElementById('atajo-sustitucion').value.trim();
  if (!c || !v) return;
  if (atajos[c]) return alert('Esa clave ya existe');
  atajos[c] = v;
  saveAtajos(atajos);
  renderAtajos();
});

// Toggle atajos list
document.getElementById('atajo-button').addEventListener('click', () => {
  document.getElementById('atajos-guardados').classList.toggle('show');
});

// Initial render atajos
renderAtajos();

// === Render and manage Historial ===
function renderHistorial() {
  const ul = document.getElementById('historial-list');
  ul.innerHTML = '';
  historial.forEach((item, idx) => {
    const li = document.createElement('li');
    li.textContent = `[${item.fecha}] ${item.texto.slice(0,50)}…`;
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.addEventListener('click', () => {
      historial.splice(idx, 1);
      saveHistorial(historial);
      renderHistorial();
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

// Add to historial
function guardarEnHistorial(texto) {
  const fecha = new Date().toLocaleString();
  historial.unshift({ fecha, texto });
  saveHistorial(historial);
  renderHistorial();
}

// Toggle historial list
document.getElementById('historial-button').addEventListener('click', () => {
  document.getElementById('historial-list').classList.toggle('show');
});

// Initial render historial
renderHistorial();

// === Generate report via OpenAI ===
generateBtn.addEventListener('click', async () => {
  const dictado = transcriptionBox.textContent.trim();
  if (!dictado) {
    alert('Dictado vacío.'); return;
  }
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generando informe…';
  const processed = generarInforme(dictado);
  try {
    const res = await fetch('http://localhost:5050/informe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dictado: processed })
    });
    const data = await res.json();
    if (data.informe) {
      const info = data.informe;
      popupContent.innerHTML = `
        <h2>TC DE ${info.estudio}</h2>
        <h3>TÉCNICA:</h3><p>${info.tecnica}</p>
        <h3>HALLAZGOS:</h3><p>${info.hallazgos}</p>
        <h3>CONCLUSIÓN:</h3><p>${info.conclusion}</p>
      `;
      popup.style.display = 'block';
      guardarEnHistorial(JSON.stringify(info));
    } else {
      alert('Error: ' + (data.error || 'Desconocido')); 
    }
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generar informe';
  }
});

// === Close popup ===
popupClose.addEventListener('click', () => { popup.style.display = 'none'; });

// === Helper for applying atajos ===
function generarInforme(txt) {
  let out = txt;
  Object.keys(atajos).forEach(k => {
    const regex = new RegExp(`\\b${k}\\b`, 'gi');
    out = out.replace(regex, atajos[k]);
  });
  return out;
}

