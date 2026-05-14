export const HEIGHT_METERS_TO_SCENE_UNITS = 1 / 1000;
export const GRID_SIZE_SCENE_SCALE = 0.1;
export const SAMPLE_PAN_SPEED = 4;

export const POLYLINE_CURVE_TENSION = 0.15;
export const POLYLINE_MIN_POINTS = 12;

export const HIKING_TRAIL_STYLE = {
  baseHeightOffsetSceneUnits: 0.03,
  colorHeightOffsets: {
    red: 0.075,
    blue: 0.06,
    green: 0.045,
    yellow: 0.035,
  },
  lineWidthPixels: 3,
  pointKeepRatio: 0.1,
  runMergeDistanceKm: 0.16,
};

export const ROAD_STYLE = {
  baseHeightOffsetSceneUnits: 0.04,
  lineWidthPixels: 6,
  pointKeepRatio: 0.1,
  runMergeDistanceKm: 0.16,
};
