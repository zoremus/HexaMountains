import { resolveAssetUrl } from "./asset-url.js";

const DEFAULT_HIKING_SEGMENTS_URL = resolveAssetUrl("hiking/hiking_trail_segments.csv");
const SUPPORTED_COLORS = new Set(["red", "blue", "green", "yellow"]);
const COLOR_MAP = {
  red: { r: 220, g: 40, b: 40 },
  blue: { r: 40, g: 110, b: 235 },
  green: { r: 30, g: 170, b: 70 },
  yellow: { r: 240, g: 210, b: 40 },
};
const STITCH_DISTANCE_KM = 0.03;

async function fetchAsText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch hiking trail segments from ${url}`);
  }

  return response.text();
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = {};
    for (let index = 0; index < header.length; index += 1) {
      row[header[index]] = values[index] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function distanceKm(a, b) {
  const dx = a.xKm - b.xKm;
  const dz = a.zKm - b.zKm;
  return Math.sqrt(dx * dx + dz * dz);
}

function appendSegment(target, segment) {
  const points = [...segment];
  if (distanceKm(target[target.length - 1], points[0]) <= STITCH_DISTANCE_KM) {
    points.shift();
  }
  target.push(...points);
}

function prependSegment(target, segment) {
  const points = [...segment];
  if (distanceKm(points[points.length - 1], target[0]) <= STITCH_DISTANCE_KM) {
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

export async function loadHikingTrailSegmentsSource() {
  const text = await fetchAsText(DEFAULT_HIKING_SEGMENTS_URL);
  const rows = parseCsv(text);
  const groups = new Map();

  for (const row of rows) {
    const colorName = String(row.color_name ?? "").trim().toLowerCase();
    if (!SUPPORTED_COLORS.has(colorName)) {
      continue;
    }

    const relationId = String(row.relation_id ?? "").trim();
    const startXKm = Number.parseFloat(row.start_x_km);
    const startZKm = Number.parseFloat(row.start_z_km);
    const endXKm = Number.parseFloat(row.end_x_km);
    const endZKm = Number.parseFloat(row.end_z_km);

    if (![startXKm, startZKm, endXKm, endZKm].every(Number.isFinite)) {
      continue;
    }

    const key = `${relationId}|${colorName}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push([
      { xKm: startXKm, zKm: startZKm },
      { xKm: endXKm, zKm: endZKm },
    ]);
  }

  const polylines = [];
  for (const [key, segments] of groups.entries()) {
    const [, colorName] = key.split("|");
    for (const pointsKm of stitchSegments(segments)) {
      if (pointsKm.length < 2) {
        continue;
      }

      polylines.push({
        colorName,
        color: COLOR_MAP[colorName],
        pointsKm,
      });
    }
  }

  return {
    sourceUrl: DEFAULT_HIKING_SEGMENTS_URL,
    polylines,
  };
}
