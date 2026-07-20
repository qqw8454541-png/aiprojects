'use client';
import { useRef, ReactNode } from 'react';
import { motion, useAnimation, useMotionValue, PanInfo } from 'framer-motion';

interface SwipeableItemProps {
  children: ReactNode;
  onDelete: (skipConfirm?: boolean) => void;
  onEdit?: () => void;
  className?: string;
  bgClassName?: string;
}

export default function SwipeableItem({ 
  children, 
  onDelete, 
  onEdit, 
  className = '',
  bgClassName = 'bg-red-500 shadow-sm'
}: SwipeableItemProps) {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const isDragging = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragEnd = async (e: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -100 || velocity < -500) {
      await controls.start({ x: -window.innerWidth, transition: { duration: 0.2 } });
      onDelete(true);
    } else if (offset < -40) {
      controls.start({ x: -80, transition: { type: 'spring', bounce: 0, duration: 0.4 } });
    } else {
      controls.start({ x: 0, transition: { type: 'spring', bounce: 0, duration: 0.4 } });
    }
  };

  const startPress = () => {
    if (!onEdit) return;
    isDragging.current = false;
    timerRef.current = setTimeout(() => {
      if (!isDragging.current && Math.abs(x.get()) < 10) {
        onEdit();
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(50);
        }
      }
    }, 400);
  };

  const cancelPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden ${bgClassName}`}>
      <div 
        className="absolute inset-y-0 right-0 w-20 flex items-center justify-center text-white cursor-pointer"
        onClick={() => {
          controls.start({ x: -window.innerWidth, transition: { duration: 0.2 } }).then(() => onDelete(true));
        }}
      >
        <span className="text-2xl">🗑️</span>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragStart={() => { isDragging.current = true; cancelPress(); }}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        className={`relative z-10 w-full ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
