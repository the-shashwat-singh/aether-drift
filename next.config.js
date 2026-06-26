/** @type {import('next').NextConfig} */
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

const cesiumSource = path.join(__dirname, 'node_modules/cesium/Build/Cesium');

const nextConfig = {
  reactStrictMode: true,
  // Cesium's static assets are served from /static/cesium/* — see CESIUM_BASE_URL
  // set in app/layout.tsx and components/Globe.tsx.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            { from: path.join(cesiumSource, 'Workers'), to: '../public/cesium/Workers', info: { minimized: true } },
            { from: path.join(cesiumSource, 'ThirdParty'), to: '../public/cesium/ThirdParty', info: { minimized: true } },
            { from: path.join(cesiumSource, 'Assets'), to: '../public/cesium/Assets', info: { minimized: true } },
            { from: path.join(cesiumSource, 'Widgets'), to: '../public/cesium/Widgets', info: { minimized: true } },
          ],
        })
      );

      config.module.rules.push({
        test: /\.js$/,
        include: /node_modules[\\/]cesium/,
        use: { loader: 'strip-pragma-loader', options: { pragmas: { debug: false } } },
      });

      // Cesium expects to be loaded as a classic script / AMD-style global in some
      // internal paths; this keeps webpack from choking on `require` inside Cesium.
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  },
  // Cesium's static assets are served from /static/cesium/* — see CESIUM_BASE_URL
  // set in app/layout.tsx and components/Globe.tsx.
};

module.exports = nextConfig;
