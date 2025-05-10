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
const popupPdf         = document.getElementById('popup-pdf');
const popupClose       = document.getElementById('popup-close');

// === Atajos DOM ===
const atajoBtn        = document.getElementById('atajo-button');
const atajoDropdown   = document.getElementById('atajo-dropdown');
const crearAtajoBtn   = document.getElementById('crear-atajo-button');
const toggleListBtn   = document.getElementById('toggle-atajos-list');
const atajosList      = document.getElementById('atajos-guardados');

// === Historial DOM ===
const historialBtn    = document.getElementById('historial-button');
const historialList   = document.getElementById('historial-list');

// === Persistence helpers ===
function saveAtajos(obj)   { localStorage.setItem('atajos', JSON.stringify(obj)); }
function loadAtajos()      { return JSON.parse(localStorage.getItem('atajos') || '{}'); }
function saveHistorial(arr){ localStorage.setItem('historial', JSON.stringify(arr)); }
function loadHistorial()   { return JSON.parse(localStorage.getItem('historial') || '[]'); }

// === State ===
let isRecording = false, mediaRecorder;
let atajos       = loadAtajos();
let historial    = loadHistorial();

// === Drag & Drop ===
// …igual que antes…

// === Streaming Whisper ===
// …igual que antes…

// === Mic control ===
// …igual que antes…

// === Nuevo dictado ===
resetBtn.addEventListener('click', () => {
  transcriptionBox.innerHTML = '';
  sessionStorage.removeItem('dictado');
});

// === Render and manage Atajos ===
function renderAtajos() {
  atajosList.innerHTML = '';
  Object.entries(atajos).forEach(([clave, valor]) => {
    const li = document.createElement('li');
    li.textContent = `${clave} → ${valor} `;
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.style.marginLeft = '8px';
    del.addEventListener('click', () => {
      delete atajos[clave];
      saveAtajos(atajos);
      renderAtajos();
    });
    li.appendChild(del);
    atajosList.appendChild(li);
  });
}

// 1) Abrir/cerrar panel de atajos
atajoBtn.addEventListener('click', e => {
  e.stopPropagation();
  atajoDropdown.classList.toggle('show');
});

// 2) Crear atajo
crearAtajoBtn.addEventListener('click', () => {
  const clave = document.getElementById('atajo-clave').value.trim();
  const valor = document.getElementById('atajo-valor').value.trim();
  if (!clave || !valor) return alert('Rellena ambos campos');
  if (atajos[clave])   return alert('Ya existe');
  atajos[clave] = valor;
  saveAtajos(atajos);
  renderAtajos();
  document.getElementById('atajo-clave').value = '';
  document.getElementById('atajo-valor').value = '';
});

// 3) Mostrar/ocultar lista atajos
toggleListBtn.addEventListener('click', () => {
  if (atajosList.style.display === 'block') {
    atajosList.style.display = 'none';
    toggleListBtn.textContent = '📋 Ver atajos guardados';
  } else {
    atajosList.style.display = 'block';
    toggleListBtn.textContent = '❌ Ocultar atajos guardados';
  }
});

// 4) Cerrar al click fuera
document.addEventListener('click', e => {
  if (!atajoDropdown.contains(e.target) && e.target !== atajoBtn) {
    atajoDropdown.classList.remove('show');
  }
});

// Inicializar
renderAtajos();
atajosList.style.display = 'none';
toggleListBtn.textContent = '📋 Ver atajos guardados';

// === Render and manage Historial ===
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
renderHistorial();

// === Generar informe ===
// …igual que antes…

// === Popup copy/pdf handlers ===
popupCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(popupContent.textContent);
});
popupPdf.addEventListener('click', () => { /* implementar PDF */ });
popupClose.addEventListener('click', () => {
  popup.style.display = 'none';
});
