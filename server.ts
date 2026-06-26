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

//// API Route for Gemini Travel Recommendations
app.post("/api/gemini/recommendations", async (req, res) => {
  try {
    const { lat, lon, data, category } = req.body;

    // APIキーの存在チェック。未設定の場合はダミーデータではなく、ユーザーへの分かりやすい設定指示を返す
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return res.json({
        alert: "⚠️ 【設定エラー】画面右上の「Settings > Secrets」から「GEMINI_API_KEY」を設定してください！",
        actionGuide: "AI情報機能を使用するには、Gemini APIキーの追加登録が必要です。",
        spotInfo: "登録完了後、あなたの現在地に連動した「どのお店で何がいくらで買えるか」といった超限定情報が動き出します。"
      });
    }

    const ai = getAiClient();

    // カテゴリに応じた優先テーマ指示を動的に生成
    let categoryPriorityInstruction = "";
    if (category) {
      switch (category) {
        case "driving":
          categoryPriorityInstruction = "【最優先テーマ：運転・ドライブ】現在地付近から車で行きやすい「道の駅」「駐車場」「ローカルガソリンスタンド」「道路渋滞・抜け道状況」「おすすめドライブインやおやつ店（店名・価格・営業時間）」に特化した情報。";
          break;
        case "climbing":
          categoryPriorityInstruction = "【最優先テーマ：登山・山登り】現在地周辺の「登山道」「トレッキングコース」「山小屋」「避難小屋」「標高変化に伴う防寒・安全対策」「登山者向け名物行動食」に特化した情報。";
          break;
        case "sea":
          categoryPriorityInstruction = "【最優先テーマ：海・ビーチ】周辺の「ビーチ」「漁港」「具体的な釣りのポイント」「潮汐や波の注意点」「獲れたて魚介を提供する食堂（店名・名物・価格・営業時間）」に特化した情報。";
          break;
        case "weather":
          categoryPriorityInstruction = "【最優先テーマ：天候・気象】現在の天気、降水、風、紫外線、マジックアワーを活かしたアドバイス。雨なら駆け込める屋内施設、晴れなら絶景夕日・星空スポットの店や場所。";
          break;
        case "disaster":
          categoryPriorityInstruction = "【最優先テーマ：防災・安全】現在地から最寄りの具体的な「指定避難所」「ハザード（河川氾濫、土砂災害等）の危険度」「最寄りの非常用電源・コンビニ」など安全確保を最優先にした命を守る情報。";
          break;
        default:
          categoryPriorityInstruction = "【最優先テーマ：全般】現在地周辺の実在する面白いスポット、ローカル名物（店名、おやつの価格、営業時間）を具体的かつ簡潔に。";
          break;
      }
    }

    const prompt = `
以下の周辺環境データと【最優先テーマ】に基づき、旅行者のための超ローカル情報を日本語かつ極限まで簡潔に生成してください。

【最優先テーマ】
${categoryPriorityInstruction}

【現在の環境データ】
現在地: ${data?.address || "取得中..."} (〒${data?.zipcode || "不明"})
緯度経度: ${lat || "不明"}, ${lon || "不明"}
日時: ${data?.currentDate || ""} ${data?.currentTime || ""}
天気・雨雲: ${data?.weather ? `${data.weather.temp}℃` : "不明"} / ${data?.rainCloudApproach || "正常"}
風・湿度・大気: 風 ${data?.wind?.speed || "0"}m/s / PM2.5 ${data?.pm25 || "正常"}
日の出・日没・マジックアワー: ${data?.sunrise ? `出 ${data.sunrise.time}` : ""} / ${data?.sunset ? `没 ${data.sunset.time}` : ""} / マジックアワー ${data?.magicHour || ""}
潮汐・波: 満/干: ${data?.highTide || ""}/${data?.lowTide || ""} / 波: ${data?.waveInfo ? `${data.waveInfo.height}m` : ""}
騒音・防災・交通: 騒音 ${data?.dbLevel || "0"}dB / 地震: ${data?.earthquake || "正常"} / 電力: ${data?.powerUsage?.rate || "0"}% / 道路: ${data?.trafficStatus || "順調"}

【出力条件（爆速化のため絶対に厳守）】
- 各項目は、日本語で「完全に1文のみ」、かつ「45〜65文字以内」にまとめてください。
- 余計な枕詞、挨拶、まとめ文は一切含めないでください。
- 実在する具体的な店舗名や、おやつの具体的な金額（例：○○カフェのクッキー250円）を1つ必ず含めてください。
`;

    // 爆速モデル gemini-2.5-flash を最優先で使用し、さらに速度向上のため温度とトークン数を最適化
    const modelsToTry = ["gemini-2.5-flash", "gemini-3.5-flash"];
    let response = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction: "あなたは爆速でお供情報を返すAIです。余計な説明や挨拶は完全に排除し、指定されたスキーマに従って日本語の1文（45〜65文字）で回答してください。実在する特定の店舗名、商品名、および価格（例：○○カフェのクッキー250円）を必ず1つ含めてください。",
            responseMimeType: "application/json",
            temperature: 0.1, // 決定論的な出力を高めて思考速度を極限まで引き上げる
            maxOutputTokens: 250, // 通信とトークン生成コストを抑えレスポンスを最速化
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                alert: {
                  type: Type.STRING,
                  description: "現在の気象や環境、カテゴリに即した注意。1文で45〜65文字以内。",
                },
                actionGuide: {
                  type: Type.STRING,
                  description: "今取るべき行動やアドバイス。1文で45〜65文字以内。",
                },
                spotInfo: {
                  type: Type.STRING,
                  description: "具体的なローカル店舗、商品、価格、営業時間。1文で45〜65文字以内。",
                },
              },
              required: ["alert", "actionGuide", "spotInfo"],
            },
          },
        });
        if (response) {
          console.log(`Successfully generated recommendations with model: ${modelName}`);
          break;
        }
      } catch (err) {
        console.warn(`Attempt with ${modelName} failed, trying next:`, err);
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error("All fallback models failed.");
    }

    const text = response.text || "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Recommendations Error:", error);
    const errorDetails = error?.message || "不明なAPIエラー";
    res.json({
      alert: `⚠️ 【AI取得エラー】${errorDetails.slice(0, 50)}...。電波状況かAPIキーのクォータ制限を確認してください。`,
      actionGuide: "現在地データを元にした推奨情報の取得に失敗しました。時間をおいて一括更新をお試しください。",
      spotInfo: "💡 解決策: Settings > Secrets で設定した Gemini APIキー が正しく有効であることを確認してください。"
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
