import { Bot } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// تأكد من جلب الـ Key بالصحيح
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function askGemini(text) {
    try {
        // إذا كان الـ Key فارغ
        if (!process.env.GEMINI_API_KEY) {
            return "❌ خطأ: GEMINI_API_KEY غير موجود في إعدادات Railway.";
        }
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(text);
        return result.response.text();
    } catch (error) {
        console.error("Gemini Error Detail:", error.message);
        return `❌ خطأ من Google: ${error.message}`;
    }
}

bot.command("start", (ctx) => ctx.reply("🚀 البوت جاهز! ابعثلي اسم أي عملة."));

bot.on("message:text", async (ctx) => {
    await ctx.reply("⏳ جاري التحليل...");
    const res = await askGemini(ctx.message.text);
    await ctx.reply(res);
});

bot.start();
