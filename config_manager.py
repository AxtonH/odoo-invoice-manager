import json
import os
import base64
from datetime import datetime
from pathlib import Path

class ConfigManager:
    def __init__(self, config_file="automated_reports_config.json"):
        """Initialize configuration manager with JSON file storage"""
        # Create config directory if it doesn't exist
        self.config_dir = Path("config")
        self.config_dir.mkdir(exist_ok=True)
        
        # Set config file path
        self.config_file = self.config_dir / config_file
        self.config = self.load_config()
    
    def _encrypt_password(self, password):
        """Simple encryption for passwords (base64 encoding)"""
        if not password:
            return ""
        return base64.b64encode(password.encode('utf-8')).decode('utf-8')
    
    def _decrypt_password(self, encrypted_password):
        """Simple decryption for passwords (base64 decoding)"""
        if not encrypted_password:
            return ""
        try:
            return base64.b64decode(encrypted_password.encode('utf-8')).decode('utf-8')
        except:
            return ""
    
    def load_config(self):
        """Load configuration from JSON file or create default"""
        default_config = {
            "automated_reports": {
                "enabled": False,
                "recipient_email": "",
                "report_time": "09:00",
                "check_interval": "hourly",
                "email_template": "daily_summary",
                "last_sent": None,
                "odoo_connection": {
                    "url": "",
                    "database": "",
                    "username": "",
                    "password": ""
                },
                "email_settings": {
                    "smtp_server": "smtp.gmail.com",
                    "smtp_port": 587,
                    "sender_email": "",
                    "sender_password": ""
                }
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    # Don't decrypt passwords - assume they're already in plain text
                    print(f"✅ Loaded configuration from {self.config_file}")
                    return config
            except Exception as e:
                print(f"⚠️ Error loading config, using defaults: {str(e)}")
        
        # Create default config file
        self.save_config(default_config)
        print(f"✅ Created default configuration at {self.config_file}")
        return default_config
    
    def save_config(self, config=None):
        """Save configuration to JSON file with encrypted passwords"""
        if config is None:
            config = self.config
        
        # Create a copy for saving (to encrypt passwords)
        save_config = json.loads(json.dumps(config))
        
        if "automated_reports" in save_config:
            odoo_config = save_config["automated_reports"].get("odoo_connection", {})
            email_config = save_config["automated_reports"].get("email_settings", {})
            
            # Encrypt passwords before saving
            odoo_config["password"] = self._encrypt_password(odoo_config.get("password", ""))
            email_config["sender_password"] = self._encrypt_password(email_config.get("sender_password", ""))
        
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(save_config, f, indent=2, ensure_ascii=False)
            print(f"✅ Configuration saved to {self.config_file}")
            return True
        except Exception as e:
            print(f"❌ Error saving configuration: {str(e)}")
            return False
    
    def get(self, key, default=None):
        """Get a configuration value using dot notation (e.g., 'automated_reports.enabled')"""
        keys = key.split('.')
        value = self.config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key, value):
        """Set a configuration value using dot notation and save"""
        keys = key.split('.')
        config = self.config
        
        # Navigate to the parent of the target key
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        # Set the value
        config[keys[-1]] = value
        
        # Save the configuration
        return self.save_config()
    
    def update_automated_reports_config(self, updates):
        """Update multiple automated reports settings at once"""
        if "automated_reports" not in self.config:
            self.config["automated_reports"] = {}
        
        for key, value in updates.items():
            self.config["automated_reports"][key] = value
        
        # Save without encryption (direct save)
        try:
            # Create a copy for saving without encryption
            save_config = json.loads(json.dumps(self.config))
            
            # Ensure passwords are not encrypted by directly using the values from updates
            if "automated_reports" in save_config:
                odoo_config = save_config["automated_reports"].get("odoo_connection", {})
                email_config = save_config["automated_reports"].get("email_settings", {})
                
                # Use the original values from updates to avoid encryption
                if "odoo_connection" in updates:
                    odoo_config.update(updates["odoo_connection"])
                if "email_settings" in updates:
                    email_config.update(updates["email_settings"])
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(save_config, f, indent=2, ensure_ascii=False)
            print(f"✅ Configuration saved to {self.config_file}")
            return True
        except Exception as e:
            print(f"❌ Error saving configuration: {str(e)}")
            return False
    
    def is_time_to_send_report(self):
        """Check if it's time to send the daily report"""
        if not self.get("automated_reports.enabled", False):
            return False
        
        report_time = self.get("automated_reports.report_time", "09:00")
        current_time = datetime.now().strftime("%H:%M")
        
        # Check if current time matches report time
        if current_time == report_time:
            # Check if we already sent today
            last_sent = self.get("automated_reports.last_sent")
            today = datetime.now().strftime("%Y-%m-%d")
            
            if last_sent != today:
                return True
        
        return False
    
    def mark_report_sent(self):
        """Mark that the report was sent today"""
        today = datetime.now().strftime("%Y-%m-%d")
        return self.set("automated_reports.last_sent", today)
    
    def get_decrypted_config(self):
        """Get configuration with decrypted passwords for use in scripts"""
        # self.config already has decrypted passwords from load_config()
        return json.loads(json.dumps(self.config))

# Test the configuration manager
if __name__ == "__main__":
    config_manager = ConfigManager()
    
    # Test basic operations
    print("Testing configuration manager...")
    
    # Set some test values
    config_manager.set("automated_reports.enabled", True)
    config_manager.set("automated_reports.recipient_email", "test@company.com")
    config_manager.set("automated_reports.odoo_connection.password", "test_password")
    
    # Get values
    print(f"Enabled: {config_manager.get('automated_reports.enabled')}")
    print(f"Recipient: {config_manager.get('automated_reports.recipient_email')}")
    print(f"Password: {config_manager.get('automated_reports.odoo_connection.password')}")
    
    print("✅ Configuration manager test completed!") 