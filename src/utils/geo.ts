/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 2点の経緯度から距離（km）を計算（ハバーシンの公式）
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球の半径 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 2点間の始点から終点への真北基準の方位角（0〜360度）を計算
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

// 方位角（0〜360度）を16方位の文字列に変換
export function getCardinalDirection(bearing: number): string {
  const directions = [
    "北",
    "北北東",
    "北東",
    "東北東",
    "東",
    "東南東",
    "南東",
    "南南東",
    "南",
    "南南西",
    "南西",
    "西南西",
    "西",
    "西北西",
    "北西",
    "北北西",
  ];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

// デバイス方位（heading, 真北から時計回り）と、目的地方位角から、画面表示用のアロー（↖ ↙ ↗ ↘ ↑ ↓ ← →）を決定する
// デバイス向き(heading)がわからない（PCなど、null）の場合は絶対方位のアローを返す
export function getRelativeArrow(
  bearing: number,
  deviceHeading: number | null
): string {
  let relativeAngle = bearing;
  if (deviceHeading !== null) {
    // 目的地方位から、デバイスが向いている方位を引く
    relativeAngle = (bearing - deviceHeading + 360) % 360;
  }

  // relativeAngleを8つのアローに対応させる
  // 337.5〜22.5: ↑ (北/正面)
  // 22.5〜67.5: ↗ (北東/右前)
  // 67.5〜112.5: → (東/右)
  // 112.5〜157.5: ↘ (南東/右後ろ)
  // 157.5〜202.5: ↓ (南/後ろ)
  // 202.5〜247.5: ↙ (南西/左後ろ)
  // 247.5〜292.5: ← (西/左)
  // 292.5〜337.5: ↖ (北西/左前)
  if (relativeAngle >= 337.5 || relativeAngle < 22.5) return "↑";
  if (relativeAngle >= 22.5 && relativeAngle < 67.5) return "↗";
  if (relativeAngle >= 67.5 && relativeAngle < 112.5) return "→";
  if (relativeAngle >= 112.5 && relativeAngle < 157.5) return "↘";
  if (relativeAngle >= 157.5 && relativeAngle < 202.5) return "↓";
  if (relativeAngle >= 202.5 && relativeAngle < 247.5) return "↙";
  if (relativeAngle >= 247.5 && relativeAngle < 292.5) return "←";
  return "↖";
}

// 基準となる目的地座標
export const DESTINATIONS = {
  TOKYO_STATION: { lat: 35.681236, lon: 139.767125, name: "東京駅" },
  MT_FUJI: { lat: 35.3606, lon: 138.7274, name: "富士山" },
};

// 最寄りの県庁所在地リスト（日本全国47都道府県）
export const PREFECTURAL_CAPITALS = [
  { name: "札幌市", lat: 43.062095, lon: 141.354376 },
  { name: "青森市", lat: 40.822002, lon: 140.747365 },
  { name: "盛岡市", lat: 39.702053, lon: 141.154483 },
  { name: "仙台市", lat: 38.268215, lon: 140.869356 },
  { name: "秋田市", lat: 39.720008, lon: 140.102564 },
  { name: "山形市", lat: 38.255439, lon: 140.339602 },
  { name: "福島市", lat: 37.760834, lon: 140.474728 },
  { name: "水戸市", lat: 36.365857, lon: 140.471197 },
  { name: "宇都宮市", lat: 36.565125, lon: 139.883565 },
  { name: "前橋市", lat: 36.389482, lon: 139.063428 },
  { name: "さいたま市", lat: 35.86163, lon: 139.645482 },
  { name: "千葉市", lat: 35.607267, lon: 140.106291 },
  { name: "新宿区(東京)", lat: 35.6895, lon: 139.6917 },
  { name: "横浜市", lat: 35.443708, lon: 139.638026 },
  { name: "新潟市", lat: 37.916192, lon: 139.036413 },
  { name: "富山市", lat: 36.695952, lon: 137.213674 },
  { name: "金沢市", lat: 36.561325, lon: 136.656205 },
  { name: "福井市", lat: 36.064067, lon: 136.219606 },
  { name: "甲府市", lat: 35.662061, lon: 138.56831 },
  { name: "長野市", lat: 36.64855, lon: 138.194243 },
  { name: "岐阜市", lat: 35.423298, lon: 136.760654 },
  { name: "静岡市", lat: 34.975562, lon: 138.382761 },
  { name: "名古屋市", lat: 35.181446, lon: 136.906398 },
  { name: "津市", lat: 34.718595, lon: 136.505718 },
  { name: "大津市", lat: 35.01783, lon: 135.85474 },
  { name: "京都市", lat: 35.011564, lon: 135.768149 },
  { name: "大阪市", lat: 34.693737, lon: 135.502165 },
  { name: "神戸市", lat: 34.690083, lon: 135.195511 },
  { name: "奈良市", lat: 34.685087, lon: 135.832742 },
  { name: "和歌山市", lat: 34.230511, lon: 135.170811 },
  { name: "鳥取市", lat: 35.501133, lon: 134.235091 },
  { name: "松江市", lat: 35.46806, lon: 133.048375 },
  { name: "岡山市", lat: 34.661772, lon: 133.934406 },
  { name: "広島市", lat: 34.385203, lon: 132.455293 },
  { name: "山口市", lat: 34.178456, lon: 131.473727 },
  { name: "徳島市", lat: 34.071105, lon: 134.551644 },
  { name: "高松市", lat: 34.342782, lon: 134.046555 },
  { name: "松山市", lat: 33.839157, lon: 132.765575 },
  { name: "高知市", lat: 33.559705, lon: 133.531079 },
  { name: "福岡市", lat: 33.590355, lon: 130.401716 },
  { name: "佐賀市", lat: 33.263483, lon: 130.300858 },
  { name: "長崎市", lat: 32.750139, lon: 129.877662 },
  { name: "熊本市", lat: 32.8031, lon: 130.707891 },
  { name: "大分市", lat: 33.238172, lon: 131.612592 },
  { name: "宮崎市", lat: 31.907674, lon: 131.420241 },
  { name: "鹿児島市", lat: 31.596554, lon: 130.557116 },
  { name: "那覇市", lat: 26.212401, lon: 127.680932 },
];

export function findNearestCapital(
  lat: number,
  lon: number
): { name: string; distance: number; bearing: number } {
  let nearest = PREFECTURAL_CAPITALS[0];
  let minDistance = Infinity;

  for (const capital of PREFECTURAL_CAPITALS) {
    const dist = calculateDistance(lat, lon, capital.lat, capital.lon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = capital;
    }
  }

  const bearing = calculateBearing(lat, lon, nearest.lat, nearest.lon);
  return {
    name: nearest.name,
    distance: minDistance,
    bearing,
  };
}

// 簡易月齢計算（2000年1月6日 18:14 UTCが新月とする）
export function getMoonAgeAndState(date: Date): { age: number; state: string } {
  const baseDate = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const synodicMonth = 29.530588853; // 月の朔望周期（日）
  const diffTime = date.getTime() - baseDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const age = (diffDays % synodicMonth + synodicMonth) % synodicMonth;

  let state = "不明";
  if (age < 1.5) state = "新月";
  else if (age < 7.0) state = "三日月";
  else if (age < 8.5) state = "上弦の月";
  else if (age < 14.0) state = "十日余月";
  else if (age < 16.0) state = "満月";
  else if (age < 22.0) state = "十六夜月";
  else if (age < 23.5) state = "下弦の月";
  else state = "二十六夜";

  return { age, state };
}

// 太陽の現在方位・高度（簡易天文学計算）
// 経度、緯度、現在時間より算出
export function getSolarPosition(
  lat: number,
  lon: number,
  date: Date
): { bearing: number; cardinal: string; elevation: number } {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  
  // 簡易計算：およその太陽の経度と赤緯を算出
  // 1年の日数：365.25
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0));
  const dayOfYear = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
  
  // 太陽の平均黄経
  const g = (357.529 + 0.98560028 * dayOfYear) % 360;
  const q = (280.459 + 0.98564736 * dayOfYear) % 360;
  const L = (q + 1.915 * Math.sin((g * Math.PI) / 180) + 0.02 * Math.sin((2 * g * Math.PI) / 180)) % 360;
  
  // 黄道傾斜角
  const e = 23.439 - 0.00000036 * dayOfYear;
  
  // 太陽の赤緯 (Declination)
  const declination = Math.asin(Math.sin((e * Math.PI) / 180) * Math.sin((L * Math.PI) / 180)) * (180 / Math.PI);
  
  // 地方恒星時・時角の簡易推定
  // 太陽の地方時角 (Hour Angle)
  // 正午 (12時) に太陽が真南 (時角 = 0) になると仮定
  // 1時間あたり15度移動する。経度による時差：1度 = 4分 = 15度/時間
  const localSolarTime = (utcHours + lon / 15 + 24) % 24;
  const hourAngle = (localSolarTime - 12) * 15; // 度数
  
  // 高度 (Elevation / Altitude)
  const latRad = (lat * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;
  const haRad = (hourAngle * Math.PI) / 180;
  
  const sinEl = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const elevation = Math.asin(sinEl) * (180 / Math.PI);
  
  // 方位角 (Azimuth / Bearing)
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinEl) / (Math.cos(latRad) * Math.cos(Math.asin(sinEl)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
  
  if (Math.sin(haRad) > 0) {
    azimuth = 360 - azimuth;
  }
  
  // 16方位
  const cardinal = getCardinalDirection(azimuth);
  
  return {
    bearing: azimuth,
    cardinal,
    elevation,
  };
}

// 簡易的な潮汐の予測（満潮・干潮）
// 月齢から大まかな満潮、干潮の時間を算出
export function getTideTimes(date: Date, moonAge: number): { highTides: string[]; lowTides: string[] } {
  // 満潮は、月が南中するタイミング（およびその12.42時間後）に近い。
  // 月の南中時間は、太陽の南中（12時）から月齢 * 0.83時間遅れる。
  // 月齢0（新月）＝ 南中12:00頃。満潮＝12:00, 00:25頃
  // 月齢7.4（上弦）＝ 南中18:00頃。満潮＝18:00, 06:25頃
  // 月齢15（満月）＝ 南中00:00頃。満潮＝00:00, 12:25頃
  // 月齢22（下弦）＝ 南中06:00頃。満潮＝06:00, 18:25頃
  const firstHighDecimal = (12 + moonAge * 0.83) % 24;
  const secondHighDecimal = (firstHighDecimal + 12.42) % 24;

  const firstLowDecimal = (firstHighDecimal + 6.21) % 24;
  const secondLowDecimal = (secondHighDecimal + 6.21) % 24;

  const formatDecimalTime = (decimal: number) => {
    const hours = Math.floor(decimal);
    const minutes = Math.floor((decimal - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  return {
    highTides: [formatDecimalTime(firstHighDecimal), formatDecimalTime(secondHighDecimal)].sort(),
    lowTides: [formatDecimalTime(firstLowDecimal), formatDecimalTime(secondLowDecimal)].sort(),
  };
}
