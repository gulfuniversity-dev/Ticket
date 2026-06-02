/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-lib and qrcode run only inside route handlers (Node runtime); nothing extra needed.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow Excel uploads
    },
  },
};

module.exports = nextConfig;
