"""LDD land use 2563 (2020) per tambon + simplified map layer; NSO census by amphoe."""
import json, pandas as pd, geopandas as gpd, shapely
OUT='/home/claude/work/out'; UTM='EPSG:32647'
t=gpd.read_file('/home/claude/src_in/tambon/Tambon/THA_Tambon.shp', encoding='utf-8')
t=t[t.P_NAME_E.str.upper()=='PHUKET'].copy(); t['id']=t.T_NAME_E.str.title().str.lower().str.replace(' ','-')
t=t.dissolve(by='id',as_index=False)[['id','geometry']].to_crs(UTM)
lu=gpd.read_file('/home/claude/src_in/new/lu/LU_PKT_2563.shp').to_crs(UTM)
lu=lu[lu.geometry.notna()&lu.is_valid | lu.geometry.notna()].copy(); lu['geometry']=lu.make_valid()
x=gpd.overlay(lu[['LUL1_CODE','geometry']], t, how='intersection', keep_geom_type=True)
x['km2']=x.area/1e6
tab=x.pivot_table(index='id',columns='LUL1_CODE',values='km2',aggfunc='sum',fill_value=0)
for c in 'UAFWM':
    if c not in tab: tab[c]=0
tab['mapped']=tab[list('UAFWM')].sum(axis=1)
land=tab['mapped']-tab['W']
res=pd.DataFrame({'id':tab.index.values,
  'lu_urban_pct':(tab.U/land*100).round(1),'lu_agri_pct':(tab.A/land*100).round(1),'lu_forest_pct':(tab.F/land*100).round(1),
  'lu_misc_pct':(tab.M/land*100).round(1),'lu_water_km2':tab.W.round(2),
  'developable_pct':((tab.A+tab.M)/land*100).round(1)})
res=res.reset_index(drop=True); print(res.sort_values('developable_pct').to_string())
res.to_csv(OUT+'/landuse_by_tambon.csv',index=False)
# merge into tambons.geojson used by the site
tg=gpd.read_file(OUT+'/tambons.geojson')
tg=tg.drop(columns=[c for c in res.columns if c!='id' and c in tg.columns]).merge(res,on='id')
tg.to_file(OUT+'/tambons.geojson',driver='GeoJSON',COORDINATE_PRECISION=5)
f=pd.read_csv(OUT+'/phuket_tambon_factors.csv',encoding='utf-8-sig')
f=f.drop(columns=[c for c in res.columns if c!='id' and c in f.columns]).merge(res,on='id'); f.to_csv(OUT+'/phuket_tambon_factors.csv',index=False,encoding='utf-8-sig')
# map layer: dissolve by level-2 class to keep it small
names={'U1':('ตัวเมืองและย่านการค้า','City & commercial'),'U2':('หมู่บ้าน/ที่อยู่อาศัย','Villages & housing'),'U3':('สถานที่ราชการ','Institutional'),
 'U4':('คมนาคม','Transport & utility'),'U5':('อุตสาหกรรม','Industrial'),'U6':('รีสอร์ท/โรงแรม/นันทนาการ','Resort, hotel, recreation'),'U7':('สนามกอล์ฟ','Golf course'),
 'A':('เกษตรกรรม','Agriculture'),'F':('ป่าไม้','Forest'),'W':('แหล่งน้ำ','Water'),'M':('เบ็ดเตล็ด (ทุ่งหญ้า เหมืองเก่า พื้นที่ถม)','Miscellaneous (grass, old mines, fill)')}
lu['cls']=lu.apply(lambda r: r.LUL2_CODE if r.LUL1_CODE=='U' else r.LUL1_CODE, axis=1)
d=lu.dissolve(by='cls',as_index=False)[['cls','geometry']]
d['geometry']=d.simplify(25)
d['th']=d.cls.map(lambda c: names.get(c,(c,c))[0]); d['en']=d.cls.map(lambda c: names.get(c,(c,c))[1])
d=d.explode(index_parts=False); d=d[d.area>6000]
d=d.to_crs('EPSG:4326'); d.geometry=shapely.set_precision(d.geometry.values,1e-5)
d.to_file(OUT+'/landuse_2563.geojson',driver='GeoJSON',COORDINATE_PRECISION=5)
import os; print('landuse layer',len(d),os.path.getsize(OUT+'/landuse_2563.geojson')//1024,'KB')
# census by amphoe (NSO, 2533/2543/2553)
c=pd.read_csv('/root/.claude/uploads/d597aeb3-d582-598d-818e-cc8cbd36c52d/9436663d-data_4.csv',encoding='utf-8-sig')
p=c[(c.province=='ภูเก็ต')&(c.sex=='รวม')&(c.area=='รวม')]
cen={'source':'สำนักงานสถิติแห่งชาติ สำมะโนประชากรและเคหะ (data.go.th dataset 0703_01_14)','years':[2533,2543,2553],
     'rows':[{'amphoe':a,'values':[int(p[(p.district==a)&(p.year==y)].value.iloc[0]) for y in (2533,2543,2553)]} for a in ['เมืองภูเก็ต','กะทู้','ถลาง','รวม']]}
json.dump(cen,open(OUT+'/census_amphoe.json','w'),ensure_ascii=False,indent=1); print(cen)
