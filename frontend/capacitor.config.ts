import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "nz.co.careersignal.app",
  appName: "CareerSignal",
  webDir: "dist",
  backgroundColor: "#f6f7f8",
  android: {
    backgroundColor: "#f6f7f8",
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      backgroundColor: "#173a55",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
