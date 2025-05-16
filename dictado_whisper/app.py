import os
import io
import time
import traceback
import subprocess
import tempfile
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from werkzeug.utils import secure_filename

# — Cargar clave OpenAI —
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("🔑 La variable OPENAI_API_KEY no está definida en el entorno")
print("✅ OPENAI_API_KEY detectada ✅")

# — Cliente OpenAI —
client = OpenAI(api_key=api_key)
assistant_id = "asst_fgKQWIHbzkBVc93SOD6iSYTh"

# — App Flask —
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), '../web'), static_url_path='')
CORS(app)

# — Endpoint de salud —
@app.route('/health')
def health():
    try:
        client.models.list()
        return "OK", 200
    except Exception as e:
        return f"ERROR: {e}", 500

@app.route('/test-openai')
def test_openai():
    try:
        modelos = client.models.list()
        return jsonify(success=True, models=[m.id for m in modelos.data])
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

@app.route('/')
def root():
    return app.send_static_file('dashboard.html')

@app.route('/<path:filename>')
def static_files(filename):
    return app.send_static_file(filename)

# — Transcripción vía Whisper API —
@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        if 'audio' not in request.files:
            print("❌ No se recibió archivo 'audio'")
            return jsonify(error="No se envió archivo de audio"), 400

        audio_file = request.files['audio']
        print(f"📥 Recibido archivo: {audio_file.filename}, type={audio_file.content_type}")

        # Guardar el archivo temporalmente
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, 'input.webm')
            output_path = os.path.join(tmpdir, 'output.mp3')
            audio_file.save(input_path)

            # Convertir a mp3 con ffmpeg
            subprocess.run(
                ['ffmpeg', '-i', input_path, output_path],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )

            # Enviar a Whisper API
            with open(output_path, 'rb') as mp3_file:
                result = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=mp3_file,
                    language="es"
                )

        print("✅ Transcripción completada")
        return jsonify(text=result.text)

    except Exception as e:
        print("❌ Error al transcribir:\n", traceback.format_exc())
        return jsonify(error="Error interno del servidor"), 500

# — Generación de informe vía Assistant API —
@app.route('/informe', methods=['POST'])
def generar_informe():
    data = request.get_json() or {}
    dictado = data.get('dictado', '').strip()
    if not dictado:
        return jsonify(error="Dictado vacío"), 400
    try:
        thread = client.beta.threads.create()
        client.beta.threads.messages.create(thread_id=thread.id, role="user", content=dictado)
        run = client.beta.threads.runs.create(thread_id=thread.id, assistant_id=assistant_id)
        while run.status not in ["completed", "failed", "cancelled"]:
            time.sleep(1)
            run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)
        if run.status != "completed":
            return jsonify(error="Error al completar la solicitud"), 500
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        contenido = messages.data[0].content[0].text.value.strip()
        print("📄 Informe recibido:", contenido)
        return jsonify(informe=contenido)
    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Error en /informe:\n", tb)
        return jsonify(error="Error interno del servidor"), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f"🔥 Servidor iniciado en puerto {port}")
    app.run(host='0.0.0.0', port=port)
