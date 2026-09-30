import { CustomerSignUpInputSchema } from "@metastorage/contracts";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import { AppError, ConflictError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { CUSTOMER_REGISTRATION_MESSAGES } from "../customers/customer-registration.messages";
import { CustomerRegistrationRepository } from "../customers/customer-registration.repository";
import { CustomerRegistrationService } from "../customers/customer-registration.service";
import { auth } from "./auth";
import { AUTH_MESSAGES } from "./auth.messages";
import { getCustomerSignupCallbackUrl } from "./customer-signup.callback";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const customerRegistration = new CustomerRegistrationService(
    new CustomerRegistrationRepository(fastify.db),
  );

  fastify.post("/customer-sign-up", async (request, reply) => {
    const input = CustomerSignUpInputSchema.parse(request.body);
    await customerRegistration.assertEmailCanRegister(input.email);

    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      throw new AppError(
        AUTH_MESSAGES.customerSignupEmailDeliveryUnavailable,
        503,
        "EMAIL_DELIVERY_UNAVAILABLE",
      );
    }

    const callbackURL = getCustomerSignupCallbackUrl(
      input.callbackTarget,
      env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
    );

    if (!callbackURL) {
      throw new Error(AUTH_MESSAGES.noTrustedWebOriginForEmailVerification);
    }

    try {
      await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          phone: input.phone,
          callbackURL,
        },
        headers: fromNodeHeaders(request.headers),
      });
    } catch (error) {
      if (isEmailConflict(error)) {
        throw new ConflictError(CUSTOMER_REGISTRATION_MESSAGES.accountRecovery);
      }
      throw error;
    }

    return reply.status(202).send({
      message: AUTH_MESSAGES.customerSignupVerificationEmailSent,
    });
  });

  fastify.route({
    method: ["GET", "POST"],
    url: "/*",
    async handler(request, reply) {
      // Construct request URL
      const url = new URL(request.url, env.BETTER_AUTH_URL);

      if (request.method === "POST" && url.pathname.endsWith("/sign-up/email")) {
        return reply.status(404).send({
          message: AUTH_MESSAGES.customerSignupMustUseCustomerEndpoint,
        });
      }

      // Convert Fastify headers to standard Headers object
      const headers = fromNodeHeaders(request.headers);

      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      // Process authentication request
      const response = await auth.handler(req);

      // Forward response to client
      reply.status(response.status);
      // biome-ignore lint/suspicious/useIterableCallbackReturn: <have no idea>
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });
};

function isEmailConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errorRecord = error as { code?: string; body?: { code?: string } };
  return (
    errorRecord.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    errorRecord.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  );
}
