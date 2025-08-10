import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

const initialState = {
  isConnected: false,
  connectionDetails: null,
  connectionId: null,
  overdueInvoices: [],
  clientsMissingEmail: [],
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  error: null,
  // Add settings state
  settings: {
    emailConfig: {
      senderEmail: 'omar.elhasan@prezlab.com',
      senderPassword: 'cnns amsx gxxj ixnm',
      ccList: '',
      smtpServer: 'smtp.gmail.com',
      smtpPort: '587',
      defaultSenderName: '',
    },
    currency: 'ORIGINAL',
    security: {
      sessionTimeout: 60,
      enable2FA: false,
      dataRetention: 90,
    }
  },
  // Add exchange rates for currency conversion
  exchangeRates: {
    AED: 1.0, // Base currency
    USD: 0.272, // 1 AED = 0.272 USD
    EUR: 0.251, // 1 AED = 0.251 EUR
    GBP: 0.215, // 1 AED = 0.215 GBP
    SAR: 1.02, // 1 AED = 1.02 SAR
    KWD: 0.083, // 1 AED = 0.083 KWD
    BHD: 0.102, // 1 AED = 0.102 BHD
    QAR: 0.99, // 1 AED = 0.99 QAR
    OMR: 0.105, // 1 AED = 0.105 OMR
    JOD: 0.193, // 1 AED = 0.193 JOD
  }
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOADING_PROGRESS':
      return { 
        ...state, 
        loadingProgress: action.payload.progress,
        loadingMessage: action.payload.message 
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload, 
        isLoading: false,
        loadingProgress: 0,
        loadingMessage: ''
      };
    case 'CONNECT_SUCCESS':
      return {
        ...state,
        isConnected: true,
        connectionDetails: action.payload.connectionDetails,
        connectionId: action.payload.connectionId,
        overdueInvoices: action.payload.overdueInvoices,
        clientsMissingEmail: action.payload.clientsMissingEmail,
        isLoading: false,
        loadingProgress: 0,
        loadingMessage: '',
        error: null,
      };
    case 'DISCONNECT':
      return {
        ...state,
        isConnected: false,
        connectionDetails: null,
        connectionId: null,
        overdueInvoices: [],
        clientsMissingEmail: [],
        isLoading: false,
        loadingProgress: 0,
        loadingMessage: '',
        error: null,
      };
    case 'UPDATE_INVOICES':
      return {
        ...state,
        overdueInvoices: action.payload.overdueInvoices,
        clientsMissingEmail: action.payload.clientsMissingEmail,
      };
    // Add settings actions
    case 'UPDATE_EMAIL_CONFIG':
      return {
        ...state,
        settings: {
          ...state.settings,
          emailConfig: {
            ...state.settings.emailConfig,
            ...action.payload
          }
        }
      };
    case 'UPDATE_CURRENCY':
      return {
        ...state,
        settings: {
          ...state.settings,
          currency: action.payload
        }
      };
    case 'UPDATE_SECURITY_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          security: {
            ...state.settings.security,
            ...action.payload
          }
        }
      };
    case 'LOAD_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload
        }
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load connection state and settings from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('odooConnectionState');
    const savedSettings = localStorage.getItem('appSettings');
    
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.isConnected) {
          dispatch({
            type: 'CONNECT_SUCCESS',
            payload: parsedState,
          });
        }
      } catch (error) {
        console.error('Error loading saved connection state:', error);
      }
    }
    
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        dispatch({
          type: 'LOAD_SETTINGS',
          payload: parsedSettings
        });
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }
  }, []);

  // Save connection state to localStorage when it changes
  useEffect(() => {
    if (state.isConnected) {
      localStorage.setItem('odooConnectionState', JSON.stringify(state));
    } else {
      localStorage.removeItem('odooConnectionState');
    }
  }, [state.isConnected, state.connectionDetails, state.overdueInvoices]);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(state.settings));
  }, [state.settings]);

  const connectToOdoo = async (connectionDetails) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Update progress for connection start
      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 10, message: 'Initializing connection...' } 
      });

      // Simulate API call to connect to Odoo
      // In a real implementation, this would call your backend API
      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 30, message: 'Connecting to Odoo server...' } 
      });

      const response = await fetch('http://localhost:8000/api/odoo/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionDetails),
      });

      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 60, message: 'Authenticating...' } 
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Odoo');
      }

      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 80, message: 'Fetching invoice data...' } 
      });

      const data = await response.json();
      
      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 100, message: 'Connection successful!' } 
      });

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: {
          isDemoMode: false,
          connectionDetails,
          connectionId: data.connectionId,
          overdueInvoices: data.overdueInvoices,
          clientsMissingEmail: data.clientsMissingEmail,
        },
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };



  const disconnect = async () => {
    try {
      // Call backend to disconnect
      if (state.connectionId) {
        await fetch('http://localhost:8000/api/odoo/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connectionId: state.connectionId
          }),
        });
      }
    } catch (error) {
      console.error('Error disconnecting from backend:', error);
    }
    
    // Always dispatch disconnect to clear frontend state
    dispatch({ type: 'DISCONNECT' });
  };

  const refreshInvoices = async () => {
    if (!state.isConnected) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 30, message: 'Refreshing invoice data...' } 
      });

      const response = await fetch('http://localhost:8000/api/odoo/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: state.connectionId,
          ...state.connectionDetails
        }),
      });

      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 80, message: 'Processing data...' } 
      });

      if (!response.ok) {
        throw new Error('Failed to refresh invoices');
      }

      const data = await response.json();
      
      dispatch({ 
        type: 'SET_LOADING_PROGRESS', 
        payload: { progress: 100, message: 'Refresh complete!' } 
      });

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300));
      
      dispatch({
        type: 'UPDATE_INVOICES',
        payload: {
          overdueInvoices: data.overdueInvoices,
          clientsMissingEmail: data.clientsMissingEmail,
        },
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  // Settings management functions
  const updateEmailConfig = (emailConfig) => {
    dispatch({
      type: 'UPDATE_EMAIL_CONFIG',
      payload: emailConfig
    });
  };

  const updateCurrency = (currency) => {
    dispatch({
      type: 'UPDATE_CURRENCY',
      payload: currency
    });
  };

  const updateSecuritySettings = (securitySettings) => {
    dispatch({
      type: 'UPDATE_SECURITY_SETTINGS',
      payload: securitySettings
    });
  };

  // Currency conversion function
  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    // If toCurrency is ORIGINAL, return the original amount without conversion
    if (toCurrency === 'ORIGINAL') {
      return amount;
    }
    
    if (!state.exchangeRates[fromCurrency] || !state.exchangeRates[toCurrency]) {
      return amount; // Return original amount if conversion not possible
    }
    
    // Convert to AED first (base currency), then to target currency
    const amountInAED = amount / state.exchangeRates[fromCurrency];
    const convertedAmount = amountInAED * state.exchangeRates[toCurrency];
    
    return Math.round(convertedAmount * 100) / 100; // Round to 2 decimal places
  };

  // Format currency amount with proper symbol
  const formatCurrencyAmount = (amount, currencyCode, originalCurrency = null) => {
    // If currencyCode is ORIGINAL, use the original currency symbol
    if (currencyCode === 'ORIGINAL' && originalCurrency) {
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
      
      const symbol = symbols[originalCurrency] || originalCurrency;
      return `${symbol}${amount.toLocaleString()}`;
    }
    
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
    
    const symbol = symbols[currencyCode] || currencyCode;
    return `${symbol}${amount.toLocaleString()}`;
  };

  const value = {
    ...state,
    connectToOdoo,
    disconnect,
    refreshInvoices,
    updateEmailConfig,
    updateCurrency,
    updateSecuritySettings,
    convertCurrency,
    formatCurrencyAmount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Demo data generator (simplified version)
function generateDemoData() {
  const clients = [
    "Acme Corporation",
    "TechStart Solutions",
    "Global Industries Ltd",
    "Innovation Systems",
    "Digital Dynamics",
  ];

  const companies = [
    "Prezlab FZ LLC",
    "Prezlab Advanced Design Company",
    "PrezLab",
    "TechCorp",
    "Innovation Inc",
  ];

  const invoices = [];
  const today = new Date();

  for (let i = 0; i < 15; i++) {
    const daysOverdue = Math.floor(Math.random() * 60) + 1;
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() - daysOverdue);

    invoices.push({
      id: i + 1,
      invoice_number: `INV-2024-${String(i + 1).padStart(4, '0')}`,
      due_date: dueDate.toISOString().split('T')[0],
      days_overdue: daysOverdue,
      amount_due: Math.round((Math.random() * 9500 + 500) * 100) / 100,
      currency_symbol: "SAR",
              origin: `S${String(Math.floor(Math.random() * 20000)).padStart(5, '0')} ${['TMHB-T55', 'MOC22005', 'S01897', 'S01713', 'S01564', 'S01395', 'S00132', 'S01952', 'S01958', 'S01836'][Math.floor(Math.random() * 10)]}`,
      client_name: clients[Math.floor(Math.random() * clients.length)],
      client_email: `accounts@${clients[Math.floor(Math.random() * clients.length)].toLowerCase().replace(/\s+/g, '')}.com`,
      company_name: companies[Math.floor(Math.random() * companies.length)],
    });
  }

  return invoices;
} 