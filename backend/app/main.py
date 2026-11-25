from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager

import cv2
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import CORS_ORIGINS, MAX_UPLOAD_MB, MODEL_DIR, UPLOAD_DIR
from .database import Prediction, SessionLocal, init_db
from .model_service import ModelNotReady, service
from .report import build_pdf


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    try:
        service.load()
    except ModelNotReady as e:  # the API still starts so /health can explain what is missing
        print("WARNING:", e)
    yield


app = FastAPI(title="AI Plant Doctor API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get(db: Session, pid: str) -> Prediction:
    p = db.get(Prediction, pid)
    if not p:
        raise HTTPException(404, "Prediction not found")
    return p


@app.get("/health")
def health():
    if not service.ready:
        try:
            service.load()  # picks the model up as soon as training has written the files
        except ModelNotReady:
            pass
    return {"status": "ok", "model_loaded": service.ready,
            "detail": None if service.ready else "Model not trained yet: run python training/train_svm.py"}


def _ensure_model():
    if not service.ready:
        try:
            service.load()
        except ModelNotReady as e:
            raise HTTPException(503, str(e))


def _run(img, crop: str | None) -> dict:
    crop = (crop or "").strip() or None
    if crop and crop.lower() == "auto":
        crop = None
    try:
        return service.predict(img, crop=crop)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _apply(row: Prediction, r: dict) -> None:
    row.class_name, row.plant, row.disease, row.status = r["class_name"], r["plant"], r["disease"], r["status"]
    row.confidence, row.description = r["confidence_raw"], r["description"]
    row.prevention, row.treatment, row.top_predictions = r["prevention"], r["treatment"], r["top_predictions"]
    row.verdict, row.notes, row.crop_hint = r["verdict"], r["notes"], r["crop_hint"]


@app.post("/predict")
def predict(file: UploadFile = File(...), crop: str | None = Form(None), db: Session = Depends(get_db)):
    """Classify a leaf. Optional form field `crop` (e.g. "Tomato") restricts the answer to that crop's diseases."""
    _ensure_model()
    limit = MAX_UPLOAD_MB * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"Image is larger than {MAX_UPLOAD_MB} MB")
    img = service.decode(data)
    if img is None:
        raise HTTPException(400, "Could not read the file as an image. Use JPG, PNG, WEBP or BMP.")

    h, w = img.shape[:2]
    if max(h, w) > 1280:  # stored copy stays small; features are computed at 256x256 anyway
        s = 1280 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    result = _run(img, crop)

    pid = uuid.uuid4().hex
    fname = f"{pid}.jpg"  # always re-encoded: never serve the raw uploaded bytes back
    cv2.imwrite(str(UPLOAD_DIR / fname), img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    row = Prediction(id=pid, image_file=fname, original_name=(file.filename or "")[:255])
    _apply(row, result)
    db.add(row)
    db.commit()
    return row.to_dict()


@app.post("/history/{pid}/recheck")
def recheck(pid: str, crop: str | None = Form(None), db: Session = Depends(get_db)):
    """Re-run a saved scan with a different crop selection (or "auto"), without uploading again."""
    _ensure_model()
    row = _get(db, pid)
    img = cv2.imread(str(UPLOAD_DIR / row.image_file))
    if img is None:
        raise HTTPException(410, "The stored image for this scan is missing")
    _apply(row, _run(img, crop))
    db.commit()
    return row.to_dict()


@app.get("/history")
def history(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    q = select(Prediction).order_by(Prediction.created_at.desc()).limit(max(1, min(limit, 200))).offset(max(0, offset))
    total = db.scalar(select(func.count()).select_from(Prediction))
    return {"total": total, "items": [p.to_dict() for p in db.scalars(q)]}


@app.get("/history/{pid}")
def history_item(pid: str, db: Session = Depends(get_db)):
    return _get(db, pid).to_dict()


@app.delete("/history/{pid}", status_code=204)
def delete_item(pid: str, db: Session = Depends(get_db)):
    p = _get(db, pid)
    (UPLOAD_DIR / p.image_file).unlink(missing_ok=True)
    db.delete(p)
    db.commit()


@app.get("/report/{pid}")
def report(pid: str, db: Session = Depends(get_db)):
    p = _get(db, pid)
    pdf = build_pdf(p, UPLOAD_DIR / p.image_file)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="plant-report-{pid[:8]}.pdf"'})


@app.get("/classes")
def classes():
    _ensure_model()
    crops: dict[str, list[dict]] = {}
    for info in service.mapping.values():
        crops.setdefault(info["plant"], []).append({"disease": info["disease"], "status": info["status"]})
    return {"n_classes": len(service.mapping), "crops": crops}


@app.get("/metrics")
def metrics():
    f = MODEL_DIR / "metrics.json"
    if not f.exists():
        raise HTTPException(404, "metrics.json not found. Train the model first.")
    return json.loads(f.read_text())
