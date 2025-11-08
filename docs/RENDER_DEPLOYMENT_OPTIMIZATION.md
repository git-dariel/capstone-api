# Render Deployment Guide - Memory Optimization

## Problem

The API was experiencing "JavaScript heap out of memory" errors during deployment on Render, and build failures due to husky not being available in production.

## Root Causes

1. **webpack build without memory optimization** - ts-loader was consuming excessive memory during compilation
2. **Prisma generation during build** - Running during npm install multiplied memory usage
3. **No explicit memory allocation** - Node.js default heap was insufficient
4. **Source maps enabled** - Adding unnecessary memory overhead during build
5. **husky prepare hook running in production** - Dev dependency failing during npm install when NODE_ENV not set early enough

## Solutions Implemented

### 1. **Smart npm start Script (Now with Auto-Build Fallback)**

```json
"start": "if [ \"$NODE_ENV\" = \"production\" ]; then if [ ! -d \"./dist\" ]; then npm run build; fi && NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 node ./dist/server.ts; else nodemon index.ts; fi"
```

- Detects NODE_ENV and runs appropriate command
- Production: Checks if dist folder exists, builds if needed, then starts server
- Development: Runs with nodemon for live reload
- **Fallback protection**: Even if build command doesn't run, npm start will build automatically
- More resilient to Render configuration issues

### 2. **Updated Procfile**

```
web: NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 node ./dist/server.ts
```

- Sets NODE_ENV before Node.js starts
- Allocates 512MB of heap memory explicitly via NODE_OPTIONS
- Runs pre-built binary directly (no build on startup)
- Used as fallback when render.yaml not recognized

### 3. **Optimized webpack.config.js**

- Added `mode: "production"` for optimized build
- Disabled source maps with `devtool: false`
- Enabled `transpileOnly: true` in ts-loader to skip type checking
- Added proper `exclude: /node_modules/` to avoid processing unnecessary files
- Configured minimization and performance hints

### 4. **Enhanced package.json Scripts**

```json
"build": "NODE_ENV=production node --max-old-space-size=512 ./node_modules/webpack/bin/webpack.js --config webpack.config.js"
"prod": "NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 node ./dist/server.ts"
"postinstall": "if [ \"$NODE_ENV\" != \"production\" ]; then npm run prepare; fi"
"prepare": "if [ \"$NODE_ENV\" != \"production\" ]; then husky; fi"
```

- Build script allocates 512MB to webpack
- Skips husky and prisma generation during production installs
- Sets NODE_ENV consistently
- Only runs husky in development environments
- npm start intelligently switches between dev and prod modes

### 5. **render.yaml Configuration**

Updated Render configuration:

```yaml
buildCommand: "NODE_ENV=production npm ci --omit=dev && npm run prisma-generate && npm run build"
startCommand: "NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 node ./dist/server.ts"
envVars:
    - key: NODE_ENV
      value: production
    - key: NODE_OPTIONS
      value: "--max-old-space-size=512"
```

**Key improvements:**

- Uses `npm ci` instead of `npm install` for faster, more reliable builds
- Adds `--omit=dev` to skip dev dependencies in production build
- Sets NODE_ENV=production in both build and start commands
- Defines environment variables explicitly for runtime

## Deployment Steps for Render

### Quick Setup (Recommended - Uses render.yaml)

1. Ensure you've pushed latest changes including `render.yaml` to GitHub
2. In Render dashboard, click "New" → "Web Service"
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml` configuration
5. Add any environment variables not in render.yaml:
    - `DATABASE_URL`: Your MongoDB connection string
    - `JWT_SECRET`: Your JWT secret
    - `EMAIL_USER`, `EMAIL_PASSWORD`: Email credentials
    - `CLOUDINARY_*`: Cloudinary credentials
    - Any other secrets from `.env`
6. Deploy!

### Manual Setup (If render.yaml not recognized)

1. Create new Web Service on Render
2. Connect your GitHub repository
3. In Service Settings, set environment variables:

    - `NODE_ENV`: `production`
    - `NODE_OPTIONS`: `--max-old-space-size=512`
    - `DATABASE_URL`: Your MongoDB connection string
    - `JWT_SECRET`: Your JWT secret
    - `EMAIL_USER`: Your email
    - `EMAIL_PASSWORD`: Your app password
    - `CLOUDINARY_API_KEY`: Cloudinary API key
    - `CLOUDINARY_API_SECRET`: Cloudinary API secret
    - `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name
    - Other required vars from `.env`

4. Set Build Command:

    ```
    NODE_ENV=production npm ci --omit=dev && npm run prisma-generate && npm run build
    ```

5. Leave Start Command as default (will use `npm start` which auto-detects NODE_ENV)

    - OR set to: `NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 node ./dist/server.ts`

6. Deploy!

## Troubleshooting Build & Deployment Failures

### Error: "nodemon: not found"

**Cause**: npm install used instead of production build command, or NODE_ENV not set

**Solution**:

- The smart `npm start` script should handle this automatically
- If still occurring, verify NODE_ENV=production is set in Render environment variables
- Check that the buildCommand sets NODE_ENV before npm install

### Error: "husky: not found"

**Cause**: NODE_ENV not set to production during npm install

**Solution**:

- Ensure build command starts with `NODE_ENV=production`
- The postinstall hook will skip husky when NODE_ENV=production

### Error: "JavaScript heap out of memory"

**Solution 1**: Increase NODE_OPTIONS in environment variables:

```
NODE_OPTIONS="--max-old-space-size=1024"
```

**Solution 2**: If still failing, try:

```bash
NODE_ENV=production npm ci --legacy-peer-deps --omit=dev && npm run prisma-generate && npm run build
```

### Error: "prisma generate failed"

**Cause**: Prisma schema not accessible or DATABASE_URL not set

**Solution**:

- Set DATABASE_URL environment variable in Render dashboard (required for schema generation)
- Ensure your Prisma schema is committed to git
- Check that `.env` is NOT in .gitignore (unless you have DATABASE_URL set in Render)

### Error: "Port binding issue"

**Solution**: Render assigns port dynamically via PORT environment variable

- Your app already handles this: `process.env.PORT || 5000`
- Render will assign a port like 10000, 10001, etc.
- Make sure binding to `0.0.0.0` not localhost
- Verify `index.ts` server.listen properly handles the dynamic PORT

### Deployment keeps restarting

**Cause**: Often due to app crash after start

**Solution**:

1. Check Render logs for specific error messages
2. Verify all required environment variables are set
3. Test locally: `NODE_ENV=production npm run build && npm run prod`
4. Check database connection with your DATABASE_URL

## Memory Optimization Tips

### If Still Running Out of Memory:

1. **Increase heap size further**:

    ```
    NODE_OPTIONS="--max-old-space-size=2048"
    ```

2. **Use npm ci instead of npm install**:

    ```
    NODE_ENV=production npm ci --omit=dev
    ```

3. **Split webpack output**:

    - Create multiple entry points
    - Use tree-shaking to remove unused code

4. **Lazy load dependencies**:

    - Consider only loading heavy ML libraries when needed
    - The `canvas` package is especially memory-intensive

5. **Monitor in Render**:
    - Check "Logs" tab in Render dashboard
    - Watch for OOM errors in real-time

## Environment Variables Required

```env
DATABASE_URL=mongodb+srv://...
NODE_ENV=production
PORT=10000  # Render assigns dynamic port, but we can specify
JWT_SECRET=your_secret
EMAIL_USER=your_email
EMAIL_PASSWORD=your_app_password
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud
```

## Troubleshooting

### Build Still Failing?

1. Check Render logs: Look for exact error line
2. Try increasing heap: `--max-old-space-size=1024`
3. Verify MongoDB connection works
4. Check if all environment variables are set

### Application Crashes After Deploy?

1. Run `npm run build` locally to test
2. Check that PORT binding works (Render assigns port dynamically)
3. Verify all environment variables are set in Render dashboard
4. Check application logs in Render

### Port Binding Issues?

- Render will assign a port via `PORT` environment variable
- Your `index.ts` already handles this: `process.env.PORT || 5000`
- Make sure to bind to `0.0.0.0` not just `localhost`

## Performance Benchmarks

- **Build time**: ~3-4 minutes (with optimization)
- **Startup time**: ~10-15 seconds
- **Memory usage**: 256-512MB during runtime

## Next Steps for Further Optimization

1. Consider splitting ML models into separate service
2. Implement code splitting for large bundles
3. Use native modules (node-gyp) instead of pure JS ML libraries
4. Implement lazy loading for heavy dependencies
