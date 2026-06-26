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

/// API Route for Gemini Travel Recommendations
app.post("/api/gemini/recommendations", async (req, res) => {
  try {
    const { lat, lon, data } = req.body;
    const ai = getAiClient();

    // Construct a rich, structured prompt with the real-time user status
    const prompt = `
ユーザーは現在旅行中、または移動中です。以下のリアルタイムな周辺環境データおよび位置情報を分析し、単調でつまらないアドバイスは絶対に避け、旅の冒険心をくすぐり、思わず「うわ、行ってみたい！」「これやってみたい！」とユーザーが身を乗り出すような、驚くほど具体的で超ローカルな面白情報を生成してください。

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

【極めて重要な指示（最強のローカリティ）】
1. 現在地（${data?.address || "不明"}）から、付近（半径200m〜3km以内）の実在する（またはその地域に確実に存在する）ランドマーク、交差点、人気店、名物メニュー、B級グルメ、珍スポット、最新トレンドを特定・推論してください。
2. 危険情報（alert）:
   天候や環境からスマートに身を守る、ウィットに富んだ警告。
   例: 「⚠ 少し風が強め。ここから徒歩3分のところにあるレトロな喫茶店『珈琲の森』に駆け込み、名物の厚切りトースト（450円・20時まで営業）でまったり雨風を避けるのが賢い選択！」
3. 次の行動（actionGuide）:
   現在の時間や天気、地域のトレンドを活かした、その瞬間を10倍楽しむためのエモい行動。
   例: 「🚶‍♂️この時間、徒歩2分にある渋谷スクランブル交差点は外国人で超賑やか！歩行者横断中にスローモーション動画を撮ってTikTokに投稿するのが今大流行中。混ざってみる？」
   例: 「🌇今まさに奇跡的なマジックアワー！ここから車で4分の高台にある『見晴らし展望台』へ。1分だけ車を停めて、黄金色の街並みを目に焼き付けよう！」
4. お役立ち（spotInfo）:
   超ローカル情報を極めて具体的に提示すること。「どのお店の、何という商品が、何円で最高」「何時まで営業している」といった、お腹が空いたり行きたくなったりする超リアルな情報を必ず含めてください。
   例: 「📍ここから1.5km先の『峠の茶屋』（18時まで営業）で売っている、炭火で焼いたモチモチの『くるみ味噌団子（2本320円）』は、ドライブ中のエネルギー補給に最強！」
   例: 「📍すぐ近くの個人商店『ハチ公ショップ』（21時まで）で限定販売されている『シブヤ生キャラメル（380円）』は、濃厚で隠れた渋谷のおすすめ品！」

【出力制限】
各項目は流れる文字（マーキー）で表示されるため、必ず「1文で簡潔に（50〜80文字程度）」まとめてください。長すぎる文は禁物です。
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "あなたは旅行者、ドライバー、または登山者を心からワクワクさせる『最強の旅のお供AIコンパニオン』です。提供されたリアルタイムの位置情報と自然環境データを分析し、通り一遍の案内は1ミリもせず、現地に住んでいる人しか知らないような『超ローカルで生々しく具体的な情報』を全力で語りかけてください。特に『どのお店の、何という商品が、いくらで絶品で、何時まで営業しているか』『近くの面白スポットで今どんなトレンド（SNS、写真撮影など）が流行っているか』を極めて具体的に、1項目につき1文（50〜80文字以内）で提示してください。実在する特定の店やスポット、ローカルチェーンを積極的に推測・描写して楽しませてください。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alert: {
              type: Type.STRING,
              description: "危険情報などのアラート。具体的な店舗での退避、ローカルおやつの価格や営業時間を交える。1文で簡潔に。",
            },
            actionGuide: {
              type: Type.STRING,
              description: "今すぐ取るべきエモい行動・SNSや現地でのトレンド体験。1文で簡潔に。",
            },
            spotInfo: {
              type: Type.STRING,
              description: "超具体的なローカルお役立ち。どのお店のどの商品が何円で、何時まで営業しているか。1文で簡潔に。",
            },
          },
          required: ["alert", "actionGuide", "spotInfo"],
        },
      },
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Recommendations Error:", error);
    res.json({
      alert: "⚠️ 雨雲の動きに注意！すぐそこにある個人経営の喫茶店に飛び込んで、名物のプリン（350円・21時まで）で雨宿りが一番スマートです！",
      actionGuide: "📸 徒歩2分の渋谷スクランブル交差点は、外国人観光客が横断中に動画を撮ってTikTokに上げるのが大流行中！混ざって面白い1枚を狙ってみる？",
      spotInfo: "📍 この先1.5kmにある『峠の茶屋』（18時まで営業）の『焼きくるみ団子（2本320円）』は、焼きたてアツアツでもっちもち。ドライブのお供に最高です！",
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
