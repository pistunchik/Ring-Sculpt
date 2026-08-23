import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Paintbrush,
  PenTool,
  Download,
  Eye,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Circle,
  Square,
  Triangle,
  Heart,
  Type,
  Sun,
  Moon,
  Trash2,
  Info,
  Hand,
  Gem,
} from 'lucide-react';
import { ThreeCanvas } from '../components/ThreeCanvas';
import {
  SculptEngine,
  SculptTool,
  BrushConfig,
  RingParams,
  PlacedInsert,
} from '../components/SculptEngine';
import { claySoundManager } from '../components/ClaySoundManager';
import { MATERIAL_PRESETS_LIST } from '../utils/materialUtils';

// ─── Micro-Jitter Filter & Chaikin Smoothing for Custom 2D Drawing ────────────
interface Point {
  x: number;
  y: number;
}

function filterMicroJitter(pts: Point[], minDist: number = 3.5): Point[] {
  if (pts.length <= 2) return pts;
  const res: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = res[res.length - 1];
    const dx = pts[i].x - last.x;
    const dy = pts[i].y - last.y;
    if (Math.hypot(dx, dy) >= minDist) {
      res.push(pts[i]);
    }
  }
  if (res[res.length - 1] !== pts[pts.length - 1]) {
    res.push(pts[pts.length - 1]);
  }
  return res;
}

function applyChaikin(pts: Point[], iterations: number = 3): Point[] {
  if (pts.length <= 2) return pts;
  let current = pts;
  for (let it = 0; it < iterations; it++) {
    const next: Point[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

const AdminDrawingCanvas: React.FC<{
  onDrawEnd: (points: Point[]) => void;
  onClear: () => void;
}> = ({ onDrawEnd, onClear }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);

  const draw = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
    ctx.clearRect(0, 0, 160, 160);
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
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

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
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
      y: clientY - rect.top,
    };
  };

  const handleStart = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    setDrawing(true);
    setPoints([coords]);
  };

  const handleMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
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
      <div className="relative border border-neutral-700/80 rounded-2xl overflow-hidden bg-neutral-900 shadow-inner">
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
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
        type="button"
        onClick={handleClearClick}
        className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg font-medium cursor-pointer"
      >
        Очистить рисунок
      </button>
    </div>
  );
};

// ─── Main Admin Sculpt Modal ──────────────────────────────────────────────────

interface AdminSculptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRingParams?: RingParams;
  initialMaterial?: string;
  initialInscription?: string;
  initialStlFileName?: string;
  initialCustomStlBase64?: string;
  onSaveModel: (result: {
    ringParams: RingParams;
    materialPreset: string;
    inscriptionText: string;
    customStlBase64: string;
  }) => void;
}

export const AdminSculptModal: React.FC<AdminSculptModalProps> = ({
  isOpen,
  onClose,
  initialRingParams = { innerDiameter: 17.5, width: 6, thickness: 2.5 },
  initialMaterial = 'ice_blue',
  initialInscription = '',
  initialStlFileName,
  initialCustomStlBase64,
  onSaveModel,
}) => {
  if (!isOpen) return null;

  // 1. Dimensions
  const [ringParams, setRingParams] = useState<RingParams>({ ...initialRingParams });
  const [materialPreset, setMaterialPreset] = useState<string>(initialMaterial);
  const [inscriptionText, setInscriptionText] = useState<string>(initialInscription);
  const [inscriptionDepth, setInscriptionDepth] = useState<number>(50);
  const [inscriptionSize, setInscriptionSize] = useState<number>(100);
  const [inscriptionWeight, setInscriptionWeight] = useState<number>(10);

  // 2. Sculpting Brush Config
  const [brushConfig, setBrushConfig] = useState<BrushConfig>({
    tool: SculptTool.Clay,
    radius: 3.5,
    intensity: 0.5,
    isSubtract: false,
  });

  // 3. Symmetry
  const [symmetryEnabled, setSymmetryEnabled] = useState(true);
  const [symmetryPlane, setSymmetryPlane] = useState(true);
  const [symmetryPlanePerp, setSymmetryPlanePerp] = useState(true);
  const [symmetryRadialCount, setSymmetryRadialCount] = useState(0);

  // 4. Auto-smooth & Relaxation
  const [autoSmoothEnabled, setAutoSmoothEnabled] = useState(false);
  const [autoSmoothStrength, setAutoSmoothStrength] = useState(0.3);
  const [smoothAllCounter, setSmoothAllCounter] = useState(0);

  // 5. Placed Decorative Inserts
  const [placedInserts, setPlacedInserts] = useState<PlacedInsert[]>([]);
  const [insertType, setInsertType] = useState<
    'circle' | 'triangle' | 'square' | 'heart' | 'custom' | null
  >(null);
  const [insertHeight, setInsertHeight] = useState<number>(3.0);
  const [insertBevel, setInsertBevel] = useState<number>(15);
  const [insertScale, setInsertScale] = useState<number>(1.0);
  const [customPoints, setCustomPoints] = useState<{ x: number; y: number }[]>([]);

  // 6. Atmosphere & Ergonomics
  const [timeOfDay, setTimeOfDay] = useState<number>(12.0);
  const [showFingerZones, setShowFingerZones] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [collisionState, setCollisionState] = useState({
    hasCollision: false,
    hasLeft: false,
    hasRight: false,
    maxExceed: 0,
  });

  // 7. Engine & Counters
  const [sculptEngine, setSculptEngine] = useState<SculptEngine | null>(null);
  const [triggerReset, setTriggerReset] = useState(0);
  const [undoCounter, setUndoCounter] = useState(0);
  const [redoCounter, setRedoCounter] = useState(0);
  const [exportCounter, setExportCounter] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // 8. Active UI Tab
  const [activeTab, setActiveTab] = useState<
    'sculpt' | 'inserts' | 'params' | 'engraving' | 'material'
  >('sculpt');

  // Load initial STL into sculptEngine if available
  useEffect(() => {
    if (!sculptEngine) return;

    if (initialCustomStlBase64) {
      sculptEngine.loadSTLDataUrl(initialCustomStlBase64);
    } else if (initialStlFileName) {
      fetch(`/api/catalog/stl/${initialStlFileName}`)
        .then((res) => {
          if (!res.ok) throw new Error('File not found');
          return res.blob();
        })
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result && sculptEngine) {
              sculptEngine.loadSTLDataUrl(reader.result as string);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch((err) => console.warn('Could not load STL into admin editor:', err));
    }
  }, [sculptEngine, initialStlFileName, initialCustomStlBase64]);

  const handleEngineReady = (engine: SculptEngine | null) => {
    setSculptEngine(engine);
    if (engine) {
      setCanUndo(engine.canUndo());
      setCanRedo(engine.canRedo());
    }
  };

  const triggerUndo = () => {
    if (sculptEngine && sculptEngine.canUndo()) {
      setUndoCounter((c) => c + 1);
      setTimeout(() => {
        setCanUndo(sculptEngine.canUndo());
        setCanRedo(sculptEngine.canRedo());
      }, 50);
    }
  };

  const triggerRedo = () => {
    if (sculptEngine && sculptEngine.canRedo()) {
      setRedoCounter((c) => c + 1);
      setTimeout(() => {
        setCanUndo(sculptEngine.canUndo());
        setCanRedo(sculptEngine.canRedo());
      }, 50);
    }
  };

  const handleSaveAndApply = () => {
    if (!sculptEngine) return;

    try {
      const blob = sculptEngine.generateSTLBlob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onSaveModel({
          ringParams: { ...ringParams },
          materialPreset,
          inscriptionText,
          customStlBase64: base64,
        });
        onClose();
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error generating STL blob:', err);
      onSaveModel({
        ringParams: { ...ringParams },
        materialPreset,
        inscriptionText,
        customStlBase64: '',
      });
      onClose();
    }
  };

  // Tool presets list
  const tools = [
    { id: SculptTool.Clay, label: 'Глина', icon: Paintbrush, desc: 'Наращивание органического объёма' },
    { id: SculptTool.Carve, label: 'Резьба', icon: PenTool, desc: 'Глубокая выборка и канавки' },
    { id: SculptTool.Smooth, label: 'Сглаживание', icon: Sparkles, desc: 'Локальное полирование неровностей' },
    { id: SculptTool.Flatten, label: 'Грани', icon: Layers, desc: 'Срезание плоскостей и фасок' },
    { id: SculptTool.Inflate, label: 'Раздувание', icon: Circle, desc: 'Радиальное расширение формы' },
    { id: SculptTool.Pinch, label: 'Защип', icon: Gem, desc: 'Сжатие и создание острых ребер' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 md:p-5 overflow-hidden font-sans">
      <div className="relative w-full h-full max-w-7xl bg-[#12141a] border border-neutral-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* ── Modal Header ── */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-[#161822] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                Полный 3D Редактор изделия (Админ-студия)
              </h2>
              <p className="text-[11px] text-neutral-400">
                Моделирование, декоративные вставки, гравировка и экспорт готового STL
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExportCounter((c) => c + 1)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Скачать файл STL на компьютер"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Экспорт STL</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить в карточку</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Main Workspace ── */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* 1. 3D Viewport */}
          <div className="flex-1 h-[50vh] md:h-full relative overflow-hidden bg-[#fcfbf9]">
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
                const arr = Array.isArray(newInserts) ? newInserts : [newInserts];
                setPlacedInserts((prev) => [...prev, ...arr]);
                if (sculptEngine) {
                  setCanUndo(sculptEngine.canUndo());
                  setCanRedo(sculptEngine.canRedo());
                }
              }}
            />

            {/* Top Toolbar Overlay on 3D Canvas */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-white backdrop-blur-md shadow-2xl">
              <button
                type="button"
                onClick={() => setShowFingerZones(!showFingerZones)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  showFingerZones
                    ? collisionState.hasCollision
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'text-neutral-400 hover:bg-neutral-800 border-transparent'
                }`}
                title="Отображение границ 4 мм для соседних пальцев"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Границы</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-800 my-auto" />

              <button
                type="button"
                onClick={triggerUndo}
                disabled={!canUndo}
                className={`p-1.5 rounded-xl transition-all ${
                  canUndo
                    ? 'text-neutral-200 hover:bg-neutral-800 active:scale-95 cursor-pointer'
                    : 'text-neutral-600 cursor-not-allowed'
                }`}
                title="Назад (Undo)"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={triggerRedo}
                disabled={!canRedo}
                className={`p-1.5 rounded-xl transition-all ${
                  canRedo
                    ? 'text-neutral-200 hover:bg-neutral-800 active:scale-95 cursor-pointer'
                    : 'text-neutral-600 cursor-not-allowed'
                }`}
                title="Вперед (Redo)"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setTriggerReset((prev) => prev + 1);
                  setPlacedInserts([]);
                  setInsertType(null);
                  setCustomPoints([]);
                  setInscriptionText('');
                  setTimeout(() => {
                    if (sculptEngine) {
                      setCanUndo(sculptEngine.canUndo());
                      setCanRedo(sculptEngine.canRedo());
                    }
                  }, 50);
                }}
                className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                title="Сбросить форму"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-neutral-800 my-auto" />

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 text-neutral-300 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
                title={soundEnabled ? 'Выключить звук глины' : 'Включить звук глины'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            {/* Collision Warning Banner */}
            {showFingerZones && collisionState.hasCollision && (
              <div className="absolute top-4 left-4 z-20 max-w-sm bg-rose-950/90 border border-rose-500/40 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <p className="text-[11px] text-rose-200 leading-snug">
                  Выступ превышает безопасную зону (4 мм) и может мешать пальцам.
                </p>
              </div>
            )}
          </div>

          {/* 2. Side Control Toolbar (Full-Featured Studio) */}
          <div className="w-full md:w-[380px] bg-[#161822] border-t md:border-t-0 md:border-l border-neutral-800 flex flex-col overflow-hidden">
            {/* Studio Navigation Tabs */}
            <div className="flex bg-[#0f1118] p-1.5 border-b border-neutral-800 overflow-x-auto gap-1">
              {[
                { id: 'sculpt', label: 'Кисти', icon: Paintbrush },
                { id: 'inserts', label: 'Вставки', icon: Gem },
                { id: 'params', label: 'Размер', icon: Sliders },
                { id: 'engraving', label: 'Текст', icon: Type },
                { id: 'material', label: 'Материал', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-neutral-800 text-cyan-400 shadow-md border border-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-neutral-200 text-xs">
              {/* ── TAB 1: SCULPTING BRUSHES & SYMMETRY ── */}
              {activeTab === 'sculpt' && (
                <div className="space-y-5">
                  {/* Tool Selection Grid */}
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                      Инструмент скульптинга
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {tools.map((t) => {
                        const Icon = t.icon;
                        const isSelected = brushConfig.tool === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setBrushConfig((b) => ({ ...b, tool: t.id }))}
                            className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1 ${
                              isSelected
                                ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-md'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">{t.label}</span>
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-neutral-500'}`} />
                            </div>
                            <span className="text-[10px] text-neutral-500 leading-tight">{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brush Radius & Intensity */}
                  <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-neutral-400">Радиус кисти</span>
                        <span className="font-mono text-cyan-400 font-bold">{brushConfig.radius.toFixed(1)} мм</span>
                      </div>
                      <input
                        type="range"
                        min={1.0}
                        max={8.0}
                        step={0.1}
                        value={brushConfig.radius}
                        onChange={(e) => setBrushConfig((b) => ({ ...b, radius: parseFloat(e.target.value) }))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-neutral-400">Сила воздействия</span>
                        <span className="font-mono text-cyan-400 font-bold">{Math.round(brushConfig.intensity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        value={brushConfig.intensity}
                        onChange={(e) => setBrushConfig((b) => ({ ...b, intensity: parseFloat(e.target.value) }))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-300">Инверсия кисти (вычитание -)</span>
                      <button
                        type="button"
                        onClick={() => setBrushConfig((b) => ({ ...b, isSubtract: !b.isSubtract }))}
                        className={`px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          brushConfig.isSubtract
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {brushConfig.isSubtract ? 'Вычитание (-)' : 'Добавление (+)'}
                      </button>
                    </div>
                  </div>

                  {/* Symmetry Options */}
                  <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-300">Симметрия</span>
                      <button
                        type="button"
                        onClick={() => setSymmetryEnabled(!symmetryEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          symmetryEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        {symmetryEnabled ? 'Включена' : 'Выключена'}
                      </button>
                    </div>

                    {symmetryEnabled && (
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1.5">Радиальная симметрия</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[0, 2, 3, 4, 6, 8, 12, 16].map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setSymmetryRadialCount(count)}
                                className={`py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                  symmetryRadialCount === count
                                    ? 'bg-cyan-500 text-neutral-950 shadow-sm'
                                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                {count === 0 ? 'Выкл' : `${count}x`}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSymmetryPlane(!symmetryPlane)}
                            className={`flex-1 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                              symmetryPlane
                                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                                : 'bg-neutral-800/50 border-neutral-700 text-neutral-500'
                            }`}
                          >
                            Плоскость X
                          </button>
                          <button
                            type="button"
                            onClick={() => setSymmetryPlanePerp(!symmetryPlanePerp)}
                            className={`flex-1 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                              symmetryPlanePerp
                                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                                : 'bg-neutral-800/50 border-neutral-700 text-neutral-500'
                            }`}
                          >
                            Плоскость Z
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Smooth All Action */}
                  <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-3">
                    <span className="font-bold text-neutral-300 block">Глобальное сглаживание</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSmoothAllCounter((c) => c + 1);
                      }}
                      className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Сгладить всю поверхность</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── TAB 2: DECORATIVE INSERTS ── */}
              {activeTab === 'inserts' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                      Форма декоративной вставки
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'circle', label: 'Круг', icon: Circle },
                        { id: 'triangle', label: 'Треугольник', icon: Triangle },
                        { id: 'square', label: 'Квадрат', icon: Square },
                        { id: 'heart', label: 'Сердце', icon: Heart },
                        { id: 'custom', label: 'Свой рисунок', icon: PenTool },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = insertType === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setInsertType(item.id as any)}
                            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-md'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-[11px] font-semibold">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {insertType === 'custom' && (
                    <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 flex flex-col items-center">
                      <span className="text-neutral-400 text-xs mb-2">Нарисуйте контур вставки</span>
                      <AdminDrawingCanvas
                        onDrawEnd={setCustomPoints}
                        onClear={() => setCustomPoints([])}
                      />
                    </div>
                  )}

                  {insertType && (
                    <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-neutral-400">Высота выступа</span>
                          <span className="font-mono text-cyan-400 font-bold">{insertHeight.toFixed(1)} мм</span>
                        </div>
                        <input
                          type="range"
                          min={1.0}
                          max={8.0}
                          step={0.5}
                          value={insertHeight}
                          onChange={(e) => setInsertHeight(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-neutral-400">Фаска (угол скоса)</span>
                          <span className="font-mono text-cyan-400 font-bold">{insertBevel}°</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={45}
                          step={5}
                          value={insertBevel}
                          onChange={(e) => setInsertBevel(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-neutral-400">Масштаб</span>
                          <span className="font-mono text-cyan-400 font-bold">{insertScale.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.5}
                          max={2.5}
                          step={0.1}
                          value={insertScale}
                          onChange={(e) => setInsertScale(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {placedInserts.length > 0 && (
                    <div className="pt-2 flex items-center justify-between border-t border-neutral-800">
                      <span className="text-neutral-400">Установлено вставок: {placedInserts.length}</span>
                      <button
                        type="button"
                        onClick={() => setPlacedInserts([])}
                        className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Очистить все</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: DIMENSIONS & PARAMETERS ── */}
              {activeTab === 'params' && (
                <div className="space-y-4">
                  <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-neutral-300 font-medium">Внутренний диаметр (размер)</span>
                        <span className="font-mono text-cyan-400 font-bold text-sm">
                          {ringParams.innerDiameter.toFixed(1)} мм
                        </span>
                      </div>
                      <input
                        type="range"
                        min={15.0}
                        max={23.0}
                        step={0.5}
                        value={ringParams.innerDiameter}
                        onChange={(e) =>
                          setRingParams((p) => ({ ...p, innerDiameter: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-neutral-300 font-medium">Ширина кольца (высота)</span>
                        <span className="font-mono text-cyan-400 font-bold text-sm">
                          {ringParams.width.toFixed(1)} мм
                        </span>
                      </div>
                      <input
                        type="range"
                        min={3.0}
                        max={12.0}
                        step={0.5}
                        value={ringParams.width}
                        onChange={(e) =>
                          setRingParams((p) => ({ ...p, width: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-neutral-300 font-medium">Толщина стенки</span>
                        <span className="font-mono text-cyan-400 font-bold text-sm">
                          {ringParams.thickness.toFixed(1)} мм
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.5}
                        max={4.5}
                        step={0.1}
                        value={ringParams.thickness}
                        onChange={(e) =>
                          setRingParams((p) => ({ ...p, thickness: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Shape Templates */}
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                      Базовые профили
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Классика', p: { innerDiameter: 17.5, width: 6.0, thickness: 2.5 } },
                        { name: 'Печатка', p: { innerDiameter: 18.5, width: 8.5, thickness: 3.2 } },
                        { name: 'Волна', p: { innerDiameter: 17.0, width: 7.5, thickness: 2.75 } },
                        { name: 'Минимал', p: { innerDiameter: 17.0, width: 4.5, thickness: 2.0 } },
                      ].map((tpl) => (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => setRingParams(tpl.p)}
                          className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-left transition-all cursor-pointer"
                        >
                          <p className="font-bold text-xs">{tpl.name}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            {tpl.p.width}×{tpl.p.thickness} мм
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 4: ENGRAVING / INSCRIPTION ── */}
              {activeTab === 'engraving' && (
                <div className="space-y-4">
                  <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-4">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1.5">
                        Текст внутренней гравировки
                      </label>
                      <input
                        type="text"
                        maxLength={24}
                        placeholder="Например: FOREVER, ECLIPSE..."
                        value={inscriptionText}
                        onChange={(e) => setInscriptionText(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono uppercase text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-neutral-400">Глубина выдавливания</span>
                        <span className="font-mono text-cyan-400 font-bold">{inscriptionDepth}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={inscriptionDepth}
                        onChange={(e) => setInscriptionDepth(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-neutral-400">Размер шрифта</span>
                        <span className="font-mono text-cyan-400 font-bold">{inscriptionSize}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        step={5}
                        value={inscriptionSize}
                        onChange={(e) => setInscriptionSize(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-neutral-400">Толщина букв</span>
                        <span className="font-mono text-cyan-400 font-bold">{inscriptionWeight}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={inscriptionWeight}
                        onChange={(e) => setInscriptionWeight(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 5: MATERIALS & LIGHTING ── */}
              {activeTab === 'material' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                      Палитра ювелирных материалов
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {MATERIAL_PRESETS_LIST.map((mat) => {
                        const isSelected = materialPreset === mat.id;
                        return (
                          <button
                            key={mat.id}
                            type="button"
                            onClick={() => setMaterialPreset(mat.id)}
                            className={`p-3 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-md'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full shrink-0 shadow-sm border border-white/20 ${mat.colorClass}`}
                            />
                            <span className="text-xs font-semibold truncate">{mat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time of Day Lighting */}
                  <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Время суток (Освещение)</span>
                      </span>
                      <span className="font-mono text-cyan-400 font-bold text-xs">{timeOfDay.toFixed(0)}:00</span>
                    </div>
                    <input
                      type="range"
                      min={12.0}
                      max={24.0}
                      step={0.5}
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Export / Save CTA */}
            <div className="p-4 border-t border-neutral-800 bg-[#12141a] mt-auto">
              <button
                type="button"
                onClick={handleSaveAndApply}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Сохранить 3D модель в карточку</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
