"""Build the "does this look like a leaf the model knows?" check (out-of-distribution detection).

An SVM always answers with one of its 38 classes, even for a rose, a person or a busy field photo.
This script fits a class-conditional novelty detector on the training features so the API can say
"not recognised" instead of a confident wrong name.

Method (no deep learning):
  scaled features -> PCA (32 dims) -> mean distance to the k=10 nearest *training images of the
  predicted class*. Each class gets its own threshold: the 99th percentile of that distance on the
  held-out test images of the class. A ratio distance/threshold > 1 means "unlike anything we trained on".

Also measures how the SVM confidence behaves on the test set, to calibrate the "not sure" threshold.

Run after train_svm.py (uses its feature cache, about 1 minute):
    python training/build_ood.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.decomposition import PCA
from sklearn.neighbors import NearestNeighbors

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "model"
CACHE = ROOT / "training" / "cache" / "features.npz"
SPLIT = ROOT / "dataset" / "splits" / "color_train.txt"
K, DIMS, PCTL = 10, 32, 99.0


def main():
    if not CACHE.exists() or not SPLIT.exists():
        sys.exit("Feature cache or split file missing: run python training/train_svm.py first")
    z = np.load(CACHE, allow_pickle=False)
    X, paths = z["X"][z["ok"]], z["paths"][z["ok"]]
    train_set = {l.strip() for l in SPLIT.read_text().splitlines() if l.strip()}
    is_tr = np.array(["/".join(Path(p).parts[-4:]) in train_set for p in paths])
    labels = np.array([Path(p).parts[-2] for p in paths])

    scaler = joblib.load(MODEL_DIR / "scaler.pkl")
    model = joblib.load(MODEL_DIR / "model.pkl")
    enc = joblib.load(MODEL_DIR / "label_encoder.pkl")
    Xs = scaler.transform(X).astype(np.float32)
    pca = PCA(DIMS, random_state=42).fit(Xs[is_tr])
    P = pca.transform(Xs).astype(np.float32)

    per_class = {}
    for c in enc.classes_:
        nn = NearestNeighbors(n_neighbors=K).fit(P[is_tr & (labels == c)])
        d = nn.kneighbors(P[~is_tr & (labels == c)])[0].mean(1)
        per_class[c] = {"nn": nn, "threshold": float(np.percentile(d, PCTL))}

    # evaluate on the test set using the deployed model's predictions
    te = np.where(~is_tr)[0]
    proba = model.predict_proba(Xs[te])
    pred = enc.inverse_transform(model.classes_[proba.argmax(1)])
    conf = proba.max(1)
    correct = pred == labels[te]
    ratio = np.array([per_class[c]["nn"].kneighbors(P[i:i + 1])[0].mean() / per_class[c]["threshold"]
                      for i, c in zip(te, pred)])
    print(f"test images: {len(te)}   accuracy {correct.mean():.4f}")
    print(f"novelty check accepts {np.mean(ratio[correct] <= 1):.3f} of correct and {np.mean(ratio[~correct] <= 1):.3f} of wrong predictions")
    conf_stats = {}
    for t in (0.5, 0.6, 0.7, 0.8):
        hi = conf >= t
        conf_stats[str(t)] = {"share_of_images": float(hi.mean()), "accuracy_when_above": float(correct[hi].mean()),
                              "accuracy_when_below": float(correct[~hi].mean()) if (~hi).any() else None}
        print(f"confidence >= {t:.1f}: {hi.mean():.3f} of images, accuracy {correct[hi].mean():.3f} "
              f"(below: {correct[~hi].mean():.3f})")

    joblib.dump({"pca": pca, "k": K, "percentile": PCTL, "per_class": per_class}, MODEL_DIR / "ood.pkl", compress=3)
    m = json.loads((MODEL_DIR / "metrics.json").read_text())
    m["ood"] = {"method": f"PCA({DIMS}) + mean distance to {K} nearest training images of the predicted class, "
                          f"per-class p{PCTL:g} threshold",
                "accept_correct": float(np.mean(ratio[correct] <= 1)), "accept_wrong": float(np.mean(ratio[~correct] <= 1)),
                "confidence": conf_stats}
    (MODEL_DIR / "metrics.json").write_text(json.dumps(m, indent=2))
    print("saved", MODEL_DIR / "ood.pkl")


if __name__ == "__main__":
    main()
