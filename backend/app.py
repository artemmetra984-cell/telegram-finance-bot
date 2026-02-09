# backend/app.py
import os
import sys
from flask import Flask, render_template, jsonify, request
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

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com')

print(f"🚀 Starting Flask app (iOS 26 Version)")

CACHE_DIR = os.getenv('MARKET_CACHE_DIR')
if not CACHE_DIR:
    CACHE_DIR = '/data' if os.path.isdir('/data') else '/tmp'
PERSIST_CACHE_PATH = os.path.join(CACHE_DIR, 'market_cache.json')
PERSIST_KEYS = {'movers_stocks_all', 'movers_crypto_all'}

MARKET_CACHE = {}
MARKET_CACHE_TTL = int(os.getenv('MARKET_CACHE_TTL', '900'))  # seconds

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

try:
    from database import db
    print("✅ Database imported")
except ImportError as e:
    print(f"⚠️ Database error: {e}")
    db = None

@app.route('/')
def index():
    return render_template('index.html')

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
                    default_wallet = user['default_wallet'] or 'Наличные'
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
                default_wallet = 'Наличные'
        
        if db:
            stats = db.get_user_stats(user_id)
            
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
                    'progress': goal['progress']
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
                {'name': 'Наличные', 'icon': '💵', 'balance': 0, 'is_default': True},
                {'name': 'Карта', 'icon': '💳', 'balance': 0, 'is_default': False}
            ]
            goals_data = []
            recent_transactions = []
            total_transactions = 0
            currency = 'RUB'
            default_wallet = 'Наличные'
        
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
            'recent_transactions': recent_transactions,
            'total_transactions': total_transactions,
            'currency': currency,
            'default_wallet': default_wallet
        })
    except Exception as e:
        print(f"Init error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    try:
        data = request.json
        user_id = data.get('user_id')
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        wallet = data.get('wallet', 'Наличные')
        description = data.get('description', '')
        
        if not all([user_id, trans_type, amount, category]):
            return jsonify({'error': 'Missing fields'}), 400
        
        if trans_type not in ['income', 'expense']:
            return jsonify({'error': 'Invalid type'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            transaction_id = db.add_transaction(user_id, trans_type, amount, category, wallet, description)
            
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
                'date': t['date']
            } for t in recent]
        })
    except Exception as e:
        print(f"Transaction error: {e}")
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
                'goal_id': goal_id
            })
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add goal error: {e}")
        return jsonify({'error': str(e)}), 500

# НОВЫЙ ЭНДПОИНТ: Добавить накопления в цель
@app.route('/api/add_to_goal', methods=['POST'])
def add_to_goal():
    try:
        data = request.json
        user_id = data.get('user_id')
        goal_id = data.get('goal_id')
        amount = data.get('amount')
        
        if not all([user_id, goal_id, amount]):
            return jsonify({'error': 'Missing fields'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            # Обновляем прогресс цели
            success = db.update_goal_progress(goal_id, amount)
            if success:
                # Также добавляем транзакцию накопления
                transaction_id = db.add_transaction(user_id, 'expense', amount, 'Накопления', 'Копилка', f'Накопления в цель ID: {goal_id}')
                
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
                    'progress': goal['progress']
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
                return jsonify({'error': 'CoinGecko unavailable'}), 502
            try:
                data = resp.json()
            except Exception:
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
                        return jsonify({'error': 'Alpha Vantage rate limit'}), 429
                else:
                    series = data.get('Time Series (Daily)', {})
                    dates = sorted(series.keys())
                    series_points = [{'t': d, 'v': float(series[d]['4. close'])} for d in dates if '4. close' in series[d]]
                    cache_set(series_key, series_points)
            if not series_points:
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
