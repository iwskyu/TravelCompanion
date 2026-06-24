/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TileConfig, CompanionData } from "../types";
import { getRelativeArrow, getCardinalDirection } from "./geo";
import { getWeatherEmojiAndName } from "./api";

// 距離をきれいにフォーマットする（1km未満ならm、1km以上なら小数点1桁のkm）
function formatDistance(distKm: number | null): string {
  if (distKm === null) return "-";
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
  // 1-5: 白
  {
    id: "tilt",
    label: "傾き",
    emoji: "📐",
    borderColorClass: "border-white",
    render: (data) => {
      if (!data.tilt) return "-";
      const { pitch, roll } = data.tilt;
      return `前後:${pitch}°\n左右:${roll}°`;
    },
  },
  {
    id: "bearing",
    label: "方角",
    emoji: "🧭",
    borderColorClass: "border-white",
    render: (data) => {
      if (!data.bearing) return "-";
      const arrow = getArrow(data.bearing.angle, null); // 自身のコンパスは絶対方位を示す
      return `${arrow}${data.bearing.direction}\n${data.bearing.angle}°`;
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
      return `精度 ${level}\n${acc}m`;
    },
  },
  {
    id: "speed",
    label: "移動速度",
    emoji: "🚗",
    borderColorClass: "border-white",
    render: (data) => {
      if (data.speed === null) return "0 km/h";
      const speedKmh = Math.round(data.speed * 3.6); // m/s to km/h
      return `${speedKmh} km/h`;
    },
  },
  {
    id: "elevation",
    label: "標高",
    emoji: "⛰️",
    borderColorClass: "border-blue", // 青
    render: (data) => {
      if (data.elevation === null) return "-";
      return `${Math.round(data.elevation)}m`;
    },
  },

  // 6-9: 青 (長距離、目的地)
  {
    id: "tokyoDistance",
    label: "東京駅まで",
    emoji: "⛪️",
    borderColorClass: "border-blue",
    render: (data, heading) => {
      if (data.tokyoDistance === null || data.tokyoBearing === null) return "-";
      const arrow = getArrow(data.tokyoBearing, heading);
      return `${arrow}${formatDistance(data.tokyoDistance)}`;
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
      return `${arrow}${formatDistance(data.seaDistance)}`;
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
      return `${arrow}${formatDistance(data.fujiDistance)}`;
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
      return `${name}\n${arrow}${formatDistance(distance)}`;
    },
  },

  // 10-17: 黄色 (気象、太陽、風など)
  {
    id: "weather",
    label: "天気、気温",
    emoji: "🌈",
    borderColorClass: "border-yellow",
    render: (data) => {
      if (!data.weather) return "-";
      const info = getWeatherEmojiAndName(data.weather.code);
      return `${info.emoji}${info.name}\n${data.weather.temp.toFixed(1)}℃`;
    },
  },
  {
    id: "precipitation",
    label: "降水確率、降水量",
    emoji: "☔",
    borderColorClass: "border-yellow",
    render: (data) => {
      if (!data.precipitation) return "-";
      const prob = data.precipitation.probability !== null ? `確率 ${data.precipitation.probability}%` : "確率 -";
      const amt = data.precipitation.amount !== null ? `水量 ${data.precipitation.amount}mm` : "水量 -";
      return `${prob}\n${amt}`;
    },
  },
  {
    id: "rainCloudApproach",
    label: "雨雲接近",
    emoji: "🌧️",
    borderColorClass: "border-yellow",
    render: (data) => {
      return data.rainCloudApproach || "-";
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
    id: "sunrise",
    label: "日の出",
    emoji: "🌅",
    borderColorClass: "border-yellow",
    render: (data, heading) => {
      if (!data.sunrise) return "-";
      const arrow = getArrow(data.sunrise.bearing, heading);
      return `${data.sunrise.time}${arrow}`;
    },
  },
  {
    id: "sunset",
    label: "日没",
    emoji: "🌇",
    borderColorClass: "border-yellow",
    render: (data, heading) => {
      if (!data.sunset) return "-";
      const arrow = getArrow(data.sunset.bearing, heading);
      return `${data.sunset.time}${arrow}`;
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
      return `${data.wind.speed}m/s\n${data.wind.direction}${arrow}`;
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

  // 18: 緑 (大気汚染)
  {
    id: "airQuality",
    label: "花粉",
    emoji: "🌲",
    borderColorClass: "border-green",
    render: (data) => {
      if (!data.airQuality) return "-";
      const pollenVal = data.airQuality.pm25 !== null ? `${data.airQuality.pm25.toFixed(1)}μg/m³` : "-";
      return `${data.airQuality.pollenText}\n${pollenVal}`;
    },
  },

  // 19-21: エメラルドグリーン (海洋、潮汐)
  {
    id: "seaTemp",
    label: "海水温",
    emoji: "🌊",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (data.seaTemp === null) return "海面温度\n-";
      return `海面温度\n${data.seaTemp.toFixed(1)}℃`;
    },
  },
  {
    id: "highTide",
    label: "潮汐満潮",
    emoji: "🌊",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.highTide || data.highTide === "-") return "-";
      return `満潮時間\n${data.highTide}`;
    },
  },
  {
    id: "lowTide",
    label: "潮汐干潮",
    emoji: "🌊",
    borderColorClass: "border-emerald",
    render: (data) => {
      if (!data.lowTide || data.lowTide === "-") return "-";
      return `干潮時間\n${data.lowTide}`;
    },
  },

  // 22-23: 紺 (天体、太陽)
  {
    id: "moonAge",
    label: "月齢",
    emoji: "🌙",
    borderColorClass: "border-navy",
    render: (data) => {
      if (!data.moonAge) return "-";
      return `${data.moonAge.state}\n${data.moonAge.age.toFixed(1)}日`;
    },
  },
  {
    id: "sunPosition",
    label: "太陽の位置",
    emoji: "🌞",
    borderColorClass: "border-navy",
    render: (data, heading) => {
      if (!data.sunPosition) return "-";
      const arrow = getArrow(data.sunPosition.bearing, heading);
      return `${arrow}${data.sunPosition.cardinal}`;
    },
  },

  // 24-25: オレンジ (河川)
  {
    id: "river",
    label: "河川名・距離",
    emoji: "🏞️",
    borderColorClass: "border-orange",
    render: (data) => {
      if (!data.river) return "-";
      if (data.river.name === "5km以内に該当なし") return "5km以内に該当なし";
      return `${data.river.name}\n${formatDistance(data.river.distance)}`;
    },
  },
  {
    id: "riverLevel",
    label: "河川水位",
    emoji: "💧",
    borderColorClass: "border-orange",
    render: (data) => {
      if (!data.riverLevel) return "-";
      if (data.riverLevel.name === "5km以内に該当なし") {
        if (data.riverLevel.danger === "平穏") return "平穏";
        return "5km以内に該当なし";
      }
      return `${data.riverLevel.name}\n${data.riverLevel.level}(${data.riverLevel.danger})`;
    },
  },

  // 26-27: 赤 (主要道路)
  {
    id: "roadDensity1",
    label: "主要道路1交通密度",
    emoji: "🛣️",
    borderColorClass: "border-red",
    render: (data) => {
      if (!data.roadDensity1) return "-";
      if (data.roadDensity1.roadName === "5km以内に該当なし") {
        if (data.roadDensity1.info === "順調") return "順調";
        return "5km以内に該当なし";
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
      if (!data.roadDensity2) return "-";
      if (data.roadDensity2.roadName === "5km以内に該当なし") {
        if (data.roadDensity2.info === "順調") return "順調";
        return "5km以内に該当なし";
      }
      const road = data.roadDensity2.roadName;
      const info = data.roadDensity2.info;
      const dist = formatDistance(data.roadDensity2.distance);
      return `${road} (${info})\n${dist}`;
    },
  },

  // 28-41: 茶色 (周辺POI、宿泊、コンプレックス)
  {
    id: "convenience1",
    label: "コンビニ1",
    emoji: "🏪",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.convenience1) return "-";
      if (data.convenience1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.convenience1.bearing, heading);
      return `${data.convenience1.name}\n${formatDistance(data.convenience1.distance)}${arrow}`;
    },
  },
  {
    id: "convenience2",
    label: "コンビニ2",
    emoji: "🏪",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.convenience2) return "-";
      if (data.convenience2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.convenience2.bearing, heading);
      return `${data.convenience2.name}\n${formatDistance(data.convenience2.distance)}${arrow}`;
    },
  },
  {
    id: "toilet1",
    label: "トイレ1",
    emoji: "🚾",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.toilet1) return "-";
      if (data.toilet1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.toilet1.bearing, heading);
      return `${data.toilet1.name}\n${formatDistance(data.toilet1.distance)}${arrow}`;
    },
  },
  {
    id: "toilet2",
    label: "トイレ2",
    emoji: "🚾",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.toilet2) return "-";
      if (data.toilet2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.toilet2.bearing, heading);
      return `${data.toilet2.name}\n${formatDistance(data.toilet2.distance)}${arrow}`;
    },
  },
  {
    id: "wifi1",
    label: "無料Wi-Fi1",
    emoji: "📶",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.wifi1) return "-";
      if (data.wifi1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.wifi1.bearing, heading);
      return `${data.wifi1.name}\n${formatDistance(data.wifi1.distance)}${arrow}`;
    },
  },
  {
    id: "wifi2",
    label: "無料Wi-Fi2",
    emoji: "📶",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.wifi2) return "-";
      if (data.wifi2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.wifi2.bearing, heading);
      return `${data.wifi2.name}\n${formatDistance(data.wifi2.distance)}${arrow}`;
    },
  },
  {
    id: "gas1",
    label: "ガソリン1",
    emoji: "⛽",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.gas1) return "-";
      if (data.gas1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.gas1.bearing, heading);
      return `${data.gas1.name}\n${formatDistance(data.gas1.distance)}${arrow}`;
    },
  },
  {
    id: "gas2",
    label: "ガソリン2",
    emoji: "⛽",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.gas2) return "-";
      if (data.gas2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.gas2.bearing, heading);
      return `${data.gas2.name}\n${formatDistance(data.gas2.distance)}${arrow}`;
    },
  },
  {
    id: "parking1",
    label: "駐車場1",
    emoji: "🅿️",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.parking1) return "-";
      if (data.parking1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.parking1.bearing, heading);
      return `${data.parking1.name}\n${formatDistance(data.parking1.distance)}${arrow}`;
    },
  },
  {
    id: "parking2",
    label: "駐車場2",
    emoji: "🅿️",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.parking2) return "-";
      if (data.parking2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.parking2.bearing, heading);
      return `${data.parking2.name}\n${formatDistance(data.parking2.distance)}${arrow}`;
    },
  },
  {
    id: "roadStation1",
    label: "道の駅1",
    emoji: "🏡",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.roadStation1) return "-";
      if (data.roadStation1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.roadStation1.bearing, heading);
      return `${data.roadStation1.name}\n${formatDistance(data.roadStation1.distance)}${arrow}`;
    },
  },
  {
    id: "roadStation2",
    label: "道の駅2",
    emoji: "🏡",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.roadStation2) return "-";
      if (data.roadStation2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.roadStation2.bearing, heading);
      return `${data.roadStation2.name}\n${formatDistance(data.roadStation2.distance)}${arrow}`;
    },
  },
  {
    id: "hotel",
    label: "最寄りホテル",
    emoji: "🏨",
    borderColorClass: "border-brown",
    render: (data) => {
      if (!data.hotel) return "-";
      if (data.hotel.name === "5km以内に該当なし") return "5km以内に該当なし";
      return `${data.hotel.name}\n${formatDistance(data.hotel.distance)}`;
    },
  },
  {
    id: "guesthouse",
    label: "最寄りゲストハウス",
    emoji: "🏡",
    borderColorClass: "border-brown",
    render: (data) => {
      if (!data.guesthouse) return "-";
      if (data.guesthouse.name === "5km以内に該当なし") return "5km以内に該当なし";
      return `${data.guesthouse.name}\n${formatDistance(data.guesthouse.distance)}`;
    },
  },

  // 42-45: 赤 (主要交通機関)
  {
    id: "station1",
    label: "最寄り駅1",
    emoji: "🚃",
    borderColorClass: "border-red",
    render: (data, heading) => {
      if (!data.station1) return "-";
      if (data.station1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.station1.bearing, heading);
      return `${data.station1.line}:${data.station1.name}\n${formatDistance(data.station1.distance)}${arrow}`;
    },
  },
  {
    id: "station2",
    label: "最寄り駅2",
    emoji: "🚃",
    borderColorClass: "border-red",
    render: (data, heading) => {
      if (!data.station2) return "-";
      if (data.station2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.station2.bearing, heading);
      return `${data.station2.line}:${data.station2.name}\n${formatDistance(data.station2.distance)}${arrow}`;
    },
  },
  {
    id: "bus1",
    label: "バス情報1",
    emoji: "🚌",
    borderColorClass: "border-red",
    render: (data, heading) => {
      if (!data.bus1) return "-";
      if (data.bus1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.bus1.bearing, heading);
      return `${data.bus1.line}:${data.bus1.name}(${formatDistance(data.bus1.distance)}${arrow})\n次 ${data.bus1.nextBus}`;
    },
  },
  {
    id: "bus2",
    label: "バス情報2",
    emoji: "🚌",
    borderColorClass: "border-red",
    render: (data, heading) => {
      if (!data.bus2) return "-";
      if (data.bus2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.bus2.bearing, heading);
      return `${data.bus2.line}:${data.bus2.name}(${formatDistance(data.bus2.distance)}${arrow})\n次 ${data.bus2.nextBus}`;
    },
  },

  // 46-47: 茶色 (グルメ)
  {
    id: "gourmet1",
    label: "グルメ情報1",
    emoji: "🍜",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.gourmet1) return "-";
      if (data.gourmet1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.gourmet1.bearing, heading);
      return `${data.gourmet1.name}\n★${data.gourmet1.rating.toFixed(1)} / ${formatDistance(data.gourmet1.distance)}${arrow}`;
    },
  },
  {
    id: "gourmet2",
    label: "グルメ情報2",
    emoji: "🍜",
    borderColorClass: "border-brown",
    render: (data, heading) => {
      if (!data.gourmet2) return "-";
      if (data.gourmet2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.gourmet2.bearing, heading);
      return `${data.gourmet2.name}\n★${data.gourmet2.rating.toFixed(1)} / ${formatDistance(data.gourmet2.distance)}${arrow}`;
    },
  },

  // 48-50: 青 (位置・郵便番号、山)
  {
    id: "zipcode",
    label: "郵便番号",
    emoji: "📮",
    borderColorClass: "border-blue",
    render: (data) => {
      if (!data.zipcode || data.zipcode === "-") return "-";
      return `〒${data.zipcode}`;
    },
  },
  {
    id: "address",
    label: "現在地",
    emoji: "🗺️",
    borderColorClass: "border-blue",
    render: (data) => {
      return data.address || "-";
    },
  },
  {
    id: "mountain",
    label: "山の名前・標高・距離",
    emoji: "⛰️",
    borderColorClass: "border-blue",
    render: (data) => {
      if (!data.mountain) return "-";
      if (data.mountain.name === "5km以内に該当なし") return "5km以内に該当なし";
      return `${data.mountain.name}\n標高${Math.round(data.mountain.elevation)}m ${formatDistance(data.mountain.distance)}`;
    },
  },

  // 51-52: 紫 (観光地)
  {
    id: "attraction1",
    label: "観光地1",
    emoji: "🎡",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.attraction1) return "-";
      if (data.attraction1.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.attraction1.bearing, heading);
      return `${data.attraction1.name}\n${formatDistance(data.attraction1.distance)}${arrow}`;
    },
  },
  {
    id: "attraction2",
    label: "観光地2",
    emoji: "🎡",
    borderColorClass: "border-purple",
    render: (data, heading) => {
      if (!data.attraction2) return "-";
      if (data.attraction2.name === "5km以内に該当なし") return "5km以内に該当なし";
      const arrow = getArrow(data.attraction2.bearing, heading);
      return `${data.attraction2.name}\n${formatDistance(data.attraction2.distance)}${arrow}`;
    },
  },
];
