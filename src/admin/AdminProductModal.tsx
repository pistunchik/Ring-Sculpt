import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  PenTool,
  Check,
  Sparkles,
  AlertCircle,
  FileCode,
  Sliders,
  DollarSign,
  Tag,
  Eye,
  Trash2,
} from 'lucide-react';
import { CatalogItem, RingParams } from '../types';
import { Admin3DPreview } from './Admin3DPreview';
import { AdminSculptModal } from './AdminSculptModal';
import { MATERIAL_PRESETS_LIST, MATERIAL_GROUPS } from '../utils/materialUtils';

interface AdminProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  adminPassword: string;
  itemToEdit?: CatalogItem | null;
}

export const AdminProductModal: React.FC<AdminProductModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  adminPassword,
  itemToEdit,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(itemToEdit);

  const [name, setName] = useState(itemToEdit?.name || '');
  const [category, setCategory] = useState(itemToEdit?.category || 'rings');
  const [categoryName, setCategoryName] = useState(itemToEdit?.categoryName || 'Кольца');
  const [badge, setBadge] = useState(itemToEdit?.badge || '');
  const [description, setDescription] = useState(itemToEdit?.description || '');
  const [price, setPrice] = useState<number>(itemToEdit?.price || 1850);
  const [isActive, setIsActive] = useState<boolean>(itemToEdit?.isActive ?? true);

  const [ringParams, setRingParams] = useState<RingParams>(
    itemToEdit?.defaultParams || { innerDiameter: 17.5, width: 6, thickness: 2.5 }
  );
  const [defaultMaterial, setDefaultMaterial] = useState<string>(
    itemToEdit?.defaultMaterial || 'ice_blue'
  );
  const [defaultInscription, setDefaultInscription] = useState<string>(
    itemToEdit?.defaultInscription || ''
  );

  const [selectedStlFile, setSelectedStlFile] = useState<File | null>(null);
  const [previewStlUrl, setPreviewStlUrl] = useState<string>('');
  const [customStlBase64, setCustomStlBase64] = useState<string>('');
  const [currentStlFileName, setCurrentStlFileName] = useState<string>(
    itemToEdit?.stlFileName || ''
  );

  const [isSculptModalOpen, setIsSculptModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.stl')) {
      setErrorMsg('Пожалуйста, выберите файл в формате .stl');
      return;
    }

    setSelectedStlFile(file);
    setErrorMsg('');

    // Instant zero-copy object URL preview for Three.js
    const blobUrl = URL.createObjectURL(file);
    setPreviewStlUrl(blobUrl);
    setCustomStlBase64('');
  };

  const handleSculptSave = (res: {
    ringParams: RingParams;
    materialPreset: string;
    inscriptionText: string;
    customStlBase64: string;
  }) => {
    setRingParams(res.ringParams);
    setDefaultMaterial(res.materialPreset);
    if (res.inscriptionText) setDefaultInscription(res.inscriptionText);
    if (res.customStlBase64) {
      setCustomStlBase64(res.customStlBase64);
      setSelectedStlFile(null);
      setPreviewStlUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Укажите название изделия');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('category', category);
      formData.append('categoryName', categoryName);
      formData.append('badge', badge.trim());
      formData.append('description', description.trim());
      formData.append('price', String(price));
      formData.append('defaultParams', JSON.stringify(ringParams));
      formData.append('defaultMaterial', defaultMaterial);
      formData.append('defaultInscription', defaultInscription.trim());
      formData.append('isActive', String(isActive));

      if (selectedStlFile) {
        formData.append('stlFile', selectedStlFile);
      } else if (customStlBase64) {
        formData.append('customStlBase64', customStlBase64);
      }

      const url = isEditing ? `/api/catalog/${itemToEdit!.id}` : '/api/catalog';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'x-admin-password': adminPassword,
        },
        body: formData,
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Server returned non-JSON:', responseText.slice(0, 300));
        throw new Error(`Ошибка сервера (${res.status}): ${res.statusText || 'Сервер вернул неожиданный ответ'}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при сохранении изделия');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving catalog item:', err);
      setErrorMsg(err.message || 'Произошла ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
        <div className="relative w-full max-w-4xl bg-[#14161f] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-[#191c26]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {isEditing ? `Редактирование: ${itemToEdit?.name}` : 'Создание новой карточки товара'}
                </h2>
                <p className="text-xs text-neutral-400">
                  Заполните информацию о товаре и прикрепите 3D STL модель
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
            {errorMsg && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Form Inputs (7 cols) */}
              <div className="md:col-span-7 space-y-4">
                {/* 1. Name & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">
                      Название изделия <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Например: Монолит Эклипс"
                      className="w-full px-3.5 py-2.5 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Цена (₽)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={50}
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                    />
                  </div>
                </div>

                {/* 2. Category & Badge */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Категория</label>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setCategoryName(
                          e.target.value === 'rings'
                            ? 'Кольца'
                            : e.target.value === 'signet'
                            ? 'Печатки'
                            : 'Эксклюзив'
                        );
                      }}
                      className="w-full px-3.5 py-2.5 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs"
                    >
                      <option value="rings">Кольца</option>
                      <option value="signet">Печатки</option>
                      <option value="exclusive">Эксклюзив</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Бейдж / Лейбл</label>
                    <input
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder="Хит продаж, Новинка, etc."
                      className="w-full px-3.5 py-2.5 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs"
                    />
                  </div>
                </div>

                {/* 3. Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Описание изделия</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Архитектурное кольцо с гранёными скосами..."
                    className="w-full px-3.5 py-2 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs resize-none"
                  />
                </div>

                {/* 4. Default Ring Dimensions */}
                <div className="p-3.5 bg-[#0f1117] border border-neutral-800 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Базовые размеры кольца:
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[11px] text-neutral-400 mb-1">Диаметр (мм):</div>
                      <input
                        type="number"
                        min={15}
                        max={23}
                        step={0.5}
                        value={ringParams.innerDiameter}
                        onChange={(e) =>
                          setRingParams((p) => ({ ...p, innerDiameter: parseFloat(e.target.value) || 17.5 }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[#181a24] border border-neutral-700 rounded-lg text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-400 mb-1">Ширина (мм):</div>
                      <input
                        type="number"
                        min={3}
                        max={14}
                        step={0.5}
                        value={ringParams.width}
                        onChange={(e) =>
                          setRingParams((p) => ({ ...p, width: parseFloat(e.target.value) || 6 }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[#181a24] border border-neutral-700 rounded-lg text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-400 mb-1">Толщина (мм):</div>
                      <input
                        type="number"
                        min={1.5}
                        max={5}
                        step={0.1}
                        value={ringParams.thickness}
                        onChange={(e) =>
                          setRingParams((p) => ({ ...p, thickness: parseFloat(e.target.value) || 2.5 }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[#181a24] border border-neutral-700 rounded-lg text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Material & Inscription */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Дефолтный материал</label>
                    <select
                      value={defaultMaterial}
                      onChange={(e) => setDefaultMaterial(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs"
                    >
                      {MATERIAL_GROUPS.map((group) => (
                        <optgroup key={group.id} label={group.label}>
                          {group.presets.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Дефолтная гравировка</label>
                    <input
                      type="text"
                      maxLength={24}
                      value={defaultInscription}
                      onChange={(e) => setDefaultInscription(e.target.value)}
                      placeholder="ECLIPSE"
                      className="w-full px-3 py-2 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {/* 6. Active Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#0f1117] border border-neutral-800 rounded-xl">
                  <div>
                    <div className="text-xs font-semibold text-white">Отображать в каталоге</div>
                    <div className="text-[11px] text-neutral-500">Товар доступен для заказа пользователями</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 accent-cyan-500"
                  />
                </div>
              </div>

              {/* Right Column: 3D Model & Source (5 cols) */}
              <div className="md:col-span-5 flex flex-col space-y-4">
                <label className="text-xs font-semibold text-neutral-300">3D Модель изделия</label>

                {/* 3D Preview Box */}
                <div className="relative w-full h-[220px] rounded-2xl bg-[#0f1117] border border-neutral-800 overflow-hidden">
                  <Admin3DPreview
                    stlUrl={previewStlUrl}
                    stlFileName={!selectedStlFile && !customStlBase64 && !previewStlUrl ? currentStlFileName : undefined}
                    customStlBase64={customStlBase64}
                    ringParams={ringParams}
                    materialPreset={defaultMaterial}
                    inscription={defaultInscription}
                    className="w-full h-full"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-md text-[10px] text-neutral-400">
                    Интерактивный 3D просмотр
                  </div>
                </div>

                {/* 3D Actions */}
                <div className="space-y-2">
                  {/* Action 1: Upload STL file */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".stl"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 bg-[#191c26] hover:bg-[#202430] border border-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {selectedStlFile ? `Файл: ${selectedStlFile.name}` : 'Импортировать STL файл с диска'}
                    </span>
                  </button>

                  {/* Action 2: Open in 3D Editor */}
                  <button
                    type="button"
                    onClick={() => setIsSculptModalOpen(true)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Открыть / Создать в 3D Редакторе</span>
                  </button>

                  {customStlBase64 && (
                    <div className="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>Новая 3D геометрия готова к сохранению</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStlBase64('');
                          setSelectedStlFile(null);
                        }}
                        className="text-neutral-400 hover:text-rose-400"
                        title="Сбросить загруженную модель"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-all"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{isEditing ? 'Сохранить изменения' : 'Создать товар'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded 3D Sculpting Studio Modal */}
      <AdminSculptModal
        isOpen={isSculptModalOpen}
        onClose={() => setIsSculptModalOpen(false)}
        initialRingParams={ringParams}
        initialMaterial={defaultMaterial}
        initialInscription={defaultInscription}
        initialStlFileName={currentStlFileName}
        initialCustomStlBase64={customStlBase64}
        onSaveModel={handleSculptSave}
      />
    </>
  );
};
