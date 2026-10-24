import { config } from './config.js';
import './db.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Sales Coaching Platform API on http://localhost:${config.port}`);
  console.log(`Data dir: ${config.dataDir}`);
});
