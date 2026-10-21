import os, sys, struct, json, numpy as np, math
src = sys.argv[1]; out = sys.argv[2]
d = os.listdir(src.encode())[0]
base = src.encode()+b'/'+d+b'/'
shp = base+[f for f in os.listdir(base) if f.endswith(b'.shp')][0]
data = open(shp,'rb').read()
pos = 100; cx=[]; cy=[]; area=[]
R = 6378137.0
while pos < len(data):
    rn, clen = struct.unpack('>ii', data[pos:pos+8]); pos += 8
    rec = data[pos:pos+clen*2]; pos += clen*2
    st = struct.unpack('<i', rec[:4])[0]
    if st != 5: continue
    nparts, npts = struct.unpack('<ii', rec[36:44])
    parts = list(struct.unpack('<%di'%nparts, rec[44:44+4*nparts])) + [npts]
    pts = np.frombuffer(rec[44+4*nparts:44+4*nparts+16*npts], dtype='<f8').reshape(-1,2)
    lat0 = pts[:,1].mean(); k = math.cos(math.radians(lat0))
    x = np.radians(pts[:,0])*R*k; y = np.radians(pts[:,1])*R
    a = 0.0
    for i in range(nparts):
        xs, ys = x[parts[i]:parts[i+1]], y[parts[i]:parts[i+1]]
        a += 0.5*(np.dot(xs[:-1], ys[1:]) - np.dot(xs[1:], ys[:-1]))  # signed; shapefile outer rings CW -> negative
    area.append(abs(a)); cx.append(pts[:,0].mean()); cy.append(lat0)
cx=np.array(cx); cy=np.array(cy); area=np.array(area)
print('buildings', len(area), 'total footprint km2', area.sum()/1e6, 'median m2', np.median(area))
# 500 m grid
cell = 500.0
lat_c = 8.0; dlat = cell/111320.0; dlon = cell/(111320.0*math.cos(math.radians(lat_c)))
lon0, lat0 = cx.min(), cy.min()
ix = ((cx-lon0)/dlon).astype(int); iy = ((cy-lat0)/dlat).astype(int)
cells = {}
for i,j,a in zip(ix,iy,area):
    c = cells.setdefault((i,j),[0,0.0,0]); c[0]+=1; c[1]+=a; c[2]+= a>=1000
feats=[]
for (i,j),(n,a,big) in cells.items():
    x0=lon0+i*dlon; y0=lat0+j*dlat
    feats.append({"type":"Feature","properties":{"n":n,"area_m2":round(a),"cover_pct":round(a/(cell*cell)*100,2),"large":int(big)},
      "geometry":{"type":"Polygon","coordinates":[[[round(x0,5),round(y0,5)],[round(x0+dlon,5),round(y0,5)],[round(x0+dlon,5),round(y0+dlat,5)],[round(x0,5),round(y0+dlat,5)],[round(x0,5),round(y0,5)]]]}})
json.dump({"type":"FeatureCollection","properties":{"source":"GISTDA building footprints, Phuket (file 83_ภูเก็ต, dated 2022-06)","cell_m":cell,"buildings":int(len(area))},"features":feats}, open(out,'w'), ensure_ascii=False, separators=(',',':'))
print('cells', len(feats), 'max n', max(f['properties']['n'] for f in feats), 'max cover', max(f['properties']['cover_pct'] for f in feats))
hist = np.histogram(area, bins=[0,50,100,200,500,1000,5000,1e9])[0]; print('size hist', hist.tolist())
