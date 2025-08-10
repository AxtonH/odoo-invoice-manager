# Windows Task Scheduler Setup Guide

This guide will help you set up Windows Task Scheduler to automatically run the daily report script.

## Prerequisites

1. **Application Setup**: Make sure the Odoo Invoice Follow-Up Manager is properly configured
2. **Automated Reports Configuration**: Configure the automated reports settings in the Settings page
3. **Python**: Ensure Python is installed and accessible from command line

## Step 1: Open Task Scheduler

1. Press `Windows + R` to open Run dialog
2. Type `taskschd.msc` and press Enter
3. Task Scheduler will open

## Step 2: Create Basic Task

1. In the right panel, click **"Create Basic Task..."**
2. Enter a name: `Odoo Daily Report`
3. Enter a description: `Automated daily invoice follow-up report`
4. Click **Next**

## Step 3: Set Trigger

1. Select **"Daily"**
2. Click **Next**
3. Set the start time to **00:00:00** (midnight)
4. Click **Next**

## Step 4: Set Action

1. Select **"Start a program"**
2. Click **Next**
3. Program/script: `C:\Windows\System32\cmd.exe`
4. Add arguments: `/c "cd /d "C:\Users\Geeks\Desktop\CCD - V2" && python scripts\daily_report_script.py"`
5. Start in: `C:\Users\Geeks\Desktop\CCD - V2`
6. Click **Next**

## Step 5: Finish Setup

1. Review the settings
2. Check **"Open the Properties dialog for this task when I click Finish"**
3. Click **Finish**

## Step 6: Advanced Settings

In the Properties dialog:

1. **General Tab**:
   - Check **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**

2. **Triggers Tab**:
   - Click **Edit** on the existing trigger
   - Check **"Repeat task every"**
   - Set to **1 hour**
   - Set **"for a duration of"** to **24 hours**
   - Click **OK**

3. **Settings Tab**:
   - Uncheck **"Stop the task if it runs longer than"**
   - Check **"If the task fails, restart every"** and set to **1 minute**
   - Set **"Attempt to restart up to"** to **3 times**

4. Click **OK** to save

## Step 7: Test the Setup

1. **Manual Test**: Right-click the task and select **"Run"**
2. **Check Logs**: 
   - Right-click the task and select **"Properties"**
   - Go to **"History"** tab to see execution results
3. **Check Application Logs**: Look for output in the console or check the script logs

## How It Works

1. **Task Scheduler** runs the script every hour
2. **Script checks** if it's time to send a report (based on your configured time)
3. **If it's time**: Script connects to Odoo, generates report, and sends email
4. **If not time**: Script exits without doing anything
5. **Configuration** is controlled from the Settings page in the application

## Troubleshooting

### Script Not Running
- Check if Python is in PATH: Open cmd and type `python --version`
- Verify the script path is correct
- Check Task Scheduler History for errors

### Connection Issues
- Ensure Odoo credentials are correct in the Settings page
- Check if Odoo server is accessible
- Verify email settings are configured

### Email Not Sending
- Check SMTP settings in the Settings page
- Verify sender email and password
- Test email configuration using the "Test Report" button

### Permission Issues
- Run Task Scheduler as Administrator
- Ensure the task is set to "Run whether user is logged on or not"
- Check Windows Event Viewer for permission errors

## Configuration Changes

To change the report time or other settings:

1. **Open the application**
2. **Go to Settings page**
3. **Configure Automated Reports section**
4. **Save the configuration**
5. **The script will automatically use the new settings**

No need to modify Task Scheduler - the script reads the configuration file each time it runs.

## Security Notes

- Passwords are encrypted in the configuration file
- The script runs with the same permissions as the Task Scheduler service
- Consider using a dedicated service account for production use
- Regularly review and update credentials

## Support

If you encounter issues:

1. Check the Task Scheduler History
2. Review the script logs in the console
3. Test the configuration using the "Test Report" button in the Settings page
4. Verify all prerequisites are met 