import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("🔑 La variable OPENAI_API_KEY no está definida en el entorno")
print("✅ OPENAI_API_KEY detectada ✅")

import tempfile
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import whisper
from openai import OpenAI

client = OpenAI(api_key=api_key)

app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), '../web'),
    static_url_path=''
)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return app.send_static_file(filename)

# --- Whisper ---
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

# --- Generar informe desde Assistant ---
@app.route('/informe', methods=['POST'])
def generar_informe():
    data = request.get_json() or {}
    dictado = data.get('dictado', '').strip()
    if not dictado:
        return jsonify(error="Dictado vacío"), 400

    messages = [
        {
            "role": "system",
            "content": """
Eres un radiólogo experto. A partir de un dictado por voz, debes generar un informe radiológico completo y redactado de forma clara y profesional.

El dictado puede incluir indicaciones como "modo plantillas", hallazgos específicos, o instrucciones como "valida frases normales". Debes aplicar la plantilla correspondiente, sustituir o añadir hallazgos en su lugar adecuado, y generar el informe final completo.

El formato debe ser este:

TC DE [ESTUDIO]:

TÉCNICA:
[Descripción de técnica basada en lo dictado o plantilla]

HALLAZGOS:
[Frases normales más hallazgos dictados]

CONCLUSIÓN:
[solo si el dictado la incluye]

Devuelve únicamente el informe completo como texto plano. No incluyas encabezados tipo “INFORME:”, ni JSON, ni explicaciones. Solo el cuerpo del informe final, tal como se entregaría a un clínico.
"""
        },
        {"role": "user", "content": dictado}
    ]

    print("📤 Enviando dictado al Assistant:", dictado)

    try:
        resp = client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.2,
            max_tokens=1200
        )
        raw = resp.choices[0].message.content.strip()
        return jsonify(informe=raw)

    except Exception as e:
        print("❌ Error al generar informe:", e)
        return jsonify(error=str(e)), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f"🔥 Servidor iniciado en puerto {port}")
    socketio.run(app, host='0.0.0.0', port=port)

