import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Database, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Send,
  Cog
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';

const Layout = ({ children }) => {
  const { isConnected } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: FileText },
    { name: 'Email Sender', href: '/email-sender', icon: Send },
    { name: 'Settings', href: '/settings', icon: Cog },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side - Connection Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Odoo Invoice Manager</span>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-success-600" />
                    <span className="text-sm text-success-700">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Not Connected</span>
                    <Link
                      to="/settings"
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Connect in Settings
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Center - Navigation */}
            <div className="flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-100 text-primary-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right Side - Empty for balance */}
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
};

export default Layout; 