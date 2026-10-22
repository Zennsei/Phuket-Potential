"""Overture buildings for Phuket (D9 in DATA.md). Not used by the website.

Reads the public GeoParquet files on S3 directly (the overturemaps CLI needs the STAC host, which may be blocked).
Usage: python overture_buildings.py [release]   (default 2026-09-23.1)
Output: phuket_buildings_overture.parquet
Needs: pyarrow
"""
import sys, time, pyarrow.dataset as ds, pyarrow.fs as fs, pyarrow.parquet as pq
REL = sys.argv[1] if len(sys.argv) > 1 else "2026-09-23.1"
W, S, E, N = 98.255, 7.745, 98.485, 8.205
import os, urllib.parse
proxy = urllib.parse.urlparse(os.environ.get("HTTPS_PROXY", ""))
opts = {"proxy_options": {"scheme": "http", "host": proxy.hostname, "port": proxy.port}} if proxy.hostname else {}
s3 = fs.S3FileSystem(anonymous=True, region="us-west-2", **opts)
path = f"overturemaps-us-west-2/release/{REL}/theme=buildings/type=building/"
t = time.time()
d = ds.dataset(path, filesystem=s3, format="parquet")
print("files", len(d.files), round(time.time() - t, 1), "s")
flt = (ds.field("bbox", "xmin") < E) & (ds.field("bbox", "xmax") > W) & (ds.field("bbox", "ymin") < N) & (ds.field("bbox", "ymax") > S)
cols = [c for c in ["id", "geometry", "bbox", "height", "num_floors", "class", "subtype", "sources", "has_parts"] if c in d.schema.names]
tbl = d.to_table(columns=cols, filter=flt)
print("rows", tbl.num_rows, round(time.time() - t, 1), "s")
pq.write_table(tbl, "phuket_buildings_overture.parquet")
