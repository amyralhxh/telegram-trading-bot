import { Bot, InlineKeyboard } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// إعداد البوت
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// دالة التحليل باستخدام الموديل المستقر
async function askGemini(promptText) {
    try {
        if (!process.env.GEMINI_API_KEY) return "❌ خطأ: اسم المفتاح في Railway لازم يكون GEMINI_API_KEY";
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // استعملنا gemini-pro لأنه الأكثر استقراراً مع الـ Keys المجانية
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const result = await model.generateContent(promptText);
        return result.response.text();
    } catch (error) {
        console.error("Gemini Error:", error.message);
        return "❌ فشل من Google: " + error.message;
    }
}

bot.command("start", async (ctx) => {
    const kb = new InlineKeyboard().text("🥇 تحليل الذهب", "gold").text("₿ بيتكوين", "btc");
    await ctx.reply("🚀 البوت جاهز! اختر أو اكتب اسم أي زوج:", { reply_markup: kb });
});

bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("⏳ جاري التحليل...");
    const res = await askGemini(`حلل لي ${ctx.callbackQuery.data} كخبير تداول.`);
    await ctx.reply(res);
});

bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    await ctx.reply("⏳ جاري التحليل...");
    const res = await askGemini(ctx.message.text);
    await ctx.reply(res);
});

// حل مشكلة الـ Conflict (التوقف وإعادة التشغيل)
bot.start();
console.log("✅ Bot is running properly!");
