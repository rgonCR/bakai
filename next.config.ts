import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Libera /_next/* no dev ao abrir pela IP da LAN (não só localhost)
  allowedDevOrigins: ["192.168.1.14", "127.0.0.1"],
};

export default nextConfig;
