import React from 'react';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';

const DashboardPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of overdue invoices and client status</p>
        </div>
        <Dashboard />
      </div>
    </Layout>
  );
};

export default DashboardPage; 