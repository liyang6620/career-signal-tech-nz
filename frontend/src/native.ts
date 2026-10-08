import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNativeApp = Capacitor.isNativePlatform();

export async function initializeNativeApp() {
  if (!isNativeApp) return;

  document.documentElement.classList.add("native-app");
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#f6f7f8" });

  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void App.minimizeApp();
  });
}
