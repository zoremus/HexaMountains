import { loadElevationSource } from "./elevation-sampler.js";
import { loadHikingTrailsSource } from "./hiking-trails-source.js";
import { loadLandcoverSource } from "./landcover-sampler.js";
import { loadRoadsSource } from "./roads-source.js";

export function createSourceCache() {
  let elevationSource = null;
  let hikingTrailsSource = null;
  let landcoverSource = null;
  let roadsSource = null;

  return {
    async ensureElevationLoaded() {
      elevationSource ??= await loadElevationSource();
      return elevationSource;
    },

    async ensureLandcoverLoaded() {
      landcoverSource ??= await loadLandcoverSource();
      return landcoverSource;
    },

    async ensureHikingTrailsLoaded() {
      hikingTrailsSource ??= await loadHikingTrailsSource();
      return hikingTrailsSource;
    },

    async ensureRoadsLoaded() {
      roadsSource ??= await loadRoadsSource();
      return roadsSource;
    },
  };
}
