/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  // Cesium's static assets are served from /static/cesium/* — see CESIUM_BASE_URL
  // set in app/layout.tsx and components/Globe.tsx.
  webpack: (config, { isServer, webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify('/cesium'),
      })
    );
    config.output.sourcePrefix = '';
    config.module.noParse = /\/cesium\/Build\/Cesium\/Cesium\.js$/;

    if (!isServer) {
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
