import "reflect-metadata";
import app from "./app";
import connectDB from "./config/db";
import createSuperAdmin from "./utils/createSuperAdmin";
import seedRoles from "./utils/createRole";
import startBot from "./bot/startBot";
import bot from "./bot/main";
import createCurrencyCourse from "./utils/createCurrencyCourse";
import debtorService from "./dashboard/services/debtor.service";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    await seedRoles();
    await createCurrencyCourse();
    await createSuperAdmin();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    setInterval(async () => {
      try {
        await debtorService.createOverdueDebtors();
      } catch (error) {
        console.error("Error in automatic debtor creation:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 soat

    setTimeout(async () => {
      try {
        await debtorService.createOverdueDebtors();
      } catch (error) {
        console.error("Error in initial debtor creation:", error);
      }
    }, 5000);

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`Dastur xotira iste'moli: ${Math.round(used * 100) / 100} MB`);
  } catch (error) {
    console.error("Server start error:", error);
  }
};

const startApplication = async () => {
  try {
    await startServer();

    const enableBot = process.env.ENABLE_BOT;
    const hasToken = !!process.env.BOT_TOKEN;
    const botHostUrl = process.env.BOT_HOST_URL;

    console.log(` Bot configuration check:`);
    console.log(`   - Has token: ${hasToken}`);
    console.log(`   - Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`   - ENABLE_BOT: ${enableBot || "not set"}`);

    const shouldStartBot = hasToken && enableBot !== "false";

    if (shouldStartBot && botHostUrl) {
      console.log("Setting up Telegram webhook...");
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        // Set new webhook
        const webhookUrl = `${botHostUrl}/telegram-webhook`;
        await bot.telegram.setWebhook(webhookUrl, {
          drop_pending_updates: true,
        });

        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log(
          `Webhook status: ${webhookInfo.url ? "Active" : "Inactive"}`
        );
      } catch (botError: any) {
        console.error("ebhook setup failed:", botError.message);
      }
    } else if (hasToken && enableBot === "false") {
      console.log("Bot disabled by ENABLE_BOT=false");
    } else {
      console.log(
        "Bot token or BOT_HOST_URL not found, skipping bot initialization"
      );
    }
  } catch (err) {
    console.error("Application start error:", err);
    process.exit(1);
  }
};
startApplication();
