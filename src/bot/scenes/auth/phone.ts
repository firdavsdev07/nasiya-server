// import { Markup, Scenes } from "telegraf";
// import Employee from "../../../schemas/employee.schema";
// import { MyContext } from "../../utils/context";

// const phoneScene = new Scenes.BaseScene<MyContext>("phone");

// phoneScene.enter(async (ctx) => {
//   try {
//     await ctx.reply(
//       "Telefon raqamingizni kiriting: ",
//       Markup.keyboard([
//         Markup.button.contactRequest("📱 Telefon raqamni yuborish"),
//       ])
//         .resize()
//         .oneTime()
//     );
//   } catch (err: any) {
//     // Error handling
//   }
// });

// phoneScene.hears(/^\/start\b/, (ctx) => ctx.scene.enter("start"));

// phoneScene.on("contact", async (ctx) => {
//   try {
//     const telegramId = ctx.from.id;
//     let phoneNumber = ctx.message?.contact.phone_number;

//     if (!phoneNumber.startsWith("+")) {
//       phoneNumber = "+" + phoneNumber;
//     }

//     const employee = await Employee.findOne({
//       phoneNumber: phoneNumber,
//       isActive: true,
//       isDeleted: false,
//     });
//     if (employee) {
//       employee.telegramId = telegramId.toString();
//       await employee.save();

//       await ctx.reply(
//         `${employee.firstName} ${employee.lastName}, shaxsingiz tasdiqlandi.`
//       );

//       return await ctx.scene.enter("start");
//     } else {
//       await ctx.reply(
//         "Kechirasiz, sizning raqamingiz ro'yxatdan o'tmagan yoki faolsiz."
//       );
//       return;
//     }
//   } catch (e) {
//     // Error handling
//   }
// });

// phoneScene.on("text", async (ctx) => {
//   try {
//     await ctx.reply(
//       "Iltimos, telefon raqamingizni tugma orqali yuboring: ",
//       Markup.keyboard([
//         Markup.button.contactRequest("📱 Telefon raqamni yuborish"),
//       ])
//         .resize()
//         .oneTime()
//     );
//   } catch (e) {
//     // Error handling
//   }
// });

// export default phoneScene;

import { Markup, Scenes } from "telegraf";
import Employee from "../../../schemas/employee.schema";
import { MyContext } from "../../utils/context";

const phoneScene = new Scenes.BaseScene<MyContext>("phone");

phoneScene.enter(async (ctx) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📱 PHONE SCENE BOSHLANDI");
    console.log("=".repeat(60));

    await ctx.reply(
      "👋 Assalomu alaykum!\n\n" +
        "📲 Manager panelga kirish uchun telefon raqamingizni yuboring:",
      Markup.keyboard([
        Markup.button.contactRequest("📱 Telefon raqamni yuborish"),
      ])
        .resize()
        .oneTime()
    );

    console.log("✅ Telefon raqam so'rash xabari yuborildi");
  } catch (err: any) {
    console.log("❌ Phone scene enter error:", err.message);
  }
});

phoneScene.hears(/^\/start\b/, (ctx) => {
  console.log("🔄 /start buyrug'i qabul qilindi, start scene'ga qaytish");
  return ctx.scene.enter("start");
});

phoneScene.on("contact", async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    let phoneNumber = ctx.message?.contact.phone_number;

    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+" + phoneNumber;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📞 TELEFON RAQAM QABUL QILINDI");
    console.log("📱 Raqam:", phoneNumber);
    console.log("👤 Telegram ID:", telegramId);
    console.log("=".repeat(60));

    // Bazadan FAQAT manager rollidagi employee'larni qidirish
    console.log("🔍 Bazadan manager qidirilmoqda...");

    const employee = await Employee.findOne({
      phoneNumber: phoneNumber,
      isActive: true,
      isDeleted: false,
    }).populate("role");

    if (employee) {
      const roleName = (employee.role as any)?.name || "unknown";

      console.log("✅ EMPLOYEE TOPILDI:");
      console.log("   - Ism:", employee.firstName, employee.lastName);
      console.log("   - Rol:", roleName);
      console.log("   - Telefon:", employee.phoneNumber);
      console.log("   - Faol:", employee.isActive);

      // Faqat manager, admin, moderator rollariga ruxsat
      const allowedRoles = ["manager", "admin", "moderator"];

      if (!allowedRoles.includes(roleName)) {
        console.log("❌ RUXSAT YO'Q: Rol manager emas");
        console.log("   - Foydalanuvchi roli:", roleName);
        console.log("   - Ruxsat berilgan rollar:", allowedRoles.join(", "));

        await ctx.reply(
          "❌ Ruxsat yo'q\n\n" +
            "Sizda manager panelga kirish huquqi yo'q.\n" +
            `Sizning rolingiz: ${roleName}\n\n` +
            "Iltimos, administrator bilan bog'laning."
        );
        return;
      }

      // Telegram ID'ni saqlash
      employee.telegramId = telegramId.toString();
      await employee.save();

      console.log("✅ Telegram ID saqlandi");

      console.log("🔄 Manager panelga o'tilmoqda...");

      // Manager panelni ko'rsatish
      const webAppUrl = process.env.BOT_WEB_APP_URL || "http://localhost:5174";

      await ctx.reply(
        `✅ Tasdiqlandi!\n\n` +
          `👤 Ism: ${employee.firstName} ${employee.lastName}\n` +
          `🎯 Rol: ${roleName}\n\n` +
          `📊 Manager panelingizga kirish uchun quyidagi tugmani bosing:\n\n` +
          `⚠️ Agar Desktop Telegram'da tugma ishlamasa, quyidagi linkni brauzerda oching:\n` +
          `🔗 ${webAppUrl}`,
        Markup.inlineKeyboard([
          [Markup.button.webApp("📊 Manager Panel", webAppUrl)],
          [Markup.button.url("🌐 Brauzerda ochish", webAppUrl)],
        ])
      );

      console.log("✅ Manager panel tugmasi yuborildi (inline + URL)");
      console.log("=".repeat(60) + "\n");
    } else {
      console.log("❌ EMPLOYEE TOPILMADI");
      console.log("   - Qidirilgan raqam:", phoneNumber);
      console.log("   - Sabab: Bazada yo'q yoki faol emas");

      // Debug: Barcha employee'larni ko'rsatish
      const allEmployees = await Employee.find({
        isDeleted: false,
      }).select("phoneNumber firstName lastName isActive");

      console.log("📋 Bazadagi barcha employee'lar:");
      allEmployees.forEach((emp, index) => {
        console.log(
          `   ${index + 1}. ${emp.phoneNumber} - ${emp.firstName} ${
            emp.lastName
          } (Faol: ${emp.isActive})`
        );
      });
      console.log("=".repeat(60) + "\n");

      await ctx.reply(
        "❌ Ruxsat yo'q\n\n" +
          "Sizda ushbu bo'limga kirish uchun yetarli huquq yo'q. " +
          "Agar bu xatolik deb hisoblasangiz, iltimos, administrator bilan bog'laning.\n\n" +
          `📞 Yuborilgan raqam: ${phoneNumber}`
      );
    }
  } catch (e: any) {
    console.log("❌ PHONE SCENE ERROR:", e.message);
    console.log("Stack:", e.stack);

    await ctx.reply(
      "❌ Xatolik yuz berdi.\n\n" + "Iltimos, /start ni qayta bosing."
    );
  }
});

phoneScene.on("text", async (ctx) => {
  try {
    console.log("⚠️ Text yuborildi, telefon tugmasini ko'rsatish");

    await ctx.reply(
      "⚠️ Iltimos, telefon raqamingizni tugma orqali yuboring:",
      Markup.keyboard([
        Markup.button.contactRequest("📱 Telefon raqamni yuborish"),
      ])
        .resize()
        .oneTime()
    );
  } catch (e: any) {
    console.log("❌ Text handler error:", e.message);
  }
});

export default phoneScene;
