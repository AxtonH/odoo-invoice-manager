import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import Button from './ui/Button';
import { Input } from './ui/Input';
import { Select, SelectOption } from './ui/Select';
import { Badge } from './ui/Badge';
import { 
  Mail, 
  Users, 
  FileText, 
  Send, 
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  AlertTriangle,
  Upload,
  X,
  ArrowRight,
  ArrowLeft,
  Edit,
  Eye as EyeIcon,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

const EmailSender = () => {
  const { overdueInvoices, isConnected, settings, connectionId, convertCurrency, formatCurrencyAmount } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClients, setSelectedClients] = useState([]);
  const [emailConfigs, setEmailConfigs] = useState({});
  const [globalEmailConfig, setGlobalEmailConfig] = useState({
    template: 'auto',
    ccList: settings.emailConfig.ccList || '',
    enablePdfAttachment: true,
  });
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEmails, setExpandedEmails] = useState({});
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [sendResults, setSendResults] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Group invoices by client
  const clientInvoices = useMemo(() => {
    const grouped = {};
    overdueInvoices.forEach(invoice => {
      if (!grouped[invoice.client_name]) {
        grouped[invoice.client_name] = [];
      }
      grouped[invoice.client_name].push(invoice);
    });
    return grouped;
  }, [overdueInvoices]);

  // Group clients by overdue severity
  const groupedClients = useMemo(() => {
    const recent = [];
    const moderate = [];
    const severe = [];

    Object.entries(clientInvoices).forEach(([clientName, invoices]) => {
      // Filter by search query
      if (searchQuery && !clientName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }
      
      const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
      if (maxDays <= 15) {
        recent.push(clientName);
      } else if (maxDays <= 30) {
        moderate.push(clientName);
      } else {
        severe.push(clientName);
      }
    });

    return { recent, moderate, severe };
  }, [clientInvoices, searchQuery]);

  // Sort selected clients with matching clients at the top
  const sortedSelectedClients = useMemo(() => {
    if (!emailSearchQuery.trim()) {
      return selectedClients;
    }
    
    const matchingClients = selectedClients.filter(clientName => {
      const invoices = clientInvoices[clientName];
      const clientEmail = invoices[0]?.client_email || '';
      return clientName.toLowerCase().includes(emailSearchQuery.toLowerCase()) ||
             clientEmail.toLowerCase().includes(emailSearchQuery.toLowerCase());
    });
    
    const nonMatchingClients = selectedClients.filter(clientName => !matchingClients.includes(clientName));
    
    return [...matchingClients, ...nonMatchingClients];
  }, [selectedClients, emailSearchQuery, clientInvoices]);

  const handleClientToggle = (clientName) => {
    setSelectedClients(prev => 
      prev.includes(clientName) 
        ? prev.filter(name => name !== clientName)
        : [...prev, clientName]
    );
  };

  const handleSelectAll = (clientList) => {
    setSelectedClients(clientList);
  };

  const handleDeselectAll = (clientList) => {
    setSelectedClients(prev => prev.filter(client => !clientList.includes(client)));
  };

  const handleClearSelection = () => {
    setSelectedClients([]);
  };

  const toggleEmailExpansion = (clientName) => {
    setExpandedEmails(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  const handleEmailSearch = (query) => {
    setEmailSearchQuery(query);
    
    if (query.trim()) {
      // Find matching clients
      const matchingClients = selectedClients.filter(clientName => {
        const invoices = clientInvoices[clientName];
        const clientEmail = invoices[0]?.client_email || '';
        return clientName.toLowerCase().includes(query.toLowerCase()) ||
               clientEmail.toLowerCase().includes(query.toLowerCase());
      });
      
      // Scroll to first matching client at current viewport position
      if (matchingClients.length > 0) {
        setTimeout(() => {
          const firstMatch = document.getElementById(`email-card-${matchingClients[0]}`);
          if (firstMatch) {
            const currentScrollY = window.scrollY;
            const elementTop = firstMatch.offsetTop;
            const elementHeight = firstMatch.offsetHeight;
            const windowHeight = window.innerHeight;
            
            // Calculate if element is outside current viewport
            const isAbove = elementTop < currentScrollY;
            const isBelow = elementTop + elementHeight > currentScrollY + windowHeight;
            
            if (isAbove || isBelow) {
              // Scroll to bring element into view at current position
              const targetScrollY = isAbove ? elementTop : elementTop + elementHeight - windowHeight;
              window.scrollTo({
                top: targetScrollY,
                behavior: 'smooth'
              });
            }
          }
        }, 100);
      }
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && selectedClients.length > 0) {
      // Initialize email configs for selected clients
      const initialConfigs = {};
      selectedClients.forEach(clientName => {
        const invoices = clientInvoices[clientName];
        const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
        const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
        
        // Automatically select template based on overdue severity
        let templateType = 'initial';
        if (maxDays > 30) {
          templateType = 'final';
        } else if (maxDays > 15) {
          templateType = 'second';
        }
        
        const template = generateEmailBody(clientName, invoices, totalAmount, maxDays, templateType);
        
        const clientEmail = invoices[0]?.client_email || '';
        console.log(`🔍 Frontend: Setting email for ${clientName}: '${clientEmail}'`);
        
        initialConfigs[clientName] = {
          subject: template.subject,
          body: template.body,
          cc: globalEmailConfig.ccList,
          recipientEmail: clientEmail, // Auto-fill with client email from Odoo
          attachments: [],
          customAttachments: [],
          templateType: templateType // Store the selected template type
        };
      });
      setEmailConfigs(initialConfigs);
      setCurrentStep(2);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateEmailBody = (clientName, invoices, totalAmount, maxDays, templateType = 'initial') => {
    // Convert amounts to display currency
    const displayCurrency = settings.currency || 'AED';
    const convertedTotalAmount = convertCurrency(totalAmount, invoices[0]?.currency_symbol || 'AED', displayCurrency);
    
    // Generate HTML table for invoices
    const generateInvoiceTable = (invoices) => {
      const totalFormattedAmount = displayCurrency === 'ORIGINAL' 
        ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
        : formatCurrencyAmount(convertedTotalAmount, displayCurrency);
      
      // Create table rows
      const tableRows = invoices.map(inv => {
        const convertedAmount = convertCurrency(inv.amount_due, inv.currency_symbol || 'AED', displayCurrency);
        const formattedAmount = displayCurrency === 'ORIGINAL' 
          ? formatCurrencyAmount(convertedAmount, displayCurrency, inv.currency_symbol || 'AED')
          : formatCurrencyAmount(convertedAmount, displayCurrency);
        
        return `<tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${inv.invoice_number}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${inv.invoice_date}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${inv.due_date}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${inv.origin || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formattedAmount}</td>
        </tr>`;
      }).join('');
      
      return `<table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-family: Arial, sans-serif; font-size: 14px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Reference</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Date</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Due Date</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Origin</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total Due</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9f9f9; border-top: 2px solid #ddd;">
            <td colspan="3" style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total Due</td>
            <td style="padding: 12px; border: 1px solid #ddd;"></td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${totalFormattedAmount}</td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td colspan="3" style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total Overdue</td>
            <td style="padding: 12px; border: 1px solid #ddd;"></td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${totalFormattedAmount}</td>
          </tr>
        </tfoot>
      </table>`;
    };
    
    const invoiceTable = generateInvoiceTable(invoices);

    // Get template based on type
    let template;
    switch (templateType) {
      case 'second':
        template = {
          subject: `Invoice notice - outstanding balance of ${displayCurrency === 'ORIGINAL' 
            ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
            : formatCurrencyAmount(convertedTotalAmount, displayCurrency)
          }`,
          body: `Dear ${clientName},

I hope you're doing well.

This is a follow-up regarding our previous message concerning your outstanding balance of ${displayCurrency === 'ORIGINAL' 
            ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
            : formatCurrencyAmount(convertedTotalAmount, displayCurrency)
          }, which remains unsettled on your account.

As mentioned earlier, we kindly request that you arrange for payment within ${maxDays} days to avoid any potential disruptions to services or further escalation.

If you have already processed the payment, please disregard this reminder. Otherwise, we encourage you to reach out to our Finance Team if you need any assistance or would like to discuss this matter further.

${invoiceTable}

We appreciate your prompt attention to this issue.`
        };
        break;
      case 'final':
        template = {
          subject: `Invoice notice - outstanding balance of ${displayCurrency === 'ORIGINAL' 
            ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
            : formatCurrencyAmount(convertedTotalAmount, displayCurrency)
          }`,
          body: `Dear ${clientName},

This is our final reminder regarding the outstanding balance of ${displayCurrency === 'ORIGINAL' 
            ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
            : formatCurrencyAmount(convertedTotalAmount, displayCurrency)
          } on your account, which has now been overdue for ${maxDays} days.

Despite our previous communications, we have yet to receive payment or hear from your team regarding this matter.

We kindly urge you to settle the balance immediately to prevent further action, which may include suspension of services or referral to collections, in accordance with our company policy.

If payment has been made, please provide confirmation at your earliest convenience. For any concerns, our Finance Team remains available to assist.

${invoiceTable}

Thank you for your immediate attention.`
        };
        break;
      default: // initial
        template = {
          subject: `Invoice notice - outstanding balance of ${displayCurrency === 'ORIGINAL' 
            ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
            : formatCurrencyAmount(convertedTotalAmount, displayCurrency)
          }`,
          body: `Dear ${clientName},

I hope this message finds you well.

It has come to our attention that you have an outstanding balance of ${displayCurrency === 'ORIGINAL' 
            ? formatCurrencyAmount(convertedTotalAmount, displayCurrency, invoices[0]?.currency_symbol || 'AED')
            : formatCurrencyAmount(convertedTotalAmount, displayCurrency)
          } on your account.

We kindly request that you take the necessary steps to settle this amount within the next ${maxDays} days from the date of this email.

If you have already made the payment after receiving this message, please disregard this notice.

Should you have any questions or require assistance, our CS department is available to support you.

${invoiceTable}

Thank you for your cooperation.`
        };
        break;
    }

    return template;
  };

  const updateEmailConfig = (clientName, field, value) => {
    setEmailConfigs(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [field]: value
      }
    }));
  };

  const handleFileUpload = (clientName, event) => {
    const files = Array.from(event.target.files);
    updateEmailConfig(clientName, 'customAttachments', [
      ...(emailConfigs[clientName]?.customAttachments || []),
      ...files
    ]);
  };

  const removeAttachment = (clientName, index) => {
    const currentAttachments = emailConfigs[clientName]?.customAttachments || [];
    updateEmailConfig(clientName, 'customAttachments', 
      currentAttachments.filter((_, i) => i !== index)
    );
  };

  const getClientStats = (clientName) => {
    const invoices = clientInvoices[clientName];
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
    const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
    const hasEmail = invoices.some(inv => inv.client_email);
    
    // Get the most common currency from this client's invoices
    const invoiceCurrencies = invoices.map(inv => inv.currency_symbol || 'AED');
    const mostCommonCurrency = invoiceCurrencies.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    const sourceCurrency = Object.keys(mostCommonCurrency).reduce((a, b) => 
      mostCommonCurrency[a] > mostCommonCurrency[b] ? a : b
    );
    
    // Convert to display currency
    const displayCurrency = settings.currency || 'AED';
    const convertedAmount = convertCurrency(totalAmount, sourceCurrency, displayCurrency);
    
    return { 
      totalAmount: convertedAmount, 
      maxDays, 
      hasEmail, 
      invoiceCount: invoices.length,
      sourceCurrency,
      displayCurrency,
      formattedAmount: displayCurrency === 'ORIGINAL' 
        ? formatCurrencyAmount(convertedAmount, displayCurrency, sourceCurrency)
        : formatCurrencyAmount(convertedAmount, displayCurrency)
    };
  };

  const getOverdueBadge = (days) => {
    if (days <= 15) return <Badge variant="success">Recent</Badge>;
    if (days <= 30) return <Badge variant="warning">Moderate</Badge>;
    return <Badge variant="danger">Severe</Badge>;
  };

  const handleSendEmails = async () => {
    if (!selectedClients.length) return;
    
    if (!connectionId) {
      setSendResults({
        success: false,
        error: 'No active connection found. Please reconnect to Odoo.',
        successfulSends: 0,
        failedSends: selectedClients.length,
        failedClients: selectedClients.map(client => `${client} (no connection)`)
      });
      return;
    }
    
    setIsSending(true);
    setSendResults(null);
    setShowSuccessMessage(false);
    
    try {
      // Prepare email configurations for sending
      const emailConfigsForSending = {};
      selectedClients.forEach(clientName => {
        const invoices = clientInvoices[clientName];
        const stats = getClientStats(clientName);
        const config = emailConfigs[clientName] || {};
        
        emailConfigsForSending[clientName] = {
          recipientEmail: config.recipientEmail || invoices[0]?.client_email || '',
          subject: config.subject || generateEmailBody(clientName, invoices, stats.totalAmount, stats.maxDays, globalEmailConfig.template).subject,
          body: config.body || generateEmailBody(clientName, invoices, stats.totalAmount, stats.maxDays, globalEmailConfig.template).body,
          cc: config.cc || globalEmailConfig.ccList,
          attachments: config.customAttachments || []
        };
      });
      
      // Debug: Log what we're sending
      console.log('🔍 Frontend: Sending email request with data:', {
        connectionId,
        selectedClients,
        emailConfigs: emailConfigsForSending,
        globalEmailConfig: {
          ...globalEmailConfig,
          senderEmail: settings.emailConfig.senderEmail,
          senderPassword: settings.emailConfig.senderPassword,
          smtpServer: settings.emailConfig.smtpServer,
          smtpPort: settings.emailConfig.smtpPort
        }
      });
      
      // Call the backend API to send emails
      const response = await fetch('http://localhost:8000/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId,
          selectedClients,
          emailConfigs: emailConfigsForSending,
          globalEmailConfig: {
            ...globalEmailConfig,
            senderEmail: settings.emailConfig.senderEmail,
            senderPassword: settings.emailConfig.senderPassword,
            smtpServer: settings.emailConfig.smtpServer,
            smtpPort: settings.emailConfig.smtpPort
          },
          // Send the invoice data from the dashboard to avoid fetching from Odoo again
          invoiceData: overdueInvoices
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setSendResults(result);
      
      if (result.successfulSends > 0) {
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 5000);
        
        // Reset to step 1 after successful send
        setTimeout(() => {
          setCurrentStep(1);
          setSelectedClients([]);
          setEmailConfigs({});
          setSendResults(null);
        }, 3000);
      }
      
    } catch (error) {
      console.error('Error sending emails:', error);
      setSendResults({
        success: false,
        error: error.message,
        successfulSends: 0,
        failedSends: selectedClients.length,
        failedClients: selectedClients.map(client => `${client} (API error: ${error.message})`)
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Connection</h3>
          <p className="text-gray-500">Please connect to Odoo or enable demo mode to send emails.</p>
        </div>
      </div>
    );
  }

  if (!overdueInvoices.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-success-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Overdue Invoices</h3>
          <p className="text-gray-500">No emails to send - all invoices are up to date.</p>
        </div>
      </div>
    );
  }

  // Step 1: Client Selection
  if (currentStep === 1) {
    return (
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
            <span className="text-sm font-medium text-primary-600">Select Clients</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">2</div>
            <span className="text-sm font-medium text-gray-500">Customize Emails</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">3</div>
            <span className="text-sm font-medium text-gray-500">Send Emails</span>
          </div>
        </div>



        {/* Client Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Clients
              {selectedClients.length > 0 && (
                <Badge variant="default">{selectedClients.length} selected</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Choose which clients to send follow-up emails to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search clients by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Recent Clients */}
              {groupedClients.recent.length > 0 && (
                <div>
                                  <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-success-600" />
                    Recent (≤ 15 days)
                    <Badge variant="success">{groupedClients.recent.length}</Badge>
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll(groupedClients.recent)}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeselectAll(groupedClients.recent)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedClients.recent.map(clientName => {
                      const stats = getClientStats(clientName);
                      return (
                        <div
                          key={clientName}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedClients.includes(clientName)
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleClientToggle(clientName)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {clientName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {stats.invoiceCount} invoice(s) • {stats.formattedAmount}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {getOverdueBadge(stats.maxDays)}
                                {!stats.hasEmail && (
                                  <Badge variant="danger">No Email</Badge>
                                )}
                              </div>
                            </div>
                            {selectedClients.includes(clientName) && (
                              <CheckCircle className="h-4 w-4 text-primary-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Moderate Clients */}
              {groupedClients.moderate.length > 0 && (
                <div>
                                  <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning-600" />
                    Moderate (16-30 days)
                    <Badge variant="warning">{groupedClients.moderate.length}</Badge>
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll(groupedClients.moderate)}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeselectAll(groupedClients.moderate)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedClients.moderate.map(clientName => {
                      const stats = getClientStats(clientName);
                      return (
                        <div
                          key={clientName}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedClients.includes(clientName)
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleClientToggle(clientName)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {clientName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {stats.invoiceCount} invoice(s) • {stats.formattedAmount}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {getOverdueBadge(stats.maxDays)}
                                {!stats.hasEmail && (
                                  <Badge variant="danger">No Email</Badge>
                                )}
                              </div>
                            </div>
                            {selectedClients.includes(clientName) && (
                              <CheckCircle className="h-4 w-4 text-primary-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Severe Clients */}
              {groupedClients.severe.length > 0 && (
                <div>
                                  <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-danger-600" />
                    Severe (31+ days)
                    <Badge variant="danger">{groupedClients.severe.length}</Badge>
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll(groupedClients.severe)}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeselectAll(groupedClients.severe)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedClients.severe.map(clientName => {
                      const stats = getClientStats(clientName);
                      return (
                        <div
                          key={clientName}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedClients.includes(clientName)
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleClientToggle(clientName)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {clientName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {stats.invoiceCount} invoice(s) • {stats.formattedAmount}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {getOverdueBadge(stats.maxDays)}
                                {!stats.hasEmail && (
                                  <Badge variant="danger">No Email</Badge>
                                )}
                              </div>
                            </div>
                            {selectedClients.includes(clientName) && (
                              <CheckCircle className="h-4 w-4 text-primary-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selection Actions */}
              {selectedClients.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    {selectedClients.length} client(s) selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearSelection}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      className="flex items-center gap-2"
                    >
                      Next Step
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Individual Email Customization
  if (currentStep === 2) {
    return (
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-success-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-success-600">Select Clients</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
            <span className="text-sm font-medium text-primary-600">Customize Emails</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">3</div>
            <span className="text-sm font-medium text-gray-500">Send Emails</span>
          </div>
        </div>

        {/* Global Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Global Email Settings
            </CardTitle>
            <CardDescription>
              Configure default email settings for all clients. Templates are automatically selected based on overdue severity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Override Template (Optional)</label>
                <Select
                  value={globalEmailConfig.template}
                  onChange={(e) => {
                    setGlobalEmailConfig(prev => ({
                      ...prev,
                      template: e.target.value
                    }));
                    // Regenerate email configs with new template
                    const updatedConfigs = {};
                    selectedClients.forEach(clientName => {
                      const invoices = clientInvoices[clientName];
                      const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
                      const maxDays = Math.max(...invoices.map(inv => inv.days_overdue));
                      
                      // Determine template type based on selection
                      let templateType = e.target.value;
                      if (e.target.value === 'auto') {
                        // Auto-select based on overdue severity
                        if (maxDays > 30) {
                          templateType = 'final';
                        } else if (maxDays > 15) {
                          templateType = 'second';
                        } else {
                          templateType = 'initial';
                        }
                      }
                      
                      const template = generateEmailBody(clientName, invoices, totalAmount, maxDays, templateType);
                      
                      updatedConfigs[clientName] = {
                        subject: template.subject,
                        body: template.body,
                        cc: globalEmailConfig.ccList,
                        recipientEmail: emailConfigs[clientName]?.recipientEmail || invoices[0]?.client_email || '', // Preserve recipient email
                        attachments: [],
                        customAttachments: emailConfigs[clientName]?.customAttachments || [],
                        templateType: templateType
                      };
                    });
                    setEmailConfigs(updatedConfigs);
                  }}
                >
                  <SelectOption value="auto">Auto-select based on overdue days</SelectOption>
                  <SelectOption value="initial">Initial Reminder</SelectOption>
                  <SelectOption value="second">Second Reminder</SelectOption>
                  <SelectOption value="final">Final Reminder</SelectOption>
                </Select>
                <p className="text-xs text-gray-500">
                  Leave as "Auto-select" to use severity-based templates, or override for all clients
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default CC List</label>
                <Input
                  placeholder="email1@company.com, email2@company.com"
                  value={globalEmailConfig.ccList}
                  onChange={(e) => {
                    setGlobalEmailConfig(prev => ({
                      ...prev,
                      ccList: e.target.value
                    }));
                    // Update CC for all clients
                    const updatedConfigs = {};
                    selectedClients.forEach(clientName => {
                      updatedConfigs[clientName] = {
                        ...emailConfigs[clientName],
                        cc: e.target.value
                      };
                    });
                    setEmailConfigs(updatedConfigs);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enablePdf"
                  checked={globalEmailConfig.enablePdfAttachment}
                  onChange={(e) => setGlobalEmailConfig(prev => ({
                    ...prev,
                    enablePdfAttachment: e.target.checked
                  }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="enablePdf" className="text-sm">
                  Enable automatic invoice PDF attachment (generates PDF from Odoo for each client)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Client
            </CardTitle>
            <CardDescription>
              Search for a specific client to quickly locate them at the top of the list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by client name or email..."
                value={emailSearchQuery}
                onChange={(e) => handleEmailSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {emailSearchQuery && (
                <button
                  onClick={() => handleEmailSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {emailSearchQuery && (
              <div className="mt-2 text-sm text-gray-600">
                {sortedSelectedClients.filter(clientName => {
                  const invoices = clientInvoices[clientName];
                  const clientEmail = invoices[0]?.client_email || '';
                  return clientName.toLowerCase().includes(emailSearchQuery.toLowerCase()) ||
                         clientEmail.toLowerCase().includes(emailSearchQuery.toLowerCase());
                }).length} client(s) found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Client Selection
          </Button>
          <Button
            onClick={() => setCurrentStep(3)}
            className="flex items-center gap-2"
          >
            Review & Send
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Individual Email Customization */}
        <div className="space-y-4">
          {sortedSelectedClients.map((clientName, index) => {
            const config = emailConfigs[clientName] || {};
            const stats = getClientStats(clientName);
            const isExpanded = expandedEmails[clientName] || false;
            
            return (
              <Card key={clientName} id={`email-card-${clientName}`} className="border-l-4 border-l-primary-500">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleEmailExpansion(clientName)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <Edit className="h-5 w-5" />
                      <div>
                        <CardTitle className="text-lg">
                          {clientName}
                          <Badge variant="default" className="ml-2">{index + 1} of {selectedClients.length}</Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {stats.invoiceCount} invoice(s) • {stats.formattedAmount} • {stats.maxDays} days overdue
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Template:</span>
                      <Badge 
                        variant={
                          config.templateType === 'final' ? 'danger' : 
                          config.templateType === 'second' ? 'warning' : 'success'
                        }
                      >
                        {config.templateType === 'final' ? 'Final Reminder' :
                         config.templateType === 'second' ? 'Second Reminder' : 'Initial Reminder'}
                      </Badge>
                      {globalEmailConfig.template === 'auto' && (
                        <span className="text-xs text-gray-400">(Auto-selected)</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        value={config.subject || ''}
                        onChange={(e) => updateEmailConfig(clientName, 'subject', e.target.value)}
                        placeholder="Email subject..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">CC (comma-separated)</label>
                      <Input
                        value={config.cc || ''}
                        onChange={(e) => updateEmailConfig(clientName, 'cc', e.target.value)}
                        placeholder="email1@company.com, email2@company.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient Email</label>
                    <Input
                      type="email"
                      value={config.recipientEmail || clientInvoices[clientName]?.[0]?.client_email || ''}
                      onChange={(e) => updateEmailConfig(clientName, 'recipientEmail', e.target.value)}
                      placeholder="client@company.com"
                    />
                    <p className="text-xs text-gray-500">
                      {clientInvoices[clientName]?.[0]?.client_email ? 
                        'Auto-filled from Odoo. You can edit if needed.' : 
                        'No email found in Odoo. Please enter the client email address.'
                      }
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Body</label>
                    <textarea
                      value={config.body || ''}
                      onChange={(e) => updateEmailConfig(clientName, 'body', e.target.value)}
                      rows={12}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Email content..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Additional Attachments</label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById(`file-upload-${clientName}`).click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Files
                      </Button>
                      <input
                        id={`file-upload-${clientName}`}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => handleFileUpload(clientName, e)}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-500">
                        {config.customAttachments?.length || 0} file(s) selected
                      </span>
                    </div>
                    
                    {config.customAttachments?.length > 0 && (
                      <div className="space-y-2">
                        {config.customAttachments.map((file, fileIndex) => (
                          <div key={fileIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">{file.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttachment(clientName, fileIndex)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Step 3: Review and Send
  if (currentStep === 3) {
    return (
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-success-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-success-600">Select Clients</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-success-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-success-600">Customize Emails</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
            <span className="text-sm font-medium text-primary-600">Send Emails</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Email Customization
          </Button>
        </div>

        {/* Review Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeIcon className="h-5 w-5" />
              Review Summary
            </CardTitle>
            <CardDescription>
              Review all emails before sending
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Total Clients</p>
                  <p className="text-sm text-gray-600">{selectedClients.length} clients selected</p>
                </div>
                <div>
                  <p className="font-medium">Total Invoices</p>
                  <p className="text-sm text-gray-600">
                    {selectedClients.reduce((sum, client) => sum + getClientStats(client).invoiceCount, 0)} invoices
                  </p>
                </div>
                <div>
                  <p className="font-medium">Total Amount</p>
                  <p className="text-sm text-gray-600">
                    {selectedClients.reduce((sum, client) => {
                      const stats = getClientStats(client);
                      return sum + stats.totalAmount;
                    }, 0).toLocaleString()} in {settings.currency}
                  </p>
                </div>
                <div>
                  <p className="font-medium">PDF Attachments</p>
                  <p className="text-sm text-gray-600">
                    {globalEmailConfig.enablePdfAttachment ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedClients.map((clientName, index) => {
                  const config = emailConfigs[clientName] || {};
                  const stats = getClientStats(clientName);
                  
                  return (
                    <div key={clientName} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{clientName}</h4>
                          <p className="text-sm text-gray-600">
                            {stats.invoiceCount} invoice(s) • {stats.formattedAmount}
                          </p>
                        </div>
                        <Badge variant="default">{index + 1}</Badge>
                      </div>
                      
                                             <div className="space-y-2 text-sm">
                         <div>
                           <span className="font-medium">Template:</span> 
                           <Badge 
                             variant={
                               config.templateType === 'final' ? 'danger' : 
                               config.templateType === 'second' ? 'warning' : 'success'
                             }
                             className="ml-2"
                           >
                             {config.templateType === 'final' ? 'Final Reminder' :
                              config.templateType === 'second' ? 'Second Reminder' : 'Initial Reminder'}
                           </Badge>
                         </div>
                         <div>
                           <span className="font-medium">Subject:</span> {config.subject}
                         </div>
                         <div>
                           <span className="font-medium">To:</span> {config.recipientEmail || 'No email specified'}
                         </div>
                         <div>
                           <span className="font-medium">CC:</span> {config.cc || 'None'}
                         </div>
                         <div>
                           <span className="font-medium">Attachments:</span> {config.customAttachments?.length || 0} custom files
                           {globalEmailConfig.enablePdfAttachment && (
                             <span className="text-green-600 ml-1">• Invoice PDF (auto-generated)</span>
                           )}
                         </div>
                         <div>
                           <span className="font-medium">Body Preview:</span>
                           <p className="text-gray-600 mt-1 line-clamp-2">
                             {config.body?.substring(0, 150)}...
                           </p>
                         </div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Message */}
        {showSuccessMessage && (
          <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {sendResults?.successfulSends > 0 
                  ? `Successfully sent ${sendResults.successfulSends} email(s)!`
                  : 'Email sending completed!'
                }
              </span>
            </div>
          </div>
        )}

        {/* Send Results */}
        {sendResults && (
          <Card className={`border-2 ${sendResults.successfulSends > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${sendResults.successfulSends > 0 ? 'text-green-800' : 'text-red-800'}`}>
                {sendResults.successfulSends > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                Email Sending Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Clients:</span>
                  <span className="text-sm">{sendResults.totalClients}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700">Successful Sends:</span>
                  <span className="text-sm text-green-700 font-medium">{sendResults.successfulSends}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">Failed Sends:</span>
                  <span className="text-sm text-red-700 font-medium">{sendResults.failedSends}</span>
                </div>
                
                {sendResults.failedClients && sendResults.failedClients.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-2">Failed Clients:</p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {sendResults.failedClients.map((client, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                          {client}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {sendResults.error && (
                  <div className="mt-3 p-3 bg-red-100 rounded-lg">
                    <p className="text-sm font-medium text-red-800">Error:</p>
                    <p className="text-sm text-red-700">{sendResults.error}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Send Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSendEmails}
            disabled={isSending}
            size="lg"
            className="flex items-center gap-2 px-8"
          >
            {isSending ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending Emails...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Send All Emails ({selectedClients.length})
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default EmailSender; 