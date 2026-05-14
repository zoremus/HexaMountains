import * as THREE from "three";

import { HIKING_TRAIL_STYLE, ROAD_STYLE, SAMPLE_PAN_SPEED } from "./app-config.js";
import {
  getGridSettings,
  queryControls,
  shouldShowHikingTrails,
  shouldShowRoads,
  syncDerivedHeightMultiplier,
  updateGridStats,
  updateReadouts,
} from "./controls.js";
import { cubeToWorld, deriveSampleHexRadiusKm } from "./hex-grid.js";
import { createPointerTools } from "./interaction.js";
import { buildPolylineOverlay } from "./polyline-overlay.js";
import { createScene, replaceGrid } from "./scene.js";
import { createSourceCache } from "./source-cache.js";
import { buildTerrainMesh } from "./terrain-mesh.js";
import "./style.css";

const controlsUi = queryControls();
const { gridGroup, controls, renderer, camera } = createScene(controlsUi.viewportNode);
const sourceCache = createSourceCache();
const pointerTools = createPointerTools({ renderer, camera, gridGroup });
const sampleOffsetKm = { x: 0, y: 0 };
let sampleDragState = null;
let gridBuildToken = 0;

function getSamplingKmPerSceneUnit() {
  const { sideLength, gridRadiusKm, gridSizeScale } = getGridSettings(controlsUi);
  const sampleHexRadiusKm = deriveSampleHexRadiusKm(sideLength, gridRadiusKm);

  if (gridSizeScale <= 0) {
    return 0;
  }

  return sampleHexRadiusKm / gridSizeScale;
}

function getCurrentSampleHexRadiusKm() {
  const { sideLength, gridRadiusKm } = getGridSettings(controlsUi);
  return deriveSampleHexRadiusKm(sideLength, gridRadiusKm);
}

async function buildTerrainContent() {
  const elevationSource = await sourceCache.ensureElevationLoaded();
  const landcoverSource = await sourceCache.ensureLandcoverLoaded();

  const terrain = buildTerrainMesh({
    ...getGridSettings(controlsUi),
    sampleOffsetKm,
    elevationSource,
    landcoverSource,
  });

  updateGridStats(controlsUi, {
    hexCount: terrain.hexCount,
    renderedRadius: terrain.geometryHexRadius,
    sampleRadiusKm: terrain.sampleHexRadiusKm,
  });

  const contentGroup = new THREE.Group();
  contentGroup.add(terrain.mesh);

  const overlayContext = {
    renderer,
    contentGroup,
    layoutHexRadius: terrain.layoutHexRadius,
    sampleHexRadiusKm: terrain.sampleHexRadiusKm,
    renderedHexCenterMap: terrain.renderedHexCenterMap,
    minSampledHeightMeters: terrain.minSampledHeightMeters,
    heightMultiplier: getGridSettings(controlsUi).heightMultiplier,
    sampleOffsetKm,
    elevationSource,
  };

  return overlayContext;
}

async function attachOptionalOverlays(overlayContext, {
  showHikingTrails = shouldShowHikingTrails(controlsUi),
  showRoads = shouldShowRoads(controlsUi),
} = {}, token) {
  const overlayGroups = [];

  if (showHikingTrails) {
    try {
      const hikingTrailsSource = await sourceCache.ensureHikingTrailsLoaded();
      overlayGroups.push(
        buildPolylineOverlay({
          ...overlayContext,
          polylines: hikingTrailsSource.polylines,
          style: HIKING_TRAIL_STYLE,
        }),
      );
    } catch (error) {
      console.error("Failed to load hiking trails overlay", error);
    }
  }

  if (showRoads) {
    try {
      const roadsSource = await sourceCache.ensureRoadsLoaded();
      overlayGroups.push(
        buildPolylineOverlay({
          ...overlayContext,
          polylines: roadsSource.polylines,
          style: ROAD_STYLE,
        }),
      );
    } catch (error) {
      console.error("Failed to load roads overlay", error);
    }
  }

  if (token !== gridBuildToken) {
    return;
  }

  for (const overlayGroup of overlayGroups) {
    overlayContext.contentGroup.add(overlayGroup);
  }
}

async function regenerateGrid(options) {
  const token = ++gridBuildToken;
  const overlayContext = await buildTerrainContent();
  if (token !== gridBuildToken) {
    return;
  }

  replaceGrid(gridGroup, overlayContext.contentGroup);
  void attachOptionalOverlays(overlayContext, options, token);
}

async function handleControlsChanged(options) {
  updateReadouts(controlsUi, sampleOffsetKm);
  await regenerateGrid(options);
}

function beginSampleDrag(event) {
  if (!(event.ctrlKey && event.button === 2)) {
    return;
  }

  event.preventDefault();
  const groundPoint = pointerTools.getGroundPointFromPointer(event);
  if (!groundPoint) {
    return;
  }

  sampleDragState = {
    startGroundPoint: groundPoint,
    startOffsetX: sampleOffsetKm.x,
    startOffsetY: sampleOffsetKm.y,
  };
  controls.enabled = false;
}

function continueSampleDrag(event) {
  if (!sampleDragState) {
    return;
  }

  const groundPoint = pointerTools.getGroundPointFromPointer(event);
  if (!groundPoint) {
    return;
  }

  const kmPerSceneUnit = getSamplingKmPerSceneUnit();
  const dx = groundPoint.x - sampleDragState.startGroundPoint.x;
  const dz = groundPoint.z - sampleDragState.startGroundPoint.z;

  sampleOffsetKm.x = sampleDragState.startOffsetX - dx * kmPerSceneUnit * SAMPLE_PAN_SPEED;
  sampleOffsetKm.y = sampleDragState.startOffsetY - dz * kmPerSceneUnit * SAMPLE_PAN_SPEED;
  void handleControlsChanged({ showHikingTrails: false, showRoads: false });
}

function endSampleDrag() {
  if (!sampleDragState) {
    return;
  }

  sampleDragState = null;
  controls.enabled = true;
  void handleControlsChanged();
}

function handleCtrlWheel(event) {
  if (!event.ctrlKey) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const hoveredCoord = pointerTools.getHoveredHexCoord(event);
  const previousSampleHexRadiusKm = getCurrentSampleHexRadiusKm();
  const currentValue = Number.parseFloat(controlsUi.gridRadiusKmInput.value);
  const minValue = Number.parseFloat(controlsUi.gridRadiusKmInput.min);
  const maxValue = Number.parseFloat(controlsUi.gridRadiusKmInput.max);
  const stepValue = Number.parseFloat(controlsUi.gridRadiusKmInput.step || "1");
  const direction = event.deltaY < 0 ? -1 : 1;
  const nextValue = Math.max(
    minValue,
    Math.min(maxValue, currentValue + direction * stepValue),
  );

  if (nextValue === currentValue) {
    return;
  }

  controlsUi.gridRadiusKmInput.value = String(nextValue);

  if (hoveredCoord) {
    const previousSampleKm = cubeToWorld(hoveredCoord, previousSampleHexRadiusKm, 1);
    const nextSampleKm = cubeToWorld(hoveredCoord, getCurrentSampleHexRadiusKm(), 1);

    sampleOffsetKm.x += previousSampleKm.x - nextSampleKm.x;
    sampleOffsetKm.y += previousSampleKm.z - nextSampleKm.z;
  }

  syncDerivedHeightMultiplier(controlsUi);
  void handleControlsChanged();
}

syncDerivedHeightMultiplier(controlsUi);
updateReadouts(controlsUi, sampleOffsetKm);
handleControlsChanged().catch((error) => {
  console.error(error);
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
});
renderer.domElement.addEventListener("mousedown", beginSampleDrag);
renderer.domElement.addEventListener("wheel", handleCtrlWheel, { passive: false, capture: true });
window.addEventListener("mousemove", continueSampleDrag);
window.addEventListener("mouseup", endSampleDrag);

controlsUi.sideLengthInput.addEventListener("input", () => {
  syncDerivedHeightMultiplier(controlsUi);
  void handleControlsChanged();
});
controlsUi.gridSizeScaleInput.addEventListener("input", () => void handleControlsChanged());
controlsUi.gridRadiusKmInput.addEventListener("input", () => {
  syncDerivedHeightMultiplier(controlsUi);
  void handleControlsChanged();
});
controlsUi.heightMultiplierInput.addEventListener("input", () => void handleControlsChanged());
controlsUi.showHikingTrailsInput.addEventListener("input", () => void handleControlsChanged());
controlsUi.showRoadsInput.addEventListener("input", () => void handleControlsChanged());
