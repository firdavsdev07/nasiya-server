import "reflect-metadata";
import "dotenv/config";
import connectDB from "./config/db";
import bot from "./bot/main";

const startBot = async () => {
  try {
    console.log("🔗 MongoDB'ga ulanish...");
    await connectDB();
    console.log("✅ MongoDB ulandi");

    console.log("🤖 Bot ishga tushirilmoqda...");
    await bot.launch();
    console.log("✅ Bot muvaffaqiyatli ishga tushdi");

    const info = await bot.telegram.getMe();
    console.log(`🤖 Bot tayyor: @${info.username}`);

    // Graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (error: any) {
    console.error("❌ Bot xatolik:", error.message);
    process.exit(1);
  }
};

startBot();
