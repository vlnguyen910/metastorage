import {
  and,
  type Customer,
  customers,
  type Database,
  eq,
  isNull,
  sql,
  users,
} from "@storex/database";
import { ConflictError } from "../../common/errors/app-error";

export interface VerifiedCustomerRegistrationUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export class CustomerRegistrationRepository {
  constructor(private readonly db: Database) {}

  async findRegistrationIdentity(email: string) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(btrim(${users.email})) = ${email}`)
      .limit(1);
    const [customer] = await this.db
      .select({ userId: customers.userId })
      .from(customers)
      .where(sql`lower(btrim(${customers.email})) = ${email}`)
      .limit(1);

    return {
      userExists: Boolean(user),
      customerUserId: customer?.userId ?? null,
    };
  }

  async reconcileVerifiedUser(user: VerifiedCustomerRegistrationUser): Promise<Customer> {
    return this.db.transaction(async (tx) => {
      const normalizedEmail = user.email.trim().toLowerCase();
      const [existingCustomer] = await tx
        .select()
        .from(customers)
        .where(sql`lower(btrim(${customers.email})) = ${normalizedEmail}`)
        .for("update");

      if (existingCustomer) {
        return this.attachUserToCustomer(tx, existingCustomer, user.id);
      }

      const [createdCustomer] = await tx
        .insert(customers)
        .values({
          userId: user.id,
          fullName: user.name,
          email: normalizedEmail,
          phone: user.phone,
        })
        .onConflictDoNothing()
        .returning();
      if (createdCustomer) return createdCustomer;

      // Another verification or checkout may have created the normalized-email row
      // while this transaction attempted its insert. Lock and reconcile that row.
      const [concurrentCustomer] = await tx
        .select()
        .from(customers)
        .where(sql`lower(btrim(${customers.email})) = ${normalizedEmail}`)
        .for("update");
      if (!concurrentCustomer) {
        throw new Error("Customer reconciliation failed after a concurrent insert");
      }

      return this.attachUserToCustomer(tx, concurrentCustomer, user.id);
    });
  }

  private async attachUserToCustomer(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    customer: Customer,
    userId: string,
  ): Promise<Customer> {
    if (customer.userId === userId) return customer;
    if (customer.userId) {
      throw new ConflictError(
        "Email đã liên kết với tài khoản khác. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
      );
    }

    const [linkedCustomer] = await tx
      .update(customers)
      .set({ userId, updatedAt: new Date() })
      .where(and(eq(customers.id, customer.id), isNull(customers.userId)))
      .returning();
    if (linkedCustomer) return linkedCustomer;

    // The unique userId index is the final guard if another request won the link.
    const [currentCustomer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, customer.id))
      .for("update");
    if (currentCustomer?.userId === userId) return currentCustomer;
    throw new ConflictError(
      "Email đã liên kết với tài khoản khác. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
    );
  }
}
