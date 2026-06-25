'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { callStaff, submitOrder } from '../../actions';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface OrderClientProps {
  sessionId: string;
  initialData: {
    session: any;
    categories: any[];
    menuItems: any[];
  };
}

type CartEntry = {
  key: string;
  quantity: number;
  notes: string;
  item: any;
  selectedOptions: any[];
  selectedVariant?: {
    variant_id?: number | null;
    variant_name: string;
    min_quantity?: number;
    max_quantity?: number;
  } | null;
};

export default function OrderClient({ sessionId, initialData }: OrderClientProps) {
  const { session, categories, menuItems } = initialData;
  const [activeCategory, setActiveCategory] = useState<number | string | 'all'>('all');
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [activeView, setActiveView] = useState<'menu' | 'cart' | 'orders' | 'service'>('menu');
  const [submitting, setSubmitting] = useState(false);
  const [callingStaff, setCallingStaff] = useState(false);
  const [lastServiceRequest, setLastServiceRequest] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Customization modal
  const [customizingItem, setCustomizingItem] = useState<any | null>(null);
  const [customQty, setCustomQty] = useState(1);
  const [customNotes, setCustomNotes] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<number, number[]>>({});
  const [variantQuantities, setVariantQuantities] = useState<Record<number | string, number>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  function getItemVariants(item: any) {
    return item?.variants || item?.menu_item_variants || [];
  }

  function getItemImages(item: any) {
    const images = item?.images || item?.menu_item_images || [];
    if (Array.isArray(images) && images.length > 0) {
      return images.map((image: any) => image.image_url || image.url).filter(Boolean);
    }
    return item?.image_url ? [item.image_url] : [];
  }

  function primaryImage(item: any) {
    return getItemImages(item)[0] || '/logo.jpg';
  }

  function optionSignature(options: any[] = []) {
    return options
      .map(option => `${option.group_id}:${(option.choice_ids || []).join(',')}`)
      .sort()
      .join('|');
  }

  function cartKey(itemId: number, variantId: number | string = 'base', selectedOptions: any[] = []) {
    return `${itemId}:${variantId || 'base'}:${optionSignature(selectedOptions)}`;
  }

  function variantKey(variant: any) {
    return variant.id || variant.name;
  }

  function selectedVariantText(variant?: CartEntry['selectedVariant']) {
    return variant?.variant_name ? `ขนาด: ${variant.variant_name}` : '';
  }

  function selectedOptionsText(options: any[] = []) {
    return options
      .map(option => `${option.group_name}: ${option.choice_names.join(', ')}`)
      .join(' • ');
  }

  const modalHasVariants = customizingItem ? getItemVariants(customizingItem).length > 0 : false;
  const modalVariantTotalQty = customizingItem
    ? getItemVariants(customizingItem).reduce((sum: number, variant: any) => sum + Number(variantQuantities[variantKey(variant)] || 0), 0)
    : 0;
  const modalAddQty = modalHasVariants ? modalVariantTotalQty : customQty;
  const modalAddDisabled = Boolean(customizingItem && getMissingRequiredOption(customizingItem)) || (modalHasVariants && modalAddQty <= 0);

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
    const variants = getItemVariants(item);
    setCustomizingItem(item);
    setCustomQty(1);
    setCustomNotes('');
    setSelectedOptionIds({});
    setVariantQuantities(variants.length > 0
      ? Object.fromEntries(variants.map((variant: any) => [variantKey(variant), 0]))
      : {}
    );
    setActiveImageIndex(0);
  }

  function handleAddToCart() {
    if (!customizingItem) return;
    const missingRequiredOption = getMissingRequiredOption(customizingItem);
    if (missingRequiredOption) {
      alert(`กรุณาเลือก ${missingRequiredOption}`);
      return;
    }

    const selectedOptions = buildSelectedOptions(customizingItem);
    const variants = getItemVariants(customizingItem);

    if (variants.length > 0) {
      const selectedVariants = variants
        .map((variant: any) => ({
          variant,
          quantity: Number(variantQuantities[variantKey(variant)] || 0),
        }))
        .filter(({ quantity }: any) => quantity > 0);

      if (selectedVariants.length === 0) {
        alert('กรุณาเลือกจำนวนอย่างน้อย 1 ไซส์');
        return;
      }

      for (const { variant, quantity } of selectedVariants) {
        if (quantity < variant.min_quantity || quantity > variant.max_quantity) {
          alert(`${variant.name} เลือกได้ ${variant.min_quantity}-${variant.max_quantity} รายการ`);
          return;
        }
      }

      setCart(prev => ({
        ...prev,
        ...Object.fromEntries(selectedVariants.map(({ variant, quantity }: any) => {
          const key = cartKey(customizingItem.id, variant.id || variant.name, selectedOptions);
          return [key, {
            key,
            quantity,
            notes: customNotes,
            item: customizingItem,
            selectedOptions,
            selectedVariant: {
              variant_id: variant.id || null,
              variant_name: variant.name,
              min_quantity: variant.min_quantity,
              max_quantity: variant.max_quantity,
            },
          }];
        })),
      }));
    } else if (customQty <= 0) {
      const key = cartKey(customizingItem.id, 'base', selectedOptions);
      const updated = { ...cart };
      delete updated[key];
      setCart(updated);
    } else {
      const key = cartKey(customizingItem.id, 'base', selectedOptions);
      setCart(prev => ({
        ...prev,
        [key]: {
          key,
          quantity: customQty,
          notes: customNotes,
          item: customizingItem,
          selectedOptions,
          selectedVariant: null,
        },
      }));
    }
    setCustomizingItem(null);
    setSelectedOptionIds({});
    setVariantQuantities({});

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
      const variantOption = (orderItem.selected_options || []).find((option: any) => option.variant_id || option.group_name === 'ขนาด');
      const selectedVariant = variantOption
        ? {
            variant_id: variantOption.variant_id || null,
            variant_name: variantOption.choice_names?.[0] || '',
          }
        : null;
      const selectedOptions = (orderItem.selected_options || []).filter((option: any) => !(option.variant_id || option.group_name === 'ขนาด'));
      const key = cartKey(menuItem.id, selectedVariant?.variant_id || selectedVariant?.variant_name || 'base', selectedOptions);
      const existing = nextCart[key];
      nextCart[key] = {
        key,
        quantity: (existing?.quantity || 0) + quantity,
        notes: orderItem.notes || existing?.notes || '',
        item: menuItem,
        selectedOptions: selectedOptions || existing?.selectedOptions || [],
        selectedVariant,
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
    const itemsArray = Object.values(cart).map(entry => ({
      menuItemId: entry.item.id,
      quantity: entry.quantity,
      notes: entry.notes,
      selectedOptions: entry.selectedOptions || [],
      selectedVariant: entry.selectedVariant || null,
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

  async function handleServiceRequest(requestType: 'staff' | 'soup') {
    if (callingStaff) return;

    const requestLabel = requestType === 'soup' ? 'เติมน้ำซุป' : 'เรียกพนักงาน';
    setCallingStaff(true);
    try {
      const result = await callStaff(sessionId, requestType);
      setLastServiceRequest(requestLabel);
      alert(result.duplicate ? `แจ้ง${requestLabel}ไปแล้ว พนักงานกำลังมาที่โต๊ะครับ` : `ส่งคำขอ${requestLabel}เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert(err.message || 'ส่งคำขอไม่สำเร็จ');
    } finally {
      setCallingStaff(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-body-md relative">
      
      {/* Top Header */}
      <header className="z-40 fixed top-0 left-0 flex h-[80px] w-full items-center justify-between bg-surface px-container-margin py-base shadow-xs border-b border-surface-container-low">
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
          <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs border border-primary/20 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            {session.packages?.name}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`${activeView === 'service' ? 'pt-[104px] pb-[104px] px-5' : 'pt-[80px] pb-[96px] px-container-margin'}`}>
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

                  const imageSource = primaryImage(item) ||
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
                        <button
                          type="button"
                          onClick={() => openCustomizer(item)}
                          className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-surface-container-low border border-surface-container transition-transform active:scale-[0.98]"
                          aria-label={`Open ${item.name}`}
                        >
                          <img className="w-full h-full object-cover" src={imageSource} alt={item.name} />
                        </button>
                        <div className="flex flex-col justify-between py-1 grow">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="mt-2 text-[17px] font-black leading-tight text-on-surface">{item.name}</h3>
                              {isPremiumOnly && (
                                <span className="bg-secondary-container/10 text-on-secondary-container border border-secondary-container/30 px-2 py-0.5 rounded-full text-[9px] font-bold">PREMIUM</span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-on-surface-variant text-[11px] font-medium line-clamp-2 mt-1">{item.description}</p>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-primary font-extrabold text-xs">เสิร์ฟไม่อั้น</span>
                              {getItemVariants(item).length > 0 && (
                                <span className="rounded-full bg-[#fff7e0] px-2 py-0.5 text-[9px] font-black text-secondary">มีไซส์</span>
                              )}
                            </div>
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
                        <button
                          type="button"
                          onClick={() => openCustomizer(item)}
                          className="aspect-square w-full rounded-2xl overflow-hidden bg-surface-container-low border border-surface-container mb-2 relative block transition-transform active:scale-[0.98]"
                          aria-label={`Open ${item.name}`}
                        >
                          <img className="w-full h-full object-cover" src={imageSource} alt={item.name} />
                          {isPremiumOnly && (
                            <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-white">PREMIUM</span>
                          )}
                        </button>
                        <h3 className="line-clamp-2 text-[15px] font-black leading-tight text-on-surface">{item.name}</h3>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-neutral-400 text-[10px] font-bold">
                          {getItemVariants(item).length > 0 ? 'เลือกไซส์' : 'Buffet'}
                        </span>
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
                    <div key={entry.key} className="rounded-[24px] border border-[#e4beba]/45 bg-surface-container-lowest p-3 shadow-sm">
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-container-low">
                          <img className="h-full w-full object-cover" src={primaryImage(entry.item)} alt={entry.item.name} />
                        </div>
                        <div className="min-w-0 grow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black text-on-surface">{entry.item.name}</h3>
                              {entry.selectedVariant && (
                                <p className="mt-1 text-[11px] font-black text-primary">{selectedVariantText(entry.selectedVariant)}</p>
                              )}
                              {entry.selectedOptions?.length > 0 && (
                                <p className="mt-1 line-clamp-2 text-[11px] font-black text-secondary">{selectedOptionsText(entry.selectedOptions)}</p>
                              )}
                              {entry.notes && <p className="mt-1 line-clamp-2 text-[11px] font-bold text-primary">โน้ต: {entry.notes}</p>}
                            </div>
                            <button
                              onClick={() => {
                                const updated = { ...cart };
                                delete updated[entry.key];
                                setCart(updated);
                              }}
                              className="rounded-full p-1 text-error hover:bg-error-container"
                              aria-label={`ลบ ${entry.item.name}`}
                            >
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 rounded-full bg-transparent px-1 py-1">
                              <button
                                onClick={() => {
                                  const nextQty = entry.quantity - 1;
                                  const updated = { ...cart };
                                  if (nextQty <= 0) {
                                    delete updated[entry.key];
                                  } else {
                                    updated[entry.key] = { ...entry, quantity: nextQty };
                                  }
                                  setCart(updated);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-primary shadow-sm"
                              >
                                -
                              </button>
                              <span className="min-w-5 text-center text-base font-black text-[#410003]">{entry.quantity}</span>
                              <button
                                onClick={() => {
                                  const maxQuantity = entry.selectedVariant?.max_quantity || 99;
                                  setCart(prev => ({
                                    ...prev,
                                    [entry.key]: { ...entry, quantity: Math.min(entry.quantity + 1, maxQuantity) },
                                  }));
                                }}
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

        {activeView === 'service' && (
          <section className="animate-fade-in space-y-5 pt-3">
            <div className="px-3 text-center">
              <h2 className="text-[30px] font-black leading-tight text-[#2c1714] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">บริการพนักงาน</h2>
              <p className="mt-2 whitespace-nowrap text-[13px] font-bold leading-6 text-[#6c5a57]">
                เลือกบริการที่ต้องการ พนักงานจะได้รับแจ้งทันที
              </p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => handleServiceRequest('staff')}
                disabled={callingStaff}
                className="group relative h-[128px] w-full overflow-hidden rounded-[26px] border border-primary/70 bg-white text-left shadow-[0_10px_24px_rgba(65,0,3,0.12)] transition-all active:scale-[0.99] disabled:opacity-70"
              >
                <svg className="absolute inset-y-0 left-0 h-full w-[46%]" viewBox="0 0 170 128" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="serviceStaffRed" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#e00719" />
                      <stop offset="54%" stopColor="#c50918" />
                      <stop offset="100%" stopColor="#9f0611" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 0 H 129 C 88 20 88 108 129 128 H 0 Z"
                    fill="url(#serviceStaffRed)"
                  />
                </svg>
                <div className="absolute right-6 top-4 text-primary/5">
                  <span className="material-symbols-outlined text-[82px]" style={{ fontVariationSettings: "'FILL' 1" }}>soup_kitchen</span>
                </div>
                <div className="relative flex h-full items-center">
                  <div className="z-10 flex w-[34%] shrink-0 items-center justify-center -translate-x-2 text-white">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '72px', lineHeight: 1 }}>room_service</span>
                  </div>
                  <div className="z-10 min-w-0 grow pr-14">
                    <h3 className="whitespace-nowrap text-[24px] font-black leading-tight text-primary">เรียกพนักงาน</h3>
                    <p className="mt-2 whitespace-nowrap text-[12px] font-bold leading-5 text-[#6b5a57]">สอบถามหรือขอความช่วยเหลือ</p>
                  </div>
                  <div className="absolute bottom-7 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_18px_rgba(175,16,26,0.24)] ring-[3px] ring-white/90">
                    <span className="material-symbols-outlined text-[28px]">chevron_right</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleServiceRequest('soup')}
                disabled={callingStaff}
                className="group relative h-[128px] w-full overflow-hidden rounded-[26px] border border-primary/55 bg-white text-left shadow-[0_10px_24px_rgba(65,0,3,0.11)] transition-all active:scale-[0.99] disabled:opacity-70"
              >
                <svg className="absolute inset-y-0 left-0 h-full w-[46%]" viewBox="0 0 170 128" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="serviceSoupRed" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#e00719" />
                      <stop offset="54%" stopColor="#c50918" />
                      <stop offset="100%" stopColor="#9f0611" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 0 H 129 C 88 20 88 108 129 128 H 0 Z"
                    fill="url(#serviceSoupRed)"
                  />
                </svg>
                <div className="absolute right-6 top-4 text-primary/5">
                  <span className="material-symbols-outlined text-[82px]" style={{ fontVariationSettings: "'FILL' 1" }}>soup_kitchen</span>
                </div>
                <div className="relative flex h-full items-center">
                  <div className="z-10 flex w-[34%] shrink-0 items-center justify-center -translate-x-2 text-white">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '78px', lineHeight: 1 }}>soup_kitchen</span>
                  </div>
                  <div className="z-10 min-w-0 grow pr-14">
                    <h3 className="whitespace-nowrap text-[24px] font-black leading-tight text-primary">เติมน้ำซุป</h3>
                    <p className="mt-2 whitespace-nowrap text-[12px] font-bold leading-5 text-[#6b5a57]">แจ้งพนักงานเติมน้ำซุปที่โต๊ะ</p>
                  </div>
                  <div className="absolute bottom-7 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_18px_rgba(175,16,26,0.24)] ring-[3px] ring-white/90">
                    <span className="material-symbols-outlined text-[28px]">chevron_right</span>
                  </div>
                </div>
              </button>
            </div>

            <div className="rounded-[30px] border border-[#ead6d0] bg-white p-5 shadow-[0_14px_30px_rgba(65,0,3,0.08)]">
              <div className="flex items-center gap-5">
                <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[28px] ${lastServiceRequest ? 'bg-primary text-white' : 'bg-primary/8 text-primary'}`}>
                  <span className="material-symbols-outlined text-[42px]" style={{ fontVariationSettings: lastServiceRequest ? "'FILL' 1" : "'FILL' 0" }}>
                    {lastServiceRequest ? 'task_alt' : 'pending_actions'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[26px] font-black leading-tight text-primary">คำขอล่าสุด</h3>
                  <p className="mt-2 text-[17px] font-bold leading-6 text-[#6b5a57]">
                    {lastServiceRequest ? `ส่งคำขอ${lastServiceRequest}แล้ว พนักงานกำลังมาที่โต๊ะ` : 'ยังไม่มีคำขอที่รอดำเนินการ'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Floating Cart status bubble */}
      {cartTotalQty > 0 && activeView === 'menu' && (
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
      <nav
        className="fixed bottom-0 left-0 w-full z-30 flex min-h-[66px] justify-around items-center gap-1 px-4 pt-1.5 bg-surface-container-lowest border-t border-surface-container-low shadow-[0_-4px_14px_rgba(65,0,3,0.08)]"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      >
        {/* Menu (Active when modals are closed) */}
        <button 
          onClick={() => setActiveView('menu')}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] px-1.5 py-1 transition-all duration-200 ${
            activeView === 'menu'
              ? 'bg-primary-container text-on-primary-container shadow-xs scale-95' 
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: activeView === 'menu' ? "'FILL' 1" : "'FILL' 0" }}>restaurant_menu</span>
          <span className="text-[11px] font-bold mt-0.5">เมนูอาหาร</span>
        </button>

        {/* Cart */}
        <button 
          onClick={() => setActiveView('cart')}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] px-1.5 py-1 transition-all duration-200 ${
            activeView === 'cart'
              ? 'bg-primary-container text-on-primary-container shadow-xs scale-95' 
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: activeView === 'cart' ? "'FILL' 1" : "'FILL' 0" }}>shopping_basket</span>
            {cartTotalQty > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] font-extrabold rounded-full flex items-center justify-center">{cartTotalQty}</span>
            )}
          </div>
          <span className="text-[11px] font-bold mt-0.5">ตะกร้า</span>
        </button>

        {/* Order History */}
        <button 
          onClick={() => setActiveView('orders')}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] px-1.5 py-1 transition-all duration-200 ${
            activeView === 'orders'
              ? 'bg-primary-container text-on-primary-container shadow-xs scale-95' 
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: activeView === 'orders' ? "'FILL' 1" : "'FILL' 0" }}>receipt_long</span>
          <span className="text-[11px] font-bold mt-0.5">ประวัติสั่ง</span>
        </button>

        {/* Service */}
        <button
          onClick={() => setActiveView('service')}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] px-1.5 py-1.5 transition-all duration-200 ${
            activeView === 'service'
              ? 'bg-gradient-to-br from-[#d80b1a] to-[#b50814] text-white shadow-[0_8px_18px_rgba(175,16,26,0.24)] scale-95'
              : 'text-on-surface-variant hover:bg-surface-variant/50'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: activeView === 'service' ? "'FILL' 1" : "'FILL' 0" }}>person_raised_hand</span>
          <span className="text-[11px] font-bold mt-0.5">บริการ</span>
        </button>
      </nav>

      {/* Item Customizer Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2b160f]/70 backdrop-blur-xs">
          <div className="flex h-[100dvh] w-full max-w-sm flex-col overflow-hidden rounded-none border-t border-[#e4beba] bg-[#fffdfa] shadow-[0_-18px_50px_rgba(65,0,3,0.22)] animate-slide-up sm:h-auto sm:max-h-[86vh] sm:rounded-[32px] sm:border">
            <div className="relative shrink-0 overflow-hidden rounded-t-[32px] bg-gradient-to-r from-[#af101a] to-[#800c13] px-5 py-4 text-white">
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

            <div className="flex-1 overflow-y-auto p-5">
              <div className="relative mb-4">
                <div
                  className="flex snap-x snap-mandatory overflow-x-auto rounded-[22px] bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    const nextIndex = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1));
                    setActiveImageIndex(nextIndex);
                  }}
                >
                  {(getItemImages(customizingItem).length > 0 ? getItemImages(customizingItem) : [primaryImage(customizingItem)]).map((imageUrl, imageIndex) => (
                    <div key={`${imageUrl}-${imageIndex}`} className="aspect-[4/3] max-h-[34vh] w-full shrink-0 snap-center bg-white">
                      <img className="h-full w-full object-contain" src={imageUrl} alt={`${customizingItem.name} ${imageIndex + 1}`} />
                    </div>
                  ))}
                </div>
                {getItemImages(customizingItem).length > 1 && (
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur-sm">
                    {getItemImages(customizingItem).map((_, imageIndex) => (
                      <span
                        key={imageIndex}
                        className={`rounded-full transition-all ${
                          activeImageIndex === imageIndex
                            ? 'h-1.5 w-5 bg-white'
                            : 'h-1.5 w-1.5 bg-white/55'
                        }`}
                      ></span>
                    ))}
                  </div>
                )}
              </div>

            {getItemVariants(customizingItem).length > 0 ? (
              <div className="mb-5 space-y-2">
                {getItemVariants(customizingItem).map((variant: any) => {
                  const key = variantKey(variant);
                  const qty = Number(variantQuantities[key] || 0);
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#e4beba]/70 bg-white p-3">
                      <div className="min-w-0">
                        <div className="text-base font-black text-[#410003]">{variant.name}</div>
                        <div className="text-[11px] font-bold text-[#7b5b54]">เลือกได้ {variant.min_quantity}-{variant.max_quantity}</div>
                      </div>
                      <div className="flex items-center gap-3 rounded-full bg-transparent px-1 py-1">
                        <button
                          onClick={() => setVariantQuantities(prev => ({ ...prev, [key]: Math.max(0, qty - 1) }))}
                          className="h-10 w-10 rounded-full bg-white text-2xl font-black text-primary shadow-sm active:scale-90"
                          aria-label={`ลดจำนวน ${variant.name}`}
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-2xl font-black text-[#410003]">{qty}</span>
                        <button
                          onClick={() => setVariantQuantities(prev => ({ ...prev, [key]: Math.min(variant.max_quantity, qty + 1) }))}
                          className="h-10 w-10 rounded-full bg-primary text-2xl font-black text-white shadow-sm active:scale-90"
                          aria-label={`เพิ่มจำนวน ${variant.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
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
            )}

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
            </div>

            <div className="shrink-0 border-t border-[#e4beba]/70 bg-[#fffdfa]/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_24px_rgba(65,0,3,0.08)] backdrop-blur">
              <button
                onClick={handleAddToCart}
                disabled={modalAddDisabled}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/40 bg-gradient-to-r from-[#af101a] to-[#800c13] py-4 text-base font-black text-white shadow-[0_10px_28px_rgba(175,16,26,0.30)] squishy-button disabled:from-neutral-300 disabled:to-neutral-300 disabled:text-white disabled:shadow-none"
              >
                <span className="material-symbols-outlined text-[21px]">add_shopping_cart</span>
                <span>ใส่ตะกร้า</span>
                {modalAddQty > 0 && (
                  <span className="ml-1 rounded-full bg-white/18 px-2 py-0.5 text-sm font-black">x{modalAddQty}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
