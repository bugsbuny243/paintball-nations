[out:xml][timeout:45];
// Paintball Nations — Istanbul / Macka OSM research extract
// Order: south, west, north, east. Approx. 320 x 335 metres.
// Query contains only publicly mapped geometries.
// This is NOT a live download; run via https://overpass-turbo.eu/ .
(
  way["highway"](41.0428,28.9917,41.0457,28.9957);
  way["building"](41.0428,28.9917,41.0457,28.9957);
  way["landuse"](41.0428,28.9917,41.0457,28.9957);
  way["leisure"](41.0428,28.9917,41.0457,28.9957);
  way["natural"](41.0428,28.9917,41.0457,28.9957);
  way["barrier"](41.0428,28.9917,41.0457,28.9957);
);
// Return referenced nodes as well as the ways.
(._;>;);
out meta;
