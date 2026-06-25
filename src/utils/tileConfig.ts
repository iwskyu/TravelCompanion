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
  // ==========================================
  // 1. 基本日時（2個）
  // ==========================================
  {
    id: "currentDate",
    label: "現在年月日",
    emoji: "📅",
    borderColorClass: "border-white",
    render: (data) => {
      return data.currentDate || "-";
    },
  },
  {
    id: "currentTime",
    label: "現在時間",
    emoji: "⏰",
    borderColorClass: "border-white",
    render: (data) => {
      return data.currentTime || "-";
    },
  },

  // ==========================================
  // 2. デバイスセンサー・GPS基礎（4個）
  // ==========================================
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
  },

  // ==========================================
  // 3. 標高データ（2個・補正・連続）
  // ==========================================
  {
    id: "elevation",
    label: "高度",
    emoji: "⛰️",
    borderColorClass: "border-white",
    render: (data) => {
      if (data.elevation === null) return "-";
      return `高度\n${Math.round(data.elevation)}m`;
    },
  },
  {
    id: "gsiElevation",
    label: "国土地理院 標高",
    emoji: "🗻",
    borderColorClass: "border-white",
    render: (data) => {
      if (data.gsiElevation === null || data.gsiElevation === undefined) return "-";
      return `${Math.round(data.gsiElevation)}m`;
    },
  },

  // ==========================================
  // 4. 電力 & 地震・防災 & 道路交通（5個・連続）
  // ==========================================
  {
    id: "powerUsage",
    label: "電力使用状況",
    emoji: "⚡",
    borderColorClass: "border-green",
    render: (data) => {
      if (!data.powerUsage) return "-";
      const { company, rate, usage, capacity } = data.powerUsage;
      return `${company}\n使用率 ${rate}%\n(${Math.round(usage)}/${capacity}万kW)`;
    },
  },
  {
    id: "earthquake",
    label: "地震・防災情報",
    emoji: "🚨",
    borderColorClass: "border-orange",
    render: (data) => {
      return data.earthquake || "異常なし（安定）";
    },
  },
  {
    id: "trafficStatus",
    label: "道路交通状況",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => {
      return data.trafficStatus || "順調";
    },
  },
  {
    id: "roadDensity1",
    label: "主要道路1交通密度",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => {
      if (!data.roadDensity1) return "-";
      if (data.roadDensity1.roadName === "該当なし(5km)") {
        if (data.roadDensity1.info === "順調") return "順調";
        return "該当なし(5km)";
      }
      const road = data.roadDensity1.roadName;
      const info = data.roadDensity1.info;
      const dist = formatDistance(data.roadDensity1.distance);
      return `${road} (${info})\n${dist}`;
    },
  },
  {
    id: "roadDensity2",
    label: "主要道路2交通密度",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => {
      if (!data.roadDensity2 || data.roadDensity2.info === "-" || data.roadDensity2.roadName === "-" || data.roadDensity2.roadName === "該当なし(5km)") {
        return "順調";
      }
      const road = data.roadDensity2.roadName;
      const info = data.roadDensity2.info;
      const dist = formatDistance(data.roadDensity2.distance);
      return `${road} (${info})\n${dist}`;
    },
  },

  // ==========================================
  // 5. 気象・環境情報 (Open-Meteo API)（7個・連続）
  // ==========================================
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
  },
  {
    id: "magicHour",
    label: "マジックアワー",
    emoji: "🌅",
    borderColorClass: "border-yellow",
    render: (data) => {
      return data.magicHour || "-";
    },
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
  },

  // ==========================================
  // 6. 大気汚染 (Air Quality API)（2個・連続）
  // ==========================================
  {
    id: "airQuality",
    label: "花粉",
    emoji: "🌲",
    borderColorClass: "border-green",
    render: (data) => {
      if (!data.airQuality) return "-";
      return `${data.airQuality.pollenText}`;
    },
  },
  {
    id: "pm25",
    label: "PM2.5",
    emoji: "🌫️",
    borderColorClass: "border-green",
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
  },

  // ==========================================
  // 7. 天体・宇宙（2個）
  // ==========================================
  {
    id: "moonAge",
    label: "月齢",
    emoji: "🌙",
    borderColorClass: "border-indigo",
    render: (data) => {
      if (!data.moonAge) return "-";
      return `${data.moonAge.state}\n${data.moonAge.age.toFixed(1)}日`;
    },
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
  },

  // ==========================================
  // 8. 方角・偏角（2個・連続）
  // ==========================================
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
  },
  {
    id: "magneticDeclination",
    label: "磁気偏角",
    emoji: "🧭",
    borderColorClass: "border-indigo",
    render: (data) => {
      if (data.magneticDeclination === null || data.magneticDeclination === undefined) return "-";
      const val = data.magneticDeclination;
      const dir = val >= 0 ? "西偏" : "東偏";
      return `${dir} ${Math.abs(val)}°`;
    },
  },

  // ==========================================
  // 9. 目的地距離と方角アロー（5個・連続）
  // ==========================================
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
  },

  // ==========================================
  // 10. 海洋情報 (Marine API)（3個・連続）
  // ==========================================
  {
    id: "seaTemp",
    label: "海水温",
    emoji: "🌊",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (data.seaTemp === null) return "-";
      return `${data.seaTemp.toFixed(1)}℃`;
    },
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
  },
];
