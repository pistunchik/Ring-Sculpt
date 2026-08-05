import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  PenTool,
  Info,
  ChevronRight,
  Gem,
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

  const handleNav = (id: 'editor' | 'about') => {
    navigate(id);
    closeMenu();
  };

  const navItems: { id: 'editor' | 'about'; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'editor', label: '3D Редактор', icon: PenTool, desc: 'Создать своё украшение с нуля' },
    { id: 'about', label: 'О нас', icon: Info, desc: 'История бренда, ценности и контакты' },
  ];

  return (
    <>
      {/* ── Hamburger Trigger ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="pointer-events-auto flex items-center justify-center w-9 h-9 rounded-xl bg-white/80 border border-neutral-200/60 backdrop-blur-md shadow-sm hover:bg-white hover:shadow-md transition-all active:scale-95"
        title="Главное меню"
        aria-label="Открыть главное меню"
        id="main-menu-button"
      >
        <Menu className="w-4 h-4 text-neutral-700" />
      </button>

      {/* ── Drawer + Backdrop ── */}
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
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={closeMenu}
            />

            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: '-100%', opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed top-0 left-0 z-50 h-full w-[340px] max-w-[92vw] bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950 text-white flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-bold tracking-tight">Nebulae</span>
                </div>
                <button
                  onClick={closeMenu}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
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
                      className="flex items-center gap-3.5 px-5 py-4 hover:bg-neutral-50 transition-all text-left group"
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

              {/* Quick CTA */}
              <div className="p-5 mt-auto">
                <div className="rounded-2xl bg-gradient-to-br from-neutral-950 to-neutral-800 text-white p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Gem className="w-4 h-4 text-cyan-400" />
                    <span className="text-[13px] font-bold">Nebulae Studio</span>
                  </div>
                  <p className="text-[12px] text-neutral-400 leading-relaxed">
                    Создайте уникальное ювелирное украшение в нашем 3D-редакторе.
                  </p>
                  <button
                    onClick={() => handleNav('editor')}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-[12px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Открыть 3D Редактор
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
