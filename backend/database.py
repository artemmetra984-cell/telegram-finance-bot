# backend/database.py
import sqlite3
import os
import shutil
from datetime import datetime, timedelta

SAVINGS_WALLET_NAME = 'Накопления'
SAVINGS_WALLET_ICON = '💰'
SAVINGS_CATEGORIES = ('Накопления', 'Цели')

class Database:
    def __init__(self):
        db_path = self._resolve_db_path()
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self._migrate_legacy_db_if_needed(db_path)
        print(f"📊 Database: {os.path.abspath(db_path)}")
        
        self.conn = sqlite3.connect(db_path, check_same_thread=False, timeout=30)
        self.conn.row_factory = sqlite3.Row
        self._configure_connection()
        self.init_db()
        self._log_database_state(db_path)

    def _resolve_db_path(self):
        configured = os.getenv('DB_PATH')
        if configured:
            configured = configured.strip()
            if os.path.isdir('/data') and configured in {'/finance.db', 'finance.db', './finance.db'}:
                print(f"⚠️ DB_PATH={configured} is unsafe, using /data/finance.db instead")
                return '/data/finance.db'
            return configured

        persistent_dir = os.getenv('PERSISTENT_DATA_DIR')
        if persistent_dir:
            return os.path.join(persistent_dir, 'finance.db')

        # Render persistent disk mount (if configured).
        if os.path.isdir('/data'):
            return '/data/finance.db'

        # Stable local default path independent of current working directory.
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        return os.path.join(project_root, 'data', 'finance.db')

    def _configure_connection(self):
        # Durability/concurrency settings for SQLite.
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=FULL')
        self.conn.execute('PRAGMA foreign_keys=ON')
        self.conn.execute('PRAGMA busy_timeout=5000')

    def _migrate_legacy_db_if_needed(self, target_path):
        if os.path.exists(target_path):
            return

        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        candidates = [
            os.path.join(backend_dir, 'finance.db'),
            os.path.join(project_root, 'finance.db'),
            os.path.abspath('finance.db'),
        ]

        target_abs = os.path.abspath(target_path)
        for candidate in candidates:
            candidate_abs = os.path.abspath(candidate)
            if candidate_abs == target_abs or not os.path.exists(candidate_abs):
                continue
            try:
                shutil.copy2(candidate_abs, target_abs)
                print(f"📦 Migrated database from {candidate_abs} to {target_abs}")
                return
            except Exception as exc:
                print(f"⚠️ Failed to migrate database from {candidate_abs}: {exc}")

    def _log_database_state(self, db_path):
        try:
            size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
            print(f"🗄️ DB file size: {size} bytes")
            if os.path.abspath(db_path).startswith('/data'):
                if os.path.ismount('/data'):
                    print("✅ /data is a mounted persistent disk")
                else:
                    print("⚠️ /data is NOT a mounted disk (data may be ephemeral)")
            cursor = self.conn.cursor()
            for table in ('users', 'transactions', 'goals', 'debts', 'subscriptions'):
                cursor.execute(f'SELECT COUNT(*) as total FROM {table}')
                row = cursor.fetchone()
                total = row['total'] if row and 'total' in row.keys() else 0
                print(f"📈 {table}: {total}")
        except Exception as exc:
            print(f"⚠️ Failed to log DB state: {exc}")
    
    def init_db(self):
        cursor = self.conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                language_code TEXT,
                currency TEXT DEFAULT 'RUB',
                session_token TEXT UNIQUE,
                default_wallet TEXT DEFAULT 'Карта',
                debts_enabled INTEGER DEFAULT 0,
                exclude_savings_from_balance INTEGER DEFAULT 0,
                debt_target_amount REAL DEFAULT 0,
                debt_note TEXT DEFAULT '',
                reminder_enabled INTEGER DEFAULT 1,
                reminder_hour INTEGER DEFAULT 21,
                reminder_last_sent_date TEXT,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица транзакций
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                wallet TEXT DEFAULT 'Карта',
                description TEXT,
                debt_id INTEGER,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица долгов
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS debts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL,
                note TEXT,
                archived INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Таблица категорий
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense', 'savings')) NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💰',
                color TEXT DEFAULT '#007AFF',
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, type, name)
            )
        ''')
        
        # Таблица кошельков
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💳',
                balance REAL DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, name)
            )
        ''')
        
        # Таблица целей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL,
                current_amount REAL DEFAULT 0,
                icon TEXT DEFAULT '🎯',
                color TEXT DEFAULT '#FF9500',
                deadline TEXT,
                archived INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица общего кошелька (1 владелец + 1 участник)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shared_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                member_id INTEGER,
                code TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users (id),
                FOREIGN KEY (member_id) REFERENCES users (id)
            )
        ''')

        # Таблица подписок
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                active INTEGER DEFAULT 0,
                activated_at TIMESTAMP,
                expires_at TEXT,
                is_trial INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Лог одноразовых напоминаний о завершении подписки
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscription_reminder_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                reminder_type TEXT NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, expires_at, reminder_type)
            )
        ''')

        # Таблица платежей NOWPayments
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS nowpayments_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                payment_id INTEGER UNIQUE NOT NULL,
                payment_status TEXT,
                price_amount REAL,
                price_currency TEXT,
                pay_amount REAL,
                pay_currency TEXT,
                pay_address TEXT,
                order_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица счетов CryptoCloud
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cryptocloud_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                uuid TEXT UNIQUE NOT NULL,
                order_id TEXT,
                status TEXT,
                amount REAL,
                currency TEXT,
                address TEXT,
                pay_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица счетов LeCryptio
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lecryptio_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                uuid TEXT UNIQUE NOT NULL,
                order_id TEXT,
                status TEXT,
                amount REAL,
                currency TEXT,
                network TEXT,
                address TEXT,
                pay_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица счетов Crypto Pay
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cryptopay_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                invoice_id INTEGER UNIQUE NOT NULL,
                status TEXT,
                asset TEXT,
                amount TEXT,
                payload TEXT,
                bot_invoice_url TEXT,
                mini_app_invoice_url TEXT,
                web_app_invoice_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица промокодов
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS promo_redemptions (
                code TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                months INTEGER NOT NULL,
                redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица промокодов с лимитом (многоразовые)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS promo_multi_redemptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                months INTEGER NOT NULL,
                redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(code, user_id)
            )
        ''')
        
        # Индексы для быстрого поиска
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_debt_id ON transactions(debt_id)')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_owner ON shared_wallets(owner_id)')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_member ON shared_wallets(member_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_reminder_unique ON subscription_reminder_log(user_id, expires_at, reminder_type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_nowpayments_user_id ON nowpayments_payments(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_cryptocloud_user_id ON cryptocloud_invoices(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_lecryptio_user_id ON lecryptio_invoices(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_cryptopay_user_id ON cryptopay_invoices(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_promo_user_id ON promo_redemptions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_promo_multi_code ON promo_multi_redemptions(code)')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_multi_code_user ON promo_multi_redemptions(code, user_id)')

        # ensure new columns for subscriptions
        cursor.execute("PRAGMA table_info(subscriptions)")
        existing_cols = [row['name'] for row in cursor.fetchall()]
        if 'expires_at' not in existing_cols:
            try:
                cursor.execute('ALTER TABLE subscriptions ADD COLUMN expires_at TEXT')
            except Exception:
                pass
        if 'is_trial' not in existing_cols:
            try:
                cursor.execute('ALTER TABLE subscriptions ADD COLUMN is_trial INTEGER DEFAULT 0')
            except Exception:
                pass
        
        # Миграция: поле debts_enabled
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN debts_enabled INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        # Миграция: настройка исключения накоплений из остатка
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN exclude_savings_from_balance INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        # Миграция: поле debt_id для транзакций
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN debt_id INTEGER")
        except sqlite3.OperationalError:
            pass
        # Миграция: поле archived для долгов
        try:
            cursor.execute("ALTER TABLE debts ADD COLUMN archived INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        # Миграция: поле archived для целей
        try:
            cursor.execute("ALTER TABLE goals ADD COLUMN archived INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        # Миграция: долг (сумма и комментарий)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN debt_target_amount REAL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN debt_note TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        # Миграция: ежедневные напоминания
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reminder_enabled INTEGER DEFAULT 1")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reminder_hour INTEGER DEFAULT 21")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reminder_last_sent_date TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN language_code TEXT")
        except sqlite3.OperationalError:
            pass
        
        self.conn.commit()
        print("✅ Tables ready")
    
    def get_or_create_user(self, telegram_id, username, first_name, session_token=None, language_code=None):
        cursor = self.conn.cursor()
        clean_username = (username or '').strip() or None
        clean_first_name = (first_name or '').strip() or None
        clean_language_code = (language_code or '').strip() or None
        
        cursor.execute('''
            SELECT id, currency, session_token, default_wallet FROM users 
            WHERE telegram_id = ? OR session_token = ?
        ''', (telegram_id, session_token))
        
        user = cursor.fetchone()
        
        if user:
            print(f"👤 User exists: {user['id']}")
            should_update = (
                (session_token and user['session_token'] != session_token)
                or clean_username is not None
                or clean_first_name is not None
                or clean_language_code is not None
            )
            if should_update:
                cursor.execute('''
                    UPDATE users
                    SET session_token = COALESCE(?, session_token),
                        username = COALESCE(?, username),
                        first_name = COALESCE(?, first_name),
                        language_code = COALESCE(?, language_code),
                        last_login = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (session_token if session_token else None, clean_username, clean_first_name, clean_language_code, user['id']))
                self.conn.commit()
            
            return user['id'], user['currency'] or 'RUB', user['default_wallet'] or 'Карта', False
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, language_code, session_token, last_login) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (telegram_id, clean_username, clean_first_name, clean_language_code, session_token))
            user_id = cursor.lastrowid
            
            # Стандартные категории с цветами iOS
            default_categories = [
                (user_id, 'income', 'Зарплата', '💰', '#34C759'),
                (user_id, 'income', 'Фриланс', '💻', '#007AFF'),
                (user_id, 'income', 'Инвестиции', '📈', '#5856D6'),
                (user_id, 'expense', 'Продукты', '🛒', '#FF9500'),
                (user_id, 'expense', 'Транспорт', '🚗', '#FF5E3A'),
                (user_id, 'expense', 'Развлечения', '🎬', '#FF2D55'),
                (user_id, 'expense', 'ЖКХ', '🏠', '#AF52DE'),
                (user_id, 'expense', 'Связь', '📱', '#FF3B30'),
                (user_id, 'expense', 'Еда вне дома', '🍕', '#FF9500'),
                (user_id, 'savings', 'Накопления', '💰', '#FFD60A'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, icon, color) 
                VALUES (?, ?, ?, ?, ?)
            ''', default_categories)
            
            # Стандартные кошельки
            default_wallets = [
                (user_id, 'Карта', '💳', 0, 1),
                (user_id, 'Наличные', '💵', 0, 0),
            ]
            
            cursor.executemany('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default) 
                VALUES (?, ?, ?, ?, ?)
            ''', default_wallets)
            
            self.conn.commit()
            print(f"👤 New user: {first_name} ({user_id})")
            return user_id, 'RUB', 'Карта', True

    def reset_user_financial_data(self, user_id):
        owner_id = self._resolve_owner_id(user_id)
        cursor = self.conn.cursor()
        cursor.execute('SELECT id FROM users WHERE id = ?', (owner_id,))
        if not cursor.fetchone():
            return {'error': 'user_not_found'}

        try:
            deleted = {}
            for table in ('transactions', 'goals', 'debts', 'categories', 'wallets'):
                cursor.execute(f'SELECT COUNT(*) AS total FROM {table} WHERE user_id = ?', (owner_id,))
                row = cursor.fetchone()
                deleted[table] = int(row['total'] or 0) if row else 0

            cursor.execute('DELETE FROM transactions WHERE user_id = ?', (owner_id,))
            cursor.execute('DELETE FROM goals WHERE user_id = ?', (owner_id,))
            cursor.execute('DELETE FROM debts WHERE user_id = ?', (owner_id,))
            cursor.execute('DELETE FROM categories WHERE user_id = ?', (owner_id,))
            cursor.execute('DELETE FROM wallets WHERE user_id = ?', (owner_id,))

            default_categories = [
                (owner_id, 'income', 'Зарплата', '💰', '#34C759'),
                (owner_id, 'income', 'Фриланс', '💻', '#007AFF'),
                (owner_id, 'income', 'Инвестиции', '📈', '#5856D6'),
                (owner_id, 'expense', 'Продукты', '🛒', '#FF9500'),
                (owner_id, 'expense', 'Транспорт', '🚗', '#FF5E3A'),
                (owner_id, 'expense', 'Развлечения', '🎬', '#FF2D55'),
                (owner_id, 'expense', 'ЖКХ', '🏠', '#AF52DE'),
                (owner_id, 'expense', 'Связь', '📱', '#FF3B30'),
                (owner_id, 'expense', 'Еда вне дома', '🍕', '#FF9500'),
                (owner_id, 'savings', 'Накопления', '💰', '#FFD60A')
            ]
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, icon, color)
                VALUES (?, ?, ?, ?, ?)
            ''', default_categories)

            default_wallets = [
                (owner_id, 'Карта', '💳', 0, 1),
                (owner_id, 'Наличные', '💵', 0, 0)
            ]
            cursor.executemany('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default)
                VALUES (?, ?, ?, ?, ?)
            ''', default_wallets)

            cursor.execute('''
                UPDATE users
                SET default_wallet = 'Карта',
                    debts_enabled = 0,
                    debt_target_amount = 0,
                    debt_note = ''
                WHERE id = ?
            ''', (owner_id,))

            self.conn.commit()
            return {'success': True, 'owner_id': owner_id, 'deleted': deleted}
        except Exception:
            self.conn.rollback()
            raise
    
    def get_user_by_session(self, session_token):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, telegram_id, username, first_name, currency, default_wallet, debts_enabled, debt_target_amount, debt_note
            FROM users WHERE session_token = ?
        ''', (session_token,))
        return cursor.fetchone()

    def get_daily_reminder_targets(self, date_key, hour):
        cursor = self.conn.cursor()
        hour_value = int(hour)
        cursor.execute('''
            SELECT id, telegram_id, language_code
            FROM users
            WHERE telegram_id IS NOT NULL
              AND COALESCE(reminder_enabled, 1) = 1
              AND COALESCE(reminder_hour, 21) = ?
              AND (reminder_last_sent_date IS NULL OR reminder_last_sent_date <> ?)
        ''', (hour_value, date_key))
        return cursor.fetchall()

    def mark_daily_reminder_sent(self, user_id, date_key):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE users
            SET reminder_last_sent_date = ?
            WHERE id = ?
        ''', (date_key, user_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def get_subscription_expiry_reminder_candidates(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT
                u.id AS user_id,
                u.telegram_id,
                u.language_code,
                s.expires_at,
                COALESCE(s.is_trial, 0) AS is_trial
            FROM subscriptions s
            INNER JOIN users u ON u.id = s.user_id
            WHERE u.telegram_id IS NOT NULL
              AND COALESCE(s.active, 0) = 1
              AND s.expires_at IS NOT NULL
        ''')
        return cursor.fetchall()

    def has_subscription_expiry_reminder_sent(self, user_id, expires_at, reminder_type):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT 1
            FROM subscription_reminder_log
            WHERE user_id = ? AND expires_at = ? AND reminder_type = ?
            LIMIT 1
        ''', (owner_id, str(expires_at), str(reminder_type)))
        return cursor.fetchone() is not None

    def mark_subscription_expiry_reminder_sent(self, user_id, expires_at, reminder_type):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT OR IGNORE INTO subscription_reminder_log (user_id, expires_at, reminder_type)
            VALUES (?, ?, ?)
        ''', (owner_id, str(expires_at), str(reminder_type)))
        self.conn.commit()
        return cursor.rowcount > 0

    def get_debts_enabled(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT debts_enabled FROM users WHERE id = ?', (owner_id,))
        row = cursor.fetchone()
        return bool(row['debts_enabled']) if row and row['debts_enabled'] is not None else False

    def get_exclude_savings_from_balance(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT exclude_savings_from_balance FROM users WHERE id = ?', (owner_id,))
        row = cursor.fetchone()
        return bool(row['exclude_savings_from_balance']) if row and row['exclude_savings_from_balance'] is not None else False

    def get_debt_settings(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT debt_target_amount, debt_note FROM users WHERE id = ?', (owner_id,))
        row = cursor.fetchone()
        if not row:
            return {'target_amount': 0, 'note': ''}
        return {
            'target_amount': row['debt_target_amount'] or 0,
            'note': row['debt_note'] or ''
        }

    def set_debts_enabled(self, user_id, enabled):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('UPDATE users SET debts_enabled = ? WHERE id = ?', (1 if enabled else 0, owner_id))
        self.conn.commit()
        return True

    def set_exclude_savings_from_balance(self, user_id, enabled):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute(
            'UPDATE users SET exclude_savings_from_balance = ? WHERE id = ?',
            (1 if enabled else 0, owner_id)
        )
        self.conn.commit()
        return True

    def create_debt(self, user_id, name, target_amount, note=''):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT INTO debts (user_id, name, target_amount, note)
            VALUES (?, ?, ?, ?)
        ''', (owner_id, name, target_amount, note or ''))
        self.conn.commit()
        return cursor.lastrowid

    def get_debt_by_id(self, user_id, debt_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT * FROM debts WHERE id = ? AND user_id = ?', (debt_id, owner_id))
        return cursor.fetchone()

    def get_debt_paid_amount(self, user_id, debt_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_id = ? AND debt_id = ? AND type = 'expense' AND category = 'Долги'
        ''', (owner_id, debt_id))
        row = cursor.fetchone()
        return float(row['total']) if row and row['total'] else 0

    def update_debt(self, user_id, debt_id, name, target_amount, note=''):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            UPDATE debts
            SET name = ?, target_amount = ?, note = ?
            WHERE id = ? AND user_id = ?
        ''', (name, target_amount, note or '', debt_id, owner_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def delete_debt(self, user_id, debt_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('DELETE FROM debts WHERE id = ? AND user_id = ?', (debt_id, owner_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def set_debt_archived(self, user_id, debt_id, archived):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('UPDATE debts SET archived = ? WHERE id = ? AND user_id = ?', (1 if archived else 0, debt_id, owner_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def get_debts(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT COUNT(*) as count FROM debts WHERE user_id = ?', (owner_id,))
        count_row = cursor.fetchone()
        if count_row and count_row['count'] == 0:
            cursor.execute('SELECT debt_target_amount, debt_note FROM users WHERE id = ?', (owner_id,))
            legacy = cursor.fetchone()
            if legacy and legacy['debt_target_amount'] and legacy['debt_target_amount'] > 0:
                cursor.execute('''
                    INSERT INTO debts (user_id, name, target_amount, note)
                    VALUES (?, ?, ?, ?)
                ''', (owner_id, 'Долг', legacy['debt_target_amount'], legacy['debt_note'] or ''))
                self.conn.commit()
        cursor.execute('''
            SELECT d.id, d.name, d.target_amount, d.note, d.archived,
                   COALESCE(SUM(t.amount), 0) as paid_amount
            FROM debts d
            LEFT JOIN transactions t
              ON t.debt_id = d.id AND t.user_id = ? AND t.type = 'expense' AND t.category = 'Долги'
            WHERE d.user_id = ?
            GROUP BY d.id
            ORDER BY d.created_at DESC
        ''', (owner_id, owner_id))
        return cursor.fetchall()

    def set_debt_settings(self, user_id, amount, note=''):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            UPDATE users
            SET debt_target_amount = ?, debt_note = ?, debts_enabled = 1
            WHERE id = ?
        ''', (amount, note or '', owner_id))
        self.conn.commit()
        return True

    def get_user_id_by_username(self, username):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id FROM users WHERE lower(username) = lower(?)
        ''', (username,))
        row = cursor.fetchone()
        return row['id'] if row else None

    def get_username_by_id(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT username FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        return row['username'] if row and row['username'] else None

    def _resolve_owner_id(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT owner_id, member_id FROM shared_wallets
            WHERE owner_id = ? OR member_id = ?
        ''', (user_id, user_id))
        row = cursor.fetchone()
        if row:
            return row['owner_id']
        return user_id

    def _ensure_wallet_row(self, cursor, owner_id, wallet_name, icon='💳', initial_balance=0.0):
        cursor.execute('SELECT name FROM wallets WHERE user_id = ? AND name = ?', (owner_id, wallet_name))
        if cursor.fetchone():
            return
        cursor.execute('''
            INSERT INTO wallets (user_id, name, icon, balance, is_default)
            VALUES (?, ?, ?, ?, ?)
        ''', (owner_id, wallet_name, icon, float(initial_balance or 0), 0))

    def _ensure_savings_wallet_cursor(self, cursor, owner_id, create_if_missing=False):
        cursor.execute('SELECT balance FROM wallets WHERE user_id = ? AND name = ?', (owner_id, SAVINGS_WALLET_NAME))
        row = cursor.fetchone()
        if row:
            return float(row['balance'] or 0)

        cursor.execute('''
            SELECT COALESCE(SUM(CASE WHEN type = 'expense' AND category IN ('Накопления', 'Цели') THEN amount ELSE 0 END), 0) AS total_savings
            FROM transactions
            WHERE user_id = ?
        ''', (owner_id,))
        total_row = cursor.fetchone()
        total_savings = float(total_row['total_savings'] or 0) if total_row else 0.0

        if total_savings <= 0 and not create_if_missing:
            return 0.0

        self._ensure_wallet_row(
            cursor,
            owner_id,
            SAVINGS_WALLET_NAME,
            icon=SAVINGS_WALLET_ICON,
            initial_balance=max(total_savings, 0.0)
        )
        return max(total_savings, 0.0)

    def ensure_savings_wallet_from_history(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=False)
        self.conn.commit()

    def get_savings_wallet_balance(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT balance FROM wallets WHERE user_id = ? AND name = ?', (owner_id, SAVINGS_WALLET_NAME))
        row = cursor.fetchone()
        return float(row['balance'] or 0) if row else 0.0

    def get_shared_wallet_status(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT sw.id, sw.owner_id, sw.member_id, sw.code,
                   o.first_name as owner_name, o.username as owner_username,
                   m.first_name as member_name, m.username as member_username
            FROM shared_wallets sw
            LEFT JOIN users o ON o.id = sw.owner_id
            LEFT JOIN users m ON m.id = sw.member_id
            WHERE sw.owner_id = ? OR sw.member_id = ?
        ''', (user_id, user_id))
        return cursor.fetchone()

    def create_shared_wallet(self, owner_id, code):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id FROM shared_wallets WHERE owner_id = ? OR member_id = ?
        ''', (owner_id, owner_id))
        if cursor.fetchone():
            return None
        try:
            cursor.execute('''
                INSERT INTO shared_wallets (owner_id, code)
                VALUES (?, ?)
            ''', (owner_id, code))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None

    def join_shared_wallet(self, user_id, code):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id FROM shared_wallets WHERE owner_id = ? OR member_id = ?
        ''', (user_id, user_id))
        if cursor.fetchone():
            return {'error': 'already_in'}
        cursor.execute('''
            SELECT id, owner_id, member_id FROM shared_wallets WHERE code = ?
        ''', (code,))
        row = cursor.fetchone()
        if not row:
            return {'error': 'not_found'}
        if row['member_id'] and row['member_id'] != user_id:
            return {'error': 'full'}
        if row['owner_id'] == user_id:
            return {'error': 'owner'}
        cursor.execute('''
            UPDATE shared_wallets SET member_id = ? WHERE id = ?
        ''', (user_id, row['id']))
        self.conn.commit()
        return {'success': True}

    def leave_shared_wallet(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, owner_id, member_id FROM shared_wallets
            WHERE owner_id = ? OR member_id = ?
        ''', (user_id, user_id))
        row = cursor.fetchone()
        if not row:
            return {'error': 'not_found'}
        if row['member_id'] == user_id:
            cursor.execute('UPDATE shared_wallets SET member_id = NULL WHERE id = ?', (row['id'],))
            self.conn.commit()
            return {'success': True, 'role': 'member'}
        if row['owner_id'] == user_id:
            cursor.execute('DELETE FROM shared_wallets WHERE id = ?', (row['id'],))
            self.conn.commit()
            return {'success': True, 'role': 'owner'}
        return {'error': 'not_found'}
    
    def get_user_stats(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN category IN ('Накопления','Цели') AND type = 'expense' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions WHERE user_id = ?
        ''', (owner_id,))
        
        result = cursor.fetchone()
        summary = {
            'total_income': float(result['total_income']) if result['total_income'] else 0,
            'total_expense': float(result['total_expense']) if result['total_expense'] else 0,
            'total_savings': float(result['total_savings']) if result['total_savings'] else 0,
            'balance': float((result['total_income'] or 0) - (result['total_expense'] or 0))
        }
        
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'income'
            GROUP BY category
        ''', (owner_id,))
        income_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'expense'
            GROUP BY category
        ''', (owner_id,))
        expense_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT name, balance FROM wallets WHERE user_id = ?
        ''', (owner_id,))
        wallet_balances = {row['name']: float(row['balance']) for row in cursor.fetchall()}
        if SAVINGS_WALLET_NAME in wallet_balances:
            summary['total_savings'] = max(0.0, wallet_balances[SAVINGS_WALLET_NAME])
        
        return {
            'summary': summary,
            'income': income_stats,
            'expense': expense_stats,
            'wallets': wallet_balances
        }
    
    def add_transaction(self, user_id, trans_type, amount, category, wallet, description, debt_id=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)

        if trans_type == 'expense' and category in SAVINGS_CATEGORIES and wallet != SAVINGS_WALLET_NAME:
            # Ensure target savings wallet exists before insert to avoid counting current deposit twice.
            self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=True)
        if wallet == SAVINGS_WALLET_NAME:
            self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=True)
        else:
            self._ensure_wallet_row(cursor, owner_id, wallet)
        
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, category, wallet, description, debt_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (owner_id, trans_type, amount, category, wallet, description or '', debt_id))
        
        if trans_type == 'income':
            cursor.execute('''
                UPDATE wallets SET balance = balance + ? 
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, wallet))
        else:
            cursor.execute('''
                UPDATE wallets SET balance = balance - ? 
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, wallet))

        if trans_type == 'expense' and category in SAVINGS_CATEGORIES and wallet != SAVINGS_WALLET_NAME:
            cursor.execute('''
                UPDATE wallets SET balance = balance + ?
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, SAVINGS_WALLET_NAME))
        
        self.conn.commit()
        return cursor.lastrowid

    def get_transaction_by_id(self, user_id, transaction_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM transactions
            WHERE id = ? AND user_id = ?
        ''', (transaction_id, owner_id))
        return cursor.fetchone()

    def delete_transaction(self, user_id, transaction_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM transactions
            WHERE id = ? AND user_id = ?
        ''', (transaction_id, owner_id))
        transaction = cursor.fetchone()
        if not transaction:
            return False
        amount = float(transaction['amount']) if transaction['amount'] is not None else 0
        wallet = transaction['wallet']
        category = transaction['category']
        if transaction['type'] == 'income':
            cursor.execute('''
                UPDATE wallets SET balance = balance - ?
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, wallet))
        else:
            cursor.execute('''
                UPDATE wallets SET balance = balance + ?
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, wallet))
        if transaction['type'] == 'expense' and category in SAVINGS_CATEGORIES and wallet != SAVINGS_WALLET_NAME:
            self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=True)
            cursor.execute('''
                UPDATE wallets SET balance = MAX(balance - ?, 0)
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, SAVINGS_WALLET_NAME))
        cursor.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (transaction_id, owner_id))
        self.conn.commit()
        return True

    def update_transaction(self, user_id, transaction_id, trans_type, amount, category, wallet, description, debt_id=None, trans_date=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM transactions
            WHERE id = ? AND user_id = ?
        ''', (transaction_id, owner_id))
        transaction = cursor.fetchone()
        if not transaction:
            return False
        old_amount = float(transaction['amount']) if transaction['amount'] is not None else 0
        old_wallet = transaction['wallet']
        old_type = transaction['type']
        old_category = transaction['category']

        if wallet == SAVINGS_WALLET_NAME or old_wallet == SAVINGS_WALLET_NAME:
            self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=True)
        if wallet != SAVINGS_WALLET_NAME:
            self._ensure_wallet_row(cursor, owner_id, wallet)

        if old_type == 'income':
            cursor.execute('''
                UPDATE wallets SET balance = balance - ?
                WHERE user_id = ? AND name = ?
            ''', (old_amount, owner_id, old_wallet))
        else:
            cursor.execute('''
                UPDATE wallets SET balance = balance + ?
                WHERE user_id = ? AND name = ?
            ''', (old_amount, owner_id, old_wallet))
        if old_type == 'expense' and old_category in SAVINGS_CATEGORIES and old_wallet != SAVINGS_WALLET_NAME:
            self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=True)
            cursor.execute('''
                UPDATE wallets SET balance = MAX(balance - ?, 0)
                WHERE user_id = ? AND name = ?
            ''', (old_amount, owner_id, SAVINGS_WALLET_NAME))

        if trans_type == 'income':
            cursor.execute('''
                UPDATE wallets SET balance = balance + ?
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, wallet))
        else:
            cursor.execute('''
                UPDATE wallets SET balance = balance - ?
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, wallet))
        if trans_type == 'expense' and category in SAVINGS_CATEGORIES and wallet != SAVINGS_WALLET_NAME:
            self._ensure_savings_wallet_cursor(cursor, owner_id, create_if_missing=True)
            cursor.execute('''
                UPDATE wallets SET balance = balance + ?
                WHERE user_id = ? AND name = ?
            ''', (amount, owner_id, SAVINGS_WALLET_NAME))

        cursor.execute('''
            UPDATE transactions
            SET type = ?, amount = ?, category = ?, wallet = ?, description = ?, debt_id = ?, date = COALESCE(?, date)
            WHERE id = ? AND user_id = ?
        ''', (trans_type, amount, category, wallet, description or '', debt_id, trans_date, transaction_id, owner_id))
        self.conn.commit()
        return True
    
    def get_recent_transactions(self, user_id, limit=5):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY date DESC 
            LIMIT ?
        ''', (owner_id, limit))
        return cursor.fetchall()
    
    def get_wallets(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT name, icon, balance, is_default FROM wallets 
            WHERE user_id = ? ORDER BY is_default DESC, name
        ''', (owner_id,))
        return cursor.fetchall()

    def get_wallet_balance(self, user_id, wallet_name):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT balance FROM wallets
            WHERE user_id = ? AND name = ?
        ''', (owner_id, wallet_name))
        row = cursor.fetchone()
        if row and row['balance'] is not None:
            return float(row['balance'])
        return 0.0
    
    def set_default_wallet(self, user_id, wallet_name):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        
        cursor.execute('''
            UPDATE wallets SET is_default = 0 WHERE user_id = ?
        ''', (owner_id,))
        
        cursor.execute('''
            UPDATE wallets SET is_default = 1 
            WHERE user_id = ? AND name = ?
        ''', (owner_id, wallet_name))
        
        cursor.execute('''
            UPDATE users SET default_wallet = ? WHERE id = ?
        ''', (wallet_name, owner_id))
        
        self.conn.commit()
        return True
    
    def get_goals(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT id, name, target_amount, current_amount, icon, color, deadline, archived,
                   (current_amount / target_amount * 100) as progress
            FROM goals WHERE user_id = ? ORDER BY archived ASC, created_at DESC
        ''', (owner_id,))
        return cursor.fetchall()

    def get_goal_by_id(self, user_id, goal_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT * FROM goals WHERE id = ? AND user_id = ?', (goal_id, owner_id))
        return cursor.fetchone()
    
    def add_goal(self, user_id, name, target_amount, icon, color, deadline=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT INTO goals (user_id, name, target_amount, icon, color, deadline)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (owner_id, name, target_amount, icon, color, deadline))
        self.conn.commit()
        return cursor.lastrowid

    def update_goal(self, user_id, goal_id, name, target_amount, icon, color, deadline=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            UPDATE goals
            SET name = ?, target_amount = ?, icon = ?, color = ?, deadline = ?
            WHERE id = ? AND user_id = ?
        ''', (name, target_amount, icon, color, deadline, goal_id, owner_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def set_goal_archived(self, user_id, goal_id, archived):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('UPDATE goals SET archived = ? WHERE id = ? AND user_id = ?', (1 if archived else 0, goal_id, owner_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def move_goal_transactions_to_piggybank(self, user_id, goal_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        pattern = f'%Накопления в цель ID: {goal_id}%'
        cursor.execute('''
            UPDATE transactions
            SET category = 'Накопления'
            WHERE user_id = ?
              AND type = 'expense'
              AND category = 'Цели'
              AND description LIKE ?
        ''', (owner_id, pattern))
        self.conn.commit()
        return cursor.rowcount

    def delete_goal(self, user_id, goal_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('DELETE FROM goals WHERE id = ? AND user_id = ?', (goal_id, owner_id))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def update_goal_progress(self, goal_id, amount):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE goals SET current_amount = current_amount + ? 
            WHERE id = ?
        ''', (amount, goal_id))
        self.conn.commit()
        return True
    
    def add_category(self, user_id, category_type, name, icon, color):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        try:
            cursor.execute('''
                INSERT INTO categories (user_id, type, name, icon, color) 
                VALUES (?, ?, ?, ?, ?)
            ''', (owner_id, category_type, name, icon, color))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None

    def delete_category_with_transactions(self, user_id, category_type, name):
        owner_id = self._resolve_owner_id(user_id)
        trans_type = 'income' if category_type == 'income' else 'expense'

        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id FROM transactions
            WHERE user_id = ? AND type = ? AND category = ?
            ORDER BY id
        ''', (owner_id, trans_type, name))
        transaction_ids = [int(row['id']) for row in cursor.fetchall()]

        deleted_transactions = 0
        for transaction_id in transaction_ids:
            if self.delete_transaction(owner_id, transaction_id):
                deleted_transactions += 1

        cursor = self.conn.cursor()
        cursor.execute('''
            DELETE FROM categories
            WHERE user_id = ? AND type = ? AND name = ?
        ''', (owner_id, category_type, name))
        deleted_category = cursor.rowcount > 0
        self.conn.commit()

        if not deleted_category and deleted_transactions == 0:
            return {'error': 'not_found'}

        return {
            'success': True,
            'deleted_category': deleted_category,
            'deleted_transactions': deleted_transactions
        }
    
    def get_categories(self, user_id, trans_type=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        
        if trans_type:
            cursor.execute('''
                SELECT name, icon, color FROM categories 
                WHERE user_id = ? AND type = ?
                ORDER BY name
            ''', (owner_id, trans_type))
        else:
            cursor.execute('''
                SELECT name, type, icon, color FROM categories 
                WHERE user_id = ?
                ORDER BY type, name
            ''', (owner_id,))
        
        return cursor.fetchall()
    
    def get_user_currency(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT currency FROM users WHERE id = ?', (user_id,))
        result = cursor.fetchone()
        return result['currency'] if result else 'RUB'

    def get_effective_default_wallet(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT default_wallet FROM users WHERE id = ?', (owner_id,))
        result = cursor.fetchone()
        return result['default_wallet'] if result and result['default_wallet'] else 'Карта'

    def get_subscription_status(self, user_id):
        info = self.get_subscription_info(user_id)
        return bool(info['active'])

    def get_subscription_info(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT active, activated_at, expires_at, COALESCE(is_trial, 0) AS is_trial FROM subscriptions WHERE user_id = ?', (owner_id,))
        row = cursor.fetchone()
        if not row:
            return {'active': False, 'activated_at': None, 'expires_at': None, 'is_trial': False}
        active = bool(row['active'])
        expires_at = row['expires_at']
        activated_at = row['activated_at']
        is_trial = bool(row['is_trial'])
        if expires_at:
            try:
                exp = datetime.fromisoformat(expires_at)
                if datetime.utcnow() > exp:
                    active = False
                    cursor.execute('UPDATE subscriptions SET active = 0 WHERE user_id = ?', (owner_id,))
                    self.conn.commit()
            except Exception:
                pass
        return {'active': active, 'activated_at': activated_at, 'expires_at': expires_at, 'is_trial': is_trial}

    def set_subscription_active(self, user_id, active=True, months=None, days=None, extend=True, trial=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT active, activated_at, expires_at, COALESCE(is_trial, 0) AS is_trial FROM subscriptions WHERE user_id = ?', (owner_id,))
        row = cursor.fetchone()
        now = datetime.utcnow()
        activated_at = now.isoformat()
        expires_at = None
        is_trial = 0
        if row:
            if row['expires_at']:
                expires_at = row['expires_at']
            is_trial = int(row['is_trial'] or 0)
        if active and months:
            start = now
            if extend and expires_at:
                try:
                    existing = datetime.fromisoformat(expires_at)
                    if existing > now:
                        start = existing
                except Exception:
                    pass
            expires_at = self._add_months(start, months).isoformat()
            is_trial = 0 if trial is None else (1 if trial else 0)
            if start == now:
                activated_at = now.isoformat()
            elif row and row['activated_at']:
                activated_at = row['activated_at']
        elif active and days:
            start = now
            if extend and expires_at:
                try:
                    existing = datetime.fromisoformat(expires_at)
                    if existing > now:
                        start = existing
                except Exception:
                    pass
            expires_at = (start + timedelta(days=int(days))).isoformat()
            if trial is not None:
                is_trial = 1 if trial else 0
            if start == now:
                activated_at = now.isoformat()
            elif row and row['activated_at']:
                activated_at = row['activated_at']
        elif not active:
            expires_at = None
            is_trial = 0
        if row:
            cursor.execute('''
                UPDATE subscriptions
                SET active = ?, activated_at = ?, expires_at = ?, is_trial = ?
                WHERE user_id = ?
            ''', (1 if active else 0, activated_at, expires_at, int(is_trial), owner_id))
        else:
            cursor.execute('''
                INSERT INTO subscriptions (user_id, active, activated_at, expires_at, is_trial)
                VALUES (?, ?, ?, ?, ?)
            ''', (owner_id, 1 if active else 0, activated_at, expires_at, int(is_trial)))
        self.conn.commit()
        return True

    def _add_months(self, dt_value, months):
        month_index = dt_value.month - 1 + int(months)
        year = dt_value.year + month_index // 12
        month = month_index % 12 + 1
        day = min(dt_value.day, self._days_in_month(year, month))
        return dt_value.replace(year=year, month=month, day=day)

    def _days_in_month(self, year, month):
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        return (next_month - timedelta(days=1)).day

    def create_nowpayment(self, user_id, payment_id, status, price_amount, price_currency, pay_amount, pay_currency, pay_address, order_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT OR REPLACE INTO nowpayments_payments
            (user_id, payment_id, payment_status, price_amount, price_currency, pay_amount, pay_currency, pay_address, order_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (owner_id, payment_id, status, price_amount, price_currency, pay_amount, pay_currency, pay_address, order_id))
        self.conn.commit()
        return True

    def update_nowpayment_status(self, payment_id, status):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE nowpayments_payments SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE payment_id = ?
        ''', (status, payment_id))
        self.conn.commit()
        return True

    def get_nowpayment(self, payment_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM nowpayments_payments WHERE payment_id = ?
        ''', (payment_id,))
        return cursor.fetchone()

    def get_nowpayment_by_order(self, order_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM nowpayments_payments WHERE order_id = ?
        ''', (order_id,))
        return cursor.fetchone()

    def get_latest_nowpayment(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM nowpayments_payments
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 1
        ''', (owner_id,))
        return cursor.fetchone()

    def create_cryptocloud_invoice(self, user_id, uuid_value, order_id, status, amount, currency, address, pay_url):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT OR REPLACE INTO cryptocloud_invoices
            (user_id, uuid, order_id, status, amount, currency, address, pay_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (owner_id, uuid_value, order_id, status, amount, currency, address, pay_url))
        self.conn.commit()
        return True

    def update_cryptocloud_status(self, uuid_value, status):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE cryptocloud_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (status, uuid_value))
        self.conn.commit()
        return True

    def get_cryptocloud_invoice(self, uuid_value):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM cryptocloud_invoices WHERE uuid = ?
        ''', (uuid_value,))
        return cursor.fetchone()

    def get_cryptocloud_invoice_by_order(self, order_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM cryptocloud_invoices WHERE order_id = ?
        ''', (order_id,))
        return cursor.fetchone()

    def get_latest_cryptocloud_invoice(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM cryptocloud_invoices
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 1
        ''', (owner_id,))
        return cursor.fetchone()

    def create_lecryptio_invoice(self, user_id, uuid_value, order_id, status, amount, currency, network, address, pay_url):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT OR REPLACE INTO lecryptio_invoices
            (user_id, uuid, order_id, status, amount, currency, network, address, pay_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (owner_id, uuid_value, order_id, status, amount, currency, network, address, pay_url))
        self.conn.commit()
        return True

    def update_lecryptio_status(self, uuid_value, status):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE lecryptio_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (status, uuid_value))
        self.conn.commit()
        return True

    def get_lecryptio_invoice(self, uuid_value):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM lecryptio_invoices WHERE uuid = ?
        ''', (uuid_value,))
        return cursor.fetchone()

    def get_lecryptio_invoice_by_order(self, order_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM lecryptio_invoices WHERE order_id = ?
        ''', (order_id,))
        return cursor.fetchone()

    def get_latest_lecryptio_invoice(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM lecryptio_invoices
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 1
        ''', (owner_id,))
        return cursor.fetchone()

    def create_cryptopay_invoice(self, user_id, invoice_id, status, asset, amount, payload, bot_url, mini_url, web_url):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            INSERT OR REPLACE INTO cryptopay_invoices
            (user_id, invoice_id, status, asset, amount, payload, bot_invoice_url, mini_app_invoice_url, web_app_invoice_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (owner_id, invoice_id, status, asset, amount, payload, bot_url, mini_url, web_url))
        self.conn.commit()
        return True

    def update_cryptopay_status(self, invoice_id, status):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE cryptopay_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE invoice_id = ?
        ''', (status, invoice_id))
        self.conn.commit()
        return True

    def get_cryptopay_invoice(self, invoice_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM cryptopay_invoices WHERE invoice_id = ?
        ''', (invoice_id,))
        return cursor.fetchone()

    def get_cryptopay_invoice_by_payload(self, payload):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM cryptopay_invoices WHERE payload = ?
        ''', (payload,))
        return cursor.fetchone()

    def get_latest_cryptopay_invoice(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT * FROM cryptopay_invoices
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 1
        ''', (owner_id,))
        return cursor.fetchone()

    def is_promo_redeemed(self, code):
        cursor = self.conn.cursor()
        cursor.execute('SELECT code FROM promo_redemptions WHERE code = ?', (code,))
        return cursor.fetchone() is not None

    def has_promo_user(self, code, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('SELECT code FROM promo_redemptions WHERE code = ? AND user_id = ?', (code, owner_id))
        return cursor.fetchone() is not None

    def get_promo_redemption_count(self, code):
        cursor = self.conn.cursor()
        cursor.execute('SELECT COUNT(*) as total FROM promo_redemptions WHERE code = ?', (code,))
        row = cursor.fetchone()
        return int(row['total']) if row else 0

    def redeem_promo_code(self, user_id, code, months):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        try:
            cursor.execute('''
                INSERT INTO promo_redemptions (code, user_id, months)
                VALUES (?, ?, ?)
            ''', (code, owner_id, months))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def get_promo_multi_count(self, code):
        cursor = self.conn.cursor()
        cursor.execute('SELECT COUNT(*) as total FROM promo_multi_redemptions WHERE code = ?', (code,))
        row = cursor.fetchone()
        return int(row['total']) if row else 0

    def has_promo_multi_user(self, code, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT id FROM promo_multi_redemptions
            WHERE code = ? AND user_id = ?
        ''', (code, owner_id))
        return cursor.fetchone() is not None

    def redeem_promo_multi_code(self, user_id, code, months):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        try:
            cursor.execute('''
                INSERT INTO promo_multi_redemptions (code, user_id, months)
                VALUES (?, ?, ?)
            ''', (code, owner_id, months))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def update_user_currency(self, user_id, currency):
        cursor = self.conn.cursor()
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
        self.conn.commit()
        return True
    
    def get_financial_summary(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN category IN ('Накопления','Цели') AND type = 'expense' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions WHERE user_id = ?
        ''', (owner_id,))
        
        result = cursor.fetchone()
        if result:
            total_income = float(result['total_income']) if result['total_income'] else 0
            total_expense = float(result['total_expense']) if result['total_expense'] else 0
            total_savings = float(result['total_savings']) if result['total_savings'] else 0
        else:
            total_income = total_expense = total_savings = 0
        
        return {
            'total_income': total_income,
            'total_expense': total_expense,
            'balance': total_income - total_expense,
            'total_savings': total_savings
        }
    
    def get_transactions(self, user_id, limit=50, offset=0, month=None, year=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        
        if month and year:
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
                ORDER BY date DESC 
                LIMIT ? OFFSET ?
            ''', (owner_id, str(year), f'{month:02d}', limit, offset))
        else:
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                ORDER BY date DESC 
                LIMIT ? OFFSET ?
            ''', (owner_id, limit, offset))
        
        return cursor.fetchall()
    
    def get_transactions_count(self, user_id, month=None, year=None):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        
        if month and year:
            cursor.execute('''
                SELECT COUNT(*) as count FROM transactions 
                WHERE user_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
            ''', (owner_id, str(year), f'{month:02d}'))
        else:
            cursor.execute('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', (owner_id,))
        
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    def get_monthly_summary(self, user_id):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        cursor.execute('''
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                SUM(CASE WHEN category IN ('Накопления','Цели') AND type = 'expense' THEN amount ELSE 0 END) as savings
            FROM transactions WHERE user_id = ?
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month DESC
        ''', (owner_id,))
        
        months = []
        for row in cursor.fetchall():
            months.append({
                'month': row['month'],
                'income': float(row['income'] or 0),
                'expense': float(row['expense'] or 0),
                'savings': float(row['savings'] or 0),
                'balance': float((row['income'] or 0) - (row['expense'] or 0))
            })
        
        return months
    
    def get_balance_dynamics(self, user_id, period='week'):
        cursor = self.conn.cursor()
        owner_id = self._resolve_owner_id(user_id)
        
        end_date = datetime.now()
        if period == 'day':
            start_date = end_date - timedelta(days=1)
            group_format = '%Y-%m-%d %H:00'
        elif period == 'week':
            start_date = end_date - timedelta(days=7)
            group_format = '%Y-%m-%d'
        elif period == 'month':
            start_date = end_date - timedelta(days=30)
            group_format = '%Y-%m-%d'
        else:
            start_date = end_date - timedelta(days=7)
            group_format = '%Y-%m-%d'
        
        cursor.execute('''
            SELECT 
                strftime(?, date) as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                SUM(CASE WHEN type = 'expense' AND category IN ('Накопления','Цели') THEN amount ELSE 0 END) as savings
            FROM transactions 
            WHERE user_id = ? AND date >= ?
            GROUP BY strftime(?, date)
            ORDER BY period
        ''', (group_format, owner_id, start_date, group_format))
        
        dynamics = []
        cumulative_balance = 0
        cumulative_savings = 0
        
        for row in cursor.fetchall():
            income = float(row['income'] or 0)
            expense = float(row['expense'] or 0)
            savings = float(row['savings'] or 0)
            balance_change = income - expense
            cumulative_balance += balance_change
            cumulative_savings += savings
            
            dynamics.append({
                'period': row['period'],
                'income': income,
                'expense': expense,
                'balance': cumulative_balance,
                'savings': cumulative_savings
            })
        
        return dynamics

db = Database()
