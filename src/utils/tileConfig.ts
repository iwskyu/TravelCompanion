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
  // 1. システム・日時（スレートグレー: border-white）
  // =========================================================================
  {
    id: "currentDate",
    label: "現在年月日",
    emoji: "📅",
    borderColorClass: "border-white",
    render: (data) => data.currentDate || "-",
  },
  {
    id: "currentTime",
    label: "現在時間",
    emoji: "⏰",
    borderColorClass: "border-white",
    render: (data) => data.currentTime || "-",
  },

  // =========================================================================
  // 2. 位置・GPS・物理センサー（スレートグレー: border-white）
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

  // =========================================================================
  // 3. 地球物理・目的地方角と距離（スカイブルー: border-blue）
  // =========================================================================
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

  // =========================================================================
  // 4. 気象情報 [Open-Meteo API]（アンバー: border-yellow）
  // =========================================================================
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
    render: (data) => data.magicHour || "-",
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

  // =========================================================================
  // 5. 天体情報（インディゴ: border-indigo）
  // =========================================================================
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

  // =========================================================================
  // 6. 大気・環境情報 [Air Quality API]（ティール: border-emerald）
  // =========================================================================
  {
    id: "airQuality",
    label: "花粉",
    emoji: "🌲",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.airQuality) return "-";
      return `${data.airQuality.pollenText}`;
    },
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
  },

  // =========================================================================
  // 7. 海洋情報 [Marine API]（ティール: border-emerald）
  // =========================================================================
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

  // =========================================================================
  // 8. 防災・社会インフラ（ローズ/レッド: border-red）
  // =========================================================================
  {
    id: "earthquake",
    label: "地震・防災情報",
    emoji: "🚨",
    borderColorClass: "border-red",
    render: (data) => data.earthquake || "異常なし（安定）",
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
  },
  {
    id: "trafficStatus",
    label: "道路交通状況",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => data.trafficStatus || "順調",
  },

  // =========================================================================
  // 9. 周辺POI・移動支援情報 [Overpass API]（パープル: border-purple）
  // =========================================================================
  {
    id: "station1",
    label: "最寄り駅1",
    emoji: "🚉",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.station1 || data.station1.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.station1.bearing, heading);
      return `${data.station1.name}\n${formatDistance(data.station1.distance)} ${arrow}`;
    },
  },
  {
    id: "station2",
    label: "最寄り駅2",
    emoji: "🚉",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.station2 || data.station2.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.station2.bearing, heading);
      return `${data.station2.name}\n${formatDistance(data.station2.distance)} ${arrow}`;
    },
  },
  {
    id: "bus1",
    label: "バス停1",
    emoji: "🚌",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.bus1 || data.bus1.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.bus1.bearing, heading);
      return `${data.bus1.name}\n${formatDistance(data.bus1.distance)} ${arrow}`;
    },
  },
  {
    id: "bus2",
    label: "バス停2",
    emoji: "🚌",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.bus2 || data.bus2.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.bus2.bearing, heading);
      return `${data.bus2.name}\n${formatDistance(data.bus2.distance)} ${arrow}`;
    },
  },
  {
    id: "roadStation1",
    label: "最寄りの「道の駅」",
    emoji: "🏪",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.roadStation1 || data.roadStation1.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.roadStation1.bearing, heading);
      return `${data.roadStation1.name}\n${formatDistance(data.roadStation1.distance)} ${arrow}`;
    },
  },
  {
    id: "onsen",
    label: "最寄りの温泉・入浴施設",
    emoji: "♨️",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.onsen || data.onsen.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.onsen.bearing, heading);
      return `${data.onsen.name}\n${formatDistance(data.onsen.distance)} ${arrow}`;
    },
  },

  {
    id: "mountain",
    label: "最寄り山",
    emoji: "⛰️",
    borderColorClass: "border-purple",
    render: (data) => {
      if (!data.mountain || data.mountain.name === "該当なし(5km)") return "-";
      return `${data.mountain.name}\n${Math.round(data.mountain.elevation)}m (${formatDistance(data.mountain.distance)})`;
    },
  },
  {
    id: "gsiElevation",
    label: "国土地理院 標高",
    emoji: "🗻",
    borderColorClass: "border-purple",
    render: (data) => {
      if (data.gsiElevation === null || data.gsiElevation === undefined) return "-";
      return `${Math.round(data.gsiElevation)}m`;
    },
  },
  {
    id: "river",
    label: "最寄り川",
    emoji: "💧",
    borderColorClass: "border-purple",
    render: (data) => {
      if (!data.river || data.river.name === "該当なし(5km)") return "-";
      return `${data.river.name}\n(${formatDistance(data.river.distance)})`;
    },
  },
  {
    id: "riverLevel",
    label: "河川水位",
    emoji: "🌊",
    borderColorClass: "border-purple",
    render: (data) => {
      if (!data.riverLevel || data.riverLevel.name === "該当なし(5km)") return "-";
      return `${data.riverLevel.name}\n${data.riverLevel.level} [${data.riverLevel.danger}]`;
    },
  },
  {
    id: "intersection",
    label: "交差点",
    emoji: "🚦",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.intersection || data.intersection.name === "該当なし(5km)") return "-";
      const arrow = getArrow(data.intersection.bearing, heading);
      return `${data.intersection.name}\n${formatDistance(data.intersection.distance)} ${arrow}`;
    },
  },

];
