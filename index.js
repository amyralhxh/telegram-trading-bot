import { Bot, InlineKeyboard } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// إعداد البوت والذكاء الاصطناعي
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TRADING_SYSTEM_PROMPT = `أنت محلل تداول محترف. عند تحليل أي أصل، قدم:
1. الاتجاه العام ومستويات الدعم والمقاومة.
2. نقاط دخول دقيقة (Entry Price).
3. وقف الخسارة (SL) وأهداف الربح (TP1, TP2, TP3).
4. نصيحة لإدارة المخاطر.
استخدم الرموز التعبيرية وأجب بالعربية دائماً.`;

// دالة الاتصال بـ Gemini
async function askGemini(query) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([TRADING_SYSTEM_PROMPT, query]);
        return result.response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "❌ حدث خطأ في التحليل. تأكد من إعداد GEMINI_API_KEY.";
    }
}

// قائمة الأزرار الرئيسية
const mainKeyboard = new InlineKeyboard()
    .text("🥇 الذهب", "analyze_XAUUSD")
    .text("₿ بيتكوين", "analyze_BTCUSDT").row()
    .text("🔥 إشارات حية", "cmd_signals")
    .text("⚡ سكالبينج", "cmd_scalp").row()
    .text("📊 تحليل مخصص", "cmd_help");

// أمر Start
bot.command("start", async (ctx) => {
    await ctx.reply(
        "🎯 **مرحباً بك في بوت التداول الاحترافي**\n" +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        "يمكنك الضغط على الأزرار أو كتابة اسم أي زوج لتحليله مباشرة.",
        { parse_mode: "Markdown", reply_markup: mainKeyboard }
    );
});

// معالج الأزرار (Callback Queries)
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    if (data.startsWith("analyze_")) {
        const asset = data.split("_")[1];
        await ctx.reply(`⏳ جاري تحليل ${asset}...`);
        const result = await askGemini(`حلل لي زوج ${asset} تحليل شامل.`);
        await ctx.reply(result, { parse_mode: "Markdown" });
    } else if (data === "cmd_signals") {
        await ctx.reply("⏳ جاري البحث عن إشارات حية...");
        const result = await askGemini("أعطني 3 إشارات تداول قوية الآن.");
        await ctx.reply(result, { parse_mode: "Markdown" });
    } else if (data === "cmd_scalp") {
        await ctx.reply("⏳ جاري البحث عن فرص سكالبينج...");
        const result = await askGemini("أعطني صفقات سكالبينج سريعة (5m/15m).");
        await ctx.reply(result, { parse_mode: "Markdown" });
    }
});

// الأوامر المباشرة (Commands)
bot.command("gold", (ctx) => ctx.reply("⏳ تحليل الذهب...", { reply_to_message_id: ctx.message.message_id }) && askGemini("حلل الذهب الآن").then(res => ctx.reply(res)));
bot.command("signals", async (ctx) => ctx.reply(await askGemini("أعطني إشارات تداول حية.")));

// استقبال أي رسالة نصية (تحليل حر)
bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    await ctx.reply("⏳ جاري تحليل " + ctx.message.text + "...");
    const result = await askGemini(ctx.message.text);
    await ctx.reply(result, { parse_mode: "Markdown" });
});

// تشغيل البوت
bot.catch((err) => console.error("Bot Error:", err));
bot.start();
console.log("🚀 البوت الاحترافي يشتغل الآن بنجاح!");
