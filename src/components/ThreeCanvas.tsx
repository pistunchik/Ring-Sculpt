import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { SculptEngine, BrushConfig, RingParams, SculptTool, PlacedInsert } from './SculptEngine';
import { claySoundManager } from './ClaySoundManager';
import { createRingMaterial } from '../utils/materialUtils';
import { Loader2, HelpCircle } from 'lucide-react';

interface ThreeCanvasProps {
  ringParams: RingParams;
  stlUrl?: string;
  brushConfig: BrushConfig;
  onEngineReady: (engine: SculptEngine | null) => void;
  soundEnabled: boolean;
  materialPreset: string;
  triggerReset: number;
  undoCounter: number;
  redoCounter: number;
  exportCounter: number;
  symmetryEnabled: boolean;
  symmetryPlane: boolean;
  symmetryPlanePerp?: boolean;
  symmetryRadialCount: number;
  timeOfDay: number;
  autoSmoothEnabled: boolean;
  autoSmoothStrength: number;
  smoothAllCounter: number;
  placedInserts: PlacedInsert[];
  onAddPlacedInsert: (insert: PlacedInsert | PlacedInsert[]) => void;
  insertType: 'circle' | 'triangle' | 'square' | 'heart' | 'custom' | null;
  insertHeight: number;
  insertBevel: number;
  insertScale: number;
  customPoints: { x: number; y: number }[];
  inscriptionText: string;
  inscriptionDepth: number;
  inscriptionSize: number;
  inscriptionWeight: number;
  showFingerZones?: boolean;
  onCollisionChange?: (collision: { hasCollision: boolean; hasLeft: boolean; hasRight: boolean; maxExceed: number }) => void;
  /** Called once renderer is ready, with a function to capture a JPEG snapshot of the canvas */
  onSnapshotReady?: (captureSnapshot: () => string) => void;
  /** Callback to trigger onboarding tour modal */
  onOpenOnboarding?: () => void;
}


const createMaterial = (presetName: string): THREE.Material => {
  return createRingMaterial(presetName);
};


// Generates warm, cozy, atmospheric lights and background based on the timeOfDay (12:00 -> 24:00)
const getLightState = (t: number) => {
  const time = Math.max(12, Math.min(24, t));

  // Noon (12:00) - Bright, clean cozy studio daylight, matching the catalog aesthetic
  const noon = {
    bgColor: new THREE.Color(0xfcfbf9),
    ambientColor: new THREE.Color(0xfff9f2),
    ambientIntensity: 1.2,
    dir1Color: new THREE.Color(0xffeed8),
    dir1Intensity: 2.0,
    dir1Pos: new THREE.Vector3(18, 28, 22),
    dir2Color: new THREE.Color(0xddeeff),
    dir2Intensity: 0.9,
    floorColor: new THREE.Color(0xffffff),
    floorIntensity: 0.7,
  };

  // Sunset/Evening (18:00) - Golden warm window-cast light, rosy warm environment
  const evening = {
    bgColor: new THREE.Color(0xf5dcc5), // Beautiful peach-amber cozy sunset background
    ambientColor: new THREE.Color(0xffcfaf), // Cozy amber fill
    ambientIntensity: 0.55,
    dir1Color: new THREE.Color(0xff8a27), // Deep golden orange sunset
    dir1Intensity: 1.9,
    dir1Pos: new THREE.Vector3(20, -15, 30),
    dir2Color: new THREE.Color(0xbd9bf5), // Lavender soft fill
    dir2Intensity: 0.35,
    floorColor: new THREE.Color(0xfa8850),
    floorIntensity: 0.35,
  };

  // Midnight (24:00) - Deep, dark indigo room with mysterious neon moonlight
  const midnight = {
    bgColor: new THREE.Color(0x0a0a10), // Midnight dark room
    ambientColor: new THREE.Color(0x130b2c), // Dim magical violet ambient
    ambientIntensity: 0.18,
    dir1Color: new THREE.Color(0x404beb), // Magical cool moonlight
    dir1Intensity: 0.35,
    dir1Pos: new THREE.Vector3(15, -25, 30),
    dir2Color: new THREE.Color(0x00a8ff), // Electric neon cyan/blue glow
    dir2Intensity: 0.55,
    floorColor: new THREE.Color(0x000000),
    floorIntensity: 0.0,
  };

  const result = {
    bgColor: new THREE.Color(),
    ambientColor: new THREE.Color(),
    ambientIntensity: 0,
    dir1Color: new THREE.Color(),
    dir1Intensity: 0,
    dir1Pos: new THREE.Vector3(),
    dir2Color: new THREE.Color(),
    dir2Intensity: 0,
    floorColor: new THREE.Color(),
    floorIntensity: 0,
  };

  if (time <= 18) {
    const alpha = (time - 12) / 6;
    result.bgColor.copy(noon.bgColor).lerp(evening.bgColor, alpha);
    result.ambientColor.copy(noon.ambientColor).lerp(evening.ambientColor, alpha);
    result.ambientIntensity = THREE.MathUtils.lerp(noon.ambientIntensity, evening.ambientIntensity, alpha);
    result.dir1Color.copy(noon.dir1Color).lerp(evening.dir1Color, alpha);
    result.dir1Intensity = THREE.MathUtils.lerp(noon.dir1Intensity, evening.dir1Intensity, alpha);
    result.dir1Pos.copy(noon.dir1Pos).lerp(evening.dir1Pos, alpha);
    result.dir2Color.copy(noon.dir2Color).lerp(evening.dir2Color, alpha);
    result.dir2Intensity = THREE.MathUtils.lerp(noon.dir2Intensity, evening.dir2Intensity, alpha);
    result.floorColor.copy(noon.floorColor).lerp(evening.floorColor, alpha);
    result.floorIntensity = THREE.MathUtils.lerp(noon.floorIntensity, evening.floorIntensity, alpha);
  } else {
    const alpha = (time - 18) / 6;
    result.bgColor.copy(evening.bgColor).lerp(midnight.bgColor, alpha);
    result.ambientColor.copy(evening.ambientColor).lerp(midnight.ambientColor, alpha);
    result.ambientIntensity = THREE.MathUtils.lerp(evening.ambientIntensity, midnight.ambientIntensity, alpha);
    result.dir1Color.copy(evening.dir1Color).lerp(midnight.dir1Color, alpha);
    result.dir1Intensity = THREE.MathUtils.lerp(evening.dir1Intensity, midnight.dir1Intensity, alpha);
    result.dir1Pos.copy(evening.dir1Pos).lerp(midnight.dir1Pos, alpha);
    result.dir2Color.copy(evening.dir2Color).lerp(midnight.dir2Color, alpha);
    result.dir2Intensity = THREE.MathUtils.lerp(evening.dir2Intensity, midnight.dir2Intensity, alpha);
    result.floorColor.copy(evening.floorColor).lerp(midnight.floorColor, alpha);
    result.floorIntensity = THREE.MathUtils.lerp(evening.floorIntensity, midnight.floorIntensity, alpha);
  }

  return result;
};

interface Transform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/**
 * Returns a smooth, interpolated surface normal at the exact raycast hit point
 * by weighting the three vertex normals of the hit triangle with barycentric
 * coordinates. Falls back to the face normal when vertex normals are unavailable.
 * The result is transformed to world space.
 */
const getInterpolatedNormal = (
  hit: THREE.Intersection,
  mesh: THREE.Mesh
): THREE.Vector3 => {
  const face = hit.face;
  if (!face) return new THREE.Vector3(0, 0, 1);

  const geo = mesh.geometry;
  const normAttr = geo.attributes.normal;

  // Fallback to face normal if no vertex normals
  if (!normAttr || !hit.barycoord) {
    return face.normal.clone().transformDirection(mesh.matrixWorld).normalize();
  }

  const { a, b, c } = face;
  const bc = hit.barycoord; // THREE.Vector3 with barycentric u,v,w

  const nA = new THREE.Vector3().fromBufferAttribute(normAttr, a);
  const nB = new THREE.Vector3().fromBufferAttribute(normAttr, b);
  const nC = new THREE.Vector3().fromBufferAttribute(normAttr, c);

  // Interpolate: N = bc.x*nA + bc.y*nB + bc.z*nC
  const interpolated = new THREE.Vector3()
    .addScaledVector(nA, bc.x)
    .addScaledVector(nB, bc.y)
    .addScaledVector(nC, bc.z)
    .normalize();

  // Transform to world space (ignores scale)
  return interpolated.transformDirection(mesh.matrixWorld).normalize();
};

const rotateVectorY = (vec: THREE.Vector3, angle: number): THREE.Vector3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new THREE.Vector3(
    vec.x * cos - vec.z * sin,
    vec.y,
    vec.x * sin + vec.z * cos
  );
};

const mirrorVectorY = (vec: THREE.Vector3): THREE.Vector3 => {
  return new THREE.Vector3(vec.x, -vec.y, vec.z);
};

const mirrorVectorX = (vec: THREE.Vector3): THREE.Vector3 => {
  return new THREE.Vector3(-vec.x, vec.y, vec.z);
};

export const computeSymmetricalTransforms = (
  hitPoint: THREE.Vector3,
  hitNormal: THREE.Vector3,
  symmetryEnabled: boolean,
  symmetryPlane: boolean,
  symmetryRadialCount: number,
  symmetryPlanePerp?: boolean
): Transform[] => {
  const up = new THREE.Vector3(0, 0, 1);
  const transforms: Transform[] = [];

  const addUniqueTransform = (pos: THREE.Vector3, norm: THREE.Vector3) => {
    for (const existing of transforms) {
      if (existing.position.distanceTo(pos) < 0.001) {
        return;
      }
    }
    const q = new THREE.Quaternion().setFromUnitVectors(up, norm);
    transforms.push({ position: pos, quaternion: q });
  };

  if (!symmetryEnabled) {
    const q = new THREE.Quaternion().setFromUnitVectors(up, hitNormal);
    transforms.push({ position: hitPoint.clone(), quaternion: q });
    return transforms;
  }

  const radialCount = Math.max(1, Math.min(8, symmetryRadialCount || 1));

  for (let k = 0; k < radialCount; k++) {
    const angle = (k * 2 * Math.PI) / radialCount;

    const ptRot = rotateVectorY(hitPoint, angle);
    const normRot = rotateVectorY(hitNormal, angle);
    addUniqueTransform(ptRot, normRot);

    if (symmetryPlane) {
      const ptMirY = mirrorVectorY(ptRot);
      const normMirY = mirrorVectorY(normRot);
      addUniqueTransform(ptMirY, normMirY);
    }

    if (symmetryPlanePerp) {
      const ptMirX = mirrorVectorX(ptRot);
      const normMirX = mirrorVectorX(normRot);
      addUniqueTransform(ptMirX, normMirX);
    }

    if (symmetryPlane && symmetryPlanePerp) {
      const ptMirXY = mirrorVectorY(mirrorVectorX(ptRot));
      const normMirXY = mirrorVectorY(mirrorVectorX(normRot));
      addUniqueTransform(ptMirXY, normMirXY);
    }
  }

  return transforms;
};

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  ringParams,
  stlUrl,
  brushConfig,
  onEngineReady,
  soundEnabled,
  materialPreset,
  triggerReset,
  undoCounter,
  redoCounter,
  exportCounter,
  symmetryEnabled,
  symmetryPlane,
  symmetryPlanePerp = false,
  symmetryRadialCount,
  timeOfDay,
  autoSmoothEnabled,
  autoSmoothStrength,
  smoothAllCounter,
  placedInserts = [],
  onAddPlacedInsert,
  insertType,
  insertHeight,
  insertBevel,
  insertScale,
  customPoints,
  inscriptionText = "",
  inscriptionDepth = 50,
  inscriptionSize = 100,
  inscriptionWeight = 10,
  showFingerZones = true,
  onCollisionChange,
  onSnapshotReady,
  onOpenOnboarding,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Finger zone refs
  const showFingerZonesRef = useRef(showFingerZones);
  const onCollisionChangeRef = useRef(onCollisionChange);

  useEffect(() => {
    showFingerZonesRef.current = showFingerZones;
  }, [showFingerZones]);

  useEffect(() => {
    onCollisionChangeRef.current = onCollisionChange;
  }, [onCollisionChange]);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const ssaoPassRef = useRef<SSAOPass | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ringMeshRef = useRef<THREE.Mesh | null>(null);
  const sculptEngineRef = useRef<SculptEngine | null>(null);
  const brushIndicatorRef = useRef<THREE.LineLoop | null>(null);

  // References for inserts & ghost preview mesh
  const insertsGroupRef = useRef<THREE.Group | null>(null);
  const previewGroupRef = useRef<THREE.Group | null>(null);

  // Refs to control lights in dark room mode
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLight1Ref = useRef<THREE.DirectionalLight | null>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight | null>(null);
  const floorLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Keep track of the active brush config & ring params via refs for the render / event loops
  const brushConfigRef = useRef(brushConfig);
  const ringParamsRef = useRef(ringParams);
  const autoSmoothEnabledRef = useRef(autoSmoothEnabled);
  const autoSmoothStrengthRef = useRef(autoSmoothStrength);
  const [loading, setLoading] = useState(true);

  // Track dragging / sculpting states
  const isSculptingActive = useRef(false);
  const lastIntersectPoint = useRef<THREE.Vector3 | null>(null);
  const mousePosition = useRef<THREE.Vector2>(new THREE.Vector2());

  // Sync decorative inserts
  useEffect(() => {
    const group = insertsGroupRef.current;
    const engine = sculptEngineRef.current;
    const ringMesh = ringMeshRef.current;
    if (!group || !engine || !ringMesh) return;

    // Keep placedInserts inside sculptEngine synchronized
    engine.placedInserts = JSON.parse(JSON.stringify(placedInserts));

    // Clear previous
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    // Re-create each placed insert
    placedInserts.forEach((insert) => {
      try {
        const geo = engine.getInsertGeometry(insert);
        const mesh = new THREE.Mesh(geo, ringMesh.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.position.set(insert.position.x, insert.position.y, insert.position.z);
        mesh.quaternion.set(insert.quaternion.x, insert.quaternion.y, insert.quaternion.z, insert.quaternion.w);

        group.add(mesh);
      } catch (err) {
        console.error("Error rendering placed insert:", err);
      }
    });
  }, [placedInserts, materialPreset]);

  // Sync ghost preview mesh geometry and material
  useEffect(() => {
    const group = previewGroupRef.current;
    const engine = sculptEngineRef.current;
    const ringMesh = ringMeshRef.current;
    if (!group || !engine || !ringMesh || !insertType) {
      if (group) group.visible = false;
      return;
    }

    try {
      const dummyInsert: PlacedInsert = {
        id: 'preview',
        type: insertType,
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        height: insertHeight,
        bevel: insertBevel,
        scale: insertScale,
        customPoints: insertType === 'custom' ? customPoints : undefined,
      };

      const geo = engine.getInsertGeometry(dummyInsert);
      const previewMat = (ringMesh.material as THREE.Material).clone();
      previewMat.transparent = true;
      previewMat.opacity = 0.55;

      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          child.geometry = geo;
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
          child.material = previewMat.clone();
        }
      });
    } catch (err) {
      console.error("Error creating preview geometry:", err);
    }
  }, [insertType, insertHeight, insertBevel, insertScale, customPoints, materialPreset]);

  // Update refs on changes
  const insertTypeRef = useRef(insertType);
  const insertHeightRef = useRef(insertHeight);
  const insertBevelRef = useRef(insertBevel);
  const insertScaleRef = useRef(insertScale);
  const customPointsRef = useRef(customPoints);

  useEffect(() => {
    insertTypeRef.current = insertType;
  }, [insertType]);

  useEffect(() => {
    insertHeightRef.current = insertHeight;
  }, [insertHeight]);

  useEffect(() => {
    insertBevelRef.current = insertBevel;
  }, [insertBevel]);

  useEffect(() => {
    insertScaleRef.current = insertScale;
  }, [insertScale]);

  useEffect(() => {
    customPointsRef.current = customPoints;
  }, [customPoints]);

  useEffect(() => {
    brushConfigRef.current = brushConfig;
  }, [brushConfig]);

  useEffect(() => {
    autoSmoothEnabledRef.current = autoSmoothEnabled;
  }, [autoSmoothEnabled]);

  useEffect(() => {
    autoSmoothStrengthRef.current = autoSmoothStrength;
  }, [autoSmoothStrength]);

  useEffect(() => {
    claySoundManager.toggle(soundEnabled);
  }, [soundEnabled]);

  const symmetryEnabledRef = useRef(symmetryEnabled);
  const symmetryPlaneRef = useRef(symmetryPlane);
  const symmetryPlanePerpRef = useRef(symmetryPlanePerp);
  const symmetryRadialCountRef = useRef(symmetryRadialCount);

  useEffect(() => {
    symmetryEnabledRef.current = symmetryEnabled;
  }, [symmetryEnabled]);

  useEffect(() => {
    symmetryPlaneRef.current = symmetryPlane;
  }, [symmetryPlane]);

  useEffect(() => {
    symmetryPlanePerpRef.current = symmetryPlanePerp;
  }, [symmetryPlanePerp]);

  useEffect(() => {
    symmetryRadialCountRef.current = symmetryRadialCount;
  }, [symmetryRadialCount]);

  // Handle ring parameters resizing dynamically (Morphing vertices continuously)
  const prevParamsRef = useRef<RingParams | null>(null);
  useEffect(() => {
    const engine = sculptEngineRef.current;
    const mesh = ringMeshRef.current;
    if (!engine || !mesh) return;

    // Keep ring params synced in the engine for the text projection overlay
    engine.setRingParams(ringParams);

    const oldParams = prevParamsRef.current;
    const newParams = ringParams;

    if (oldParams) {
      // Check if actually changed
      if (
        oldParams.innerDiameter !== newParams.innerDiameter ||
        oldParams.width !== newParams.width ||
        oldParams.thickness !== newParams.thickness
      ) {
        // CONTINUOUS BI-LINEAR MORPHING ALGORITHM
        // Keeps user's sculpting design while stretching/shrinking perfectly to new ring size parameters.
        const oldInnerRadius = oldParams.innerDiameter / 2;
        const newInnerRadius = newParams.innerDiameter / 2;
        const oldThickness = oldParams.thickness;
        const newThickness = newParams.thickness;
        const oldWidth = oldParams.width;
        const newWidth = newParams.width;

        const positions = engine.currentPositions;
        const count = engine.vertexCount;
        const v = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
          v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);

          // Cylindrical projection in XZ plane
          const theta = Math.atan2(v.z, v.x);
          const dxz = Math.sqrt(v.x * v.x + v.z * v.z);
          const y = v.y;

          // Compute distance relative to old inner radius (representing local sculpt height)
          const localThickness = dxz - oldInnerRadius;
          // Scale radial sculpt thickness proportionally
          const thicknessRatio = oldThickness > 0 ? (localThickness / oldThickness) : 1;
          const newDxz = newInnerRadius + thicknessRatio * newThickness;

          // Scale height (width) along Y
          const widthRatio = oldWidth > 0 ? (y / oldWidth) : 1;
          const newY = widthRatio * newWidth;

          // Map back to Cartesian coordinates
          v.x = Math.cos(theta) * newDxz;
          v.z = Math.sin(theta) * newDxz;
          v.y = newY;

          // Save back
          positions[i * 3] = v.x;
          positions[i * 3 + 1] = v.y;
          positions[i * 3 + 2] = v.z;
        }

        engine.updateGeometryBuffer();
      }
    }

    prevParamsRef.current = { ...newParams };
    ringParamsRef.current = newParams;
  }, [ringParams]);

  // Handle Material Changes
  useEffect(() => {
    const mesh = ringMeshRef.current;
    if (mesh) {
      const oldMat = mesh.material;
      const newMat = createMaterial(materialPreset);
      mesh.material = newMat;

      // Update all placed inserts to use the new material immediately!
      const group = insertsGroupRef.current;
      if (group) {
        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = newMat;
          }
        });
      }

      // Update preview group meshes as well
      const previewGroup = previewGroupRef.current;
      if (previewGroup) {
        const previewMat = newMat.clone();
        previewMat.transparent = true;
        previewMat.opacity = 0.55;
        previewGroup.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = previewMat.clone();
          }
        });
      }

      if (oldMat) {
        if (Array.isArray(oldMat)) {
          oldMat.forEach((m) => m.dispose());
        } else {
          oldMat.dispose();
        }
      }
    }
  }, [materialPreset]);

  // Handle Daylight / Time of Day cycle changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const lState = getLightState(timeOfDay);
    scene.background = lState.bgColor;

    if (ambientLightRef.current) {
      ambientLightRef.current.color.copy(lState.ambientColor);
      ambientLightRef.current.intensity = lState.ambientIntensity;
    }
    if (dirLight1Ref.current) {
      dirLight1Ref.current.color.copy(lState.dir1Color);
      dirLight1Ref.current.intensity = lState.dir1Intensity;
      dirLight1Ref.current.position.copy(lState.dir1Pos);
    }
    if (dirLight2Ref.current) {
      dirLight2Ref.current.color.copy(lState.dir2Color);
      dirLight2Ref.current.intensity = lState.dir2Intensity;
    }
    if (floorLightRef.current) {
      floorLightRef.current.color.copy(lState.floorColor);
      floorLightRef.current.intensity = lState.floorIntensity;
    }
  }, [timeOfDay]);

  // Handle Reset Trigger
  useEffect(() => {
    if (triggerReset > 0) {
      resetRing();
    }
  }, [triggerReset]);

  // Handle Inscription updates reactively
  useEffect(() => {
    const engine = sculptEngineRef.current;
    if (engine && ringParamsRef.current) {
      engine.setRingParams(ringParamsRef.current);
      engine.updateInscription(inscriptionText, inscriptionDepth, inscriptionSize, inscriptionWeight);
    }
  }, [inscriptionText, inscriptionDepth, inscriptionSize, inscriptionWeight, triggerReset]);

  // Handle Undo Trigger (guarded against firing on mount)
  const prevUndoRef = useRef(undoCounter);
  useEffect(() => {
    if (undoCounter > prevUndoRef.current && sculptEngineRef.current) {
      sculptEngineRef.current.undo();
    }
    prevUndoRef.current = undoCounter;
  }, [undoCounter]);

  // Handle Redo Trigger (guarded against firing on mount)
  const prevRedoRef = useRef(redoCounter);
  useEffect(() => {
    if (redoCounter > prevRedoRef.current && sculptEngineRef.current) {
      sculptEngineRef.current.redo();
    }
    prevRedoRef.current = redoCounter;
  }, [redoCounter]);

  // Handle Export Trigger (guarded against firing on mount)
  const prevExportRef = useRef(exportCounter);
  useEffect(() => {
    if (exportCounter > prevExportRef.current && sculptEngineRef.current) {
      sculptEngineRef.current.exportSTL();
    }
    prevExportRef.current = exportCounter;
  }, [exportCounter]);

  // Handle Global Smoothing Trigger (guarded against firing on mount)
  const prevSmoothRef = useRef(smoothAllCounter);
  useEffect(() => {
    if (smoothAllCounter > prevSmoothRef.current && sculptEngineRef.current && ringParamsRef.current) {
      sculptEngineRef.current.smoothAll(ringParamsRef.current, 3, autoSmoothStrengthRef.current);
    }
    prevSmoothRef.current = smoothAllCounter;
  }, [smoothAllCounter]);

  // Handle dynamic stlUrl updates
  const currentStlUrlRef = useRef<string | undefined>(stlUrl);
  useEffect(() => {
    if (!stlUrl || stlUrl === currentStlUrlRef.current) return;
    currentStlUrlRef.current = stlUrl;
    const engine = sculptEngineRef.current;
    if (!engine) return;

    const loader = new STLLoader();
    loader.load(
      stlUrl,
      (loadedGeo) => {
        engine.loadGeometry(loadedGeo, ringParamsRef.current.innerDiameter);
        if (ringMeshRef.current) {
          ringMeshRef.current.geometry = loadedGeo;
          ringMeshRef.current.geometry.computeVertexNormals();
          ringMeshRef.current.geometry.attributes.position.needsUpdate = true;
        }
      },
      undefined,
      (err) => {
        console.warn('Could not load STL in ThreeCanvas:', err);
      }
    );
  }, [stlUrl]);

  // Procedural Ring Geometry Generator (XZ Plane)
  const createRingGeometry = (params: RingParams) => {
    const radialSegments = 120;
    const tubularSegments = 360;

    const innerRadius = params.innerDiameter / 2;
    const r = params.thickness / 2;
    const R = innerRadius + r;

    // Base Torus rotated to stand in the XZ plane
    const geometry = new THREE.TorusGeometry(R, r, radialSegments, tubularSegments);
    geometry.rotateX(Math.PI / 2);

    // Continuous stretching along the Y axis to fit the ring width
    const posAttr = geometry.attributes.position;
    const scaleY = params.width / params.thickness;

    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      posAttr.setY(i, y * scaleY);
    }

    geometry.computeVertexNormals();
    return geometry;
  };

  const resetRing = () => {
    const engine = sculptEngineRef.current;
    const mesh = ringMeshRef.current;
    if (engine && mesh && ringParamsRef.current) {
      const oldGeo = mesh.geometry;
      const newGeo = createRingGeometry(ringParamsRef.current);
      mesh.geometry = newGeo;
      if (oldGeo) oldGeo.dispose();
      engine.reset(newGeo);
    }
  };

  // Main Mounting & Initialisation Loop
  useEffect(() => {
     // 1. Initialize Scene & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfcfbf9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      36,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      500
    );
    camera.position.set(0, 16, 36);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // 2. Add Ambient Contact Ground Plane (Underneath ring at Y = -13)
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -13;
    ground.receiveShadow = true;
    scene.add(ground);

    // 3. Add Studio Lights Setup (Clean, bright, crystal-clear studio setup)
    const ambientLight = new THREE.AmbientLight(0xfff9f2, 1.2);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight1 = new THREE.DirectionalLight(0xffeed8, 2.0);
    dirLight1.position.set(18, 28, 22);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 160;
    dirLight1.shadow.camera.left = -35;
    dirLight1.shadow.camera.right = 35;
    dirLight1.shadow.camera.top = 35;
    dirLight1.shadow.camera.bottom = -35;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);
    dirLight1Ref.current = dirLight1;

    const dirLight2 = new THREE.DirectionalLight(0xddeeff, 0.9);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);
    dirLight2Ref.current = dirLight2;

    const floorLight = new THREE.DirectionalLight(0xffffff, 0.7);
    floorLight.position.set(0, 8, 25);
    scene.add(floorLight);
    floorLightRef.current = floorLight;

    // 4. Initialize Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 80;
    // Allow full camera rotation, including looking from below
    controls.maxPolarAngle = Math.PI;

    // MAPPING INTUITION:
    // Right Click -> Rotate
    // Middle Click -> Dolly/Zoom
    // Left Click is left entirely unbound so sculpting raycasts smoothly without camera drag!
    controls.mouseButtons = {
      LEFT: -1 as any, // Important: prevents camera rotation on sculpting
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Support two-finger gestures on mobile for rotation/zoom
    controls.touches = {
      ONE: -1 as any, // Sculpting on mobile single touch
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    controlsRef.current = controls;

    // 5. Generate Initial Ring Geometry & Mesh
    const ringGeo = createRingGeometry(ringParamsRef.current);
    const ringMat = createMaterial(materialPreset);

    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.castShadow = true;
    ringMesh.receiveShadow = true;
    // Center ring beautifully
    ringMesh.position.set(0, 0, 0);
    scene.add(ringMesh);
    ringMeshRef.current = ringMesh;

    // Create and add group for placed decorative inserts
    const insertsGroup = new THREE.Group();
    ringMesh.add(insertsGroup);
    insertsGroupRef.current = insertsGroup;

    // Create and add preview group for insert placement ghosting
    const previewGroup = new THREE.Group();
    scene.add(previewGroup);
    previewGroupRef.current = previewGroup;

    // Apply initial daylight cycle setup
    const initialLightState = getLightState(timeOfDay);
    scene.background = initialLightState.bgColor;
    ambientLight.color.copy(initialLightState.ambientColor);
    ambientLight.intensity = initialLightState.ambientIntensity;
    dirLight1.color.copy(initialLightState.dir1Color);
    dirLight1.intensity = initialLightState.dir1Intensity;
    dirLight1.position.copy(initialLightState.dir1Pos);
    dirLight2.color.copy(initialLightState.dir2Color);
    dirLight2.intensity = initialLightState.dir2Intensity;
    floorLight.color.copy(initialLightState.floorColor);
    floorLight.intensity = initialLightState.floorIntensity;

    // 6. Initialize Sculpting Engine
    const engine = new SculptEngine(ringGeo);
    engine.setRingParams(ringParamsRef.current);
    engine.onGeometryReplaced = (newGeo: THREE.BufferGeometry) => {
      if (ringMeshRef.current) {
        ringMeshRef.current.geometry = newGeo;
        ringMeshRef.current.geometry.computeVertexNormals();
        ringMeshRef.current.geometry.attributes.position.needsUpdate = true;
      }
    };
    sculptEngineRef.current = engine;
    onEngineReady(engine);

    // If stlUrl is provided at mount time, load it into engine and mesh
    if (stlUrl) {
      const loader = new STLLoader();
      loader.load(
        stlUrl,
        (loadedGeo) => {
          engine.loadGeometry(loadedGeo, ringParamsRef.current.innerDiameter);
          if (ringMeshRef.current) {
            ringMeshRef.current.geometry = loadedGeo;
            ringMeshRef.current.geometry.computeVertexNormals();
            ringMeshRef.current.geometry.attributes.position.needsUpdate = true;
          }
        },
        undefined,
        (err) => {
          console.warn('Could not load initial STL in ThreeCanvas mount:', err);
        }
      );
    }

    // 7. Add Visual Brush Outline Ring
    const brushOutlineGeo = new THREE.RingGeometry(1, 1.05, 32);
    const brushOutlineMat = new THREE.MeshBasicMaterial({
      color: 0xff3860, // Warm crimson color for high-visibility tactile focus
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const brushIndicator = new THREE.LineLoop(brushOutlineGeo, brushOutlineMat);
    brushIndicator.visible = false;
    scene.add(brushIndicator);
    brushIndicatorRef.current = brushIndicator as any;

    // 7b. Add 3D Finger Zones (Left & Right 4mm limit zones) & Collision Points
    const fingerZonesGroup = new THREE.Group();
    scene.add(fingerZonesGroup);

    // Compact bounded box geometry that does not cut into background planes
    const zoneBoxGeo = new THREE.BoxGeometry(6, 18, 22);

    const leftZoneMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const leftZoneMesh = new THREE.Mesh(zoneBoxGeo, leftZoneMat);
    leftZoneMesh.renderOrder = 99;
    leftZoneMesh.visible = false;

    const leftEdgesGeo = new THREE.EdgesGeometry(zoneBoxGeo);
    const leftEdgesMat = new THREE.LineBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const leftEdgeLines = new THREE.LineSegments(leftEdgesGeo, leftEdgesMat);
    leftEdgeLines.renderOrder = 100;
    leftZoneMesh.add(leftEdgeLines);
    fingerZonesGroup.add(leftZoneMesh);

    const rightZoneMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const rightZoneMesh = new THREE.Mesh(zoneBoxGeo, rightZoneMat);
    rightZoneMesh.renderOrder = 99;
    rightZoneMesh.visible = false;

    const rightEdgesGeo = new THREE.EdgesGeometry(zoneBoxGeo);
    const rightEdgesMat = new THREE.LineBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const rightEdgeLines = new THREE.LineSegments(rightEdgesGeo, rightEdgesMat);
    rightEdgeLines.renderOrder = 100;
    rightZoneMesh.add(rightEdgeLines);
    fingerZonesGroup.add(rightZoneMesh);

    // Points mesh for highlighting offending vertices in glowing red
    const collisionGeo = new THREE.BufferGeometry();
    const collisionMat = new THREE.PointsMaterial({
      color: 0xff0033,
      size: 1.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const collisionPointsMesh = new THREE.Points(collisionGeo, collisionMat);
    collisionPointsMesh.renderOrder = 101;
    collisionPointsMesh.visible = false;
    scene.add(collisionPointsMesh);

    setLoading(false);

    // Expose snapshot capture function to parent (for cart preview)
    if (onSnapshotReady) {
      onSnapshotReady(() => {
        // Force a fresh render before capture
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/jpeg', 0.75);
      });
    }

    // 8. Animation & Render Loop
    let animationId: number;
    const raycaster = new THREE.Raycaster();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Smooth camera damping updates
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Automatically execute clay relaxation animations smoothly on completion
      if (sculptEngineRef.current) {
        const isRelaxing = sculptEngineRef.current.updateRelaxation();
        if (isRelaxing && ringMeshRef.current) {
          // Recompute normals for rendering
          ringMeshRef.current.geometry.computeVertexNormals();
        }
      }

      // Dynamic brush alignment or insert preview alignment & raycasting
      if (ringMeshRef.current && cameraRef.current && brushIndicatorRef.current && previewGroupRef.current) {
        raycaster.setFromCamera(mousePosition.current, cameraRef.current);

        const activeInsertType = insertTypeRef.current;
        const previewGroup = previewGroupRef.current;

        // In insert mode: test against the ring AND existing insert meshes so the
        // preview normal is correct when hovering over a placed insert.
        let previewHitPoint: THREE.Vector3 | null = null;
        let previewHitNormal: THREE.Vector3 | null = null;

        if (activeInsertType && insertsGroupRef.current) {
          const insertCandidates: THREE.Object3D[] = [ringMeshRef.current, ...insertsGroupRef.current.children];
          const insertIntersects = raycaster.intersectObjects(insertCandidates, false);
          if (insertIntersects.length > 0) {
            const firstHit = insertIntersects[0];
            previewHitPoint = firstHit.point.clone();
            if (insertsGroupRef.current.children.includes(firstHit.object)) {
              // Hit an existing insert — use the actual face normal at the hit point
              // (top face → +Z direction; side face → perpendicular to extrusion)
              previewHitNormal = getInterpolatedNormal(firstHit, firstHit.object as THREE.Mesh);
            } else {
              // Hit the ring — use smooth interpolated vertex normal
              previewHitNormal = getInterpolatedNormal(firstHit, ringMeshRef.current);
            }
          }
        } else {
          const intersects = raycaster.intersectObject(ringMeshRef.current);
          if (intersects.length > 0) {
            previewHitPoint = intersects[0].point.clone();
            previewHitNormal = getInterpolatedNormal(intersects[0], ringMeshRef.current);
          }
        }

        if (previewHitPoint !== null && previewHitNormal !== null) {
          const hit = { point: previewHitPoint, face: { normal: previewHitNormal } };

          if (activeInsertType) {
            brushIndicatorRef.current.visible = false;
            previewGroup.visible = true;

            const transforms = computeSymmetricalTransforms(
              hit.point,
              hit.face.normal,
              symmetryEnabledRef.current,
              symmetryPlaneRef.current,
              symmetryRadialCountRef.current,
              symmetryPlanePerpRef.current
            );

            const engine = sculptEngineRef.current;
            if (engine) {
              const dummyInsert: PlacedInsert = {
                id: 'preview',
                type: activeInsertType,
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
                height: insertHeightRef.current,
                bevel: insertBevelRef.current,
                scale: insertScaleRef.current,
                customPoints: activeInsertType === 'custom' ? customPointsRef.current : undefined,
              };

              const geo = engine.getInsertGeometry(dummyInsert);
              const previewMat = (ringMeshRef.current.material as THREE.Material).clone();
              previewMat.transparent = true;
              previewMat.opacity = 0.55;

              while (previewGroup.children.length < transforms.length) {
                const mesh = new THREE.Mesh();
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                previewGroup.add(mesh);
              }
              while (previewGroup.children.length > transforms.length) {
                const child = previewGroup.children[previewGroup.children.length - 1] as THREE.Mesh;
                previewGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                  if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
                  else child.material.dispose();
                }
              }

              transforms.forEach((tf, idx) => {
                const mesh = previewGroup.children[idx] as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                mesh.geometry = geo.clone();
                if (mesh.material) {
                  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
                  else mesh.material.dispose();
                }
                mesh.material = previewMat.clone();
                mesh.position.copy(tf.position);
                mesh.quaternion.copy(tf.quaternion);
                mesh.visible = true;
              });

              geo.dispose();
              previewMat.dispose();
            }
          } else {
            previewGroup.visible = false;
            brushIndicatorRef.current.visible = true;

            const offsetPos = hit.point.clone().addScaledVector(hit.face.normal, 0.05);
            brushIndicatorRef.current.position.copy(offsetPos);

            const up = new THREE.Vector3(0, 0, 1);
            const q = new THREE.Quaternion().setFromUnitVectors(up, hit.face.normal);
            brushIndicatorRef.current.setRotationFromQuaternion(q);

            const activeRadius = brushConfigRef.current.radius;
            brushIndicatorRef.current.scale.set(activeRadius, activeRadius, 1);
          }
        } else {
          brushIndicatorRef.current.visible = false;
          previewGroup.visible = false;
        }
      }

      // Check Finger Collision and update 3D Zone visuals
      if (ringParamsRef.current && sculptEngineRef.current) {
        const innerRadius = ringParamsRef.current.innerDiameter / 2;
        const limitX = innerRadius + 4.0; // 4mm distance limit from inner diameter

        leftZoneMesh.position.set(-limitX - 3.0, 0, 0);
        rightZoneMesh.position.set(limitX + 3.0, 0, 0);

        const visible = showFingerZonesRef.current ?? true;
        fingerZonesGroup.visible = visible;

        const col = sculptEngineRef.current.checkFingerCollision(limitX);

        if (visible && col.collidingPoints.length > 0) {
          collisionGeo.setAttribute('position', new THREE.BufferAttribute(col.collidingPoints, 3));
          collisionGeo.attributes.position.needsUpdate = true;
          collisionPointsMesh.visible = true;
        } else {
          collisionPointsMesh.visible = false;
        }

        const pulseOpacity = 0.35 + Math.sin(Date.now() * 0.007) * 0.15;

        // Zones remain invisible until an actual collision occurs on that side
        if (visible && col.hasLeft) {
          leftZoneMesh.visible = true;
          leftZoneMat.color.setHex(0xef4444);
          leftZoneMat.opacity = pulseOpacity;
          leftEdgesMat.color.setHex(0xff0044);
          leftEdgesMat.opacity = 0.85;
        } else {
          leftZoneMesh.visible = false;
        }

        if (visible && col.hasRight) {
          rightZoneMesh.visible = true;
          rightZoneMat.color.setHex(0xef4444);
          rightZoneMat.opacity = pulseOpacity;
          rightEdgesMat.color.setHex(0xff0044);
          rightEdgesMat.opacity = 0.85;
        } else {
          rightZoneMesh.visible = false;
        }

        if (onCollisionChangeRef.current) {
          onCollisionChangeRef.current({
            hasCollision: col.hasCollision,
            hasLeft: col.hasLeft,
            hasRight: col.hasRight,
            maxExceed: col.maxExceed,
          });
        }
      }

      // Render Scene directly with clean studio lighting & ACES tone mapping
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // 9. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
      if (composerRef.current) {
        composerRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup Loop
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (composerRef.current) {
        composerRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      ringGeo.dispose();
      ringMat.dispose();
      brushOutlineGeo.dispose();
      brushOutlineMat.dispose();
      if (previewGroupRef.current) {
        while (previewGroupRef.current.children.length > 0) {
          const child = previewGroupRef.current.children[0] as THREE.Mesh;
          previewGroupRef.current.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        }
      }
      onEngineReady(null);
    };
  }, []);

  // Raycasting helper to detect hits
  const performRaycast = (clientX: number, clientY: number): THREE.Intersection | null => {
    if (!rendererRef.current || !cameraRef.current || !ringMeshRef.current) return null;

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    mousePosition.current.set(x, y);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePosition.current, cameraRef.current);
    const intersects = raycaster.intersectObject(ringMeshRef.current);

    return intersects.length > 0 ? intersects[0] : null;
  };

  /**
   * In insert-placement mode, test the ray against both the ring and placed
   * inserts, and return { point, worldNormal } for the closest hit.
   * If the hit is on an insert, the worldNormal is taken as that insert's
   * upward direction (local +Z rotated into world space), so a new insert
   * placed there will be perpendicular to the existing insert's top face.
   */
  const performInsertRaycast = (clientX: number, clientY: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null => {
    if (!rendererRef.current || !cameraRef.current || !ringMeshRef.current) return null;

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    // Collect candidates: ring mesh and all insert meshes
    const candidates: THREE.Object3D[] = [ringMeshRef.current];
    if (insertsGroupRef.current) {
      insertsGroupRef.current.children.forEach((child) => candidates.push(child));
    }

    const intersects = raycaster.intersectObjects(candidates, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const hitObj = hit.object;

    // Check if we hit an insert mesh (a direct child of insertsGroup)
    const insertsGroup = insertsGroupRef.current;
    if (insertsGroup && insertsGroup.children.includes(hitObj)) {
      // Use the actual face normal at the hit point on the insert mesh
      // (top face → insert's extrusion direction; side face → perpendicular to it)
      return { point: hit.point.clone(), normal: getInterpolatedNormal(hit, hitObj as THREE.Mesh) };
    }

    // Hit the ring — use smooth interpolated vertex normal
    if (!hit.face) return null;
    const ringNormal = getInterpolatedNormal(hit, ringMeshRef.current);
    return { point: hit.point.clone(), normal: ringNormal };
  };

  // MOUSE & TOUCH EVENT EVENT HANDLERS
  const handleMouseDown = (e: React.MouseEvent) => {
    // Left click only sculpts/places
    if (e.button !== 0) return;

    const hit = performRaycast(e.clientX, e.clientY);
    if (hit) {
      const activeInsertType = insertTypeRef.current;
      if (activeInsertType) {
        // We are in insert mode! Add insert(s) symmetrically and do not sculpt!
        // Use insert-aware raycast so clicking on an existing insert uses its top normal
        const insertHit = performInsertRaycast(e.clientX, e.clientY);
        if (!insertHit) return;

        const transforms = computeSymmetricalTransforms(
          insertHit.point,
          insertHit.normal,
          symmetryEnabledRef.current,
          symmetryPlaneRef.current,
          symmetryRadialCountRef.current,
          symmetryPlanePerpRef.current
        );

        const newInserts: PlacedInsert[] = transforms.map((tf) => ({
          id: Math.random().toString(36).substr(2, 9),
          type: activeInsertType,
          position: { x: tf.position.x, y: tf.position.y, z: tf.position.z },
          quaternion: { x: tf.quaternion.x, y: tf.quaternion.y, z: tf.quaternion.z, w: tf.quaternion.w },
          height: insertHeightRef.current,
          bevel: insertBevelRef.current,
          scale: insertScaleRef.current,
          customPoints: activeInsertType === 'custom' ? [...customPointsRef.current] : undefined,
        }));

        // Save history state in engine so undos work!
        if (sculptEngineRef.current) {
          sculptEngineRef.current.saveState();
          sculptEngineRef.current.placedInserts.push(...newInserts);
        }

        // Notify parent state
        onAddPlacedInsert(newInserts);
        return;
      }

      isSculptingActive.current = true;
      lastIntersectPoint.current = hit.point.clone();

      // Undo / Redo history saving
      if (sculptEngineRef.current) {
        sculptEngineRef.current.beginStroke(); // Reset stroke-level modified index accumulator
        sculptEngineRef.current.saveState();
      }

      // Audio synthesizer start
      claySoundManager.start();

      // Run first deform stroke
      applySculptStroke(hit);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Keep track of normalized mouse coordinate for cursor preview even if not sculpting
    if (rendererRef.current) {
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mousePosition.current.set(x, y);
    }

    if (!isSculptingActive.current || insertTypeRef.current) return;

    const hit = performRaycast(e.clientX, e.clientY);
    if (hit) {
      applySculptStroke(hit);
    } else {
      claySoundManager.updateSpeed(0);
    }
  };

  const handleMouseUp = () => {
    if (isSculptingActive.current) {
      isSculptingActive.current = false;
      lastIntersectPoint.current = null;

      // Stop the synthesizer
      claySoundManager.stop();

      // Trigger local relaxation — smooths only vertices touched in this stroke
      if (sculptEngineRef.current && ringParamsRef.current) {
        sculptEngineRef.current.triggerRelaxation(ringParamsRef.current);
      }
    }
  };

  // TOUCH EVENT HANDLERS (MOBILE SUPPORT)
  const handleTouchStart = (e: React.TouchEvent) => {
    // Single touch sculpts
    if (e.touches.length !== 1) {
      isSculptingActive.current = false;
      claySoundManager.stop();
      return;
    }

    const touch = e.touches[0];
    const hit = performRaycast(touch.clientX, touch.clientY);
    if (hit) {
      const activeInsertType = insertTypeRef.current;
      if (activeInsertType) {
        // Use insert-aware raycast for correct normal when clicking on existing inserts
        const insertHit = performInsertRaycast(touch.clientX, touch.clientY);
        if (!insertHit) return;

        const transforms = computeSymmetricalTransforms(
          insertHit.point,
          insertHit.normal,
          symmetryEnabledRef.current,
          symmetryPlaneRef.current,
          symmetryRadialCountRef.current,
          symmetryPlanePerpRef.current
        );

        const newInserts: PlacedInsert[] = transforms.map((tf) => ({
          id: Math.random().toString(36).substr(2, 9),
          type: activeInsertType,
          position: { x: tf.position.x, y: tf.position.y, z: tf.position.z },
          quaternion: { x: tf.quaternion.x, y: tf.quaternion.y, z: tf.quaternion.z, w: tf.quaternion.w },
          height: insertHeightRef.current,
          bevel: insertBevelRef.current,
          scale: insertScaleRef.current,
          customPoints: activeInsertType === 'custom' ? [...customPointsRef.current] : undefined,
        }));

        if (sculptEngineRef.current) {
          sculptEngineRef.current.saveState();
          sculptEngineRef.current.placedInserts.push(...newInserts);
        }

        onAddPlacedInsert(newInserts);
        return;
      }

      isSculptingActive.current = true;
      lastIntersectPoint.current = hit.point.clone();

      if (sculptEngineRef.current) {
        sculptEngineRef.current.beginStroke(); // Reset stroke-level modified index accumulator
        sculptEngineRef.current.saveState();
      }

      claySoundManager.start();
      applySculptStroke(hit);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSculptingActive.current || e.touches.length !== 1 || insertTypeRef.current) return;

    const touch = e.touches[0];
    const hit = performRaycast(touch.clientX, touch.clientY);
    if (hit) {
      applySculptStroke(hit);
    } else {
      claySoundManager.updateSpeed(0);
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // Apply actual displacement to model
  const applySculptStroke = (hit: THREE.Intersection) => {
    const engine = sculptEngineRef.current;
    if (!engine || !ringParamsRef.current) return;

    // Calculate mouse drag velocity/direction in 3D for Grab brush
    let dragVector = new THREE.Vector3();
    let speed = 1.0;

    if (lastIntersectPoint.current) {
      dragVector.subVectors(hit.point, lastIntersectPoint.current);
      speed = dragVector.length() * 150; // Map motion to sound index
      claySoundManager.updateSpeed(speed);
    }

    // Execute engine deformation
    engine.sculpt(
      brushConfigRef.current,
      hit.point,
      hit.face!.normal,
      ringParamsRef.current,
      dragVector,
      symmetryEnabled,
      symmetryPlane,
      symmetryRadialCount,
      autoSmoothEnabledRef.current,
      autoSmoothStrengthRef.current,
      symmetryPlanePerp
    );

    // Save current intersection for velocity on next move event
    lastIntersectPoint.current = hit.point.clone();
  };

  // Double click resets camera view elegantly (As requested in camera section)
  const handleDoubleClick = () => {
    if (controlsRef.current && cameraRef.current) {
      // Smoothly zoom/center back to target
      controlsRef.current.target.set(0, 0, 0);
      cameraRef.current.position.set(0, -32, 22);
      controlsRef.current.update();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair overflow-hidden touch-none select-none bg-transparent"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      id="3d-viewport-container"
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 backdrop-blur-xs z-10">
          <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
          <p className="mt-2 text-sm font-sans font-medium text-neutral-600">Подготовка цифровой глины...</p>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full block" id="sculptring-canvas" />

      {/* Floating Camera Help Overlay */}
      <div className="absolute bottom-4 left-4 font-sans text-[12px] tracking-wide text-neutral-500 bg-white/90 px-3 py-2 rounded-2xl shadow-md border border-neutral-200/60 select-none backdrop-blur-md hidden md:flex items-center gap-3.5 z-10">
        <div className="leading-snug text-neutral-600 font-medium">
          <div><strong className="text-neutral-900">ЛКМ:</strong> лепка</div>
          <div><strong className="text-neutral-900">ПКМ:</strong> вращение</div>
          <div><strong className="text-neutral-900">Колесо:</strong> зум</div>
          <div><strong className="text-neutral-900">Дабл-клик:</strong> сброс камеры</div>
        </div>

        <div className="border-l border-neutral-200/80 pl-3 flex items-center">
          <button
            onClick={() => {
              if (onOpenOnboarding) {
                onOpenOnboarding();
              } else {
                window.dispatchEvent(new CustomEvent('nebulae_open_onboarding'));
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer pointer-events-auto"
            title="Пройти обучение заново"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Обучение</span>
          </button>
        </div>
      </div>
    </div>
  );
};
