/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { TileConfig, CompanionData } from "../types";
import { getRelativeArrow } from "./geo";
import { getWeatherEmojiAndName } from "./api";

// 距離をきれいにフォーマットする（1km未満ならm、1km以上なら小数点1桁のkm）
function formatDistance(distKm: number | null): string {
  if (distKm === null) return "";
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)}m`;
  }
  return `${distKm.toFixed(1)}km`;
}

// 共通アロー取得用ラッパー
function getArrow(bearing: number | null, heading: number | null): string {
  if (bearing === null) return "";
  return getRelativeArrow(bearing, heading);
}

export const ALL_TILES_CONFIG: TileConfig[] = [
  // =========================================================================
  // 1. 端末センサー・リアルタイム取得情報 (境界カラー: border-cyan - シアンネオン)
  // =========================================================================
  {
    id: "bearing",
    label: "方角",
    emoji: "🧭",
    borderColorClass: "border-cyan",
    render: (data, deviceHeading) => {
      const headingToUse = deviceHeading !== null ? deviceHeading : (data.bearing ? data.bearing.angle : null);
      if (headingToUse === null) return "-";

      const angle = headingToUse;
      const direction = data.bearing ? data.bearing.direction : "北";

      return (
        <div className="flex items-center justify-center gap-2 w-full h-full py-1">
          <motion.div
            animate={{ rotate: -angle }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
            className="w-10 h-10 rounded-full border border-slate-700 bg-slate-950 text-sky-400 flex items-center justify-center text-[10px] font-bold relative shrink-0 shadow-inner"
            style={{ originX: 0.5, originY: 0.5 }}
          >
            <span className="absolute top-1 text-[8px] text-rose-500 font-black leading-none">N</span>
            <div className="w-[1.5px] h-3 bg-rose-500 rounded-full absolute top-1.5" />
            <div className="w-[1.5px] h-3 bg-slate-600 rounded-full absolute bottom-1.5" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 absolute" />
          </motion.div>
          
          <div className="flex flex-col items-start leading-none shrink-0 text-left">
            <span className="text-[14px] font-black text-slate-200">{direction} <span className="text-[10px] font-bold text-emerald-400">(動作中)</span></span>
            <span className="text-[11px] font-mono font-bold text-slate-400 mt-1">{Math.round(angle)}°</span>
          </div>
        </div>
      );
    },
    categories: ["driving", "climbing", "sea"],
  },
  {
    id: "tilt",
    label: "傾き",
    emoji: "📐",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (!data.tilt) return "-";
      const { pitch, roll } = data.tilt;
      const isStable = Math.abs(pitch) <= 10 && Math.abs(roll) <= 10;
      const status = isStable ? "🟢水平/安定" : Math.abs(pitch) > 30 || Math.abs(roll) > 30 ? "🔴急傾斜/注意" : "🟡傾斜あり";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-bold text-white">↕️ {pitch}° / ↔️ {roll}°</span>
        </div>
      );
    },
    categories: ["driving", "climbing", "sea"],
  },
  {
    id: "maxLeanAngle",
    label: "最大バンク角",
    emoji: "🏍️",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (data.confirmResetLean) {
        return "タップしてリセット";
      }
      if (!data.maxLeanAngle) return "◀️ 0°\n▶️ 0°";
      const { left, right } = data.maxLeanAngle;
      const maxVal = Math.max(left, right);
      const status = maxVal < 15 ? "直立/安全" : maxVal < 45 ? "軽快バンク" : "限界ハング";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">({status})</span>
          <span className="text-xs font-black text-white">◀️ {left}° / ▶️ {right}°</span>
        </div>
      );
    },
    categories: ["driving"],
  },
  {
    id: "speed",
    label: "移動速度",
    emoji: "🚗",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (data.speed === null) return "0km/h (停車中)";
      const speedKmh = Math.round(data.speed * 3.6);
      const status = speedKmh === 0 ? "🟢停車中" : speedKmh <= 40 ? "🟢徐行/安全" : speedKmh <= 80 ? "🟢巡航/快適" : "🟡高速移動中";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-lg font-black text-white font-mono">{speedKmh}<span className="text-xs font-normal">km/h</span></span>
        </div>
      );
    },
    categories: ["driving"],
  },
  {
    id: "elevation",
    label: "標高",
    emoji: "🗻",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (data.elevation === null || data.elevation === undefined) return "-";
      const h = Math.round(data.elevation);
      const status = h < 100 ? "🟢平地" : h < 1000 ? "🟡中高地" : "🔴山岳/低圧";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-base font-black text-white font-mono">{h}m</span>
        </div>
      );
    },
    categories: ["climbing", "driving"],
  },
  {
    id: "accumulatedDistance",
    label: "累計移動距離",
    emoji: "🏃",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (data.accumulatedDistance === null || data.accumulatedDistance === undefined) return "0m";
      const dist = data.accumulatedDistance;
      const status = dist < 1000 ? "開始直後" : dist < 50000 ? "快調走行" : "本格ツーリング";
      const distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(2)}km`;
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">({status})</span>
          <span className="text-base font-black text-white font-mono">{distStr}</span>
        </div>
      );
    },
    categories: ["driving", "climbing"],
  },
  {
    id: "dbLevel",
    label: "周囲の静けさ",
    emoji: "🎙️",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (data.dbLevel === null || data.dbLevel === undefined) return "-";
      const db = data.dbLevel;
      const indicator = db < 40 ? "🟢非常に静か(快適)" : db < 65 ? "🟡街頭並(普通)" : "🔴騒音あり(耳栓推奨)";
      return (
        <div className="flex flex-col items-center justify-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5 whitespace-nowrap">{indicator}</span>
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {db}<span className="text-sm font-normal ml-0.5 text-slate-400">dB</span>
          </span>
        </div>
      );
    },
    categories: ["weather"],
  },
  {
    id: "gpsAccuracy",
    label: "GPS精度",
    emoji: "📡",
    borderColorClass: "border-cyan",
    render: (data) => {
      if (data.gpsAccuracy === null) return "-";
      const acc = Math.round(data.gpsAccuracy);
      const signal = acc <= 10 ? "🟢超良好(位置精密)" : acc <= 30 ? "🟡普通(測位中)" : "🔴低下(屋内?)";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">{signal}</span>
          <span className="text-sm font-black text-white font-mono">{acc}m</span>
        </div>
      );
    },
    categories: ["driving", "climbing", "sea"],
  },

  // =========================================================================
  // 2. 環境・気象・天体 (境界カラー: border-amber - 温かみゴールド)
  // =========================================================================
  {
    id: "weather",
    label: "天気、気温",
    emoji: "🌈",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.weather) return "-";
      const info = getWeatherEmojiAndName(data.weather.code);
      let minMaxText = "";
      if (data.weather.minTemp !== undefined && data.weather.minTemp !== null &&
          data.weather.maxTemp !== undefined && data.weather.maxTemp !== null) {
        minMaxText = ` (${Math.round(data.weather.minTemp)}~${Math.round(data.weather.maxTemp)}℃)`;
      }
      
      let status = "お出かけ快適";
      if (data.weather.code >= 50) status = "雨天/スリップ注意";
      if (data.weather.code >= 90) status = "荒天/避難推奨";

      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">({status})</span>
          <span className="text-sm font-black text-white">{info.emoji} {Math.round(data.weather.temp)}℃{minMaxText}</span>
        </div>
      );
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "precipitation",
    label: "降水確率・量",
    emoji: "☔️",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.precipitation) return "-";
      const prob = data.precipitation.probability !== null ? data.precipitation.probability : 0;
      const amt = data.precipitation.amount !== null ? data.precipitation.amount : 0;
      const status = prob < 20 ? "🟢傘不要/快適" : prob < 50 ? "🟡小雨懸念/折畳推奨" : "🔴雨天想定/雨具必須";
      return (
        <div className="flex flex-col items-center leading-tight w-full">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-[11px] sm:text-xs font-black text-sky-300">☔ {prob}% / 💧 {amt}mm</span>
          <span className="text-[8px] text-amber-400/80 mt-0.5 font-bold">📊タップで12時間推移</span>
        </div>
      );
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "rainCloudApproach",
    label: "雨雲接近",
    emoji: "☁️",
    borderColorClass: "border-amber",
    render: (data) => {
      const approach = data.rainCloudApproach || "-";
      if (approach.includes("接近なし") || approach.includes("なし")) {
        return "🟢 接近なし (晴天/安心)";
      }
      return `🔴 警告: ${approach}`;
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "pressure",
    label: "気圧",
    emoji: "🌀",
    borderColorClass: "border-amber",
    render: (data) => {
      if (data.pressure === null || data.pressure === undefined) return "-";
      const p = Math.round(data.pressure);
      const status = p < 1005 ? "🔴低気圧(頭痛注意)" : p < 1012 ? "🟡やや低圧(体調配慮)" : "🟢高気圧(快適・安定)";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-base font-black text-white font-mono">{p} hPa</span>
        </div>
      );
    },
    categories: ["weather", "climbing"],
  },
  {
    id: "humidity",
    label: "湿度",
    emoji: "💧",
    borderColorClass: "border-amber",
    render: (data) => {
      if (data.humidity === null) return "-";
      const h = data.humidity;
      const status = h < 40 ? "🟡乾燥(喉潤い推奨)" : h <= 60 ? "🟢適湿(お肌に優しい)" : "🔴多湿(蒸し暑さ・不快)";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-base font-black text-white font-mono">{h}%</span>
        </div>
      );
    },
    categories: ["weather", "climbing"],
  },
  {
    id: "wind",
    label: "風速、風向き",
    emoji: "💨",
    borderColorClass: "border-amber",
    render: (data, heading) => {
      if (!data.wind) return "-";
      const arrow = getArrow(data.wind.bearing, heading);
      const speed = data.wind.speed;
      const status = speed < 3.0 ? "🟢穏やか/快適" : speed <= 8.0 ? "🟡中風/体感涼しい" : "🔴強風/横風・転倒注意";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">{arrow} {speed}m/s</span>
        </div>
      );
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "uvIndex",
    label: "紫外線情報",
    emoji: "☀️",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.uvIndex) return "-";
      const uv = data.uvIndex.index;
      const levelEmoji = uv >= 8 ? "🔴" : uv >= 5 ? "🟠" : "🟡";
      const status = uv < 3 ? "🟢弱い/対策不要" : uv < 6 ? "🟡中等/帽子推奨" : "🔴極強/日傘・日焼け止め必須";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">{levelEmoji} UV {uv.toFixed(1)}</span>
        </div>
      );
    },
    categories: ["weather", "climbing", "sea"],
  },
  {
    id: "pm25",
    label: "PM2.5",
    emoji: "🌫️",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.airQuality || data.airQuality.pm25 === null || data.airQuality.pm25 === undefined) {
        return "-";
      }
      const val = data.airQuality.pm25;
      const indicator = val > 35 ? "🔴濃度高(マスク推奨)" : val > 15 ? "🟡普通(気にならない)" : "🟢良好(空気清浄)";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{indicator}</span>
          <span className="text-sm font-black text-white font-mono">{val} ㎍/㎥</span>
        </div>
      );
    },
    categories: ["weather"],
  },
  {
    id: "airQuality",
    label: "花粉",
    emoji: "🌲",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.airQuality) return "-";
      const pollen = data.airQuality.pollenText;
      const status = pollen.includes("多い") ? "🔴アレルギー警戒" : "🟢少ない/快適";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">{pollen}</span>
        </div>
      );
    },
    categories: ["weather"],
  },
  {
    id: "kosa",
    label: "黄砂",
    emoji: "😷",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.airQuality || !data.airQuality.kosaText) return "-";
      const kosa = data.airQuality.kosaText;
      const status = kosa.includes("多い") || kosa.includes("あり") ? "🔴呼吸器注意/車体汚れ" : "🟢飛来なし/視界クリア";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">{kosa}</span>
        </div>
      );
    },
    categories: ["weather"],
  },
  {
    id: "sunrise",
    label: "日の出・日没",
    emoji: "🌅",
    borderColorClass: "border-amber",
    render: (data, heading) => {
      if (!data.sunrise && !data.sunset) return "-";
      const r1 = data.sunrise ? `${data.sunrise.time}${getArrow(data.sunrise.bearing, heading)}` : "-";
      const r2 = data.sunset ? `${data.sunset.time}${getArrow(data.sunset.bearing, heading)}` : "-";
      return `🌅 出: ${r1}\n🌇 入: ${r2}`;
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "sunsetDuration",
    label: "日の出入・残時間",
    emoji: "⏱️",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.sunset) return "-";
      const sunsetStr = data.sunset.time;
      const [sh, sm] = sunsetStr.split(":").map(Number);
      const now = new Date();
      const sunsetDate = new Date();
      sunsetDate.setHours(sh, sm, 0, 0);
      
      const diffMs = sunsetDate.getTime() - now.getTime();
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `⏳ あと ${pad(hours)}:${pad(mins)}:${pad(secs)}\n(早めのライト点灯推奨)`;
      } else {
        const passedMins = Math.floor(Math.abs(diffMs) / 60000);
        if (passedMins < 60) {
          return `🌙 日没後 -${passedMins}分\n(夜間走行注意)`;
        }
        return "🌙 夜間走行モード\n(ライト点灯確認)";
      }
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "moonAge",
    label: "月齢",
    emoji: "🌙",
    borderColorClass: "border-amber",
    render: (data) => {
      if (!data.moonAge) return "-";
      const age = data.moonAge.age;
      let moonIcon = "🌕";
      let status = "夜景観賞向き";
      if (age < 2) {
        moonIcon = "🌑";
        status = "🌟新月/星空観測最適!";
      } else if (age < 6.5) moonIcon = "🌒";
      else if (age < 9.5) moonIcon = "🌓";
      else if (age < 14) moonIcon = "🌔";
      else if (age < 16) {
        moonIcon = "🌕";
        status = "🌕満月/夜道が明るい";
      } else if (age < 20) moonIcon = "🌖";
      else if (age < 24) moonIcon = "🌗";
      else if (age < 28) moonIcon = "🌘";
      else {
        moonIcon = "🌑";
        status = "🌟新月/星空観測最適!";
      }
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">{moonIcon} 月齢 {age.toFixed(1)}</span>
        </div>
      );
    },
    categories: ["weather", "sea"],
  },
  {
    id: "sunPosition",
    label: "太陽の位置",
    emoji: "🌞",
    borderColorClass: "border-amber",
    render: (data, heading) => {
      if (!data.sunPosition) return "-";
      const arrow = getArrow(data.sunPosition.bearing, heading);
      const card = data.sunPosition.cardinal;
      let status = "日差しあり";
      if (card === "東") status = "朝日/逆光運転注意";
      if (card === "西") status = "西日/サンバイザー必須";
      if (card === "南") status = "南中/日陰休憩推奨";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">☀️ {card}方向 {arrow}</span>
        </div>
      );
    },
    categories: ["weather", "climbing"],
  },

  // =========================================================================
  // 3. 海・波 (境界カラー: border-teal - クリーンな海洋ブルー/グリーン)
  // =========================================================================
  {
    id: "waveInfo",
    label: "波情報",
    emoji: "🏄",
    borderColorClass: "border-teal",
    render: (data) => {
      if (!data.waveInfo) return "-";
      const { height, period } = data.waveInfo;
      const status = height < 0.5 ? "🟢凪/マリン最適" : height <= 1.5 ? "🟡中波/サーフィン向き" : "🔴うねり強/遊泳危険";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-xs font-black text-white">🌊 {height.toFixed(1)}m / ⏱️ {period.toFixed(1)}s</span>
        </div>
      );
    },
    categories: ["sea"],
  },
  {
    id: "highLowTide",
    label: "満潮・干潮",
    emoji: "🌊",
    borderColorClass: "border-teal",
    render: (data) => {
      const high = data.highTide && data.highTide !== "-" ? data.highTide : "-";
      const low = data.lowTide && data.lowTide !== "-" ? data.lowTide : "-";
      if (high === "-" && low === "-") return "-";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold text-slate-400 mb-0.5">(釣り・潮干狩りの目安)</span>
          <span className="text-[11px] font-bold text-white">満潮: {high}\n干潮: {low}</span>
        </div>
      );
    },
    categories: ["sea"],
  },
  {
    id: "seaTemp",
    label: "海水温",
    emoji: "🌊",
    borderColorClass: "border-teal",
    render: (data) => {
      if (data.seaTemp === null || data.seaTemp === undefined) return "-";
      const t = data.seaTemp;
      const status = t < 18 ? "🔵冷海水/防寒必須" : t <= 24 ? "🟢マリンスポーツ最適" : "🟡温暖/プランクトン注意";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-base font-black text-white font-mono">{t.toFixed(1)}℃</span>
        </div>
      );
    },
    categories: ["sea"],
  },
  {
    id: "seaDistance",
    label: "海まで",
    emoji: "🌊",
    borderColorClass: "border-teal",
    render: (data, heading) => {
      if (data.seaDistance === null || data.seaBearing === null) return "-";
      const d = data.seaDistance;
      const arrow = getArrow(data.seaBearing, heading);
      const status = d < 1 ? "🌊目前! 潮風の香り" : d < 10 ? "🚗近接/散策圏内" : "⛰️内陸エリア";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-sm font-black text-white">{formatDistance(d)} {arrow}</span>
        </div>
      );
    },
    categories: ["sea"],
  },

  // =========================================================================
  // 4. 防災・社会インフラ (境界カラー: border-rose - 警戒ビビッドレッド)
  // =========================================================================
  {
    id: "earthquake",
    label: "地震・防災情報",
    emoji: "🚨",
    borderColorClass: "border-rose",
    render: (data) => {
      const eq = data.earthquake || "異常なし（安定）";
      const isOk = eq.includes("異常なし") || eq.includes("安定");
      return (
        <div className="flex flex-col items-center justify-center leading-normal text-center h-full w-full">
          <span className="text-[10px] font-extrabold text-slate-400 mb-0.5">{isOk ? "🟢 安定運転可能" : "⚠️ 要警報確認"}</span>
          <span className="text-xs font-bold text-rose-300">{eq}</span>
        </div>
      );
    },
    categories: ["disaster"],
  },
  {
    id: "powerUsage",
    label: "電力使用状況",
    emoji: "⚡",
    borderColorClass: "border-rose",
    render: (data) => {
      if (!data.powerUsage) return "-";
      const { rate, usage } = data.powerUsage;
      const status = rate >= 95 ? "🔴逼迫/節電警報" : rate >= 90 ? "🟡注意/節電推奨" : "🟢安定/電力十分";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-xs sm:text-sm font-black text-white">🔋 {rate}% ({Math.round(usage)}万kW)</span>
        </div>
      );
    },
    categories: ["disaster"],
  },
  {
    id: "trafficStatus",
    label: "道路交通状況",
    emoji: "🛣️",
    borderColorClass: "border-rose",
    render: (data) => {
      const traffic = data.trafficStatus || "順調";
      const isSmooth = traffic.includes("順調") || traffic.includes("良好") || traffic.includes("通常");
      const status = isSmooth ? "🟢順調/ツーリング最適" : "🔴混雑・渋滞/迂回推奨";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-xs font-black text-white">{traffic}</span>
        </div>
      );
    },
    categories: ["driving", "disaster"],
  },

  // =========================================================================
  // 5. 交通・移動・位置（境界カラー: border-indigo - ナビゲーションインディゴ）
  // =========================================================================
  {
    id: "prefecturalCapital",
    label: "県庁所在地",
    emoji: "🏢",
    borderColorClass: "border-indigo",
    render: (data, heading) => {
      if (!data.prefecturalCapital) return "-";
      const { name, distance, bearing } = data.prefecturalCapital;
      const arrow = getArrow(bearing, heading);
      const formattedName = name.includes("(") ? name.replace("(", "\n(") : name;
      const status = distance < 5 ? "🏢至近/行政中心" : "🚗周辺エリア";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-xs font-black text-white">{formattedName} ({formatDistance(distance)} {arrow})</span>
        </div>
      );
    },
    categories: ["driving"],
  },
  {
    id: "tokyoDistance",
    label: "東京駅まで",
    emoji: "⛪️",
    borderColorClass: "border-indigo",
    render: (data, heading) => {
      if (data.tokyoDistance === null || data.tokyoBearing === null) return "-";
      const d = data.tokyoDistance;
      const arrow = getArrow(data.tokyoBearing, heading);
      const status = d < 5 ? "📍東京目前!" : d < 100 ? "🚗首都圏内" : "🧭広域移動";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-xs sm:text-sm font-black text-white">{formatDistance(d)} {arrow}</span>
        </div>
      );
    },
    categories: ["driving"],
  },
  {
    id: "fujiDistance",
    label: "富士山まで",
    emoji: "🗻",
    borderColorClass: "border-indigo",
    render: (data, heading) => {
      if (data.fujiDistance === null || data.fujiBearing === null) return "-";
      const d = data.fujiDistance;
      const arrow = getArrow(data.fujiBearing, heading);
      const status = d < 10 ? "🗻山麓エリア!" : d < 80 ? "🔭晴天時ビューエリア" : "🧭広域";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">{status}</span>
          <span className="text-xs sm:text-sm font-black text-white">{formatDistance(d)} {arrow}</span>
        </div>
      );
    },
    categories: ["climbing"],
  },

  // =========================================================================
  // 6. システム・日時 (境界カラー: border-slate - ニュートラルシルバー)
  // =========================================================================
  {
    id: "currentDate",
    label: "現在年月日",
    emoji: "📅",
    borderColorClass: "border-slate",
    render: (data) => {
      const val = data.currentDate || "-";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">🟢システム時刻正常</span>
          <span className="text-xs font-black text-slate-200">{val}</span>
        </div>
      );
    },
    categories: ["system"],
  },
  {
    id: "currentTime",
    label: "現在時間",
    emoji: "⏰",
    borderColorClass: "border-slate",
    render: (data) => {
      const val = data.currentTime || "-";
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[9px] font-bold text-slate-400 mb-0.5">⏱️ リアルタイム時計</span>
          <span className="text-base sm:text-lg font-black text-white font-mono">{val}</span>
        </div>
      );
    },
    categories: ["system"],
  },
];
