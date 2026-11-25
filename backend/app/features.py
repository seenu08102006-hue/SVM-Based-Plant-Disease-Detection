"""Hand-crafted feature extraction (no deep learning).

Feature vector layout (1982 dims):
  RGB histogram   3 x 32          =   96
  HSV histogram   3 x 32          =   96
  Haralick (GLCM) 13 x (mean,rng) =   26
  HOG             7 x 7 x 2x2 x 9 = 1764
The same function is used by training and by the API, so features always match.
"""
from __future__ import annotations

import cv2
import numpy as np
from skimage.feature import graycomatrix, hog

IMG_SIZE = 256
HIST_BINS = 32
GLCM_LEVELS = 32
EPS = 1e-12

HARALICK_NAMES = [
    "angular_second_moment", "contrast", "correlation", "variance", "inverse_diff_moment",
    "sum_average", "sum_variance", "sum_entropy", "entropy", "diff_variance",
    "diff_entropy", "info_measure_corr_1", "info_measure_corr_2",
]


def _norm_hist(channel: np.ndarray, rng: tuple[int, int]) -> np.ndarray:
    h = cv2.calcHist([channel], [0], None, [HIST_BINS], list(rng)).ravel()
    return h / (h.sum() + EPS)


def color_features(bgr: np.ndarray) -> np.ndarray:
    """Per-channel normalised RGB and HSV histograms."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    feats = [_norm_hist(bgr[..., c], (0, 256)) for c in (2, 1, 0)]  # R, G, B
    feats += [_norm_hist(hsv[..., 0], (0, 180)), _norm_hist(hsv[..., 1], (0, 256)),
              _norm_hist(hsv[..., 2], (0, 256))]
    return np.concatenate(feats)


def _haralick_from_glcm(p: np.ndarray) -> np.ndarray:
    """13 Haralick features from one normalised, symmetric GLCM (Ng x Ng)."""
    n = p.shape[0]
    i, j = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    px, py = p.sum(1), p.sum(0)
    idx = np.arange(n)
    mux, muy = (idx * px).sum(), (idx * py).sum()
    sx = np.sqrt(((idx - mux) ** 2 * px).sum()) + EPS
    sy = np.sqrt(((idx - muy) ** 2 * py).sum()) + EPS

    # p_{x+y}(k), k = 0..2n-2   and   p_{x-y}(k), k = 0..n-1
    p_sum = np.bincount((i + j).ravel(), weights=p.ravel(), minlength=2 * n - 1)
    p_dif = np.bincount(np.abs(i - j).ravel(), weights=p.ravel(), minlength=n)
    k_sum, k_dif = np.arange(2 * n - 1), np.arange(n)

    ent = lambda v: -(v * np.log2(v + EPS)).sum()  # noqa: E731
    f1 = (p ** 2).sum()
    f2 = (((i - j) ** 2) * p).sum()
    f3 = ((i * j * p).sum() - mux * muy) / (sx * sy)
    f4 = (((i - mux) ** 2) * p).sum()
    f5 = (p / (1.0 + (i - j) ** 2)).sum()
    f6 = (k_sum * p_sum).sum()
    f8 = ent(p_sum)
    f7 = (((k_sum - f6) ** 2) * p_sum).sum()
    f9 = ent(p)
    f10 = (((k_dif - (k_dif * p_dif).sum()) ** 2) * p_dif).sum()
    f11 = ent(p_dif)
    hx, hy = ent(px), ent(py)
    pxpy = np.outer(px, py)
    hxy1 = -(p * np.log2(pxpy + EPS)).sum()
    hxy2 = -(pxpy * np.log2(pxpy + EPS)).sum()
    f12 = (f9 - hxy1) / (max(hx, hy) + EPS)
    f13 = np.sqrt(max(0.0, 1.0 - np.exp(-2.0 * (hxy2 - f9))))
    return np.array([f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13])


def texture_features(gray: np.ndarray) -> np.ndarray:
    """GLCM (4 angles, distance 1) -> 13 Haralick features -> mean and range over angles."""
    q = (gray.astype(np.uint16) * GLCM_LEVELS // 256).astype(np.uint8)
    glcm = graycomatrix(q, distances=[1], angles=[0, np.pi / 4, np.pi / 2, 3 * np.pi / 4],
                        levels=GLCM_LEVELS, symmetric=True, normed=True)
    per_angle = np.stack([_haralick_from_glcm(glcm[:, :, 0, a]) for a in range(glcm.shape[3])])
    return np.concatenate([per_angle.mean(0), per_angle.max(0) - per_angle.min(0)])


def shape_features(gray: np.ndarray) -> np.ndarray:
    """Histogram of Oriented Gradients."""
    return hog(gray, orientations=9, pixels_per_cell=(32, 32), cells_per_block=(2, 2),
               block_norm="L2-Hys", feature_vector=True)


def extract_features(bgr: np.ndarray) -> np.ndarray:
    """BGR uint8 image of any size -> 1-D float32 feature vector."""
    img = cv2.resize(bgr, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return np.concatenate([color_features(img), texture_features(gray), shape_features(gray)]).astype(np.float32)


def extract_from_path(path: str) -> np.ndarray | None:
    data = np.fromfile(path, dtype=np.uint8)  # robust to non-ASCII paths on Windows
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    return None if img is None else extract_features(img)


def feature_groups() -> dict[str, tuple[int, int]]:
    """Index ranges of each feature family inside the vector."""
    return {"rgb_hist": (0, 96), "hsv_hist": (96, 192), "haralick": (192, 218), "hog": (218, 1982)}
