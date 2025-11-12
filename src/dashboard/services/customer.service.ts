import BaseError from "../../utils/base.error";
import Auth from "../../schemas/auth.schema";
import Customer, { ICustomer } from "../../schemas/customer.schema";
import {
  CreateCustomerDto,
  SellerCreateCustomerDto,
  UpdateCustomerDto,
  UpdateManagerDto,
} from "../../validators/customer";
import IJwtUser from "../../types/user";
import Employee from "../../schemas/employee.schema";
import Contract from "../../schemas/contract.schema";
import { Types } from "mongoose";

class CustomerService {
  async getAllCustomer() {
    const filter: any = { isDeleted: false };
    return await Customer.find(filter)
      .populate({
        path: "manager",
        select: "firstName lastName _id isDeleted",
      })
      .sort({ createdAt: -1 });
  }

  async getAll() {
    return await Customer.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "manager",
          foreignField: "_id",
          as: "manager",
        },
      },
      {
        $unwind: {
          path: "$manager",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "contracts",
          localField: "_id",
          foreignField: "customer",
          as: "contracts",
        },
      },
      {
        $addFields: {
          contractCount: { $size: "$contracts" },
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          phoneNumber: 1,
          address: 1,
          passportSeries: 1,
          birthDate: 1,
          createdAt: 1,
          manager: {
            $ifNull: [
              {
                _id: "$manager._id",
                firstName: "$manager.firstName",
                lastName: "$manager.lastName",
              },
              null,
            ],
          },
          contractCount: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async getAllNew() {
    const query: any = {
      isDeleted: false,
      isActive: false,
    };
    const customers = await Customer.find(query).sort({ createdAt: -1 });
    return customers;
  }

  async getCustomerById(customerId: string) {
    interface ICustomerWithContract extends ICustomer {
      contracts: any[];
    }
    const customer = await Customer.findOne({
      _id: customerId,
    }).populate({
      path: "manager",
      select: "firstName lastName _id isDeleted",
    });

    if (!customer) {
      throw BaseError.BadRequest("Customer topilmadi");
    }

    const customerWithContract =
      customer.toObject() as unknown as ICustomerWithContract;
    customerWithContract.contracts = await Contract.aggregate([
      {
        $match: {
          isDeleted: false,
          isActive: true,
          customer: new Types.ObjectId(customerId),
        },
      },
      {
        $lookup: {
          from: "notes",
          localField: "notes",
          foreignField: "_id",
          as: "notes",
          pipeline: [{ $project: { text: 1 } }],
        },
      },
      {
        $addFields: {
          notes: { $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, null] },
        },
      },
      {
        $lookup: {
          from: "payments",
          localField: "payments",
          foreignField: "_id",
          as: "payments",
          pipeline: [
            {
              $lookup: {
                from: "notes",
                localField: "notes",
                foreignField: "_id",
                as: "notes",
                pipeline: [{ $project: { text: 1 } }],
              },
            },
            {
              $addFields: {
                notes: {
                  $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, ""],
                },
              },
            },
            {
              $project: {
                _id: 1,
                amount: 1,
                date: 1,
                isPaid: 1,
                paymentType: 1,
                status: 1,
                remainingAmount: 1,
                excessAmount: 1,
                expectedAmount: 1,
                notes: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          totalPaid: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$payments",
                    as: "p",
                    cond: { $eq: ["$$p.isPaid", true] },
                  },
                },
                as: "pp",
                in: "$$pp.amount",
              },
            },
          },
        },
      },
      {
        $addFields: {
          remainingDebt: {
            $subtract: ["$totalPrice", "$totalPaid"],
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return customerWithContract;
  }

  async checkPhone(phone: string) {
    const exists = await Customer.findOne({ phoneNumber: "+" + phone });
    return { exists: Boolean(exists) };
  }

  async checkPassport(passport: string) {
    const exists = await Customer.findOne({ passportSeries: passport });
    return { exists: Boolean(exists) };
  }

  async create(data: CreateCustomerDto, user: IJwtUser, files?: any) {
    const createBy = await Employee.findById(user.sub);
    if (!createBy) {
      throw BaseError.ForbiddenError();
    }
    if (data.phoneNumber) {
      const phoneExists = await Customer.findOne({
        phoneNumber: data.phoneNumber,
      });
      if (phoneExists) {
        throw BaseError.BadRequest(
          `Ushbu telefon raqami bilan mijoz allaqachon mavjud.`
        );
      }
    }
    if (data.passportSeries) {
      const passportExists = await Customer.findOne({
        passportSeries: data.passportSeries,
      });
      if (passportExists) {
        throw BaseError.BadRequest(
          "Ushbu passport seriyasi bilan mijoz allaqachon mavjud."
        );
      }
    }
    const auth = new Auth({});
    await auth.save();

    const customerFiles: any = {};
    if (files) {
      if (files.passport && files.passport[0]) {
        customerFiles.passport = files.passport[0].path;
      }
      if (files.shartnoma && files.shartnoma[0]) {
        customerFiles.shartnoma = files.shartnoma[0].path;
      }
      if (files.photo && files.photo[0]) {
        customerFiles.photo = files.photo[0].path;
      }
    }

    const customer = new Customer({
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      address: data.address,
      passportSeries: data.passportSeries,
      birthDate: data.birthDate,
      manager: data.managerId,
      auth,
      isActive: true,
      createBy,
      files: customerFiles,
    });
    await customer.save();
    return { message: "Mijoz yaratildi.", customer };
  }

  async update(data: UpdateCustomerDto, files?: any) {
    const customer = await Customer.findOne({
      _id: data.id,
      isDeleted: false,
    });

    if (!customer) {
      throw BaseError.NotFoundError("Mijoz topilmadi.");
    }

    const { deleteFile } = await import("../../middlewares/upload.middleware");
    if (files) {
      if (files.passport && files.passport[0] && customer.files?.passport) {
        deleteFile(customer.files.passport);
      }
      if (files.shartnoma && files.shartnoma[0] && customer.files?.shartnoma) {
        deleteFile(customer.files.shartnoma);
      }
      if (files.photo && files.photo[0] && customer.files?.photo) {
        deleteFile(customer.files.photo);
      }
    }

    const customerFiles: any = { ...customer.files };
    if (files) {
      if (files.passport && files.passport[0]) {
        customerFiles.passport = files.passport[0].path;
      }
      if (files.shartnoma && files.shartnoma[0]) {
        customerFiles.shartnoma = files.shartnoma[0].path;
      }
      if (files.photo && files.photo[0]) {
        customerFiles.photo = files.photo[0].path;
      }
    }

    await Customer.findOneAndUpdate(
      { _id: data.id, isDeleted: false },
      {
        firstName: data.firstName,
        lastName: data.lastName,
        passportSeries: data.passportSeries,
        phoneNumber: data.phoneNumber,
        birthDate: data.birthDate,
        address: data.address,
        manager: data.managerId,
        isActive: true,
        files: customerFiles,
      }
    ).exec();

    return { message: "Mijoz ma'lumotlari yangilandi." };
  }

  async delete(id: string) {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw BaseError.NotFoundError("Mijoz topilmadi.");
    }

    const { deleteFile } = await import("../../middlewares/upload.middleware");
    if (customer.files) {
      if (customer.files.passport) {
        deleteFile(customer.files.passport);
      }
      if (customer.files.shartnoma) {
        deleteFile(customer.files.shartnoma);
      }
      if (customer.files.photo) {
        deleteFile(customer.files.photo);
      }
    }

    customer.isDeleted = true;
    await customer.save();

    return { message: "Mijoz o'chirildi." };
  }

  async restoration(id: string) {
    const customer = await Customer.findByIdAndUpdate(
      id,
      {
        isDeleted: false,
      },
      { new: true }
    ).exec();
    if (!customer) {
      throw BaseError.NotFoundError("Mijoz topilmadi.");
    }

    return { message: "Mijoz qayta tiklandi" };
  }

  async updateManager({ managerId, customerId }: UpdateManagerDto) {
    const mamagerExist = await Employee.findById(managerId);

    if (!mamagerExist) {
      return { status: "error", message: "Meneger topilmadi." };
    }

    const customer = await Customer.findByIdAndUpdate(customerId, {
      manager: mamagerExist,
    });

    if (!customer) {
      return { status: "error", message: "Mijoz topilmadi." };
    }

    return { status: "ok", message: "Menejer yangilandi" };
  }

  async confirmationCustomer({ managerId, customerId }: UpdateManagerDto) {
    const mamagerExist = await Employee.findById(managerId);

    if (!mamagerExist) {
      return { status: "error", message: "Meneger topilmadi." };
    }

    const customer = await Customer.findByIdAndUpdate(customerId, {
      manager: mamagerExist,
      isActive: true,
    });

    if (!customer) {
      return { status: "error", message: "Mijoz topilmadi." };
    }

    return { status: "ok", message: "Menejer yangilandi" };
  }

  async sellerCreate(
    data: SellerCreateCustomerDto,
    user: IJwtUser,
    files?: any
  ) {
    const createBy = await Employee.findById(user.sub);
    if (!createBy) {
      throw BaseError.ForbiddenError();
    }
    if (data.phoneNumber) {
      const phoneExists = await Customer.findOne({
        phoneNumber: data.phoneNumber,
      });
      if (phoneExists) {
        throw BaseError.BadRequest(
          `Ushbu telefon raqami bilan mijoz allaqachon mavjud.`
        );
      }
    }
    if (data.passportSeries) {
      const passportExists = await Customer.findOne({
        passportSeries: data.passportSeries,
      });
      if (passportExists) {
        throw BaseError.BadRequest(
          "Ushbu passport seriyasi bilan mijoz allaqachon mavjud."
        );
      }
    }
    const auth = new Auth({});
    await auth.save();

    const customerFiles: any = {};
    if (files) {
      if (files.passport && files.passport[0]) {
        customerFiles.passport = files.passport[0].path;
      }
      if (files.shartnoma && files.shartnoma[0]) {
        customerFiles.shartnoma = files.shartnoma[0].path;
      }
      if (files.photo && files.photo[0]) {
        customerFiles.photo = files.photo[0].path;
      }
    }

    const customer = new Customer({
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      address: data.address,
      passportSeries: data.passportSeries,
      birthDate: data.birthDate,
      auth,
      isActive: false,
      createBy,
      files: customerFiles,
    });
    await customer.save();
    return { message: "Mijoz yaratildi.", customer };
  }
}

export default new CustomerService();
