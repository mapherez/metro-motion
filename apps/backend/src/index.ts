import { buildServer } from './server';
import { config } from './config';
import { Ingestor } from './ingestor';

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
