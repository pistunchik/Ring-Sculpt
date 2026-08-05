import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
  Download,
  Truck,
  ShieldCheck,
  Gem,
  Type,
  Sparkles,
  Phone,
  User,
  Mail,
  MapPin,
  FileText,
  Loader2,
  Pencil,
  Check
} from 'lucide-react';
import { CartItem, OrderDetails } from '../types';
import { useRouter } from '../router';

// Укажите токены здесь или через VITE_TELEGRAM_BOT_TOKEN / VITE_TELEGRAM_CHAT_ID в .env
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || 'ВАШ_ТОКЕН';
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || 'ВАШ_CHAT_ID';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onExportSTL: () => void;
  onEditItem?: (id: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onExportSTL,
  onEditItem,
}) => {
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [orderNumber, setOrderNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({
    customerName: '',
    phone: '',
    email: '',
    deliveryMethod: 'cdek',
    address: '',
    comment: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Item selection state for checkout
  const [selectedIds, setSelectedIds] = useState<string[]>(() => items.map((i) => i.id));

  // Confirmation state before deleting item(s) from cart
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'single' | 'selected' | 'all';
    id?: string;
    name?: string;
  } | null>(null);

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'single' && itemToDelete.id) {
      onRemoveItem(itemToDelete.id);
    } else if (itemToDelete.type === 'selected') {
      selectedItems.forEach((item) => onRemoveItem(item.id));
      setSelectedIds([]);
    } else if (itemToDelete.type === 'all') {
      onClearCart();
      setSelectedIds([]);
    }
    setItemToDelete(null);
  };

  // Sync selectedIds when new items are added to cart
  useEffect(() => {
    setSelectedIds((prev) => {
      const validPrev = prev.filter((id) => items.some((item) => item.id === id));
      const newIds = items.filter((item) => !prev.includes(item.id)).map((item) => item.id);
      return [...validPrev, ...newIds];
    });
  }, [items]);

  const { navigate } = useRouter();
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedTotalPrice = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!orderDetails.customerName.trim()) {
      errors.customerName = 'Укажите ваше имя';
    }
    if (!orderDetails.phone.trim() || orderDetails.phone.length < 7) {
      errors.phone = 'Укажите контактный номер телефона';
    }
    if (!orderDetails.email.trim()) {
      errors.email = 'Укажите e-mail для квитанции';
    }
    if (!orderDetails.address.trim()) {
      errors.address = 'Укажите пункт выдачи или адрес доставки';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || selectedItems.length === 0) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('customerName', orderDetails.customerName);
      formData.append('phone', orderDetails.phone);
      formData.append('email', orderDetails.email || '');
      formData.append('address', orderDetails.address || '');
      formData.append('comment', orderDetails.comment || '');
      formData.append('items', JSON.stringify(selectedItems));

      // Прикрепляем STL-файлы только для выбранных товаров
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        if (item.stlBlobUrl) {
          try {
            const blobRes = await fetch(item.stlBlobUrl);
            const blob = await blobRes.blob();
            formData.append('stlFiles', blob, `Item_${i + 1}.stl`);
          } catch (fileErr) {
            console.error('Ошибка чтения STL блоба:', fileErr);
          }
        }
      }

      // Создаём платёж в ЮКассе
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка создания платежа');
      }

      // Сохраняем номер заказа и удаляем только оплаченные товары из корзины
      setOrderNumber(result.orderNumber);
      selectedItems.forEach((item) => onRemoveItem(item.id));
      setSelectedIds([]);

      // Если ЮКасса настроена — редирект на страницу оплаты.
      if (result.confirmationUrl.startsWith('http')) {
        window.location.href = result.confirmationUrl;
      } else {
        setStep('success');
      }

    } catch (err: any) {
      console.error('Ошибка оформления заказа:', err);
      alert(`Ошибка при создании платежа: ${err.message || 'Проверьте соединение с сервером'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('cart');
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900 leading-tight">
                    {step === 'cart' && 'Корзина заказа'}
                    {step === 'checkout' && 'Оформление заказа'}
                    {step === 'success' && 'Заказ принят!'}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {step === 'cart' && `${items.reduce((a, b) => a + b.quantity, 0)} шт. в корзине`}
                    {step === 'checkout' && 'Заполните данные для заказа'}
                    {step === 'success' && `Заказ №${orderNumber}`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {step === 'cart' && (
                <>
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-4">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-bold text-neutral-800 mb-1">Корзина пуста</h3>
                      <p className="text-xs text-neutral-500 max-w-xs mb-6">
                        Создайте свой уникальный дизайн кольца в 3D редакторе и нажмите «Добавить в корзину»
                      </p>
                      <button
                        onClick={handleClose}
                        className="px-5 py-2.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Вернуться к моделированию
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Select All / Batch Action Bar */}
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-100 text-xs">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center gap-2 font-semibold text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer select-none"
                        >
                          <div
                            className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${isAllSelected
                                ? 'bg-neutral-900 border-neutral-900 text-white'
                                : selectedIds.length > 0
                                  ? 'bg-neutral-100 border-neutral-400 text-neutral-800'
                                  : 'border-neutral-300 bg-white hover:border-neutral-400'
                              }`}
                          >
                            {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            {!isAllSelected && selectedIds.length > 0 && (
                              <div className="w-2 h-0.5 bg-neutral-800 rounded-full" />
                            )}
                          </div>
                          <span>Выбрать всё к оплате ({selectedCount} из {totalCount} шт.)</span>
                        </button>

                        {selectedIds.length > 0 && (
                          <button
                            onClick={() => {
                              setItemToDelete({
                                type: 'selected',
                                name: selectedItems.length === 1 ? selectedItems[0].name : `${selectedItems.length} позиций`,
                              });
                            }}
                            className="text-[11px] text-rose-500 hover:text-rose-700 font-medium transition-colors cursor-pointer"
                          >
                            Удалить выбранное
                          </button>
                        )}
                      </div>

                      {items.map((item) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${isSelected
                                ? 'border-neutral-300 bg-white'
                                : 'border-neutral-200/60 bg-neutral-50/50 opacity-65'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex gap-3 items-center">
                                {/* Selection Checkbox */}
                                <button
                                  onClick={() => toggleSelectItem(item.id)}
                                  className="cursor-pointer p-0.5 shrink-0"
                                  title={isSelected ? 'Снять выделение' : 'Выбрать для оплаты'}
                                >
                                  <div
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-neutral-900 border-neutral-900 text-white'
                                        : 'border-neutral-300 bg-white hover:border-neutral-400'
                                      }`}
                                  >
                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </div>
                                </button>

                                {item.previewDataUrl && (
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0 shadow-inner">
                                    <img
                                      src={item.previewDataUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full border border-neutral-300 ${item.materialColorClass}`} />
                                    <h4 className="text-sm font-bold text-neutral-900">{item.name}</h4>
                                  </div>
                                  <p className="text-xs text-neutral-500 mt-0.5">
                                    Материал: <span className="font-medium text-neutral-700">{item.materialName}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-bold font-mono text-neutral-900">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-white p-2.5 rounded-xl border border-neutral-100 text-neutral-600">
                              <div>
                                Размер пальца: <span className="font-semibold text-neutral-900">{item.ringParams.innerDiameter} мм</span>
                              </div>
                              <div>
                                Ширина: <span className="font-semibold text-neutral-900">{item.ringParams.width} мм</span>
                              </div>
                              <div className="col-span-2">
                                Толщина: <span className="font-semibold text-neutral-900">{item.ringParams.thickness} мм</span>
                              </div>
                            </div>

                            {(item.inscriptionText || item.placedInsertsCount > 0) && (
                              <div className="flex flex-wrap gap-2 text-[11px]">
                                {item.inscriptionText && (
                                  <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-100 font-medium">
                                    <Type className="w-3 h-3" />
                                    Гравировка: «{item.inscriptionText}»
                                  </span>
                                )}
                                {item.placedInsertsCount > 0 && (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-100 font-medium">
                                    <Sparkles className="w-3 h-3" />
                                    Вставки: {item.placedInsertsCount} шт.
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50">
                              <div className="flex items-center gap-2">
                                {onEditItem && item.editorSnapshot && (
                                  <button
                                    onClick={() => onEditItem(item.id)}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/80 transition-all cursor-pointer"
                                    title="Вернуться к редактированию модели"
                                  >
                                    <Pencil className="w-3 h-3 text-emerald-600" />
                                    <span>Изменить</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    if (item.stlBlobUrl) {
                                      const link = document.createElement('a');
                                      link.href = item.stlBlobUrl;
                                      link.download = `${item.name.replace(/[^\w\dа-яА-Я_-]+/g, '_')}.stl`;
                                      link.click();
                                    } else {
                                      onExportSTL();
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 bg-white hover:bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 transition-all cursor-pointer"
                                >
                                  <Download className="w-3 h-3 text-neutral-600" />
                                  <span>3D STL</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg border border-neutral-200 bg-white p-0.5">
                                  <button
                                    onClick={() => {
                                      if (item.quantity === 1) {
                                        setItemToDelete({ type: 'single', id: item.id, name: item.name });
                                      } else {
                                        onUpdateQuantity(item.id, -1);
                                      }
                                    }}
                                    className="p-1 hover:bg-neutral-100 rounded text-neutral-600 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-semibold text-neutral-800 font-mono">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => onUpdateQuantity(item.id, 1)}
                                    className="p-1 hover:bg-neutral-100 rounded text-neutral-600 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                <button
                                  onClick={() => setItemToDelete({ type: 'single', id: item.id, name: item.name })}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg active:scale-95 transition-all cursor-pointer"
                                  title="Удалить из корзины"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {step === 'checkout' && (
                <form onSubmit={handlePlaceOrder} className="space-y-4">
                  <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-500">Заказ ({selectedCount} изделия):</p>
                      <p className="text-sm font-bold text-neutral-900">{formatPrice(selectedTotalPrice)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('cart')}
                      className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
                    >
                      Изменить
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Имя и Фамилия <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="Иван Иванов"
                          value={orderDetails.customerName}
                          onChange={(e) => setOrderDetails({ ...orderDetails, customerName: e.target.value })}
                          className={`w-full pl-9 pr-3 py-2.5 bg-white border text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${formErrors.customerName ? 'border-rose-400 focus:ring-rose-200' : 'border-neutral-200 focus:ring-neutral-900/10 focus:border-neutral-900'
                            }`}
                        />
                      </div>
                      {formErrors.customerName && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.customerName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Телефон для связи <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="tel"
                          placeholder="+7 (999) 000-00-00"
                          value={orderDetails.phone}
                          onChange={(e) => setOrderDetails({ ...orderDetails, phone: e.target.value })}
                          className={`w-full pl-9 pr-3 py-2.5 bg-white border text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${formErrors.phone ? 'border-rose-400 focus:ring-rose-200' : 'border-neutral-200 focus:ring-neutral-900/10 focus:border-neutral-900'
                            }`}
                        />
                      </div>
                      {formErrors.phone && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.phone}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Email для квитанции <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="email"
                          placeholder="example@mail.ru"
                          value={orderDetails.email}
                          onChange={(e) => setOrderDetails({ ...orderDetails, email: e.target.value })}
                          className={`w-full pl-9 pr-3 py-2.5 bg-white border text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${formErrors.email ? 'border-rose-400 focus:ring-rose-200' : 'border-neutral-200 focus:ring-neutral-900/10 focus:border-neutral-900'}`}
                        />
                      </div>
                      {formErrors.email && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.email}</p>}
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                      <Truck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold block mb-0.5">Бесплатная доставка</span>
                        Заказ будет доставлен в ближайший пункт выдачи&nbsp;
                        <span className="font-semibold">Яндекс&nbsp;Маркет</span> — бесплатно, без доплат.
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Пункт выдачи / Адрес <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                        <textarea
                          rows={2}
                          placeholder="Город, ближайший пункт Яндекс Маркет или адрес..."
                          value={orderDetails.address}
                          onChange={(e) => setOrderDetails({ ...orderDetails, address: e.target.value })}
                          className={`w-full pl-9 pr-3 py-2.5 bg-white border text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${formErrors.address ? 'border-rose-400 focus:ring-rose-200' : 'border-neutral-200 focus:ring-neutral-900/10 focus:border-neutral-900'}`}
                        />
                      </div>
                      {formErrors.address && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.address}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Комментарий к заказу</label>
                      <div className="relative">
                        <FileText className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                        <textarea
                          rows={2}
                          placeholder="Пожелания к заказу..."
                          value={orderDetails.comment}
                          onChange={(e) => setOrderDetails({ ...orderDetails, comment: e.target.value })}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-neutral-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>СОЗДАЁМ ПЛАТЁЖ...</span>
                        </>
                      ) : (
                        <>
                          <span>ПЕРЕЙТИ К ОПЛАТЕ</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <p className="text-center text-[11px] text-neutral-400">
                      Безопасная оплата через&nbsp;<span className="font-semibold text-neutral-600">ЮКасса</span>.
                      После оплаты заказ автоматически поступит в обработку.
                    </p>
                  </div>
                </form>
              )}

              {step === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center py-6">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-100"
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>

                  <h3 className="text-xl font-bold text-neutral-900 mb-1">Спасибо за заказ!</h3>
                  <p className="text-xs text-neutral-500 mb-6 font-mono font-medium">
                    Номер заказа: <span className="text-emerald-600 font-bold">{orderNumber}</span>
                  </p>

                  <div className="w-full bg-neutral-50 rounded-2xl border border-neutral-200/80 p-4 text-left space-y-3 mb-6 text-xs text-neutral-600">
                    <div className="flex items-start gap-2.5">
                      <Truck className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-neutral-900 block">Изготовление и доставка</span>
                        <span className="text-[11px] text-neutral-500">Срок изготовления: 5-7 рабочих дней. Мы свяжемся с вами по номеру <strong className="text-neutral-800">{orderDetails.phone}</strong>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 pt-2 border-t border-neutral-200/60">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-neutral-900 block">Параметры сохранены</span>
                        <span className="text-[11px] text-neutral-500">Все 3D-модели (STL) и данные заказа зафиксированы.</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-2 border-t border-neutral-100">
                      <span className="text-sm font-bold text-neutral-900">Итого к оплате:</span>
                      <span className="text-lg font-bold font-mono text-neutral-900">{formatPrice(selectedTotalPrice)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      navigate('success');
                    }}
                    className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Посмотреть статус и котика 🐾</span>
                  </button>
                </div>
              )}
            </div>

            {step === 'cart' && items.length > 0 && (
              <div className="p-6 border-t border-neutral-100 bg-neutral-50/50 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-neutral-500">Итого ({selectedCount} шт.):</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">{formatPrice(selectedTotalPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  disabled={selectedIds.length === 0}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                    selectedIds.length > 0
                      ? 'bg-neutral-900 hover:bg-neutral-950 text-white active:scale-[0.98] shadow-neutral-900/10'
                      : 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <span>
                    {selectedIds.length > 0
                      ? `ПЕРЕЙТИ К ОФОРМЛЕНИЮ (${formatPrice(selectedTotalPrice)})`
                      : 'ВЫБЕРИТЕ ТОВАРЫ ДЛЯ ОПЛАТЫ'}
                  </span>
                  {selectedIds.length > 0 && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {step === 'checkout' && (
              <div className="p-6 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-400 block font-medium">К оплате:</span>
                  <span className="text-base font-bold font-mono text-neutral-900">{formatPrice(selectedTotalPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 transition-all cursor-pointer"
                >
                  Назад к корзине
                </button>
              </div>
            )}

            {/* Confirmation Modal for item deletion */}
            <AnimatePresence>
              {itemToDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-6"
                  onClick={() => setItemToDelete(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 12 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                    className="bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 max-w-xs w-full text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-neutral-900">Удалить из корзины?</h4>
                      <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                        {itemToDelete.type === 'selected'
                          ? `Вы действительно хотите удалить выбранные товары (${selectedItems.length} шт.) из корзины?`
                          : itemToDelete.type === 'all'
                          ? `Вы действительно хотите очистить всю корзину (${items.length} шт.)?`
                          : `Вы действительно хотите удалить «${itemToDelete.name}» из корзины?`}
                      </p>
                    </div>
                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setItemToDelete(null)}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold active:scale-95 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                      >
                        Удалить
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};