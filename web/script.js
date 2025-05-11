// === Socket.IO ===
const socket = io();

// === DOM Elements ===
const micButton = document.getElementById('mic-button');
const transcriptionBox = document.getElementById('transcription');
const resetBtn = document.getElementById('reset-btn');
const generateBtn = document.getElementById('generate-btn');
const copyBtn = document.getElementById('copy-btn');
const popupContent = document.getElementById('popup-content');
const exportPdfBtn = document.getElementById('popup-pdf');
const crearAtajoBtn = document.getElementById('crear-atajo-button');
const atajoBtn = document.getElementById('atajo-button');
const toggleListBtn = document.getElementById('toggle-atajos-list');
const atajosList = document.getElementById('atajos-guardados');
const historialBtn = document.getElementById('historial-button');
const historialList = document.getElementById('historial-list');

// === Persistence ===
function saveAtajos(obj)        { localStorage.setItem('atajos', JSON.stringify(obj)); }
function loadAtajos()           { return JSON.parse(localStorage.getItem('atajos') || '{}'); }
function saveHistorial(arr)     { localStorage.setItem('historial', JSON.stringify(arr)); }
function loadHistorial()        { return JSON.parse(localStorage.getItem('historial') || '[]'); }

let isRecording = false, mediaRecorder;
let atajos = loadAtajos();
let historial = loadHistorial();

// === Mic Control ===
micButton?.addEventListener('click', async () => {
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

// === Transcripción en tiempo real ===
socket.on('transcription', ({ text }) => {
  if (text) {
    transcriptionBox.innerHTML += text + '<br>';
    transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
    sessionStorage.setItem('dictado', transcriptionBox.innerHTML);
  }
});

// === Nuevo dictado ===
resetBtn?.addEventListener('click', () => {
  transcriptionBox.innerHTML = '';
  sessionStorage.removeItem('dictado');
});

// === Generar informe ===
generateBtn?.addEventListener('click', async () => {
  const dictado = transcriptionBox.textContent.trim();
  if (!dictado) return alert('Dictado vacío.');

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generando informe…';

  try {
    const res = await fetch('/informe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dictado })
    });

    const data = await res.json();
    if (data.informe) {
      popupContent.innerText = data.informe.trim();
      guardarEnHistorial(data.informe.trim());
    } else {
      alert('⚠️ No se recibió ningún informe.');
    }
  } catch (e) {
    alert('❌ Error de red: ' + e.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generar informe';
  }
});

// === Copiar ===
copyBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(transcriptionBox.textContent);
});

// === Exportar PDF ===
exportPdfBtn?.addEventListener('click', () => {
  const text = popupContent.innerText.trim();
  const nombre = generarNombreInforme();

  const blob = new Blob([text], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nombre;
  link.click();
});

function generarNombreInforme() {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-ES').replaceAll('/', '');
  const hora = now.toLocaleTimeString('es-ES').replaceAll(':', '.');
  return `informe_${fecha}_${hora}.pdf`;
}

// === Historial ===
function renderHistorial() {
  historialList.innerHTML = '';
  historial.forEach((item, idx) => {
    const li = document.createElement('li');
    li.textContent = `[${item.fecha}]`;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      popupContent.innerText = item.texto;
    });
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

function guardarEnHistorial(texto) {
  const fecha = new Date().toLocaleString();
  historial.unshift({ fecha, texto });
  saveHistorial(historial);
  renderHistorial();
}

historialBtn?.addEventListener('click', () => {
  historialList.classList.toggle('show');
});
renderHistorial();

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
crearAtajoBtn?.addEventListener('click', () => {
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
atajoBtn?.addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('atajo-dropdown').classList.toggle('show');
});
toggleListBtn?.addEventListener('click', () => {
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