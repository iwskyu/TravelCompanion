/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize Gemini API client to prevent crashing if the key is missing on startup
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Route for Gemini Travel Recommendations
app.post("/api/gemini/recommendations", async (req, res) => {
  try {
    const { lat, lon, data } = req.body;
    const ai = getAiClient();

    // Construct a rich, structured prompt with the real-time user status
    const prompt = `
ユーザーは現在旅行中、または移動中です。以下のリアルタイムな周辺環境データおよび位置情報を分析し、旅行者に役立つアドバイスを次の3つの項目（警告・危険、行動指針、周辺スポット・ユーティリティ）に分類して生成してください。

【現在のユーザーの環境データ】
現在地: ${data?.address || "取得中..."} (〒${data?.zipcode || "不明"})
緯度・経度: ${lat || "不明"}, ${lon || "不明"}
現在日時: ${data?.currentDate || ""} ${data?.currentTime || ""}
天気: ${data?.weather ? `${data.weather.temp}℃ (コード: ${data.weather.code})` : "不明"}
降水確率・量: ${data?.precipitation ? `確率 ${data.precipitation.probability}% / 量 ${data.precipitation.amount}mm` : "不明"}
雨雲接近: ${data?.rainCloudApproach || "不明"}
風速・風向き: ${data?.wind ? `${data.wind.direction} ${data.wind.speed}m/s` : "不明"}
大気 (花粉/PM2.5/黄砂): PM2.5: ${data?.pm25 || "不明"}
日の出・日没 / 夕方カウントダウン: ${data?.sunrise ? `日の出: ${data.sunrise.time}` : ""} / ${data?.sunset ? `日没: ${data.sunset.time}` : ""} / ${data?.sunsetCountdown || ""}
月齢: ${data?.moonAge ? `${data.moonAge.state} (月齢: ${data.moonAge.age})` : "不明"}
潮汐・波情報: 満潮/干潮: ${data?.highTide || ""}/${data?.lowTide || ""} / 波: ${data?.waveInfo ? `${data.waveInfo.height}m` : ""}
周囲の騒音: ${data?.dbLevel ? `${data.dbLevel} dB` : "不明"}
移動速度: ${data?.speed ? `${data.speed} m/s` : "0"}
防災・インフラ情報: 地震: ${data?.earthquake || "正常"} / 電力: ${data?.powerUsage ? `${data.powerUsage.company} 使用率 ${data.powerUsage.rate}%` : ""} / 道路交通: ${data?.trafficStatus || "順調"}

【要件】
1. 危険情報（alert）:
   雨、豪雨、風、気温（熱中症/凍結）、地震、交通渋滞、または大気汚染からユーザーを守る警告。
   例: 「⚠ 15分後にゲリラ豪雨。近くの道の駅や1km先のローソンで雨宿り推奨」

2. 行動指針（actionGuide）:
   日没時間、月齢、現在の気温、天気、または時間帯に合わせて今取るべき最適な行動。
   例: 「今夜は満月。日没1時間後の20時に、駐車場が広い犬吠埼灯台での天体観測がおすすめ」

3. スポット・お役立ち（spotInfo）:
   現在地近くのおすすめスポット、道の駅、トイレ、コンビニ、日帰り温泉、食事処などの実用情報。実在する場所があればそれを優先してください（無ければ一般的なおすすめを具体的に）。
   例: 「この先2km右側の『道の駅おおかわ』ではマグロ丼定食(1500円)がボリューム大で超人気！」

【出力形式】
以下のJSONスキーマに従い、読みやすく自然な日本語で生成してください。各項目は流れる文字（マーキー）で表示されるため、1文で簡潔に（できれば50〜80文字以内）まとめてください。
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "あなたは旅行者、ドライバー、または登山者を支える「最強の旅のお供AIコンパニオン」です。提供されたデータをもとに、現実的で超具体的な気象・安全アドバイス、行動提案、周辺施設情報を提供してください。曖昧な表現は避け、距離や方向、具体的な店舗名や施設名を盛り込むようにしてください。検索などを利用して現在地付近のリアルな店舗やおすすめ情報を可能な限り正確に提示してください。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alert: {
              type: Type.STRING,
              description: "危険情報などのアラート情報。例: ⚠ 15分後にゲリラ豪雨。近くの道の駅や1km先のローソンで雨宿り推奨",
            },
            actionGuide: {
              type: Type.STRING,
              description: "今からユーザが取るべき行動指針。例: 今夜は満月。日没1時間後の20時に、駐車場が広い犬吠埼灯台での天体観測がおすすめ",
            },
            spotInfo: {
              type: Type.STRING,
              description: "付近のおすすめスポット、道の駅、トイレ、コンビニ等使える役立つ情報。例: この先2km右側の『道の駅おおかわ』ではマグロ丼定食(1500円)がボリューム大で超人気！",
            },
          },
          required: ["alert", "actionGuide", "spotInfo"],
        },
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Recommendations Error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate recommendations.",
      alert: "⚠️ AI情報の取得に失敗しました。時間をおいて再試行してください。",
      actionGuide: "現在地の気象状況や時間を踏まえて、安全な移動を心がけてください。",
      spotInfo: "周辺のコンビニ、ガソリンスタンド、道の駅の看板に注意して走行してください。",
    });
  }
});

// Configure Vite or serve production build
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
