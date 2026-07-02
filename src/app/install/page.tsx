import type { Metadata } from "next";
import Image from "next/image";
import { Download, MonitorSmartphone, QrCode, ShieldCheck } from "lucide-react";
import InstallQrCode from "./InstallQrCode";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://teeauansuki-app.vercel.app").replace(/\/$/, "");
const installUrl = `${appUrl}/install`;
const apkUrl = `${appUrl}/downloads/teeuan-sunmi-v2.apk`;

export const metadata: Metadata = {
  title: "ติดตั้งแอป SUNMI V2 | ตี๋อ้วน สุกี้ชาบู",
  description: "หน้าดาวน์โหลดแอปสำหรับเครื่อง SUNMI V2 ของร้านตี๋อ้วน สุกี้ชาบู",
};

const steps = [
  "ใช้ SUNMI V2 สแกน QR นี้",
  "กดดาวน์โหลดแอป แล้วกดติดตั้ง",
  "เปิดแอปและเข้าสู่ระบบด้วยสิทธิ์พนักงาน",
];

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-[#faf9f8] px-5 py-6 text-on-surface">
      <section className="mx-auto flex w-full max-w-[460px] flex-col gap-5">
        <div className="rounded-[28px] border border-[#f0d1cc] bg-white p-5 shadow-[0_16px_44px_rgba(80,45,40,0.12)]">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#f3d3ce] bg-white shadow-sm">
              <Image src="/logo.jpg" alt="ตี๋อ้วน สุกี้ชาบู" fill className="object-cover" priority />
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.18em] text-secondary">SUNMI V2</p>
              <h1 className="text-3xl font-black leading-tight text-primary">ติดตั้งแอป POS</h1>
              <p className="mt-1 text-base font-bold text-on-surface-variant">ตี๋อ้วน สุกี้ชาบู</p>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#efc7c2] bg-white p-6 text-center shadow-[0_18px_50px_rgba(80,45,40,0.12)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
            <QrCode size={27} strokeWidth={2.6} />
          </div>
          <h2 className="text-2xl font-black text-on-surface">สแกนเพื่อติดตั้ง</h2>
          <p className="mt-1 text-base font-bold leading-relaxed text-on-surface-variant">
            ใช้เครื่อง SUNMI V2 สแกน QR นี้ เพื่อเปิดหน้าดาวน์โหลดแอปเวอร์ชันล่าสุด
          </p>

          <div className="mx-auto mt-5 inline-flex rounded-[24px] border border-[#f0d1cc] bg-white p-3 shadow-inner">
            <InstallQrCode value={installUrl} />
          </div>

          <a
            href={apkUrl}
            download
            className="mt-6 flex min-h-14 items-center justify-center gap-3 rounded-full bg-primary px-6 text-lg font-black text-white shadow-[0_10px_24px_rgba(175,16,26,0.24)] transition active:scale-[0.98]"
          >
            <Download size={24} strokeWidth={2.8} />
            ดาวน์โหลด APK
          </a>
        </div>

        <div className="rounded-[28px] border border-[#efc7c2] bg-white p-5 shadow-[0_14px_36px_rgba(80,45,40,0.08)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1ef] text-primary">
              <MonitorSmartphone size={24} strokeWidth={2.7} />
            </div>
            <div>
              <h2 className="text-xl font-black text-on-surface">ขั้นตอนบนเครื่อง</h2>
              <p className="text-sm font-bold text-on-surface-variant">ทำตามลำดับนี้ทุกเครื่อง</p>
            </div>
          </div>

          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-2xl bg-[#faf7f6] px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-black text-white">
                  {index + 1}
                </span>
                <span className="text-base font-black leading-snug text-on-surface">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-start gap-3 rounded-[24px] border border-[#f0d1cc] bg-[#fff8f7] p-4">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={24} strokeWidth={2.6} />
          <p className="text-sm font-bold leading-relaxed text-on-surface-variant">
            Android อาจขออนุญาตติดตั้งจากแหล่งที่ไม่รู้จัก ให้กดอนุญาตเฉพาะแอปนี้เท่านั้น แล้วกลับมากดติดตั้งอีกครั้ง
          </p>
        </div>
      </section>
    </main>
  );
}
