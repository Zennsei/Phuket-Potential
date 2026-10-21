"""Phuket per-tambon factor preparation. All inputs are real files supplied by the team."""
import os, json, numpy as np, pandas as pd, geopandas as gpd, shapely
from shapely.geometry import Point, box
from shapely import STRtree
U='/root/.claude/uploads/d597aeb3-d582-598d-818e-cc8cbd36c52d'
OUT='/home/claude/work/out'; UTM='EPSG:32647'
# ---------- tambons ----------
t=gpd.read_file('/home/claude/src_in/tambon/Tambon/THA_Tambon.shp', encoding='utf-8')
t=t[t.P_NAME_E.str.upper()=='PHUKET'].copy()
t['amphoe_th']=t.A_NAME_T; t['amphoe_en']=t.A_NAME_E.str.title(); t['tambon_th']=t.T_NAME_T; t['tambon_en']=t.T_NAME_E.str.title()
t=t.dissolve(by=['amphoe_th','amphoe_en','tambon_th','tambon_en'],as_index=False)[['amphoe_th','amphoe_en','tambon_th','tambon_en','geometry']]
t=t.to_crs(UTM); t['area_km2']=t.area/1e6
t['id']=t.tambon_en.str.lower().str.replace(' ','-')
t=t.reset_index(drop=True); print('tambons',len(t), round(t.area_km2.sum(),1))
def assign(points_gdf, max_dist=1500):
    j=gpd.sjoin(points_gdf, t[['geometry']], how='left', predicate='within')
    j=j[~j.index.duplicated()]
    miss=j.index_right.isna()
    if miss.any():
        n=gpd.sjoin_nearest(points_gdf[miss], t[['geometry']], how='left', max_distance=max_dist)
        n=n[~n.index.duplicated()]
        j.loc[miss,'index_right']=n.index_right
    return j.index_right
# ---------- buildings (GISTDA) ----------
bdir='/home/claude/work/bldg'
b=gpd.read_file(bdir+'/'+[f for f in os.listdir(bdir) if f.endswith('.shp')][0]).to_crs(UTM)
b['area_m2']=b.area; b['geometry']=b.centroid
b['ti']=assign(b,3000).values
print('buildings',len(b),'unassigned',b.ti.isna().sum())
# ---------- roads (OSM) ----------
r=gpd.read_file('/home/claude/work/osm_roads.geojson').to_crs(UTM)
MAIN={'primary','secondary','primary_link','secondary_link','trunk','trunk_link','motorway','motorway_link'}
main=r[r.hw.isin(MAIN)]
tree=STRtree(main.geometry.values)
idx=tree.query_nearest(b.geometry.values, return_distance=True)
dist=np.full(len(b),np.nan); dist[idx[0][0]]=idx[1]; b['road_m']=dist
# ---------- POIs (OSM) ----------
p=gpd.read_file('/home/claude/work/osm_pois.geojson').to_crs(UTM)
SERVICE={'education','health','market','retail','finance','public','transport'}
p['ti']=assign(p,500).values
# ---------- population (Kontur, H3 400m) ----------
def kontur(y):
    k=gpd.read_file(f'/home/claude/work/kontur_{y}.gpkg', bbox=(10937000,842000,10965000,919000))  # EPSG:3857 bbox around Phuket
    k=k.to_crs(UTM); c=k.copy(); c['geometry']=k.centroid
    k['ti']=assign(c,800).values
    return k
k23=kontur('20231101'); k22=kontur('20220630')
print('kontur hex 2023',len(k23),'pop in phuket',k23[k23.ti.notna()].population.sum(),'| 2022',k22[k22.ti.notna()].population.sum())
# ---------- land value (Treasury, located by UTM map sheet) ----------
lv=pd.read_csv(U+'/ee32c603-land_83_phuket.csv',encoding='utf-8-sig',dtype=str)
lv['price']=lv.EVAPRICE.astype(float)
n0=len(lv)
lv=lv[(lv.UTMMAP3!='0000')&(lv.price>0)&lv.UTMSCALE.isin(['500','1000','2000','4000'])].copy()
e2=lv.UTMMAP3.str[:2].astype(int); n2=lv.UTMMAP3.str[2:].astype(int)
lv['E0']=(400+e2)*1000.0; lv['N0']=np.where(n2>=50,800+n2,900+n2)*1000.0
div={'4000':1,'2000':2,'1000':4,'500':8}
d=lv.UTMSCALE.map(div).astype(int); sub=lv.UTMMAP4.astype(int); sub=np.where(lv.UTMSCALE=='4000',1,sub)
row=(sub-1)//d; col=(sub-1)%d; size=2000.0/d   # sub-sheets numbered row by row from the north-west corner (tested: best fit to building locations, 94% on land)
lv['x']=lv.E0+(col+0.5)*size; lv['y']=lv.N0+2000-(row+0.5)*size
lv['xc']=lv.E0+1000; lv['yc']=lv.N0+1000                                     # sheet centre (no sub-sheet assumption)
lv['cell']=size
g=gpd.GeoDataFrame(lv,geometry=gpd.points_from_xy(lv.x,lv.y),crs=UTM); g['ti']=assign(g,1500).values
gc=gpd.GeoDataFrame(lv,geometry=gpd.points_from_xy(lv.xc,lv.yc),crs=UTM); gc['ti']=assign(gc,1500).values
print('land rows',n0,'usable',len(lv),'located',g.ti.notna().sum())
# ---------- per-tambon table ----------
rows=[]
for i,tt in t.iterrows():
    bi=b[b.ti==i]; pi=p[p.ti==i]; li=g[g.ti==i]; lc=gc[gc.ti==i]
    pop23=k23[k23.ti==i].population.sum(); pop22=k22[k22.ti==i].population.sum()
    svc=pi[pi.cat.isin(SERVICE)]
    rows.append(dict(id=tt.id,tambon_th=tt.tambon_th,tambon_en=tt.tambon_en,amphoe_th=tt.amphoe_th,amphoe_en=tt.amphoe_en,
      area_km2=round(tt.area_km2,2),
      buildings=int(len(bi)), bldg_per_km2=round(len(bi)/tt.area_km2,1), roof_cover_pct=round(bi.area_m2.sum()/(tt.area_km2*1e6)*100,2),
      large_bldg=int((bi.area_m2>=1000).sum()),
      road_dist_m=round(float(bi.road_m.median()),0), road_main_km=round(float(main.clip(tt.geometry).length.sum()/1000),1),
      services=int(len(svc)), services_per_km2=round(len(svc)/tt.area_km2,2),
      svc_education=int((pi.cat=='education').sum()), svc_health=int((pi.cat=='health').sum()), svc_retail=int(pi.cat.isin(['retail','market']).sum()),
      svc_finance=int((pi.cat=='finance').sum()), lodging=int((pi.cat=='lodging').sum()), food=int((pi.cat=='food').sum()),
      population=int(round(pop23)), pop_per_km2=round(pop23/tt.area_km2,1), population_2022=int(round(pop22)),
      land_parcels=int(len(li)), land_median=float(li.price.median()) if len(li) else None, land_mean=round(float(li.price.mean()),0) if len(li) else None,
      land_median_sheetcentre=float(lc.price.median()) if len(lc) else None))
df=pd.DataFrame(rows).sort_values('bldg_per_km2',ascending=False)
pd.set_option('display.width',250); pd.set_option('display.max_columns',40)
print(df[['tambon_th','area_km2','buildings','bldg_per_km2','road_dist_m','services','population','pop_per_km2','population_2022','land_parcels','land_median','land_median_sheetcentre']])
df.to_csv(OUT+'/phuket_tambon_factors.csv',index=False,encoding='utf-8-sig')
# ---------- map layers (WGS84) ----------
W='EPSG:4326'
def dump(gdf,name,prec=5):
    gdf=gdf.to_crs(W); gdf.geometry=shapely.set_precision(gdf.geometry.values,10**-prec)
    gdf.to_file(OUT+f'/{name}.geojson',driver='GeoJSON',COORDINATE_PRECISION=prec); print(name,len(gdf),os.path.getsize(OUT+f'/{name}.geojson')//1024,'KB')
tt=t.copy(); tt['geometry']=tt.geometry.simplify(25)
tt=tt[['id','geometry']].merge(df,on='id')
dump(tt,'tambons')
island=t.union_all().buffer(300)
mr=r[r.hw.isin(MAIN|{'tertiary','tertiary_link'})].clip(island); mr['geometry']=mr.simplify(8)
dump(mr[['hw','name','ref','geometry']],'roads_main')
ps=p[p.ti.notna()&p.cat.isin(SERVICE|{'lodging','attraction'})]
dump(ps[['cat','kind','name','name_en','geometry']],'pois')
kk=k23[k23.ti.notna()][['h3','population','geometry']].copy(); kk['population']=kk.population.round().astype(int)
kk['density']=(kk.population/(kk.area/1e6)).round().astype(int)
dump(kk,'population_h3')
# land-value grid: median per 1 km cell (sub-sheets of 1 km or smaller, rounded to their 1 km parent)
g1=g[g.ti.notna()].copy(); g1['cx']=(g1.x//1000)*1000; g1['cy']=(g1.y//1000)*1000
agg=g1.groupby(['cx','cy']).price.agg(['median','count']).reset_index()
lg=gpd.GeoDataFrame(agg.rename(columns={'median':'median_price','count':'parcels'}),geometry=[box(x,y,x+1000,y+1000) for x,y in zip(agg.cx,agg.cy)],crs=UTM)
dump(lg[['median_price','parcels','geometry']],'land_value_1km')
json.dump({"generated":"2026-10-21","notes":{
 "buildings":"GISTDA building footprints, Phuket (file 83_ภูเก็ต, dated 2022-06), "+str(len(b))+" polygons",
 "population":"Kontur Population, H3 400 m hexagons, release 2023-11-01 (2022-06-30 kept for comparison)",
 "roads_pois":"OpenStreetMap via Geofabrik extract thailand-261020 (2026-10-20)",
 "land_value":f"Treasury Department appraisal CSV land_83_phuket (data.go.th); {len(lv)} of {n0} parcels located by UTM map-sheet number; 1:5000 sheets and zero prices excluded",
 "boundaries":"THA_Tambon shapefile supplied by team"}},open(OUT+'/sources.json','w'),ensure_ascii=False,indent=1)
