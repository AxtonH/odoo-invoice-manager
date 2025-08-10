import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Progress from '../components/ui/Progress';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import { 
  Settings, 
  Database, 
  Mail, 
  Shield, 
  Info, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  LogOut,
  Loader2,
  DollarSign,
  Download,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';

// Helper function to get currency symbol
const getCurrencySymbol = (currencyCode) => {
  const symbols = {
    'AED': 'د.إ',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'SAR': 'ر.س',
    'KWD': 'د.ك',
    'BHD': 'د.ب',
    'QAR': 'ر.ق',
    'OMR': 'ر.ع',
    'JOD': 'د.أ'
  };
  return symbols[currencyCode] || currencyCode;
};

// Helper function to get exchange rate
const getExchangeRate = (currencyCode) => {
  if (currencyCode === 'ORIGINAL') {
    return 'N/A';
  }
  const rates = {
    'AED': 1.0,
    'USD': 0.272,
    'EUR': 0.251,
    'GBP': 0.215,
    'SAR': 1.02,
    'KWD': 0.083,
    'BHD': 0.102,
    'QAR': 0.99,
    'OMR': 0.105,
    'JOD': 0.193
  };
  return rates[currencyCode] || 1.0;
};

const SettingsPage = () => {
  const { 
    isConnected, 
    isLoading, 
    loadingProgress,
    loadingMessage,
    error, 
    connectToOdoo, 
    disconnect, 
    refreshInvoices,
    overdueInvoices,
    settings,
    updateEmailConfig,
    updateCurrency,
    updateSecuritySettings
  } = useAuth();

  // Local state for connection progress
  const [localLoading, setLocalLoading] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [localMessage, setLocalMessage] = useState('');

  const [connectionDetails, setConnectionDetails] = useState({
    url: 'https://prezlab-staging-22061821.dev.odoo.com',
    database: 'prezlab-staging-22061821',
    username: 'omar.elhasan@prezlab.com',
    password: 'Omar@@1998',
  });

  const [emailConfig, setEmailConfig] = useState(settings.emailConfig);

  const [showConnectionForm, setShowConnectionForm] = useState(!isConnected);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showAdvancedEmail, setShowAdvancedEmail] = useState(false);
  const [showOdooPassword, setShowOdooPassword] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showAutomatedOdooPassword, setShowAutomatedOdooPassword] = useState(false);
  const [showAutomatedEmailPassword, setShowAutomatedEmailPassword] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState(settings.currency);
  const [securitySettings, setSecuritySettings] = useState(settings.security);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Automated Reports state
  const [automatedReportsConfig, setAutomatedReportsConfig] = useState({
    enabled: false,
    recipient_email: '',
    report_time: '09:00',
    check_interval: 'hourly',
    email_template: 'daily_summary',
    odoo_connection: {
      url: '',
      database: '',
      username: '',
      password: 'Omar@@1998'
    },
    email_settings: {
      smtp_server: 'smtp.gmail.com',
      smtp_port: 587,
      sender_email: 'omar.elhasan@prezlab.com',
      sender_password: 'cnns amsx gxxj ixnm'
    }
  });
  const [showAutomatedReportsForm, setShowAutomatedReportsForm] = useState(false);
  const [isLoadingAutomatedConfig, setIsLoadingAutomatedConfig] = useState(false);
  const [isSavingAutomatedConfig, setIsSavingAutomatedConfig] = useState(false);
  const [isTestingAutomatedReport, setIsTestingAutomatedReport] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Sync local state with context settings
  useEffect(() => {
    setEmailConfig(settings.emailConfig);
  }, [settings.emailConfig]);

  useEffect(() => {
    setDisplayCurrency(settings.currency);
  }, [settings.currency]);

  useEffect(() => {
    setSecuritySettings(settings.security);
  }, [settings.security]);

  // Load automated reports configuration on component mount
  useEffect(() => {
    loadAutomatedReportsConfig();
  }, []);

  const handleConnect = async () => {
    console.log('Connect button clicked!');
    
    // Start local loading state
    setLocalLoading(true);
    setLocalProgress(0);
    setLocalMessage('Initializing connection...');
    
    try {
      // Simulate progress updates
      const progressSteps = [
        { progress: 10, message: 'Initializing connection...' },
        { progress: 30, message: 'Connecting to Odoo server...' },
        { progress: 60, message: 'Authenticating...' },
        { progress: 80, message: 'Fetching invoice data...' },
        { progress: 100, message: 'Connection successful!' }
      ];
      
      // Update progress step by step
      for (let i = 0; i < progressSteps.length; i++) {
        const step = progressSteps[i];
        setLocalProgress(step.progress);
        setLocalMessage(step.message);
        
        // Wait a bit between steps
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Now call the actual connection
      await connectToOdoo(connectionDetails);
      
      if (isConnected) {
        setShowConnectionForm(false);
      }
    } catch (error) {
      console.error('Connection error:', error);
      setLocalMessage('Connection failed: ' + error.message);
    } finally {
      // Keep the success message visible for a moment
      setTimeout(() => {
        setLocalLoading(false);
        setLocalProgress(0);
        setLocalMessage('');
      }, 2000);
    }
  };

  const handleRefresh = async () => {
    await refreshInvoices();
  };

  const handleDisconnect = () => {
    disconnect();
    setShowConnectionForm(true);
  };

  // Load automated reports configuration
  const loadAutomatedReportsConfig = async () => {
    setIsLoadingAutomatedConfig(true);
    try {
      const response = await fetch('/api/automated-reports/config');
      const data = await response.json();
      
      if (data.success && data.config?.automated_reports) {
        setAutomatedReportsConfig(data.config.automated_reports);
      }
    } catch (error) {
      console.error('Error loading automated reports config:', error);
    } finally {
      setIsLoadingAutomatedConfig(false);
    }
  };

  // Save automated reports configuration
  const saveAutomatedReportsConfig = async () => {
    setIsSavingAutomatedConfig(true);
    try {
      const requestBody = {
        updates: {
          enabled: automatedReportsConfig.enabled,
          recipient_email: automatedReportsConfig.recipient_email,
          report_time: automatedReportsConfig.report_time,
          check_interval: automatedReportsConfig.check_interval,
          email_template: automatedReportsConfig.email_template,
          odoo_connection: automatedReportsConfig.odoo_connection,
          email_settings: automatedReportsConfig.email_settings
        }
      };
      
      console.log('Saving automated reports config:', requestBody);
      
      const response = await fetch('/api/automated-reports/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
      } else {
        console.error('Error saving config:', data.error);
      }
    } catch (error) {
      console.error('Error saving automated reports config:', error);
    } finally {
      setIsSavingAutomatedConfig(false);
    }
  };

  // Test automated report
  const testAutomatedReport = async () => {
    setIsTestingAutomatedReport(true);
    try {
      const response = await fetch('/api/automated-reports/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Test report sent successfully!\n\nReport Summary:\n- Total Invoices: ${data.report_summary.total_invoices}\n- Total Amount: $${data.report_summary.total_amount.toLocaleString()}\n- Total Clients: ${data.report_summary.total_clients}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing automated report:', error);
      alert('Error testing automated report. Please check the console for details.');
    } finally {
      setIsTestingAutomatedReport(false);
    }
  };

  const generateOverdueReport = async () => {
    if (!isConnected) {
      alert('Please connect to Odoo first to generate a report.');
      return;
    }

    setIsGeneratingReport(true);
    
    try {
      console.log('Starting PDF generation...');
      console.log('jsPDF available:', typeof jsPDF);
      
      if (typeof jsPDF === 'undefined') {
        throw new Error('jsPDF library not loaded');
      }
      // Calculate report data
      const totalOverdueInvoices = overdueInvoices.length;
      const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount_due, 0);
      
      // Debug: Log first few invoices to see structure
      console.log('Sample invoice data:', overdueInvoices.slice(0, 3).map(inv => ({
        client_name: inv.client_name,
        partner_name: inv.partner_name,
        currency_symbol: inv.currency_symbol,
        amount_due: inv.amount_due
      })));
      
      // Group invoices by client
      const clientInvoices = {};
      overdueInvoices.forEach(invoice => {
        if (!clientInvoices[invoice.client_name]) {
          clientInvoices[invoice.client_name] = [];
        }
        clientInvoices[invoice.client_name].push(invoice);
      });
      
      // Find severely overdue clients (>30 days)
      const severelyOverdueClients = Object.entries(clientInvoices)
        .filter(([clientName, invoices]) => {
          const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
          return maxDays > 30;
        })
        .map(([clientName, invoices]) => {
          const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
          const invoiceCount = invoices.length;
          const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
          return {
            clientName,
            totalAmount,
            invoiceCount,
            maxDays
          };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount); // Sort by amount descending

      // Find moderately overdue clients (16-30 days)
      const moderatelyOverdueClients = Object.entries(clientInvoices)
        .filter(([clientName, invoices]) => {
          const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
          return maxDays > 15 && maxDays <= 30;
        })
        .map(([clientName, invoices]) => {
          const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
          const invoiceCount = invoices.length;
          const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
          return {
            clientName,
            totalAmount,
            invoiceCount,
            maxDays
          };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount); // Sort by amount descending

      // Calculate top 3 clients to follow up on
      const calculateTopClientsToFollowUp = (clientInvoices) => {
        const clientScores = Object.entries(clientInvoices).map(([clientName, invoices]) => {
          const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
          const maxDaysOverdue = Math.max(...invoices.map(inv => inv.days_overdue));
          const avgDaysOverdue = invoices.reduce((sum, inv) => sum + inv.days_overdue, 0) / invoices.length;
          const invoiceCount = invoices.length;
          
          // Calculate priority score (more weight to overdue duration)
          // Formula: (max_days_overdue * 0.6) + (avg_days_overdue * 0.3) + (total_amount / 1000 * 0.1)
          const priorityScore = (maxDaysOverdue * 0.6) + (avgDaysOverdue * 0.3) + (totalAmount / 1000 * 0.1);
          
          return {
            clientName,
            totalAmount,
            maxDaysOverdue,
            avgDaysOverdue: Math.round(avgDaysOverdue * 10) / 10,
            invoiceCount,
            priorityScore
          };
        });
        
        // Sort by priority score (highest first) and return top 3
        return clientScores.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 3);
      };

      const topClientsToFollowUp = calculateTopClientsToFollowUp(clientInvoices);
      
      // Create PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      
      // Set up fonts and colors
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(44, 62, 80); // Dark blue-gray
      
      // Header
      pdf.text('OVERDUE INVOICES REPORT', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Date
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 25;
      
      // Summary Section
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(44, 62, 80);
      pdf.text('SUMMARY', margin, yPosition);
      yPosition += 15;
      
      // Summary box
      pdf.setFillColor(236, 240, 241); // Light gray background
      pdf.rect(margin, yPosition - 5, contentWidth, 70, 'F'); // Increased height for more lines
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(52, 73, 94);
      
      // Define label width for alignment and ensure proper spacing
      const labelWidth = 140;
      const valueX = margin + labelWidth + 10;
      const maxValueWidth = pageWidth - valueX - margin; // Available space for values
      
      // Helper function to format currency with proper symbol
      const formatCurrency = (amount) => {
        // Get the most common currency from overdue invoices
        const currencies = overdueInvoices.map(inv => inv.currency_symbol || '$');
        const mostCommonCurrency = currencies.reduce((acc, curr) => {
          acc[curr] = (acc[curr] || 0) + 1;
          return acc;
        }, {});
        const primaryCurrency = Object.keys(mostCommonCurrency).reduce((a, b) => 
          mostCommonCurrency[a] > mostCommonCurrency[b] ? a : b
        );
        return `${primaryCurrency}${amount.toLocaleString()}`;
      };
      
      // Helper function to format currency for individual clients
      const formatClientCurrency = (clientName, amount) => {
        // Find the specific client's invoices to get their currency
        const clientInvoices = overdueInvoices.filter(inv => 
          inv.client_name === clientName || inv.partner_name === clientName || 
          inv.client_name?.includes(clientName) || inv.partner_name?.includes(clientName)
        );
        if (clientInvoices.length > 0) {
          const clientCurrency = clientInvoices[0].currency_symbol || '$';
          console.log(`Client: ${clientName}, Currency: ${clientCurrency}, Invoices found: ${clientInvoices.length}`);
          return `${clientCurrency}${amount.toLocaleString()}`;
        }
        // Fallback to most common currency
        console.log(`No specific currency found for ${clientName}, using fallback`);
        return formatCurrency(amount);
      };
      
      // Helper function to check if text fits and truncate if needed
      const fitText = (text, maxWidth) => {
        const textWidth = pdf.getTextWidth(text);
        if (textWidth <= maxWidth) {
          return text;
        }
        // Truncate with ellipsis
        let truncated = text;
        while (pdf.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
      };
      
      pdf.text(`Total Overdue Invoices:`, margin + 10, yPosition + 5);
      pdf.setFont('helvetica', 'bold');
      const invoiceCountText = fitText(totalOverdueInvoices.toString(), maxValueWidth);
      pdf.text(invoiceCountText, valueX, yPosition + 5);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total Overdue Amount:`, margin + 10, yPosition + 15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(231, 76, 60); // Red for amount
      // For total amount, don't truncate - show full number
      pdf.text(formatCurrency(totalOverdueAmount), valueX, yPosition + 15);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(52, 73, 94);
      pdf.text(`Moderately Overdue Clients (16-30 days):`, margin + 10, yPosition + 25);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(241, 196, 15); // Yellow for moderate
      const moderateCountText = fitText(moderatelyOverdueClients.length.toString(), maxValueWidth);
      pdf.text(moderateCountText, valueX, yPosition + 25);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(52, 73, 94);
      pdf.text(`Severely Overdue Clients (>30 days):`, margin + 10, yPosition + 35);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(230, 126, 34); // Orange for warning
      const severeCountText = fitText(severelyOverdueClients.length.toString(), maxValueWidth);
      pdf.text(severeCountText, valueX, yPosition + 35);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(52, 73, 94);
      pdf.text(`Top Priority Clients Identified:`, margin + 10, yPosition + 45);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(155, 89, 182); // Purple for priority
      const topClientsCountText = fitText(topClientsToFollowUp.length.toString(), maxValueWidth);
      pdf.text(topClientsCountText, valueX, yPosition + 45);
      
      yPosition += 80;
      
      // Top 3 Clients to Follow Up On Section
      if (topClientsToFollowUp.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(44, 62, 80);
        pdf.text('TOP 3 CLIENTS TO FOLLOW UP ON', margin, yPosition);
        yPosition += 15;
        
        // Table header
        pdf.setFillColor(52, 73, 94);
        pdf.rect(margin, yPosition, contentWidth, 12, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        
        pdf.text('Client Name', margin + 5, yPosition + 8);
        pdf.text('Amount', margin + 80, yPosition + 8);
        pdf.text('Max Days', margin + 120, yPosition + 8);
        pdf.text('Avg Days', margin + 150, yPosition + 8);
        pdf.text('Invoices', margin + 180, yPosition + 8);
        
        yPosition += 12;
        
        // Table rows
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(52, 73, 94);
        pdf.setFontSize(10);
        
        topClientsToFollowUp.forEach((client, index) => {
          // Alternate row colors
          if (index % 2 === 0) {
            pdf.setFillColor(248, 249, 250);
          } else {
            pdf.setFillColor(255, 255, 255);
          }
          pdf.rect(margin, yPosition, contentWidth, 12, 'F');
          
          // Client name (truncate if too long)
          const clientName = client.clientName.length > 20 ? 
            client.clientName.substring(0, 17) + '...' : client.clientName;
          pdf.text(clientName, margin + 5, yPosition + 8);
          
          // Amount with proper currency for this specific client
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(231, 76, 60);
          const clientAmountText = fitText(formatClientCurrency(client.clientName, client.totalAmount), 35);
          pdf.text(clientAmountText, margin + 80, yPosition + 8);
          
          // Max days overdue
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(230, 126, 34);
          pdf.text(`${client.maxDaysOverdue}`, margin + 120, yPosition + 8);
          
          // Average days overdue
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(52, 73, 94);
          pdf.text(`${client.avgDaysOverdue}`, margin + 150, yPosition + 8);
          
          // Invoice count
          pdf.text(`${client.invoiceCount}`, margin + 180, yPosition + 8);
          
          yPosition += 12;
          
          // Check if we need a new page
          if (yPosition > 250) {
            pdf.addPage();
            yPosition = margin;
          }
        });
        
        yPosition += 20;
      }
      
      // Severely Overdue Clients Section
      if (severelyOverdueClients.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(44, 62, 80);
        pdf.text('SEVERELY OVERDUE CLIENTS', margin, yPosition);
        yPosition += 15;
        
        // Table header
        pdf.setFillColor(52, 73, 94);
        pdf.rect(margin, yPosition, contentWidth, 12, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        
        pdf.text('Client Name', margin + 5, yPosition + 8);
        pdf.text('Amount', margin + 80, yPosition + 8);
        pdf.text('Invoices', margin + 120, yPosition + 8);
        pdf.text('Days Overdue', margin + 150, yPosition + 8);
        
        yPosition += 12;
        
        // Table rows
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(52, 73, 94);
        pdf.setFontSize(10);
        
        severelyOverdueClients.forEach((client, index) => {
          // Alternate row colors
          if (index % 2 === 0) {
            pdf.setFillColor(248, 249, 250);
          } else {
            pdf.setFillColor(255, 255, 255);
          }
          pdf.rect(margin, yPosition, contentWidth, 12, 'F');
          
          // Client name (truncate if too long)
          const clientName = client.clientName.length > 25 ? 
            client.clientName.substring(0, 22) + '...' : client.clientName;
          pdf.text(clientName, margin + 5, yPosition + 8);
          
          // Amount with proper currency for this specific client
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(231, 76, 60);
          const clientAmountText = fitText(formatClientCurrency(client.clientName, client.totalAmount), 40);
          pdf.text(clientAmountText, margin + 80, yPosition + 8);
          
          // Invoice count
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(52, 73, 94);
          pdf.text(`${client.invoiceCount}`, margin + 120, yPosition + 8);
          
          // Days overdue
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(230, 126, 34);
          pdf.text(`${client.maxDays}`, margin + 150, yPosition + 8);
          
          yPosition += 12;
          
          // Check if we need a new page
          if (yPosition > 250) {
            pdf.addPage();
            yPosition = margin;
          }
        });
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(128, 128, 128);
        pdf.text('No severely overdue clients found.', margin, yPosition);
        yPosition += 20;
      }
      
      // Footer
      yPosition += 20;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      pdf.text('This report was generated automatically by the Odoo Invoice Follow-Up Manager.', pageWidth / 2, yPosition, { align: 'center' });
      
             // Save the PDF
       const fileName = `overdue-invoices-report-${new Date().toISOString().split('T')[0]}.pdf`;
       console.log('Saving PDF with filename:', fileName);
       pdf.save(fileName);
       console.log('PDF saved successfully');
      
    } catch (error) {
      console.error('Error generating report:', error);
      
      // Fallback to text file if PDF generation fails
      try {
        console.log('Falling back to text file generation...');
        
        // Calculate report data
        const totalOverdueInvoices = overdueInvoices.length;
        const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount_due, 0);
        
        // Group invoices by client
        const clientInvoices = {};
        overdueInvoices.forEach(invoice => {
          if (!clientInvoices[invoice.client_name]) {
            clientInvoices[invoice.client_name] = [];
          }
          clientInvoices[invoice.client_name].push(invoice);
        });
        
        // Find severely overdue clients (>30 days)
        const severelyOverdueClients = Object.entries(clientInvoices)
          .filter(([clientName, invoices]) => {
            const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
            return maxDays > 30;
          })
          .map(([clientName, invoices]) => {
            const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
            const invoiceCount = invoices.length;
            const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
            return {
              clientName,
              totalAmount,
              invoiceCount,
              maxDays
            };
          })
          .sort((a, b) => b.totalAmount - a.totalAmount);

        // Find moderately overdue clients (16-30 days)
        const moderatelyOverdueClients = Object.entries(clientInvoices)
          .filter(([clientName, invoices]) => {
            const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
            return maxDays > 15 && maxDays <= 30;
          })
          .map(([clientName, invoices]) => {
            const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
            const invoiceCount = invoices.length;
            const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
            return {
              clientName,
              totalAmount,
              invoiceCount,
              maxDays
            };
          })
          .sort((a, b) => b.totalAmount - a.totalAmount);
        
        // Helper function to format currency for text report
        const formatCurrencyText = (amount) => {
          const currencies = overdueInvoices.map(inv => inv.currency_symbol || '$');
          const mostCommonCurrency = currencies.reduce((acc, curr) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
          }, {});
          const primaryCurrency = Object.keys(mostCommonCurrency).reduce((a, b) => 
            mostCommonCurrency[a] > mostCommonCurrency[b] ? a : b
          );
          return `${primaryCurrency}${amount.toLocaleString()}`;
        };
        
        // Helper function to format currency for individual clients in text report
        const formatClientCurrencyText = (clientName, amount) => {
          const clientInvoices = overdueInvoices.filter(inv => 
            inv.client_name === clientName || inv.partner_name === clientName || 
            inv.client_name?.includes(clientName) || inv.partner_name?.includes(clientName)
          );
          if (clientInvoices.length > 0) {
            const clientCurrency = clientInvoices[0].currency_symbol || '$';
            return `${clientCurrency}${amount.toLocaleString()}`;
          }
          return formatCurrencyText(amount);
        };
        
        // Create text report content
        const reportContent = `
OVERDUE INVOICES SUMMARY REPORT
Generated on: ${new Date().toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

SUMMARY:
- Total Overdue Invoices: ${totalOverdueInvoices}
- Total Overdue Amount: ${formatCurrencyText(totalOverdueAmount)}
- Moderately Overdue Clients (16-30 days): ${moderatelyOverdueClients.length}
- Severely Overdue Clients (>30 days): ${severelyOverdueClients.length}

SEVERELY OVERDUE CLIENTS:
${severelyOverdueClients.map(client => `
Client: ${client.clientName}
- Total Overdue Amount: ${formatClientCurrencyText(client.clientName, client.totalAmount)}
- Number of Overdue Invoices: ${client.invoiceCount}
- Maximum Days Overdue: ${client.maxDays}
`).join('\n')}

END OF REPORT
        `;
        
        // Create and download text file
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `overdue-invoices-report-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('PDF generation failed. A text file has been downloaded instead.');
      } catch (fallbackError) {
        console.error('Fallback text generation also failed:', fallbackError);
        alert('Error generating report. Please try again.');
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <Layout>
      {/* Success Notification */}
      {showSaveSuccess && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Settings saved successfully!</span>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure application settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Odoo Connection */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Odoo Connection
              </CardTitle>
              <CardDescription>
                Connect to your Odoo instance to fetch invoice data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {/* Connection Status */}
              {isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success-600" />
                      <span className="text-sm font-medium text-success-700">Connected</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {isLoading && <span className="ml-1 text-xs">Refreshing...</span>}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnect}
                      >
                        <LogOut className="h-3 w-3" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {connectionDetails.database} • {connectionDetails.username}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Not Connected</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowConnectionForm(true)}
                    className="w-full"
                  >
                    Connect to Odoo
                  </Button>
                </div>
              )}

              {/* Connection Form */}
              {showConnectionForm && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Odoo URL</label>
                    <Input
                      value={connectionDetails.url}
                      onChange={(e) => setConnectionDetails(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://your-odoo-instance.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Database</label>
                    <Input
                      value={connectionDetails.database}
                      onChange={(e) => setConnectionDetails(prev => ({ ...prev, database: e.target.value }))}
                      placeholder="database_name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input
                      value={connectionDetails.username}
                      onChange={(e) => setConnectionDetails(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <div className="relative">
                      <Input
                        type={showOdooPassword ? 'text' : 'password'}
                        value={connectionDetails.password}
                        onChange={(e) => setConnectionDetails(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOdooPassword(!showOdooPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showOdooPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={localLoading}
                      className="flex-1"
                    >
                      {localLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-2" />
                          Connecting...
                        </>
                      ) : (
                        'Connect'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConnectionForm(false)}
                      disabled={localLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                  
                  {/* Progress Bar */}
                  {localLoading && (
                    <div className={`p-3 rounded-lg border ${
                      localProgress === 100 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${
                          localProgress === 100 
                            ? 'text-green-800' 
                            : 'text-blue-800'
                        }`}>
                          {localMessage}
                        </span>
                        <span className={`text-xs font-medium ${
                          localProgress === 100 
                            ? 'text-green-600' 
                            : 'text-blue-600'
                        }`}>
                          {Math.round(localProgress)}%
                        </span>
                      </div>
                      <Progress 
                        value={localProgress} 
                        showLabel={false} 
                        className="mb-2"
                      />
                      <div className={`flex items-center gap-2 text-xs ${
                        localProgress === 100 
                          ? 'text-green-600' 
                          : 'text-blue-600'
                      }`}>
                        {localProgress === 100 ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            <span>Connection established successfully!</span>
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Please wait while we connect to Odoo...</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Configuration */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure email sending preferences and SMTP settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {!showEmailForm ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Email settings</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailForm(true)}
                    >
                      Configure
                    </Button>
                  </div>
                  {settings.emailConfig.senderEmail && (
                    <div className="text-xs text-gray-500">
                      Sender: {settings.emailConfig.senderEmail}
                    </div>
                  )}
                  {settings.emailConfig.ccList && (
                    <div className="text-xs text-gray-500">
                      CC: {settings.emailConfig.ccList}
                    </div>
                  )}
                  <div className="text-xs text-blue-600 mt-2">
                    💡 For Gmail, you may need to enable "Less secure app access" or use an App Password
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sender Email</label>
                    <Input
                      value={emailConfig.senderEmail}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                      type="email"
                      placeholder="sender@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sender Password</label>
                    <div className="relative">
                      <Input
                        type={showEmailPassword ? 'text' : 'password'}
                        value={emailConfig.senderPassword}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, senderPassword: e.target.value }))}
                        placeholder="password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword(!showEmailPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showEmailPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">CC List (Optional)</label>
                    <Input
                      value={emailConfig.ccList}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, ccList: e.target.value }))}
                      placeholder="email1@company.com, email2@company.com"
                    />
                  </div>

                  {/* Advanced Settings Toggle */}
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={() => setShowAdvancedEmail(!showAdvancedEmail)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {showAdvancedEmail ? 'Hide' : 'Show'} Advanced Settings
                    </button>
                  </div>

                  {/* Advanced Settings */}
                  {showAdvancedEmail && (
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">SMTP Server</label>
                        <Input
                          placeholder="smtp.gmail.com"
                          defaultValue="smtp.gmail.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">SMTP Port</label>
                        <Input
                          type="number"
                          placeholder="587"
                          defaultValue="587"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Default Sender Name</label>
                        <Input
                          placeholder="Your Company Name"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateEmailConfig(emailConfig);
                        setShowEmailForm(false);
                        setShowSaveSuccess(true);
                        setTimeout(() => setShowSaveSuccess(false), 3000);
                      }}
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmailConfig(settings.emailConfig);
                        setShowEmailForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch('http://localhost:8000/api/email/test', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              senderEmail: emailConfig.senderEmail,
                              senderPassword: emailConfig.senderPassword,
                              smtpServer: emailConfig.smtpServer,
                              smtpPort: emailConfig.smtpPort,
                              testEmail: emailConfig.senderEmail // Send test to self
                            }),
                          });
                          
                          if (response.ok) {
                            alert('Test email sent successfully! Check your inbox.');
                          } else {
                            const error = await response.json();
                            alert(`Test email failed: ${error.error}`);
                          }
                        } catch (error) {
                          alert(`Test email failed: ${error.message}`);
                        }
                      }}
                      disabled={!emailConfig.senderEmail || !emailConfig.senderPassword}
                    >
                      Test Email
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Currency Settings */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Currency Settings
              </CardTitle>
              <CardDescription>
                Configure currency display preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Currency</label>
                <div className="text-xs text-gray-500 mb-2">
                  Current: {displayCurrency === 'ORIGINAL' ? 'Original Currency' : `${displayCurrency} (${getCurrencySymbol(displayCurrency)})`}
                </div>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                >
                  <option value="ORIGINAL">Original Currency (from Odoo)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="KWD">KWD (Kuwaiti Dinar)</option>
                  <option value="BHD">BHD (Bahraini Dinar)</option>
                  <option value="QAR">QAR (Qatari Riyal)</option>
                  <option value="OMR">OMR (Omani Rial)</option>
                  <option value="JOD">JOD (Jordanian Dinar)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Currency Conversion</label>
                <div className="text-xs text-gray-600">
                  <p>• Individual invoices will display in their original currency</p>
                  <p>• Total amounts will be {displayCurrency === 'ORIGINAL' ? 'shown in their original currency' : `converted to ${displayCurrency}`}</p>
                  <p>• Exchange rates are updated daily</p>
                  <p>• Current rate: {displayCurrency === 'ORIGINAL' ? 'No conversion (original currency from Odoo)' : `1 AED = ${getExchangeRate(displayCurrency)} ${displayCurrency}`}</p>
                </div>
              </div>

              <Button 
                className="w-full"
                onClick={() => {
                  updateCurrency(displayCurrency);
                  setShowSaveSuccess(true);
                  setTimeout(() => setShowSaveSuccess(false), 3000);
                }}
              >
                Save Currency Settings
              </Button>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session Timeout (minutes)</label>
                <Input
                  type="number"
                  placeholder="60"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings(prev => ({ 
                    ...prev, 
                    sessionTimeout: parseInt(e.target.value) || 60 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Enable Two-Factor Authentication</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="2fa"
                    checked={securitySettings.enable2FA}
                    onChange={(e) => setSecuritySettings(prev => ({ 
                      ...prev, 
                      enable2FA: e.target.checked 
                    }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="2fa" className="text-sm text-gray-700">
                    Require 2FA for all users
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Retention (days)</label>
                <Input
                  type="number"
                  placeholder="90"
                  value={securitySettings.dataRetention}
                  onChange={(e) => setSecuritySettings(prev => ({ 
                    ...prev, 
                    dataRetention: parseInt(e.target.value) || 90 
                  }))}
                />
              </div>

              <Button 
                className="w-full"
                onClick={() => {
                  updateSecuritySettings(securitySettings);
                  setShowSaveSuccess(true);
                  setTimeout(() => setShowSaveSuccess(false), 3000);
                }}
              >
                Save Security Settings
              </Button>
            </CardContent>
          </Card>

          {/* Automated Reports */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Automated Daily Reports
              </CardTitle>
              <CardDescription>
                Configure automated daily reports sent via email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {!showAutomatedReportsForm ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Automated reports</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAutomatedReportsForm(true)}
                    >
                      Configure
                    </Button>
                  </div>
                  {automatedReportsConfig.enabled && (
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>• Status: Enabled</p>
                      <p>• Recipient: {automatedReportsConfig.recipient_email}</p>
                      <p>• Time: {automatedReportsConfig.report_time}</p>
                      <p>• Schedule: {automatedReportsConfig.check_interval}</p>
                    </div>
                  )}
                  {!automatedReportsConfig.enabled && (
                    <div className="text-xs text-gray-500">
                      Automated reports are disabled
                    </div>
                  )}
                  <div className="text-xs text-blue-600 mt-2">
                    💡 Set up Windows Task Scheduler to run scripts/daily_report.bat hourly
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enable Automated Reports</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={automatedReportsConfig.enabled}
                        onChange={(e) => setAutomatedReportsConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-600">Send daily reports automatically</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient Email</label>
                    <Input
                      value={automatedReportsConfig.recipient_email}
                      onChange={(e) => setAutomatedReportsConfig(prev => ({ ...prev, recipient_email: e.target.value }))}
                      type="email"
                      placeholder="finance@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report Time</label>
                    <Input
                      value={automatedReportsConfig.report_time}
                      onChange={(e) => setAutomatedReportsConfig(prev => ({ ...prev, report_time: e.target.value }))}
                      type="time"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Odoo Connection</label>
                    <Input
                      value={automatedReportsConfig.odoo_connection.url}
                      onChange={(e) => setAutomatedReportsConfig(prev => ({ 
                        ...prev, 
                        odoo_connection: { ...prev.odoo_connection, url: e.target.value }
                      }))}
                      placeholder="https://your-odoo-instance.com"
                    />
                    <Input
                      value={automatedReportsConfig.odoo_connection.database}
                      onChange={(e) => setAutomatedReportsConfig(prev => ({ 
                        ...prev, 
                        odoo_connection: { ...prev.odoo_connection, database: e.target.value }
                      }))}
                      placeholder="database_name"
                    />
                    <Input
                      value={automatedReportsConfig.odoo_connection.username}
                      onChange={(e) => setAutomatedReportsConfig(prev => ({ 
                        ...prev, 
                        odoo_connection: { ...prev.odoo_connection, username: e.target.value }
                      }))}
                      placeholder="username"
                    />
                    <div className="relative">
                      <Input
                        type={showAutomatedOdooPassword ? "text" : "password"}
                        value={automatedReportsConfig.odoo_connection.password}
                        onChange={(e) => setAutomatedReportsConfig(prev => ({ 
                          ...prev, 
                          odoo_connection: { ...prev.odoo_connection, password: e.target.value }
                        }))}
                        placeholder="password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAutomatedOdooPassword(!showAutomatedOdooPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showAutomatedOdooPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Settings</label>
                    <Input
                      value={automatedReportsConfig.email_settings.sender_email}
                      onChange={(e) => setAutomatedReportsConfig(prev => ({ 
                        ...prev, 
                        email_settings: { ...prev.email_settings, sender_email: e.target.value }
                      }))}
                      placeholder="reports@company.com"
                    />
                    <div className="relative">
                      <Input
                        type={showAutomatedEmailPassword ? "text" : "password"}
                        value={automatedReportsConfig.email_settings.sender_password}
                        onChange={(e) => setAutomatedReportsConfig(prev => ({ 
                          ...prev, 
                          email_settings: { ...prev.email_settings, sender_password: e.target.value }
                        }))}
                        placeholder="password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAutomatedEmailPassword(!showAutomatedEmailPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showAutomatedEmailPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3">
                    <Button
                      size="sm"
                      onClick={saveAutomatedReportsConfig}
                      disabled={isSavingAutomatedConfig}
                      className="flex-1"
                    >
                      {isSavingAutomatedConfig ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testAutomatedReport}
                      disabled={isTestingAutomatedReport}
                      className="flex-1"
                    >
                      {isTestingAutomatedReport ? 'Testing...' : 'Test Report'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAutomatedReportsForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* About */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                About
              </CardTitle>
              <CardDescription>
                Application information and version details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Version</span>
                  <span className="text-sm font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Build Date</span>
                  <span className="text-sm font-medium">2024-01-15</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">License</span>
                  <span className="text-sm font-medium">MIT</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Odoo Invoice Follow-Up Manager helps you manage overdue invoices and send automated follow-up emails to clients.
                </p>
              </div>

              <Button variant="outline" className="w-full">
                Check for Updates
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  // Reset all settings to defaults
                  updateEmailConfig({
                    senderEmail: '',
                    senderPassword: '',
                    ccList: '',
                    smtpServer: 'smtp.gmail.com',
                    smtpPort: '587',
                    defaultSenderName: '',
                  });
                  updateCurrency('ORIGINAL');
                  updateSecuritySettings({
                    sessionTimeout: 60,
                    enable2FA: false,
                    dataRetention: 90,
                  });
                  setShowSaveSuccess(true);
                  setTimeout(() => setShowSaveSuccess(false), 3000);
                }}
              >
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>

          {/* Download Report */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Download Report
              </CardTitle>
              <CardDescription>
                Generate and download a summary report of overdue invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Overdue invoices report</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateOverdueReport}
                    disabled={!isConnected || isGeneratingReport}
                    className="flex items-center gap-2"
                  >
                    {isGeneratingReport ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Download Report
                      </>
                    )}
                  </Button>
                </div>
                
                {isConnected && (
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• Total overdue invoices: {overdueInvoices?.length || 0}</p>
                    <p>• Total overdue amount: {(overdueInvoices?.reduce((sum, inv) => sum + inv.amount_due, 0) || 0).toLocaleString()}</p>
                    <p>• Severely overdue clients: {
                      overdueInvoices ? 
                        Object.keys(overdueInvoices.reduce((acc, inv) => {
                          if (!acc[inv.client_name]) acc[inv.client_name] = [];
                          acc[inv.client_name].push(inv);
                          return acc;
                        }, {})).filter(clientName => {
                          const clientInvoices = overdueInvoices.filter(inv => inv.client_name === clientName);
                          const maxDays = Math.max(...clientInvoices.map(inv => inv.days_overdue));
                          return maxDays > 30;
                        }).length : 0
                    }</p>
                  </div>
                )}
                
                {!isConnected && (
                  <div className="text-xs text-gray-500">
                    Connect to Odoo to generate reports
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage; 