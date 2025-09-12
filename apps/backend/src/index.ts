import { buildServer } from './server.js';
import { config } from './config.js';
import { Ingestor } from './ingestor.js';

const app = buildServer();

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then((addr) => {
    app.log.info(`Backend listening at ${addr}`);
    // Start ingestor loop
    const ingestor = new Ingestor();
    ingestor.start();
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
