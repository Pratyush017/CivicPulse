import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { SlidersHorizontal } from 'lucide-react';

type MenuItem = {
  label: string | ReactNode;
  href: string;
  ariaLabel?: string;
  rotation?: number;
  hoverStyles?: {
    bgColor?: string;
    textColor?: string;
  };
  onClick?: () => void;
};

export type BubbleMenuProps = {
  logo: ReactNode | string;
  onMenuClick?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
  menuAriaLabel?: string;
  menuBg?: string;
  menuContentColor?: string;
  useFixedPosition?: boolean;
  items?: MenuItem[];
  animationEase?: string;
  animationDuration?: number;
  staggerDelay?: number;
};

const DEFAULT_ITEMS: MenuItem[] = [
  {
    label: 'home',
    href: '#',
    ariaLabel: 'Home',
    rotation: -8,
    hoverStyles: { bgColor: '#3b82f6', textColor: '#ffffff' }
  }
];

export default function BubbleMenu({
  logo,
  onMenuClick,
  className,
  style,
  menuAriaLabel = 'Toggle menu',
  menuBg = '#fff',
  menuContentColor = '#111',
  useFixedPosition = false,
  items,
  animationEase = 'back.out(1.5)',
  animationDuration = 0.5,
  staggerDelay = 0.35
}: BubbleMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLAnchorElement[]>([]);
  const labelRefs = useRef<HTMLSpanElement[]>([]);

  const menuItems = items?.length ? items : DEFAULT_ITEMS;

  const containerClassName = [
    'bubble-menu',
    className || (useFixedPosition ? 'fixed left-0 right-0 top-8' : 'absolute left-0 right-0 top-8'),
    'flex items-center',
    logo ? 'justify-between' : 'justify-end',
    logo ? 'gap-4 px-8' : '',
    'pointer-events-none',
    'z-[1001]'
  ]
    .filter(Boolean)
    .join(' ');

  const handleToggle = () => {
    const nextState = !isMenuOpen;
    if (nextState) setShowOverlay(true);
    setIsMenuOpen(nextState);
    onMenuClick?.(nextState);
  };

  const closeMenu = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      onMenuClick?.(false);
    }
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    const bubbles = bubblesRef.current.filter(Boolean);
    const labels = labelRefs.current.filter(Boolean);
    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(labels, { y: 24, autoAlpha: 0 });

      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        
        // Generate random target scale and rotation for organic bubble feel
        const targetScale = gsap.utils.random(0.85, 1.15);
        const targetRot = gsap.utils.random(-15, 15);
        
        const tl = gsap.timeline({ delay });
        tl.to(bubble, {
          scale: targetScale,
          rotation: targetRot,
          duration: animationDuration,
          ease: animationEase,
          onComplete: () => {
            // Add continuous floating animation from the new base rotation and scale
            gsap.to(bubble, {
              y: 'random(-10, 10)',
              x: 'random(-10, 10)',
              rotation: `random(${targetRot - 8}, ${targetRot + 8})`,
              scale: `random(${targetScale - 0.05}, ${targetScale + 0.05})`,
              duration: 'random(2, 4)',
              repeat: -1,
              yoyo: true,
              ease: 'sine.inOut'
            });
          }
        });
        if (labels[i]) {
          tl.to(
            labels[i],
            {
              y: 0,
              autoAlpha: 1,
              duration: animationDuration,
              ease: 'power3.out'
            },
            '-=' + animationDuration * 0.9
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, {
        y: 24,
        autoAlpha: 0,
        duration: 0.2,
        ease: 'power3.in'
      });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.2,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' });
          setShowOverlay(false);
        }
      });
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay]);

  useEffect(() => {
    const handleResize = () => {
      if (isMenuOpen) {
        const bubbles = bubblesRef.current.filter(Boolean);
        const isDesktop = window.innerWidth >= 900;
        bubbles.forEach((bubble, i) => {
          const item = menuItems[i];
          if (bubble && item) {
            const rotation = isDesktop ? (item.rotation ?? 0) : 0;
            gsap.set(bubble, { rotation });
          }
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen, menuItems]);

  return (
    <>
      {/* Workaround for silly Tailwind capabilities */}
      <style>{`
        .bubble-menu .menu-line {
          transition: transform 0.3s ease, opacity 0.3s ease;
          transform-origin: center;
        }
        .bubble-menu-items .pill-list .pill-col:nth-child(4):nth-last-child(2) {
          margin-left: calc(100% / 6);
        }
        .bubble-menu-items .pill-list .pill-col:nth-child(4):last-child {
          margin-left: calc(100% / 3);
        }
        @media (min-width: 900px) {
          .bubble-menu-items .pill-link {
            transform: rotate(var(--item-rot));
          }
          .bubble-menu-items .pill-link:hover {
            transform: rotate(var(--item-rot)) scale(1.06);
            background: var(--hover-bg) !important;
            color: var(--hover-color) !important;
          }
          .bubble-menu-items .pill-link:active {
            transform: rotate(var(--item-rot)) scale(.94);
          }
        }
        @media (max-width: 899px) {
          .bubble-menu-items {
            padding-top: 40px;
            align-items: center;
          }
          .bubble-menu-items .pill-list {
            gap: 20px;
            justify-content: center;
          }
          .bubble-menu-items .pill-list .pill-col {
            flex: 0 0 auto !important;
            margin-left: 0 !important;
            overflow: visible;
          }
          .bubble-menu-items .pill-link {
            font-size: clamp(1rem, 3vw, 2rem);
            padding: 1rem;
            width: 130px;
            height: 130px;
            min-height: auto !important;
            border-radius: 50% !important;
          }
          .bubble-menu-items .pill-link:active {
            transform: scale(.94);
          }
        }
      `}</style>

      <nav className={containerClassName} style={style} aria-label="Main navigation">
        {logo && (
          <div
            className={[
              'bubble logo-bubble',
              'inline-flex items-center justify-center',
              'rounded-full',
              'bg-[#050505]',
              'shadow-[0_4px_16px_rgba(0,0,0,0.12)]',
              'pointer-events-auto',
              'h-9 md:h-10',
              'px-2 md:px-4',
              'gap-2',
              'will-change-transform'
            ].join(' ')}
            aria-label="Logo"
            style={{
              background: menuBg,
              minHeight: '36px',
              borderRadius: '9999px'
            }}
          >
            <span
              className={['logo-content', 'inline-flex items-center justify-center', 'w-[120px] h-full'].join(' ')}
              style={
                {
                  ['--logo-max-height']: '60%',
                  ['--logo-max-width']: '100%'
                } as CSSProperties
              }
            >
              {typeof logo === 'string' ? (
                <img src={logo} alt="Logo" className="bubble-logo max-h-[60%] max-w-full object-contain block" />
              ) : (
                logo
              )}
            </span>
          </div>
        )}

        <button
          type="button"
          className={[
            'bubble toggle-bubble menu-btn',
            isMenuOpen ? 'open' : '',
            'inline-flex flex-col items-center justify-center',
            'rounded-full',
            'bg-teal-500/12',
            'backdrop-blur-md',
            'shadow-[0_4px_16px_rgba(0,0,0,0.12)]',
            'pointer-events-auto',
            'w-9 h-9',
            'border border-teal-500/25 cursor-pointer p-0 hover:bg-teal-500/20 transition-colors',
            'will-change-transform'
          ].join(' ')}
          onClick={handleToggle}
          aria-label={menuAriaLabel}
          aria-pressed={isMenuOpen}
        >
          <SlidersHorizontal className={`size-[18px] text-teal-400 transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : ''}`} />
        </button>
      </nav>

      {showOverlay && (
        <div
          ref={overlayRef}
          className={[
            'bubble-menu-items',
            'fixed',
            'inset-0',
            'flex items-center justify-center',
            'pointer-events-none',
            'z-[1000]',
            'bg-[#020617]/70 backdrop-blur-xl'
          ].join(' ')}
          aria-hidden={!isMenuOpen}
          onClick={closeMenu}
        >
          <ul
            className={[
              'pill-list',
              'list-none m-0 px-6',
              'w-full max-w-[1600px] mx-auto',
              'flex flex-wrap',
              'gap-x-0 gap-y-1',
              'pointer-events-auto'
            ].join(' ')}
            role="menu"
            aria-label="Menu links"
            onClick={(e) => e.stopPropagation()}
          >
            {menuItems.map((item, idx) => (
              <li
                key={idx}
                role="none"
                className={[
                  'pill-col',
                  'flex justify-center items-center',
                  'box-border'
                ].join(' ')}
              >
                <a
                  role="menuitem"
                  href={item.href}
                  aria-label={item.ariaLabel || (typeof item.label === 'string' ? item.label : '')}
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.onClick) item.onClick();
                    closeMenu();
                  }}
                  className={[
                    'pill-link',
                    'rounded-full',
                    'no-underline',
                    'bg-[#0f172a]',
                    'text-slate-300',
                    'border border-slate-800',
                    'shadow-[0_8px_32px_rgba(0,0,0,0.40)]',
                    'flex items-center justify-center',
                    'relative',
                    'transition-[background,color,border-color] duration-300 ease-in-out',
                    'box-border',
                    'overflow-hidden'
                  ].join(' ')}
                  style={
                    {
                      ['--item-rot']: `${item.rotation ?? 0}deg`,
                      ['--hover-bg']: item.hoverStyles?.bgColor || '#1e293b',
                      ['--hover-color']: item.hoverStyles?.textColor || '#ffffff',
                      width: 'clamp(140px, 15vw, 200px)',
                      height: 'clamp(140px, 15vw, 200px)',
                      fontWeight: 500,
                      lineHeight: 0,
                      willChange: 'transform'
                    } as CSSProperties
                  }
                  ref={el => {
                    if (el) bubblesRef.current[idx] = el;
                  }}
                >
                  <span
                    className="pill-label flex items-center justify-center w-full"
                    style={{
                      willChange: 'transform, opacity',
                      height: '100%',
                      lineHeight: 1.2
                    }}
                    ref={el => {
                      if (el) labelRefs.current[idx] = el;
                    }}
                  >
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
