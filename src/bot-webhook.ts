import "reflect-metadata";
import "dotenv/config";
import express from "express";
import connectDB from "./config/db";
import seedRoles from "./utils/createRole";
import bot from "./bot/main";

const app = express();
const PORT = 3001;
const WEBHOOK_DOMAIN = "https://phpbb-balloon-brandon-story.trycloudflare.com";
const WEBHOOK_PATH = `/telegram-webhook`;

const startWebhookBot = async () => {
  try {
    console.log("🔗 MongoDB'ga ulanish...");
    await connectDB();
    await seedRoles();
    console.log("✅ MongoDB ulandi");

    // Delete old webhook first
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log("🗑️ Eski webhook o'chirildi");

    // Set new webhook
    const webhookUrl = `${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`;
    console.log("🌐 Webhook o'rnatilmoqda:", webhookUrl);

    await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true,
    });
    console.log("✅ Webhook o'rnatildi");

    // Check webhook info
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log("📊 Webhook info:", JSON.stringify(webhookInfo, null, 2));

    // Express middleware
    app.use(express.json());

    // Webhook endpoint
    app.post(WEBHOOK_PATH, (req, res) => {
      console.log("📨 Webhook update qabul qilindi");
      bot.handleUpdate(req.body, res);
    });

    app.get("/", (req, res) => {
      res.json({
        status: "Bot webhook ishlayapti",
        webhook: webhookUrl,
        bot: process.env.BOT_USERNAME,
      });
    });

    app.get("/webhook-info", async (req, res) => {
      const info = await bot.telegram.getWebhookInfo();
      res.json(info);
    });

    app.listen(PORT, () => {
      console.log(`✅ Webhook server ishga tushdi: http://localhost:${PORT}`);
      console.log(`🤖 Bot tayyor: @${process.env.BOT_USERNAME}`);
      console.log(`📡 Webhook URL: ${webhookUrl}`);
    });

    // Graceful stop
    process.once("SIGINT", async () => {
      await bot.telegram.deleteWebhook();
      process.exit(0);
    });
    process.once("SIGTERM", async () => {
      await bot.telegram.deleteWebhook();
      process.exit(0);
    });
  } catch (error: any) {
    console.error("❌ Bot xatolik:", error.message);
    console.error(error);
    process.exit(1);
  }
};

startWebhookBot();
