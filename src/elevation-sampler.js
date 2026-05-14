import { decode } from "fast-png";

const DEFAULT_ELEVATION_URL = "/elevation/elevation_mosaic.png";
const ELEVATION_IMAGE_SIZE_KM = 25.6;
const ELEVATION_IMAGE_HALF_SIZE_KM = ELEVATION_IMAGE_SIZE_KM / 2;
const MISSING_ELEVATION_THRESHOLD = 10000;

async function fetchAsBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch elevation image from ${url}`);
  }
  return response.blob();
}

export async function loadElevationSource() {
  const blob = await fetchAsBlob(DEFAULT_ELEVATION_URL);
  const buffer = await blob.arrayBuffer();
  const png = decode(new Uint8Array(buffer));
  const channels = png.channels ?? png.data.length / (png.width * png.height);

  return {
    width: png.width,
    height: png.height,
    data: png.data,
    channels,
    sizeKm: ELEVATION_IMAGE_SIZE_KM,
    halfSizeKm: ELEVATION_IMAGE_HALF_SIZE_KM,
    sourceUrl: DEFAULT_ELEVATION_URL,
  };
}

export function sampleElevationMetersAtKm(source, xKm, zKm) {
  const u = (xKm + source.halfSizeKm) / source.sizeKm;
  const v = (zKm + source.halfSizeKm) / source.sizeKm;

  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  const x = Math.round(u * (source.width - 1));
  const y = Math.round(v * (source.height - 1));
  const index = (y * source.width + x) * source.channels;
  const value = Number(source.data[index]);

  if (value >= MISSING_ELEVATION_THRESHOLD) {
    return null;
  }

  return value;
}
