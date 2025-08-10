#!/usr/bin/env python3
"""
Daily Report Script for Odoo Invoice Follow-Up Manager
This script is designed to be run by Windows Task Scheduler.

It will:
1. Check if automated reports are enabled
2. Check if it's time to send a report
3. Connect to Odoo and generate the report
4. Send the report via email with PDF attachment
5. Log the results
"""

import sys
import os
import csv
import io
from datetime import datetime, timedelta
from pathlib import Path

# Add the parent directory to the path so we can import our modules
sys.path.append(str(Path(__file__).parent.parent))

from config_manager import ConfigManager
from core import OdooConnector

def log_message(message, level="INFO"):
    """Log a message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def generate_pdf_report(invoices, top_clients=None, severe_clients=None, moderate_clients=None):
    """Generate a comprehensive PDF report identical to the download button"""
    try:
        # Import jsPDF equivalent for Python (we'll use reportlab but match the exact layout)
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        
        # Create PDF buffer
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)
        
        # Get styles
        styles = getSampleStyleSheet()
        
        # Create custom styles matching the download button exactly
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=15,
            alignment=TA_CENTER,
            textColor=colors.Color(44/255, 62/255, 80/255)  # Dark blue-gray
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=15,
            textColor=colors.Color(44/255, 62/255, 80/255)  # Dark blue-gray
        )
        
        normal_style = ParagraphStyle(
            'Normal',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.Color(52/255, 73/255, 94/255)  # Dark gray
        )
        
        date_style = ParagraphStyle(
            'Date',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            textColor=colors.Color(128/255, 128/255, 128/255)  # Gray
        )
        
        # Build the story (content)
        story = []
        
        # Title - exactly like download button
        story.append(Paragraph("OVERDUE INVOICES REPORT", title_style))
        story.append(Spacer(1, 15))
        
        # Date - exactly like download button
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", date_style))
        story.append(Spacer(1, 25))
        
        # Summary Section - exactly like download button
        story.append(Paragraph("SUMMARY", heading_style))
        story.append(Spacer(1, 15))
        
        # Calculate report data exactly like download button
        total_invoices = len(invoices)
        total_amount = sum(inv['amount_due'] for inv in invoices)
        
        # Use passed parameters or calculate if not provided
        if severe_clients is None or moderate_clients is None:
            # Group invoices by client exactly like download button
            client_invoices = {}
            for invoice in invoices:
                client_name = invoice['client_name']
                if client_name not in client_invoices:
                    client_invoices[client_name] = []
                client_invoices[client_name].append(invoice)
            
            # Find severely overdue clients (>30 days) - exactly like download button
            severe_clients = []
            moderate_clients = []
            
            for client_name, client_inv_list in client_invoices.items():
                max_days = max(inv['days_overdue'] for inv in client_inv_list)
                total_amount_client = sum(inv['amount_due'] for inv in client_inv_list)
                invoice_count = len(client_inv_list)
                
                client_summary = {
                    'clientName': client_name,
                    'totalAmount': total_amount_client,
                    'invoiceCount': invoice_count,
                    'maxDays': max_days
                }
                
                if max_days > 30:
                    severe_clients.append(client_summary)
                elif max_days > 15 and max_days <= 30:
                    moderate_clients.append(client_summary)
            
            # Sort by amount descending exactly like download button
            severe_clients.sort(key=lambda x: x['totalAmount'], reverse=True)
            moderate_clients.sort(key=lambda x: x['totalAmount'], reverse=True)
        
        # Summary box - exactly like download button
        summary_data = [
            ['Total Overdue Invoices:', str(total_invoices)],
            ['Total Overdue Amount:', f"${total_amount:,.2f}"],
            ['Moderately Overdue Clients (16-30 days):', str(len(moderate_clients))],
            ['Severely Overdue Clients (>30 days):', str(len(severe_clients))],
            ['Top Priority Clients Identified:', str(len(top_clients) if top_clients else 0)]
        ]
        
        summary_table = Table(summary_data, colWidths=[3.5*inch, 1.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.Color(236/255, 240/255, 241/255)),  # Light gray background
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.Color(52/255, 73/255, 94/255)),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.Color(200/255, 200/255, 200/255)),
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 70))
        
        # Top 3 Clients to Follow Up On Section
        if top_clients:
            story.append(Paragraph("TOP 3 CLIENTS TO FOLLOW UP ON", heading_style))
            story.append(Spacer(1, 15))
            
            # Table header for top clients
            top_header_data = [['Client Name', 'Total Amount', 'Max Days Overdue', 'Avg Days Overdue', 'Invoice Count']]
            top_header_table = Table(top_header_data, colWidths=[2.5*inch, 1.5*inch, 1.2*inch, 1.2*inch, 1*inch])
            top_header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(52/255, 73/255, 94/255)),  # Dark blue header
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(top_header_table)
            story.append(Spacer(1, 12))
            
            # Table rows for top clients
            for index, client in enumerate(top_clients):
                # Alternate row colors
                if index % 2 == 0:
                    row_color = colors.Color(248/255, 249/255, 250/255)  # Light gray
                else:
                    row_color = colors.white
                
                row_data = [[
                    client['client_name'][:25] + '...' if len(client['client_name']) > 25 else client['client_name'],
                    f"${client['total_amount']:,.2f}",
                    str(client['max_days_overdue']),
                    str(client['avg_days_overdue']),
                    str(client['invoice_count'])
                ]]
                
                row_table = Table(row_data, colWidths=[2.5*inch, 1.5*inch, 1.2*inch, 1.2*inch, 1*inch])
                row_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), row_color),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.Color(52/255, 73/255, 94/255)),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(row_table)
                story.append(Spacer(1, 12))
        else:
            story.append(Paragraph("No clients identified for follow-up.", normal_style))
            story.append(Spacer(1, 20))
        
        story.append(Spacer(1, 30))
        
        # Severely Overdue Clients Section - exactly like download button
        log_message(f"Debug: severe_clients count = {len(severe_clients) if severe_clients else 0}")
        if severe_clients:
            log_message(f"Debug: First 3 severe clients: {severe_clients[:3]}")
            log_message(f"Debug: severe_clients type: {type(severe_clients)}")
            log_message(f"Debug: severe_clients is empty: {len(severe_clients) == 0}")
            story.append(Paragraph("SEVERELY OVERDUE CLIENTS", heading_style))
            story.append(Spacer(1, 15))
            
            # Table header - exactly like download button
            header_data = [['Client Name', 'Amount', 'Invoices', 'Days Overdue']]
            header_table = Table(header_data, colWidths=[2.5*inch, 1.5*inch, 1*inch, 1*inch])
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(52/255, 73/255, 94/255)),  # Dark blue header
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(header_table)
            story.append(Spacer(1, 12))
            
            # Table rows - exactly like download button
            for index, client in enumerate(severe_clients):
                # Alternate row colors
                if index % 2 == 0:
                    row_color = colors.Color(248/255, 249/255, 250/255)  # Light gray
                else:
                    row_color = colors.white
                
                row_data = [[
                    client['clientName'][:25] + '...' if len(client['clientName']) > 25 else client['clientName'],
                    f"${client['totalAmount']:,.2f}",
                    str(client['invoiceCount']),
                    str(client['maxDays'])
                ]]
                
                row_table = Table(row_data, colWidths=[2.5*inch, 1.5*inch, 1*inch, 1*inch])
                row_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), row_color),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.Color(52/255, 73/255, 94/255)),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(row_table)
                story.append(Spacer(1, 12))
        else:
            story.append(Paragraph("No severely overdue clients found.", normal_style))
            story.append(Spacer(1, 20))
        
        # Footer - exactly like download button
        story.append(Spacer(1, 20))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.Color(128/255, 128/255, 128/255)  # Gray
        )
        story.append(Paragraph("This report was generated automatically by the Odoo Invoice Follow-Up Manager.", footer_style))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF content
        pdf_content = buffer.getvalue()
        buffer.close()
        
        log_message(f"PDF report generated successfully ({len(pdf_content)} bytes)")
        return pdf_content
        
    except ImportError:
        log_message("ReportLab not available, falling back to CSV only", "WARNING")
        return None
    except Exception as e:
        log_message(f"Error generating PDF report: {str(e)}", "ERROR")
        return None

def calculate_top_clients_to_follow_up(client_invoices):
    """Calculate top 3 clients to follow up on based on overdue duration and invoice amounts"""
    client_scores = []
    
    for client_name, client_inv_list in client_invoices.items():
        # Calculate metrics for this client
        total_amount = sum(inv['amount_due'] for inv in client_inv_list)
        max_days_overdue = max(inv['days_overdue'] for inv in client_inv_list)
        avg_days_overdue = sum(inv['days_overdue'] for inv in client_inv_list) / len(client_inv_list)
        invoice_count = len(client_inv_list)
        
        # Calculate priority score (more weight to overdue duration)
        # Formula: (max_days_overdue * 0.6) + (avg_days_overdue * 0.3) + (total_amount / 1000 * 0.1)
        # This gives 60% weight to longest overdue, 30% to average overdue, 10% to amount
        priority_score = (max_days_overdue * 0.6) + (avg_days_overdue * 0.3) + (total_amount / 1000 * 0.1)
        
        client_scores.append({
            'client_name': client_name,
            'total_amount': total_amount,
            'max_days_overdue': max_days_overdue,
            'avg_days_overdue': round(avg_days_overdue, 1),
            'invoice_count': invoice_count,
            'priority_score': priority_score
        })
    
    # Sort by priority score (highest first) and return top 3
    client_scores.sort(key=lambda x: x['priority_score'], reverse=True)
    return client_scores[:3]

def generate_daily_report(connector):
    """Generate the same report as the Settings page download button"""
    try:
        log_message("Generating daily report...")
        
        # Get overdue invoices (same logic as Settings page)
        invoices = connector.get_overdue_invoices()
        
        if not invoices:
            log_message("No overdue invoices found", "WARNING")
            return None
        
        # Group invoices by client
        client_invoices = {}
        for invoice in invoices:
            client_name = invoice['client_name']
            if client_name not in client_invoices:
                client_invoices[client_name] = []
            client_invoices[client_name].append(invoice)
        
        # Calculate top clients to follow up on
        top_clients = calculate_top_clients_to_follow_up(client_invoices)
        
        # Calculate severe and moderate clients for PDF report
        severe_clients = []
        moderate_clients = []
        
        for client_name, client_inv_list in client_invoices.items():
            max_days = max(inv['days_overdue'] for inv in client_inv_list)
            total_amount_client = sum(inv['amount_due'] for inv in client_inv_list)
            invoice_count = len(client_inv_list)
            
            client_summary = {
                'clientName': client_name,
                'totalAmount': total_amount_client,
                'invoiceCount': invoice_count,
                'maxDays': max_days
            }
            
            if max_days > 30:
                severe_clients.append(client_summary)
            elif max_days > 15 and max_days <= 30:
                moderate_clients.append(client_summary)
        
        # Sort by amount descending
        severe_clients.sort(key=lambda x: x['totalAmount'], reverse=True)
        moderate_clients.sort(key=lambda x: x['totalAmount'], reverse=True)
        
        log_message(f"Debug: Calculated {len(severe_clients)} severe clients and {len(moderate_clients)} moderate clients")
        log_message(f"Debug: First 3 severe clients in generate_daily_report: {severe_clients[:3] if severe_clients else 'None'}")
        
        # Calculate summary statistics
        total_invoices = len(invoices)
        total_amount = sum(inv['amount_due'] for inv in invoices)
        total_clients = len(client_invoices)
        
        # Create CSV report
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        
        # Write header
        csv_writer.writerow([
            'Client Name', 'Invoice Number', 'Invoice Date', 'Due Date', 
            'Origin', 'Amount Due', 'Currency', 'Days Overdue', 'Company'
        ])
        
        # Write data rows
        for client_name, client_inv_list in client_invoices.items():
            for invoice in client_inv_list:
                csv_writer.writerow([
                    invoice['client_name'],
                    invoice['invoice_number'],
                    invoice['invoice_date'],
                    invoice['due_date'],
                    invoice.get('origin', ''),
                    invoice['amount_due'],
                    invoice['currency_symbol'],
                    invoice['days_overdue'],
                    invoice['company_name']
                ])
        
        # Add top clients to follow up on section
        csv_writer.writerow([])  # Empty row for separation
        csv_writer.writerow(['TOP 3 CLIENTS TO FOLLOW UP ON'])
        csv_writer.writerow(['Client Name', 'Total Amount', 'Max Days Overdue', 'Average Days Overdue', 'Invoice Count', 'Priority Score'])
        
        for client in top_clients:
            csv_writer.writerow([
                client['client_name'],
                client['total_amount'],
                client['max_days_overdue'],
                client['avg_days_overdue'],
                client['invoice_count'],
                round(client['priority_score'], 2)
            ])
        
        csv_content = csv_buffer.getvalue()
        csv_buffer.close()
        
        # Generate PDF report
        pdf_content = generate_pdf_report(invoices, top_clients, severe_clients, moderate_clients)
        
        # Create summary
        summary = {
            'total_invoices': total_invoices,
            'total_amount': total_amount,
            'total_clients': total_clients,
            'top_clients_to_follow_up': top_clients,
            'report_date': datetime.now().strftime("%Y-%m-%d"),
            'csv_content': csv_content,
            'pdf_content': pdf_content
        }
        
        log_message(f"Report generated: {total_invoices} invoices, {total_clients} clients, ${total_amount:,.2f} total")
        return summary
        
    except Exception as e:
        log_message(f"Error generating report: {str(e)}", "ERROR")
        return None

def send_daily_report_email(config, report_data):
    """Send the daily report via email with threading support"""
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders
        
        # Import the core send_email function for threading support
        from core import send_email, thread_manager
        
        # Get email settings
        email_config = config['automated_reports']['email_settings']
        recipient_email = config['automated_reports']['recipient_email']
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = email_config['sender_email']
        msg['To'] = recipient_email
        msg['Subject'] = f"Daily Invoice Follow-Up Report - {datetime.now().strftime('%Y-%m-%d')}"
        
        # Create email body
        body = f"""Dear Finance Team,

Please find attached the daily invoice follow-up report for {datetime.now().strftime('%Y-%m-%d')}.

Summary:
- Total Overdue Invoices: {report_data['total_invoices']}
- Total Outstanding Amount: ${report_data['total_amount']:,.2f}
- Clients with Overdue Invoices: {report_data['total_clients']}

Top 3 Clients to Follow Up On:
"""
        
        # Add top clients information to email body
        if report_data.get('top_clients_to_follow_up'):
            for i, client in enumerate(report_data['top_clients_to_follow_up'], 1):
                body += f"""
{i}. {client['client_name']}
   - Total Amount: ${client['total_amount']:,.2f}
   - Max Days Overdue: {client['max_days_overdue']} days
   - Average Days Overdue: {client['avg_days_overdue']} days
   - Invoice Count: {client['invoice_count']}
"""
        else:
            body += "No clients identified for follow-up at this time.\n"
        
        body += f"""

The detailed report is attached as a CSV file.

Best regards,
Invoice Follow-Up System
"""
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Attach CSV file
        csv_attachment = MIMEBase('text', 'csv')
        csv_attachment.set_payload(report_data['csv_content'])
        encoders.encode_base64(csv_attachment)
        csv_attachment.add_header(
            'Content-Disposition', 
            f'attachment; filename="invoice_followup_report_{datetime.now().strftime("%Y%m%d")}.csv"'
        )
        msg.attach(csv_attachment)

        # Attach PDF file if available
        if report_data.get('pdf_content'):
            pdf_attachment = MIMEBase('application', 'pdf')
            pdf_attachment.set_payload(report_data['pdf_content'])
            encoders.encode_base64(pdf_attachment)
            pdf_attachment.add_header(
                'Content-Disposition',
                f'attachment; filename="invoice_followup_report_{datetime.now().strftime("%Y%m%d")}.pdf"'
            )
            msg.attach(pdf_attachment)
            log_message("PDF attachment added to email")
        else:
            log_message("No PDF content available, sending CSV only", "WARNING")
        
        # Prepare attachments for threading
        attachments = []
        
        # Add CSV attachment
        csv_attachment = {
            'data': report_data['csv_content'].encode('utf-8'),
            'filename': f"invoice_followup_report_{datetime.now().strftime('%Y%m%d')}.csv"
        }
        attachments.append(csv_attachment)
        
        # Add PDF attachment if available
        if report_data.get('pdf_content'):
            pdf_attachment = {
                'data': report_data['pdf_content'],
                'filename': f"invoice_followup_report_{datetime.now().strftime('%Y%m%d')}.pdf"
            }
            attachments.append(pdf_attachment)
        
        # Send email using threading support
        success = send_email(
            sender_email=email_config['sender_email'],
            sender_password=email_config['sender_password'],
            recipient_email=recipient_email,
            cc_list=[],
            subject=msg['Subject'],
            body=body,
            attachments=attachments,
            smtp_server=email_config['smtp_server'],
            smtp_port=email_config['smtp_port'],
            client_name="Finance Team",
            company_name="Daily Reports",
            enable_threading=True
        )
        
        if success:
            log_message(f"Email sent successfully to {recipient_email}")
            return True
        else:
            log_message(f"Failed to send email to {recipient_email}", "ERROR")
            return False
        
    except Exception as e:
        log_message(f"Error sending email: {str(e)}", "ERROR")
        return False

def main():
    """Main function - entry point for the script"""
    log_message("Starting daily report script...")
    
    try:
        # Load configuration
        config_manager = ConfigManager()
        config = config_manager.get_decrypted_config()
        
        # Check if automated reports are enabled
        if not config_manager.get("automated_reports.enabled", False):
            log_message("Automated reports are disabled", "INFO")
            return
        
        # Check if it's time to send a report
        if not config_manager.is_time_to_send_report():
            log_message("Not time to send report yet", "INFO")
            return
        
        log_message("Time to send daily report!")
        
        # Get Odoo connection details
        odoo_config = config['automated_reports']['odoo_connection']
        
        if not all([odoo_config['url'], odoo_config['database'], 
                   odoo_config['username'], odoo_config['password']]):
            log_message("Odoo connection details not configured", "ERROR")
            return
        
        # Connect to Odoo
        connector = OdooConnector(
            odoo_config['url'],
            odoo_config['database'],
            odoo_config['username'],
            odoo_config['password']
        )
        
        if not connector.connect():
            log_message("Failed to connect to Odoo", "ERROR")
            return
        
        log_message("Connected to Odoo successfully")
        
        # Generate report
        report_data = generate_daily_report(connector)
        
        if not report_data:
            log_message("No report data to send", "WARNING")
            return
        
        # Send email
        if send_daily_report_email(config, report_data):
            # Mark report as sent
            config_manager.mark_report_sent()
            log_message("Daily report completed successfully", "SUCCESS")
        else:
            log_message("Failed to send daily report", "ERROR")
        
    except Exception as e:
        log_message(f"Unexpected error in main function: {str(e)}", "ERROR")

if __name__ == "__main__":
    main() 