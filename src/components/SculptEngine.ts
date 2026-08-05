import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export enum SculptTool {
  Clay = 'Clay',
  Inflate = 'Inflate',
  Pinch = 'Pinch',
  Smooth = 'Smooth',
  Grab = 'Grab',
  Twist = 'Twist',
  Flatten = 'Flatten',
  Noise = 'Noise',
  Carve = 'Carve',
}

export interface PlacedInsert {
  id: string;
  type: 'circle' | 'triangle' | 'square' | 'heart' | 'custom';
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  height: number;
  bevel: number;
  scale: number;
  customPoints?: { x: number; y: number }[];
}

export interface HistoryState {
  positions: Float32Array;
  inserts: PlacedInsert[];
}

export interface BrushConfig {
  tool: SculptTool;
  radius: number;
  intensity: number;
  isSubtract: boolean;
}

export interface RingParams {
  innerDiameter: number; // in mm
  width: number;        // in mm
  thickness: number;    // in mm
}

export class SculptEngine {
  private geometry: THREE.BufferGeometry;
  
  // Sculpting state
  public originalPositions: Float32Array;
  public currentPositions: Float32Array;
  public vertexCount: number = 0;

  // Inscription text state
  public inscriptionText: string = "";
  public inscriptionDepth: number = 50; // 0-100%
  public inscriptionSize: number = 100; // 50-150%
  public inscriptionWeight: number = 10; // 1-20
  private inscriptionPixels: Uint8Array | null = null;
  private cachedInscriptionText: string = "";
  private cachedInscriptionSize: number = 100;
  private cachedInscriptionWeight: number = 10;
  public lastRingParams: RingParams | null = null;
  private displacedPositions: Float32Array | null = null;

  public setRingParams(params: RingParams) {
    this.lastRingParams = params;
  }

  public loadSTLDataUrl(dataUrl: string, onComplete?: () => void) {
    try {
      const base64Str = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const binary = atob(base64Str);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const loader = new STLLoader();
      const loadedGeo = loader.parse(bytes.buffer);
      loadedGeo.computeVertexNormals();
      loadedGeo.center();

      loadedGeo.computeBoundingBox();
      if (loadedGeo.boundingBox) {
        const size = new THREE.Vector3();
        loadedGeo.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scaleFactor = 18.0 / maxDim;
          loadedGeo.scale(scaleFactor, scaleFactor, scaleFactor);
        }
      }

      this.geometry.dispose();
      this.geometry = loadedGeo;
      const posAttr = this.geometry.attributes.position;
      this.vertexCount = posAttr.count;
      this.originalPositions = new Float32Array(posAttr.array);
      this.currentPositions = new Float32Array(posAttr.array);
      this.precomputeStructure();

      if (onComplete) onComplete();
    } catch (err) {
      console.error('Error parsing STL data in SculptEngine:', err);
    }
  }

  // Placed decorative inserts
  public placedInserts: PlacedInsert[] = [];

  // Geometry structural maps
  private weldMap: number[][] = [];       // Maps each vertex index to all indices that share the same coordinates
  private adjacencyList: number[][] = [];  // Vertex adjacency list for Laplacian smoothing

  // Undo/Redo stacks (each stores a HistoryState)
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private maxHistory: number = 50;

  // Relaxation animation
  private isRelaxing: boolean = false;
  private relaxationStartTime: number = 0;
  private relaxationDuration: number = 400; // ms
  private relaxationPositionsStart: Float32Array | null = null;
  private relaxationPositionsTarget: Float32Array | null = null;

  constructor(geometry: THREE.BufferGeometry) {
    this.geometry = geometry;
    const posAttr = this.geometry.attributes.position;
    this.vertexCount = posAttr.count;

    // Cache original and current positions
    this.originalPositions = new Float32Array(posAttr.array);
    this.currentPositions = new Float32Array(posAttr.array);

    this.precomputeStructure();
  }

  /**
   * Welds coincident vertices (to avoid seam separation) and precomputes
   * the topological adjacency list (edges) for instant Laplacian smoothing.
   */
  private precomputeStructure() {
    const positions = this.currentPositions;
    const count = this.vertexCount;

    // 1. Build weld map
    // We group vertices that are practically at the exact same location in 3D space.
    this.weldMap = Array.from({ length: count }, () => []);
    
    // Hash-based welding for O(N) performance
    const precision = 1000; // 1 micrometer precision
    const hashMap = new Map<string, number[]>();

    for (let i = 0; i < count; i++) {
      const x = Math.round(positions[i * 3] * precision) / precision;
      const y = Math.round(positions[i * 3 + 1] * precision) / precision;
      const z = Math.round(positions[i * 3 + 2] * precision) / precision;
      const key = `${x},${y},${z}`;

      if (!hashMap.has(key)) {
        hashMap.set(key, []);
      }
      hashMap.get(key)!.push(i);
    }

    hashMap.forEach((indices) => {
      indices.forEach((i) => {
        this.weldMap[i] = indices;
      });
    });

    // 2. Build adjacency list based on triangles
    this.adjacencyList = Array.from({ length: count }, () => []);
    const indexAttr = this.geometry.index;

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const a = indexAttr.getX(i);
        const b = indexAttr.getX(i + 1);
        const c = indexAttr.getX(i + 2);

        this.addEdge(a, b);
        this.addEdge(b, c);
        this.addEdge(c, a);
      }
    } else {
      // Non-indexed geometry: treat consecutive triplets as triangles
      for (let i = 0; i < count; i += 3) {
        this.addEdge(i, i + 1);
        this.addEdge(i + 1, i + 2);
        this.addEdge(i + 2, i);
      }
    }
  }

  private addEdge(u: number, v: number) {
    // Add edges between u and v, and also between their welded twins
    const uTwins = this.weldMap[u] || [u];
    const vTwins = this.weldMap[v] || [v];

    for (const ut of uTwins) {
      for (const vt of vTwins) {
        if (ut !== vt) {
          if (!this.adjacencyList[ut].includes(vt)) {
            this.adjacencyList[ut].push(vt);
          }
          if (!this.adjacencyList[vt].includes(ut)) {
            this.adjacencyList[vt].push(ut);
          }
        }
      }
    }
  }

  /**
   * Saves the current mesh state for Undo/Redo.
   */
  public saveState() {
    this.undoStack.push({
      positions: new Float32Array(this.currentPositions),
      inserts: JSON.parse(JSON.stringify(this.placedInserts))
    });
    this.redoStack = []; // Clear redo stack on new action
    
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo() {
    if (!this.canUndo()) return;
    const previous = this.undoStack.pop()!;
    this.redoStack.push({
      positions: new Float32Array(this.currentPositions),
      inserts: JSON.parse(JSON.stringify(this.placedInserts))
    });
    
    this.currentPositions.set(previous.positions);
    this.placedInserts = previous.inserts;
    this.updateGeometryBuffer();
  }

  public redo() {
    if (!this.canRedo()) return;
    const next = this.redoStack.pop()!;
    this.undoStack.push({
      positions: new Float32Array(this.currentPositions),
      inserts: JSON.parse(JSON.stringify(this.placedInserts))
    });

    this.currentPositions.set(next.positions);
    this.placedInserts = next.inserts;
    this.updateGeometryBuffer();
  }

  public reset(originalGeometry: THREE.BufferGeometry) {
    this.geometry = originalGeometry;
    const posAttr = originalGeometry.attributes.position;
    this.vertexCount = posAttr.count;

    this.originalPositions = new Float32Array(posAttr.array);
    this.currentPositions = new Float32Array(posAttr.array);
    
    this.placedInserts = [];
    this.undoStack = [];
    this.redoStack = [];
    
    this.precomputeStructure();
    this.updateGeometryBuffer();
  }

  /**
   * Applies a sculpting stroke on the vertices on the CPU with full plane and axial symmetry.
   */
  public sculpt(
    config: BrushConfig,
    intersectPt: THREE.Vector3,
    intersectNormal: THREE.Vector3,
    ringParams: RingParams,
    dragVector?: THREE.Vector3,
    symmetryEnabled?: boolean,
    symmetryPlane?: boolean,
    symmetryRadialCount?: number,
    autoSmoothEnabled?: boolean,
    autoSmoothStrength?: number,
    symmetryPlanePerp?: boolean
  ) {
    const { tool, radius, intensity, isSubtract } = config;
    const posAttr = this.geometry.attributes.position;
    const positions = this.currentPositions;
    const count = this.vertexCount;

    // Define internal parameters
    const innerRadius = ringParams.innerDiameter / 2;
    const minThickness = 1.8; // mm (as requested)

    // Pre-calculate brush parameters
    const sign = isSubtract ? -1 : 1;
    const radiusSq = radius * radius;
    
    // We can compute a vertex normal array if needed, but since we have a torus, 
    // the local direction from the ring's core Z-axis (radial normal) is an extremely 
    // stable normal for thickness/inflation.
    const radialNormal = new THREE.Vector3();
    const vPos = new THREE.Vector3();
    const delta = new THREE.Vector3();

    // Track if any vertex was modified to optimize normals computation
    let modified = false;
    const modifiedIndices: number[] = [];

    // Generate virtual brushes for symmetry
    const virtualBrushes: { point: THREE.Vector3; normal: THREE.Vector3; drag: THREE.Vector3 }[] = [];

    const addUniqueBrush = (pt: THREE.Vector3, norm: THREE.Vector3, drag: THREE.Vector3) => {
      for (const b of virtualBrushes) {
        if (b.point.distanceTo(pt) < 0.001) return;
      }
      virtualBrushes.push({ point: pt, normal: norm, drag: drag });
    };

    const origPt = intersectPt.clone();
    const origNorm = intersectNormal.clone();
    const origDrag = dragVector ? dragVector.clone() : new THREE.Vector3();

    if (!symmetryEnabled) {
      addUniqueBrush(origPt, origNorm, origDrag);
    } else {
      const radialCount = Math.max(1, Math.min(8, symmetryRadialCount || 1));

      const rotateZ = (vec: THREE.Vector3, angle: number): THREE.Vector3 => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new THREE.Vector3(
          vec.x * cos - vec.y * sin,
          vec.x * sin + vec.y * cos,
          vec.z
        );
      };

      const mirrorZ = (vec: THREE.Vector3): THREE.Vector3 => {
        return new THREE.Vector3(vec.x, vec.y, -vec.z);
      };

      const mirrorX = (vec: THREE.Vector3): THREE.Vector3 => {
        return new THREE.Vector3(-vec.x, vec.y, vec.z);
      };

      for (let k = 0; k < radialCount; k++) {
        const angle = (k * 2 * Math.PI) / radialCount;

        const ptRot = rotateZ(origPt, angle);
        const normRot = rotateZ(origNorm, angle);
        const dragRot = rotateZ(origDrag, angle);

        addUniqueBrush(ptRot, normRot, dragRot);

        if (symmetryPlane) {
          const ptMirZ = mirrorZ(ptRot);
          const normMirZ = mirrorZ(normRot);
          const dragMirZ = mirrorZ(dragRot);
          addUniqueBrush(ptMirZ, normMirZ, dragMirZ);
        }

        if (symmetryPlanePerp) {
          const ptMirX = mirrorX(ptRot);
          const normMirX = mirrorX(normRot);
          const dragMirX = mirrorX(dragRot);
          addUniqueBrush(ptMirX, normMirX, dragMirX);
        }

        if (symmetryPlane && symmetryPlanePerp) {
          const ptMirXZ = mirrorZ(mirrorX(ptRot));
          const normMirXZ = mirrorZ(mirrorX(normRot));
          const dragMirXZ = mirrorZ(mirrorX(dragRot));
          addUniqueBrush(ptMirXZ, normMirXZ, dragMirXZ);
        }
      }
    }

    for (let i = 0; i < count; i++) {
      vPos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      let vertexModified = false;

      for (const brush of virtualBrushes) {
        // Distance from virtual brush center to vertex
        delta.subVectors(vPos, brush.point);
        const distSq = delta.lengthSq();

        if (distSq < radiusSq) {
          modified = true;
          vertexModified = true;
          const dist = Math.sqrt(distSq);
          
          // Beautiful cosine brush falloff (soft center, smooth edge)
          const ratio = dist / radius;
          const weight = Math.cos(ratio * Math.PI / 2);
          const wEffect = weight * weight * intensity * 0.15;

          // Compute local radial vector (pointing directly outwards from the Z-axis center)
          radialNormal.set(vPos.x, vPos.y, 0).normalize();

          // 1. Calculate safe mask (prevents inner ring deformation)
          const currentDxy = Math.sqrt(vPos.x * vPos.x + vPos.y * vPos.y);
          // Lock vertices that are very close to inner radius
          const safetyMask = THREE.MathUtils.clamp((currentDxy - (innerRadius + 0.2)) / 0.8, 0, 1);
          const effectiveWeight = wEffect * safetyMask;

          if (effectiveWeight <= 0) continue;

          switch (tool) {
            case SculptTool.Clay: {
              const displaceDir = brush.normal;
              vPos.addScaledVector(displaceDir, sign * effectiveWeight);
              break;
            }
            case SculptTool.Inflate: {
              vPos.addScaledVector(radialNormal, sign * effectiveWeight);
              break;
            }
            case SculptTool.Pinch: {
              const pullDir = delta.normalize().negate();
              vPos.addScaledVector(pullDir, effectiveWeight * 0.4);
              break;
            }
            case SculptTool.Smooth: {
              const neighbors = this.adjacencyList[i];
              if (neighbors.length > 0) {
                const avg = new THREE.Vector3();
                for (const n of neighbors) {
                  avg.x += positions[n * 3];
                  avg.y += positions[n * 3 + 1];
                  avg.z += positions[n * 3 + 2];
                }
                avg.divideScalar(neighbors.length);
                vPos.lerp(avg, effectiveWeight * 0.5);
              }
              break;
            }
            case SculptTool.Grab: {
              if (brush.drag && brush.drag.lengthSq() > 0) {
                vPos.addScaledVector(brush.drag, effectiveWeight * 3.5);
              }
              break;
            }
            case SculptTool.Twist: {
              const rotateAxis = brush.normal.clone().normalize();
              vPos.sub(brush.point);
              const angle = sign * effectiveWeight * 1.5;
              vPos.applyAxisAngle(rotateAxis, angle);
              vPos.add(brush.point);
              break;
            }
            case SculptTool.Flatten: {
              const dot = delta.dot(brush.normal);
              const projection = vPos.clone().addScaledVector(brush.normal, -dot);
              vPos.lerp(projection, effectiveWeight * 0.6);
              break;
            }
            case SculptTool.Noise: {
              const noiseScaleX = Math.sin(vPos.x * 2.5 + vPos.y * 3.0) * 0.15;
              const noiseScaleY = Math.cos(vPos.y * 2.5 - vPos.z * 3.0) * 0.15;
              const noiseScaleZ = Math.sin(vPos.z * 4.0) * 0.15;
              const totalNoise = (noiseScaleX + noiseScaleY + noiseScaleZ);
              vPos.addScaledVector(radialNormal, totalNoise * effectiveWeight * 2.0);
              break;
            }
            case SculptTool.Carve: {
              vPos.addScaledVector(radialNormal, -effectiveWeight);
              break;
            }
          }
        }
      }

      if (vertexModified) {
        // Apply thickness checks instantly during deform to prevent holes
        const origX = this.originalPositions[i * 3];
        const origY = this.originalPositions[i * 3 + 1];
        const origDxy = Math.sqrt(origX * origX + origY * origY);
        const t = THREE.MathUtils.clamp((origDxy - innerRadius) / ringParams.thickness, 0, 1);
        const minDxyConstraint = innerRadius + t * minThickness;

        const newDxy = Math.sqrt(vPos.x * vPos.x + vPos.y * vPos.y);
        if (newDxy < minDxyConstraint) {
          const scale = minDxyConstraint / newDxy;
          vPos.x *= scale;
          vPos.y *= scale;
        }

        // Store back
        positions[i * 3] = vPos.x;
        positions[i * 3 + 1] = vPos.y;
        positions[i * 3 + 2] = vPos.z;

        modifiedIndices.push(i);
      }
    }

    if (modified) {
      // Automatic Local Laplacian Smoothing pass to keep clay sculpt strokes from being rough/coarse
      if (autoSmoothEnabled && tool !== SculptTool.Smooth && modifiedIndices.length > 0) {
        const smoothStrength = autoSmoothStrength !== undefined ? autoSmoothStrength : 0.5;
        
        // Use 1 iteration of local relaxation
        const tempPositions = new Float32Array(positions);
        for (const idx of modifiedIndices) {
          const neighbors = this.adjacencyList[idx];
          if (neighbors.length === 0) continue;

          let sumX = 0, sumY = 0, sumZ = 0;
          for (const n of neighbors) {
            sumX += tempPositions[n * 3];
            sumY += tempPositions[n * 3 + 1];
            sumZ += tempPositions[n * 3 + 2];
          }

          const avgX = sumX / neighbors.length;
          const avgY = sumY / neighbors.length;
          const avgZ = sumZ / neighbors.length;

          const currentDxy = Math.sqrt(tempPositions[idx * 3] * tempPositions[idx * 3] + tempPositions[idx * 3 + 1] * tempPositions[idx * 3 + 1]);
          const safetyMask = THREE.MathUtils.clamp((currentDxy - (innerRadius + 0.2)) / 0.8, 0, 1);
          
          // Moderate, stable blend factor proportional to user's setting
          const lerpFactor = 0.22 * smoothStrength * safetyMask;

          let nextX = THREE.MathUtils.lerp(positions[idx * 3], avgX, lerpFactor);
          let nextY = THREE.MathUtils.lerp(positions[idx * 3 + 1], avgY, lerpFactor);
          let nextZ = THREE.MathUtils.lerp(positions[idx * 3 + 2], avgZ, lerpFactor);

          // Enforce minimum thickness
          const origX = this.originalPositions[idx * 3];
          const origY = this.originalPositions[idx * 3 + 1];
          const origDxy = Math.sqrt(origX * origX + origY * origY);
          const t = THREE.MathUtils.clamp((origDxy - innerRadius) / ringParams.thickness, 0, 1);
          const minDxyConstraint = innerRadius + t * minThickness;

          const dxy = Math.sqrt(nextX * nextX + nextY * nextY);
          if (dxy < minDxyConstraint) {
            const scale = minDxyConstraint / dxy;
            nextX *= scale;
            nextY *= scale;
          }

          positions[idx * 3] = nextX;
          positions[idx * 3 + 1] = nextY;
          positions[idx * 3 + 2] = nextZ;
        }
      }

      this.enforceWeldMap();
      this.updateGeometryBuffer();
    }
  }

  /**
   * Applies a global Laplacian smoothing pass over all vertices of the ring.
   * Allows manual instant smoothing of the entire rough model.
   */
  public smoothAll(ringParams: RingParams, iterations: number = 3, strength: number = 0.3) {
    const positions = this.currentPositions;
    const count = this.vertexCount;
    const innerRadius = ringParams.innerDiameter / 2;
    const minThickness = 1.8;

    // Execute multiple iterations of global Laplacian smoothing
    for (let iter = 0; iter < iterations; iter++) {
      const tempPositions = new Float32Array(positions);

      for (let i = 0; i < count; i++) {
        const neighbors = this.adjacencyList[i];
        if (neighbors.length === 0) continue;

        let sumX = 0, sumY = 0, sumZ = 0;
        for (const n of neighbors) {
          sumX += tempPositions[n * 3];
          sumY += tempPositions[n * 3 + 1];
          sumZ += tempPositions[n * 3 + 2];
        }

        const avgX = sumX / neighbors.length;
        const avgY = sumY / neighbors.length;
        const avgZ = sumZ / neighbors.length;

        const currentDxy = Math.sqrt(tempPositions[i * 3] * tempPositions[i * 3] + tempPositions[i * 3 + 1] * tempPositions[i * 3 + 1]);
        const safetyMask = THREE.MathUtils.clamp((currentDxy - (innerRadius + 0.2)) / 0.8, 0, 1);
        const lerpFactor = strength * safetyMask;

        let nextX = THREE.MathUtils.lerp(tempPositions[i * 3], avgX, lerpFactor);
        let nextY = THREE.MathUtils.lerp(tempPositions[i * 3 + 1], avgY, lerpFactor);
        let nextZ = THREE.MathUtils.lerp(tempPositions[i * 3 + 2], avgZ, lerpFactor);

        // Enforce min thickness
        const origX = this.originalPositions[i * 3];
        const origY = this.originalPositions[i * 3 + 1];
        const origDxy = Math.sqrt(origX * origX + origY * origY);
        const t = THREE.MathUtils.clamp((origDxy - innerRadius) / ringParams.thickness, 0, 1);
        const minDxyConstraint = innerRadius + t * minThickness;

        const dxy = Math.sqrt(nextX * nextX + nextY * nextY);
        if (dxy < minDxyConstraint) {
          const scale = minDxyConstraint / dxy;
          nextX *= scale;
          nextY *= scale;
        }

        positions[i * 3] = nextX;
        positions[i * 3 + 1] = nextY;
        positions[i * 3 + 2] = nextZ;
      }
    }

    this.enforceWeldMap();
    this.updateGeometryBuffer();
  }

  /**
   * Applies the weld map to average positions and prevent vertex seams cracking.
   */
  private enforceWeldMap() {
    const positions = this.currentPositions;
    const count = this.vertexCount;

    const visited = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
      if (visited[i]) continue;

      const twins = this.weldMap[i];
      if (twins.length > 1) {
        let sumX = 0, sumY = 0, sumZ = 0;
        for (const t of twins) {
          sumX += positions[t * 3];
          sumY += positions[t * 3 + 1];
          sumZ += positions[t * 3 + 2];
          visited[t] = 1;
        }

        const avgX = sumX / twins.length;
        const avgY = sumY / twins.length;
        const avgZ = sumZ / twins.length;

        for (const t of twins) {
          positions[t * 3] = avgX;
          positions[t * 3 + 1] = avgY;
          positions[t * 3 + 2] = avgZ;
        }
      }
    }
  }

  /**
   * Updates Three.js GPU attributes and vertex normals.
   */
  public updateGeometryBuffer() {
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    
    // Allocate displacedPositions cache if needed
    if (!this.displacedPositions || this.displacedPositions.length !== this.currentPositions.length) {
      this.displacedPositions = new Float32Array(this.currentPositions.length);
    }
    
    this.displacedPositions.set(this.currentPositions);
    
    // Apply inner text displacement if active
    if (this.inscriptionText && this.inscriptionText.trim().length > 0 && this.inscriptionPixels) {
      this.applyInscriptionOffset(this.displacedPositions);
    }
    
    posAttr.set(this.displacedPositions);
    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  public updateInscription(text: string, depthPercent: number, sizePercent: number = 100, weight: number = 10) {
    this.inscriptionText = text;
    this.inscriptionDepth = depthPercent;
    this.inscriptionSize = sizePercent;
    this.inscriptionWeight = weight;
    
    const trimmed = text.trim();
    if (
      trimmed !== this.cachedInscriptionText || 
      sizePercent !== this.cachedInscriptionSize || 
      weight !== this.cachedInscriptionWeight || 
      !this.inscriptionPixels
    ) {
      this.cachedInscriptionText = trimmed;
      this.cachedInscriptionSize = sizePercent;
      this.cachedInscriptionWeight = weight;
      if (trimmed.length === 0) {
        this.inscriptionPixels = null;
      } else {
        const width = 1024;
        const height = 128;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
          
          // Base font size is 80px, scaled by sizePercent / 100
          let fontSize = Math.floor(80 * (sizePercent / 100));
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const isThin = weight <= 2;
          const fontFamily = isThin
            ? `"Segoe UI", "Trebuchet MS", "Arial", sans-serif`
            : `"Arial Black", "Impact", "Trebuchet MS", sans-serif`;
          const fontWeightName = isThin ? '600' : '900';

          ctx.font = `${fontWeightName} ${fontSize}px ${fontFamily}`;
          let textWidth = ctx.measureText(trimmed).width;
          
          // Shrink dynamically if it overflows the 1024px canvas
          const maxWidth = width - 40;
          if (textWidth > maxWidth) {
            fontSize = Math.floor(fontSize * (maxWidth / textWidth));
            ctx.font = `${fontWeightName} ${fontSize}px ${fontFamily}`;
          }
          
          if (isThin) {
            // Ultra-thin line rendering for small weights (0.5px - 2px)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.1, weight);
            ctx.lineJoin = 'round';
            ctx.strokeText(trimmed, width / 2, height / 2);
            if (weight > 1.2) {
              ctx.fillStyle = '#ffffff';
              ctx.fillText(trimmed, width / 2, height / 2);
            }
          } else {
            // Bold filled stroke rendering for thicker weights (up to 12px)
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = weight; // Custom thickness stroke (0.5px to 12px)
            ctx.lineJoin = 'round';
            ctx.strokeText(trimmed, width / 2, height / 2);
            ctx.fillText(trimmed, width / 2, height / 2);
          }
          
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          const pixels = new Uint8Array(width * height);
          for (let i = 0; i < width * height; i++) {
            pixels[i] = data[i * 4]; // Red channel
          }
          this.inscriptionPixels = pixels;
        }
      }
    }
    
    this.updateGeometryBuffer();
  }

  private getInscriptionPixel(u: number, v: number): number {
    if (!this.inscriptionPixels) return 0;
    const width = 1024;
    const height = 128;
    
    const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
    
    return this.inscriptionPixels[y * width + x];
  }

  private applyInscriptionOffset(positions: Float32Array) {
    if (!this.lastRingParams) return;
    
    const count = this.vertexCount;
    const innerRadius = this.lastRingParams.innerDiameter / 2;
    const thickness = this.lastRingParams.thickness;
    const width = this.lastRingParams.width;
    const r = thickness / 2;
    const R = innerRadius + r; // Major radius of torus

    // Maximum safe engraving depth is up to half of the ring's thickness
    const maxDepth = thickness * 0.5 * (this.inscriptionDepth / 100);

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const dxy = Math.sqrt(x * x + y * y);
      const theta = Math.atan2(y, x); // Angle around Z axis [-pi, pi]

      const dx = dxy - R;

      // Only apply to the inside face of the ring (dx < 0)
      if (dx < 0) {
        // Map theta to u: we map the full circumference so text wraps cleanly on the inside.
        const u = (theta + Math.PI) / (2 * Math.PI);

        // Map z (height) to v:
        const v = (z + width / 2) / width;

        if (v >= 0.05 && v <= 0.95) {
          // Beautiful wide vertical fade using a sine wave, avoiding jagged edges near boundaries
          const verticalWeight = Math.sin((v - 0.05) / 0.9 * Math.PI);
          
          // Radial weight is maximum on the innermost wall (dxy = innerRadius) and fades to the tube center (dxy = R)
          const radialWeight = Math.max(0, (R - dxy) / r);
          
          // Let the inside weight be extremely prominent
          const insideWeight = radialWeight * verticalWeight;

          if (insideWeight > 0.01) {
            const intensity = this.getInscriptionPixel(u, v) / 255.0;

            if (intensity > 0.01) {
              // "Engraving" means moving the inside face outwards (away from center)
              const displaceAmount = intensity * maxDepth * insideWeight;

              // Direction vector pointing outwards from the center of the ring
              const dirX = Math.cos(theta);
              const dirY = Math.sin(theta);

              positions[i * 3] += dirX * displaceAmount;
              positions[i * 3 + 1] += dirY * displaceAmount;
            }
          }
        }
      }
    }
  }

  /**
   * Begins the automatic clay-relaxing transition (Laplacian smooth).
   * Runs for 300-500ms after a stroke is finished, giving a soft physical elastic settle.
   */
  public triggerRelaxation(ringParams: RingParams) {
    if (this.isRelaxing) return;

    // Build the relaxed target state
    const relaxedPositions = new Float32Array(this.currentPositions);
    const count = this.vertexCount;
    const innerRadius = ringParams.innerDiameter / 2;
    const minThickness = 1.8;

    // Execute 5 iterations of Laplacian smoothing for beautifully polished and professional results
    for (let iter = 0; iter < 5; iter++) {
      const tempPositions = new Float32Array(relaxedPositions);
 
      for (let i = 0; i < count; i++) {
        const neighbors = this.adjacencyList[i];
        if (neighbors.length === 0) continue;
 
        let sumX = 0, sumY = 0, sumZ = 0;
        for (const n of neighbors) {
          sumX += tempPositions[n * 3];
          sumY += tempPositions[n * 3 + 1];
          sumZ += tempPositions[n * 3 + 2];
        }
 
        const avgX = sumX / neighbors.length;
        const avgY = sumY / neighbors.length;
        const avgZ = sumZ / neighbors.length;
 
        // Fetch safety mask to protect inner ring size
        const currentDxy = Math.sqrt(tempPositions[i * 3] * tempPositions[i * 3] + tempPositions[i * 3 + 1] * tempPositions[i * 3 + 1]);
        const safetyMask = THREE.MathUtils.clamp((currentDxy - (innerRadius + 0.2)) / 0.8, 0, 1);
        const lerpFactor = 0.35 * safetyMask; // Highly polished smooth

        let nextX = THREE.MathUtils.lerp(tempPositions[i * 3], avgX, lerpFactor);
        let nextY = THREE.MathUtils.lerp(tempPositions[i * 3 + 1], avgY, lerpFactor);
        let nextZ = THREE.MathUtils.lerp(tempPositions[i * 3 + 2], avgZ, lerpFactor);

        // Enforce minimum thickness clamping
        const origX = this.originalPositions[i * 3];
        const origY = this.originalPositions[i * 3 + 1];
        const origDxy = Math.sqrt(origX * origX + origY * origY);
        const t = THREE.MathUtils.clamp((origDxy - innerRadius) / ringParams.thickness, 0, 1);
        const minDxyConstraint = innerRadius + t * minThickness;

        const dxy = Math.sqrt(nextX * nextX + nextY * nextY);
        if (dxy < minDxyConstraint) {
          const scale = minDxyConstraint / dxy;
          nextX *= scale;
          nextY *= scale;
        }

        relaxedPositions[i * 3] = nextX;
        relaxedPositions[i * 3 + 1] = nextY;
        relaxedPositions[i * 3 + 2] = nextZ;
      }
    }

    // Welded seam safety for target positions
    const visited = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      if (visited[i]) continue;
      const twins = this.weldMap[i];
      if (twins.length > 1) {
        let sumX = 0, sumY = 0, sumZ = 0;
        for (const t of twins) {
          sumX += relaxedPositions[t * 3];
          sumY += relaxedPositions[t * 3 + 1];
          sumZ += relaxedPositions[t * 3 + 2];
          visited[t] = 1;
        }
        const avgX = sumX / twins.length;
        const avgY = sumY / twins.length;
        const avgZ = sumZ / twins.length;
        for (const t of twins) {
          relaxedPositions[t * 3] = avgX;
          relaxedPositions[t * 3 + 1] = avgY;
          relaxedPositions[t * 3 + 2] = avgZ;
        }
      }
    }

    // Set up relaxation animation states
    this.relaxationPositionsStart = new Float32Array(this.currentPositions);
    this.relaxationPositionsTarget = relaxedPositions;
    this.relaxationStartTime = performance.now();
    this.isRelaxing = true;
  }

  /**
   * Updates the relaxation animation frame. Called on the render loop.
   */
  public updateRelaxation(): boolean {
    if (!this.isRelaxing || !this.relaxationPositionsStart || !this.relaxationPositionsTarget) {
      return false;
    }

    const elapsed = performance.now() - this.relaxationStartTime;
    const progress = Math.min(elapsed / this.relaxationDuration, 1.0);

    // Ease-out-quad interpolation
    const easeProgress = progress * (2 - progress);

    const start = this.relaxationPositionsStart;
    const target = this.relaxationPositionsTarget;
    const current = this.currentPositions;
    const count = this.vertexCount;

    for (let i = 0; i < count * 3; i++) {
      current[i] = start[i] + (target[i] - start[i]) * easeProgress;
    }

    this.updateGeometryBuffer();

    if (progress >= 1.0) {
      this.isRelaxing = false;
      this.relaxationPositionsStart = null;
      this.relaxationPositionsTarget = null;
    }

    return true;
  }

  /**
   * Generates extrusion geometry for a placed decorative insert.
   */
  public getInsertGeometry(insert: PlacedInsert): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const type = insert.type;

    if (type === 'circle') {
      shape.absellipse(0, 0, 1.8, 1.8, 0, Math.PI * 2, false, 0);
    } else if (type === 'triangle') {
      const r = 2.0;
      shape.moveTo(0, r);
      shape.lineTo(r * Math.cos(7 * Math.PI / 6), r * Math.sin(7 * Math.PI / 6));
      shape.lineTo(r * Math.cos(11 * Math.PI / 6), r * Math.sin(11 * Math.PI / 6));
      shape.closePath();
    } else if (type === 'square') {
      shape.moveTo(-1.8, -1.8);
      shape.lineTo(-1.8, 1.8);
      shape.lineTo(1.8, 1.8);
      shape.lineTo(1.8, -1.8);
      shape.closePath();
    } else if (type === 'heart') {
      const x = -2, y = -3.8;
      shape.moveTo(x + 2, y + 2);
      shape.bezierCurveTo(x + 2, y + 2, x + 1.6, y, x, y);
      shape.bezierCurveTo(x - 2.4, y, x - 2.4, y + 2.8, x - 2.4, y + 2.8);
      shape.bezierCurveTo(x - 2.4, y + 4.4, x - 0.8, y + 6.2, x + 2, y + 7.6);
      shape.bezierCurveTo(x + 4.8, y + 6.2, x + 6.4, y + 4.4, x + 6.4, y + 2.8);
      shape.bezierCurveTo(x + 6.4, y + 2.8, x + 6.4, y, x + 4, y);
      shape.bezierCurveTo(x + 2.8, y, x + 2, y + 2, x + 2, y + 2);
      shape.closePath();
    } else if (type === 'custom' && insert.customPoints && insert.customPoints.length > 2) {
      const pts = insert.customPoints;
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i].x, pts[i].y);
      }
      shape.closePath();
    } else {
      shape.absellipse(0, 0, 1.8, 1.8, 0, Math.PI * 2, false, 0);
    }

    const height = insert.height;
    const bevelPercent = insert.bevel; // Treat bevel as percentage 0-100%
    const scale = insert.scale;

    // Convert percentage to fraction (0.0 to 1.0)
    const bevelFraction = Math.max(0, Math.min(1, bevelPercent / 100));
    
    // We extrude the entire height. To get smooth curvature along the Z-axis,
    // we use steps (extrusion slices) if a bevel is requested.
    const depth = height;
    const steps = bevelFraction > 0.001 ? 24 : 1;

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: false, // Disable native bevel to completely avoid triangulation/self-intersection artifacts
      steps: steps,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center(); // Center around Z = 0, so Z coordinates are in [-height/2, height/2]

    // Apply smooth mathematical rounding/filleting via Z-axis vertex scaling.
    // This scales the (X, Y) coordinates of the mesh depending on how close they are
    // to the front/back cap faces. It preserves perfect topology and avoids any 2D self-intersections.
    if (bevelFraction > 0.001) {
      const posAttr = geometry.attributes.position;
      const count = posAttr.count;
      const halfH = height / 2;
      
      if (halfH > 0) {
        const tStart = 1.0 - bevelFraction;
        
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const z = posAttr.getZ(i);
          
          // Normalized absolute Z distance from the center plane, in [0, 1] range
          const t = Math.max(0, Math.min(1, Math.abs(z) / halfH));
          
          let scaleFactor = 1.0;
          if (t >= tStart) {
            // Map t in [tStart, 1.0] to u in [0.0, 1.0]
            const u = bevelFraction > 0 ? (t - tStart) / bevelFraction : 0;
            // Circular arc profile for beautiful, flawless sphere/dome curvature
            scaleFactor = Math.sqrt(1.0 - Math.min(1.0, u * u));
          }
          
          // Clamp minimum scale to 0.01 to keep faces valid and prevent normal flip/collapse artifacts
          const finalScale = Math.max(0.01, scaleFactor);
          
          posAttr.setX(i, x * finalScale);
          posAttr.setY(i, y * finalScale);
        }
        
        posAttr.needsUpdate = true;
      }
    }

    geometry.translate(0, 0, height / 2 - 0.2); // slight sink in Z

    // Scale geometry (X & Y scale, Z stays proportional to height)
    geometry.scale(scale, scale, 1);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Checks vertices against the lateral distance limit limitX (innerRadius + 4mm).
   * Returns collision status, max exceed distance, and Float32Array of colliding 3D points.
   */
  public checkFingerCollision(limitX: number) {
    const pos = this.displacedPositions || this.currentPositions;
    const collidingPoints: number[] = [];
    let hasLeft = false;
    let hasRight = false;
    let maxExceed = 0;

    // Check ring mesh vertices
    for (let i = 0; i < this.vertexCount; i++) {
      const x = pos[i * 3];
      if (x > limitX) {
        hasRight = true;
        const exceed = x - limitX;
        if (exceed > maxExceed) maxExceed = exceed;
        collidingPoints.push(x, pos[i * 3 + 1], pos[i * 3 + 2]);
      } else if (x < -limitX) {
        hasLeft = true;
        const exceed = -limitX - x;
        if (exceed > maxExceed) maxExceed = exceed;
        collidingPoints.push(x, pos[i * 3 + 1], pos[i * 3 + 2]);
      }
    }

    return {
      hasCollision: hasLeft || hasRight,
      hasLeft,
      hasRight,
      maxExceed,
      collidingPoints: new Float32Array(collidingPoints)
    };
  }

  /**
   * Generates a watertight STL binary blob of the sculpted ring geometry,
   * merged with all placed decorative inserts.
   */
  public generateSTLBlob(): Blob {
    interface Triangle {
      vA: THREE.Vector3;
      vB: THREE.Vector3;
      vC: THREE.Vector3;
      normal: THREE.Vector3;
    }
    const triangles: Triangle[] = [];

    // 1. Gather ring triangles (read from the displaced GPU buffer so engraving is included)
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const ringPositions = posAttr.array;
    const ringIndexAttr = this.geometry.index;
    let ringIndices: number[] = [];

    if (ringIndexAttr) {
      for (let i = 0; i < ringIndexAttr.count; i++) {
        ringIndices.push(ringIndexAttr.getX(i));
      }
    } else {
      for (let i = 0; i < this.vertexCount; i++) {
        ringIndices.push(i);
      }
    }

    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();

    for (let i = 0; i < ringIndices.length; i += 3) {
      const idxA = ringIndices[i];
      const idxB = ringIndices[i + 1];
      const idxC = ringIndices[i + 2];

      const vA = new THREE.Vector3(ringPositions[idxA * 3], ringPositions[idxA * 3 + 1], ringPositions[idxA * 3 + 2]);
      const vB = new THREE.Vector3(ringPositions[idxB * 3], ringPositions[idxB * 3 + 1], ringPositions[idxB * 3 + 2]);
      const vC = new THREE.Vector3(ringPositions[idxC * 3], ringPositions[idxC * 3 + 1], ringPositions[idxC * 3 + 2]);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();

      triangles.push({ vA, vB, vC, normal });
    }

    // 2. Gather placed inserts' triangles
    for (const insert of this.placedInserts) {
      try {
        const insertGeo = this.getInsertGeometry(insert);
        const insertPositions = insertGeo.attributes.position;
        const insertIndexAttr = insertGeo.index;

        // Apply transformations
        const q = new THREE.Quaternion(insert.quaternion.x, insert.quaternion.y, insert.quaternion.z, insert.quaternion.w);
        insertGeo.applyQuaternion(q);
        insertGeo.translate(insert.position.x, insert.position.y, insert.position.z);

        let insertIndices: number[] = [];
        if (insertIndexAttr) {
          for (let i = 0; i < insertIndexAttr.count; i++) {
            insertIndices.push(insertIndexAttr.getX(i));
          }
        } else {
          for (let i = 0; i < insertPositions.count; i++) {
            insertIndices.push(i);
          }
        }

        const iPos = insertPositions.array;
        for (let i = 0; i < insertIndices.length; i += 3) {
          const idxA = insertIndices[i];
          const idxB = insertIndices[i + 1];
          const idxC = insertIndices[i + 2];

          const vA = new THREE.Vector3(iPos[idxA * 3], iPos[idxA * 3 + 1], iPos[idxA * 3 + 2]);
          const vB = new THREE.Vector3(iPos[idxB * 3], iPos[idxB * 3 + 1], iPos[idxB * 3 + 2]);
          const vC = new THREE.Vector3(iPos[idxC * 3], iPos[idxC * 3 + 1], iPos[idxC * 3 + 2]);

          cb.subVectors(vC, vB);
          ab.subVectors(vA, vB);
          const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();

          triangles.push({ vA, vB, vC, normal });
        }

        // Clean up temporary geometry
        insertGeo.dispose();
      } catch (err) {
        console.error("Error exporting insert to STL:", err);
      }
    }

    const triangleCount = triangles.length;
    const bufferSize = 80 + 4 + triangleCount * 50;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Header (80 bytes)
    for (let i = 0; i < 80; i++) {
      view.setUint8(i, 0);
    }

    // Triangle Count
    view.setUint32(80, triangleCount, true);

    let offset = 84;
    for (const t of triangles) {
      view.setFloat32(offset, t.normal.x, true);
      view.setFloat32(offset + 4, t.normal.y, true);
      view.setFloat32(offset + 8, t.normal.z, true);

      view.setFloat32(offset + 12, t.vA.x, true);
      view.setFloat32(offset + 16, t.vA.y, true);
      view.setFloat32(offset + 20, t.vA.z, true);

      view.setFloat32(offset + 24, t.vB.x, true);
      view.setFloat32(offset + 28, t.vB.y, true);
      view.setFloat32(offset + 32, t.vB.z, true);

      view.setFloat32(offset + 36, t.vC.x, true);
      view.setFloat32(offset + 40, t.vC.y, true);
      view.setFloat32(offset + 44, t.vC.z, true);

      view.setUint16(offset + 48, 0, true);
      offset += 50;
    }

    return new Blob([buffer], { type: 'application/octet-stream' });
  }

  public exportSTL(name: string = 'SculptRing_Model.stl') {
    const blob = this.generateSTLBlob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
