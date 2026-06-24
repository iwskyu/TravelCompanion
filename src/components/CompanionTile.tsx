/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TileConfig, CompanionData } from "../types";

interface CompanionTileProps {
  key?: string | number;
  config: TileConfig;
  data: CompanionData;
  deviceHeading: number | null;
  lastUpdatedTime: number; // 最終更新のタイムスタンプ
  onClick?: () => void; // タップ/クリックで即情報更新するイベントハンドラー
}

export function CompanionTile({
  config,
  data,
  deviceHeading,
  lastUpdatedTime,
  onClick,
}: CompanionTileProps) {
  const [isFlashing, setIsFlashing] = useState(false);

  let valueContent: React.ReactNode = "-";
  try {
    valueContent = config.render(data, deviceHeading);
  } catch (err) {
    console.error(`Error rendering tile ${config.id}:`, err);
    valueContent = "エラー";
  }
  const valueString = typeof valueContent === "string" ? valueContent : "";

  const prevValueRef = React.useRef<string>(valueString);

  // データの最終更新時刻が変わったら一時的に黄色にする（フラッシュ演出）
  useEffect(() => {
    // 傾き、方角、周囲の静かさは黄色に光らせない（常時光ることになるため）
    if (config.id === "tilt" || config.id === "bearing" || config.id === "dbLevel") {
      return;
    }
    
    const hasChanged = prevValueRef.current !== valueString;
    prevValueRef.current = valueString;

    if (lastUpdatedTime > 0 && hasChanged) {
      setIsFlashing(true);
      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, 750); // 0.75秒間黄色（半分の時間）
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedTime, valueString, config.id]);

  // 文字数に応じてフォントサイズを決定。枠内に収まるできるだけ大きいサイズにし、統一感を出す
  // ユーザー要望：全パネルの値、文字をできるだけ大きく、見切れ「…」禁止
  const getFontSizeClass = (text: string) => {
    if (!text) return "text-[18px] sm:text-[20px] md:text-[22px] font-black";
    const len = text.length;
    if (len <= 10) {
      return "text-[18px] sm:text-[20px] md:text-[22px] font-black leading-tight";
    }
    if (len <= 16) {
      return "text-[15px] sm:text-[17px] md:text-[19px] font-black leading-tight";
    }
    if (len <= 26) {
      return "text-[12px] sm:text-[14px] md:text-[16px] font-bold leading-snug";
    }
    if (len <= 36) {
      return "text-[10px] sm:text-[11px] md:text-[12px] font-bold leading-normal";
    }
    return "text-[8px] sm:text-[9px] md:text-[11px] font-bold leading-normal";
  };

  let fontSizeClass = getFontSizeClass(valueString);
  if (config.id === "dbLevel") {
    if (fontSizeClass.includes("text-[18px]")) {
      fontSizeClass = "text-[17px] sm:text-[19px] md:text-[21px] font-black leading-tight";
    } else if (fontSizeClass.includes("text-[15px]")) {
      fontSizeClass = "text-[14px] sm:text-[16px] md:text-[18px] font-black leading-tight";
    } else if (fontSizeClass.includes("text-[12px]")) {
      fontSizeClass = "text-[11px] sm:text-[13px] md:text-[15px] font-bold leading-snug";
    } else if (fontSizeClass.includes("text-[10px]")) {
      fontSizeClass = "text-[9px] sm:text-[10px] md:text-[11px] font-bold leading-normal";
    } else {
      fontSizeClass = "text-[7.5px] sm:text-[8px] md:text-[10px] font-bold leading-normal";
    }
  }

  // 枠のグラデーション色を取得
  const getGradientColors = (borderColor: string) => {
    switch (borderColor) {
      case "border-white":
        return "from-slate-400/60 to-slate-600/60";
      case "border-blue":
        return "from-sky-400/80 to-indigo-600/80";
      case "border-indigo":
        return "from-indigo-400/80 to-purple-600/80";
      case "border-yellow":
        return "from-amber-400/80 to-orange-500/80";
      case "border-green":
        return "from-emerald-400/80 to-green-600/80";
      case "border-emerald":
        return "from-teal-400/80 to-emerald-600/80";
      case "border-orange":
        return "from-orange-400/80 to-red-500/80";
      case "border-red":
        return "from-rose-500/80 to-red-600/80";
      case "border-brown":
        return "from-amber-600/80 to-amber-800/80";
      case "border-purple":
        return "from-fuchsia-400/80 to-violet-600/80";
      default:
        return "from-slate-500/60 to-slate-700/60";
    }
  };

  const gradientColors = getGradientColors(config.borderColorClass);
  const gradientClass = isFlashing
    ? "from-yellow-400 to-amber-500"
    : gradientColors;

  return (
    <motion.div
      id={`tile-${config.id}`}
      layout
      whileTap={onClick ? { scale: 0.95 } : undefined}
      onClick={onClick}
      className={`relative p-[1px] rounded-xl overflow-hidden transition-all duration-300 ease-out h-[72px] sm:h-20 md:h-24 select-none bg-gradient-to-br ${gradientClass} ${
        onClick ? "cursor-pointer active:brightness-90 hover:brightness-110 hover:shadow-lg hover:shadow-cyan-500/10" : ""
      }`}
    >
      <div
        className={`w-full h-full flex flex-col justify-center px-2 py-1 rounded-[11px] overflow-hidden ${
          isFlashing ? "bg-yellow-500/10" : "bg-slate-900/85 hover:bg-slate-800/85"
        } transition-all duration-300`}
      >
        {/* 項目名（小さく表示） */}
        <div className="text-[10px] sm:text-[11px] text-gray-300 font-normal opacity-85 leading-tight mb-0.5 whitespace-normal break-all">
          {config.emoji} {config.label}
        </div>

        {/* 値（太字・白文字・大きく表示、見切れ・省略禁止） */}
        <div
          className={`flex-grow flex items-center justify-center text-center font-bold text-white break-all whitespace-pre-wrap ${fontSizeClass}`}
        >
          {valueContent}
        </div>
      </div>
    </motion.div>
  );
}
