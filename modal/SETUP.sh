# Voice Assistant Setup — Drifttide + Modal
# ============================================================
# Everything you need to do, in order.

# ── STEP 1: Deploy the three Modal services ───────────────────
# Run these from your local machine (not the droplet).
# Each command gives you a URL when it finishes.


modal deploy voice.py
# → copy the URL, looks like: https://your-username--kokoro-tts-kokoroservice-web.modal.run

modal deploy llm.py
# → copy the URL, looks like: https://your-username--mistral-llm-serve.modal.run


# ── STEP 2: Create HuggingFace secret in Modal ───────────────
# (needed for llm_service.py to download the model)
# Get your token from https://huggingface.co/settings/tokens
modal secret create huggingface-secret HF_TOKEN=hf_your_token_here


# ── STEP 3: Update Seashell to point to your new Modal LLM ───
# In /home/tide/seashell/.env, update the LLM endpoint URL:
#
# Before (Gemma 3):
#   OPENAI_API_BASE=<whatever it was>
#   MODEL=gemma3
#
# After (Mistral on Modal):
#   OPENAI_API_BASE=https://your-username--mistral-llm-serve.modal.run/v1
#   OPENAI_API_KEY=not-needed
#   MODEL=mistralai/Mistral-7B-Instruct-v0.3
#
# Then restart Seashell:
cd /home/tide/music
docker compose restart seashell


# ── STEP 4: Configure Open WebUI Audio ───────────────────────
# Open https://drift-tide.com in your browser
# Click your profile icon (bottom left) → Settings → Audio

# SPEECH TO TEXT section:
#   STT Engine:      OpenAI
#   API Base URL:    https://your-username--whisper-stt-whisperservice-web.modal.run
#   API Key:         not-needed
#   Model:           whisper-1

# TEXT TO SPEECH section:
#   TTS Engine:      OpenAI
#   API Base URL:    https://your-username--kokoro-tts-kokoroservice-web.modal.run
#   API Key:         not-needed
#   Voice:           af_heart
#   Model:           kokoro

# Save. Done.


# ── STEP 5: Set up your personal assistant model ─────────────
# In Open WebUI: Workspace → Models → + New Model
#
# Name:         Personal Assistant
# Base Model:   (select your Mistral model)
# System Prompt:
# ---
# You are a helpful personal voice assistant. You have access to
# tools for Gmail, Google Calendar, Joplin notes, Seafile files,
# and Navidrome music.
#
# CRITICAL: Your responses will be spoken aloud by a text-to-speech
# system. Never use markdown, bullet points, asterisks, headers, or
# any formatting. Write only in natural spoken sentences.
#
# Keep responses concise. When reading emails, summarize rather than
# reading word for word unless asked otherwise.
#
# Always confirm before sending emails or deleting anything.
# While fetching data, say "One moment..." so the user knows you are working.
# ---


# ── STEP 6: Test the voice pipeline ──────────────────────────
# In Open WebUI, open a new chat with your Personal Assistant model.
# Click the phone/call icon in the bottom right of the input area.
# Microphone activates. Speak:

#   "What is the capital of France?"
# You should hear: "The capital of France is Paris."

# If that works, try:
#   "Read me my unread emails"
# You should hear a summary of your Gmail inbox.


# ── VERIFY Modal services are running ────────────────────────
# Check health endpoints in your browser or with curl:

curl https://your-username--whisper-stt-whisperservice-web.modal.run/health
# → {"status":"ok","model":"small"}

curl https://your-username--kokoro-tts-kokoroservice-web.modal.run/health
# → {"status":"ok"}

curl https://your-username--mistral-llm-serve.modal.run/v1/models
# → {"object":"list","data":[{"id":"mistralai/Mistral-7B-Instruct-v0.3",...}]}


# ── WHAT STAYS ON DRIFTTIDE (no changes needed) ──────────────
# ✅ Open WebUI   — chat interface
# ✅ Caddy        — HTTPS routing
# ✅ Navidrome    — music server
# ✅ Seashell     — API proxy (just update .env to point to Modal LLM)
# ✅ AudioMuse-AI — playlist generation
# ✅ Filebrowser  — file management

# ── WHAT MOVES TO MODAL ──────────────────────────────────────
# 🚀 Whisper STT  — whisper_service.py
# 🚀 Kokoro TTS   — kokoro_service.py
# 🚀 Mistral LLM  — llm_service.py


# ── ESTIMATED MODAL COSTS (personal use) ─────────────────────
# Whisper (CPU, 2 cores):  ~$0.0002 per transcription
# Kokoro  (CPU, 2 cores):  ~$0.0003 per response
# Mistral (A10G GPU):      ~$0.001  per conversation turn
# Cold start: free, just adds ~30s latency on first daily use
# For ~50 voice interactions/day: under $1/month total
