#!/usr/bin/env python3
"""
Backend server for Odoo Invoice Follow-Up Manager React Application
"""

import os
import sys
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from datetime import datetime
import json

# Add parent directory to path to import original app modules
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Set up Flask to serve React build files
build_folder = os.path.join(parent_dir, 'build')
app = Flask(__name__, static_folder=build_folder, static_url_path='')
CORS(app)

# Import the core functionality
try:
    from core import OdooConnector, InvoicePDFGenerator, generate_email_template, send_email, get_automatic_iban_attachment, thread_manager
    from email_templates import get_template_by_type
    print("Successfully imported core modules")
except ImportError as e:
    print(f"Warning: Could not import core modules: {e}")
    print("   Backend will run in demo mode only")

# Store active connections
active_connections = {}

@app.route('/api/odoo/connect', methods=['POST'])
def connect_odoo():
    """Connect to Odoo and fetch overdue invoices"""
    try:
        data = request.json
        url = data.get('url')
        database = data.get('database')
        username = data.get('username')
        password = data.get('password')
        
        if not all([url, database, username, password]):
            return jsonify({'error': 'Missing required connection parameters'}), 400
        
        # Create Odoo connector
        connector = OdooConnector(url, database, username, password)
        
        if not connector.connect():
            return jsonify({'error': 'Failed to connect to Odoo'}), 401
        
        # Fetch overdue invoices with progress callback
        def progress_callback(message, progress):
            print(f"📊 {message} ({progress:.1f}%)")
        
        print("🚀 Starting optimized invoice fetch...")
        invoices = connector.get_overdue_invoices(progress_callback)
        
        # Debug: Check first few invoices for currency data
        if invoices:
            print(f"✅ Sample invoice data: {invoices[0]}")
            print(f"✅ Currency symbols found: {[inv.get('currency_symbol', 'N/A') for inv in invoices[:5]]}")
            print(f"✅ Company names found: {[inv.get('company_name', 'N/A') for inv in invoices[:5]]}")
        
        # Filter out zero-amount invoices (additional safety)
        invoices = [inv for inv in invoices if inv['amount_due'] > 0 and inv['amount_total'] > 0]
        
        # Check for clients missing email
        clients_missing_email = [inv for inv in invoices if not inv['client_email']]
        
        # Store connection for later use
        connection_id = f"{username}_{database}"
        active_connections[connection_id] = {
            'connector': connector,
            'connection_details': data,
            'cached_invoices': invoices  # Cache the invoices during initial connection
        }
        
        print(f"Connected to Odoo: {database} ({len(invoices)} invoices)")
        print(f"🔍 Debug: Cached {len(invoices)} invoices for connection {connection_id}")
        print(f"🔍 Debug: Connection data keys: {list(active_connections[connection_id].keys())}")
        
        return jsonify({
            'success': True,
            'overdueInvoices': invoices,
            'clientsMissingEmail': clients_missing_email,
            'connectionId': connection_id
        })
        
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/odoo/refresh', methods=['POST'])
def refresh_invoices():
    """Refresh overdue invoices data"""
    try:
        data = request.json
        connection_id = data.get('connectionId')
        
        if connection_id not in active_connections:
            return jsonify({'error': 'Connection not found'}), 404
        
        connector = active_connections[connection_id]['connector']
        
        # Use optimized invoice fetching with progress callback
        def progress_callback(message, progress):
            print(f"📊 Refresh: {message} ({progress:.1f}%)")
        
        print("🔄 Starting optimized refresh...")
        invoices = connector.get_overdue_invoices(progress_callback)
        
        # Filter out zero-amount invoices (additional safety)
        invoices = [inv for inv in invoices if inv['amount_due'] > 0 and inv['amount_total'] > 0]
        
        # Update the cache with fresh data
        active_connections[connection_id]['cached_invoices'] = invoices
        
        clients_missing_email = [inv for inv in invoices if not inv['client_email']]
        
        print(f"Refreshed invoices: {len(invoices)} found")
        
        return jsonify({
            'success': True,
            'overdueInvoices': invoices,
            'clientsMissingEmail': clients_missing_email
        })
        
    except Exception as e:
        print(f"❌ Refresh error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/send', methods=['POST'])
def send_bulk_emails():
    """Send bulk emails to selected clients"""
    try:
        data = request.json
        connection_id = data.get('connectionId')
        selected_clients = data.get('selectedClients', [])
        email_config = data.get('emailConfigs', {})  # Changed from emailConfig to emailConfigs
        
        print(f"🔍 Debug: Received connection_id: '{connection_id}'")
        print(f"🔍 Debug: Active connections: {list(active_connections.keys())}")
        
        # Handle different connection ID formats
        if connection_id not in active_connections:
            # Try to find a matching connection by checking if the connection_id contains any of the stored keys
            matching_connection = None
            for stored_connection_id in active_connections.keys():
                if connection_id in stored_connection_id or stored_connection_id in connection_id:
                    matching_connection = stored_connection_id
                    break
            
            if matching_connection:
                print(f"🔍 Debug: Found matching connection: {matching_connection}")
                connection_id = matching_connection
            else:
                print(f"❌ Error: Connection not found. Available connections: {list(active_connections.keys())}")
                return jsonify({'error': 'Connection not found. Please reconnect to Odoo.'}), 404
        
        if not selected_clients:
            return jsonify({'error': 'No clients selected'}), 400
        
        connector = active_connections[connection_id]['connector']
        
        # Use invoice data sent from frontend (dashboard data) instead of fetching from Odoo
        invoice_data = data.get('invoiceData', [])
        
        if invoice_data:
            print(f"📊 Using invoice data from frontend ({len(invoice_data)} invoices)")
            invoices = invoice_data
        else:
            # Fallback to cached data if frontend doesn't send invoice data
            print(f"🔍 Debug: No invoice data from frontend, checking cache for connection {connection_id}")
            print(f"🔍 Debug: Connection data keys: {list(active_connections[connection_id].keys())}")
            print(f"🔍 Debug: Has cached_invoices: {'cached_invoices' in active_connections[connection_id]}")
            
            if 'cached_invoices' not in active_connections[connection_id]:
                print(f"📊 Fetching invoice data from Odoo...")
                try:
                    # Add a timeout for the Odoo API call
                    import threading
                    import queue
                    
                    result_queue = queue.Queue()
                    
                    def fetch_invoices():
                        try:
                            invoices = connector.get_overdue_invoices()
                            result_queue.put(('success', invoices))
                        except Exception as e:
                            result_queue.put(('error', str(e)))
                    
                    # Start the fetch in a separate thread
                    fetch_thread = threading.Thread(target=fetch_invoices)
                    fetch_thread.daemon = True
                    fetch_thread.start()
                    
                    # Wait for result with timeout (30 seconds)
                    try:
                        result_type, result_data = result_queue.get(timeout=30)
                        if result_type == 'error':
                            raise Exception(f"Odoo API error: {result_data}")
                        invoices = result_data
                    except queue.Empty:
                        raise Exception("Odoo API timeout - request took too long")
                    
                    # Filter out zero-amount invoices
                    invoices = [inv for inv in invoices if inv['amount_due'] > 0 and inv['amount_total'] > 0]
                    # Cache the invoice data
                    active_connections[connection_id]['cached_invoices'] = invoices
                    print(f"📊 Cached {len(invoices)} invoices")
                except Exception as e:
                    print(f"❌ Error fetching invoices: {str(e)}")
                    raise Exception(f"Failed to fetch invoice data: {str(e)}")
            else:
                invoices = active_connections[connection_id]['cached_invoices']
                print(f"📊 Using cached invoice data ({len(invoices)} invoices)")
                print(f"🔍 Debug: Cache hit! Using {len(invoices)} cached invoices")
        
        # Group invoices by client
        client_invoices = {}
        for invoice in invoices:
            if invoice['client_name'] not in client_invoices:
                client_invoices[invoice['client_name']] = []
            client_invoices[invoice['client_name']].append(invoice)
        
        successful_sends = 0
        failed_sends = 0
        failed_clients = []
        
        # Get global email configuration
        global_config = data.get('globalEmailConfig', {})
        print(f"🔍 Debug: Global email config: {global_config}")
        
        print(f"📧 Sending emails to {len(selected_clients)} clients...")
        print(f"🔍 Debug: Received email config keys: {list(email_config.keys())}")
        for client_name in selected_clients:
            if client_name in email_config:
                print(f"🔍 Debug: Email config for '{client_name}': {email_config[client_name]}")
            else:
                print(f"🔍 Debug: No email config found for '{client_name}'")
        
        for client_name in selected_clients:
            if client_name not in client_invoices:
                failed_sends += 1
                failed_clients.append(f"{client_name} (no invoices)")
                print(f"❌ No invoices found for client: {client_name}")
                continue
            
            client_invoices_list = client_invoices[client_name]
            client_email = client_invoices_list[0]['client_email']
            
            # Check if frontend provided a custom email address for this client
            client_email_config = email_config.get(client_name, {})
            print(f"🔍 Debug: Email config for '{client_name}': {client_email_config}")
            
            if client_email_config.get('recipientEmail'):
                client_email = client_email_config['recipientEmail']
                print(f"🔍 Using frontend-provided email for '{client_name}': '{client_email}'")
            else:
                print(f"🔍 Using invoice email for '{client_name}': '{client_email}' (type: {type(client_email)})")
                print(f"🔍 Debug: Invoice data for '{client_name}': {client_invoices_list[0]}")
            
            if not client_email or client_email.strip() == '':
                failed_sends += 1
                failed_clients.append(f"{client_name} (no email)")
                print(f"❌ No email found for client: {client_name}")
                continue
            
            try:
                # Get email configuration for this client
                client_email_config = email_config.get(client_name, {})
                
                # Use custom subject/body if provided, otherwise generate template
                if client_email_config.get('subject') and client_email_config.get('body'):
                    subject = client_email_config['subject']
                    body = client_email_config['body']
                else:
                    # Generate email template
                    max_days = max(inv['days_overdue'] for inv in client_invoices_list)
                    template_result = generate_email_template(
                        client_name, 
                        client_invoices_list, 
                        max_days, 
                        email_config.get('template', 'initial')
                    )
                    subject = template_result['subject']
                    body = template_result['body']
                
                # Prepare attachments
                attachments = []
                
                # Add automatic IBAN letter if applicable
                # Get company name from the first invoice for this client
                company_name = client_invoices_list[0].get('company_name', 'Unknown Company')
                print(f"🔍 Debug: Company name for {client_name}: '{company_name}'")
                
                iban_attachment = get_automatic_iban_attachment(company_name)
                if iban_attachment:
                    attachments.append(iban_attachment)
                    print(f"📎 Added IBAN letter attachment for company: {company_name}")
                else:
                    print(f"📎 No IBAN letter found for company: {company_name}")
                
                # Generate and attach invoice PDF if enabled
                if global_config.get('enablePdfAttachment', True):
                    try:
                        print(f"📄 Generating invoice PDF for {client_name}...")
                        
                        # Create PDF generator instance
                        pdf_generator = InvoicePDFGenerator(connector)
                        
                        # Get partner ID from the first invoice
                        partner_id = client_invoices_list[0].get('partner_id', client_name)
                        
                        # Generate PDF with progress callback
                        def pdf_progress_callback(message, progress):
                            print(f"📄 PDF Progress for {client_name}: {message} ({progress:.1f}%)")
                        
                        pdf_data = pdf_generator.generate_client_invoices_pdf(
                            client_name, 
                            partner_id, 
                            pdf_progress_callback
                        )
                        
                        if pdf_data:
                            # Create a file-like object for the PDF
                            import io
                            pdf_file = io.BytesIO(pdf_data)
                            pdf_file.name = f"Invoices_{client_name.replace(' ', '_')}.pdf"
                            attachments.append(pdf_file)
                            print(f"✅ Successfully generated and attached invoice PDF for {client_name} ({len(pdf_data)} bytes)")
                        else:
                            print(f"⚠️ Failed to generate invoice PDF for {client_name}")
                    except Exception as e:
                        print(f"❌ Error generating PDF for {client_name}: {str(e)}")
                
                # Send email
                cc_list = email_config.get('ccList', '').split(',') if email_config.get('ccList') else []
                cc_list = [email.strip() for email in cc_list if email.strip()]
                
                # Get sender credentials from global config
                sender_email = global_config.get('senderEmail', email_config.get('senderEmail', 'noreply@company.com'))
                sender_password = global_config.get('senderPassword', email_config.get('senderPassword', ''))
                smtp_server = global_config.get('smtpServer', email_config.get('smtpServer', 'smtp.gmail.com'))
                smtp_port = global_config.get('smtpPort', email_config.get('smtpPort', 587))
                
                if send_email(sender_email, sender_password, client_email, cc_list, subject, body, attachments, smtp_server, smtp_port, client_name=client_name, company_name=company_name, enable_threading=True):
                    successful_sends += 1
                    print(f"✅ Email sent to {client_name}")
                else:
                    failed_sends += 1
                    failed_clients.append(f"{client_name} (email failed)")
                    print(f"❌ Failed to send email to {client_name}")
                    
            except Exception as e:
                failed_sends += 1
                failed_clients.append(f"{client_name} ({str(e)})")
                print(f"❌ Error sending email to {client_name}: {str(e)}")
        
        print(f"Email sending complete: {successful_sends} successful, {failed_sends} failed")
        
        return jsonify({
            'success': True,
            'successfulSends': successful_sends,
            'failedSends': failed_sends,
            'failedClients': failed_clients,
            'totalClients': len(selected_clients)
        })
        
    except Exception as e:
        print(f"❌ Bulk email error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/test', methods=['POST'])
def test_email():
    """Test email configuration by sending a test email"""
    try:
        data = request.json
        sender_email = data.get('senderEmail')
        sender_password = data.get('senderPassword')
        smtp_server = data.get('smtpServer', 'smtp.gmail.com')
        smtp_port = data.get('smtpPort', 587)
        test_email = data.get('testEmail', sender_email)
        
        if not all([sender_email, sender_password, test_email]):
            return jsonify({'error': 'Missing required email configuration'}), 400
        
        print(f"🧪 Testing email configuration:")
        print(f"   Sender: {sender_email}")
        print(f"   SMTP: {smtp_server}:{smtp_port}")
        print(f"   Test recipient: {test_email}")
        
        # Send test email using simple SMTP (bypass complex send_email function)
        import smtplib
        from email.mime.text import MIMEText
        
        # Create simple text message
        subject = "Test Email - Odoo Invoice Follow-Up Manager"
        body = f"""Hello,

This is a test email from the Odoo Invoice Follow-Up Manager.

If you received this email, your email configuration is working correctly.

Test Details:
- Sender: {sender_email}
- SMTP Server: {smtp_server}:{smtp_port}
- Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Best regards,
Odoo Invoice Follow-Up Manager"""
        
        # Create message
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['From'] = sender_email
        msg['To'] = test_email
        msg['Subject'] = subject
        
        # Send email
        print(f"   Connecting to SMTP server...")
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        
        print(f"   Authenticating...")
        server.login(sender_email, sender_password)
        
        print(f"   Sending test email...")
        server.sendmail(sender_email, [test_email], msg.as_string())
        server.quit()
        
        print(f"   ✅ Test email sent successfully!")
        return jsonify({
            'success': True,
            'message': 'Test email sent successfully'
        })
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication Error: {str(e)}")
        return jsonify({'error': f'Authentication failed: {str(e)}'}), 401
    except smtplib.SMTPRecipientsRefused as e:
        print(f"❌ SMTP Recipients Refused: {str(e)}")
        return jsonify({'error': f'Invalid recipient email: {str(e)}'}), 400
    except smtplib.SMTPServerDisconnected as e:
        print(f"❌ SMTP Server Disconnected: {str(e)}")
        return jsonify({'error': f'SMTP server connection failed: {str(e)}'}), 500
    except Exception as e:
        print(f"❌ Test email error: {str(e)}")
        return jsonify({'error': f'Test email failed: {str(e)}'}), 500

@app.route('/api/pdf/generate', methods=['POST'])
def generate_pdf():
    """Generate PDF for a specific client"""
    try:
        data = request.json
        connection_id = data.get('connectionId')
        client_name = data.get('clientName')
        
        if connection_id not in active_connections:
            return jsonify({'error': 'Connection not found'}), 404
        
        connector = active_connections[connection_id]['connector']
        pdf_generator = InvoicePDFGenerator(connector)
        
        # Get partner ID for the client
        invoices = connector.get_overdue_invoices()
        
        # Filter out zero-amount invoices
        invoices = [inv for inv in invoices if inv['amount_due'] > 0 and inv['amount_total'] > 0]
        
        client_invoices = [inv for inv in invoices if inv['client_name'] == client_name]
        
        if not client_invoices:
            return jsonify({'error': f'No invoices found for {client_name}'}), 404
        
        print(f"Generating PDF for {client_name}...")
        
        # Generate PDF
        pdf_data = pdf_generator.generate_client_invoices_pdf(client_name, client_name)
        
        if pdf_data:
            import base64
            pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
            print(f"PDF generated for {client_name} ({len(pdf_data)} bytes)")
            return jsonify({
                'success': True,
                'pdfData': pdf_base64,
                'filename': f"{client_name}_invoices.pdf"
            })
        else:
            print(f"Failed to generate PDF for {client_name}")
            return jsonify({'error': 'Failed to generate PDF'}), 500
            
    except Exception as e:
        print(f"❌ PDF generation error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    connection_info = {}
    for conn_id, conn_data in active_connections.items():
        connection_info[conn_id] = {
            'has_connector': 'connector' in conn_data,
            'has_cached_invoices': 'cached_invoices' in conn_data,
            'cached_invoice_count': len(conn_data.get('cached_invoices', []))
        }
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'activeConnections': len(active_connections),
        'connectionIds': list(active_connections.keys()),
        'connectionInfo': connection_info,
        'version': '1.0.0'
    })

@app.route('/api/odoo/disconnect', methods=['POST'])
def disconnect_odoo():
    """Disconnect from Odoo and clear connection data"""
    try:
        data = request.json
        connection_id = data.get('connectionId')
        
        if connection_id and connection_id in active_connections:
            del active_connections[connection_id]
            print(f"Disconnected from Odoo: {connection_id}")
            return jsonify({
                'success': True,
                'message': f'Disconnected from Odoo: {connection_id}'
            })
        else:
            return jsonify({
                'success': True,
                'message': 'No active connection to disconnect'
            })
            
    except Exception as e:
        print(f"❌ Disconnect error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/clear-cache', methods=['POST'])
def clear_cache():
    """Clear cached invoice data for all connections"""
    try:
        cleared_count = 0
        for conn_id in active_connections:
            if 'cached_invoices' in active_connections[conn_id]:
                del active_connections[conn_id]['cached_invoices']
                cleared_count += 1
        
        return jsonify({
            'success': True,
            'message': f'Cleared cache for {cleared_count} connections'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/connections', methods=['GET'])
def debug_connections():
    """Debug endpoint to view active connections"""
    try:
        connection_info = {}
        for connection_id, connection_data in active_connections.items():
            connection_info[connection_id] = {
                'connection_details': connection_data.get('connection_details', {}),
                'has_connector': 'connector' in connection_data,
                'has_cached_invoices': 'cached_invoices' in connection_data,
                'cached_invoice_count': len(connection_data.get('cached_invoices', []))
            }
        
        return jsonify({
            'success': True,
            'active_connections': connection_info,
            'total_connections': len(active_connections)
        })
    except Exception as e:
        print(f"❌ Error getting connection debug info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/threads', methods=['GET'])
def debug_threads():
    """Debug endpoint to view email threads"""
    try:
        thread_summary = thread_manager.get_thread_summary()
        return jsonify({
            'success': True,
            'threads': thread_summary,
            'total_threads': len(thread_summary)
        })
    except Exception as e:
        print(f"❌ Error getting thread debug info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/threads/clear', methods=['POST'])
def clear_threads():
    """Debug endpoint to clear all email threads"""
    try:
        thread_manager.clear_threads()
        return jsonify({
            'success': True,
            'message': 'All email threads cleared successfully'
        })
    except Exception as e:
        print(f"❌ Error clearing threads: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/demo/data', methods=['GET'])
def get_demo_data():
    """Get demo data for testing"""
    try:
        from demo_data import generate_demo_data
        demo_invoices = generate_demo_data()
        
        # Filter out zero-amount invoices
        demo_invoices = [inv for inv in demo_invoices if inv['amount_due'] > 0]
        
        clients_missing_email = [inv for inv in demo_invoices if not inv['client_email']]
        
        return jsonify({
            'success': True,
            'overdueInvoices': demo_invoices,
            'clientsMissingEmail': clients_missing_email
        })
    except ImportError:
        return jsonify({'error': 'Demo data module not available'}), 500

@app.route('/api/automated-reports/config', methods=['GET'])
def get_automated_reports_config():
    """Get automated reports configuration"""
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        
        from config_manager import ConfigManager
        config_manager = ConfigManager()
        
        # Return configuration without decrypted passwords for security
        config = config_manager.config
        
        return jsonify({
            'success': True,
            'config': config
        })
    except Exception as e:
        print(f"❌ Error getting automated reports config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/automated-reports/config', methods=['POST'])
def update_automated_reports_config():
    """Update automated reports configuration"""
    try:
        import sys
        import os
        import json
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        
        from config_manager import ConfigManager
        
        data = request.json
        print(f"🔍 Received automated reports config update: {data}")
        
        # Load current config
        config_manager = ConfigManager()
        current_config = config_manager.config
        
        # Update the configuration
        if 'updates' in data:
            updates = data['updates']
            
            # Update the automated_reports section
            if 'automated_reports' not in current_config:
                current_config['automated_reports'] = {}
            
            for key, value in updates.items():
                current_config['automated_reports'][key] = value
            
            # Save directly to file without encryption
            config_file = config_manager.config_file
            try:
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(current_config, f, indent=2, ensure_ascii=False)
                print(f"✅ Configuration saved to {config_file}")
                
                return jsonify({
                    'success': True,
                    'message': 'Configuration updated successfully'
                })
            except Exception as e:
                print(f"❌ Error saving configuration: {str(e)}")
                return jsonify({'error': f'Failed to save configuration: {str(e)}'}), 500
        
        return jsonify({'error': 'No updates provided'}), 400
        
    except Exception as e:
        print(f"❌ Error updating automated reports config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/automated-reports/test', methods=['POST'])
def test_automated_report():
    """Test the automated report generation and email sending"""
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        
        from config_manager import ConfigManager
        from core import OdooConnector
        
        config_manager = ConfigManager()
        config = config_manager.get_decrypted_config()
        
        print(f"🔍 Testing automated report with config: {config}")
        
        # Check if configuration is complete
        odoo_config = config['automated_reports']['odoo_connection']
        email_config = config['automated_reports']['email_settings']
        
        print(f"🔍 Odoo config: {odoo_config}")
        print(f"🔍 Email config: {email_config}")
        
        if not all([odoo_config['url'], odoo_config['database'], 
                   odoo_config['username'], odoo_config['password']]):
            missing_fields = []
            if not odoo_config['url']: missing_fields.append('url')
            if not odoo_config['database']: missing_fields.append('database')
            if not odoo_config['username']: missing_fields.append('username')
            if not odoo_config['password']: missing_fields.append('password')
            return jsonify({'error': f'Odoo connection details not configured. Missing: {missing_fields}'}), 400
        
        if not all([email_config['sender_email'], email_config['sender_password']]):
            return jsonify({'error': 'Email settings not configured'}), 400
        
        # Connect to Odoo
        connector = OdooConnector(
            odoo_config['url'],
            odoo_config['database'],
            odoo_config['username'],
            odoo_config['password']
        )
        
        if not connector.connect():
            return jsonify({'error': 'Failed to connect to Odoo'}), 500
        
        # Generate test report
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        from scripts.daily_report_script import generate_daily_report, send_daily_report_email
        
        report_data = generate_daily_report(connector)
        
        if not report_data:
            return jsonify({'error': 'No report data generated'}), 500
        
        # Send test email
        if send_daily_report_email(config, report_data):
            return jsonify({
                'success': True,
                'message': f'Test report sent successfully to {config["automated_reports"]["recipient_email"]}',
                'report_summary': {
                    'total_invoices': report_data['total_invoices'],
                    'total_amount': report_data['total_amount'],
                    'total_clients': report_data['total_clients']
                }
            })
        else:
            return jsonify({'error': 'Failed to send test email'}), 500
            
    except Exception as e:
        print(f"❌ Error testing automated report: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/threads', methods=['GET'])
def get_email_threads():
    """Get information about email threads"""
    try:
        threads = thread_manager.threads
        thread_list = []
        
        for client_key, thread_info in threads.items():
            thread_list.append({
                'client_key': client_key,
                'client_name': thread_info.get('client_name', ''),
                'client_email': thread_info.get('client_email', ''),
                'company_name': thread_info.get('company_name', ''),
                'thread_id': thread_info.get('thread_id', ''),
                'message_count': thread_info.get('message_count', 0),
                'created_date': thread_info.get('created_date', ''),
                'last_subject': thread_info.get('last_subject', '')
            })
        
        # Sort by message count (most active threads first)
        thread_list.sort(key=lambda x: x['message_count'], reverse=True)
        
        return jsonify({
            'success': True,
            'total_threads': len(thread_list),
            'threads': thread_list
        })
        
    except Exception as e:
        print(f"❌ Get email threads error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/threads/<client_key>', methods=['GET'])
def get_email_thread_info(client_key):
    """Get detailed information about a specific email thread"""
    try:
        thread_info = thread_manager.threads.get(client_key)
        
        if not thread_info:
            return jsonify({'error': 'Thread not found'}), 404
        
        return jsonify({
            'success': True,
            'thread_info': thread_info
        })
        
    except Exception as e:
        print(f"❌ Get thread info error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Serve React App
@app.route('/')
def serve_react_app():
    """Serve the main React application"""
    try:
        return send_from_directory(app.static_folder, 'index.html')
    except Exception as e:
        return f"Error serving React app: {str(e)}", 500

@app.route('/<path:path>')
def serve_react_routes(path):
    """Serve React routes and static files"""
    try:
        # Check if it's a static file request
        if path and ('.' in path or path.startswith('static/')):
            if os.path.exists(os.path.join(app.static_folder, path)):
                return send_from_directory(app.static_folder, path)
        
        # For all other routes, serve the React app
        return send_from_directory(app.static_folder, 'index.html')
    except Exception as e:
        print(f"❌ Error serving path {path}: {str(e)}")
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 8000))
    print("Starting Odoo Invoice Follow-Up Manager Backend...")
    print(f"Backend will be available at: http://0.0.0.0:{port}")
    print("API endpoints:")
    print("   - POST /api/odoo/connect")
    print("   - POST /api/odoo/disconnect")
    print("   - POST /api/odoo/refresh")
    print("   - POST /api/email/send")
    print("   - POST /api/pdf/generate")
    print("   - GET  /api/health")
    print("   - GET  /api/demo/data")
    print("   - GET  /api/debug/connections")
    print("   - GET  /api/debug/threads")
    print("   - POST /api/debug/threads/clear")
    print("   - GET  /api/automated-reports/config")
    print("   - POST /api/automated-reports/config")
    print("   - POST /api/automated-reports/test")
    print("   - GET  /api/email/threads")
    print("   - GET  /api/email/threads/<client_key>")
    print()
    
    app.run(debug=False, host='0.0.0.0', port=port)