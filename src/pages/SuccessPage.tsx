import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowLeft, PackageCheck, Sparkles, Clock, Truck, ShieldCheck, Heart } from 'lucide-react';
import { useRouter } from '../router';
import catImage from '../assets/thank_you_cat.png';

interface SuccessPageProps {
  orderNumber?: string;
}

export const SuccessPage: React.FC<SuccessPageProps> = ({ orderNumber: propOrderNumber }) => {
  const { navigate } = useRouter();

  // Extract order number from URL query string if present (e.g. ?order=260824-1&status=paid)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlOrder = urlParams?.get('order');
  const displayOrderNumber = propOrderNumber || urlOrder || '260826-1';

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-white flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-cyan-500/15 via-pink-500/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-pink-500 flex items-center justify-center font-black text-xs text-black shadow-md shadow-cyan-500/20">
              N
            </div>
            <span className="font-extrabold tracking-tight text-base">Nebulae Studio</span>
          </div>

          <button
            onClick={() => navigate('editor')}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 px-3.5 py-2 rounded-xl border border-neutral-700/60 transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>В 3D-редактор</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center text-center relative z-10">
        
        {/* Animated Success Badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="relative mb-6"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-[0_0_50px_rgba(16,185,129,0.35)] flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold px-3 py-0.5 rounded-full backdrop-blur-md uppercase tracking-wider whitespace-nowrap">
            Оплата прошла успешно
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-3 text-white"
        >
          Спасибо за ваш заказ! <Sparkles className="inline-block w-7 h-7 text-amber-300 animate-bounce" />
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="text-neutral-400 text-sm sm:text-base leading-relaxed max-w-lg mb-8"
        >
          Ваш индивидуальный 3D-дизайн отправлен на ювелирное производство. Мы сразу приступили к отливке и обработке вашего изделия.
        </motion.p>

        {/* Main Cat Hero Card */}
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl mb-10 relative overflow-hidden group"
        >
          {/* Subtle glowing frame */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-pink-500/10 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Cat Image Container */}
          <div className="relative mx-auto w-48 h-48 sm:w-64 sm:h-64 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 mb-6 group-hover:scale-[1.02] transition-transform duration-500">
            <img
              src={catImage}
              alt="Главный контролер качества Nebulae"
              className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-2xl pointer-events-none" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-pink-500/15 border border-pink-500/30 px-3.5 py-1 rounded-full text-pink-300 text-xs font-semibold">
              <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400 animate-pulse" />
              <span>Главный контролёр качества Nebulae</span>
            </div>

            <p className="text-base sm:text-lg font-bold text-white leading-snug">
              «Лично слежу за производством вашего украшения!» 🐾
            </p>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Наш главный пушистый эксперт уже одобрил параметры вашей 3D-модели и следит за каждым этапом работы.
            </p>
          </div>
        </motion.div>

        {/* Order Details Grid */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left"
        >
          {/* Card 1: Order Num */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium mb-3">
              <span>Номер заказа</span>
              <PackageCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-xl font-mono font-bold text-cyan-400">№{displayOrderNumber}</p>
              <p className="text-[11px] text-neutral-400 mt-1">Сохранён в нашей базе</p>
            </div>
          </div>

          {/* Card 2: Crafting Time */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium mb-3">
              <span>Изготовление</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-300">5–7 дней</p>
              <p className="text-[11px] text-neutral-400 mt-1">Ручная полировка & гравировка</p>
            </div>
          </div>

          {/* Card 3: Delivery */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium mb-3">
              <span>Доставка</span>
              <Truck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-400">Яндекс Маркет</p>
              <p className="text-[11px] text-neutral-400 mt-1">Бесплатно в пункт выдачи</p>
            </div>
          </div>
        </motion.div>

        {/* Informational Callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.5 }}
          className="w-full bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-5 mb-10 flex items-start gap-4 text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs space-y-1">
            <p className="font-bold text-cyan-200 text-sm">Что происходит дальше?</p>
            <p className="text-cyan-100/80 leading-relaxed">
              Копия чека и параметры 3D-модели отправлены на вашу электронную почту. Мы пришлём трек-номер для отслеживания посылки, как только украшение будет готово и передано в курьерскую службу.
            </p>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.48, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md"
        >
          <button
            onClick={() => navigate('editor')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-cyan-500/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Создать ещё одно украшение</span>
          </button>

          <button
            onClick={() => navigate('about')}
            className="w-full sm:w-auto py-4 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 font-bold text-sm transition-all active:scale-98 cursor-pointer whitespace-nowrap"
          >
            О нашей студии
          </button>
        </motion.div>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 py-6 text-center text-xs text-neutral-400 relative z-10">
        <p>© {new Date().getFullYear()} Nebulae Jewelry Studio. Создавайте уникальное.</p>
      </footer>
    </div>
  );
};
