import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#101827" },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#F5F7FA" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "HoopCheck", headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
