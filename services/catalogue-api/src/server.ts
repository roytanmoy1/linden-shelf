import { createServer } from 'node:http';
import { createApp } from './app.js';
import { CatalogueService } from './catalogue/catalogue-service.js';
import { FakeStoreProductSource } from './catalogue/fake-store-source.js';
import { readConfig } from './config.js';
import { createSmtpTransport, SmtpEnquiryMailer } from './enquiries/smtp-mailer.js';

try {
  const config = readConfig(process.env);
  const transport = createSmtpTransport(config);
  const app = createApp({
    catalogue: new CatalogueService(new FakeStoreProductSource(config), config.featuredProductIds),
    mailer: new SmtpEnquiryMailer(transport, config),
    allowedOrigins: config.allowedOrigins,
    trustIngressProxy: config.trustIngressProxy,
  });
  const server = createServer({ headersTimeout: 10000, requestTimeout: 15000 }, app);
  server.once('error', () => {
    transport.close();
    console.error(JSON.stringify({ event: 'api_start_failed' }));
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    console.log(JSON.stringify({ event: 'api_listening', host: config.host, port: config.port }));
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      transport.close();
      process.exitCode = 1;
    }, 20000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      transport.close();
      console.log(JSON.stringify({ event: 'api_stopped' }));
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch {
  console.error(JSON.stringify({ event: 'api_start_failed' }));
  process.exitCode = 1;
}