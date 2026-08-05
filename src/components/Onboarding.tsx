import React, { useEffect, useState, useCallback } from 'react';
import { driver, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { motion, AnimatePresence } from 'motion/react';
import { renderToString } from 'react-dom/server';
import {
  Sparkles,
  RotateCcw,
  Undo2,
  Redo2,
  ShieldAlert,
  Volume2,
  Layers,
  PenTool,
  Grid,
  Paintbrush,
  ShoppingBag,
  ChevronRight,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { useRouter } from '../router';

/* ── Welcome Modal ── */
interface WelcomeModalProps {
  onStart: () => void;
  onSkip: () => void;
  onOpenCatalog: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStart, onSkip, onOpenCatalog }) => {
  const features = [
    { icon: RotateCcw, label: '3D-лепка', desc: 'Придайте кольцу уникальную форму' },
    { icon: Layers, label: 'Вставки', desc: 'Сердечки, звёзды, свои рисунки' },
    { icon: PenTool, label: 'Гравировка', desc: 'Ваши слова внутри шинки' },
    { icon: Grid, label: 'Симметрия', desc: 'Идеальный узор в один клик' },
    { icon: Paintbrush, label: 'Материал', desc: 'Цвет и эффект свечения' },
    { icon: ShoppingBag, label: 'Заказ', desc: 'Отправьте на 3D-печать' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(10, 10, 10, 0.72)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)' }}
      >
        {/* Gradient header */}
        <div
          className="relative px-8 pt-10 pb-8 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}
        >
          <div
            className="absolute -top-8 -left-8 w-32 h-32 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #00d2ff, transparent)' }}
          />
          <div
            className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #ff3385, transparent)' }}
          />
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white mb-1 tracking-tight"
          >
            Добро пожаловать в Nebulae
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="text-sm leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            3D-конструктор ярких украшений прямо в браузере
          </motion.p>
        </div>

        {/* Feature grid */}
        <div className="px-6 py-5">
          {/* Catalog shortcut button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            onClick={onOpenCatalog}
            className="w-full mb-3 py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #0f0f0f, #2d2d2d)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}
          >
            <span>Открыть каталог готовых украшений</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>

          <p className="text-[14px] font-semibold uppercase tracking-wider text-neutral-400 mb-4 text-center">
            Или создайте своё уникальное украшение за пару минут
          </p>


          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col gap-2"
          >
            <button
              onClick={onStart}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #0f0f0f, #2d2d2d)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              }}
            >
              <span>Начать обучение</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onSkip}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 transition-all"
            >
              Пропустить, я разберусь сам
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── Main Component ── */
interface OnboardingProps {
  runOnMount?: boolean;
}

export const Onboarding: React.FC<OnboardingProps> = ({ runOnMount = false }) => {
  const [showWelcome, setShowWelcome] = useState(false);

  const buildTour = useCallback(() => {
    const config: Config = {
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 10,
      stageRadius: 16,
      popoverClass: 'nebulae-popover',
      doneBtnText: 'Готово!',
      nextBtnText: 'Далее →',
      prevBtnText: '← Назад',
      progressText: '{{current}} из {{total}}',
      steps: [
        {
          element: '#viewport-workspace',
          popover: {
            title: '3D-холст',
            description:
              '<p>Это ваша основная рабочая область</p>' +
              '<ul style="margin-top:6px;padding-left:16px;line-height:1.8">' +
              '<li><b>ЛКМ (удерживать)</b> — рисовать</li>' +
              '<li><b>ПКМ (удерживать)</b> — перемещать</li>' +
              '<li><b>Колесо мыши</b> — приближение</li>' +
              '<li><b>Двойной клик ЛКМ</b> — сбросить камеру</li>' +
              '</ul>',
            side: 'left',
            align: 'center',
          },
        },
        {
          element: '.p-5.border-b.border-neutral-100',
          popover: {
            title: 'Параметры кольца',
            description:
              '<p>Здесь настраиваются основные параметры кольца:</p>' +
              '<ul style="margin-top:6px;padding-left:16px;line-height:1.8">' +
              '<li><b>Диаметр</b> — размер пальца (15–23 мм)</li>' +
              '<li><b>Ширина шинки</b> — насколько широкое кольцо</li>' +
              '<li><b>Толщина стенок</b> — насколько толстое кольцо</li>' +
              '</ul>',
            side: 'left',
            align: 'start',
          },
        },
        {
          element: '.flex.bg-neutral-100.p-1.rounded-xl',
          popover: {
            title: 'Режимы работы',
            description:
              '<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">' +
              '<div><b>Лепка</b> — пластичное изменение геометрии кистью</div>' +
              '<div><b>Вставки</b> — добавляйте готовые элементы</div>' +
              '<div><b>Гравировка</b> — ваши слова будут выгравированы на внутренней поверхности кольца</div>' +
              '</div>',
            side: 'left',
            align: 'center',
          },
        },
        {
          element: '.p-5.border-b.border-neutral-100.space-y-4',
          popover: {
            title: 'Инструменты лепки',
            description:
              '<p>На вкладке <b>«Лепка»</b>:</p>' +
              '<ul style="margin-top:6px;padding-left:16px;line-height:1.8">' +
              '<li><b>Добавить (+)</b> — наращивает материал на кольцо</li>' +
              '<li><b>Убрать (−)</b> — вдавливает поверхность</li>' +
              '<li><b>Размер кисти</b> — зона воздействия в мм</li>' +
              '<li><b>Сила</b> — интенсивность деформации</li>' +
              '</ul>',
            side: 'left',
            align: 'center',
          },
        },
        {
          element: '#symmetry-controls-section',
          popover: {
            title: 'Симметрия',
            description:
              '<p>Мощный инструмент для создания сложных узоров без лишних усилий:</p>' +
              '<ul style="margin-top:6px;padding-left:16px;line-height:1.8">' +
              '<li><b>Осевая симметрия</b> — 1×–8×, лепите сразу по всей окружности</li>' +
              '<li><b>Зеркальная по ширине</b> — дублирует изменения в ширину кольца</li>' +
              '<li><b>Зеркальная по высоте</b> — дублирует изменения в высоту кольца</li>' +
              '</ul>',
            side: 'left',
            align: 'center',
          },
        },
        {
          element: '#daylight-wheel-section',
          popover: {
            title: 'Время суток',
            description:
              '<p>Ползунок <b>«Освещение»</b> меняет угол и цвет света от полудня до полуночи</p>' +
              '<p style="margin-top:8px">Выберите светящийся материал и переключитесь на ночь — кольцо засияет в темноте!</p>',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '.flex.flex-wrap.gap-2\\.5',
          popover: {
            title: 'Выбор материала',
            description:
              '<p>Кликните на кружок, чтобы сменить цвет и эффект:</p>' +
              '<ul style="margin-top:6px;padding-left:16px;line-height:1.8">' +
              '<li>Однотонные пастельные цвета</li>' +
              '<li>Градиент</li>' +
              '<li>Светящийся</li>' +
              '</ul>',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '.absolute.top-5.right-5',
          popover: {
            title: 'Панель действий',
            description:
              '<p>Панель управления в правом верхнем углу холста:</p>' +
              '<ul style="margin-top:6px;padding-left:16px;line-height:1.8">' +
              `<li><b>${renderToString(<ShieldAlert style={{ display: 'inline', width: 14, height: 14, verticalAlign: '-2px', marginRight: 4, color: '#d97706' }} />)}</b> Границы (зоны безопасности 4 мм)</li>` +
              `<li><b>${renderToString(<Undo2 style={{ display: 'inline', width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />)}</b> Отменить действие (Ctrl+Z)</li>` +
              `<li><b>${renderToString(<Redo2 style={{ display: 'inline', width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />)}</b> Повторить действие (Ctrl+Y / Ctrl+Shift+Z)</li>` +
              `<li><b>${renderToString(<RotateCcw style={{ display: 'inline', width: 14, height: 14, verticalAlign: '-2px', marginRight: 4, color: '#f43f5e' }} />)}</b> Сбросить модель к начальному состоянию</li>` +
              `<li><b>${renderToString(<Volume2 style={{ display: 'inline', width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />)}</b> Включить/выключить звук лепки</li>` +
              '</ul>',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '#cart-header-button',
          popover: {
            title: 'Корзина',
            description:
              '<p>Когда ваш дизайн готов — нажмите <b>«Добавить в корзину»</b> внизу боковой панели.</p>' +
              '<p style="margin-top:8px">Из корзины вы можете <b>скачать STL</b> для 3D-печати или оформить заказ у нас.</p>',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '#add-to-cart-button',
          popover: {
            title: 'Всё готово!',
            description:
              '<p>Вы узнали обо всех возможностях Nebulae.</p>' +
              '<p style="margin-top:8px;color:#10b981;font-weight:600">Начните лепить, добавляйте вставки, создайте надпись и закажите своё уникальное кольцо!</p>',
            side: 'top',
            align: 'center',
          },
        },
      ],
    };

    return driver(config);
  }, []);

  const startTour = useCallback(() => {
    setShowWelcome(false);
    setTimeout(() => {
      const driverObj = buildTour();
      driverObj.drive();
    }, 250);
  }, [buildTour]);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('nebulae_has_seen_onboarding_v2');
    if (!hasSeenTour || runOnMount) {
      const timer = setTimeout(() => {
        setShowWelcome(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [runOnMount]);

  useEffect(() => {
    const handleCustomOpen = () => {
      setShowWelcome(true);
    };
    window.addEventListener('nebulae_open_onboarding', handleCustomOpen);
    return () => window.removeEventListener('nebulae_open_onboarding', handleCustomOpen);
  }, []);

  const handleStart = () => {
    localStorage.setItem('nebulae_has_seen_onboarding_v2', 'true');
    startTour();
  };

  const handleSkip = () => {
    localStorage.setItem('nebulae_has_seen_onboarding_v2', 'true');
    setShowWelcome(false);
  };

  const { navigate } = useRouter();
  const handleOpenCatalog = () => {
    localStorage.setItem('nebulae_has_seen_onboarding_v2', 'true');
    setShowWelcome(false);
    navigate('catalog');
  };

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <WelcomeModal onStart={handleStart} onSkip={handleSkip} onOpenCatalog={handleOpenCatalog} />
        )}
      </AnimatePresence>

      {/* Custom driver.js styles */}
      <style>{`
        .nebulae-popover {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif !important;
          border-radius: 20px !important;
          box-shadow: 0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06) !important;
          max-width: 340px !important;
          padding: 0 !important;
          overflow: hidden !important;
          border: none !important;
          background: #fff !important;
        }

        .nebulae-popover .driver-popover-title {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #0f0f0f !important;
          padding: 16px 40px 8px 18px !important;
          background: linear-gradient(to bottom, #f9f9f9, #fff) !important;
          border-bottom: 1px solid #f0f0f0 !important;
          margin: 0 !important;
          line-height: 1.3 !important;
        }

        .nebulae-popover .driver-popover-description {
          font-size: 13px !important;
          color: #444 !important;
          line-height: 1.65 !important;
          padding: 10px 18px 14px !important;
          margin: 0 !important;
        }

        .nebulae-popover .driver-popover-description b {
          color: #0f0f0f;
          font-weight: 600;
        }

        .nebulae-popover .driver-popover-description ul {
          margin: 0;
          padding-left: 18px;
        }

        .nebulae-popover .driver-popover-footer {
          padding: 8px 12px 12px !important;
          background: #fafafa !important;
          border-top: 1px solid #f0f0f0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 6px !important;
        }

        .nebulae-popover .driver-popover-progress-text {
          font-size: 11px !important;
          color: #aaa !important;
          font-weight: 500 !important;
          letter-spacing: 0.02em !important;
          flex: 1 !important;
        }

        .nebulae-popover .driver-popover-prev-btn,
        .nebulae-popover .driver-popover-next-btn,
        .nebulae-popover .driver-popover-done-btn {
          font-size: 12px !important;
          font-weight: 600 !important;
          border-radius: 10px !important;
          padding: 6px 14px !important;
          border: none !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          outline: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .nebulae-popover .driver-popover-prev-btn {
          background: #f0f0f0 !important;
          color: #555 !important;
        }
        .nebulae-popover .driver-popover-prev-btn:hover {
          background: #e0e0e0 !important;
          color: #111 !important;
        }

        .nebulae-popover .driver-popover-next-btn,
        .nebulae-popover .driver-popover-done-btn {
          background: linear-gradient(135deg, #0f0f0f, #333) !important;
          color: #fff !important;
        }
        .nebulae-popover .driver-popover-next-btn:hover,
        .nebulae-popover .driver-popover-done-btn:hover {
          background: linear-gradient(135deg, #2d2d2d, #555) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.22) !important;
        }

        .nebulae-popover .driver-popover-close-btn {
          width: 22px !important;
          height: 22px !important;
          border-radius: 6px !important;
          background: #f0f0f0 !important;
          color: #888 !important;
          border: none !important;
          font-size: 13px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          position: absolute !important;
          top: 12px !important;
          right: 12px !important;
          transition: background 0.15s !important;
          line-height: 1 !important;
        }
        .nebulae-popover .driver-popover-close-btn:hover {
          background: #e0e0e0 !important;
          color: #333 !important;
        }

        .driver-active-element {
          border-radius: 12px !important;
        }

        .driver-popover-arrow-side-left.driver-popover-arrow {
          border-right-color: #fff !important;
        }
        .driver-popover-arrow-side-right.driver-popover-arrow {
          border-left-color: #fff !important;
        }
        .driver-popover-arrow-side-top.driver-popover-arrow {
          border-bottom-color: #fff !important;
        }
        .driver-popover-arrow-side-bottom.driver-popover-arrow {
          border-top-color: #fff !important;
        }
      `}</style>
    </>
  );
};