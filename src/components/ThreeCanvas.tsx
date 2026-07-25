import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SculptEngine, BrushConfig, RingParams, SculptTool, PlacedInsert } from './SculptEngine';
import { claySoundManager } from './ClaySoundManager';
import { Loader2 } from 'lucide-react';

interface ThreeCanvasProps {
  ringParams: RingParams;
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
}

// Less matte (glossy, clean resin/porcelain finish) and bright, pure colors
const materialPresets: Record<string, any> = {
  pastel_blue: {
    color: 0x00d2ff, // Bright, pure electric sky blue
    roughness: 0.16,
    metalness: 0.03,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    transmission: 0.2,
    thickness: 1.2,
    label: "голубой"
  },
  pastel_yellow: {
    color: 0xffe600, // Vibrant, pure, rich sunshine yellow
    roughness: 0.15,
    metalness: 0.03,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    transmission: 0.2,
    thickness: 1.2,
    label: "желтый"
  },
  pastel_light_green: {
    color: 0x00e676, // Bright, clean, fresh emerald mint green
    roughness: 0.16,
    metalness: 0.03,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    transmission: 0.2,
    thickness: 1.2,
    label: "зеленый"
  },
  pastel_pink: {
    color: 0xff3385, // Vibrant, pure candy blossom pink
    roughness: 0.16,
    metalness: 0.03,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    transmission: 0.2,
    thickness: 1.2,
    label: "розовый"
  },
  pastel_milky: {
    color: 0xfffcf5, // Clean, luminous glossy white porcelain
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 0.8,
    clearcoatRoughness: 0.05,
    transmission: 0.35,
    thickness: 1.8,
    label: "молочный"
  },
  two_tone: {
    color: 0xffffff,
    roughness: 0.10,
    metalness: 0.40,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    label: "Сине-розовый"
  },
  glow_blue: {
    color: 0x00c4ff, // Clean cyan blue base
    emissive: 0x0088dd, // Soft glow blue
    emissiveIntensity: 0.75, // Reduced glow intensity for a calmer, less bright aesthetic
    roughness: 0.12,
    metalness: 0.05,
    label: "голубой светящийся"
  }
};

const createMaterial = (presetName: string): THREE.Material => {
  const params = materialPresets[presetName] || materialPresets.pastel_blue;

  if (presetName === 'glow_blue') {
    return new THREE.MeshPhysicalMaterial({
      color: params.color,
      emissive: new THREE.Color(params.emissive),
      emissiveIntensity: params.emissiveIntensity,
      roughness: params.roughness,
      metalness: params.metalness,
      shadowSide: THREE.DoubleSide,
    });
  }

  if (presetName === 'two_tone') {
    const mat = new THREE.MeshPhysicalMaterial({
      roughness: 0.15,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      shadowSide: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;
         varying vec3 vLocalNormal;`
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLocalPos = position;
         vLocalNormal = normal;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;
         varying vec3 vLocalNormal;`
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 N = vec3(0.0, 0.0, 1.0);
         if (length(vLocalNormal) > 0.001) {
           N = normalize(vLocalNormal);
         }
         // Custom split direction representing the co-extrusion plane.
         // A tilted axis ensures all curvatures of the ring (X, Y, Z axes) display the rich color shift.
         vec3 splitDir = normalize(vec3(1.0, 0.35, 0.2));
         float dotVal = dot(N, splitDir);
         float mixRatio = smoothstep(-0.55, 0.55, dotVal);
         
         // Premium silk co-extruded filament colors (deep vibrant royal cyan-blue and lush neon magenta-pink)
         vec3 blueColor = vec3(0.05, 0.52, 1.0);
         vec3 pinkColor = vec3(1.0, 0.18, 0.72);
         
         diffuseColor.rgb = mix(blueColor, pinkColor, mixRatio);`
      );
    };
    return mat;
  }

  return new THREE.MeshPhysicalMaterial({
    color: params.color,
    roughness: params.roughness,
    metalness: params.metalness,
    transmission: params.transmission || 0,
    thickness: params.thickness || 0,
    clearcoat: params.clearcoat || 0,
    clearcoatRoughness: params.clearcoatRoughness || 0,
    shadowSide: THREE.DoubleSide,
  });
};

// Generates warm, cozy, atmospheric lights and background based on the timeOfDay (12:00 -> 24:00)
const getLightState = (t: number) => {
  const time = Math.max(12, Math.min(24, t));

  // Noon (12:00) - Bright, clean cozy daylight, high soft warm sun
  const noon = {
    bgColor: new THREE.Color(0xfbfaf6),
    ambientColor: new THREE.Color(0xfff9f2),
    ambientIntensity: 0.65,
    dir1Color: new THREE.Color(0xffebd2),
    dir1Intensity: 1.6,
    dir1Pos: new THREE.Vector3(25, -20, 30),
    dir2Color: new THREE.Color(0xd9efff),
    dir2Intensity: 0.45,
    floorColor: new THREE.Color(0xffebd2),
    floorIntensity: 0.25,
  };

  // Sunset/Evening (18:00) - Golden warm window-cast light, rosy warm environment
  const evening = {
    bgColor: new THREE.Color(0xf5dcc5), // Beautiful peach-amber cozy sunset background
    ambientColor: new THREE.Color(0xffcfaf), // Cozy amber fill
    ambientIntensity: 0.55,
    dir1Color: new THREE.Color(0xff8a27), // Deep golden orange sunset
    dir1Intensity: 1.9,
    dir1Pos: new THREE.Vector3(35, -15, 18), // Slanted low angle for long shadows
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
    dir1Pos: new THREE.Vector3(20, -10, 25),
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

const rotateVectorZ = (vec: THREE.Vector3, angle: number): THREE.Vector3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new THREE.Vector3(
    vec.x * cos - vec.y * sin,
    vec.x * sin + vec.y * cos,
    vec.z
  );
};

const mirrorVectorZ = (vec: THREE.Vector3): THREE.Vector3 => {
  return new THREE.Vector3(vec.x, vec.y, -vec.z);
};

export const computeSymmetricalTransforms = (
  hitPoint: THREE.Vector3,
  hitNormal: THREE.Vector3,
  symmetryEnabled: boolean,
  symmetryPlane: boolean,
  symmetryRadialCount: number
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

    const ptRot = rotateVectorZ(hitPoint, angle);
    const normRot = rotateVectorZ(hitNormal, angle);
    addUniqueTransform(ptRot, normRot);

    if (symmetryPlane) {
      const ptMir = mirrorVectorZ(ptRot);
      const normMir = mirrorVectorZ(normRot);
      addUniqueTransform(ptMir, normMir);
    }
  }

  return transforms;
};

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  ringParams,
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
  const symmetryRadialCountRef = useRef(symmetryRadialCount);

  useEffect(() => {
    symmetryEnabledRef.current = symmetryEnabled;
  }, [symmetryEnabled]);

  useEffect(() => {
    symmetryPlaneRef.current = symmetryPlane;
  }, [symmetryPlane]);

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

          // Cylindrical projection
          const theta = Math.atan2(v.y, v.x);
          const dxy = Math.sqrt(v.x * v.x + v.y * v.y);
          const z = v.z;

          // Compute distance relative to old inner radius (representing local sculpt height)
          const localThickness = dxy - oldInnerRadius;
          // Scale radial sculpt thickness proportionally
          const thicknessRatio = oldThickness > 0 ? (localThickness / oldThickness) : 1;
          const newDxy = newInnerRadius + thicknessRatio * newThickness;

          // Scale height (width) along Z
          const widthRatio = oldWidth > 0 ? (z / oldWidth) : 1;
          const newZ = widthRatio * newWidth;

          // Map back to Cartesian coordinates
          v.x = Math.cos(theta) * newDxy;
          v.y = Math.sin(theta) * newDxy;
          v.z = newZ;

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

  // Handle Undo Trigger
  useEffect(() => {
    if (undoCounter > 0 && sculptEngineRef.current) {
      sculptEngineRef.current.undo();
    }
  }, [undoCounter]);

  // Handle Redo Trigger
  useEffect(() => {
    if (redoCounter > 0 && sculptEngineRef.current) {
      sculptEngineRef.current.redo();
    }
  }, [redoCounter]);

  // Handle Export Trigger
  useEffect(() => {
    if (exportCounter > 0 && sculptEngineRef.current) {
      sculptEngineRef.current.exportSTL();
    }
  }, [exportCounter]);

  // Handle Global Smoothing Trigger
  useEffect(() => {
    if (smoothAllCounter > 0 && sculptEngineRef.current && ringParamsRef.current) {
      sculptEngineRef.current.smoothAll(ringParamsRef.current, 3, autoSmoothStrengthRef.current);
    }
  }, [smoothAllCounter]);

  // Procedural Ring Geometry Generator
  const createRingGeometry = (params: RingParams) => {
    const radialSegments = 120;
    const tubularSegments = 360;

    const innerRadius = params.innerDiameter / 2;
    const r = params.thickness / 2;
    const R = innerRadius + r;

    // Base Torus
    const geometry = new THREE.TorusGeometry(R, r, radialSegments, tubularSegments);

    // Continuous stretching along the Z axis to fit the ring width
    const posAttr = geometry.attributes.position;
    const scaleZ = params.width / params.thickness;

    for (let i = 0; i < posAttr.count; i++) {
      const z = posAttr.getZ(i);
      posAttr.setZ(i, z * scaleZ);
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
    if (!containerRef.current || !canvasRef.current) return;

    // 1. Initialize Scene & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfbf9f5); // Warm, cozy off-white/beige studio background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      40,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    // Beautiful, relaxed initial angle looking slightly from top-right
    camera.position.set(0, -32, 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for mobile performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // Beautiful, ultra-soft contact shadows
    rendererRef.current = renderer;

    // 1b. Initialize Postprocessing Composer & Ambient Occlusion (SSAO)
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const ssaoPass = new SSAOPass(scene, camera, width, height);
    ssaoPass.kernelRadius = 2.0;
    ssaoPass.minDistance = 0.001;
    ssaoPass.maxDistance = 0.1;
    composer.addPass(ssaoPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    composerRef.current = composer;
    ssaoPassRef.current = ssaoPass;

    // 2. Add Ambient Contact Ground Plane
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.z = -35; // Pushed further back behind the model
    ground.receiveShadow = true;
    scene.add(ground);

    // 3. Add Studio Lights Setup (Cozy warm sunlight streaming from a window)
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.55); // Soft, warm cozy ambient base fill
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight1 = new THREE.DirectionalLight(0xffebca, 1.7); // Warm golden sunlight from a window
    dirLight1.position.set(25, -20, 30); // Higher, slanted window angle for cozy long shadows
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 200;
    dirLight1.shadow.camera.left = -30;
    dirLight1.shadow.camera.right = 30;
    dirLight1.shadow.camera.top = 30;
    dirLight1.shadow.camera.bottom = -30;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);
    dirLight1Ref.current = dirLight1;

    const dirLight2 = new THREE.DirectionalLight(0xd9f0ff, 0.40); // Cool soft sky-blue fill from opposite side of the window
    dirLight2.position.set(-25, 25, 15);
    scene.add(dirLight2);
    dirLight2Ref.current = dirLight2;

    const floorLight = new THREE.DirectionalLight(0xffeed6, 0.20); // Warm reflected floor bounce light
    floorLight.position.set(0, 0, -20);
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
    sculptEngineRef.current = engine;
    onEngineReady(engine);

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
    const zoneBoxGeo = new THREE.BoxGeometry(6, 22, 18);

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
        const intersects = raycaster.intersectObject(ringMeshRef.current);

        const activeInsertType = insertTypeRef.current;
        const previewGroup = previewGroupRef.current;

        if (intersects.length > 0) {
          const hit = intersects[0];
          
          if (activeInsertType) {
            brushIndicatorRef.current.visible = false;
            previewGroup.visible = true;

            const normal = hit.face!.normal.clone().transformDirection(ringMeshRef.current.matrixWorld);

            const transforms = computeSymmetricalTransforms(
              hit.point,
              normal,
              symmetryEnabledRef.current,
              symmetryPlaneRef.current,
              symmetryRadialCountRef.current
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
            
            const offsetPos = hit.point.clone().addScaledVector(hit.face!.normal, 0.05);
            brushIndicatorRef.current.position.copy(offsetPos);
            
            const up = new THREE.Vector3(0, 0, 1);
            const q = new THREE.Quaternion().setFromUnitVectors(up, hit.face!.normal);
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

      // Render Scene with Ambient Occlusion (Composer) or direct renderer fallback
      if (composerRef.current) {
        composerRef.current.render();
      } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
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

  // MOUSE & TOUCH EVENT EVENT HANDLERS
  const handleMouseDown = (e: React.MouseEvent) => {
    // Left click only sculpts/places
    if (e.button !== 0) return;

    const hit = performRaycast(e.clientX, e.clientY);
    if (hit) {
      const activeInsertType = insertTypeRef.current;
      if (activeInsertType) {
        // We are in insert mode! Add insert(s) symmetrically and do not sculpt!
        const ringMesh = ringMeshRef.current;
        if (!ringMesh) return;

        const normal = hit.face!.normal.clone().transformDirection(ringMesh.matrixWorld);
        const transforms = computeSymmetricalTransforms(
          hit.point,
          normal,
          symmetryEnabledRef.current,
          symmetryPlaneRef.current,
          symmetryRadialCountRef.current
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

      // Trigger organic clay-relaxing/melting animation
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
        const ringMesh = ringMeshRef.current;
        if (!ringMesh) return;

        const normal = hit.face!.normal.clone().transformDirection(ringMesh.matrixWorld);
        const transforms = computeSymmetricalTransforms(
          hit.point,
          normal,
          symmetryEnabledRef.current,
          symmetryPlaneRef.current,
          symmetryRadialCountRef.current
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
      autoSmoothStrengthRef.current
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
      <div className="absolute bottom-4 left-4 font-sans text-[13px] tracking-wide text-neutral-400 bg-white/85 px-2.5 py-1.5 rounded-full shadow-xs border border-neutral-100/40 select-none pointer-events-none backdrop-blur-xs max-w-xs leading-relaxed hidden md:block">
        🖱️ <strong className="text-neutral-600">Левый клик:</strong> лепка • <strong className="text-neutral-600">Правый клик:</strong> вращение • <strong className="text-neutral-600">Колесо:</strong> зум • <strong className="text-neutral-600">Дабл-клик:</strong> сброс камеры
      </div>
    </div>
  );
};
