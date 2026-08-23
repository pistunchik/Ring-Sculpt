import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Cpu,
  Truck,
  Mail,
  Send,
  User,
  FileText,
  Download,
  Leaf,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Package,
  Gift,
  ExternalLink,
  Eye,
  Printer,
  Scale,
  Lock,
  Clock,
} from 'lucide-react';
import { useRouter } from '../router';
import packagingImage from '../assets/packaging_custom.jpg';
import { LEGAL_DOCUMENTS } from '../data/legalDocuments';
import { DocumentModal } from '../components/DocumentModal';

const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = '',
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
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  const handleOpenDoc = (docId: string) => {
    setSelectedDocId(docId);
    setIsDocModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f1] flex flex-col font-sans text-neutral-800 selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-neutral-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <button
            onClick={() => navigate('editor')}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-600" />
            <span>В 3D-редактор</span>
          </button>




        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 text-white overflow-hidden relative">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20 flex flex-col items-center text-center gap-5">


          <FadeIn delay={0.1}>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
              Всё о сервисе <span className="font-pilowlava font-normal text-4xl sm:text-6xl tracking-wide">Nebulae</span>,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-pink-400">
                технологиях и доставке
              </span>
            </h1>
          </FadeIn>


          {/* Quick Nav Chips */}
          <FadeIn delay={0.2} className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {[
              { label: 'Что это такое?', target: 'about-service' },
              { label: 'Технология', target: 'about-tech' },
              { label: 'Доставка', target: 'about-delivery' },
              { label: 'Контакты', target: 'about-contacts' },
              { label: 'Документы', target: 'about-docs' },
            ].map((chip) => (
              <button
                key={chip.target}
                onClick={() => scrollToSection(chip.target)}
                className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-neutral-200 transition-all cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </FadeIn>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 space-y-16">

        {/* ── SECTION 1: Что это такое? ── */}
        <section id="about-service" className="scroll-mt-24">
          <FadeIn>
            <div className="flex items-center gap-2.5 mb-3 text-cyan-600">
              <HelpCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">О сервисе</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 mb-4">Что это такое?</h2>

            <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-sm space-y-4">
              <p className="text-neutral-600 text-sm sm:text-base leading-relaxed">
                <strong className="text-neutral-900 font-pilowlava text-lg font-normal tracking-wide">Nebulae</strong> — это 3D-конструктор и сервис нового поколения. Используя конструктор <span className="font-pilowlava text-base text-neutral-900 font-normal tracking-wide">Nebulae</span> вы можете сами смоделировать уникальное современное украшение. WW
              </p>

              <div className="grid sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-700 flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <p className="font-bold text-neutral-900 text-sm">Удобный интерфейс</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Интуитивно понятный интерфейс, позволяющий легко создать украшение под свои желания.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-700 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <p className="font-bold text-neutral-900 text-sm">Уникальность</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Создавайте украшения, которые полностью соответствуют вашему стилю и индивидуальности.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <p className="font-bold text-neutral-900 text-sm">Новизна</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Современное производство и экологичные материалы.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ── SECTION 2: Технология и PLA ── */}
        <section id="about-tech" className="scroll-mt-24">
          <FadeIn>
            <div className="flex items-center gap-2.5 mb-3 text-pink-600">
              <Cpu className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Технология</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 mb-2">Технология 3D-печати и Материал PLA</h2>
            <p className="text-neutral-500 text-sm mb-6">
              Мы используем передовую аддитивную печать высокого разрешения и экологичные биополимеры.
            </p>

            <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">Что такое материал PLA (Полилактид)?</h3>
                <p className="text-neutral-600 text-sm leading-relaxed">
                  <strong>PLA (Полилактид)</strong> — это высокотехнологичный термопластичный биополимер, создаваемый из натуральных возобновляемых ресурсов, таких как кукурузный крахмал и сахарный тростник.
                </p>
              </div>

              {/* Grid of PLA Advantages */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-3">

                  <div>
                    <p className="font-bold text-neutral-900 text-sm">Экологичность и Биоразлагаемость</p>
                    <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                      Полностью безопасен для природы. В отличие от нефтяных пластиков, разлагается на естественные органические компоненты.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-100 flex items-start gap-3">

                  <div>
                    <p className="font-bold text-neutral-900 text-sm">Гипоаллергенность и Безопасность</p>
                    <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                      Абсолютно безопасен при длительном контакте с кожей. Не вызывает аллергии, раздражений и не имеет запаха.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-start gap-3">

                  <div>
                    <p className="font-bold text-neutral-900 text-sm">Легкость и комфорт</p>
                    <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                      Украшения невероятно легкие и комфортные при ежедневной носке.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-start gap-3">

                  <div>
                    <p className="font-bold text-neutral-900 text-sm">Свобода формы</p>
                    <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                      3D-печать позволяет воплотить в реальность самые смелые дизайнерские идеи.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>


        {/* ── SECTION 4: Доставка ── */}
        <section id="about-delivery" className="scroll-mt-24">
          <FadeIn>
            <div className="flex items-center gap-2.5 mb-3 text-emerald-600">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Доставка</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 mb-4">Бесплатная доставка по всей России</h2>

            <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 mb-1">Яндекс Доставка</h3>
                  <p className="text-neutral-600 text-sm leading-relaxed">
                    Все заказы Nebulae доставляются <strong className="text-emerald-700 font-bold">совершенно бесплатно</strong> по всей территории Российской Федерации через логистическую службу <strong>Яндекс Доставки</strong>.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-neutral-900 text-sm">Пункты выдачи (ПВЗ)</p>
                    <p className="text-neutral-500 mt-0.5">Выдача в любом удобном пункте Яндекс Маркета рядом с вашим домом или работой.</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-neutral-900 text-sm">Трек-номер и отслеживание</p>
                    <p className="text-neutral-500 mt-0.5">Пришлем трек-номер на почту, также заказ можно отследить в приложении Яндекс Маркет.</p>
                  </div>
                </div>
              </div>

              {/* Beta notice in delivery */}
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block text-amber-950 font-bold mb-0.5">Сроки в период бета-тестирования:</strong>
                  Во время открытого бета-теста время изготовления украшений увеличено <strong className="text-amber-950">до 3-х недель</strong>, а отправка готовых изделий начнется <strong className="text-amber-950">не ранее 14 сентября 2026 года</strong>. На все заказы действует скидка 50%.
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ── SECTION 4: Контакты ── */}
        <section id="about-contacts" className="scroll-mt-24">
          <FadeIn>
            <div className="bg-neutral-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-2.5 mb-3 text-cyan-400">
                <Mail className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Контакты</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-6">Реквизиты и связь</h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <a
                  href="mailto:support@nebulae.ru"
                  className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-all">
                    <Mail className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-400 uppercase tracking-wide">Электронная почта</p>
                    <p className="text-sm font-semibold text-white mt-0.5">support@nebulae.ru</p>
                  </div>
                </a>

                <a
                  href="https://t.me/nebulae_support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-all">
                    <Send className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-400 uppercase tracking-wide">Telegram Поддержка</p>
                    <p className="text-sm font-semibold text-white mt-0.5">@nebulae_support</p>
                  </div>
                </a>

                <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-400 uppercase tracking-wide">Организация / Имя</p>
                    <p className="text-sm font-semibold text-white mt-0.5">Федоренко Денис Витальевич</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-400 uppercase tracking-wide">ИНН / Реквизиты</p>
                    <p className="text-sm font-mono font-semibold text-white mt-0.5">ИНН: 770902168809</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ── SECTION 5: Документы ── */}
        <section id="about-docs" className="scroll-mt-24">
          <FadeIn>
            <div className="flex items-center gap-2.5 mb-3 text-cyan-600">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Правовая информация</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900">Официальные документы</h2>

            </div>

            <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-sm space-y-6">
              <p className="text-neutral-600 text-sm leading-relaxed">
                Вы можете ознакомиться с полным текстом каждого документа прямо на сайте, открыть его в отдельной вкладке или сохранить / распечатать в формате PDF:
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                {LEGAL_DOCUMENTS.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between p-5 rounded-2xl bg-neutral-50/70 hover:bg-white border border-neutral-200/70 hover:border-neutral-300 hover:shadow-md transition-all group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200/80 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-cyan-200 transition-all shadow-xs">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 justify-end">

                        </div>
                      </div>

                      <h3 className="font-bold text-neutral-900 text-sm sm:text-base group-hover:text-cyan-700 transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        {doc.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-neutral-200/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenDoc(doc.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Читать на сайте</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <a
                          href={doc.fileHtml}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors"
                          title="Открыть в отдельной вкладке"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <a
                          href={doc.fileHtml}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors"
                          title="Распечатать или сохранить в PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </FadeIn>
        </section>

        {/* Bottom CTA */}
        <FadeIn delay={0.1}>
          <div className="text-center pt-4 pb-8">
            <p className="text-neutral-500 text-sm mb-4">Готовы создать своё уникальное украшение?</p>
            <button
              onClick={() => navigate('editor')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-extrabold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/20 text-sm cursor-pointer"
            >
              <span>Открыть 3D-редактор</span>
            </button>
          </div>
        </FadeIn>

      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200/60 bg-white/60 py-6 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} <span className="font-pilowlava text-sm text-neutral-600 tracking-wide font-normal">Nebulae</span> Studio — Информация и условия сервиса
      </footer>

      {/* Document Reader Modal */}
      <DocumentModal
        isOpen={isDocModalOpen}
        activeDocId={selectedDocId}
        onClose={() => setIsDocModalOpen(false)}
        onSelectDoc={(id) => setSelectedDocId(id)}
      />
    </div>
  );
};
