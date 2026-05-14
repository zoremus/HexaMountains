const SQRT3 = Math.sqrt(3);

export function createCubeCoords(sideLength) {
  const radius = sideLength - 1;
  const coords = [];

  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);

    for (let r = rMin; r <= rMax; r += 1) {
      const s = -q - r;
      coords.push({ q, r, s });
    }
  }

  return coords;
}

export function cubeToWorld({ q, r }, hexRadius, spacing) {
  const baseX = SQRT3 * (q + r / 2) * hexRadius;
  const baseZ = 1.5 * r * hexRadius;
  return {
    x: baseX * spacing,
    z: baseZ * spacing,
  };
}

export function deriveSampleHexRadiusKm(sideLength, largeHexRadiusKm) {
  const ringRadius = sideLength - 1;
  if (ringRadius <= 0) {
    return largeHexRadiusKm;
  }

  return largeHexRadiusKm / (ringRadius * SQRT3);
}

export function computeAmplifiedHeightMeters(sampledHeightMeters, minSampledHeightMeters, heightMultiplier) {
  return (
    minSampledHeightMeters +
    (sampledHeightMeters - minSampledHeightMeters) * heightMultiplier
  );
}

export function isPointInsidePointyHex(xKm, zKm, centerXKm, centerZKm, hexRadiusKm) {
  const dx = Math.abs(xKm - centerXKm);
  const dz = Math.abs(zKm - centerZKm);
  if (dz > hexRadiusKm) {
    return false;
  }

  return SQRT3 * dx + dz <= SQRT3 * hexRadiusKm;
}

export function roundCubeCoordinate(q, r, s) {
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  let roundedS = Math.round(s);

  const qDiff = Math.abs(roundedQ - q);
  const rDiff = Math.abs(roundedR - r);
  const sDiff = Math.abs(roundedS - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    roundedQ = -roundedR - roundedS;
  } else if (rDiff > sDiff) {
    roundedR = -roundedQ - roundedS;
  } else {
    roundedS = -roundedQ - roundedR;
  }

  return { q: roundedQ, r: roundedR, s: roundedS };
}

export function worldKmToCube(xKm, zKm, hexRadiusKm) {
  const q = ((SQRT3 / 3) * xKm - (1 / 3) * zKm) / hexRadiusKm;
  const r = ((2 / 3) * zKm) / hexRadiusKm;
  return roundCubeCoordinate(q, r, -q - r);
}

export function getCoordKey({ q, r, s }) {
  return `${q},${r},${s}`;
}

export function getNearbyCubeCoords(coord) {
  return [
    coord,
    { q: coord.q + 1, r: coord.r - 1, s: coord.s },
    { q: coord.q + 1, r: coord.r, s: coord.s - 1 },
    { q: coord.q, r: coord.r + 1, s: coord.s - 1 },
    { q: coord.q - 1, r: coord.r + 1, s: coord.s },
    { q: coord.q - 1, r: coord.r, s: coord.s + 1 },
    { q: coord.q, r: coord.r - 1, s: coord.s + 1 },
  ];
}

export function findContainingRenderedHex(xKm, zKm, approxCoord, renderedHexCenterMap, hexRadiusKm) {
  for (const candidateCoord of getNearbyCubeCoords(approxCoord)) {
    const center = renderedHexCenterMap.get(getCoordKey(candidateCoord));
    if (!center) {
      continue;
    }

    if (isPointInsidePointyHex(xKm, zKm, center.xKm, center.zKm, hexRadiusKm)) {
      return center;
    }
  }

  return null;
}
