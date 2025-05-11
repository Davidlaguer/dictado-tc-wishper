// === script.js actualizado ===

const socket = io();

// === Elementos DOM ===
const transcriptionBox = document.getElementById('transcription');
const micButton = document.getElementById('mic-button');
const generateBtn = document.getElementById('generate-btn');
const resetBtn = document.getElementById('reset-btn');
const copyBtn = document.getElementById('copy-btn');
const pdfBtn = document.getElementById('pdf-btn');
const outputBox = document.getElementById('output');
const historialBtn = document.getElementById('historial-btn');
const historialList = document.getElementById('historial-list');
const atajosBtn = document.getElementById('atajos-btn');
const atajosPanel = document.getElementById('atajos-panel');
const toggleAppBtn = document.getElementById('toggle-app');

let isRecording = false;
let mediaRecorder;
let historial = JSON.parse(localStorage.getItem('historial') || '[]');
let atajos = JSON.parse(localStorage.getItem('atajos') || '{}');

// === Inicialización ===
document.addEventListener('DOMContentLoaded', () => {
  historialList.style.display = 'none';
  atajosPanel.style.display = 'none';
  renderHistorial();
  renderAtajos();
});

// === Micrófono ===
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
    } catch (e) {
      alert('Error con el micrófono: ' + e.message);
    }
  } else {
    mediaRecorder.stop();
  }
});

socket.on('transcription', ({ text }) => {
  if (text) {
    transcriptionBox.value += text + ' ';
    transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
  }
});

// === Generar informe ===
generateBtn.addEventListener('click', async () => {
  const dictado = transcriptionBox.value.trim();
  if (!dictado) return alert('Dictado vacío');

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generando…';
  generateBtn.classList.add('loading');

  try {
    const res = await fetch('/informe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dictado })
    });
    const data = await res.json();

    if (data.informe) {
      outputBox.value = data.informe.trim();
      guardarInforme(data.informe);
    } else {
      alert('Error generando informe.');
    }
  } catch (e) {
    alert('Error del servidor: ' + e.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generar informe';
    generateBtn.classList.remove('loading');
  }
});

// === Copiar informe ===
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputBox.value.trim());
});

// === Reset ===
resetBtn.addEventListener('click', () => {
  transcriptionBox.value = '';
  outputBox.value = '';
});

// === Exportar PDF ===
pdfBtn.addEventListener('click', () => {
  const texto = outputBox.value.trim();
  if (!texto) return;
  const blob = new Blob([texto], { type: 'application/pdf' });
  const link = document.createElement('a');
  const fecha = new Date();
  const nombre = `informe_${fecha.getFullYear()}${(fecha.getMonth()+1).toString().padStart(2,'0')}${fecha.getDate().toString().padStart(2,'0')}_${fecha.toTimeString().slice(0,8).replace(/:/g, '.')}.pdf`;
  link.href = URL.createObjectURL(blob);
  link.download = nombre;
  link.click();
});

// === Guardar historial ===
function guardarInforme(texto) {
  const fecha = new Date().toLocaleString();
  historial.unshift({ fecha, texto });
  localStorage.setItem('historial', JSON.stringify(historial));
  renderHistorial();
}

function renderHistorial() {
  historialList.innerHTML = '';
  historial.forEach(({ fecha, texto }, i) => {
    const li = document.createElement('li');
    li.textContent = `[${fecha}]`;
    li.addEventListener('click', () => {
      outputBox.value = texto;
    });
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.addEventListener('click', () => {
      historial.splice(i, 1);
      localStorage.setItem('historial', JSON.stringify(historial));
      renderHistorial();
    });
    li.appendChild(del);
    historialList.appendChild(li);
  });
}

// === Toggle historial ===
historialBtn.addEventListener('click', () => {
  historialList.style.display = historialList.style.display === 'none' ? 'block' : 'none';
});

// === Atajos ===
function renderAtajos() {
  const ul = document.getElementById('atajos-list');
  ul.innerHTML = '';
  Object.entries(atajos).forEach(([k, v]) => {
    const li = document.createElement('li');
    li.textContent = `${k} → ${v}`;
    const b = document.createElement('button');
    b.textContent = '🗑';
    b.onclick = () => {
      delete atajos[k];
      localStorage.setItem('atajos', JSON.stringify(atajos));
      renderAtajos();
    };
    li.appendChild(b);
    ul.appendChild(li);
  });
}

document.getElementById('add-atajo').addEventListener('click', () => {
  const clave = document.getElementById('clave').value.trim();
  const valor = document.getElementById('valor').value.trim();
  if (!clave || !valor) return alert('Completa ambos campos');
  if (atajos[clave]) return alert('Esa clave ya existe');
  atajos[clave] = valor;
  localStorage.setItem('atajos', JSON.stringify(atajos));
  renderAtajos();
});

atajosBtn.addEventListener('click', () => {
  atajosPanel.style.display = atajosPanel.style.display === 'none' ? 'block' : 'none';
});

// === Modo móvil ===
toggleAppBtn?.addEventListener('click', () => {
  window.open('index.html', '_blank', 'width=540,height=720');
});