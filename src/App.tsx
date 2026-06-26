/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ALL_TILES_CONFIG } from "./utils/tileConfig";
import { CompanionTile } from "./components/CompanionTile";
import { InitialOverlay } from "./components/InitialOverlay";
import {
  fetchAddressAndZip,
  fetchWeatherAndMeteorology,
  fetchAirQualityAndPollen,
  fetchSeaTemperature,
  fetchPOIFromOverpass,
  getWeatherEmojiAndName,
  calculateMagicHour,
  fetchEarthquakeInfo,
  calculateMagneticDeclination,
  calculatePowerUsage,
  calculateTrafficStatus
} from "./utils/api";
import {
  calculateDistance,
  calculateBearing,
  findNearestCapital,
  getMoonAgeAndState,
  getSolarPosition,
  getTideTimes,
  DESTINATIONS
} from "./utils/geo";
import { CompanionData, TileId } from "./types";
import { RefreshCw, MapPin, Mic, Compass, Play, Pause, Maximize2 } from "lucide-react";
import { motion } from "motion/react";

// デフォルト/初期データ構造
const INITIAL_COMPANION_DATA: CompanionData = {
  tilt: null,
  bearing: null,
  gpsAccuracy: null,
  speed: null,
  elevation: null,
  tokyoDistance: null,
  tokyoBearing: null,
  seaDistance: null,
  seaBearing: null,
  fujiDistance: null,
  fujiBearing: null,
  prefecturalCapital: null,
  weather: null,
  precipitation: null,
  rainCloudApproach: null,
  uvIndex: null,
  sunrise: null,
  sunset: null,
  wind: null,
  humidity: null,
  airQuality: null,
  seaTemp: null,
  highTide: null,
  lowTide: null,
  moonAge: null,
  sunPosition: null,
  zipcode: null,
  address: null,
  dbLevel: null,
  currentDate: null,
  currentTime: null,
  pm25: null,
  waveInfo: null,
  magicHour: null,
  earthquake: null,
  powerUsage: null,
  trafficStatus: null,
  accumulatedDistance: 0,
};

// --- 今日の旅コンディションの計算ロジック (カテゴリ別) ---
interface TravelCondition {
  title: string;
  icon: string;
  score: number;
  stars: number;
  remarks: string[];
}

function getCategoryCondition(data: CompanionData, category: string): TravelCondition {
  let score = 70; // ベースライン
  const remarks: string[] = [];
  let title = "今日の旅コンディション";
  let icon = "✨";

  switch (category) {
    case "all":
      title = "今日の旅コンディション";
      icon = "✨";
      if (data.weather) {
        const code = data.weather.code;
        if (code === 0) {
          score += 15;
          remarks.push("晴天で絶好の行楽日和");
        } else if (code === 1 || code === 2 || code === 3) {
          score += 8;
          remarks.push("穏やかな晴れ間");
        } else if (code >= 51 && code <= 65) {
          score -= 25;
          remarks.push("雨が降っています");
        } else if (code >= 95) {
          score -= 35;
          remarks.push("荒天・雷雨に厳重注意");
        } else {
          remarks.push("曇りがちなお天気");
        }

        const temp = data.weather.temp;
        if (temp >= 15 && temp <= 25) {
          score += 10;
          remarks.push("車中泊・散策に快適な気温");
        } else if (temp < 10) {
          score -= 10;
          remarks.push("肌寒いため防寒対策を");
        } else if (temp > 30) {
          score -= 15;
          remarks.push("熱中症に警戒してください");
        }
      } else {
        remarks.push("お天気データ準備中");
      }

      if (data.rainCloudApproach) {
        if (data.rainCloudApproach.includes("分後")) {
          score -= 20;
          remarks.push(`雨雲が接近中（${data.rainCloudApproach}）`);
        } else if (data.rainCloudApproach.includes("心配なし") || data.rainCloudApproach.includes("正常") || data.rainCloudApproach.includes("なし")) {
          score += 5;
          remarks.push("直近の雨の心配はありません");
        }
      }

      if (data.wind) {
        const wSpeed = data.wind.speed;
        if (wSpeed < 3.0) {
          score += 5;
          remarks.push("風が弱く非常に穏やか");
        } else if (wSpeed > 7.0) {
          score -= 10;
          remarks.push("風が強く吹き荒れています");
        }
      }

      if (data.weather && data.humidity !== null) {
        const code = data.weather.code;
        const hum = data.humidity;
        if ((code === 0 || code === 1) && hum < 65) {
          score += 5;
          remarks.push("富士山が見えやすい視程です");
        }
      }

      if (data.weather && data.sunset && data.sunset.time !== "-") {
        const code = data.weather.code;
        if (code === 0 || code === 1 || code === 2) {
          score += 5;
          remarks.push("夕焼けが期待できる空模様");
        }
      }
      break;

    case "weather":
      title = "お出かけコンディション";
      icon = "🌈";
      if (data.weather) {
        const code = data.weather.code;
        if (code === 0 || code === 1) {
          score += 20;
          remarks.push("青空が広がるお出かけ日和");
        } else if (code === 2 || code === 3) {
          score += 10;
          remarks.push("お出かけに問題ない空模様");
        } else {
          score -= 20;
          remarks.push("傘や雨具が必要です");
        }
      } else {
        remarks.push("お天気データ準備中");
      }
      if (data.uvIndex) {
        const uv = data.uvIndex.index;
        if (uv >= 6) {
          score -= 5;
          remarks.push("日焼け止め・日傘が必須です");
        } else if (uv <= 2) {
          remarks.push("紫外線は弱めです");
        }
      }
      if (data.humidity && data.humidity > 75) {
        score -= 5;
        remarks.push("湿度が高く少し蒸し暑いです");
      }
      break;

    case "driving":
      title = "ドライブ＆ツーリングコンディション";
      icon = "🚗";
      if (data.trafficStatus) {
        if (data.trafficStatus.includes("順調")) {
          score += 15;
          remarks.push("道路状況はスムーズで順調");
        } else if (data.trafficStatus.includes("渋滞")) {
          score -= 25;
          remarks.push("周辺道路で渋滞が発生中");
        } else {
          score -= 10;
          remarks.push("道路が少し混雑しています");
        }
      } else {
        remarks.push("道路交通状況の取得中");
      }
      if (data.weather) {
        const code = data.weather.code;
        if (code >= 51) {
          score -= 15;
          remarks.push("雨で路面が滑りやすいため減速");
        }
      }
      if (data.wind && data.wind.speed > 8.0) {
        score -= 10;
        remarks.push("横風が強いためハンドル操作注意");
      }
      break;

    case "climbing":
      title = "山登りコンディション";
      icon = "🏔️";
      if (data.weather) {
        const code = data.weather.code;
        if (code === 0) {
          score += 20;
          remarks.push("視界良好で絶好の登山日和");
        } else if (code >= 51) {
          score -= 35;
          remarks.push("雨のため登山はおすすめしません");
        } else if (code >= 45 && code <= 48) {
          score -= 20;
          remarks.push("濃霧のため道迷いに注意");
        }
      } else {
        remarks.push("山岳お天気データ準備中");
      }
      if (data.wind) {
        const wSpeed = data.wind.speed;
        if (wSpeed > 6.0) {
          score -= 20;
          remarks.push("稜線は強風の可能性・低体温注意");
        } else {
          score += 5;
          remarks.push("風が穏やかで登りやすい");
        }
      }
      if (data.elevation && data.elevation > 1000) {
        remarks.push(`標高 ${Math.round(data.elevation)}m：平地より気温低め`);
      }
      break;

    case "sea":
      title = "海コンディション";
      icon = "🌊";
      if (data.waveInfo) {
        const h = data.waveInfo.height;
        if (h < 0.8) {
          score += 20;
          remarks.push("波が穏やかで海水浴・釣り日和");
        } else if (h > 1.8) {
          score -= 35;
          remarks.push("波が高く、磯や砂浜は危険です");
        } else {
          score -= 10;
          remarks.push("波がやや高めです");
        }
      } else {
        remarks.push("波情報の分析中");
      }
      if (data.seaTemp) {
        if (data.seaTemp >= 23) {
          score += 10;
          remarks.push(`海水温 ${data.seaTemp}℃：快適に泳げます`);
        } else if (data.seaTemp < 18) {
          score -= 15;
          remarks.push(`海水温 ${data.seaTemp}℃：ウェットスーツ推奨`);
        }
      }
      if (data.highTide || data.lowTide) {
        remarks.push(`潮汐：満潮 / 干潮データ確認推奨`);
      }
      break;

    case "disaster":
      title = "防災安全コンディション";
      icon = "🚨";
      if (data.earthquake) {
        if (data.earthquake.includes("情報なし") || data.earthquake.includes("正常") || data.earthquake.includes("安定")) {
          score = 100;
          remarks.push("地震活動は安定しています");
        } else {
          score = 40;
          remarks.push("直近で有感地震が観測されました");
        }
      } else {
        remarks.push("地震情報の監視中");
      }
      if (data.powerUsage) {
        const rate = data.powerUsage.rate;
        if (rate > 90) {
          score -= 10;
          remarks.push("地域の電力需給が逼迫ぎみです");
        }
      }
      break;

    default:
      title = "旅コンディション";
      icon = "✨";
      remarks.push("快適に旅をお楽しみください");
      break;
  }

  score = Math.max(10, Math.min(100, score));
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));

  if (remarks.length === 0) {
    remarks.push("標準的なコンディションです");
  }

  const uniqueRemarks = Array.from(new Set(remarks)).slice(0, 4);

  return { title, icon, score, stars, remarks: uniqueRemarks };
}

// --- オフライン時の避難場所リストフォールバック ---
function getFallbackShelters(address: string | null): string[] {
  if (!address) {
    return [
      "広域避難場所：近隣の指定小中学校・大規模公園",
      "一時避難場所：最寄りの耐震ビル・神社仏閣",
      "二次避難所（福祉避難所）：公民館・コミュニティセンター"
    ];
  }
  
  const prefMatch = address.match(/(東京都|神奈川県|埼玉県|千葉県|愛知県|大阪府|京都府|兵庫県|福岡県|山梨県|静岡県)/);
  const pref = prefMatch ? prefMatch[1] : "";
  
  if (pref === "東京都") {
    return [
      "新宿御苑 (新宿区) [広域避難場所]",
      "代々木公園 (渋谷区) [広域避難場所]",
      "上野恩賜公園 (台東区) [広域避難場所]",
      "都立芝公園 (港区) [広域避難場所]",
      "最寄りの区立小学校・中学校体育館 [指定避難所]"
    ];
  } else if (pref === "神奈川県") {
    return [
      "みなとみらい臨時避難空地 (横浜市西区) [広域避難所]",
      "山下公園 (横浜市中区) [広域避難所]",
      "三ツ沢公園 (横浜市神奈川区) [広域避難所]",
      "最寄りの市立小学校・中学校体育館 [指定避難所]"
    ];
  } else if (pref === "山梨県") {
    return [
      "小瀬スポーツ公園 (甲府市) [広域避難場所]",
      "山梨県立科学館周辺 (甲府市) [広域避難場所]",
      "富士急ハイランド第1駐車場 (富士吉田市) [広域避難所]",
      "最寄りの市立・町立小学校体育館 [指定避難所]"
    ];
  } else {
    return [
      `${pref || "現在地"}の指定緊急避難場所（大規模公園・緑地・広場）`,
      `${pref || "現在地"}の指定避難所（最寄りの公立小中学校・市民センター）`,
      "福祉避難所（公民館・保健センター）"
    ];
  }
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [data, setData] = useState<CompanionData>(INITIAL_COMPANION_DATA);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [dbLevel, setDbLevel] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConditionCollapsed, setIsConditionCollapsed] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const lastGeminiTimeRef = useRef<number>(0);
  const categoryDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [maxLean, setMaxLean] = useState<{ left: number; right: number }>(() => {
    try {
      const saved = localStorage.getItem("maxLeanAngle");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse maxLeanAngle from localStorage", e);
    }
    return { left: 0, right: 0 };
  });

  const maxLeanRef = useRef(maxLean);
  useEffect(() => {
    maxLeanRef.current = maxLean;
    localStorage.setItem("maxLeanAngle", JSON.stringify(maxLean));
    setData((prev) => ({ ...prev, maxLeanAngle: maxLean }));
  }, [maxLean]);

  // Gemini リアルタイム旅行推奨情報 (5分毎更新, 3項目：警告、行動指針、周辺スポット)
  const [recommendations, setRecommendations] = useState<{
    alert: string;
    actionGuide: string;
    spotInfo: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("recommendations");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse recommendations from localStorage", e);
    }
    return null;
  });

  useEffect(() => {
    if (recommendations) {
      localStorage.setItem("recommendations", JSON.stringify(recommendations));
    }
  }, [recommendations]);

  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // オフライン減災モードの判定
  const [isOfflineMitigationMode, setIsOfflineMitigationMode] = useState<boolean>(false);

  // AI更新のカウントダウン秒数（初期値5分=300秒）
  const [countdownSec, setCountdownSec] = useState<number>(300);

  // タップ詳細表示用モーダルステート
  const [selectedFullText, setSelectedFullText] = useState<{ label: string; text: string } | null>(null);

  
  // カテゴリ選択用 state ("all" = すべて, "weather" = 天候, "driving" = 運転, "climbing" = 登山, "sea" = 海, "disaster" = 防災, "custom" = カスタム)
  const [activeCategory, setActiveCategory] = useState<"all" | "weather" | "driving" | "climbing" | "sea" | "disaster" | "custom">("all");

  const [customCategoryTileIds, setCustomCategoryTileIds] = useState<TileId[]>(() => {
    try {
      const saved = localStorage.getItem("customCategoryTileIds");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return ["weather", "speed", "elevation", "bearing", "tilt", "pressure", "maxLeanAngle"];
  });

  useEffect(() => {
    localStorage.setItem("customCategoryTileIds", JSON.stringify(customCategoryTileIds));
  }, [customCategoryTileIds]);

  const [isCustomSettingOpen, setIsCustomSettingOpen] = useState(false);

  // 複数タイルの一括移動用
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedTileIds, setSelectedTileIds] = useState<TileId[]>([]);

  const toggleSelectTile = (tileId: TileId) => {
    setSelectedTileIds((prev) => {
      if (prev.includes(tileId)) {
        return prev.filter((id) => id !== tileId);
      } else {
        return [...prev, tileId];
      }
    });
  };

  const moveSelectedTiles = (direction: "left" | "right") => {
    if (selectedTileIds.length === 0) return;
    setTileOrder((prev) => {
      const next = [...prev];
      if (direction === "left") {
        for (let i = 1; i < next.length; i++) {
          const currentId = next[i];
          if (selectedTileIds.includes(currentId)) {
            const prevId = next[i - 1];
            if (!selectedTileIds.includes(prevId)) {
              next[i - 1] = currentId;
              next[i] = prevId;
            }
          }
        }
      } else {
        for (let i = next.length - 2; i >= 0; i--) {
          const currentId = next[i];
          if (selectedTileIds.includes(currentId)) {
            const nextId = next[i + 1];
            if (!selectedTileIds.includes(nextId)) {
              next[i + 1] = currentId;
              next[i] = nextId;
            }
          }
        }
      }
      localStorage.setItem("tile_order", JSON.stringify(next));
      return next;
    });
  };

  const gatherSelectedTiles = () => {
    if (selectedTileIds.length <= 1) return;
    setTileOrder((prev) => {
      const firstIdx = prev.findIndex(id => selectedTileIds.includes(id));
      if (firstIdx === -1) return prev;
      
      const unselected = prev.filter(id => !selectedTileIds.includes(id));
      const selected = prev.filter(id => selectedTileIds.includes(id));
      
      const next = [
        ...unselected.slice(0, firstIdx),
        ...selected,
        ...unselected.slice(firstIdx)
      ];
      localStorage.setItem("tile_order", JSON.stringify(next));
      return next;
    });
  };

  // カテゴリタブが切り替わったときにAI情報を即座に優先更新する（デバウンスを挟んで連打を防止）
  useEffect(() => {
    if (started) {
      if (categoryDebounceRef.current) {
        clearTimeout(categoryDebounceRef.current);
      }
      categoryDebounceRef.current = setTimeout(() => {
        triggerGeminiRecommendations(data, activeCategory);
      }, 800);
    }
    return () => {
      if (categoryDebounceRef.current) {
        clearTimeout(categoryDebounceRef.current);
      }
    };
  }, [activeCategory, started]);

  // タイルごとのキャッシュ判別（フェッチ失敗等で古い/キャッシュであることを示すフラグ）
  const [cachedTiles, setCachedTiles] = useState<Record<TileId, boolean>>({});

  // タイルの順序（ドラッグ＆ドロップによる並べ替え対応・ローカルストレージ自動復元付き）
  const [tileOrder, setTileOrder] = useState<TileId[]>(() => {
    try {
      const saved = localStorage.getItem("tile_order");
      if (saved) {
        const parsed = JSON.parse(saved) as TileId[];
        const validIds = ALL_TILES_CONFIG.map((c) => c.id);
        const filtered = parsed.filter((id) => validIds.includes(id));
        const missing = validIds.filter((id) => !filtered.includes(id));
        return [...filtered, ...missing];
      }
    } catch (e) {
      console.warn("Failed to parse tile order from localStorage", e);
    }
    return ALL_TILES_CONFIG.map((c) => c.id);
  });

  // タイルの順序が変化したときにlocalStorageに保存
  useEffect(() => {
    localStorage.setItem("tile_order", JSON.stringify(tileOrder));
  }, [tileOrder]);

  // ドラッグ＆ドロップ用のインデックス参照
  const draggedIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex.current === null || draggedIndex.current === index) return;

    const newOrder = [...tileOrder];
    const draggedItem = newOrder[draggedIndex.current];
    newOrder.splice(draggedIndex.current, 1);
    newOrder.splice(index, 0, draggedItem);
    draggedIndex.current = index;
    setTileOrder(newOrder);
  };

  const handleDragEnd = () => {
    draggedIndex.current = null;
  };

  const mainRef = useRef<HTMLElement | null>(null);

  // Screen Wake Lock API（画面自動オフ・スリープ・ロックの防止）
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!started) return;

    const requestWakeLock = async () => {
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator.wakeLock as any).request("screen");
          console.log("Wake Lock has been successfully acquired!");
        } catch (err) {
          console.warn("Screen Wake Lock request failed:", err);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        isPausedRef.current = false;
        await requestWakeLock();
      } else {
        isPausedRef.current = true;
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          } catch (e) {
            console.warn("Wake lock release err", e);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        }).catch((err: any) => {
          console.warn("Failed to release Wake Lock:", err);
        });
      }
    };
  }, [started]);

  const handleScrollToContent = () => {
    if (mainRef.current) {
      mainRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // タイルごとの最終更新日時（タイムスタンプ）を保持。
  // これを使って各タイルの黄色いフラッシュ演出を制御する。
  const [lastUpdated, setLastUpdated] = useState<Record<TileId, number>>({});
  const [isAddressFlashing, setIsAddressFlashing] = useState(false);

  useEffect(() => {
    if (lastUpdated.address > 0) {
      setIsAddressFlashing(true);
      const timer = setTimeout(() => setIsAddressFlashing(false), 750);
      return () => clearTimeout(timer);
    }
  }, [lastUpdated.address]);

  // リアルタイム現在日時更新（現在年月日、現在時間のパネル用）
  useEffect(() => {
    const getFormattedDateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
      const weekday = weekdays[now.getDay()];
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");

      return {
        currentDate: `${year}/${month}/${day} (${weekday})`,
        currentTime: `${hours}:${minutes}`,
      };
    };

    const updateTime = () => {
      const dt = getFormattedDateTime();
      setData((prev) => ({
        ...prev,
        currentDate: dt.currentDate,
        currentTime: dt.currentTime,
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // リアルタイムセンサー情報保持用のRef（スロットリング更新用）
  const latestTilt = useRef<{ pitch: number; roll: number }>({ pitch: 0, roll: 0 });
  const latestHeading = useRef<number>(0);
  const bearingHistory = useRef<{ x: number; y: number }[]>([]);
  
  // 累計移動距離用の前回位置保存Refと積算値Ref
  const prevTrackCoords = useRef<{ lat: number; lon: number } | null>(null);
  const currentAccumulatedDistance = useRef<number>(0);

  const latestGps = useRef<{ accuracy: number | null; speed: number | null; elevation: number | null }>({
    accuracy: null,
    speed: null,
    elevation: null,
  });

  // 位置情報とAPI用経緯度
  const currentCoords = useRef<{ lat: number; lon: number } | null>(null);

  // バッテリー延命＆動的スキップ用の前回の位置・日付Ref
  const lastUpdatedCoords = useRef<{ lat: number; lon: number } | null>(null);
  const lastUpdatedDateStr = useRef<string>(new Date().toDateString());
  const micIntervalId = useRef<any>(null);

  // マイク周りのRef
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const latestDb = useRef<number>(0);

  // 1. 初回起動（オーバーレイからコールバック）
  const handleStart = (
    coords: { lat: number; lon: number } | null,
    stream: MediaStream | null
  ) => {
    setStarted(true);
    
    if (coords) {
      currentCoords.current = coords;
    } else {
      // GPSが取得できなかった場合は都庁にせず、座標をnull（未取得）にする
      currentCoords.current = null;
      setData((prev) => ({
        ...prev,
        address: "-",
        zipcode: null,
      }));
    }

    // マイクアナライザーの初期化
    if (stream) {
      initAudioAnalyser(stream);
    }

    // 初回一括更新
    triggerFullUpdate();
  };

  // マイクから騒音レベル(dB)を解析するロジック
  const initAudioAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // リアルタイムに音量を解析
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // デシベル簡易計算 (0〜100dBの範囲にスケーリング)
        const db = Math.round((average / 255) * 100);
        latestDb.current = db;
      };

      // requestAnimationFrameを廃止し、250msのタイマーで解析（バッテリー消費低減）
      micIntervalId.current = setInterval(updateVolume, 250);
    } catch (e) {
      console.warn("Failed to init audio analyser", e);
    }
  };

  // 騒音レベルを評価する日本語文字列を取得
  const getNoiseLabel = (db: number) => {
    if (db < 20) return "極めて静か (深夜の森)";
    if (db < 40) return "静か (図書館並み)";
    if (db < 65) return "普通 (街頭・会話音)";
    if (db < 85) return "騒がしい (主要国道沿い)";
    return "極めて騒がしい (電車のガード下)";
  };

  // 2. 差分/一括更新。引数で特定のタイルグループを指定
  const updateTileData = async (tileIds: TileId[]) => {
    if (!currentCoords.current) {
      setCachedTiles((prev) => {
        const next = { ...prev };
        tileIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
      return;
    }
    const { lat, lon } = currentCoords.current;
    const nowStamp = Date.now();
    const now = new Date();
    const dateStr = now.toDateString();

    const isSameDay = lastUpdatedDateStr.current === dateStr;
    const moved = !lastUpdatedCoords.current ||
      Math.abs(lastUpdatedCoords.current.lat - lat) > 0.0005 ||
      Math.abs(lastUpdatedCoords.current.lon - lon) > 0.0005;

    const promises: Promise<void>[] = [];

    try {
      // 2. 天気・気象・気候 (マジックアワー、標高も連動)
      const weatherKeys: TileId[] = ["weather", "precipitation", "rainCloudApproach", "uvIndex", "sunrise", "sunset", "sunriseSunset", "wind", "humidity", "elevation", "magicHour", "sunsetCountdown"];
      if (tileIds.some(id => weatherKeys.includes(id))) {
        promises.push((async () => {
          const res = await fetchWeatherAndMeteorology(lat, lon);

          const finalSunrise = isSameDay && data.sunrise ? data.sunrise : res.sunrise;
          const finalSunset = isSameDay && data.sunset ? data.sunset : res.sunset;
          const magicHourVal = calculateMagicHour(finalSunrise?.time || "-", finalSunset?.time || "-");

          const gpsAlt = latestGps.current.elevation;
          let finalElevation = res.elevation;
          if (gpsAlt !== null && res.elevation !== null) {
            finalElevation = Math.round((gpsAlt + res.elevation) / 2);
          } else if (gpsAlt !== null) {
            finalElevation = gpsAlt;
          }

          setData((prev) => ({
            ...prev,
            weather: res.weather,
            precipitation: res.precipitation,
            rainCloudApproach: res.rainCloudApproach,
            uvIndex: res.uvIndex,
            sunrise: finalSunrise,
            sunset: finalSunset,
            elevation: finalElevation !== null ? finalElevation : prev.elevation,
            magicHour: magicHourVal,
          }));
          setLastUpdated((prev) => {
            const next = { ...prev };
            weatherKeys.forEach(id => {
              if (tileIds.includes(id)) {
                // 日の出・日没は日付が変わったとき、または初回のみ光らせる
                if ((id === "sunrise" || id === "sunset" || id === "sunriseSunset") && isSameDay && prev.sunrise) {
                  return;
                }
                next[id] = nowStamp;
              }
            });
            return next;
          });
        })());
      }

      // 2.5. 直近の地震・防災情報
      if (tileIds.includes("earthquake")) {
        promises.push((async () => {
          const res = await fetchEarthquakeInfo();
          setData((prev) => ({
            ...prev,
            earthquake: res,
          }));
          setLastUpdated((prev) => ({
            ...prev,
            earthquake: nowStamp,
          }));
        })());
      }

      // 2.6. 電力使用状況
      if (tileIds.includes("powerUsage")) {
        promises.push((async () => {
          const res = calculatePowerUsage(lat, lon);
          setData((prev) => ({
            ...prev,
            powerUsage: res,
          }));
          setLastUpdated((prev) => ({
            ...prev,
            powerUsage: nowStamp,
          }));
        })());
      }

      // 3. 大気・花粉
      if (tileIds.includes("airQuality")) {
        promises.push((async () => {
          const res = await fetchAirQualityAndPollen(lat, lon);
          setData((prev) => ({
            ...prev,
            airQuality: res,
          }));
          setLastUpdated((prev) => ({
            ...prev,
            airQuality: nowStamp,
          }));
        })());
      }

      // 4. 海水温・波情報
      if (tileIds.includes("seaTemp") || tileIds.includes("waveInfo")) {
        // 大きく移動していない、かつ既にデータがある場合はスキップ
        if (moved || !data.seaTemp) {
          promises.push((async () => {
            const res = await fetchSeaTemperature(lat, lon);
            setData((prev) => ({
              ...prev,
              seaTemp: res.seaTemp,
              waveInfo: res.waveInfo,
            }));
            setLastUpdated((prev) => ({
              ...prev,
              seaTemp: nowStamp,
              waveInfo: nowStamp,
            }));
          })());
        }
      }

      // 5. 周辺POI (海までの距離・方位、道路交通状況)
      const poiKeys: TileId[] = ["seaDistance", "seaBearing", "trafficStatus"];
      if (tileIds.some(id => poiKeys.includes(id))) {
        if (moved || data.seaDistance === null) {
          promises.push((async () => {
            const res = await fetchPOIFromOverpass(lat, lon);
            const speedKmh = latestGps.current.speed !== null ? Math.round(latestGps.current.speed * 3.6) : 0;
            const traffic = calculateTrafficStatus(lat, lon, speedKmh);
            setData((prev) => ({
              ...prev,
              seaDistance: res.seaDistance,
              seaBearing: res.seaBearing,
              trafficStatus: traffic,
            }));
            setLastUpdated((prev) => {
              const next = { ...prev };
              poiKeys.forEach(id => {
                if (tileIds.includes(id)) {
                  next[id] = nowStamp;
                }
              });
              return next;
            });
          })());
        }
      }

      await Promise.all(promises);

      // 更新完了時に位置・日付を履歴に保存
      lastUpdatedCoords.current = { lat, lon };
      lastUpdatedDateStr.current = dateStr;

    } catch (err) {
      console.error("Failed to update tiles partially:", tileIds, err);
    }
  };

  // 音声読み上げ同期管理用 Ref
  const isMutedRef = useRef<boolean>(true);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isMuted]);

  // 音声案内（自動・手動）の統合クリックハンドラー
  const handleVoiceToggle = () => {
    if (!window.speechSynthesis) return;

    if (isMuted) {
      // 1. ミュート中（オフ）の場合：ミュートを解除し、現在のテキストを即座に読み上げる
      setIsMuted(false);
      isMutedRef.current = false;
      if (recommendations) {
        // すでに isSpeaking が false なので、一瞬待たずにそのまま再生
        speakRecommendations(recommendations);
      }
    } else if (isSpeaking) {
      // 2. 読み上げ中の場合：現在の読み上げを即時停止する（ミュート状態はオンのまま）
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // 3. 音声オン（待機中）の場合：自動案内機能自体を完全にミュート（オフ）にする
      setIsMuted(true);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // 音声で読み上げる（上から順番に・トグル停止対応）
  const speakRecommendations = (recs: { alert: string; actionGuide: string; spotInfo: string }) => {
    if (!window.speechSynthesis) return;

    // 新たに再生を開始する
    setIsSpeaking(true);
    window.speechSynthesis.cancel();

    const textToSpeak = [
      `危険情報。${recs.alert}`,
      `次の行動。${recs.actionGuide}`,
      `お役立ち。${recs.spotInfo}`
    ];

    let index = 0;
    const speakNext = () => {
      if (isMutedRef.current) {
        setIsSpeaking(false);
        return;
      }
      if (index >= textToSpeak.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak[index]);
      utterance.lang = "ja-JP";
      utterance.rate = 1.05; // 自然で明瞭な聞き取りやすいスピード
      utterance.pitch = 1.0;
      
      utterance.onend = () => {
        index++;
        if (index >= textToSpeak.length) {
          setIsSpeaking(false);
        } else {
          speakNext();
        }
      };

      utterance.onerror = () => {
        index++;
        if (index >= textToSpeak.length) {
          setIsSpeaking(false);
        } else {
          speakNext();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  // Gemini推奨情報を取得する
  const triggerGeminiRecommendations = async (currentData?: CompanionData, categoryOverride?: string) => {
    // すでにロード中であれば重複してリクエストしない
    if (isLoadingRecommendations) {
      console.log("Gemini API is already loading. Skip duplicate request.");
      return;
    }

    // 連続リクエスト防止：前回の成功から30秒以内はスキップ（ローカル制限）
    const nowStamp = Date.now();
    if (nowStamp - lastGeminiTimeRef.current < 30000) {
      console.log("Gemini API request rate limited locally to protect API keys. Skip request.");
      return;
    }

    if (!currentCoords.current) {
      console.warn("GPS現在地が未取得のため、デフォルト座標（東京駅）を仮設定してGemini推奨情報を取得します。");
      currentCoords.current = { lat: 35.6812, lon: 139.7671 };
    }
    setIsLoadingRecommendations(true);
    try {
      const { lat, lon } = currentCoords.current;
      const activeData = currentData || data;
      const cat = categoryOverride || activeCategory;
      const response = await fetch("/api/gemini/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lon,
          data: activeData,
          category: cat,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
      }
      const result = await response.json();
      setRecommendations(result);
      setIsOfflineMitigationMode(false);
      
      // 成功時、タイムスタンプを更新
      lastGeminiTimeRef.current = Date.now();

      // 自動読み上げ（ミュートでない場合）
      if (result && !isMutedRef.current) {
        speakRecommendations(result);
      }
    } catch (err) {
      console.error("Failed to fetch travel recommendations from Gemini:", err);
      // オフライン減災モードの有効化
      setIsOfflineMitigationMode(true);
      const shelters = getFallbackShelters(data.address || null);
      const fallbackResult = {
        alert: "⚠️ 【オフライン減災モード】通信不調のためローカル情報を提供中。落ち着いて行動してください。",
        actionGuide: "🧭 広域避難場所へ避難、家族への安否確認、FMラジオ等の災害情報を確認してください。",
        spotInfo: `📍 近隣の主な指定避難所リスト:\n` + shelters.map(s => `・${s}`).join("\n")
      };
      setRecommendations(fallbackResult);
      if (!isMutedRef.current) {
        speakRecommendations(fallbackResult);
      }
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // 一括更新。全てのAPIを順次並行フェッチし、届いたデータから順次画面を更新。
  const triggerFullUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    // GPS現在地を一発getCurrentPositionで取得
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        currentCoords.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch (e) {
        console.warn("Failed to refresh raw geolocation on manual update, using last cached", e);
      }
    }

    if (!currentCoords.current) {
      console.warn("GPS現在地が取得できません。位置情報の許可、または電波状況を確認してください。");
      setData((prev) => ({
        ...prev,
        address: "GPS信号を受信できません。位置情報の利用を許可し、一括更新してください。",
        zipcode: null,
      }));
      setIsUpdating(false);
      
      // GPS未取得の時の親切な案内をGeminiおすすめ欄に直接セット
      setRecommendations({
        alert: "🧭 【GPSシグナルなし】現在地の取得を待っています...",
        actionGuide: "スマートフォンのGPS（位置情報）が有効になっているか確認してください。",
        spotInfo: "GPSが取得されると、あなたの居場所に完全に連動したAIコンパニオンが起動します。"
      });
      return;
    }

    const { lat, lon } = currentCoords.current;
    const nowStamp = Date.now();
    const now = new Date();
    const dateStr = now.toDateString();

    const isSameDay = lastUpdatedDateStr.current === dateStr;
    const moved = !lastUpdatedCoords.current ||
      Math.abs(lastUpdatedCoords.current.lat - lat) > 0.0005 ||
      Math.abs(lastUpdatedCoords.current.lon - lon) > 0.0005;

    // -------------------------------------------------------------
    // ステップ1: API不要でローカルで即座に計算できるデータをただちに更新・光らせる
    // -------------------------------------------------------------
    const updateMoonAndTide = !isSameDay || !data.moonAge || !data.highTide || !data.lowTide;
    const updateGeoDistance = moved || !data.tokyoDistance || !data.fujiDistance || !data.seaDistance;
    const updateCapital = moved || !data.prefecturalCapital;

    const moonAgeData = updateMoonAndTide ? getMoonAgeAndState(now) : data.moonAge!;
    const sunPos = getSolarPosition(lat, lon, now); // 太陽位置は常に更新（時間で変化するため）
    const tides = updateMoonAndTide ? getTideTimes(now, moonAgeData.age) : { highTides: [data.highTide || "-"], lowTides: [data.lowTide || "-"] };

    const tokyoDist = updateGeoDistance ? calculateDistance(lat, lon, DESTINATIONS.TOKYO_STATION.lat, DESTINATIONS.TOKYO_STATION.lon) : data.tokyoDistance;
    const tokyoBear = updateGeoDistance ? calculateBearing(lat, lon, DESTINATIONS.TOKYO_STATION.lat, DESTINATIONS.TOKYO_STATION.lon) : data.tokyoBearing;

    const fujiDist = updateGeoDistance ? calculateDistance(lat, lon, DESTINATIONS.MT_FUJI.lat, DESTINATIONS.MT_FUJI.lon) : data.fujiDistance;
    const fujiBear = updateGeoDistance ? calculateBearing(lat, lon, DESTINATIONS.MT_FUJI.lat, DESTINATIONS.MT_FUJI.lon) : data.fujiBearing;

    const capital = updateCapital ? findNearestCapital(lat, lon) : data.prefecturalCapital;

    let seaDist = data.seaDistance;
    let seaBear = data.seaBearing;
    if (updateGeoDistance) {
      const seaBases = [
        // 東京湾、横浜港、湘南、相模湾周辺
        { name: "東京湾", lat: 35.5, lon: 139.8 },
        { name: "横浜港", lat: 35.45, lon: 139.65 }, // 横浜駅近くの海（これで横浜駅からの距離が大幅に近くなります）
        { name: "湘南海岸", lat: 35.31, lon: 139.47 },
        { name: "相模湾", lat: 35.25, lon: 139.15 },
        { name: "駿河湾", lat: 34.9, lon: 138.5 },
        { name: "伊勢湾", lat: 34.7, lon: 136.8 },
        { name: "大阪湾", lat: 34.6, lon: 135.3 },
        { name: "博多湾", lat: 33.63, lon: 130.35 },
        { name: "鹿児島湾", lat: 31.5, lon: 130.6 },
        { name: "仙台湾", lat: 38.2, lon: 141.1 },
        { name: "太平洋(銚子)", lat: 35.73, lon: 140.85 },
        { name: "太平洋(浜松)", lat: 34.67, lon: 137.7 },
        { name: "太平洋(室戸岬)", lat: 33.25, lon: 134.18 },
        { name: "太平洋(足摺岬)", lat: 32.7, lon: 133.0 },
        { name: "日本海(新潟)", lat: 37.95, lon: 139.0 },
        { name: "日本海(金沢)", lat: 36.65, lon: 136.6 },
        { name: "日本海(境港)", lat: 35.55, lon: 133.25 },
        { name: "瀬戸内海(広島)", lat: 34.3, lon: 132.45 },
        { name: "瀬戸内海(高松)", lat: 34.35, lon: 134.05 },
        { name: "オホーツク海(網走)", lat: 44.03, lon: 144.27 },
        { name: "内浦湾(室蘭)", lat: 42.35, lon: 140.97 },
        { name: "石狩湾(小樽)", lat: 43.2, lon: 141.0 },
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

    const localCalculatedData = {
      moonAge: moonAgeData,
      sunPosition: sunPos,
      highTide: tides.highTides[0] || "-",
      lowTide: tides.lowTides[0] || "-",
      tokyoDistance: tokyoDist,
      tokyoBearing: tokyoBear,
      fujiDistance: fujiDist,
      fujiBearing: fujiBear,
      prefecturalCapital: capital,
      seaDistance: seaDist,
      seaBearing: seaBear,
      
      // センサー系
      tilt: { ...latestTilt.current },
      bearing: { angle: latestHeading.current, direction: getDirectionString(latestHeading.current) },
      gpsAccuracy: latestGps.current.accuracy,
      speed: latestGps.current.speed,
      dbLevel: latestDb.current,
    };

    const immediateTileIds: TileId[] = [
      "sunPosition",
      "tilt", "bearing", "gpsAccuracy", "speed", "elevation", "dbLevel"
    ];

    if (updateMoonAndTide) {
      immediateTileIds.push("moonAge", "highTide", "lowTide", "highLowTide");
    }
    if (updateGeoDistance) {
      immediateTileIds.push("tokyoDistance", "fujiDistance", "seaDistance");
    }
    if (updateCapital) {
      immediateTileIds.push("prefecturalCapital");
    }

    // ローカルで全情報をリアルタイムにマージして最後にGeminiへ渡す
    const mergedData: CompanionData = {
      ...data,
      ...localCalculatedData,
      elevation: latestGps.current.elevation !== null ? latestGps.current.elevation : data.elevation,
    };

    setData((prev) => ({
      ...prev,
      ...localCalculatedData,
      elevation: latestGps.current.elevation !== null ? latestGps.current.elevation : prev.elevation,
    }));

    setLastUpdated((prev) => {
      const next = { ...prev };
      immediateTileIds.forEach((id) => {
        next[id] = nowStamp;
      });
      return next;
    });

    // -------------------------------------------------------------
    // ステップ2: 各種外部APIリクエストを個別の並列非同期タスクとして起動し、
    // 届いた順に即時反映・光らせる（Promise.allによる一括待ちを行わない）
    // -------------------------------------------------------------
    
    // API 1: 住所・郵便番号 (Nominatim)
    // 大きく移動していなければAPI呼び出しを完全にスキップ
    const taskAddress = async () => {
      if (!moved && data.address && data.zipcode) {
        console.log("Battery Save: Skip Nominatim API because position hasn't changed significantly.");
        return;
      }
      try {
        const res = await fetchAddressAndZip(lat, lon);
        const stamp = Date.now();
        mergedData.address = res.address;
        mergedData.zipcode = res.zipcode;
        setData((prev) => ({
          ...prev,
          address: res.address,
          zipcode: res.zipcode,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          address: stamp,
          zipcode: stamp,
        }));
        setCachedTiles((prev) => ({
          ...prev,
          address: false,
          zipcode: false,
        }));
      } catch (err) {
        console.error("fetchAddressAndZip failed in triggerFullUpdate", err);
        setCachedTiles((prev) => ({
          ...prev,
          address: true,
          zipcode: true,
        }));
      }
    };

    // API 2: 天気・気象・気候 (Open-Meteo & マジックアワー)
    const taskWeather = async () => {
      const weatherTileIds: TileId[] = [
        "weather", "precipitation", "rainCloudApproach", "uvIndex", "wind", "humidity", "magicHour", "sunriseSunset", "elevation"
      ];
      try {
        const res = await fetchWeatherAndMeteorology(lat, lon);
        const stamp = Date.now();

        const finalSunrise = isSameDay && data.sunrise ? data.sunrise : res.sunrise;
        const finalSunset = isSameDay && data.sunset ? data.sunset : res.sunset;
        const magicHourVal = calculateMagicHour(finalSunrise?.time || "-", finalSunset?.time || "-");

        let finalElevation = res.elevation;
        const gpsAlt = latestGps.current.elevation;
        if (gpsAlt !== null && res.elevation !== null) {
          finalElevation = Math.round((gpsAlt + res.elevation) / 2);
        } else if (gpsAlt !== null) {
          finalElevation = gpsAlt;
        }

        mergedData.weather = res.weather;
        mergedData.precipitation = res.precipitation;
        mergedData.rainCloudApproach = res.rainCloudApproach;
        mergedData.uvIndex = res.uvIndex;
        mergedData.sunrise = finalSunrise;
        mergedData.sunset = finalSunset;
        mergedData.wind = res.wind;
        mergedData.humidity = res.humidity;
        mergedData.elevation = finalElevation !== null ? finalElevation : mergedData.elevation;
        mergedData.magicHour = magicHourVal;

        setData((prev) => ({
          ...prev,
          weather: res.weather,
          precipitation: res.precipitation,
          rainCloudApproach: res.rainCloudApproach,
          uvIndex: res.uvIndex,
          sunrise: finalSunrise,
          sunset: finalSunset,
          wind: res.wind,
          humidity: res.humidity,
          elevation: finalElevation !== null ? finalElevation : prev.elevation,
          magicHour: magicHourVal,
        }));
        
        const activeTileIds = [...weatherTileIds];

        setLastUpdated((prev) => {
          const next = { ...prev };
          activeTileIds.forEach((id) => {
            next[id] = stamp;
          });
          return next;
        });

        setCachedTiles((prev) => {
          const next = { ...prev };
          activeTileIds.forEach((id) => {
            next[id] = false;
          });
          return next;
        });
      } catch (err) {
        console.error("fetchWeatherAndMeteorology failed in triggerFullUpdate", err);
        setCachedTiles((prev) => {
          const next = { ...prev };
          weatherTileIds.forEach((id) => {
            next[id] = true;
          });
          next["gsiElevation"] = true;
          return next;
        });
      }
    };

    // API 3: 大気・花粉 (Open-Meteo Air Quality & 黄砂)
    const taskAirQuality = async () => {
      const airQualityKeys: TileId[] = ["airQuality", "pm25", "kosa"];
      try {
        const res = await fetchAirQualityAndPollen(lat, lon);
        const stamp = Date.now();
        mergedData.airQuality = res;
        setData((prev) => ({
          ...prev,
          airQuality: res,
        }));
        setLastUpdated((prev) => {
          const next = { ...prev };
          airQualityKeys.forEach((id) => { next[id] = stamp; });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          airQualityKeys.forEach((id) => { next[id] = false; });
          return next;
        });
      } catch (err) {
        console.error("fetchAirQualityAndPollen failed in triggerFullUpdate", err);
        setCachedTiles((prev) => {
          const next = { ...prev };
          airQualityKeys.forEach((id) => { next[id] = true; });
          return next;
        });
      }
    };

    // API 4: 海水温・波情報 (Open-Meteo Marine & 満潮干潮)
    const taskSeaTemp = async () => {
      const marineKeys: TileId[] = ["seaTemp", "waveInfo", "highLowTide"];
      if (!moved && data.seaTemp) {
        console.log("Battery Save: Skip Marine API because position hasn't changed significantly.");
        return;
      }
      try {
        const res = await fetchSeaTemperature(lat, lon);
        const stamp = Date.now();
        mergedData.seaTemp = res.seaTemp;
        mergedData.waveInfo = res.waveInfo;
        setData((prev) => ({
          ...prev,
          seaTemp: res.seaTemp,
          waveInfo: res.waveInfo,
        }));
        setLastUpdated((prev) => {
          const next = { ...prev };
          marineKeys.forEach((id) => { next[id] = stamp; });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          marineKeys.forEach((id) => { next[id] = false; });
          return next;
        });
      } catch (err) {
        console.error("fetchSeaTemperature failed in triggerFullUpdate", err);
        setCachedTiles((prev) => {
          const next = { ...prev };
          marineKeys.forEach((id) => { next[id] = true; });
          return next;
        });
      }
    };

    // API 5: 周辺POI (Overpass API & 道路交通状況)
    const taskPOI = async () => {
      const poiTileIds: TileId[] = [
        "river", "riverLevel", "trafficStatus",
        "roadStation1", "onsen",
        "station1", "station2", "bus1", "bus2",
        "mountain", "intersection"
      ];
      if (!moved && data.river) {
        console.log("Battery Save: Skip Overpass API because position hasn't changed significantly.");
        return;
      }
      try {
        const res = await fetchPOIFromOverpass(lat, lon);
        const stamp = Date.now();
        const speedKmh = latestGps.current.speed !== null ? Math.round(latestGps.current.speed * 3.6) : 0;
        const traffic = calculateTrafficStatus(lat, lon, speedKmh);
        
        Object.assign(mergedData, res);
        mergedData.trafficStatus = traffic;

        setData((prev) => ({
          ...prev,
          ...res,
          trafficStatus: traffic,
        }));
        
        setLastUpdated((prev) => {
          const next = { ...prev };
          poiTileIds.forEach((id) => {
            next[id] = stamp;
          });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          poiTileIds.forEach((id) => {
            next[id] = false;
          });
          return next;
        });
      } catch (err) {
        console.error("fetchPOIFromOverpass failed in triggerFullUpdate", err);
        setCachedTiles((prev) => {
          const next = { ...prev };
          poiTileIds.forEach((id) => {
            next[id] = true;
          });
          return next;
        });
      }
    };

    // API 6: 直近の地震・防災情報 (P2Pquake)
    const taskEarthquake = async () => {
      try {
        const res = await fetchEarthquakeInfo();
        const stamp = Date.now();
        mergedData.earthquake = res;
        setData((prev) => ({
          ...prev,
          earthquake: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          earthquake: stamp,
        }));
        setCachedTiles((prev) => ({
          ...prev,
          earthquake: false,
        }));
      } catch (err) {
        console.error("fetchEarthquakeInfo failed in triggerFullUpdate", err);
        setCachedTiles((prev) => ({
          ...prev,
          earthquake: true,
        }));
      }
    };

    // API 7: 電力使用状況
    const taskPowerUsage = async () => {
      try {
        const res = calculatePowerUsage(lat, lon);
        const stamp = Date.now();
        mergedData.powerUsage = res;
        setData((prev) => ({
          ...prev,
          powerUsage: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          powerUsage: stamp,
        }));
        setCachedTiles((prev) => ({
          ...prev,
          powerUsage: false,
        }));
      } catch (err) {
        console.error("calculatePowerUsage failed in triggerFullUpdate", err);
        setCachedTiles((prev) => ({
          ...prev,
          powerUsage: true,
        }));
      }
    };

    // すべてのAPIリクエストを非同期で開始し、届いた順に個別にアップデート
    Promise.allSettled([
      taskAddress(),
      taskWeather(),
      taskAirQuality(),
      taskSeaTemp(),
      taskPOI(),
      taskEarthquake(),
      taskPowerUsage()
    ]).finally(() => {
      setIsUpdating(false);
      lastUpdatedCoords.current = { lat, lon };
      lastUpdatedDateStr.current = dateStr;

      // 最新の全てのデータを直に流し込んで、Geminiの推薦情報を同期更新＆自動音声読み上げ
      triggerGeminiRecommendations(mergedData);
    });
  };

  // 特定のパネルをタップ/クリックしたときにそのパネルだけを即時更新する関数
  const handleTileClick = async (tileId: TileId) => {
    if (tileId === "maxLeanAngle") {
      if (data.confirmResetLean) {
        setMaxLean({ left: 0, right: 0 });
        setData((prev) => ({ ...prev, confirmResetLean: false, maxLeanAngle: { left: 0, right: 0 } }));
      } else {
        setData((prev) => ({ ...prev, confirmResetLean: true }));
        setTimeout(() => {
          setData((prev) => ({ ...prev, confirmResetLean: false }));
        }, 4000);
      }
      return;
    }

    const nowStamp = Date.now();
    setLastUpdated((prev) => ({
      ...prev,
      [tileId]: nowStamp,
    }));

    // 位置情報を最新に更新
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentCoords.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        },
        null,
        { enableHighAccuracy: true, timeout: 2000 }
      );
    }

    if (!currentCoords.current) {
      setCachedTiles((prev) => ({ ...prev, [tileId]: true }));
      return;
    }

    const { lat, lon } = currentCoords.current;

    // どのデータを更新するかキーによって分類してフェッチ
    const weatherKeys: TileId[] = ["weather", "precipitation", "rainCloudApproach", "uvIndex", "wind", "humidity", "elevation", "magicHour"];
    const poiKeys: TileId[] = [
      "river", "riverLevel", "trafficStatus",
      "roadStation1", "onsen",
      "station1", "station2", "bus1", "bus2",
      "mountain", "intersection"
    ];

    if (tileId === "address" || tileId === "zipcode") {
      try {
        const res = await fetchAddressAndZip(lat, lon);
        setData((prev) => ({ ...prev, address: res.address, zipcode: res.zipcode }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => ({ ...prev, address: updatedStamp, zipcode: updatedStamp }));
        setCachedTiles((prev) => ({ ...prev, address: false, zipcode: false }));
      } catch (e) {
        console.error("Single tile update Nominatim error:", e);
        setCachedTiles((prev) => ({ ...prev, address: true, zipcode: true }));
      }
    } else if (weatherKeys.includes(tileId)) {
      try {
        const res = await fetchWeatherAndMeteorology(lat, lon);

        const magicHourVal = calculateMagicHour(res.sunrise?.time || "-", res.sunset?.time || "-");
        
        let finalElevation = res.elevation;
        const gpsAlt = latestGps.current.elevation;
        if (gpsAlt !== null && res.elevation !== null) {
          finalElevation = Math.round((gpsAlt + res.elevation) / 2);
        } else if (gpsAlt !== null) {
          finalElevation = gpsAlt;
        }

        setData((prev) => ({
          ...prev,
          weather: res.weather,
          precipitation: res.precipitation,
          rainCloudApproach: res.rainCloudApproach,
          uvIndex: res.uvIndex,
          wind: res.wind,
          humidity: res.humidity,
          elevation: finalElevation !== null ? finalElevation : prev.elevation,
          magicHour: magicHourVal,
        }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => {
          const next = { ...prev };
          weatherKeys.forEach(k => { next[k] = updatedStamp; });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          weatherKeys.forEach(k => { next[k] = false; });
          return next;
        });
      } catch (e) {
        console.error("Single tile update Weather error:", e);
        setCachedTiles((prev) => {
          const next = { ...prev };
          weatherKeys.forEach(k => { next[k] = true; });
          return next;
        });
      }
    } else if (tileId === "airQuality" || tileId === "pm25" || tileId === "kosa") {
      const aqKeys: TileId[] = ["airQuality", "pm25", "kosa"];
      try {
        const res = await fetchAirQualityAndPollen(lat, lon);
        setData((prev) => ({ ...prev, airQuality: res }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => {
          const next = { ...prev };
          aqKeys.forEach(k => { next[k] = updatedStamp; });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          aqKeys.forEach(k => { next[k] = false; });
          return next;
        });
      } catch (e) {
        console.error("Single tile update AirQuality error:", e);
        setCachedTiles((prev) => {
          const next = { ...prev };
          aqKeys.forEach(k => { next[k] = true; });
          return next;
        });
      }
    } else if (tileId === "seaTemp" || tileId === "waveInfo" || tileId === "highLowTide") {
      const seaKeys: TileId[] = ["seaTemp", "waveInfo", "highLowTide"];
      try {
        const res = await fetchSeaTemperature(lat, lon);
        setData((prev) => ({ ...prev, seaTemp: res.seaTemp, waveInfo: res.waveInfo }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => {
          const next = { ...prev };
          seaKeys.forEach(k => { next[k] = updatedStamp; });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          seaKeys.forEach(k => { next[k] = false; });
          return next;
        });
      } catch (e) {
        console.error("Single tile update SeaTemp error:", e);
        setCachedTiles((prev) => {
          const next = { ...prev };
          seaKeys.forEach(k => { next[k] = true; });
          return next;
        });
      }
    } else if (poiKeys.includes(tileId)) {
      try {
        const res = await fetchPOIFromOverpass(lat, lon);
        const speedKmh = latestGps.current.speed !== null ? Math.round(latestGps.current.speed * 3.6) : 0;
        const traffic = calculateTrafficStatus(lat, lon, speedKmh);
        setData((prev) => ({
          ...prev,
          ...res,
          trafficStatus: traffic,
        }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => {
          const next = { ...prev };
          poiKeys.forEach(k => { next[k] = updatedStamp; });
          return next;
        });
        setCachedTiles((prev) => {
          const next = { ...prev };
          poiKeys.forEach(k => { next[k] = false; });
          return next;
        });
      } catch (e) {
        console.error("Single tile update POI error:", e);
        setCachedTiles((prev) => {
          const next = { ...prev };
          poiKeys.forEach(k => { next[k] = true; });
          return next;
        });
      }
    } else if (tileId === "earthquake") {
      try {
        const res = await fetchEarthquakeInfo();
        setData((prev) => ({ ...prev, earthquake: res }));
        setLastUpdated((prev) => ({ ...prev, earthquake: Date.now() }));
        setCachedTiles((prev) => ({ ...prev, earthquake: false }));
      } catch (e) {
        console.error("Single tile update Earthquake error:", e);
        setCachedTiles((prev) => ({ ...prev, earthquake: true }));
      }
    } else if (tileId === "powerUsage") {
      try {
        const res = calculatePowerUsage(lat, lon);
        setData((prev) => ({ ...prev, powerUsage: res }));
        setLastUpdated((prev) => ({ ...prev, powerUsage: Date.now() }));
        setCachedTiles((prev) => ({ ...prev, powerUsage: false }));
      } catch (e) {
        console.error("Single tile update PowerUsage error:", e);
        setCachedTiles((prev) => ({ ...prev, powerUsage: true }));
      }
    } else {
      // センサーやローカル計算系は一瞬で現在データから再生成
      const now = new Date();
      const moonAgeData = getMoonAgeAndState(now);
      const sunPos = getSolarPosition(lat, lon, now);
      const tides = getTideTimes(now, moonAgeData.age);

      const tokyoDist = calculateDistance(lat, lon, DESTINATIONS.TOKYO_STATION.lat, DESTINATIONS.TOKYO_STATION.lon);
      const tokyoBear = calculateBearing(lat, lon, DESTINATIONS.TOKYO_STATION.lat, DESTINATIONS.TOKYO_STATION.lon);

      const fujiDist = calculateDistance(lat, lon, DESTINATIONS.MT_FUJI.lat, DESTINATIONS.MT_FUJI.lon);
      const fujiBear = calculateBearing(lat, lon, DESTINATIONS.MT_FUJI.lat, DESTINATIONS.MT_FUJI.lon);

      const capital = findNearestCapital(lat, lon);

      setData((prev) => ({
        ...prev,
        moonAge: moonAgeData,
        sunPosition: sunPos,
        highTide: tides.highTides[0] || "-",
        lowTide: tides.lowTides[0] || "-",
        tokyoDistance: tokyoDist,
        tokyoBearing: tokyoBear,
        fujiDistance: fujiDist,
        fujiBearing: fujiBear,
        prefecturalCapital: capital,
      }));

      setLastUpdated((prev) => ({
        ...prev,
        [tileId]: Date.now(),
      }));
      setCachedTiles((prev) => ({
        ...prev,
        [tileId]: false,
      }));
    }
  };

  // 方角を16方位の日本語に (堅牢化版)
  const getDirectionString = (bearing: number | null | undefined): string => {
    if (bearing === null || bearing === undefined || isNaN(bearing)) {
      return "-";
    }
    const directions = [
      "北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東",
      "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"
    ];
    const index = Math.round(bearing / 22.5) % 16;
    const dir = directions[index];
    return dir || "-";
  };

  // 3. 自動タイマーの設定とセンサー監視
  useEffect(() => {
    if (!started) return;

    // --- GPS監視開始 ---
    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (isPausedRef.current) return;
          latestGps.current = {
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            elevation: position.coords.altitude,
          };
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          currentCoords.current = { lat, lon };

          // 累計移動距離の積算
          if (prevTrackCoords.current) {
            const distKm = calculateDistance(
              prevTrackCoords.current.lat,
              prevTrackCoords.current.lon,
              lat,
              lon
            );
            // GPS誤差（揺らぎ）による不意な蓄積を防ぐため、2m以上かつ精度30m以下の場合のみ積算
            if (distKm > 0.002 && (!position.coords.accuracy || position.coords.accuracy < 30)) {
              currentAccumulatedDistance.current += distKm * 1000;
            }
          }
          prevTrackCoords.current = { lat, lon };
        },
        (err) => {
          console.warn("watchPosition error", err);
        },
        { enableHighAccuracy: true }
      );
    }

    // --- デバイス傾きとコンパスのトラッキング（Ref更新のみで再描画は起こさない） ---
    let lastOrientationTime = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (isPausedRef.current) return;
      const now = Date.now();
      if (now - lastOrientationTime < 200) return; // 200ms未満は間引いてバッテリー負荷を最小に
      lastOrientationTime = now;

      const pitch = e.beta !== null ? Math.round(e.beta) : 0;
      const roll = e.gamma !== null ? Math.round(e.gamma) : 0;
      latestTilt.current = { pitch, roll };

      // 最大バンク角（ハングオン）の自動計測＆記録
      const rollAbs = Math.abs(roll);
      if (rollAbs > 0 && rollAbs <= 65) { // 典型的な最大バンク角は60°前後
        if (roll < 0) {
          const leftLean = Math.abs(roll);
          if (leftLean > maxLeanRef.current.left) {
            setMaxLean((prev) => ({ ...prev, left: leftLean }));
          }
        } else if (roll > 0) {
          const rightLean = roll;
          if (rightLean > maxLeanRef.current.right) {
            setMaxLean((prev) => ({ ...prev, right: rightLean }));
          }
        }
      }

      // @ts-ignore
      let heading = e.webkitCompassHeading;
      if (heading === undefined || heading === null) {
        heading = e.alpha !== null ? 360 - e.alpha : 0;
      }

      // 移動平均フィルタ (巡回的な角度を正しく平均するためにベクトルx/yに変換)
      const rad = (heading * Math.PI) / 180;
      const currentVec = { x: Math.cos(rad), y: Math.sin(rad) };

      const history = bearingHistory.current;
      history.push(currentVec);
      if (history.length > 8) {
        history.shift();
      }

      let sumX = 0;
      let sumY = 0;
      for (const vec of history) {
        sumX += vec.x;
        sumY += vec.y;
      }
      const avgX = sumX / history.length;
      const avgY = sumY / history.length;

      let avgRad = Math.atan2(avgY, avgX);
      if (avgRad < 0) {
        avgRad += 2 * Math.PI;
      }
      const smoothedHeading = Math.round((avgRad * 180) / Math.PI) % 360;
      latestHeading.current = smoothedHeading;
    };
    window.addEventListener("deviceorientation", handleOrientation, true);

    // --- 3秒毎更新 (旧1秒毎) ---
    // 📐傾き, 🧭方角, マイクdB, 🏃累計移動距離をまとめて3秒毎に1回だけ一括ステート描画
    const interval3s = setInterval(() => {
      if (isPausedRef.current) return;
      const nowStamp = Date.now();
      const heading = latestHeading.current;
      
      setDeviceHeading(heading);
      setDbLevel(latestDb.current);

      setData((prev) => ({
        ...prev,
        tilt: { ...latestTilt.current },
        bearing: { angle: heading, direction: getDirectionString(heading) },
        dbLevel: latestDb.current,
        accumulatedDistance: Math.round(currentAccumulatedDistance.current),
        maxLeanAngle: { ...maxLeanRef.current },
      }));
      setLastUpdated((prev) => ({
        ...prev,
        tilt: nowStamp,
        bearing: nowStamp,
        dbLevel: nowStamp,
        accumulatedDistance: nowStamp,
        sunsetCountdown: nowStamp, // カウントダウンタイマーも3秒ごとに表示を更新
        maxLeanAngle: nowStamp,
      }));
    }, 3000);

    // --- 10秒毎更新 (旧5秒毎) ---
    // 📡GPS精度, 🚗移動速度, ⛰️標高
    const interval10s = setInterval(() => {
      if (isPausedRef.current) return;
      const nowStamp = Date.now();
      setData((prev) => ({
        ...prev,
        gpsAccuracy: latestGps.current.accuracy,
        speed: latestGps.current.speed,
        elevation: latestGps.current.elevation !== null ? latestGps.current.elevation : prev.elevation,
      }));
      setLastUpdated((prev) => ({
        ...prev,
        gpsAccuracy: nowStamp,
        speed: nowStamp,
        elevation: nowStamp,
      }));
    }, 10000);

    // --- 3分毎更新 ---
    // 📮郵便番号, 🗺️現在地 (最上部表示用)
    const interval3m = setInterval(() => {
      if (isPausedRef.current) return;
      updateTileData(["zipcode", "address"]);
    }, 3 * 60 * 1000);

    // --- 10分毎更新 ---
    // 海、日の出・日没、大気汚染、満潮・干潮、黄砂 (不要なPOIは完全に削除)
    const interval10m = setInterval(() => {
      if (isPausedRef.current) return;
      const list10m: TileId[] = [
        "tokyoDistance", "seaDistance", "fujiDistance", "prefecturalCapital",
        "wind", "humidity", "airQuality", "seaTemp", "highLowTide", "sunPosition", "kosa"
      ];
      updateTileData(list10m);
    }, 10 * 60 * 1000);

    // --- 15分毎更新 ---
    // 天気、降水、雨雲、紫外線
    const interval15m = setInterval(() => {
      if (isPausedRef.current) return;
      updateTileData(["weather", "precipitation", "rainCloudApproach", "uvIndex"]);
    }, 15 * 60 * 1000);

    // --- 20分毎更新 ---
    // 日の出・日没
    const interval20m = setInterval(() => {
      if (isPausedRef.current) return;
      updateTileData(["sunriseSunset"]);
    }, 20 * 60 * 1000);

    // --- 60分毎更新 ---
    // 月齢
    const interval60m = setInterval(() => {
      if (isPausedRef.current) return;
      updateTileData(["moonAge"]);
    }, 60 * 60 * 1000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.removeEventListener("deviceorientation", handleOrientation, true);
      clearInterval(interval3s);
      clearInterval(interval10s);
      clearInterval(interval3m);
      clearInterval(interval10m);
      clearInterval(interval15m);
      clearInterval(interval20m);
      clearInterval(interval60m);
      if (micIntervalId.current) {
        clearInterval(micIntervalId.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [started]);

  // 緊急度の自動判定 (震度や警報、緊急避難などの重要ワードを検知)
  const isEmergency = !!(
    (recommendations?.alert && (
      recommendations.alert.includes("震度") || 
      recommendations.alert.includes("津波") || 
      recommendations.alert.includes("警報") || 
      recommendations.alert.includes("避難") ||
      recommendations.alert.includes("震災") ||
      recommendations.alert.includes("緊急")
    )) || 
    (data.earthquake && (
      data.earthquake.includes("震度5") || 
      data.earthquake.includes("震度6") || 
      data.earthquake.includes("震度7") || 
      data.earthquake.includes("津波") || 
      data.earthquake.includes("緊急")
    ))
  );

  // AI情報自動更新＆カウントダウンタイマー (緊急時は1分毎更新、通常時は5分毎更新)
  useEffect(() => {
    if (!started) return;
    
    const targetLimit = isEmergency ? 60 : 300;
    
    // カウントダウンが制限時間を超えていれば、即座にキャップする
    setCountdownSec((prev) => (prev > targetLimit ? targetLimit : prev));

    const timer = setInterval(() => {
      if (isPausedRef.current) return;
      
      setCountdownSec((prev) => {
        if (prev <= 1) {
          triggerGeminiRecommendations();
          return targetLimit;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [started, isEmergency]);

  if (!started) {
    return <InitialOverlay onStart={handleStart} />;
  }

  // 天気のおすすめ絵文字
  const weatherEmoji = data.weather ? getWeatherEmojiAndName(data.weather.code).emoji : "🧭";

  const addressBgClass = isAddressFlashing
    ? "bg-yellow-400 text-slate-950 border-yellow-300"
    : "bg-slate-950/85 text-white border-white/10";

  // マーカー行表示用ヘルパー (クリックで詳細表示モーダルを起動)
  const renderMarqueeRow = (icon: string, label: string, labelColor: string, text: string) => {
    return (
      <div 
        onClick={() => text && setSelectedFullText({ label, text })}
        className="flex items-center gap-2 bg-slate-900/60 hover:bg-slate-900/80 transition-all px-3 py-1.5 rounded-lg border border-white/5 text-[11px] h-8 overflow-hidden cursor-pointer select-none group"
        title="タップして詳細をダイアログ表示"
      >
        <span className={`shrink-0 font-bold ${labelColor} flex items-center gap-1 min-w-[70px] text-left select-none`}>
          <span>{icon}</span>
          <span>{label}:</span>
        </span>
        <div className="marquee-container flex-1">
          {text ? (
            <>
              <div className="marquee-content text-slate-200 font-sans pr-10 group-hover:text-white">
                <span>{text}</span>
                <span className="mx-6 text-slate-500 font-bold">✦</span>
              </div>
              <div className="marquee-content text-slate-200 font-sans pr-10 group-hover:text-white">
                <span>{text}</span>
                <span className="mx-6 text-slate-500 font-bold">✦</span>
              </div>
            </>
          ) : (
            <div className="marquee-content text-slate-400">
              <span>現在地と周辺データを分析中...</span>
            </div>
          )}
        </div>
        <span className="shrink-0 text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
          🔍
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen animate-travel-bg text-white font-sans flex flex-col overflow-x-hidden pb-44 sm:pb-[180px]">
      {/* ヘッダーエリア */}
      <header className="w-full h-[46px] bg-black/20 border-b border-white/20 relative z-40 px-5 flex items-center justify-between shadow-lg shrink-0">
        {/* ロゴと現在地の概要 */}
        <div className="flex items-center gap-2.5">
          <div className="w-6.5 h-6.5 bg-gradient-to-tr from-slate-900 to-slate-950 rounded-md flex items-center justify-center shadow-md border border-slate-800">
            <Compass className="w-4 h-4 text-sky-400 animate-[spin_25s_linear_infinite]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-white tracking-wider flex items-center gap-1 whitespace-nowrap">
              旅のお供
            </h1>
          </div>
        </div>

        {/* 一括更新・並べ替えグループ選択エリア */}
        <div className="flex items-center gap-1.5">
          {activeCategory === "all" && (
            <button
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedTileIds([]);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all select-none cursor-pointer ${
                isSelectMode
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>🧩</span>
              <span>{isSelectMode ? "グループ移動中" : "複数選択移動"}</span>
            </button>
          )}

          {/* 強制一括更新ボタン */}
          <button
            onClick={triggerFullUpdate}
            disabled={isUpdating}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 disabled:opacity-50 transition-all font-bold border border-white px-3 py-1 rounded-md text-xs text-white shrink-0 select-none cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            <span>一括更新</span>
          </button>
        </div>
      </header>

      {/* カテゴリ選択タブ */}
      <div className="w-full bg-slate-900/60 border-b border-white/10 px-4 py-1.5 flex gap-1.5 items-center overflow-x-auto scrollbar-none shrink-0 relative z-20">
        {[
          { id: "all", label: "すべて", icon: "🌐" },
          { id: "weather", label: "天候", icon: "🌈" },
          { id: "driving", label: "運転", icon: "🚗" },
          { id: "climbing", label: "登山", icon: "🏔️" },
          { id: "sea", label: "海", icon: "🌊" },
          { id: "disaster", label: "防災", icon: "🚨" },
          { id: "custom", label: "カスタム", icon: "⭐" },
        ].map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer select-none shrink-0 border ${
                isActive
                  ? "bg-sky-500/15 text-sky-400 border-sky-400/40 shadow-[0_0_10px_rgba(56,189,248,0.1)]"
                  : "bg-slate-800/40 text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* グループ並べ替え操作パネル (選択モード時のみ表示) */}
      {isSelectMode && activeCategory === "all" && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex flex-wrap gap-2 items-center justify-between z-20 shrink-0">
          <div className="text-[11px] text-amber-400 font-bold">
            選択中: <span className="font-mono text-xs">{selectedTileIds.length}</span> 個のタイル
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => moveSelectedTiles("left")}
              disabled={selectedTileIds.length === 0}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded cursor-pointer transition-colors"
            >
              ◀ 左へ移動
            </button>
            <button
              onClick={() => moveSelectedTiles("right")}
              disabled={selectedTileIds.length === 0}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded cursor-pointer transition-colors"
            >
              右へ移動 ▶
            </button>
            <button
              onClick={gatherSelectedTiles}
              disabled={selectedTileIds.length <= 1}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-black text-[10px] px-2.5 py-1 rounded cursor-pointer transition-colors"
            >
              一括集約
            </button>
            <button
              onClick={() => setSelectedTileIds([])}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer transition-colors"
            >
              クリア
            </button>
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedTileIds([]);
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white font-black text-[10px] px-2.5 py-1 rounded cursor-pointer transition-colors"
            >
              完了
            </button>
          </div>
        </div>
      )}

      {/* 住所表示パネル (コンパス非表示、住所のみをシンプルに表示) */}
      <div
        ref={mainRef}
        className={`sticky top-0 z-30 w-full px-4 py-2 flex items-center justify-start gap-1.5 text-xs border-b backdrop-blur-md transition-colors duration-300 ${addressBgClass}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={isAddressFlashing ? "text-slate-950" : "text-sky-400"}>📍</span>
          <span className={`truncate font-bold tracking-wide text-sm ${isAddressFlashing ? "text-slate-950" : "text-slate-200"}`}>
            {data.zipcode ? `〒${data.zipcode} ` : ""}{data.address || "現在地を取得中..."}
          </span>
        </div>
      </div>

      {/* カスタムカテゴリの設定パネル (カスタムタブ選択時のみ表示) */}
      {activeCategory === "custom" && (
        <div className="mx-4 my-2 p-3 bg-slate-900/80 border border-sky-500/20 rounded-2xl flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5 select-none">
              ⭐ カスタム表示タイルの編集
            </span>
            <button
              onClick={() => setIsCustomSettingOpen(!isCustomSettingOpen)}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            >
              {isCustomSettingOpen ? "設定を閉じる" : "表示タイルを設定"}
            </button>
          </div>
          
          {isCustomSettingOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1 bg-slate-950/50 p-2.5 rounded-xl border border-white/5 max-h-48 overflow-y-auto">
              {ALL_TILES_CONFIG.map((tile) => {
                const isChecked = customCategoryTileIds.includes(tile.id);
                return (
                  <label key={tile.id} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none hover:text-white p-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setCustomCategoryTileIds((prev) =>
                          isChecked ? prev.filter((id) => id !== tile.id) : [...prev, tile.id]
                        );
                      }}
                      className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-900"
                    />
                    <span>{tile.emoji} {tile.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 今日の旅コンディション (カテゴリ別のコンディション、カスタム時は非表示、タップで折りたたみ可能) */}
      {(() => {
        if (activeCategory === "custom") return null;
        const cond = getCategoryCondition(data, activeCategory);
        
        if (isConditionCollapsed) {
          return (
            <div 
              onClick={() => setIsConditionCollapsed(false)}
              className="mx-4 my-1.5 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-900 border border-white/10 rounded-xl shadow-md flex items-center justify-between gap-3 shrink-0 cursor-pointer select-none transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0 leading-none">{cond.icon}</span>
                <span className="text-xs font-black text-slate-200 truncate">{cond.title}</span>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-[10px] leading-none ${
                        i < cond.stars ? "text-yellow-400" : "text-slate-700"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black font-mono text-emerald-400">
                  {cond.score}点
                </span>
                <span className="text-[9px] text-slate-500 font-bold bg-slate-950/40 px-1.5 py-0.5 rounded">
                  詳細 ＋
                </span>
              </div>
            </div>
          );
        }

        return (
          <div 
            onClick={() => setIsConditionCollapsed(true)}
            className="mx-4 my-2 p-4 bg-slate-900/70 border border-white/10 rounded-2xl shadow-xl flex items-center justify-between gap-4 shrink-0 cursor-pointer select-none hover:bg-slate-900/80 transition-all active:scale-[0.99]"
            title="タップするとコンパクトに畳みます"
          >
            <div className="flex-grow">
              <div className="text-xs text-sky-400 font-extrabold tracking-wider mb-1 flex items-center gap-1.5">
                <span>{cond.icon}</span> {cond.title}
                <span className="text-[9px] text-slate-500 font-normal normal-case ml-auto shrink-0 select-none">
                  タップで畳む −
                </span>
              </div>
              <div className="flex items-center gap-1.5 my-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-base leading-none ${
                      i < cond.stars ? "text-yellow-400" : "text-slate-600"
                    }`}
                  >
                    ★
                  </span>
                ))}
                <span className="text-xs text-slate-400 ml-1 font-mono font-bold">
                  ({cond.stars}/5)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {cond.remarks.map((remark, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-slate-950/60 border border-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full"
                  >
                    {remark}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center justify-center bg-slate-950/80 border border-white/5 rounded-xl px-3 py-2 w-20 text-center shadow-inner">
              <span className="text-[22px] font-black font-mono text-emerald-400 leading-none">
                {cond.score}
              </span>
              <span className="text-[9px] text-slate-400 font-bold mt-1 leading-none">
                100点満点
              </span>
            </div>
          </div>
        );
      })()}

      {/* メインタイグリッド */}
      <main className="flex-grow w-full px-1 py-1 flex flex-col justify-start">
        {/* スマートフォンの画面サイズに応じて3列または4列に切り替わるようにレスポンシブなグリッド設定に変更 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 w-full">
          {tileOrder.map((tileId, idx) => {
            const config = ALL_TILES_CONFIG.find((c) => c.id === tileId);
            if (!config) return null;

            // カテゴリによるフィルタリング
            if (activeCategory === "custom") {
              if (!customCategoryTileIds.includes(tileId)) return null;
            } else if (activeCategory !== "all" && !config.categories.includes(activeCategory)) {
              return null;
            }

            // ドラッグ＆ドロップは "すべて" (all) タブかつ並べ替え選択モードでない場合のみ有効にする
            const canDrag = activeCategory === "all" && !isSelectMode;
            const isSelected = selectedTileIds.includes(config.id);
            const tileClickAction = isSelectMode 
              ? () => toggleSelectTile(config.id) 
              : () => handleTileClick(config.id);

            return (
              <div
                key={config.id}
                draggable={canDrag}
                onDragStart={(e) => canDrag && handleDragStart(e, idx)}
                onDragOver={(e) => canDrag && handleDragOver(e, idx)}
                onDragEnd={canDrag ? handleDragEnd : undefined}
                className={`${canDrag ? "cursor-move active:scale-95" : "cursor-default"} select-none transition-transform`}
              >
                <div className={`relative rounded-2xl h-full transition-all duration-200 ${isSelected ? "ring-4 ring-amber-400 scale-[0.96] shadow-[0_0_15px_rgba(245,158,11,0.3)]" : ""}`}>
                  {isSelectMode && (
                    <div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 bg-amber-500 border border-white rounded-full flex items-center justify-center text-[10px] text-slate-950 font-black">
                      {isSelected ? "✓" : ""}
                    </div>
                  )}
                  <CompanionTile
                    config={config}
                    data={data}
                    deviceHeading={deviceHeading}
                    lastUpdatedTime={lastUpdated[config.id] || 0}
                    isCached={!!cachedTiles[config.id]}
                    onClick={tileClickAction}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 🤖 Gemini リアルタイム旅行情報 (画面下部に完全に固定されたフローティング・コンパニオン・ドック) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-white/15 px-4 pt-3 pb-2 shadow-[0_-12px_40px_rgba(0,0,0,0.7)]">
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isLoadingRecommendations ? (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                ) : null}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isLoadingRecommendations ? "bg-sky-500" : isEmergency ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}></span>
              </span>
              <span className={`text-[11px] font-bold tracking-wide font-sans flex items-center gap-1 select-none ${isEmergency ? "text-amber-400 animate-pulse" : "text-slate-200"}`}>
                {isEmergency ? (
                  <span>🚨 AI災害緊急モード (1分更新: 残り {countdownSec}秒)</span>
                ) : (
                  <span>🤖 AI情報自動更新 (5分更新: あと {Math.floor(countdownSec / 60)}分{countdownSec % 60}秒)</span>
                )}
                {isLoadingRecommendations && <span className="text-[10px] text-slate-400 animate-pulse font-normal">(更新中...)</span>}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleVoiceToggle}
                disabled={!recommendations || isLoadingRecommendations}
                className={`flex items-center gap-1.5 px-3 py-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold rounded border shadow-sm cursor-pointer select-none ${
                  isSpeaking
                    ? "bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/20 text-amber-300 animate-pulse"
                    : isMuted
                    ? "bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/20 text-rose-300"
                    : "bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500/20 text-emerald-300"
                }`}
                title={
                  isSpeaking 
                    ? "読み上げを即時停止" 
                    : isMuted 
                    ? "音声案内をオンにする (即時読み上げ)" 
                    : "音声案内をオフにする (ミュート)"
                }
              >
                {isSpeaking ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                    <span>⏹ 停止する</span>
                  </>
                ) : isMuted ? (
                  <>
                    <span>🔇 音声案内: オフ</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>🔊 音声案内: オン (自動)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {/* 危険情報が無い場合（危険情報の重要キーワードが含まれていない場合）は非表示にする */}
            {(isEmergency || (recommendations?.alert && (
              recommendations.alert.includes("警報") ||
              recommendations.alert.includes("注意") ||
              recommendations.alert.includes("震度") ||
              recommendations.alert.includes("津波") ||
              recommendations.alert.includes("避難") ||
              recommendations.alert.includes("オフライン減災") ||
              recommendations.alert.includes("🚨") ||
              recommendations.alert.includes("⚠️")
            ))) ? (
              renderMarqueeRow("🚨", "危険情報", "text-rose-400 font-extrabold", recommendations?.alert || "")
            ) : null}
            
            {renderMarqueeRow("🧭", "次の行動", "text-sky-300", recommendations?.actionGuide || "")}
            {renderMarqueeRow("📍", "お役立ち", "text-emerald-300", recommendations?.spotInfo || "")}
          </div>

          {/* フッターを固定ドックの下にスリムに統合して省スペース化 */}
          <div className="mt-2 text-center text-[9px] text-slate-500 select-none border-t border-white/5 pt-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
            <span>@2026 旅のお供 ver84</span>
            {(!isOnline || !currentCoords.current || isOfflineMitigationMode) && (
              <span className="flex items-center gap-1 text-rose-400 font-bold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
                <span>オフライン減災モード起動中</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI情報詳細表示モーダル */}
      {selectedFullText && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-base font-black text-white mb-2 flex items-center gap-2 border-b border-white/5 pb-2">
              <span>ℹ️</span> {selectedFullText.label} の詳細
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap py-2">
              {selectedFullText.text}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedFullText(null)}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
