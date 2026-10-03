const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:1338',
      changeOrigin: true,
      logLevel: 'warn',
    })
  );

  // Proxy specifically for HMCC API
  app.use(
    '/external-api',
    createProxyMiddleware({
      target: process.env.REACT_APP_MAIN_URL,
      changeOrigin: true,
      pathRewrite: {
        '^/external-api': '/api',
      },
      logLevel: 'warn',
    })
  );
};
