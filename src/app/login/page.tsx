'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Delete } from 'lucide-react';
import { validateStaffPin } from '../actions';

// Custom SVG Shabu Pot shape in active brand color style matching cashier page's occupied table pot
function ShabuPotShape({ className = "w-full h-full absolute inset-0 -z-10", isActive = false }) {
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
      className={`${className} transition-all duration-200 group-hover:scale-105 ${isActive ? 'scale-95 brightness-90' : 'group-hover:drop-shadow-[0_4px_8px_rgba(175,16,26,0.15)]'}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Handles */}
      <rect x="8" y="44" width="8" height="12" rx="4" fill={handleFill} className={`${strokeColor} transition-colors duration-150`} strokeWidth="2" />
      <rect x="84" y="44" width="8" height="12" rx="4" fill={handleFill} className={`${strokeColor} transition-colors duration-150`} strokeWidth="2" />

      {/* Main Pot Outer Ring */}
      <circle cx="50" cy="50" r="36" fill={potOuterFill} className={`${strokeColor} transition-colors duration-150`} strokeWidth="2" />
      <circle cx="50" cy="50" r="33" fill={potInnerShadow} className="transition-colors duration-150" /> {/* Inner wall shadow */}
      
      {/* Left Spicy Soup (Red Mala) - S-curve boundary */}
      <path 
        d="M 50 20 A 30 30 0 0 0 50 80 C 33 65, 67 35, 50 20 Z" 
        fill={soupLeft} 
        className="transition-colors duration-150"
      />
      
      {/* Right Clear/Gold Soup (Sukiyaki Black) - S-curve boundary */}
      <path 
        d="M 50 20 C 67 35, 33 65, 50 80 A 30 30 0 0 0 50 20 Z" 
        fill={soupRight} 
        className="transition-colors duration-150"
      />

      {/* Yin-Yang S-Curve Divider */}
      <path 
        d="M 50 20 C 67 35, 33 65, 50 80" 
        className={`${strokeColor} transition-colors duration-150`} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
      
      {/* Pot Rim Stroke */}
      <circle cx="50" cy="50" r="30" className={`${strokeColor} transition-colors duration-150`} strokeWidth="2.5" />
    </svg>
  );
}

interface ShabuKeyProps {
  num: string;
  onClick: (num: string) => void;
}

function ShabuKey({ num, onClick }: ShabuKeyProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onClick(num)}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      onMouseLeave={() => setIsActive(false)}
      onTouchStart={() => setIsActive(true)}
      onTouchEnd={() => setIsActive(false)}
      className="group relative w-20 h-20 sm:w-24 sm:h-24 flex flex-col items-center justify-center active:scale-95 transition-all duration-150 cursor-pointer border-none bg-transparent outline-none focus:outline-none"
    >
      <ShabuPotShape isActive={isActive} />
      {/* White text with glow shadow for high legibility over colored soup background */}
      <span className="text-2xl sm:text-3xl font-black text-white text-glow leading-none select-none">{num}</span>
    </button>
  );
}

export default function PinPage() {
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const router = useRouter();

  function handleNumberPress(num: string) {
    setPin(prev => {
      if (prev.length < 6) {
        setErrorMessage('');
        return prev + num;
      }
      return prev;
    });
  }

  // Handle keyboard entry listener (0-9, Backspace, Esc/Delete)
  function handleBackspace() {
    setPin(prev => {
      setErrorMessage('');
      return prev.slice(0, -1);
    });
  }

  function handleClear() {
    setPin('');
    setErrorMessage('');
  }

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
  }, []);

  // Passcode keys details (iOS high-end passcode vibe)
  const keys = [
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

  return (
    <div className="relative w-screen h-screen h-[100dvh] bg-[#faf9f8] flex items-center justify-center overflow-hidden font-sans select-none">
      
      {/* Hidden SVG Filter for Swirling Fluid Smoke Turbulence */}
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <filter id="smokeFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise">
              <animate attributeName="baseFrequency" dur="25s" values="0.01 0.015;0.02 0.025;0.01 0.015" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="70" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Animated Smoke/Steam Floating Background Effect */}
      <div className="smoke-particle smoke-1" />
      <div className="smoke-particle smoke-2" />
      <div className="smoke-particle smoke-3" />
      <div className="smoke-particle smoke-4" />
      <div className="smoke-particle smoke-5" />

      {/* Background Decorative Blur Blobs (Luxury Ambient Glow) */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-[#af101a]/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#fdc003]/8 blur-[120px] pointer-events-none" />

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
        @keyframes smokeRise {
          0% {
            transform: translateY(110vh) translateX(0) scale(0.6) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 0.85;
          }
          50% {
            transform: translateY(50vh) translateX(60px) scale(1.3) rotate(180deg);
            opacity: 0.95;
          }
          85% {
            opacity: 0.55;
          }
          100% {
            transform: translateY(-20vh) translateX(-60px) scale(1.8) rotate(360deg);
            opacity: 0;
          }
        }
        .smoke-particle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(253, 192, 3, 0.22) 35%, rgba(175, 16, 26, 0.1) 60%, rgba(175, 16, 26, 0) 80%);
          filter: url(#smokeFilter) blur(20px);
          pointer-events: none;
          opacity: 0;
          z-index: 1;
        }
        .smoke-1 {
          width: 250px;
          height: 250px;
          left: 10%;
          animation: smokeRise 25s linear infinite;
        }
        .smoke-2 {
          width: 320px;
          height: 320px;
          left: 40%;
          animation: smokeRise 32s linear infinite;
          animation-delay: -8s;
        }
        .smoke-3 {
          width: 210px;
          height: 210px;
          left: 70%;
          animation: smokeRise 20s linear infinite;
          animation-delay: -4s;
        }
        .smoke-4 {
          width: 280px;
          height: 280px;
          left: 25%;
          animation: smokeRise 28s linear infinite;
          animation-delay: -14s;
        }
        .smoke-5 {
          width: 230px;
          height: 230px;
          left: 85%;
          animation: smokeRise 23s linear infinite;
          animation-delay: -18s;
        }
      `}} />

      {/* Main Glass Card container - Full screen height on Mobile, Centered widget on Desktop */}
      <div className="w-full h-full sm:h-auto sm:max-w-sm p-6 sm:p-8 sm:bg-white/70 sm:backdrop-blur-xl sm:border sm:border-white/60 sm:shadow-[0_24px_70px_rgba(0,0,0,0.04)] sm:rounded-[40px] flex flex-col justify-between sm:justify-center items-center z-10 sm:gap-6">
        
        {/* Top Branding Section */}
        <div className="flex flex-col items-center text-center mt-6 sm:mt-0">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border border-[#af101a] mb-3 shadow-[0_8px_20px_rgba(175,16,26,0.12)] bg-white flex-shrink-0">
            <img src="/logo.jpg" alt="ตี๋อ้วน สุกี้ชาบู Logo" className="w-full h-full object-cover" />
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
          {keys.map((key) => (
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
