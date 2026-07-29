/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Undo2,
  Redo2,
  RotateCcw,
  Download,
  Volume2,
  VolumeX,
  Sliders,
  Paintbrush,
  Sparkles,
  Compass,
  Check,
  Eye,
  Hammer,
  Maximize,
  Minimize2,
  RotateCw,
  Move,
  Grid,
  Activity,
  Plus,
  Minus,
  Sun,
  Moon,
  Smile,
  Heart,
  Star,
  Flower,
  PenTool,
  Circle,
  Triangle,
  Square,
  AlertTriangle,
  ShieldAlert,
  ShoppingBag
} from 'lucide-react';
import { ThreeCanvas } from './components/ThreeCanvas';
import { SculptEngine, SculptTool, BrushConfig, RingParams, PlacedInsert } from './components/SculptEngine';
import { CartDrawer } from './components/CartDrawer';
import { CartItem } from './types';

// Helper to filter micro-jitters / clustered points when drawing
const filterMicroJitter = (pts: { x: number; y: number }[]): { x: number; y: number }[] => {
  if (pts.length < 3) return pts;
  const filtered: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = filtered[filtered.length - 1];
    const curr = pts[i];
    const dist = Math.hypot(curr.x - last.x, curr.y - last.y);
    if (dist > 3.0) { // minimum 3 pixels distance to prevent clustering
      filtered.push(curr);
    }
  }
  return filtered;
};

// Helper to apply Chaikin's subdivision algorithm for super smooth curves
const applyChaikin = (pts: { x: number; y: number }[], iterations: number = 3): { x: number; y: number }[] => {
  if (pts.length < 3) return pts;
  let current = [...pts];
  for (let iter = 0; iter < iterations; iter++) {
    const next: { x: number; y: number }[] = [];
    const len = current.length;
    for (let i = 0; i < len; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % len];
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y
      });
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y
      });
    }
    current = next;
  }
  return current;
};

// Cozy blueprint-styled interactive sketch drawing panel for custom insert cross-sections
const DrawingPad = ({ onDrawEnd, onClear }: { onDrawEnd: (points: { x: number; y: number }[]) => void; onClear: () => void }) => {
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const draw = (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) => {
    ctx.clearRect(0, 0, 150, 150);
    
    // Draw blueprint-like dot grid
    ctx.fillStyle = '#e5e7eb';
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    for (let x = 10; x < 150; x += 15) {
      for (let y = 10; y < 150; y += 15) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw lines
    if (pts.length === 0) {
      // Draw placeholder instruction text
      ctx.fillStyle = '#9ca3af';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Нарисуйте контур', 75, 70);
      ctx.fillText('(зажмите и ведите)', 75, 85);
      return;
    }

    ctx.strokeStyle = '#4f46e5'; // Beautiful indigo
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    // Auto close shape for extrusion
    if (pts.length > 2) {
      ctx.lineTo(pts[0].x, pts[0].y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, points);
  }, [points]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    setDrawing(true);
    setPoints([coords]);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    setPoints((prev) => [...prev, coords]);
  };

  const handleEnd = () => {
    if (!drawing) return;
    setDrawing(false);
    if (points.length >= 3) {
      const filtered = filterMicroJitter(points);
      if (filtered.length >= 3) {
        const smoothed = applyChaikin(filtered, 3);
        setPoints(smoothed);
        onDrawEnd(smoothed);
      }
    }
  };

  const handleClearClick = () => {
    setPoints([]);
    onClear();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative border border-neutral-200/80 rounded-xl overflow-hidden bg-neutral-50 shadow-inner">
        <canvas
          ref={canvasRef}
          width={150}
          height={150}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="cursor-crosshair block touch-none"
        />
      </div>
      <button
        onClick={handleClearClick}
        className="text-[13px] text-neutral-500 hover:text-neutral-800 transition-colors bg-neutral-100 hover:bg-neutral-200/85 px-2.5 py-1 rounded-md font-medium"
      >
        Очистить рисунок
      </button>
    </div>
  );
};

export default function App() {
  // Decorative Placed Inserts & Active Selection parameters state
  const [placedInserts, setPlacedInserts] = useState<PlacedInsert[]>([]);
  const [insertType, setInsertType] = useState<'circle' | 'triangle' | 'square' | 'heart' | 'custom' | null>(null);
  const [insertHeight, setInsertHeight] = useState<number>(3.0);
  const [insertBevel, setInsertBevel] = useState<number>(15);
  const [insertScale, setInsertScale] = useState<number>(1.0);
  const [customPoints, setCustomPoints] = useState<{ x: number; y: number }[]>([]);
  // 1. Ring Dimension State
  const [ringParams, setRingParams] = useState<RingParams>({
    innerDiameter: 18.0, // Standard size 18
    width: 4.5,          // 4.5 mm width
    thickness: 2.2,      // 2.2 mm thickness
  });

  // 2. Sculpt Brush Configuration
  const [brushConfig, setBrushConfig] = useState<BrushConfig>({
    tool: SculptTool.Clay,
    radius: 2.5,         // mm
    intensity: 0.6,      // 60%
    isSubtract: false,
  });

  // 3. Audio & Theme State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [materialPreset, setMaterialPreset] = useState('pastel_blue');

  // Symmetry and Daylight settings (timeOfDay goes from 12.0 noon to 24.0 midnight)
  const [symmetryEnabled, setSymmetryEnabled] = useState(true);
  const [symmetryPlane, setSymmetryPlane] = useState(true);
  const [symmetryPlanePerp, setSymmetryPlanePerp] = useState(false);
  const [symmetryRadialCount, setSymmetryRadialCount] = useState(4);
  const [timeOfDay, setTimeOfDay] = useState(12.0);

  // Automatic & Manual Smoothing settings
  const [autoSmoothEnabled, setAutoSmoothEnabled] = useState(true);
  const [autoSmoothStrength, setAutoSmoothStrength] = useState(0.5);
  const [smoothAllCounter, setSmoothAllCounter] = useState(0);

  // 4. Action counters to trigger canvas effects reactively
  const [triggerReset, setTriggerReset] = useState(0);
  const [undoCounter, setUndoCounter] = useState(0);
  const [redoCounter, setRedoCounter] = useState(0);
  const [exportCounter, setExportCounter] = useState(0);

  // 5. Active Engine Reference for tracking undo/redo availability
  const [sculptEngine, setSculptEngine] = useState<SculptEngine | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeTab, setActiveTab] = useState<'sculpt' | 'inserts' | 'inscription'>('sculpt');

  // 6. Inscription State
  const [inscriptionText, setInscriptionText] = useState("");
  const [inscriptionDepth, setInscriptionDepth] = useState(50);
  const [inscriptionSize, setInscriptionSize] = useState(100);
  const [inscriptionWeight, setInscriptionWeight] = useState(2);

  // 7. Finger Zones & Collision Detection State
  const [showFingerZones, setShowFingerZones] = useState(true);
  const [collisionState, setCollisionState] = useState({
    hasCollision: false,
    hasLeft: false,
    hasRight: false,
    maxExceed: 0,
  });

  // 8. Shopping Cart State & Persistence
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      // Clear legacy cart items stored from previous tests so initial cart is empty
      localStorage.removeItem('nebulae_cart');
      localStorage.removeItem('nebulae_cart_v2');
      const saved = localStorage.getItem('nebulae_cart_v3');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartToast, setCartToast] = useState<{ show: boolean; message: string } | null>(null);

  useEffect(() => {
    try {
      // Strip memory object URLs before persisting to localStorage
      const lightweightItems = cartItems.map(({ stlBlobUrl, stlDataUrl, ...rest }) => rest);
      localStorage.setItem('nebulae_cart_v3', JSON.stringify(lightweightItems));
    } catch (e) {
      console.warn('Could not save cart to localStorage:', e);
    }
  }, [cartItems]);

  const calculateRingPrice = (
    params: RingParams,
    material: string,
    insertsCount: number,
    engraving: string
  ) => {
    let basePrice = 1500;
    return basePrice ;
  };

  const handleAddToCart = () => {
    const currentMaterial = materialPresetsList.find((m) => m.id === materialPreset);
    const calculatedPrice = calculateRingPrice(
      ringParams,
      materialPreset,
      placedInserts.length,
      inscriptionText
    );

    let stlBlobUrl: string | undefined;

    if (sculptEngine) {
      try {
        const blob = sculptEngine.generateSTLBlob();
        stlBlobUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.error("Error capturing ring STL snapshot:", err);
      }
    }

    const newItem: CartItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: `Кольцо Nebulae (${ringParams.innerDiameter.toFixed(1)} мм)`,
      ringParams: { ...ringParams },
      materialPreset,
      materialName: currentMaterial?.name || materialPreset,
      materialColorClass: currentMaterial?.colorClass || 'bg-neutral-300',
      inscriptionText,
      placedInsertsCount: placedInserts.length,
      price: calculatedPrice,
      quantity: 1,
      addedAt: new Date().toISOString(),
      stlBlobUrl,
    };

    setCartItems((prev) => [...prev, newItem]);

    setCartToast({
      show: true,
      message: 'Модель добавлена в корзину!',
    });

    setTimeout(() => {
      setCartToast(null);
    }, 4000);
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Helper to normalize, center, and invert drawing points coordinates for extrusion
  const handleSketchEnd = (rawPoints: { x: number; y: number }[]) => {
    if (rawPoints.length < 3) return;

    // 1. Find bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of rawPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    if (width === 0 || height === 0) return;

    // 2. Find center
    const cx = minX + width / 2;
    const cy = minY + height / 2;

    // 3. Normalize points: translate to center and scale so max dimension is 1.0.
    // Also invert Y coordinate so that drawing up goes positive Y in 3D.
    const scale = 2.0 / Math.max(width, height); // Scale to range [-1.0, 1.0]
    const normalized = rawPoints.map(p => ({
      x: (p.x - cx) * scale,
      y: -(p.y - cy) * scale, // Invert Y
    }));

    setCustomPoints(normalized);
  };

  // Sync undo state on mouse/touch interaction
  const handleEngineReady = (engine: SculptEngine | null) => {
    setSculptEngine(engine);
    if (engine) {
      setCanUndo(engine.canUndo());
      setCanRedo(engine.canRedo());
    } else {
      setCanUndo(false);
      setCanRedo(false);
    }
  };

  const triggerUndo = () => {
    if (sculptEngine && sculptEngine.canUndo()) {
      setUndoCounter((prev) => prev + 1);
      // Wait for execution, then sync state
      setTimeout(() => {
        setCanUndo(sculptEngine.canUndo());
        setCanRedo(sculptEngine.canRedo());
        setPlacedInserts([...sculptEngine.placedInserts]);
      }, 30);
    }
  };

  const triggerRedo = () => {
    if (sculptEngine && sculptEngine.canRedo()) {
      setRedoCounter((prev) => prev + 1);
      setTimeout(() => {
        setCanUndo(sculptEngine.canUndo());
        setCanRedo(sculptEngine.canRedo());
        setPlacedInserts([...sculptEngine.placedInserts]);
      }, 30);
    }
  };

  // Synchronize undo/redo state and listen to Ctrl+Z / Ctrl+Y key events
  useEffect(() => {
    const handleMouseUpSync = () => {
      if (sculptEngine) {
        setCanUndo(sculptEngine.canUndo());
        setCanRedo(sculptEngine.canRedo());
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            triggerRedo();
          } else {
            triggerUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          triggerRedo();
        }
      }
    };

    window.addEventListener('mouseup', handleMouseUpSync);
    window.addEventListener('touchend', handleMouseUpSync);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mouseup', handleMouseUpSync);
      window.removeEventListener('touchend', handleMouseUpSync);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sculptEngine, canUndo, canRedo]);

  const materialPresetsList = [
    { id: 'pastel_blue', name: 'голубой', colorClass: 'bg-[#00d2ff]' },
    { id: 'pastel_yellow', name: 'желтый', colorClass: 'bg-[#ffe600]' },
    { id: 'pastel_light_green', name: 'зеленый', colorClass: 'bg-[#00e676]' },
    { id: 'pastel_pink', name: 'розовый', colorClass: 'bg-[#ff3385]' },
    { id: 'pastel_milky', name: 'молочный', colorClass: 'bg-[#fffcf5] border-neutral-300' },
    { id: 'two_tone', name: 'Сине-розовый', colorClass: 'bg-gradient-to-r from-[#00b0ff] to-[#ff00a0]' },
    { id: 'glow_blue', name: 'голубой светящийся', colorClass: 'bg-[#00d8ff] border-dashed shadow-[0_0_12px_rgba(0,216,255,0.85)] animate-pulse' },
  ];

  const isNight = timeOfDay >= 21.0;

  return (
    <div className="relative w-screen h-screen flex flex-col md:flex-row overflow-hidden bg-[#f6f5f1] text-neutral-800 font-sans select-none antialiased">
      
      {/* 1. Canvas Area */}
      <div className="relative flex-1 h-[50vh] md:h-full overflow-hidden" id="viewport-workspace">
        <ThreeCanvas
          ringParams={ringParams}
          brushConfig={brushConfig}
          onEngineReady={handleEngineReady}
          soundEnabled={soundEnabled}
          materialPreset={materialPreset}
          triggerReset={triggerReset}
          undoCounter={undoCounter}
          redoCounter={redoCounter}
          exportCounter={exportCounter}
          symmetryEnabled={symmetryEnabled}
          symmetryPlane={symmetryPlane}
          symmetryPlanePerp={symmetryPlanePerp}
          symmetryRadialCount={symmetryRadialCount}
          timeOfDay={timeOfDay}
          autoSmoothEnabled={autoSmoothEnabled}
          autoSmoothStrength={autoSmoothStrength}
          smoothAllCounter={smoothAllCounter}
          placedInserts={placedInserts}
          insertType={insertType}
          insertHeight={insertHeight}
          insertBevel={insertBevel}
          insertScale={insertScale}
          customPoints={customPoints}
          inscriptionText={inscriptionText}
          inscriptionDepth={inscriptionDepth}
          inscriptionSize={inscriptionSize}
          inscriptionWeight={inscriptionWeight}
          showFingerZones={showFingerZones}
          onCollisionChange={setCollisionState}
          onAddPlacedInsert={(newInserts) => {
            const insertArray = Array.isArray(newInserts) ? newInserts : [newInserts];
            setPlacedInserts((prev) => [...prev, ...insertArray]);
            if (sculptEngine) {
              setCanUndo(sculptEngine.canUndo());
              setCanRedo(sculptEngine.canRedo());
            }
          }}
        />

        {/* Brand Header */}
        <div className="absolute top-5 left-5 pointer-events-none z-10 flex flex-col">
          <h1 className="text-lg font-bold tracking-tight text-neutral-900 select-none">Nebulae ver 0.1</h1>
        </div>

        {/* Real-time Collision Warning Banner */}
        <AnimatePresence>
          {showFingerZones && collisionState.hasCollision && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-rose-600/95 text-white p-4 rounded-2xl shadow-2xl border border-rose-400/40 backdrop-blur-md flex flex-col gap-3 max-w-md w-[92vw] sm:w-auto pointer-events-auto"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-xs sm:text-sm text-rose-50 font-medium leading-snug">
                    Эти части украшения будут мешать соседним пальцам, и носка будет неудобной!
                  </p>
                </div>
              </div>

              {/* Prominent Dismiss / Acknowledge Button */}
              <button
                onClick={() => setShowFingerZones(false)}
                className="w-full py-2 px-3 bg-white text-rose-900 font-bold text-xs rounded-xl shadow-sm hover:bg-rose-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Я знаю, что делаю. Отключить</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Control Panel: Undo/Redo/Reset, Finger Zones & Sound */}
        <div className={`absolute top-5 right-5 z-10 flex items-center gap-1.5 p-1.5 rounded-xl border backdrop-blur-md shadow-sm transition-all duration-300 ${
          isNight 
            ? 'bg-neutral-900/90 border-neutral-800 text-white shadow-neutral-950/40' 
            : 'bg-white/80 border-neutral-200/40 text-neutral-800'
        }`}>
          {/* Finger Zone Toggle Button */}
          <button
            onClick={() => setShowFingerZones(!showFingerZones)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all border ${
              showFingerZones
                ? collisionState.hasCollision
                  ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
                : 'text-neutral-500 hover:bg-neutral-100 border-transparent'
            }`}
            title="Отображение зон 4 мм для соседних пальцев"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Границы</span>
          </button>

          <div className={`w-px h-5 mx-0.5 ${isNight ? 'bg-neutral-800' : 'bg-neutral-200/60'}`} />
          <button
            onClick={triggerUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-all ${
              canUndo 
                ? (isNight ? 'text-neutral-200 hover:bg-neutral-800 active:scale-95' : 'text-neutral-700 hover:bg-neutral-100 active:scale-95') 
                : 'text-neutral-500 cursor-not-allowed'
            }`}
            title="Назад (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={triggerRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-all ${
              canRedo 
                ? (isNight ? 'text-neutral-200 hover:bg-neutral-800 active:scale-95' : 'text-neutral-700 hover:bg-neutral-100 active:scale-95') 
                : 'text-neutral-500 cursor-not-allowed'
            }`}
            title="Вперед (Redo)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              // Note: Avoid window.confirm in iframe previews as they can block/freeze the browser thread.
              // Instead, we perform an instant, seamless reset.
              setTriggerReset((prev) => prev + 1);
              setPlacedInserts([]);
              setInsertType(null);
              setCustomPoints([]);
              setInscriptionText(""); // Reset text inscription
              setInscriptionDepth(50);
              setInscriptionSize(100);
              setInscriptionWeight(2);
              setTimeout(() => {
                setCanUndo(false);
                setCanRedo(false);
              }, 50);
            }}
            className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all"
            title="Сбросить все изменения (Reset)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className={`w-px h-5 mx-0.5 ${isNight ? 'bg-neutral-800' : 'bg-neutral-200/60'}`} />

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-all active:scale-95 ${
              soundEnabled 
                ? (isNight ? 'text-teal-400 hover:bg-neutral-800' : 'text-neutral-700 hover:bg-neutral-100') 
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
            title={soundEnabled ? "Выключить звук" : "Включить звук"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className={`w-px h-5 mx-0.5 ${isNight ? 'bg-neutral-800' : 'bg-neutral-200/60'}`} />

          {/* Cart Header Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              cartItems.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : (isNight ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200' : 'bg-neutral-900 hover:bg-neutral-800 text-white')
            }`}
            id="cart-header-button"
            title="Перейти в корзину для заказа"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Корзина</span>
            {cartItems.length > 0 && (
              <span className="bg-white text-emerald-900 font-mono text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ml-0.5">
                {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Controls & Toolbars Sidebar */}
      <div 
        className="w-full md:w-[380px] h-[50vh] md:h-full bg-white border-t md:border-t-0 md:border-l border-neutral-200/60 shadow-2xl flex flex-col z-20 overflow-y-auto"
        id="controls-sidebar"
      >
        {/* Dimensions & Parameters Section */}
        <div className="p-5 border-b border-neutral-100">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-neutral-500" />
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400">Параметры кольца</h2>
          </div>

          <div className="space-y-4">
            {/* Inner Diameter */}
            <div>
              <div className="flex justify-between items-center text-sm mb-1.5">
                <span className="text-neutral-600 font-medium">Размер пальца (диаметр)</span>
                <span className="font-mono font-bold text-neutral-900 bg-neutral-50 px-2 py-0.5 rounded text-[13px]">
                  {ringParams.innerDiameter.toFixed(1)} мм
                </span>
              </div>
              <input
                type="range"
                min="15.0"
                max="23.0"
                step="0.5"
                value={ringParams.innerDiameter}
                onChange={(e) => setRingParams({ ...ringParams, innerDiameter: parseFloat(e.target.value) })}
                className="w-full accent-neutral-900 h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[13px] text-neutral-400 mt-1 px-1">
                <span>15.0 мм</span>
                <span>23.0 мм</span>
              </div>
            </div>

            {/* Band Width */}
            <div>
              <div className="flex justify-between items-center text-sm mb-1.5">
                <span className="text-neutral-600 font-medium">Ширина шинки</span>
                <span className="font-mono font-bold text-neutral-900 bg-neutral-50 px-2 py-0.5 rounded text-[13px]">
                  {ringParams.width.toFixed(1)} мм
                </span>
              </div>
              <input
                type="range"
                min="2.5"
                max="9.0"
                step="0.5"
                value={ringParams.width}
                onChange={(e) => setRingParams({ ...ringParams, width: parseFloat(e.target.value) })}
                className="w-full accent-neutral-900 h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[13px] text-neutral-400 mt-1 px-1">
                <span>2.5 мм</span>
                <span>9.0 мм</span>
              </div>
            </div>

            {/* Band Thickness */}
            <div>
              <div className="flex justify-between items-center text-sm mb-1.5">
                <span className="text-neutral-600 font-medium">Толщина стенок</span>
                <span className="font-mono font-bold text-neutral-900 bg-neutral-50 px-2 py-0.5 rounded text-[13px]">
                  {ringParams.thickness.toFixed(1)} мм
                </span>
              </div>
              <input
                type="range"
                min="1.6"
                max="4.0"
                step="0.2"
                value={ringParams.thickness}
                onChange={(e) => setRingParams({ ...ringParams, thickness: parseFloat(e.target.value) })}
                className="w-full accent-neutral-900 h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[13px] text-neutral-400 mt-1 px-1">
                <span>1.6 мм</span>
                <span>4.0 мм</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab segmented control */}
        <div className="px-5 pt-3">
          <div className="flex bg-neutral-100 p-1 rounded-xl gap-0.5">
            <button
              onClick={() => {
                setActiveTab('sculpt');
                setInsertType(null);
              }}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                activeTab === 'sculpt'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Лепка
            </button>
            <button
              onClick={() => {
                setActiveTab('inserts');
                setInsertType('circle');
              }}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                activeTab === 'inserts'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Вставки
            </button>
            <button
              onClick={() => {
                setActiveTab('inscription');
                setInsertType(null);
              }}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                activeTab === 'inscription'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Гравировка
            </button>
          </div>
        </div>

        {/* Sculpting Tools Section */}
        {activeTab === 'sculpt' && (
          <div className="p-5 border-b border-neutral-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-4 h-4 text-neutral-500" />
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400">Инструменты лепки</h2>
            </div>

            {/* Segmented Add / Subtract toggles */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setBrushConfig({ ...brushConfig, isSubtract: false });
                  setInsertType(null);
                }}
                className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border font-medium text-[13px] transition-all ${
                  !brushConfig.isSubtract
                    ? 'border-neutral-900 bg-neutral-950 text-white shadow-md'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <Plus className="w-4 h-4 text-emerald-500" />
                Добавить
              </button>
              <button
                onClick={() => {
                  setBrushConfig({ ...brushConfig, isSubtract: true });
                  setInsertType(null);
                }}
                className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border font-medium text-[13px] transition-all ${
                  brushConfig.isSubtract
                    ? 'border-neutral-900 bg-neutral-950 text-white shadow-md'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <Minus className="w-4 h-4 text-rose-500" />
                Убрать
              </button>
            </div>

            {/* Sliders for Radius & Intensity */}
            <div className="space-y-4 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100/50">
              {/* Radius */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Размер</span>
                  <span className="font-mono text-neutral-800 font-semibold">{brushConfig.radius.toFixed(1)} мм</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="6.0"
                  step="0.1"
                  value={brushConfig.radius}
                  onChange={(e) => setBrushConfig({ ...brushConfig, radius: parseFloat(e.target.value) })}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Intensity */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Сила</span>
                  <span className="font-mono text-neutral-800 font-semibold">{(brushConfig.intensity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={brushConfig.intensity}
                  onChange={(e) => setBrushConfig({ ...brushConfig, intensity: parseFloat(e.target.value) })}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>


          </div>
        )}

        {/* Decorative Inserts Section */}
        {activeTab === 'inserts' && (
          <div className="p-5 border-b border-neutral-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Smile className="w-4 h-4 text-neutral-500" />
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400">Вставки на кольцо</h2>
            </div>

            {/* List of decorative shapes */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'circle', name: 'Круг', icon: Circle, isCustom: false },
                { id: 'triangle', name: 'Треугольник', icon: Triangle, isCustom: false },
                { id: 'custom', name: 'Рисунок', icon: PenTool, isCustom: true },
                { id: 'square', name: 'Квадрат', icon: Square, isCustom: false },
                { id: 'heart', name: 'Сердечко', icon: Heart, isCustom: false },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = insertType === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setInsertType(item.id as any);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                      item.isCustom ? 'row-span-2 h-full py-4' : ''
                    } ${
                      isSelected
                        ? 'border-neutral-900 bg-neutral-950 text-white shadow-md'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <Icon className={`${item.isCustom ? 'w-5 h-5 mb-1.5' : 'w-4 h-4 mb-1'} ${isSelected ? 'text-white' : 'text-neutral-500'}`} />
                    <span className="font-medium text-[13px]">{item.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Insert Parameters Sliders */}
            <div className="space-y-4 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100/50">
              {/* Insert Height */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Высота призмы</span>
                  <span className="font-mono text-neutral-800 font-semibold">{insertHeight.toFixed(1)} мм</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={insertHeight}
                  onChange={(e) => setInsertHeight(parseFloat(e.target.value))}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Insert Bevel / Rounding */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Скругление граней</span>
                  <span className="font-mono text-neutral-800 font-semibold">{insertBevel.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={insertBevel}
                  onChange={(e) => setInsertBevel(parseFloat(e.target.value))}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Insert Scale */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Размер вставки</span>
                  <span className="font-mono text-neutral-800 font-semibold">{insertScale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.1"
                  value={insertScale}
                  onChange={(e) => setInsertScale(parseFloat(e.target.value))}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Sketch Pad Drawing Field (Visible when custom is selected) */}
            <AnimatePresence>
              {insertType === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex flex-col items-center justify-center"
                >
                  <span className="text-[13px] uppercase font-bold tracking-wider text-neutral-400 mb-2">Сечение вставки</span>
                  <DrawingPad
                    onDrawEnd={handleSketchEnd}
                    onClear={() => setCustomPoints([])}
                  />
                  <span className="text-[13px] text-neutral-400 text-center mt-2 leading-relaxed">
                    Нарисуйте закрытую форму. Она автоматически выдавится по высоте и преобразуется в 3D призму.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[13px] text-center font-medium leading-relaxed">
              Кликните мышкой в любом месте на кольце, чтобы прикрепить вставку.
            </div>
          </div>
        )}

        {/* Inscription Tab Panel */}
        {activeTab === 'inscription' && (
          <div className="p-5 border-b border-neutral-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 flex items-center justify-center font-bold text-[13px] text-neutral-500 select-none">A</span>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400">Внутренняя надпись</h2>
            </div>

            <div className="space-y-4 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100/50">
              {/* Text Input */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-neutral-500">Текст надписи</label>
                <input
                  type="text"
                  maxLength={32}
                  value={inscriptionText}
                  onChange={(e) => setInscriptionText(e.target.value)}
                  placeholder="LOVE, MOM, 2026..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950 text-sm bg-white font-mono placeholder-neutral-400"
                />
              </div>

              {/* Depth Slider */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Глубина гравировки</span>
                  <span className="font-mono text-neutral-800 font-semibold">{inscriptionDepth.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={inscriptionDepth}
                  onChange={(e) => setInscriptionDepth(parseFloat(e.target.value))}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Size Slider */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Размер шрифта</span>
                  <span className="font-mono text-neutral-800 font-semibold">{inscriptionSize.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={inscriptionSize}
                  onChange={(e) => setInscriptionSize(parseFloat(e.target.value))}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Weight Slider */}
              <div>
                <div className="flex justify-between text-[13px] font-medium text-neutral-500 mb-1">
                  <span>Толщина букв</span>
                  <span className="font-mono text-neutral-800 font-semibold">{inscriptionWeight.toFixed(1)}px</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="12"
                  step="0.5"
                  value={inscriptionWeight}
                  onChange={(e) => setInscriptionWeight(parseFloat(e.target.value))}
                  className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="p-3 bg-teal-50 border border-teal-100 text-teal-800 rounded-xl text-[13px] text-center font-medium leading-relaxed">
              Гравировка появится на внутренней стороне шинки кольца
            </div>
          </div>
        )}

        {/* Symmetry Section */}
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/20" id="symmetry-controls-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-neutral-500" />
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400">Симметрия лепки</h2>
            </div>
            <button
              onClick={() => setSymmetryEnabled(!symmetryEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                symmetryEnabled ? 'bg-neutral-900' : 'bg-neutral-200'
              }`}
              id="symmetry-master-toggle"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  symmetryEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {symmetryEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden pt-1"
                id="symmetry-expanded-panel"
              >
                {/* Axial Symmetry Slider */}
                <div>
                  <div className="flex justify-between items-center text-[13px] text-neutral-500 mb-1.5 font-medium">
                    <span>Осевая симметрия</span>
                    <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded text-[13px]">
                      {symmetryRadialCount}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={symmetryRadialCount}
                    onChange={(e) => setSymmetryRadialCount(parseInt(e.target.value))}
                    className="w-full accent-neutral-950 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                    id="symmetry-radial-count-slider"
                  />
                  <div className="relative text-[13px] text-neutral-400 mt-1 h-3 font-mono mx-[8px]">
                    <span className="absolute left-0 -translate-x-1/2">1x</span>
                    <span className="absolute left-[42.857%] -translate-x-1/2">4x</span>
                    <span className="absolute left-[100%] -translate-x-1/2">8x</span>
                  </div>
                </div>

                {/* Plane Symmetry Toggles */}
                <div className="space-y-3 pt-3 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium text-neutral-700 block">Зеркально по ширине</span>
                      <span className="text-[11px] text-neutral-400 block leading-tight">Отражение вдоль ширины шинки</span>
                    </div>
                    <button
                      onClick={() => setSymmetryPlane(!symmetryPlane)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        symmetryPlane ? 'bg-emerald-600' : 'bg-neutral-200'
                      }`}
                      id="symmetry-plane-toggle"
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          symmetryPlane ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100/60">
                    <div>
                      <span className="text-[13px] font-medium text-neutral-700 block">Зеркально перпендикулярно</span>
                      <span className="text-[11px] text-neutral-400 block leading-tight">Перпендикулярно плоскости кольца</span>
                    </div>
                    <button
                      onClick={() => setSymmetryPlanePerp(!symmetryPlanePerp)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        symmetryPlanePerp ? 'bg-emerald-600' : 'bg-neutral-200'
                      }`}
                      id="symmetry-plane-perp-toggle"
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          symmetryPlanePerp ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Material Preset Selector & Export Panel */}
        <div className="p-5 bg-neutral-50 border-t border-neutral-100">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Paintbrush className="w-4 h-4 text-neutral-500" />
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400">Материал</h2>
            </div>
            
            {/* Color/Material Dots */}
            <div className="flex flex-wrap gap-2.5">
              {materialPresetsList.map((preset) => {
                const isSelected = materialPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setMaterialPreset(preset.id)}
                    className={`group relative w-8 h-8 rounded-full border-2 transition-all active:scale-90 flex items-center justify-center ${
                      preset.colorClass
                    } ${
                      isSelected 
                        ? 'border-neutral-900 shadow-md scale-105' 
                        : 'border-transparent hover:border-neutral-300'
                    }`}
                    title={preset.name}
                    id={`material-btn-${preset.id}`}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-neutral-900" />
                    )}
                    <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[13px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm font-sans z-30">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Daylight Cycle Dial (Освещение) */}
            <div className="mt-4 bg-white rounded-xl border border-neutral-200/50 p-3" id="daylight-wheel-section">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-neutral-700 tracking-wide uppercase">Освещение</span>
                </div>
              </div>
              
              <div className="relative flex items-center justify-center py-1">
                <div className="absolute left-0 text-amber-500" title="Полдень">
                  <Sun className="w-3 h-3" />
                </div>
                <div className="absolute right-0 text-violet-500" title="Полуночь">
                  <Moon className="w-3 h-3" />
                </div>

                <input
                  type="range"
                  min="12.0"
                  max="24.0"
                  step="0.1"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                  className="w-full mx-5 accent-neutral-900 h-1 bg-gradient-to-r from-amber-200 via-orange-300 to-indigo-950 rounded-lg appearance-none cursor-pointer"
                  id="time-of-day-slider"
                />
              </div>



              {materialPreset === 'glow_blue' && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[13px] bg-sky-50 text-sky-600 border border-sky-100 p-1 rounded-md font-medium">
                  {timeOfDay >= 21 ? 'Свечение активно в темноте!' : 'Сдвиньте колесо к ночи, чтобы увидеть свечение в темноте!'}
                </div>
              )}
            </div>
          </div>



          {/* Add to Cart Primary Button & Cart Drawer */}
          <div className="space-y-2 mt-4">
            <button
              onClick={handleAddToCart}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-[13px] font-bold tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              id="add-to-cart-button"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>ДОБАВИТЬ В КОРЗИНУ ({new Intl.NumberFormat('ru-RU').format(calculateRingPrice(ringParams, materialPreset, placedInserts.length, inscriptionText))} ₽)</span>
            </button>

            <div className="flex items-center justify-between px-1 text-xs text-neutral-500">
              <button
                onClick={() => setIsCartOpen(true)}
                className="text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span>В корзине {cartItems.reduce((acc, item) => acc + item.quantity, 0)} шт.</span>
              </button>

              <button
                onClick={() => setExportCounter((prev) => prev + 1)}
                className="text-neutral-400 hover:text-neutral-700 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Скачать исходный STL файл для 3D-печати"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать STL</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Slide-over Drawer & Order Modal */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onExportSTL={() => setExportCounter((prev) => prev + 1)}
      />

      {/* Toast Notification when item added */}
      <AnimatePresence>
        {cartToast?.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-neutral-700/80 flex items-center gap-3 backdrop-blur-md max-w-sm w-[90vw]"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
              <Check className="w-4 h-4" />
            </div>
            <div className="text-xs flex-1">
              <p className="font-bold text-white">{cartToast.message}</p>
              <p className="text-neutral-400 text-[11px]">Параметры сохранены</p>
            </div>
            <button
              onClick={() => {
                setCartToast(null);
                setIsCartOpen(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-all shrink-0 cursor-pointer"
            >
              В корзину
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
