/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
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
  // システム・日時（category: "system"）
  // =========================================================================
  {
    id: "currentDate",
    label: "現在年月日",
    emoji: "📅",
    borderColorClass: "border-white",
    render: (data) => data.currentDate || "-",
    category: "system",
  },
  {
    id: "currentTime",
    label: "現在時間",
    emoji: "⏰",
    borderColorClass: "border-white",
    render: (data) => data.currentTime || "-",
    category: "system",
  },

  // =========================================================================
  // 交通・移動・位置（category: "transit"）
  // =========================================================================
  {
    id: "bearing",
    label: "方角",
    emoji: "🧭",
    borderColorClass: "border-white",
    render: (data) => {
      if (!data.bearing) return "-";
      const arrow = getArrow(data.bearing.angle, null);
      return `${data.bearing.direction}\n${data.bearing.angle}° ${arrow}`;
    },
    category: "transit",
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
    category: "transit",
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
    category: "transit",
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
    category: "transit",
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
    category: "transit",
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
    category: "transit",
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
    category: "transit",
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
    category: "transit",
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
    category: "transit",
  },

  // =========================================================================
  // 環境・気象・天体（category: "environment"）
  // =========================================================================
  {
    id: "elevation",
    label: "標高 (気圧・GPS算出)",
    emoji: "🗻",
    borderColorClass: "border-purple",
    render: (data) => {
      if (data.elevation === null || data.elevation === undefined) return "-";
      return `${Math.round(data.elevation)}m`;
    },
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
        return `日没まで\n${hours > 0 ? `${hours}時間` : ""}${mins}分${secs}秒`;
      } else {
        const passedMins = Math.floor(Math.abs(diffMs) / 60000);
        if (passedMins < 60) {
          return `日没から\n${passedMins}分経過`;
        }
        return "夜間 (日没済)";
      }
    },
    category: "environment",
  },
  {
    id: "magicHour",
    label: "マジックアワー",
    emoji: "🌅",
    borderColorClass: "border-yellow",
    render: (data) => data.magicHour || "-",
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
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
    category: "environment",
  },

  // =========================================================================
  // 防災・社会インフラ（category: "disaster"）
  // =========================================================================
  {
    id: "earthquake",
    label: "地震・防災情報",
    emoji: "🚨",
    borderColorClass: "border-red",
    render: (data) => data.earthquake || "異常なし（安定）",
    category: "disaster",
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
    category: "disaster",
  },
  {
    id: "trafficStatus",
    label: "道路交通状況",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => data.trafficStatus || "順調",
    category: "disaster",
  },
];
