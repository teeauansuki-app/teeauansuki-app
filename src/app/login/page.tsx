'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Delete } from 'lucide-react';
import { validateStaffPin } from '../actions';

// Custom SVG Shabu Pot shape in active brand color style matching cashier page's occupied table pot
type ShabuPotShapeProps = {
  className?: string;
  isActive?: boolean;
};

const ShabuPotShape = React.memo(function ShabuPotShape({
  className = "w-full h-full absolute inset-0 -z-10",
  isActive = false,
}: ShabuPotShapeProps) {
  // All parts styled in the exact same brand red (#af101a) with darker red outlines (#800c13) for definition
  const strokeColor = "stroke-[#800c13]";
  const handleFill = "#af101a";
  const potOuterFill = "#af101a";
  const potInnerShadow = "#800c13";
  const soupLeft = "#af101a";
  const soupRight = "#af101a";

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} transition-transform duration-100 ${isActive ? 'scale-95 brightness-90' : ''}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Handles */}
      <rect x="8" y="44" width="8" height="12" rx="4" fill={handleFill} className={strokeColor} strokeWidth="2" />
      <rect x="84" y="44" width="8" height="12" rx="4" fill={handleFill} className={strokeColor} strokeWidth="2" />

      {/* Main Pot Outer Ring */}
      <circle cx="50" cy="50" r="36" fill={potOuterFill} className={strokeColor} strokeWidth="2" />
      <circle cx="50" cy="50" r="33" fill={potInnerShadow} /> {/* Inner wall shadow */}
      
      {/* Left Spicy Soup (Red Mala) - S-curve boundary */}
      <path 
        d="M 50 20 A 30 30 0 0 0 50 80 C 33 65, 67 35, 50 20 Z" 
        fill={soupLeft} 
      />
      
      {/* Right Clear/Gold Soup (Sukiyaki Black) - S-curve boundary */}
      <path 
        d="M 50 20 C 67 35, 33 65, 50 80 A 30 30 0 0 0 50 20 Z" 
        fill={soupRight} 
      />

      {/* Yin-Yang S-Curve Divider */}
      <path 
        d="M 50 20 C 67 35, 33 65, 50 80" 
        className={strokeColor} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
      
      {/* Pot Rim Stroke */}
      <circle cx="50" cy="50" r="30" className={strokeColor} strokeWidth="2.5" />
    </svg>
  );
});

interface ShabuKeyProps {
  num: string;
  onClick: (num: string) => void;
}

const ShabuKey = React.memo(function ShabuKey({ num, onClick }: ShabuKeyProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onClick(num)}
      onPointerDown={() => setIsActive(true)}
      onPointerUp={() => setIsActive(false)}
      onPointerCancel={() => setIsActive(false)}
      onPointerLeave={() => setIsActive(false)}
      className="relative w-20 h-20 sm:w-24 sm:h-24 flex flex-col items-center justify-center active:scale-95 transition-transform duration-100 cursor-pointer border-none bg-transparent outline-none focus:outline-none touch-manipulation"
    >
      <ShabuPotShape isActive={isActive} />
      {/* White text with glow shadow for high legibility over colored soup background */}
      <span className="text-2xl sm:text-3xl font-black text-white text-glow leading-none select-none">{num}</span>
    </button>
  );
});

const PIN_KEYS = [
  { num: '1', letters: '' },
  { num: '2', letters: 'A B C' },
  { num: '3', letters: 'D E F' },
  { num: '4', letters: 'G H I' },
  { num: '5', letters: 'J K L' },
  { num: '6', letters: 'M N O' },
  { num: '7', letters: 'P Q R S' },
  { num: '8', letters: 'T U V' },
  { num: '9', letters: 'W X Y Z' },
];

export default function PinPage() {
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const router = useRouter();

  const handleNumberPress = React.useCallback((num: string) => {
    setPin(prev => {
      if (prev.length < 6) {
        setErrorMessage('');
        return prev + num;
      }
      return prev;
    });
  }, []);

  // Handle keyboard entry listener (0-9, Backspace, Esc/Delete)
  const handleBackspace = React.useCallback(() => {
    setPin(prev => {
      setErrorMessage('');
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = React.useCallback(() => {
    setPin('');
    setErrorMessage('');
  }, []);

  useEffect(() => {
    if (pin.length === 6) {
      const verifyPin = async () => {
        const res = await validateStaffPin(pin);
        if (res.success) {
          if (res.role === 'cashier') {
            router.push('/cashier');
          } else if (res.role === 'admin') {
            router.push('/admin');
          }
        } else {
          // Invalid PIN
          setIsShaking(true);
          setErrorMessage(res.error || 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
          const timer = setTimeout(() => {
            setIsShaking(false);
            setPin('');
          }, 1000); // Reset pin after shake duration
        }
      };
      verifyPin();
    }
  }, [pin, router]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        handleClear();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNumberPress, handleBackspace, handleClear]);

  return (
    <div className="relative w-screen h-screen h-[100dvh] bg-[#faf9f8] flex items-center justify-center overflow-hidden font-sans select-none">
      
      {/* Background Decorative Blur Blobs (Luxury Ambient Glow) */}
      <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[260px] h-[260px] rounded-full bg-[#af101a]/8 blur-[70px] pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-[#fdc003]/8 blur-[80px] pointer-events-none" />

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .keypad-shadow {
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.03));
        }
        .text-glow {
          text-shadow: 
            -1px -1px 0 rgba(0, 0, 0, 0.8),  
             1px -1px 0 rgba(0, 0, 0, 0.8),
            -1px  1px 0 rgba(0, 0, 0, 0.8),
             1px  1px 0 rgba(0, 0, 0, 0.8),
             0px 2px 4px rgba(0,0,0,0.6);
        }
      `}} />

      {/* Main Glass Card container - Full screen height on Mobile, Centered widget on Desktop */}
      <div className="w-full h-full sm:h-auto sm:max-w-sm p-6 sm:p-8 sm:bg-white/70 sm:backdrop-blur-xl sm:border sm:border-white/60 sm:shadow-[0_24px_70px_rgba(0,0,0,0.04)] sm:rounded-[40px] flex flex-col justify-between sm:justify-center items-center z-10 sm:gap-6">
        
        {/* Top Branding Section */}
        <div className="flex flex-col items-center text-center mt-6 sm:mt-0">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border border-[#af101a] mb-3 shadow-[0_8px_20px_rgba(175,16,26,0.12)] bg-white flex-shrink-0">
            <Image
              src="/logo.jpg"
              alt="ตี๋อ้วน สุกี้ชาบู Logo"
              width={128}
              height={128}
              priority
              sizes="128px"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#af101a] tracking-tight leading-tight">ตี๋อ้วน สุกี้ชาบู</h1>
          <p className="text-[10px] text-neutral-400 font-extrabold mt-1.5 uppercase tracking-widest">Staff Access Portal</p>
        </div>

        {/* Indicator dots */}
        <div className="flex flex-col items-center my-4 sm:my-0">
          <div className={`flex gap-5 mb-4 ${isShaking ? 'animate-shake' : ''}`}>
            {Array.from({ length: 6 }).map((_, i) => {
              const isActive = pin.length > i;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#af101a] to-[#db272e] border-[#af101a] scale-110 shadow-[0_0_12px_rgba(175,16,26,0.4)]' 
                      : 'bg-transparent border-[#af101a]/30'
                  }`}
                />
              );
            })}
          </div>
          {errorMessage ? (
            <p className="text-xs font-black text-red-600 tracking-wide text-center animate-pulse">{errorMessage}</p>
          ) : (
            <p className="text-xs font-bold text-neutral-400 tracking-wide">กรุณากรอกรหัส PIN 6 หลักเพื่อเข้าสู่ระบบ</p>
          )}
        </div>

        {/* Keyboard Panel with Shabu Pot buttons */}
        <div className="grid grid-cols-3 gap-y-4 gap-x-4 sm:gap-y-5 sm:gap-x-6 w-full max-w-[300px] sm:max-w-none justify-items-center">
          {PIN_KEYS.map((key) => (
            <ShabuKey
              key={key.num}
              num={key.num}
              onClick={handleNumberPress}
            />
          ))}
          
          {/* Row 4: Clear, 0, Backspace */}
          <button
            type="button"
            onClick={handleClear}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full text-[#af101a] hover:text-red-700 text-xs sm:text-sm font-black flex items-center justify-center transition-colors cursor-pointer active:scale-90"
          >
            ล้างรหัส
          </button>
          
          <ShabuKey
            num="0"
            onClick={handleNumberPress}
          />

          <button
            type="button"
            onClick={handleBackspace}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full text-[#af101a] hover:text-red-700 flex items-center justify-center transition-colors cursor-pointer active:scale-90"
            aria-label="ลบ"
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

      </div>
    </div>
  );
}
