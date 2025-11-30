import { Request, Response, NextFunction } from "express";
import BaseError from "../../utils/base.error";
import IJwtUser from "../../types/user";
import { RoleEnum } from "../../enums/role.enum";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PayDebtDto, PayNewDebtDto } from "../../validators/payment";
import { handleValidationErrors } from "../../validators/format";
import paymentService from "../services/payment.service";
import dashboardPaymentController from "../../dashboard/controllers/payment.controller";

// const user: IJwtUser = {
//   sub: "686e7881ab577df7c3eb3db2",
//   name: "Farhod",
//   role: RoleEnum.MANAGER,
// };

class PaymentController {
  async payDebt(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const payData = plainToInstance(PayDebtDto, req.body || {});
      const errors = await validate(payData);
      if (errors.length > 0) {
        const formattedErrors = handleValidationErrors(errors);
        return next(
          BaseError.BadRequest("To'lov ma'lumotlari xato.", formattedErrors)
        );
      }
      const data = await paymentService.payDebt(payData, user);
      res.status(201).json(data);
    } catch (error) {
      return next(error);
    }
  }
  async payNewDebt(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const payData = plainToInstance(PayNewDebtDto, req.body || {});
      const errors = await validate(payData);
      if (errors.length > 0) {
        const formattedErrors = handleValidationErrors(errors);
        return next(
          BaseError.BadRequest("To'lov ma'lumotlari xato.", formattedErrors)
        );
      }
      const data = await paymentService.payNewDebt(payData, user);
      res.status(201).json(data);
    } catch (error) {
      console.log("error", error);

      return next(error);
    }
  }

  /**
   * To'lovni keyinga qoldirish
   * Mijoz to'lovni boshqa sanaga ko'chirish uchun
   */
  async postponePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { contractId, postponeDate, reason } = req.body;

      console.log("📅 POSTPONE PAYMENT REQUEST:");
      console.log("   - Contract ID:", contractId);
      console.log("   - Postpone Date:", postponeDate);
      console.log("   - Reason:", reason);
      console.log("   - Manager:", user.name);

      // Validation
      if (!contractId) {
        return next(BaseError.BadRequest("Shartnoma ID si kiritilmagan"));
      }

      if (!postponeDate) {
        return next(BaseError.BadRequest("Keyingi to'lov sanasi kiritilmagan"));
      }

      const data = await paymentService.postponePayment(
        contractId,
        postponeDate,
        reason || "Mijoz so'rovi",
        user
      );

      res.status(200).json(data);
    } catch (error) {
      console.error("❌ Postpone payment error:", error);
      return next(error);
    }
  }

  async payAllRemainingMonths(req: Request, res: Response, next: NextFunction) {
    return dashboardPaymentController.payAllRemainingMonths(req, res, next);
  }
}
export default new PaymentController();
