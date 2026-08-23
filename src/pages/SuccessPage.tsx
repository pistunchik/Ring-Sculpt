import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  PackageCheck,
  Sparkles,
  Clock,
  Truck,
  ShieldCheck,
  Heart,
  XCircle,
  Loader2,
  PenTool,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from '../router';
import { MainMenu } from '../components/MainMenu';
import catImage from '../assets/thank_you_cat.png';

interface SuccessPageProps {
  orderNumber?: string;
  onClearCart?: () => void;
}

export const SuccessPage: React.FC<SuccessPageProps> = ({ orderNumber: propOrderNumber, onClearCart }) => {
  const { navigate } = useRouter();

  // Extract order number from URL query string if present (e.g. ?order=260824-1&status=paid)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlOrder = urlParams?.get('order');
  const displayOrderNumber = propOrderNumber || urlOrder || '';
  const paymentId = urlParams?.get('paymentId') || urlParams?.get('payment_id');

  const [paymentState, setPaymentState] = useState<'checking' | 'succeeded' | 'canceled'>('checking');

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (displayOrderNumber) {
      fetch('/api/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: displayOrderNumber, paymentId }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('[SUCCESS PAGE] Результат проверки платежа:', data);
          if (data.success && data.status === 'succeeded') {
            setPaymentState('succeeded');
            // Очищаем корзину ТОЛЬКО после подтверждения успешной оплаты!
            try {
              localStorage.removeItem('nebulae_cart_v3');
            } catch (e) { }
            onClearCart?.();
          } else {
            setPaymentState('canceled');
          }
        })
        .catch((err) => {
          console.error('[SUCCESS PAGE] Ошибка проверки платежа:', err);
          setPaymentState('canceled');
        });
    } else {
      setPaymentState('canceled');
    }
  }, [displayOrderNumber, paymentId]);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-neutral-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
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

        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center text-center">

        {paymentState === 'checking' && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white border border-neutral-200/80 rounded-3xl p-10 shadow-xs max-w-md w-full">
            <Loader2 className="w-10 h-10 text-neutral-900 animate-spin" />
            <h2 className="text-lg font-bold text-neutral-900">Проверка статуса оплаты...</h2>
            <p className="text-xs text-neutral-500">Связываемся с платежной системой ЮКасса</p>
          </div>
        )}

        {paymentState === 'canceled' && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-white border border-rose-200/80 rounded-3xl p-8 sm:p-10 shadow-sm flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-5 shadow-inner">
              <XCircle className="w-9 h-9 sm:w-10 sm:h-10 text-rose-500" />
            </div>

            <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-3">
              Оплата не завершена
            </span>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 mb-3">
              Платёж был отменён
            </h1>

            <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed mb-8 max-w-md">
              {displayOrderNumber ? (
                <>Платёж по заказу <strong className="text-neutral-900 font-mono">№{displayOrderNumber}</strong> отменён или не был завершён. Средства с вашей карты не были списаны.</>
              ) : (
                <>Платёж отменён или не найден. Средства с вашей карты не были списаны.</>
              )}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
              <button
                onClick={() => navigate('editor')}
                className="w-full py-3.5 px-6 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs md:text-sm tracking-wide shadow-md shadow-neutral-950/15 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >

                <span>Попробовать оплатить снова</span>
              </button>
            </div>
          </motion.div>
        )}

        {paymentState === 'succeeded' && (
          <>
            {/* Animated Success Badge */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="relative mb-5"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-100/90 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-sm mx-auto">
                <CheckCircle2 className="w-9 h-9 sm:w-10 sm:h-10 text-emerald-600" />
              </div>
            </motion.div>

            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
              Оплата прошла успешно
            </span>

            {/* Title */}
            <motion.h1
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-3 text-neutral-950"
            >
              Спасибо за ваш заказ!
            </motion.h1>



            {/* Main Cat Hero Card */}


            {/* Order Details Grid */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8 text-left"
            >
              {/* Card 1: Order Num */}
              <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-3">
                  <span>Номер заказа</span>
                  <PackageCheck className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <p className="text-lg font-mono font-bold text-neutral-950">№{displayOrderNumber}</p>
                  <p className="text-[11px] text-neutral-400 mt-1">Сохранён в нашей базе</p>
                </div>
              </div>

              {/* Card 2: Crafting Time */}
              <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-3">
                  <span>Изготовление (Бета)</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-950">до 3 недель</p>
                  <p className="text-[11px] text-neutral-400 mt-1">Отправка с 14 сентября</p>
                </div>
              </div>

              {/* Card 3: Delivery */}
              <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-3">
                  <span>Доставка</span>
                  <Truck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-950">Яндекс Маркет</p>
                  <p className="text-[11px] text-neutral-400 mt-1">Бесплатно в пункт выдачи</p>
                </div>
              </div>
            </motion.div>

            {/* Informational Callout */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.4 }}
              className="w-full bg-white border border-neutral-200/80 rounded-2xl p-5 mb-8 flex items-start gap-3.5 text-left shadow-xs"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200/70 text-cyan-700 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-neutral-900 text-sm">Что происходит дальше?</p>
                <p className="text-neutral-600 leading-relaxed">
                  Копия чека и параметры 3D-модели сохранены. В период открытого бета-теста отправка первой партии украшений начнется <strong>не ранее 14 сентября</strong>. Мы обязательно пришлём трек-номер для отслеживания посылки, как только украшение будет изготовлено и передано в курьерскую службу.
                </p>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.48, duration: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md"
            >
              <button
                onClick={() => navigate('editor')}
                className="w-full py-3.5 px-6 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs md:text-sm tracking-wide shadow-lg shadow-neutral-950/15 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >

                <span>Создать ещё одно украшение</span>
              </button>

              <button
                onClick={() => navigate('catalog')}
                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 font-bold text-xs md:text-sm transition-all active:scale-98 cursor-pointer whitespace-nowrap shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>В каталог</span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </motion.div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 py-6 text-center text-xs text-neutral-500 bg-[#f7f6f2]">
        <p>© {new Date().getFullYear()} <span className="font-pilowlava text-sm text-neutral-900 tracking-wide">Nebulae</span> Studio. Создавайте уникальное.</p>
      </footer>
    </div>
  );
};
