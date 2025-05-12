// === script.js actualizado ===
const socket = io();

// === Elementos DOM ===
const transcriptionBox = document.getElementById('transcription');
const micButton = document.getElementById('mic-button');
const generateBtn = document.getElementById('generate-btn');
const resetBtn = document.getElementById('reset-btn');
const copyBtn = document.getElementById('copy-btn');
// 🔴 Ya no buscamos ni usamos pdfBtn ni outputBox ni copy-output-btn
const historialBtn = document.getElementById('historial-button');
const historialList = document.getElementById('historial-list');
const atajosBtn = document.getElementById('atajo-button');
const atajosPanel = document.getElementById('atajo-dropdown');
const toggleAppBtn = document.getElementById('modo-app-button');
const addAtajoBtn = document.getElementById('crear-atajo-button');
const toggleAtajosListBtn = document.getElementById('toggle-atajos-list');
const atajosGuardadosList = document.getElementById('atajos-guardados');

// 🟢 Referencias al nuevo popup
const popup = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCopyBtn = document.getElementById('popup-copy-btn');
const popupCloseBtn = document.getElementById('popup-close-btn');

let isRecording = false;
let mediaRecorder;
let historial = JSON.parse(localStorage.getItem('historial') || '[]');
let atajos = JSON.parse(localStorage.getItem('atajos') || '{}');

// === Inicialización ===
document.addEventListener('DOMContentLoaded', () => {
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
      // 🟢 En lugar de volcar al textarea, abrimos el popup
      popupContent.textContent = data.informe.trim();
      guardarInforme(data.informe);
      popup.classList.add('show');
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

// === Copiar dictado ===
copyBtn.addEventListener('click', () => {
  transcriptionBox.select();
  document.execCommand('copy');
});

// === Copiar desde el popup ===
popupCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(popupContent.textContent);
});

// === Cerrar popup ===
popupCloseBtn.addEventListener('click', () => {
  popup.classList.remove('show');
});

// === Reset ===
resetBtn.addEventListener('click', () => {
  transcriptionBox.value = '';
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
    li.addEventListener('click', () => {
      popupContent.textContent = texto;
      popup.classList.add('show');
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

// === Modificado: posicionamiento Historial sobre el textarea, esquina superior derecha ===
historialBtn.addEventListener('click', e => {
  e.stopPropagation();
  const rect = transcriptionBox.getBoundingClientRect();
  const menuHeight = historialList.offsetHeight;
  historialList.style.top  = `${window.scrollY + rect.top - menuHeight}px`;
  historialList.style.left = `${window.scrollX + rect.right}px`;
  historialList.classList.toggle('show');
});

// === Atajos ===
function renderAtajos() {
  atajosGuardadosList.innerHTML = '';
  Object.entries(atajos).forEach(([k, v]) => {
    const li = document.createElement('li');
    li.textContent = `${k} → ${v}`;
    const btn = document.createElement('button');
    btn.textContent = '🗑';
    btn.onclick = () => {
      delete atajos[k];
      localStorage.setItem('atajos', JSON.stringify(atajos));
      renderAtajos();
    };
    li.appendChild(btn);
    atajosGuardadosList.appendChild(li);
  });
}

// === Modificado: posicionamiento Atajos justo debajo del Historial ===
atajosBtn.addEventListener('click', e => {
  e.stopPropagation();
  const rect = transcriptionBox.getBoundingClientRect();
  atajosPanel.style.top  = `${window.scrollY + rect.top}px`;
  atajosPanel.style.left = `${window.scrollX + rect.right}px`;
  atajosPanel.classList.toggle('show');
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

// === Cerrar dropdowns al hacer clic fuera ===
// Cuando clicas dentro de cualquiera de los dropdowns, no cierres
document.querySelectorAll('.dropdown-content').forEach(drop => {
  drop.addEventListener('click', e => e.stopPropagation());
});

document.addEventListener('click', () => {
  historialList.classList.remove('show');
  atajosPanel.classList.remove('show');
});

// === Modo móvil ===
toggleAppBtn?.addEventListener('click', () => {
  window.open('index.html', '_blank', 'width=540,height=720');
});

