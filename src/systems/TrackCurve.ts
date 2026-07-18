export const EARTH_CURVE_RADIUS = 420;

export interface TrackRenderPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
}

export function trackCurveDrop(logicalZ: number): number {
  const distanceAhead = Math.max(0, -logicalZ);
  return EARTH_CURVE_RADIUS * (Math.cos(distanceAhead / EARTH_CURVE_RADIUS) - 1);
}

export function trackCurvePitch(logicalZ: number): number {
  return logicalZ < 0 ? logicalZ / EARTH_CURVE_RADIUS : 0;
}

export function trackCurveRenderZ(logicalZ: number): number {
  const distanceAhead = Math.max(0, -logicalZ);
  return logicalZ < 0 ? -EARTH_CURVE_RADIUS * Math.sin(distanceAhead / EARTH_CURVE_RADIUS) : logicalZ;
}

export function sampleTrackRenderPose(
  logicalX: number,
  logicalZ: number,
  target: TrackRenderPose = { x: 0, y: 0, z: 0, pitch: 0 },
): TrackRenderPose {
  const distanceAhead = Math.max(0, -logicalZ);
  target.x = logicalX;
  target.y = trackCurveDrop(logicalZ);
  target.z = logicalZ < 0 ? -EARTH_CURVE_RADIUS * Math.sin(distanceAhead / EARTH_CURVE_RADIUS) : logicalZ;
  target.pitch = trackCurvePitch(logicalZ);
  return target;
}

export function sampleTrackChordRenderPose(
  logicalX: number,
  logicalZ: number,
  halfLength: number,
  target: TrackRenderPose = { x: 0, y: 0, z: 0, pitch: 0 },
): TrackRenderPose {
  const nearLogicalZ = logicalZ + halfLength;
  const farLogicalZ = logicalZ - halfLength;
  const nearY = trackCurveDrop(nearLogicalZ);
  const farY = trackCurveDrop(farLogicalZ);
  const nearZ = trackCurveRenderZ(nearLogicalZ);
  const farZ = trackCurveRenderZ(farLogicalZ);
  target.x = logicalX;
  target.y = (nearY + farY) * 0.5;
  target.z = (nearZ + farZ) * 0.5;
  target.pitch = -Math.atan2(nearY - farY, nearZ - farZ);
  return target;
}
