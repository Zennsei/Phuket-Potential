# สคริปต์เตรียมข้อมูล

ไฟล์ต้นทาง (ไม่ได้รวมไว้ในโปรเจกต์เพราะใหญ่) :
- `83_ภูเก็ต.shp` รูปแปลงอาคาร GISTDA
- `THA_Tambon.shp` ขอบเขตตำบล
- `thailand-latest.osm.pbf` จาก https://download.geofabrik.de/asia/thailand.html
- `kontur_population_TH_20231101.gpkg` จาก HDX
- `land_83_phuket.csv` ราคาประเมิน กรมธนารักษ์ จาก https://data.go.th/dataset/land-valuation

- `LU_PKT_2563.shp` การใช้ที่ดิน กรมพัฒนาที่ดิน ปี 2563 (จาก Landuse_pkt.zip)
- `data_4.csv` สำมะโนประชากร ภาคใต้ (data.go.th/dataset/0703_01_14)

ลำดับการรัน: `osm_extract.py` → `bldg_grid.py` → `data_prep.py` → `landuse_prep.py` (แก้ path ของไฟล์ต้นทางที่ต้นไฟล์ก่อน)

`dopa_prep.py` รวมประชากรและจำนวนบ้านตามทะเบียนราษฎร์รายตำบล จากไฟล์ `stat_t*.txt` ของกรมการปกครอง → `public/data/dopa_tambon.csv`

`gistda_buildings_api.py` ดึงอาคารพร้อมความสูง ปี 2567 จาก GISTDA API Gateway รันบนเครื่องของทีมเท่านั้น (ต้องมี `GISTDA_API_KEY` ใน `.env`) ผลอยู่ใน `data-prep/out/` ซึ่งไม่ถูก commit

`gistda_api_probe6.py` ทดสอบรอบหก (52 คำขอ): ดึงแผ่น Landtrendr ซูม 13 2 × 2 แผ่น (เมืองเก่า รัษฎา วิชิต) กับภาพรายปี 43 ปีของกรอบเดียวกัน ไว้หาคำอธิบายสี ได้ `out/probe6/` (ภาพเป็นลิขสิทธิ์ GISTDA เก็บในเครื่อง ห้าม commit) · ทีมรันแล้ว 25 ต.ค. 2569

`landtrendr_legend.py` อ่านไฟล์จากรอบหก แล้วหาว่าแต่ละสีของ Landtrendr คือปีไหน: หาปีแรกที่แต่ละจุด "เขียวแล้วกลายเป็นดินโล่ง" จากภาพรายปี หักจำนวนที่เกิดเองบนพื้นที่ที่ไม่มีสี แล้วดูว่าปีไหนเด่นในแต่ละสี ได้ `checks/landtrendr_legend.txt` (ตัวเลขล้วน ไม่มีภาพ) · ต้องมี numpy, Pillow, scipy · รันใหม่: `python data-prep/landtrendr_legend.py data-prep/out/probe6`

`gistda_api_probe5.py` ทดสอบรอบห้า (8 คำขอ): ขอแผ่นเวกเตอร์ของชุดขอบเขตตำบลและประชากรใน Land feature collections แล้วถอดในตัว (ชื่อชั้น จำนวนรูป ช่องข้อมูล) ได้ `out/probe5/report.txt` ที่ลบ key แล้ว ส่วนไฟล์ `.pbf` เป็นข้อมูลของ GISTDA เก็บไว้ในเครื่อง ห้าม commit · ผล 24 ต.ค. 2569: ได้ 404 "Service not found" ทั้งหมด (gateway ไม่เปิดเส้นทางนี้) จึงปิดเรื่องนี้

`gistda_api_probe4.py` ทดสอบรอบสี่ (ราว 25 คำขอ ไม่มีภาพ): หา path ที่ได้ข้อมูลรายการของ Land feature collections (รอบ 3 ได้ 404) โดยลองหลายทางและบันทึกคำตอบเต็มพร้อม header ได้ `out/probe4/report.txt` ที่ลบ key แล้ว · ตามลิงก์ที่ GISTDA ให้มาเฉพาะเมื่ออยู่บน api-gateway.gistda.or.th เท่านั้น key จึงไม่ถูกส่งไปที่อื่น

`gistda_api_probe3.py` ทดสอบรอบสาม: ดึงภาพตัวอย่างของภูเก็ต (ภาพรายปี, Landtrendr, Hillshade, GI Basemap) และหา PLEIADES ที่ครอบภูเก็ต ภาพเป็นลิขสิทธิ์ GISTDA ใช้ประเมินเท่านั้น

`gistda_api_probe2.py` ทดสอบรอบสอง (ไล่ลิงก์ THEOS-1/PLEIADES, ขอรายชื่อชั้นภาพดาวเทียม, น้ำท่วมซ้ำซากหลายจุด) ได้ `out/gistda_api_probe2.txt`

`gistda_api_probe.py` ทดสอบบริการ GISTDA ที่น่าสนใจ (น้ำท่วมซ้ำซาก THEOS-1 ภาพดาวเทียมรายปี ฯลฯ) รันบนเครื่องทีม ได้รายงานที่ไม่มี key

`terrain_prep.py` ความสูงและความชันจาก Copernicus DEM 30 ม. (ต้องติดตั้ง `rasterio`) ดาวน์โหลด 2 ไฟล์จาก `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N07_00_E098_00_DEM/Copernicus_DSM_COG_10_N07_00_E098_00_DEM.tif` และ `..._N08_00_E098_00_...`

`check_heights.py` เทียบความสูงอาคาร GISTDA 2567 กับ Overture/OSM และสร้างรายการตรวจด้วยตา `checks/height_spotcheck.csv`

`check_compare.py` คิดหน้า "เทียบข้อมูล" ซ้ำด้วยสูตรที่เขียนแยกจากโค้ดเว็บ: แบบต่างวิธีคิด (5 เรื่อง × 3 หลักเกณฑ์) → `checks/compare_methods.txt` และแบบวัดสิ่งเดียวกัน/นิยามต่างกัน/ต่างช่วงเวลา → `checks/compare_sources.txt` ใช้ Python มาตรฐานอย่างเดียว: `python data-prep/check_compare.py`

`building_sources.py` นับอาคาร 3 แหล่ง (GISTDA 2565, GISTDA 2567, Overture) รายตำบลด้วยกติกาเดียวกัน ได้ `public/data/building_sources.csv` สำหรับหน้าเทียบข้อมูล: `python data-prep/building_sources.py <ภูเก็ต.shp> <gistda_buildings_2567_phuket.csv.gz> <phuket_buildings_overture.parquet> <THA_Tambon.shp>` (ไฟล์ทั้ง 4 อยู่ใน `raw-data/` zip 03, 01, 06, 10) ต้องมี geopandas และ pyarrow

`market_dummy.py` สร้างราคาตลาดที่ดิน**จำลอง**สำหรับแผนที่ = ราคาประเมินของช่อง 1 กม. × 2 (ตัวคูณสมมติ ไม่ใช่ข้อมูลจริง ไม่ใช้คิดคะแนน) → `public/data/market_dummy_1km.geojson`: `python data-prep/market_dummy.py`

`road_density.py` วัดความยาวถนนสายหลัก (primary/secondary + ทางเชื่อม) และสายรอง (tertiary) ในแต่ละตำบลจากแผ่น `public/data/roads_all/14/` → คอลัมน์ `road_km`, `road_major_km`, `road_tert_km`, `road_km_per_km2` (ปัจจัยความหนาแน่นถนน) ใน `tambons.geojson` และ `phuket_tambon_factors.csv`: `python data-prep/road_density.py` (ต้องมี shapely, pyproj, numpy)

`admin_levels.py` รวมรูปตำบลเป็นเส้นขอบอำเภอและจังหวัด → `public/data/amphoe.geojson`, `province.geojson` (ตัวเลขของอำเภอ/จังหวัดรวมในเบราว์เซอร์ที่ `src/levels.ts`): `python data-prep/admin_levels.py`

`overture_buildings.py` ดึงอาคาร Overture (ไม่ได้ใช้ในเว็บ ใช้ตรวจความครบของข้อมูลอาคาร) ต้องติดตั้ง `pyarrow`

รายละเอียดของข้อมูลทุกชุด (แหล่ง ปี สถานะ) อยู่ใน `DATA.md` ที่โฟลเดอร์หลัก

## วิธีหาตำแหน่งราคาประเมิน
ไฟล์ราคาประเมินไม่มีพิกัด มีแต่เลขระวาง UTM เช่น `4624 I 3470-01 (1:1000)`
- 4 หลัก `3470`: 2 หลักแรกคือพิกัดตะวันออก (434 กม.) 2 หลักหลังคือพิกัดเหนือ (870 กม.) ของมุมล่างซ้ายของแผ่น 2×2 กม.
- เลขแผ่นย่อย: 1:2000 แบ่ง 4 แผ่น, 1:1000 แบ่ง 16 แผ่น, 1:500 แบ่ง 64 แผ่น เรียงทีละแถวจากมุมบนซ้าย
  (ทดสอบแล้ว รูปแบบนี้ทำให้ตำแหน่ง 94% ตกบนเกาะและใกล้อาคาร ดีกว่ารูปแบบอื่นทั้งหมด)
- แปลงที่ใช้ระวาง 1:5000 (ประมาณ 8%) ใช้ระบบเลขแบบเก่า แปลงเป็นตำแหน่งไม่ได้ จึงไม่ได้นับ
