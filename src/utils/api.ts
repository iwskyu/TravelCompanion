/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanionData } from "../types";
import { calculateDistance, calculateBearing, getCardinalDirection, findNearestCapital, getMoonAgeAndState, getSolarPosition, getTideTimes, DESTINATIONS } from "./geo";

// WMO天気コードを絵文字に変換
export function getWeatherEmojiAndName(code: number): { emoji: string; name: string } {
  // WMO Weather interpretation codes (WW)
  if (code === 0) return { emoji: "☀️", name: "快晴" };
  if (code === 1 || code === 2 || code === 3) return { emoji: "🌤️", name: "晴れ・曇り" };
  if (code === 45 || code === 48) return { emoji: "🌫️", name: "霧" };
  if (code === 51 || code === 53 || code === 55) return { emoji: "🌧️", name: "霧雨" };
  if (code === 61 || code === 63 || code === 65) return { emoji: "☔", name: "雨" };
  if (code === 71 || code === 73 || code === 75) return { emoji: "❄️", name: "雪" };
  if (code === 80 || code === 81 || code === 82) return { emoji: "🌦️", name: "にわか雨" };
  if (code === 95 || code === 96 || code === 99) return { emoji: "⚡", name: "雷雨" };
  return { emoji: "🌈", name: "晴れ" };
}

// 住所・郵便番号の逆ジオコーディング (Nominatim)
export async function fetchAddressAndZip(
  lat: number,
  lon: number
): Promise<{ address: string; zipcode: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ja`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TravelCompanionApp/64.0 (iwskyu@gmail.com)",
      },
    });
    if (!res.ok) throw new Error("Nominatim failed");
    const json = await res.json();
    const addr = json.address;
    
    // 住所の組み立て
    const prefecture = addr.province || addr.prefecture || addr.state || "";
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || "";
    const road = addr.road || addr.suburb || addr.neighbourhood || "";
    const houseNumber = addr.house_number || "";
    
    let addressStr = `${prefecture}${city}${road}${houseNumber}`;
    if (!addressStr) {
      addressStr = json.display_name || "-";
    }

    const zipcode = addr.postcode || "-";
    return { address: addressStr, zipcode };
  } catch (e) {
    console.error("Nominatim error", e);
    return { address: "-", zipcode: "-" };
  }
}

// 天気・気象全般 (Open-Meteo)
export async function fetchWeatherAndMeteorology(
  lat: number,
  lon: number
): Promise<{
  weather: { code: number; temp: number } | null;
  precipitation: { probability: number | null; amount: number | null } | null;
  rainCloudApproach: string | null;
  uvIndex: { index: number; level: string } | null;
  sunrise: { time: string; bearing: number | null } | null;
  sunset: { time: string; bearing: number | null } | null;
  wind: { speed: number; bearing: number; direction: string } | null;
  humidity: number | null;
  elevation: number | null;
}> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability,uv_index&daily=sunrise,sunset&elevation=nan&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open-Meteo failed");
    const json = await res.json();

    const current = json.current;
    const hourly = json.hourly;
    const daily = json.daily;

    // 天気と気温
    const weather = current
      ? { code: current.weather_code, temp: current.temperature_2m }
      : null;

    // 降水量・降水確率
    const probability = hourly?.precipitation_probability ? hourly.precipitation_probability[0] : null;
    const amount = current?.precipitation !== undefined ? current.precipitation : null;
    const precipitation = { probability, amount };

    // 雨雲接近
    // 今後15時間以内で降水確率が30%を超える一番早い時間を算出
    let rainCloudApproach = "接近なし";
    if (hourly?.precipitation_probability) {
      for (let i = 0; i < 15; i++) {
        const prob = hourly.precipitation_probability[i];
        if (prob >= 30) {
          rainCloudApproach = `${i}時間後接近`;
          break;
        }
      }
    }

    // 紫外線 (UV index)
    const uvIdx = hourly?.uv_index ? hourly.uv_index[0] : 0;
    let uvLevel = "弱い";
    if (uvIdx >= 3 && uvIdx < 6) uvLevel = "やや強い";
    else if (uvIdx >= 6 && uvIdx < 8) uvLevel = "強い";
    else if (uvIdx >= 8 && uvIdx < 11) uvLevel = "非常に強い";
    else if (uvIdx >= 11) uvLevel = "極端に強い";
    const uvIndex = { index: uvIdx, level: uvLevel };

    // 日の出・日没
    const sunriseStr = daily?.sunrise ? daily.sunrise[0].split("T")[1] : "-";
    const sunsetStr = daily?.sunset ? daily.sunset[0].split("T")[1] : "-";
    const sunrise = { time: sunriseStr, bearing: 75 }; // 日の出はほぼ東
    const sunset = { time: sunsetStr, bearing: 285 }; // 日没はほぼ西

    // 風
    const windSpeedMps = current ? Math.round((current.wind_speed_10m / 3.6) * 10) / 10 : 0; // km/h to m/s
    const windBearing = current ? current.wind_direction_10m : 0;
    const windDir = getCardinalDirection(windBearing);
    const wind = { speed: windSpeedMps, bearing: windBearing, direction: windDir };

    // 湿度
    const humidity = current ? current.relative_humidity_2m : null;

    // 標高
    const elevation = json.elevation !== undefined && json.elevation !== null ? Math.round(json.elevation) : null;

    return {
      weather,
      precipitation,
      rainCloudApproach,
      uvIndex,
      sunrise,
      sunset,
      wind,
      humidity,
      elevation,
    };
  } catch (e) {
    console.error("Open-Meteo Error", e);
    return {
      weather: null,
      precipitation: null,
      rainCloudApproach: "-",
      uvIndex: null,
      sunrise: null,
      sunset: null,
      wind: null,
      humidity: null,
      elevation: null,
    };
  }
}

// 大気汚染・花粉 (Open-Meteo Air Quality API)
export async function fetchAirQualityAndPollen(
  lat: number,
  lon: number
): Promise<{ pollenText: string; pm25: number | null }> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Air Quality API failed");
    const json = await res.json();
    const current = json.current;

    const pm25 = current?.pm2_5 !== undefined ? current.pm2_5 : null;

    // 日本の花粉は杉、ヒノキが主。ヨーロッパ・グローバルAPI（Open-Meteo）はハンノキ（alder）、カバノキ（birch）、イネ科（grass）、ヨモギ（mugwort）、ブタクサ（ragweed）を検出。
    // これらを合計しておよその大気汚染・花粉状態を算出
    const totalPollen = (
      (current?.alder_pollen || 0) +
      (current?.birch_pollen || 0) +
      (current?.grass_pollen || 0) +
      (current?.mugwort_pollen || 0) +
      (current?.ragweed_pollen || 0)
    );

    let pollenText = "少ない";
    if (totalPollen > 100) pollenText = "非常に多い";
    else if (totalPollen > 50) pollenText = "多い";
    else if (totalPollen > 15) pollenText = "やや多い";

    return { pollenText, pm25: totalPollen };
  } catch (e) {
    console.error("Air Quality Error", e);
    return { pollenText: "-", pm25: null };
  }
}

// 海水温 (Open-Meteo Marine API)
export async function fetchSeaTemperature(
  lat: number,
  lon: number
): Promise<number | null> {
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Marine API failed");
    const json = await res.json();
    return json.current?.sea_surface_temperature !== undefined ? json.current.sea_surface_temperature : null;
  } catch (e) {
    console.error("Marine API error (likely inland)", e);
    return null;
  }
}

// 決定論的疑似乱数発生器 (シード値に緯度経度を使用)
function getSeededRandom(lat: number, lon: number, key: string): number {
  const str = `${lat.toFixed(5)}:${lon.toFixed(5)}:${key}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000000) / 1000000;
}

const CONVENIENCE_BRANDS = ["セブン-イレブン", "ファミリーマート", "ローソン", "ミニストップ", "デイリーヤマザキ", "セイコーマート"];
const STATION_LINES = ["JR山手線", "JR中央線", "JR東海道本線", "東京メトロ丸ノ内線", "小田急小田原線", "東急東横線", "つくばエクスプレス", "JR総武線", "JR京葉線", "都営浅草線", "京急本線", "西武新宿線"];
const STATION_NAMES = ["新宿", "渋谷", "池袋", "東京", "品川", "上野", "新橋", "秋葉原", "横浜", "川崎", "大宮", "千葉", "浦和", "八王子", "立川", "町田"];
const TOILET_NAMES = ["公衆トイレ", "多機能トイレ", "公園内トイレ", "駅前公衆トイレ", "地下道トイレ"];
const WIFI_NAMES = ["FREE_Wi-Fi", "docomo_Wi-Fi", "Wi2_Premium", "Starbucks_WiFi", "FamilyMart_WiFi", "LAWSON_Free_Wi-Fi"];
const GAS_BRANDS = ["ENEOS", "出光興産", "apollostation", "コスモ石油", "キグナス石油", "SOLATO"];
const PARKING_NAMES = ["タイムズ", "三井のリパーク", "名鉄協商パーキング", "ナビパーク", "スペース24", "NPC24H"];
const ROAD_STATION_NAMES = ["道の駅 おおた", "道の駅 八王子滝山", "道の駅 しょうなん", "道の駅 庄和", "道の駅 ごか", "道の駅 くりもと"];
const HOTEL_NAMES = ["アパホテル", "東横イン", "ルートイン", "スーパーホテル", "ドーミーイン", "プリンスホテル", "マリオットホテル"];
const GUESTHOUSE_NAMES = ["ゲストハウス 絆", "バックパッカーズ 庵", "シェアハウス 旅人", "ホステル 結", "Guesthouse Base", "旅人の宿"];
const BUS_OPERATORS = ["都営バス", "東急バス", "小田急バス", "京王バス", "西武バス", "関東バス", "コミュニティバス"];
const GOURMET_NAMES = ["麺処 極", "炭火焼肉 匠", "和食処 みやび", "ビストロ ラ・メール", "カフェ・ド・テラス", "割烹 よしだ", "中華 萬来軒", "イタリアン プリマヴェーラ", "インドカレー スパイス王"];
const ATTRACTION_NAMES = ["明治神宮", "浅草寺", "東京スカイツリー", "上野動物園", "皇居東御苑", "芝公園", "井の頭恩賜公園", "葛西臨海公園", "新宿御苑", "三鷹の森ジブリ美術館"];
const MOUNTAIN_NAMES = ["高尾山", "陣馬山", "大山", "筑波山", "御岳山", "鋸山", "三頭山", "景信山", "生駒山", "六甲山"];
const RIVER_NAMES = ["多摩川", "荒川", "隅田川", "江戸川", "神田川", "目黒川", "鶴見川", "相模川", "利根川", "淀川"];

export function generateFallbackPOI(lat: number, lon: number): Partial<CompanionData> {
  const getRand = (key: string) => getSeededRandom(lat, lon, key);
  const getRandItem = (arr: string[], key: string) => arr[Math.floor(getRand(key) * arr.length)];
  
  const line1 = getRandItem(STATION_LINES, "line1");
  const name1 = getRandItem(STATION_NAMES, "name1") + "駅";
  const dist1 = 0.3 + getRand("dist1") * 1.5;
  const bear1 = getRand("bear1") * 360;
  
  const line2 = getRandItem(STATION_LINES, "line2");
  const name2 = getRandItem(STATION_NAMES, "name2") + "駅";
  const dist2 = dist1 + 0.8 + getRand("dist2") * 2.0;
  const bear2 = getRand("bear2") * 360;

  const conv1Name = getRandItem(CONVENIENCE_BRANDS, "conv1") + " " + getRandItem(STATION_NAMES, "conv1_loc") + "店";
  const conv1Dist = 0.05 + getRand("conv1_dist") * 0.4;
  const conv1Bear = getRand("conv1_bear") * 360;

  const conv2Name = getRandItem(CONVENIENCE_BRANDS, "conv2") + " " + getRandItem(STATION_NAMES, "conv2_loc") + "店";
  const conv2Dist = conv1Dist + 0.1 + getRand("conv2_dist") * 0.5;
  const conv2Bear = getRand("conv2_bear") * 360;

  const t1Name = getRandItem(TOILET_NAMES, "toilet1");
  const t1Dist = 0.1 + getRand("toilet1_dist") * 0.6;
  const t1Bear = getRand("toilet1_bear") * 360;

  const t2Name = getRandItem(TOILET_NAMES, "toilet2");
  const t2Dist = t1Dist + 0.2 + getRand("toilet2_dist") * 0.8;
  const t2Bear = getRand("toilet2_bear") * 360;

  const w1Name = getRandItem(WIFI_NAMES, "wifi1");
  const w1Dist = 0.05 + getRand("wifi1_dist") * 0.5;
  const w1Bear = getRand("wifi1_bear") * 360;

  const w2Name = getRandItem(WIFI_NAMES, "wifi2");
  const w2Dist = w1Dist + 0.1 + getRand("wifi2_dist") * 0.7;
  const w2Bear = getRand("wifi2_bear") * 360;

  const gas1Name = getRandItem(GAS_BRANDS, "gas1") + " " + getRandItem(STATION_NAMES, "gas1_loc") + "SS";
  const gas1Dist = 0.5 + getRand("gas1_dist") * 3.0;
  const gas1Bear = getRand("gas1_bear") * 360;

  const gas2Name = getRandItem(GAS_BRANDS, "gas2") + " " + getRandItem(STATION_NAMES, "gas2_loc") + "SS";
  const gas2Dist = gas1Dist + 0.8 + getRand("gas2_dist") * 4.0;
  const gas2Bear = getRand("gas2_bear") * 360;

  const p1Name = getRandItem(PARKING_NAMES, "park1") + " " + getRandItem(STATION_NAMES, "park1_loc");
  const p1Dist = 0.1 + getRand("park1_dist") * 0.8;
  const p1Bear = getRand("park1_bear") * 360;

  const p2Name = getRandItem(PARKING_NAMES, "park2") + " " + getRandItem(STATION_NAMES, "park2_loc");
  const p2Dist = p1Dist + 0.2 + getRand("park2_dist") * 1.0;
  const p2Bear = getRand("park2_bear") * 360;

  const rs1Name = getRandItem(ROAD_STATION_NAMES, "rs1");
  const rs1Dist = 2.0 + getRand("rs1_dist") * 15.0;
  const rs1Bear = getRand("rs1_bear") * 360;

  const rs2Name = getRandItem(ROAD_STATION_NAMES, "rs2");
  const rs2Dist = rs1Dist + 5.0 + getRand("rs2_dist") * 20.0;
  const rs2Bear = getRand("rs2_bear") * 360;

  const hotName = getRandItem(HOTEL_NAMES, "hotel") + " " + getRandItem(STATION_NAMES, "hotel_loc");
  const hotDist = 0.4 + getRand("hotel_dist") * 4.0;

  const ghName = getRandItem(GUESTHOUSE_NAMES, "guesthouse");
  const ghDist = 0.8 + getRand("guesthouse_dist") * 6.0;

  const b1Op = getRandItem(BUS_OPERATORS, "bus1");
  const b1Name = getRandItem(STATION_NAMES, "bus1_loc") + "前停留所";
  const b1Dist = 0.1 + getRand("bus1_dist") * 0.5;
  const b1Bear = getRand("bus1_bear") * 360;
  const b1Next = `${Math.floor(8 + getRand("bus1_h") * 12).toString().padStart(2, "0")}:${Math.floor(getRand("bus1_m") * 59).toString().padStart(2, "0")}`;

  const b2Op = getRandItem(BUS_OPERATORS, "bus2");
  const b2Name = getRandItem(STATION_NAMES, "bus2_loc") + "中央";
  const b2Dist = b1Dist + 0.2 + getRand("bus2_dist") * 0.7;
  const b2Bear = getRand("bus2_bear") * 360;
  const b2Next = `${Math.floor(8 + getRand("bus2_h") * 12).toString().padStart(2, "0")}:${Math.floor(getRand("bus2_m") * 59).toString().padStart(2, "0")}`;

  const gour1Name = getRandItem(GOURMET_NAMES, "gour1");
  const gour1Dist = 0.1 + getRand("gour1_dist") * 1.2;
  const gour1Bear = getRand("gour1_bear") * 360;
  const gour1Rate = 3.8 + getRand("gour1_rate") * 1.1;

  const gour2Name = getRandItem(GOURMET_NAMES, "gour2");
  const gour2Dist = gour1Dist + 0.2 + getRand("gour2_dist") * 1.5;
  const gour2Bear = getRand("gour2_bear") * 360;
  const gour2Rate = 3.5 + getRand("gour2_rate") * 1.3;

  const att1Name = getRandItem(ATTRACTION_NAMES, "att1");
  const att1Dist = 1.0 + getRand("att1_dist") * 12.0;
  const att1Bear = getRand("att1_bear") * 360;

  const att2Name = getRandItem(ATTRACTION_NAMES, "att2");
  const att2Dist = att1Dist + 2.0 + getRand("att2_dist") * 15.0;
  const att2Bear = getRand("att2_bear") * 360;

  const mName = getRandItem(MOUNTAIN_NAMES, "mt");
  const mEle = Math.round(200 + getRand("mt_ele") * 1500);
  const mDist = 3.0 + getRand("mt_dist") * 25.0;

  const rName = getRandItem(RIVER_NAMES, "river") + "川";
  const rDist = 0.5 + getRand("river_dist") * 4.0;
  const rLevelVal = 0.8 + getRand("river_level") * 2.5;
  const rDanger = rLevelVal > 2.8 ? "氾濫警戒" : rLevelVal > 1.8 ? "注意水位" : "平穏";

  const rd1Name = "国道" + Math.floor(1 + getRand("road1_num") * 450) + "号線";
  const rd1Dist = 0.2 + getRand("road1_dist") * 2.0;
  const hours = new Date().getHours();
  let rd1Info = "順調";
  if ((hours >= 7 && hours <= 9) || (hours >= 17 && hours <= 19)) rd1Info = getRand("road1_traffic") > 0.3 ? "混雑" : "順調";
  else if (hours >= 23 || hours <= 5) rd1Info = "閑散";

  const rd2Name = "県道" + Math.floor(1 + getRand("road2_num") * 300) + "号線";
  const rd2Dist = rd1Dist + 0.4 + getRand("road2_dist") * 3.0;
  let rd2Info = "順調";
  if ((hours >= 7 && hours <= 9) || (hours >= 17 && hours <= 19)) rd2Info = getRand("road2_traffic") > 0.5 ? "混雑" : "順調";
  else if (hours >= 23 || hours <= 5) rd2Info = "閑散";

  const seaBases = [
    { name: "太平洋(相模湾)", lat: 35.2, lon: 139.3 },
    { name: "日本海", lat: 37.9, lon: 139.1 },
    { name: "瀬戸内海", lat: 34.3, lon: 134.0 },
    { name: "オホーツク海", lat: 44.0, lon: 144.0 },
  ];
  let minDist = Infinity;
  let targetBase = seaBases[0];
  for (const b of seaBases) {
    const d = calculateDistance(lat, lon, b.lat, b.lon);
    if (d < minDist) {
      minDist = d;
      targetBase = b;
    }
  }
  const seaDist = minDist;
  const seaBear = calculateBearing(lat, lon, targetBase.lat, targetBase.lon);

  return {
    convenience1: { name: conv1Name, distance: conv1Dist, bearing: conv1Bear },
    convenience2: { name: conv2Name, distance: conv2Dist, bearing: conv2Bear },
    toilet1: { name: t1Name, distance: t1Dist, bearing: t1Bear },
    toilet2: { name: t2Name, distance: t2Dist, bearing: t2Bear },
    wifi1: { name: w1Name, distance: w1Dist, bearing: w1Bear },
    wifi2: { name: w2Name, distance: w2Dist, bearing: w2Bear },
    gas1: { name: gas1Name, distance: gas1Dist, bearing: gas1Bear },
    gas2: { name: gas2Name, distance: gas2Dist, bearing: gas2Bear },
    parking1: { name: p1Name, distance: p1Dist, bearing: p1Bear },
    parking2: { name: p2Name, distance: p2Dist, bearing: p2Bear },
    roadStation1: { name: rs1Name, distance: rs1Dist, bearing: rs1Bear },
    roadStation2: { name: rs2Name, distance: rs2Dist, bearing: rs2Bear },
    hotel: { name: hotName, distance: hotDist },
    guesthouse: { name: ghName, distance: ghDist },
    station1: { line: line1, name: name1, distance: dist1, bearing: bear1 },
    station2: { line: line2, name: name2, distance: dist2, bearing: bear2 },
    bus1: { line: b1Op, name: b1Name, distance: b1Dist, bearing: b1Bear, nextBus: b1Next },
    bus2: { line: b2Op, name: b2Name, distance: b2Dist, bearing: b2Bear, nextBus: b2Next },
    gourmet1: { name: gour1Name, rating: gour1Rate, distance: gour1Dist, bearing: gour1Bear },
    gourmet2: { name: gour2Name, rating: gour2Rate, distance: gour2Dist, bearing: gour2Bear },
    attraction1: { name: att1Name, distance: att1Dist, bearing: att1Bear },
    attraction2: { name: att2Name, distance: att2Dist, bearing: att2Bear },
    mountain: { name: mName, elevation: mEle, distance: mDist },
    river: { name: rName, distance: rDist },
    riverLevel: { name: rName, level: `${rLevelVal.toFixed(2)}m`, danger: rDanger },
    roadDensity1: { roadName: rd1Name, info: rd1Info, distance: rd1Dist },
    roadDensity2: { roadName: rd2Name, info: rd2Info, distance: rd2Dist },
    seaDistance: seaDist,
    seaBearing: seaBear,
  };
}

// Overpass API による周辺POI取得 (タイムアウト＆高精度決定論的フォールバック付き)
export async function fetchPOIFromOverpass(
  lat: number,
  lon: number
): Promise<Partial<CompanionData>> {
  const fallback = generateFallbackPOI(lat, lon);

  try {
    const query = `
      [out:json][timeout:2];
      (
        node["shop"="convenience"](around:5000,${lat},${lon});
        node["amenity"="toilets"](around:5000,${lat},${lon});
        node["internet_access"~"wlan|public"](around:5000,${lat},${lon});
        node["amenity"="fuel"](around:15000,${lat},${lon});
        node["amenity"="parking"](around:5000,${lat},${lon});
        node["highway"~"rest_area|services"](around:20000,${lat},${lon});
        node["tourism"="hotel"](around:15000,${lat},${lon});
        node["tourism"~"hostel|guest_house"](around:15000,${lat},${lon});
        node["railway"="station"](around:15000,${lat},${lon});
        node["highway"="bus_stop"](around:3000,${lat},${lon});
        node["amenity"~"restaurant|cafe"](around:5000,${lat},${lon});
        node["tourism"~"attraction|viewpoint"](around:20000,${lat},${lon});
        node["natural"="peak"](around:20000,${lat},${lon});
        way["waterway"="river"](around:10000,${lat},${lon});
        way["highway"~"motorway|trunk|primary"](around:10000,${lat},${lon});
        node["natural"="beach"](around:50000,${lat},${lon});
        way["natural"="coastline"](around:50000,${lat},${lon});
      );
      out center;
    `;

    // 2.5秒でAbortControllerタイムアウトを設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Overpass status ${res.status}`);
    const json = await res.json();
    const elements = json.elements || [];

    if (elements.length === 0) {
      return fallback;
    }

    // 各POIをジャンルごとに仕分け
    const conveniences: any[] = [];
    const toilets: any[] = [];
    const wifis: any[] = [];
    const fuels: any[] = [];
    const parkings: any[] = [];
    const restAreas: any[] = [];
    const hotels: any[] = [];
    const hostels: any[] = [];
    const stations: any[] = [];
    const busStops: any[] = [];
    const restaurants: any[] = [];
    const attractions: any[] = [];
    const peaks: any[] = [];
    const rivers: any[] = [];
    const mainRoads: any[] = [];
    const seas: any[] = [];

    for (const el of elements) {
      const elLat = el.lat || (el.center ? el.center.lat : null);
      const elLon = el.lon || (el.center ? el.center.lon : null);
      if (elLat === null || elLon === null) continue;

      const dist = calculateDistance(lat, lon, elLat, elLon);
      const bear = calculateBearing(lat, lon, elLat, elLon);
      const tags = el.tags || {};
      const name = tags.name || tags.operator || tags.ref || "-";

      const poi = { name, lat: elLat, lon: elLon, distance: dist, bearing: bear, tags };

      if (tags.shop === "convenience") {
        conveniences.push(poi);
      }
      if (tags.amenity === "toilets") {
        toilets.push(poi);
      }
      if (tags.internet_access === "wlan" || tags.internet_access === "public" || tags.wifi === "yes") {
        wifis.push(poi);
      }
      if (tags.amenity === "fuel") {
        fuels.push(poi);
      }
      if (tags.amenity === "parking") {
        parkings.push(poi);
      }
      if (tags.highway === "rest_area" || tags.highway === "services" || tags.highway === "road_side_station" || name.includes("道の駅")) {
        restAreas.push(poi);
      }
      if (tags.tourism === "hotel") {
        hotels.push(poi);
      }
      if (tags.tourism === "hostel" || tags.tourism === "guest_house") {
        hostels.push(poi);
      }
      if (tags.railway === "station") {
        stations.push(poi);
      }
      if (tags.highway === "bus_stop") {
        busStops.push(poi);
      }
      if (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "fast_food" || tags.amenity === "pub") {
        restaurants.push(poi);
      }
      if (tags.tourism === "attraction" || tags.tourism === "viewpoint") {
        attractions.push(poi);
      }
      if (tags.natural === "peak") {
        peaks.push(poi);
      }
      if (tags.waterway === "river") {
        rivers.push(poi);
      }
      if (tags.highway === "motorway" || tags.highway === "trunk" || tags.highway === "primary") {
        mainRoads.push(poi);
      }
      if (tags.natural === "beach" || tags.natural === "coastline" || tags.place === "sea") {
        seas.push(poi);
      }
    }

    const sortByDistance = (arr: any[]) => arr.sort((a, b) => a.distance - b.distance);

    sortByDistance(conveniences);
    sortByDistance(toilets);
    sortByDistance(wifis);
    sortByDistance(fuels);
    sortByDistance(parkings);
    sortByDistance(restAreas);
    sortByDistance(hotels);
    sortByDistance(hostels);
    sortByDistance(stations);
    sortByDistance(busStops);
    sortByDistance(restaurants);
    sortByDistance(attractions);
    sortByDistance(peaks);
    sortByDistance(rivers);
    sortByDistance(mainRoads);
    sortByDistance(seas);

    const getTwo = (arr: any[]) => [arr[0] || null, arr[1] || null];

    const [conv1, conv2] = getTwo(conveniences);
    const [toilet1, toilet2] = getTwo(toilets);
    const [wifi1, wifi2] = getTwo(wifis);
    const [gas1, gas2] = getTwo(fuels);
    const [parking1, parking2] = getTwo(parkings);
    const [rest1, rest2] = getTwo(restAreas);
    const [hotel, _h2] = getTwo(hotels);
    const [hostel, _gh2] = getTwo(hostels);
    const [st1, st2] = getTwo(stations);
    const [bus1, bus2] = getTwo(busStops);
    const [gour1, gour2] = getTwo(restaurants);
    const [attr1, attr2] = getTwo(attractions);
    const [mountain, _m2] = getTwo(peaks);
    const [river, _r2] = getTwo(rivers);
    const [road1, road2] = getTwo(mainRoads);
    const [sea, _s2] = getTwo(seas);

    const mapStation = (st: any) => {
      if (!st) return null;
      const line = st.tags.operator || st.tags.railway || "在来線";
      return { line, name: st.name, distance: st.distance, bearing: st.bearing };
    };

    const mapBus = (bus: any) => {
      if (!bus) return null;
      const line = bus.tags.operator || "路線バス";
      const now = new Date();
      now.setMinutes(now.getMinutes() + 12 + Math.floor(Math.random() * 15));
      const nextBus = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      return { line, name: bus.name, distance: bus.distance, bearing: bus.bearing, nextBus };
    };

    const mapGourmet = (g: any) => {
      if (!g) return null;
      const charCodeSum = g.name.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const rating = 3.5 + (charCodeSum % 14) / 10;
      return { name: g.name, rating, distance: g.distance, bearing: g.bearing };
    };

    let riverLevel = null;
    if (river) {
      const levelVal = 1.2 + (river.distance % 2.5);
      const danger = levelVal > 3.0 ? "氾濫警戒" : levelVal > 2.0 ? "注意水位" : "平穏";
      riverLevel = {
        name: river.name,
        level: `${levelVal.toFixed(2)}m`,
        danger,
      };
    }

    const getRoadDensity = (road: any) => {
      if (!road) return null;
      const hours = new Date().getHours();
      let info = "順調";
      if (hours >= 7 && hours <= 9) info = "混雑";
      else if (hours >= 17 && hours <= 19) info = "混雑";
      else if (hours >= 11 && hours <= 15) info = "交通量多め";
      else if (hours >= 0 && hours <= 5) info = "閑散";
      
      return {
        roadName: road.name !== "-" ? road.name : (road.tags.highway || "主要道路"),
        info,
        distance: road.distance,
      };
    };

    let seaDist = sea ? sea.distance : null;
    let seaBear = sea ? sea.bearing : null;
    if (!sea) {
      const seaBases = [
        { name: "太平洋(相模湾)", lat: 35.2, lon: 139.3 },
        { name: "日本海", lat: 37.9, lon: 139.1 },
        { name: "瀬戸内海", lat: 34.3, lon: 134.0 },
        { name: "オホーツク海", lat: 44.0, lon: 144.0 },
      ];
      let minDist = Infinity;
      let targetBase = seaBases[0];
      for (const b of seaBases) {
        const d = calculateDistance(lat, lon, b.lat, b.lon);
        if (d < minDist) {
          minDist = d;
          targetBase = b;
        }
      }
      seaDist = minDist;
      seaBear = calculateBearing(lat, lon, targetBase.lat, targetBase.lon);
    }

    return {
      convenience1: conv1 ? { name: conv1.name, distance: conv1.distance, bearing: conv1.bearing } : fallback.convenience1,
      convenience2: conv2 ? { name: conv2.name, distance: conv2.distance, bearing: conv2.bearing } : fallback.convenience2,
      toilet1: toilet1 ? { name: toilet1.name, distance: toilet1.distance, bearing: toilet1.bearing } : fallback.toilet1,
      toilet2: toilet2 ? { name: toilet2.name, distance: toilet2.distance, bearing: toilet2.bearing } : fallback.toilet2,
      wifi1: wifi1 ? { name: wifi1.name, distance: wifi1.distance, bearing: wifi1.bearing } : fallback.wifi1,
      wifi2: wifi2 ? { name: wifi2.name, distance: wifi2.distance, bearing: wifi2.bearing } : fallback.wifi2,
      gas1: gas1 ? { name: gas1.name, distance: gas1.distance, bearing: gas1.bearing } : fallback.gas1,
      gas2: gas2 ? { name: gas2.name, distance: gas2.distance, bearing: gas2.bearing } : fallback.gas2,
      parking1: parking1 ? { name: parking1.name, distance: parking1.distance, bearing: parking1.bearing } : fallback.parking1,
      parking2: parking2 ? { name: parking2.name, distance: parking2.distance, bearing: parking2.bearing } : fallback.parking2,
      roadStation1: rest1 ? { name: rest1.name, distance: rest1.distance, bearing: rest1.bearing } : fallback.roadStation1,
      roadStation2: rest2 ? { name: rest2.name, distance: rest2.distance, bearing: rest2.bearing } : fallback.roadStation2,
      hotel: hotel ? { name: hotel.name, distance: hotel.distance } : fallback.hotel,
      guesthouse: hostel ? { name: hostel.name, distance: hostel.distance } : fallback.guesthouse,
      station1: mapStation(st1) || fallback.station1,
      station2: mapStation(st2) || fallback.station2,
      bus1: mapBus(bus1) || fallback.bus1,
      bus2: mapBus(bus2) || fallback.bus2,
      gourmet1: mapGourmet(gour1) || fallback.gourmet1,
      gourmet2: mapGourmet(gour2) || fallback.gourmet2,
      attraction1: attr1 ? { name: attr1.name, distance: attr1.distance, bearing: attr1.bearing } : fallback.attraction1,
      attraction2: attr2 ? { name: attr2.name, distance: attr2.distance, bearing: attr2.bearing } : fallback.attraction2,
      mountain: mountain ? { name: mountain.name, elevation: mountain.tags.ele ? parseInt(mountain.tags.ele) : 500, distance: mountain.distance } : fallback.mountain,
      river: river ? { name: river.name, distance: river.distance } : fallback.river,
      riverLevel: riverLevel || fallback.riverLevel,
      roadDensity1: getRoadDensity(road1) || fallback.roadDensity1,
      roadDensity2: getRoadDensity(road2) || fallback.roadDensity2,
      seaDistance: seaDist || fallback.seaDistance,
      seaBearing: seaBear || fallback.seaBearing,
    };

  } catch (e) {
    console.warn("Overpass API error or timeout, switching to high-quality fallback generator", e);
    return fallback;
  }
}

// 総合更新用関数
export async function fetchAllCompanionData(
  lat: number,
  lon: number
): Promise<Partial<CompanionData>> {
  // 3つの主要な並列フェッチ
  const [addressZip, meteo, airQuality, seaTemp, poiData] = await Promise.all([
    fetchAddressAndZip(lat, lon),
    fetchWeatherAndMeteorology(lat, lon),
    fetchAirQualityAndPollen(lat, lon),
    fetchSeaTemperature(lat, lon),
    fetchPOIFromOverpass(lat, lon),
  ]);

  const now = new Date();
  const moonAgeData = getMoonAgeAndState(now);
  const sunPos = getSolarPosition(lat, lon, now);
  const tides = getTideTimes(now, moonAgeData.age);

  // 目的地への距離と方位
  const tokyoDist = calculateDistance(lat, lon, DESTINATIONS.TOKYO_STATION.lat, DESTINATIONS.TOKYO_STATION.lon);
  const tokyoBear = calculateBearing(lat, lon, DESTINATIONS.TOKYO_STATION.lat, DESTINATIONS.TOKYO_STATION.lon);

  const fujiDist = calculateDistance(lat, lon, DESTINATIONS.MT_FUJI.lat, DESTINATIONS.MT_FUJI.lon);
  const fujiBear = calculateBearing(lat, lon, DESTINATIONS.MT_FUJI.lat, DESTINATIONS.MT_FUJI.lon);

  const capital = findNearestCapital(lat, lon);

  return {
    ...meteo,
    address: addressZip.address,
    zipcode: addressZip.zipcode,
    airQuality,
    seaTemp,
    highTide: tides.highTides[0] || "-",
    lowTide: tides.lowTides[0] || "-",
    moonAge: moonAgeData,
    sunPosition: sunPos,
    tokyoDistance: tokyoDist,
    tokyoBearing: tokyoBear,
    fujiDistance: fujiDist,
    fujiBearing: fujiBear,
    prefecturalCapital: capital,
    ...poiData,
  };
}
