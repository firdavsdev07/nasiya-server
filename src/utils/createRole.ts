import { Permission } from "../enums/permission.enum";
import { Role } from "../schemas/role.schema";

const seedRoles = async () => {
  const roleCount = await Role.countDocuments();
  if (roleCount > 0) {
    console.log("Roles already exist. Updating permissions...");

    // Mavjud rolelarni yangilash
    await Role.findOneAndUpdate(
      { name: "seller" },
      {
        permissions: [
          Permission.VIEW_CUSTOMER,
          Permission.CREATE_CUSTOMER,
          Permission.VIEW_CONTRACT,
          Permission.CREATE_CONTRACT,
          Permission.CONTRACT_CREATE_MANAGER,
          Permission.CUSTOMER_CREATE_MANAGER,
          Permission.VIEW_PAYMENT,
          Permission.CREATE_PAYMENT,
          Permission.VIEW_DASHBOARD,
        ],
      }
    );

    await Role.findOneAndUpdate(
      { name: "manager" },
      {
        permissions: [
          Permission.VIEW_CUSTOMER,
          Permission.CREATE_CUSTOMER,
          Permission.UPDATE_CUSTOMER,
          Permission.VIEW_CONTRACT,
          Permission.CREATE_CONTRACT,
          Permission.UPDATE_CONTRACT,
          Permission.VIEW_DEBTOR,
          Permission.VIEW_CASH,
          Permission.CREATE_CASH,
          Permission.UPDATE_CASH, // Manager ham tasdiqlashi mumkin
          Permission.VIEW_DASHBOARD,
        ],
      }
    );

    // Employee'larning permissionlarini yangilash
    const Employee = (await import("../schemas/employee.schema")).default;

    // Manager role'dagi employee'larni yangilash
    const managerRole = await Role.findOne({ name: "manager" });
    if (managerRole) {
      await Employee.updateMany(
        { role: managerRole._id },
        {
          $set: {
            permissions: [
              Permission.VIEW_CUSTOMER,
              Permission.CREATE_CUSTOMER,
              Permission.UPDATE_CUSTOMER,
              Permission.VIEW_CONTRACT,
              Permission.CREATE_CONTRACT,
              Permission.UPDATE_CONTRACT,
              Permission.VIEW_DEBTOR,
              Permission.VIEW_CASH,
              Permission.CREATE_CASH,
              Permission.UPDATE_CASH, // Manager ham tasdiqlashi mumkin
              Permission.VIEW_DASHBOARD,
            ],
          },
        }
      );
      console.log("Manager employees permissions updated (UPDATE_CASH added).");
    }

    // Seller role'dagi employee'larni yangilash
    const sellerRole = await Role.findOne({ name: "seller" });
    if (sellerRole) {
      await Employee.updateMany(
        { role: sellerRole._id, permissions: { $size: 0 } },
        {
          $set: {
            permissions: [
              Permission.VIEW_CUSTOMER,
              Permission.CREATE_CUSTOMER,
              Permission.VIEW_CONTRACT,
              Permission.CREATE_CONTRACT,
              Permission.CONTRACT_CREATE_MANAGER,
              Permission.CUSTOMER_CREATE_MANAGER,
              Permission.VIEW_PAYMENT,
              Permission.CREATE_PAYMENT,
              Permission.VIEW_DASHBOARD,
            ],
          },
        }
      );
      console.log("Seller employees permissions updated.");
    }

    // Moderator role'dagi employee'larni yangilash
    const moderatorRole = await Role.findOne({ name: "moderator" });
    if (moderatorRole) {
      const allPermissions = Object.values(Permission);
      await Employee.updateMany(
        {
          role: moderatorRole._id,
          $expr: { $lt: [{ $size: "$permissions" }, allPermissions.length] },
        },
        {
          $set: {
            permissions: allPermissions,
          },
        }
      );
      console.log(
        `Moderator employees permissions updated to ${allPermissions.length} permissions.`
      );
    }

    // Admin role'dagi employee'larni yangilash
    const adminRole = await Role.findOne({ name: "admin" });
    if (adminRole) {
      const allPermissions = Object.values(Permission);
      await Employee.updateMany(
        {
          role: adminRole._id,
          $expr: { $lt: [{ $size: "$permissions" }, allPermissions.length] },
        },
        {
          $set: {
            permissions: allPermissions,
          },
        }
      );
      console.log(
        `Admin employees permissions updated to ${allPermissions.length} permissions.`
      );
    }

    console.log("Roles permissions updated.");
  } else {
    console.log("Seeding roles...");
    await Role.create([
      {
        name: "admin",
        permissions: Object.values(Permission),
      },
      {
        name: "seller",
        permissions: [
          Permission.VIEW_CUSTOMER,
          Permission.CREATE_CUSTOMER,
          Permission.VIEW_CONTRACT,
          Permission.CREATE_CONTRACT,
          Permission.CONTRACT_CREATE_MANAGER,
          Permission.CUSTOMER_CREATE_MANAGER,
          Permission.VIEW_PAYMENT,
          Permission.CREATE_PAYMENT,
          Permission.VIEW_DASHBOARD,
        ],
      },
      {
        name: "manager",
        permissions: [
          Permission.VIEW_CUSTOMER,
          Permission.CREATE_CUSTOMER,
          Permission.UPDATE_CUSTOMER,
          Permission.VIEW_CONTRACT,
          Permission.CREATE_CONTRACT,
          Permission.UPDATE_CONTRACT,
          Permission.VIEW_DEBTOR,
          Permission.VIEW_CASH,
          Permission.CREATE_CASH,
          Permission.UPDATE_CASH, // Manager ham tasdiqlashi mumkin
          Permission.VIEW_DASHBOARD,
        ],
      },
      {
        name: "moderator",
        permissions: Object.values(Permission),
      },
    ]);
    console.log("Roles created");
  }
};

export default seedRoles;
