/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ALL_TILES_CONFIG } from "./utils/tileConfig";
import { CompanionTile } from "./components/CompanionTile";
import { InitialOverlay } from "./components/InitialOverlay";
import { fetchAllCompanionData, getWeatherEmojiAndName } from "./utils/api";
import { CompanionData, TileId } from "./types";
import { RefreshCw, MapPin, Mic, Compass } from "lucide-react";

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
  river: null,
  riverLevel: null,
  roadDensity1: null,
  roadDensity2: null,
  convenience1: null,
  convenience2: null,
  toilet1: null,
  toilet2: null,
  wifi1: null,
  wifi2: null,
  gas1: null,
  gas2: null,
  parking1: null,
  parking2: null,
  roadStation1: null,
  roadStation2: null,
  hotel: null,
  guesthouse: null,
  station1: null,
  station2: null,
  bus1: null,
  bus2: null,
  gourmet1: null,
  gourmet2: null,
  zipcode: null,
  address: null,
  mountain: null,
  attraction1: null,
  attraction2: null,
};

export default function App() {
  const [started, setStarted] = useState(false);
  const [data, setData] = useState<CompanionData>(INITIAL_COMPANION_DATA);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [dbLevel, setDbLevel] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // タイルごとの最終更新日時（タイムスタンプ）を保持。
  // これを使って各タイルの黄色いフラッシュ演出を制御する。
  const [lastUpdated, setLastUpdated] = useState<Record<TileId, number>>({});

  // リアルタイムセンサー情報保持用のRef（スロットリング更新用）
  const latestTilt = useRef<{ pitch: number; roll: number }>({ pitch: 0, roll: 0 });
  const latestHeading = useRef<number>(0);
  const latestGps = useRef<{ accuracy: number | null; speed: number | null; elevation: number | null }>({
    accuracy: null,
    speed: null,
    elevation: null,
  });

  // 位置情報とAPI用経緯度
  const currentCoords = useRef<{ lat: number; lon: number } | null>(null);

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
      // 緯度経度デフォルト
      currentCoords.current = { lat: 35.6895, lon: 139.6917 };
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
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
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
    if (!currentCoords.current) return;
    const { lat, lon } = currentCoords.current;

    try {
      // APIからすべてのデータをフェッチ（差分APIの統合的なハブ）
      const apiResult = await fetchAllCompanionData(lat, lon);

      setData((prev) => {
        const next = { ...prev };
        const nowStamp = Date.now();
        const nextUpdated = { ...lastUpdated };

        for (const tid of tileIds) {
          // apiResult から該当する値をマッピング。
          // センサー、GPS、及び静的計算は別にアップデートされるため、API側から来た値のみマッピングする。
          if (tid in apiResult) {
            // @ts-ignore
            next[tid] = apiResult[tid];
            nextUpdated[tid] = nowStamp;
          }
        }

        setLastUpdated((prevUpdated) => ({
          ...prevUpdated,
          ...nextUpdated,
        }));
        return next;
      });
    } catch (err) {
      console.error("Failed to update tiles:", tileIds, err);
    }
  };

  // 一括更新。全てのAPIからデータを一挙取得。
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

    const { lat, lon } = currentCoords.current || { lat: 35.6895, lon: 139.6917 };

    try {
      const fullData = await fetchAllCompanionData(lat, lon);
      
      const nowStamp = Date.now();
      const updatedMap: Record<TileId, number> = {};

      // すべてのタイルをピカッと光らせる
      ALL_TILES_CONFIG.forEach((t) => {
        updatedMap[t.id] = nowStamp;
      });

      setData((prev) => ({
        ...prev,
        ...fullData,
        // センサー、GPS、コンパスは現在の瞬時値を反映
        tilt: { ...latestTilt.current },
        bearing: { angle: latestHeading.current, direction: getDirectionString(latestHeading.current) },
        gpsAccuracy: latestGps.current.accuracy,
        speed: latestGps.current.speed,
        elevation: fullData.elevation !== null ? fullData.elevation : latestGps.current.elevation,
      }));

      setLastUpdated(updatedMap);
    } catch (e) {
      console.error("Full update error", e);
    } finally {
      setIsUpdating(false);
    }
  };

  // 方角を16方位の日本語に
  const getDirectionString = (bearing: number): string => {
    const directions = [
      "北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東",
      "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  };

  // 3. 自動タイマーの設定とセンサー監視
  useEffect(() => {
    if (!started) return;

    // --- GPS監視開始 ---
    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          latestGps.current = {
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            elevation: position.coords.altitude,
          };
          currentCoords.current = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
        },
        (err) => {
          console.warn("watchPosition error", err);
        },
        { enableHighAccuracy: true }
      );
    }

    // --- デバイス傾きとコンパスのトラッキング（Ref更新のみで再描画は起こさない） ---
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const pitch = e.beta !== null ? Math.round(e.beta) : 0;
      const roll = e.gamma !== null ? Math.round(e.gamma) : 0;
      latestTilt.current = { pitch, roll };

      // @ts-ignore
      let heading = e.webkitCompassHeading;
      if (heading === undefined || heading === null) {
        heading = e.alpha !== null ? 360 - e.alpha : 0;
      }
      latestHeading.current = Math.round(heading);
    };
    window.addEventListener("deviceorientation", handleOrientation, true);

    // --- 1秒毎更新 ---
    // 📐傾き, 🧭方角, マイクdBをまとめて1秒毎に1回だけ一括ステート描画（スロットリング）
    const interval1s = setInterval(() => {
      const nowStamp = Date.now();
      const heading = latestHeading.current;
      
      setDeviceHeading(heading);
      setDbLevel(latestDb.current);

      setData((prev) => ({
        ...prev,
        tilt: { ...latestTilt.current },
        bearing: { angle: heading, direction: getDirectionString(heading) },
      }));
      setLastUpdated((prev) => ({
        ...prev,
        tilt: nowStamp,
        bearing: nowStamp,
      }));
    }, 1000);

    // --- 5秒毎更新 ---
    // 📡GPS精度, 🚗移動速度, ⛰️標高
    const interval5s = setInterval(() => {
      const nowStamp = Date.now();
      setData((prev) => ({
        ...prev,
        gpsAccuracy: latestGps.current.accuracy,
        speed: latestGps.current.speed,
        elevation: prev.elevation !== null ? prev.elevation : latestGps.current.elevation,
      }));
      setLastUpdated((prev) => ({
        ...prev,
        gpsAccuracy: nowStamp,
        speed: nowStamp,
        elevation: nowStamp,
      }));
    }, 5000);

    // --- 3分毎更新 ---
    // 📮郵便番号, 🗺️現在地
    const interval3m = setInterval(() => {
      updateTileData(["zipcode", "address"]);
    }, 3 * 60 * 1000);

    // --- 10分毎更新 ---
    // POI（コンビニ、トイレ、駅、バス、Wi-Fi、GS、駐車場、道の駅、ホテル、グルメ、観光地、川、道路）、日の出・日没、大気汚染
    const interval10m = setInterval(() => {
      const list10m: TileId[] = [
        "tokyoDistance", "seaDistance", "fujiDistance", "prefecturalCapital",
        "wind", "humidity", "airQuality", "seaTemp", "highTide", "lowTide", "sunPosition",
        "river", "riverLevel", "roadDensity1", "roadDensity2",
        "convenience1", "convenience2", "toilet1", "toilet2", "wifi1", "wifi2",
        "gas1", "gas2", "parking1", "parking2", "roadStation1", "roadStation2",
        "hotel", "guesthouse", "station1", "station2", "bus1", "bus2",
        "gourmet1", "gourmet2", "mountain", "attraction1", "attraction2"
      ];
      updateTileData(list10m);
    }, 10 * 60 * 1000);

    // --- 15分毎更新 ---
    // 天気、降水、雨雲、紫外線
    const interval15m = setInterval(() => {
      updateTileData(["weather", "precipitation", "rainCloudApproach", "uvIndex"]);
    }, 15 * 60 * 1000);

    // --- 20分毎更新 ---
    // 日の出、日没
    const interval20m = setInterval(() => {
      updateTileData(["sunrise", "sunset"]);
    }, 20 * 60 * 1000);

    // --- 60分毎更新 ---
    // 月齢
    const interval60m = setInterval(() => {
      updateTileData(["moonAge"]);
    }, 60 * 60 * 1000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.removeEventListener("deviceorientation", handleOrientation, true);
      clearInterval(interval1s);
      clearInterval(interval5s);
      clearInterval(interval3m);
      clearInterval(interval10m);
      clearInterval(interval15m);
      clearInterval(interval20m);
      clearInterval(interval60m);
    };
  }, [started]);

  if (!started) {
    return <InitialOverlay onStart={handleStart} />;
  }

  // 天気のおすすめ絵文字
  const weatherEmoji = data.weather ? getWeatherEmojiAndName(data.weather.code).emoji : "🧭";

  return (
    <div className="min-h-screen animate-travel-bg text-white font-sans flex flex-col overflow-x-hidden">
      {/* ヘッダーエリア */}
      <header className="w-full h-[60px] bg-black/20 border-b border-white/20 sticky top-0 z-40 px-5 flex items-center justify-between shadow-lg shrink-0">
        {/* ロゴと現在地の概要 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-base shadow-md">
            {weatherEmoji}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-wider flex items-center gap-1.5">
              旅のお供 <span className="text-xs font-normal opacity-70">ver66</span>
            </h1>
            <span className="hidden md:inline-block text-xs text-slate-400 border-l border-white/20 pl-2 max-w-[200px] truncate">
              📍 {data.address || "現在地を取得中..."}
            </span>
          </div>
        </div>

        {/* 環境音＆一括更新エリア */}
        <div className="flex items-center gap-4">
          {/* 環境音メーター (マイクの実用) */}
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-[11px]">
            <Mic className={`w-3.5 h-3.5 text-rose-500 ${dbLevel > 40 ? "animate-pulse" : ""}`} />
            <span className="text-slate-300 font-mono">
              {dbLevel}dB ({getNoiseLabel(dbLevel)})
            </span>
          </div>

          {/* 強制一括更新ボタン */}
          <button
            onClick={triggerFullUpdate}
            disabled={isUpdating}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 active:scale-95 disabled:opacity-50 transition-all font-bold border-2 border-white px-5 py-1.5 rounded-lg text-sm sm:text-base text-white shrink-0 select-none cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
            <span>一括更新</span>
          </button>
        </div>
      </header>

      {/* メインタイグリッド */}
      <main className="flex-grow w-full px-1 py-1 flex flex-col justify-start">
        {/* レスポンシブに必ず1列に3タイル（grid-cols-3）を表示し、隙間は最小限（gap-1） */}
        <div className="grid grid-cols-3 gap-1 w-full">
          {ALL_TILES_CONFIG.map((config) => (
            <CompanionTile
              key={config.id}
              config={config}
              data={data}
              deviceHeading={deviceHeading}
              lastUpdatedTime={lastUpdated[config.id] || 0}
            />
          ))}
        </div>
      </main>

      {/* フッター */}
      <footer className="w-full bg-black/40 border-t border-white/5 py-3 text-center text-[10px] text-slate-500 select-none">
        旅のお供 ver66 © 2026 ・ GPS & マイク連動リアルタイムコンパニオン
      </footer>
    </div>
  );
}
