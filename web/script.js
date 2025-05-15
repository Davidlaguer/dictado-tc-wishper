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

const popup = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCopyBtn = document.getElementById('popup-copy-btn');
const popupCloseBtn = document.getElementById('popup-close-btn');
const loadingOverlay = document.getElementById('loading-overlay');

let isRecording = false;
let mediaRecorder;
let historial = JSON.parse(localStorage.getItem('historial') || '[]');
let atajos = JSON.parse(localStorage.getItem('atajos') || '{}');

document.addEventListener('DOMContentLoaded', () => {
  renderHistorial();
  renderAtajos();
});

micButton.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      let chunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
  	const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
  	const formData = new FormData();
  	formData.append('audio', audioBlob, 'audio.webm');

        try {
          const res = await fetch('/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.text) {
            transcriptionBox.value += data.text.trim() + ' ';
            transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
          } else {
            alert(data.error || 'Error de transcripción');
          }
        } catch (err) {
          console.error('Error enviando audio:', err);
          alert('Error al enviar audio al servidor');
        }

        micButton.classList.remove('active');
        isRecording = false;
      };

      chunks = [];
      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 5000); // 5 segundos de grabación por bloque

      micButton.classList.add('active');
      isRecording = true;

    } catch (e) {
      alert('Error con el micrófono: ' + e.message);
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
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

// impedir cierre al clicar dentro
document.querySelectorAll('.dropdown-content').forEach(drop => {
  drop.addEventListener('click', e => e.stopPropagation());
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

document.addEventListener('click', () => {
  historialList.classList.remove('show');
  atajosPanel.classList.remove('show');
});

toggleAppBtn?.addEventListener('click', () => {
  window.open('index.html', '_blank', 'width=540,height=720');
});
