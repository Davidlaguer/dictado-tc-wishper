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
const historialBtn = document.getElementById('historial-button');
const historialList = document.getElementById('historial-list');
const atajosBtn = document.getElementById('atajo-button');
const atajosPanel = document.getElementById('atajo-dropdown');
const toggleAppBtn = document.getElementById('modo-app-button');
const addAtajoBtn = document.getElementById('crear-atajo-button');
const toggleAtajosListBtn = document.getElementById('toggle-atajos-list');
const atajosGuardadosList = document.getElementById('atajos-guardados');

let isRecording = false;
let mediaRecorder;
let historial = JSON.parse(localStorage.getItem('historial') || '[]');
let atajos = JSON.parse(localStorage.getItem('atajos') || '{}');

// === Inicialización ===
document.addEventListener('DOMContentLoaded', () => {
  historialList.style.display = 'none';
  atajosPanel.classList.add('hidden');
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
      micButton.classList.add('active');
      mediaRecorder.onstop = () => micButton.classList.remove('active');
      isRecording = true;
    } catch (e) {
      alert('Error con el micrófono: ' + e.message);
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
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
  }
});

// === Copiar dictado e informe ===
copyBtn.addEventListener('click', () => {
  transcriptionBox.select();
  document.execCommand('copy');
});

document.getElementById('popup-copy').addEventListener('click', () => {
  outputBox.select();
  document.execCommand('copy');
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

// === Historial ===
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
    li.addEventListener('click', () => outputBox.value = texto);
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

historialBtn.addEventListener('click', () => {
  const visible = historialList.classList.toggle('show');
  const rect = historialBtn.getBoundingClientRect();
  historialList.style.top = `${rect.bottom + window.scrollY}px`;
  historialList.style.left = `${rect.left + window.scrollX}px`;
});

// === Atajos ===
function renderAtajos() {
  atajosGuardadosList.innerHTML = '';
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
    atajosGuardadosList.appendChild(li);
  });
}

addAtajoBtn.addEventListener('click', () => {
  const clave = document.getElementById('atajo-clave').value.trim();
  const valor = document.getElementById('atajo-valor').value.trim();
  if (!clave || !valor) return alert('Completa ambos campos');
  if (atajos[clave]) return alert('Esa clave ya existe');
  atajos[clave] = valor;
  localStorage.setItem('atajos', JSON.stringify(atajos));
  renderAtajos();
});

atajosBtn.addEventListener('click', () => {
  const rect = atajosBtn.getBoundingClientRect();
  atajosPanel.style.top = `${rect.bottom + window.scrollY}px`;
  atajosPanel.style.left = `${rect.left + window.scrollX}px`;
  atajosPanel.classList.toggle('hidden');
});

toggleAtajosListBtn.addEventListener('click', () => {
  if (atajosGuardadosList.style.display === 'block') {
    atajosGuardadosList.style.display = 'none';
    toggleAtajosListBtn.textContent = '📋 Ver atajos guardados';
  } else {
    atajosGuardadosList.style.display = 'block';
    toggleAtajosListBtn.textContent = '❌ Ocultar atajos guardados';
  }
});

// === Modo móvil ===
toggleAppBtn?.addEventListener('click', () => {
  window.open('index.html', '_blank', 'width=540,height=720');
});