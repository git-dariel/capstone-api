# Quick Render Deployment Setup

## ⚠️ Critical: Set Build Command in Render Dashboard

Render is not reading `render.yaml` automatically. You must set these manually:

### Steps:

1. **Go to your Render service dashboard**
2. **Click Settings → Build & Deploy**
3. **Find "Build Command" field and set it to:**

    ```
    NODE_ENV=production npm ci --omit=dev && npm run prisma-generate && npm run build
    ```

4. **Find "Start Command" field and set it to:**

    ```
    npm start
    ```

5. **Environment Variables - Make sure these are set:**

    - `NODE_ENV` = `production`
    - `NODE_OPTIONS` = `--max-old-space-size=512`
    - `DATABASE_URL` = your MongoDB URL
    - `JWT_SECRET` = your secret
    - `EMAIL_USER` = your email
    - `EMAIL_PASSWORD` = your app password
    - `CLOUDINARY_API_KEY` = your key
    - `CLOUDINARY_API_SECRET` = your secret
    - `CLOUDINARY_CLOUD_NAME` = your cloud name

6. **Click "Save"**
7. **Click "Deploy" button**

## Why This Is Needed

- Render's default is to run `npm install` (no custom build)
- The `render.yaml` file is often not recognized by Render
- Without the build command, webpack never runs, so `./dist/server.ts` is never created
- The updated `npm start` script now auto-builds if needed, so it's more resilient

## Expected Build Output

```
==> Running build command 'NODE_ENV=production npm ci --omit=dev && npm run prisma-generate && npm run build'...
[npm ci output]
[prisma-generate output]
[webpack build output]
==> Build successful 🎉
==> Running 'npm start'
> mental-health-api@1.0.0 start
[Server starting...]
```

## If Build Still Fails

Try these troubleshooting steps:

1. **Check Render logs** for the exact error
2. **Test locally first:**

    ```bash
    npm run build
    NODE_ENV=production npm start
    ```

3. **If webpack fails locally**, check:

    - All TypeScript files compile: `npx tsc --noEmit`
    - No import errors: check `tsconfig.json`
    - Sufficient disk space and memory

4. **If Prisma fails:**

    - Set `DATABASE_URL` in environment variables
    - Make sure schema.prisma exists in `prisma/` folder

5. **Increase memory if needed:**
    - Set `NODE_OPTIONS` to `--max-old-space-size=1024` (1GB)

## What the Updated npm start Does

```bash
if NODE_ENV is "production":
  - Check if dist folder exists
  - If NOT: run npm run build automatically
  - Then start the server with memory optimization
else (development):
  - Run nodemon for live reload
```

This makes it resilient to build command failures and provides a fallback.
