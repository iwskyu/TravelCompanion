/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from "react";

export interface CompanionData {
  tilt: { pitch: number; roll: number } | null;
  bearing: { angle: number; direction: string } | null;
  gpsAccuracy: number | null;
  speed: number | null;

  tokyoDistance: number | null;
  tokyoBearing: number | null;
  seaDistance: number | null;
  seaBearing: number | null;
  fujiDistance: number | null;
  fujiBearing: number | null;
  prefecturalCapital: { name: string; distance: number; bearing: number } | null;

  weather: { code: number; temp: number; minTemp?: number | null; maxTemp?: number | null } | null;
  precipitation: { probability: number | null; amount: number | null } | null;
  rainCloudApproach: string | null;
  uvIndex: { index: number; level: string } | null;
  sunrise: { time: string; bearing: number | null } | null;
  sunset: { time: string; bearing: number | null } | null;
  wind: { speed: number; bearing: number; direction: string } | null;
  humidity: number | null;

  airQuality: { pollenText: string; pm25: number | null; kosaText: string } | null;
  seaTemp: number | null;
  highTide: string | null;
  lowTide: string | null;
  moonAge: { age: number; state: string } | null;
  sunPosition: { bearing: number; cardinal: string } | null;

  zipcode: string | null;
  address: string | null;
  dbLevel: number | null;

  currentDate?: string | null;
  currentTime?: string | null;
  pm25?: number | null;
  waveInfo?: { height: number; period: number; direction: string } | null;

  gsiElevation?: number | null;
  elevation?: number | null;
  magicHour?: string | null;
  earthquake?: string | null;
  powerUsage?: { company: string; rate: number; usage: number; capacity: number } | null;
  trafficStatus?: string | null;

  // 新機能: アプリ起動時からの累計移動距離 (m)
  accumulatedDistance?: number | null;
}

export type TileId = keyof CompanionData | string;

export type TileCategory = "weather" | "driving" | "climbing" | "sea" | "disaster" | "system";

export interface TileConfig {
  id: TileId;
  label: string;
  emoji: string;
  borderColorClass: string;
  render: (data: CompanionData, deviceHeading: number | null) => string | ReactNode;
  categories: TileCategory[];
}
