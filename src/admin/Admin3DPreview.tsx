import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { RingParams } from '../types';
import { createRingMaterial } from '../utils/materialUtils';

interface Admin3DPreviewProps {
  stlUrl?: string;
  stlFileName?: string;
  customStlBase64?: string;
  ringParams?: RingParams;
  materialPreset?: string;
  inscription?: string;
  autoRotate?: boolean;
  className?: string;
}

export const Admin3DPreview: React.FC<Admin3DPreviewProps> = ({
  stlUrl,
  stlFileName,
  customStlBase64,
  ringParams = { innerDiameter: 17.5, width: 6, thickness: 2.5 },
  materialPreset = 'ice_blue',
  inscription = '',
  autoRotate = true,
  className = 'w-full h-full min-h-[220px]',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringMeshRef = useRef<THREE.Mesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    let isMounted = true;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 220;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x181a20);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 500);
    camera.position.set(0, 16, 36);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;
    controls.enablePan = false;
    controls.minDistance = 15;
    controls.maxDistance = 60;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(20, 25, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00d2ff, 1.0);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    const floorLight = new THREE.DirectionalLight(0xffffff, 0.6);
    floorLight.position.set(0, -20, 10);
    scene.add(floorLight);

    const createProceduralGeo = (d: number, w: number, th: number) => {
      const innerR = d / 2;
      const r = th / 2;
      const R = innerR + r;
      const geo = new THREE.TorusGeometry(R, r, 64, 180);
      geo.rotateX(Math.PI / 2);
      const posAttr = geo.attributes.position;
      const scaleY = w / th;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, posAttr.getY(i) * scaleY);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const attachGeometry = (geo: THREE.BufferGeometry) => {
      if (!isMounted) return;
      if (ringMeshRef.current) {
        scene.remove(ringMeshRef.current);
        ringMeshRef.current.geometry.dispose();
      }

      const mat = createRingMaterial(materialPreset);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      ringMeshRef.current = mesh;
      setLoading(false);
    };

    setLoading(true);

    const loader = new STLLoader();

    if (stlUrl) {
      loader.load(
        stlUrl,
        (geo) => {
          if (!isMounted) return;
          geo.computeVertexNormals();
          geo.center();
          geo.computeBoundingBox();
          if (geo.boundingBox) {
            const size = new THREE.Vector3();
            geo.boundingBox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              const scaleFactor = (ringParams.innerDiameter + ringParams.thickness * 2) / maxDim;
              geo.scale(scaleFactor, scaleFactor, scaleFactor);
            }
          }
          attachGeometry(geo);
        },
        undefined,
        (err) => {
          console.warn('Error loading STL from URL:', err);
          attachGeometry(createProceduralGeo(ringParams.innerDiameter, ringParams.width, ringParams.thickness));
        }
      );
    } else if (customStlBase64) {
      try {
        const base64Clean = customStlBase64.includes(',') ? customStlBase64.split(',')[1] : customStlBase64;
        const binary = atob(base64Clean);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const loadedGeo = loader.parse(bytes.buffer);
        loadedGeo.computeVertexNormals();
        loadedGeo.center();
        loadedGeo.computeBoundingBox();
        if (loadedGeo.boundingBox) {
          const size = new THREE.Vector3();
          loadedGeo.boundingBox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const scaleFactor = (ringParams.innerDiameter + ringParams.thickness * 2) / maxDim;
            loadedGeo.scale(scaleFactor, scaleFactor, scaleFactor);
          }
        }
        attachGeometry(loadedGeo);
      } catch (err) {
        console.warn('Error parsing base64 STL:', err);
        attachGeometry(createProceduralGeo(ringParams.innerDiameter, ringParams.width, ringParams.thickness));
      }
    } else if (stlFileName) {
      loader.load(
        `/api/catalog/stl/${stlFileName}`,
        (geo) => {
          if (!isMounted) return;
          geo.computeVertexNormals();
          geo.center();
          geo.computeBoundingBox();
          if (geo.boundingBox) {
            const size = new THREE.Vector3();
            geo.boundingBox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              const scaleFactor = (ringParams.innerDiameter + ringParams.thickness * 2) / maxDim;
              geo.scale(scaleFactor, scaleFactor, scaleFactor);
            }
          }
          attachGeometry(geo);
        },
        undefined,
        (err) => {
          console.warn('Error loading STL:', err);
          attachGeometry(createProceduralGeo(ringParams.innerDiameter, ringParams.width, ringParams.thickness));
        }
      );
    } else {
      attachGeometry(createProceduralGeo(ringParams.innerDiameter, ringParams.width, ringParams.thickness));
    }

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (ringMeshRef.current) {
        scene.remove(ringMeshRef.current);
        ringMeshRef.current.geometry.dispose();
      }
    };
  }, [stlUrl, stlFileName, customStlBase64, ringParams.innerDiameter, ringParams.width, ringParams.thickness]);

  // Update material dynamically
  useEffect(() => {
    if (!ringMeshRef.current) return;
    const oldMat = ringMeshRef.current.material;
    ringMeshRef.current.material = createRingMaterial(materialPreset);
    if (Array.isArray(oldMat)) oldMat.forEach((m) => m.dispose());
    else if (oldMat) (oldMat as THREE.Material).dispose();
  }, [materialPreset]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {loading && (
        <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
