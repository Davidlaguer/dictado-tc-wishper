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
const popupCopy        = document.getElementById('popup-copy');
const popupClose       = document.getElementById('popup-close');

// === Atajos DOM ===
const crearAtajoBtn   = document.getElementById('crear-atajo-button');
const atajoBtn        = document.getElementById('atajo-button');
const toggleListBtn   = document.getElementById('toggle-atajos-list');
const atajosList      = document.getElementById('atajos-guardados');

// === Historial DOM ===
const historialBtn    = document.getElementById('historial-button');
const historialList   = document.getElementById('historial-list');

// === Persistence ===
function saveAtajos(obj)        { localStorage.setItem('atajos', JSON.stringify(obj)); }
function loadAtajos()           { return JSON.parse(localStorage.getItem('atajos') || '{}'); }
function saveHistorial(arr)     { localStorage.setItem('historial', JSON.stringify(arr)); }
function loadHistorial()        { return JSON.parse(localStorage.getItem('historial') || '[]'); }

// === State ===
let isRecording = false, mediaRecorder;
let atajos = loadAtajos();
let historial = loadHistorial();

// === Drag & Drop ===
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
dragBar.addEventListener('touchstart', e => onStart(e.touches[0].clientX, e.touches[0].clientY));
document.addEventListener('touchmove', e => onMove(e.touches[0].clientX, e.touches[0].clientY));
document.addEventListener('touchend', onEnd);

// === Socket & Whisper ===
socket.on('connect', () => console.log('🔗 Conectado a Whisper'));
socket.on('transcription', ({ text }) => {
  if (text) {
    transcriptionBox.innerHTML += text + '<br>';
    transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
    sessionStorage.setItem('dictado', transcriptionBox.innerHTML);
  }
});

// === Mic Control ===
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
      mediaRecorder.onstop  = () => { micButton.classList.remove('active'); isRecording = false; };
    } catch (err) {
      alert('Error accediendo al micrófono: ' + err.message);
    }
  } else {
    mediaRecorder.stop();
  }
});

// === Reset dictado ===
resetBtn.addEventListener('click', () => {
  transcriptionBox.innerHTML = '';
  sessionStorage.removeItem('dictado');
});

// === Atajos ===
function renderAtajos() {
  atajosList.innerHTML = '';
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
    atajosList.appendChild(li);
  });
}
crearAtajoBtn.addEventListener('click', () => {
  const c = document.getElementById('atajo-clave').value.trim();
  const v = document.getElementById('atajo-valor').value.trim();
  if (!c || !v) return alert('Completa ambos campos');
  if (atajos[c]) return alert('Esa clave ya existe');
  atajos[c] = v;
  saveAtajos(atajos);
  renderAtajos();
  document.getElementById('atajo-clave').value = '';
  document.getElementById('atajo-valor').value = '';
});
atajoBtn.addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('atajo-dropdown').classList.toggle('show');
});
toggleListBtn.addEventListener('click', () => {
  if (atajosList.style.display === 'block') {
    atajosList.style.display = 'none';
    toggleListBtn.textContent = '📋 Ver atajos guardados';
  } else {
    atajosList.style.display = 'block';
    toggleListBtn.textContent = '❌ Ocultar atajos guardados';
  }
});
document.addEventListener('click', e => {
  if (!document.getElementById('atajo-dropdown').contains(e.target) && e.target !== atajoBtn) {
    document.getElementById('atajo-dropdown').classList.remove('show');
  }
});
renderAtajos();
atajosList.style.display = 'none';
toggleListBtn.textContent = '📋 Ver atajos guardados';

// === Historial ===
function renderHistorial() {
  historialList.innerHTML = '';
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
    historialList.appendChild(li);
  });
}
historialBtn.addEventListener('click', () => {
  historialList.classList.toggle('show');
});
function guardarEnHistorial(texto) {
  const fecha = new Date().toLocaleString();
  historial.unshift({ fecha, texto });
  saveHistorial(historial);
  renderHistorial();
}
renderHistorial();

// === Generar informe ===
generateBtn.addEventListener('click', async () => {
  const dictado = transcriptionBox.textContent.trim();
  if (!dictado) {
    alert('Dictado vacío.');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generando informe…';

  try {
    const res = await fetch('/informe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dictado })
    });

    const raw = await res.text(); // usamos text en vez de .json por seguridad

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('⚠️ No se pudo parsear JSON. Mostrando texto plano:', raw);
      popupContent.innerHTML = `<pre>${raw}</pre>`;
      popup.style.display = 'block';
      alert('⚠️ El servidor respondió con un formato inesperado. Se muestra texto plano.');
      return;
    }

    console.log("📄 Informe recibido:", data);

    if (data.informe && typeof data.informe === 'object') {
      const { estudio, tecnica, hallazgos, conclusion } = data.informe;

      popupContent.innerHTML = `
        <h2>TC DE ${estudio?.toUpperCase() || 'ESTUDIO'}</h2>
        <h3>TÉCNICA:</h3><p>${tecnica || '—'}</p>
        <h3>HALLAZGOS:</h3><p>${hallazgos || '—'}</p>
        <h3>CONCLUSIÓN:</h3><p>${conclusion || '—'}</p>
      `;

      popup.style.display = 'block';
      guardarEnHistorial(JSON.stringify(data.informe));
    } else {
      alert('⚠️ Error: el Assistant no devolvió un informe válido.');
    }

  } catch (e) {
    alert('❌ Error de red o servidor: ' + e.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generar informe';
  }
});

// === Popup handlers ===
popupClose.addEventListener('click', () => { popup.style.display = 'none'; });
popupCopy?.addEventListener('click', () => {
  navigator.clipboard.writeText(popupContent.textContent);
});

// === Aplica atajos al texto
function aplicarAtajos(txt) {
  let out = txt;
  Object.keys(atajos).forEach(k => {
    const r = new RegExp(`\\b${k}\\b`, 'gi');
    out = out.replace(r, atajos[k]);
  });
  return out;
}
