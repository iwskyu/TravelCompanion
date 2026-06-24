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
}

export function CompanionTile({
  config,
  data,
  deviceHeading,
  lastUpdatedTime,
}: CompanionTileProps) {
  const [isFlashing, setIsFlashing] = useState(false);

  // データの最終更新時刻が変わったら一時的に黄色にする（フラッシュ演出）
  useEffect(() => {
    if (lastUpdatedTime > 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, 1500); // 1.5秒間黄色
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedTime]);

  const valueContent = config.render(data, deviceHeading);
  const valueString = typeof valueContent === "string" ? valueContent : "";

  // 文字数に応じてフォントサイズを動的に決定（見切れ・省略の絶対禁止）
  const getFontSizeClass = (text: string) => {
    if (!text) return "text-sm sm:text-base";
    const len = text.length;
    if (len <= 5) return "text-lg sm:text-xl md:text-2xl";
    if (len <= 10) return "text-sm sm:text-base md:text-lg";
    if (len <= 18) return "text-xs sm:text-sm md:text-base";
    if (len <= 26) return "text-[11px] sm:text-xs md:text-sm";
    return "text-[9px] sm:text-[10px] md:text-xs leading-none";
  };

  const fontSizeClass = getFontSizeClass(valueString);

  // 枠線と背景色の設定
  // isFlashingがtrueのときは黄色の枠線になり、内側を優しく光らせる（領域は拡張しない）
  const borderClass = isFlashing
    ? "tile-updated bg-yellow-500/10 z-10"
    : `${config.borderColorClass} bg-black/20`;

  return (
    <motion.div
      id={`tile-${config.id}`}
      layout
      className={`relative flex flex-col justify-center px-2 py-0.5 border border-solid transition-all duration-300 ease-out h-[72px] sm:h-20 md:h-24 overflow-hidden select-none ${borderClass}`}
    >
      {/* 項目名（小さく表示） */}
      <div className="text-[10px] text-gray-300 font-normal opacity-85 leading-tight mb-0.5 truncate">
        {config.emoji} {config.label}
      </div>

      {/* 値（太字・白文字・大きく表示、見切れ・省略禁止） */}
      <div
        className={`flex-grow flex items-center justify-center text-center font-bold text-white break-all whitespace-pre-wrap ${fontSizeClass}`}
      >
        {valueContent}
      </div>
    </motion.div>
  );
}
