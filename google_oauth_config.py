"""
Google OAuth Configuration for Gmail Integration
"""

import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle
import json
import streamlit as st

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email'
]

def load_oauth_config():
    """Load OAuth configuration from credentials.json file or environment variables"""
    # First, try to load from credentials.json file
    credentials_file = "credentials.json"
    if os.path.exists(credentials_file):
        try:
            with open(credentials_file, 'r') as f:
                config = json.load(f)
                # Extract web client configuration
                if "web" in config:
                    return config["web"]
                elif "installed" in config:
                    # Convert installed app config to web config
                    installed = config["installed"]
                    return {
                        "client_id": installed["client_id"],
                        "project_id": installed["project_id"],
                        "auth_uri": installed["auth_uri"],
                        "token_uri": installed["token_uri"],
                        "auth_provider_x509_cert_url": installed["auth_provider_x509_cert_url"],
                        "client_secret": installed["client_secret"],
                        "redirect_uris": ["http://localhost:8501/", "http://localhost:8501"]
                    }
        except Exception as e:
            print(f"Error loading credentials.json: {e}")
    
    # Fallback to environment variables
    return {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "project_id": os.getenv("GOOGLE_PROJECT_ID", ""),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uris": ["http://localhost:8501/", "http://localhost:8501"]
    }

# Load OAuth configuration
OAUTH_CONFIG = {"web": load_oauth_config()}

def get_google_oauth_url():
    """Generate Google OAuth URL for authentication with proper redirect"""
    try:
        flow = InstalledAppFlow.from_client_config(OAUTH_CONFIG, SCOPES)
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            redirect_uri='http://localhost:8501/'
        )
        return auth_url
    except Exception as e:
        print(f"Error generating OAuth URL: {e}")
        return None

def handle_oauth_callback():
    """Handle OAuth callback from Google"""
    try:
        # Get query parameters from Streamlit
        query_params = st.experimental_get_query_params()
        code = query_params.get("code", [None])[0]
        
        if code:
            # Exchange code for tokens
            token_data = exchange_code_for_tokens(code)
            if token_data:
                # Save tokens to file
                save_tokens_to_file(token_data)
                return token_data
        return None
    except Exception as e:
        print(f"Error handling OAuth callback: {e}")
        return None

def exchange_code_for_tokens(authorization_code):
    """Exchange authorization code for access and refresh tokens"""
    try:
        flow = InstalledAppFlow.from_client_config(OAUTH_CONFIG, SCOPES)
        flow.fetch_token(code=authorization_code)
        
        # Get user info
        credentials = flow.credentials
        user_info = get_user_info(credentials)
        
        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes,
            'user_email': user_info.get('email', ''),
            'user_name': user_info.get('name', '')
        }
    except Exception as e:
        print(f"Error exchanging code for tokens: {e}")
        return None

def get_user_info(credentials):
    """Get user information from Google"""
    try:
        from googleapiclient.discovery import build
        
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        return user_info
    except Exception as e:
        print(f"Error getting user info: {e}")
        return {}

def refresh_access_token(refresh_token):
    """Refresh access token using refresh token"""
    try:
        credentials = Credentials(
            None,  # No access token initially
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=OAUTH_CONFIG["web"]["client_id"],
            client_secret=OAUTH_CONFIG["web"]["client_secret"],
            scopes=SCOPES
        )
        
        # Refresh the credentials
        credentials.refresh(Request())
        
        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
    except Exception as e:
        print(f"Error refreshing token: {e}")
        return None

def create_credentials_from_tokens(token_data):
    """Create Credentials object from token data"""
    try:
        return Credentials(
            token=token_data['access_token'],
            refresh_token=token_data['refresh_token'],
            token_uri=token_data['token_uri'],
            client_id=token_data['client_id'],
            client_secret=token_data['client_secret'],
            scopes=token_data['scopes']
        )
    except Exception as e:
        print(f"Error creating credentials: {e}")
        return None

def save_tokens_to_file(token_data, filename="token.json"):
    """Save token data to a JSON file"""
    try:
        with open(filename, 'w') as f:
            json.dump(token_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving tokens: {e}")
        return False

def load_tokens_from_file(filename="token.json"):
    """Load token data from a JSON file"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading tokens: {e}")
    return None

def send_email_with_oauth(credentials, to_email, subject, body, cc_list=None):
    """Send email using Gmail API with OAuth credentials"""
    try:
        from googleapiclient.discovery import build
        from email.mime.text import MIMEText
        import base64
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)
        
        # Create message
        message = MIMEText(body, 'html')
        message['to'] = to_email
        message['subject'] = subject
        
        if cc_list:
            message['cc'] = ', '.join(cc_list)
        
        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        # Send message
        sent_message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
        return True, sent_message.get('id')
    except Exception as e:
        return False, str(e) 