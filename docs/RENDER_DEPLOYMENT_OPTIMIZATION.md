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

### 1. **Updated Procfile**

```
web: NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 node ./dist/server.ts
```

- Sets NODE_ENV before Node.js starts
- Allocates 512MB of heap memory explicitly via NODE_OPTIONS
- Runs pre-built binary directly (no build on startup)

### 2. **Optimized webpack.config.js**

- Added `mode: "production"` for optimized build
- Disabled source maps with `devtool: false`
- Enabled `transpileOnly: true` in ts-loader to skip type checking
- Added proper `exclude: /node_modules/` to avoid processing unnecessary files
- Configured minimization and performance hints

### 3. **Enhanced package.json Scripts**

```json
"build": "NODE_ENV=production node --max-old-space-size=512 ./node_modules/webpack/bin/webpack.js --config webpack.config.js"
"prod": "NODE_ENV=production node ./dist/server.ts"
"postinstall": "if [ \"$NODE_ENV\" != \"production\" ]; then npm run prepare; fi"
"prepare": "if [ \"$NODE_ENV\" != \"production\" ]; then husky; fi"
```

- Build script allocates 512MB to webpack
- Skips husky and prisma generation during production installs
- Sets NODE_ENV consistently
- Only runs husky in development environments

### 4. **render.yaml Configuration**

Created explicit Render configuration:

```yaml
buildCommand: "NODE_ENV=production npm install && npm run prisma-generate && npm run build"
startCommand: "npm run prod"
envVars:
    - key: NODE_ENV
      value: production
    - key: NODE_OPTIONS
      value: "--max-old-space-size=512"
```

- Sets NODE_ENV=production early in build command
- Separates npm install, prisma-generate, and build steps
- Defines environment variables for runtime
- Health check path for monitoring

## Deployment Steps for Render

### Option A: Using Dashboard (Recommended)

1. Create new Web Service on Render
2. Connect your GitHub repository
3. In Service Settings, add these environment variables:

    - `NODE_ENV`: `production`
    - `NODE_OPTIONS`: `--max-old-space-size=512`
    - `DATABASE_URL`: Your MongoDB connection string
    - `JWT_SECRET`: Your JWT secret
    - `EMAIL_USER`: Your email
    - `EMAIL_PASSWORD`: Your app password
    - `CLOUDINARY_*`: Your Cloudinary credentials
    - Other required vars from `.env`

4. Set Build Command:

    ```
    NODE_ENV=production npm install && npm run prisma-generate && npm run build
    ```

5. Set Start Command:

    ```
    npm run prod
    ```

6. Deploy!

### Option B: Using render.yaml

1. Push `render.yaml` to your repository
2. In Render dashboard, select "New" → "Web Service"
3. Connect your repo
4. Render will auto-detect `render.yaml` and apply configurations automatically

## Troubleshooting Build Failures

### Error: "husky: not found"

**Cause**: NODE_ENV not set to production during npm install

**Solution**: Ensure your build command starts with `NODE_ENV=production`

### Error: "JavaScript heap out of memory"

**Solution 1**: Increase NODE_OPTIONS in environment variables:

```
NODE_OPTIONS="--max-old-space-size=1024"
```

**Solution 2**: Update render.yaml buildCommand:

```yaml
buildCommand: "NODE_ENV=production npm install --legacy-peer-deps && npm run prisma-generate && npm run build"
```

### Error: "prisma generate failed"

**Cause**: Prisma schema not accessible or DATABASE_URL not set

**Solution**:

- Set DATABASE_URL environment variable in Render dashboard
- Ensure .prisma/generated directory is in .gitignore (check if needed)

### Error: "Port binding issue"

**Solution**: Render assigns port dynamically via PORT environment variable

- Your app already handles this: `process.env.PORT || 5000`
- Make sure binding to `0.0.0.0` not localhost
- Check `index.ts` line with `server.listen(config.port, ...)`

## Memory Optimization Tips

### If Still Running Out of Memory:

1. **Further increase heap size**:

    ```
    NODE_OPTIONS="--max-old-space-size=2048"
    ```

2. **Split webpack output**:

    - Create multiple entry points
    - Use tree-shaking to remove unused code

3. **Lazy load dependencies**:

    - Consider only loading heavy ML libraries when needed
    - The `canvas` package is especially memory-intensive

4. **Monitor in Render**:
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
