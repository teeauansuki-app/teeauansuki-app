'use server';

import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// ==========================================
// MOCK DATA STORAGE FOR PREVIEW MODE (When Supabase is not configured yet)
// ==========================================

let mockTables = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  table_number: i + 1,
  status: i === 2 || i === 7 ? 'occupied' : 'vacant',
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
  { id: 'standard', name: 'Standard Buffet', price: 308.00, description: 'หมูสด ผักสด ซุปใสต้มยำ' },
  { id: 'premium', name: 'Premium Buffet', price: 398.00, description: 'Standard + เนื้อวากิว ซีฟู้ด ซุปทรัฟเฟิล' }
];

let mockCategories = [
  { id: 1, name: 'Shabu Sets', description: 'ชุดชาบูเริ่มต้น', sort_order: 1 },
  { id: 2, name: 'Meats', description: 'เนื้อสัตว์สไลด์เกรดพรีเมียม', sort_order: 2 },
  { id: 3, name: 'Seafood', description: 'อาหารทะเลสดใหม่', sort_order: 3 },
  { id: 4, name: 'Vegetables & Sides', description: 'ผักสดและเครื่องเคียง', sort_order: 4 },
  { id: 5, name: 'Drinks', description: 'เครื่องดื่มรีฟิลดับกระหาย', sort_order: 5 }
];

let mockMenuItems = [
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
      packages: { name: 'Standard Buffet', id: 'standard' }
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
        packages: { name: 'Standard Buffet' }
      },
      order_items: [
        { id: 1, menu_item_id: 3, quantity: 2, notes: 'ขอผักเยอะๆ', menu_items: { name: 'Pork Belly' } },
        { id: 2, menu_item_id: 9, quantity: 1, notes: '', menu_items: { name: 'Assorted Veggies Basket' } }
      ]
    }
  }
];

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
    return items.map(item => ({ ...item, option_groups: [] }));
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

  return items.map(item => ({
    ...item,
    option_groups: normalizeOptionGroups(groupsByItem.get(item.id) || []),
  }));
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
  cartItems: { menuItemId: number; quantity: number; notes?: string; selectedOptions?: any[] }[]
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
      return {
        id: idx + 1,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes || '',
        selected_options: formatSelectedOptions(item.selectedOptions || []),
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

  const menuItemsWithOptions = await attachOptionGroupsToMenuItems(supabase, orderMenuItems || []);
  const menuItemById = new Map(menuItemsWithOptions.map(item => [item.id, item]));

  for (const item of cartItems) {
    validateSelectedOptions(menuItemById.get(item.menuItemId), item.selectedOptions || []);
  }

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
  const itemsToInsert = cartItems.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menuItemId,
    quantity: item.quantity,
    notes: item.notes || '',
    selected_options: formatSelectedOptions(item.selectedOptions || []),
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
        image_url: data.image_url || '',
        option_groups: normalizeOptionGroups(data.option_groups || []),
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
          image_url: data.image_url || '',
          option_groups: normalizeOptionGroups(data.option_groups || []),
        };
      }
    } else if (action === 'delete') {
      mockMenuItems = mockMenuItems.filter(m => m.id !== data.id);
    }
    revalidatePath('/admin');
    return { success: true };
  }

  const supabase = getSupabaseAdmin();

  if (action === 'create') {
    const { data: createdItem, error } = await supabase.from('menu_items').insert({
      category_id: data.category_id,
      name: data.name,
      description: data.description || '',
      price: 0,
      image_url: data.image_url || '',
      package_ids: data.package_ids,
      is_available: data.is_available ?? true,
    }).select('id').single();
    if (error) throw new Error(error.message);
    if (createdItem) {
      await saveMenuOptionGroups(supabase, createdItem.id, data.option_groups || []);
    }
  } else if (action === 'update') {
    const { error } = await supabase
      .from('menu_items')
      .update({
        category_id: data.category_id,
        name: data.name,
        description: data.description || '',
        price: 0,
        image_url: data.image_url || '',
        package_ids: data.package_ids,
        is_available: data.is_available ?? true,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
    await saveMenuOptionGroups(supabase, data.id, data.option_groups || []);
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
