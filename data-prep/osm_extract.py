import osmium, json, sys
pbf, out = sys.argv[1], sys.argv[2]
W,S,E,N = 98.24, 7.55, 98.50, 8.22
inb = lambda lon,lat: W<=lon<=E and S<=lat<=N
ROAD_KEEP = {'motorway','trunk','primary','secondary','tertiary','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link','residential','unclassified','service','living_street','track'}
POI_TAGS = {
 'amenity': {'school':'education','college':'education','university':'education','kindergarten':'education',
             'hospital':'health','clinic':'health','doctors':'health','pharmacy':'health',
             'marketplace':'market','bank':'finance','atm':'finance','police':'public','fire_station':'public','townhall':'public','post_office':'public',
             'fuel':'transport','bus_station':'transport','ferry_terminal':'transport','restaurant':'food','cafe':'food','fast_food':'food'},
 'shop': {'mall':'retail','supermarket':'retail','department_store':'retail','convenience':'retail'},
 'tourism': {'hotel':'lodging','resort':'lodging','guest_house':'lodging','hostel':'lodging','apartment':'lodging','attraction':'attraction','viewpoint':'attraction','museum':'attraction'},
 'aeroway': {'aerodrome':'transport','terminal':'transport'},
}
def cat(tags):
    for k,m in POI_TAGS.items():
        v=tags.get(k)
        if v in m: return m[v], k, v
    return None
class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.roads=[]; s.pois=[]
    def node(s,n):
        if not n.location.valid() or not inb(n.location.lon,n.location.lat): return
        c=cat(n.tags)
        if c: s.pois.append({"type":"Feature","properties":{"cat":c[0],"kind":c[2],"name":n.tags.get('name',''),"name_en":n.tags.get('name:en','')},"geometry":{"type":"Point","coordinates":[round(n.location.lon,6),round(n.location.lat,6)]}})
    def way(s,w):
        hw=w.tags.get('highway'); c=cat(w.tags)
        if hw not in ROAD_KEEP and not c: return
        try: pts=[(nd.location.lon,nd.location.lat) for nd in w.nodes]
        except osmium.InvalidLocationError: return
        if not pts or not any(inb(x,y) for x,y in pts): return
        if hw in ROAD_KEEP:
            s.roads.append({"type":"Feature","properties":{"hw":hw,"name":w.tags.get('name',''),"ref":w.tags.get('ref','')},"geometry":{"type":"LineString","coordinates":[[round(x,6),round(y,6)] for x,y in pts]}})
        if c:
            x=sum(p[0] for p in pts)/len(pts); y=sum(p[1] for p in pts)/len(pts)
            s.pois.append({"type":"Feature","properties":{"cat":c[0],"kind":c[2],"name":w.tags.get('name',''),"name_en":w.tags.get('name:en','')},"geometry":{"type":"Point","coordinates":[round(x,6),round(y,6)]}})
h=H(); h.apply_file(pbf, locations=True, idx='flex_mem')
json.dump({"type":"FeatureCollection","features":h.roads},open(out+'/osm_roads.geojson','w'),ensure_ascii=False)
json.dump({"type":"FeatureCollection","features":h.pois},open(out+'/osm_pois.geojson','w'),ensure_ascii=False)
from collections import Counter
print('roads',len(h.roads),Counter(f['properties']['hw'] for f in h.roads).most_common())
print('pois',len(h.pois),Counter(f['properties']['cat'] for f in h.pois).most_common())
