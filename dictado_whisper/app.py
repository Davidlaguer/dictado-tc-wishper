import os, json, tempfile, subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import whisper, openai

# ————— Verificación de clave —————
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("🔑 La variable OPENAI_API_KEY no está definida")
openai.api_key = api_key

# ————— App y SocketIO —————
# Indicamos que los estáticos están en ../web
app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), '../web'),
    static_url_path=''      # sirve /index.html, /style.css, /script.js
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
            "content": (
                "Eres un radiólogo experto. Genera siempre un informe con este formato exacto:\n\n"
                "TC DE {ESTUDIO}:\n\n"
                "TÉCNICA:\n"
                "{TEXTO_DE_LA_TECNICA}\n\n"
                "HALLAZGOS:\n"
                "{TEXTO_DE_LOS_HALLAZGOS}\n\n"
                "CONCLUSIÓN:\n"
                "{TEXTO_DE_LA_CONCLUSION}\n\n"
                "Devuélvelo **solo** como un objeto JSON con las claves:\n"
                "{\n"
                "  \"estudio\": \"...\",\n"
                "  \"tecnica\": \"...\",\n"
                "  \"hallazgos\": \"...\",\n"
                "  \"conclusion\": \"...\"\n"
                "}\n\n"
                "No incluyas nada fuera de ese JSON."
            )
        },
        {"role": "user", "content": dictado}
    ]

    try:
        resp = openai.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.2,
            max_tokens=1200
        )
        raw = resp.choices[0].message.content.strip()
        informe_json = json.loads(raw)
        return jsonify(informe=informe_json)
    except json.JSONDecodeError:
        return jsonify(error="Error al parsear JSON de OpenAI"), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f"🔥 Iniciando servidor WebSocket con Whisper y OpenAI (puerto {port})…")
    socketio.run(app, host='0.0.0.0', port=port)
