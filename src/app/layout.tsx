import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sukhumvit = localFont({
  src: [
    {
      path: "../../public/fonts/SukhumvitSet-Bold.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SukhumvitSet-Bold.ttf",
      weight: "700",
      style: "normal",
    }
  ],
  variable: "--font-sukhumvit",
});

export const metadata: Metadata = {
  title: "ตี๋อ้วน สุกี้ชาบู - Little Fat Shabu",
  description: "ระบบสั่งอาหารผ่าน QR Code สำหรับร้านชาบูบุฟเฟต์ ตี๋อ้วน สุกี้ชาบู",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${sukhumvit.variable} h-full antialiased`} style={{ colorScheme: 'light' }}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-background">
        {children}
      </body>
    </html>
  );
}
