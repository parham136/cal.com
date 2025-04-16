require("dotenv").config({ path: "../../../.env" });

const CopyWebpackPlugin = require("copy-webpack-plugin");
const { withAxiom } = require("next-axiom");
const { withSentryConfig } = require("@sentry/nextjs");
const { version } = require("./package.json");

if (process.env.NODE_ENV !== "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error("Please set NEXTAUTH_SECRET");
}
if (process.env.NODE_ENV !== "production" && !process.env.CALENDSO_ENCRYPTION_KEY) {
  throw new Error("Please set CALENDSO_ENCRYPTION_KEY");
}
if (process.env.NODE_ENV !== "production" && !process.env.NEXTAUTH_URL) {
  throw new Error("Please set NEXTAUTH_URL");
}
process.env.NEXT_PUBLIC_API_V2_URL = process.env.NEXT_PUBLIC_API_V2_URL || "https://dummy.api.local";

const config = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  productionBrowserSourceMaps: true,
  env: {
    NEXT_PUBLIC_CALCOM_VERSION: version,
    NEXT_PUBLIC_API_V2_URL: process.env.NEXT_PUBLIC_API_V2_URL,
  },
  webpack: (config) => {
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "./public/static/locales",
            to: "./public/static/locales"
          }
        ]
      })
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      os: false
    };
    return config;
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/forms/:formQuery*",
          destination: "/apps/routing-forms/routing-link/:formQuery*"
        }
      ]
    };
  }
};

module.exports = withSentryConfig(withAxiom(config));
