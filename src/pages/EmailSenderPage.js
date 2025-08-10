import React from 'react';
import Layout from '../components/Layout';
import EmailSender from '../components/EmailSender';

const EmailSenderPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Sender</h1>
          <p className="text-gray-600">Send follow-up emails to clients with overdue invoices</p>
        </div>
        <EmailSender />
      </div>
    </Layout>
  );
};

export default EmailSenderPage; 