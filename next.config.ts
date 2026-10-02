import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep visited pages in the client cache briefly so back/forth between months and tabs is instant.
    // Saving anything calls revalidatePath, which clears this cache.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
