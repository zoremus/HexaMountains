import { resolveAssetUrl } from "./asset-url.js";

const DEFAULT_HIKING_TRAILS_URL = resolveAssetUrl("hiking/hiking_trails_raw.json");
const MAP_CENTER_LAT = 49.185;
const MAP_CENTER_LON = 20.111;
const SUPPORTED_COLORS = new Set(["red", "blue", "green", "yellow"]);
const COLOR_MAP = {
  red: { r: 220, g: 40, b: 40 },
  blue: { r: 40, g: 110, b: 235 },
  green: { r: 30, g: 170, b: 70 },
  yellow: { r: 240, g: 210, b: 40 },
};
const STITCH_DISTANCE_KM = 0.08;

async function fetchAsJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch hiking trails from ${url}`);
  }

  return response.json();
}

function normalizeColorName(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  return SUPPORTED_COLORS.has(normalized) ? normalized : null;
}

function inferColorName(tags = {}) {
  const directColor = normalizeColorName(tags.colour ?? tags.color);
  if (directColor) {
    return directColor;
  }

  const osmcSymbol = String(tags["osmc:symbol"] ?? "").toLowerCase();
  for (const colorName of SUPPORTED_COLORS) {
    if (osmcSymbol.includes(colorName)) {
      return colorName;
    }
  }

  return null;
}

function latLonToKm(lat, lon) {
  const latScaleKm = 111.32;
  const lonScaleKm = 111.32 * Math.cos((MAP_CENTER_LAT * Math.PI) / 180);

  return {
    xKm: (lon - MAP_CENTER_LON) * lonScaleKm,
    zKm: (MAP_CENTER_LAT - lat) * latScaleKm,
  };
}

function resolveWayMembersInOrder(relationId, relationMap, visited = new Set()) {
  if (visited.has(relationId)) {
    return [];
  }

  visited.add(relationId);
  const relation = relationMap.get(relationId);
  if (!relation) {
    return [];
  }

  const wayIds = [];
  for (const member of relation.members ?? []) {
    if (member.type === "way") {
      wayIds.push(member.ref);
      continue;
    }

    if (member.type === "relation") {
      wayIds.push(...resolveWayMembersInOrder(member.ref, relationMap, visited));
    }
  }

  return wayIds;
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

function orientSegmentToAttach(previousPoint, segment) {
  if (!previousPoint || segment.length < 2) {
    return segment;
  }

  const startDistance = distanceKm(previousPoint, segment[0]);
  const endDistance = distanceKm(previousPoint, segment[segment.length - 1]);
  return endDistance < startDistance ? [...segment].reverse() : segment;
}

function buildOrderedPolylines(orderedSegments) {
  const polylines = [];
  let current = [];

  for (const rawSegment of orderedSegments) {
    const segment = current.length > 0
      ? orientSegmentToAttach(current[current.length - 1], rawSegment)
      : rawSegment;

    if (current.length === 0) {
      current = [...segment];
      continue;
    }

    const gapKm = distanceKm(current[current.length - 1], segment[0]);
    if (gapKm <= STITCH_DISTANCE_KM) {
      appendSegment(current, segment);
      continue;
    }

    if (current.length >= 2) {
      polylines.push(current);
    }
    current = [...segment];
  }

  if (current.length >= 2) {
    polylines.push(current);
  }

  return polylines;
}

export async function loadHikingTrailsSource() {
  const json = await fetchAsJson(DEFAULT_HIKING_TRAILS_URL);
  const elements = Array.isArray(json.elements) ? json.elements : [];
  const relationMap = new Map();
  const wayMap = new Map();

  for (const element of elements) {
    if (element.type === "relation") {
      relationMap.set(element.id, element);
    } else if (element.type === "way" && Array.isArray(element.geometry)) {
      wayMap.set(element.id, element);
    }
  }

  const polylines = [];
  for (const relation of relationMap.values()) {
    const colorName = inferColorName(relation.tags);
    if (!colorName) {
      continue;
    }

    const wayIds = resolveWayMembersInOrder(relation.id, relationMap);
    const orderedSegments = [];
    for (const wayId of wayIds) {
      const way = wayMap.get(wayId);
      if (!way || !Array.isArray(way.geometry) || way.geometry.length < 2) {
        continue;
      }

      const pointsKm = [];
      for (const point of way.geometry) {
        if (typeof point.lat !== "number" || typeof point.lon !== "number") {
          continue;
        }

        pointsKm.push(latLonToKm(point.lat, point.lon));
      }

      if (pointsKm.length < 2) {
        continue;
      }

      orderedSegments.push(pointsKm);
    }

    for (const pointsKm of buildOrderedPolylines(orderedSegments)) {
      polylines.push({
        colorName,
        color: COLOR_MAP[colorName],
        pointsKm,
      });
    }
  }

  if (polylines.length === 0) {
    for (const relation of relationMap.values()) {
      const colorName = inferColorName(relation.tags);
      if (!colorName) {
        continue;
      }

      const wayIds = resolveWayMembersInOrder(relation.id, relationMap);
      const segments = [];
      for (const wayId of wayIds) {
        const way = wayMap.get(wayId);
        if (!way || !Array.isArray(way.geometry) || way.geometry.length < 2) {
          continue;
        }

        const pointsKm = [];
        for (const point of way.geometry) {
          if (typeof point.lat !== "number" || typeof point.lon !== "number") {
            continue;
          }

          pointsKm.push(latLonToKm(point.lat, point.lon));
        }

        if (pointsKm.length >= 2) {
          segments.push(pointsKm);
        }
      }

      for (const pointsKm of stitchSegments(segments)) {
        polylines.push({
          colorName,
          color: COLOR_MAP[colorName],
          pointsKm,
        });
      }
    }
  }

  return {
    sourceUrl: DEFAULT_HIKING_TRAILS_URL,
    polylines,
  };
}
