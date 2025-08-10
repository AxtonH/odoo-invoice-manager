# Email Threading Feature

## Overview

The Odoo Invoice Follow-Up Manager now includes email threading functionality that ensures multiple invoice follow-up messages to the same customer appear in the same email thread/conversation. This provides better context and continuity for both the finance team and customers.

## How It Works

### Thread ID Generation
- Each customer gets a unique thread ID based on their name, email, and company
- Thread IDs are generated using MD5 hash for consistency
- Format: `<{hash}@{company}.com>`

### Email Headers
The system adds the following headers to maintain thread continuity:
- `Message-ID`: Unique identifier for the thread
- `In-Reply-To`: References the thread ID
- `References`: Contains the thread ID for proper threading

### Thread Management
- Thread information is stored in `email_threads.json`
- Tracks message count, creation date, and last subject
- Automatically updates thread information with each email

## Implementation Details

### Core Components

#### EmailThreadManager Class
```python
class EmailThreadManager:
    - get_thread_id(client_name, client_email, company_name)
    - get_thread_info(client_name, client_email, company_name)
    - update_thread_subject(client_name, client_email, subject, company_name)
```

#### Enhanced send_email Function
```python
def send_email(..., client_name=None, company_name=None, enable_threading=True):
    # Automatically adds threading headers when client info is provided
```

### Usage Examples

#### Invoice Follow-up Emails
```python
# Threading is automatically enabled for invoice follow-ups
send_email(
    sender_email="finance@company.com",
    sender_password="password",
    recipient_email="client@company.com",
    cc_list=[],
    subject="Payment Reminder - Outstanding Balance",
    body=email_body,
    attachments=attachments,
    client_name="Client Company Name",
    company_name="Your Company",
    enable_threading=True
)
```

#### Daily Reports
```python
# Daily reports also use threading
send_email(
    sender_email="reports@company.com",
    sender_password="password",
    recipient_email="finance@company.com",
    cc_list=[],
    subject="Daily Invoice Follow-Up Report",
    body=report_body,
    attachments=report_attachments,
    client_name="Finance Team",
    company_name="Daily Reports",
    enable_threading=True
)
```

## API Endpoints

### View Thread Information
```bash
# Get all email threads
GET /api/email/threads

# Get specific thread details
GET /api/email/threads/{client_key}
```

### Response Format
```json
{
  "success": true,
  "total_threads": 5,
  "threads": [
    {
      "client_key": "ClientName_client@email.com_CompanyName",
      "client_name": "Client Name",
      "client_email": "client@email.com",
      "company_name": "Company Name",
      "thread_id": "<abc123@company.com>",
      "message_count": 3,
      "created_date": "2024-01-15T10:30:00",
      "last_subject": "Payment Reminder - Outstanding Balance"
    }
  ]
}
```

## Benefits

### For Finance Team
- **Better Organization**: All communications with a client are grouped together
- **Context Preservation**: Previous messages and attachments are easily accessible
- **Efficient Follow-up**: Quick access to conversation history

### For Customers
- **Clear Communication**: All related messages appear in one conversation
- **Easy Reference**: Previous correspondence is readily available
- **Professional Experience**: Organized communication flow

## Technical Features

### Automatic Thread Detection
- System recognizes existing customers and reuses thread IDs
- New customers automatically get new thread IDs
- Thread information is persisted across application restarts

### Thread Persistence
- Thread data stored in JSON format
- Survives application updates and restarts
- Easy backup and migration

### Performance Optimized
- Minimal overhead for threading functionality
- Efficient thread ID generation using hashing
- Fast thread lookup and updates

## Configuration

### Thread File Location
- Default: `email_threads.json` in application root
- Configurable via EmailThreadManager constructor
- Automatic creation if file doesn't exist

### Threading Control
- Can be disabled per email by setting `enable_threading=False`
- Backward compatible with existing email functionality
- No breaking changes to existing code

## Monitoring and Debugging

### Thread Information
- View all threads via API endpoint
- Track message counts and activity
- Monitor thread creation dates

### Debug Logging
- Thread ID generation is logged
- Message count updates are tracked
- Thread file operations are monitored

## Future Enhancements

### Planned Features
- Thread analytics and reporting
- Thread cleanup for old/inactive threads
- Thread export/import functionality
- Advanced thread management UI

### Integration Possibilities
- CRM system integration
- Email client API integration
- Advanced threading rules and policies




