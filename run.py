"""One-click launcher for AI Plant Doctor.

Open this file in VS Code and press the Run button (or: python run.py).
It starts the FastAPI backend and the React frontend, waits until both are ready,
prints the local URL and opens it in Google Chrome. Press Ctrl+C (or the stop button) to shut both down.
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
MODEL_FILES = ["model.pkl", "scaler.pkl", "label_encoder.pkl", "disease_mapping.json"]
IS_WIN = os.name == "nt"


def say(msg: str) -> None:
    print(f"[run] {msg}", flush=True)


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) != 0


def free_port(start: int) -> int:
    for p in range(start, start + 50):
        if port_free(p):
            return p
    raise SystemExit(f"No free port found near {start}")


def get_json(url: str, timeout: float = 2.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def wait_for(url: str, proc: subprocess.Popen | None, name: str, seconds: int = 90) -> bool:
    for _ in range(seconds * 2):
        if proc is not None and proc.poll() is not None:
            say(f"{name} exited early (code {proc.returncode}). See the messages above.")
            return False
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.5)
    say(f"{name} did not become ready in {seconds}s")
    return False


def find_chrome() -> str | None:
    candidates = []
    if IS_WIN:
        for env in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
            base = os.environ.get(env)
            if base:
                candidates.append(Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe")
    elif sys.platform == "darwin":
        candidates.append(Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))
    for c in candidates:
        if c.exists():
            return str(c)
    for name in ("google-chrome", "google-chrome-stable", "chrome", "chromium"):
        p = shutil.which(name)
        if p:
            return p
    return None


def open_in_chrome(url: str) -> None:
    chrome = find_chrome()
    if chrome:
        subprocess.Popen([chrome, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        say("Opened in Google Chrome")
    else:
        webbrowser.open(url)
        say("Google Chrome not found, opened in your default browser instead")


def stop(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    if IS_WIN:  # kill the whole tree (npm -> node -> vite)
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        proc.terminate()


def check_python_deps() -> None:
    missing = []
    for mod in ("fastapi", "uvicorn", "multipart", "cv2", "skimage", "sklearn", "sqlalchemy", "reportlab", "joblib"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        say(f"Installing missing Python packages ({', '.join(missing)}) ...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])


def main() -> None:
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("Node.js / npm not found. Install Node 18+ from https://nodejs.org and try again.")
    check_python_deps()
    if not (FRONTEND / "node_modules").exists():
        say("Installing frontend packages (first run only) ...")
        subprocess.check_call([npm, "install", "--no-audit", "--no-fund"], cwd=FRONTEND)

    missing = [f for f in MODEL_FILES if not (ROOT / "model" / f).exists()]
    if missing:
        say("WARNING: the SVM model is not trained yet, so leaf detection will be disabled.")
        say("         Train it once with:  python training/train_svm.py")

    backend_proc = frontend_proc = None
    try:
        # Backend: reuse one that is already running on 8000, otherwise start our own.
        health = get_json("http://127.0.0.1:8000/health")
        if health and "model_loaded" in health:
            api_port = 8000
            say("Backend already running on port 8000, reusing it")
        else:
            api_port = free_port(8000)
            say(f"Starting backend on port {api_port} ...")
            backend_proc = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port)],
                cwd=BACKEND)
            if not wait_for(f"http://127.0.0.1:{api_port}/health", backend_proc, "Backend"):
                return

        # Frontend: always on a free port so it never collides with other projects.
        web_port = free_port(5180)
        say(f"Starting frontend on port {web_port} ...")
        env = {**os.environ, "VITE_BACKEND": f"http://127.0.0.1:{api_port}"}
        frontend_proc = subprocess.Popen([npm, "run", "dev", "--", "--port", str(web_port), "--strictPort"],
                                         cwd=FRONTEND, env=env)
        url = f"http://localhost:{web_port}"
        if not wait_for(url, frontend_proc, "Frontend"):
            return

        h = get_json(f"http://127.0.0.1:{api_port}/health") or {}
        print()
        print("=" * 60)
        print(f"  AI Plant Doctor is running:   {url}")
        print(f"  API docs:                     http://localhost:{api_port}/docs")
        print(f"  Model loaded:                 {'yes' if h.get('model_loaded') else 'NO (train it first)'}")
        print("  Press Ctrl+C (or the stop button) to stop both servers.")
        print("=" * 60)
        print(flush=True)
        open_in_chrome(url)

        while True:
            time.sleep(1)
            if backend_proc is not None and backend_proc.poll() is not None:
                say("Backend stopped."); break
            if frontend_proc.poll() is not None:
                say("Frontend stopped."); break
    except KeyboardInterrupt:
        pass
    finally:
        say("Shutting down ...")
        stop(frontend_proc)
        stop(backend_proc)


if __name__ == "__main__":
    main()
