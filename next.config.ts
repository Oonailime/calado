import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // Origins other than localhost that may load the dev server. Without them
  // Next refuses the dev connection and the page never hydrates: a phone on
  // the home Wi-Fi (192.168.x.x) and the Android emulator's host alias.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.0.2.2"],
};
export default config;
