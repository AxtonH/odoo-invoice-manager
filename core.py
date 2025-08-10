#!/usr/bin/env python3
"""
Core functionality for Odoo Invoice Follow-Up Manager
Contains classes and functions without Streamlit dependencies
"""

import pandas as pd
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import tempfile
import base64
import time
import re
import io
import requests
import hashlib
import uuid
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager

# Load environment variables
load_dotenv()

class EmailThreadManager:
    """Manages email threading for customer conversations"""
    
    def __init__(self, thread_file="email_threads.json"):
        """Initialize the thread manager with a JSON file to store thread information"""
        self.thread_file = thread_file
        self.threads = self._load_threads()
    
    def _load_threads(self):
        """Load existing thread information from file"""
        try:
            if os.path.exists(self.thread_file):
                with open(self.thread_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"Warning: Could not load thread file: {e}")
            return {}
    
    def _save_threads(self):
        """Save thread information to file"""
        try:
            with open(self.thread_file, 'w', encoding='utf-8') as f:
                json.dump(self.threads, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Warning: Could not save thread file: {e}")
    
    def get_thread_id(self, client_name, client_email, company_name=None):
        """Get or create a thread ID for a specific client"""
        # Create a unique key for this client
        client_key = f"{client_name}_{client_email}_{company_name or 'default'}"
        
        # Generate a hash for consistent thread ID
        thread_hash = hashlib.md5(client_key.encode('utf-8')).hexdigest()
        
        # Sanitize company name for email address (remove spaces, special chars)
        def sanitize_company_name(company):
            if not company:
                return 'company'
            # Remove spaces and special characters, keep only alphanumeric and dots
            sanitized = re.sub(r'[^a-zA-Z0-9.]', '', company)
            # If empty after sanitization, use default
            return sanitized if sanitized else 'company'
        
        sanitized_company = sanitize_company_name(company_name)
        
        if client_key not in self.threads:
            # Create new thread
            thread_id = f"<{thread_hash}@{sanitized_company}.com>"
            self.threads[client_key] = {
                'thread_id': thread_id,
                'client_name': client_name,
                'client_email': client_email,
                'company_name': company_name,
                'created_date': datetime.now().isoformat(),
                'message_count': 0
            }
            self._save_threads()
        else:
            # Update message count
            self.threads[client_key]['message_count'] += 1
            self._save_threads()
        
        return self.threads[client_key]['thread_id']
    
    def get_thread_info(self, client_name, client_email, company_name=None):
        """Get thread information for a client"""
        client_key = f"{client_name}_{client_email}_{company_name or 'default'}"
        return self.threads.get(client_key, {})
    
    def update_thread_subject(self, client_name, client_email, subject, company_name=None):
        """Update the subject line for a thread to maintain context"""
        client_key = f"{client_name}_{client_email}_{company_name or 'default'}"
        if client_key in self.threads:
            self.threads[client_key]['last_subject'] = subject
            self._save_threads()
    
    def clear_threads(self):
        """Clear all thread data (for testing purposes)"""
        self.threads = {}
        self._save_threads()
        print("🧹 All email threads cleared")
    
    def get_thread_summary(self):
        """Get a summary of all threads"""
        summary = []
        for client_key, thread_info in self.threads.items():
            summary.append({
                'client_key': client_key,
                'client_name': thread_info.get('client_name', ''),
                'client_email': thread_info.get('client_email', ''),
                'thread_id': thread_info.get('thread_id', ''),
                'message_count': thread_info.get('message_count', 0),
                'created_date': thread_info.get('created_date', ''),
                'last_subject': thread_info.get('last_subject', '')
            })
        return summary

# Global thread manager instance
thread_manager = EmailThreadManager()

class OdooConnector:
    def __init__(self, url, database, username, password):
        self.url = url.rstrip('/')
        self.database = database
        self.username = username
        self.password = password
        
        # Optimized session with connection pooling
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        self.session = requests.Session()
        
        # Configure connection pooling
        adapter = HTTPAdapter(
            pool_connections=10,  # Number of connection pools
            pool_maxsize=20,      # Maximum connections per pool
            max_retries=Retry(
                total=3,
                backoff_factor=0.1,
                status_forcelist=[500, 502, 503, 504]
            )
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        
        # Optimized headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Connection': 'keep-alive'  # Enable keep-alive
        })
        
        self.uid = None
        
        # Add caching for better performance
        self._partners_cache = {}
        self._currencies_cache = {}
        self._companies_cache = {}
        self._cache_timestamp = None
        self._cache_duration = 300  # 5 minutes cache
        
    def connect(self):
        """Connect to Odoo and authenticate"""
        try:
            # Authenticate with Odoo
            auth_url = f"{self.url}/web/session/authenticate"
            auth_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "db": self.database,
                    "login": self.username,
                    "password": self.password
                }
            }
            
            response = self.session.post(auth_url, json=auth_data)
            result = response.json()
            
            if result.get('result') and result['result'].get('uid'):
                self.uid = result['result']['uid']
                
                # Initialize models for API calls
                try:
                    import xmlrpc.client
                    self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
                    print(f"✅ Models initialized for API calls")
                except Exception as e:
                    print(f"⚠️ Could not initialize models: {str(e)}")
                    self.models = None
                
                return True
            else:
                return False
                
        except Exception as e:
            print(f"Connection error: {str(e)}")
            return False
    
    def get_overdue_invoices(self, progress_callback=None):
        """Fetch overdue invoices from Odoo with ultra-optimized batch processing"""
        try:
            if not self.uid:
                if not self.connect():
                    return []
            
            print(f"🚀 Starting ultra-optimized invoice fetch...")
            
            # Search for overdue invoices with optimized query
            print(f"🔍 Debug: Searching for invoices with residual amounts > 0")
            
            search_url = f"{self.url}/web/dataset/call_kw"
            search_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "account.move",
                    "method": "search_read",
                    "args": [
                        [
                            ("move_type", "=", "out_invoice"),
                            ("amount_residual", ">", 0)  # Pre-filter zero amounts
                        ]
                    ],
                    "kwargs": {
                        "fields": [
                            "id", "name", "partner_id", "amount_total", "amount_residual",
                            "invoice_date", "invoice_date_due", "payment_state", "currency_id",
                            "company_id", "invoice_origin"
                        ],
                        "limit": 1000  # Limit results for faster processing
                    }
                }
            }
            
            print(f"🔍 Debug: Search criteria: {search_data['params']['args'][0]}")
            
            response = self.session.post(search_url, json=search_data)
            result = response.json()
            
            # Debug: Log the raw response to see what's happening
            print(f"🔍 Debug: Odoo API response status: {response.status_code}")
            print(f"🔍 Debug: Odoo API response: {result}")
            
            if not result.get('result'):
                print(f"❌ No result from Odoo API. Error: {result.get('error', 'Unknown error')}")
                return []
            
            raw_invoices = result['result']
            print(f"📊 Found {len(raw_invoices)} invoices, starting batch processing...")
            
            # Debug: Check if company_id is in the raw data
            if raw_invoices:
                first_invoice = raw_invoices[0]
                print(f"🔍 Debug: First invoice fields: {list(first_invoice.keys())}")
                print(f"🔍 Debug: company_id in first invoice: {first_invoice.get('company_id', 'NOT FOUND')}")
                print(f"🔍 Debug: invoice_origin in first invoice: {first_invoice.get('invoice_origin', 'NOT FOUND')}")
                print(f"🔍 Debug: Sample invoice data: {first_invoice}")
            
            # Filter out zero-amount invoices first
            valid_invoices = [inv for inv in raw_invoices if inv['amount_total'] > 0 and inv['amount_residual'] > 0]
            print(f"📋 Processing {len(valid_invoices)} valid invoices...")
            
            # Collect all unique IDs for batch fetching
            partner_ids = list(set(inv['partner_id'][0] for inv in valid_invoices if inv.get('partner_id')))
            currency_ids = list(set(inv['currency_id'][0] for inv in valid_invoices if inv.get('currency_id')))
            company_ids = list(set(inv['company_id'][0] for inv in valid_invoices if inv.get('company_id')))
            
            print(f"🔄 Parallel batch fetching {len(partner_ids)} partners, {len(currency_ids)} currencies, and {len(company_ids)} companies...")
            
            # Parallel batch fetching using threading
            import threading
            import queue
            
            partners_cache = {}
            currencies_cache = {}
            companies_cache = {}
            
            # Create queues for results
            partner_queue = queue.Queue()
            currency_queue = queue.Queue()
            company_queue = queue.Queue()
            
            # Start parallel threads
            if partner_ids:
                partner_thread = threading.Thread(
                    target=lambda: partner_queue.put(self._get_partners_batch(partner_ids))
                )
                partner_thread.daemon = True
                partner_thread.start()
            
            if currency_ids:
                currency_thread = threading.Thread(
                    target=lambda: currency_queue.put(self._get_currencies_batch(currency_ids))
                )
                currency_thread.daemon = True
                currency_thread.start()
            
            if company_ids:
                company_thread = threading.Thread(
                    target=lambda: company_queue.put(self._get_companies_batch(company_ids))
                )
                company_thread.daemon = True
                company_thread.start()
            
            # Wait for results with timeout
            if partner_ids:
                try:
                    partners_cache = partner_queue.get(timeout=10)
                except queue.Empty:
                    print("⚠️ Partner fetch timeout, using empty cache")
                    partners_cache = {}
            
            if currency_ids:
                try:
                    currencies_cache = currency_queue.get(timeout=10)
                except queue.Empty:
                    print("⚠️ Currency fetch timeout, using empty cache")
                    currencies_cache = {}
            
            if company_ids:
                try:
                    companies_cache = company_queue.get(timeout=10)
                except queue.Empty:
                    print("⚠️ Company fetch timeout, using empty cache")
                    companies_cache = {}
            
            print(f"✅ Batch fetch complete. Processing invoices...")
            
            # Optimized invoice processing with list comprehension
            from datetime import datetime
            
            def process_invoice(invoice, i):
                # Get partner from cache
                partner_id = invoice['partner_id'][0] if invoice.get('partner_id') else None
                partner = partners_cache.get(partner_id, {'name': 'Unknown', 'email': ''})
                
                # Get currency from cache
                currency_id = invoice.get('currency_id', [None])[0] if invoice.get('currency_id') else None
                currency_symbol = '$'  # Default fallback
                if currency_id and currency_id in currencies_cache:
                    currency_symbol = currencies_cache[currency_id].get('symbol', '$')
                
                # Get company name from company_id (from Odoo API)
                company_name = 'Unknown Company'
                company_id = invoice.get('company_id', [None])[0] if invoice.get('company_id') else None
                
                if company_id and company_id in companies_cache:
                    # Use cached company data
                    company = companies_cache[company_id]
                    company_name = company.get('name', 'Unknown Company')
                    print(f"🔍 Debug: Invoice {invoice['name']} → Company ID {company_id} → {company_name}")
                elif company_id:
                    # Fallback: Get company details directly
                    company = self._get_company(company_id)
                    company_name = company.get('name', 'Unknown Company')
                    print(f"🔍 Debug: Invoice {invoice['name']} → Company ID {company_id} → {company_name}")
                else:
                    # Fallback to invoice number pattern if company_id not available
                    company_name = self._get_company_from_invoice_number(invoice['name'])
                    print(f"🔍 Debug: Invoice {invoice['name']} → No company_id, using pattern → {company_name}")
                
                # Calculate days overdue
                due_date = datetime.strptime(invoice['invoice_date_due'], "%Y-%m-%d")
                days_overdue = (datetime.now() - due_date).days
                
                invoice_data = {
                    'id': invoice['id'],
                    'invoice_number': invoice['name'],
                    'client_name': partner['name'],
                    'client_email': partner.get('email', ''),
                    'amount_total': invoice['amount_total'],
                    'amount_due': invoice['amount_residual'],
                    'invoice_date': invoice['invoice_date'],
                    'due_date': invoice['invoice_date_due'],
                    'days_overdue': days_overdue,
                    'payment_state': invoice['payment_state'],
                    'currency_symbol': currency_symbol,
                    'company_name': company_name,
                    'origin': invoice.get('invoice_origin', '')  # Use the correct field name
                }
                
                # Debug: Check if company_name was set
                if i < 3:  # Only debug first 3 invoices
                    print(f"🔍 Debug: Invoice {invoice['name']} → company_name: '{company_name}'")
                
                return invoice_data
            
            # Process invoices with progress updates
            invoices = []
            total_invoices = len(valid_invoices)
            
            for i, invoice in enumerate(valid_invoices):
                invoices.append(process_invoice(invoice, i))
                
                # Progress callback (less frequent for better performance)
                if progress_callback and i % 20 == 0:  # Update every 20 invoices
                    progress_callback(f"Processing invoice {i+1}/{total_invoices}", (i+1) / total_invoices * 100)
            
            print(f"✅ Successfully processed {len(invoices)} invoices")
            return invoices
            
        except Exception as e:
            print(f"Error fetching invoices: {str(e)}")
            return []
    
    def _get_company_from_invoice_number(self, invoice_number):
        """Get company name from invoice number pattern (fast local processing)"""
        if invoice_number.startswith('PLFZ/'):
            return 'Prezlab FZ LLC'
        elif invoice_number.startswith('PLAD/'):
            return 'Prezlab Advanced Design Company'
        elif invoice_number.startswith('PLDD/'):
            return 'Prezlab Digital Design'
        else:
            return 'Unknown Company'
    
    def _is_cache_valid(self):
        """Check if cache is still valid"""
        if not self._cache_timestamp:
            return False
        
        import time
        return (time.time() - self._cache_timestamp) < self._cache_duration
    
    def _update_cache_timestamp(self):
        """Update cache timestamp"""
        import time
        self._cache_timestamp = time.time()
    
    def _get_partners_batch(self, partner_ids):
        """Batch fetch multiple partners in one API call with caching"""
        try:
            if not partner_ids:
                return {}
            
            # Check cache first
            if self._is_cache_valid():
                cached_partners = {pid: self._partners_cache.get(pid) for pid in partner_ids}
                missing_ids = [pid for pid in partner_ids if pid not in self._partners_cache]
                
                if not missing_ids:
                    print(f"✅ Using cached partners data ({len(partner_ids)} partners)")
                    return cached_partners
                else:
                    print(f"🔄 Fetching {len(missing_ids)} missing partners from cache...")
                    partner_ids = missing_ids
            
            partner_url = f"{self.url}/web/dataset/call_kw"
            partner_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "res.partner",
                    "method": "read",
                    "args": [partner_ids],
                    "kwargs": {"fields": ["name", "email", "currency_id"]}
                }
            }
            
            response = self.session.post(partner_url, json=partner_data)
            result = response.json()
            
            partners_cache = {}
            if result.get('result'):
                for partner in result['result']:
                    partners_cache[partner['id']] = partner
                    # Update global cache
                    self._partners_cache[partner['id']] = partner
            
            # Update cache timestamp
            self._update_cache_timestamp()
            
            print(f"✅ Batch fetched {len(partners_cache)} partners")
            return partners_cache
            
        except Exception as e:
            print(f"Error batch fetching partners: {str(e)}")
            return {}
    
    def _get_currencies_batch(self, currency_ids):
        """Batch fetch multiple currencies in one API call with caching"""
        try:
            if not currency_ids:
                return {}
            
            # Check cache first
            if self._is_cache_valid():
                cached_currencies = {cid: self._currencies_cache.get(cid) for cid in currency_ids}
                missing_ids = [cid for cid in currency_ids if cid not in self._currencies_cache]
                
                if not missing_ids:
                    print(f"✅ Using cached currencies data ({len(currency_ids)} currencies)")
                    return cached_currencies
                else:
                    print(f"🔄 Fetching {len(missing_ids)} missing currencies from cache...")
                    currency_ids = missing_ids
            
            currency_url = f"{self.url}/web/dataset/call_kw"
            currency_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "res.currency",
                    "method": "read",
                    "args": [currency_ids],
                    "kwargs": {"fields": ["name", "symbol"]}
                }
            }
            
            response = self.session.post(currency_url, json=currency_data)
            result = response.json()
            
            currencies_cache = {}
            if result.get('result'):
                for currency in result['result']:
                    currencies_cache[currency['id']] = currency
                    # Update global cache
                    self._currencies_cache[currency['id']] = currency
            
            # Update cache timestamp
            self._update_cache_timestamp()
            
            print(f"✅ Batch fetched {len(currencies_cache)} currencies")
            return currencies_cache
            
        except Exception as e:
            print(f"Error batch fetching currencies: {str(e)}")
            return {}
    
    def _get_companies_batch(self, company_ids):
        """Batch fetch multiple companies in one API call with caching"""
        try:
            if not company_ids:
                return {}
            
            # Check cache first
            if self._is_cache_valid():
                cached_companies = {cid: self._companies_cache.get(cid) for cid in company_ids}
                missing_ids = [cid for cid in company_ids if cid not in self._companies_cache]
                
                if not missing_ids:
                    print(f"✅ Using cached companies data ({len(company_ids)} companies)")
                    return cached_companies
                else:
                    print(f"🔄 Fetching {len(missing_ids)} missing companies from cache...")
                    company_ids = missing_ids
            
            company_url = f"{self.url}/web/dataset/call_kw"
            company_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "res.company",
                    "method": "read",
                    "args": [company_ids],
                    "kwargs": {"fields": ["name"]}
                }
            }
            
            response = self.session.post(company_url, json=company_data)
            result = response.json()
            
            companies_cache = {}
            if result.get('result'):
                for company in result['result']:
                    companies_cache[company['id']] = company
                    # Update global cache
                    self._companies_cache[company['id']] = company
            
            # Update cache timestamp
            self._update_cache_timestamp()
            
            print(f"✅ Batch fetched {len(companies_cache)} companies")
            return companies_cache
            
        except Exception as e:
            print(f"Error batch fetching companies: {str(e)}")
            return {}
    
    def _get_partner(self, partner_id):
        """Get partner details"""
        try:
            partner_url = f"{self.url}/web/dataset/call_kw"
            partner_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "res.partner",
                    "method": "read",
                    "args": [[partner_id]],
                    "kwargs": {"fields": ["name", "email", "currency_id"]}
                }
            }
            
            response = self.session.post(partner_url, json=partner_data)
            result = response.json()
            
            print(f"🔍 Debug: Partner API response for ID {partner_id}: {result}")
            
            if result.get('result') and result['result']:
                partner_data = result['result'][0]
                print(f"🔍 Debug: Extracted partner data: {partner_data}")
                return partner_data
            return {'name': 'Unknown', 'email': ''}
            
        except Exception as e:
            print(f"Error fetching partner: {str(e)}")
            return {'name': 'Unknown', 'email': ''}

    def _get_currency(self, currency_id):
        """Get currency details"""
        try:
            currency_url = f"{self.url}/web/dataset/call_kw"
            currency_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "res.currency",
                    "method": "read",
                    "args": [[currency_id]],
                    "kwargs": {"fields": ["name", "symbol"]}
                }
            }
            
            response = self.session.post(currency_url, json=currency_data)
            result = response.json()
            
            if result.get('result') and result['result']:
                return result['result'][0]
            return {'name': 'USD', 'symbol': '$'}
            
        except Exception as e:
            print(f"Error fetching currency: {str(e)}")
            return {'name': 'USD', 'symbol': '$'}

    def _get_company(self, company_id):
        """Get company details"""
        try:
            company_url = f"{self.url}/web/dataset/call_kw"
            company_data = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "model": "res.company",
                    "method": "read",
                    "args": [[company_id]],
                    "kwargs": {"fields": ["name"]}
                }
            }
            
            response = self.session.post(company_url, json=company_data)
            result = response.json()
            
            print(f"🔍 Debug: Company API response for ID {company_id}: {result}")
            
            if result.get('result') and result['result']:
                company_data = result['result'][0]
                print(f"🔍 Debug: Extracted company data: {company_data}")
                return company_data
            return {'name': 'Unknown Company'}
            
        except Exception as e:
            print(f"Error fetching company: {str(e)}")
            return {'name': 'Unknown Company'}

class InvoicePDFGenerator:
    def __init__(self, odoo_connector):
        self.connector = odoo_connector
        self.driver = None
    
    def generate_client_invoices_pdf(self, client_name, partner_id, progress_callback=None):
        """Generate PDF with all invoices for a client using API-first approach"""
        try:
            if progress_callback:
                progress_callback(f"Generating PDF for {client_name}...", 0.1)
            
            # Try API method first (more reliable and faster)
            pdf_data = self._generate_pdf_via_api(client_name, partner_id, progress_callback)
            if pdf_data:
                if progress_callback:
                    progress_callback(f"PDF generated successfully via API for {client_name}", 1.0)
                return pdf_data
            
            # Only fall back to browser automation if API completely fails
            if progress_callback:
                progress_callback(f"API methods failed, trying browser automation for {client_name}...", 0.5)
            
            # For now, let's skip browser automation and just return None
            # This will force users to rely on the more reliable API method
            if progress_callback:
                progress_callback(f"Browser automation disabled - API method failed for {client_name}", 1.0)
            
            print(f"⚠️ PDF generation failed for {client_name}. Please check if the client has invoices and try again.")
            return None
            
        except Exception as e:
            print(f"Error generating PDF for {client_name}: {str(e)}")
            return None
    
    def _generate_pdf_via_api(self, client_name, partner_id, progress_callback=None):
        """Generate PDF using direct HTTP request to Odoo (the only working method)"""
        try:
            if progress_callback:
                progress_callback(f"Getting partner ID for {client_name}...", 0.1)
            
            # First, get the partner ID if we don't have it
            if isinstance(partner_id, str):
                # partner_id is actually the client name, so we need to find the partner ID
                partner_ids = self.connector.models.execute_kw(
                    self.connector.database, self.connector.uid, self.connector.password,
                    'res.partner', 'search',
                    [[('name', '=', partner_id)]]
                )
                if not partner_ids:
                    print(f"❌ No partner found for client: {client_name}")
                    return None
                partner_id = partner_ids[0]
                print(f"✅ Found partner ID {partner_id} for client: {client_name}")
            
            if progress_callback:
                progress_callback(f"Getting overdue invoice IDs for {client_name}...", 0.3)
            
            # Get only OVERDUE invoice IDs for this client (follow-up report criteria)
            today = datetime.now().date()
            invoice_ids = self.connector.models.execute_kw(
                self.connector.database, self.connector.uid, self.connector.password,
                'account.move', 'search',
                [[('partner_id', '=', partner_id), 
                  ('move_type', '=', 'out_invoice'),
                  ('state', '=', 'posted'),
                  ('payment_state', '!=', 'paid'),
                  ('invoice_date_due', '<', today.isoformat())]]
            )
            
            if not invoice_ids:
                print(f"❌ No overdue invoices found for {client_name}")
                return None
            
            print(f"✅ Found {len(invoice_ids)} overdue invoices for {client_name}: {invoice_ids}")
            
            if progress_callback:
                progress_callback(f"Generating PDF for {client_name}...", 0.5)
            
            # Direct HTTP request (the only working method)
            if self.connector.url and invoice_ids:
                import requests
                
                # Create a session to maintain cookies
                session = requests.Session()
                session.headers.update({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                })
                
                # Authenticate using Odoo v17 method
                login_url = f"{self.connector.url}/web/session/authenticate"
                login_data = {
                    'jsonrpc': '2.0',
                    'method': 'call',
                    'params': {
                        'db': self.connector.database,
                        'login': self.connector.username,
                        'password': self.connector.password
                    }
                }
                
                login_response = session.post(login_url, json=login_data, timeout=30)
                
                if login_response.status_code == 200:
                    # Try to parse the login response
                    try:
                        login_result = login_response.json()
                        if login_result.get('result', {}).get('uid'):
                            print(f"✅ Login successful for {client_name}")
                        else:
                            print(f"❌ Login failed for {client_name}: {login_result}")
                            return None
                    except:
                        print(f"❌ Could not parse login response for {client_name}")
                        return None
                    
                    # Generate PDF using the report URL
                    report_url = f"{self.connector.url}/report/pdf/account.report_invoice/{','.join(map(str, invoice_ids))}"
                    response = session.get(report_url, timeout=30)
                    
                    if response.status_code == 200:
                        content_type = response.headers.get('content-type', '')
                        if 'application/pdf' in content_type or response.content.startswith(b'%PDF'):
                            print(f"✅ PDF generated successfully for {client_name} - Size: {len(response.content)} bytes")
                            return response.content
                        else:
                            print(f"❌ HTTP request returned non-PDF content for {client_name}: {content_type}")
                            print(f"❌ Response length: {len(response.content)} bytes")
                            # Show first 200 characters for debugging
                            try:
                                print(f"❌ Response preview: {response.text[:200]}...")
                            except:
                                print("❌ Could not decode response text")
                    else:
                        print(f"❌ HTTP request failed for {client_name} with status: {response.status_code}")
                        try:
                            print(f"❌ Response content: {response.text[:200]}...")
                        except:
                            print("❌ Could not decode error response")
                else:
                    print(f"❌ Login request failed for {client_name} with status: {login_response.status_code}")
            
            print(f"❌ PDF generation failed for {client_name}")
            return None
            
        except Exception as e:
            print(f"❌ Error generating PDF for {client_name}: {str(e)}")
            return None

def get_automatic_iban_attachment(reference_company):
    """Get automatic IBAN letter attachment based on reference company"""
    import os
    import tempfile
    
    # Define the mapping of companies to their IBAN letter files
    iban_letter_mapping = {
        "Prezlab FZ LLC": "IBAN Letter _ Prezlab FZ LLC .pdf",
        "Prezlab Advanced Design Company": "IBAN Letter _ Prezlab Advanced Design Company .pdf"
    }
    
    # Get the filename for the company
    filename = iban_letter_mapping.get(reference_company)
    if not filename:
        print(f"⚠️ No IBAN letter mapping found for company: {reference_company}")
        return None
    
    # Construct the full file path
    file_path = os.path.join(os.getcwd(), filename)
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"⚠️ IBAN letter file not found for {reference_company}: {file_path}")
        return None
    
    try:
        # Read the file content into memory and create a temporary file-like object
        with open(file_path, 'rb') as file:
            file_content = file.read()
        
        # Create a BytesIO object that can be used multiple times
        import io
        file_obj = io.BytesIO(file_content)
        file_obj.name = filename  # Set the filename for the email attachment
        
        print(f"✅ Successfully loaded IBAN letter: {filename} ({len(file_content)} bytes)")
        return file_obj
    except Exception as e:
        print(f"Error reading IBAN letter file for {reference_company}: {str(e)}")
        return None

def generate_email_template(client_name, invoices, days_overdue, template_type="initial"):
    """Generate email template for a client"""
    total_amount = sum(invoice['amount_residual'] for invoice in invoices)
    
    # Use consistent subject line for all template types to enable proper threading
    subject = f"Invoice notice - outstanding balance of ${total_amount:,.2f}"
    
    if template_type == "initial":
        body = f"""
Dear {client_name},

We hope this email finds you well. We would like to bring to your attention that you have {len(invoices)} invoice(s) that are currently overdue for payment.

Total Outstanding Amount: ${total_amount:,.2f}
Days Overdue: {days_overdue}

Please arrange for payment at your earliest convenience. If you have any questions or concerns, please don't hesitate to contact us.

Thank you for your prompt attention to this matter.

Best regards,
Your Company Name
        """
    elif template_type == "second":
        body = f"""
Dear {client_name},

This is our second reminder regarding your overdue invoice(s). We have not yet received payment for the following:

Total Outstanding Amount: ${total_amount:,.2f}
Days Overdue: {days_overdue}

Please note that continued non-payment may result in additional charges or suspension of services.

We kindly request immediate payment or contact us to discuss payment arrangements.

Best regards,
Your Company Name
        """
    else:  # final
        body = f"""
Dear {client_name},

This is our final notice regarding your overdue invoice(s). Payment is now urgently required:

Total Outstanding Amount: ${total_amount:,.2f}
Days Overdue: {days_overdue}

Failure to make immediate payment may result in:
- Additional late fees
- Suspension of services
- Legal action

Please contact us immediately to resolve this matter.

Best regards,
Your Company Name
        """
    
    return {
        'subject': subject.strip(),
        'body': body.strip()
    }

def send_email(sender_email, sender_password, recipient_email, cc_list, subject, body, attachments=None, smtp_server="smtp.gmail.com", smtp_port=587, client_name=None, company_name=None, enable_threading=True):
    """Send email with optional attachments and threading support"""
    try:
        print(f"📧 Attempting to send email:")
        print(f"   From: {sender_email}")
        print(f"   To: {recipient_email}")
        print(f"   CC: {cc_list}")
        print(f"   SMTP: {smtp_server}:{smtp_port}")
        print(f"   Body preview: {body[:200]}...")
        print(f"   Threading enabled: {enable_threading}")
        
        # Check if body contains HTML tags to determine format
        is_html = '<table>' in body or '<tr>' in body or '<td>' in body or '<th>' in body
        print(f"   Content type: {'HTML' if is_html else 'Plain text'}")
        
        # Get thread ID if threading is enabled and client info is provided
        thread_id = None
        if enable_threading and client_name and recipient_email:
            thread_id = thread_manager.get_thread_id(client_name, recipient_email, company_name)
            thread_manager.update_thread_subject(client_name, recipient_email, subject, company_name)
            print(f"   Thread ID: {thread_id}")
            print(f"   Subject for threading: {subject}")
        
        # Get thread info for reference
        thread_info = None
        if client_name and recipient_email:
            thread_info = thread_manager.get_thread_info(client_name, recipient_email, company_name)
            if thread_info:
                print(f"   Thread message count: {thread_info.get('message_count', 0)}")
        
        if is_html:
            # Create a multipart alternative message for better HTML support
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            # Create plain text version (strip HTML tags)
            import re
            plain_text = re.sub(r'<[^>]+>', '', body)
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            
            # Create the main message as multipart alternative
            msg = MIMEMultipart('alternative')
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject
            
            # Add threading headers
            if thread_id:
                msg['Message-ID'] = thread_id
                msg['In-Reply-To'] = thread_id
                msg['References'] = thread_id
                # Add X-Thread-ID header for better compatibility
                msg['X-Thread-ID'] = thread_id.strip('<>')
                print(f"   Added threading headers: Message-ID, In-Reply-To, References, X-Thread-ID")
            
            if cc_list:
                msg['Cc'] = ', '.join(cc_list)
            
            # Attach plain text version first
            text_part = MIMEText(plain_text, 'plain', 'utf-8')
            msg.attach(text_part)
            
            # Attach HTML version
            html_part = MIMEText(body, 'html', 'utf-8')
            msg.attach(html_part)
        else:
            # For plain text, use simple MIMEText
            msg = MIMEText(body, 'plain', 'utf-8')
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject
            
            # Add threading headers
            if thread_id:
                msg['Message-ID'] = thread_id
                msg['In-Reply-To'] = thread_id
                msg['References'] = thread_id
                # Add X-Thread-ID header for better compatibility
                msg['X-Thread-ID'] = thread_id.strip('<>')
                print(f"   Added threading headers: Message-ID, In-Reply-To, References, X-Thread-ID")
            
            if cc_list:
                msg['Cc'] = ', '.join(cc_list)
        
        # Add attachments
        if attachments:
            # If we have attachments, we need to wrap the message in a multipart/mixed
            if is_html:
                # Create a new multipart/mixed message
                mixed_msg = MIMEMultipart('mixed')
                mixed_msg['From'] = sender_email
                mixed_msg['To'] = recipient_email
                mixed_msg['Subject'] = subject
                
                # Add threading headers
                if thread_id:
                    mixed_msg['Message-ID'] = thread_id
                    mixed_msg['In-Reply-To'] = thread_id
                    mixed_msg['References'] = thread_id
                    # Add X-Thread-ID header for better compatibility
                    mixed_msg['X-Thread-ID'] = thread_id.strip('<>')
                
                if cc_list:
                    mixed_msg['Cc'] = ', '.join(cc_list)
                
                # Attach the alternative message (HTML + plain text)
                mixed_msg.attach(msg)
                
                # Add attachments
                for attachment in attachments:
                    if isinstance(attachment, dict) and 'data' in attachment and 'filename' in attachment:
                        # Handle dict format with data and filename
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(attachment['data'])
                        encoders.encode_base64(part)
                        part.add_header('Content-Disposition', f'attachment; filename= {attachment["filename"]}')
                        mixed_msg.attach(part)
                    elif hasattr(attachment, 'read') and hasattr(attachment, 'name'):
                        # Handle file-like objects (BytesIO with name attribute)
                        part = MIMEBase('application', 'octet-stream')
                        attachment.seek(0)  # Reset to beginning
                        part.set_payload(attachment.read())
                        encoders.encode_base64(part)
                        part.add_header('Content-Disposition', f'attachment; filename= {attachment.name}')
                        mixed_msg.attach(part)
                
                msg = mixed_msg
            else:
                # For plain text with attachments, create multipart/mixed
                mixed_msg = MIMEMultipart('mixed')
                mixed_msg['From'] = sender_email
                mixed_msg['To'] = recipient_email
                mixed_msg['Subject'] = subject
                
                # Add threading headers
                if thread_id:
                    mixed_msg['Message-ID'] = thread_id
                    mixed_msg['In-Reply-To'] = thread_id
                    mixed_msg['References'] = thread_id
                    # Add X-Thread-ID header for better compatibility
                    mixed_msg['X-Thread-ID'] = thread_id.strip('<>')
                
                if cc_list:
                    mixed_msg['Cc'] = ', '.join(cc_list)
                
                # Attach the plain text message
                mixed_msg.attach(msg)
                
                # Add attachments
                for attachment in attachments:
                    if isinstance(attachment, dict) and 'data' in attachment and 'filename' in attachment:
                        # Handle dict format with data and filename
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(attachment['data'])
                        encoders.encode_base64(part)
                        part.add_header('Content-Disposition', f'attachment; filename= {attachment["filename"]}')
                        mixed_msg.attach(part)
                    elif hasattr(attachment, 'read') and hasattr(attachment, 'name'):
                        # Handle file-like objects (BytesIO with name attribute)
                        part = MIMEBase('application', 'octet-stream')
                        attachment.seek(0)  # Reset to beginning
                        part.set_payload(attachment.read())
                        encoders.encode_base64(part)
                        part.add_header('Content-Disposition', f'attachment; filename= {attachment.name}')
                        mixed_msg.attach(part)
                
                msg = mixed_msg
        
        # Send email
        print(f"   Connecting to SMTP server...")
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        
        print(f"   Authenticating...")
        server.login(sender_email, sender_password)
        
        recipients = [recipient_email] + cc_list if cc_list else [recipient_email]
        print(f"   Sending to recipients: {recipients}")
        server.sendmail(sender_email, recipients, msg.as_string())
        server.quit()
        
        print(f"   ✅ Email sent successfully!")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication Error: {str(e)}")
        print(f"   Please check your email credentials and ensure 'Less secure app access' is enabled for Gmail")
        return False
    except smtplib.SMTPRecipientsRefused as e:
        print(f"❌ SMTP Recipients Refused: {str(e)}")
        print(f"   Please check the recipient email addresses")
        return False
    except smtplib.SMTPServerDisconnected as e:
        print(f"❌ SMTP Server Disconnected: {str(e)}")
        print(f"   Please check your internet connection and SMTP server settings")
        return False
    except Exception as e:
        print(f"❌ Email sending error: {str(e)}")
        return False 