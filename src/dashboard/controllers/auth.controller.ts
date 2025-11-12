import { Request, Response, NextFunction } from "express";
import authService from "../services/auth.service";
import { plainToInstance } from "class-transformer";
import { LoginDto } from "../../validators/auth";
import { handleValidationErrors } from "../../validators/format";
import { validate } from "class-validator";
import BaseError from "../../utils/base.error";
import { profile } from "console";

class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const loginData = plainToInstance(LoginDto, req.body || {});

      const errors = await validate(loginData);

      if (errors.length > 0) {
        const formattedErrors = handleValidationErrors(errors);
        return next(
          BaseError.BadRequest(
            "Ma'lumotlar tekshiruvdan o'tmadi",
            formattedErrors
          )
        );
      }

      const data = await authService.login(loginData);

      // Cookie sozlamalari
      const isProduction = process.env.NODE_ENV === "production";
      const isNgrok = req.headers.host?.includes("ngrok");

      const cookieOptions: any = {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 kun
        path: "/",
        secure: isProduction || isNgrok, // HTTPS production yoki ngrok'da
        sameSite: isProduction || isNgrok ? "none" : "lax", // Cross-site production yoki ngrok'da
      };

      console.log("🍪 === SETTING COOKIE ===");
      console.log("📍 Origin:", req.headers.origin);
      console.log("📍 Host:", req.headers.host);
      console.log("🔧 NODE_ENV:", process.env.NODE_ENV);
      console.log("🔧 Is Ngrok:", isNgrok);
      console.log("⚙️ Cookie options:", cookieOptions);
      console.log("🔑 Token (first 20 chars):", data.refreshToken.substring(0, 20) + "...");

      res.cookie("refresh_token", data.refreshToken, cookieOptions);

      console.log("✅ Cookie set successfully");
      console.log("📤 Response headers will include Set-Cookie");

      // ✅ accessToken ham qaytarish (frontend localStorage'ga saqlaydi)
      res.json({
        profile: data.profile,
        accessToken: data.accessToken,
        token: data.accessToken // backward compatibility
      });
    } catch (error) {
      return next(error);
    }
  }

  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (user) {
        const data = await authService.getUser(user);
        res.json(data);
      }
    } catch (error) {
      return next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.cookies;

      // Debug: Cookie tekshirish
      console.log("🔍 === REFRESH REQUEST ===");
      console.log("📍 Origin:", req.headers.origin);
      console.log("📦 All Cookies:", req.cookies);
      console.log("📋 Cookie Header:", req.headers.cookie);
      console.log("🔑 Refresh token:", refresh_token ? "exists" : "missing");

      if (!refresh_token) {
        console.log("❌ No refresh token in cookies");
        console.log("💡 Hint: Check if cookie was set during login");
        console.log("💡 Hint: Check if withCredentials: true in frontend");
        console.log("💡 Hint: Check CORS credentials: true in backend");
        return next(BaseError.UnauthorizedError("Refresh token topilmadi"));
      }

      const data = await authService.refresh(refresh_token);
      console.log("✅ Refresh successful");
      console.log("📦 Returning profile:", data.profile.firstname);

      res.json(data);
    } catch (error) {
      console.log("❌ Refresh failed:", error);
      return next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Cookie'ni tozalash - login paytidagi sozlamalar bilan
      const isProduction = process.env.NODE_ENV === "production";
      const isNgrok = req.headers.host?.includes("ngrok");

      res.clearCookie("refresh_token", {
        httpOnly: true,
        path: "/",
        secure: isProduction || isNgrok,
        sameSite: isProduction || isNgrok ? "none" : "lax",
      });

      console.log("✅ Logout successful, cookie cleared");
      res.json({ message: "Log out successful" });
    } catch (error) {
      return next(error);
    }
  }
}
export default new AuthController();
