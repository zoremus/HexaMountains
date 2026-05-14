export function queryControls() {
  return {
    viewportNode: document.querySelector("#viewport"),
    sideLengthInput: document.querySelector("#side-length"),
    sideLengthValue: document.querySelector("#side-length-value"),
    gridSizeScaleInput: document.querySelector("#grid-size-scale"),
    gridSizeScaleValue: document.querySelector("#grid-size-scale-value"),
    gridRadiusKmInput: document.querySelector("#grid-radius-km"),
    gridRadiusKmValue: document.querySelector("#grid-radius-km-value"),
    heightMultiplierInput: document.querySelector("#height-multiplier"),
    heightMultiplierValue: document.querySelector("#height-multiplier-value"),
    showHikingTrailsInput: document.querySelector("#show-hiking-trails"),
    showRoadsInput: document.querySelector("#show-roads"),
    centerLocationNode: document.querySelector("#center-location"),
    hexCountNode: document.querySelector("#hex-count"),
    renderedRadiusNode: document.querySelector("#rendered-radius"),
    sampleRadiusKmNode: document.querySelector("#sample-radius-km"),
  };
}

export function getSideLength(controls) {
  return Number.parseInt(controls.sideLengthInput.value, 10);
}

export function getGridSettings(controls) {
  return {
    sideLength: getSideLength(controls),
    gridSizeScale: Number.parseFloat(controls.gridSizeScaleInput.value),
    gridRadiusKm: Number.parseFloat(controls.gridRadiusKmInput.value),
    heightMultiplier: Number.parseFloat(controls.heightMultiplierInput.value),
  };
}

export function shouldShowHikingTrails(controls) {
  return controls.showHikingTrailsInput.checked;
}

export function shouldShowRoads(controls) {
  return controls.showRoadsInput.checked;
}

export function deriveHeightMultiplierValue(controls) {
  const sideLength = getSideLength(controls);
  const gridRadiusKm = Number.parseFloat(controls.gridRadiusKmInput.value);
  const calculatedValue = ((sideLength / gridRadiusKm) / 10) * 2;
  const minValue = Number.parseFloat(controls.heightMultiplierInput.min);
  const maxValue = Number.parseFloat(controls.heightMultiplierInput.max);

  return Math.max(minValue, Math.min(maxValue, calculatedValue));
}

export function syncDerivedHeightMultiplier(controls) {
  controls.heightMultiplierInput.value = deriveHeightMultiplierValue(controls).toFixed(1);
}

export function updateReadouts(controls, sampleOffsetKm) {
  controls.sideLengthValue.textContent = String(getSideLength(controls));
  controls.gridSizeScaleValue.textContent =
    Number.parseFloat(controls.gridSizeScaleInput.value).toFixed(2);
  controls.gridRadiusKmValue.textContent = `${controls.gridRadiusKmInput.value} km`;
  controls.centerLocationNode.textContent =
    `${sampleOffsetKm.x.toFixed(1)} km, ${sampleOffsetKm.y.toFixed(1)} km`;
  controls.heightMultiplierValue.textContent =
    Number.parseFloat(controls.heightMultiplierInput.value).toFixed(2);
}

export function updateGridStats(controls, { hexCount, renderedRadius, sampleRadiusKm }) {
  controls.hexCountNode.textContent = hexCount.toLocaleString();
  controls.renderedRadiusNode.textContent = `${renderedRadius.toFixed(3)} unit`;
  controls.sampleRadiusKmNode.textContent = `${sampleRadiusKm.toFixed(3)} km`;
}
