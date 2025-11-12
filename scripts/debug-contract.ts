import "dotenv/config";
import connectDB from "../src/config/db";
import Customer from "../src/schemas/customer.schema";
import Contract from "../src/schemas/contract.schema";

async function debugContract() {
  try {
    await connectDB();

    const customer = await Customer.findOne({
      firstName: "YASHNAR",
      lastName: "FAYZULLA",
    });

    if (!customer) {
      console.log("❌ Customer not found");
      process.exit(1);
    }

    const contract = await Contract.findOne({
      customer: customer._id,
    });

    if (!contract) {
      console.log("❌ Contract not found");
      process.exit(1);
    }

    console.log("Contract:", {
      _id: contract._id,
      customer: contract.customer,
      productName: contract.productName,
      startDate: contract.startDate,
      payments: contract.payments,
      paymentsLength: contract.payments?.length || 0,
    });

    process.exit(0);
  } catch (error: any) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

debugContract();
