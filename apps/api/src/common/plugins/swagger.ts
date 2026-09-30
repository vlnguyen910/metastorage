import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "../../config/env";

const openApiSchemaTransform = createJsonSchemaTransform({
  zodToJsonConfig: { target: "openapi-3.0" },
});

const swaggerPluginCallback: FastifyPluginAsync = async (fastify) => {
  if (env.NODE_ENV === "production") {
    return;
  }

  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "metastorage API",
        description: "HTTP API for the metastorage platform",
        version: "0.0.1",
      },
      paths: {
        "/api/auth/sign-in/email": {
          post: {
            tags: ["Authentication"],
            summary: "Sign in with email and password",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 8, format: "password" },
                      rememberMe: { type: "boolean", default: true },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Session cookie created" },
              "401": { description: "Invalid email or password" },
            },
          },
        },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: "Local development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: openApiSchemaTransform,
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      deepLinking: true,
      docExpansion: "list",
      withCredentials: true,
    },
    staticCSP: true,
  });
};

export const swaggerPlugin = fp(swaggerPluginCallback, {
  name: "swagger-plugin",
});
