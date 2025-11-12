import { Request, Response, NextFunction } from "express";
import authService from "../services/user.service";
import { plainToInstance } from "class-transformer";
import { LoginDto } from "../../validators/auth";
import { handleValidationErrors } from "../../validators/format";
import { validate } from "class-validator";
import BaseError from "../../utils/base.error";
import { profile } from "console";
import { checkTelegramInitData } from "../utils/checkInitData";
import config from "../utils/config";
// import jwt from "jsonwebtoken";
import Employee from "../../schemas/employee.schema";
import IEmployeeData from "../../types/employeeData";
import IJwtUser from "../../types/user";
import jwt from "../../utils/jwt";

class AuthController {
  async telegram(req: Request, res: Response, next: NextFunction) {
    try {
      console.log("🔐 === BOT AUTH REQUEST ===");
      console.log(
        "📍 Request body:",
        JSON.stringify(req.body).substring(0, 100)
      );

      const { initData } = req.body;

      if (!initData) {
        console.log("❌ initData mavjud emas");
        return next(BaseError.ForbiddenError("initData topilmadi"));
      }

      console.log("✅ initData mavjud, uzunligi:", initData.length);
      const telegramId = checkTelegramInitData(initData);

      if (!telegramId) {
        console.log("❌ telegramId parse qilinmadi:", telegramId);
        return next(BaseError.UnauthorizedError("initData noto'g'ri"));
      }

      console.log("✅ telegramId topildi:", telegramId);
      console.log("🔍 Database'dan xodim qidirilmoqda...");

      const employee = await Employee.findOne({
        telegramId: telegramId.toString(),
        isActive: true,
        isDeleted: false,
      }).populate("role");

      if (!employee) {
        console.log("❌ Xodim topilmadi. TelegramId:", telegramId);
        console.log("💡 Iltimos, avval telefon raqamingizni bot'ga yuboring");
        return next(BaseError.NotFoundError("Foydalanuvchi topilmadi"));
      }

      console.log("✅ Xodim topildi:", employee.firstName, employee.lastName);
      console.log("👤 Rol:", employee.role?.name);

      const employeeData: IEmployeeData = {
        id: employee.id,
        firstname: employee.firstName,
        lastname: employee.lastName,
        phoneNumber: employee.phoneNumber,
        telegramId: employee.telegramId,
        role: employee.role.name,
      };

      const employeeDto: IJwtUser = {
        sub: employee.id.toString(),
        name: employee.firstName,
        role: employee.role.name,
      };

      const accessToken = jwt.signBot(employeeDto);
      console.log("✅ Token yaratildi");
      console.log("🎉 === AUTH SUCCESSFUL ===\n");

      res.json({ profile: employeeData, token: accessToken });
    } catch (err) {
      console.error("❌ Telegram auth error:", err);
      return next(err);
    }
  }
}
export default new AuthController();
