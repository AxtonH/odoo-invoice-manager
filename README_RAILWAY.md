Deploying to Railway
====================

Prerequisites
-------------
- Railway account
- Railway CLI (optional)

Deploy Steps
------------
1. Push this repo to GitHub.
2. In Railway, create a new project → Deploy from GitHub → select this repo.
3. Railway will detect `Procfile` and `requirements.txt` and run the backend.
4. Set environment variables as needed (e.g., Odoo credentials if you move them to env).

Service
-------
- Web service runs: `python backend/run_backend.py`
- Binds to `PORT` provided by Railway.

Frontend (optional)
-------------------
This setup deploys the backend API. If you want to deploy the React app separately:
- Build frontend locally: `npm run build`
- Serve `build/` via a static host (Railway static, Netlify, Vercel) and set API base URL to Railway service URL.

Health Check
------------
- Open Railway URL and hit `/api/health`.

