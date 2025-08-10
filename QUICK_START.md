# 🚀 Quick Start Guide - Odoo Invoice Follow-Up Manager React Edition

## Prerequisites

Before starting, make sure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download here](https://python.org/)
- **npm** (comes with Node.js)

## 🎯 Quick Start (Recommended)

### Option 1: Automatic Startup (Easiest)

1. **Run the startup script:**
   ```bash
   start_app.bat
   ```

2. **The script will:**
   - ✅ Check all dependencies
   - ✅ Start both frontend and backend servers
   - ✅ Open the application in your browser

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

### Option 2: Manual Startup

#### Step 1: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
pip install -r backend/requirements.txt
```

#### Step 2: Start Backend Server

```bash
# Start Flask backend
python backend/run_backend.py
```

#### Step 3: Start Frontend Server

```bash
# In a new terminal, start React frontend
npm start
```

#### Step 4: Access Application

- Open http://localhost:3000 in your browser
- The backend API will be available at http://localhost:8000

## 🧪 Testing the Application

### Demo Mode (No Odoo Required)

1. **Open the application** at http://localhost:3000
2. **Click "Enable Demo Mode"** in the sidebar
3. **Explore the features:**
   - View sample overdue invoices in the Dashboard
   - Test the Email Sender with demo clients
   - Check the Settings page

### Real Odoo Connection

1. **Configure Odoo connection** in the sidebar:
   - Odoo URL (e.g., https://your-odoo-instance.com)
   - Database name
   - Username
   - Password

2. **Click "Connect to Odoo"**

3. **Start managing invoices:**
   - View real overdue invoices
   - Send follow-up emails
   - Generate PDF attachments

## 📱 Using the Application

### Dashboard
- **Overview Statistics**: Total overdue, amount, average days, unique clients
- **Categorized View**: Recent (≤15 days), Moderate (16-30 days), Severe (31+ days)
- **Detailed Table**: All overdue invoices with filtering and sorting

### Email Sender
- **Client Selection**: Choose clients by overdue category
- **Template Configuration**: Select email templates (Initial, Second, Final)
- **Attachment Management**: Upload PDFs and enable automatic invoice PDFs
- **Bulk Sending**: Send emails to multiple clients at once

### Settings
- **General Settings**: Default templates, CC lists, refresh intervals
- **Email Settings**: SMTP configuration
- **Security Settings**: Session timeout, audit logging
- **About**: Application information and version details

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ODOO_DEFAULT_URL=https://your-odoo-instance.com
REACT_APP_ODOO_DEFAULT_DATABASE=your-database
```

### Email Configuration

1. **SMTP Settings**: Configure in the Settings page
2. **Sender Email**: Set up your email account
3. **App Password**: Use app-specific passwords for Gmail/Office 365

## 🛠️ Development

### Project Structure

```
├── src/                    # React frontend source
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── pages/             # Page components
│   └── utils/             # Utility functions
├── backend/               # Flask backend
│   ├── run_backend.py     # Backend server
│   └── requirements.txt   # Python dependencies
├── public/                # Static assets
└── package.json           # Frontend dependencies
```

### Available Scripts

```bash
# Frontend
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests

# Backend
python backend/run_backend.py  # Start backend server
```

## 🚨 Troubleshooting

### Common Issues

1. **Port 3000 already in use:**
   ```bash
   # Kill process using port 3000
   npx kill-port 3000
   ```

2. **Port 8000 already in use:**
   ```bash
   # Kill process using port 8000
   npx kill-port 8000
   ```

3. **Node modules missing:**
   ```bash
   npm install
   ```

4. **Python dependencies missing:**
   ```bash
   pip install -r backend/requirements.txt
   ```

5. **Odoo connection fails:**
   - Check URL, database, username, and password
   - Ensure Odoo instance is accessible
   - Verify user has proper permissions

### Getting Help

- **Check the logs** in the terminal for error messages
- **Verify API endpoints** at http://localhost:8000/api/health
- **Test demo mode** to isolate connection issues
- **Review the README.md** for detailed documentation

## 🎉 Success!

Once everything is running:

1. ✅ **Frontend**: http://localhost:3000
2. ✅ **Backend**: http://localhost:8000
3. ✅ **Demo Mode**: Working with sample data
4. ✅ **Odoo Connection**: Ready to connect to your instance

The application is now ready to help you manage Odoo invoice follow-ups with a modern, responsive interface!

---

**Need help?** Check the main [README.md](README.md) for detailed documentation and troubleshooting guides. 