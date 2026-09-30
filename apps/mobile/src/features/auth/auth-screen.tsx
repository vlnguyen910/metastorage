import { APP_NAME } from "@storex/shared";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FormFieldProps } from "./auth-screen.types";
import { useAuthFlow } from "./use-auth-flow";

export function AuthScreen() {
  const auth = useAuthFlow();

  if (auth.isSessionPending) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <StatusBar style="light" />
        <ActivityIndicator accessibilityLabel="Đang tải phiên đăng nhập" color="#34d399" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center px-5 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md gap-6">
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-emerald-400">{APP_NAME}</Text>
            <Text className="text-center text-base text-slate-300">
              {auth.user ? "Tài khoản Customer" : "Quản lý kho thuê trong một tài khoản"}
            </Text>
          </View>

          {auth.user ? (
            <View className="items-center gap-5 rounded-3xl border border-slate-700 bg-slate-900 p-6">
              <Text className="text-xl font-semibold text-white">Xin chào, {auth.user.name}</Text>
              <Text className="text-center text-slate-300">{auth.user.email}</Text>
              <ActionButton label="Đăng xuất" onPress={() => void auth.signOut()} />
            </View>
          ) : auth.registeredEmail ? (
            <View className="items-center gap-4 rounded-3xl border border-slate-700 bg-slate-900 p-6">
              <Text
                accessibilityRole="header"
                className="text-center text-2xl font-bold text-white"
              >
                Kiểm tra hộp thư
              </Text>
              <Text className="text-center leading-6 text-slate-300">
                Đã gửi liên kết xác minh đến {auth.registeredEmail}. Mở email này trên thiết bị để
                quay lại ứng dụng.
              </Text>
              <ActionButton label="Về đăng nhập" onPress={() => auth.setMode("login")} />
            </View>
          ) : (
            <View className="gap-4 rounded-3xl border border-slate-700 bg-slate-900 p-6">
              <Text accessibilityRole="header" className="text-2xl font-bold text-white">
                {auth.mode === "login" ? "Đăng nhập" : "Tạo tài khoản Customer"}
              </Text>

              {auth.mode === "register" ? (
                <FormField
                  label="Họ và tên"
                  value={auth.values.name}
                  error={auth.errors.name}
                  onChangeText={(value) => auth.updateField("name", value)}
                  autoComplete="name"
                />
              ) : null}
              <FormField
                label="Email"
                value={auth.values.email}
                error={auth.errors.email}
                onChangeText={(value) => auth.updateField("email", value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {auth.mode === "register" ? (
                <FormField
                  label="Số điện thoại"
                  value={auth.values.phone}
                  error={auth.errors.phone}
                  onChangeText={(value) => auth.updateField("phone", value)}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              ) : null}
              <FormField
                label="Mật khẩu"
                value={auth.values.password}
                error={auth.errors.password}
                onChangeText={(value) => auth.updateField("password", value)}
                secureTextEntry
                autoComplete={auth.mode === "login" ? "current-password" : "new-password"}
              />
              {auth.mode === "register" ? (
                <FormField
                  label="Nhập lại mật khẩu"
                  value={auth.values.confirmPassword}
                  error={auth.errors.confirmPassword}
                  onChangeText={(value) => auth.updateField("confirmPassword", value)}
                  secureTextEntry
                  autoComplete="new-password"
                />
              ) : null}

              {auth.message ? (
                <Text
                  accessibilityRole="alert"
                  className={auth.verificationFailed ? "text-amber-300" : "text-rose-300"}
                >
                  {auth.message}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-4 active:bg-emerald-600"
                disabled={auth.isSubmitting}
                onPress={() => void auth.submit()}
              >
                {auth.isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="font-bold text-slate-950">
                    {auth.mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                  </Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                className="min-h-11 items-center justify-center px-3"
                onPress={() => auth.setMode(auth.mode === "login" ? "register" : "login")}
              >
                <Text className="text-center font-medium text-emerald-300">
                  {auth.mode === "login"
                    ? "Chưa có tài khoản? Đăng ký Customer"
                    : "Đã có tài khoản? Đăng nhập"}
                </Text>
              </Pressable>
            </View>
          )}
          <Text className="text-center text-xs text-slate-500">
            Xác minh email trước khi đăng nhập. Số điện thoại dùng để tạo hồ sơ Customer.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({ label, value, error, onChangeText, ...inputProps }: FormFieldProps) {
  return (
    <View className="gap-2">
      <Text className="font-semibold text-slate-200">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        className="min-h-12 rounded-xl border border-slate-600 bg-slate-950 px-3 text-base text-white"
        placeholder={label}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        {...inputProps}
      />
      {error ? <Text className="text-sm text-rose-300">{error}</Text> : null}
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5"
      onPress={onPress}
    >
      <Text className="font-bold text-slate-950">{label}</Text>
    </Pressable>
  );
}
