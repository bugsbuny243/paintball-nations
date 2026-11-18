#!/usr/bin/env python3
"""Build a small privacy-conscious 3D game map from OSM XML (stdlib only).

Usage: python scripts/build_osm_map.py /tmp/macka.osm maps/istanbul-macka.json
Attribution: © OpenStreetMap contributors, ODbL 1.0.
"""
import json
import math
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

# Bounding box from maps/queries/istanbul-macka.overpassql
SOUTH, WEST, NORTH, EAST = 41.0428, 28.9917, 41.0457, 28.9957
LAT0 = (SOUTH + NORTH) / 2
LON0 = (WEST + EAST) / 2
X_SCALE = 111320.0 * math.cos(math.radians(LAT0))
Z_SCALE = 111320.0
MIN_X, MAX_X = (WEST - LON0) * X_SCALE, (EAST - LON0) * X_SCALE
MIN_Z, MAX_Z = -(NORTH - LAT0) * Z_SCALE, -(SOUTH - LAT0) * Z_SCALE
ROAD_WIDTH = {
    "motorway": 12, "trunk": 11, "primary": 9, "secondary": 8,
    "tertiary": 7, "residential": 5.6, "service": 4.2,
    "living_street": 4, "pedestrian": 4.5, "footway": 2.6,
    "path": 2.2, "steps": 2, "cycleway": 2.5, "track": 3.6
}

def coordinate(lat, lon):
    return [round((lon - LON0) * X_SCALE, 2), round(-(lat - LAT0) * Z_SCALE, 2)]

def intersects(points):
    # The official map endpoint may include complete ways stretching outside bbox.
    return any(MIN_X - 5 <= x <= MAX_X + 5 and MIN_Z - 5 <= z <= MAX_Z + 5 for x, z in points)

def closed(points):
    return len(points) >= 4 and points[0] == points[-1]

def area(points):
    return abs(sum(points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]
                   for i in range(len(points) - 1))) / 2

def parse(inp):
    root = ET.parse(inp).getroot()
    nodes = {}
    for node in root.findall("node"):
        if node.get("lat") and node.get("lon"):
            nodes[node.get("id")] = coordinate(float(node.get("lat")), float(node.get("lon")))
    roads, buildings, greens = [], [], []
    skipped = 0
    for way in root.findall("way"):
        tags = {x.get("k"): x.get("v") for x in way.findall("tag")}
        ids = [n.get("ref") for n in way.findall("nd")]
        if any(i not in nodes for i in ids):
            skipped += 1
            continue
        points = [nodes[i] for i in ids]
        if len(points) < 2 or not intersects(points):
            continue
        highway = tags.get("highway")
        if highway in ROAD_WIDTH:
            roads.append({"id":way.get("id"), "type":highway,
                          "width": ROAD_WIDTH[highway], "p":points})
        if closed(points) and 12 < area(points) < 22000:
            if tags.get("building") not in (None, "no"):
                height = tags.get("height", "").replace("m", "").strip()
                try:
                    meters = float(height)
                    estimated = False
                except ValueError:
                    try:
                        meters = float(tags.get("building:levels", "")) * 3.1
                        estimated = True
                    except ValueError:
                        meters = 6 + int(way.get("id", "0")) % 4 * 2.8
                        estimated = True
                buildings.append({"id":way.get("id"),
                                  "h":round(min(32, max(3, meters)), 1),
                                  "estimated":estimated, "p":points[:-1]})
            elif tags.get("leisure") in ("park", "garden", "playground", "pitch") or tags.get("landuse") in ("grass", "meadow", "recreation_ground", "forest", "village_green") or tags.get("natural") in ("wood", "grassland", "scrub"):
                greens.append({"id":way.get("id"), "p":points[:-1]})
    if not roads and not buildings and not greens:
        raise ValueError("No usable OSM roads, buildings or green areas found; refusing to publish empty map.")
    return {
        "metadata": {
            "title":"Maçka / Istanbul — OSM-derived 3D prototype",
            "center":{"lat":LAT0,"lon":LON0},
            "bbox":[WEST,SOUTH,EAST,NORTH],
            "units":"meters",
            "source":"OpenStreetMap contributors",
            "attribution":"© OpenStreetMap contributors",
            "license":"ODbL-1.0",
            "url":"https://www.openstreetmap.org/copyright",
            "generatedAt":datetime.now(timezone.utc).isoformat(),
            "note":"Build footprints & roads are OSM-derived. Heights marked estimated are not surveyed; terrain elevation and relation multipolygons omitted.",
            "counts":{"roads":len(roads),"buildings":len(buildings),"greenAreas":len(greens),"skippedWays":skipped}
        },
        "roads":roads,
        "buildings":buildings,
        "greenAreas":greens
    }

def main():
    if len(sys.argv)!=3:
        raise SystemExit("Usage: build_osm_map.py <raw.osm> <output.json>")
    result=parse(sys.argv[1])
    out=Path(sys.argv[2]); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")), encoding="utf8")
    print("OSM conversion OK", json.dumps(result["metadata"]["counts"],ensure_ascii=False), "bytes",out.stat().st_size)

if __name__=="__main__":
    main()
