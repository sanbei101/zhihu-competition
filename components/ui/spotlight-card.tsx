"use client";

import React, { useRef, useState, useCallback, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightRadius?: number;
}

/**
 * ReactBits SpotlightCard 组件
 * 随鼠标移动在卡片表面投射细腻的微光反光，无需复杂渐变 CSS，提升卡片交互质感
 */
export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.08)",
  spotlightRadius = 320,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative rounded-xl border border-border bg-card text-card-foreground overflow-hidden transition-all",
        className,
      )}
      {...props}
    >
      {/* 聚光灯微光层 */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${spotlightRadius}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-20 h-full">{children}</div>
    </div>
  );
}

export default SpotlightCard;
