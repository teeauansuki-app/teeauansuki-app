'use server';

import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createSign } from 'node:crypto';

// ==========================================
// MOCK DATA STORAGE FOR PREVIEW MODE (When Supabase is not configured yet)
// ==========================================

let mockTables = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  table_number: i + 1,
  status: i === 2 || i === 7 ? 'occupied' : 'vacant',
  is_active: true,
  created_at: new Date().toISOString(),
  sessions: i === 2 ? [{
    id: 'mock-session-3',
    table_id: 3,
    package_id: 'standard',
    status: 'active',
    opened_at: new Date(Date.now() - 30 * 60000).toISOString()
  }] : i === 7 ? [{
    id: 'mock-session-8',
    table_id: 8,
    package_id: 'premium',
    status: 'active',
    opened_at: new Date(Date.now() - 15 * 60000).toISOString()
  }] : []
}));

let mockPackages = [
  { id: 'standard', name: 'Standard', price: 308.00, description: 'หมูสด ผักสด ซุปใสต้มยำ' },
  { id: 'premium', name: 'Premium', price: 398.00, description: 'Standard + เนื้อวากิว ซีฟู้ด ซุปทรัฟเฟิล' }
];

let mockCategories = [
  { id: 1, name: 'Shabu Sets', description: 'ชุดชาบูเริ่มต้น', sort_order: 1 },
  { id: 2, name: 'Meats', description: 'เนื้อสัตว์สไลด์เกรดพรีเมียม', sort_order: 2 },
  { id: 3, name: 'Seafood', description: 'อาหารทะเลสดใหม่', sort_order: 3 },
  { id: 4, name: 'Vegetables & Sides', description: 'ผักสดและเครื่องเคียง', sort_order: 4 },
  { id: 5, name: 'Drinks', description: 'เครื่องดื่มรีฟิลดับกระหาย', sort_order: 5 }
];

let mockMenuItems: any[] = [
  { id: 1, category_id: 1, name: 'Standard Pork Set', description: 'ชุดหมูสไลด์รวม ผักสด และน้ำซุปมาตรฐาน', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' },
  { id: 2, category_id: 1, name: 'Premium Beef Set', description: 'ชุดเนื้อวัวพรีเมียม วากิว ซีฟู้ด และน้ำซุปเลือกได้ทุกรสชาติ', price: 0, package_ids: ['premium'], is_available: true, image_url: '' },
  { id: 3, category_id: 2, name: 'Pork Belly', description: 'หมูสามชั้นสไลด์บางพอดีคำ รสชาตินุ่มละมุน', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' },
  { id: 4, category_id: 2, name: 'Sliced Chicken', description: 'เนื้ออกไก่สไลด์ นุ่ม ไขมันต่ำ', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' },
  { id: 5, category_id: 2, name: 'Prime Ribeye', description: 'เนื้อริบอายพรีเมียมคัต ลายสวยนุ่มหอมกลิ่นเนื้อวัว', price: 0, package_ids: ['premium'], is_available: true, image_url: '' },
  { id: 6, category_id: 2, name: 'A5 Wagyu Beef', description: 'เนื้อวากิวระดับ A5 ลายหินอ่อนละลายในปาก', price: 0, package_ids: ['premium'], is_available: true, image_url: '' },
  { id: 7, category_id: 3, name: 'Fresh Prawns', description: 'กุ้งสดแกะเปลือก เนื้อเด้งหวาน', price: 0, package_ids: ['premium'], is_available: true, image_url: '' },
  { id: 8, category_id: 3, name: 'Green Mussels', description: 'หอยแมลงภู่นิวซีแลนด์ตัวใหญ่ เนื้อแน่น', price: 0, package_ids: ['premium'], is_available: true, image_url: '' },
  { id: 9, category_id: 4, name: 'Assorted Veggies Basket', description: 'ชุดผักรวมมิตร ผักกาดขาว, ผักบุ้ง, แครอท, ข้าวโพดหวาน, เห็ดเข็มทอง', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' },
  { id: 10, category_id: 4, name: 'Signature Broth', description: 'น้ำซุปสูตรสมุนไพรสีทอง หอมกลิ่นกระดูกต้ม', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' },
  { id: 11, category_id: 4, name: 'Truffle Broth', description: 'ซุปทรัฟเฟิลเข้มข้น กลิ่นหอมเป็นเอกลักษณ์ระดับพรีเมียม', price: 0, package_ids: ['premium'], is_available: true, image_url: '' },
  { id: 12, category_id: 4, name: 'Egg Noodles', description: 'บะหมี่หยกเกรดดี เส้นเหนียวนุ่ม', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' },
  { id: 13, category_id: 5, name: 'Green Tea (Refill)', description: 'ชาเขียวเย็นหอมชื่นใจ ไม่หวาน', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '', option_groups: [
    {
      id: 1,
      name: 'ไข่มุก',
      selection_type: 'single',
      is_required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      choices: [
        { id: 1, name: 'ใส่ไข่มุก', price_delta: 0, sort_order: 1 },
        { id: 2, name: 'ไม่ใส่ไข่มุก', price_delta: 0, sort_order: 2 },
      ],
    },
  ] },
  { id: 14, category_id: 5, name: 'Soft Drink (Refill)', description: 'น้ำอัดลมรีฟิล เลือกได้ (โค้ก/สไปรท์/แฟนต้า)', price: 0, package_ids: ['standard', 'premium'], is_available: true, image_url: '' }
];

let mockOrders: any[] = [
  {
    id: 1001,
    session_id: 'mock-session-3',
    status: 'pending',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    sessions: {
      tables: { table_number: 3 },
      packages: { name: 'Standard', id: 'standard' }
    },
    order_items: [
      { id: 1, menu_item_id: 3, quantity: 2, notes: 'ขอผักเยอะๆ', menu_items: { name: 'Pork Belly' } },
      { id: 2, menu_item_id: 9, quantity: 1, notes: '', menu_items: { name: 'Assorted Veggies Basket' } }
    ]
  }
];

let mockPrintJobs: any[] = [
  {
    id: 201,
    order_id: 1001,
    status: 'pending',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    orders: {
      id: 1001,
      sessions: {
        tables: { table_number: 3 },
        packages: { name: 'Standard' }
      },
      order_items: [
        { id: 1, menu_item_id: 3, quantity: 2, notes: 'ขอผักเยอะๆ', menu_items: { name: 'Pork Belly' } },
        { id: 2, menu_item_id: 9, quantity: 1, notes: '', menu_items: { name: 'Assorted Veggies Basket' } }
      ]
    }
  }
];

let mockStaffCalls: any[] = [];
let mockPosDevices: any[] = [];

function sortMenuItemsByCategory(items: any[], categories: any[]) {
  const categoryOrder = new Map(
    categories.map((category, index) => [
      category.id,
      Number.isFinite(category.sort_order) ? category.sort_order : index + 1,
    ])
  );

  return [...items].sort((a, b) => {
    const categoryA = categoryOrder.get(a.category_id) ?? Number.MAX_SAFE_INTEGER;
    const categoryB = categoryOrder.get(b.category_id) ?? Number.MAX_SAFE_INTEGER;

    if (categoryA !== categoryB) {
      return categoryA - categoryB;
    }

    return String(a.name || '').localeCompare(String(b.name || ''), 'th');
  });
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getFirebaseAccessToken() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(unsignedJwt).sign(privateKey);
  const jwt = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Firebase token request failed: ${details}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function sendFcmNotification(token: string, title: string, body: string, data: Record<string, string>) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const accessToken = await getFirebaseAccessToken();

  if (!projectId || !accessToken) {
    return { sent: false, reason: 'missing_firebase_env' };
  }

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'tee_uan_staff_calls',
            sound: 'default',
            default_vibrate_timings: true,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`FCM send failed: ${details}`);
  }

  return { sent: true };
}

function normalizeOptionGroups(groups: any[] = []) {
  return [...groups]
    .map((group, groupIndex) => ({
      id: group.id,
      name: String(group.name || '').trim(),
      selection_type: group.selection_type === 'multiple' ? 'multiple' : 'single',
      is_required: Boolean(group.is_required),
      min_select: Number.isFinite(Number(group.min_select)) ? Number(group.min_select) : (group.is_required ? 1 : 0),
      max_select: Number.isFinite(Number(group.max_select)) ? Number(group.max_select) : 1,
      sort_order: Number.isFinite(Number(group.sort_order)) ? Number(group.sort_order) : groupIndex + 1,
      choices: [...(group.choices || group.menu_option_choices || [])]
        .map((choice, choiceIndex) => ({
          id: choice.id,
          name: String(choice.name || '').trim(),
          price_delta: Number(choice.price_delta || 0),
          sort_order: Number.isFinite(Number(choice.sort_order)) ? Number(choice.sort_order) : choiceIndex + 1,
        }))
        .filter(choice => choice.name.length > 0)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter(group => group.name.length > 0 && group.choices.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeMenuVariants(variants: any[] = []) {
  return [...variants]
    .map((variant, variantIndex) => {
      const minQuantity = Number.isFinite(Number(variant.min_quantity)) ? Number(variant.min_quantity) : 1;
      const maxQuantity = Number.isFinite(Number(variant.max_quantity)) ? Number(variant.max_quantity) : Math.max(minQuantity, 1);

      return {
        id: variant.id,
        menu_item_id: variant.menu_item_id,
        name: String(variant.name || '').trim(),
        min_quantity: Math.max(0, minQuantity),
        max_quantity: Math.max(Math.max(0, minQuantity), maxQuantity),
        sort_order: Number.isFinite(Number(variant.sort_order)) ? Number(variant.sort_order) : variantIndex + 1,
      };
    })
    .filter(variant => variant.name.length > 0 && variant.max_quantity > 0)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeMenuImages(images: any[] = [], fallbackImageUrl = '') {
  const normalized = [...images]
    .map((image, imageIndex) => ({
      id: image.id,
      menu_item_id: image.menu_item_id,
      image_url: String(image.image_url || image.url || '').trim(),
      sort_order: Number.isFinite(Number(image.sort_order)) ? Number(image.sort_order) : imageIndex + 1,
      is_primary: Boolean(image.is_primary || imageIndex === 0),
    }))
    .filter(image => image.image_url.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image, imageIndex) => ({
      ...image,
      sort_order: imageIndex + 1,
      is_primary: imageIndex === 0,
    }));

  if (normalized.length === 0 && fallbackImageUrl) {
    return [{
      image_url: fallbackImageUrl,
      sort_order: 1,
      is_primary: true,
    }];
  }

  return normalized;
}

function formatSelectedOptions(options: any[] = []) {
  return options
    .map(option => ({
      group_id: option.group_id,
      group_name: String(option.group_name || '').trim(),
      choice_ids: Array.isArray(option.choice_ids) ? option.choice_ids : [],
      choice_names: Array.isArray(option.choice_names) ? option.choice_names.map((name: any) => String(name || '').trim()).filter(Boolean) : [],
    }))
    .filter(option => option.group_name && option.choice_names.length > 0);
}

function formatSelectedVariant(variant: any) {
  if (!variant) return null;
  const name = String(variant.variant_name || variant.name || '').trim();
  const id = Number(variant.variant_id || variant.id || 0);

  if (!name && !id) return null;

  return {
    variant_id: id || null,
    variant_name: name,
  };
}

function validateSelectedOptions(menuItem: any, selectedOptions: any[] = []) {
  const groups = normalizeOptionGroups(menuItem?.option_groups || menuItem?.menu_option_groups || []);
  const selectedByGroup = new Map(formatSelectedOptions(selectedOptions).map(option => [option.group_id, option]));

  for (const group of groups) {
    const selected = selectedByGroup.get(group.id);
    const selectedCount = selected?.choice_ids?.length || selected?.choice_names?.length || 0;
    const minSelect = group.is_required ? Math.max(1, group.min_select || 1) : group.min_select || 0;
    const maxSelect = group.selection_type === 'single' ? 1 : Math.max(group.max_select || group.choices.length, minSelect);

    if (selectedCount < minSelect) {
      throw new Error(`กรุณาเลือกตัวเลือก "${group.name}"`);
    }

    if (selectedCount > maxSelect) {
      throw new Error(`ตัวเลือก "${group.name}" เลือกได้สูงสุด ${maxSelect} รายการ`);
    }
  }
}

function validateSelectedVariant(menuItem: any, selectedVariant: any, quantity: number) {
  const variants = normalizeMenuVariants(menuItem?.variants || menuItem?.menu_item_variants || []);

  if (variants.length === 0) {
    return null;
  }

  const normalizedVariant = formatSelectedVariant(selectedVariant);
  const variant = normalizedVariant?.variant_id
    ? variants.find(itemVariant => itemVariant.id === normalizedVariant.variant_id)
    : variants.find(itemVariant => itemVariant.name === normalizedVariant?.variant_name);

  if (!variant) {
    throw new Error(`กรุณาเลือกขนาดของ "${menuItem?.name || 'เมนูนี้'}"`);
  }

  if (quantity < variant.min_quantity || quantity > variant.max_quantity) {
    throw new Error(`"${menuItem?.name || 'เมนูนี้'}" แบบ${variant.name} เลือกได้ ${variant.min_quantity}-${variant.max_quantity} รายการ`);
  }

  return {
    variant_id: variant.id,
    variant_name: variant.name,
  };
}

type OfflineSessionContext = {
  tableNumber?: string | string[];
  packageId?: string | string[];
  offline?: string | string[];
};

function firstSearchValue(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOfflineSessionContext(context?: OfflineSessionContext) {
  if (firstSearchValue(context?.offline) !== '1') return null;

  const tableNumber = Number.parseInt(firstSearchValue(context?.tableNumber) || '', 10);
  const packageId = firstSearchValue(context?.packageId);

  if (!Number.isInteger(tableNumber) || tableNumber <= 0 || tableNumber > 999) return null;
  if (packageId !== 'standard' && packageId !== 'premium') return null;

  return { tableNumber, packageId };
}

async function ensureOfflineSession(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  sessionId: string,
  context?: OfflineSessionContext
) {
  const offlineContext = normalizeOfflineSessionContext(context);
  if (!offlineContext || !isValidUuid(sessionId)) return null;

  const { data: existingSession, error: existingSessionError } = await supabase
    .from('sessions')
    .select('*, tables(table_number), packages(name)')
    .eq('id', sessionId)
    .maybeSingle();

  if (existingSessionError) {
    throw new Error(`Failed to check offline session: ${existingSessionError.message}`);
  }

  if (existingSession) {
    return existingSession.status === 'active' ? existingSession : null;
  }

  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('id, table_number')
    .eq('table_number', offlineContext.tableNumber)
    .eq('is_active', true)
    .maybeSingle();

  if (tableError) {
    throw new Error(`Failed to find offline table: ${tableError.message}`);
  }

  if (!table) return null;

  await supabase
    .from('sessions')
    .update({ status: 'completed', closed_at: new Date().toISOString() })
    .eq('table_id', table.id)
    .eq('status', 'active');

  const { error: updateTableError } = await supabase
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', table.id);

  if (updateTableError) {
    throw new Error(`Failed to occupy offline table: ${updateTableError.message}`);
  }

  const { data: createdSession, error: createSessionError } = await supabase
    .from('sessions')
    .insert({
      id: sessionId,
      table_id: table.id,
      package_id: offlineContext.packageId,
      status: 'active',
    })
    .select('*, tables(table_number), packages(name)')
    .single();

  if (createSessionError || !createdSession) {
    await supabase.from('tables').update({ status: 'vacant' }).eq('id', table.id);
    throw new Error(`Failed to create offline session: ${createSessionError?.message}`);
  }

  revalidatePath('/cashier');
  return createdSession;
}

async function attachOptionGroupsToMenuItems(supabase: any, items: any[] = []) {
  if (items.length === 0) return [];

  const itemIds = items.map(item => item.id).filter(Boolean);
  if (itemIds.length === 0) {
    return items.map(item => ({ ...item, option_groups: [], variants: [], images: normalizeMenuImages([], item.image_url || '') }));
  }

  const { data: groups, error: groupsError } = await supabase
    .from('menu_option_groups')
    .select('*')
    .in('menu_item_id', itemIds)
    .order('sort_order', { ascending: true });

  if (groupsError) {
    throw new Error(`Failed to fetch menu option groups: ${groupsError.message}`);
  }

  const groupIds = (groups || []).map((group: any) => group.id);
  const { data: choices, error: choicesError } = groupIds.length > 0
    ? await supabase
        .from('menu_option_choices')
        .select('*')
        .in('option_group_id', groupIds)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };

  if (choicesError) {
    throw new Error(`Failed to fetch menu option choices: ${choicesError.message}`);
  }

  const choicesByGroup = new Map<number, any[]>();
  for (const choice of choices || []) {
    const list = choicesByGroup.get(choice.option_group_id) || [];
    list.push(choice);
    choicesByGroup.set(choice.option_group_id, list);
  }

  const groupsByItem = new Map<number, any[]>();
  for (const group of groups || []) {
    const list = groupsByItem.get(group.menu_item_id) || [];
    list.push({
      ...group,
      choices: choicesByGroup.get(group.id) || [],
    });
    groupsByItem.set(group.menu_item_id, list);
  }

  return attachMenuVariantsAndImages(supabase, items.map(item => ({
    ...item,
    option_groups: normalizeOptionGroups(groupsByItem.get(item.id) || []),
  })));
}

async function attachMenuVariantsAndImages(supabase: any, items: any[] = []) {
  if (items.length === 0) return [];

  const itemIds = items.map(item => item.id).filter(Boolean);
  if (itemIds.length === 0) {
    return items.map(item => ({ ...item, variants: [], images: normalizeMenuImages([], item.image_url || '') }));
  }

  const { data: variants, error: variantsError } = await supabase
    .from('menu_item_variants')
    .select('*')
    .in('menu_item_id', itemIds)
    .order('sort_order', { ascending: true });

  if (variantsError) {
    const message = String(variantsError.message || '');
    if (!message.includes('menu_item_variants')) {
      throw new Error(`Failed to fetch menu variants: ${variantsError.message}`);
    }
  }

  const { data: images, error: imagesError } = await supabase
    .from('menu_item_images')
    .select('*')
    .in('menu_item_id', itemIds)
    .order('sort_order', { ascending: true });

  if (imagesError) {
    const message = String(imagesError.message || '');
    if (!message.includes('menu_item_images')) {
      throw new Error(`Failed to fetch menu images: ${imagesError.message}`);
    }
  }

  const variantsByItem = new Map<number, any[]>();
  for (const variant of variants || []) {
    const list = variantsByItem.get(variant.menu_item_id) || [];
    list.push(variant);
    variantsByItem.set(variant.menu_item_id, list);
  }

  const imagesByItem = new Map<number, any[]>();
  for (const image of images || []) {
    const list = imagesByItem.get(image.menu_item_id) || [];
    list.push(image);
    imagesByItem.set(image.menu_item_id, list);
  }

  return items.map(item => {
    const itemImages = normalizeMenuImages(imagesByItem.get(item.id) || [], item.image_url || '');
    const primaryImage = itemImages.find(image => image.is_primary) || itemImages[0];

    return {
      ...item,
      variants: normalizeMenuVariants(variantsByItem.get(item.id) || []),
      images: itemImages,
      image_url: primaryImage?.image_url || item.image_url || '',
    };
  });
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

// Cashier: Open Table Session
export async function openTableSession(tableId: number, packageId: string) {
  if (!isSupabaseConfigured) {
    const tableIndex = mockTables.findIndex(t => t.id === tableId);
    if (tableIndex === -1) throw new Error('Table not found');

    const openedAt = new Date().toISOString();
    const sessionId = `mock-session-${Date.now()}`;
    const pkg = mockPackages.find(p => p.id === packageId);

    const session = {
      id: sessionId,
      table_id: tableId,
      package_id: packageId,
      status: 'active',
      opened_at: openedAt,
    };

    mockTables[tableIndex] = {
      ...mockTables[tableIndex],
      status: 'occupied',
      sessions: [session]
    };

    revalidatePath('/cashier');
    return session;
  }

  const supabase = getSupabaseAdmin();

  // 1. Get the table info
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('id, table_number')
    .eq('id', tableId)
    .eq('is_active', true)
    .single();

  if (tableError || !table) {
    throw new Error(tableError?.message || 'Table not found');
  }

  // 2. Set table status to occupied
  const { error: updateTableError } = await supabase
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', tableId);

  if (updateTableError) {
    throw new Error(`Failed to occupy table: ${updateTableError.message}`);
  }

  // 3. Close any pre-existing active session for safety
  await supabase
    .from('sessions')
    .update({ status: 'completed', closed_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('status', 'active');

  // 4. Create new active session
  const { data: session, error: createSessionError } = await supabase
    .from('sessions')
    .insert({
      table_id: tableId,
      package_id: packageId,
      status: 'active',
    })
    .select()
    .single();

  if (createSessionError || !session) {
    // Rollback table status if session creation fails
    await supabase
      .from('tables')
      .update({ status: 'vacant' })
      .eq('id', tableId);
    throw new Error(`Failed to create session: ${createSessionError?.message}`);
  }

  revalidatePath('/cashier');
  return session;
}

// Cashier: Close Table Session
export async function closeTableSession(sessionId: string) {
  if (!isSupabaseConfigured) {
    const closedOrderIds = new Set(
      mockOrders
        .filter(order => order.session_id === sessionId)
        .map(order => order.id)
    );
    mockOrders = mockOrders.filter(order => order.session_id !== sessionId);
    mockPrintJobs = mockPrintJobs.filter(job => {
      const jobSessionId = job.orders?.session_id ?? job.orders?.sessions?.id;
      return jobSessionId !== sessionId && !closedOrderIds.has(job.order_id);
    });

    const tableIndex = mockTables.findIndex(t => t.sessions.some(s => s.id === sessionId));
    if (tableIndex !== -1) {
      mockTables[tableIndex] = {
        ...mockTables[tableIndex],
        status: 'vacant',
        sessions: []
      };
    }
    revalidatePath('/cashier');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();

  // 1. Get session info
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('table_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message || 'Session not found');
  }

  const tableId = session.table_id;

  // 2. Mark session as completed
  const { error: updateSessionError } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateSessionError) {
    throw new Error(`Failed to complete session: ${updateSessionError.message}`);
  }

  // 3. Mark table as vacant
  const { error: updateTableError } = await supabase
    .from('tables')
    .update({ status: 'vacant' })
    .eq('id', tableId);

  if (updateTableError) {
    throw new Error(`Failed to vacant table: ${updateTableError.message}`);
  }

  revalidatePath('/cashier');
  return { success: true };
}

// Customer: Load menus filtered by session package
export async function getMenuForSession(sessionId: string, offlineContext?: OfflineSessionContext) {
  if (!isSupabaseConfigured) {
    // Find active session in our mock tables
    let activeSession: any = null;
    let tableNumber = 0;

    for (const table of mockTables) {
      const found = table.sessions.find(s => s.id === sessionId && s.status === 'active');
      if (found) {
        activeSession = found;
        tableNumber = table.table_number;
        break;
      }
    }

    if (!activeSession) {
      return { error: 'โต๊ะนี้ยังไม่ได้เปิดระบบ หรือเซสชันหมดอายุแล้ว กรุณาติดต่อแคชเชียร์' };
    }

    const pkg = mockPackages.find(p => p.id === activeSession.package_id);
    const sessionWithDetails = {
      ...activeSession,
      tables: { table_number: tableNumber },
      packages: { name: pkg ? pkg.name : activeSession.package_id }
    };

    // Filter items based on package (checking if current package_id is in item's package_ids list)
    const items = mockMenuItems
      .filter(item => item.package_ids.includes(activeSession.package_id))
      .map(item => ({
        ...item,
        option_groups: normalizeOptionGroups(item.option_groups || []),
      }));

    return {
      session: sessionWithDetails,
      categories: mockCategories,
      menuItems: sortMenuItemsByCategory(items, mockCategories),
    };
  }

  const supabase = getSupabaseAdmin();

  // 1. Get session and table details
  let { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*, tables(table_number), packages(name)')
    .eq('id', sessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (sessionError) {
    throw new Error(`Failed to fetch session: ${sessionError.message}`);
  }

  if (!session) {
    session = await ensureOfflineSession(supabase, sessionId, offlineContext);
  }

  if (!session) {
    return { error: 'โต๊ะนี้ยังไม่ได้เปิดระบบ หรือเซสชันหมดอายุแล้ว กรุณาติดต่อแคชเชียร์' };
  }

  // 2. Fetch categories
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (categoriesError) {
    throw new Error(`Failed to fetch categories: ${categoriesError.message}`);
  }

  // 3. Fetch menu items
  let query = supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true);

  // Filter menu items by checking if the session's package_id is in package_ids array
  query = query.contains('package_ids', [session.package_id]);

  const { data: menuItems, error: menuItemsError } = await query;

  if (menuItemsError) {
    throw new Error(`Failed to fetch menu items: ${menuItemsError.message}`);
  }

  return {
    session,
    categories,
    menuItems: sortMenuItemsByCategory(await attachOptionGroupsToMenuItems(supabase, menuItems || []), categories || []),
  };
}

// Customer: Submit Food Order
export async function submitOrder(
  sessionId: string,
  cartItems: { menuItemId: number; quantity: number; notes?: string; selectedOptions?: any[]; selectedVariant?: any }[]
) {
  if (!isSupabaseConfigured) {
    let activeSession: any = null;
    let tableNumber = 0;

    for (const table of mockTables) {
      const found = table.sessions.find(s => s.id === sessionId && s.status === 'active');
      if (found) {
        activeSession = found;
        tableNumber = table.table_number;
        break;
      }
    }

    if (!activeSession) {
      throw new Error('เซสชันนี้ไม่มีอยู่ หรือโต๊ะนี้ถูกปิดไปแล้ว');
    }

    const orderId = 1000 + mockOrders.length + 1;
    const pkg = mockPackages.find(p => p.id === activeSession.package_id);

    const orderItems = cartItems.map((item, idx) => {
      const menuItem = mockMenuItems.find(m => m.id === item.menuItemId);
      validateSelectedOptions(menuItem, item.selectedOptions || []);
      const selectedVariant = validateSelectedVariant(menuItem, item.selectedVariant, item.quantity);
      return {
        id: idx + 1,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes || '',
        selected_options: [
          ...(selectedVariant ? [{ group_name: 'ขนาด', choice_names: [selectedVariant.variant_name], variant_id: selectedVariant.variant_id }] : []),
          ...formatSelectedOptions(item.selectedOptions || []),
        ],
        menu_items: { name: menuItem ? menuItem.name : 'Unknown Item' }
      };
    });

    const newOrder = {
      id: orderId,
      session_id: sessionId,
      status: 'pending',
      created_at: new Date().toISOString(),
      sessions: {
        tables: { table_number: tableNumber },
        packages: { name: pkg ? pkg.name : activeSession.package_id }
      },
      order_items: orderItems
    };

    mockOrders.unshift(newOrder);

    // Create a mock print job
    mockPrintJobs.push({
      id: 200 + mockPrintJobs.length + 1,
      order_id: orderId,
      status: 'pending',
      created_at: new Date().toISOString(),
      orders: newOrder
    });

    return { success: true, orderId };
  }

  const supabase = getSupabaseAdmin();

  // 1. Verify active session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('status', 'active')
    .single();

  if (sessionError || !session) {
    throw new Error('เซสชันนี้ไม่มีอยู่ หรือโต๊ะนี้ถูกปิดไปแล้ว');
  }

  if (cartItems.length === 0) {
    throw new Error('ไม่มีรายการอาหารในตะกร้า');
  }

  const menuItemIds = [...new Set(cartItems.map(item => item.menuItemId))];
  const { data: orderMenuItems, error: optionMenuError } = await supabase
    .from('menu_items')
    .select('id, name')
    .in('id', menuItemIds);

  if (optionMenuError) {
    throw new Error(`โหลดตัวเลือกเมนูไม่สำเร็จ: ${optionMenuError.message}`);
  }

  const menuItemsWithDetails = await attachOptionGroupsToMenuItems(supabase, orderMenuItems || []);
  const menuItemById = new Map(menuItemsWithDetails.map(item => [item.id, item]));
  const selectedVariantsByLine = new Map<number, any>();

  cartItems.forEach((item, index) => {
    const menuItem = menuItemById.get(item.menuItemId);
    validateSelectedOptions(menuItem, item.selectedOptions || []);
    const selectedVariant = validateSelectedVariant(menuItem, item.selectedVariant, item.quantity);
    if (selectedVariant) selectedVariantsByLine.set(index, selectedVariant);
  });

  // 2. Create Order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      session_id: sessionId,
      status: 'pending',
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(`สร้างออเดอร์ไม่สำเร็จ: ${orderError?.message}`);
  }

  // 3. Create Order Items
  const itemsToInsert = cartItems.map((item, index) => ({
    order_id: order.id,
    menu_item_id: item.menuItemId,
    quantity: item.quantity,
    notes: item.notes || '',
    selected_options: [
      ...(selectedVariantsByLine.has(index)
        ? [{
            group_name: 'ขนาด',
            choice_names: [selectedVariantsByLine.get(index).variant_name],
            variant_id: selectedVariantsByLine.get(index).variant_id,
          }]
        : []),
      ...formatSelectedOptions(item.selectedOptions || []),
    ],
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsToInsert);

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(`บันทึกรายการอาหารไม่สำเร็จ: ${itemsError.message}`);
  }

  // 4. Create Print Job
  const { error: printJobError } = await supabase
    .from('print_jobs')
    .insert({
      order_id: order.id,
      status: 'pending',
    });

  if (printJobError) {
    console.error('Failed to create print job:', printJobError.message);
  }

  return { success: true, orderId: order.id };
}

// Customer: Call staff from table
export async function callStaff(sessionId: string, requestType: 'staff' | 'soup' = 'staff') {
  if (!sessionId) {
    throw new Error('ไม่พบเซสชันโต๊ะ');
  }

  const requestMessage = requestType === 'soup' ? 'เติมน้ำซุป' : 'เรียกพนักงาน';

  if (!isSupabaseConfigured) {
    const table = mockTables.find(item => item.sessions.some(session => session.id === sessionId && session.status === 'active'));
    if (!table) {
      throw new Error('โต๊ะนี้ปิดบริการแล้ว');
    }

    const recentCall = mockStaffCalls.find(call => (
      call.session_id === sessionId
      && call.status === 'pending'
      && call.message === requestMessage
      && Date.now() - new Date(call.created_at).getTime() < 30000
    ));

    if (recentCall) {
      return { success: true, duplicate: true, pushSent: false };
    }

    mockStaffCalls.unshift({
      id: mockStaffCalls.length + 1,
      session_id: sessionId,
      table_id: table.id,
      table_number: table.table_number,
      status: 'pending',
      message: requestMessage,
      created_at: new Date().toISOString(),
      acknowledged_at: null,
    });

    revalidatePath('/admin');
    return { success: true, duplicate: false, pushSent: false };
  }

  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, table_id, status, package_id, tables(table_number), packages(name)')
    .eq('id', sessionId)
    .eq('status', 'active')
    .single();

  if (sessionError || !session) {
    throw new Error('โต๊ะนี้ปิดบริการแล้ว');
  }

  const recentThreshold = new Date(Date.now() - 30000).toISOString();
  const { data: recentCall } = await supabase
    .from('staff_calls')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .eq('message', requestMessage)
    .gte('created_at', recentThreshold)
    .maybeSingle();

  if (recentCall) {
    return { success: true, duplicate: true, pushSent: false };
  }

  const sessionRow: any = session;
  const tableNumber = Array.isArray(sessionRow.tables)
    ? sessionRow.tables[0]?.table_number
    : sessionRow.tables?.table_number;

  const { data: staffCall, error: callError } = await supabase
    .from('staff_calls')
    .insert({
      session_id: sessionRow.id,
      table_id: sessionRow.table_id,
      table_number: tableNumber,
      status: 'pending',
      message: requestMessage,
    })
    .select()
    .single();

  if (callError || !staffCall) {
    throw new Error(`บันทึกการเรียกพนักงานไม่สำเร็จ: ${callError?.message}`);
  }

  const { data: devices } = await supabase
    .from('pos_devices')
    .select('id, fcm_token')
    .eq('is_active', true);

  const packageName = Array.isArray(sessionRow.packages)
    ? sessionRow.packages[0]?.name
    : sessionRow.packages?.name;
  const title = `โต๊ะ ${tableNumber} ${requestMessage}`;
  const body = packageName ? `${packageName} - ${requestMessage}` : requestMessage;
  let pushSent = false;

  await Promise.all((devices || []).map(async (device) => {
    try {
      const result = await sendFcmNotification(String(device.fcm_token), title, body, {
        type: 'staff_call',
        staffCallId: String(staffCall.id),
        sessionId,
        tableNumber: String(tableNumber || ''),
        table_number: String(tableNumber || ''),
        requestType,
        message: requestMessage,
      });
      pushSent = pushSent || result.sent;
    } catch (err) {
      console.error('Failed to send staff call notification:', err);
    }
  }));

  revalidatePath('/admin');
  revalidatePath('/cashier');

  return { success: true, duplicate: false, pushSent };
}

export async function registerPosDevice(data: { name?: string; fcm_token?: string }) {
  const name = String(data.name || 'SUNMI V2 POS').trim();
  const fcmToken = String(data.fcm_token || '').trim();

  if (fcmToken.length < 40) {
    throw new Error('FCM token ไม่ถูกต้อง');
  }

  if (!isSupabaseConfigured) {
    const existing = mockPosDevices.find(device => device.fcm_token === fcmToken);
    if (existing) {
      existing.name = name;
      existing.is_active = true;
      existing.last_seen_at = new Date().toISOString();
    } else {
      mockPosDevices.unshift({
        id: mockPosDevices.length + 1,
        name,
        fcm_token: fcmToken,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }
    revalidatePath('/admin');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('pos_devices')
    .upsert({
      name,
      fcm_token: fcmToken,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'fcm_token' });

  if (error) {
    throw new Error(`บันทึกเครื่อง POS ไม่สำเร็จ: ${error.message}`);
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function acknowledgeStaffCall(callId: number) {
  if (!isSupabaseConfigured) {
    const call = mockStaffCalls.find(item => item.id === callId);
    if (call) {
      call.status = 'acknowledged';
      call.acknowledged_at = new Date().toISOString();
    }
    revalidatePath('/admin');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('staff_calls')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', callId);

  if (error) {
    throw new Error(`อัปเดตการเรียกพนักงานไม่สำเร็จ: ${error.message}`);
  }

  revalidatePath('/admin');
  return { success: true };
}

// Cashier & Admin Dashboard Data Fetching
export async function getTablesAndSessions() {
  if (!isSupabaseConfigured) {
    return {
      tables: mockTables,
      packages: mockPackages
    };
  }

  const supabase = getSupabaseAdmin();

  // Fetch all tables with their active session if occupied
  const { data: tablesData, error: tablesError } = await supabase
    .from('tables')
    .select('*, sessions(*)')
    .eq('is_active', true)
    .order('table_number', { ascending: true });

  if (tablesError) {
    throw new Error(`Failed to fetch tables: ${tablesError.message}`);
  }

  // Fetch all packages
  const { data: packagesData, error: packagesError } = await supabase
    .from('packages')
    .select('*')
    .order('price', { ascending: true });

  if (packagesError) {
    throw new Error(`Failed to fetch packages: ${packagesError.message}`);
  }

  return {
    tables: tablesData || [],
    packages: packagesData || [],
  };
}

// Admin: Tables CRUD
export async function manageTable(
  action: 'create' | 'delete',
  data: any
) {
  const tableNumber = Number(data.table_number);

  if (action === 'create') {
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      throw new Error('กรุณากรอกเลขโต๊ะเป็นจำนวนเต็มบวก');
    }
  }

  if (!isSupabaseConfigured) {
    if (action === 'create') {
      const existing = mockTables.find(table => table.table_number === tableNumber);
      if (existing?.is_active) {
        throw new Error(`โต๊ะ ${tableNumber} มีอยู่แล้ว`);
      }
      if (existing) {
        existing.is_active = true;
        existing.status = 'vacant';
        existing.sessions = [];
      } else {
        mockTables.push({
          id: Math.max(0, ...mockTables.map(table => table.id)) + 1,
          table_number: tableNumber,
          status: 'vacant',
          is_active: true,
          created_at: new Date().toISOString(),
          sessions: [],
        });
      }
    } else if (action === 'delete') {
      const tableId = Number(data.id);
      const table = mockTables.find(item => item.id === tableId);
      if (!table) throw new Error('ไม่พบโต๊ะนี้');
      if (table.status === 'occupied' || table.sessions.some((session: any) => session.status === 'active')) {
        throw new Error('ไม่สามารถลบโต๊ะที่กำลังเปิดบริการอยู่ได้');
      }
      table.is_active = false;
      table.status = 'vacant';
      table.sessions = [];
    }
    revalidatePath('/admin');
    revalidatePath('/cashier');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();

  if (action === 'create') {
    const { data: existingTable, error: existingError } = await supabase
      .from('tables')
      .select('id, table_number, status, is_active')
      .eq('table_number', tableNumber)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingTable?.is_active) {
      throw new Error(`โต๊ะ ${tableNumber} มีอยู่แล้ว`);
    }

    const { error } = existingTable
      ? await supabase
          .from('tables')
          .update({ is_active: true, status: 'vacant' })
          .eq('id', existingTable.id)
      : await supabase
          .from('tables')
          .insert({ table_number: tableNumber, status: 'vacant', is_active: true });

    if (error) {
      throw new Error(error.message);
    }
  } else if (action === 'delete') {
    const tableId = Number(data.id);
    if (!Number.isInteger(tableId) || tableId <= 0) {
      throw new Error('ไม่พบโต๊ะนี้');
    }

    const { data: activeSessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('table_id', tableId)
      .eq('status', 'active')
      .limit(1);

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if ((activeSessions || []).length > 0) {
      throw new Error('ไม่สามารถลบโต๊ะที่กำลังเปิดบริการอยู่ได้');
    }

    const { error } = await supabase
      .from('tables')
      .update({ is_active: false, status: 'vacant' })
      .eq('id', tableId);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath('/admin');
  revalidatePath('/cashier');
  return { success: true };
}

// Admin: Categories CRUD
export async function manageCategory(
  action: 'create' | 'update' | 'delete',
  data: any
) {
  if (!isSupabaseConfigured) {
    if (action === 'create') {
      mockCategories.push({
        id: mockCategories.length + 1,
        name: data.name,
        description: data.description || '',
        sort_order: data.sort_order || 0
      });
    } else if (action === 'update') {
      const idx = mockCategories.findIndex(c => c.id === data.id);
      if (idx !== -1) {
        mockCategories[idx] = {
          ...mockCategories[idx],
          name: data.name,
          description: data.description || '',
          sort_order: data.sort_order || 0
        };
      }
    } else if (action === 'delete') {
      mockCategories = mockCategories.filter(c => c.id !== data.id);
    }
    revalidatePath('/admin');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();

  if (action === 'create') {
    const { error } = await supabase.from('categories').insert({
      name: data.name,
      description: data.description || '',
      image_url: data.image_url || '',
      sort_order: data.sort_order || 0,
    });
    if (error) throw new Error(error.message);
  } else if (action === 'update') {
    const { error } = await supabase
      .from('categories')
      .update({
        name: data.name,
        description: data.description || '',
        image_url: data.image_url || '',
        sort_order: data.sort_order || 0,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  } else if (action === 'delete') {
    const { error } = await supabase.from('categories').delete().eq('id', data.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin');
  return { success: true };
}

// Admin: Menu Items CRUD
async function saveMenuOptionGroups(supabase: any, menuItemId: number, optionGroups: any[] = []) {
  const groups = normalizeOptionGroups(optionGroups);

  const { error: deleteError } = await supabase
    .from('menu_option_groups')
    .delete()
    .eq('menu_item_id', menuItemId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  for (const group of groups) {
    const minSelect = group.is_required ? Math.max(1, group.min_select || 1) : group.min_select || 0;
    const maxSelect = group.selection_type === 'single' ? 1 : Math.max(group.max_select || group.choices.length, minSelect);

    const { data: createdGroup, error: groupError } = await supabase
      .from('menu_option_groups')
      .insert({
        menu_item_id: menuItemId,
        name: group.name,
        selection_type: group.selection_type,
        is_required: group.is_required,
        min_select: minSelect,
        max_select: maxSelect,
        sort_order: group.sort_order,
      })
      .select('id')
      .single();

    if (groupError || !createdGroup) {
      throw new Error(groupError?.message || 'Failed to create option group');
    }

    const choicesToInsert = group.choices.map(choice => ({
      option_group_id: createdGroup.id,
      name: choice.name,
      price_delta: choice.price_delta || 0,
      sort_order: choice.sort_order,
    }));

    if (choicesToInsert.length > 0) {
      const { error: choicesError } = await supabase
        .from('menu_option_choices')
        .insert(choicesToInsert);

      if (choicesError) {
        throw new Error(choicesError.message);
      }
    }
  }
}

async function saveMenuVariants(supabase: any, menuItemId: number, variants: any[] = []) {
  const normalizedVariants = normalizeMenuVariants(variants);

  const { error: deleteError } = await supabase
    .from('menu_item_variants')
    .delete()
    .eq('menu_item_id', menuItemId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (normalizedVariants.length === 0) return;

  const variantsToInsert = normalizedVariants.map((variant, index) => ({
    menu_item_id: menuItemId,
    name: variant.name,
    min_quantity: variant.min_quantity,
    max_quantity: variant.max_quantity,
    sort_order: index + 1,
  }));

  const { error: insertError } = await supabase
    .from('menu_item_variants')
    .insert(variantsToInsert);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function saveMenuImages(supabase: any, menuItemId: number, images: any[] = [], fallbackImageUrl = '') {
  const normalizedImages = normalizeMenuImages(images, fallbackImageUrl);

  const { error: deleteError } = await supabase
    .from('menu_item_images')
    .delete()
    .eq('menu_item_id', menuItemId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (normalizedImages.length === 0) return '';

  const imagesToInsert = normalizedImages.map((image, index) => ({
    menu_item_id: menuItemId,
    image_url: image.image_url,
    sort_order: index + 1,
    is_primary: index === 0,
  }));

  const { error: insertError } = await supabase
    .from('menu_item_images')
    .insert(imagesToInsert);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return imagesToInsert[0]?.image_url || '';
}

export async function manageMenuItem(
  action: 'create' | 'update' | 'delete',
  data: any
) {
  if (!isSupabaseConfigured) {
    if (action === 'create') {
      mockMenuItems.push({
        id: mockMenuItems.length + 1,
        category_id: data.category_id,
        name: data.name,
        description: data.description || '',
        price: 0,
        package_ids: data.package_ids || [],
        is_available: data.is_available ?? true,
        image_url: normalizeMenuImages(data.images || [], data.image_url || '')[0]?.image_url || '',
        option_groups: normalizeOptionGroups(data.option_groups || []),
        variants: normalizeMenuVariants(data.variants || []),
        images: normalizeMenuImages(data.images || [], data.image_url || ''),
      });
    } else if (action === 'update') {
      const idx = mockMenuItems.findIndex(m => m.id === data.id);
      if (idx !== -1) {
        mockMenuItems[idx] = {
          ...mockMenuItems[idx],
          category_id: data.category_id,
          name: data.name,
          description: data.description || '',
          price: 0,
          package_ids: data.package_ids || [],
          is_available: data.is_available ?? true,
          image_url: normalizeMenuImages(data.images || [], data.image_url || '')[0]?.image_url || '',
          option_groups: normalizeOptionGroups(data.option_groups || []),
          variants: normalizeMenuVariants(data.variants || []),
          images: normalizeMenuImages(data.images || [], data.image_url || ''),
        };
      }
    } else if (action === 'delete') {
      mockMenuItems = mockMenuItems.filter(m => m.id !== data.id);
    }
    revalidatePath('/admin');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();
  const normalizedImages = normalizeMenuImages(data.images || [], data.image_url || '');
  const primaryImageUrl = normalizedImages[0]?.image_url || data.image_url || '';

  if (action === 'create') {
    const { data: createdItem, error } = await supabase.from('menu_items').insert({
      category_id: data.category_id,
      name: data.name,
      description: data.description || '',
      price: 0,
      image_url: primaryImageUrl,
      package_ids: data.package_ids,
      is_available: data.is_available ?? true,
    }).select('id').single();
    if (error) throw new Error(error.message);
    if (createdItem) {
      await saveMenuOptionGroups(supabase, createdItem.id, data.option_groups || []);
      await saveMenuVariants(supabase, createdItem.id, data.variants || []);
      await saveMenuImages(supabase, createdItem.id, normalizedImages, primaryImageUrl);
    }
  } else if (action === 'update') {
    const { error } = await supabase
      .from('menu_items')
      .update({
        category_id: data.category_id,
        name: data.name,
        description: data.description || '',
        price: 0,
        image_url: primaryImageUrl,
        package_ids: data.package_ids,
        is_available: data.is_available ?? true,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
    await saveMenuOptionGroups(supabase, data.id, data.option_groups || []);
    await saveMenuVariants(supabase, data.id, data.variants || []);
    await saveMenuImages(supabase, data.id, normalizedImages, primaryImageUrl);
  } else if (action === 'delete') {
    const { error } = await supabase.from('menu_items').delete().eq('id', data.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin');
  return { success: true };
}

// Admin: Upload Image to Supabase Storage
export async function uploadMenuImage(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }

  if (!isSupabaseConfigured) {
    // Local fallback for preview mode - return dummy logo url or similar
    return { success: true, url: '/logo.jpg' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Generate clean unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const cleanFilename = `menu-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;

    const { error } = await supabase.storage
      .from('menu')
      .upload(cleanFilename, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload file to storage: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('menu')
      .getPublicUrl(cleanFilename);

    return { success: true, url: publicUrl };
  } catch (err: any) {
    console.error('Error in uploadMenuImage:', err);
    throw new Error(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
  }
}

// Admin: Get Dashboard Data (Orders, Print Queue)
export async function getAdminDashboardData() {
  if (!isSupabaseConfigured) {
    const active = mockTables
      .filter(t => t.status === 'occupied' && t.sessions.length > 0)
      .map(t => {
        const s = t.sessions[0];
        const pkg = mockPackages.find(p => p.id === s.package_id);
        return {
          ...s,
          tables: { table_number: t.table_number },
          packages: { name: pkg ? pkg.name : s.package_id }
        };
      });

    const pending = mockPrintJobs.filter(j => j.status === 'pending');

    const formattedMenuItems = mockMenuItems.map(item => {
      const cat = mockCategories.find(c => c.id === item.category_id);
      return {
        ...item,
        option_groups: normalizeOptionGroups(item.option_groups || []),
        categories: { name: cat ? cat.name : 'Unknown' }
      };
    });

    return {
      activeSessions: active,
      recentOrders: mockOrders,
      pendingPrintJobs: pending,
      staffCalls: mockStaffCalls.filter(call => call.status === 'pending'),
      posDevices: mockPosDevices.map(({ fcm_token, ...device }) => device),
      tables: mockTables
        .filter(table => table.is_active)
        .sort((a, b) => a.table_number - b.table_number),
      categories: mockCategories,
      menuItems: formattedMenuItems,
      packages: mockPackages,
    };
  }

  const supabase = getSupabaseAdmin();

  // 1. Get recent active sessions
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('*, tables(table_number), packages(name)')
    .eq('status', 'active')
    .order('opened_at', { ascending: false });

  // 2. Get recent orders with items and tables
  const { data: recentOrders } = await supabase
    .from('orders')
    .select(`
      *,
      sessions (
        tables (table_number),
        packages (name, id)
      ),
      order_items (
        *,
        menu_items (name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  // 3. Get pending print jobs
  const { data: pendingPrintJobs } = await supabase
    .from('print_jobs')
    .select(`
      *,
      orders (
        id,
        sessions (
          tables (table_number),
          packages (name)
        ),
        order_items (
          *,
          menu_items (name)
        )
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const { data: staffCalls } = await supabase
    .from('staff_calls')
    .select(`
      id,
      session_id,
      table_id,
      table_number,
      status,
      message,
      created_at,
      sessions (
        packages (name)
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: posDevices } = await supabase
    .from('pos_devices')
    .select('id, name, is_active, last_seen_at, created_at')
    .order('last_seen_at', { ascending: false });

  const { data: tables } = await supabase
    .from('tables')
    .select('*, sessions(*)')
    .eq('is_active', true)
    .order('table_number', { ascending: true });

  // 4. Get categories & menus
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select(`
      *,
      categories(name)
    `)
    .order('name', { ascending: true });

  const { data: packages } = await supabase
    .from('packages')
    .select('*')
    .order('price', { ascending: true });

  return {
    activeSessions: activeSessions || [],
    recentOrders: recentOrders || [],
    pendingPrintJobs: pendingPrintJobs || [],
    staffCalls: staffCalls || [],
    posDevices: posDevices || [],
    tables: tables || [],
    categories: categories || [],
    menuItems: sortMenuItemsByCategory(await attachOptionGroupsToMenuItems(supabase, menuItems || []), categories || []),
    packages: packages || [],
  };
}

// Kitchen: Update print job status
export async function updatePrintJobStatus(jobId: number, status: 'printed' | 'failed', errorMessage?: string) {
  if (!isSupabaseConfigured) {
    const jobIndex = mockPrintJobs.findIndex(j => j.id === jobId);
    if (jobIndex !== -1) {
      mockPrintJobs[jobIndex] = {
        ...mockPrintJobs[jobIndex],
        status,
        error_message: errorMessage || null
      };
      
      // Also update the status of the related mock order to 'served' or similar if printed
      const orderId = mockPrintJobs[jobIndex].order_id;
      const orderIndex = mockOrders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1 && status === 'printed') {
        mockOrders[orderIndex].status = 'served';
      }
    }
    revalidatePath('/admin');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('print_jobs')
    .update({
      status,
      error_message: errorMessage || null,
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update print job: ${error.message}`);
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function validateStaffPin(pin: string) {
  if (pin.length !== 6) {
    return { success: false, error: 'รหัส PIN ต้องมี 6 หลัก' };
  }

  let staffMember = null;

  if (!isSupabaseConfigured) {
    // Mock authentication
    if (pin === '111111') {
      staffMember = { role: 'cashier', name: 'แคชเชียร์' };
    } else if (pin === '999999') {
      staffMember = { role: 'admin', name: 'ผู้ดูแลระบบ' };
    }
  } else {
    // Real Supabase authentication using service_role client for secure staff verification
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('staff')
      .select('role, name')
      .eq('pin', pin)
      .maybeSingle();

    if (error) {
      return { success: false, error: `เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ${error.message}` };
    }
    staffMember = data;
  }

  if (!staffMember) {
    return { success: false, error: 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
  }

  // Set cookies
  const cookieStore = await cookies();
  cookieStore.set('staff_role', staffMember.role, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 day session
  });
  cookieStore.set('staff_name', staffMember.name, {
    path: '/',
    httpOnly: false, // Allow client access for display if needed
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  });

  return { success: true, role: staffMember.role, name: staffMember.name };
}

export async function logoutStaff() {
  const cookieStore = await cookies();
  cookieStore.delete('staff_role');
  cookieStore.delete('staff_name');
  return { success: true };
}
