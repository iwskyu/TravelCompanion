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
  // ユーザー要望：全パネルの値、文字をできるだけ大きく
  const getFontSizeClass = (text: string) => {
    if (!text) return "text-[16px] sm:text-[18px] md:text-[20px] font-black";
    const len = text.length;
    // ほとんどの2行表記や短い数値（14文字以下）に最高に大きくて見やすいインパクト
    if (len <= 14) {
      return "text-[16px] sm:text-[18px] md:text-[20px] font-black leading-tight";
    }
    // 少し長めの文字列（15〜24文字）
    if (len <= 24) {
      return "text-[13px] sm:text-[15px] md:text-[17px] font-bold leading-snug";
    }
    // 非常に長い住所や名称
    return "text-[11px] sm:text-[12px] md:text-[13px] font-bold leading-normal";
  };

  const fontSizeClass = getFontSizeClass(valueString);

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
        <div className="text-[11px] text-gray-300 font-normal opacity-85 leading-tight mb-0.5 truncate">
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
