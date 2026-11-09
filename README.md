# ForestCheck

An open verification platform for forest and tree-planting carbon credit projects.
Given a set of satellite pixel embeddings for a registered project polygon, ForestCheck
classifies each pixel as tree or non-tree, estimates a causal counterfactual baseline,
and issues a machine-auditable verdict against the project's registered claim.

Built for the **PCCOE IGC Hackathon 2026**.

---

## The Problem

Voluntary carbon markets depend on forest projects accurately reporting how much tree
cover they've created or preserved. Auditing today is manual, infrequent, and expensive.
Several high-profile analyses (West et al. 2023, Guardian/Zeit 2023) found that a majority
of REDD+ credits from leading registries like Verra may be over-credited by 90%+.

ForestCheck makes satellite-based verification fast, reproducible, and open.

---

## How Carbon Credit Verification Works

### 1. Pixel Classification

Each project polygon is sampled into a grid of pixels. For each pixel, Google AlphaEarth
produces a 64-dimensional embedding that encodes spectral and spatial features from
multi-temporal satellite imagery — capturing vegetation density, canopy structure, and
land-cover type without exposing raw band values.

Our XGBoost classifier takes these 64-dim vectors and outputs:
- **label**: tree (1) or non-tree (0)
- **probability**: model confidence (0–1)

```
pixel embeddings (A00–A63)  →  XGBoost  →  tree probability per pixel
```

Aggregating predictions across all pixels gives **verified tree coverage (%)**.

### 2. Causal Counterfactual

A project claims credit for trees that exist *because* of the intervention. Without a
counterfactual — what coverage would have been without the project — you cannot measure
additionality.

ForestCheck estimates the counterfactual by splitting pixels into two groups by their
model confidence score:

- **Treatment group** (high confidence / high prob): pixels where the model is sure it
  sees dense tree cover — likely the actively managed/planted areas.
- **Control group** (low confidence / below-median prob): pixels in the same landscape
  with weaker vegetation signal — a proxy for the pre-intervention baseline.

```
counterfactual coverage = tree rate among control-group pixels
additionality           = verified_coverage − counterfactual_coverage
```

This is a simplified **Difference-in-Differences** proxy. A production system would use
matched control polygons from adjacent areas with similar terrain, climate, and soil type.

### 3. Verdict

| Condition | Verdict |
|---|---|
| claimed − verified ≤ 5% | Verified |
| claimed − verified ≤ 20% | Overstated |
| claimed − verified > 20% | Fraudulent |

CO₂e credits are scaled proportionally:
```
verified_co2e = claimed_co2e × (verified_coverage / claimed_coverage)
```

---

## Demo Project: VCS-4541

**Sundari Mangrove Restoration**, Sundarbans, West Bengal, India

- Registered: Verra VCS registry
- Methodology: VM0033 — Tidal Wetland and Seagrass Restoration
- Claimed: 85% coverage · 15,016 tCO₂e/yr · 4,404 ha
- Source embeddings: AlphaEarth vectors sampled from 88–89°E, 21–22°N

The demo dataset (`research/forest2.csv`) contains 1,000 real AlphaEarth pixel embeddings
from the Sundarbans mangrove belt. Running the classifier on this data produces the live
result shown on the Results page — no values are hardcoded.

---

## Model

**Algorithm**: XGBoost binary classifier  
**Training data**: 2,000 pixels — 1,000 Western Ghats (`forest1.csv`) + 1,000 Sundarbans mangroves (`forest2.csv`)  
**Features**: 64 AlphaEarth embedding dimensions (A00–A63)  
**Labels**: 0 = non-tree, 1 = tree (balanced 50/50)

| Metric | Value |
|---|---|
| Test Accuracy | 89.0% |
| Test ROC-AUC | 0.9610 |
| 5-Fold CV ROC-AUC | 0.9651 ± 0.0096 |
| Top feature | A51 (importance 0.0819) |

Model weights are stored in `research/models/tree_classifier.ubj` (native XGBoost format).

Full training details: [`research/results.md`](research/results.md)

---

## Project Structure

```
ForestCheck/
├── backend/
│   ├── main.py           # FastAPI — /demo, /verify, /health
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx      # Landing page with model stats
│       │   ├── Verify.tsx    # CSV upload form
│       │   └── Results.tsx   # Verification report + map
│       └── components/ui/    # shadcn-style components
├── research/
│   ├── forest1.csv           # Western Ghats pixel embeddings
│   ├── forest2.csv           # Sundarbans mangrove embeddings
│   ├── train_classifier.py   # XGBoost training script
│   ├── results.md            # Training run results
│   └── models/
│       ├── tree_classifier.ubj     # XGBoost native weights
│       ├── tree_classifier.joblib  # sklearn-compatible weights
│       └── metadata.json           # Feature list + eval scores
└── models/                   # Runtime copy used by backend
```

---

## Running Locally

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

---

## API

### `GET /demo`
Runs inference on the built-in Sundarbans dataset. No upload required.

### `POST /verify`
Upload your own AlphaEarth embeddings CSV.

| Field | Type | Description |
|---|---|---|
| `file` | CSV | Columns: `system:index`, `A00`–`A63`, `label`, `.geo` |
| `project_id` | string | e.g. `VCS-4541` |
| `claimed_coverage` | float | Project's registered tree coverage % |

**Response includes:**
- `verified_coverage` — model-estimated tree coverage %
- `counterfactual_coverage` — baseline without intervention
- `additionality_verified` — true additionality
- `verdict` — `verified` / `overstated` / `fraudulent`
- `pixel_samples` — lat/lng + label + probability for each sampled pixel (for map rendering)
- `prob_distribution` — histogram of prediction probabilities (10 bins)
- `top_features` — top 5 most discriminative AlphaEarth dimensions

---

## Limitations (Hackathon Scope)

- Counterfactual is a within-polygon proxy, not a matched control region
- Model trained on 2 Indian forest types — generalization to other biomes is untested
- No temporal analysis (before/after change detection) yet
- AlphaEarth embeddings are pre-extracted; real pipeline would call Google Earth Engine
