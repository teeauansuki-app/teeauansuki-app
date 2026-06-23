'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { submitOrder } from '../../actions';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface OrderClientProps {
  sessionId: string;
  initialData: {
    session: any;
    categories: any[];
    menuItems: any[];
  };
}

export default function OrderClient({ sessionId, initialData }: OrderClientProps) {
  const { session, categories, menuItems } = initialData;
  const [activeCategory, setActiveCategory] = useState<number | string | 'all'>('all');
  const [cart, setCart] = useState<{ [itemId: number]: { quantity: number; notes: string; item: any; selectedOptions: any[] } }>({});
  const [activeView, setActiveView] = useState<'menu' | 'cart' | 'orders'>('menu');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Customization modal
  const [customizingItem, setCustomizingItem] = useState<any | null>(null);
  const [customQty, setCustomQty] = useState(1);
  const [customNotes, setCustomNotes] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<number, number[]>>({});

  function clearClosedSessionState() {
    setPlacedOrders([]);
    setCart({});
    setActiveView('menu');
    setCustomizingItem(null);
    setSelectedOptionIds({});
    setOrderSuccess(false);
  }

  // Fetch placed orders history
  async function fetchPlacedOrders() {
    if (!isSupabaseConfigured) return;
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, menu_items(name))')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setPlacedOrders(data);
      }
    } catch (err) {
      console.error('Error fetching placed orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }

  // Subscribe to changes in order status
  useEffect(() => {
    fetchPlacedOrders();

    if (!isSupabaseConfigured) return;
    const ordersChannel = supabase
      .channel(`orders-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchPlacedOrders();
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as any)?.status;
          if (payload.eventType === 'DELETE' || nextStatus !== 'active') {
            clearClosedSessionState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [sessionId]);

  const menuSections = useMemo(() => {
    const categoryIds = new Set(categories.map(category => category.id));
    const groupedSections = categories
      .map(category => ({
        category,
        items: menuItems.filter(item => item.category_id === category.id),
      }))
      .filter(section => section.items.length > 0);

    const uncategorizedItems = menuItems.filter(item => !categoryIds.has(item.category_id));

    if (uncategorizedItems.length === 0) {
      return groupedSections;
    }

    return [
      ...groupedSections,
      {
        category: { id: 'uncategorized', name: 'อื่น ๆ' },
        items: uncategorizedItems,
      },
    ];
  }, [categories, menuItems]);

  const cartTotalQty = Object.values(cart).reduce((sum, entry) => sum + entry.quantity, 0);

  function getItemOptionGroups(item: any) {
    return item?.option_groups || item?.menu_option_groups || [];
  }

  function selectedOptionsText(options: any[] = []) {
    return options
      .map(option => `${option.group_name}: ${option.choice_names.join(', ')}`)
      .join(' • ');
  }

  function buildSelectedOptions(item: any, selections = selectedOptionIds) {
    return getItemOptionGroups(item).map((group: any) => {
      const choiceIds = selections[group.id] || [];
      const choices = (group.choices || group.menu_option_choices || []).filter((choice: any) => choiceIds.includes(choice.id));
      return {
        group_id: group.id,
        group_name: group.name,
        choice_ids: choices.map((choice: any) => choice.id),
        choice_names: choices.map((choice: any) => choice.name),
      };
    }).filter((option: any) => option.choice_names.length > 0);
  }

  function getMissingRequiredOption(item: any) {
    for (const group of getItemOptionGroups(item)) {
      const selectedCount = selectedOptionIds[group.id]?.length || 0;
      const minSelect = group.is_required ? Math.max(1, group.min_select || 1) : group.min_select || 0;
      if (selectedCount < minSelect) {
        return group.name;
      }
    }
    return '';
  }

  function handleOptionToggle(group: any, choice: any) {
    setSelectedOptionIds(prev => {
      const current = prev[group.id] || [];
      if (group.selection_type === 'multiple') {
        const exists = current.includes(choice.id);
        const maxSelect = Math.max(group.max_select || group.choices?.length || 1, group.is_required ? 1 : 0);
        const next = exists
          ? current.filter(id => id !== choice.id)
          : current.length >= maxSelect
            ? current
            : [...current, choice.id];
        return { ...prev, [group.id]: next };
      }
      return { ...prev, [group.id]: [choice.id] };
    });
  }

  function getCategoryIcon(categoryName?: string) {
    const name = (categoryName || '').toLowerCase();

    if (name.includes('drink') || name.includes('เครื่องดื่ม') || name.includes('รีฟิล') || name.includes('น้ำ')) return 'local_drink';
    if (name.includes('snack') || name.includes('ทานเล่น') || name.includes('ของทานเล่น')) return 'fastfood';
    if (name.includes('fresh') || name.includes('ของสด') || name.includes('สด')) return 'grocery';
    if (name.includes('veg') || name.includes('ผัก') || name.includes('เห็ด')) return 'eco';
    if (name.includes('meat') || name.includes('เนื้อ') || name.includes('หมู') || name.includes('ไก่')) return 'kebab_dining';
    if (name.includes('set') || name.includes('ชุด')) return 'set_meal';
    if (name.includes('seafood') || name.includes('ทะเล') || name.includes('กุ้ง') || name.includes('หอย')) return 'set_meal';
    if (name.includes('dessert') || name.includes('หวาน') || name.includes('ของหวาน')) return 'icecream';
    if (name.includes('sauce') || name.includes('น้ำจิ้ม') || name.includes('ซอส')) return 'soup_kitchen';

    return 'ramen_dining';
  }

  function getSectionId(categoryId: number | string | 'all') {
    return categoryId === 'all' ? 'menu-section-all' : `menu-section-${categoryId}`;
  }

  function scrollToCategory(categoryId: number | string | 'all') {
    setActiveCategory(categoryId);

    requestAnimationFrame(() => {
      document.getElementById(getSectionId(categoryId))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function openCustomizer(item: any) {
    const existing = cart[item.id];
    setCustomizingItem(item);
    setCustomQty(existing ? existing.quantity : 1);
    setCustomNotes(existing ? existing.notes : '');
    const existingSelections: Record<number, number[]> = {};
    for (const option of existing?.selectedOptions || []) {
      existingSelections[option.group_id] = option.choice_ids || [];
    }
    setSelectedOptionIds(existingSelections);
  }

  function handleAddToCart() {
    if (!customizingItem) return;
    const missingRequiredOption = getMissingRequiredOption(customizingItem);
    if (missingRequiredOption) {
      alert(`กรุณาเลือก ${missingRequiredOption}`);
      return;
    }

    const selectedOptions = buildSelectedOptions(customizingItem);
    if (customQty <= 0) {
      const updated = { ...cart };
      delete updated[customizingItem.id];
      setCart(updated);
    } else {
      setCart(prev => ({
        ...prev,
        [customizingItem.id]: {
          quantity: customQty,
          notes: customNotes,
          item: customizingItem,
          selectedOptions,
        }
      }));
    }
    setCustomizingItem(null);
    setSelectedOptionIds({});

    // Pulse cart bubble animation if cart was empty
    const bubble = document.getElementById('cart-bubble');
    if (bubble) {
      bubble.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.15)' },
        { transform: 'scale(1)' }
      ], { duration: 300, easing: 'ease-out' });
    }
  }

  function handleReorder(order: any) {
    const nextCart = { ...cart };
    let addedCount = 0;

    for (const orderItem of order.order_items || []) {
      const menuItem = menuItems.find(item => item.id === orderItem.menu_item_id);
      if (!menuItem) continue;

      const quantity = orderItem.quantity || 1;
      const existing = nextCart[menuItem.id];
      nextCart[menuItem.id] = {
        quantity: (existing?.quantity || 0) + quantity,
        notes: orderItem.notes || existing?.notes || '',
        item: menuItem,
        selectedOptions: orderItem.selected_options || existing?.selectedOptions || [],
      };
      addedCount += quantity;
    }

    if (addedCount === 0) {
      alert('ไม่พบเมนูที่สามารถสั่งซ้ำได้');
      return;
    }

    setCart(nextCart);
    setActiveView('cart');
  }

  function getOrderItemCount(order: any) {
    return (order.order_items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  }

  async function handleConfirmOrder() {
    const itemsArray = Object.keys(cart).map(id => ({
      menuItemId: parseInt(id),
      quantity: cart[parseInt(id)].quantity,
      notes: cart[parseInt(id)].notes,
      selectedOptions: cart[parseInt(id)].selectedOptions || [],
    }));

    if (itemsArray.length === 0) return;
    setSubmitting(true);
    try {
      await submitOrder(sessionId, itemsArray);
      setCart({});
      setActiveView('menu');
      setOrderSuccess(true);
      fetchPlacedOrders();
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออเดอร์');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCallStaff() {
    alert('เรียกพนักงานเรียบร้อยแล้ว พนักงานกำลังมาบริการท่านที่โต๊ะครับ');
  }

  return (
    <div className="min-h-screen bg-background font-body-md relative">
      
      {/* Top Header */}
      <header className="flex h-[80px] justify-between items-center w-full px-container-margin py-base z-40 fixed top-0 bg-surface shadow-xs border-b border-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-primary shadow-xs bg-surface-container-high">
            <img className="w-full h-full object-cover" src="/logo.jpg" alt="Logo" />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-extrabold text-primary tracking-wide">โต๊ะ {session.tables?.table_number}</span>
            <h1 className="text-base font-extrabold text-on-surface tracking-tight leading-none mt-0.5">ตี๋อ้วน สุกี้ชาบู</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleCallStaff}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low text-primary hover:bg-primary/5 active:scale-95 transition-all"
            title="เรียกพนักงาน"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
          </button>
          <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            {session.packages?.name}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-[80px] pb-[96px] px-container-margin">
        {activeView === 'menu' && (
        <>
        
        {/* Categories Section */}
        <section className="sticky top-[80px] z-30 -mx-container-margin overflow-x-auto hide-scrollbar border-b border-surface-container-low bg-background/95 backdrop-blur-md">
          <div className="flex gap-5 px-container-margin">
            <button
              onClick={() => scrollToCategory('all')}
              className={`shrink-0 pt-3 pb-1.5 border-b-2 transition-all active:scale-95 ${
                activeCategory === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              <span className="block whitespace-nowrap text-center text-[13px] font-black tracking-[0.08em]">ทั้งหมด</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
              className={`shrink-0 pt-3 pb-1.5 border-b-2 transition-all active:scale-95 ${
                  activeCategory === cat.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                <span className="block whitespace-nowrap text-center text-[13px] font-black tracking-[0.08em]">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Menu Sections */}
        <section id="menu-section-all" className="mt-6 scroll-mt-28 space-y-8">
          {menuSections.map((section) => (
            <div
              key={section.category.id}
              id={getSectionId(section.category.id)}
              className="scroll-mt-28"
            >
              <div className="mb-4 flex items-center gap-3 px-1">
                <div className="h-12 w-1.5 shrink-0 rounded-full bg-primary"></div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>{getCategoryIcon(section.category.name)}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black leading-tight text-on-surface">{section.category.name}</h2>
                  <p className="mt-0.5 text-[11px] font-black text-secondary">{section.items.length} รายการ</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {section.items.map((item, idx) => {
                  const isPremiumOnly = item.package_ids
                    ? !item.package_ids.includes('standard')
                    : item.package_id === 'premium';

                  const imageSource = item.image_url ||
                    (isPremiumOnly
                      ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfv0iUl3FnYbWitEDl29tirrm3MCSrOLGLKghYdoW3gnpHw26E38wNJ-fgbhxvK-MYp2auLHw5HyA2sFi4geCJsObbYwhyBpv7Gs6NH_Jx7apmFGUNl1FCYYf10kGIEB4weCdak1IDz85s97fDKLOfoC7Y-HT0VrpuAK5KJYbbwN_uQpdK1xMSpAoTdKJa88LTNzve0pknmByqwFdyQ8HQqjjHv1YCxPM9NXFas1juHAKdIiUz-FaXTd8DZMcAOwhGRfkJ0N5LoUQ'
                      : 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNglf4PW6Gg5J78tly8xNCmVHbghVG_Z0_xHK60lP6q6DfSJEV3vRxd2eWkC8ShcqyKmLFvsq5YECOyheHqtITUQjiH6rkBmXYzdZ55U9AVV430PbUNkADpNiEFOTIAsIesHugwaRbQGfyKmfaHkW-kfoIqwJhSKKmEWe22iFQDnme0Rzyl7v5Qw_hEk1hQ_asGx-Tvf4l54OqD0lF_qVlirr6WxTVTCqiiJqMBOaW1-7_J0K89c2_eDeQ5W2g8mzoEjSoSnknmlU'
                    );

                  const isWideCard = idx % 5 === 0;

                  if (isWideCard) {
                    return (
                      <div
                        key={item.id}
                        className="col-span-2 bg-surface rounded-[24px] p-3 flex gap-4 shadow-xs border border-surface-container-low relative"
                      >
                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-surface-container-low border border-surface-container">
                          <img className="w-full h-full object-cover" src={imageSource} alt={item.name} />
                        </div>
                        <div className="flex flex-col justify-between py-1 grow">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-extrabold text-sm text-on-surface leading-tight">{item.name}</h3>
                              {isPremiumOnly && (
                                <span className="bg-secondary-container/10 text-on-secondary-container border border-secondary-container/30 px-2 py-0.5 rounded-full text-[9px] font-bold">PREMIUM</span>
                              )}
                            </div>
                            <p className="text-on-surface-variant text-[11px] font-medium line-clamp-2 mt-1">{item.description || 'สุกี้ชาบูรสเลิศ ทานคู่น้ำจิ้มสูตรเด็ด'}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-primary font-extrabold text-xs">เสิร์ฟไม่อั้น (Buffet)</span>
                            <button
                              onClick={() => openCustomizer(item)}
                              className="squishy-button w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[20px]">add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="bg-surface rounded-[24px] p-3 shadow-xs border border-surface-container-low flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container-low border border-surface-container mb-2 relative">
                          <img className="w-full h-full object-cover" src={imageSource} alt={item.name} />
                          {isPremiumOnly && (
                            <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-white">PREMIUM</span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-xs text-on-surface leading-tight line-clamp-1">{item.name}</h3>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-neutral-400 text-[10px] font-bold">Buffet</span>
                        <button
                          onClick={() => openCustomizer(item)}
                          className="squishy-button w-7 h-7 bg-primary text-on-primary rounded-full flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        </>
        )}

        {activeView === 'cart' && (
          <section className="animate-fade-in pt-4">
            {Object.keys(cart).length === 0 ? (
              <div className="rounded-[28px] border border-surface-container-low bg-surface-container-lowest p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined text-4xl">shopping_basket</span>
                </div>
                <h3 className="text-lg font-black text-on-surface">ยังไม่มีรายการในตะกร้า</h3>
                <p className="mt-2 text-xs font-bold leading-6 text-on-surface-variant">เลือกเมนูที่ต้องการก่อน แล้วรายการจะมาอยู่ตรงนี้</p>
                <button
                  onClick={() => setActiveView('menu')}
                  className="mt-5 rounded-full bg-primary px-5 py-3 text-sm font-black text-white shadow-[0_8px_22px_rgba(175,16,26,0.24)]"
                >
                  กลับไปเลือกเมนู
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {Object.values(cart).map((entry) => (
                    <div key={entry.item.id} className="rounded-[24px] border border-[#e4beba]/45 bg-surface-container-lowest p-3 shadow-sm">
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-container-low">
                          <img className="h-full w-full object-cover" src={entry.item.image_url || '/logo.jpg'} alt={entry.item.name} />
                        </div>
                        <div className="min-w-0 grow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black text-on-surface">{entry.item.name}</h3>
                              {entry.selectedOptions?.length > 0 && (
                                <p className="mt-1 line-clamp-2 text-[11px] font-black text-secondary">{selectedOptionsText(entry.selectedOptions)}</p>
                              )}
                              {entry.notes && <p className="mt-1 line-clamp-2 text-[11px] font-bold text-primary">โน้ต: {entry.notes}</p>}
                            </div>
                            <button
                              onClick={() => {
                                const updated = { ...cart };
                                delete updated[entry.item.id];
                                setCart(updated);
                              }}
                              className="rounded-full p-1 text-error hover:bg-error-container"
                              aria-label={`ลบ ${entry.item.name}`}
                            >
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 rounded-full bg-[#fff7e0] px-2 py-1">
                              <button
                                onClick={() => {
                                  const nextQty = entry.quantity - 1;
                                  const updated = { ...cart };
                                  if (nextQty <= 0) {
                                    delete updated[entry.item.id];
                                  } else {
                                    updated[entry.item.id] = { ...entry, quantity: nextQty };
                                  }
                                  setCart(updated);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-primary shadow-sm"
                              >
                                -
                              </button>
                              <span className="min-w-5 text-center text-base font-black text-[#410003]">{entry.quantity}</span>
                              <button
                                onClick={() => setCart(prev => ({
                                  ...prev,
                                  [entry.item.id]: { ...entry, quantity: entry.quantity + 1 },
                                }))}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-lg font-black text-white shadow-sm"
                              >
                                +
                              </button>
                            </div>
                            <button onClick={() => openCustomizer(entry.item)} className="text-[11px] font-black text-secondary">
                              แก้ไขโน้ต
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="sticky bottom-[76px] mt-5 rounded-[28px] border border-[#e4beba] bg-white/95 p-4 shadow-[0_-8px_28px_rgba(65,0,3,0.10)] backdrop-blur">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-black text-on-surface">รวมทั้งหมด</span>
                    <span className="text-xl font-black text-primary">{cartTotalQty} รายการ</span>
                  </div>
                  <button
                    onClick={handleConfirmOrder}
                    disabled={submitting || Object.keys(cart).length === 0}
                    className="w-full rounded-full bg-gradient-to-r from-[#af101a] to-[#800c13] py-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(175,16,26,0.28)] disabled:bg-neutral-300 disabled:shadow-none"
                  >
                    {submitting ? 'กำลังส่งออเดอร์เข้าครัว...' : `ยืนยันส่งออเดอร์ (${cartTotalQty} รายการ)`}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {activeView === 'orders' && (
          <section className="animate-fade-in space-y-3 pt-3">
            <div className="rounded-[24px] border border-[#ead6d0] bg-white/90 px-4 py-3.5 shadow-[0_10px_26px_rgba(65,0,3,0.06)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary">Order History</p>
                  <h2 className="truncate text-2xl font-black leading-tight text-on-surface">ประวัติสั่งอาหาร</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-3.5 py-2 text-primary">
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                  <span className="text-sm font-black">{placedOrders.length} ออเดอร์</span>
                </div>
              </div>
            </div>

            {loadingOrders ? (
              <div className="rounded-[24px] bg-surface-container-lowest p-6 text-center text-base font-bold text-on-surface-variant">กำลังโหลดข้อมูลออเดอร์...</div>
            ) : placedOrders.length === 0 ? (
              <div className="rounded-[24px] border border-[#e4beba]/60 bg-surface-container-lowest p-6 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined text-3xl">receipt_long</span>
                </div>
                <h3 className="text-lg font-black text-on-surface">ยังไม่มีประวัติสั่งอาหาร</h3>
                <p className="mt-1 text-sm font-bold leading-6 text-on-surface-variant">เมื่อส่งออเดอร์แล้ว รายการที่เคยสั่งจะมาอยู่ตรงนี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {placedOrders.map((order) => (
                  <div key={order.id} className="rounded-[24px] border border-[#e4beba]/55 bg-surface-container-lowest p-4 shadow-[0_10px_24px_rgba(65,0,3,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 grow gap-3">
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff7e0] text-primary">
                          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-base font-black text-on-surface">ออเดอร์ #{order.id}</h3>
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">{getOrderItemCount(order)} รายการ</span>
                          </div>
                          <p className="mt-0.5 text-sm font-bold text-on-surface-variant">
                            {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReorder(order)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-black text-white shadow-[0_8px_18px_rgba(175,16,26,0.22)] active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xl">replay</span>
                        สั่งซ้ำ
                      </button>
                    </div>

                    <div className="mt-3 space-y-2 border-t border-[#f1ddd7] pt-3">
                      {order.order_items?.slice(0, 3).map((item: any) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="block truncate font-bold text-on-surface">{item.menu_items?.name}</span>
                            {item.selected_options?.length > 0 && (
                              <span className="mt-0.5 block truncate text-xs font-bold text-secondary">{selectedOptionsText(item.selected_options)}</span>
                            )}
                          </div>
                          <span className="shrink-0 font-black text-secondary">x{item.quantity}</span>
                        </div>
                      ))}
                      {(order.order_items?.length || 0) > 3 && (
                        <div className="text-sm font-black text-primary">+ อีก {(order.order_items?.length || 0) - 3} รายการ</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Cart status bubble */}
      {cartTotalQty > 0 && activeView !== 'cart' && (
        <div className="fixed bottom-24 right-container-margin z-40" id="cart-bubble">
          <button 
            onClick={() => setActiveView('cart')}
            className="floating-cart bg-primary-container text-on-primary-container px-4 py-3 rounded-full shadow-lg flex items-center gap-2.5 border-2 border-white hover:opacity-95 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_basket</span>
            <span className="font-extrabold text-xs">{cartTotalQty} รายการในตะกร้า</span>
          </button>
        </div>
      )}

      {/* Order Sent Toast Message */}
      {orderSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-tertiary-container text-on-tertiary-container px-5 py-3 rounded-full shadow-lg border border-tertiary-container/30 flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="text-xs font-bold">ส่งออเดอร์เข้าครัวเรียบร้อยแล้ว!</span>
        </div>
      )}

      {/* Bottom Sticky Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-30 flex justify-around items-center px-4 pt-2.5 pb-safe bg-surface-container-lowest border-t border-surface-container-low shadow-[0_-4px_12px_rgba(175,16,26,0.05)] rounded-t-[20px]">
        {/* Menu (Active when modals are closed) */}
        <button 
          onClick={() => setActiveView('menu')}
          className={`flex flex-col items-center justify-center rounded-full px-5 py-1.5 transition-all duration-200 ${
            activeView === 'menu'
              ? 'bg-primary-container text-on-primary-container shadow-xs scale-95' 
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeView === 'menu' ? "'FILL' 1" : "'FILL' 0" }}>restaurant_menu</span>
          <span className="text-[10px] font-bold mt-0.5">เมนูอาหาร</span>
        </button>

        {/* Cart */}
        <button 
          onClick={() => setActiveView('cart')}
          className={`flex flex-col items-center justify-center rounded-full px-5 py-1.5 transition-all duration-200 ${
            activeView === 'cart'
              ? 'bg-primary-container text-on-primary-container shadow-xs scale-95' 
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeView === 'cart' ? "'FILL' 1" : "'FILL' 0" }}>shopping_basket</span>
            {cartTotalQty > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] font-extrabold rounded-full flex items-center justify-center">{cartTotalQty}</span>
            )}
          </div>
          <span className="text-[10px] font-bold mt-0.5">ตะกร้า</span>
        </button>

        {/* Order History */}
        <button 
          onClick={() => setActiveView('orders')}
          className={`flex flex-col items-center justify-center rounded-full px-5 py-1.5 transition-all duration-200 ${
            activeView === 'orders'
              ? 'bg-primary-container text-on-primary-container shadow-xs scale-95' 
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeView === 'orders' ? "'FILL' 1" : "'FILL' 0" }}>receipt_long</span>
          <span className="text-[10px] font-bold mt-0.5">ประวัติสั่ง</span>
        </button>
      </nav>

      {/* Item Customizer Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2b160f]/70 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-t-[32px] sm:rounded-[32px] max-w-sm w-full border-t sm:border border-[#e4beba] shadow-[0_-18px_50px_rgba(65,0,3,0.22)] animate-slide-up h-[86vh] sm:h-auto sm:max-h-[86vh] overflow-y-auto">
            <div className="relative overflow-hidden rounded-t-[32px] bg-gradient-to-r from-[#af101a] to-[#800c13] px-5 py-4 text-white">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#fdc003_0,transparent_26%),radial-gradient(circle_at_90%_10%,#ffffff_0,transparent_22%)]"></div>
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white/70 bg-white shadow-md">
                    <img src="/logo.jpg" alt="ตี๋อ้วน สุกี้ชาบู" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fdc003]">เลือกจำนวนออเดอร์</p>
                    <h3 className="truncate text-lg font-black leading-tight">{customizingItem.name}</h3>
                  </div>
                </div>
                <button onClick={() => { setCustomizingItem(null); setSelectedOptionIds({}); }} className="shrink-0 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="relative mb-4 overflow-hidden rounded-[24px] border border-[#e4beba]/70 bg-[#fff7e0] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)]">
                <div className="aspect-[4/3] max-h-[34vh] overflow-hidden rounded-[18px] bg-white">
                  <img className="w-full h-full object-contain" src={customizingItem.image_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfv0iUl3FnYbWitEDl29tirrm3MCSrOLGLKghYdoW3gnpHw26E38wNJ-fgbhxvK-MYp2auLHw5HyA2sFi4geCJsObbYwhyBpv7Gs6NH_Jx7apmFGUNl1FCYYf10kGIEB4weCdak1IDz85s97fDKLOfoC7Y-HT0VrpuAK5KJYbbwN_uQpdK1xMSpAoTdKJa88LTNzve0pknmByqwFdyQ8HQqjjHv1YCxPM9NXFas1juHAKdIiUz-FaXTd8DZMcAOwhGRfkJ0N5LoUQ'} alt={customizingItem.name} />
                </div>
              </div>

            {/* Qty Selector */}
            <div className="mb-5 flex items-center justify-center gap-7">
              <button
                onClick={() => setCustomQty(prev => Math.max(1, prev - 1))}
                className="h-14 w-14 rounded-full bg-white border-2 border-[#e4beba] flex items-center justify-center text-3xl font-black text-[#800c13] active:scale-90 shadow-[0_8px_20px_rgba(65,0,3,0.12)]"
                aria-label="ลดจำนวน"
              >
                -
              </button>
              <span className="min-w-12 text-center text-4xl font-black leading-none text-[#410003]">{customQty}</span>
              <button
                onClick={() => setCustomQty(prev => prev + 1)}
                className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-black active:scale-90 shadow-[0_10px_24px_rgba(175,16,26,0.28)]"
                aria-label="เพิ่มจำนวน"
              >
                +
              </button>
            </div>

            {getItemOptionGroups(customizingItem).length > 0 && (
              <div className="mb-5 space-y-3">
                {getItemOptionGroups(customizingItem).map((group: any) => {
                  const selectedIds = selectedOptionIds[group.id] || [];
                  const missing = group.is_required && selectedIds.length === 0;
                  return (
                    <div key={group.id} className={`rounded-[22px] border p-3 ${missing ? 'border-primary/50 bg-primary/5' : 'border-[#e4beba]/70 bg-white'}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black text-[#410003]">{group.name}</h4>
                          <p className="mt-0.5 text-[10px] font-bold text-[#7b5b54]">
                            {group.selection_type === 'multiple' ? `เลือกได้สูงสุด ${group.max_select || group.choices?.length || 1} รายการ` : 'เลือก 1 อย่าง'}
                          </p>
                        </div>
                        {group.is_required && (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">จำเป็น</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {(group.choices || group.menu_option_choices || []).map((choice: any) => {
                          const checked = selectedIds.includes(choice.id);
                          return (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => handleOptionToggle(group, choice)}
                              className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.99] ${
                                checked
                                  ? 'border-primary bg-primary text-white shadow-[0_8px_18px_rgba(175,16,26,0.18)]'
                                  : 'border-[#ead6d0] bg-[#fffdfa] text-[#410003]'
                              }`}
                            >
                              <span className="text-sm font-black">{choice.name}</span>
                              <span className={`material-symbols-outlined text-[20px] ${checked ? 'text-white' : 'text-[#a6948f]'}`}>
                                {group.selection_type === 'multiple'
                                  ? checked ? 'check_box' : 'check_box_outline_blank'
                                  : checked ? 'radio_button_checked' : 'radio_button_unchecked'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {missing && (
                        <p className="mt-2 text-[10px] font-black text-primary">กรุณาเลือกตัวเลือกนี้ก่อนใส่ตะกร้า</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <label className="text-xs font-black text-[#5b403d] block mb-2">คำแนะนำพิเศษเพิ่มเติม</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="เช่น ไม่ใส่ผัก, ขอรสเผ็ดน้อย, แยกน้ำจิ้ม..."
                className="w-full bg-white border border-[#e4beba]/80 rounded-2xl p-3 text-xs placeholder:text-neutral-400 focus:outline-none focus:border-[#fdc003] focus:ring-2 focus:ring-[#fdc003]/20 resize-none h-20"
              />
            </div>

            <button
              onClick={handleAddToCart}
              disabled={Boolean(getMissingRequiredOption(customizingItem))}
              className="w-full py-4 bg-gradient-to-r from-[#af101a] to-[#800c13] text-white font-black rounded-full text-sm squishy-button flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(175,16,26,0.30)] border border-white/40 disabled:from-neutral-300 disabled:to-neutral-300 disabled:text-white disabled:shadow-none"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              ใส่ตะกร้าออเดอร์
            </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
