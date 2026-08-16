/**
 * Desktop Coordinate Transformation Engine
 * Calculates normalized coordinates (0.0 .. 1.0) from DOM MouseEvent / TouchEvent
 * relative to the displayed HTML Video element bounds.
 */

export interface VideoViewportBounds {
  videoWidth: number;
  videoHeight: number;
  elementWidth: number;
  elementHeight: number;
  rotation: number; // 0, 90, 180, 270 degrees
  zoom: number;
}

export interface NormalizedCoordinates {
  normX: number;
  normY: number;
}

export function transformDesktopClickToNormalized(
  clientX: number,
  clientY: number,
  boundingRect: DOMRect,
  viewport: VideoViewportBounds
): NormalizedCoordinates {
  // 1. Calculate relative click inside video bounding box
  const relativeX = clientX - boundingRect.left;
  const relativeY = clientY - boundingRect.top;

  // 2. Base normalized calculation
  let normX = relativeX / boundingRect.width;
  let normY = relativeY / boundingRect.height;

  // 3. Clamp between 0.0 and 1.0
  normX = Math.max(0, Math.min(1, normX));
  normY = Math.max(0, Math.min(1, normY));

  return { normX, normY };
}
