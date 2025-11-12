// import { session } from "telegraf";
// import axiosInstance from "../service/server/api";
import bot from "./core/bot";
import session from "./core/session";
import stage from "./scenes";

bot.use(session);
bot.use(stage.middleware());

bot.command("speed", async (ctx) => {
  const start = Date.now();
  await new Promise((res) => setTimeout(res, 50));
  const ms = Date.now() - start;
  await ctx.reply(`🚀 Bot javob berish tezligi: ${ms} ms`);
});

bot.start(async (ctx) => {
  if (ctx.chat.type === "private") {
    await ctx.scene.enter("start");
  }
});

bot.catch((err, ctx) => {
  console.log(`Bot handler error ${err}`);
  ctx.reply("Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.");
});

export default bot;
