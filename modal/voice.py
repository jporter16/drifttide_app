import modal
import os
import tempfile

app = modal.App("voice-pipeline")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("espeak-ng")
    .pip_install(
        "faster-whisper==1.0.3",
        "kokoro>=0.9.4",
        "soundfile",
        "numpy",
        "fastapi",
        "python-multipart",
    )
)

# Volumes cache model weights so they survive image rebuilds
# and don't need to be re-downloaded every deploy
whisper_cache = modal.Volume.from_name("whisper-cache", create_if_missing=True)
kokoro_cache = modal.Volume.from_name("kokoro-cache", create_if_missing=True)


@app.cls(
    image=image.env({
        "HF_HUB_CACHE": "/kokoro-cache",
    }),
    cpu=2,
    memory=2048,
    timeout=120,
    scaledown_window=300,
    volumes={
        "/whisper-cache": whisper_cache,
        "/kokoro-cache": kokoro_cache,
    },
)
class VoicePipeline:

    @modal.enter()
    def load_models(self):
        from faster_whisper import WhisperModel
        from kokoro import KPipeline

        # Download to volume on first run, served from cache after
        self.whisper = WhisperModel(
            "small",
            device="cpu",
            compute_type="int8",
            download_root="/whisper-cache",
        )
        self.kokoro = {
            'a': KPipeline(lang_code='a'),
            'b': KPipeline(lang_code='b'),
        }

    @modal.asgi_app()
    def web(self):
        from fastapi import FastAPI, UploadFile, File, Form, Request        
        from fastapi.responses import StreamingResponse, JSONResponse
        from pydantic import BaseModel
        import soundfile as sf
        import numpy as np
        import io

        ALLOWED_IPS = {
        "64.23.205.157",   # Drifttide droplet
        "134.199.138.170"
        }       

        api = FastAPI(title="Voice Pipeline — STT + TTS")

        @api.middleware("http")
        async def ip_whitelist(request: Request, call_next):
            client_ip = request.headers.get("x-forwarded-for", request.client.host)
            # x-forwarded-for can be a comma-separated list, take the first
            client_ip = client_ip.split(",")[0].strip()
            if client_ip not in ALLOWED_IPS:
                return JSONResponse(
                    status_code=403,
                    content={"error": f"IP {client_ip} not allowed"}
                )
            return await call_next(request)        


        @api.get("/health")
        def health():
            return {"status": "ok", "services": ["whisper", "kokoro"]}

        @api.post("/v1/audio/transcriptions")
        async def transcribe(
            file: UploadFile = File(...),
            model: str = Form(default="whisper-1"),
            language: str = Form(default=None),
        ):
            audio_bytes = await file.read()
            suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"

            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name

            try:
                segments, _ = self.whisper.transcribe(
                    tmp_path,
                    language=language or None,
                    vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 500},
                )
                text = " ".join(s.text.strip() for s in segments)
            finally:
                os.unlink(tmp_path)

            return JSONResponse({"text": text})

        class TTSRequest(BaseModel):
            model: str = "kokoro"
            input: str
            voice: str = "af_heart"
            speed: float = 1.0

        @api.post("/v1/audio/speech")
        async def synthesize(request: TTSRequest):
            if not request.input.strip():
                return JSONResponse({"error": "Empty input"}, status_code=400)

            lang_code = 'b' if request.voice.startswith('b') else 'a'
            pipeline = self.kokoro.get(lang_code, self.kokoro['a'])

            chunks = []
            for _, _, audio in pipeline(
                request.input,
                voice=request.voice,
                speed=request.speed,
                split_pattern=r'\n+'
            ):
                chunks.append(audio)

            combined = np.concatenate(chunks)
            buf = io.BytesIO()
            sf.write(buf, combined, 24000, format='WAV')
            buf.seek(0)

            return StreamingResponse(buf, media_type="audio/wav")

        return api