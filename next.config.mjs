/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Next checks that a Server Action's Origin header matches the Host
      // it's served from, to block cross-site form submission. A tunnel
      // (ngrok, Cloudflare Tunnel) puts a different public hostname in
      // front, so every write in this app — login, add to order, place
      // order — would otherwise fail with a 500. Wildcards cover ngrok's
      // random subdomain on every restart. See architecture.md §9.
      allowedOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app"],
    },
  },
};

export default nextConfig;
