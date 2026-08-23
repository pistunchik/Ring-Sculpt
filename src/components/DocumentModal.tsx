import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileText,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Search,
  Building2,
  CreditCard,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { LEGAL_DOCUMENTS, LegalDocument } from '../data/legalDocuments';

interface DocumentModalProps {
  isOpen: boolean;
  activeDocId: string | null;
  onClose: () => void;
  onSelectDoc?: (docId: string) => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  isOpen,
  activeDocId,
  onClose,
  onSelectDoc,
}) => {
  const [selectedId, setSelectedId] = useState<string>(activeDocId || 'user-agreement');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (activeDocId) {
      setSelectedId(activeDocId);
    }
  }, [activeDocId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const currentDoc = useMemo(() => {
    return LEGAL_DOCUMENTS.find((d) => d.id === selectedId) || LEGAL_DOCUMENTS[0];
  }, [selectedId]);

  const handleCopyText = () => {
    if (!currentDoc) return;
    let fullText = `${currentDoc.title}\n${currentDoc.subtitle}\n\n`;
    if (currentDoc.preamble) {
      fullText += `${currentDoc.preamble}\n\n`;
    }
    currentDoc.sections.forEach((sec) => {
      fullText += `${sec.number ? `${sec.number}. ` : ''}${sec.title}\n`;
      sec.items.forEach((item) => {
        fullText += `${item}\n`;
      });
      fullText += '\n';
    });
    if (currentDoc.footerInfo) {
      fullText += `\nРеквизиты:\n${currentDoc.footerInfo.organization}\n`;
      if (currentDoc.footerInfo.inn) fullText += `ИНН: ${currentDoc.footerInfo.inn}\n`;
      if (currentDoc.footerInfo.address) fullText += `Адрес: ${currentDoc.footerInfo.address}\n`;
      if (currentDoc.footerInfo.bankDetails) {
        fullText += `Счет: ${currentDoc.footerInfo.bankDetails.account}\nБанк: ${currentDoc.footerInfo.bankDetails.bank}\nБИК: ${currentDoc.footerInfo.bankDetails.bik}\nКорр. счет: ${currentDoc.footerInfo.bankDetails.corrAccount}\n`;
      }
    }

    navigator.clipboard.writeText(fullText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2200);
    });
  };

  const handlePrint = () => {
    const win = window.open(currentDoc.fileHtml, '_blank');
    if (win) {
      win.focus();
      win.onload = () => {
        win.print();
      };
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-3 sm:p-6 sm:py-8">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-neutral-200/80 flex flex-col max-h-[90vh] z-10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 sm:px-8 py-4 bg-neutral-950 text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-cyan-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">Документы студии</h3>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Nebulae
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 hidden sm:block">Официальные правовые соглашения и регламенты сервиса</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Tabs Bar */}
            <div className="px-4 sm:px-8 py-2.5 bg-neutral-50/90 border-b border-neutral-200/70 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
              <div className="flex items-center gap-1.5 min-w-max">
                {LEGAL_DOCUMENTS.map((doc) => {
                  const isActive = doc.id === selectedId;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedId(doc.id);
                        if (onSelectDoc) onSelectDoc(doc.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                        isActive
                          ? 'bg-neutral-900 text-white shadow-sm'
                          : 'bg-white hover:bg-neutral-200/70 text-neutral-600 border border-neutral-200/60'
                      }`}
                    >
                      <span className="truncate max-w-[170px] sm:max-w-none">{doc.title}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="hidden md:flex items-center gap-2 shrink-0">
                <a
                  href={currentDoc.fileHtml}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg flex items-center gap-1 transition-all"
                  title="Открыть в новой вкладке"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>В новой вкладке</span>
                </a>
              </div>
            </div>

            {/* Quick Actions & Search Sub-bar */}
            <div className="px-5 sm:px-8 py-2.5 bg-white border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-cyan-50 text-cyan-700 border border-cyan-100">
                  {currentDoc.badge}
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  {currentDoc.dateBadge}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Скопировать</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Печать / PDF</span>
                </button>
              </div>
            </div>

            {/* Scrollable Document Text Content */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-10 py-6 sm:py-8 space-y-6 text-neutral-800 text-sm leading-relaxed selection:bg-cyan-200">
              {/* Document Header inside container */}
              <div className="border-b border-neutral-200 pb-5 mb-4 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight mb-1">
                  {currentDoc.title}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500">{currentDoc.subtitle}</p>
              </div>

              {/* Optional Preamble */}
              {currentDoc.preamble && (
                <div className="p-4 rounded-2xl bg-cyan-50/50 border-l-4 border-cyan-500 text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed whitespace-pre-line">
                  {currentDoc.preamble}
                </div>
              )}

              {/* Document Sections */}
              <div className="space-y-6">
                {currentDoc.sections.map((section, idx) => (
                  <div key={idx} className="space-y-2.5">
                    <h4 className="text-sm sm:text-base font-bold text-neutral-900 flex items-baseline gap-1.5 border-b border-neutral-100 pb-1">
                      {section.number && (
                        <span className="text-cyan-600 font-mono text-xs font-black">{section.number}.</span>
                      )}
                      <span>{section.title}</span>
                    </h4>

                    <div className="space-y-2 text-xs sm:text-sm text-neutral-600 pl-1">
                      {section.items.map((item, itemIdx) => {
                        const isSubItem = /^\d+\.\d+\.\d+/.test(item.trim());
                        return (
                          <p
                            key={itemIdx}
                            className={`leading-relaxed ${
                              isSubItem ? 'pl-4 sm:pl-6 text-neutral-700 font-normal' : ''
                            }`}
                          >
                            {item}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Requisites Card (if present) */}
              {currentDoc.footerInfo && (
                <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-4">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs sm:text-sm">
                    <Building2 className="w-4 h-4 text-cyan-600" />
                    <span>Официальные реквизиты стороны:</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs text-neutral-700">
                    <div>
                      <span className="text-neutral-400 block text-[11px] font-medium">Организация / Имя:</span>
                      <strong className="text-neutral-900">{currentDoc.footerInfo.organization}</strong>
                    </div>

                    {currentDoc.footerInfo.inn && (
                      <div>
                        <span className="text-neutral-400 block text-[11px] font-medium">ИНН:</span>
                        <strong className="font-mono text-neutral-900">{currentDoc.footerInfo.inn}</strong>
                      </div>
                    )}

                    {currentDoc.footerInfo.address && (
                      <div className="sm:col-span-2">
                        <span className="text-neutral-400 block text-[11px] font-medium">Юридический адрес:</span>
                        <span>{currentDoc.footerInfo.address}</span>
                      </div>
                    )}
                  </div>

                  {currentDoc.footerInfo.bankDetails && (
                    <div className="pt-3 border-t border-neutral-200/70">
                      <div className="flex items-center gap-1.5 text-neutral-900 font-semibold text-xs mb-2">
                        <CreditCard className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Банковские реквизиты:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-3 rounded-xl border border-neutral-200/60 font-mono">
                        <div>
                          <span className="text-neutral-400 block">Номер счёта:</span>
                          <span className="text-neutral-900 font-semibold">{currentDoc.footerInfo.bankDetails.account}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">Банк:</span>
                          <span className="text-neutral-900 font-semibold font-sans">{currentDoc.footerInfo.bankDetails.bank}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">БИК:</span>
                          <span className="text-neutral-900 font-semibold">{currentDoc.footerInfo.bankDetails.bik}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">Корр. счёт:</span>
                          <span className="text-neutral-900 font-semibold">{currentDoc.footerInfo.bankDetails.corrAccount}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Modal Footer */}
            <div className="px-5 sm:px-8 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-neutral-500">
                Студия <span className="font-pilowlava text-xs text-neutral-900 font-normal">Nebulae</span> &bull; Защищено законодательством РФ
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={currentDoc.fileHtml}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Открыть отдельную страницу</span>
                </a>

                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
