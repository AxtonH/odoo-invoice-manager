import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Users, 
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

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

const Dashboard = () => {
  const { overdueInvoices, isConnected, settings, convertCurrency, formatCurrencyAmount } = useAuth();
  
  // State to track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState({
    moderate: false,
    severe: false,
    allInvoices: false
  });

  // Toggle function for expanding/collapsing categories
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const stats = useMemo(() => {
    if (!overdueInvoices.length) return null;

    const totalAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount_due, 0);
    const avgDaysOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.days_overdue, 0) / overdueInvoices.length;
    const uniqueClients = new Set(overdueInvoices.map(inv => inv.client_name)).size;
    
    // Get the most common currency from invoices (fallback to AED)
    const invoiceCurrencies = overdueInvoices.map(inv => inv.currency_symbol || 'AED');
    const mostCommonCurrency = invoiceCurrencies.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    const sourceCurrency = Object.keys(mostCommonCurrency).reduce((a, b) => 
      mostCommonCurrency[a] > mostCommonCurrency[b] ? a : b
    );

    // Use the saved currency setting from context
    const displayCurrency = settings.currency || 'AED';
    
    // Convert the total amount to the display currency
    const convertedAmount = convertCurrency(totalAmount, sourceCurrency, displayCurrency);

    return {
      totalInvoices: overdueInvoices.length,
      totalAmount,
      displayAmount: convertedAmount,
      avgDaysOverdue,
      uniqueClients,
      sourceCurrency,
      displayCurrency,
      // For ORIGINAL currency, we need to track individual currencies
      isOriginalCurrency: displayCurrency === 'ORIGINAL'
    };
  }, [overdueInvoices, settings.currency, convertCurrency]);

  const groupedInvoices = useMemo(() => {
    if (!overdueInvoices.length) return { recent: [], moderate: [], severe: [] };

    return {
      recent: overdueInvoices.filter(inv => inv.days_overdue <= 15),
      moderate: overdueInvoices.filter(inv => inv.days_overdue > 15 && inv.days_overdue <= 30),
      severe: overdueInvoices.filter(inv => inv.days_overdue > 30),
    };
  }, [overdueInvoices]);

  const getOverdueBadge = (days) => {
    if (days <= 15) return <Badge variant="success">Recent</Badge>;
    if (days <= 30) return <Badge variant="warning">Moderate</Badge>;
    return <Badge variant="danger">Severe</Badge>;
  };

  const getOverdueIcon = (days) => {
    if (days <= 15) return <Clock className="h-4 w-4 text-success-600" />;
    if (days <= 30) return <AlertTriangle className="h-4 w-4 text-warning-600" />;
    return <AlertTriangle className="h-4 w-4 text-danger-600" />;
  };

  // Helper function to render invoice items for a category
  const renderInvoiceItems = (invoices, category) => {
    const isExpanded = expandedCategories[category];
    const displayInvoices = isExpanded ? invoices : invoices.slice(0, 5);
    const hasMore = invoices.length > 5;

    return (
      <div className="space-y-3">
        {displayInvoices.map((invoice) => {
          // Convert amount to display currency
          const sourceCurrency = invoice.currency_symbol || 'AED';
          const displayCurrency = settings.currency || 'AED';
          const convertedAmount = convertCurrency(invoice.amount_due, sourceCurrency, displayCurrency);
          
          return (
            <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {invoice.client_name}
                </p>
                <p className="text-xs text-gray-500">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {displayCurrency === 'ORIGINAL' 
                    ? formatCurrencyAmount(convertedAmount, displayCurrency, sourceCurrency)
                    : formatCurrencyAmount(convertedAmount, displayCurrency)
                  }
                </p>
                <p className="text-xs text-gray-500">
                  {invoice.days_overdue} days • {displayCurrency === 'ORIGINAL' ? sourceCurrency : (sourceCurrency !== displayCurrency ? `${sourceCurrency} → ${displayCurrency}` : displayCurrency)}
                </p>
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button
            onClick={() => toggleCategory(category)}
            className="w-full text-xs text-blue-600 hover:text-blue-800 text-center py-2 flex items-center justify-center gap-1 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                +{invoices.length - 5} more
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Connection</h3>
          <p className="text-gray-500">Please connect to Odoo or enable demo mode to view overdue invoices.</p>
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
          <p className="text-gray-500">Great! All invoices are up to date.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
              </div>
              <FileText className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.isOriginalCurrency 
                    ? `${getCurrencySymbol(stats.sourceCurrency)}${stats.displayAmount.toLocaleString()}`
                    : formatCurrencyAmount(stats.displayAmount, stats.displayCurrency)
                  }
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-success-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Days Overdue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avgDaysOverdue.toFixed(1)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-warning-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unique Clients</p>
                <p className="text-2xl font-bold text-gray-900">{stats.uniqueClients}</p>
              </div>
              <Users className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue by Period */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moderate Overdue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-600" />
              Moderate (16-30 days)
              <Badge variant="warning">{groupedInvoices.moderate.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupedInvoices.moderate.length > 0 ? (
              renderInvoiceItems(groupedInvoices.moderate, 'moderate')
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No moderate overdue invoices</p>
            )}
          </CardContent>
        </Card>

        {/* Severe Overdue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
              Severe (31+ days)
              <Badge variant="danger">{groupedInvoices.severe.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupedInvoices.severe.length > 0 ? (
              renderInvoiceItems(groupedInvoices.severe, 'severe')
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No severe overdue invoices</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Overdue Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Company</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Due Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Days Overdue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Amount (Currency)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {(expandedCategories.allInvoices ? overdueInvoices : overdueInvoices.slice(0, 6)).map((invoice) => {
                  // Convert amount to display currency
                  const sourceCurrency = invoice.currency_symbol || 'AED';
                  const displayCurrency = settings.currency || 'AED';
                  const convertedAmount = convertCurrency(invoice.amount_due, sourceCurrency, displayCurrency);
                  
                  return (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                          <p className="text-xs text-gray-500">{invoice.origin}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invoice.client_name}</p>
                          <p className="text-xs text-gray-500">{invoice.client_email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">{invoice.company_name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">
                          {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getOverdueIcon(invoice.days_overdue)}
                          <span className="text-sm text-gray-900">{invoice.days_overdue}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {displayCurrency === 'ORIGINAL' 
                              ? formatCurrencyAmount(convertedAmount, displayCurrency, sourceCurrency)
                              : formatCurrencyAmount(convertedAmount, displayCurrency)
                            }
                          </p>
                          <p className="text-xs text-gray-500">
                            {displayCurrency === 'ORIGINAL' ? sourceCurrency : (sourceCurrency !== displayCurrency ? `${sourceCurrency} → ${displayCurrency}` : displayCurrency)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getOverdueBadge(invoice.days_overdue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {overdueInvoices.length > 6 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => toggleCategory('allInvoices')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mx-auto transition-colors"
                >
                  {expandedCategories.allInvoices ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show less ({overdueInvoices.length} total)
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show all ({overdueInvoices.length - 6} more)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard; 