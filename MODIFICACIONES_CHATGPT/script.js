// script.js

// === Socket.IO ===
const socket = io('http://localhost:5050');

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

// === STATE ===
let isRecording = false;
let mediaRecorder;

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
  const t = e.touches[0];
  onStart(t.clientX, t.clientY);
});
document.addEventListener('touchmove', e => {
  const t = e.touches[0];
  onMove(t.clientX, t.clientY);
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

// === Mic control: send 5 s chunks ===
micButton.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start(5000); // chunk cada 5 s

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          e.data.arrayBuffer().then(buf => {
            socket.emit('audio_chunk', { chunk: new Uint8Array(buf) });
          });
        }
      };
      mediaRecorder.onstart = () => {
        micButton.classList.add('active');
        console.log('🎤 Inicio streaming audio');
        isRecording = true;
      };
      mediaRecorder.onstop = () => {
        micButton.classList.remove('active');
        console.log('🎤 Fin streaming audio');
        isRecording = false;
      };
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

// === Generate report via OpenAI ===
generateBtn.addEventListener('click', async () => {
  const dictado = transcriptionBox.textContent.trim();
  if (!dictado) {
    alert('Dictado vacío.');
    return;
  }

  // Disable and show loading
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generando informe…';

  // Apply local shortcuts
  const processed = generarInforme(dictado);

  try {
    const res = await fetch('http://localhost:5050/informe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dictado: processed })
    });
    const data = await res.json();

    if (data.informe) {
      // Expect informe as JSON object: { estudio, tecnica, hallazgos, conclusion }
      const info = data.informe;
      popupContent.innerHTML = `
        <h2>TC DE ${info.estudio}</h2>
        <h3>TÉCNICA:</h3>
        <p>${info.tecnica}</p>
        <h3>HALLAZGOS:</h3>
        <p>${info.hallazgos}</p>
        <h3>CONCLUSIÓN:</h3>
        <p>${info.conclusion}</p>
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
popupClose.addEventListener('click', () => {
  popup.style.display = 'none';
});

// === History log ===
function guardarEnHistorial(texto) {
  const ul = document.getElementById('historial-list');
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleString()}] ${texto.slice(0, 50)}…`;
  ul.appendChild(li);
}
document.getElementById('historial-button')
  .addEventListener('click', () => {
    document.getElementById('historial-list').classList.toggle('show');
  });

// === Custom shortcuts ===
function generarInforme(txt) {
  let out = txt;
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('atajo_')) {
      const key = k.replace('atajo_', '');
      out = out.replace(new RegExp(`\\b${key}\\b`, 'gi'), localStorage.getItem(k));
    }
  });
  return out;
}

document.getElementById('atajo-button')
  .addEventListener('click', () => {
    document.getElementById('atajo-form').classList.toggle('show');
  });
document.getElementById('crear-atajo-button')
  .addEventListener('click', () => {
    const c = document.getElementById('atajo-clave').value.trim();
    const v = document.getElementById('atajo-sustitucion').value.trim();
    if (c && v) {
      localStorage.setItem(`atajo_${c}`, v);
      alert('Atajo guardado');
      mostrarAtajos();
    }
  });
document.getElementById('mostrar-atajos')
  .addEventListener('click', () => {
    document.getElementById('atajos-guardados').classList.toggle('show');
  });

function mostrarAtajos() {
  const ul = document.getElementById('atajos-guardados');
  ul.innerHTML = '';
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('atajo_')) {
      const li = document.createElement('li');
      li.textContent = `${k.replace('atajo_', '')} → ${localStorage.getItem(k)}`;
      ul.appendChild(li);
    }
  });
}
mostrarAtajos();
