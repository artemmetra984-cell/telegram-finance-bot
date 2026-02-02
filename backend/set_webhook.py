import os
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')

if not TELEGRAM_TOKEN:
    print("ERROR: TELEGRAM_BOT_TOKEN not found in environment variables")
    exit(1)

if not WEBHOOK_URL:
    print("ERROR: WEBHOOK_URL not found in environment variables")
    exit(1)

# Устанавливаем вебхук
url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook"
data = {
    "url": f"{WEBHOOK_URL}/webhook",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": True
}

response = requests.post(url, json=data)

if response.status_code == 200:
    result = response.json()
    if result.get("ok"):
        print("✅ Webhook установлен успешно!")
        print(f"URL: {WEBHOOK_URL}/webhook")
        print(f"Description: {result.get('description', 'No description')}")
    else:
        print("❌ Ошибка установки webhook:")
        print(result)
else:
    print(f"❌ HTTP Error: {response.status_code}")
    print(response.text)