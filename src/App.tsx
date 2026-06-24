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
  getWeatherEmojiAndName
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
import { RefreshCw, MapPin, Mic, Compass, Play, Pause } from "lucide-react";

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
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const togglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (!nextPaused && started) {
      triggerFullUpdate();
    }
  };

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
    if (!currentCoords.current) return;
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
      // 1. 住所・郵便番号
      if (tileIds.includes("address") || tileIds.includes("zipcode")) {
        // 大きく移動していない、かつ既に有効データがある場合はフェッチを完全にスキップ（バッテリー延命）
        if (moved || !data.address || !data.zipcode) {
          promises.push((async () => {
            const res = await fetchAddressAndZip(lat, lon);
            setData((prev) => ({
              ...prev,
              address: res.address,
              zipcode: res.zipcode,
            }));
            setLastUpdated((prev) => ({
              ...prev,
              address: nowStamp,
              zipcode: nowStamp,
            }));
          })());
        }
      }

      // 2. 天気・気象・気候
      const weatherKeys: TileId[] = ["weather", "precipitation", "rainCloudApproach", "uvIndex", "sunrise", "sunset", "sunriseSunset", "wind", "humidity", "elevation"];
      if (tileIds.some(id => weatherKeys.includes(id))) {
        promises.push((async () => {
          const res = await fetchWeatherAndMeteorology(lat, lon);
          setData((prev) => ({
            ...prev,
            weather: res.weather,
            precipitation: res.precipitation,
            rainCloudApproach: res.rainCloudApproach,
            uvIndex: res.uvIndex,
            // 日の出、日没、標高は「丸一日変わらない/一度出せば十分」なため、すでに値があれば既存のものを優先（上書きしない、再フェッチもしない）
            sunrise: isSameDay && prev.sunrise ? prev.sunrise : res.sunrise,
            sunset: isSameDay && prev.sunset ? prev.sunset : res.sunset,
            elevation: !moved && prev.elevation !== null ? prev.elevation : (latestGps.current.elevation !== null ? latestGps.current.elevation : (res.elevation !== null ? res.elevation : prev.elevation)),
          }));
          setLastUpdated((prev) => {
            const next = { ...prev };
            weatherKeys.forEach(id => {
              if (tileIds.includes(id)) {
                // 日の出・日没は日付が変わったとき、または初回のみ光らせる
                if ((id === "sunrise" || id === "sunset" || id === "sunriseSunset") && isSameDay && prev.sunrise) {
                  return;
                }
                // 標高は大きく動いたとき、または初回のみ光らせる
                if (id === "elevation" && !moved && prev.elevation !== null) {
                  return;
                }
                next[id] = nowStamp;
              }
            });
            return next;
          });
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

      // 4. 海水温
      if (tileIds.includes("seaTemp")) {
        // 大きく移動していない、かつ既にデータがある場合はスキップ
        if (moved || !data.seaTemp) {
          promises.push((async () => {
            const res = await fetchSeaTemperature(lat, lon);
            setData((prev) => ({
              ...prev,
              seaTemp: res,
            }));
            setLastUpdated((prev) => ({
              ...prev,
              seaTemp: nowStamp,
            }));
          })());
        }
      }

      // 5. 周辺POI (Overpass API)
      const poiKeys: TileId[] = [
        "river", "riverLevel", "roadDensity1", "roadDensity2",
        "convenience1", "convenience2", "toilet1", "toilet2", "wifi1", "wifi2",
        "gas1", "gas2", "parking1", "parking2", "roadStation1", "roadStation2",
        "hotel", "guesthouse", "station1", "station2", "bus1", "bus2",
        "gourmet1", "gourmet2", "mountain", "attraction1", "attraction2", "seaDistance", "seaBearing"
      ];
      if (tileIds.some(id => poiKeys.includes(id))) {
        // 大きく移動していない、かつ既にデータがある場合はスキップしてバッテリー・通信量を極限まで削減
        if (moved || !data.river) {
          promises.push((async () => {
            const res = await fetchPOIFromOverpass(lat, lon);
            setData((prev) => ({
              ...prev,
              ...res,
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

    const { lat, lon } = currentCoords.current || { lat: 35.6895, lon: 139.6917 };
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
    };

    const immediateTileIds: TileId[] = [
      "sunPosition",
      "tilt", "bearing", "gpsAccuracy", "speed", "elevation"
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
      } catch (err) {
        console.error("fetchAddressAndZip failed in triggerFullUpdate", err);
      }
    };

    // API 2: 天気・気象・気候 (Open-Meteo)
    // 常に最新データを取得しますが、1日中不変の日の出・日の入り、大きく移動しないと変わらない標高は、
    // すでに有効な値があれば光らせない（lastUpdatedに含めない）ことでチカチカを防止。
    const taskWeather = async () => {
      try {
        const res = await fetchWeatherAndMeteorology(lat, lon);
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          weather: res.weather,
          precipitation: res.precipitation,
          rainCloudApproach: res.rainCloudApproach,
          uvIndex: res.uvIndex,
          sunrise: isSameDay && prev.sunrise ? prev.sunrise : res.sunrise,
          sunset: isSameDay && prev.sunset ? prev.sunset : res.sunset,
          wind: res.wind,
          humidity: res.humidity,
          elevation: !moved && prev.elevation !== null ? prev.elevation : (latestGps.current.elevation !== null ? latestGps.current.elevation : (res.elevation !== null ? res.elevation : prev.elevation)),
        }));
        
        const weatherTileIds: TileId[] = [
          "weather", "precipitation", "rainCloudApproach", "uvIndex", "wind", "humidity"
        ];
        
        if (!isSameDay || !data.sunrise) {
          weatherTileIds.push("sunrise", "sunset", "sunriseSunset");
        }
        if (moved || data.elevation === null) {
          weatherTileIds.push("elevation");
        }

        setLastUpdated((prev) => {
          const next = { ...prev };
          weatherTileIds.forEach((id) => {
            next[id] = stamp;
          });
          return next;
        });
      } catch (err) {
        console.error("fetchWeatherAndMeteorology failed in triggerFullUpdate", err);
      }
    };

    // API 3: 大気・花粉 (Open-Meteo Air Quality)
    const taskAirQuality = async () => {
      try {
        const res = await fetchAirQualityAndPollen(lat, lon);
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          airQuality: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          airQuality: stamp,
        }));
      } catch (err) {
        console.error("fetchAirQualityAndPollen failed in triggerFullUpdate", err);
      }
    };

    // API 4: 海水温 (Open-Meteo Marine)
    // 大きく移動していなければフェッチをスキップ
    const taskSeaTemp = async () => {
      if (!moved && data.seaTemp) {
        console.log("Battery Save: Skip Marine API because position hasn't changed significantly.");
        return;
      }
      try {
        const res = await fetchSeaTemperature(lat, lon);
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          seaTemp: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          seaTemp: stamp,
        }));
      } catch (err) {
        console.error("fetchSeaTemperature failed in triggerFullUpdate", err);
      }
    };

    // API 5: 周辺POI (Overpass API)
    // 大きく移動していなければAPIフェッチを完全にスキップ（超低消費電力・低トラフィック化）
    const taskPOI = async () => {
      if (!moved && data.river) {
        console.log("Battery Save: Skip Overpass API because position hasn't changed significantly.");
        return;
      }
      try {
        const res = await fetchPOIFromOverpass(lat, lon);
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          ...res,
        }));
        
        const poiTileIds: TileId[] = [
          "river", "riverLevel", "roadDensity1", "roadDensity2",
          "convenience1", "convenience2", "toilet1", "toilet2", "wifi1", "wifi2",
          "gas1", "gas2", "parking1", "parking2", "roadStation1", "roadStation2",
          "hotel", "guesthouse", "station1", "station2", "bus1", "bus2",
          "gourmet1", "gourmet2", "mountain", "attraction1", "attraction2"
        ];
        setLastUpdated((prev) => {
          const next = { ...prev };
          poiTileIds.forEach((id) => {
            next[id] = stamp;
          });
          return next;
        });
      } catch (err) {
        console.error("fetchPOIFromOverpass failed in triggerFullUpdate", err);
      }
    };

    // すべてのAPIリクエストを非同期で開始し、届いた順に個別にアップデート
    Promise.allSettled([
      taskAddress(),
      taskWeather(),
      taskAirQuality(),
      taskSeaTemp(),
      taskPOI()
    ]).finally(() => {
      setIsUpdating(false);
      lastUpdatedCoords.current = { lat, lon };
      lastUpdatedDateStr.current = dateStr;
    });
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

    // --- 3秒毎更新 (旧1秒毎) ---
    // 📐傾き, 🧭方角, マイクdBをまとめて3秒毎に1回だけ一括ステート描画（スロットリングして描画負荷・バッテリーを大幅節約）
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
      }));
      setLastUpdated((prev) => ({
        ...prev,
        tilt: nowStamp,
        bearing: nowStamp,
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
    // POI（コンビニ、トイレ、駅、バス、Wi-Fi、GS、駐車場、道の駅、ホテル、グルメ、観光地、川、道路）、日の出・日没、大気汚染、満潮・干潮
    const interval10m = setInterval(() => {
      if (isPausedRef.current) return;
      const list10m: TileId[] = [
        "tokyoDistance", "seaDistance", "fujiDistance", "prefecturalCapital",
        "wind", "humidity", "airQuality", "seaTemp", "highLowTide", "sunPosition",
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
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/25">
            <Compass className="w-5 h-5 text-white animate-[spin_15s_linear_infinite]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-wider flex items-center gap-1.5">
              旅のお供 <span className="text-xs font-normal opacity-70">ver70</span>
            </h1>
            <span className="hidden md:inline-block text-xs text-slate-400 border-l border-white/20 pl-2">
              📍 {data.zipcode ? `〒${data.zipcode} ` : ""}{data.address || "現在地を取得中..."}
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

          {/* 自動更新一時停止/再開ボタン */}
          <button
            onClick={togglePause}
            className={`flex items-center gap-1.5 transition-all font-bold border px-3 py-1.5 rounded-lg text-xs sm:text-sm select-none cursor-pointer ${
              isPaused 
                ? "bg-rose-600/30 border-rose-500 hover:bg-rose-600/50 text-rose-200 animate-pulse" 
                : "bg-emerald-600/20 border-emerald-500/50 hover:bg-emerald-600/30 text-emerald-300"
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>更新再開</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>更新停止</span>
              </>
            )}
          </button>

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
        {/* レスポンシブに必ず1列に4タイル（grid-cols-4）を表示し、隙間は最小限（gap-1） */}
        <div className="grid grid-cols-4 gap-1 w-full">
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
        旅のお供 ver70 © 2026 ・ GPS & マイク連動リアルタイムコンパニオン
      </footer>
    </div>
  );
}
