"""Placeholder (dummy) market land price per 1 km cell, for the map only.

The team asked (27 Oct 2569) to show a market price instead of the Treasury appraisal, but no real market price
data is available yet. Until it is, the map shows this placeholder so the layer can be designed and presented:
    price = Treasury appraisal median of the cell (public/data/land_value_1km.geojson) x 2, rounded to 500 THB
The factor 2 is an assumption, not a measured ratio. Every place that shows this layer must say it is simulated
data (AGENTS.md rule 11). The value is not used in any score.

Usage:  python data-prep/market_dummy.py      ->  public/data/market_dummy_1km.geojson
Python standard library only.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTOR = 2

src = json.load(open(os.path.join(ROOT, "public/data/land_value_1km.geojson"), encoding="utf-8"))
out = {"type": "FeatureCollection", "features": []}
for f in src["features"]:
    p = f["properties"]
    out["features"].append({"type": "Feature", "geometry": f["geometry"],
                            "properties": {"price": round(p["median_price"] * FACTOR / 500) * 500, "dummy": 1}})
with open(os.path.join(ROOT, "public/data/market_dummy_1km.geojson"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print(len(out["features"]), "cells, price x", FACTOR)
