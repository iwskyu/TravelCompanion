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
  // システム・日時
  // =========================================================================
  {
    id: "currentDate",
    label: "現在年月日",
    emoji: "📅",
    borderColorClass: "border-white",
    render: (data) => data.currentDate || "-",
    categories: ["system"],
  },
  {
    id: "currentTime",
    label: "現在時間",
    emoji: "⏰",
    borderColorClass: "border-white",
    render: (data) => data.currentTime || "-",
    categories: ["system"],
  },

  // =========================================================================
  // 交通・移動・位置
  // =========================================================================
  {
    id: "bearing",
    label: "方角",
    emoji: "🧭",
    borderColorClass: "border-white",
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
          
          <div className="flex flex-col items-start leading-none shrink-0">
            <span className="text-[15px] font-black text-slate-200">{direction}</span>
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
    borderColorClass: "border-white",
    render: (data) => {
      if (!data.tilt) return "-";
      const { pitch, roll } = data.tilt;
      return `前後: ${pitch}°\n左右: ${roll}°`;
    },
    categories: ["driving", "climbing", "sea"],
  },
  {
    id: "gpsAccuracy",
    label: "GPS精度",
    emoji: "📡",
    borderColorClass: "border-white",
    render: (data) => {
      if (data.gpsAccuracy === null) return "-";
      const acc = Math.round(data.gpsAccuracy);
      const level = acc <= 10 ? "高" : acc <= 30 ? "中" : "低";
      return `精度：${level}\n${acc}m`;
    },
    categories: ["driving", "climbing", "sea"],
  },
  {
    id: "speed",
    label: "移動速度",
    emoji: "🚗",
    borderColorClass: "border-white",
    render: (data) => {
      if (data.speed === null) return "0km/h";
      const speedKmh = Math.round(data.speed * 3.6);
      return `${speedKmh}km/h`;
    },
    categories: ["driving"],
  },
  {
    id: "accumulatedDistance",
    label: "累計移動距離",
    emoji: "🏃",
    borderColorClass: "border-green",
    render: (data) => {
      if (data.accumulatedDistance === null || data.accumulatedDistance === undefined) return "0m";
      const dist = data.accumulatedDistance;
      if (dist < 1000) {
        return `${Math.round(dist)}m`;
      }
      return `${(dist / 1000).toFixed(2)}km`;
    },
    categories: ["driving", "climbing"],
  },
  {
    id: "prefecturalCapital",
    label: "県庁所在地",
    emoji: "🏢",
    borderColorClass: "border-blue",
    render: (data, heading) => {
      if (!data.prefecturalCapital) return "-";
      const { name, distance, bearing } = data.prefecturalCapital;
      const arrow = getArrow(bearing, heading);
      const formattedName = name.includes("(") ? name.replace("(", "\n(") : name;
      return `${formattedName}\n${formatDistance(distance)} ${arrow}`;
    },
    categories: ["driving"],
  },
  {
    id: "tokyoDistance",
    label: "東京駅まで",
    emoji: "⛪️",
    borderColorClass: "border-blue",
    render: (data, heading) => {
      if (data.tokyoDistance === null || data.tokyoBearing === null) return "-";
      const arrow = getArrow(data.tokyoBearing, heading);
      return `${formatDistance(data.tokyoDistance)} ${arrow}`;
    },
    categories: ["driving"],
  },
  {
    id: "fujiDistance",
    label: "富士山まで",
    emoji: "🗻",
    borderColorClass: "border-blue",
    render: (data, heading) => {
      if (data.fujiDistance === null || data.fujiBearing === null) return "-";
      const arrow = getArrow(data.fujiBearing, heading);
      return `${formatDistance(data.fujiDistance)} ${arrow}`;
    },
    categories: ["climbing"],
  },
  {
    id: "seaDistance",
    label: "海まで",
    emoji: "🌊",
    borderColorClass: "border-blue",
    render: (data, heading) => {
      if (data.seaDistance === null || data.seaBearing === null) return "-";
      const arrow = getArrow(data.seaBearing, heading);
      return `最寄り海\n${formatDistance(data.seaDistance)} ${arrow}`;
    },
    categories: ["sea"],
  },

  // =========================================================================
  // 環境・気象・天体
  // =========================================================================
  {
    id: "elevation",
    label: "標高",
    emoji: "🗻",
    borderColorClass: "border-purple",
    render: (data) => {
      if (data.elevation === null || data.elevation === undefined) return "-";
      return `${Math.round(data.elevation)}m`;
    },
    categories: ["climbing", "driving"],
  },
  {
    id: "weather",
    label: "天気、気温",
    emoji: "🌈",
    borderColorClass: "border-yellow",
    render: (data) => {
      if (!data.weather) return "-";
      const info = getWeatherEmojiAndName(data.weather.code);
      let minMaxText = "";
      if (data.weather.minTemp !== undefined && data.weather.minTemp !== null &&
          data.weather.maxTemp !== undefined && data.weather.maxTemp !== null) {
        minMaxText = `\n${Math.round(data.weather.minTemp)}℃〜${Math.round(data.weather.maxTemp)}℃`;
      }
      return `${info.emoji} ${info.name}\n${Math.round(data.weather.temp)}℃${minMaxText}`;
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "precipitation",
    label: "降水確率、降水量",
    emoji: "☔",
    borderColorClass: "border-yellow",
    render: (data) => {
      if (!data.precipitation) return "-";
      const prob = data.precipitation.probability !== null ? `${data.precipitation.probability}%` : "-";
      const amt = data.precipitation.amount !== null ? `${data.precipitation.amount}mm` : "-";
      return `${prob} / ${amt}`;
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "rainCloudApproach",
    label: "雨雲接近",
    emoji: "🌧️",
    borderColorClass: "border-yellow",
    render: (data) => {
      const approach = data.rainCloudApproach || "-";
      if (approach.includes("分後")) {
        return approach.replace("分後", "分後\n");
      }
      return approach;
    },
    categories: ["weather", "driving", "climbing", "sea", "disaster"],
  },
  {
    id: "sunriseSunset",
    label: "日の出・日没",
    emoji: "🌅",
    borderColorClass: "border-yellow",
    render: (data, heading) => {
      if (!data.sunrise && !data.sunset) return "-";
      const r1 = data.sunrise ? `${data.sunrise.time} ${getArrow(data.sunrise.bearing, heading)}` : "-";
      const r2 = data.sunset ? `${data.sunset.time} ${getArrow(data.sunset.bearing, heading)}` : "-";
      return `出: ${r1}\n没: ${r2}`;
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "sunsetCountdown",
    label: "日没カウントダウン",
    emoji: "🌇",
    borderColorClass: "border-orange",
    render: (data) => {
      if (!data.sunset || !data.sunset.time || data.sunset.time === "-") return "-";
      const parts = data.sunset.time.split(":");
      if (parts.length < 2) return "-";
      const sunsetHour = parseInt(parts[0]);
      const sunsetMin = parseInt(parts[1]);

      const now = new Date();
      const sunsetDate = new Date();
      sunsetDate.setHours(sunsetHour, sunsetMin, 0, 0);

      const diffMs = sunsetDate.getTime() - now.getTime();
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `日没まで\n${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      } else {
        const passedMins = Math.floor(Math.abs(diffMs) / 60000);
        if (passedMins < 60) {
          return `日没から\n${passedMins}分経過`;
        }
        return "夜間 (日没済)";
      }
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "magicHour",
    label: "マジックアワー",
    emoji: "🌅",
    borderColorClass: "border-yellow",
    render: (data) => data.magicHour || "-",
    categories: ["weather"],
  },
  {
    id: "uvIndex",
    label: "紫外線の強さ",
    emoji: "👒",
    borderColorClass: "border-yellow",
    render: (data) => {
      if (!data.uvIndex) return "-";
      return `${data.uvIndex.level}\nUV ${data.uvIndex.index.toFixed(1)}`;
    },
    categories: ["weather", "climbing", "sea"],
  },
  {
    id: "humidity",
    label: "湿度",
    emoji: "💧",
    borderColorClass: "border-yellow",
    render: (data) => {
      if (data.humidity === null) return "-";
      return `${data.humidity}%`;
    },
    categories: ["weather", "climbing"],
  },
  {
    id: "wind",
    label: "風速、風向き",
    emoji: "💨",
    borderColorClass: "border-yellow",
    render: (data, heading) => {
      if (!data.wind) return "-";
      const arrow = getArrow(data.wind.bearing, heading);
      return `${data.wind.direction} ${arrow}\n${data.wind.speed}m/s`;
    },
    categories: ["weather", "driving", "climbing", "sea"],
  },
  {
    id: "moonAge",
    label: "月齢",
    emoji: "🌙",
    borderColorClass: "border-indigo",
    render: (data) => {
      if (!data.moonAge) return "-";
      return `${data.moonAge.state}\n${data.moonAge.age.toFixed(1)}日`;
    },
    categories: ["weather", "sea"],
  },
  {
    id: "sunPosition",
    label: "太陽の位置",
    emoji: "🌞",
    borderColorClass: "border-indigo",
    render: (data, heading) => {
      if (!data.sunPosition) return "-";
      const arrow = getArrow(data.sunPosition.bearing, heading);
      return `${data.sunPosition.cardinal}\n向き ${arrow}`;
    },
    categories: ["weather", "climbing"],
  },
  {
    id: "airQuality",
    label: "花粉",
    emoji: "🌲",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.airQuality) return "-";
      return `${data.airQuality.pollenText}`;
    },
    categories: ["weather"],
  },
  {
    id: "pm25",
    label: "PM2.5",
    emoji: "🌫️",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.airQuality || data.airQuality.pm25 === null || data.airQuality.pm25 === undefined) {
        return "-";
      }
      const val = data.airQuality.pm25;
      let label = "少ない";
      if (val > 35) label = "非常に多い";
      else if (val > 15) label = "やや多い";
      return `${label} ${val} ㎍/㎥`;
    },
    categories: ["weather"],
  },
  {
    id: "kosa",
    label: "黄砂",
    emoji: "😷",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.airQuality || !data.airQuality.kosaText) return "-";
      return data.airQuality.kosaText;
    },
    categories: ["weather"],
  },
  {
    id: "seaTemp",
    label: "海水温",
    emoji: "🌊",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (data.seaTemp === null) return "-";
      return `${data.seaTemp.toFixed(1)}℃`;
    },
    categories: ["sea"],
  },
  {
    id: "waveInfo",
    label: "波情報",
    emoji: "🏄",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.waveInfo) return "-";
      const { height, period, direction } = data.waveInfo;
      return `${height.toFixed(1)}m (${direction})\n周期: ${period.toFixed(1)}秒`;
    },
    categories: ["sea"],
  },
  {
    id: "highLowTide",
    label: "満潮・干潮",
    emoji: "🌊",
    borderColorClass: "border-emerald",
    render: (data) => {
      const high = data.highTide && data.highTide !== "-" ? data.highTide : "-";
      const low = data.lowTide && data.lowTide !== "-" ? data.lowTide : "-";
      if (high === "-" && low === "-") return "-";
      return `満潮: ${high}\n干潮: ${low}`;
    },
    categories: ["sea"],
  },
  {
    id: "dbLevel",
    label: "周囲の静かさ",
    emoji: "🎙️",
    borderColorClass: "border-white",
    render: (data) => {
      if (data.dbLevel === null || data.dbLevel === undefined) return "-";
      const db = data.dbLevel;
      let label = "極めて静か";
      if (db < 20) label = "極めて静か";
      else if (db < 40) label = "静か";
      else if (db < 65) label = "普通";
      else if (db < 85) label = "騒がしい";
      else label = "極めて騒がしい";
      return `${db} dB\n${label}`;
    },
    categories: ["weather"],
  },

  // =========================================================================
  // 防災・社会インフラ
  // =========================================================================
  {
    id: "earthquake",
    label: "地震・防災情報",
    emoji: "🚨",
    borderColorClass: "border-red",
    render: (data) => data.earthquake || "異常なし（安定）",
    categories: ["disaster"],
  },
  {
    id: "powerUsage",
    label: "電力使用状況",
    emoji: "⚡",
    borderColorClass: "border-red",
    render: (data) => {
      if (!data.powerUsage) return "-";
      const { company, rate, usage, capacity } = data.powerUsage;
      return `${company}\n使用率 ${rate}%\n(${Math.round(usage)}/${capacity}万kW)`;
    },
    categories: ["disaster"],
  },
  {
    id: "trafficStatus",
    label: "道路交通状況",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => data.trafficStatus || "順調",
    categories: ["driving", "disaster"],
  },
  {
    id: "pressure",
    label: "気圧",
    emoji: "🌀",
    borderColorClass: "border-indigo",
    render: (data) => {
      if (data.pressure === null || data.pressure === undefined) return "-";
      return `${Math.round(data.pressure)} hPa`;
    },
    categories: ["weather", "climbing"],
  },
  {
    id: "maxLeanAngle",
    label: "最大バンク角",
    emoji: "🏍️",
    borderColorClass: "border-orange",
    render: (data) => {
      if (data.confirmResetLean) {
        return "タップしてリセット";
      }
      if (!data.maxLeanAngle) return "左: 0° | 右: 0°";
      return `左: ${data.maxLeanAngle.left}°\n右: ${data.maxLeanAngle.right}°`;
    },
    categories: ["driving"],
  },
];
