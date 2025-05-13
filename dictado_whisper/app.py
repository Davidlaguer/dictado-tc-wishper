import os
import tempfile
import subprocess
import time
import traceback
from dotenv import load_dotenv

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit

import whisper
from openai import OpenAI

# — Carga clave OpenAI —
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("🔑 La variable OPENAI_API_KEY no está definida en el entorno")
print("✅ OPENAI_API_KEY detectada ✅")

# — Test de conexión a OpenAI —
try:
    test_client = OpenAI(api_key=api_key)
    m = test_client.models.list().data[:3]
    print("✅ Conexión a OpenAI OK. Modelos:", [x.id for x in m])
except Exception as e:
    print("❌ Error al conectar a OpenAI:", e)
    raise

# — Cliente OpenAI —
client = OpenAI(api_key=api_key)
assistant_id = "asst_fgKQWIHbzkBVc93SOD6iSYTh"

# — App Flask —
app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), '../web'),
    static_url_path=''
)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# — Endpoint de salud —
@app.route('/health')
def health():
    try:
        client.models.list()
        return "OK", 200
    except Exception as e:
        return f"ERROR: {e}", 500

@app.route('/')
def root():
    return app.send_static_file('dashboard.html')

@app.route('/<path:filename>')
def static_files(filename):
    return app.send_static_file(filename)

# — Whisper modelo local —
model = whisper.load_model("base")

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    audio_bytes = bytes(data['chunk'])
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = os.path.join(tmpdir, 'chunk.webm')
        with open(in_path, 'wb') as f:
            f.write(audio_bytes)
        wav_path = os.path.join(tmpdir, 'chunk.wav')
        subprocess.run(
            ["ffmpeg", "-i", in_path, "-ar", "16000", "-ac", "1", wav_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        result = model.transcribe(wav_path, language="es", fp16=False)
        text = result.get('text', '').strip()
    emit('transcription', {'text': text})

# — Generación de informe vía Assistant API —
@app.route('/informe', methods=['POST'])
def generar_informe():
    data = request.get_json() or {}
    dictado = data.get('dictado', '').strip()
    if not dictado:
        return Response("Dictado vacío", status=400, mimetype="text/plain")

    try:
        # Llamada al Chat API usando el modelo gpt-4o
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": dictado}]
        )
        informe = resp.choices[0].message.content.strip()
        # Devolvemos texto plano
        return Response(informe, mimetype="text/plain")

    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Error en /informe:\n", tb)
        return Response("Error interno llamando al Assistant", status=500, mimetype="text/plain")

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f"🔥 Servidor iniciado en puerto {port}")
    socketio.run(app, host='0.0.0.0', port=port)
