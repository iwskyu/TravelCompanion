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
    // 傾きと方角は黄色に光らせない（常時光ることになるため）
    if (config.id === "tilt" || config.id === "bearing") {
      return;
    }
    
    const hasChanged = prevValueRef.current !== valueString;
    prevValueRef.current = valueString;

    if (lastUpdatedTime > 0 && hasChanged) {
      setIsFlashing(true);
      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, 1500); // 1.5秒間黄色
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedTime, valueString, config.id]);

  // 文字数に応じてフォントサイズを決定。枠内に収まるできるだけ大きいサイズにし、統一感を出す
  const getFontSizeClass = (text: string) => {
    if (!text) return "text-[14px] sm:text-[15px] md:text-[17px]";
    const len = text.length;
    // ほとんどの2行表記（14文字以下）に最高の統一感を持たせる
    if (len <= 14) {
      return "text-[14px] sm:text-[15px] md:text-[17px] leading-tight";
    }
    // 少し長めの文字列（15〜24文字）
    if (len <= 24) {
      return "text-[12px] sm:text-[13px] md:text-[14px] leading-snug";
    }
    // 非常に長い住所や名称
    return "text-[10px] sm:text-[11px] md:text-[12px] leading-none";
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
      <div className="text-[11px] text-gray-300 font-normal opacity-85 leading-tight mb-0.5 truncate">
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
