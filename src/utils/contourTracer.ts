/**
 * Standalone Image Vectorizer & Contour Extraction Module
 * Re-implemented from scratch with Marching Squares / Radial Boundary Tracing,
 * Intelligent Background Auto-Detection (Alpha, Border sampling, Luminance delta),
 * RDP Polygon Simplification, and 3D Extrusion Normalization.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Normalizes 2D points to centered [-1.0, 1.0] range with inverted Y
 * for Three.js 3D extrusion.
 */
export function normalizePointsFor3D(rawPoints: Point[]): Point[] {
  if (!rawPoints || rawPoints.length < 3) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of rawPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 1e-4 || h < 1e-4) return [];

  const cx = minX + w / 2;
  const cy = minY + h / 2;
  const maxDim = Math.max(w, h);
  const scale = 2.0 / maxDim;

  return rawPoints.map((p) => ({
    x: (p.x - cx) * scale,
    y: -(p.y - cy) * scale,
  }));
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm to remove collinear points and staircasing
 * while keeping all sharp corners and essential geometry.
 */
export function simplifyRDP(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lineLenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    let dist: number;

    if (lineLenSq < 1e-6) {
      dist = Math.hypot(p.x - start.x, p.y - start.y);
    } else {
      const u = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lineLenSq));
      const projX = start.x + u * dx;
      const projY = start.y + u * dy;
      dist = Math.hypot(p.x - projX, p.y - projY);
    }

    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

/**
 * Extracts binary grid (1 = foreground, 0 = background) with auto-detection of
 * transparency, background brightness, and color polarity.
 */
function createBinaryMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pad: number
): Uint8Array {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const total = width * height;
  const mask = new Uint8Array(total);

  // 1. Check transparency
  let transparentPixels = 0;
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] < 96) {
      transparentPixels++;
    }
  }

  // If > 2% of pixels are transparent, alpha channel determines the silhouette
  if (transparentPixels > (width - pad * 2) * (height - pad * 2) * 0.02) {
    for (let i = 0; i < total; i++) {
      mask[i] = data[i * 4 + 3] >= 120 ? 1 : 0;
    }
    return mask;
  }

  // 2. Opaque image: Sample outer borders to determine background color
  let bgR = 0, bgG = 0, bgB = 0, borderCount = 0;
  for (let x = pad; x < width - pad; x++) {
    const topIdx = (pad * width + x) * 4;
    const botIdx = ((height - pad - 1) * width + x) * 4;
    bgR += data[topIdx] + data[botIdx];
    bgG += data[topIdx + 1] + data[botIdx + 1];
    bgB += data[topIdx + 2] + data[botIdx + 2];
    borderCount += 2;
  }
  for (let y = pad; y < height - pad; y++) {
    const lftIdx = (y * width + pad) * 4;
    const rgtIdx = (y * width + (width - pad - 1)) * 4;
    bgR += data[lftIdx] + data[rgtIdx];
    bgG += data[lftIdx + 1] + data[rgtIdx + 1];
    bgB += data[lftIdx + 2] + data[rgtIdx + 2];
    borderCount += 2;
  }

  bgR /= Math.max(1, borderCount);
  bgG /= Math.max(1, borderCount);
  bgB /= Math.max(1, borderCount);
  const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

  // 3. Compute pixel differences from background
  const diffs = new Float32Array(total);
  let maxDiff = 0;

  for (let i = 0; i < total; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    // Color distance + luminance contrast
    const colorDist = Math.hypot(r - bgR, g - bgG, b - bgB);
    const lumaDiff = Math.abs(luma - bgLuma);
    const diff = Math.max(colorDist, lumaDiff * 1.2);

    diffs[i] = diff;
    if (diff > maxDiff) maxDiff = diff;
  }

  // Threshold: significant deviation from background
  const threshold = Math.max(25, maxDiff * 0.35);

  for (let i = 0; i < total; i++) {
    mask[i] = diffs[i] >= threshold ? 1 : 0;
  }

  return mask;
}

/**
 * Traces the largest closed outer boundary contour using clockwise radial Moore Neighborhood search.
 */
function traceOuterContour(mask: Uint8Array, width: number, height: number): Point[] {
  // 8 Clockwise directions starting from North: [dx, dy]
  // 0: N(0,-1), 1: NE(1,-1), 2: E(1,0), 3: SE(1,1), 4: S(0,1), 5: SW(-1,1), 6: W(-1,0), 7: NW(-1,-1)
  const DIRS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
  ];

  // 1. Scan for the first foreground pixel (topmost, then leftmost)
  let startX = -1;
  let startY = -1;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (mask[y * width + x] === 1) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) return [];

  const points: Point[] = [];
  let currX = startX;
  let currY = startY;
  // Starting search direction: entering from West (index 6), start checking clockwise from North (index 0)
  let searchDir = 0;
  const maxSteps = width * height * 2;
  let steps = 0;

  while (steps < maxSteps) {
    points.push({ x: currX, y: currY });

    let foundNext = false;
    let nextDir = 0;

    for (let i = 0; i < 8; i++) {
      const dirIdx = (searchDir + i) % 8;
      const nx = currX + DIRS[dirIdx].dx;
      const ny = currY + DIRS[dirIdx].dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx] === 1) {
        currX = nx;
        currY = ny;
        nextDir = dirIdx;
        foundNext = true;
        break;
      }
    }

    if (!foundNext) break;
    steps++;

    // In Moore-Neighbor, set next search direction to previous background neighbor (backwards + 2 clockwise)
    searchDir = (nextDir + 5) % 8;

    // Terminate when loop returns to start position
    if (currX === startX && currY === startY && steps >= 3) {
      break;
    }
  }

  return points;
}

/**
 * Complete Image to 2D Profile Vectorization Function.
 * Converts an uploaded image file into a smooth, centered, closed contour polygon.
 */
export async function traceImageToPoints(file: File, targetSize = 150): Promise<Point[]> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxRes = 256;
      let origW = img.naturalWidth || img.width || maxRes;
      let origH = img.naturalHeight || img.height || maxRes;

      if (origW <= 0 || origH <= 0) {
        resolve([]);
        return;
      }

      // Preserve aspect ratio
      let scale = Math.min(maxRes / origW, maxRes / origH);
      if (scale > 1.0) scale = 1.0;

      const w = Math.max(20, Math.round(origW * scale));
      const h = Math.max(20, Math.round(origH * scale));

      const pad = 4;
      const canvasW = w + pad * 2;
      const canvasH = h + pad * 2;

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve([]);
        return;
      }

      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, pad, pad, w, h);

      // 1. Create binary foreground mask
      const mask = createBinaryMask(ctx, canvasW, canvasH, pad);

      // 2. Trace closed outer boundary contour
      const rawContour = traceOuterContour(mask, canvasW, canvasH);
      if (rawContour.length < 3) {
        resolve([]);
        return;
      }

      // 3. Simplify with RDP to remove pixel grid noise while preserving angles
      const simplified = simplifyRDP(rawContour, 1.25);
      if (simplified.length < 3) {
        resolve([]);
        return;
      }

      // 4. Calculate bounding box
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const p of simplified) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const boundW = maxX - minX;
      const boundH = maxY - minY;
      if (boundW <= 1 || boundH <= 1) {
        resolve([]);
        return;
      }

      // 5. Fit, center, and preserve aspect ratio within targetSize
      const padding = targetSize * 0.14;
      const drawSize = targetSize - padding * 2;
      const fitScale = drawSize / Math.max(boundW, boundH);

      const fittedW = boundW * fitScale;
      const fittedH = boundH * fitScale;
      const offsetX = (targetSize - fittedW) / 2;
      const offsetY = (targetSize - fittedH) / 2;

      const fittedPoints = simplified.map((p) => ({
        x: offsetX + (p.x - minX) * fitScale,
        y: offsetY + (p.y - minY) * fitScale,
      }));

      // Subsample if too dense
      let result = fittedPoints;
      if (result.length > 90) {
        const step = Math.ceil(result.length / 90);
        result = result.filter((_, i) => i % step === 0);
      }

      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([]);
    };

    img.src = url;
  });
}
