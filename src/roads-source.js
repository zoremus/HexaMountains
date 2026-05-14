const DEFAULT_ROADS_URL = "/roads/roads_raw.json";
const MAP_CENTER_LAT = 49.185;
const MAP_CENTER_LON = 20.111;
const ROAD_COLOR = { r: 12, g: 12, b: 12 };
const STITCH_DISTANCE_KM = 0.08;
const RENDERED_HIGHWAY_TYPES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "road",
  "unclassified",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);

async function fetchAsJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch roads from ${url}`);
  }

  return response.json();
}

function latLonToKm(lat, lon) {
  const latScaleKm = 111.32;
  const lonScaleKm = 111.32 * Math.cos((MAP_CENTER_LAT * Math.PI) / 180);

  return {
    xKm: (lon - MAP_CENTER_LON) * lonScaleKm,
    zKm: (MAP_CENTER_LAT - lat) * latScaleKm,
  };
}

function distanceKm(a, b) {
  const dx = a.xKm - b.xKm;
  const dz = a.zKm - b.zKm;
  return Math.sqrt(dx * dx + dz * dz);
}

function appendSegment(target, segment) {
  const points = [...segment];
  if (target.length > 0 && points.length > 0 && distanceKm(target[target.length - 1], points[0]) <= STITCH_DISTANCE_KM) {
    points.shift();
  }
  target.push(...points);
}

function prependSegment(target, segment) {
  const points = [...segment];
  if (target.length > 0 && points.length > 0 && distanceKm(points[points.length - 1], target[0]) <= STITCH_DISTANCE_KM) {
    points.pop();
  }
  target.unshift(...points);
}

function stitchSegments(segments) {
  const remaining = segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => [...segment]);
  const stitched = [];

  while (remaining.length > 0) {
    const current = remaining.shift();
    let changed = true;

    while (changed) {
      changed = false;

      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const currentStart = current[0];
        const currentEnd = current[current.length - 1];
        const candidateStart = candidate[0];
        const candidateEnd = candidate[candidate.length - 1];

        if (distanceKm(currentEnd, candidateStart) <= STITCH_DISTANCE_KM) {
          appendSegment(current, candidate);
        } else if (distanceKm(currentEnd, candidateEnd) <= STITCH_DISTANCE_KM) {
          appendSegment(current, [...candidate].reverse());
        } else if (distanceKm(currentStart, candidateEnd) <= STITCH_DISTANCE_KM) {
          prependSegment(current, candidate);
        } else if (distanceKm(currentStart, candidateStart) <= STITCH_DISTANCE_KM) {
          prependSegment(current, [...candidate].reverse());
        } else {
          continue;
        }

        remaining.splice(index, 1);
        changed = true;
        break;
      }
    }

    stitched.push(current);
  }

  return stitched;
}

export async function loadRoadsSource() {
  const json = await fetchAsJson(DEFAULT_ROADS_URL);
  const elements = Array.isArray(json.elements) ? json.elements : [];
  const nodesById = new Map();
  const waySegments = [];

  for (const element of elements) {
    if (element.type === "node" && typeof element.lat === "number" && typeof element.lon === "number") {
      nodesById.set(element.id, { lon: element.lon, lat: element.lat });
    }
  }

  for (const element of elements) {
    if (element.type !== "way") {
      continue;
    }

    const highwayType = String(element.tags?.highway ?? "").trim().toLowerCase();
    if (!RENDERED_HIGHWAY_TYPES.has(highwayType)) {
      continue;
    }

    let rawPoints = null;
    if (Array.isArray(element.geometry) && element.geometry.length >= 2) {
      rawPoints = element.geometry
        .filter((point) => typeof point.lat === "number" && typeof point.lon === "number")
        .map((point) => ({ lon: point.lon, lat: point.lat }));
    } else if (Array.isArray(element.nodes) && element.nodes.length >= 2) {
      rawPoints = element.nodes
        .map((nodeId) => nodesById.get(nodeId))
        .filter(Boolean);
    }

    if (!rawPoints || rawPoints.length < 2) {
      continue;
    }

    waySegments.push(
      rawPoints.map((point) => latLonToKm(point.lat, point.lon)),
    );
  }

  return {
    sourceUrl: DEFAULT_ROADS_URL,
    polylines: stitchSegments(waySegments).map((pointsKm) => ({
      color: ROAD_COLOR,
      pointsKm,
    })),
  };
}
