import io
import json
import os
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from xgboost import XGBClassifier

app = FastAPI(title="ForestCheck API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
RESEARCH_DIR = os.path.join(ROOT, "research")
MODEL_PATH = os.path.join(RESEARCH_DIR, "models", "tree_classifier.ubj")
FEATURE_COLS = [f"A{i:02d}" for i in range(64)]

model = XGBClassifier()
model.load_model(MODEL_PATH)

with open(os.path.join(RESEARCH_DIR, "models", "metadata.json")) as f:
    MODEL_META = json.load(f)

PROJECT_META = {
    "VCS-4541": {
        "project_name": "Sundari Mangrove Restoration",
        "location": "Sundarbans, West Bengal, India",
        "registry": "Verra VCS",
        "area_ha": 4404,
        "methodology": "VM0033 — Tidal Wetland & Seagrass",
        "coordinates": {"lat": 21.92, "lng": 88.9},
        "claimed_co2e": 15016,
        "claimed_coverage": 85.0,
    },
    "VCS-1234": {
        "project_name": "Western Ghats Reforestation",
        "location": "Maharashtra, India",
        "registry": "Verra VCS",
        "area_ha": 2800,
        "methodology": "VM0047 — Afforestation, Reforestation & Revegetation",
        "coordinates": {"lat": 19.1, "lng": 73.2},
        "claimed_co2e": 9500,
        "claimed_coverage": 80.0,
    },
}


def parse_geo(geo_str: str) -> tuple[float, float] | None:
    """Extract lat/lng from GEE .geo JSON string."""
    try:
        geo = json.loads(geo_str)
        lng, lat = geo["coordinates"]
        return round(lat, 6), round(lng, 6)
    except Exception:
        return None


def compute_counterfactual(probs: np.ndarray) -> float:
    """
    Counterfactual: tree rate among lower-probability half of pixels,
    representing 'business as usual' baseline without intervention.
    """
    median = float(np.median(probs))
    control_mask = probs < median
    if control_mask.sum() == 0:
        return 0.0
    return round(float((probs[control_mask] > 0.5).mean()) * 100, 1)


def run_inference(df: pd.DataFrame, project_id: str, claimed_coverage: float) -> dict:
    X = df[FEATURE_COLS].values
    preds = model.predict(X)
    probs = model.predict_proba(X)[:, 1]

    tree_pixels = int(preds.sum())
    total_pixels = len(preds)
    verified_coverage = round(tree_pixels / total_pixels * 100, 1)
    confidence = round(float(probs.mean()), 3)

    counterfactual = compute_counterfactual(probs)
    additionality_verified = round(verified_coverage - counterfactual, 1)
    additionality_claimed = round(claimed_coverage - counterfactual, 1)

    # Pixel-level samples for map (up to 300 points, stratified)
    pixel_samples = []
    if ".geo" in df.columns:
        tree_idx = np.where(preds == 1)[0]
        non_tree_idx = np.where(preds == 0)[0]
        rng = np.random.default_rng(42)
        sample_tree = rng.choice(tree_idx, size=min(150, len(tree_idx)), replace=False)
        sample_non = rng.choice(non_tree_idx, size=min(150, len(non_tree_idx)), replace=False)
        for idx in np.concatenate([sample_tree, sample_non]):
            coords = parse_geo(df.iloc[idx][".geo"])
            if coords:
                lat, lng = coords
                pixel_samples.append({
                    "lat": lat,
                    "lng": lng,
                    "label": int(preds[idx]),
                    "prob": round(float(probs[idx]), 3),
                })

    # Probability distribution (10 bins)
    counts, edges = np.histogram(probs, bins=10, range=(0, 1))
    prob_distribution = [
        {"bin": round(float(edges[i]), 1), "count": int(counts[i])}
        for i in range(len(counts))
    ]

    # Top 5 features by importance
    top_features = sorted(
        zip(MODEL_META["features"], model.feature_importances_),
        key=lambda x: -x[1],
    )[:5]

    meta = PROJECT_META.get(project_id.upper(), {
        "project_name": project_id,
        "location": "Unknown",
        "registry": "Unknown",
        "area_ha": 0,
        "methodology": "Unknown",
        "coordinates": {"lat": 20.5, "lng": 78.9},
        "claimed_co2e": 0,
        "claimed_coverage": claimed_coverage,
    })

    verified_co2e = round(meta["claimed_co2e"] * (verified_coverage / claimed_coverage)) if claimed_coverage > 0 else 0

    delta = claimed_coverage - verified_coverage
    if delta <= 5:
        verdict, verdict_label = "verified", "Verified"
    elif delta <= 20:
        verdict, verdict_label = "overstated", "Overstated"
    else:
        verdict, verdict_label = "fraudulent", "Fraudulent"

    return {
        **meta,
        "project_id": project_id.upper(),
        "claimed_coverage": claimed_coverage,
        "verified_coverage": verified_coverage,
        "counterfactual_coverage": counterfactual,
        "additionality_claimed": additionality_claimed,
        "additionality_verified": additionality_verified,
        "claimed_co2e": meta["claimed_co2e"],
        "verified_co2e": verified_co2e,
        "total_pixels": total_pixels,
        "tree_pixels": tree_pixels,
        "non_tree_pixels": total_pixels - tree_pixels,
        "confidence": confidence,
        "verdict": verdict,
        "verdict_label": verdict_label,
        "top_features": [{"name": n, "importance": round(float(i), 4)} for n, i in top_features],
        "pixel_samples": pixel_samples,
        "prob_distribution": prob_distribution,
    }


@app.get("/demo")
def demo():
    """Run inference on the built-in Sundarbans dataset (forest2.csv)."""
    csv_path = os.path.join(RESEARCH_DIR, "forest2.csv")
    df = pd.read_csv(csv_path)
    return run_inference(df, "VCS-4541", claimed_coverage=85.0)


@app.post("/verify")
async def verify(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    claimed_coverage: float = Form(85.0),
):
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        raise HTTPException(400, f"CSV missing columns: {missing[:5]}…")

    return run_inference(df, project_id, claimed_coverage)


@app.get("/health")
def health():
    return {"status": "ok", "model": "tree_classifier.ubj"}
