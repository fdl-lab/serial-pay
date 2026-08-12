import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // スマホ実機から LAN IP で開いたときの警告対策
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.0/16", "192.168.40.0/24"],
};

export default nextConfig;
