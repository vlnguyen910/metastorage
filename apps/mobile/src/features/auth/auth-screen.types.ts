export interface FormFieldProps {
  label: string;
  value: string;
  error?: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoComplete?: "name" | "email" | "tel" | "current-password" | "new-password";
  autoCapitalize?: "none" | "sentences";
}
