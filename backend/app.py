# backend/app.py
import os
import sys
import random
import string
import hmac
import hashlib
import json
import base64
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import uuid
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, 'frontend', 'static')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'frontend', 'templates')

app = Flask(__name__,
           static_folder=STATIC_DIR,
           template_folder=TEMPLATE_DIR)
CORS(app)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-123')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com')
NOWPAYMENTS_API_KEY = os.getenv('NOWPAYMENTS_API_KEY', '')
NOWPAYMENTS_IPN_SECRET = os.getenv('NOWPAYMENTS_IPN_SECRET', '')
CRYPTOCLOUD_API_KEY = os.getenv('CRYPTOCLOUD_API_KEY', '')
CRYPTOCLOUD_SHOP_ID = os.getenv('CRYPTOCLOUD_SHOP_ID', '')
CRYPTOCLOUD_POSTBACK_SECRET = os.getenv('CRYPTOCLOUD_POSTBACK_SECRET', '')
LECRYPTIO_API_KEY = os.getenv('LECRYPTIO_API_KEY', '')
LECRYPTIO_SIGNING_SECRET = os.getenv('LECRYPTIO_SIGNING_SECRET', '')
LECRYPTIO_WEBHOOK_SECRET = os.getenv('LECRYPTIO_WEBHOOK_SECRET', '')
CRYPTOPAY_API_TOKEN = os.getenv('CRYPTOPAY_API_TOKEN', '')
CRYPTOPAY_WEBHOOK_SECRET = os.getenv('CRYPTOPAY_WEBHOOK_SECRET', '')
DEFAULT_SUBSCRIPTION_MONTHS = int(os.getenv('SUBSCRIPTION_DEFAULT_MONTHS', '1'))
SAVINGS_WALLET_NAME = 'Накопления'

def parse_promo_codes(raw_value):
    if not raw_value:
        return []
    parts = []
    for chunk in raw_value.replace('\n', ',').split(','):
        token = chunk.strip()
        if not token:
            continue
        parts.append(token.upper())
    return parts

PROMO_CODE_MAP = {}
for code in parse_promo_codes(os.getenv('PROMO_CODES_1M', '')):
    PROMO_CODE_MAP[code] = 1
for code in parse_promo_codes(os.getenv('PROMO_CODES_3M', '')):
    PROMO_CODE_MAP[code] = 3
for code in parse_promo_codes(os.getenv('PROMO_CODES_6M', '')):
    PROMO_CODE_MAP[code] = 6
for code in parse_promo_codes(os.getenv('PROMO_CODES_12M', '')):
    PROMO_CODE_MAP[code] = 12

PROMO_MULTI_CODE_MAP = {}
for code in parse_promo_codes(os.getenv('PROMO_CODES_1M_MULTI_100', '')):
    PROMO_MULTI_CODE_MAP[code] = 1

PROMO_MULTI_LIMITS = {
    1: int(os.getenv('PROMO_CODES_1M_MULTI_LIMIT', '100'))
}

print(f"🚀 Starting Flask app (iOS 26 Version)")

CACHE_DIR = os.getenv('MARKET_CACHE_DIR')
if not CACHE_DIR:
    CACHE_DIR = '/data' if os.path.isdir('/data') else '/tmp'
PERSIST_CACHE_PATH = os.path.join(CACHE_DIR, 'market_cache.json')
PERSIST_KEYS = {'movers_stocks_all', 'movers_crypto_all'}

MARKET_CACHE = {}
MARKET_CACHE_TTL = int(os.getenv('MARKET_CACHE_TTL', '900'))  # seconds

def generate_invite_code(length=7):
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choice(alphabet) for _ in range(length))

def sort_payload(value):
    if isinstance(value, dict):
        return {k: sort_payload(value[k]) for k in sorted(value.keys())}
    if isinstance(value, list):
        return [sort_payload(v) for v in value]
    return value

def base64url_decode(value):
    if isinstance(value, str):
        value = value.encode()
    padding = b'=' * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)

def decode_cryptocloud_token(token, secret):
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode()
        signature = base64url_decode(sig_b64)
        expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(base64url_decode(payload_b64))
        return payload
    except Exception:
        return None

def is_cryptocloud_paid(status):
    return status in ('paid', 'overpaid', 'success')

def normalize_cryptocloud_currency(value):
    if isinstance(value, dict):
        return value.get('fullcode') or value.get('code') or value.get('name') or ''
    return value or ''

def normalize_lecryptio_invoice(payload):
    invoice = payload.get('invoice') if isinstance(payload, dict) else None
    if not invoice:
        invoice = payload.get('data') if isinstance(payload, dict) else None
    if not invoice:
        invoice = payload if isinstance(payload, dict) else {}
    return invoice

def is_lecryptio_paid(status):
    return status in ('paid', 'success')

def lecryptio_matches_subscription(amount, currency, network):
    amt_val = amount
    if isinstance(amount, dict):
        amt_val = amount.get('fiat') or amount.get('crypto') or amount.get('amount')
        if amt_val is None:
            amt_val = amount.get('fiat_amount') or amount.get('crypto_amount')
    try:
        amt = float(amt_val) if amt_val is not None else None
    except Exception:
        amt = None
    cur = (currency or '').upper()
    net = (network or '').upper()
    net = ''.join(ch for ch in net if ch.isalnum())
    if amt is None:
        return False
    return abs(amt - 2.0) < 0.0001 and cur == 'USDT' and net == 'TRC20'

def lecryptio_signed_headers(body_str):
    if not LECRYPTIO_API_KEY or not LECRYPTIO_SIGNING_SECRET:
        return None
    timestamp = str(int(datetime.utcnow().timestamp()))
    signing_string = f"{timestamp}.{body_str}"
    signature = hmac.new(LECRYPTIO_SIGNING_SECRET.encode(), signing_string.encode(), hashlib.sha256).hexdigest()
    return {
        'Authorization': f'Bearer {LECRYPTIO_API_KEY}',
        'X-LC-Timestamp': timestamp,
        'X-LC-Signature': f'v1={signature}'
    }

def verify_lecryptio_webhook(raw_body, timestamp_header, signature_header, secret):
    if not raw_body or not timestamp_header or not signature_header or not secret:
        return False
    try:
        parts = {}
        for piece in signature_header.split(','):
            piece = piece.strip()
            if not piece:
                continue
            key, value = (piece.split('=', 1) + [None])[:2]
            parts[(key or '').strip()] = (value or '').strip()
        timestamp_sig = parts.get('t')
        signature = parts.get('v1')
        if not signature:
            return False
        if timestamp_sig and timestamp_sig != timestamp_header:
            return False
        signing_string = f"{timestamp_header}.{raw_body}"
        expected = hmac.new(secret.encode(), signing_string.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    except Exception:
        return False

def cryptopay_signature(body_str, token):
    secret = hashlib.sha256(token.encode()).digest()
    return hmac.new(secret, body_str.encode(), hashlib.sha256).hexdigest()

def verify_cryptopay_webhook(raw_body, signature_header, token):
    if not raw_body or not signature_header or not token:
        return False
    expected = cryptopay_signature(raw_body, token)
    return hmac.compare_digest(signature_header, expected)

def is_cryptopay_paid(status):
    return status in ('paid',)

SUBSCRIPTION_PRICE_MAP = {
    1: 2.0,
    3: 5.6,
    6: 10.5,
    12: 21.5
}

def get_subscription_price(months):
    try:
        months = int(months)
    except Exception:
        months = 1
    if months not in SUBSCRIPTION_PRICE_MAP:
        months = 1
    return SUBSCRIPTION_PRICE_MAP[months]

def parse_months_from_order(order_id):
    try:
        if not order_id:
            return None
        parts = order_id.split('_')
        if len(parts) < 4:
            return None
        return int(parts[2])
    except Exception:
        return None

def cryptopay_resolve_months(amount, asset, payload_ref=None):
    months = parse_months_from_order(payload_ref)
    if months in SUBSCRIPTION_PRICE_MAP:
        return months
    try:
        amt = float(amount)
    except Exception:
        return None
    asset = (asset or '').upper()
    if asset != 'USDT':
        return None
    for period, price in SUBSCRIPTION_PRICE_MAP.items():
        if abs(amt - price) < 0.0001:
            return period
    return None

def create_cryptopay_invoice_for_user(user_id, asset='USDT', months=1):
    if not CRYPTOPAY_API_TOKEN:
        return None, 'CRYPTOPAY_API_TOKEN is not set'
    asset = 'USDT'
    try:
        months = int(months)
    except Exception:
        months = 1
    if months not in SUBSCRIPTION_PRICE_MAP:
        months = 1
    amount_value = get_subscription_price(months)
    amount_str = f"{amount_value:.2f}".rstrip('0').rstrip('.')
    order_id = f"sub_{user_id}_{months}_{int(datetime.utcnow().timestamp())}"
    payload = {
        'asset': asset,
        'amount': amount_str,
        'description': f'Subscription {months}m',
        'payload': order_id,
        'allow_comments': False,
        'allow_anonymous': False,
        'expires_in': 3600
    }
    body_str = json.dumps(payload, separators=(',', ':'), ensure_ascii=False)
    resp = requests.post(
        'https://pay.crypt.bot/api/createInvoice',
        headers={'Crypto-Pay-API-Token': CRYPTOPAY_API_TOKEN, 'Content-Type': 'application/json'},
        data=body_str,
        timeout=15
    )
    if resp.status_code >= 400:
        return None, f'CryptoPay error: {resp.text}'
    body = resp.json() or {}
    if not body.get('ok'):
        return None, body.get('error') or 'CryptoPay create failed'
    invoice = body.get('result') or {}
    invoice_id = invoice.get('invoice_id')
    if not invoice_id:
        return None, 'CryptoPay invalid response'
    status = invoice.get('status') or 'active'
    amount = invoice.get('amount') or payload['amount']
    asset = invoice.get('asset') or asset
    bot_url = invoice.get('bot_invoice_url') or invoice.get('pay_url') or ''
    mini_url = invoice.get('mini_app_invoice_url') or ''
    web_url = invoice.get('web_app_invoice_url') or ''
    db.create_cryptopay_invoice(user_id, int(invoice_id), status, asset, amount, order_id, bot_url, mini_url, web_url)
    return {
        'invoice_id': int(invoice_id),
        'status': status,
        'asset': asset,
        'amount': amount,
        'bot_invoice_url': bot_url,
        'mini_app_invoice_url': mini_url,
        'web_app_invoice_url': web_url,
        'payload': order_id,
        'months': months
    }, None

def resolve_cryptopay_invoice_id(uuid_value, order_id):
    invoice_id = None
    if uuid_value and str(uuid_value).isdigit():
        invoice_id = int(uuid_value)
    if not invoice_id and order_id:
        found = db.get_cryptopay_invoice_by_payload(order_id)
        if found:
            invoice_id = int(found['invoice_id'])
    return invoice_id

def refresh_cryptopay_invoice(invoice_id):
    invoice = db.get_cryptopay_invoice(invoice_id)
    status = invoice['status'] if invoice else 'active'
    if CRYPTOPAY_API_TOKEN:
        resp = requests.post(
            'https://pay.crypt.bot/api/getInvoices',
            headers={'Crypto-Pay-API-Token': CRYPTOPAY_API_TOKEN, 'Content-Type': 'application/json'},
            json={'invoice_ids': str(invoice_id)},
            timeout=15
        )
        if resp.status_code < 400:
            body = resp.json() or {}
            if body.get('ok'):
                result = body.get('result') or {}
                items = result.get('items') if isinstance(result, dict) else result
                if isinstance(items, list) and items:
                    remote = items[0]
                    status = remote.get('status') or status
                    amount = remote.get('amount') or (invoice['amount'] if invoice else None)
                    asset = remote.get('asset') or (invoice['asset'] if invoice else '')
                    bot_url = remote.get('bot_invoice_url') or (invoice['bot_invoice_url'] if invoice else '')
                    mini_url = remote.get('mini_app_invoice_url') or (invoice['mini_app_invoice_url'] if invoice else '')
                    web_url = remote.get('web_app_invoice_url') or (invoice['web_app_invoice_url'] if invoice else '')
                    payload_ref = remote.get('payload') or (invoice['payload'] if invoice else '')
                    user_ref = invoice['user_id'] if invoice else parse_user_from_order(payload_ref)
                    if user_ref:
                        db.create_cryptopay_invoice(user_ref, invoice_id, status, asset, amount, payload_ref, bot_url, mini_url, web_url)
                        invoice = db.get_cryptopay_invoice(invoice_id)
    return invoice, status

def parse_user_from_order(order_id):
    try:
        if not order_id:
            return None
        parts = order_id.split('_')
        if len(parts) < 3:
            return None
        return int(parts[1])
    except Exception:
        return None

def _load_persisted_entry(key):
    if key not in PERSIST_KEYS:
        return None
    try:
        if not os.path.exists(PERSIST_CACHE_PATH):
            return None
        with open(PERSIST_CACHE_PATH, 'r', encoding='utf-8') as f:
            payload = json.load(f)
        entry = payload.get(key)
        if not entry or 'data' not in entry:
            return None
        ts_raw = entry.get('ts')
        ts = datetime.utcnow()
        if isinstance(ts_raw, str):
            try:
                ts = datetime.fromisoformat(ts_raw)
            except Exception:
                ts = datetime.utcnow()
        return {'ts': ts, 'data': entry['data']}
    except Exception:
        return None

def _persist_entry(key, data):
    if key not in PERSIST_KEYS:
        return
    try:
        payload = {}
        if os.path.exists(PERSIST_CACHE_PATH):
            with open(PERSIST_CACHE_PATH, 'r', encoding='utf-8') as f:
                payload = json.load(f)
        payload[key] = {'ts': datetime.utcnow().isoformat(), 'data': data}
        with open(PERSIST_CACHE_PATH, 'w', encoding='utf-8') as f:
            json.dump(payload, f)
    except Exception:
        return

def cache_get(key, allow_stale=False):
    entry = MARKET_CACHE.get(key)
    if not entry:
        entry = _load_persisted_entry(key)
        if entry:
            MARKET_CACHE[key] = entry
    if not entry:
        return None
    if (datetime.utcnow() - entry['ts']).total_seconds() > MARKET_CACHE_TTL and not allow_stale:
        return None
    return entry['data']

def cache_set(key, data):
    MARKET_CACHE[key] = {'ts': datetime.utcnow(), 'data': data}
    _persist_entry(key, data)

@app.after_request
def add_cache_headers(response):
    try:
        path = request.path or ''
        if path == '/' or path.endswith('.html') or path.endswith('.js') or path.endswith('.css') or path.endswith('.json'):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
    except Exception:
        pass
    return response

def fetch_yahoo_movers(move_type):
    try:
        scr_id = 'day_gainers' if move_type == 'gainers' else 'day_losers'
        resp = requests.get(
            'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved',
            params={'formatted': 'false', 'scrIds': scr_id, 'count': 8},
            headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
            timeout=10
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = data.get('finance', {}).get('result', [])
        if not results:
            return []
        quotes = results[0].get('quotes', [])
        items = []
        for quote in quotes[:8]:
            symbol = quote.get('symbol', '')
            change = quote.get('regularMarketChangePercent')
            price = quote.get('regularMarketPrice')
            name = quote.get('shortName') or symbol
            safe_symbol = ''.join(ch for ch in symbol if ch.isalnum()).upper()
            logo_primary = f"https://storage.googleapis.com/iex/api/logos/{safe_symbol}.png" if safe_symbol else ''
            logo_alt = f"https://financialmodelingprep.com/image-stock/{safe_symbol}.png" if safe_symbol else ''
            try:
                change_val = float(change) if change is not None else 0.0
            except Exception:
                change_val = 0.0
            items.append({
                'id': symbol,
                'symbol': symbol,
                'name': name,
                'change': change_val,
                'price': price,
                'logo': logo_primary,
                'logo_alt': logo_alt
            })
        return items
    except Exception:
        return []

def fetch_yahoo_chart(symbol, range_key):
    try:
        range_map = {
            '1d': ('1d', '5m'),
            '1w': ('5d', '30m'),
            '1m': ('1mo', '1d'),
            'all': ('1y', '1d')
        }
        rng, interval = range_map.get(range_key, ('1mo', '1d'))
        resp = requests.get(
            f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}',
            params={
                'range': rng,
                'interval': interval,
                'includePrePost': 'false',
                'events': 'div,splits'
            },
            headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
            timeout=10
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        result = data.get('chart', {}).get('result', [])
        if not result:
            return []
        timestamps = result[0].get('timestamp') or []
        closes = result[0].get('indicators', {}).get('quote', [{}])[0].get('close') or []
        points = []
        for ts, close in zip(timestamps, closes):
            if close is None:
                continue
            points.append({'t': int(ts) * 1000, 'v': float(close)})
        return points
    except Exception:
        return []

def fetch_cryptocompare_chart(symbol, range_key):
    try:
        symbol = (symbol or '').upper()
        if not symbol:
            return []
        if range_key in ('1d', '1w'):
            limit = 24 if range_key == '1d' else 168
            resp = requests.get(
                'https://min-api.cryptocompare.com/data/v2/histohour',
                params={'fsym': symbol, 'tsym': 'USD', 'limit': limit},
                headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
                timeout=10
            )
        else:
            limit = 30 if range_key == '1m' else 365
            resp = requests.get(
                'https://min-api.cryptocompare.com/data/v2/histoday',
                params={'fsym': symbol, 'tsym': 'USD', 'limit': limit},
                headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
                timeout=10
            )
        if resp.status_code != 200:
            return []
        data = resp.json()
        points_raw = data.get('Data', {}).get('Data', [])
        points = []
        for item in points_raw:
            close = item.get('close')
            ts = item.get('time')
            if close is None or ts is None:
                continue
            points.append({'t': int(ts) * 1000, 'v': float(close)})
        return points
    except Exception:
        return []

try:
    from database import db
    print("✅ Database imported")
except ImportError as e:
    print(f"⚠️ Database error: {e}")
    db = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/sw.js')
def service_worker():
    return send_from_directory(STATIC_DIR, 'sw.js', mimetype='application/javascript')

@app.route('/webhook', methods=['POST'])
def telegram_webhook():
    try:
        data = request.get_json()
        
        if 'message' in data and 'text' in data['message']:
            message = data['message']
            text = message.get('text', '').strip()
            chat_id = message['chat']['id']
            
            if text == '/start' and TELEGRAM_TOKEN and WEBHOOK_URL:
                requests.post(
                    f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage',
                    json={
                        'chat_id': chat_id,
                        'text': '💰 Финансовый помощник iOS 26\n\nНажми кнопку:',
                        'reply_markup': {
                            'inline_keyboard': [[{
                                'text': '📱 Открыть',
                                'web_app': {'url': WEBHOOK_URL}
                            }]]
                        }
                    },
                    timeout=5
                )
        
        return 'ok'
    except Exception as e:
        print(f"Webhook error: {e}")
        return 'error', 500

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/init', methods=['POST'])
def init_user():
    try:
        data = request.json
        
        telegram_id = data.get('telegram_id')
        username = data.get('username', '')
        first_name = data.get('first_name', 'Пользователь')
        session_token = data.get('session_token')
        
        if not session_token:
            session_token = str(uuid.uuid4())
        
        if not telegram_id:
            if session_token and db:
                user = db.get_user_by_session(session_token)
                if user:
                    user_id = user['id']
                    currency = user['currency'] or 'RUB'
                    telegram_id = user['telegram_id']
                    default_wallet = user['default_wallet'] or 'Карта'
                else:
                    return jsonify({'error': 'User not found'}), 404
            else:
                return jsonify({'error': 'Telegram ID or session token required'}), 400
        else:
            if db:
                user_id, currency, default_wallet = db.get_or_create_user(telegram_id, username, first_name, session_token)
            else:
                user_id = telegram_id
                currency = 'RUB'
                default_wallet = 'Карта'
        
        if db:
            ensure_savings_wallet(user_id)
            stats = db.get_user_stats(user_id)
            default_wallet = db.get_effective_default_wallet(user_id)
            subscription_info = db.get_subscription_info(user_id)
            subscription_active = subscription_info['active']
            debts_enabled = db.get_debts_enabled(user_id)
            debts_data = db.get_debts(user_id)
            
            categories = {'income': [], 'expense': [], 'savings': []}
            all_categories = db.get_categories(user_id)
            for cat in all_categories:
                cat_type = cat['type']
                if cat_type in categories:
                    categories[cat_type].append({
                        'name': cat['name'],
                        'icon': cat['icon'],
                        'color': cat['color']
                    })
            
            wallets_data = []
            wallets = db.get_wallets(user_id)
            for wallet in wallets:
                wallets_data.append({
                    'name': wallet['name'],
                    'icon': wallet['icon'],
                    'balance': wallet['balance'],
                    'is_default': bool(wallet['is_default'])
                })
            
            goals_data = []
            goals = db.get_goals(user_id)
            for goal in goals:
                goals_data.append({
                    'id': goal['id'],
                    'name': goal['name'],
                    'target_amount': goal['target_amount'],
                    'current_amount': goal['current_amount'],
                    'icon': goal['icon'],
                    'color': goal['color'],
                    'deadline': goal['deadline'],
                    'progress': goal['progress'],
                    'archived': bool(goal['archived']) if 'archived' in goal.keys() else False
                })
            
            recent = db.get_recent_transactions(user_id, limit=10)
            recent_transactions = []
            for trans in recent:
                recent_transactions.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'wallet': trans['wallet'] or default_wallet,
                    'description': trans['description'] or '',
                    'debt_id': trans['debt_id'],
                    'date': trans['date']
                })
            
            total_transactions = db.get_transactions_count(user_id)
            
        else:
            user_id = telegram_id
            stats = {'summary': {'total_income': 0, 'total_expense': 0, 'balance': 0, 'total_savings': 0},
                    'income': {}, 'expense': {}, 'wallets': {}}
            categories = {
                'income': [{'name': 'Зарплата', 'icon': '💰', 'color': '#34C759'}],
                'expense': [{'name': 'Продукты', 'icon': '🛒', 'color': '#FF9500'}],
                'savings': []
            }
            wallets_data = [
                {'name': 'Карта', 'icon': '💳', 'balance': 0, 'is_default': True},
                {'name': 'Наличные', 'icon': '💵', 'balance': 0, 'is_default': False}
            ]
            goals_data = []
            recent_transactions = []
            total_transactions = 0
            currency = 'RUB'
            default_wallet = 'Карта'
            subscription_active = False
            subscription_info = {'activated_at': None, 'expires_at': None}
            debts_enabled = False
            debts_data = []
        
        return jsonify({
            'user_id': user_id,
            'telegram_id': telegram_id,
            'session_token': session_token,
            'summary': stats['summary'],
            'category_stats': {
                'income': stats['income'],
                'expense': stats['expense'],
                'wallets': stats['wallets']
            },
            'categories': categories,
            'wallets': wallets_data,
            'goals': goals_data,
            'debts': [{
                'id': d['id'],
                'name': d['name'],
                'target_amount': d['target_amount'],
                'paid_amount': d['paid_amount'],
                'note': d['note'] or '',
                'archived': bool(d['archived'])
            } for d in debts_data],
            'recent_transactions': recent_transactions,
            'total_transactions': total_transactions,
            'currency': currency,
            'default_wallet': default_wallet,
            'subscription_active': subscription_active,
            'subscription_start': subscription_info['activated_at'],
            'subscription_end': subscription_info['expires_at'],
            'debts_enabled': debts_enabled
        })
    except Exception as e:
        print(f"Init error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/debts', methods=['POST'])
def update_debts_setting():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        enabled = data.get('enabled')
        if user_id is None or enabled is None:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        db.set_debts_enabled(user_id, bool(enabled))
        return jsonify({'success': True, 'debts_enabled': bool(enabled)})
    except Exception as e:
        print(f"Debts setting error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debt', methods=['POST'])
def create_debt():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        name = (data.get('name') or '').strip()
        amount = data.get('amount')
        note = data.get('note') or ''
        if user_id is None or amount is None or not name:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        try:
            amount_value = float(amount)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid amount'}), 400
        if amount_value <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
        debt_id = db.create_debt(user_id, name, amount_value, note)
        db.set_debts_enabled(user_id, True)
        return jsonify({
            'success': True,
            'debts_enabled': True,
            'debt': {
                'id': debt_id,
                'name': name,
                'target_amount': amount_value,
                'paid_amount': 0,
                'note': note,
                'archived': False
            }
        })
    except Exception as e:
        print(f"Debt update error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debt/update', methods=['POST'])
def update_debt():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        debt_id = data.get('debt_id')
        name = (data.get('name') or '').strip()
        amount = data.get('amount')
        note = data.get('note') or ''
        if not all([user_id, debt_id, name, amount]):
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        try:
            amount_value = float(amount)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid amount'}), 400
        if amount_value <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
        existing = db.get_debt_by_id(user_id, int(debt_id))
        if not existing:
            return jsonify({'error': 'Debt not found'}), 404
        db.update_debt(user_id, int(debt_id), name, amount_value, note)
        paid_amount = db.get_debt_paid_amount(user_id, int(debt_id))
        updated = db.get_debt_by_id(user_id, int(debt_id))
        return jsonify({
            'success': True,
            'debt': {
                'id': updated['id'],
                'name': updated['name'],
                'target_amount': updated['target_amount'],
                'paid_amount': paid_amount,
                'note': updated['note'] or '',
                'archived': bool(updated['archived'])
            }
        })
    except Exception as e:
        print(f"Debt update error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debt/delete', methods=['POST'])
def delete_debt():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        debt_id = data.get('debt_id')
        if not user_id or not debt_id:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        paid_amount = db.get_debt_paid_amount(user_id, int(debt_id))
        if paid_amount > 0:
            return jsonify({'error': 'debt_has_payments'}), 400
        if not db.delete_debt(user_id, int(debt_id)):
            return jsonify({'error': 'Debt not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        print(f"Debt delete error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debt/archive', methods=['POST'])
def archive_debt():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        debt_id = data.get('debt_id')
        archived = data.get('archived')
        if user_id is None or debt_id is None or archived is None:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        existing = db.get_debt_by_id(user_id, int(debt_id))
        if not existing:
            return jsonify({'error': 'Debt not found'}), 404
        db.set_debt_archived(user_id, int(debt_id), bool(archived))
        return jsonify({'success': True})
    except Exception as e:
        print(f"Debt archive error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/shared_wallet/status')
def shared_wallet_status():
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        status = db.get_shared_wallet_status(user_id)
        if not status:
            return jsonify({'status': 'none'})
        role = 'owner' if status['owner_id'] == user_id else 'member'
        base_url = request.host_url.rstrip('/')
        link = f"{base_url}/?invite={status['code']}" if status['code'] else ''
        return jsonify({
            'status': role,
            'code': status['code'],
            'link': link,
            'owner_name': status['owner_name'] or status['owner_username'] or '',
            'member_name': status['member_name'] or status['member_username'] or ''
        })
    except Exception as e:
        print(f"Shared status error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/shared_wallet/create', methods=['POST'])
def shared_wallet_create():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        status = db.get_shared_wallet_status(user_id)
        if status:
            return jsonify({'error': 'Already in shared wallet'}), 400
        code = None
        for _ in range(10):
            candidate = generate_invite_code()
            try:
                if db.create_shared_wallet(user_id, candidate):
                    code = candidate
                    break
            except Exception:
                code = None
        if not code:
            return jsonify({'error': 'Failed to create invite'}), 500
        base_url = request.host_url.rstrip('/')
        link = f"{base_url}/?invite={code}"
        return jsonify({'status': 'owner', 'code': code, 'link': link})
    except Exception as e:
        print(f"Shared create error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/shared_wallet/join', methods=['POST'])
def shared_wallet_join():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        code = (data.get('code') or '').strip().upper()
        if not user_id or not code:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        result = db.join_shared_wallet(user_id, code)
        if result.get('error'):
            return jsonify({'error': result['error']}), 400
        return jsonify({'status': 'member'})
    except Exception as e:
        print(f"Shared join error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/shared_wallet/leave', methods=['POST'])
def shared_wallet_leave():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        result = db.leave_shared_wallet(user_id)
        if result.get('error'):
            return jsonify({'error': result['error']}), 400
        return jsonify({'success': True, 'role': result.get('role')})
    except Exception as e:
        print(f"Shared leave error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/activate', methods=['POST'])
def subscription_activate():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        admin_key = data.get('admin_key', '')
        months = data.get('months')
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        secret = os.getenv('ADMIN_SECRET')
        if not secret:
            return jsonify({'error': 'ADMIN_SECRET is not set'}), 500
        if admin_key != secret:
            return jsonify({'error': 'Forbidden'}), 403
        if not db:
            return jsonify({'error': 'Database error'}), 500
        try:
            months = int(months) if months else DEFAULT_SUBSCRIPTION_MONTHS
        except Exception:
            months = DEFAULT_SUBSCRIPTION_MONTHS
        db.set_subscription_active(user_id, True, months=months)
        info = db.get_subscription_info(user_id)
        return jsonify({'success': True, 'subscription_start': info['activated_at'], 'subscription_end': info['expires_at'], 'months': months})
    except Exception as e:
        print(f"Subscription activate error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/grant', methods=['POST'])
def subscription_grant():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        username = (data.get('username') or '').lstrip('@').strip()
        admin_key = data.get('admin_key', '')
        months = data.get('months')
        secret = os.getenv('ADMIN_SECRET')
        if not secret:
            return jsonify({'error': 'ADMIN_SECRET is not set'}), 500
        if admin_key != secret:
            return jsonify({'error': 'Forbidden'}), 403
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if not user_id and username:
            user_id = db.get_user_id_by_username(username)
        if not user_id:
            return jsonify({'error': 'User not found (user must open app once)'}), 404
        try:
            months = int(months) if months else DEFAULT_SUBSCRIPTION_MONTHS
        except Exception:
            months = DEFAULT_SUBSCRIPTION_MONTHS
        if months not in (1, 3, 6, 12):
            months = DEFAULT_SUBSCRIPTION_MONTHS
        db.set_subscription_active(user_id, True, months=months)
        info = db.get_subscription_info(user_id)
        if not username:
            username = db.get_username_by_id(user_id)
        return jsonify({
            'success': True,
            'months': months,
            'subscription_start': info['activated_at'],
            'subscription_end': info['expires_at'],
            'username': username or None,
            'user_id': user_id
        })
    except Exception as e:
        print(f"Subscription grant error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/info')
def subscription_info():
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        info = db.get_subscription_info(user_id)
        return jsonify({
            'active': info['active'],
            'subscription_start': info['activated_at'],
            'subscription_end': info['expires_at']
        })
    except Exception as e:
        print(f"Subscription info error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/redeem', methods=['POST'])
def subscription_redeem():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        code = (data.get('code') or '').strip().upper()
        if not user_id or not code:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        months = PROMO_CODE_MAP.get(code)
        if months:
            if db.is_promo_redeemed(code):
                return jsonify({'error': 'Promo code already used'}), 400
            if not db.redeem_promo_code(user_id, code, months):
                return jsonify({'error': 'Promo code already used'}), 400
        else:
            months = PROMO_MULTI_CODE_MAP.get(code)
            if not months:
                return jsonify({'error': 'Invalid promo code'}), 400
            if db.has_promo_multi_user(code, user_id):
                return jsonify({'error': 'Promo code already used'}), 400
            limit = PROMO_MULTI_LIMITS.get(months, 0)
            if limit and db.get_promo_multi_count(code) >= limit:
                return jsonify({'error': 'Promo code limit reached'}), 400
            if not db.redeem_promo_multi_code(user_id, code, months):
                return jsonify({'error': 'Promo code already used'}), 400
        db.set_subscription_active(user_id, True, months=months)
        info = db.get_subscription_info(user_id)
        return jsonify({
            'success': True,
            'months': months,
            'subscription_start': info['activated_at'],
            'subscription_end': info['expires_at']
        })
    except Exception as e:
        print(f"Subscription redeem error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/promo_stats', methods=['POST'])
def subscription_promo_stats():
    try:
        data = request.json or {}
        admin_key = data.get('admin_key', '')
        secret = os.getenv('ADMIN_SECRET')
        if not secret:
            return jsonify({'error': 'ADMIN_SECRET is not set'}), 500
        if admin_key != secret:
            return jsonify({'error': 'Forbidden'}), 403
        if not db:
            return jsonify({'error': 'Database error'}), 500

        items = []
        for code, months in PROMO_CODE_MAP.items():
            used = db.get_promo_redemption_count(code)
            items.append({
                'code': code,
                'months': months,
                'used': used,
                'limit': 1,
                'type': 'single'
            })
        for code, months in PROMO_MULTI_CODE_MAP.items():
            used = db.get_promo_multi_count(code)
            limit = PROMO_MULTI_LIMITS.get(months, 0) or None
            items.append({
                'code': code,
                'months': months,
                'used': used,
                'limit': limit,
                'type': 'multi'
            })

        items.sort(key=lambda x: (x['months'], x['code']))
        return jsonify({'items': items})
    except Exception as e:
        print(f"Promo stats error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/lecryptio/create', methods=['POST'])
def lecryptio_create():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if db.get_subscription_status(user_id):
            return jsonify({'active': True})
        result, err = create_cryptopay_invoice_for_user(user_id, 'USDT')
        if err:
            return jsonify({'error': err}), 502
        pay_url = result.get('mini_app_invoice_url') or result.get('web_app_invoice_url') or result.get('bot_invoice_url') or ''
        uuid_value = str(result.get('invoice_id'))
        order_ref = result.get('payload')
        status = result.get('status') or 'active'
        amount = result.get('amount') or '2'
        currency = result.get('asset') or 'USDT'
        return jsonify({
            'uuid': uuid_value,
            'order_id': order_ref,
            'status': status,
            'pay_url': pay_url,
            'address': '',
            'amount': amount,
            'currency': currency
        })
    except Exception as e:
        print(f"LeCryptio create error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/lecryptio/status')
def lecryptio_status():
    try:
        uuid_value = request.args.get('uuid', '').strip()
        order_id = request.args.get('order_id', '').strip()
        if not uuid_value and not order_id:
            return jsonify({'error': 'Missing uuid'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        invoice_id = resolve_cryptopay_invoice_id(uuid_value, order_id)
        if not invoice_id:
            return jsonify({'status': 'active'})
        invoice, status = refresh_cryptopay_invoice(invoice_id)
        if invoice and is_cryptopay_paid(status):
            months = cryptopay_resolve_months(invoice['amount'], invoice['asset'], invoice.get('payload'))
            if months:
                db.set_subscription_active(invoice['user_id'], True, months=months)
                info = db.get_subscription_info(invoice['user_id'])
                return jsonify({
                    'status': status,
                    'active': True,
                    'subscription_start': info['activated_at'],
                    'subscription_end': info['expires_at']
                })
        return jsonify({'status': status})
    except Exception as e:
        print(f"LeCryptio status error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/lecryptio/webhook', methods=['POST'])
def lecryptio_webhook():
    try:
        if not db:
            return jsonify({'error': 'Database error'}), 500
        raw = request.get_data(as_text=True) or ''
        signature = request.headers.get('X-LeCryptio-Signature', '')
        timestamp = request.headers.get('X-LeCryptio-Timestamp', '')
        if LECRYPTIO_WEBHOOK_SECRET:
            if not verify_lecryptio_webhook(raw, timestamp, signature, LECRYPTIO_WEBHOOK_SECRET):
                return jsonify({'error': 'Invalid signature'}), 400
        payload = request.get_json(silent=True) or {}
        event = payload.get('event') or ''
        invoice = normalize_lecryptio_invoice(payload)
        uuid_value = invoice.get('uuid') or invoice.get('id')
        status = invoice.get('status') or ''
        order_id = invoice.get('external_id') or invoice.get('order_id') or ''
        amount = invoice.get('amount')
        currency = invoice.get('currency')
        network = invoice.get('network')
        address = invoice.get('pay_address') or invoice.get('address') or ''
        pay_url = invoice.get('payment_url') or invoice.get('checkout_url') or invoice.get('url') or ''
        user_id = parse_user_from_order(order_id)
        if uuid_value and user_id:
            db.create_lecryptio_invoice(user_id, uuid_value, order_id, status or event, amount, currency, network, address, pay_url)
            if (is_lecryptio_paid(status) or event == 'invoice.paid') and lecryptio_matches_subscription(amount, currency, network):
                db.set_subscription_active(user_id, True, months=DEFAULT_SUBSCRIPTION_MONTHS)
        elif uuid_value and status:
            db.update_lecryptio_status(uuid_value, status)
        return jsonify({'success': True})
    except Exception as e:
        print(f"LeCryptio webhook error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/cryptopay/create', methods=['POST'])
def cryptopay_create():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        asset = 'USDT'
        months = data.get('months', 1)
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if db.get_subscription_status(user_id):
            return jsonify({'active': True})
        result, err = create_cryptopay_invoice_for_user(user_id, asset, months)
        if err:
            return jsonify({'error': err}), 502
        return jsonify(result)
    except Exception as e:
        print(f"CryptoPay create error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/cryptopay/status')
def cryptopay_status():
    try:
        invoice_id = request.args.get('invoice_id', type=int)
        if not invoice_id:
            return jsonify({'error': 'Missing invoice_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        invoice, status = refresh_cryptopay_invoice(invoice_id)
        if invoice and is_cryptopay_paid(status):
            months = cryptopay_resolve_months(invoice['amount'], invoice['asset'], invoice.get('payload'))
            if months:
                db.set_subscription_active(invoice['user_id'], True, months=months)
                info = db.get_subscription_info(invoice['user_id'])
                return jsonify({
                    'status': status,
                    'active': True,
                    'subscription_start': info['activated_at'],
                    'subscription_end': info['expires_at']
                })
        return jsonify({'status': status})
    except Exception as e:
        print(f"CryptoPay status error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cryptopay/webhook', methods=['POST'])
@app.route('/api/cryptopay/webhook/<secret>', methods=['POST'])
def cryptopay_webhook(secret=None):
    try:
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if CRYPTOPAY_WEBHOOK_SECRET and secret != CRYPTOPAY_WEBHOOK_SECRET:
            return jsonify({'error': 'Forbidden'}), 403
        raw = request.get_data(as_text=True) or ''
        signature = request.headers.get('crypto-pay-api-signature', '')
        if CRYPTOPAY_API_TOKEN:
            if not verify_cryptopay_webhook(raw, signature, CRYPTOPAY_API_TOKEN):
                return jsonify({'error': 'Invalid signature'}), 400
        payload = request.get_json(silent=True) or {}
        update_type = payload.get('update_type') or ''
        invoice = payload.get('payload') or {}
        invoice_id = invoice.get('invoice_id') or invoice.get('id')
        status = invoice.get('status') or ('paid' if update_type == 'invoice_paid' else '')
        asset = invoice.get('asset') or ''
        amount = invoice.get('amount') or ''
        payload_ref = invoice.get('payload') or ''
        bot_url = invoice.get('bot_invoice_url') or ''
        mini_url = invoice.get('mini_app_invoice_url') or ''
        web_url = invoice.get('web_app_invoice_url') or ''
        if invoice_id:
            invoice_id = int(invoice_id)
        user_id = parse_user_from_order(payload_ref)
        if not user_id and invoice_id:
            existing = db.get_cryptopay_invoice(invoice_id)
            if existing:
                user_id = existing['user_id']
                if not asset:
                    asset = existing['asset']
                if not amount:
                    amount = existing['amount']
                if not payload_ref:
                    payload_ref = existing['payload']
        if invoice_id and user_id:
            db.create_cryptopay_invoice(user_id, invoice_id, status, asset, amount, payload_ref, bot_url, mini_url, web_url)
            if is_cryptopay_paid(status):
                months = cryptopay_resolve_months(amount, asset, payload_ref)
                if months:
                    db.set_subscription_active(user_id, True, months=months)
        elif invoice_id and status:
            db.update_cryptopay_status(invoice_id, status)
        return jsonify({'success': True})
    except Exception as e:
        print(f"CryptoPay webhook error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/cryptocloud/create', methods=['POST'])
def cryptocloud_create():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if db.get_subscription_status(user_id):
            return jsonify({'active': True})
        result, err = create_cryptopay_invoice_for_user(user_id, 'USDT')
        if err:
            return jsonify({'error': err}), 502
        pay_url = result.get('mini_app_invoice_url') or result.get('web_app_invoice_url') or result.get('bot_invoice_url') or ''
        uuid_value = str(result.get('invoice_id'))
        order_id = result.get('payload')
        status = result.get('status') or 'active'
        amount = result.get('amount') or '2'
        currency = result.get('asset') or 'USDT'
        return jsonify({
            'uuid': uuid_value,
            'order_id': order_id,
            'status': status,
            'pay_url': pay_url,
            'address': '',
            'amount': amount,
            'currency': currency
        })
    except Exception as e:
        print(f"CryptoCloud create error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/cryptocloud/status')
def cryptocloud_status():
    try:
        uuid_value = request.args.get('uuid', '').strip()
        order_id = request.args.get('order_id', '').strip()
        if not uuid_value and not order_id:
            return jsonify({'error': 'Missing uuid'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        invoice_id = resolve_cryptopay_invoice_id(uuid_value, order_id)
        if not invoice_id:
            return jsonify({'status': 'active'})
        invoice, status = refresh_cryptopay_invoice(invoice_id)
        if invoice and is_cryptopay_paid(status):
            months = cryptopay_resolve_months(invoice['amount'], invoice['asset'], invoice.get('payload'))
            if months:
                db.set_subscription_active(invoice['user_id'], True, months=months)
                info = db.get_subscription_info(invoice['user_id'])
                return jsonify({
                    'status': status,
                    'active': True,
                    'subscription_start': info['activated_at'],
                    'subscription_end': info['expires_at']
                })
        return jsonify({'status': status})
    except Exception as e:
        print(f"CryptoCloud status error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cryptocloud/postback', methods=['POST'])
def cryptocloud_postback():
    try:
        if not CRYPTOCLOUD_POSTBACK_SECRET:
            return jsonify({'error': 'Postback secret not set'}), 500
        if not db:
            return jsonify({'error': 'Database error'}), 500
        data = request.get_json(silent=True) or {}
        if not data:
            data = request.form.to_dict() if request.form else {}
        token = data.get('token') or data.get('Token')
        if not token:
            return jsonify({'error': 'Missing token'}), 400
        payload = decode_cryptocloud_token(token, CRYPTOCLOUD_POSTBACK_SECRET)
        if not payload:
            return jsonify({'error': 'Invalid token'}), 400
        uuid_value = payload.get('uuid') or payload.get('invoice_uuid')
        status = payload.get('status') or payload.get('invoice_status') or ''
        order_id = payload.get('order_id') or ''
        amount = payload.get('amount_to_pay') or payload.get('amount')
        currency = normalize_cryptocloud_currency(payload.get('currency'))
        address = payload.get('address') or ''
        pay_url = payload.get('link') or payload.get('pay_url') or ''
        user_id = parse_user_from_order(order_id)
        if not user_id and uuid_value:
            invoice = db.get_cryptocloud_invoice(uuid_value)
            if invoice:
                user_id = invoice['user_id']
                if not order_id:
                    order_id = invoice['order_id']
        if user_id and uuid_value:
            db.create_cryptocloud_invoice(user_id, uuid_value, order_id, status, amount, currency, address, pay_url)
            if is_cryptocloud_paid(status):
                db.set_subscription_active(user_id, True, months=DEFAULT_SUBSCRIPTION_MONTHS)
        elif uuid_value and status:
            db.update_cryptocloud_status(uuid_value, status)
        return jsonify({'success': True})
    except Exception as e:
        print(f"CryptoCloud postback error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/nowpayments/create', methods=['POST'])
def nowpayments_create():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if db.get_subscription_status(user_id):
            return jsonify({'active': True})
        if not NOWPAYMENTS_API_KEY:
            return jsonify({'error': 'NOWPAYMENTS_API_KEY is not set'}), 500

        order_id = f"sub_{user_id}_{int(datetime.utcnow().timestamp())}"
        ipn_url = f"{request.host_url.rstrip('/')}/api/nowpayments/ipn"
        payload = {
            'price_amount': 2.0,
            'price_currency': 'usd',
            'pay_currency': 'usdttrc20',
            'order_id': order_id,
            'order_description': 'Subscription',
            'ipn_callback_url': ipn_url,
            'success_url': request.host_url,
            'cancel_url': request.host_url
        }
        resp = requests.post(
            'https://api.nowpayments.io/v1/invoice',
            headers={'x-api-key': NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json'},
            data=json.dumps(payload),
            timeout=15
        )
        if resp.status_code >= 400:
            return jsonify({'error': f'NOWPayments error: {resp.text}'}), 502
        payment = resp.json()
        invoice_url = payment.get('invoice_url', '')
        if not invoice_url:
            return jsonify({'error': 'NOWPayments invalid response'}), 502
        return jsonify({
            'order_id': order_id,
            'payment_status': payment.get('payment_status', 'waiting'),
            'invoice_url': invoice_url
        })
    except Exception as e:
        print(f"NowPayments create error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/nowpayments/status')
def nowpayments_status():
    try:
        payment_id = request.args.get('payment_id', type=int)
        order_id = request.args.get('order_id', '')
        if not payment_id and not order_id:
            return jsonify({'error': 'Missing payment_id'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if payment_id:
            payment = db.get_nowpayment(payment_id)
            if payment and payment['payment_status'] in ('finished', 'confirmed'):
                db.set_subscription_active(payment['user_id'], True, months=DEFAULT_SUBSCRIPTION_MONTHS)
                return jsonify({'payment_status': payment['payment_status'], 'active': True})
            if not NOWPAYMENTS_API_KEY:
                status = payment['payment_status'] if payment else 'unknown'
                return jsonify({'payment_status': status})
            resp = requests.get(
                f'https://api.nowpayments.io/v1/payment/{payment_id}',
                headers={'x-api-key': NOWPAYMENTS_API_KEY},
                timeout=15
            )
            if resp.status_code >= 400:
                status = payment['payment_status'] if payment else 'unknown'
                return jsonify({'payment_status': status})
            remote = resp.json()
            status = remote.get('payment_status', '')
            if status:
                db.update_nowpayment_status(payment_id, status)
            if payment and status in ('finished', 'confirmed'):
                db.set_subscription_active(payment['user_id'], True, months=DEFAULT_SUBSCRIPTION_MONTHS)
                return jsonify({'payment_status': status, 'active': True})
            return jsonify({'payment_status': status})
        payment = db.get_nowpayment_by_order(order_id)
        if payment and payment['payment_status'] in ('finished', 'confirmed'):
            db.set_subscription_active(payment['user_id'], True, months=DEFAULT_SUBSCRIPTION_MONTHS)
            return jsonify({'payment_status': payment['payment_status'], 'active': True})
        return jsonify({'payment_status': payment['payment_status'] if payment else 'waiting'})
    except Exception as e:
        print(f"NowPayments status error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/nowpayments/ipn', methods=['POST'])
def nowpayments_ipn():
    try:
        if not NOWPAYMENTS_IPN_SECRET:
            return jsonify({'error': 'IPN secret not set'}), 500
        signature = request.headers.get('x-nowpayments-sig', '')
        raw = request.get_data(as_text=True)
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            return jsonify({'error': 'Invalid JSON'}), 400
        sorted_payload = sort_payload(payload)
        sorted_json = json.dumps(sorted_payload, separators=(',', ':'), ensure_ascii=False)
        check = hmac.new(NOWPAYMENTS_IPN_SECRET.encode(), sorted_json.encode(), hashlib.sha512).hexdigest()
        if not hmac.compare_digest(check, signature):
            return jsonify({'error': 'Invalid signature'}), 400
        payment_id = payload.get('payment_id')
        status = payload.get('payment_status')
        order_id = payload.get('order_id', '')
        price_amount = payload.get('price_amount')
        price_currency = payload.get('price_currency')
        pay_amount = payload.get('pay_amount')
        pay_currency = payload.get('pay_currency')
        pay_address = payload.get('pay_address')
        if payment_id:
            payment = db.get_nowpayment(int(payment_id))
            user_id = payment['user_id'] if payment else parse_user_from_order(order_id)
            if user_id:
                db.create_nowpayment(
                    user_id,
                    int(payment_id),
                    status,
                    price_amount,
                    price_currency,
                    pay_amount,
                    pay_currency,
                    pay_address,
                    order_id
                )
            else:
                db.update_nowpayment_status(int(payment_id), status)
            payment = db.get_nowpayment(int(payment_id))
            if payment and status in ('finished', 'confirmed'):
                db.set_subscription_active(payment['user_id'], True, months=DEFAULT_SUBSCRIPTION_MONTHS)
        return jsonify({'success': True})
    except Exception as e:
        print(f"NowPayments IPN error: {e}")
        return jsonify({'error': str(e)}), 500

def ensure_expense_category(user_id, name, icon, color):
    if not db:
        return
    try:
        db.add_category(user_id, 'expense', name, icon, color)
    except Exception:
        pass

def ensure_savings_wallet(user_id):
    if not db:
        return
    try:
        db.ensure_savings_wallet_from_history(user_id)
    except Exception:
        pass

def get_available_wallet_balance(user_id, wallet_name):
    if not db:
        return 0.0
    if wallet_name == SAVINGS_WALLET_NAME:
        ensure_savings_wallet(user_id)
    return db.get_wallet_balance(user_id, wallet_name)

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    try:
        data = request.json
        user_id = data.get('user_id')
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        wallet = data.get('wallet', 'Карта')
        description = data.get('description', '')
        debt_id = data.get('debt_id')
        
        if not all([user_id, trans_type, amount, category]):
            return jsonify({'error': 'Missing fields'}), 400

        if db and not db.get_subscription_status(user_id):
            return jsonify({'error': 'subscription_required'}), 402
        
        if trans_type not in ['income', 'expense']:
            return jsonify({'error': 'Invalid type'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400

        if category == 'Долги':
            if trans_type != 'expense':
                return jsonify({'error': 'Invalid type for debt transaction'}), 400
            if not debt_id:
                return jsonify({'error': 'Missing debt_id'}), 400
            try:
                debt_id = int(debt_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid debt_id'}), 400
            if not db.get_debt_by_id(user_id, debt_id):
                return jsonify({'error': 'Debt not found'}), 404
        else:
            debt_id = None
        
        if db:
            if category == 'Накопления':
                ensure_expense_category(user_id, 'Накопления', '💰', '#FFD166')
            if category == 'Цели':
                ensure_expense_category(user_id, 'Цели', '🎯', '#FF9500')
            if trans_type == 'expense':
                wallet_balance = get_available_wallet_balance(user_id, wallet)
                if amount > wallet_balance:
                    return jsonify({'error': 'insufficient_funds'}), 400

            transaction_id = db.add_transaction(user_id, trans_type, amount, category, wallet, description, debt_id)
            
            stats = db.get_user_stats(user_id)
            wallets = db.get_wallets(user_id)
            recent = db.get_recent_transactions(user_id, limit=5)
            
        else:
            return jsonify({'error': 'Database error'}), 500
        
        return jsonify({
            'success': True,
            'transaction_id': transaction_id,
            'summary': stats['summary'],
            'category_stats': {
                'income': stats['income'],
                'expense': stats['expense'],
                'wallets': stats['wallets']
            },
            'wallets': [{'name': w['name'], 'balance': w['balance']} for w in wallets],
            'recent_transactions': [{
                'id': t['id'],
                'type': t['type'],
                'amount': t['amount'],
                'category': t['category'],
                'wallet': t['wallet'],
                'description': t['description'] or '',
                'debt_id': t['debt_id'],
                'date': t['date']
            } for t in recent]
        })
    except Exception as e:
        print(f"Transaction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transaction/update', methods=['POST'])
def update_transaction():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        transaction_id = data.get('transaction_id')
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        wallet = data.get('wallet', 'Карта')
        description = data.get('description', '')
        debt_id = data.get('debt_id')
        transaction_date_raw = data.get('date')
        transaction_date = None

        if not all([user_id, transaction_id, trans_type, amount, category]):
            return jsonify({'error': 'Missing fields'}), 400

        if trans_type not in ['income', 'expense']:
            return jsonify({'error': 'Invalid type'}), 400

        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400

        if transaction_date_raw not in (None, ''):
            if not isinstance(transaction_date_raw, str):
                return jsonify({'error': 'Invalid date format'}), 400
            parsed_date = None
            cleaned = transaction_date_raw.strip()
            date_formats = (
                '%Y-%m-%dT%H:%M',
                '%Y-%m-%d %H:%M',
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%d %H:%M:%S'
            )
            for date_fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(cleaned, date_fmt)
                    break
                except ValueError:
                    continue
            if parsed_date is None:
                try:
                    parsed_date = datetime.fromisoformat(cleaned.replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({'error': 'Invalid date format'}), 400
            if parsed_date.tzinfo is not None:
                parsed_date = parsed_date.astimezone().replace(tzinfo=None)
            transaction_date = parsed_date.strftime('%Y-%m-%d %H:%M:%S')

        if not db:
            return jsonify({'error': 'Database error'}), 500

        existing = db.get_transaction_by_id(user_id, int(transaction_id))
        if not existing:
            return jsonify({'error': 'Transaction not found'}), 404

        if category == 'Долги':
            if trans_type != 'expense':
                return jsonify({'error': 'Invalid type for debt transaction'}), 400
            if debt_id in (None, ''):
                debt_id = existing['debt_id']
            if not debt_id:
                return jsonify({'error': 'Missing debt_id'}), 400
            try:
                debt_id = int(debt_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid debt_id'}), 400
            if not db.get_debt_by_id(user_id, debt_id):
                return jsonify({'error': 'Debt not found'}), 404
        else:
            debt_id = None

        if trans_type == 'expense':
            available_balance = get_available_wallet_balance(user_id, wallet)
            if existing['wallet'] == wallet:
                old_amount = float(existing['amount']) if existing['amount'] is not None else 0
                if existing['type'] == 'expense':
                    available_balance += old_amount
                else:
                    available_balance -= old_amount
            if amount > available_balance:
                return jsonify({'error': 'insufficient_funds'}), 400

        if not db.update_transaction(
            user_id,
            int(transaction_id),
            trans_type,
            amount,
            category,
            wallet,
            description,
            debt_id,
            transaction_date
        ):
            return jsonify({'error': 'Transaction not found'}), 404

        stats = db.get_user_stats(user_id)
        wallets = db.get_wallets(user_id)
        recent = db.get_recent_transactions(user_id, limit=5)

        return jsonify({
            'success': True,
            'summary': stats['summary'],
            'category_stats': {
                'income': stats['income'],
                'expense': stats['expense'],
                'wallets': stats['wallets']
            },
            'wallets': [{'name': w['name'], 'balance': w['balance']} for w in wallets],
            'recent_transactions': [{
                'id': t['id'],
                'type': t['type'],
                'amount': t['amount'],
                'category': t['category'],
                'wallet': t['wallet'],
                'description': t['description'] or '',
                'debt_id': t['debt_id'],
                'date': t['date']
            } for t in recent]
        })
    except Exception as e:
        print(f"Update transaction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transaction/delete', methods=['POST'])
def delete_transaction():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        transaction_id = data.get('transaction_id')
        if not user_id or not transaction_id:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        if not db.delete_transaction(user_id, int(transaction_id)):
            return jsonify({'error': 'Transaction not found'}), 404

        stats = db.get_user_stats(user_id)
        wallets = db.get_wallets(user_id)
        recent = db.get_recent_transactions(user_id, limit=5)

        return jsonify({
            'success': True,
            'summary': stats['summary'],
            'category_stats': {
                'income': stats['income'],
                'expense': stats['expense'],
                'wallets': stats['wallets']
            },
            'wallets': [{'name': w['name'], 'balance': w['balance']} for w in wallets],
            'recent_transactions': [{
                'id': t['id'],
                'type': t['type'],
                'amount': t['amount'],
                'category': t['category'],
                'wallet': t['wallet'],
                'description': t['description'] or '',
                'debt_id': t['debt_id'],
                'date': t['date']
            } for t in recent]
        })
    except Exception as e:
        print(f"Delete transaction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/set_default_wallet', methods=['POST'])
def set_default_wallet():
    try:
        data = request.json
        user_id = data.get('user_id')
        wallet_name = data.get('wallet_name')
        
        if not user_id or not wallet_name:
            return jsonify({'error': 'Missing fields'}), 400
        
        if db:
            success = db.set_default_wallet(user_id, wallet_name)
            return jsonify({'success': success})
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Set default wallet error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/add_goal', methods=['POST'])
def add_goal():
    try:
        data = request.json
        user_id = data.get('user_id')
        name = data.get('name')
        target_amount = data.get('target_amount')
        icon = data.get('icon', '🎯')
        color = data.get('color', '#FF9500')
        deadline = data.get('deadline')
        
        if not all([user_id, name, target_amount]):
            return jsonify({'error': 'Missing fields'}), 400
        
        try:
            target_amount = float(target_amount)
            if target_amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            goal_id = db.add_goal(user_id, name, target_amount, icon, color, deadline)
            return jsonify({
                'success': True,
                'goal_id': goal_id,
                'goal': {
                    'id': goal_id,
                    'name': name,
                    'target_amount': target_amount,
                    'current_amount': 0,
                    'icon': icon,
                    'color': color,
                    'deadline': deadline,
                    'progress': 0,
                    'archived': False
                }
            })
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add goal error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/goal/update', methods=['POST'])
def update_goal():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        goal_id = data.get('goal_id')
        name = data.get('name')
        target_amount = data.get('target_amount')
        icon = data.get('icon', '🎯')
        color = data.get('color', '#FF9500')
        deadline = data.get('deadline')

        if not all([user_id, goal_id, name, target_amount]):
            return jsonify({'error': 'Missing fields'}), 400

        try:
            target_amount = float(target_amount)
            if target_amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400

        if not db:
            return jsonify({'error': 'Database error'}), 500

        try:
            goal_id = int(goal_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid goal_id'}), 400

        goal = db.get_goal_by_id(user_id, goal_id)
        if not goal:
            return jsonify({'error': 'Goal not found'}), 404

        if not db.update_goal(user_id, goal_id, name, target_amount, icon, color, deadline):
            return jsonify({'error': 'Goal not found'}), 404

        updated = db.get_goal_by_id(user_id, goal_id)
        progress = 0
        if updated and updated['target_amount']:
            progress = (float(updated['current_amount']) / float(updated['target_amount'])) * 100 if float(updated['target_amount']) else 0

        return jsonify({
            'success': True,
            'goal': {
                'id': updated['id'],
                'name': updated['name'],
                'target_amount': updated['target_amount'],
                'current_amount': updated['current_amount'],
                'icon': updated['icon'],
                'color': updated['color'],
                'deadline': updated['deadline'],
                'progress': progress,
                'archived': bool(updated['archived'])
            }
        })
    except Exception as e:
        print(f"Update goal error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/goal/archive', methods=['POST'])
def archive_goal():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        goal_id = data.get('goal_id')
        archived = data.get('archived', True)

        if user_id is None or goal_id is None:
            return jsonify({'error': 'Missing fields'}), 400

        if not db:
            return jsonify({'error': 'Database error'}), 500

        try:
            goal_id = int(goal_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid goal_id'}), 400

        goal = db.get_goal_by_id(user_id, goal_id)
        if not goal:
            return jsonify({'error': 'Goal not found'}), 404

        if not db.set_goal_archived(user_id, goal_id, bool(archived)):
            return jsonify({'error': 'Goal not found'}), 404

        updated = db.get_goal_by_id(user_id, goal_id)
        progress = 0
        if updated and updated['target_amount']:
            progress = (float(updated['current_amount']) / float(updated['target_amount'])) * 100 if float(updated['target_amount']) else 0

        return jsonify({
            'success': True,
            'goal': {
                'id': updated['id'],
                'name': updated['name'],
                'target_amount': updated['target_amount'],
                'current_amount': updated['current_amount'],
                'icon': updated['icon'],
                'color': updated['color'],
                'deadline': updated['deadline'],
                'progress': progress,
                'archived': bool(updated['archived'])
            }
        })
    except Exception as e:
        print(f"Archive goal error: {e}")
        return jsonify({'error': str(e)}), 500

# Удаление цели с переносом средств в копилку (если цель не завершена)
@app.route('/api/goal/delete', methods=['POST'])
def delete_goal():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        goal_id = data.get('goal_id')

        if user_id is None or goal_id is None:
            return jsonify({'error': 'Missing fields'}), 400
        if not db:
            return jsonify({'error': 'Database error'}), 500
        try:
            goal_id = int(goal_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid goal_id'}), 400

        goal = db.get_goal_by_id(user_id, goal_id)
        if not goal:
            return jsonify({'error': 'Goal not found'}), 404

        current_amount = float(goal['current_amount'] or 0)
        target_amount = float(goal['target_amount'] or 0)
        moved_rows = 0
        moved_to_piggybank = current_amount > 0 and target_amount > 0 and current_amount < target_amount

        if moved_to_piggybank:
            ensure_expense_category(user_id, 'Накопления', '💰', '#FFD166')
            moved_rows = db.move_goal_transactions_to_piggybank(user_id, goal_id)

        if not db.delete_goal(user_id, goal_id):
            return jsonify({'error': 'Goal not found'}), 404

        return jsonify({
            'success': True,
            'moved_to_piggybank': moved_to_piggybank,
            'moved_amount': current_amount if moved_to_piggybank else 0,
            'moved_rows': moved_rows
        })
    except Exception as e:
        print(f"Delete goal error: {e}")
        return jsonify({'error': str(e)}), 500

# НОВЫЙ ЭНДПОИНТ: Добавить накопления в цель
@app.route('/api/add_to_goal', methods=['POST'])
def add_to_goal():
    try:
        data = request.json
        user_id = data.get('user_id')
        goal_id = data.get('goal_id')
        amount = data.get('amount')
        wallet = data.get('wallet')
        
        if not all([user_id, goal_id, amount]):
            return jsonify({'error': 'Missing fields'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            try:
                goal_id = int(goal_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid goal_id'}), 400
            goal = db.get_goal_by_id(user_id, goal_id)
            if not goal:
                return jsonify({'error': 'Goal not found'}), 404
            if goal['archived']:
                return jsonify({'error': 'goal_archived'}), 400
            # Обновляем прогресс цели
            success = db.update_goal_progress(goal_id, amount)
            if success:
                # Также добавляем транзакцию накопления с выбранным кошельком
                if not wallet:
                    wallet = db.get_effective_default_wallet(user_id)
                wallet_balance = get_available_wallet_balance(user_id, wallet)
                if amount > wallet_balance:
                    return jsonify({'error': 'insufficient_funds'}), 400
                ensure_expense_category(user_id, 'Накопления', '💰', '#FFD166')
                transaction_id = db.add_transaction(
                    user_id,
                    'expense',
                    amount,
                    'Накопления',
                    wallet,
                    f'Накопления в цель ID: {goal_id}'
                )
                
                return jsonify({
                    'success': True,
                    'transaction_id': transaction_id,
                    'goal_updated': True
                })
            else:
                return jsonify({'error': 'Failed to update goal'}), 500
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add to goal error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/add_category', methods=['POST'])
def add_category():
    try:
        data = request.json
        user_id = data.get('user_id')
        category_type = data.get('type')
        name = data.get('name')
        icon = data.get('icon', '💰')
        color = data.get('color', '#007AFF')
        
        if not all([user_id, category_type, name]):
            return jsonify({'error': 'Missing fields'}), 400
        
        if category_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Invalid category type'}), 400
        
        if db:
            category_id = db.add_category(user_id, category_type, name, icon, color)
            if category_id:
                return jsonify({'success': True, 'category_id': category_id})
            else:
                return jsonify({'error': 'Category already exists'}), 400
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add category error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/category/delete', methods=['POST'])
def delete_category():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        category_type = data.get('type')
        name = (data.get('name') or '').strip()

        if not all([user_id, category_type, name]):
            return jsonify({'error': 'Missing fields'}), 400

        if category_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Invalid category type'}), 400

        if not db:
            return jsonify({'error': 'Database error'}), 500

        result = db.delete_category_with_transactions(user_id, category_type, name)
        if result.get('error') == 'not_found':
            return jsonify({'error': 'Category not found'}), 404

        ensure_savings_wallet(user_id)
        return jsonify({
            'success': True,
            'deleted_category': bool(result.get('deleted_category')),
            'deleted_transactions': int(result.get('deleted_transactions', 0))
        })
    except Exception as e:
        print(f"Delete category error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/balance_dynamics/<int:user_id>')
def get_balance_dynamics(user_id):
    try:
        period = request.args.get('period', 'week')
        
        if period not in ['day', 'week', 'month']:
            period = 'week'
        
        if db:
            dynamics = db.get_balance_dynamics(user_id, period)
            return jsonify(dynamics)
        else:
            return jsonify([])
    except Exception as e:
        print(f"Balance dynamics error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/all_transactions/<int:user_id>')
def get_all_transactions(user_id):
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        if db:
            transactions = db.get_transactions(user_id, limit, offset)
            result = []
            for trans in transactions:
                result.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'wallet': trans['wallet'],
                    'description': trans['description'] or '',
                    'debt_id': trans['debt_id'],
                    'date': trans['date']
                })
            return jsonify(result)
        else:
            return jsonify([])
    except Exception as e:
        print(f"All transactions error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions/<int:user_id>')
def get_transactions(user_id):
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if db:
            transactions = db.get_transactions(user_id, limit, offset, month, year)
            result = []
            for trans in transactions:
                result.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'wallet': trans['wallet'],
                    'description': trans['description'] or '',
                    'debt_id': trans['debt_id'],
                    'date': trans['date']
                })
            return jsonify(result)
        else:
            return jsonify([])
    except Exception as e:
        print(f"Get transactions error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions_count/<int:user_id>')
def get_transactions_count(user_id):
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if db:
            count = db.get_transactions_count(user_id, month, year)
            return jsonify({'count': count})
        else:
            return jsonify({'count': 0})
    except Exception as e:
        print(f"Count error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/history/<int:user_id>')
def get_history(user_id):
    try:
        if db:
            monthly_data = db.get_monthly_summary(user_id)
            return jsonify(monthly_data)
        else:
            return jsonify([])
    except Exception as e:
        print(f"History error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_currency', methods=['POST'])
def update_currency():
    try:
        data = request.json
        user_id = data.get('user_id')
        currency = data.get('currency')
        
        if not user_id or not currency:
            return jsonify({'error': 'Missing fields'}), 400
        
        if currency not in ['RUB', 'USD', 'EUR', 'GEL']:
            return jsonify({'error': 'Invalid currency'}), 400
        
        if db:
            db.update_user_currency(user_id, currency)
            return jsonify({'success': True, 'currency': currency})
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Currency error: {e}")
        return jsonify({'error': str(e)}), 500

# НОВЫЙ ЭНДПОИНТ: Добавить кошелёк
@app.route('/api/add_wallet', methods=['POST'])
def add_wallet():
    try:
        data = request.json
        user_id = data.get('user_id')
        name = data.get('name')
        icon = data.get('icon', '💳')
        is_default = data.get('is_default', False)
        
        if not all([user_id, name]):
            return jsonify({'error': 'Missing fields'}), 400
        
        if db:
            # Проверяем, существует ли уже кошелёк
            cursor = db.conn.cursor()
            cursor.execute('SELECT name FROM wallets WHERE user_id = ? AND name = ?', (user_id, name))
            if cursor.fetchone():
                return jsonify({'error': 'Wallet already exists'}), 400
            
            # Если устанавливаем как дефолтный, сбрасываем другие
            if is_default:
                cursor.execute('UPDATE wallets SET is_default = 0 WHERE user_id = ?', (user_id,))
            
            cursor.execute('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, name, icon, 0, 1 if is_default else 0))
            
            if is_default:
                cursor.execute('UPDATE users SET default_wallet = ? WHERE id = ?', (name, user_id))
            
            db.conn.commit()
            
            return jsonify({
                'success': True,
                'wallet_id': cursor.lastrowid
            })
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add wallet error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals')
def get_goals():
    try:
        user_id = request.args.get('user_id', type=int)
        
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        
        if db:
            goals = db.get_goals(user_id)
            result = []
            for goal in goals:
                result.append({
                    'id': goal['id'],
                    'name': goal['name'],
                    'target_amount': goal['target_amount'],
                    'current_amount': goal['current_amount'],
                    'icon': goal['icon'],
                    'color': goal['color'],
                    'deadline': goal['deadline'],
                    'progress': goal['progress'],
                    'archived': bool(goal['archived']) if 'archived' in goal.keys() else False
                })
            return jsonify(result)
        else:
            return jsonify([])
    except Exception as e:
        print(f"Get goals error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/market_movers/<market>')
def get_market_movers(market):
    try:
        move_type = request.args.get('type', 'gainers')
        cache_key = f"movers_{market}_{move_type}"
        cached = cache_get(cache_key)
        if cached:
            return jsonify({'items': cached})
        
        if market == 'crypto':
            all_key = "movers_crypto_all"
            all_cached = cache_get(all_key)
            if not all_cached:
                params = {
                    'vs_currency': 'usd',
                    'order': 'market_cap_desc',
                    'per_page': 200,
                    'page': 1,
                    'sparkline': 'false',
                    'price_change_percentage': '24h'
                }
                resp = requests.get(
                    'https://api.coingecko.com/api/v3/coins/markets',
                    params=params,
                    headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
                    timeout=10
                )
                if resp.status_code != 200:
                    all_cached = cache_get(all_key, allow_stale=True)
                    if not all_cached:
                        return jsonify({'error': 'CoinGecko unavailable'}), 502
                else:
                    try:
                        data = resp.json()
                    except Exception:
                        data = None
                    if not data:
                        all_cached = cache_get(all_key, allow_stale=True)
                        if not all_cached:
                            return jsonify({'error': 'CoinGecko invalid response'}), 502
                    else:
                        items = []
                        for coin in data:
                            change = coin.get('price_change_percentage_24h')
                            if change is None:
                                continue
                            items.append({
                                'id': coin.get('id'),
                                'symbol': coin.get('symbol', '').upper(),
                                'name': coin.get('name', ''),
                                'change': float(change),
                                'price': coin.get('current_price'),
                                'image': coin.get('image')
                            })
                        cache_set(all_key, items)
                        all_cached = items
            items = all_cached or []
            items.sort(key=lambda x: x['change'], reverse=(move_type == 'gainers'))
            items = items[:8]
            cache_set(cache_key, items)
            return jsonify({'items': items})

        if market == 'crypto_legacy':
            params = {
                'vs_currency': 'usd',
                'order': 'market_cap_desc',
                'per_page': 200,
                'page': 1,
                'sparkline': 'false',
                'price_change_percentage': '24h'
            }
            resp = requests.get(
                'https://api.coingecko.com/api/v3/coins/markets',
                params=params,
                headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
                timeout=10
            )
            if resp.status_code != 200:
                cached = cache_get(cache_key, allow_stale=True)
                if cached:
                    return jsonify({'points': cached})
                return jsonify({'error': 'CoinGecko unavailable'}), 502
            try:
                data = resp.json()
            except Exception:
                cached = cache_get(cache_key, allow_stale=True)
                if cached:
                    return jsonify({'points': cached})
                return jsonify({'error': 'CoinGecko invalid response'}), 502
            items = []
            for coin in data:
                change = coin.get('price_change_percentage_24h')
                if change is None:
                    continue
                items.append({
                    'id': coin.get('id'),
                    'symbol': coin.get('symbol', '').upper(),
                    'name': coin.get('name', ''),
                    'change': float(change),
                    'price': coin.get('current_price'),
                    'image': coin.get('image')
                })
            items.sort(key=lambda x: x['change'], reverse=(move_type == 'gainers'))
            items = items[:8]
            cache_set(cache_key, items)
            return jsonify({'items': items})
        
        if market == 'stocks':
            api_key = os.getenv('ALPHAVANTAGE_API_KEY')
            if not api_key:
                return jsonify({'error': 'ALPHAVANTAGE_API_KEY is not set'}), 400
            all_key = "movers_stocks_all"
            all_cached = cache_get(all_key, allow_stale=True)
            if not all_cached:
                params = {'function': 'TOP_GAINERS_LOSERS', 'apikey': api_key}
                resp = requests.get('https://www.alphavantage.co/query', params=params, timeout=10)
                try:
                    data = resp.json()
                except Exception:
                    return jsonify({'error': 'Alpha Vantage invalid response'}), 502
                if 'Note' in data or 'Information' in data:
                    cached = cache_get(cache_key, allow_stale=True)
                    if cached:
                        return jsonify({'items': cached})
                    yahoo_items = fetch_yahoo_movers(move_type)
                    if yahoo_items:
                        cache_set(cache_key, yahoo_items)
                        return jsonify({'items': yahoo_items})
                    return jsonify({'error': 'Alpha Vantage rate limit'}), 429
                all_cached = {
                    'top_gainers': data.get('top_gainers', []),
                    'top_losers': data.get('top_losers', []),
                    'most_actively_traded': data.get('most_actively_traded', [])
                }
                cache_set(all_key, all_cached)
            key = 'top_gainers' if move_type == 'gainers' else 'top_losers'
            raw_items = []
            if isinstance(all_cached, dict):
                raw_items = all_cached.get(key, []) or []
            elif isinstance(all_cached, list):
                raw_items = all_cached
            if not isinstance(raw_items, list):
                raw_items = []
            items = []
            for item in raw_items[:8]:
                if not isinstance(item, dict):
                    continue
                symbol = item.get('ticker', '')
                change_pct = item.get('change_percentage', '0%').replace('%', '').replace(',', '.')
                try:
                    change = float(change_pct)
                except ValueError:
                    change = 0.0
                safe_symbol = ''.join(ch for ch in symbol if ch.isalnum())
                safe_symbol = safe_symbol.upper()
                logo_primary = f"https://storage.googleapis.com/iex/api/logos/{safe_symbol}.png" if safe_symbol else ''
                logo_alt = f"https://financialmodelingprep.com/image-stock/{safe_symbol}.png" if safe_symbol else ''
                items.append({
                    'id': symbol,
                    'symbol': symbol,
                    'name': symbol,
                    'change': change,
                    'price': item.get('price'),
                    'logo': logo_primary,
                    'logo_alt': logo_alt
                })
            cache_set(cache_key, items)
            return jsonify({'items': items})
        
        return jsonify({'error': 'Unknown market'}), 400
    except Exception as e:
        print(f"Market movers error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/market_chart/<market>')
def get_market_chart(market):
    try:
        item_id = request.args.get('id', '')
        symbol = request.args.get('symbol', '')
        range_key = (request.args.get('range', '1m') or '1m').lower()
        if not item_id:
            return jsonify({'error': 'Missing id'}), 400
        cache_key = f"chart_{market}_{item_id}_{range_key}"
        cached = cache_get(cache_key)
        if cached:
            return jsonify({'points': cached})
        
        if market == 'crypto':
            days_map = {'1d': 1, '1w': 7, '1m': 30, 'all': 'max'}
            days = days_map.get(range_key, 30)
            params = {'vs_currency': 'usd', 'days': days}
            resp = requests.get(
                f'https://api.coingecko.com/api/v3/coins/{item_id}/market_chart',
                params=params,
                headers={'User-Agent': 'Mozilla/5.0 (TelegramFinanceBot)'},
                timeout=10
            )
            if resp.status_code != 200:
                cached = cache_get(cache_key, allow_stale=True)
                if cached:
                    return jsonify({'points': cached})
                fallback_points = fetch_cryptocompare_chart(symbol, range_key)
                if fallback_points:
                    cache_set(cache_key, fallback_points)
                    return jsonify({'points': fallback_points})
                return jsonify({'error': 'CoinGecko unavailable'}), 502
            try:
                data = resp.json()
            except Exception:
                cached = cache_get(cache_key, allow_stale=True)
                if cached:
                    return jsonify({'points': cached})
                fallback_points = fetch_cryptocompare_chart(symbol, range_key)
                if fallback_points:
                    cache_set(cache_key, fallback_points)
                    return jsonify({'points': fallback_points})
                return jsonify({'error': 'CoinGecko invalid response'}), 502
            points = [{'t': p[0], 'v': p[1]} for p in data.get('prices', [])]
            cache_set(cache_key, points)
            return jsonify({'points': points})
        
        if market == 'stocks':
            api_key = os.getenv('ALPHAVANTAGE_API_KEY')
            if not api_key:
                return jsonify({'error': 'ALPHAVANTAGE_API_KEY is not set'}), 400
            series_key = f"chart_stocks_series_{item_id}"
            series_points = cache_get(series_key, allow_stale=True)
            if not series_points:
                params = {
                    'function': 'TIME_SERIES_DAILY',
                    'symbol': item_id,
                    'apikey': api_key,
                    'outputsize': 'compact'
                }
                resp = requests.get('https://www.alphavantage.co/query', params=params, timeout=10)
                data = resp.json()
                if 'Note' in data or 'Information' in data:
                    series_points = cache_get(series_key, allow_stale=True)
                    if not series_points:
                        yahoo_points = fetch_yahoo_chart(item_id, range_key)
                        if yahoo_points:
                            cache_set(cache_key, yahoo_points)
                            return jsonify({'points': yahoo_points})
                        return jsonify({'error': 'Alpha Vantage rate limit'}), 429
                else:
                    series = data.get('Time Series (Daily)', {})
                    dates = sorted(series.keys())
                    series_points = [{'t': d, 'v': float(series[d]['4. close'])} for d in dates if '4. close' in series[d]]
                    cache_set(series_key, series_points)
            if not series_points:
                yahoo_points = fetch_yahoo_chart(item_id, range_key)
                if yahoo_points:
                    cache_set(cache_key, yahoo_points)
                    return jsonify({'points': yahoo_points})
                return jsonify({'points': []})
            if range_key == '1d':
                points = series_points[-2:]
            elif range_key == '1w':
                points = series_points[-7:]
            elif range_key == '1m':
                points = series_points[-30:]
            else:
                points = series_points
            cache_set(cache_key, points)
            return jsonify({'points': points})
        
        return jsonify({'error': 'Unknown market'}), 400
    except Exception as e:
        print(f"Market chart error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/<int:user_id>')
def export_data(user_id):
    try:
        if db:
            transactions = db.get_transactions(user_id, limit=1000)
            
            csv_data = "Дата,Тип,Категория,Сумма,Кошелёк,Описание\n"
            for trans in transactions:
                date = datetime.strptime(trans['date'], '%Y-%m-%d %H:%M:%S').strftime('%d.%m.%Y')
                trans_type = 'Доход' if trans['type'] == 'income' else 'Расход'
                amount = str(trans['amount'])
                if trans['type'] == 'expense':
                    amount = '-' + amount
                
                csv_data += f"{date},{trans_type},{trans['category']},{amount},{trans['wallet']},\"{trans['description'] or ''}\"\n"
            
            return csv_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=transactions_{user_id}_{datetime.now().strftime("%Y%m%d")}.csv'
            }
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Export error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    print(f"🌍 Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
