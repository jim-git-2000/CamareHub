import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.32.123"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://backend:8000/api/:path*"
      },
      {
        source: "/uploads/:path*",
        destination: "http://backend:8000/uploads/:path*"
      }
    ];
  }
};

export default nextConfig;
