import { images } from '@/shared/assets/images';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Progress animation
    const steps = [
      { target: 30, delay: 200 },
      { target: 60, delay: 400 },
      { target: 85, delay: 300 },
      { target: 100, delay: 250 },
    ];

    let current = 0;
    let timer: ReturnType<typeof setTimeout>;

    function runStep() {
      if (current >= steps.length) {
        // End — fade out
        setTimeout(() => setFadeOut(true), 150);
        setTimeout(() => onFinish(), 650);
        return;
      }
      const { target, delay } = steps[current];
      timer = setTimeout(() => {
        setProgress(target);
        current++;
        runStep();
      }, delay);
    }

    // 300ms kechiktirib boshlash (UI render bo'lsin)
    const startTimer = setTimeout(runStep, 300);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#14110E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease',
        userSelect: 'none',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,87,0.12) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -60%)',
        pointerEvents: 'none',
      }} />

      {/* Logo / Brand */}
      <div style={{ textAlign: 'center', marginBottom: 48, position: 'relative' }}>
        {/* Animated icon */}
        {/* <div style={{
          width: 80,
          height: 80,
          borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(217,119,87,0.25) 0%, rgba(217,119,87,0.08) 100%)',
          border: '1.5px solid rgba(217,119,87,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 0 40px rgba(217,119,87,0.15)',
          animation: 'splashPulse 2s ease-in-out infinite',
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 6L32 13V27L20 34L8 27V13L20 6Z"
              stroke="#D97757"
              strokeWidth="1.5"
              fill="none"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="20" r="5" fill="#D97757" opacity="0.8" />
            <circle cx="20" cy="20" r="2" fill="#D97757" />
          </svg>
        </div> */}

        <img src={images.brands.logo_png} alt="Yolnoma" />

        <p style={{
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(217,119,87,0.7)',
          fontFamily: '"Inter", sans-serif',
          fontWeight: 600,
          marginBottom: 8,
        }}>
          JK Software
        </p>
        <h1 style={{
          fontSize: 36,
          fontWeight: 500,
          fontFamily: '"Georgia", serif',
          color: '#F2EDE6',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Yolnoma
        </h1>
        <p style={{
          fontSize: 13,
          color: 'rgba(242,237,230,0.35)',
          fontFamily: '"Inter", sans-serif',
          marginTop: 6,
          margin: '6px 0 0',
        }}>
          Swiss Army Knife
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: 200, position: 'relative' }}>
        <div style={{
          height: 2,
          background: 'rgba(242,237,230,0.07)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #D97757, rgba(217,119,87,0.6))',
            borderRadius: 4,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 8px rgba(217,119,87,0.5)',
          }} />
        </div>
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(242,237,230,0.25)',
          fontFamily: '"Inter", sans-serif',
          marginTop: 12,
          letterSpacing: '0.05em',
        }}>
          {progress < 60 ? 'Loading...' : progress < 100 ? 'Almost ready...' : 'Ready!'}
        </p>
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { box-shadow: 0 0 40px rgba(217,119,87,0.15); }
          50% { box-shadow: 0 0 60px rgba(217,119,87,0.30); }
        }
      `}</style>
    </div>
  );
}
