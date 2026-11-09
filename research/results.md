# XGBoost Tree Classifier — Training Results

**Date:** 2026-11-10  
**Task:** Binary classification — tree vs. non-tree pixel using AlphaEarth 64-dim embeddings

---

## Dataset

| Property | Value |
|---|---|
| Sources | Western Ghats (`forest1.csv`) + Mangroves (`forest2.csv`) |
| Total samples | 2000 |
| Label 0 (non-tree) | 1000 |
| Label 1 (tree) | 1000 |
| Train / Test split | 1600 / 400 (80/20, stratified) |
| Features | A00–A63 (64 AlphaEarth embedding dimensions) |

---

## Model

**Algorithm:** XGBoost (`XGBClassifier`)

| Hyperparameter | Value |
|---|---|
| n_estimators | 300 |
| max_depth | 6 |
| learning_rate | 0.05 |
| subsample | 0.8 |
| colsample_bytree | 0.8 |
| min_child_weight | 3 |
| gamma | 0.1 |
| reg_alpha | 0.1 |
| reg_lambda | 1.0 |

---

## Training Loss (validation logloss)

| Iteration | Logloss |
|---|---|
| 0 | 0.66725 |
| 50 | 0.28460 |
| 100 | 0.24834 |
| 150 | 0.24658 |
| 200 | 0.25055 |
| 250 | 0.25678 |
| 299 | 0.26013 |

> Best validation logloss achieved around iteration 150. Model slightly overfits beyond that — consider adding early stopping in future runs.

---

## Evaluation Metrics (Test Set)

| Metric | non-tree | tree | weighted avg |
|---|---|---|---|
| Precision | 0.91 | 0.87 | 0.89 |
| Recall | 0.86 | 0.92 | 0.89 |
| F1-score | 0.89 | 0.89 | 0.89 |
| **Accuracy** | | | **0.89** |

**ROC-AUC (test):** 0.9610  
**5-Fold CV ROC-AUC:** 0.9651 ± 0.0096

### Confusion Matrix

|  | Predicted non-tree | Predicted tree |
|---|---|---|
| **Actual non-tree** | 173 | 27 |
| **Actual tree** | 17 | 183 |

---

## Top 10 Feature Importances

| Rank | Feature | Importance |
|---|---|---|
| 1 | A51 | 0.0819 |
| 2 | A43 | 0.0625 |
| 3 | A40 | 0.0497 |
| 4 | A45 | 0.0389 |
| 5 | A22 | 0.0363 |
| 6 | A48 | 0.0358 |
| 7 | A15 | 0.0345 |
| 8 | A32 | 0.0267 |
| 9 | A06 | 0.0251 |
| 10 | A04 | 0.0226 |

---

## Saved Artifacts

| File | Description |
|---|---|
| `models/tree_classifier.ubj` | Native XGBoost format — use for inference |
| `models/tree_classifier.joblib` | Sklearn-compatible pickle |
| `models/metadata.json` | Feature list, scores, class mapping |

---

## Notes

- Validation logloss bottoms out at ~iter 150; add `early_stopping_rounds=20` to prevent overfitting in production
- Top features (A51, A43, A40) likely correspond to NIR/SWIR spectral bands — consistent with vegetation detection
- Model generalises well (CV std of 0.0096 is very tight across folds)
