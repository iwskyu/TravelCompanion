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
  fetchGSIElevation,
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
  intersection: null,
  dbLevel: null,
  currentDate: null,
  currentTime: null,
  pm25: null,
  waveInfo: null,
  gsiElevation: null,
  magicHour: null,
  earthquake: null,
  magneticDeclination: null,
  powerUsage: null,
  trafficStatus: null,
};

export default function App() {
  const [started, setStarted] = useState(false);
  const [data, setData] = useState<CompanionData>(INITIAL_COMPANION_DATA);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [dbLevel, setDbLevel] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const isPausedRef = useRef<boolean>(false);

  const mainRef = useRef<HTMLElement | null>(null);

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

      // 2. 天気・気象・気候 (マジックアワー、地理院標高も連動)
      const weatherKeys: TileId[] = ["weather", "precipitation", "rainCloudApproach", "uvIndex", "sunrise", "sunset", "sunriseSunset", "wind", "humidity", "elevation", "gsiElevation", "magicHour"];
      if (tileIds.some(id => weatherKeys.includes(id))) {
        promises.push((async () => {
          const [res, gsiElev] = await Promise.all([
            fetchWeatherAndMeteorology(lat, lon),
            fetchGSIElevation(lat, lon)
          ]);

          const finalSunrise = isSameDay && data.sunrise ? data.sunrise : res.sunrise;
          const finalSunset = isSameDay && data.sunset ? data.sunset : res.sunset;
          const magicHourVal = calculateMagicHour(finalSunrise?.time || "-", finalSunset?.time || "-");

          let finalElevation = res.elevation;
          const gpsAlt = latestGps.current.elevation;
          if (gpsAlt !== null && res.elevation !== null) {
            finalElevation = Math.round((gpsAlt + res.elevation) / 2);
          }

          setData((prev) => ({
            ...prev,
            weather: res.weather,
            precipitation: res.precipitation,
            rainCloudApproach: res.rainCloudApproach,
            uvIndex: res.uvIndex,
            sunrise: finalSunrise,
            sunset: finalSunset,
            elevation: !moved && prev.elevation !== null ? prev.elevation : (finalElevation !== null ? finalElevation : prev.elevation),
            gsiElevation: gsiElev !== null ? gsiElev : (prev.gsiElevation !== null ? prev.gsiElevation : finalElevation),
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

      // 2.7. 磁気偏角
      if (tileIds.includes("magneticDeclination")) {
        promises.push((async () => {
          const res = calculateMagneticDeclination(lat, lon);
          setData((prev) => ({
            ...prev,
            magneticDeclination: res,
          }));
          setLastUpdated((prev) => ({
            ...prev,
            magneticDeclination: nowStamp,
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

      // 5. 周辺POI (Overpass API)
      const poiKeys: TileId[] = [
        "river", "riverLevel", "roadDensity1", "roadDensity2", "trafficStatus",
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
            const speedKmh = latestGps.current.speed !== null ? Math.round(latestGps.current.speed * 3.6) : 0;
            const traffic = calculateTrafficStatus(lat, lon, speedKmh);
            setData((prev) => ({
              ...prev,
              ...res,
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

    // API 2: 天気・気象・気候 (Open-Meteo & 国土地理院 & マジックアワー)
    const taskWeather = async () => {
      try {
        const [res, gsiElev] = await Promise.all([
          fetchWeatherAndMeteorology(lat, lon),
          fetchGSIElevation(lat, lon)
        ]);
        const stamp = Date.now();

        const finalSunrise = isSameDay && data.sunrise ? data.sunrise : res.sunrise;
        const finalSunset = isSameDay && data.sunset ? data.sunset : res.sunset;
        const magicHourVal = calculateMagicHour(finalSunrise?.time || "-", finalSunset?.time || "-");

        let finalElevation = res.elevation;
        const gpsAlt = latestGps.current.elevation;
        if (gpsAlt !== null && res.elevation !== null) {
          finalElevation = Math.round((gpsAlt + res.elevation) / 2);
        }

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
          elevation: !moved && prev.elevation !== null ? prev.elevation : (finalElevation !== null ? finalElevation : prev.elevation),
          gsiElevation: gsiElev !== null ? gsiElev : (prev.gsiElevation !== null ? prev.gsiElevation : finalElevation),
          magicHour: magicHourVal,
        }));
        
        const weatherTileIds: TileId[] = [
          "weather", "precipitation", "rainCloudApproach", "uvIndex", "wind", "humidity", "magicHour"
        ];
        
        if (!isSameDay || !data.sunrise) {
          weatherTileIds.push("sunrise", "sunset", "sunriseSunset");
        }
        if (moved || data.elevation === null) {
          weatherTileIds.push("elevation", "gsiElevation");
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

    // API 4: 海水温・波情報 (Open-Meteo Marine)
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
          seaTemp: res.seaTemp,
          waveInfo: res.waveInfo,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          seaTemp: stamp,
          waveInfo: stamp,
        }));
      } catch (err) {
        console.error("fetchSeaTemperature failed in triggerFullUpdate", err);
      }
    };

    // API 5: 周辺POI (Overpass API & 道路交通状況)
    const taskPOI = async () => {
      if (!moved && data.river) {
        console.log("Battery Save: Skip Overpass API because position hasn't changed significantly.");
        return;
      }
      try {
        const res = await fetchPOIFromOverpass(lat, lon);
        const stamp = Date.now();
        const speedKmh = latestGps.current.speed !== null ? Math.round(latestGps.current.speed * 3.6) : 0;
        const traffic = calculateTrafficStatus(lat, lon, speedKmh);
        
        setData((prev) => ({
          ...prev,
          ...res,
          trafficStatus: traffic,
        }));
        
        const poiTileIds: TileId[] = [
          "river", "riverLevel", "roadDensity1", "roadDensity2", "trafficStatus",
          "convenience1", "convenience2", "toilet1", "toilet2", "wifi1", "wifi2",
          "gas1", "gas2", "parking1", "parking2", "roadStation1", "roadStation2",
          "hotel", "guesthouse", "station1", "station2", "bus1", "bus2",
          "gourmet1", "gourmet2", "mountain", "attraction1", "attraction2", "intersection"
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

    // API 6: 直近の地震・防災情報 (P2Pquake)
    const taskEarthquake = async () => {
      try {
        const res = await fetchEarthquakeInfo();
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          earthquake: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          earthquake: stamp,
        }));
      } catch (err) {
        console.error("fetchEarthquakeInfo failed in triggerFullUpdate", err);
      }
    };

    // API 7: 電力使用状況
    const taskPowerUsage = async () => {
      try {
        const res = calculatePowerUsage(lat, lon);
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          powerUsage: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          powerUsage: stamp,
        }));
      } catch (err) {
        console.error("calculatePowerUsage failed in triggerFullUpdate", err);
      }
    };

    // API 8: 磁気偏角
    const taskMagneticDeclination = async () => {
      try {
        const res = calculateMagneticDeclination(lat, lon);
        const stamp = Date.now();
        setData((prev) => ({
          ...prev,
          magneticDeclination: res,
        }));
        setLastUpdated((prev) => ({
          ...prev,
          magneticDeclination: stamp,
        }));
      } catch (err) {
        console.error("calculateMagneticDeclination failed in triggerFullUpdate", err);
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
      taskPowerUsage(),
      taskMagneticDeclination()
    ]).finally(() => {
      setIsUpdating(false);
      lastUpdatedCoords.current = { lat, lon };
      lastUpdatedDateStr.current = dateStr;
    });
  };

  // 特定のパネルをタップ/クリックしたときにそのパネルだけを即時更新する関数
  const handleTileClick = async (tileId: TileId) => {
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

    const { lat, lon } = currentCoords.current || { lat: 35.6895, lon: 139.6917 };

    // どのデータを更新するかキーによって分類してフェッチ
    const weatherKeys = ["weather", "precipitation", "rainCloudApproach", "uvIndex", "wind", "humidity", "elevation", "gsiElevation", "magicHour"];
    const poiKeys = [
      "river", "riverLevel", "roadDensity1", "roadDensity2", "trafficStatus",
      "convenience1", "convenience2", "toilet1", "toilet2", "wifi1", "wifi2",
      "gas1", "gas2", "parking1", "parking2", "roadStation1", "roadStation2",
      "hotel", "guesthouse", "station1", "station2", "bus1", "bus2",
      "gourmet1", "gourmet2", "mountain", "attraction1", "attraction2", "intersection"
    ];

    if (tileId === "address" || tileId === "zipcode") {
      try {
        const res = await fetchAddressAndZip(lat, lon);
        setData((prev) => ({ ...prev, address: res.address, zipcode: res.zipcode }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => ({ ...prev, address: updatedStamp, zipcode: updatedStamp }));
      } catch (e) {
        console.error("Single tile update Nominatim error:", e);
      }
    } else if (weatherKeys.includes(tileId)) {
      try {
        const [res, gsiElev] = await Promise.all([
          fetchWeatherAndMeteorology(lat, lon),
          fetchGSIElevation(lat, lon)
        ]);

        const magicHourVal = calculateMagicHour(res.sunrise?.time || "-", res.sunset?.time || "-");
        
        let finalElevation = res.elevation;
        const gpsAlt = latestGps.current.elevation;
        if (gpsAlt !== null && res.elevation !== null) {
          finalElevation = Math.round((gpsAlt + res.elevation) / 2);
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
          gsiElevation: gsiElev !== null ? gsiElev : (prev.gsiElevation !== null ? prev.gsiElevation : finalElevation),
          magicHour: magicHourVal,
        }));
        const updatedStamp = Date.now();
        setLastUpdated((prev) => {
          const next = { ...prev };
          weatherKeys.forEach(k => { next[k] = updatedStamp; });
          return next;
        });
      } catch (e) {
        console.error("Single tile update Weather error:", e);
      }
    } else if (tileId === "airQuality") {
      try {
        const res = await fetchAirQualityAndPollen(lat, lon);
        setData((prev) => ({ ...prev, airQuality: res }));
        setLastUpdated((prev) => ({ ...prev, airQuality: Date.now() }));
      } catch (e) {
        console.error("Single tile update AirQuality error:", e);
      }
    } else if (tileId === "seaTemp") {
      try {
        const res = await fetchSeaTemperature(lat, lon);
        setData((prev) => ({ ...prev, seaTemp: res }));
        setLastUpdated((prev) => ({ ...prev, seaTemp: Date.now() }));
      } catch (e) {
        console.error("Single tile update SeaTemp error:", e);
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
      } catch (e) {
        console.error("Single tile update POI error:", e);
      }
    } else if (tileId === "earthquake") {
      try {
        const res = await fetchEarthquakeInfo();
        setData((prev) => ({ ...prev, earthquake: res }));
        setLastUpdated((prev) => ({ ...prev, earthquake: Date.now() }));
      } catch (e) {
        console.error("Single tile update Earthquake error:", e);
      }
    } else if (tileId === "powerUsage") {
      try {
        const res = calculatePowerUsage(lat, lon);
        setData((prev) => ({ ...prev, powerUsage: res }));
        setLastUpdated((prev) => ({ ...prev, powerUsage: Date.now() }));
      } catch (e) {
        console.error("Single tile update PowerUsage error:", e);
      }
    } else if (tileId === "magneticDeclination") {
      try {
        const res = calculateMagneticDeclination(lat, lon);
        setData((prev) => ({ ...prev, magneticDeclination: res }));
        setLastUpdated((prev) => ({ ...prev, magneticDeclination: Date.now() }));
      } catch (e) {
        console.error("Single tile update MagneticDeclination error:", e);
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
        dbLevel: latestDb.current,
      }));
      setLastUpdated((prev) => ({
        ...prev,
        tilt: nowStamp,
        bearing: nowStamp,
        dbLevel: nowStamp,
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
        "gourmet1", "gourmet2", "mountain", "attraction1", "attraction2", "intersection"
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

  const addressBgClass = isAddressFlashing
    ? "bg-yellow-400 text-slate-950 border-yellow-300"
    : "bg-slate-950/85 text-white border-white/10";

  return (
    <div className="min-h-screen animate-travel-bg text-white font-sans flex flex-col overflow-x-hidden">
      {/* ヘッダーエリア */}
      <header className="w-full h-[46px] bg-black/20 border-b border-white/20 relative z-40 px-5 flex items-center justify-between shadow-lg shrink-0">
        {/* ロゴと現在地の概要 */}
        <div className="flex items-center gap-2.5">
          <div className="w-6.5 h-6.5 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-md flex items-center justify-center shadow-md shadow-blue-500/25">
            <Compass className="w-4 h-4 text-white animate-[spin_15s_linear_infinite]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-white tracking-wider flex items-center gap-1 whitespace-nowrap">
              旅のお供 <span className="text-[10px] font-normal opacity-70">ver77</span>
            </h1>
          </div>
        </div>

        {/* 一括更新エリア */}
        <div className="flex items-center gap-2">
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

      {/* 住所表示パネル (スクロール時画面最上部固定、更新時は黄色く光るフラッシュ演出) */}
      <div
        ref={mainRef}
        className={`sticky top-0 z-30 w-full px-4 py-2 flex items-center justify-between gap-1.5 text-xs border-b backdrop-blur-md transition-colors duration-300 ${addressBgClass}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={isAddressFlashing ? "text-slate-950" : "text-sky-400"}>📍</span>
          <span className={`truncate font-bold tracking-wide text-sm ${isAddressFlashing ? "text-slate-950" : "text-slate-200"}`}>
            {data.zipcode ? `〒${data.zipcode} ` : ""}{data.address || "現在地を取得中..."}
          </span>
        </div>
      </div>

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
              onClick={() => handleTileClick(config.id)}
            />
          ))}
        </div>
      </main>

      {/* フッター */}
      <footer className="w-full bg-black/40 border-t border-white/5 py-3 text-center text-[10px] text-slate-500 select-none">
        旅のお供 ver77 © 2026 ・ GPS & マイク連動リアルタイムコンパニオン
      </footer>
    </div>
  );
}
