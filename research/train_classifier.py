import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.preprocessing import LabelEncoder
import joblib
import json
import os

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(DATA_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [f"A{i:02d}" for i in range(64)]

def load_data():
    df1 = pd.read_csv(os.path.join(DATA_DIR, "./forest1.csv"))  # Western Ghats
    df2 = pd.read_csv(os.path.join(DATA_DIR, "./forest2.csv"))       # Mangroves
    df1["source"] = "western_ghats"
    df2["source"] = "mangroves"
    df = pd.concat([df1, df2], ignore_index=True)
    print(f"Combined dataset: {len(df)} rows")
    print(f"Label distribution:\n{df['label'].value_counts()}")
    return df

def train():
    df = load_data()

    X = df[FEATURE_COLS].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\nTrain: {len(X_train)}, Test: {len(X_test)}")

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    # --- Evaluation ---
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print("\n=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=["non-tree", "tree"]))

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    auc = roc_auc_score(y_test, y_prob)
    print(f"ROC-AUC: {auc:.4f}")

    # 5-fold CV on full data
    cv_scores = cross_val_score(model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42), scoring="roc_auc")
    print(f"5-Fold CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # --- Feature importance (top 10) ---
    importances = model.feature_importances_
    top10 = sorted(zip(FEATURE_COLS, importances), key=lambda x: -x[1])[:10]
    print("\nTop 10 features:")
    for feat, imp in top10:
        print(f"  {feat}: {imp:.4f}")

    # --- Save weights ---
    # Native XGBoost format (portable, version-safe)
    native_path = os.path.join(MODEL_DIR, "tree_classifier.ubj")
    model.save_model(native_path)
    print(f"\nModel saved (native): {native_path}")

    # Joblib for sklearn-compatible loading
    joblib_path = os.path.join(MODEL_DIR, "tree_classifier.joblib")
    joblib.dump(model, joblib_path)
    print(f"Model saved (joblib): {joblib_path}")

    # Save metadata alongside weights
    meta = {
        "features": FEATURE_COLS,
        "n_features": len(FEATURE_COLS),
        "classes": {0: "non-tree", 1: "tree"},
        "sources": ["western_ghats", "mangroves"],
        "test_roc_auc": round(auc, 4),
        "cv_roc_auc_mean": round(float(cv_scores.mean()), 4),
        "cv_roc_auc_std": round(float(cv_scores.std()), 4),
        "xgboost_version": "3.4.1",
    }
    with open(os.path.join(MODEL_DIR, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Metadata saved: {os.path.join(MODEL_DIR, 'metadata.json')}")

    return model

if __name__ == "__main__":
    train()
