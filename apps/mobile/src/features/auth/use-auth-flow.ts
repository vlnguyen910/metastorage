import { CustomerSignUpInputSchema } from "@metastorage/contracts";
import { useEffect, useState } from "react";
import { Linking as NativeLinking } from "react-native";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { AUTH_MESSAGES } from "./auth.messages";

type AuthMode = "login" | "register";
type SignupField = "name" | "email" | "phone" | "password" | "confirmPassword";
type SignupErrors = Partial<Record<SignupField, string>>;

const emptyValues = { name: "", email: "", phone: "", password: "", confirmPassword: "" };

export function useAuthFlow() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionState = authClient.useSession();

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      let verificationUrl: URL;
      try {
        verificationUrl = new URL(url);
      } catch {
        return;
      }
      if (
        verificationUrl.protocol !== "metastorage:" ||
        verificationUrl.hostname !== "auth" ||
        verificationUrl.pathname !== "/verified"
      ) {
        return;
      }
      const hasError = verificationUrl.searchParams.has("error");
      setVerificationFailed(hasError);
      setMessage(hasError ? AUTH_MESSAGES.verificationLinkInvalid : AUTH_MESSAGES.emailVerified);
      setRegisteredEmail(null);
      setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
      setMode("login");
    }

    void NativeLinking.getInitialURL().then(handleUrl);
    const subscription = NativeLinking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  function updateField(field: SignupField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  async function submit() {
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
        if (result.error?.code === "EMAIL_NOT_VERIFIED") {
          setMessage(AUTH_MESSAGES.emailNotVerified);
          return;
        }
        if (result.error) throw new Error(result.error.message);
        return;
      }

      const result = CustomerSignUpInputSchema.safeParse({
        ...values,
        callbackTarget: "mobile",
      });
      if (!result.success) {
        const nextErrors: SignupErrors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (field in emptyValues && !nextErrors[field as SignupField]) {
            nextErrors[field as SignupField] = issue.message;
          }
        }
        setErrors(nextErrors);
        return;
      }

      await api.auth.registerCustomer(result.data);
      setRegisteredEmail(result.data.email);
      setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    setMessage(null);
  }

  return {
    mode,
    setMode: (nextMode: AuthMode) => {
      setMode(nextMode);
      setErrors({});
      setMessage(null);
      setRegisteredEmail(null);
      setVerificationFailed(false);
    },
    values,
    errors,
    message,
    registeredEmail,
    verificationFailed,
    isSubmitting,
    user: sessionState.data?.user ?? null,
    isSessionPending: sessionState.isPending,
    updateField,
    submit,
    signOut,
  };
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object" && "data" in response) {
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return data.message;
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return AUTH_MESSAGES.requestFailed;
}
