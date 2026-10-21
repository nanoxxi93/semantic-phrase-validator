import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  process.stdout.write(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode\n`);
});
