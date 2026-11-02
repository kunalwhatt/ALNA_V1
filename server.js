import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'dist');
const indexHtmlPath = path.join(distPath, 'index.html');

// If Azure App Service deployed the source without running 'npm run build', build automatically
if (!fs.existsSync(indexHtmlPath)) {
  console.log('dist/index.html not found. Running vite build for production...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('Production build failed:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static compiled assets from dist/
app.use(express.static(distPath));

// SPA fallback: always send compiled dist/index.html
app.get('*', (_req, res) => {
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(500).send('Application build missing. Ensure "npm run build" succeeds.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
