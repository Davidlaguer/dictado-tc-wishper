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
        return jsonify(error="Dictado vacío"), 400

    try:
        # 1️⃣ Crear thread
        thread = client.beta.threads.create()
        print("✅ Thread creado, ID:", thread.id)

        # 2️⃣ Enviar dictado
        msg = client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=dictado
        )
        print("✅ Mensaje USER creado, ID:", msg.id)

        # 3️⃣ Lanzar Assistant con tu assistant_id
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant_id
        )
        print("✅ Run creado, ID:", run.id)

        # 4️⃣ Polling hasta que complete o falle
        for i in range(30):
            time.sleep(2)
            status = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            ).status
            print(f"⏳ Poll {i+1}, status={status}")
            if status == "completed":
                print("✅ Run completado")
                break
            if status in ("failed", "cancelled", "expired"):
                return jsonify(error=f"Assistant falló: {status}"), 500
        else:
            return jsonify(error="Timeout esperando respuesta"), 504

        # 5️⃣ Obtener mensajes y filtrar los de assistant
        messages = client.beta.threads.messages.list(thread_id=thread.id).data
        assistant_msgs = [m for m in messages if m.role == "assistant"]
        if not assistant_msgs:
            return jsonify(error="No recibí respuesta del assistant"), 500

        # Devolver tal cual el contenido
        informe = assistant_msgs[-1].content
        print("📄 Informe recibido:", informe)
        return jsonify(informe=informe)

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("❌ Error en /informe:\n", tb)
        return jsonify(error=tb), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f"🔥 Servidor iniciado en puerto {port}")
    socketio.run(app, host='0.0.0.0', port=port)
