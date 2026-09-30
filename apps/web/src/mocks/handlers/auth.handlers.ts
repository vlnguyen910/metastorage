import { ApiErrorCode, type LoginInput, type SessionTokens } from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import {
  createSession,
  currentUser,
  envelope,
  errorBody,
  parseBody,
  publicUser,
  tokenUserId,
} from "../core/http";
import { getMockDatabase } from "../database";

export function registerAuthHandlers(mock: MockAdapter): void {
  mock.onPost("/auth/login").reply((config) => {
    const database = getMockDatabase();
    const input = parseBody<LoginInput>(config.data);
    const user = database.users.find(
      (candidate) =>
        candidate.email.toLowerCase() === input.email.toLowerCase() &&
        candidate.password === input.password,
    );
    return user
      ? [200, envelope(createSession(user), "Đăng nhập thành công")]
      : [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Email hoặc mật khẩu không đúng")];
  });

  mock.onPost("/auth/refresh").reply((config) => {
    const database = getMockDatabase();
    const body = parseBody<{ refreshToken: string }>(config.data);
    const userId = tokenUserId(body.refreshToken, "refresh");
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) {
      return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn")];
    }
    const session = createSession(user);
    const tokens: SessionTokens = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    };
    return [200, envelope(tokens)];
  });

  mock.onGet("/auth/me").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    return user
      ? [200, envelope(publicUser(user))]
      : [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
  });

  mock.onPost("/auth/logout").reply(200, envelope(null, "Đăng xuất thành công"));

  mock
    .onPost("/auth/forgot-password")
    .reply(200, envelope(null, "Nếu email tồn tại, hướng dẫn đã được gửi"));
}
