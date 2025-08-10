# Odoo Invoice Follow-Up Manager - React Edition

A modern React application for managing Odoo invoice follow-ups with a clean, intuitive interface. This application helps businesses track overdue invoices and send automated follow-up emails to clients.

## 🚀 Features

### Core Functionality
- **Odoo Integration**: Connect to your Odoo instance to fetch overdue invoices
- **Dashboard**: Visual overview of overdue invoices with statistics and categorization
- **Bulk Email Sender**: Send follow-up emails to multiple clients with customizable templates
- **Demo Mode**: Test the application with sample data without connecting to Odoo
- **PDF Generation**: Automatically generate and attach invoice PDFs to emails

### Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Clean Interface**: Less cluttered, modern design with intuitive navigation
- **Real-time Updates**: Live connection status and data refresh capabilities
- **Visual Feedback**: Loading states, success/error notifications, and progress indicators

### Email Management
- **Template System**: Pre-built email templates for different follow-up stages
- **Client Categorization**: Automatically categorize clients by overdue severity
- **Attachment Support**: Upload additional PDF files and automatic IBAN letter attachments
- **Email Validation**: Built-in email address validation and error handling

## 🛠️ Technology Stack

- **Frontend**: React 18.2.0
- **Styling**: Tailwind CSS 3.2.7
- **Routing**: React Router DOM 6.8.1
- **State Management**: React Context API
- **HTTP Client**: Axios 1.3.4
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Forms**: React Hook Form
- **Data Fetching**: React Query

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd odoo-invoice-followup-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ODOO_DEFAULT_URL=https://your-odoo-instance.com
REACT_APP_ODOO_DEFAULT_DATABASE=your-database
```

### Backend API
This React application is designed to work with a backend API that handles:
- Odoo connection and authentication
- Invoice data fetching
- Email sending
- PDF generation

The backend should implement the following endpoints:
- `POST /api/odoo/connect` - Connect to Odoo
- `POST /api/odoo/refresh` - Refresh invoice data
- `POST /api/email/send` - Send bulk emails
- `POST /api/pdf/generate` - Generate invoice PDFs

## 📱 Usage

### 1. Connection Setup
- **Demo Mode**: Click "Enable Demo Mode" to test with sample data
- **Odoo Connection**: Enter your Odoo URL, database, username, and password
- **Email Configuration**: Set up sender email and SMTP settings

### 2. Dashboard
- View overview statistics (total overdue, amount, average days, unique clients)
- Browse invoices categorized by overdue severity (Recent, Moderate, Severe)
- See detailed invoice information in a clean table format

### 3. Email Sender
- Select clients by overdue category
- Choose email templates (Initial, Second, Final reminder)
- Configure attachments and CC lists
- Preview and send bulk emails

### 4. Settings
- Configure default email templates and CC lists
- Set up SMTP server settings
- Manage security preferences
- View application information

## 🎨 UI Components

The application uses a custom component library built with Tailwind CSS:

- **Button**: Multiple variants (primary, secondary, danger, outline, ghost)
- **Card**: Flexible card components with header, content, and footer
- **Input**: Styled form inputs with validation states
- **Select**: Custom dropdown components
- **Badge**: Status indicators with color variants
- **Layout**: Responsive sidebar layout with navigation

## 🔒 Security Features

- **Session Management**: Automatic session timeout and secure storage
- **Password Protection**: Required authentication for sensitive actions
- **Data Validation**: Client-side and server-side validation
- **Audit Logging**: Optional audit trail for user actions

## 📊 Data Structure

### Invoice Object
```javascript
{
  id: number,
  invoice_number: string,
  due_date: string, // YYYY-MM-DD
  days_overdue: number,
  amount_due: number,
  currency_symbol: string,
  origin: string,
  client_name: string,
  client_email: string,
  company_name: string
}
```

### Client Categorization
- **Recent**: ≤ 15 days overdue
- **Moderate**: 16-30 days overdue
- **Severe**: 31+ days overdue

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Static Hosting
The built application can be deployed to:
- Netlify
- Vercel
- AWS S3
- GitHub Pages

### Environment Configuration
Ensure your production environment has the correct API endpoints configured.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the component examples in `/src/components`

## 🔄 Migration from Streamlit

This React application is a complete rewrite of the original Streamlit application with the following improvements:

### UI/UX Enhancements
- **Modern Design**: Clean, professional interface with better visual hierarchy
- **Responsive Layout**: Works perfectly on all device sizes
- **Better Navigation**: Intuitive sidebar navigation with active states
- **Visual Feedback**: Loading states, animations, and toast notifications

### Performance Improvements
- **Client-side Rendering**: Faster page loads and smoother interactions
- **Optimized Data Handling**: Efficient state management and data caching
- **Reduced Server Load**: Less server round-trips for UI updates

### Developer Experience
- **Component-based Architecture**: Reusable, maintainable components
- **Type Safety**: Better development experience with proper prop validation
- **Modern Tooling**: Latest React features and development tools

### Feature Parity
All original Streamlit features have been preserved and enhanced:
- ✅ Odoo connection and data fetching
- ✅ Dashboard with statistics and categorization
- ✅ Bulk email sending with templates
- ✅ PDF generation and attachments
- ✅ Demo mode for testing
- ✅ Settings and configuration management 