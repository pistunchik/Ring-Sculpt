import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Sparkles,
  Heart,
  Star,
  Gem,
  Mail,
  Phone,
  MapPin,
  Printer,
  Cpu,
  Package,
} from 'lucide-react';
import { useRouter } from '../router';

const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children, delay = 0, className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const AboutPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-[#f6f5f1] flex flex-col font-sans antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-4">
          <button
            onClick={() => navigate('editor')}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Редактор
          </button>
          <div className="flex-1 text-center">
            <span className="text-[15px] font-bold tracking-tight text-neutral-900">О нас</span>
          </div>
          <div className="w-20" /> {/* balance */}
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 text-white overflow-hidden relative">
        {/* Decorative glows */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center gap-6">
          <FadeIn delay={0.05}>
            <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto">
              <Gem className="w-10 h-10 text-cyan-400" />
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">Nebulae Studio</p>
              <h1 className="text-4xl sm:text-5xl font-black leading-tight">
                Украшения из будущего,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">
                  созданные сегодня
                </span>
              </h1>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-neutral-400 text-base leading-relaxed max-w-lg">
              Мы верим, что каждое украшение должно быть таким же уникальным, как и его владелец. Именно поэтому мы создали редактор, который позволяет вам стать дизайнером своего собственного кольца.
            </p>
          </FadeIn>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 space-y-16">

        {/* Story */}
        <FadeIn delay={0.05}>
          <section className="grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Наша история</p>
              <h2 className="text-2xl font-black text-neutral-900 mb-4">Начали с одного кольца</h2>
              <p className="text-neutral-500 text-[14px] leading-relaxed mb-3">
                Nebulae появилась из простой идеи: что если каждый человек сможет создать ювелирное украшение, которое точно отражает его личность — без посредников, без огромных бюджетов?
              </p>
              <p className="text-neutral-500 text-[14px] leading-relaxed">
                Мы объединили 3D-скульптинг, точную печать и ручную обработку в один бесшовный процесс. Сегодня тысячи уникальных колец носят по всей России.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { num: '2 000+', label: 'изделий изготовлено' },
                { num: '98%', label: 'довольных клиентов' },
                { num: '14', label: 'городов доставки' },
                { num: '3', label: 'года на рынке' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-neutral-100 p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-neutral-900">{s.num}</p>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* How it works */}
        <FadeIn delay={0.1}>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Как это работает</p>
            <h2 className="text-2xl font-black text-neutral-900 mb-6">От идеи до украшения</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Cpu, step: '01', title: 'Создайте в редакторе', desc: 'Выберите форму, материал, добавьте гравировку или вставки. Или выберите готовый дизайн из каталога.' },
                { icon: Printer, step: '02', title: 'Мы печатаем', desc: 'Ваше кольцо печатается на профессиональном 3D-принтере из высококачественного UV-полимера.' },
                { icon: Package, step: '03', title: 'Доставка к вам', desc: 'Готовое украшение проходит ручную обработку и упаковывается в фирменную коробку Nebulae.' },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-950 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-2xl font-black text-neutral-200">{step.step}</span>
                    </div>
                    <div>
                      <p className="font-bold text-neutral-900 text-[14px] mb-1">{step.title}</p>
                      <p className="text-[12px] text-neutral-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </FadeIn>

        {/* Values */}
        <FadeIn delay={0.15}>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Наши ценности</p>
            <h2 className="text-2xl font-black text-neutral-900 mb-6">Что для нас важно</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Sparkles, title: 'Уникальность', desc: 'Каждое изделие — единственное в своём роде. Мы не делаем одинаковые кольца.', color: 'text-cyan-500 bg-cyan-50' },
                { icon: Heart, title: 'Забота', desc: 'Мы сопровождаем каждый заказ и отвечаем на вопросы на каждом этапе.', color: 'text-pink-500 bg-pink-50' },
                { icon: Star, title: 'Качество', desc: 'Точная печать, ручная шлифовка и строгий контроль каждого изделия.', color: 'text-amber-500 bg-amber-50' },
              ].map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.title} className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl ${v.color} flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-neutral-900 text-[14px] mb-1">{v.title}</p>
                    <p className="text-[12px] text-neutral-500 leading-relaxed">{v.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </FadeIn>

        {/* Contact */}
        <FadeIn delay={0.2}>
          <section className="bg-neutral-950 text-white rounded-3xl p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Контакты</p>
            <h2 className="text-2xl font-black mb-6">Свяжитесь с нами</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Mail, label: 'Email', value: 'hello@nebulae.studio', href: 'mailto:hello@nebulae.studio' },
                { icon: Phone, label: 'Телефон', value: '+7 (999) 000-00-00', href: 'tel:+79990000000' },
                { icon: MapPin, label: 'Адрес', value: 'Москва, ул. Дизайнерская, 1', href: '#' },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <a
                    key={c.label}
                    href={c.href}
                    className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-all">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500 uppercase tracking-wide">{c.label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{c.value}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.25}>
          <div className="text-center pb-4">
            <p className="text-neutral-500 text-sm mb-4">Готовы создать своё уникальное украшение?</p>
            <button
              onClick={() => navigate('editor')}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg text-sm"
            >
              <Gem className="w-4 h-4" />
              Открыть редактор
            </button>
          </div>
        </FadeIn>

      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200/60 bg-white/60 py-6 text-center text-[12px] text-neutral-400">
        © 2026 Nebulae Studio — украшения из будущего
      </footer>
    </div>
  );
};
