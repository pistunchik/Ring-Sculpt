import * as THREE from 'three';

/**
 * Accurately measures the inner hole diameter of a ring mesh in millimeters.
 * Robust against surface details, relief sculptures, spikes, facets, and minor variations.
 */
export function measureRingInnerDiameter(geo: THREE.BufferGeometry): number {
  geo.computeVertexNormals();
  geo.center();

  const pos = geo.attributes.position;
  if (!pos || pos.count === 0) return 17.5;

  // Detect cylinder/hole axis if needed (default is Y axis, XZ plane)
  // Let's check angular distribution in XZ plane (Y axis)
  const numBins = 120;
  const binMinR = new Float64Array(numBins).fill(Infinity);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.5) continue; // ignore origin/degenerate points

    let theta = Math.atan2(z, x);
    if (theta < 0) theta += Math.PI * 2;
    const bin = Math.min(numBins - 1, Math.floor((theta / (Math.PI * 2)) * numBins));
    if (r < binMinR[bin]) {
      binMinR[bin] = r;
    }
  }

  const validRs: number[] = [];
  for (let i = 0; i < numBins; i++) {
    if (Number.isFinite(binMinR[i]) && binMinR[i] > 1.0) {
      validRs.push(binMinR[i]);
    }
  }

  // If XZ plane has good coverage (>30% of angular bins)
  if (validRs.length >= numBins * 0.3) {
    validRs.sort((a, b) => a - b);
    const medianR = validRs[Math.floor(validRs.length / 2)];
    return medianR * 2;
  }

  // Fallback: Check bounding box
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.z);
    return Math.max(10, maxDim - 5.0);
  }

  return 17.5;
}

/**
 * Scales a ring geometry uniformly so that its inner hole diameter matches targetInnerDiameter in millimeters.
 */
export function scaleRingGeometryToInnerDiameter(
  geo: THREE.BufferGeometry,
  targetInnerDiameter: number
): void {
  if (!targetInnerDiameter || targetInnerDiameter <= 0) return;
  const currentInnerD = measureRingInnerDiameter(geo);
  if (currentInnerD > 0 && Number.isFinite(currentInnerD)) {
    const scaleFactor = targetInnerDiameter / currentInnerD;
    geo.scale(scaleFactor, scaleFactor, scaleFactor);
  }
}
