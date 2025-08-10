# Railway Deployment Guide

## Your Flask + React App is Ready for Railway! 🚀

### Files Created:
- ✅ `railway.json` - Railway configuration
- ✅ `nixpacks.toml` - Build configuration  
- ✅ Updated `backend/run_backend.py` to serve React build files
- ✅ React builds to `build/` folder
- ✅ Local testing successful

### Environment Variables to Set in Railway:

```bash
# Odoo Connection
ODOO_URL=https://prezlab-staging-22061821.dev.odoo.com
ODOO_DB=prezlab-staging-22061821
ODOO_USERNAME=omar.elhasan@prezlab.com
ODOO_PASSWORD=Omar@@1998

# Email Settings
EMAIL_SENDER=Omarbasemelhasan@gmail.com
EMAIL_PASSWORD=zslz yakq zrjt vyxt
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587

# Production Settings
NODE_ENV=production
PORT=8000
```

### Deployment Steps:

1. **Login to Railway:**
   ```bash
   railway login
   ```

2. **Initialize Railway Project:**
   ```bash
   railway init
   ```

3. **Set Environment Variables:**
   ```bash
   railway variables set ODOO_URL=https://prezlab-staging-22061821.dev.odoo.com
   railway variables set ODOO_DB=prezlab-staging-22061821
   railway variables set ODOO_USERNAME=omar.elhasan@prezlab.com
   railway variables set ODOO_PASSWORD="Omar@@1998"
   railway variables set EMAIL_SENDER=Omarbasemelhasan@gmail.com
   railway variables set EMAIL_PASSWORD="zslz yakq zrjt vyxt"
   railway variables set SMTP_SERVER=smtp.gmail.com
   railway variables set SMTP_PORT=587
   railway variables set NODE_ENV=production
   railway variables set PORT=8000
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Get Your Live URL:**
   ```bash
   railway domain
   ```

### Alternative: Deploy via Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub
3. Connect your repository
4. Add the environment variables in the dashboard
5. Deploy!

Your app will:
- Build React frontend automatically
- Install Python dependencies
- Start Flask server serving both React and API
- Be accessible from one URL with `/api/` routes for backend

### Troubleshooting:
- Check logs: `railway logs`
- Check status: `railway status`
- Redeploy: `railway up --detach`
