import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  PenTool,
  Info,
  ChevronRight,
  Gem,
  BookOpen,
  ShoppingBag,
} from 'lucide-react';
import { EditorSnapshot } from '../types';
import { useRouter } from '../router';

// ─── Main Menu ───────────────────────────────────────────────────────────────

interface MainMenuProps {
  onOpenEditor?: (snapshot?: EditorSnapshot) => void;
}

export const MainMenu: React.FC<MainMenuProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { navigate } = useRouter();

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleNav = (id: 'catalog' | 'editor' | 'about') => {
    navigate(id);
    closeMenu();
  };

  const navItems: { id: 'catalog' | 'editor' | 'about'; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'catalog', label: 'Каталог', icon: BookOpen, desc: 'Коллекция украшений с быстрым заказом' },
    { id: 'editor', label: '3D Редактор', icon: PenTool, desc: 'Создать своё украшение с нуля' },
    { id: 'about', label: 'Информация', icon: Info, desc: 'О сервисе, технологии PLA, доставке и документы' },
  ];

  return (
    <>
      {/* ── Hamburger Trigger ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="pointer-events-auto flex items-center justify-center w-9 h-9 rounded-xl bg-white/80 border border-neutral-200/60 backdrop-blur-md shadow-sm hover:bg-white hover:shadow-md transition-all active:scale-95 cursor-pointer"
        title="Главное меню"
        aria-label="Открыть главное меню"
        id="main-menu-button"
      >
        <Menu className="w-4 h-4 text-neutral-700" />
      </button>

      {/* ── Drawer + Backdrop in Portal ── */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[99998] bg-black/40 backdrop-blur-sm"
                  onClick={closeMenu}
                />

                {/* Drawer */}
                <motion.div
                  key="drawer"
                  initial={{ x: '-100%', opacity: 0.7 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-100%', opacity: 0.7 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  className="fixed top-0 left-0 z-[99999] h-screen w-[340px] max-w-[92vw] bg-white shadow-2xl flex flex-col overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950 text-white flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-pilowlava text-2xl tracking-wide text-white leading-none">Nebulae</span>
                    </div>
                    <button
                      onClick={closeMenu}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                      aria-label="Закрыть меню"
                    >
                      <X className="w-4 h-4 text-neutral-300" />
                    </button>
                  </div>

                  {/* Nav Links */}
                  <nav className="flex flex-col divide-y divide-neutral-100">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNav(item.id)}
                          className="flex items-center gap-3.5 px-5 py-4 hover:bg-neutral-50 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center flex-shrink-0 transition-all">
                            <Icon className="w-4 h-4 text-neutral-700" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[14px] font-semibold text-neutral-900">{item.label}</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </nav>


                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
