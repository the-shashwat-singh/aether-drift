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
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    
    // Treat cesium as external so it's not bundled. We load it via a <script> tag.
    config.externals = [...(config.externals || []), { cesium: 'Cesium' }];
    
    return config;
  },
  // Cesium's static assets are served from /static/cesium/* — see CESIUM_BASE_URL
  // set in app/layout.tsx and components/Globe.tsx.
};

module.exports = nextConfig;
