import modal
import subprocess
import os

MODEL_NAME = "mistralai/Ministral-3-14B-Instruct-2512"
GPU_TYPE   = "L40S"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("vllm", "huggingface_hub")  # latest vllm, no pin
)

volume = modal.Volume.from_name("model-weights", create_if_missing=True)
app = modal.App("my-llm")


@app.function(
    gpu=GPU_TYPE,
    image=image,
    volumes={"/models": volume},
    timeout=3600,
    secrets=[modal.Secret.from_name("huggingface")],
)
def download_model():
    from huggingface_hub import snapshot_download
    snapshot_download(
        repo_id=MODEL_NAME,
        local_dir=f"/models/{MODEL_NAME}",
        token=os.environ.get("HF_TOKEN", ""),
    )
    volume.commit()
    print("Download complete.")


@app.function(
    gpu=GPU_TYPE,
    image=image,
    volumes={"/models": volume},
    scaledown_window=300,
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface")],
)
@modal.web_server(port=8000, startup_timeout=600, requires_proxy_auth=True)
def serve():
    subprocess.Popen(
        [
            "python", "-m", "vllm.entrypoints.openai.api_server",
            "--model",              MODEL_NAME,
            "--download-dir",       "/models",
            "--host",               "0.0.0.0",
            "--port",               "8000",
            "--dtype",              "auto",
            "--max-model-len",      "32768",
            "--tokenizer_mode",     "mistral",
            "--config_format",      "mistral",
            "--load_format",        "mistral",
            "--enable-auto-tool-choice",
            "--tool-call-parser",   "mistral",
        ],
        env={**os.environ, "HF_TOKEN": os.environ.get("HF_TOKEN", "")},
    )