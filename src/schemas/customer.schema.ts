import { Schema, model, Document } from "mongoose";
import { IEmployee } from "./employee.schema";
import { IAuth } from "./auth.schema";
import { BaseSchema, IBase } from "./base.schema";

export interface ICustomer extends IBase {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  passportSeries: string;
  birthDate: Date;
  telegramName: string;
  telegramId: string;
  // percent: number;
  auth: IAuth;
  manager: IEmployee;
  files?: {
    passport?: string;
    shartnoma?: string;
    photo?: string;
  };
}

const CustomerSchema = new Schema<ICustomer>(
  {
    ...BaseSchema,
    firstName: { type: String, required: true },
    lastName: { type: String },
    phoneNumber: { type: String },
    address: { type: String },
    passportSeries: { type: String },
    birthDate: { type: Date },
    telegramName: { type: String },
    telegramId: { type: String },
    // percent: { type: Number, default: 30 },
    auth: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Auth",
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    files: {
      passport: { type: String },
      shartnoma: { type: String },
      photo: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for contracts
CustomerSchema.virtual("contracts", {
  ref: "Contract",
  localField: "_id",
  foreignField: "customer",
});

const Customer = model<ICustomer>("Customer", CustomerSchema);

export default Customer;
