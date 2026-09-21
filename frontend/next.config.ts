import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted here; sibling lockfiles make it walk up to c:\Projects\code.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
