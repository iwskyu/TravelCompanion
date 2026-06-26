/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Mic, Compass } from "lucide-react";

interface InitialOverlayProps {
  onStart: (coords: { lat: number; lon: number } | null, audioStream: MediaStream | null) => void;
}

async function fetchIpCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { lat: data.latitude, lon: data.longitude };
      }
    }
  } catch (e) {
    console.warn("Failed to fetch from ipapi.co", e);
  }
  try {
    const res = await fetch("https://freeipapi.com/api/json");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { lat: data.latitude, lon: data.longitude };
      }
    }
  } catch (e) {
    console.warn("Failed to fetch from freeipapi.com", e);
  }
  return null;
}

export function InitialOverlay({ onStart }: InitialOverlayProps) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    let coords: { lat: number; lon: number } | null = null;
    let audioStream: MediaStream | null = null;

    // 1. iOSのデバイスオリエンテーション権限要求 (ユーザー操作時のみ可能)
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      // @ts-ignore
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        // @ts-ignore
        await DeviceOrientationEvent.requestPermission();
      } catch (err) {
        console.warn("DeviceOrientation permission denied or failed", err);
      }
    }

    // 2. マイク権限の取得
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn("Microphone permission denied or failed", err);
    }

    // 3. 位置情報の取得（初回のクイック取得。タイムアウトを短めにして即座にメインへ遷移させる）
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 0,
        });
      });
      coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
    } catch (err) {
      console.warn("Geolocation denied or timed out, trying IP-based fallback...", err);
      coords = await fetchIpCoords();
    }

    // 即座にオーバーレイを消してメイン画面に遷移
    onStart(coords, audioStream);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/90 text-white overflow-hidden">
      {/* 背景の光り輝くグラデーションサークル */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl animate-pulse" />

      <div className="relative max-w-md w-full flex flex-col items-center text-center space-y-10">
        {/* ロゴ・タイトル */}
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-20 h-20 bg-gradient-to-tr from-slate-900 to-slate-950 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10 mx-auto border border-slate-800"
          >
            <Compass className="w-12 h-12 text-sky-400 animate-[spin_30s_linear_infinite]" />
          </motion.div>
          
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl sm:text-4xl font-extrabold tracking-wider text-white"
          >
            旅のお供
          </motion.h1>
          <p className="text-sm text-slate-400">
            あなたの旅路を厳選されたリアルタイム情報で網羅・サポート
          </p>
        </div>

        {/* スタートボタンと注記 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full flex flex-col items-center space-y-6"
        >
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-auto px-12 py-6 rounded-[100px] font-black text-xl sm:text-2xl text-white bg-[#3b82f6] hover:bg-[#2563eb] active:scale-95 transition-all shadow-[0_0_30px_rgba(59,130,246,0.5)] cursor-pointer select-none disabled:opacity-50"
          >
            {loading ? "起動中..." : "旅を開始する"}
          </button>
          
          <div className="text-xs sm:text-sm text-slate-400 max-w-xs leading-normal opacity-70">
            ※GPS位置情報とマイクを使用して情報を表示します。
          </div>
        </motion.div>
      </div>
    </div>
  );
}
