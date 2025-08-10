@echo off
REM Daily Report Script for Odoo Invoice Follow-Up Manager
REM This batch file is designed to be run by Windows Task Scheduler

REM Change to the application directory
cd /d "%~dp0.."

REM Run the daily report script
python scripts\daily_report_script.py

REM Pause to see any error messages (remove this line for production)
REM pause 