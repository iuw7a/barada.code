/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SSE streaming breaks under gzip compression (responses get buffered),
  // so compression is off. Terminate gzip at the reverse proxy in production.
  compress: false,
};

export default nextConfig;
