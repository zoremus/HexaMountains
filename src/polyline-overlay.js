import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import {
  HEIGHT_METERS_TO_SCENE_UNITS,
  POLYLINE_CURVE_TENSION,
  POLYLINE_MIN_POINTS,
} from "./app-config.js";
import { sampleElevationMetersAtKm } from "./elevation-sampler.js";
import {
  computeAmplifiedHeightMeters,
  findContainingRenderedHex,
  worldKmToCube,
} from "./hex-grid.js";

function decimatePoints(points, keepRatio) {
  if (points.length <= 2) {
    return points;
  }

  const clampedRatio = Math.max(0.01, Math.min(1, keepRatio));
  const step = Math.max(1, Math.round(1 / clampedRatio));
  if (step <= 1) {
    return points;
  }

  const reduced = [];
  for (let index = 0; index < points.length; index += step) {
    reduced.push(points[index]);
  }

  const lastPoint = points[points.length - 1];
  if (reduced[reduced.length - 1] !== lastPoint) {
    reduced.push(lastPoint);
  }

  return reduced;
}

function mergeNearbyRuns(pointRuns, kmToSceneScale, maxGapKm) {
  if (pointRuns.length <= 1) {
    return pointRuns;
  }

  const maxGapSceneUnits = maxGapKm * kmToSceneScale;
  const mergedRuns = [];
  let currentRun = [...pointRuns[0]];

  for (let runIndex = 1; runIndex < pointRuns.length; runIndex += 1) {
    const nextRun = pointRuns[runIndex];
    const currentEnd = currentRun[currentRun.length - 1];
    const nextStart = nextRun[0];

    if (currentEnd.distanceTo(nextStart) <= maxGapSceneUnits) {
      currentRun.push(...nextRun);
      continue;
    }

    mergedRuns.push(currentRun);
    currentRun = [...nextRun];
  }

  mergedRuns.push(currentRun);
  return mergedRuns;
}

function getColorHeightOffset(style, colorName) {
  return style.colorHeightOffsets?.[colorName] ?? 0;
}

export function buildPolylineOverlay({
  renderer,
  polylines,
  style,
  layoutHexRadius,
  sampleHexRadiusKm,
  renderedHexCenterMap,
  minSampledHeightMeters,
  heightMultiplier,
  sampleOffsetKm,
  elevationSource,
}) {
  const group = new THREE.Group();
  const kmToSceneScale = layoutHexRadius / sampleHexRadiusKm;
  const resolution = new THREE.Vector2();
  renderer.getSize(resolution);
  resolution.multiplyScalar(renderer.getPixelRatio());

  for (const polyline of polylines) {
    const pointRuns = [];
    let currentRun = [];

    for (const point of polyline.pointsKm) {
      const localXKm = point.xKm - sampleOffsetKm.x;
      const localZKm = point.zKm - sampleOffsetKm.y;
      const coord = worldKmToCube(localXKm, localZKm, sampleHexRadiusKm);
      const center = findContainingRenderedHex(
        localXKm,
        localZKm,
        coord,
        renderedHexCenterMap,
        sampleHexRadiusKm,
      );

      if (!center) {
        if (currentRun.length >= 2) {
          pointRuns.push(currentRun);
        }
        currentRun = [];
        continue;
      }

      const sampledHeightMeters = sampleElevationMetersAtKm(
        elevationSource,
        point.xKm,
        point.zKm,
      );
      if (sampledHeightMeters === null) {
        if (currentRun.length >= 2) {
          pointRuns.push(currentRun);
        }
        currentRun = [];
        continue;
      }

      const actualHeightMeters = Math.max(
        0,
        computeAmplifiedHeightMeters(
          sampledHeightMeters,
          minSampledHeightMeters,
          heightMultiplier,
        ),
      );

      currentRun.push(
        new THREE.Vector3(
          localXKm * kmToSceneScale,
          actualHeightMeters * HEIGHT_METERS_TO_SCENE_UNITS +
            style.baseHeightOffsetSceneUnits +
            getColorHeightOffset(style, polyline.colorName),
          localZKm * kmToSceneScale,
        ),
      );
    }

    if (currentRun.length >= 2) {
      pointRuns.push(currentRun);
    }

    for (const curvePoints of mergeNearbyRuns(pointRuns, kmToSceneScale, style.runMergeDistanceKm)) {
      const curve = new THREE.CatmullRomCurve3(curvePoints, false, "centripetal", POLYLINE_CURVE_TENSION);
      const sampledCurvePoints = decimatePoints(
        curve.getPoints(Math.max(POLYLINE_MIN_POINTS, curvePoints.length * 3)),
        style.pointKeepRatio,
      );
      const positions = [];
      for (const point of sampledCurvePoints) {
        positions.push(point.x, point.y, point.z);
      }

      const geometry = new LineGeometry();
      geometry.setPositions(positions);
      const material = new LineMaterial({
        color: new THREE.Color(
          polyline.color.r / 255,
          polyline.color.g / 255,
          polyline.color.b / 255,
        ),
        linewidth: style.lineWidthPixels,
        worldUnits: false,
      });
      material.resolution.copy(resolution);

      const line = new Line2(geometry, material);
      line.computeLineDistances();
      line.renderOrder = 2;
      group.add(line);
    }
  }

  return group;
}
