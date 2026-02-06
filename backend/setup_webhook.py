#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com') + '/webhook'

def main():
    if not TELEGRAM_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN not found in .env")
        return
    
    url = f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook'
    data = {'url': WEBHOOK_URL}
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print(f"✅ Webhook set to: {WEBHOOK_URL}")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    main()
