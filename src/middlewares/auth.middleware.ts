import { Request, Response, NextFunction } from "express";
import BaseError from "../utils/base.error";
import jwt from "../utils/jwt";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization;

    console.log("🔐 Authentication check:", {
      hasAuth: !!auth,
      authHeader: auth?.substring(0, 20) + "...",
    });

    if (!auth) {
      console.error("❌ No authorization header");
      return next(BaseError.UnauthorizedError("Authorization header yo'q"));
    }

    const accessToken = auth.split(" ")[1];
    if (!accessToken) {
      console.error("❌ No access token");
      return next(BaseError.UnauthorizedError("Access token yo'q"));
    }

    const userData = jwt.validateAccessToken(accessToken);
    if (!userData) {
      console.error("❌ Invalid access token");
      return next(BaseError.UnauthorizedError("Token yaroqsiz"));
    }

    req.user = userData;
    console.log("✅ User authenticated:", userData.name);
    next();
  } catch (error) {
    console.error("❌ Authentication error:", error);
    return next(BaseError.UnauthorizedError("Autentifikatsiya xatosi"));
  }
};
