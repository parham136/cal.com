require("dotenv").config({ path: "../../.env" });
const CopyWebpackPlugin = require("copy-webpack-plugin");
const os = require("os");
const englishTranslation = require("./public/static/locales/en/common.json");
const { withAxiom } = require("next-axiom");
const { withSentryConfig } = require("@sentry/nextjs");
const { version } = require("./package.json");

const {
  i18n: { locales },
} = require("./next-i18next.config");

const {
  nextJsOrgRewriteConfig,
  orgUserRoutePath,
  orgUserTypeRoutePath,
  orgUserTypeEmbedRoutePath,
} = require("./pagesAndRewritePaths");

const getHttpsUrl = (url) => url?.startsWith("http://") ? url.replace("http://", "https://") : url;

const validJson = (json) => {
  try {
    const o = JSON.parse(json);
    return o && typeof o === "object" ? o : false;
  } catch {
    return false;
  }
};

if (process.env.NODE_ENV !== "production") {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("Please set NEXTAUTH_SECRET");
  if (!process.env.CALENDSO_ENCRYPTION_KEY) throw new Error("Please set CALENDSO_ENCRYPTION_KEY");
  if (!process.env.NEXTAUTH_URL) throw new Error("Please set NEXTAUTH_URL");
}

if (!process.env.NEXT_PUBLIC_API_V2_URL) {
  console.error("Please set NEXT_PUBLIC_API_V2_URL");
}

if (process.env.VERCEL_URL && !process.env.NEXT_PUBLIC_WEBAPP_URL) {
  process.env.NEXT_PUBLIC_WEBAPP_URL = `https://${process.env.VERCEL_URL}`;
}
if (!process.env.NEXTAUTH_URL && process.env.NEXT_PUBLIC_WEBAPP_URL) {
  process.env.NEXTAUTH_URL = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/auth`;
}
if (!process.env.NEXT_PUBLIC_WEBSITE_URL) {
  process.env.NEXT_PUBLIC_WEBSITE_URL = process.env.NEXT_PUBLIC_WEBAPP_URL;
}
if (process.argv.includes("--experimental-https")) {
  process.env.NEXT_PUBLIC_WEBAPP_URL = getHttpsUrl(process.env.NEXT_PUBLIC_WEBAPP_URL);
  process.env.NEXTAUTH_URL = getHttpsUrl(process.env.NEXTAUTH_URL);
  process.env.NEXT_PUBLIC_EMBED_LIB_URL = getHttpsUrl(process.env.NEXT_PUBLIC_EMBED_LIB_URL);
}
if (process.env.GOOGLE_API_CREDENTIALS && !validJson(process.env.GOOGLE_API_CREDENTIALS)) {
  console.warn("Invalid GOOGLE_API_CREDENTIALS — Google integration disabled.");
}
if (!process.env.EMAIL_FROM) {
  console.warn("EMAIL_FROM is not set — mailing may be disabled.");
}
if (
  process.env.CSP_POLICY === "strict" &&
  ["production"].includes(process.env.NODE_ENV || process.env.CALCOM_ENV)
) {
  throw new Error("Strict CSP not supported in production");
}

const isOrganizationsEnabled =
  process.env.ORGANIZATIONS_ENABLED === "1" ||
  process.env.ORGANIZATIONS_ENABLED === "true";

process.env.NEXT_PUBLIC_CALCOM_VERSION = version;

const informAboutDuplicateTranslations = () => {
  const map = {};
  for (const key in englishTranslation) {
    const value = englishTranslation[key];
    if (map[value]) {
      console.warn("Duplicate i18n value:", key, "and", map[value]);
    } else {
      map[value] = key;
    }
  }
};
informAboutDuplicateTranslations();

const plugins = [];

if (process.env.ANALYZE === "true") {
  const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: true });
  plugins.push(withBundleAnalyzer);
}

plugins.push(withAxiom);

const orgDomainMatcherConfig = {
  root: !nextJsOrgRewriteConfig.disableRootPathRewrite && {
    has: [{ type: "host", value: nextJsOrgRewriteConfig.orgHostPath }],
    source: "/",
  },
  rootEmbed: !nextJsOrgRewriteConfig.disableRootEmbedPathRewrite && {
    has: [{ type: "host", value: nextJsOrgRewriteConfig.orgHostPath }],
    source: "/embed",
  },
  user: {
    has: [{ type: "host", value: nextJsOrgRewriteConfig.orgHostPath }],
    source: orgUserRoutePath,
  },
  userType: {
    has: [{ type: "host", value: nextJsOrgRewriteConfig.orgHostPath }],
    source: orgUserTypeRoutePath,
  },
  userTypeEmbed: {
    has: [{ type: "host", value: nextJsOrgRewriteConfig.orgHostPath }],
    source: orgUserTypeEmbedRoutePath,
  },
};

const nextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  serverExternalPackages: ["deasync", "http-cookie-agent", "rest-facade", "superagent-proxy", "superagent", "formidable"],
  experimental: {
    optimizePackageImports: ["@calcom/ui"],
    turbo: {},
  },
  productionBrowserSourceMaps: process.env.SENTRY_DISABLE_CLIENT_SOURCE_MAPS === "0",
  typescript: { ignoreBuildErrors: !!process.env.CI },
  eslint: { ignoreDuringBuilds: !!process.env.CI },
  transpilePackages: [
    "@calcom/app-store", "@calcom/dayjs", "@calcom/emails", "@calcom/embed-core",
    "@calcom/embed-react", "@calcom/embed-snippet", "@calcom/features", "@calcom/lib",
    "@calcom/prisma", "@calcom/trpc"
  ],
  modularizeImports: {
    "@calcom/features/insights/components": {
      transform: "@calcom/features/insights/components/{{member}}",
      skipDefaultConversion: true,
      preventFullImport: true,
    },
    lodash: {
      transform: "lodash/{{member}}",
    },
  },
  images: { unoptimized: true },
  webpack: (config, { webpack, buildId, isServer }) => {
    if (isServer) {
      if (process.env.SENTRY_DISABLE_SERVER_SOURCE_MAPS === "1") config.devtool = false;
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /(^@google-cloud|^aws-crt|^better-sqlite3$|^bson-ext$|^cardinal$|^ioredis$|^mysql$|^pg-native$)/,
        })
      );
      config.externals.push("formidable");
    }
    config.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_DEBUG__: false,
        __SENTRY_TRACING__: false,
        "process.env.BUILD_ID": JSON.stringify(buildId),
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "../../packages/app-store/**/static/**",
            to({ context, absoluteFilename }) {
              const appName = /app-store\/(.*)\/static/.exec(absoluteFilename.replaceAll("\\", "/"));
              return `${context.replaceAll("\\", "/")}/public/app-store/${appName[1]}/[name][ext]`;
            },
          },
        ],
      })
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      "pg-native": false,
    };
    config.module.rules.push({
      test: [/lib\/.*.tsx?/i],
      sideEffects: false,
    });
    return config;
  },
  async rewrites() {
    const { orgSlug } = nextJsOrgRewriteConfig;

    const beforeFiles = [
      { source: `/:locale/:path*`, destination: "/:path*" },
      { source: "/forms/:formQuery*", destination: "/apps/routing-forms/routing-link/:formQuery*" },
      { source: "/routing", destination: "/routing/forms" },
      { source: "/routing/:path*", destination: "/apps/routing-forms/:path*" },
      { source: "/success/:path*", has: [{ type: "query", key: "uid", value: "(?<uid>.*)" }], destination: "/booking/:uid/:path*" },
      { source: "/cancel/:path*", destination: "/booking/:path*" },
      { source: "/embed.js", destination: "/embed/embed.js" },
      { source: "/login", destination: "/auth/login" },
      ...(isOrganizationsEnabled ? [
        orgDomainMatcherConfig.root && {
          ...orgDomainMatcherConfig.root,
          destination: `/team/${orgSlug}?isOrgProfile=1`,
        },
        orgDomainMatcherConfig.rootEmbed && {
          ...orgDomainMatcherConfig.rootEmbed,
          destination: `/team/${orgSlug}/embed?isOrgProfile=1`,
        },
        { ...orgDomainMatcherConfig.user, destination: `/org/${orgSlug}/:user` },
        { ...orgDomainMatcherConfig.userType, destination: `/org/${orgSlug}/:user/:type` },
        { ...orgDomainMatcherConfig.userTypeEmbed, destination: `/org/${orgSlug}/:user/:type/embed` },
      ] : []),
    ].filter(Boolean);

    const afterFiles = [
      { source: "/api/v2/:path*", destination: `${process.env.NEXT_PUBLIC_API_V2_URL}/:path*` },
      { source: "/icons/sprite.svg", destination: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/icons/sprite.svg` },
    ];

    return { beforeFiles, afterFiles };
  },
};

if (!!process.env.NEXT_PUBLIC_SENTRY_DSN) {
  plugins.push((cfg) =>
    withSentryConfig(cfg, {
      autoInstrumentServerFunctions: false,
      hideSourceMaps: true,
      disableServerWebpackPlugin: !!process.env.SENTRY_DISABLE_SERVER_WEBPACK_PLUGIN,
      silent: false,
      sourcemaps: { disable: process.env.SENTRY_DISABLE_SERVER_SOURCE_MAPS === "1" },
    })
  );
}

module.exports = () => plugins.reduce((acc, next) => next(acc), nextConfig);
