import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  PenTool,
  ShoppingBag,
  RefreshCw,
  Gem,
  ArrowRight,
  Info,
} from 'lucide-react';
import { CatalogItem, CartItem, EditorSnapshot } from '../types';
import { CatalogItemCard } from '../components/CatalogItemCard';
import { MainMenu } from '../components/MainMenu';
import { useRouter } from '../router';

interface CatalogPageProps {
  cartCount: number;
  onOpenCart: () => void;
  onAddToCart: (item: CartItem) => void;
  onOpenEditorWithSnapshot: (snapshot: EditorSnapshot, catalogItemName?: string) => void;
}

const FALLBACK_CATALOG: CatalogItem[] = [
  {
    id: 'cat_monolith_eclipse',
    name: 'Монолит Эклипс',
    category: 'rings',
    categoryName: 'Кольца',
    description: 'Архитектурное кольцо с гранёными скосами и выразительной геометрией. Идеально подчёркивает форму руки.',
    price: 1850,
    badge: 'Хит продаж',
    defaultParams: { innerDiameter: 17.5, width: 6, thickness: 2.5 },
    defaultMaterial: 'ice_blue',
    defaultInscription: 'ECLIPSE',
    stlFileName: 'monolith_eclipse.stl',
    isActive: true,
  },
  {
    id: 'cat_cyber_wave',
    name: 'Кибер-Волна',
    category: 'exclusive',
    categoryName: 'Эксклюзив',
    description: 'Биоморфная струящаяся форма с плавной синусоидальной волной генеративного дизайна.',
    price: 2200,
    badge: 'Новинка',
    defaultParams: { innerDiameter: 17, width: 7.5, thickness: 2.75 },
    defaultMaterial: 'two_tone',
    defaultInscription: 'CYBERPUNK',
    stlFileName: 'cyber_wave.stl',
    isActive: true,
  },
  {
    id: 'cat_nebula_signet',
    name: 'Печатка Небула',
    category: 'signet',
    categoryName: 'Печатки',
    description: 'Современная интерпретация классической печатки с массивной верхней гранью для персональной гравировки.',
    price: 1950,
    badge: 'Премиум',
    defaultParams: { innerDiameter: 18.5, width: 8, thickness: 3.2 },
    defaultMaterial: 'mandarin_orange',
    defaultInscription: 'NEBULAE',
    stlFileName: 'nebula_signet.stl',
    isActive: true,
  },
  {
    id: 'cat_orbit_saturn',
    name: 'Орбита Сатурна',
    category: 'exclusive',
    categoryName: 'Эксклюзив',
    description: 'Двойная космическая дуга с парящим зазором. Вдохновлено небесными кольцами Сатурна.',
    price: 2400,
    badge: 'Эксклюзив',
    defaultParams: { innerDiameter: 17.5, width: 8, thickness: 3 },
    defaultMaterial: 'glow_blue',
    defaultInscription: 'SATURN',
    stlFileName: 'orbit_saturn.stl',
    isActive: true,
  },
  {
    id: 'cat_aurora_solaris',
    name: 'Аврора Солярис',
    category: 'rings',
    categoryName: 'Кольца',
    description: 'Тонкий узор с 16 микро-фасетами, создающими непрерывную игру света на глянцевой поверхности.',
    price: 1650,
    badge: '',
    defaultParams: { innerDiameter: 16.5, width: 5.5, thickness: 2.4 },
    defaultMaterial: 'sakura_pink',
    defaultInscription: 'SOLARIS',
    stlFileName: 'aurora_solaris.stl',
    isActive: true,
  },
  {
    id: 'cat_minimal_classic',
    name: 'Минимал Классик',
    category: 'rings',
    categoryName: 'Кольца',
    description: 'Чистая лаконичная классика со скругленным комфортным внутренним профилем Comfort Fit.',
    price: 1450,
    badge: 'Базовый',
    defaultParams: { innerDiameter: 17, width: 4.5, thickness: 2 },
    defaultMaterial: 'ice_blue',
    defaultInscription: 'FOREVER',
    stlFileName: 'minimal_classic.stl',
    isActive: true,
  },
];

export const CatalogPage: React.FC<CatalogPageProps> = ({
  cartCount,
  onOpenCart,
  onAddToCart,
  onOpenEditorWithSnapshot,
}) => {
  const { navigate } = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items.filter((it: CatalogItem) => it.isActive !== false));
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[CatalogPage] API unavailable, using fallback items:', err);
    }
    setItems(FALLBACK_CATALOG);
    setLoading(false);
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-neutral-900 flex flex-col font-sans">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-30 bg-[#f7f6f2]/90 backdrop-blur-md border-b border-neutral-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MainMenu />
          <div
            onClick={() => navigate('catalog')}
            className="cursor-pointer flex items-center gap-2"
          >
            <span className="font-pilowlava text-2xl md:text-3xl tracking-wide text-neutral-900 leading-none">
              NEBULAE
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-extrabold text-[9px] tracking-wider uppercase shadow-xs">
              BETA
            </span>
          </div>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2.5">


          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-950 text-white text-xs font-bold hover:bg-neutral-800 shadow-md shadow-neutral-950/15 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Корзина</span>
            {cartCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 bg-cyan-400 text-neutral-950 text-[11px] font-extrabold rounded-full">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <section className="px-4 md:px-8 pt-8 pb-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pb-6 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-[10px] uppercase tracking-wider">
                -50% Скидка
              </span>
              <span className="text-xs text-neutral-400 font-medium">Период бета-теста</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-neutral-950 tracking-tight">
              Каталог
            </h1>
          </div>

          <button
            onClick={() => navigate('editor')}
            className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 text-white text-xs md:text-sm font-bold shadow-lg shadow-neutral-900/10 active:scale-95 transition-all"
          >
            <PenTool className="w-4 h-4 text-cyan-400" />
            <span>Создать своё кольцо с нуля</span>
            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>

        {/* Beta Notice Banner */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-50/80 via-white to-amber-50/80 border border-neutral-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping mt-1 shrink-0" />
            <div>
              <span className="font-bold text-neutral-900">Бета-тестирование: скидка 50% на все заказы!</span>
              <p className="text-neutral-600 mt-0.5">
                Срок изготовления до 3 недель. Отправка готовых украшений начнется не ранее 14 сентября.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('about')}
            className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900 underline whitespace-nowrap"
          >
            Подробнее о сервисе →
          </button>
        </div>
      </section>

      {/* ── Catalog Product Grid ── */}
      <main className="px-4 md:px-8 pb-16 max-w-7xl mx-auto w-full flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
            <p className="text-sm font-medium text-neutral-500">Загрузка каталога изделий...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-neutral-200 p-8">
            <Gem className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-neutral-800">Каталог пока пуст</h3>
            <p className="text-xs text-neutral-500 mt-1 mb-5">
              В данный момент товары готовятся к публикации. Вы можете создать своё изделие в 3D Редакторе.
            </p>
            <button
              onClick={() => navigate('editor')}
              className="px-5 py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-xl"
            >
              Открыть 3D Редактор
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <CatalogItemCard
                key={item.id}
                item={item}
                onAddToCart={onAddToCart}
                onOpenEditor={(snapshot, name) => {
                  onOpenEditorWithSnapshot(snapshot, name);
                  navigate('editor');
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-neutral-200 bg-white/60 py-6 px-4 md:px-8 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} <span className="font-pilowlava text-sm text-neutral-900 tracking-wide">Nebulae</span> Jewelry Studio. Все права защищены.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('about')}
              className="hover:text-neutral-900 transition-colors"
            >
              О сервисе & Доставка
            </button>
            <button
              onClick={() => navigate('editor')}
              className="hover:text-neutral-900 transition-colors"
            >
              3D Редактор
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
