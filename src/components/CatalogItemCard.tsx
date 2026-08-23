import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  ShoppingBag,
  PenTool,
  Check,
  RotateCw,
  Sparkles,
  Type,
  Maximize2,
} from 'lucide-react';
import { CatalogItem, CartItem, EditorSnapshot } from '../types';
import { MATERIAL_PRESETS_LIST, createRingMaterial } from '../utils/materialUtils';
import { SculptEngine } from './SculptEngine';

interface CatalogItemCardProps {
  item: CatalogItem;
  onAddToCart: (cartItem: CartItem) => void;
  onOpenEditor: (snapshot: EditorSnapshot, catalogItemName: string) => void;
}

export const CatalogItemCard: React.FC<CatalogItemCardProps> = ({
  item,
  onAddToCart,
  onOpenEditor,
}) => {
  const defaultSize = item.defaultParams?.innerDiameter || 17.5;
  const defaultWidth = item.defaultParams?.width || 6;
  const defaultThickness = item.defaultParams?.thickness || 2.5;

  const [selectedSize, setSelectedSize] = useState<number>(defaultSize);
  const [selectedMaterial, setSelectedMaterial] = useState<string>(item.defaultMaterial || 'ice_blue');
  const [inscription, setInscription] = useState<string>(item.defaultInscription || '');
  const [isAdded, setIsAdded] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const ringMeshRef = useRef<THREE.Mesh | null>(null);
  const engineRef = useRef<SculptEngine | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const baseGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  const activeMaterialInfo =
    MATERIAL_PRESETS_LIST.find((m) => m.id === selectedMaterial) || MATERIAL_PRESETS_LIST[4];

  // ── Three.js Viewport Initialisation ──
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    let isMounted = true;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 280;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfcfbf9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 500);
    camera.position.set(0, 16, 36);

    // 2. Renderer with soft studio contact shadows
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // 3. Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.enablePan = false;
    controls.minDistance = 18;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.85;

    // 4. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfff9f2, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffeed8, 2.0);
    dirLight1.position.set(18, 28, 22);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.left = -35;
    dirLight1.shadow.camera.right = 35;
    dirLight1.shadow.camera.top = 35;
    dirLight1.shadow.camera.bottom = -35;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 160;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xddeeff, 0.9);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.7);
    frontLight.position.set(0, 8, 25);
    scene.add(frontLight);

    // Floor shadow receiver plane
    const shadowGeo = new THREE.PlaneGeometry(120, 120);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -13;
    shadowMesh.receiveShadow = true;
    scene.add(shadowMesh);

    // Procedural Fallback Geometry
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
      baseGeometryRef.current = geo;

      if (ringMeshRef.current) {
        scene.remove(ringMeshRef.current);
        ringMeshRef.current.geometry.dispose();
      }

      const engine = new SculptEngine(geo.clone());
      engine.setRingParams({
        innerDiameter: defaultSize,
        width: defaultWidth,
        thickness: defaultThickness,
      });

      if (selectedSize !== defaultSize) {
        engine.morphToParams({
          innerDiameter: selectedSize,
          width: defaultWidth,
          thickness: defaultThickness,
        });
      }

      if (inscription.trim().length > 0) {
        engine.updateInscription(inscription, 50, 100, 10);
      }

      engineRef.current = engine;

      const mat = createRingMaterial(selectedMaterial);
      const mesh = new THREE.Mesh(engine.geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(0, 0, 0);

      scene.add(mesh);
      ringMeshRef.current = mesh;
      setIsLoadingModel(false);
    };

    // Load STL or procedural
    if (item.stlFileName) {
      const loader = new STLLoader();
      loader.load(
        `/api/catalog/stl/${item.stlFileName}`,
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
              const targetSize = defaultSize + defaultThickness * 2;
              const scaleFactor = targetSize / maxDim;
              geo.scale(scaleFactor, scaleFactor, scaleFactor);
            }
          }
          attachGeometry(geo);
        },
        undefined,
        (err) => {
          console.warn('[CatalogCard] Falling back to procedural geometry for', item.name, err);
          attachGeometry(createProceduralGeo(defaultSize, defaultWidth, defaultThickness));
        }
      );
    } else {
      attachGeometry(createProceduralGeo(defaultSize, defaultWidth, defaultThickness));
    }

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
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
  }, [item.id, item.stlFileName]);

  // ── Sync Material Changes ──
  useEffect(() => {
    if (!ringMeshRef.current) return;
    const oldMat = ringMeshRef.current.material;
    const newMat = createRingMaterial(selectedMaterial);
    ringMeshRef.current.material = newMat;
    if (Array.isArray(oldMat)) oldMat.forEach((m) => m.dispose());
    else if (oldMat) (oldMat as THREE.Material).dispose();
  }, [selectedMaterial]);

  // ── Sync Inscription in Real-Time 3D Geometry ──
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.updateInscription(inscription, 50, 100, 10);
  }, [inscription]);

  // ── Sync Size Morphing without Scaling Outer Profile ──
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.morphToParams({
      innerDiameter: selectedSize,
      width: defaultWidth,
      thickness: defaultThickness,
    });
  }, [selectedSize, defaultWidth, defaultThickness]);

  // ── Handlers ──
  const handleAddToCart = () => {
    let previewDataUrl: string | undefined;
    if (rendererRef.current && sceneRef.current) {
      try {
        previewDataUrl = rendererRef.current.domElement.toDataURL('image/jpeg', 0.85);
      } catch (err) {
        console.warn('Could not generate preview snapshot:', err);
      }
    }

    let customStlBlobUrl: string | undefined;
    if (engineRef.current && (selectedSize !== defaultSize || inscription.trim().length > 0)) {
      try {
        const buffer = engineRef.current.exportSTL(false);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        customStlBlobUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.warn('Could not generate custom STL blob:', e);
      }
    }

    const editorSnapshot: EditorSnapshot = {
      ringParams: {
        innerDiameter: selectedSize,
        width: defaultWidth,
        thickness: defaultThickness,
      },
      materialPreset: selectedMaterial,
      inscriptionText: inscription,
      inscriptionDepth: 50,
      inscriptionSize: 100,
      inscriptionWeight: 10,
      placedInserts: [],
      stlFileName: item.stlFileName,
    };

    const cartItem: CartItem = {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: item.name,
      ringParams: {
        innerDiameter: selectedSize,
        width: defaultWidth,
        thickness: defaultThickness,
      },
      materialPreset: selectedMaterial,
      materialName: activeMaterialInfo.name,
      materialColorClass: activeMaterialInfo.colorClass,
      inscriptionText: inscription,
      placedInsertsCount: 0,
      price: item.price <= 750 ? item.price : Math.round(item.price * 0.5),
      quantity: 1,
      addedAt: new Date().toISOString(),
      previewDataUrl,
      stlBlobUrl: customStlBlobUrl || (item.stlFileName ? `/api/catalog/stl/${item.stlFileName}` : undefined),
      editorSnapshot,
    };

    onAddToCart(cartItem);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2200);
  };

  const handleOpenEditor = () => {
    const snapshot: EditorSnapshot = {
      ringParams: {
        innerDiameter: selectedSize,
        width: defaultWidth,
        thickness: defaultThickness,
      },
      materialPreset: selectedMaterial,
      inscriptionText: inscription,
      inscriptionDepth: 50,
      inscriptionSize: 100,
      inscriptionWeight: 10,
      placedInserts: [],
      stlFileName: item.stlFileName,
    };
    onOpenEditor(snapshot, item.name);
  };

  return (
    <div className="group relative bg-white rounded-3xl border border-neutral-200/80 shadow-sm hover:shadow-xl hover:border-neutral-300 transition-all duration-300 flex flex-col overflow-hidden">
      {/* ── 3D Viewport Header ── */}
      <div
        ref={containerRef}
        className="relative w-full h-[270px] bg-gradient-to-b from-[#fbfaf8] to-[#f4f2ee] flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden select-none"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Badge */}
        {item.badge && (
          <div className="absolute top-3.5 left-3.5 px-3 py-1 bg-neutral-900/85 backdrop-blur-md text-white text-[11px] font-bold tracking-wider uppercase rounded-full shadow-sm">
            {item.badge}
          </div>
        )}

        {/* Category tag */}
        {item.categoryName && (
          <div className="absolute top-3.5 right-3.5 px-2.5 py-1 bg-white/80 backdrop-blur-md text-neutral-600 text-[11px] font-medium rounded-full border border-neutral-200/60">
            {item.categoryName}
          </div>
        )}

        {/* Interactive 3D hint */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/75 backdrop-blur-sm rounded-full text-[10px] text-neutral-500 font-medium pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity">
          <RotateCw className="w-3 h-3 text-neutral-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>3D обзор (потяните для вращения)</span>
        </div>

        {/* Loading Spinner */}
        {isLoadingModel && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="w-7 h-7 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── Content & Controls Area ── */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        {/* Title & Price */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-neutral-900 tracking-tight leading-snug">
              {item.name}
            </h3>
            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="text-xs text-neutral-400 line-through font-normal">
                  {(item.price <= 750 ? item.price * 2 : item.price).toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-lg font-extrabold text-neutral-950 whitespace-nowrap">
                  {(item.price <= 750 ? item.price : Math.round(item.price * 0.5)).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <span className="inline-block px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded text-[9px] font-black uppercase tracking-wide mt-0.5">
                -50% БЕТА
              </span>
            </div>
          </div>
          {item.description && (
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        <div className="space-y-3.5 pt-1 border-t border-neutral-100">
          {/* 1. Size Slider (15 - 23 mm) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 font-medium">Размер кольца (диаметр):</span>
              <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md text-[11px]">
                {selectedSize.toFixed(1)} мм
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 font-mono">15.0</span>
              <input
                type="range"
                min="15.0"
                max="23.0"
                step="0.5"
                value={selectedSize}
                onChange={(e) => setSelectedSize(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
              />
              <span className="text-[10px] text-neutral-400 font-mono">23.0</span>
            </div>
          </div>

          {/* 2. Inscription Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 font-medium flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-neutral-400" />
                Гравировка внутри:
              </span>
              {inscription && (
                <button
                  type="button"
                  onClick={() => setInscription('')}
                  className="text-[10px] text-neutral-400 hover:text-neutral-700 underline"
                >
                  Очистить
                </button>
              )}
            </div>
            <input
              type="text"
              maxLength={24}
              value={inscription}
              onChange={(e) => setInscription(e.target.value)}
              placeholder="Текст гравировки (например: FOREVER)"
              className="w-full px-3 py-1.5 text-xs bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all text-neutral-800 placeholder-neutral-400 font-mono uppercase"
            />
          </div>

          {/* 3. Material Swatches */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 font-medium">Материал:</span>
              <span className="font-semibold text-neutral-800 text-[11px]">
                {activeMaterialInfo.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {MATERIAL_PRESETS_LIST.map((preset) => {
                const isSelected = selectedMaterial === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.name}
                    onClick={() => setSelectedMaterial(preset.id)}
                    className={`w-6 h-6 rounded-full transition-all duration-200 relative flex items-center justify-center ${
                      preset.colorClass
                    } ${
                      isSelected
                        ? 'scale-110 ring-2 ring-offset-2 ring-neutral-900 shadow-md'
                        : 'hover:scale-105 opacity-85 hover:opacity-100 border border-black/10'
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-neutral-900 drop-shadow-xs" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleAddToCart}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm ${
              isAdded
                ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                : 'bg-neutral-950 hover:bg-neutral-800 text-white shadow-neutral-900/15'
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                В корзине!
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                В корзину
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenEditor}
            className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-neutral-200/60"
            title="Открыть эту модель в 3D редакторе для скульптинга и изменений"
          >
            <PenTool className="w-3.5 h-3.5 text-neutral-600" />
            Редактировать
          </button>
        </div>
      </div>
    </div>
  );
};
