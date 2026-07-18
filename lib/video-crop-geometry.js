export function videoAspectFromDimensions(dimensions, fallback = 16 / 9) {
  const width = Number(dimensions?.w ?? dimensions?.width);
  const height = Number(dimensions?.h ?? dimensions?.height);
  return width > 0 && height > 0 ? width / height : fallback;
}

export function computeNormalizedCropWindow({
  videoAspect,
  targetAspect,
  videoScale = 100,
  videoX = 0,
  videoY = 0,
}) {
  const sourceAspect = Number(videoAspect) > 0 ? Number(videoAspect) : 16 / 9;
  const outputAspect = Number(targetAspect) > 0 ? Number(targetAspect) : 1;
  const zoom = Math.max(Number(videoScale) || 100, 1) / 100;
  let width;
  let height;

  if (sourceAspect >= outputAspect) {
    height = 1 / zoom;
    width = outputAspect / (sourceAspect * zoom);
  } else {
    width = 1 / zoom;
    height = sourceAspect / (outputAspect * zoom);
  }

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const left = clamp(Number(videoX || 0) / 400 + (1 - width) / 2, Math.min(0, 1 - width), Math.max(0, 1 - width));
  const top = clamp(Number(videoY || 0) / 400 + (1 - height) / 2, Math.min(0, 1 - height), Math.max(0, 1 - height));

  return { left, top, width, height };
}
