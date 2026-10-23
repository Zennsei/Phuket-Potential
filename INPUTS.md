# ไฟล์ต้นทาง (raw data) ของโปรเจกต์

ไฟล์ต้นทางทั้งหมดเก็บอยู่ในโฟลเดอร์ `raw-data/` บนเครื่องของทีม **ไม่ถูก commit** (อยู่ใน `.gitignore`) เพราะ:
- ไฟล์ใหญ่ (OSM 330 MB, Kontur 170 MB) และ GitHub รับไฟล์ไม่เกิน 100 MB
- บางไฟล์ห้ามเผยแพร่ เช่น ภาพจาก GISTDA API (Copyrighted, Fees: Yes) และไฟล์ที่ได้จากการยื่นคำร้อง

ไฟล์นี้บอกว่าแต่ละไฟล์คืออะไร มาจากไหน ใช้กับสคริปต์ไหน และเผยแพร่ได้ไหม รหัส D1–D17 ตรงกับ `DATA.md`
รายงานฉบับเต็มของโปรเจกต์อยู่ที่ `PROJECT_REPORT.md`

อัปเดต: 24 ต.ค. 2569

## วิธีใช้ `raw-data/`

1. ดับเบิลคลิก `raw-data/join_parts.bat` หนึ่งครั้ง ไฟล์ที่ถูกแบ่งเป็น `.part01`, `.part02`… จะถูกต่อกลับเป็นไฟล์เดิม (ต่อเสร็จแล้วลบไฟล์ part ได้)
2. ไฟล์ 3 ไฟล์ที่ทีมส่งมาแต่แรก ตรวจกับ `SHA256.txt` ได้ (PowerShell: `Get-FileHash 12_thailand-261020_osm.pbf`)
3. แตก zip ที่ต้องใช้ แล้วส่ง path ให้สคริปต์ใน `data-prep/` (ลำดับการรันใน `PROJECT_REPORT.md` หัวข้อ 13)

## ไฟล์ใน `raw-data/` (ส่งจากเครื่องทำงานของ Claude เมื่อ 24 ต.ค. 2569)

| ไฟล์ | เนื้อหา | ข้อมูล | ใช้กับ | เผยแพร่ได้ไหม |
|---|---|---|---|---|
| `01_team_files_oct23-24.zip` | `dopa/stat_t52, t59, t63, t65, t68.txt`, `stat_67.zip` | D15 ทะเบียนราษฎร์รายตำบล | `dopa_prep.py` | ได้ (ข้อมูลเปิด กรมการปกครอง) |
| 〃 | `dpt/tp_reg.csv`, `tp_reg.xlsx`, `datadict_tp_reg.xlsx` | D11 ทะเบียนประกาศผังเมือง | อ่านอ้างอิง | ได้ (opendata.dpt.go.th) |
| 〃 | `misc/data_4.csv` | D8 สำมะโนรายอำเภอ | `landuse_prep.py` | ได้ (data.go.th) |
| 〃 | `misc/dmcr.pdf` | ประกาศเขตคุ้มครองสิ่งแวดล้อมภูเก็ต 2567 | เกณฑ์ใน `terrain_prep.py` | เอกสารราชการ |
| 〃 | `gistda_api/gistda_buildings_2567_phuket.csv.gz` (+ ไฟล์ตัวอย่าง 1,000 หลังและ progress 2 ไฟล์) | D13 อาคาร 2567 พร้อมความสูง 239,992 หลัง | `gistda_height_prep.py`, `check_heights.py` | ไม่เผยแพร่ไฟล์ดิบ (ข้อมูล GISTDA ผ่าน key ทีม) |
| 〃 | `gistda_api/gistda_api_probe.txt`, `gistda_api_probe2.txt`, `probe3_report.txt`, `gistda_api_list.txt` | ผลทดสอบ API 3 รอบ (ลบ key แล้ว) + รายการ API | อ้างอิง | ภายในทีม |
| 〃 | `probe3_images/` 20 ภาพ | ภาพตัวอย่าง GISTDA (ภาพรายปี, GI Basemap, Landtrendr, Hillshade, เมืองเก่า) | ประเมินคุณภาพ | **ห้ามเผยแพร่** (ลิขสิทธิ์ GISTDA) |
| 〃 | `screenshots_sent_to_claude/` | ภาพหน้าจอที่ทีมส่งในแชต | อ้างอิง | ภายในทีม |
| `02_ldd_landuse_2563.zip` | `LU_PKT_2563.shp`, `LUCODE.xls`, คำอธิบาย .doc, สรุป .xlsx, ขอบเขตการปกครองของ LDD | D2 การใช้ที่ดิน 2563 | `landuse_prep.py`, `terrain_prep.py` | ต้องให้เครดิตกรมพัฒนาที่ดิน |
| `03_gistda_buildings_2565_83_phuket.zip` | `83_ภูเก็ต/ภูเก็ต.shp` (ชื่อไฟล์ TIS-620 ให้คัดลอกเป็นชื่ออังกฤษก่อนใช้) | D1 อาคาร GISTDA 2565 130,403 หลัง | `bldg_grid.py`, `data_prep.py`, `travel_prep.py` | ตรวจเงื่อนไขก่อน (ได้ผ่านเว็บที่สาม) |
| `04_lovable_prototypes.zip` | `thai-growth-atlas-main`, `landscore-analyzer-main` | prototype เดิม (ข้อมูลจำลอง) | ไม่ใช้ | ภายในทีม |
| `05_intermediate_outputs.zip` | `osm_extract/osm_roads.geojson`, `osm_pois.geojson`, ผล `data_prep.py` รุ่น v1 และ v3, `phuket-data-check.html` | ผลระหว่างทาง | `travel_prep.py` อ่าน `osm_roads/pois` | ODbL (มี OSM) |
| `06_overture_buildings_2026-09-23.zip` | `phuket_buildings_overture.parquet` | D9 Overture 219,565 หลัง | `check_heights.py` | ODbL |
| `07_copernicus_dem_glo30.zip` | `cop_N07_00_E098_00.tif`, `cop_N08_00_E098_00.tif` | D17 DEM 30 ม. | `terrain_prep.py` | ได้ พร้อมเครดิต DLR/Airbus/ESA |
| `08_kontur_population_2566.zip` | `kontur_population_TH_20231101.gpkg` | D5 ประชากร (ใช้) | `data_prep.py` | CC BY 4.0 (Kontur) |
| `09_kontur_population_2565.zip` | `kontur_population_TH_20220630.gpkg` | D5 ชุดเทียบ | `data_prep.py` | CC BY 4.0 |
| `10_Tambon.zip` | `THA_Tambon.shp` ทั้งประเทศ | D4 ขอบเขตตำบล | `data_prep.py` | ไม่ทราบต้นทาง |
| `11_shapefile_Thailand.zip` | .rar 3 ไฟล์ (Province, Amphoe, Tambon) | ไม่ได้ใช้ | — | — |
| `12_thailand-261020_osm.pbf` | OpenStreetMap ประเทศไทย 20 ต.ค. 2569 | D6 | `osm_extract.py` | ODbL |
| `join_parts.bat`, `SHA256.txt` | ตัวต่อไฟล์ + ค่าตรวจสอบ | — | — | — |

**ไม่ได้ใส่ใน `raw-data/` โดยตั้งใจ:** `gistda_sample.json` (มี key เก่าอยู่ใน `links` ควรลบออกจากโฟลเดอร์โปรเจกต์)

## ไฟล์ที่ทีมต้องคัดลอกเข้า `raw-data/` เอง

ไฟล์เหล่านี้ทีมส่งในวันแรก (21–22 ต.ค.) และไม่อยู่ในเครื่องทำงานของ Claude แล้ว

| ไฟล์ | ข้อมูล | ใช้กับ |
|---|---|---|
| `land_83_phuket.csv` (และ `land_83_phuket_3.csv` ซึ่งเหมือนกันทุกไบต์) | D7 ราคาประเมิน 215,944 แปลง | `data_prep.py` |
| `details.md` | กติกาและเกณฑ์การแข่งขัน | อ้างอิง |
| `README.md` (prompt Lovable) | สเปกเว็บเดิม | อ้างอิง |
| `city_plan-Thailand.json` | D12 แบบสำรวจรายชุมชน | ยังไม่ใช้ |
| `LOD1-Thailand.json` | สารบัญ 3D Tiles | ไม่ใช้ |
| `phuket_population.pdf` | D10 รายงานสถิติจังหวัด | อ้างอิง |
| `Landuse_pkt.zip`, `LUCODE.zip` (และไฟล์ซ้ำจาก dinonline) | D2 (มีใน `02_…` แล้ว) | — |
| `data.csv`, `data_1.csv`, `data_2.csv`, `data_3.csv` | ข้อมูลระดับภาค (ไม่ใช้) | — |
| `soilonline_LU_LV3.pdf`, `urbanplan_law.pdf`, ภาพหน้าจอแผนที่ DPT | อ้างอิงปีข้อมูล LDD และผังเมือง | — |
| `tha_admin_boundaries` (HDX) | สำรอง ไม่ใช้ | — |

## ข้อมูลที่ยังรอ

| ข้อมูล | สถานะ | ใส่ที่ |
|---|---|---|
| D14 การใช้ที่ดิน LDD ปี 2552 และ 2559 | ยื่นคำร้องที่ dinonline 22 ต.ค. 2569 ยังไม่ได้รับ (24 ต.ค.) | `raw-data/ldd_landuse_2552_2559/` |
| D16 ผังเมืองรวมจังหวัดภูเก็ต (แผนที่) | ต้องขอไฟล์หรือวาดเอง | `raw-data/dpt_cityplan/` |

## ดาวน์โหลดใหม่ได้จากที่ไหน

| ข้อมูล | ที่อยู่ |
|---|---|
| OpenStreetMap | https://download.geofabrik.de/asia/thailand.html |
| Kontur Population | https://data.humdata.org (ค้นหา "Kontur Population Thailand") |
| Copernicus DEM | `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N07_00_E098_00_DEM/Copernicus_DSM_COG_10_N07_00_E098_00_DEM.tif` และ `…N08_00_E098_00…` |
| Overture | `python data-prep/overture_buildings.py 2026-09-23.1` |
| ทะเบียนราษฎร์ | https://stat.bora.dopa.go.th/new_stat/webPage/statByYear.php |
| ราคาประเมิน | https://data.go.th/dataset/land-valuation |
| อาคาร GISTDA 2567 | `python data-prep/gistda_buildings_api.py` (ต้องมี `GISTDA_API_KEY` ใน `.env`) |
