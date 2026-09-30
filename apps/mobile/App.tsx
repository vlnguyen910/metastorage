import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthScreen } from "./src/features/auth/auth-screen";
import { authClient } from "./src/lib/auth-client";
import { CheckInScreen } from "./src/screens/check-in-screen";
import "./global.css";

export default function App() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const role = user && "role" in user ? user.role : undefined;
  const canOperateCheckIn = role === "FACILITY_STAFF" || role === "FACILITY_MANAGER";

  return (
    <SafeAreaProvider>
      {user && canOperateCheckIn ? <CheckInScreen user={user} /> : <AuthScreen />}
    </SafeAreaProvider>
  );
}
