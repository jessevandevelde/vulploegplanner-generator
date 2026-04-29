# Development setup

Use the same Node version everywhere. This project is pinned to Node `22.20.0` and npm `10.x`.

Recommended setup on Windows:

1. Install Node `22.20.0` with one version manager:
   - Volta: `volta install node@22.20.0 npm@10.9.3`
   - nvm-windows: `nvm install 22.20.0` then `nvm use 22.20.0`
   - fnm: `fnm install 22.20.0` then `fnm use`
2. From this project folder, install dependencies:
   - `npm ci`
3. Check the environment:
   - `npm run doctor`
4. Start the app:
   - `npm start`

Do not copy or depend on a `node` or `node_modules` folder next to the project. Everything the app needs, including `pdfjs-dist`, must come from this project's own `package-lock.json` and `node_modules`.

If PDF parsing breaks after switching machines, run `npm ci` again from the project folder.
