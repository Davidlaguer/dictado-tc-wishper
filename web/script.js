// === Elementos DOM ===
const transcriptionBox = document.getElementById('transcription');
const micButton = document.getElementById('mic-button');
const generateBtn = document.getElementById('generate-btn');
const resetBtn = document.getElementById('reset-btn');
const copyBtn = document.getElementById('copy-btn');
const historialBtn = document.getElementById('historial-button');
const historialList = document.getElementById('historial-list');
const atajosBtn = document.getElementById('atajo-button');
const atajosPanel = document.getElementById('atajo-dropdown');
const toggleAppBtn = document.getElementById('modo-app-button');
const addAtajoBtn = document.getElementById('crear-atajo-button');
const toggleAtajosListBtn = document.getElementById('toggle-atajos-list');
const atajosGuardadosList = document.getElementById('atajos-guardados');

const modoManualBtn = document.getElementById('modo-manual-btn');
const modoAutoBtn = document.getElementById('modo-auto-btn');
const modoEstado = document.getElementById('modo-estado');

const popup = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCopyBtn = document.getElementById('popup-copy-btn');
const popupCloseBtn = document.getElementById('popup-close-btn');
const loadingOverlay = document.getElementById('loading-overlay');

let isRecording = false;
let mediaRecorder;
let historial = JSON.parse(localStorage.getItem('historial') || '[]');
let atajos = JSON.parse(localStorage.getItem('atajos') || '{}');
let modoDictado = localStorage.getItem('modoDictado') || 'manual';

function aplicarCorrecciones(texto) {
  let corregido = texto
    .replace(/\bpunto y coma\b/gi, ';')
    .replace(/\bpunto\b/gi, '.')
    .replace(/\bcoma\b/gi, ',');

  // Aplicar atajos personalizados
  Object.entries(atajos).forEach(([clave, valor]) => {
    const regex = new RegExp(`\\b${clave}\\b`, 'gi');
    corregido = corregido.replace(regex, valor);
  });

  return corregido;
}

function guardarInforme(texto) {
  const ahora = new Date();
  const nombre = ahora.toLocaleString();
  const timestamp = ahora.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const titulo = 'Informe_' + timestamp.slice(6,8) + '_' + timestamp.slice(4,6) + '_' + timestamp.slice(0,4) + '_' + timestamp.slice(8,14);

  historial.unshift({ fecha: nombre, titulo, texto });
  localStorage.setItem('historial', JSON.stringify(historial));
  renderHistorial();
}

function renderHistorial() {
  historialList.innerHTML = '';
  historial.forEach(({ fecha, titulo, texto }, i) => {
    const li = document.createElement('li');
    li.textContent = titulo || fecha;
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

function actualizarModo() {
  if (modoDictado === 'manual') {
    modoManualBtn.classList.add('selected');
    modoAutoBtn.classList.remove('selected');
    modoEstado.textContent = '🎙️ Estás dictando en modo MANUAL';
  } else {
    modoManualBtn.classList.remove('selected');
    modoAutoBtn.classList.add('selected');
    modoEstado.textContent = '🎙️ Estás dictando en modo AUTOMÁTICO';
  }
  localStorage.setItem('modoDictado', modoDictado);
}

document.addEventListener('DOMContentLoaded', () => {
  renderHistorial();
  renderAtajos();
  actualizarModo();

  modoManualBtn.addEventListener('click', () => {
    modoDictado = 'manual';
    actualizarModo();
  });

transcriptionBox.addEventListener('input', () => {
  if (modoDictado === 'automatico') {
    const cursor = transcriptionBox.selectionStart;
    transcriptionBox.value = aplicarCorrecciones(transcriptionBox.value);
    transcriptionBox.selectionEnd = cursor;
  }
});

addAtajoBtn.addEventListener('click', () => {
  const clave = document.getElementById('atajo-clave').value.trim().toLowerCase();
  const valor = document.getElementById('atajo-valor').value.trim();

  if (!clave || !valor) {
    alert('Debes completar ambos campos del atajo');
    return;
  }

  atajos[clave] = valor;
  localStorage.setItem('atajos', JSON.stringify(atajos));
  renderAtajos();
  alert('✅ Atajo guardado');

  // Limpiar los campos
  document.getElementById('atajo-clave').value = '';
  document.getElementById('atajo-valor').value = '';
});

  modoAutoBtn.addEventListener('click', () => {
    modoDictado = 'automatico';
    actualizarModo();
  });

  micButton.addEventListener('click', async () => {
    if (isRecording) {
      mediaRecorder.stop();
      micButton.classList.remove('active');
      isRecording = false;
      return;
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.warn("Ya se está grabando. Ignorado doble clic.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      mediaRecorder = new MediaRecorder(stream);
      isRecording = true;
      micButton.classList.add('active');

      if (modoDictado === 'automatico') {
        mediaRecorder.ondataavailable = async e => {
          if (e.data.size > 0) {
            const audioBlob = new Blob([e.data], { type: 'audio/webm;codecs=opus' });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.webm');
            try {
              const res = await fetch('/transcribe', { method: 'POST', body: formData });
              const data = await res.json();
              if (data.text) {
                transcriptionBox.value += aplicarCorrecciones(data.text).trim() + ' ';
                transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
              }
            } catch (err) {
              console.error('Error en transcripción automática:', err);
            }
          }
        };
        mediaRecorder.start(3000);
      } else {
        let chunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');
          try {
            const res = await fetch('/transcribe', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.text) {
              transcriptionBox.value += aplicarCorrecciones(data.text).trim() + ' ';
              transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
            }
          } catch (err) {
            console.error('Error en transcripción manual:', err);
          }
          isRecording = false;
          mediaRecorder = null;
          micButton.classList.remove('active');
        };
        mediaRecorder.start();
      }

    } catch (e) {
      alert('Error con el micrófono: ' + e.message);
      isRecording = false;
      mediaRecorder = null;
      micButton.classList.remove('active');
    }
  });

  copyBtn.addEventListener('click', () => {
    transcriptionBox.select();
    document.execCommand('copy');
  });

  popupCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(popupContent.textContent);
  });

  popupCloseBtn.addEventListener('click', () => {
    popup.classList.remove('show');
  });

  generateBtn.addEventListener('click', async () => {
    const dictado = transcriptionBox.value.trim();
    if (!dictado) return alert('Dictado vacío');

    generateBtn.textContent = '⏳ Generando...';
    generateBtn.disabled = true;
    loadingOverlay.style.display = 'flex';

    try {
      const res = await fetch('/informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dictado })
      });

      const data = await res.json();
      if (data.informe) {
        popupContent.textContent = data.informe;
        popup.classList.add('show');
        guardarInforme(data.informe);
      } else {
        alert(data.error || 'Error al generar informe');
      }
    } catch (e) {
      console.error(e);
      alert('Error al conectar con el servidor');
    } finally {
      loadingOverlay.style.display = 'none';
      generateBtn.textContent = 'Generar informe';
      generateBtn.disabled = false;
    }
  });

  resetBtn.addEventListener('click', () => {
    transcriptionBox.value = '';
  });

  historialBtn.addEventListener('click', e => {
    e.stopPropagation();
    historialList.classList.toggle('show');
  });

  atajosBtn.addEventListener('click', e => {
    e.stopPropagation();
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

  toggleAppBtn?.addEventListener('click', () => {
    window.open('index.html', '_blank', 'width=540,height=720');
  });

  document.querySelectorAll('.dropdown-content').forEach(drop => {
    drop.addEventListener('click', e => e.stopPropagation());
  });

  document.addEventListener('click', () => {
    historialList.classList.remove('show');
    atajosPanel.classList.remove('show');
  });
});
