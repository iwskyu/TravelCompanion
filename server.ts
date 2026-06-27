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

//// API Route for Reverse Geocoding (Nominatim Proxy to bypass CORS & forbidden header blocks on mobile)
app.get("/api/geocode", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Missing lat/lon parameters" });
    }
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ja`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TravelCompanionApp/64.0 (iwskyu@gmail.com)",
      },
    });
    if (!response.ok) {
      throw new Error(`Nominatim returned status ${response.status}`);
    }
    const json = await response.json();
    return res.json(json);
  } catch (error: any) {
    console.error("Geocoding proxy failed:", error.message || error);
    return res.status(500).json({ error: "Failed to reverse geocode location" });
  }
});

//// API Route for Server-side IP Geolocation to bypass mobile browser CORS & secure context constraints
app.get("/api/ip-coords", async (req, res) => {
  try {
    let ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    if (ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }
    
    // IPv4-mapped IPv6 addresses cleanup
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // Default placeholder if local loopback or private network
    if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.") || !ip) {
      ip = ""; // Let ipapi determine by request origin
    }

    const url = ip ? `https://ipapi.co/${ip}/json/` : `https://ipapi.co/json/`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TravelCompanionApp/64.0 (iwskyu@gmail.com)",
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return res.json({ lat: data.latitude, lon: data.longitude });
      }
    }

    // Fallback: freeipapi
    const fallbackUrl = ip ? `https://freeipapi.com/api/json/${ip}` : `https://freeipapi.com/api/json`;
    const fallbackResponse = await fetch(fallbackUrl);
    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return res.json({ lat: data.latitude, lon: data.longitude });
      }
    }

    // Secondary static fallback to Tokyo if all else fails
    return res.json({ lat: 35.6812, lon: 139.7671, note: "Static fallback" });
  } catch (err: any) {
    console.error("Server-side IP location resolution failed:", err.message || err);
    return res.json({ lat: 35.6812, lon: 139.7671, note: "Static fallback on error" });
  }
});

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
現在の情報から重要度順に3つだけ教えて。
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

【出力モードの厳密な判定と生成規則】

1. 【災害・重大な緊急時モード】
もし地震データに「震度5」以上の揺れがある、または重大な警報・危機が検知されている場合は、以下の通りに作成：
- alert：危険情報を極めて端的に表示（例：山梨県で震度6弱発生。横浜市西区では震度4程度の揺れ。今後数日は余震に注意。）
- actionGuide：命を守る次の行動を端的に表示（例：エレベーターを使用しない。ガス臭がないか確認する。モバイルバッテリーを充電。家族へ安否連絡。）
- spotInfo：鉄道やインフラ状況を端的に表示（例：横浜駅周辺の鉄道運行状況を確認してください。東海道新幹線は運転見合わせの可能性があります。）

2. 【通常・安全時モード】
上記のような震度5以上の大地震や致命的な災害が起きていない、日常の平穏な状況では、必ず以下のプレフィックスを冒頭に付与した3文としてください：
- alert：『⭐今日一番重要：[最優先の注意、気候や環境データに基づくお役立ち警告（例：雨が30分後に来ます。）]』
- actionGuide：『⭐今行くべき場所：[現在地周辺で今行くべきローカルスポットや店舗。店名、商品名、および価格（例：徒歩200m先の○○コンビニ、または○○店の焼き鳥150円）を必ず含むこと。]』
- spotInfo：『⭐今日しか見られない：[現在地や今日の時間帯、天候にのみ合致した希少な自然体験、絶景、夕焼け指数、またはお役立ち情報（例：富士山の視程が高く、夕焼け指数85点です。）]』

【出力条件（絶対に厳守）】
- 各項目は、日本語で「完全に1文のみ」、かつ「45〜65文字以内」にまとめてください。
- 余計な枕詞、挨拶、まとめ文は一切含めないでください。
`;

    // 爆速モデルや安定した標準モデルを優先で使用（無料枠のクォータ上限エラー回避のため、3.1-flash-liteを最優先）
    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
    let response = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction: "あなたは爆速でお供情報を返すAIコンパニオンです。余計な説明や挨拶は完全に排除し、指定されたスキーマに従って、災害・緊急時モードか、通常時（⭐今日一番重要：、⭐今行くべき場所：、⭐今日しか見られない：）の規則を厳密に守り、日本語の完全に1文（45〜65文字）で回答してください。実在する特定の店舗名、商品名、価格は通常時のactionGuideに必ず含めてください。",
            responseMimeType: "application/json",
            temperature: 0.1, // 決定論的な出力を高めて思考速度を極限まで引き上げる
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                alert: {
                  type: Type.STRING,
                  description: "災害・緊急時は危険情報の端的な要約。通常時は『⭐今日一番重要：』から始まる1文。45〜65文字以内。",
                },
                actionGuide: {
                  type: Type.STRING,
                  description: "災害・緊急時は命を守る行動要約。通常時は『⭐今行くべき場所：』から始まる1文（店名と価格を必ず含む）。45〜65文字以内。",
                },
                spotInfo: {
                  type: Type.STRING,
                  description: "災害・緊急時は交通状況。通常時は『⭐今日しか見られない：』から始まるお役立ち・絶景等の1文。45〜65文字以内。",
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
      console.warn("All Gemini API models failed. Activating high-quality local fallback recommendations...");
      // Extract a readable location name dynamically
      let loc = "周辺";
      if (data?.address) {
        const match = data.address.match(/(東京都|京都府|大阪府|北海道|.{2,3}県)?([^区市町村]+[区市町村])?/);
        if (match && match[2]) {
          loc = match[2];
        } else if (match && match[1]) {
          loc = match[1];
        } else {
          loc = data.address.slice(0, 8);
        }
      }

      const cat = category || "all";
      let fallbackResult;
      switch (cat) {
        case "driving":
          fallbackResult = {
            alert: "安全なドライブのため、こまめな休憩を心がけ、夕暮れ時は早めのヘッドライト点灯に努めましょう。",
            actionGuide: `景色の良い${loc}のパーキングエリアや道の駅に立ち寄り、深呼吸をしてストレッチがおすすめです。`,
            spotInfo: `${loc}名物の特製ソフトクリーム（380円、夕方17時まで営業）はドライブ休憩のお供に大人気です。`
          };
          break;
        case "climbing":
          fallbackResult = {
            alert: "山の天気は変わりやすいため、レインウェアや防寒具を常備し、余裕を持った下山計画を立てましょう。",
            actionGuide: `${loc}の登山口付近で最新の登山道情報を確認し、無理のないペース配分で安全に歩いてください。`,
            spotInfo: "登山口売店の特製手作りあんパン（220円、15時半営業終了）は登山中の行動食として非常に便利です。"
          };
          break;
        case "sea":
          fallbackResult = {
            alert: "海岸エリアでは急な高波や突風に注意し、足元の濡れた岩場や防波堤などの危険エリアを避けましょう。",
            actionGuide: `潮風を感じながら${loc}の砂浜や漁港周辺をゆっくり散策し、爽やかな海の景色を楽しみましょう。`,
            spotInfo: "海沿いのレトロな食堂で食べられる獲れたて生しらす丼（980円、15時LO）は地元ならではの絶品。"
          };
          break;
        case "weather":
          fallbackResult = {
            alert: "現在の気象状況に合わせた服装を選び、急な雨や強い紫外線から身を守る対策をしっかりと行いましょう。",
            actionGuide: "天気が良い時間は近くの絶景展望ポイントへ、雨なら温かみのある地元のレトロな喫茶店へどうぞ。",
            spotInfo: `${loc}のレトロカフェで提供される自家製濃厚プリン（450円、18時まで営業）は休憩に最適です。`
          };
          break;
        case "disaster":
          fallbackResult = {
            alert: "万が一の急な悪天候や自然災害に備え、最寄りの指定避難場所やハザード状況を事前に確認しましょう。",
            actionGuide: `${loc}の公共施設や安全な鉄筋コンクリート建物の位置を把握し、いざという時は速やかに退避を。`,
            spotInfo: "付近の24時間営業コンビニでは、いつでも温かい淹れたてドリップコーヒー（120円）が購入可能です。"
          };
          break;
        default:
          fallbackResult = {
            alert: "安全で快適なお出かけのために、スマートフォンのバッテリー残量を確認し、適度な水分補給を。",
            actionGuide: `${loc}の魅力的な細い路地を歩き、観光マップに載っていないローカルな隠れ家を探してみましょう。`,
            spotInfo: "駅近くの老舗和菓子屋で販売されている自家製みたらし団子（150円、17時閉店）は散策のお供に最高。"
          };
          break;
      }
      return res.json(fallbackResult);
    }

    let text = response.text || "{}";
    
    // Clean markdown blocks if present
    if (text.includes("```")) {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        text = match[1];
      }
    }
    
    // Remove any trailing/leading text outside the JSON block if any exists
    text = text.trim();
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

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
