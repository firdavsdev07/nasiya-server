import Currency from "../schemas/currency.schema";

const createCurrency = async () => {
  try {
    const existingCurrency = await Currency.findOne({
      name: "USD",
    });

    if (existingCurrency) {
      console.log("Currency already exists");
    } else {
      const currency = new Currency({
        name: "USD",
        anoumt: 0,
      });

      await currency.save();
      console.log("Currency created successfully");
    }
  } catch (error) {
    console.error("Error creating Currency :", error);
  }
};

export default createCurrency;
