# Standalone SMR WebRTC Signaling Backend (Zero-Database)

A single-folder, zero-database WebRTC signaling backend for SMR Phone Mirroring.

## 1-Click Render Deployment Instructions

1. Push your repository to GitHub.
2. Go to **[dashboard.render.com](https://dashboard.render.com)** -> Click **New +** -> **Web Service**.
3. Connect your repository.
4. Set the **Root Directory** field to:
   ```
   backend
   ```
5. Set:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click **Create Web Service**.

Render will deploy your backend instantly!
