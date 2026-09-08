import { useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
const HERO_IMG =
  'https://www.rockstargames.com/VI/_next/static/media/Jason_and_Lucia_Robbery_landscape.09c8a~do21h4p.jpg?akim=1&imdensity=1&imwidth=3840';
const LOGO_IMG =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/Grand_Theft_Auto_VI_logo_%28with_gradient%29.svg/1280px-Grand_Theft_Auto_VI_logo_%28with_gradient%29.svg.png?utm_source=simple.wikipedia.org&utm_campaign=index&utm_content=thumbnail';

const SECTIONS = [
  {
    img: 'https://oyster.ignimgs.com/mediawiki/apis.ign.com/gta-6/4/42/Vlcsnap-2023-12-04-18h59m30s080.png',
    title: 'Leonida',
    text: 'Palm trees at sunset, neon lights, and bustling coastal cities—the new world inspired by Vice City is now bigger, more vibrant, and more detailed.',
    align: 'left',
  },
  {
    img: 'https://cdn.mos.cms.futurecdn.net/9uJvFhNUF9bhHHyCEbRHaD.jpg',
    title: 'Two heroes, one path',
    text: 'Jason and Lucia are the only two people who trust each other. Their story is not about money, but about the struggle to survive together.',
    align: 'right',
  },
  {
    img: 'https://cdn.mos.cms.futurecdn.net/EhSthkSscGVzbZ78QNNiGD.jpg',
    title: 'The city never sleeps.',
    text: 'Every street and every neighborhood has its own story. This time, Rockstar has created a world that is far deeper and more alive than before.',
    align: 'left',
  },
  {
    img: 'https://kotaku.com/app/uploads/2026/06/ULTIMATE_EDITION_01-1200x675.jpg',
    title: 'Jason and Lucia',
    text: 'Rather than just cosmetics',
    align: 'right',
  },
  {
    img: 'https://www.gamespot.com/wp-content/uploads/2026/07/Real_Dimez_landscape_3bb4fa.jpg',
    title: 'Real Dimez',
    text: "Leonida's street culture is a battle for fashion, music, and status. In this world, everything depends on appearances.",
    align: 'left',
  },
];

const RELEASE_DATE = new Date('2026-11-19T00:00:00');

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------
function useCountdown(target: Date) {
  const [remaining, setRemaining] = useState(
    () => target.getTime() - Date.now(),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(target.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const clamped = Math.max(0, remaining);
  const days = Math.floor(clamped / (1000 * 60 * 60 * 24));
  const hours = Math.floor((clamped / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((clamped / (1000 * 60)) % 60);
  const seconds = Math.floor((clamped / 1000) % 60);

  return { days, hours, minutes, seconds, done: clamped <= 0 };
}

// ---------------------------------------------------------------------------
// Reveal-on-scroll hook (IntersectionObserver based)
// ---------------------------------------------------------------------------
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// ---------------------------------------------------------------------------
// Parallax section (scroll-driven background movement)
// ---------------------------------------------------------------------------
function ParallaxPanel({
  img,
  title,
  text,
  align,
}: {
  img: string;
  title: string;
  text: string;
  align: 'left' | 'right';
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);
  const { ref: revealRef, visible } = useReveal<HTMLDivElement>();

  const onScroll = useCallback(() => {
    const wrap = wrapRef.current;
    const imgEl = imgRef.current;
    if (!wrap || !imgEl) return;
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = (vh - rect.top) / (vh + rect.height); // 0 -> 1 across viewport transit
    const clamped = Math.min(1, Math.max(0, progress));
    const shift = (clamped - 0.5) * 60; // -30px .. +30px
    imgEl.style.transform = `scale(1.15) translateY(${shift}px)`;
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [onScroll]);

  return (
    <section className="panel" ref={wrapRef}>
      <div
        className="panel-media"
        ref={imgRef}
        style={{ backgroundImage: `url(${img})` }}
      />
      <div className="panel-scrim" />
      <div
        ref={revealRef}
        className={`panel-copy panel-copy--${align} ${visible ? 'is-visible' : ''}`}
      >
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Countdown digit block
// ---------------------------------------------------------------------------
function TimeBlock({ value, label }: { value: number; label: string }) {
  const padded = String(value).padStart(2, '0');
  return (
    <div className="time-block">
      <span className="time-value">{padded}</span>
      <span className="time-label">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function ViCountdown() {
  const { days, hours, minutes, seconds } = useCountdown(RELEASE_DATE);
  const heroImgRef = useRef<HTMLDivElement | null>(null);

  // subtle hero parallax on scroll
  useEffect(() => {
    const onScroll = () => {
      const el = heroImgRef.current;
      if (!el) return;
      const y = window.scrollY;
      el.style.transform = `scale(1.1) translateY(${y * 0.25}px)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="vi-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Sora:wght@400;500;600;700&display=swap');

        .vi-root {
          --bg: #0a0714;
          --bg-soft: #140b24;
          --pink: #ff3f9e;
          --pink-soft: #ff8fc4;
          --cyan: #2fe8d6;
          --gold: #ffcf6b;
          --text: #f4eefc;
          --text-dim: rgba(244,238,252,0.68);
          font-family: 'Sora', sans-serif;
          background: var(--bg);
          color: var(--text);
          overflow-x: hidden;
        }

        .vi-root * { box-sizing: border-box; margin: 0; padding: 0; }

        @media (prefers-reduced-motion: reduce) {
          .vi-root * { transition: none !important; animation: none !important; }
        }

        /* ---------- HERO ---------- */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .hero-media {
          position: absolute;
          inset: -5%;
          background-image: url('${HERO_IMG}');
          background-size: cover;
          background-position: center 30%;
          filter: blur(6px) brightness(0.55) saturate(1.1);
          will-change: transform;
        }
        .hero-gradient {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 30%, rgba(20,11,36,0.15) 0%, rgba(10,7,20,0.75) 65%, rgba(10,7,20,0.97) 100%),
            linear-gradient(180deg, rgba(10,7,20,0.35) 0%, rgba(10,7,20,0.15) 30%, rgba(10,7,20,0.9) 100%);
        }
        .hero-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 24px;
          max-width: 900px;
        }
        .hero-logo {
          width: min(78vw, 560px);
          filter: drop-shadow(0 12px 40px rgba(255, 63, 158, 0.35));
          animation: logo-in 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes logo-in {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hero-tag {
          margin-top: 18px;
          font-size: clamp(0.95rem, 2vw, 1.15rem);
          color: var(--text-dim);
          letter-spacing: 0.01em;
          animation: fade-up 1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .countdown {
          margin-top: 44px;
          display: flex;
          gap: clamp(10px, 3vw, 28px);
          animation: fade-up 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
        }
        .time-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 64px;
        }
        .time-value {
          font-family: 'Anton', sans-serif;
          font-size: clamp(2.4rem, 7vw, 4.2rem);
          line-height: 1;
          background: linear-gradient(180deg, var(--pink-soft), var(--pink) 55%, var(--cyan));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          letter-spacing: 0.01em;
        }
        .time-label {
          margin-top: 6px;
          font-size: 0.78rem;
          color: var(--text-dim);
        }

        .release-line {
          margin-top: 34px;
          font-size: clamp(1rem, 2.4vw, 1.3rem);
          color: var(--text);
          animation: fade-up 1s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
        }
        .release-line b {
          color: var(--cyan);
          font-weight: 600;
        }
        .platforms {
          margin-top: 12px;
          font-size: 0.92rem;
          color: var(--text-dim);
          max-width: 460px;
          animation: fade-up 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both;
        }

        .scroll-hint {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 36px;
          border: 2px solid rgba(244,238,252,0.35);
          border-radius: 12px;
          z-index: 2;
        }
        .scroll-hint::after {
          content: '';
          position: absolute;
          top: 6px;
          left: 50%;
          width: 4px;
          height: 8px;
          background: var(--cyan);
          border-radius: 2px;
          transform: translateX(-50%);
          animation: scroll-dot 1.6s ease-in-out infinite;
        }
        @keyframes scroll-dot {
          0% { top: 6px; opacity: 1; }
          70% { top: 18px; opacity: 0; }
          100% { top: 6px; opacity: 0; }
        }

        /* ---------- PANELS ---------- */
        .panel {
          position: relative;
          min-height: 88vh;
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .panel-media {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          will-change: transform;
        }
        .panel-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(10,7,20,0.92) 0%, rgba(10,7,20,0.55) 42%, rgba(10,7,20,0.25) 65%, rgba(10,7,20,0.85) 100%);
        }
        .panel:nth-child(odd) .panel-scrim {
          background: linear-gradient(270deg, rgba(10,7,20,0.92) 0%, rgba(10,7,20,0.55) 42%, rgba(10,7,20,0.25) 65%, rgba(10,7,20,0.85) 100%);
        }
        .panel-copy {
          position: relative;
          z-index: 2;
          max-width: 460px;
          padding: 32px;
          opacity: 0;
          transform: translateY(36px);
          transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .panel-copy.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .panel-copy--left { margin-right: auto; margin-left: 6vw; text-align: left; }
        .panel-copy--right { margin-left: auto; margin-right: 6vw; text-align: right; }
        .panel-copy h2 {
          font-family: 'Anton', sans-serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 400;
          line-height: 1.05;
          background: linear-gradient(90deg, var(--pink-soft), var(--cyan));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .panel-copy p {
          margin-top: 16px;
          font-size: clamp(0.95rem, 1.6vw, 1.08rem);
          line-height: 1.6;
          color: var(--text-dim);
        }

        /* ---------- FOOTER ---------- */
        .footer {
          position: relative;
          padding: 90px 24px 60px;
          text-align: center;
          background: radial-gradient(ellipse at 50% 0%, rgba(255,63,158,0.08), transparent 60%), var(--bg-soft);
        }
        .footer-logo {
          width: min(60vw, 300px);
          margin: 0 auto 22px;
          display: block;
          filter: drop-shadow(0 8px 24px rgba(47,232,214,0.2));
        }
        .footer-date {
          font-family: 'Anton', sans-serif;
          font-size: clamp(1.4rem, 3vw, 2rem);
          color: var(--text);
        }
        .footer-sub {
          margin-top: 10px;
          font-size: 0.85rem;
          color: var(--text-dim);
        }

        @media (max-width: 640px) {
          .panel { min-height: 80vh; }
          .panel-copy--left, .panel-copy--right { margin-left: 20px; margin-right: 20px; text-align: left; }
        }
      `}</style>

      {/* HERO */}
      <header className="hero">
        <div className="hero-media" ref={heroImgRef} />
        <div className="hero-gradient" />
        <div className="hero-content">
          <img className="hero-logo" src={LOGO_IMG} alt="Grand Theft Auto VI" />
          <p className="hero-tag">Leonida is waiting for you.</p>

          <div className="countdown">
            <TimeBlock value={days} label="day" />
            <TimeBlock value={hours} label="hour" />
            <TimeBlock value={minutes} label="minute" />
            <TimeBlock value={seconds} label="second" />
          </div>

          <p className="release-line">
            Release date: <b>November 19, 2026</b>
          </p>
          <p className="platforms">
            It will be released on Xbox Series X|S, PlayStation 5, and
            PlayStation 5 Pro platforms.
          </p>
        </div>
        <div className="scroll-hint" />
      </header>

      {/* SCROLL PANELS */}
      {SECTIONS.map((s) => (
        <ParallaxPanel
          key={s.title}
          img={s.img}
          title={s.title}
          text={s.text}
          align={s.align as 'left' | 'right'}
        />
      ))}

      {/* FOOTER */}
      <footer className="footer">
        <img className="footer-logo" src={LOGO_IMG} alt="Grand Theft Auto VI" />
        <p className="footer-date">November 19, 2026</p>
        <p className="footer-sub">Rockstar Games presents.</p>
      </footer>
    </div>
  );
}

export default ViCountdown;
