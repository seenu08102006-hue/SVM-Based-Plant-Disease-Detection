"""Loads the trained SVM artifacts once and runs inference on uploaded images.

Three safeguards against wrong names:
  1. crop hint  - if the user says which plant it is, the SVM only chooses among that crop's classes,
                  so the plant name is always right and the disease is picked from the right list.
  2. "not sure" - confidence below CONFIDENT (0.7) is reported as uncertain. On the test set, predictions
                  >= 0.7 are ~97% correct, predictions below it only ~64%.
  3. novelty    - ood.pkl: if the image is far from every training image of the predicted class,
                  the result is "not recognised" instead of a made-up name.
"""
from __future__ import annotations

import json
import threading

import cv2
import joblib
import numpy as np

from .config import CONFIDENT, MODEL_DIR
from .features import extract_features

REQUIRED = ["model.pkl", "scaler.pkl", "label_encoder.pkl", "disease_mapping.json"]

UNRECOGNISED = {
    "description": "This image does not look like any of the leaves the model was trained on. It may be a plant that is "
                   "not supported (the model knows 14 crops from the PlantVillage dataset), a photo with several "
                   "leaves or a busy background, or a blurry image.",
    "prevention": ["Photograph a single leaf on a plain background (paper, a table) in even daylight",
                   "Make sure the plant is one of the supported crops",
                   "Select the crop before detection for a more reliable result"],
    "treatment": ["No diagnosis could be made: consult a local agricultural extension officer or plant clinic"],
}


class ModelNotReady(RuntimeError):
    pass


class ModelService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.model = self.scaler = self.encoder = self.ood = None
        self.mapping: dict = {}
        self.crops: dict[str, list[str]] = {}

    @property
    def ready(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        missing = [n for n in REQUIRED if not (MODEL_DIR / n).exists()]
        if missing:
            raise ModelNotReady(f"Missing {missing} in {MODEL_DIR}. Train first: python training/train_svm.py")
        self.scaler = joblib.load(MODEL_DIR / "scaler.pkl")
        self.encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")
        self.mapping = json.loads((MODEL_DIR / "disease_mapping.json").read_text())
        self.ood = joblib.load(MODEL_DIR / "ood.pkl") if (MODEL_DIR / "ood.pkl").exists() else None
        crops: dict[str, list[str]] = {}
        for cls, info in self.mapping.items():
            crops.setdefault(info["plant"], []).append(cls)
        self.crops = dict(sorted(crops.items()))
        self.model = joblib.load(MODEL_DIR / "model.pkl")

    @staticmethod
    def decode(data: bytes) -> np.ndarray | None:
        return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)

    def _novelty_ratio(self, x: np.ndarray, cls: str) -> float | None:
        if not self.ood or cls not in self.ood["per_class"]:
            return None
        pc = self.ood["per_class"][cls]
        d = pc["nn"].kneighbors(self.ood["pca"].transform(x))[0].mean()
        return float(d / pc["threshold"])

    def predict(self, img_bgr: np.ndarray, crop: str | None = None, top_k: int = 3) -> dict:
        if not self.ready:
            self.load()
        if crop and crop not in self.crops:
            raise ValueError(f"Unknown crop '{crop}'. Supported: {', '.join(self.crops)}")
        x = self.scaler.transform(extract_features(img_bgr).reshape(1, -1))
        with self._lock:
            raw = self.model.predict_proba(x)[0]
        names = self.encoder.inverse_transform(self.model.classes_)
        notes: list[str] = []

        if crop:  # restrict the decision to the crop the user selected
            mask = np.isin(names, self.crops[crop])
            crop_match = float(raw[mask].sum())
            if mask.sum() == 1:
                # only one class exists for this crop: renormalising would always give 100%
                proba = np.where(mask, raw, 0.0)
                only = self.mapping[names[mask][0]]
                notes.append(f"The training data only contains '{only['disease']}' for {crop}, so other "
                             f"conditions of {crop} cannot be detected. Confidence shows how strongly the leaf matches it.")
            else:
                proba = np.where(mask, raw, 0.0) / max(crop_match, 1e-12)
            if crop_match < 0.05:
                notes.append(f"The image does not look much like the {crop} leaves in the training data "
                             f"(match {crop_match * 100:.1f}%). Check the photo and the selected crop.")
        else:
            proba, crop_match = raw, None

        order = [i for i in np.argsort(proba)[::-1] if proba[i] > 0][:top_k]
        top = [{"class_name": names[i], "plant": self.mapping[names[i]]["plant"],
                "disease": self.mapping[names[i]]["disease"], "status": self.mapping[names[i]]["status"],
                "confidence": round(float(proba[i]) * 100, 2)} for i in order]
        best_cls, conf = names[order[0]], float(proba[order[0]])
        info = dict(self.mapping[best_cls])
        ratio = self._novelty_ratio(x, best_cls)

        if ratio is not None and ratio > 1.0:
            verdict = "unrecognised"
            notes.insert(0, "Not recognised: the image is unlike the training leaves of the closest class. "
                            "The suggestions below are only the nearest matches.")
            info.update({"plant": crop or "Unknown plant", "disease": "Not recognised", "status": "Unknown",
                         **UNRECOGNISED})
        elif conf < CONFIDENT:
            verdict = "uncertain"
            notes.insert(0, f"Not sure: {conf * 100:.0f}% is below the {CONFIDENT * 100:.0f}% confidence needed for a reliable "
                            "diagnosis." + ("" if crop else " If this plant is not one of the supported crops, the name is "
                                                              "not meaningful. Select the crop and check again."))
        else:
            verdict = "confident"
        return {**info, "class_name": best_cls, "confidence_raw": conf, "top_predictions": top,
                "verdict": verdict, "notes": notes, "crop_hint": crop, "crop_match": crop_match,
                "novelty_ratio": ratio, "low_confidence": verdict != "confident"}


service = ModelService()
