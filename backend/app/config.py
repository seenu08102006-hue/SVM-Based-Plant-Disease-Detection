import os
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]          # backend/
ROOT = BASE.parent                                  # plant-disease-ai/
MODEL_DIR = Path(os.getenv("MODEL_DIR", ROOT / "model"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE / "uploads"))
DATA_DIR = BASE / "data"

# SQLite by default (zero setup). For PostgreSQL install psycopg and set e.g.
#   DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/plantdoctor
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(DATA_DIR / 'history.db').as_posix()}")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
# Below this confidence a result is shown as "not sure" (test set: >=0.7 is ~97% correct, <0.7 only ~64%).
CONFIDENT = float(os.getenv("CONFIDENT", "0.7"))

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
