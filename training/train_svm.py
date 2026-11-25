"""Train and compare Linear / Polynomial / RBF SVMs on PlantVillage with hand-crafted features.

Usage (from plant-disease-ai/):
    python training/train_svm.py                       # defaults
    python training/train_svm.py --train-per-class 300 --grid-samples 2000

Pipeline
  1. discover classes from dataset folders (nothing hard-coded)
  2. leaf-grouped train/test split (official PlantVillage split files; falls back to a stratified split)
  3. extract features for every image (RGB/HSV histograms + Haralick/GLCM + HOG), cached on disk
  4. GridSearchCV (3-fold) per kernel: C in {0.1,1,10,100}, gamma in {scale,auto,0.001,0.01}
  5. refit best of each kernel on the training set, evaluate on the held-out test set
  6. pick the kernel with the best cross-validation score, refit it with probability estimates
  7. save model.pkl, scaler.pkl, label_encoder.pkl, disease_mapping.json, metrics.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
from joblib import Parallel, delayed
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (accuracy_score, confusion_matrix, precision_recall_fscore_support)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "training"))
from app.features import extract_from_path, feature_groups  # noqa: E402
from disease_knowledge import build_mapping  # noqa: E402

MODEL_DIR = ROOT / "model"
CACHE_DIR = ROOT / "training" / "cache"
SEED = 42


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def find_dataset(arg: str | None) -> Path:
    for c in ([Path(arg)] if arg else []) + [ROOT / "dataset", ROOT.parent / "PlantVillage-Dataset"]:
        if (c / "raw" / "color").is_dir():
            return c
    sys.exit("Dataset not found. Clone https://github.com/spMohanty/PlantVillage-Dataset into plant-disease-ai/dataset "
             "or pass --dataset PATH")


def official_split(name: str) -> list[str] | None:
    """Leaf-grouped split lists published with the dataset on Hugging Face (small text files)."""
    f = ROOT / "dataset" / "splits" / f"color_{name}.txt"
    if not f.exists():
        try:
            from huggingface_hub import hf_hub_download
            p = hf_hub_download("mohanty/PlantVillage", f"splits/color_{name}.txt", repo_type="dataset")
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(Path(p).read_bytes())
        except Exception as e:  # offline etc.
            log("could not fetch official split:", e)
            return None
    return [l.strip() for l in f.read_text().splitlines() if l.strip()]


def collect(ds: Path, classes: list[str]):
    paths, labels, split = [], [], []
    tr, te = official_split("train"), official_split("test")
    if tr and te:
        log("using official leaf-grouped split files")
        for sp, lst in (("train", tr), ("test", te)):
            for rel in lst:
                parts = rel.split("/")
                if (ds / rel).exists() and parts[2] in classes:
                    paths.append(str(ds / rel)); labels.append(parts[2]); split.append(sp)
        return np.array(paths), np.array(labels), np.array(split), "official leaf-grouped 80/20"
    log("falling back to a stratified random 80/20 split (may leak augmented copies of one leaf)")
    for c in classes:
        for p in sorted((ds / "raw" / "color" / c).iterdir()):
            if p.suffix.lower() in (".jpg", ".jpeg", ".png"):
                paths.append(str(p)); labels.append(c)
    paths, labels = np.array(paths), np.array(labels)
    idx_tr, idx_te = train_test_split(np.arange(len(paths)), test_size=0.2, stratify=labels, random_state=SEED)
    split = np.empty(len(paths), dtype="<U5"); split[idx_tr] = "train"; split[idx_te] = "test"
    return paths, labels, split, "stratified random 80/20"


def extract_all(paths, n_jobs):
    log(f"extracting features for {len(paths)} images with {n_jobs} workers ...")
    t = time.time()
    feats = Parallel(n_jobs=n_jobs, batch_size=64)(delayed(extract_from_path)(p) for p in paths)
    bad = [i for i, f in enumerate(feats) if f is None]
    log(f"done in {time.time() - t:.0f}s, unreadable images: {len(bad)}")
    dim = next(f for f in feats if f is not None).shape[0]
    X = np.stack([f if f is not None else np.zeros(dim, np.float32) for f in feats])
    return X, np.array([i not in set(bad) for i in range(len(feats))])


def cap_per_class(y, cap, rng):
    keep = []
    for c in np.unique(y):
        idx = np.where(y == c)[0]
        keep.extend(rng.choice(idx, min(cap, len(idx)), replace=False))
    return np.sort(np.array(keep))


def metrics(y_true, y_pred):
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    pw, rw, fw, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)
    return {"accuracy": accuracy_score(y_true, y_pred), "precision_macro": p, "recall_macro": r, "f1_macro": f,
            "precision_weighted": pw, "recall_weighted": rw, "f1_weighted": fw}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset"); ap.add_argument("--train-per-class", type=int, default=500)
    ap.add_argument("--grid-samples", type=int, default=3000); ap.add_argument("--jobs", type=int, default=-1)
    ap.add_argument("--recompute-features", action="store_true")
    a = ap.parse_args()
    rng = np.random.default_rng(SEED)
    n_jobs = a.jobs if a.jobs > 0 else max(1, (joblib.cpu_count() or 2) - 1)

    ds = find_dataset(a.dataset)
    classes = sorted(p.name for p in (ds / "raw" / "color").iterdir() if p.is_dir())
    log(f"dataset: {ds}  |  {len(classes)} classes discovered")

    paths, labels, split, split_desc = collect(ds, classes)
    CACHE_DIR.mkdir(exist_ok=True, parents=True)
    cache = CACHE_DIR / "features.npz"
    if cache.exists() and not a.recompute_features:
        z = np.load(cache, allow_pickle=False)
        if len(z["X"]) == len(paths) and (z["paths"] == paths).all():
            X, ok = z["X"], z["ok"]; log("loaded cached features", X.shape)
        else:
            z = None
    else:
        z = None
    if z is None:
        X, ok = extract_all(paths, n_jobs)
        np.savez_compressed(cache, X=X, ok=ok, paths=paths)
    paths, labels, split, X = paths[ok], labels[ok], split[ok], X[ok]

    le = LabelEncoder().fit(classes)
    y = le.transform(labels)
    tr_all, te = np.where(split == "train")[0], np.where(split == "test")[0]
    tr = tr_all[cap_per_class(y[tr_all], a.train_per_class, rng)]
    log(f"train {len(tr)} (cap {a.train_per_class}/class of {len(tr_all)})  |  test {len(te)}  |  features {X.shape[1]}")
    Xtr, ytr, Xte, yte = X[tr], y[tr], X[te], y[te]

    gi = tr[cap_per_class(y[tr], max(2, a.grid_samples // len(classes)), rng)]
    Xg, yg = X[gi], y[gi]
    log(f"grid-search subset: {len(gi)} samples, 3-fold CV")

    Cs, gammas = [0.1, 1, 10, 100], ["scale", "auto", 0.001, 0.01]
    grids = {
        "linear": {"svc__C": Cs},
        "poly": {"svc__C": Cs, "svc__gamma": gammas},
        "rbf": {"svc__C": Cs, "svc__gamma": gammas},
    }
    fixed = {"linear": {}, "poly": {"degree": 3, "coef0": 1.0}, "rbf": {}}

    results, best_params, best_cv = {}, {}, {}
    cv = StratifiedKFold(3, shuffle=True, random_state=SEED)
    scaler = StandardScaler().fit(Xtr)
    Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)

    for kernel in ("linear", "poly", "rbf"):
        log(f"[{kernel}] GridSearchCV over {grids[kernel]}")
        t = time.time()
        pipe = Pipeline([("scaler", StandardScaler()), ("svc", SVC(kernel=kernel, cache_size=1000, **fixed[kernel]))])
        gs = GridSearchCV(pipe, grids[kernel], cv=cv, scoring="accuracy", n_jobs=n_jobs, refit=False)
        gs.fit(Xg, yg)
        grid_time = time.time() - t
        bp = {k.replace("svc__", ""): v for k, v in gs.best_params_.items()}
        best_params[kernel], best_cv[kernel] = bp, float(gs.best_score_)
        log(f"[{kernel}] best {bp}  cv_acc={gs.best_score_:.4f}  ({grid_time:.0f}s)")

        t = time.time()
        clf = SVC(kernel=kernel, cache_size=2000, **fixed[kernel], **bp).fit(Xtr_s, ytr)
        fit_time = time.time() - t
        t = time.time(); pred = clf.predict(Xte_s); pred_time = time.time() - t
        m = metrics(yte, pred)
        log(f"[{kernel}] test acc={m['accuracy']:.4f} f1_macro={m['f1_macro']:.4f} fit={fit_time:.0f}s predict={pred_time:.0f}s")
        grid_rows = [{"params": {k.replace("svc__", ""): v for k, v in p.items()}, "cv_accuracy": float(s)}
                     for p, s in zip(gs.cv_results_["params"], gs.cv_results_["mean_test_score"])]
        results[kernel] = {
            "kernel": kernel, "best_params": bp, "cv_accuracy": best_cv[kernel], "grid": grid_rows,
            "test": m, "n_support_vectors": int(clf.n_support_.sum()),
            "grid_search_seconds": grid_time, "fit_seconds": fit_time, "predict_seconds": pred_time,
            "confusion_matrix": confusion_matrix(yte, pred, labels=range(len(classes))).tolist(),
        }

    best_kernel = max(best_cv, key=best_cv.get)
    log(f"selected kernel by cross-validation score: {best_kernel} {best_params[best_kernel]}")
    t = time.time()
    # Platt scaling (sigmoid) for confidence scores. CalibratedClassifierCV replaces the deprecated
    # SVC(probability=True); ensemble=False keeps a single SVC fitted on all training data.
    base = SVC(kernel=best_kernel, cache_size=2000, **fixed[best_kernel], **best_params[best_kernel])
    final = CalibratedClassifierCV(base, method="sigmoid", cv=3, ensemble=False, n_jobs=min(3, n_jobs)).fit(Xtr_s, ytr)
    log(f"final model with probability estimates fitted in {time.time() - t:.0f}s")
    proba = final.predict_proba(Xte_s)
    pred = proba.argmax(1)
    fm = metrics(yte, pred)
    log(f"deployed model test acc={fm['accuracy']:.4f} f1_macro={fm['f1_macro']:.4f}")
    p, r, f, s = precision_recall_fscore_support(yte, pred, labels=range(len(classes)), zero_division=0)
    cm = confusion_matrix(yte, pred, labels=range(len(classes)))

    mapping = build_mapping(classes)
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(final, MODEL_DIR / "model.pkl", compress=3)
    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
    joblib.dump(le, MODEL_DIR / "label_encoder.pkl")
    (MODEL_DIR / "disease_mapping.json").write_text(json.dumps(mapping, indent=2))

    counts = {c: int((labels == c).sum()) for c in classes}
    metrics_json = {
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "classes": classes, "class_labels": [f"{mapping[c]['plant']} - {mapping[c]['disease']}" for c in classes],
        "n_classes": len(classes), "split": split_desc,
        "n_train_available": int(len(tr_all)), "n_train_used": int(len(tr)), "n_test": int(len(te)),
        "train_per_class_cap": a.train_per_class, "grid_search_samples": int(len(gi)),
        "feature_dim": int(X.shape[1]), "feature_groups": feature_groups(),
        "best_kernel": best_kernel, "best_params": best_params[best_kernel],
        "kernels": results, "deployed": fm,
        "per_class": [{"class": c, "label": f"{mapping[c]['plant']} - {mapping[c]['disease']}", "precision": float(p[i]),
                       "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])} for i, c in enumerate(classes)],
        "confusion_matrix": cm.tolist(), "class_distribution": counts,
        "n_images_total": int(len(paths)),
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics_json, indent=2))
    log("saved artifacts to", MODEL_DIR)


if __name__ == "__main__":
    main()
