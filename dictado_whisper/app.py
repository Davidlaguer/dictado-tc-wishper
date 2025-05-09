import os
from dotenv import load_dotenv

# ————— Carga y verificación de la clave —————
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("🔑 La variable OPENAI_API_KEY no está definida en el entorno")
print("✅ OPENAI_API_KEY detectada ✅")

# ————— Imports del resto de dependencias —————
import json
import tempfile
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import whisper
from openai import OpenAI

# ————— Inicializa cliente OpenAI —————
client = OpenAI(api_key=api_key)

# ————— App y SocketIO —————
app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), '../web'),
    static_url_path=''
)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Sirve index.html en la raíz
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Sirve cualquier otro archivo estático (CSS, JS, imágenes…)
@app.route('/<path:filename>')
def static_files(filename):
    return app.send_static_file(filename)

# ————— Whisper Streaming —————
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

# ————— Generación de informe con GPT-4 —————
@app.route('/informe', methods=['POST'])
def generar_informe():
    data = request.get_json() or {}
    dictado = data.get('dictado', '').strip()
    if not dictado:
        return jsonify(error="Dictado vacío"), 400

    messages = [
        {
            "role": "system",
            "content": """Eres un radiólogo experto. Genera siempre un informe con este formato exacto:

TC DE {ESTUDIO}:

TÉCNICA:
{TEXTO_DE_LA_TECNICA}

HALLAZGOS:
{TEXTO_DE_LOS_HALLAZGOS}

CONCLUSIÓN:
{TEXTO_DE_LA_CONCLUSION}

Devuélvelo **solo** como un objeto JSON con las claves:
{
  \"estudio\": \"...\",
  \"tecnica\": \"...\",
  \"hallazgos\": \"...\",
  \"conclusion\": \"...\"
}

No incluyas nada fuera de ese JSON."""
        },
        {"role": "user", "content": dictado}
    ]

    print("📤 [informe] Mensajes a OpenAI:", messages)
    resp = client.chat.completions.create(
        model="gpt-4",
        messages=messages,
        temperature=0.2,
        max_tokens=1200
    )
    print("📥 [informe] Respuesta completa:", resp)
    raw = resp.choices[0].message.content.strip()
    print("📄 [informe] Contenido crudo:", raw)

    try:
        informe_json = json.loads(raw)
        return jsonify(informe=informe_json)
    except json.JSONDecodeError as e:
        print("⚠️ [informe] Error al parsear JSON de OpenAI:", e)
        print("⚠️ [informe] Raw recibido:", raw)
        return jsonify(error="Error al parsear JSON de OpenAI"), 500
    except Exception as e:
        print("⚠️ [informe] Otro error inesperado:", e)
        return jsonify(error=str(e)), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f"🔥 Iniciando servidor WebSocket con Whisper y OpenAI (puerto {port})…")
    socketio.run(app, host='0.0.0.0', port=port)
