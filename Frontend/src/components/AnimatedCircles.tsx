import type { FC } from 'react';
import { useRef, useState, useEffect } from 'react';

export const AnimatedCircles: FC = () => {
  // Use a much larger grid to cover the entire left section (e.g., 55% of 1920x1080)
  // CELL_WIDTH = 48, CELL_HEIGHT = 44. 
  // 30 rows x 24 columns will cover roughly 1150px wide and 1320px tall
  const rows = Array.from({ length: 30 }, (_, i) => i + 1);
  const cols = Array.from({ length: 24 }, (_, i) => i + 1);

  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // Calculate coordinates relative to the AnimatedCircles container
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    // Track mouse globally so the effect works even when hovering over text
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const CELL_WIDTH = 48; // w-6 (24) + mx-3 (24)
  const CELL_HEIGHT = 44; // h-6 (24) + my-2.5 (20)

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-10 overflow-hidden flex flex-col pointer-events-none opacity-40 bg-transparent"
      style={{ 
        // Optional: fade out the edges so it blends beautifully with the dark background
        WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
        maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
      }}
    >
      {rows.map((row) => (
        <div key={`row-${row}`} className="flex w-full justify-start">
          {cols.map((col) => {
            const cellCenterX = (col - 1) * CELL_WIDTH + (CELL_WIDTH / 2);
            const cellCenterY = (row - 1) * CELL_HEIGHT + (CELL_HEIGHT / 2);
            
            let intensity = 0;
            if (isHovered) {
              const distance = Math.sqrt(
                Math.pow(mousePos.x - cellCenterX, 2) + 
                Math.pow(mousePos.y - cellCenterY, 2)
              );
              const maxDistance = 220; // Larger activation radius for a bigger screen
              intensity = Math.max(0, 1 - distance / maxDistance);
            }

            // Wrapper scale and opacity based on proximity
            const scale = 0.8 + (intensity * 0.7);
            const opacity = 0.2 + (intensity * 0.8);

            // Active circles get bright sky blue, inactive stays dim slate
            const bgColor = intensity > 0.05 ? 'rgba(56, 189, 248, 1)' : 'rgba(30, 41, 59, 1)';
            const shadow = intensity > 0.05 
              ? `0 0 ${24 * intensity}px rgba(56, 189, 248, ${intensity * 0.9})` 
              : 'none';
              
            // Animation speeds up as mouse gets closer
            const animationValue = intensity > 0.05 
              ? `spin-scale ${1.2 - intensity * 0.7}s linear infinite` 
              : `spin-scale 3s linear infinite`;

            return (
              <div
                key={`wrapper-${row}-${col}`}
                className="mx-3 my-2.5 flex items-center justify-center transition-all duration-300 ease-out"
                style={{ 
                  width: '1.5rem', 
                  height: '1.5rem',
                  transform: `scale(${scale})`,
                  opacity: opacity,
                }}
              >
                <div
                  className="w-full h-full rounded-full transition-colors duration-300"
                  style={{ 
                    backgroundColor: bgColor,
                    boxShadow: shadow,
                    animation: animationValue,
                    animationDelay: intensity > 0.05 ? '0s' : `${row * 150}ms`
                  }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
