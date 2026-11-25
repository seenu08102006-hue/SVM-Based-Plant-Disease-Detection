# 🌿 AI Plant Doctor: Plant Disease Detection with SVM

Upload a photo of a leaf and the app reports the **crop**, the **disease**, whether the plant is **healthy or diseased**,
the **confidence**, a **description**, **treatment** and **prevention** steps. It also keeps a **history** of scans,
produces downloadable **PDF reports**, and has a **model performance dashboard**.

The model is classical machine learning only (**no CNN or deep learning**): hand-crafted colour, texture and shape
features are fed to a **Support Vector Machine**. Linear, polynomial and RBF kernels are tuned with GridSearchCV and compared.
It covers all **38 classes / 14 crops** of the [PlantVillage dataset](https://github.com/spMohanty/PlantVillage-Dataset).

## Results

Test set: the official leaf-grouped split, 10,709 images the model never saw. Training used 17,228 images (at most 500 per class).

| Kernel | Best params (GridSearchCV) | CV acc. | Test acc. | Precision | Recall | F1 (macro) |
|---|---|---|---|---|---|---|
| **Linear** (deployed) | C = 0.1 | **73.7%** | 86.5% | 82.4% | 85.7% | 83.7% |
| Polynomial (d=3) | C = 1, γ = scale | 72.2% | **88.8%** | 85.1% | 87.5% | **86.0%** |
| RBF | C = 10, γ = scale | 71.5% | 88.2% | 85.1% | 86.8% | 85.7% |

The deployed model is the linear SVM with Platt-calibrated probabilities: **87.5% accuracy, 85.0% macro F1**.
The kernel is chosen by cross-validation score, never by test score. On this run CV picked linear, while the polynomial
kernel did slightly better on the test set. The small 3,000-image grid-search subset favours the simpler model.
To deploy a non-linear kernel, raise `--grid-samples` (slower) and retrain.

Start the app with **`python run.py`**, or open `run.py` in VS Code and press ▶ Run. It starts the backend and the
frontend and opens the site in Chrome.

## Project structure

```
plant-disease-ai/
├── backend/                 FastAPI REST API
│   ├── app/
│   │   ├── main.py          endpoints
│   │   ├── features.py      feature extraction (shared with training)
│   │   ├── model_service.py loads model.pkl / scaler / encoder, runs inference
│   │   ├── database.py      SQLAlchemy: SQLite by default, PostgreSQL via DATABASE_URL
│   │   └── report.py        PDF report (ReportLab)
│   └── requirements.txt
├── frontend/                React + Vite + Tailwind CSS
│   └── src/pages/           Home, Detect, Result, History, Dashboard (model), About
├── training/
│   ├── train_svm.py         full training / comparison pipeline
│   └── disease_knowledge.py descriptions, prevention and treatment for every class
├── model/                   generated: model.pkl, scaler.pkl, label_encoder.pkl,
│                            disease_mapping.json, metrics.json
└── dataset/                 PlantVillage images + official leaf-grouped split files
```

## Quick start

Requirements: Python 3.10+ and Node 18+.

```bash
# 1. Dataset: clone PlantVillage next to this folder, or into dataset/ (see dataset/README.md)
git clone --depth 1 https://github.com/spMohanty/PlantVillage-Dataset.git ../PlantVillage-Dataset

# 2. Python deps
pip install -r backend/requirements.txt

# 3. Train (feature extraction ~4 min on 12 cores; the whole run takes about 20-30 min)
python training/train_svm.py
#    options: --train-per-class 500 --grid-samples 3000 --jobs N --dataset PATH --recompute-features
python training/build_ood.py      # "not recognised" detector, ~1 min

# 4. API  ->  http://localhost:8000/docs
cd backend
uvicorn app.main:app --port 8000

# 5. Web app  ->  http://localhost:5173
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `localhost:8000`. For a production build, set `VITE_API_URL` to the API origin
and add the site's origin to `CORS_ORIGINS` on the backend.

## Machine-learning pipeline

1. **Classes** are discovered from `raw/color/<Crop>___<Disease>/` folder names; nothing is hard-coded.
2. **Split**: the official *leaf-grouped* 80/20 split (43,596 train / 10,709 test). PlantVillage has several photos per
   physical leaf, so a random split would leak near-duplicates and inflate accuracy.
3. **Features** (every image is resized to 256×256): 1,982 dimensions in total

   | Group | Details | Dims |
   |---|---|---|
   | RGB histogram | 32 bins × R, G, B, L1-normalised | 96 |
   | HSV histogram | 32 bins × H, S, V | 96 |
   | GLCM / Haralick | 32 grey levels, distance 1, angles 0°/45°/90°/135°; 13 Haralick features, mean + range over angles | 26 |
   | HOG | 9 orientations, 32×32 cells, 2×2 blocks, L2-Hys | 1,764 |

4. **Scaling**: `StandardScaler`. **Labels**: `LabelEncoder`.
5. **GridSearchCV** (3-fold stratified CV) per kernel: `C ∈ {0.1, 1, 10, 100}`, `γ ∈ {scale, auto, 0.001, 0.01}`
   (polynomial: degree 3, coef0 1). The search runs on a stratified 3,000-image subset.
6. Each kernel's best configuration is refit on the training set (capped at 500 images per class to balance classes
   and keep SVM training time reasonable), then scored on the **full** test set: accuracy, macro and weighted
   precision / recall / F1, and the confusion matrix.
7. The kernel with the best **cross-validation** score is selected, so the test set is never used for model selection.
   It is refit with Platt-scaled probabilities (`probability=True`) for confidence scores and saved to `model/`.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/predict` | multipart `file`. Returns plant, disease, status, confidence, description, prevention, treatment, top-3 |
| `GET` | `/history?limit=&offset=` | past predictions, newest first |
| `GET` / `DELETE` | `/history/{id}` | one prediction / delete it (and its image) |
| `GET` | `/report/{id}` | PDF report |
| `GET` | `/metrics` | training metrics (kernel comparison, grid search, confusion matrix, class distribution) |
| `GET` | `/classes` | supported crops and diseases |
| `GET` | `/health` | status and whether the model is loaded |

Example `/predict` response:

```json
{
  "id": "4b1f…", "plant": "Tomato", "disease": "Early blight", "status": "Diseased",
  "confidence": "96.5%", "confidence_value": 96.5,
  "description": "Fungal disease (Alternaria solani) with brown concentric 'bull's-eye' spots…",
  "prevention": ["Rotate crops", "Mulch to prevent soil splash", "…"],
  "treatment": ["Apply chlorothalonil, mancozeb or copper fungicide every 7-10 days", "…"],
  "top_predictions": [{"plant": "Tomato", "disease": "Early blight", "confidence": 96.5}, "…"],
  "image_url": "/uploads/4b1f….jpg", "report_url": "/report/4b1f…", "low_confidence": false
}
```

## Database

History is stored through SQLAlchemy. It defaults to SQLite at `backend/data/history.db`, so there is nothing to install.
To use **PostgreSQL**:

```bash
pip install "psycopg[binary]"
set DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/plantdoctor   # PowerShell: $env:DATABASE_URL="…"
```

The table is created automatically on startup. Uploaded images are re-encoded as JPEG into `backend/uploads/`.

## Avoiding wrong names

An SVM always answers with one of the 38 classes it was trained on, even for a rose or a busy field photo.
Three safeguards stop the app from presenting a guess as fact:

1. **Crop selection.** On the Detect page the user picks the plant (or "Other / not listed"). The SVM then chooses only among
   that crop's diseases, so the plant name is always right. Test-set accuracy rises from 87.5% to **93.7%** with the crop
   selected. "Other / not listed" explains that the plant is not supported instead of guessing. A wrong scan can be
   re-checked with a different crop from the result page (`POST /history/{id}/recheck`).
2. **"Not sure"** below 70% confidence. On the test set, predictions at or above 70% are 96.8% correct; below it, only 64%.
3. **"Not recognised"** when the image is far from every training image of the predicted class
   (`training/build_ood.py`: PCA plus k-nearest-neighbour distance with a per-class 99th-percentile threshold).

Run `python training/build_ood.py` after every retraining. It takes about a minute.

## Limitations

- PlantVillage photos are lab-style: one leaf on a plain background. Field photos with soil, hands or several leaves will score lower.
- Plants outside the 14 crops cannot be named. Hand-crafted features cannot reliably tell, for example, a spotted rose leaf
  from a spotted corn leaf, which is why the crop selector exists.
- Treatment advice is general guidance. Check local regulations and an agronomist before applying chemicals.

## Citation

Mohanty, S. P., Hughes, D. P., & Salathé, M. (2016). *Using Deep Learning for Image-Based Plant Disease Detection.*
Frontiers in Plant Science, 7, 1419. https://doi.org/10.3389/fpls.2016.01419
