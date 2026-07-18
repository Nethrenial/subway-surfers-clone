import { describe, expect, it } from 'vitest';
import {
  EARTH_CURVE_RADIUS,
  sampleTrackChordRenderPose,
  sampleTrackRenderPose,
  trackCurveDrop,
  trackCurvePitch,
} from '../src/systems/TrackCurve';

describe('TrackCurve', () => {
  it('keeps the player tangent flat and rolls only the route ahead toward the horizon', () => {
    expect(trackCurveDrop(4.1)).toBe(0);
    expect(trackCurvePitch(4.1)).toBe(0);
    expect(trackCurveDrop(-64)).toBeLessThan(-4.8);
    expect(trackCurvePitch(-64)).toBeCloseTo(-64 / EARTH_CURVE_RADIUS);
  });

  it('maps forward distance onto a circular vertical arc', () => {
    const pose = sampleTrackRenderPose(0, -100);
    expect(Math.hypot(pose.z, EARTH_CURVE_RADIUS + pose.y)).toBeCloseTo(EARTH_CURVE_RADIUS, 8);
    expect(pose.pitch).toBeCloseTo(-100 / EARTH_CURVE_RADIUS);
  });

  it('keeps every lane laterally straight at the same height and depth', () => {
    const center = sampleTrackRenderPose(0, -30);
    const rightLane = sampleTrackRenderPose(2.35, -30);

    expect(center.x).toBe(0);
    expect(rightLane.x).toBe(2.35);
    expect(rightLane.y).toBe(center.y);
    expect(rightLane.z).toBe(center.z);
    expect(rightLane.pitch).toBe(center.pitch);
  });

  it('grounds rigid pieces on the curve at both longitudinal edges', () => {
    const halfLength = 6;
    const logicalZ = -18;
    const pose = sampleTrackChordRenderPose(0, logicalZ, halfLength);
    const nearEdgeY = pose.y - Math.sin(pose.pitch) * halfLength;
    const farEdgeY = pose.y + Math.sin(pose.pitch) * halfLength;

    expect(nearEdgeY).toBeCloseTo(trackCurveDrop(logicalZ + halfLength), 3);
    expect(farEdgeY).toBeCloseTo(trackCurveDrop(logicalZ - halfLength), 3);
  });
});
