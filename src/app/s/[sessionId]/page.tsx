import React from 'react';
import { getMenuForSession } from '../../actions';
import OrderClient from './OrderClient';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;
  const initialData = await getMenuForSession(sessionId);

  // If there's an error retrieving active session, show error screen
  if ('error' in initialData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-[32px] border border-surface-container-low shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary mb-4">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="material-symbols-outlined text-primary text-5xl mb-4">qr_code_scanner</span>
          <h2 className="text-xl font-extrabold text-on-surface mb-2">ไม่พบข้อมูลโต๊ะหรือเซสชัน</h2>
          <p className="text-sm text-on-surface-variant font-medium mb-6 leading-relaxed">
            {initialData.error}
          </p>
          <div className="text-xs text-neutral-400 font-bold">ตี๋อ้วน สุกี้ชาบู</div>
        </div>
      </div>
    );
  }

  return <OrderClient sessionId={sessionId} initialData={initialData} />;
}
