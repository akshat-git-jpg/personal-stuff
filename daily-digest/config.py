import os

# When running in GitHub Actions these come from secrets; locally the defaults apply
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8106481813:AAG2lVYx83sCnlsREZpNfS_88ShyyqPlUo0")
TELEGRAM_CHAT_ID   = int(os.environ.get("TELEGRAM_CHAT_ID", "1912944391"))

TIMEZONE    = "Asia/Kolkata"
CALENDAR_ID = "primary"
