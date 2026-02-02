import { Bot, InlineKeyboard, GrammyError, HttpError } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// 1. إعداد البوت و Gemini
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. السستيم برومبت (نفس القوة التحليلية)
const TRADING_SYSTEM_PROMPT = `أنت محلل تداول محترف. وظيفتك تحليل الأسواق المالية (ذهب، عملات، كريبتو).
قدم دائماً: اتجاه السوق، نقاط دخول وخروج دقيقة، وقف خسارة (SL)، و3 أهداف ربح (TP).
استخدم اللغة العربية والرموز التعبيرية. كن دقيقاً جداً في الأرقام.`;

// 3. دالة الاتصال بـ Gemini (المجانية)
async function callGeminiAPI(userPrompt) {
  try {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", // نسخة سريعة ومجانية
        systemInstruction: TRADING_SYSTEM_PROMPT 
    });

    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "❌ عذراً، واجهت مشكلة في تحليل البيانات. حاول مرة أخرى.";
  }
}

// 4. الأوامر الأساسية
bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🥇 الذهب", "analyze_XAUUSD")
    .text("₿ بيتكوين", "analyze_BTCUSDT").row()
    .text("🇪🇺 يورو/دولار", "analyze_EURUSD")
    .text("🔥 إشارات حية", "live_signals");

  await ctx.reply("🎯 مرحباً بك في بوت التداول الذكي (Powered by Gemini)\nاختر الأصل الذي تريد تحليله:", {
    reply_markup: keyboard
  });
});

// معالج الأزرار
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  if (data === "live_signals") {
    await ctx.reply("⏳ جاري استخراج أفضل الفرص...");
    const signals = await callGeminiAPI("أعطني أفضل 3 إشارات تداول حية الآن مع نقاط الدخول والهدف.");
    await ctx.reply(signals);
  } 
  else if (data.startsWith("analyze_")) {
    const asset = data.replace("analyze_", "");
    await ctx.reply(`⏳ جاري تحليل ${asset} عبر ذكاء Gemini...`);
    const analysis = await callGeminiAPI(`حلل لي زوج ${asset} تحليل فني مفصل مع الأهداف.`);
    await ctx
    
