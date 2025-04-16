require("dotenv").config({ path: "./.env" });
const CopyWebpackPlugin = require("copy-webpack-plugin");
const os = require("os");
const englishTranslation = require("./public/static/locales/en/common.json");
const { withAxiom } = require("next-axiom");
const { withSentryConfig } = require("@sentry/nextjs");
const { version } = require("./package.json");
const { i18n } = require("./next-i18next.config");

const {
  nextJsOrgRewriteConfig,
  orgUserRoutePath,
  orgUserTypeRoutePath,
  orgUserTypeEmbedRoutePath,
} = require("./.pagesAndRewritePaths");

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
  process.env.ORGANIZATIONS_ENABLED === "1" ||
  process.env.ORGANIZATIONS_ENABLED === "true";

const config = {
  i18n,
  env: {
    CAL_VERSION: version,
  },
  webpack(config) {
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "./.well-known",
            to: "../.well-known",
          },
        ],
      })
    );
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    config.resolve.fallback = {
      ...config.resolve.fallback,
      os: require.resolve("os-browserify/browser"),
    };

    return config;
  },
  async rewrites() {
    const { orgSlug } = nextJsOrgRewriteConfig;

    const beforeFiles = [
      {
        source: `/:locale/:path*`,
        destination: "/:path*",
      },
      {
        source: "/forms/:formQuery*",
        destination: "/apps/routing-forms/routing-link/:formQuery*",
      },
      {
        source: "/routing",
        destination: "/routing/forms",
      },
      {
        source: "/routing/:path*",
        destination: "/apps/routing-forms/:path*",
      },
      {
        source: "/success/:path*",
        has: [{ type: "query", key: "uid", value: "(?<uid>.*)" }],
        destination: "/booking/:uid/:path*",
      },
      {
        source: "/cancel/:path*",
        destination: "/booking/:path*",
      },
      {
        source: "/embed.js",
        destination: "/embed/embed.js",
      },
      {
        source: "/login",
        destination: "/auth/login",
      },
      ...(isOrganizationsEnabled
        ? [
            {
              source: orgUserRoutePath.source,
              destination: `/org/${orgSlug}/:user`,
            },
            {
              source: orgUserTypeRoutePath.source,
              destination: `/org/${orgSlug}/:user/:type`,
            },
            {
              source: orgUserTypeEmbedRoutePath.source,
              destination: `/org/${orgSlug}/:user/:type/embed`,
            },
          ]
        : []),
    ];

    const afterFiles = [];

    if (
      process.env.NEXT_PUBLIC_API_V2_URL &&
      (process.env.NEXT_PUBLIC_API_V2_URL.startsWith("/") ||
        process.env.NEXT_PUBLIC_API_V2_URL.startsWith("http"))
    ) {
      afterFiles.push({
        source: "/api/v2/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_V2_URL}/:path*`,
      });
    }

    if (
      process.env.NEXT_PUBLIC_WEBAPP_URL &&
      (process.env.NEXT_PUBLIC_WEBAPP_URL.startsWith("/") ||
        process.env.NEXT_PUBLIC_WEBAPP_URL.startsWith("http"))
    ) {
      afterFiles.push({
        source: "/icons/sprite.svg",
        destination: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/icons/sprite.svg`,
      });
    }

    return {
      beforeFiles,
      afterFiles,
    };
  },
};

module.exports = withAxiom(withSentryConfig(config));
