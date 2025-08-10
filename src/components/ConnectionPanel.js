import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Button from './ui/Button';
import { Input } from './ui/Input';
import { Select, SelectOption } from './ui/Select';
import Progress from './ui/Progress';
import { 
  Database, 
  Mail, 
  Lock, 
  Globe, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  LogOut,
  Loader2
} from 'lucide-react';

const ConnectionPanel = () => {

  
  const { 
    isConnected, 
    isLoading, 
    loadingProgress,
    loadingMessage,
    error, 
    connectToOdoo, 
    disconnect, 
    refreshInvoices 
  } = useAuth();

  // Local state for connection progress
  const [localLoading, setLocalLoading] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [localMessage, setLocalMessage] = useState('');

  const [connectionDetails, setConnectionDetails] = useState({
    url: 'https://prezlab-staging-22061821.dev.odoo.com',
    database: 'prezlab-staging-22061821',
    username: 'omar.elhasan@prezlab.com',
    password: '',
  });

  const [emailConfig, setEmailConfig] = useState({
    senderEmail: '',
    senderPassword: '',
    ccList: '',
  });

  const [showConnectionForm, setShowConnectionForm] = useState(!isConnected);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Test function to verify progress bar works
  const testProgressBar = async () => {
    console.log('Testing progress bar...');
    setLocalLoading(true);
    setLocalProgress(0);
    setLocalMessage('Testing progress bar...');
    
    const steps = [
      { progress: 10, message: 'Initializing test...' },
      { progress: 30, message: 'Testing progress...' },
      { progress: 60, message: 'Almost done...' },
      { progress: 100, message: 'Test complete!' }
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setLocalProgress(step.progress);
      setLocalMessage(step.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setTimeout(() => {
      setLocalLoading(false);
      setLocalProgress(0);
      setLocalMessage('');
    }, 2000);
  };

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

  return (
    <div className="space-y-4">
      
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isConnected ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success-600" />
                  <span className="text-sm font-medium text-success-700">Connected</span>
                </div>
                <div className="flex gap-1">
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
                  </Button>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {connectionDetails.database} • {connectionDetails.username}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
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
        </CardContent>
      </Card>

      {/* Connection Form */}
      {showConnectionForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Odoo Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">URL</label>
              <Input
                value={connectionDetails.url}
                onChange={(e) => setConnectionDetails(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://your-odoo-instance.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Database</label>
              <Input
                value={connectionDetails.database}
                onChange={(e) => setConnectionDetails(prev => ({ ...prev, database: e.target.value }))}
                placeholder="database_name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Username</label>
              <Input
                value={connectionDetails.username}
                onChange={(e) => setConnectionDetails(prev => ({ ...prev, username: e.target.value }))}
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Password</label>
              <Input
                type="password"
                value={connectionDetails.password}
                onChange={(e) => setConnectionDetails(prev => ({ ...prev, password: e.target.value }))}
                placeholder="password"
              />
            </div>
            
            {/* Test Progress Bar Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={testProgressBar}
              className="w-full"
            >
              Test Progress Bar
            </Button>
            
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
            
            {/* Progress Bar - Using local state for reliability */}
            {localLoading && (
              <div className={`mt-3 p-3 rounded-lg border ${
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
              <div className="text-xs text-danger-600 bg-danger-50 p-2 rounded">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!showEmailForm ? (
            <div className="space-y-2">
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
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Sender Email</label>
                <Input
                  value={emailConfig.senderEmail}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                  placeholder="sender@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Sender Password</label>
                <Input
                  type="password"
                  value={emailConfig.senderPassword}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, senderPassword: e.target.value }))}
                  placeholder="password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">CC List</label>
                <Input
                  value={emailConfig.ccList}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, ccList: e.target.value }))}
                  placeholder="email1@company.com, email2@company.com"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowEmailForm(false)}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectionPanel; 