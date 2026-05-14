import * as THREE from "three";

import { GRID_SIZE_SCENE_SCALE, HEIGHT_METERS_TO_SCENE_UNITS } from "./app-config.js";
import { sampleElevationMetersAtKm } from "./elevation-sampler.js";
import {
  computeAmplifiedHeightMeters,
  createCubeCoords,
  cubeToWorld,
  deriveSampleHexRadiusKm,
  getCoordKey,
} from "./hex-grid.js";
import { sampleLandcoverColorAtKm } from "./landcover-sampler.js";

export function buildTerrainMesh({
  sideLength,
  gridSizeScale,
  gridRadiusKm,
  heightMultiplier,
  sampleOffsetKm,
  elevationSource,
  landcoverSource,
}) {
  const layoutHexRadius = gridSizeScale * GRID_SIZE_SCENE_SCALE;
  const geometryHexRadius = layoutHexRadius;
  const sampleHexRadiusKm = deriveSampleHexRadiusKm(sideLength, gridRadiusKm);

  const coords = createCubeCoords(sideLength);
  const geometry = new THREE.CylinderGeometry(
    geometryHexRadius,
    geometryHexRadius,
    1,
    6,
    1,
    false,
  );
  const material = new THREE.MeshStandardMaterial({
    flatShading: true,
    roughness: 0.82,
    metalness: 0.08,
  });
  const rawInstances = [];

  for (const coord of coords) {
    const { x, z } = cubeToWorld(coord, layoutHexRadius, 1);
    const sampleKm = cubeToWorld(coord, sampleHexRadiusKm, 1);
    const sampledHeightMeters = sampleElevationMetersAtKm(
      elevationSource,
      sampleKm.x + sampleOffsetKm.x,
      sampleKm.z + sampleOffsetKm.y,
    );
    const sampledColor = sampleLandcoverColorAtKm(
      landcoverSource,
      sampleKm.x + sampleOffsetKm.x,
      sampleKm.z + sampleOffsetKm.y,
    );

    if (sampledHeightMeters === null || sampledColor === null) {
      continue;
    }

    rawInstances.push({ x, z, sampledHeightMeters, sampledColor, coord });
  }

  const minSampledHeightMeters = rawInstances.length > 0
    ? Math.min(...rawInstances.map((instance) => instance.sampledHeightMeters))
    : 0;
  const instances = [];
  const renderedHexCenterMap = new Map();

  for (const rawInstance of rawInstances) {
    const amplifiedHeightMeters = computeAmplifiedHeightMeters(
      rawInstance.sampledHeightMeters,
      minSampledHeightMeters,
      heightMultiplier,
    );
    const actualHeightMeters = Math.max(0, amplifiedHeightMeters);
    const actualHeight = Math.max(0.001, actualHeightMeters * HEIGHT_METERS_TO_SCENE_UNITS);
    const sampleKm = cubeToWorld(rawInstance.coord, sampleHexRadiusKm, 1);

    renderedHexCenterMap.set(getCoordKey(rawInstance.coord), {
      xKm: sampleKm.x,
      zKm: sampleKm.z,
    });

    instances.push({
      coord: rawInstance.coord,
      x: rawInstance.x,
      z: rawInstance.z,
      actualHeight,
      sampledColor: rawInstance.sampledColor,
    });
  }

  const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
  mesh.userData.instanceData = instances;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  const color = new THREE.Color();

  for (let index = 0; index < instances.length; index += 1) {
    const instance = instances[index];

    position.set(instance.x, instance.actualHeight / 2, instance.z);
    scale.set(1, instance.actualHeight, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);

    color.setRGB(
      instance.sampledColor.r / 255,
      instance.sampledColor.g / 255,
      instance.sampledColor.b / 255,
    );
    mesh.setColorAt(index, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return {
    mesh,
    layoutHexRadius,
    geometryHexRadius,
    sampleHexRadiusKm,
    minSampledHeightMeters,
    renderedHexCenterMap,
    hexCount: instances.length,
  };
}
