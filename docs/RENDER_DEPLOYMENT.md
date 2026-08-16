# Render Cloud Deployment Guide (Connect From Anywhere)

Deploying the SMR Mirroring backend to **Render.com** allows your Android phone and Laptop desktop application to connect securely from anywhere in the world across cellular data (4G/5G) or remote Wi-Fi networks.

---

## 1. Quick Deploy via Render Blueprint

1. **Push your repository** to GitHub, GitLab, or Bitbucket.
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your repository. Render will automatically detect the [`render.yaml`](file:///c:/Users/MAYUR/Downloads/SMR%20_S/render.yaml) file.
5. Click **Apply**. Render will automatically provision:
   - **PostgreSQL Database** (`smr-postgres-db`)
   - **Node.js Signaling Server** (`smr-signaling-backend`)

---

## 2. Your Online Backend URL

Once deployed, Render gives you a public HTTPS URL:
```
https://smr-signaling-backend.onrender.com
```

---

## 3. Configuring Your Devices

### In Web UI / Desktop Application
1. Click the **`Server Config`** button in the top navigation bar.
2. Paste your Render backend URL:
   `https://smr-signaling-backend.onrender.com`
3. Click **Save URL**.

### In Android Application
The app automatically uses your configured online Render URL to establish WebSocket signaling (`wss://smr-signaling-backend.onrender.com/ws/signaling`) and pair over the internet!
