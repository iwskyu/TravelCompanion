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
  elevation: number | null;

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

  airQuality: { pollenText: string; pm25: number | null } | null;
  seaTemp: number | null;
  highTide: string | null;
  lowTide: string | null;
  moonAge: { age: number; state: string } | null;
  sunPosition: { bearing: number; cardinal: string } | null;

  river: { name: string; distance: number } | null;
  riverLevel: { name: string; level: string; danger: string } | null;

  roadDensity1: { roadName: string; info: string; distance: number } | null;
  roadDensity2: { roadName: string; info: string; distance: number } | null;

  convenience1: { name: string; distance: number; bearing: number } | null;
  convenience2: { name: string; distance: number; bearing: number } | null;
  toilet1: { name: string; distance: number; bearing: number } | null;
  toilet2: { name: string; distance: number; bearing: number } | null;
  wifi1: { name: string; distance: number; bearing: number } | null;
  wifi2: { name: string; distance: number; bearing: number } | null;
  gas1: { name: string; distance: number; bearing: number } | null;
  gas2: { name: string; distance: number; bearing: number } | null;
  parking1: { name: string; distance: number; bearing: number } | null;
  parking2: { name: string; distance: number; bearing: number } | null;
  roadStation1: { name: string; distance: number; bearing: number } | null;
  roadStation2: { name: string; distance: number; bearing: number } | null;
  hotel: { name: string; distance: number } | null;
  guesthouse: { name: string; distance: number } | null;

  station1: { line: string; name: string; distance: number; bearing: number } | null;
  station2: { line: string; name: string; distance: number; bearing: number } | null;
  bus1: { line: string; name: string; distance: number; bearing: number; nextBus: string } | null;
  bus2: { line: string; name: string; distance: number; bearing: number; nextBus: string } | null;

  gourmet1: { name: string; rating: number; distance: number; bearing: number } | null;
  gourmet2: { name: string; rating: number; distance: number; bearing: number } | null;

  zipcode: string | null;
  address: string | null;
  mountain: { name: string; elevation: number; distance: number } | null;
  attraction1: { name: string; distance: number; bearing: number } | null;
  attraction2: { name: string; distance: number; bearing: number } | null;
  intersection: { name: string; distance: number; bearing: number } | null;
}

export type TileId = keyof CompanionData | string;

export interface TileConfig {
  id: TileId;
  label: string;
  emoji: string;
  borderColorClass: string;
  render: (data: CompanionData, deviceHeading: number | null) => string | ReactNode;
}
