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
  isCached?: boolean; // キャッシュ判別フラグ（フェッチ失敗時に薄グレーアウト表示にする）
  isSelectMode?: boolean; // 複数移動用の選択モードか
  isSelected?: boolean;   // 複数移動用の選択状態か
}

export function CompanionTile({
  config,
  data,
  deviceHeading,
  lastUpdatedTime,
  onClick,
  isCached = false,
  isSelectMode = false,
  isSelected = false,
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
  const prevTiltRef = React.useRef<{ pitch: number; roll: number } | null>(null);
  const prevBearingRef = React.useRef<number | null>(null);

  // データの最終更新時刻が変わったら一時的に黄色にする（フラッシュ演出のフラグ制御）
  useEffect(() => {
    // dbLevel と sunsetCountdown はフラッシュさせない
    if (config.id === "dbLevel" || config.id === "sunsetCountdown") {
      return;
    }

    // 傾きは30°以上変化したときだけフラッシュ
    if (config.id === "tilt") {
      if (data.tilt) {
        const { pitch, roll } = data.tilt;
        if (prevTiltRef.current) {
          const dPitch = Math.abs(pitch - prevTiltRef.current.pitch);
          const dRoll = Math.abs(roll - prevTiltRef.current.roll);
          if (dPitch >= 30 || dRoll >= 30) {
            setIsFlashing(true);
            prevTiltRef.current = { pitch, roll };
          }
        } else {
          prevTiltRef.current = { pitch, roll };
        }
      }
      return;
    }

    // 方角は30°以上変化したときだけフラッシュ
    if (config.id === "bearing") {
      if (data.bearing) {
        const angle = data.bearing.angle;
        if (prevBearingRef.current !== null) {
          const dAngle = Math.abs(angle - prevBearingRef.current);
          const diff = Math.min(dAngle, 360 - dAngle);
          if (diff >= 30) {
            setIsFlashing(true);
            prevBearingRef.current = angle;
          }
        } else {
          prevBearingRef.current = angle;
        }
      }
      return;
    }

    if (lastUpdatedTime > 0) {
      const hasChanged = prevValueRef.current !== valueString;
      prevValueRef.current = valueString;
      if (hasChanged) {
        setIsFlashing(true);
      }
    }
  }, [lastUpdatedTime, valueString, config.id, data.tilt, data.bearing]);

  // isFlashingがtrueになったら、一定時間後に確実にfalseに戻すための、フラッシュ専用のクリーンアップタイマー
  useEffect(() => {
    if (isFlashing) {
      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [isFlashing]);

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
    // 周囲の静かさの値はフォントサイズを明確に小さくする
    fontSizeClass = "text-[11px] sm:text-[12px] md:text-[13px] font-bold leading-snug";
  } else if (config.id === "earthquake") {
    // 地震・防災情報の値のフォントを小さく調整
    fontSizeClass = "text-[11px] sm:text-[12px] md:text-[13px] font-bold leading-normal text-center tracking-wide px-0.5 self-center w-full overflow-y-auto max-h-[46px]";
  } else if (config.id === "magicHour") {
    // マジックアワーのフォントサイズを小さく調整
    fontSizeClass = "text-[11px] sm:text-[12px] md:text-[13px] font-bold leading-snug text-center";
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

  const isMovingFast = config.id === "bearing" && data.speed !== null && data.speed !== undefined && (data.speed * 3.6) > 30;

  // 地震・防災情報の警報レベル判定 (赤点滅演出)
  const isEarthquake = config.id === "earthquake";
  const isEarthquakeDanger = isEarthquake && valueString && (
    valueString.includes("緊急") ||
    valueString.includes("震度5") ||
    valueString.includes("震度6") ||
    valueString.includes("震度7") ||
    valueString.includes("大津波") ||
    valueString.includes("津波") ||
    valueString.includes("特別警報") ||
    valueString.includes("警報")
  );

  const gradientColors = getGradientColors(config.borderColorClass);
  let gradientClass = isFlashing
    ? "from-yellow-400 to-amber-500"
    : gradientColors;

  if (isMovingFast) {
    gradientClass = "from-red-500 to-rose-600 animate-[pulse_1.5s_infinite]";
  } else if (isEarthquakeDanger) {
    gradientClass = "from-red-600 via-rose-500 to-red-700 animate-[pulse_1s_infinite]";
  } else if (isCached) {
    gradientClass = "from-slate-700/40 to-slate-800/40";
  }

  // 日没カウントダウン用の動的な滑らか色変化 (日没前は常時光らせず他のパネルと同様、日没後はディープな夜色)
  let sunsetStyle: React.CSSProperties | undefined = undefined;
  if (!isFlashing && !isCached && config.id === "sunsetCountdown" && data.sunset && data.sunset.time && data.sunset.time !== "-") {
    try {
      const parts = data.sunset.time.split(":");
      if (parts.length >= 2) {
        const sunsetHour = parseInt(parts[0]);
        const sunsetMin = parseInt(parts[1]);

        const now = new Date();
        const sunsetDate = new Date();
        sunsetDate.setHours(sunsetHour, sunsetMin, 0, 0);

        const diffMs = sunsetDate.getTime() - now.getTime();
        const diffMins = diffMs / 60000;

        if (diffMins > 0) {
          // 日没前は常時光らせないために特別なグラデーションスタイルは適用しない
          sunsetStyle = undefined;
        } else {
          // 日没後はディープパープル/インディゴ夜間 (落ち着いたトーン)
          sunsetStyle = {
            background: "linear-gradient(135deg, #0f0c29, #1e1b4b)",
          };
        }
      }
    } catch (e) {
      console.warn("Error calculating dynamic sunset gradient style", e);
    }
  }

  return (
    <motion.div
      id={`tile-${config.id}`}
      layout
      whileTap={onClick ? { scale: 0.95 } : undefined}
      onClick={onClick}
      style={sunsetStyle}
      className={`relative p-[1px] rounded-xl overflow-hidden transition-all duration-300 ease-out h-[72px] sm:h-20 md:h-24 select-none ${
        sunsetStyle ? "" : `bg-gradient-to-br ${gradientClass}`
      } ${
        isSelectMode 
          ? isSelected 
            ? "ring-2 ring-sky-400 scale-[0.97] brightness-110 shadow-[0_0_12px_rgba(56,189,248,0.4)]" 
            : "brightness-75" 
          : onClick 
            ? "cursor-pointer active:brightness-90 hover:brightness-110 hover:shadow-lg hover:shadow-cyan-500/10" 
            : ""
      }`}
    >
      {/* 複数並び替え時の選択インジケータ */}
      {isSelectMode && (
        <div className="absolute top-1.5 right-1.5 z-10">
          {isSelected ? (
            <span className="w-4.5 h-4.5 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center text-[10px] font-black border border-sky-200 shadow-md">
              ✓
            </span>
          ) : (
            <span className="w-4.5 h-4.5 rounded-full border-1.5 border-slate-500 bg-slate-950/90 flex items-center justify-center text-[8px] font-bold text-transparent">
              ○
            </span>
          )}
        </div>
      )}

      <div
        className={`w-full h-full flex flex-col justify-center px-2 py-1 rounded-[11px] overflow-hidden ${
          isMovingFast
            ? "bg-red-950/95"
            : isEarthquakeDanger
              ? "bg-red-950/95 border border-red-500/30 animate-[pulse_2s_infinite]"
              : isFlashing
                ? "bg-yellow-500/10"
                : isCached
                  ? "bg-slate-950/90 text-slate-400 opacity-60 saturate-50"
                  : isSelected
                    ? "bg-sky-950/40"
                    : "bg-slate-900/85 hover:bg-slate-800/85"
        } transition-all duration-300`}
      >
        {/* 項目名（小さく表示） */}
        <div className="text-[10px] sm:text-[11px] text-gray-300 font-normal opacity-85 leading-tight mb-0.5 whitespace-normal break-all flex items-center justify-between">
          <span className="truncate pr-1">{config.emoji} {config.label}</span>
          {isMovingFast && (
            <span className="text-[9px] font-black text-red-300 bg-red-900/50 px-1 rounded animate-pulse whitespace-nowrap border border-red-500/30">
              ⚠️移動中
            </span>
          )}
          {isEarthquakeDanger && (
            <span className="text-[8px] font-black text-red-100 bg-red-600 px-1 rounded animate-pulse whitespace-nowrap">
              🚨警報発令
            </span>
          )}
          {isCached && !isMovingFast && !isEarthquakeDanger && (
            <span className="text-[8px] font-medium text-slate-400 bg-slate-800/80 px-1 rounded border border-slate-700 whitespace-nowrap">
              キャッシュ
            </span>
          )}
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
