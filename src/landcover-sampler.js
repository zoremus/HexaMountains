import { decode } from "fast-png";
import { resolveAssetUrl } from "./asset-url.js";

const DEFAULT_LANDCOVER_URL = resolveAssetUrl("landcover/landcover_mosaic.png");
const LANDCOVER_IMAGE_SIZE_KM = 25.6;
const LANDCOVER_IMAGE_HALF_SIZE_KM = LANDCOVER_IMAGE_SIZE_KM / 2;

async function fetchAsBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch landcover image from ${url}`);
  }
  return response.blob();
}

export async function loadLandcoverSource() {
  const blob = await fetchAsBlob(DEFAULT_LANDCOVER_URL);
  const buffer = await blob.arrayBuffer();
  const png = decode(new Uint8Array(buffer));
  const channels = png.channels ?? png.data.length / (png.width * png.height);

  return {
    width: png.width,
    height: png.height,
    data: png.data,
    channels,
    sizeKm: LANDCOVER_IMAGE_SIZE_KM,
    halfSizeKm: LANDCOVER_IMAGE_HALF_SIZE_KM,
    sourceUrl: DEFAULT_LANDCOVER_URL,
  };
}

export function sampleLandcoverColorAtKm(source, xKm, zKm) {
  const u = (xKm + source.halfSizeKm) / source.sizeKm;
  const v = (zKm + source.halfSizeKm) / source.sizeKm;

  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  const x = Math.round(u * (source.width - 1));
  const y = Math.round(v * (source.height - 1));
  const index = (y * source.width + x) * source.channels;

  return {
    r: Number(source.data[index]),
    g: Number(source.data[index + 1] ?? source.data[index]),
    b: Number(source.data[index + 2] ?? source.data[index]),
  };
}
