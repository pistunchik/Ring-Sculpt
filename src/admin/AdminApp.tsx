import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  Plus,
  Search,
  PenTool,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Layers,
  DollarSign,
  LogOut,
  Sliders,
  Check,
  AlertTriangle,
  FileCode,
  Tag,
} from 'lucide-react';
import { CatalogItem, RingParams } from '../types';
import { Admin3DPreview } from './Admin3DPreview';
import { AdminProductModal } from './AdminProductModal';
import { AdminSculptModal } from './AdminSculptModal';
import { MATERIAL_PRESETS_LIST } from '../utils/materialUtils';

export const AdminApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('nebulae_admin_auth'));
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CatalogItem | null>(null);

  const [isDirectSculptOpen, setIsDirectSculptOpen] = useState(false);
  const [directSculptItem, setDirectSculptItem] = useState<CatalogItem | null>(null);

  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const adminPassword = sessionStorage.getItem('nebulae_admin_password') || 'admin1488';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Authentication check ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('nebulae_admin_auth', 'true');
        sessionStorage.setItem('nebulae_admin_password', passwordInput.trim());
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || 'Неверный пароль администратора');
      }
    } catch (err: any) {
      console.error('Auth check error:', err);
      // Fallback verification if backend is offline
      if (passwordInput.trim() === 'admin1488') {
        sessionStorage.setItem('nebulae_admin_auth', 'true');
        sessionStorage.setItem('nebulae_admin_password', passwordInput.trim());
        setIsAuthenticated(true);
      } else {
        setAuthError('Не удалось подключиться к серверу авторизации');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('nebulae_admin_auth');
    sessionStorage.removeItem('nebulae_admin_password');
    setIsAuthenticated(false);
  };

  // ── Fetch Catalog Items ──
  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch (err) {
      console.error('Error fetching catalog items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
    }
  }, [isAuthenticated]);

  // ── Toggle Active Status ──
  const handleToggleActive = async (item: CatalogItem) => {
    const updatedStatus = !item.isActive;
    try {
      const res = await fetch(`/api/catalog/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ isActive: updatedStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, isActive: updatedStatus } : it))
        );
        showToast(`Статус «${item.name}» обновлён`);
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  // ── Delete Item ──
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/catalog/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': adminPassword,
        },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== itemToDelete.id));
        showToast(`Товар «${itemToDelete.name}» удалён`);
        setItemToDelete(null);
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  // ── Direct Sculpt Save ──
  const handleDirectSculptSave = async (res: {
    ringParams: RingParams;
    materialPreset: string;
    inscriptionText: string;
    customStlBase64: string;
  }) => {
    if (!directSculptItem) return;

    try {
      const response = await fetch(`/api/catalog/${directSculptItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({
          defaultParams: res.ringParams,
          defaultMaterial: res.materialPreset,
          defaultInscription: res.inscriptionText,
          customStlBase64: res.customStlBase64,
        }),
      });

      if (response.ok) {
        showToast(`3D модель «${directSculptItem.name}» успешно обновлена!`);
        fetchItems();
      }
    } catch (err) {
      console.error('Error updating direct sculpt:', err);
    }
  };

  const filteredItems = items.filter(
    (it) =>
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.badge && it.badge.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (it.categoryName && it.categoryName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── LOGIN SCREEN ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161822] border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-normal text-white tracking-wide font-pilowlava">Nebulae Studio</h1>
            <p className="text-xs text-neutral-400">
              Панель администратора каталога (Порт 1488)
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 text-center">
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Пароль администратора
              </label>
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Введите пароль для входа"
                className="w-full px-4 py-3 bg-[#0f1117] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Войти в панель управления</span>
            </button>
          </form>

          <div className="pt-4 border-t border-neutral-800 text-center text-[11px] text-neutral-500">
            Защищённый шлюз • Доступ только для сотрудников
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN ADMIN DASHBOARD ──
  return (
    <div className="min-h-screen bg-[#0d0f14] text-neutral-100 flex flex-col font-sans">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-[#141620]/90 backdrop-blur-md border-b border-neutral-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-normal text-base font-pilowlava">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-normal text-white text-base tracking-wide font-pilowlava">Nebulae Admin</span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                PORT 1488
              </span>
            </div>
            <span className="text-[11px] text-neutral-400">Управление ювелирным каталогом</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setItemToEdit(null);
              setIsProductModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Создать товар</span>
          </button>

          <button
            onClick={fetchItems}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-all"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${loadingItems ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800/80 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 rounded-xl text-xs font-semibold transition-all"
            title="Выйти"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#151822] border border-neutral-800 p-4 rounded-2xl">
            <div className="text-neutral-400 text-xs font-medium">Всего товаров</div>
            <div className="text-2xl font-extrabold text-white mt-1">{items.length}</div>
          </div>
          <div className="bg-[#151822] border border-neutral-800 p-4 rounded-2xl">
            <div className="text-neutral-400 text-xs font-medium">Активны в каталоге</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">
              {items.filter((i) => i.isActive !== false).length}
            </div>
          </div>
          <div className="bg-[#151822] border border-neutral-800 p-4 rounded-2xl">
            <div className="text-neutral-400 text-xs font-medium">С 3D STL моделями</div>
            <div className="text-2xl font-extrabold text-cyan-400 mt-1">
              {items.filter((i) => Boolean(i.stlFileName)).length}
            </div>
          </div>
          <div className="bg-[#151822] border border-neutral-800 p-4 rounded-2xl">
            <div className="text-neutral-400 text-xs font-medium">Средний чек</div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {items.length > 0
                ? Math.round(items.reduce((s, i) => s + i.price, 0) / items.length).toLocaleString('ru-RU')
                : 0}{' '}
              ₽
            </div>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или категории..."
              className="w-full pl-9 pr-4 py-2 bg-[#151822] border border-neutral-800 rounded-xl focus:border-cyan-500 focus:outline-none text-xs text-white placeholder-neutral-500"
            />
          </div>

          <div className="text-xs text-neutral-400">
            Показано товаров: <span className="font-bold text-white">{filteredItems.length}</span>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loadingItems ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-neutral-500">Загрузка базы товаров...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-[#151822] border border-neutral-800 rounded-3xl p-8">
            <Tag className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white">Товары не найдены</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-4">
              Попробуйте изменить поисковый запрос или создайте новый товар
            </p>
            <button
              onClick={() => {
                setItemToEdit(null);
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold"
            >
              + Создать первый товар
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const activeMat =
                MATERIAL_PRESETS_LIST.find((m) => m.id === item.defaultMaterial) ||
                MATERIAL_PRESETS_LIST[4];

              return (
                <div
                  key={item.id}
                  className={`bg-[#151822] border rounded-3xl overflow-hidden flex flex-col transition-all shadow-lg ${
                    item.isActive !== false
                      ? 'border-neutral-800 hover:border-neutral-700'
                      : 'border-neutral-800/50 opacity-60'
                  }`}
                >
                  {/* 3D Preview Box */}
                  <div className="relative w-full h-[200px] bg-[#10121a]">
                    <Admin3DPreview
                      stlFileName={item.stlFileName}
                      ringParams={item.defaultParams}
                      materialPreset={item.defaultMaterial}
                      inscription={item.defaultInscription}
                      className="w-full h-full"
                    />

                    {/* Badge */}
                    {item.badge && (
                      <div className="absolute top-3 left-3 px-2.5 py-0.5 bg-black/70 backdrop-blur-sm text-cyan-300 text-[10px] font-bold rounded-full border border-cyan-500/30">
                        {item.badge}
                      </div>
                    )}

                    {/* Status Pill */}
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm transition-all ${
                        item.isActive !== false
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                          : 'bg-neutral-800/80 border border-neutral-700 text-neutral-400'
                      }`}
                    >
                      {item.isActive !== false ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Активен</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Скрыт</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">{item.name}</h3>
                        <span className="text-base font-extrabold text-cyan-400 whitespace-nowrap">
                          {item.price.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Parameters pills */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-neutral-800/80 text-[11px]">
                      <div className="text-neutral-400">
                        Диаметр:{' '}
                        <span className="font-mono text-white">
                          {item.defaultParams?.innerDiameter || 17.5} мм
                        </span>
                      </div>
                      <div className="text-neutral-400">
                        Ширина:{' '}
                        <span className="font-mono text-white">
                          {item.defaultParams?.width || 6} мм
                        </span>
                      </div>
                      <div className="text-neutral-400 flex items-center gap-1">
                        Цвет:
                        <span
                          className={`w-3 h-3 rounded-full border border-white/20 inline-block ${activeMat.colorClass}`}
                        />
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setDirectSculptItem(item);
                          setIsDirectSculptOpen(true);
                        }}
                        className="py-2 px-2.5 bg-[#1e2230] hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        title="Открыть и смоделировать в 3D Редакторе"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>3D Скульптинг</span>
                      </button>

                      <button
                        onClick={() => {
                          setItemToEdit(item);
                          setIsProductModalOpen(true);
                        }}
                        className="py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Edit className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Правка</span>
                      </button>

                      <button
                        onClick={() => setItemToDelete(item)}
                        className="py-2 px-2.5 bg-neutral-800/60 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Удалить</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Product Create / Edit Modal ── */}
      <AdminProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSaved={() => {
          showToast(itemToEdit ? 'Товар успешно обновлен' : 'Товар успешно добавлен в каталог');
          fetchItems();
        }}
        adminPassword={adminPassword}
        itemToEdit={itemToEdit}
      />

      {/* ── Direct 3D Sculpt Modal ── */}
      {directSculptItem && (
        <AdminSculptModal
          isOpen={isDirectSculptOpen}
          onClose={() => {
            setIsDirectSculptOpen(false);
            setDirectSculptItem(null);
          }}
          initialRingParams={directSculptItem.defaultParams}
          initialMaterial={directSculptItem.defaultMaterial}
          initialInscription={directSculptItem.defaultInscription}
          initialStlFileName={directSculptItem.stlFileName}
          onSaveModel={handleDirectSculptSave}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#161822] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Удалить товар?</h3>
              <p className="text-xs text-neutral-400">
                Вы собираетесь удалить «{itemToDelete.name}» из каталога и удалить связанный STL файл.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-neutral-900/90 text-white text-xs font-semibold rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
