'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Receipt, Settings, LogOut } from 'lucide-react';
import { acknowledgeStaffCall, getAdminDashboardData, manageMenuItem, manageCategory, manageTable, registerPosDevice, updatePrintJobStatus, logoutStaff, uploadMenuImage } from '../actions';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type MenuOptionChoiceForm = {
  id?: number;
  name: string;
  price_delta: number;
  sort_order: number;
};

type MenuOptionGroupForm = {
  id?: number;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  choices: MenuOptionChoiceForm[];
};

type MenuVariantForm = {
  id?: number;
  name: string;
  min_quantity: number;
  max_quantity: number;
  sort_order: number;
};

type MenuImageForm = {
  id?: number;
  image_url: string;
  sort_order: number;
  is_primary?: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'kitchen' | 'menu' | 'categories' | 'tables' | 'sessions'>('kitchen');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | number>('all');
  
  // Dashboard data
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [pendingPrintJobs, setPendingPrintJobs] = useState<any[]>([]);
  const [staffCalls, setStaffCalls] = useState<any[]>([]);
  const [posDevices, setPosDevices] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([
    { id: 'standard', name: 'Standard', price: 308.00 },
    { id: 'premium', name: 'Premium', price: 398.00 }
  ]);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [posDeviceForm, setPosDeviceForm] = useState({
    name: 'SUNMI V2 POS',
    fcm_token: '',
  });

  // Menu Form Modal
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({
    id: null as number | null,
    name: '',
    description: '',
    price: 0,
    category_id: '' as string | number,
    package_ids: ['standard'] as string[],
    is_available: true,
    image_url: '',
    images: [] as MenuImageForm[],
    variants: [] as MenuVariantForm[],
    option_groups: [] as MenuOptionGroupForm[],
  });

  // Category Form Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({
    id: null as number | null,
    name: '',
    description: '',
    sort_order: 0,
    image_url: '',
  });

  const [showTableModal, setShowTableModal] = useState(false);
  const [tableForm, setTableForm] = useState({
    table_number: '',
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, target: 'menu' | 'cat') {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImage(true);
    setError('');

    try {
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await uploadMenuImage(formData);
        if (res.success && res.url) {
          uploadedUrls.push(res.url);
        }
      }

      if (uploadedUrls.length === 0) return;

      if (target === 'menu') {
        setMenuForm(prev => {
          const existingImages = prev.images.length > 0
            ? prev.images
            : prev.image_url
              ? [{ image_url: prev.image_url, sort_order: 1, is_primary: true }]
              : [];

          const nextImages = [
            ...existingImages,
            ...uploadedUrls.map((url, index) => ({
              image_url: url,
              sort_order: existingImages.length + index + 1,
              is_primary: false,
            })),
          ].map((image, index) => ({ ...image, sort_order: index + 1, is_primary: index === 0 }));

          return { ...prev, image_url: nextImages[0]?.image_url || '', images: nextImages };
        });
      } else {
        setCatForm(prev => ({ ...prev, image_url: uploadedUrls[0] }));
      }
      e.target.value = '';
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingImage(false);
    }
  }

  useEffect(() => {
    fetchData();

    if (!isSupabaseConfigured) return;

    // Subscribe to print jobs, orders, and sessions to update the admin dashboard in realtime!
    const printJobSub = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_calls' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(printJobSub);
    };
  }, []);

  async function fetchData() {
    try {
      const data = await getAdminDashboardData();
      setActiveSessions(data.activeSessions);
      setRecentOrders(data.recentOrders);
      setPendingPrintJobs(data.pendingPrintJobs);
      setStaffCalls(data.staffCalls || []);
      setPosDevices(data.posDevices || []);
      setTables(data.tables || []);
      setCategories(data.categories);
      setMenuItems(data.menuItems);
      if (data.packages) {
        setPackages(data.packages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMenu(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      for (const group of menuForm.option_groups) {
        if (!group.name.trim()) {
          throw new Error('กรุณากรอกชื่อกลุ่มตัวเลือก');
        }
        const filledChoices = group.choices.filter(choice => choice.name.trim());
        if (group.is_required && filledChoices.length < 2) {
          throw new Error(`กลุ่ม "${group.name}" ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`);
        }
        if (group.selection_type === 'multiple' && group.max_select < group.min_select) {
          throw new Error(`กลุ่ม "${group.name}" จำนวนสูงสุดต้องมากกว่าหรือเท่ากับจำนวนขั้นต่ำ`);
        }
      }

      for (const variant of menuForm.variants) {
        if (!variant.name.trim()) {
          throw new Error('กรุณากรอกชื่อไซส์');
        }
        if (variant.max_quantity < variant.min_quantity) {
          throw new Error(`ไซส์ "${variant.name}" จำนวนสูงสุดต้องมากกว่าหรือเท่ากับจำนวนขั้นต่ำ`);
        }
        if (variant.max_quantity <= 0) {
          throw new Error(`ไซส์ "${variant.name}" ต้องกดได้อย่างน้อย 1 รายการ`);
        }
      }

      const action = menuForm.id ? 'update' : 'create';
      await manageMenuItem(action, {
        ...menuForm,
        category_id: menuForm.category_id ? parseInt(menuForm.category_id as string) : null,
        price: 0,
        image_url: menuForm.images[0]?.image_url || menuForm.image_url || '',
        images: menuForm.images,
        variants: menuForm.variants,
      });
      await fetchData();
      if (action === 'create') {
        setSuccessMsg(`บันทึกเมนู "${menuForm.name}" เรียบร้อยแล้ว! สามารถกรอกเมนูถัดไปได้ทันที`);
        setMenuForm(prev => ({
          ...prev,
          id: null,
          name: '',
          description: '',
          image_url: '',
          images: [],
          variants: [],
          option_groups: [],
        }));
      } else {
        setShowMenuModal(false);
        resetMenuForm();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save menu item');
    }
  }

  async function handleSaveCat(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const action = catForm.id ? 'update' : 'create';
      await manageCategory(action, catForm);
      setShowCatModal(false);
      resetCatForm();
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    }
  }

  async function handleDeleteMenu(id: number) {
    if (!confirm('ยืนยันที่จะลบรายการอาหารนี้?')) return;
    try {
      await manageMenuItem('delete', { id });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete menu item');
    }
  }

  async function handleDeleteCat(id: number) {
    if (!confirm('ยืนยันที่จะลบหมวดหมู่นี้? (รายการอาหารภายใต้หมวดหมู่นี้จะไม่มีหมวดหมู่)')) return;
    try {
      await manageCategory('delete', { id });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  }

  async function handleSaveTable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const tableNumber = Number(tableForm.table_number);
      if (activeTables.some(table => Number(table.table_number) === tableNumber)) {
        throw new Error(`โต๊ะ ${tableNumber} มีอยู่แล้ว กรุณาใช้เลขโต๊ะอื่น`);
      }
      await manageTable('create', { table_number: tableNumber });
      setSuccessMsg(`เพิ่มโต๊ะ ${tableNumber} เรียบร้อยแล้ว`);
      setTableForm({ table_number: '' });
      setShowTableModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save table');
    }
  }

  async function handleDeleteTable(table: any) {
    if (table.status === 'occupied' || table.sessions?.some((session: any) => session.status === 'active')) {
      setError('ไม่สามารถลบโต๊ะที่กำลังเปิดบริการอยู่ได้');
      return;
    }

    if (!confirm(`ยืนยันที่จะลบโต๊ะ ${table.table_number}?`)) return;

    try {
      setError('');
      setSuccessMsg('');
      await manageTable('delete', { id: table.id });
      setSuccessMsg(`ลบโต๊ะ ${table.table_number} เรียบร้อยแล้ว`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete table');
    }
  }

  async function handlePrintJob(jobId: number, status: 'printed' | 'failed') {
    try {
      await updatePrintJobStatus(jobId, status);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update print job');
    }
  }

  async function handleSavePosDevice(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await registerPosDevice(posDeviceForm);
      setSuccessMsg('บันทึกเครื่อง POS สำหรับแจ้งเตือนเรียบร้อยแล้ว');
      setPosDeviceForm(prev => ({ ...prev, fcm_token: '' }));
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'บันทึกเครื่อง POS ไม่สำเร็จ');
    }
  }

  async function handleAcknowledgeStaffCall(callId: number) {
    setError('');
    try {
      await acknowledgeStaffCall(callId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'รับทราบการเรียกพนักงานไม่สำเร็จ');
    }
  }

  function resetMenuForm() {
    setError('');
    setSuccessMsg('');
    setMenuForm({
      id: null,
      name: '',
      description: '',
      price: 0,
      category_id: '',
      package_ids: ['standard'],
      is_available: true,
      image_url: '',
      images: [],
      variants: [],
      option_groups: [],
    });
    setShowPackageDropdown(false);
  }

  function addOptionGroup() {
    setMenuForm(prev => ({
      ...prev,
      option_groups: [
        ...prev.option_groups,
        {
          name: '',
          selection_type: 'single',
          is_required: true,
          min_select: 1,
          max_select: 1,
          sort_order: prev.option_groups.length + 1,
          choices: [
            { name: '', price_delta: 0, sort_order: 1 },
            { name: '', price_delta: 0, sort_order: 2 },
          ],
        },
      ],
    }));
  }

  function addVariant() {
    setMenuForm(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          name: '',
          min_quantity: 1,
          max_quantity: 3,
          sort_order: prev.variants.length + 1,
        },
      ],
    }));
  }

  function updateVariant(index: number, patch: Partial<MenuVariantForm>) {
    setMenuForm(prev => ({
      ...prev,
      variants: prev.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, ...patch } : variant
      )),
    }));
  }

  function removeVariant(index: number) {
    setMenuForm(prev => ({
      ...prev,
      variants: prev.variants
        .filter((_, variantIndex) => variantIndex !== index)
        .map((variant, variantIndex) => ({ ...variant, sort_order: variantIndex + 1 })),
    }));
  }

  function removeMenuImage(index: number) {
    setMenuForm(prev => {
      const nextImages = prev.images
        .filter((_, imageIndex) => imageIndex !== index)
        .map((image, imageIndex) => ({ ...image, sort_order: imageIndex + 1, is_primary: imageIndex === 0 }));

      return { ...prev, images: nextImages, image_url: nextImages[0]?.image_url || '' };
    });
  }

  function setPrimaryMenuImage(index: number) {
    setMenuForm(prev => {
      const image = prev.images[index];
      if (!image) return prev;
      const nextImages = [
        image,
        ...prev.images.filter((_, imageIndex) => imageIndex !== index),
      ].map((nextImage, imageIndex) => ({ ...nextImage, sort_order: imageIndex + 1, is_primary: imageIndex === 0 }));

      return { ...prev, images: nextImages, image_url: nextImages[0]?.image_url || '' };
    });
  }

  function updateOptionGroup(index: number, patch: Partial<MenuOptionGroupForm>) {
    setMenuForm(prev => ({
      ...prev,
      option_groups: prev.option_groups.map((group, groupIndex) => (
        groupIndex === index ? { ...group, ...patch } : group
      )),
    }));
  }

  function removeOptionGroup(index: number) {
    setMenuForm(prev => ({
      ...prev,
      option_groups: prev.option_groups.filter((_, groupIndex) => groupIndex !== index),
    }));
  }

  function addOptionChoice(groupIndex: number) {
    setMenuForm(prev => ({
      ...prev,
      option_groups: prev.option_groups.map((group, index) => (
        index === groupIndex
          ? {
              ...group,
              choices: [
                ...group.choices,
                { name: '', price_delta: 0, sort_order: group.choices.length + 1 },
              ],
            }
          : group
      )),
    }));
  }

  function updateOptionChoice(groupIndex: number, choiceIndex: number, patch: Partial<MenuOptionChoiceForm>) {
    setMenuForm(prev => ({
      ...prev,
      option_groups: prev.option_groups.map((group, index) => (
        index === groupIndex
          ? {
              ...group,
              choices: group.choices.map((choice, cIndex) => (
                cIndex === choiceIndex ? { ...choice, ...patch } : choice
              )),
            }
          : group
      )),
    }));
  }

  function removeOptionChoice(groupIndex: number, choiceIndex: number) {
    setMenuForm(prev => ({
      ...prev,
      option_groups: prev.option_groups.map((group, index) => (
        index === groupIndex
          ? { ...group, choices: group.choices.filter((_, cIndex) => cIndex !== choiceIndex) }
          : group
      )),
    }));
  }

  function resetCatForm() {
    setError('');
    setSuccessMsg('');
    setCatForm({
      id: null,
      name: '',
      description: '',
      sort_order: categories.length + 1,
      image_url: '',
    });
  }

  function resetTableForm() {
    setError('');
    setSuccessMsg('');
    const usedNumbers = tables.map(table => Number(table.table_number)).filter(Number.isFinite);
    const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
    setTableForm({ table_number: String(nextNumber) });
  }

  function openAddTableModal() {
    resetTableForm();
    setShowTableModal(true);
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

  function getPackageBadgeClass(packageId: string) {
    const id = packageId.toLowerCase();

    if (id.includes('premium')) {
      return 'bg-primary text-on-primary shadow-[0_4px_12px_rgba(175,16,26,0.18)]';
    }

    if (id.includes('standard')) {
      return 'bg-secondary-container text-on-secondary-container border border-secondary-fixed-dim';
    }

    return 'bg-surface-variant text-on-surface-variant border border-outline-variant';
  }

  function selectedOptionsText(options: any[] = []) {
    return options
      .map(option => `${option.group_name}: ${(option.choice_names || []).join(', ')}`)
      .join(' • ');
  }

  function openEditMenu(item: any) {
    setError('');
    setSuccessMsg('');
    setMenuForm({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: 0,
      category_id: item.category_id || '',
      package_ids: item.package_ids || (item.package_id ? [item.package_id] : ['standard']),
      is_available: item.is_available,
      image_url: item.image_url || '',
      images: (item.images || item.menu_item_images || (item.image_url ? [{ image_url: item.image_url, sort_order: 1, is_primary: true }] : [])).map((image: any, imageIndex: number) => ({
        id: image.id,
        image_url: image.image_url || '',
        sort_order: Number(image.sort_order ?? imageIndex + 1),
        is_primary: imageIndex === 0,
      })),
      variants: (item.variants || item.menu_item_variants || []).map((variant: any, variantIndex: number) => ({
        id: variant.id,
        name: variant.name || '',
        min_quantity: Number(variant.min_quantity ?? 1),
        max_quantity: Number(variant.max_quantity ?? 1),
        sort_order: Number(variant.sort_order ?? variantIndex + 1),
      })),
      option_groups: (item.option_groups || []).map((group: any, groupIndex: number) => ({
        id: group.id,
        name: group.name || '',
        selection_type: group.selection_type === 'multiple' ? 'multiple' : 'single',
        is_required: Boolean(group.is_required),
        min_select: Number(group.min_select ?? (group.is_required ? 1 : 0)),
        max_select: Number(group.max_select ?? 1),
        sort_order: Number(group.sort_order ?? groupIndex + 1),
        choices: (group.choices || group.menu_option_choices || []).map((choice: any, choiceIndex: number) => ({
          id: choice.id,
          name: choice.name || '',
          price_delta: Number(choice.price_delta || 0),
          sort_order: Number(choice.sort_order ?? choiceIndex + 1),
        })),
      })),
    });
    setShowPackageDropdown(false);
    setShowMenuModal(true);
  }

  function openEditCat(cat: any) {
    setError('');
    setSuccessMsg('');
    setCatForm({
      id: cat.id,
      name: cat.name,
      description: cat.description || '',
      sort_order: cat.sort_order,
      image_url: cat.image_url || '',
    });
    setShowCatModal(true);
  }

  const activeTables = tables.filter(table => table.is_active !== false);
  const occupiedTables = activeTables.filter(table => table.status === 'occupied').length;
  const vacantTables = activeTables.length - occupiedTables;
  const nextTableNumber = activeTables.length > 0
    ? Math.max(...activeTables.map(table => Number(table.table_number)).filter(Number.isFinite)) + 1
    : 1;
  const tableNumberValue = Number(tableForm.table_number);
  const tableNumberDuplicate = Number.isInteger(tableNumberValue)
    && activeTables.some(table => Number(table.table_number) === tableNumberValue);

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden [font-family:var(--font-sukhumvit),sans-serif]">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden lg:flex w-64 bg-gradient-to-b from-[#af101a] to-[#800c13] text-white flex-col fixed inset-y-0 left-0 z-30 border-r border-[#800c13] shadow-lg">
        {/* Logo and Brand */}
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-black text-sm tracking-tight">ตี๋อ้วน สุกี้ชาบู</h2>
            <p className="text-[10px] text-white/70 font-bold">ระบบพนักงานหลังร้าน</p>
          </div>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 mt-4">
          <Link
            href="/cashier"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Receipt className="w-5 h-5 text-white/70" />
            <span>หน้าจอแคชเชียร์</span>
          </Link>
          
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold bg-white/10 text-white border-l-4 border-[#fdc003] transition-colors"
          >
            <Settings className="w-5 h-5 text-[#fdc003]" />
            <span>หลังบ้าน & ห้องครัว</span>
          </Link>

          <button
            onClick={async () => {
              if (confirm('ยืนยันออกจากระบบ?')) {
                await logoutStaff();
                router.push('/login');
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold text-white/80 hover:text-white hover:bg-white/5 transition-colors bg-transparent border-none outline-none cursor-pointer text-left"
          >
            <LogOut className="w-5 h-5 text-white/70" />
            <span>ออกจากระบบ</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 bg-black/10 text-[10px] text-white/50 text-center font-bold">
          ตี๋อ้วน สุกี้ชาบู v1.0
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 min-h-screen flex flex-col pb-20 lg:pb-0 overflow-x-hidden">
        {/* Mobile Top Header */}
        <header className="lg:hidden sticky top-0 left-0 right-0 h-16 bg-gradient-to-r from-[#af101a] to-[#800c13] text-white flex items-center justify-between px-4 z-40 border-b border-[#800c13] shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="font-black text-xs tracking-tight">ตี๋อ้วน สุกี้ชาบู</h2>
              <p className="text-[9px] text-white/70 font-bold">หลังบ้าน & ห้องครัว</p>
            </div>
          </div>
          <div className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10 text-[#fdc003] uppercase tracking-wider">
            {activeTab === 'kitchen' ? 'คิวพิมพ์/ครัว' :
             activeTab === 'menu' ? 'เมนูอาหาร' :
             activeTab === 'categories' ? 'หมวดหมู่' :
             activeTab === 'tables' ? 'จัดการโต๊ะ' : 'โต๊ะทำงาน'}
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1">
      
      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-2xl border border-error/20 text-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-surface-container-low mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-0 md:px-0">
        <button
          onClick={() => setActiveTab('kitchen')}
          className={`flex-1 sm:flex-initial justify-center px-4 sm:px-6 py-3 font-bold text-xs md:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'kitchen' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] md:text-[20px]">print</span>
          <span className="hidden sm:inline">คิวเครื่องพิมพ์ & รายการสั่งอาหาร ({pendingPrintJobs.length})</span>
          <span className="sm:hidden">คิวสั่งอาหาร ({pendingPrintJobs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 sm:flex-initial justify-center px-4 sm:px-6 py-3 font-bold text-xs md:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'menu' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] md:text-[20px]">restaurant_menu</span>
          <span className="hidden sm:inline">จัดการเมนูอาหาร ({menuItems.length})</span>
          <span className="sm:hidden">จัดการเมนู ({menuItems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 sm:flex-initial justify-center px-4 sm:px-6 py-3 font-bold text-xs md:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'categories' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] md:text-[20px]">folder</span>
          <span className="hidden sm:inline">จัดการหมวดหมู่ ({categories.length})</span>
          <span className="sm:hidden">จัดการหมวดหมู่ ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex-1 sm:flex-initial justify-center px-4 sm:px-6 py-3 font-bold text-xs md:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'tables' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] md:text-[20px]">table_restaurant</span>
          <span className="hidden sm:inline">จัดการโต๊ะ ({activeTables.length})</span>
          <span className="sm:hidden">โต๊ะ ({activeTables.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 sm:flex-initial justify-center px-4 sm:px-6 py-3 font-bold text-xs md:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'sessions' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] md:text-[20px]">room_service</span>
          <span className="hidden sm:inline">โต๊ะที่กำลังเปิดบริการ ({activeSessions.length})</span>
          <span className="sm:hidden">โต๊ะที่เปิดอยู่ ({activeSessions.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-on-surface-variant font-bold">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* TABS: KITCHEN & ORDERS */}
          {activeTab === 'kitchen' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              
              {/* Printing Queue */}
              <div className="lg:col-span-2 bg-surface-container-lowest p-4 sm:p-6 rounded-3xl border border-surface-container-low shadow-sm">
                <h3 className="text-lg font-extrabold text-on-surface mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
                  คิวพิมพ์ใบสั่งอาหารเข้าครัว ({pendingPrintJobs.length} ออเดอร์)
                </h3>
                
                {pendingPrintJobs.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400 text-sm font-bold flex flex-col items-center">
                    <span className="material-symbols-outlined text-4xl mb-2">done_all</span>
                    ไม่มีคิวงานพิมพ์ค้างอยู่
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {pendingPrintJobs.map((job) => {
                      const order = job.orders;
                      const session = order?.sessions;
                      const tableNumber = session?.tables?.table_number;
                      const packageName = session?.packages?.name;
                      
                      return (
                        <div key={job.id} className="border-2 border-dashed border-neutral-300 p-4 bg-white rounded-2xl flex flex-col justify-between">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2 border-b border-dashed border-neutral-200 pb-2 mb-3">
                            <div>
                              <div className="text-sm md:text-base font-extrabold text-neutral-800">โต๊ะ {tableNumber} ({packageName})</div>
                              <div className="text-[10px] md:text-[11px] text-neutral-400 font-bold">คิวพิมพ์ #{job.id} | ออเดอร์ #{order?.id}</div>
                            </div>
                            <div className="text-left sm:text-right w-full sm:w-auto">
                              <div className="text-[10px] md:text-xs font-bold text-neutral-700">เวลาสั่ง: {new Date(job.created_at).toLocaleTimeString('th-TH')}</div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 mb-4">
                            {order?.order_items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-xs md:text-sm">
                                <span className="font-extrabold text-neutral-700">
                                  - {item.menu_items?.name} 
                                  {item.selected_options?.length > 0 && <span className="text-[11px] text-secondary block ml-3 font-bold">{selectedOptionsText(item.selected_options)}</span>}
                                  {item.notes && <span className="text-[11px] text-primary block ml-3 font-semibold">โน้ต: {item.notes}</span>}
                                </span>
                                <span className="font-extrabold text-neutral-800 ml-4">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap gap-2 justify-end w-full">
                            <button
                              onClick={() => handlePrintJob(job.id, 'failed')}
                              className="grow sm:grow-0 px-3 py-1.5 bg-error-container text-on-error-container rounded-xl text-xs font-bold cursor-pointer text-center"
                            >
                              พิมพ์ล้มเหลว
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-3xl border border-primary/20 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-black text-on-surface flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
                      เรียกพนักงาน
                    </h3>
                    <span className="px-3 py-1 rounded-full bg-primary text-on-primary text-sm font-black">{staffCalls.length}</span>
                  </div>

                  {staffCalls.length === 0 ? (
                    <div className="py-8 text-center text-on-surface-variant font-black">
                      ไม่มีโต๊ะเรียกพนักงาน
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {staffCalls.map((call) => {
                        const packageName = Array.isArray(call.sessions)
                          ? call.sessions[0]?.packages?.name
                          : call.sessions?.packages?.name;

                        return (
                          <div key={call.id} className="rounded-2xl bg-primary/5 border border-primary/15 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-2xl font-black text-primary leading-none">โต๊ะ {call.table_number}</div>
                                <div className="mt-1 text-sm font-black text-on-surface-variant">{call.message || 'เรียกพนักงาน'}{packageName ? ` · ${packageName}` : ''}</div>
                              </div>
                              <div className="text-right text-xs font-black text-on-surface-variant tabular-nums">
                                {new Date(call.created_at).toLocaleTimeString('th-TH')}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAcknowledgeStaffCall(call.id)}
                              className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-black text-on-primary shadow-sm active:scale-[0.99]"
                            >
                              รับทราบ
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSavePosDevice} className="bg-surface-container-lowest p-5 rounded-3xl border border-surface-container-low shadow-sm">
                  <h3 className="text-lg font-black text-on-surface mb-3">เครื่อง POS แจ้งเตือน</h3>
                  <div className="space-y-3">
                    <input
                      value={posDeviceForm.name}
                      onChange={(e) => setPosDeviceForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm font-black outline-none focus:border-primary"
                      placeholder="ชื่อเครื่อง"
                    />
                    <textarea
                      value={posDeviceForm.fcm_token}
                      onChange={(e) => setPosDeviceForm(prev => ({ ...prev, fcm_token: e.target.value }))}
                      className="min-h-24 w-full resize-none rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary"
                      placeholder="วาง FCM token จากเครื่อง SUNMI"
                    />
                    <button className="w-full rounded-2xl bg-[#410003] px-4 py-3 text-sm font-black text-white active:scale-[0.99]">
                      บันทึกเครื่อง POS
                    </button>
                  </div>
                  <div className="mt-3 text-xs font-black text-on-surface-variant">
                    ลงทะเบียนแล้ว {posDevices.length} เครื่อง
                  </div>
                </form>

                {/* Recent Orders History */}
                <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-surface-container-low shadow-sm max-h-[560px] lg:max-h-[420px] overflow-y-auto">
                <h3 className="text-2xl sm:text-[28px] leading-tight font-black text-on-surface mb-5">ประวัติออเดอร์ 50 ล่าสุด</h3>
                <div className="flex flex-col gap-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="p-4 sm:p-5 bg-surface-container-low rounded-3xl border border-surface-container shadow-[0_4px_16px_rgba(65,0,3,0.04)]">
                      <div className="flex items-start justify-between gap-3 text-on-surface mb-3">
                        <span className="text-base sm:text-lg leading-6 font-black">ออเดอร์ #{order.id} (โต๊ะ {order.sessions?.tables?.table_number})</span>
                        <span className="shrink-0 text-xs sm:text-sm px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-black">
                          {order.sessions?.packages?.name}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2.5 text-on-surface">
                        {order.order_items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between gap-4 font-black">
                            <span className="min-w-0">
                              <span className="block truncate text-sm sm:text-base leading-6">{item.menu_items?.name}</span>
                              {item.selected_options?.length > 0 && <span className="block truncate text-xs sm:text-sm leading-5 font-black text-secondary">{selectedOptionsText(item.selected_options)}</span>}
                            </span>
                            <span className="shrink-0 text-sm sm:text-base leading-6 text-[#410003]">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs sm:text-sm text-neutral-500 text-right mt-3 font-black tabular-nums">
                        {new Date(order.created_at).toLocaleTimeString('th-TH')}
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>

            </div>
          )}

          {/* TABS: MENU MANAGEMENT */}
          {activeTab === 'menu' && (
            <div className="bg-[#f9f9f9] px-0 pb-8 relative w-full animate-fade-in">
              <div className="text-center mb-8 px-4">
                <h3 className="text-[34px] md:text-5xl leading-tight font-black text-on-surface mb-3">
                  เมนูอาหาร
                </h3>
                <p className="text-sm md:text-base leading-7 text-on-surface-variant max-w-2xl mx-auto">
                  จัดการรายการอาหาร รูปภาพ หมวดหมู่ และสถานะพร้อมเสิร์ฟของเมนูภายในร้าน
                </p>
              </div>

              {/* Category Filters */}
              <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-10 pb-2 border-b border-surface-variant px-4">
                <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={`flex w-20 shrink-0 flex-col items-center gap-2 pb-2 border-b-2 transition-all cursor-pointer group sm:w-24 ${
                    selectedCategoryFilter === 'all'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-secondary hover:text-primary'
                  }`}
                >
                  <span className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    selectedCategoryFilter === 'all' ? 'bg-primary-fixed' : 'bg-surface-variant group-hover:bg-primary-fixed/50'
                  }`}>
                    <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant</span>
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-bold uppercase tracking-[0.12em]">ทั้งหมด</span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`flex w-20 shrink-0 flex-col items-center gap-2 pb-2 border-b-2 transition-all cursor-pointer group sm:w-24 ${
                      selectedCategoryFilter === cat.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-secondary hover:text-primary'
                    }`}
                  >
                    <span className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden transition-colors ${
                      selectedCategoryFilter === cat.id ? 'bg-primary-fixed' : 'bg-surface-variant group-hover:bg-primary-fixed/50'
                    }`}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[24px]">{getCategoryIcon(cat.name)}</span>
                      )}
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-bold uppercase tracking-[0.12em]">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Menu Grid */}
              <div className="-mx-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:mx-0 sm:gap-4 sm:px-4 md:gap-6">
                {((selectedCategoryFilter === 'all'
                  ? menuItems
                  : menuItems.filter(item => item.category_id === selectedCategoryFilter)
                ) || []).map((item) => (
                  <article
                    key={item.id} 
                    onClick={() => openEditMenu(item)}
                    className="group relative bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-secondary-fixed/20 cursor-pointer hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="aspect-square w-full relative overflow-hidden bg-surface-container">
                      <img 
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${
                          !item.is_available ? 'opacity-50 grayscale-[30%]' : ''
                        }`} 
                        src={item.image_url || '/logo.jpg'} 
                        alt={item.name} 
                      />
                      <div className="absolute inset-0 bg-on-surface/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                        <span className="material-symbols-outlined text-white text-3xl">edit</span>
                      </div>
                      <div className={`absolute top-2 right-2 backdrop-blur-sm px-2 py-1 rounded shadow-sm border flex items-center gap-1 max-w-[calc(100%-16px)] ${
                        item.is_available
                          ? 'bg-surface/90 border-secondary-fixed/30'
                          : 'bg-error-container/95 border-error/20'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.is_available ? 'bg-secondary' : 'bg-error'}`}></div>
                        <span className={`text-[10px] uppercase tracking-widest font-semibold truncate ${
                          item.is_available ? 'text-on-surface' : 'text-on-error-container'
                        }`}>
                          {item.is_available ? 'พร้อมเสิร์ฟ' : 'สินค้าหมด'}
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 bg-surface-container-lowest ${!item.is_available ? 'opacity-70' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-lg leading-7 font-black text-on-surface truncate">
                            {item.name}
                          </h4>
                          <p className="text-xs text-on-surface-variant mt-1 truncate">
                            {item.categories?.name || 'ไม่มีหมวดหมู่'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteMenu(item.id); }}
                          aria-label={`ลบ ${item.name}`}
                          className="w-8 h-8 rounded-full text-error hover:bg-error-container flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
                        {(item.package_ids || (item.package_id ? [item.package_id] : [])).slice(0, 2).map((pkgId: string) => (
                          <span
                            key={pkgId}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${getPackageBadgeClass(pkgId)}`}
                          >
                            {pkgId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* TABS: CATEGORY MANAGEMENT */}
          {activeTab === 'categories' && (
            <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl border border-surface-container-low shadow-sm w-full animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-on-surface">จัดการหมวดหมู่รายการอาหาร</h3>
                  <p className="text-xs text-on-surface-variant font-bold mt-1">แบ่งเมนูตามหมวดหมู่เพื่อแสดงผลให้ลูกค้าสั่งอาหารได้ง่ายขึ้น</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((cat) => {
                  const itemsCount = menuItems.filter(item => item.category_id === cat.id).length;
                  return (
                    <div key={cat.id} className="bg-surface rounded-[24px] p-4 border border-[#e4beba]/20 shadow-xs flex flex-col justify-between hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
                          )}
                        </div>
                        <div className="min-w-0 grow">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-on-surface truncate">{cat.name}</h4>
                            <span className="bg-[#fdc003]/10 text-[#785900] text-[9px] font-black px-2 py-0.5 rounded-full border border-[#fdc003]/30 shrink-0">
                              ลำดับ {cat.sort_order}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant font-medium mt-1.5 line-clamp-2 leading-relaxed">
                            {cat.description || 'ไม่มีคำอธิบายเพิ่มเติมสำหรับหมวดหมู่นี้'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-primary font-extrabold">
                            <span className="material-symbols-outlined text-xs">restaurant</span>
                            <span>{itemsCount} รายการในหมวดหมู่นี้</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 border-t border-surface-container-high pt-3 mt-4 justify-end shrink-0">
                        <button 
                          onClick={() => openEditCat(cat)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors cursor-pointer border border-surface-container-high"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>แก้ไข</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteCat(cat.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-bold text-primary transition-colors cursor-pointer border border-red-100"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span>ลบ</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TABS: TABLE MANAGEMENT */}
          {activeTab === 'tables' && (
            <div className="w-full animate-fade-in space-y-5">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="rounded-2xl border border-[#e4beba]/60 bg-white p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-xs font-black text-[#7b5b54]">ทั้งหมด</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-black text-[#410003]">{activeTables.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-xs font-black text-emerald-700">ว่าง</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-800">{vacantTables}</p>
                </div>
                <div className="rounded-2xl border border-[#e4beba]/60 bg-[#fff7e0] p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-xs font-black text-[#785900]">เปิดอยู่</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-black text-primary">{occupiedTables}</p>
                </div>
              </div>

              <section className="rounded-[28px] border border-[#e4beba]/70 bg-white p-4 sm:p-5 shadow-[0_8px_28px_rgba(65,0,3,0.05)]">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-1.5 rounded-full bg-primary"></span>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#410003]">จัดการโต๊ะ</h3>
                        <p className="text-xs sm:text-sm font-bold text-[#7b5b54]">เพิ่มหรือลบโต๊ะที่แสดงในหน้าแคชเชียร์</p>
                      </div>
                    </div>
                  </div>
                  <span className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">table_restaurant</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openAddTableModal}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(175,16,26,0.22)] transition-transform active:scale-95 sm:w-auto"
                >
                  <span className="material-symbols-outlined text-[22px]">add</span>
                  เพิ่มโต๊ะใหม่
                </button>
              </section>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {activeTables.map((table) => {
                  const isOccupied = table.status === 'occupied' || table.sessions?.some((session: any) => session.status === 'active');
                  return (
                    <article
                      key={table.id}
                      className={`rounded-[24px] border p-3 sm:p-4 shadow-sm transition-all ${
                        isOccupied
                          ? 'border-[#e4beba] bg-[#fff7e0]'
                          : 'border-surface-container-high bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-[#7b5b54]">โต๊ะ</p>
                          <h4 className="mt-1 text-3xl font-black leading-none text-[#410003]">
                            {String(table.table_number).padStart(2, '0')}
                          </h4>
                        </div>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isOccupied ? 'bg-primary text-white' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {isOccupied ? 'restaurant' : 'check'}
                          </span>
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e4beba]/50 pt-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                          isOccupied ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {isOccupied ? 'กำลังใช้งาน' : 'ว่าง'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTable(table)}
                          disabled={isOccupied}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-primary transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-300"
                          aria-label={`ลบโต๊ะ ${table.table_number}`}
                          title={isOccupied ? 'ลบไม่ได้ขณะโต๊ะเปิดอยู่' : 'ลบโต๊ะ'}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>

              {activeTables.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-[#e4beba] bg-white p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-primary">table_restaurant</span>
                  <p className="mt-2 text-base font-black text-[#410003]">ยังไม่มีโต๊ะในระบบ</p>
                  <p className="mt-1 text-sm font-bold text-[#7b5b54]">เพิ่มเลขโต๊ะด้านบนเพื่อเริ่มใช้งานหน้าแคชเชียร์</p>
                </div>
              )}
            </div>
          )}

          {/* TABS: ACTIVE SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl border border-surface-container-low shadow-sm">
              <h3 className="text-lg font-extrabold text-on-surface mb-4">โต๊ะที่กำลังทำงาน</h3>
              
              {activeSessions.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 font-bold text-sm">ไม่มีโต๊ะใดกำลังใช้บริการในขณะนี้</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {activeSessions.map((session) => (
                    <div key={session.id} className="p-4 bg-surface-container-low rounded-2xl border border-surface-container flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between font-extrabold text-on-surface text-base mb-2">
                          <span>โต๊ะ {session.tables?.table_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            session.package_id === 'premium' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary text-on-primary'
                          }`}>
                            {session.packages?.name}
                          </span>
                        </div>
                        <div className="text-xs text-on-surface-variant font-medium leading-relaxed">
                          เวลาเปิดโต๊ะ: {new Date(session.opened_at).toLocaleTimeString('th-TH')}น.<br />
                          ความก้าวหน้าเซสชัน: {Math.floor((Date.now() - new Date(session.opened_at).getTime()) / 60000)} นาที
                        </div>
                      </div>
                      
                      <div className="text-xs text-neutral-400 font-semibold border-t border-neutral-200/50 pt-3 mt-4">
                        ID: <span className="font-mono text-[9px] select-all">{session.id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {showMenuModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] max-w-2xl w-full border-t-8 border-[#fdc003] shadow-2xl overflow-hidden animate-scale-in flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#af101a] to-[#800c13] text-white p-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/30 shrink-0">
                  <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl md:text-2xl tracking-tight">
                    {menuForm.id ? 'แก้ไขรายการอาหาร' : 'เพิ่มรายการอาหารใหม่'}
                  </h3>
                  <p className="text-xs text-white/70 font-semibold">ตี๋อ้วน สุกี้ชาบู • ระบบบริหารจัดการอาหาร</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowMenuModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border-none outline-none cursor-pointer"
              >
                  <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveMenu} className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto max-h-[82vh] sm:max-h-[75vh] text-base [&_label]:!text-sm [&_input]:min-h-12 [&_input]:!text-base [&_select]:min-h-12 [&_select]:!text-base [&_button]:!text-sm">
              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm font-bold flex items-center gap-2 animate-fade-in shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                  {successMsg}
                </div>
              )}
              {/* Row 1: Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-1.5">ชื่อรายการอาหาร <span className="text-primary">*</span></label>
                  <input 
                    type="text" 
                    value={menuForm.name} 
                    onChange={(e) => setMenuForm({...menuForm, name: e.target.value})} 
                    required
                    placeholder="เช่น เนื้อริบอายพรีเมียมคัต"
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-1.5">คำอธิบาย</label>
                  <input 
                    type="text" 
                    value={menuForm.description} 
                    onChange={(e) => setMenuForm({...menuForm, description: e.target.value})} 
                    placeholder="เช่น เนื้อสไลด์บางพอดีคำ ลายสวยนุ่ม"
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Row 2: Category & Package */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-1.5">หมวดหมู่รายการ</label>
                  <select 
                    value={menuForm.category_id || ''} 
                    onChange={(e) => setMenuForm({...menuForm, category_id: e.target.value})}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold cursor-pointer"
                  >
                    <option value="">-- ไม่ระบุหมวดหมู่ --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="text-sm font-black text-on-surface-variant block mb-1.5">แพ็กเกจบุฟเฟต์ที่ร่วมรายการ <span className="text-primary">*</span></label>
                  <button
                    type="button"
                    onClick={() => setShowPackageDropdown(!showPackageDropdown)}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold text-left flex justify-between items-center cursor-pointer"
                  >
                    <span className="truncate">
                      {menuForm.package_ids.length === 0
                        ? 'เลือกแพ็กเกจ...'
                        : packages
                            .filter(p => menuForm.package_ids.includes(p.id))
                            .map(p => p.name)
                            .join(', ') || menuForm.package_ids.join(', ')}
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant select-none">
                      {showPackageDropdown ? 'arrow_drop_up' : 'arrow_drop_down'}
                    </span>
                  </button>
                  {showPackageDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowPackageDropdown(false)} 
                      />
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-surface-container-high rounded-xl shadow-lg z-20 py-1.5 max-h-48 overflow-y-auto animate-fade-in flex flex-col">
                        {packages.map((pkg) => {
                          const isChecked = menuForm.package_ids.includes(pkg.id);
                          return (
                            <label
                              key={pkg.id}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low cursor-pointer transition-colors text-sm font-bold text-on-surface"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const nextIds = isChecked
                                    ? menuForm.package_ids.filter((id) => id !== pkg.id)
                                    : [...menuForm.package_ids, pkg.id];
                                  setMenuForm({ ...menuForm, package_ids: nextIds });
                                }}
                                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                              />
                              <span>{pkg.name} ({pkg.price}.-)</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 3: Status & Image */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-1.5">สถานะบริการครัว <span className="text-primary">*</span></label>
                  <select 
                    value={menuForm.is_available ? 'true' : 'false'} 
                    onChange={(e) => setMenuForm({...menuForm, is_available: e.target.value === 'true'})}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold"
                  >
                    <option value="true">พร้อมเสิร์ฟ (Available)</option>
                    <option value="false">หมดชั่วคราว (Out of stock)</option>
                  </select>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">ออเดอร์จะถูกล็อกทันทีถ้าสถานะเป็นหมดชั่วคราว</p>
                </div>
                
                {/* Image Upload Area */}
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-1.5">รูปภาพประกอบรายการ</label>
                  
                  <div className="flex flex-col gap-3">
                    {menuForm.images.length === 0 && !menuForm.image_url ? (
                      <label 
                        htmlFor="menu-image-upload" 
                        className={`w-full h-32 rounded-xl border-2 border-dashed border-[#e4beba]/60 bg-surface-container-low hover:bg-surface-container/50 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer p-4 text-center ${uploadingImage ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
                            <span className="text-sm font-bold text-primary">กำลังอัปโหลด...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-[18px]">image</span>
                            </div>
                            <div>
                              <span className="text-sm font-extrabold text-on-surface">เลือกรูปภาพประกอบ</span>
                              <p className="text-xs text-on-surface-variant font-medium mt-0.5">คลิกเพื่ออัปโหลดจากคอม/มือถือ</p>
                            </div>
                          </>
                        )}
                      </label>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {(menuForm.images.length > 0 ? menuForm.images : [{ image_url: menuForm.image_url, sort_order: 1, is_primary: true }]).map((image, imageIndex) => (
                          <div key={`${image.image_url}-${imageIndex}`} className="relative aspect-square overflow-hidden rounded-2xl border border-[#e4beba]/70 bg-surface-container-low">
                            <img src={image.image_url} alt={`รูปเมนู ${imageIndex + 1}`} className="h-full w-full object-cover" />
                            {imageIndex === 0 && (
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-[#fdc003] px-2 py-0.5 text-[9px] font-black text-[#410003] shadow-sm">
                                หลัก
                              </span>
                            )}
                            <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1">
                              {imageIndex > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPrimaryMenuImage(imageIndex)}
                                  className="h-7 flex-1 rounded-full bg-white/90 text-[10px] font-black text-primary shadow-sm"
                                >
                                  ตั้งหลัก
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeMenuImage(imageIndex)}
                                className="h-7 w-7 rounded-full bg-primary text-white shadow-sm"
                                aria-label="ลบรูป"
                              >
                                <span className="material-symbols-outlined text-[15px]">close</span>
                              </button>
                            </div>
                          </div>
                        ))}
                        <label
                          htmlFor="menu-image-upload"
                          className={`aspect-square rounded-2xl border-2 border-dashed border-[#e4beba]/70 bg-[#fffdfa] flex flex-col items-center justify-center gap-1 text-center text-primary cursor-pointer ${uploadingImage ? 'pointer-events-none opacity-50' : ''}`}
                        >
                          <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
                          <span className="text-[10px] font-black">เพิ่มรูป</span>
                        </label>
                      </div>
                    )}
                    <input 
                      type="file" 
                      id="menu-image-upload" 
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(e, 'menu')}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <p className="text-[11px] font-bold text-on-surface-variant">รูปแรกคือรูปหลักที่แสดงหน้าเมนู</p>
                  </div>
                </div>
              </div>

              {/* Menu Variants */}
              <div className="rounded-[22px] border border-[#e4beba]/60 bg-[#fffdfa] p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-black text-on-surface">ไซส์และจำนวนต่อครั้ง</h4>
                    <p className="mt-1 text-sm font-bold leading-6 text-on-surface-variant">
                      เช่น คอนโด 1-10, จานใหญ่ 1-3
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-black text-white shadow-[0_8px_18px_rgba(175,16,26,0.18)] active:scale-95"
                  >
                    + เพิ่มไซส์
                  </button>
                </div>

                {menuForm.variants.length === 0 ? (
                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#e4beba]/70 bg-white px-4 py-5 text-sm font-black text-primary"
                  >
                    <span className="material-symbols-outlined text-[20px]">straighten</span>
                    เพิ่มไซส์ เช่น คอนโด / จานใหญ่
                  </button>
                ) : (
                  <div className="space-y-2">
                    {menuForm.variants.map((variant, variantIndex) => (
                      <div key={variantIndex} className="grid grid-cols-[1fr_74px_74px_40px] items-end gap-2 rounded-2xl border border-surface-container-high bg-white p-3">
                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-black text-on-surface-variant">ชื่อไซส์</span>
                          <input
                            value={variant.name}
                            onChange={(e) => updateVariant(variantIndex, { name: e.target.value })}
                            placeholder={variantIndex === 0 ? 'คอนโด' : 'จานใหญ่'}
                            className="w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-base font-bold text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs font-black text-on-surface-variant">ต่ำสุด</span>
                          <input
                            type="number"
                            min={0}
                            value={variant.min_quantity}
                            onChange={(e) => {
                              const nextMin = Math.max(0, Number(e.target.value || 0));
                              updateVariant(variantIndex, {
                                min_quantity: nextMin,
                                max_quantity: Math.max(variant.max_quantity, nextMin),
                              });
                            }}
                            className="w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-center text-base font-black text-on-surface focus:border-primary focus:outline-none"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs font-black text-on-surface-variant">สูงสุด</span>
                          <input
                            type="number"
                            min={variant.min_quantity}
                            value={variant.max_quantity}
                            onChange={(e) => updateVariant(variantIndex, { max_quantity: Math.max(Number(e.target.value || 0), variant.min_quantity) })}
                            className="w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-center text-base font-black text-on-surface focus:border-primary focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeVariant(variantIndex)}
                          className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-primary"
                          aria-label="ลบไซส์"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Menu Options */}
              <div className="rounded-[22px] border border-[#e4beba]/60 bg-[#fffdfa] p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-black text-on-surface">ตัวเลือกเพิ่มเติมของเมนู</h4>
                    <p className="mt-1 text-sm font-bold leading-6 text-on-surface-variant">
                      ใช้กับเมนูที่ต้องบังคับเลือก เช่น ไข่มุก ระดับความหวาน น้ำซุป หรือท็อปปิ้ง
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addOptionGroup}
                    className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-black text-white shadow-[0_8px_18px_rgba(175,16,26,0.18)] active:scale-95"
                  >
                    + เพิ่มกลุ่ม
                  </button>
                </div>

                {menuForm.option_groups.length === 0 ? (
                  <button
                    type="button"
                    onClick={addOptionGroup}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#e4beba]/70 bg-white px-4 py-5 text-sm font-black text-primary"
                  >
                    <span className="material-symbols-outlined text-[20px]">tune</span>
                    เพิ่มตัวเลือก เช่น ใส่ไข่มุก / ไม่ใส่ไข่มุก
                  </button>
                ) : (
                  <div className="space-y-3">
                    {menuForm.option_groups.map((group, groupIndex) => (
                      <div key={groupIndex} className="rounded-2xl border border-surface-container-high bg-white p-3">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 grow">
                            <label className="mb-1.5 block text-sm font-black text-on-surface-variant">ชื่อกลุ่มตัวเลือก</label>
                            <input
                              value={group.name}
                              onChange={(e) => updateOptionGroup(groupIndex, { name: e.target.value })}
                              placeholder="เช่น ไข่มุก, ระดับความหวาน"
                              className="w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-base font-bold text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOptionGroup(groupIndex)}
                            className="mt-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-primary"
                            aria-label="ลบกลุ่มตัวเลือก"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>

                        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <label className="rounded-xl border border-surface-container-high bg-surface-container-low p-3">
                            <span className="mb-1 block text-sm font-black text-on-surface-variant">รูปแบบ</span>
                            <select
                              value={group.selection_type}
                              onChange={(e) => {
                                const nextType = e.target.value as 'single' | 'multiple';
                                updateOptionGroup(groupIndex, {
                                  selection_type: nextType,
                                  min_select: group.is_required ? 1 : 0,
                                  max_select: nextType === 'single' ? 1 : Math.max(group.max_select, 2),
                                });
                              }}
                              className="w-full bg-transparent text-base font-black text-on-surface outline-none"
                            >
                              <option value="single">เลือกได้ 1 อย่าง</option>
                              <option value="multiple">เลือกได้หลายอย่าง</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-2 rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-sm font-black text-on-surface">
                            <input
                              type="checkbox"
                              checked={group.is_required}
                              onChange={(e) => updateOptionGroup(groupIndex, {
                                is_required: e.target.checked,
                                min_select: e.target.checked ? Math.max(1, group.min_select) : 0,
                              })}
                              className="h-4 w-4 rounded text-primary focus:ring-primary"
                            />
                            บังคับเลือก
                          </label>
                          {group.selection_type === 'multiple' && (
                            <label className="rounded-xl border border-surface-container-high bg-surface-container-low p-3">
                              <span className="mb-1 block text-sm font-black text-on-surface-variant">เลือกได้สูงสุด</span>
                              <input
                                type="number"
                                min={group.is_required ? 1 : 0}
                                value={group.max_select}
                                onChange={(e) => updateOptionGroup(groupIndex, { max_select: Math.max(Number(e.target.value || 0), group.is_required ? 1 : 0) })}
                                className="w-full bg-transparent text-base font-black text-on-surface outline-none"
                              />
                            </label>
                          )}
                        </div>

                        <div className="space-y-2">
                          {group.choices.map((choice, choiceIndex) => (
                            <div key={choiceIndex} className="flex items-center gap-2">
                              <input
                                value={choice.name}
                                onChange={(e) => updateOptionChoice(groupIndex, choiceIndex, { name: e.target.value })}
                                placeholder={choiceIndex === 0 ? 'ใส่ไข่มุก' : choiceIndex === 1 ? 'ไม่ใส่ไข่มุก' : 'ชื่อตัวเลือก'}
                                className="min-w-0 grow rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-base font-bold text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button
                                type="button"
                                onClick={() => removeOptionChoice(groupIndex, choiceIndex)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-primary"
                                aria-label="ลบตัวเลือก"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOptionChoice(groupIndex)}
                            className="w-full rounded-xl border border-dashed border-[#e4beba] py-3 text-sm font-black text-primary"
                          >
                            + เพิ่มตัวเลือกในกลุ่มนี้
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 border-t border-surface-container-high pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowMenuModal(false)}
                  className="grow py-3.5 bg-surface-container text-on-surface font-bold rounded-xl text-sm hover:bg-surface-container-high transition-colors border border-surface-container-high cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="grow py-3.5 bg-[#af101a] text-white font-bold rounded-xl text-sm hover:bg-[#800c13] transition-colors squishy-button flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] max-w-xl w-full border-t-8 border-[#fdc003] shadow-2xl overflow-hidden animate-scale-in flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#af101a] to-[#800c13] text-white p-5 sm:p-6 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/30 shrink-0">
                  <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl md:text-2xl tracking-tight">
                    {catForm.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/75 font-semibold mt-0.5">ตี๋อ้วน สุกี้ชาบู • ระบบบริหารจัดการอาหาร</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCatModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border-none outline-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCat} className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto max-h-[82vh] sm:max-h-[75vh] text-base [&_label]:!text-sm [&_input]:min-h-12 [&_input]:!text-base [&_button]:!text-sm">
              <div>
                <label className="text-sm font-black text-on-surface-variant block mb-2">ชื่อหมวดหมู่ <span className="text-primary">*</span></label>
                <input 
                  type="text" 
                  value={catForm.name} 
                  onChange={(e) => setCatForm({...catForm, name: e.target.value})} 
                  required
                  placeholder="เช่น เมนูหมูสดสไลด์"
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3.5 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                />
              </div>

              <div>
                <label className="text-sm font-black text-on-surface-variant block mb-2">คำอธิบาย</label>
                <input 
                  type="text" 
                  value={catForm.description} 
                  onChange={(e) => setCatForm({...catForm, description: e.target.value})} 
                  placeholder="เช่น คัดสรรเฉพาะสันคอและสามชั้นเกรดดี"
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3.5 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-2">ลำดับการจัดเรียง <span className="text-primary">*</span></label>
                  <input 
                    type="number" 
                    value={catForm.sort_order} 
                    onChange={(e) => setCatForm({...catForm, sort_order: parseInt(e.target.value) || 0})} 
                    required
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3.5 text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold"
                  />
                </div>
                
                {/* Upload Image for Category */}
                <div>
                  <label className="text-sm font-black text-on-surface-variant block mb-2">รูปภาพหมวดหมู่</label>
                  <div className="flex flex-col gap-2">
                    {catForm.image_url ? (
                      <div className="relative w-full h-16 rounded-xl overflow-hidden border border-surface-container-high bg-surface-container-low group">
                        <img 
                          src={catForm.image_url} 
                          alt="Category preview" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label 
                            htmlFor="cat-image-upload" 
                            className="px-3 py-1.5 bg-white text-on-surface text-xs font-extrabold rounded-lg cursor-pointer hover:bg-neutral-100 transition-all flex items-center gap-1 animate-fade-in"
                          >
                            <span className="material-symbols-outlined text-sm">upload</span>
                            เปลี่ยน
                          </label>
                          <button
                            type="button"
                            onClick={() => setCatForm(prev => ({ ...prev, image_url: '' }))}
                            className="px-3 py-1.5 bg-primary text-on-primary text-xs font-extrabold rounded-lg cursor-pointer hover:opacity-90 transition-all flex items-center gap-1 border-none outline-none"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            ลบ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label 
                        htmlFor="cat-image-upload" 
                        className={`w-full h-16 rounded-xl border border-dashed border-[#e4beba]/60 bg-surface-container-low hover:bg-surface-container/50 hover:border-primary/50 transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${uploadingImage ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {uploadingImage ? (
                          <div className="w-4 h-4 rounded-full border border-primary/20 border-t-primary animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xl text-primary">image</span>
                            <span className="text-sm font-extrabold text-on-surface">อัปโหลดรูปภาพ</span>
                          </>
                        )}
                      </label>
                    )}
                    <input 
                      type="file" 
                      id="cat-image-upload" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'cat')}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 border-t border-surface-container-high pt-5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="grow py-3.5 bg-surface-container text-on-surface font-bold rounded-xl text-sm hover:bg-surface-container-high transition-colors border border-surface-container-high cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="grow py-3.5 bg-[#af101a] text-white font-bold rounded-xl text-sm hover:bg-[#800c13] transition-colors squishy-button flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  บันทึกหมวดหมู่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-t-[28px] border-t-8 border-[#fdc003] bg-white shadow-2xl animate-scale-in sm:rounded-[28px]">
            <div className="bg-gradient-to-r from-[#af101a] to-[#800c13] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-[#fdc003] ring-1 ring-white/20">
                    <span className="material-symbols-outlined text-[26px]">table_restaurant</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black tracking-tight">เพิ่มโต๊ะใหม่</h3>
                    <p className="mt-0.5 text-xs font-bold text-white/75">เพิ่มเลขโต๊ะสำหรับหน้าแคชเชียร์</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  aria-label="ปิดหน้าต่างเพิ่มโต๊ะ"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-5 p-5 sm:p-6">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-on-surface-variant">เลขโต๊ะ</span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  autoFocus
                  value={tableForm.table_number}
                  onChange={(e) => setTableForm({ table_number: e.target.value })}
                  placeholder={`เช่น ${nextTableNumber}`}
                  required
                  className={`h-16 w-full rounded-2xl border bg-[#fffdfa] px-5 text-center text-4xl font-black outline-none transition-all ${
                    tableNumberDuplicate
                      ? 'border-primary text-primary ring-2 ring-primary/15'
                      : 'border-[#e4beba] text-[#410003] focus:border-primary focus:ring-2 focus:ring-primary/15'
                  }`}
                />
                {tableNumberDuplicate ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-black text-primary">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    โต๊ะเลขนี้มีอยู่แล้ว
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-bold text-[#7b5b54]">เลขถัดไปที่แนะนำคือ {nextTableNumber}</p>
                )}
              </label>

              <div className="rounded-2xl border border-[#e4beba]/70 bg-[#fff7e0] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-[#785900]">เลขโต๊ะที่มีแล้ว</span>
                  <button
                    type="button"
                    onClick={resetTableForm}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-primary shadow-sm"
                  >
                    ใช้เลขถัดไป
                  </button>
                </div>
                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {activeTables.length > 0 ? activeTables.map(table => (
                    <span
                      key={table.id}
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${
                        Number(table.table_number) === tableNumberValue
                          ? 'bg-primary text-white'
                          : 'bg-white text-[#7b5b54]'
                      }`}
                    >
                      {String(table.table_number).padStart(2, '0')}
                    </span>
                  )) : (
                    <span className="text-xs font-bold text-[#7b5b54]">ยังไม่มีโต๊ะในระบบ</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 border-t border-surface-container-high pt-4">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="h-14 grow rounded-xl border border-surface-container-high bg-surface-container px-4 py-3.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={tableNumberDuplicate || !tableForm.table_number}
                  className="h-14 grow rounded-xl bg-[#af101a] px-4 py-3.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(175,16,26,0.24)] transition-transform active:scale-95 disabled:bg-neutral-300 disabled:shadow-none"
                >
                  บันทึกโต๊ะ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      {activeTab === 'menu' && (
        <button
          onClick={() => { resetMenuForm(); setShowMenuModal(true); }}
          className="fixed bottom-24 lg:fixed lg:bottom-10 right-6 lg:right-10 w-14 h-14 bg-[#af101a] text-white rounded-full shadow-[0_8px_24px_rgba(175,16,26,0.35)] hover:shadow-[0_12px_32px_rgba(175,16,26,0.45)] hover:-translate-y-1 hover:bg-[#800c13] active:scale-90 transition-all duration-200 flex items-center justify-center z-45 group cursor-pointer border-none outline-none"
          title="เพิ่มเมนูอาหาร"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300">add</span>
        </button>
      )}

      {activeTab === 'categories' && (
        <button
          onClick={() => { resetCatForm(); setShowCatModal(true); }}
          className="fixed bottom-24 lg:fixed lg:bottom-10 right-6 lg:right-10 w-14 h-14 bg-[#fdc003] text-on-secondary-container rounded-full shadow-[0_8px_24px_rgba(253,192,3,0.35)] hover:shadow-[0_12px_32px_rgba(253,192,3,0.45)] hover:-translate-y-1 hover:bg-[#fabd00] active:scale-90 transition-all duration-200 flex items-center justify-center z-45 group cursor-pointer border-none outline-none"
          title="เพิ่มหมวดหมู่"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300 text-on-secondary-container">add</span>
        </button>
      )}

      {activeTab === 'tables' && (
        <button
          onClick={openAddTableModal}
          className="fixed bottom-24 lg:fixed lg:bottom-10 right-6 lg:right-10 w-14 h-14 bg-[#af101a] text-white rounded-full shadow-[0_8px_24px_rgba(175,16,26,0.35)] hover:shadow-[0_12px_32px_rgba(175,16,26,0.45)] hover:-translate-y-1 hover:bg-[#800c13] active:scale-90 transition-all duration-200 flex items-center justify-center z-45 group cursor-pointer border-none outline-none"
          title="เพิ่มโต๊ะ"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300">add</span>
        </button>
      )}

      {/* Mobile Bottom Nav */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 min-h-16 bg-gradient-to-r from-[#af101a] to-[#800c13] border-t border-[#800c13] text-white flex justify-around items-center z-40 px-2 shadow-2xl"
        style={{
          height: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Link
          href="/cashier"
          className="flex flex-col items-center justify-center gap-0.5 text-white/70 hover:text-white transition-colors flex-1 py-1"
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] font-extrabold">แคชเชียร์</span>
        </Link>

        <Link
          href="/admin"
          className="flex flex-col items-center justify-center gap-0.5 text-[#fdc003] transition-colors flex-1 py-1"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-extrabold">หลังบ้าน/ครัว</span>
        </Link>

        <button
          onClick={async () => {
            if (confirm('ยืนยันออกจากระบบ?')) {
              await logoutStaff();
              router.push('/login');
            }
          }}
          className="flex flex-col items-center justify-center gap-0.5 text-white/70 hover:text-white transition-colors flex-1 py-1 bg-transparent border-none outline-none cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-extrabold">ออกจากระบบ</span>
        </button>
      </nav>
    </div>
  );
}
