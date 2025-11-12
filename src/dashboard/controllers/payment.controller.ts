import { Request, Response, NextFunction } from "express";
import BaseError from "../../utils/base.error";
import IJwtUser from "../../types/user";
import { RoleEnum } from "../../enums/role.enum";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PayDebtDto, PayNewDebtDto } from "../../validators/payment";
import { handleValidationErrors } from "../../validators/format";
import paymentService from "../services/payment.service";
// import paymentService from "../services/payment.service";

// const user: IJwtUser = {
//   sub: "686e7881ab577df7c3eb3db2",
//   name: "Farhod",
//   role: RoleEnum.MANAGER,
// };
class PaymentController {
  async update(req: Request, res: Response, next: NextFunction) {
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
      const data = await paymentService.update(payData, user);
      res.status(201).json(data);
    } catch (error) {
      return next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, contractId } = req.query;
      const data = await paymentService.getPaymentHistory(
        customerId as string,
        contractId as string
      );
      res.status(200).json(data);
    } catch (error) {
      return next(error);
    }
  }

  async payByContract(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { contractId, amount, notes, currencyDetails, currencyCourse } =
        req.body;

      if (!contractId || !amount || !currencyDetails || !currencyCourse) {
        return next(BaseError.BadRequest("To'lov ma'lumotlari to'liq emas"));
      }

      const data = await paymentService.payByContract(
        {
          contractId,
          amount,
          notes,
          currencyDetails,
          currencyCourse,
        },
        user
      );

      res.status(201).json(data);
    } catch (error) {
      return next(error);
    }
  }

  // Yangi endpoint'lar - Payment Service uchun

  async receivePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { ReceivePaymentDto } = await import("../../validators/payment");
      const payData = plainToInstance(ReceivePaymentDto, req.body || {});
      const errors = await validate(payData);

      if (errors.length > 0) {
        const formattedErrors = handleValidationErrors(errors);
        return next(
          BaseError.BadRequest("To'lov ma'lumotlari xato.", formattedErrors)
        );
      }

      const data = await paymentService.receivePayment(payData, user);
      res.status(201).json(data);
    } catch (error) {
      return next(error);
    }
  }

  async confirmPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { paymentId } = req.body;

      if (!paymentId) {
        return next(BaseError.BadRequest("Payment ID bo'sh bo'lmasligi kerak"));
      }

      const data = await paymentService.confirmPayment(paymentId, user);
      res.status(200).json(data);
    } catch (error) {
      return next(error);
    }
  }

  async rejectPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { paymentId, reason } = req.body;

      if (!paymentId || !reason) {
        return next(
          BaseError.BadRequest("Payment ID va sabab bo'sh bo'lmasligi kerak")
        );
      }

      const data = await paymentService.rejectPayment(paymentId, reason, user);
      res.status(200).json(data);
    } catch (error) {
      return next(error);
    }
  }
}

export default new PaymentController();
