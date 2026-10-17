const { join, dirname } = require('node:path');
const { chromium } = require('@playwright/test');

function PlaywrightChromium(baseLauncherDecorator, captureTimeoutLauncherDecorator, retryLauncherDecorator) {
  // Keep Karma/Jasmine execution while using Playwright's installed browser and shutdown handling.
  baseLauncherDecorator(this);
  captureTimeoutLauncherDecorator(this);
  retryLauncherDecorator(this);
  this.name = 'PlaywrightChromium';
  let context;
  let closing = false;
  let starting = Promise.resolve();
  this.on('start', (url) => {
    starting = (async () => {
      context = await chromium.launchPersistentContext(join(dirname(process.env.WORKTRAIL_VERIFY_MANIFEST), 'karma-profile'), {
        headless: true,
        ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {})
      });
      context.on('close', () => { if (!closing) this._done('Chromium closed unexpectedly'); });
      await context.pages()[0].goto(url);
    })().catch(async (error) => {
      closing = true;
      await context?.close().catch(() => undefined);
      this._done(error.message);
    });
  });
  this.on('kill', (done) => {
    closing = true;
    starting.then(() => context?.close()).catch(() => undefined).then(() => { this._done(); done(); });
  });
}
PlaywrightChromium.$inject = ['baseLauncherDecorator', 'captureTimeoutLauncherDecorator', 'retryLauncherDecorator'];

module.exports = (config) => {
  const port = Number(process.env.WORKTRAIL_VERIFY_KARMA_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !process.env.WORKTRAIL_VERIFY_MANIFEST) throw new Error('Karma verification requires runner-owned configuration.');
  config.set({
    frameworks: ['jasmine'],
    plugins: [require('karma-jasmine'), require('karma-coverage'), { 'launcher:PlaywrightChromium': ['type', PlaywrightChromium] }],
    reporters: ['dots'],
    hostname: '127.0.0.1',
    listenAddress: '127.0.0.1',
    port,
    retryLimit: 0,
    browsers: ['PlaywrightChromium']
  });
};
