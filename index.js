
import { Bot, InlineKeyboard, GrammyError, HttpError } from "grammy";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config"; // تأكد أنك صابب dotenv

// 1. إعدادات البوت والذكاء الاصطناعي
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// تحقق من وجود API Keys
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ خطأ: TELEGRAM_BOT_TOKEN غير موجود!");
  process.exit(1);
}
if (!process.env.CLAUDE_API_KEY) {
  console.error("❌ خطأ: CLAUDE_API_KEY غير موجود!");
  process.exit(1);
}

// 2. System Prompt (نفس الـ Prompt متاعك)
const TRADING_SYSTEM_PROMPT = `أنت محلل تداول محترف متخصص في:
التحليل الفني المتقدم على أطر زمنية متعددة (5m, 15m, 30m, 1h, 4h)
تحديد نقاط الدخول والخروج بدقة عالية جداً
حساب وقف الخسارة وجني الأرباح بدقة رياضية
تحليل الذهب، الفضة، وجميع أزواج العملات والعملات الرقمية

عند تحليل أي أصل مالي، قدم دائماً:
1. 🔍 الاتجاه العام واحتمالية استمراره
2. 📊 قراءة دقيقة للمؤشرات الفنية
3. 📈 مستويات الدعم والمقاومة الدقيقة
4. 🎯 نقطة الدخول المثالية بالسعر المحدد
5. 🛑 وقف الخسارة المحسوب (بالسعر والنقاط والنسبة المئوية)
6. 💰 أهداف الربح الثلاثة (TP1, TP2, TP3)
7. ⚡ نسبة المخاطرة للعائد (Risk/Reward)

استخدم تنسيقاً احترافياً واضحاً مع رموز تعبيرية. أجب بالعربية دائماً.`;

// 3. قوائم الأصول (ASSETS)
const ASSETS = {
  metals: {
    'XAUUSD': '🥇 الذهب/دولار (Gold)',
    'XAGUSD': '🥈 الفضة/دولار (Silver)',
    'XPTUSD': '⚪ البلاتين/دولار',
  },
  forex: {
    'EURUSD': '🇪🇺🇺🇸 اليورو/دولار',
    'GBPUSD': '🇬🇧🇺🇸 الجنيه/دولار',
    'USDJPY': '🇺🇸🇯🇵 دولار/ين',
  },
  crypto: {
    'BTCUSDT': '₿ بيتكوين/تيثر',
    'ETHUSDT': 'Ξ إيثيريوم/تيثر',
    'SOLUSDT': '🌞 سولانا/تيثر',
  }
};

const TIMEFRAMES = {
  '5m': '5 دقائق ⚡',
  '15m': '15 دقيقة 🔥',
  '30m': '30 دقيقة 📊',
  '1h': 'ساعة واحدة 📈',
  '4h': '4 ساعات 🎯',
  '1d': 'يومي 📅'
};

// 4. دالة Rate Limiting
const userRequestTracker = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = userRequestTracker.get(userId) || [];
  const recentRequests = userRequests.filter(time => now - time < 60000);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  recentRequests.push(now);
  userRequestTracker.set(userId, recentRequests);
  return true;
}

function getAssetName(symbol) {
  for (const category of Object.values(ASSETS)) {
    if (category[symbol]) return category[symbol];
  }
  return symbol;
}

// 5. 🔥 الدالة اللي كانت ناقصة (الاتصال بـ Claude)
async function callClaudeAPI(userPrompt) {
  try {
    const message = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229", // تنجم تبدلها بـ haiku كان تحب أرخص
      max_tokens: 3000,
      system: TRADING_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt }
      ]
    });
    return message.content[0].text;
  } catch (error) {
    console.error("Claude API Error:", error);
    throw new Error("حدث خطأ أثناء تحليل السوق.");
  }
}

// 6. الأوامر (Commands)
bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🥇 الذهب والفضة", "category_metals")
    .text("💱 العملات", "category_forex").row()
    .text("₿ العملات الرقمية", "category_crypto")
    .text("📊 تحليل شامل", "full_analysis").row()
    .text("🔥 إشارات حية", "live_signals");

  await ctx.reply("🎯 مرحباً بك في محطة التداول الاحترافية! اختر من القائمة:", {
    reply_markup: keyboard
  });
});

// معالج الأزرار
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  if (data === "category_metals") await showAssetsList(ctx, "metals", "🥇 المعادن");
  else if (data === "category_forex") await showAssetsList(ctx, "forex", "💱 الفوركس");
  else if (data === "category_crypto") await showAssetsList(ctx, "crypto", "₿ الكريبتو");
  else if (data === "live_signals") await generateLiveSignals(ctx);
  else if (data.startsWith("analyze_")) {
    const asset = data.replace("analyze_", "");
    await analyzeAssetAllTimeframes(ctx, asset);
  }
});

async function showAssetsList(ctx, category, title) {
  const keyboard = new InlineKeyboard();
  const assets = ASSETS[category];
  let count = 0;
  for (const [symbol, name] of Object.entries(assets)) {
    keyboard.text(name, `analyze_${symbol}`);
    count++;
    if (count % 2 === 0) keyboard.row();
  }
  await ctx.reply(`${title}\n📊 اختر الأصل:`, { reply_markup: keyboard });
}

// دالة التحليل الشامل
async function analyzeAssetAllTimeframes(ctx, asset) {
  await ctx.reply(`⏳ جاري تحليل ${getAssetName(asset)}...`);
  await ctx.replyWithChatAction("typing");

  const prompt = `حلل لي ${asset} تحليل شامل لجميع الأطر الزمنية مع نقاط دخول وخروج دقيقة.`;
  
  try {
    const analysis = await callClaudeAPI(prompt);
    // تقسيم الرسالة إذا كانت طويلة
    if (analysis.length > 4000) {
        const part1 = analysis.substring(0, 4000);
        const part2 = analysis.substring(4000);
        await ctx.reply(part1, { parse_mode: "Markdown" });
        await ctx.reply(part2, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(analysis, { parse_mode: "Markdown" });
    }
  } catch (error) {
    await ctx.reply("❌ حدث خطأ، حاول مرة أخرى.");
  }
}

// دالة الإشارات الحية
async function generateLiveSignals(ctx) {
    await ctx.reply("⏳ جاري البحث عن فرص حية...");
    await ctx.replyWithChatAction("typing");
    const prompt = "أعطني أفضل 3 فرص تداول حية الآن (سكالبينج وسوينغ) مع الأرقام.";
    try {
        const signals = await callClaudeAPI(prompt);
        await ctx.reply(signals, { parse_mode: "Markdown" });
    } catch (error) {
        await ctx.reply("❌ خطأ في جلب الإشارات.");
    }
}

// دالة Swing (اللي كانت مقصوصة عندك)
bot.command("swing", async (ctx) => {
    if (!checkRateLimit(ctx.from.id)) return ctx.reply("⏳ انتظر قليلاً...");
    
    await ctx.reply("📈 جاري البحث عن صفقات سوينغ...");
    await ctx.replyWithChatAction("typing");

    const prompt = `قدم 3 صفقات سوينغ قوية على الأطر 1h و 4h للأصول: XAUUSD, EURUSD, BTCUSDT`;

    try {
        const swings = await callClaudeAPI(prompt);
        await ctx.reply("📈 *صفقات السوينغ المقترحة:*\n\n" + swings, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Swing error:", error);
        await ctx.reply("❌ فشل العملية.");
    }
});

// 7. تشغيل البوت ومعالجة الأخطاء
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

console.log("🚀 البوت يشتغل... (Trading Bot Started)");
bot.start();
