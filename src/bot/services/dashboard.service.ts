import IJwtUser from "../../types/user";
import { Balance } from "../../schemas/balance.schema";
import { Types } from "mongoose";
import CurrencyCourse from "../../schemas/currency.schema";

class DashboardSrvice {
  async dashboard(user: IJwtUser) {
    // Valyuta kursini olish
    const currencyCourse = await CurrencyCourse.findOne().sort({
      createdAt: -1,
    });
    const exchangeRate = currencyCourse?.amount || 12500;

    const balance = await Balance.aggregate([
      {
        $match: {
          managerId: new Types.ObjectId(user.sub),
        },
      },
      {
        $project: {
          dollar: { $ifNull: ["$dollar", 0] },
          sum: {
            $round: {
              $multiply: [{ $ifNull: ["$dollar", 0] }, exchangeRate],
            },
          },
        },
      },
    ]);

    const defaultBalance = {
      dollar: 0,
      sum: 0,
    };

    return {
      status: "success",
      data: balance.length > 0 ? balance[0] : defaultBalance,
    };
  }
  async currencyCourse() {
    const currencyCourse = await CurrencyCourse.findOne().sort({
      createdAt: -1,
    });

    return currencyCourse?.amount;
  }
}

export default new DashboardSrvice();
