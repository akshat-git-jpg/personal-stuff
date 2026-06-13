"""
Run this after sending any message to @KbDailyPlanner_bot.
It prints your Telegram chat ID — paste it into config.py.
"""
import requests
from config import TELEGRAM_BOT_TOKEN

resp = requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates")
data = resp.json()

if not data.get("ok"):
    print("Error:", data)
elif not data["result"]:
    print("No updates found. Send any message to @KbDailyPlanner_bot first, then run this again.")
else:
    for update in data["result"]:
        msg = update.get("message") or update.get("channel_post")
        if msg:
            chat = msg["chat"]
            print(f"Chat ID : {chat['id']}")
            print(f"Type    : {chat['type']}")
            print(f"Name    : {chat.get('first_name', '')} {chat.get('last_name', '')}".strip())
            print()
            print(f"Paste this into config.py → TELEGRAM_CHAT_ID = {chat['id']}")
            break
