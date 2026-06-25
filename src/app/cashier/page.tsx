'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Receipt, Settings, LogOut, RefreshCw } from 'lucide-react';
import { getTablesAndSessions, openTableSession, closeTableSession, logoutStaff } from '../actions';
import { QRCodeSVG } from 'qrcode.react';

declare global {
  interface Window {
    AndroidPrinter?: {
      printQrSlip?: (payloadJson: string) => string;
    };
    AndroidPrintInterface?: {
      printQrSlip?: (payloadJson: string) => string;
      printQR?: (tableNumber: string, packageName: string, openedAt: string, qrUrl: string) => string;
    };
  }
}

interface TableWithSession {
  id: number;
  table_number: number;
  status: 'vacant' | 'occupied';
  sessions?: Array<{
    id: string;
    package_id: string;
    status: string;
    opened_at: string;
  }>;
}

interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
}

type TableFilter = 'all' | 'vacant' | 'standard' | 'premium';

// Modern Vector Shabu Pot Icon matching the logo's branding with S-curve, tea-colored Sukiyaki soup, and warm copper finish
type ModernShabuIconProps = {
  className?: string;
  isOccupied?: boolean;
  isPremium?: boolean;
};

const ModernShabuIcon = React.memo(function ModernShabuIcon({
  className = "w-14 h-14",
  isOccupied = false,
}: ModernShabuIconProps) {
  // Outline and base colors based on state
  const strokeColor = isOccupied ? "stroke-[#6e371a]" : "stroke-neutral-300";
  const handleFill = isOccupied ? "url(#copperMetallic)" : "#e5e5e5";
  const potOuterFill = isOccupied ? "url(#copperMetallic)" : "#d4d4d4";
  const potInnerShadow = isOccupied ? "#5a2d13" : "#a3a3a3";

  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Premium Copper / Rose Gold Metallic Gradient */}
        <linearGradient id="copperMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d98c5f" />
          <stop offset="30%" stopColor="#f5c7ad" />
          <stop offset="50%" stopColor="#ac6035" />
          <stop offset="70%" stopColor="#e5a37e" />
          <stop offset="100%" stopColor="#7c3d1b" />
        </linearGradient>

        {/* Active Soup Gradients */}
        <radialGradient id="malaSoup" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="70%" stopColor="#af101a" />
          <stop offset="100%" stopColor="#7a0910" />
        </radialGradient>
        <radialGradient id="teaSoup" cx="65%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#8c5b36" />
          <stop offset="75%" stopColor="#4a2c11" />
          <stop offset="100%" stopColor="#2c1707" />
        </radialGradient>
        
        {/* Vacant Gradients */}
        <radialGradient id="vacantLeft" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f4f4f4" />
          <stop offset="100%" stopColor="#d4d4d4" />
        </radialGradient>
        <radialGradient id="vacantRight" cx="65%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#e5e5e5" />
          <stop offset="100%" stopColor="#c5c5c5" />
        </radialGradient>
      </defs>

      {/* Handles */}
      <rect x="8" y="44" width="8" height="12" rx="4" fill={handleFill} className={`${strokeColor}`} strokeWidth="2" />
      <rect x="84" y="44" width="8" height="12" rx="4" fill={handleFill} className={`${strokeColor}`} strokeWidth="2" />

      {/* Main Pot Outer Ring */}
      <circle cx="50" cy="50" r="36" fill={potOuterFill} className={`${strokeColor}`} strokeWidth="2" />
      <circle cx="50" cy="50" r="33" fill={potInnerShadow} /> {/* Inner wall shadow */}
      
      {/* Left Spicy Soup (Red Mala) - S-curve boundary matching shabu_table_icon.jpg */}
      <path 
        d="M 50 20 A 30 30 0 0 0 50 80 C 33 65, 67 35, 50 20 Z" 
        fill={isOccupied ? "url(#malaSoup)" : "url(#vacantLeft)"} 
      />
      
      {/* Right Clear/Gold Soup (Sukiyaki Black/Tea-brown) - S-curve boundary matching shabu_table_icon.jpg */}
      <path 
        d="M 50 20 C 67 35, 33 65, 50 80 A 30 30 0 0 0 50 20 Z" 
        fill={isOccupied ? "url(#teaSoup)" : "url(#vacantRight)"} 
      />

      {/* Yin-Yang S-Curve Divider matching shabu_table_icon.jpg */}
      <path 
        d="M 50 20 C 67 35, 33 65, 50 80" 
        className={`${strokeColor}`} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
      
      {/* Pot Rim Stroke */}
      <circle cx="50" cy="50" r="30" className={`${strokeColor}`} strokeWidth="2.5" />
    </svg>
  );
});

export default function CashierPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableWithSession[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  
  // Modal states
  const [selectedTable, setSelectedTable] = useState<TableWithSession | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('standard');
  const [qrModalSession, setQrModalSession] = useState<{
    id: string;
    tableNumber: number;
    packageName: string;
    openedAt: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutTableSession, setCheckoutTableSession] = useState<{
    sessionId: string;
    tableNumber: number;
    packageName: string;
    packagePrice: number;
    openedAt: string;
  } | null>(null);

  // App URL for QR Code
  const [appUrl, setAppUrl] = useState('http://localhost:3000');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await getTablesAndSessions();
      // Format sessions mapping
      const formattedTables = data.tables.map((t: any) => ({
        ...t,
        sessions: t.sessions?.filter((s: any) => s.status === 'active') || []
      }));
      setTables(formattedTables);
      setPackages(data.packages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenTable() {
    if (!selectedTable) return;
    setSubmitting(true);
    setError('');
    try {
      const session = await openTableSession(selectedTable.id, selectedPackageId);
      const pkg = packages.find(p => p.id === selectedPackageId);
      
      setQrModalSession({
        id: session.id,
        tableNumber: selectedTable.table_number,
        packageName: pkg?.name || selectedPackageId,
        openedAt: new Date(session.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      });
      
      setSelectedTable(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to open table');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseTable(sessionId: string) {
    setSubmitting(true);
    setError('');
    try {
      await closeTableSession(sessionId);
      await fetchData();
      setCheckoutTableSession(null);
    } catch (err: any) {
      setError(err.message || 'Failed to close table');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSunmiPrint() {
    if (!qrModalSession) return;

    const qrUrl = `${appUrl}/s/${qrModalSession.id}`;
    const printedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const payload = {
      type: 'qr_slip',
      version: 1,
      source: 'tee-uan-cashier-web',
      data: {
        restaurantName: 'ตี๋อ้วน สุกี้ชาบู',
        tableNumber: qrModalSession.tableNumber.toString().padStart(2, '0'),
        packageName: qrModalSession.packageName,
        openedAt: qrModalSession.openedAt,
        printedAt,
        qrUrl,
      },
    };

    try {
      const payloadJson = JSON.stringify(payload);
      const printerBridge = window.AndroidPrinter?.printQrSlip
        ? window.AndroidPrinter
        : window.AndroidPrintInterface;

      if (printerBridge?.printQrSlip) {
        const result = printerBridge.printQrSlip(payloadJson);
        if (result === 'ok') {
          alert('พิมพ์ QR เรียบร้อยแล้ว');
          return;
        }
        alert(`พิมพ์ QR ไม่สำเร็จ: ${result || 'ไม่ทราบสาเหตุ'}`);
        return;
      }

      if (window.AndroidPrintInterface?.printQR) {
        const result = window.AndroidPrintInterface.printQR(
          payload.data.tableNumber,
          payload.data.packageName,
          payload.data.openedAt,
          payload.data.qrUrl
        );
        if (result === 'ok') {
          alert('พิมพ์ QR เรียบร้อยแล้ว');
          return;
        }
        alert(`พิมพ์ QR ไม่สำเร็จ: ${result || 'ไม่ทราบสาเหตุ'}`);
        return;
      }

      alert('ไม่พบ SUNMI printer bridge กรุณาเปิดหน้านี้ผ่าน APK บนเครื่อง SUNMI V2');
    } catch (err: any) {
      alert(`พิมพ์ QR ไม่สำเร็จ: ${err?.message || 'ไม่ทราบสาเหตุ'}`);
    }
  }

  // Stats calculation
  const totalTables = tables.length;
  const vacantTables = tables.filter(t => t.status === 'vacant').length;
  const standardTables = tables.filter(
    t => t.status === 'occupied' && t.sessions?.[0]?.package_id === 'standard'
  ).length;
  const premiumTables = tables.filter(
    t => t.status === 'occupied' && t.sessions?.[0]?.package_id === 'premium'
  ).length;
  const tableFilters: Array<{ id: TableFilter; label: string; count: number }> = [
    { id: 'all', label: 'โต๊ะทั้งหมด', count: totalTables },
    { id: 'vacant', label: 'โต๊ะว่าง', count: vacantTables },
    { id: 'standard', label: 'Standard', count: standardTables },
    { id: 'premium', label: 'Premium', count: premiumTables },
  ];
  const filteredTables = tables.filter((table) => {
    const activeSession = table.sessions?.[0];

    if (tableFilter === 'vacant') {
      return table.status === 'vacant';
    }

    if (tableFilter === 'standard' || tableFilter === 'premium') {
      return table.status === 'occupied' && activeSession?.package_id === tableFilter;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#faf9f8] font-sans flex overflow-x-hidden">
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
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold bg-white/10 text-white border-l-4 border-[#fdc003] transition-colors"
          >
            <Receipt className="w-5 h-5 text-[#fdc003]" />
            <span>หน้าจอแคชเชียร์</span>
          </Link>
          
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings className="w-5 h-5 text-white/70" />
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
      <div className="flex-1 lg:pl-64 min-h-screen flex flex-col pb-20 lg:pb-0 min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[#faf9f8]/95 backdrop-blur-xl">
          <div className="lg:hidden h-16 bg-gradient-to-r from-[#af101a] to-[#800c13] text-white flex items-center justify-between px-4 border-b border-[#800c13] shadow-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-xs tracking-tight truncate">ตี๋อ้วน สุกี้ชาบู</h2>
                <p className="text-[9px] text-white/70 font-bold truncate">ระบบแคชเชียร์และเปิดโต๊ะ</p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchData}
              aria-label="รีเฟรชข้อมูล"
              title="รีเฟรชข้อมูล"
              className="w-10 h-10 rounded-full bg-white/10 text-white border border-white/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer shrink-0"
            >
              <RefreshCw className="w-5 h-5" strokeWidth={2.7} />
            </button>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 lg:pt-5">
            <div className="hidden lg:flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-[#af101a] tracking-tight leading-tight">
                  ตี๋อ้วน สุกี้ชาบู
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 font-extrabold mt-0.5 truncate">
                  ระบบแคชเชียร์และเปิดโต๊ะ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchData}
                  aria-label="รีเฟรชข้อมูล"
                  title="รีเฟรชข้อมูล"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white text-[#af101a] border border-red-100 shadow-xs hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  <RefreshCw className="w-5 h-5" strokeWidth={2.6} />
                </button>
              </div>
            </div>

            <div className="mt-3 lg:mt-4 grid grid-cols-4 border-b border-neutral-200">
              {tableFilters.map((filter) => {
                const isActive = tableFilter === filter.id;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTableFilter(filter.id)}
                    className={`min-w-0 px-1.5 sm:px-4 py-2.5 sm:py-3 border-b-2 transition-all text-center cursor-pointer ${
                      isActive
                        ? 'border-[#af101a] text-[#af101a]'
                        : 'border-transparent text-[#80610a] hover:text-[#af101a]'
                    }`}
                  >
                    <span className="block text-[11px] min-[390px]:text-xs sm:text-base font-black leading-tight truncate">
                      {filter.label}
                    </span>
                    <span className={`block text-[10px] sm:text-xs font-extrabold mt-1 ${
                      isActive ? 'text-[#af101a]' : 'text-neutral-400'
                    }`}>
                      {filter.count} โต๊ะ
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1">

      {/* Main Content */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-900 rounded-2xl border border-red-200 text-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600">error</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          {/* Skeleton Tables */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 28 }).map((_, idx) => (
              <div key={idx} className="shimmer-bg h-48 rounded-[24px] border border-neutral-200"></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tables Grid */}
          {filteredTables.length === 0 ? (
            <div className="min-h-[260px] rounded-[28px] border border-dashed border-neutral-200 bg-white/70 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#af101a] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl">table_restaurant</span>
              </div>
              <div className="text-lg font-black text-neutral-800">ไม่พบโต๊ะในหมวดนี้</div>
              <div className="text-sm font-bold text-neutral-400 mt-1">ลองเลือกตัวกรองอื่นเพื่อดูรายการโต๊ะ</div>
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredTables.map((table) => {
              const activeSession = table.sessions && table.sessions[0];
              const isOccupied = table.status === 'occupied' && activeSession;
              const isPremium = isOccupied && activeSession.package_id === 'premium';
              
              return (
                <div 
                  key={table.id}
                  className={`group rounded-[28px] p-4 border flex flex-col justify-between min-h-[220px] transition-all duration-200 ${
                    isOccupied 
                      ? isPremium 
                        ? 'bg-gradient-to-br from-amber-50/40 to-white border-amber-300 shadow-xs'
                        : 'bg-gradient-to-br from-red-50/50 to-white border-red-200 shadow-xs'
                      : 'bg-white border-neutral-200 hover:border-[#af101a]/30 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {/* Table Header */}
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-lg sm:text-xl font-extrabold text-neutral-800">
                      โต๊ะ {table.table_number.toString().padStart(2, '0')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
                      isOccupied 
                        ? isPremium 
                          ? 'bg-amber-100 text-amber-900 border-amber-200' 
                          : 'bg-red-100 text-red-900 border-red-200'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                    }`}>
                      {isOccupied ? isPremium ? 'PREMIUM' : 'STANDARD' : 'ว่าง'}
                    </span>
                  </div>

                  {/* Card Center: Modern Vector Shabu Table Icon */}
                  <div className="flex justify-center items-center my-2.5 flex-grow">
                    <ModernShabuIcon 
                      className="w-[104px] h-[104px] transition-transform duration-300 group-hover:scale-110" 
                      isOccupied={!!isOccupied} 
                      isPremium={isPremium} 
                    />
                  </div>

                  {/* Action / Timing info */}
                  {isOccupied ? (
                    <div className="space-y-2.5 mt-auto">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setQrModalSession({
                            id: activeSession.id,
                            tableNumber: table.table_number,
                            packageName: activeSession.package_id === 'premium' ? 'Premium' : 'Standard',
                            openedAt: new Date(activeSession.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                          })}
                          className="flex items-center justify-center w-10 h-10 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl border border-neutral-200 transition-colors cursor-pointer"
                          title="ดู QR Code"
                        >
                          <span className="material-symbols-outlined text-lg">qr_code_2</span>
                        </button>
                        <button
                          onClick={() => {
                            if (activeSession) {
                              const pkg = packages.find(p => p.id === activeSession.package_id);
                              setCheckoutTableSession({
                                sessionId: activeSession.id,
                                tableNumber: table.table_number,
                                packageName: pkg?.name || (activeSession.package_id === 'premium' ? 'Premium' : 'Standard'),
                                packagePrice: pkg?.price || (activeSession.package_id === 'premium' ? 499 : 329),
                                openedAt: new Date(activeSession.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                              });
                            }
                          }}
                          className="flex-1 h-10 bg-[#af101a] hover:bg-[#900e15] text-white rounded-xl text-[11px] font-extrabold shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">payments</span>
                          เช็คบิล
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedTable(table);
                        setSelectedPackageId('standard'); // Default
                      }}
                      className="w-full h-10 bg-[#af101a] hover:bg-[#900e15] text-white rounded-xl text-[11px] font-extrabold shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer mt-auto"
                    >
                      <span className="material-symbols-outlined text-[15px]">add_circle</span>
                      เปิดโต๊ะ
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Open Table Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full border border-neutral-200 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-5 border-b border-neutral-100 pb-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-[#af101a] flex-shrink-0">
                <ModernShabuIcon className="w-8 h-8" isOccupied={true} isPremium={false} />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-800">เปิดโต๊ะ {selectedTable.table_number.toString().padStart(2, '0')}</h3>
                <p className="text-xs text-neutral-400 font-bold">กรุณาเลือกประเภทแพ็กเกจอาหาร</p>
              </div>
            </div>
            
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider mb-2.5 block">แพ็กเกจบุฟเฟต์</label>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {packages.map((pkg) => {
                const isPremium = pkg.id === 'premium';
                const isSelected = selectedPackageId === pkg.id;
                
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all cursor-pointer ${
                      isSelected 
                        ? isPremium
                          ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-400 shadow-xs'
                          : 'border-red-400 bg-red-50/30 ring-2 ring-red-400 shadow-xs'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full self-start tracking-wider uppercase ${
                      isPremium 
                        ? 'bg-amber-100 text-amber-950 border border-amber-200' 
                        : 'bg-red-100 text-red-950 border border-red-200'
                    }`}>
                      {pkg.id}
                    </span>
                    <div className="mt-2">
                      <div className="font-extrabold text-sm text-neutral-800">{pkg.name}</div>
                      <div className="font-black text-[#af101a] text-xs mt-0.5">{pkg.price} บาท/ท่าน</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedTable(null)}
                className="grow py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold rounded-2xl text-xs border border-neutral-200 cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleOpenTable}
                disabled={submitting}
                className="grow py-3 bg-[#af101a] hover:bg-[#900e15] text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                {submitting ? (
                  <span>กำลังบันทึก...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">print</span>
                    เปิดโต๊ะและพิมพ์ QR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Slip Modal */}
      {qrModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full border border-neutral-200 shadow-2xl text-center">
            {/* Slip Design Mockup */}
            <div className="border border-dashed border-neutral-300 p-4 bg-neutral-50 rounded-2xl mb-6 shadow-2xs">
              <div className="flex flex-col items-center mb-3">
                <img src="/logo.jpg" alt="Logo" className="w-10 h-10 rounded-full object-cover border border-[#af101a] mb-1.5" />
                <h4 className="font-black text-neutral-800 text-sm">ตี๋อ้วน สุกี้ชาบู</h4>
                <div className="text-[10px] text-neutral-400 font-bold">Smart Dining & Ordering QR</div>
              </div>

              <div className="border-y border-dashed border-neutral-300 py-2.5 my-2.5 text-left text-xs font-black text-neutral-700 flex justify-between">
                <span>โต๊ะ: {qrModalSession.tableNumber.toString().padStart(2, '0')}</span>
                <span className="text-[#af101a]">{qrModalSession.packageName}</span>
              </div>

              <div className="my-4 flex justify-center p-3 bg-white rounded-xl border border-neutral-200 shadow-3xs">
                <QRCodeSVG value={`${appUrl}/s/${qrModalSession.id}`} size={160} />
              </div>

              <div className="text-[10px] text-neutral-400 font-bold mt-2 leading-relaxed">
                *สแกนคิวอาร์โค้ดนี้เพื่อเริ่มต้นการสั่งอาหาร*
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setQrModalSession(null)}
                className="grow py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold rounded-2xl text-xs border border-neutral-200 cursor-pointer transition-colors"
              >
                ปิดหน้าจอ
              </button>
              <button
                onClick={handleSunmiPrint}
                className="grow py-3 bg-[#af101a] hover:bg-[#900e15] text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                ปริ้นใบสลิป
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {checkoutTableSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full border border-neutral-200 shadow-2xl animate-scale-in text-center animate-fade-in">
            {/* Header Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#af101a] border-2 border-red-100 shadow-xs animate-bounce-subtle">
                <span className="material-symbols-outlined text-3xl">payments</span>
              </div>
            </div>

            <h3 className="text-xl font-black text-neutral-800 mb-1">ยืนยันการเช็คบิล</h3>
            <p className="text-xs text-neutral-400 font-bold mb-5">กรุณาตรวจสอบรายละเอียดก่อนปิดโต๊ะ</p>

            {/* Receipt Card */}
            <div className="border border-neutral-200 p-5 bg-neutral-50/50 rounded-2xl mb-6 text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-black text-neutral-400">เลขโต๊ะ</span>
                <span className="text-lg font-black text-[#af101a] bg-red-50 px-3 py-1 rounded-xl border border-red-100">
                  โต๊ะ {checkoutTableSession.tableNumber.toString().padStart(2, '0')}
                </span>
              </div>

              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-black text-neutral-400">แพ็กเกจ</span>
                <span className={`text-sm font-extrabold px-3 py-1 rounded-xl ${
                  checkoutTableSession.packageName.toLowerCase().includes('premium')
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-red-50 text-red-800 border border-red-100'
                }`}>
                  {checkoutTableSession.packageName}
                </span>
              </div>

              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-black text-neutral-400">ราคาต่อท่าน</span>
                <span className="text-sm font-extrabold text-neutral-700">
                  {checkoutTableSession.packagePrice} บาท
                </span>
              </div>

              <div className="border-t border-dashed border-neutral-300 mt-4"></div>
            </div>

            {/* Warning Message */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 mb-6 text-left flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-600 text-[18px] mt-0.5 flex-shrink-0">warning</span>
              <p className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                การเช็คบิลจะทำลายสิทธิ์การสั่งอาหารของลูกค้ารายนี้ และระบบจะบันทึกปิดรอบทันที ไม่สามารถยกเลิกภายหลังได้
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setCheckoutTableSession(null)}
                className="grow py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold rounded-2xl text-xs border border-neutral-200 cursor-pointer transition-colors"
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleCloseTable(checkoutTableSession.sessionId)}
                disabled={submitting}
                className="grow py-3 bg-[#af101a] hover:bg-[#900e15] text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                {submitting ? (
                  <span>กำลังบันทึก...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    ยืนยันเช็คบิล
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-[#af101a] to-[#800c13] border-t border-[#800c13] text-white flex justify-around items-center z-40 px-2 shadow-2xl">
        <Link
          href="/cashier"
          className="flex flex-col items-center justify-center gap-0.5 text-[#fdc003] transition-colors flex-1 py-1"
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] font-extrabold">แคชเชียร์</span>
        </Link>

        <Link
          href="/admin"
          className="flex flex-col items-center justify-center gap-0.5 text-white/70 hover:text-white transition-colors flex-1 py-1"
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
