// === script.js actualizado ===
const socket = io();

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
@app.route('/informe', methods=['POST'])
def generar_informe():
    data = request.get_json() or {}
    dictado = data.get('dictado', '').strip()
    if not dictado:
        return jsonify(error="Dictado vacío"), 400

    from openai.error import RateLimitError

    for intento in range(3):
        try:
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": dictado}],
                max_tokens=800,
                temperature=0.2
            )
            contenido = resp.choices[0].message.content.strip()
            print("📄 Informe recibido:", contenido)
            return jsonify(informe=contenido)

        except RateLimitError:
            wait = 2 ** intento
            print(f"⚠️ Rate limit, retry en {wait}s… ({intento + 1}/3)")
            time.sleep(wait)
            continue

        except Exception as e:
            tb = traceback.format_exc()
            print("❌ Error en /informe (chat):\n", tb)
            return jsonify(error="Error interno al llamar a OpenAI"), 500

    return jsonify(error="Demasiados rate-limits, prueba más tarde"), 503
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

// Historial bajo controles
historialBtn.addEventListener('click', e => {
  e.stopPropagation();
  historialList.classList.toggle('show');
});

// Atajos bajo controles
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
