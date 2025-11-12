import { NextFunction, Request, Response } from "express";
import BaseError from "../utils/base.error";
import jwt from "../utils/jwt";
import employeeService from "../dashboard/services/employee.service";
// import userService from "../dashboard/services/user.service";

const AuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return next(BaseError.UnauthorizedError());
    }
    const accressToken = auth.split(" ")[1];
    if (!accressToken) {
      return next(BaseError.UnauthorizedError());
    }
    const userData = jwt.validateAccessToken(accressToken);
    if (!userData) {
      return next(BaseError.UnauthorizedError());
    }

    const user = await employeeService.findUserById(userData.sub);
    if (!user) {
      return next(BaseError.BadRequest("User does not exist"));
    }

    req.user = userData;
    next();
  } catch (error) {
    return next(BaseError.UnauthorizedError());
  }
};
export default AuthMiddleware;
