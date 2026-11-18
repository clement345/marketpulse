import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "nodemailer"],
  poweredByHeader: false,
};

export default nextConfig;
