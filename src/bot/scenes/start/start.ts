// import { Markup, Scenes } from "telegraf";
// import Employee from "../../../schemas/employee.schema";
// import { MyContext } from "../../utils/context";

// const startScene = new Scenes.BaseScene<MyContext>("start");

// startScene.enter(async (ctx) => {
//   try {
//     if (!ctx.from) {
//       console.log("❌ ctx.from mavjud emas");
//       return;
//     }

//     const telegramId = ctx.from.id;
//     console.log("\n" + "=".repeat(60));
//     console.log("🚀 START SCENE BOSHLANDI");
//     console.log("👤 Telegram ID:", telegramId);
//     console.log("📱 Username:", ctx.from.username || "yo'q");
//     console.log("=".repeat(60));

//     // HAR DOIM telefon raqam so'rash (professional flow)
//     console.log("📲 Telefon raqam so'ralmoqda...");
//     return await ctx.scene.enter("phone");

//   } catch (e: any) {
//     console.log("❌ Start scene ERROR:", e.message || e);
//     console.log("Stack:", e.stack);

//     try {
//       await ctx.reply(
//         "❌ Xatolik yuz berdi.\n\n" +
//         "Iltimos, /start ni qayta bosing yoki administrator bilan bog'laning."
//       );
//     } catch (replyErr) {
//       console.log("❌ Reply error:", replyErr);
//     }
//   }
// });

// export default startScene;


import { Markup, Scenes } from "telegraf";
import Employee from "../../../schemas/employee.schema";
import { MyContext } from "../../utils/context";

const startScene = new Scenes.BaseScene<MyContext>("start");

startScene.enter(async (ctx) => {
  try {
    if (!ctx.from) {
      console.log("❌ ctx.from mavjud emas");
      return;
    }

    const telegramId = ctx.from.id;
    console.log("\n" + "=".repeat(60));
    console.log("🚀 START SCENE BOSHLANDI");
    console.log("👤 Telegram ID:", telegramId);
    console.log("📱 Username:", ctx.from.username || "yo'q");
    console.log("=".repeat(60));

    // HAR DOIM telefon raqam so'rash (professional flow)
    console.log("📲 Telefon raqam so'ralmoqda...");
    return await ctx.scene.enter("phone");

  } catch (e: any) {
    console.log("❌ Start scene ERROR:", e.message || e);
    console.log("Stack:", e.stack);

    try {
      await ctx.reply(
        "❌ Xatolik yuz berdi.\n\n" +
        "Iltimos, /start ni qayta bosing yoki administrator bilan bog'laning."
      );
    } catch (replyErr) {
      console.log("❌ Reply error:", replyErr);
    }
  }
});

export default startScene;
