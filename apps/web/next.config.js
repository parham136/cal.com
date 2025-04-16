require("dotenv").config({ path: "../../../.env" });
const CopyWebpackPlugin = require("copy-webpack-plugin");
const os = require("os");
const englishTranslation = require("./public/static/locales/en/common.json");
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

if (!process.env.NEXT_PUBLIC_API_V2_URL) {
  console.error("Please set NEXT_PUBLIC_API_V2_URL");
}

const isOrganizationsEnabled =
  process.env.ORGANIZATIONS_ENABLED === "1" || process.env.ORGANIZATIONS_ENABLED === "true";

const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: true,
    typedRoutes: true
  },
  i18n: {
    locales: ["en"],
    defaultLocale: "en"
  },
  env: {
    VERSION: version,
    ORGANIZATIONS_ENABLED: isOrganizationsEnabled,
    NEXT_PUBLIC_CALCOM_VERSION: version,
  },
  webpack: (config, { isServer }) => {
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
          // Handles locale-prefixed dynamic paths
          source: `/:locale/:path*`,
          destination: `/:path*`
        },
        {
          source: "/forms/:formQuery*",
          destination: "/apps/routing-forms/routing-link/:formQuery*"
        },
        ...orgSlug
      ]
    };
  }
};

module.exports = withAxiom(withSentryConfig(nextConfig));
