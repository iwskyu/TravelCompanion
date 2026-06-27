import React from "react";
import { motion } from "motion/react";

interface TacticalCompassIconProps {
  size?: "sm" | "md" | "lg" | "xl";
}

export function TacticalCompassIcon({ size = "sm" }: TacticalCompassIconProps) {
  // Size variations
  let outerClass = "w-8 h-8";
  let innerClass = "w-6.5 h-6.5";
  let arrowNorthBorder = "border-l-[3.5px] border-r-[3.5px] border-b-[9px] top-1";
  let arrowSouthBorder = "border-l-[3.5px] border-r-[3.5px] border-t-[9px] bottom-1";
  let pinClass = "w-1.5 h-1.5";
  let glowShadow = "shadow-[0_0_10px_rgba(14,165,233,0.3)]";

  if (size === "md") {
    outerClass = "w-16 h-16";
    innerClass = "w-13 h-13";
    arrowNorthBorder = "border-l-[6px] border-r-[6px] border-b-[18px] top-2";
    arrowSouthBorder = "border-l-[6px] border-r-[6px] border-t-[18px] bottom-2";
    pinClass = "w-3 h-3";
    glowShadow = "shadow-[0_0_15px_rgba(14,165,233,0.4)]";
  } else if (size === "lg") {
    outerClass = "w-24 h-24";
    innerClass = "w-20 h-20";
    arrowNorthBorder = "border-l-[8px] border-r-[8px] border-b-[28px] top-2.5";
    arrowSouthBorder = "border-l-[8px] border-r-[8px] border-t-[28px] bottom-2.5";
    pinClass = "w-4 h-4";
    glowShadow = "shadow-[0_0_25px_rgba(14,165,233,0.5)]";
  } else if (size === "xl") {
    outerClass = "w-32 h-32";
    innerClass = "w-26 h-26";
    arrowNorthBorder = "border-l-[11px] border-r-[11px] border-b-[38px] top-3";
    arrowSouthBorder = "border-l-[11px] border-r-[11px] border-t-[38px] bottom-3";
    pinClass = "w-5 h-5";
    glowShadow = "shadow-[0_0_35px_rgba(14,165,233,0.6)]";
  }

  return (
    <div className={`relative ${outerClass} flex items-center justify-center shrink-0`}>
      {/* Outer rotating bezel */}
      <div className={`absolute inset-0 rounded-full border border-slate-700 bg-slate-950 ${glowShadow} animate-[spin_40s_linear_infinite] flex items-center justify-center`}>
        {/* Tactical crosshair lines */}
        <div className="absolute w-[1px] h-full bg-slate-800/80" />
        <div className="absolute h-[1px] w-full bg-slate-800/80" />
        {/* Bezel dots */}
        <div className="absolute top-0.5 w-1 h-1 rounded-full bg-rose-500" />
        <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-slate-600" />
        <div className="absolute left-0.5 w-1 h-1 rounded-full bg-slate-600" />
        <div className="absolute right-0.5 w-1 h-1 rounded-full bg-slate-600" />
      </div>
      
      {/* Inner dial */}
      <div className={`absolute ${innerClass} rounded-full border border-sky-500/40 bg-slate-900 flex items-center justify-center`}>
        {/* Compass needle */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          className="relative w-full h-full flex items-center justify-center"
        >
          {/* North pointer: sharp neon orange triangle */}
          <div className={`absolute w-0 h-0 border-l-transparent border-r-transparent border-b-amber-500 drop-shadow-[0_0_2px_rgba(245,158,11,0.6)] ${arrowNorthBorder}`} />
          {/* South pointer: silver triangle */}
          <div className={`absolute w-0 h-0 border-l-transparent border-r-transparent border-t-slate-500 ${arrowSouthBorder}`} />
          {/* Center pin */}
          <div className={`${pinClass} rounded-full bg-slate-200 border border-slate-800 z-10 shadow-sm`} />
        </motion.div>
      </div>
    </div>
  );
}
