import sqlite3
import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

class Database:
    def __init__(self):
        db_path = 'finance.db'
        print(f"📊 Database: {os.path.abspath(db_path)}")
        
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()
    
    def init_db(self):
        cursor = self.conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                currency TEXT DEFAULT 'RUB',
                session_token TEXT UNIQUE,
                default_wallet TEXT DEFAULT 'Наличные',
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица транзакций (с goal_id для накоплений)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense', 'savings')) NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                wallet TEXT DEFAULT 'Наличные',
                description TEXT,
                goal_id INTEGER DEFAULT NULL,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE SET NULL
            )
        ''')
        
        # Таблица категорий (savings для накоплений)
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
        
        # Таблица целей (накоплений)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Индексы для производительности
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_goal_id ON transactions(goal_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_deadline ON goals(deadline)')
        
        self.conn.commit()
        print("✅ Таблицы и индексы созданы")
    
    def get_or_create_user(self, telegram_id: int, username: str, first_name: str, session_token: str = None) -> tuple:
        """Создание или получение пользователя"""
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT id, currency, session_token, default_wallet FROM users 
            WHERE telegram_id = ? OR session_token = ?
        ''', (telegram_id, session_token))
        
        user = cursor.fetchone()
        
        if user:
            print(f"👤 Пользователь существует: {user['id']}")
            if session_token and user['session_token'] != session_token:
                cursor.execute('''
                    UPDATE users SET session_token = ?, last_login = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ''', (session_token, user['id']))
                self.conn.commit()
            
            return user['id'], user['currency'] or 'RUB', user['default_wallet'] or 'Наличные'
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, session_token, last_login) 
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (telegram_id, username, first_name, session_token))
            user_id = cursor.lastrowid
            
            # Стандартные категории с плавными цветами
            default_categories = [
                # Доходы
                (user_id, 'income', 'Зарплата', '💰', '#30D158'),
                (user_id, 'income', 'Фриланс', '💻', '#0A84FF'),
                (user_id, 'income', 'Инвестиции', '📈', '#5E5CE6'),
                
                # Расходы
                (user_id, 'expense', 'Продукты', '🛒', '#FF9500'),
                (user_id, 'expense', 'Транспорт', '🚗', '#FF3B30'),
                (user_id, 'expense', 'Развлечения', '🎬', '#FF2D55'),
                (user_id, 'expense', 'ЖКХ', '🏠', '#AF52DE'),
                (user_id, 'expense', 'Связь', '📱', '#FF3B30'),
                (user_id, 'expense', 'Одежда', '👕', '#FF9500'),
                
                # Накопления
                (user_id, 'savings', 'Накопления', '💰', '#BF5AF2'),
                (user_id, 'savings', 'Подушка безопасности', '🛡️', '#30D158'),
                (user_id, 'savings', 'Крупные покупки', '🛍️', '#FF9500'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, icon, color) 
                VALUES (?, ?, ?, ?, ?)
            ''', default_categories)
            
            # Стандартные кошельки
            default_wallets = [
                (user_id, 'Наличные', '💵', 0, 1),
                (user_id, 'Карта', '💳', 0, 0),
                (user_id, 'Вклад', '🏦', 0, 0),
            ]
            
            cursor.executemany('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default) 
                VALUES (?, ?, ?, ?, ?)
            ''', default_wallets)
            
            # Стандартные цели
            default_goals = [
                (user_id, 'Новый телефон', 80000, 25000, '📱', '#0A84FF', '3 месяца'),
                (user_id, 'Путешествие', 200000, 75000, '✈️', '#30D158', '6 месяцев'),
                (user_id, 'Новый ноутбук', 120000, 0, '💻', '#FF9500', '1 год'),
            ]
            
            cursor.executemany('''
                INSERT INTO goals (user_id, name, target_amount, current_amount, icon, color, deadline)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', default_goals)
            
            self.conn.commit()
            print(f"👤 Новый пользователь: {first_name} ({user_id})")
            return user_id, 'RUB', 'Наличные'
    
    def get_user_by_session(self, session_token: str) -> Optional[Dict]:
        """Получение пользователя по токену сессии"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, telegram_id, username, first_name, currency, default_wallet 
            FROM users WHERE session_token = ?
        ''', (session_token,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_user_stats(self, user_id: int) -> Dict:
        """Полная статистика пользователя"""
        cursor = self.conn.cursor()
        
        # Базовая статистика
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type IN ('income', 'savings') THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions WHERE user_id = ?
        ''', (user_id,))
        
        result = cursor.fetchone()
        summary = {
            'total_income': float(result['total_income']) if result['total_income'] else 0,
            'total_expense': float(result['total_expense']) if result['total_expense'] else 0,
            'total_savings': float(result['total_savings']) if result['total_savings'] else 0,
            'balance': float((result['total_income'] or 0) - (result['total_expense'] or 0))
        }
        
        # Статистика по категориям доходов
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'income'
            GROUP BY category
        ''', (user_id,))
        income_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        # Статистика по категориям расходов
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'expense'
            GROUP BY category
        ''', (user_id,))
        expense_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        # Статистика по накоплениям
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'savings'
            GROUP BY category
        ''', (user_id,))
        savings_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        # Кошельки
        cursor.execute('''
            SELECT name, balance FROM wallets WHERE user_id = ?
        ''', (user_id,))
        wallet_balances = {row['name']: float(row['balance']) for row in cursor.fetchall()}
        
        return {
            'summary': summary,
            'income': income_stats,
            'expense': expense_stats,
            'savings': savings_stats,
            'wallets': wallet_balances
        }
    
    def add_transaction(self, user_id: int, trans_type: str, amount: float, 
                       category: str, wallet: str, description: str = '', 
                       goal_id: int = None) -> int:
        """Добавление транзакции с обновлением баланса и целей"""
        cursor = self.conn.cursor()
        
        # Проверяем существование кошелька
        cursor.execute('SELECT name FROM wallets WHERE user_id = ? AND name = ?', 
                      (user_id, wallet))
        if not cursor.fetchone():
            # Создаем кошелёк если не существует
            cursor.execute('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, wallet, '💳', 0, 0))
        
        # Добавляем транзакцию
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, category, wallet, description, goal_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, trans_type, amount, category, wallet, description or '', goal_id))
        
        transaction_id = cursor.lastrowid
        
        # Обновляем баланс кошелька
        if trans_type == 'income' or trans_type == 'savings':
            cursor.execute('''
                UPDATE wallets SET balance = balance + ? 
                WHERE user_id = ? AND name = ?
            ''', (amount, user_id, wallet))
        else:  # expense
            cursor.execute('''
                UPDATE wallets SET balance = balance - ? 
                WHERE user_id = ? AND name = ?
            ''', (amount, user_id, wallet))
        
        # Если транзакция привязана к цели, обновляем цель
        if goal_id:
            cursor.execute('''
                UPDATE goals 
                SET current_amount = current_amount + ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            ''', (amount, goal_id, user_id))
        
        self.conn.commit()
        return transaction_id
    
    def get_recent_transactions(self, user_id: int, limit: int = 10) -> List[Dict]:
        """Последние транзакции"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                t.*,
                g.name as goal_name,
                g.icon as goal_icon
            FROM transactions t
            LEFT JOIN goals g ON t.goal_id = g.id
            WHERE t.user_id = ? 
            ORDER BY t.date DESC 
            LIMIT ?
        ''', (user_id, limit))
        
        transactions = []
        for row in cursor.fetchall():
            trans = dict(row)
            trans['amount'] = float(trans['amount']) if trans['amount'] else 0.0
            transactions.append(trans)
        
        return transactions
    
    def get_wallets(self, user_id: int) -> List[Dict]:
        """Получение кошельков пользователя"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, name, icon, balance, is_default 
            FROM wallets 
            WHERE user_id = ? 
            ORDER BY is_default DESC, balance DESC
        ''', (user_id,))
        
        wallets = []
        for row in cursor.fetchall():
            wallet = dict(row)
            wallet['balance'] = float(wallet['balance']) if wallet['balance'] else 0.0
            wallet['is_default'] = bool(wallet['is_default'])
            wallets.append(wallet)
        
        return wallets
    
    def add_wallet(self, user_id: int, name: str, icon: str = '💳', 
                  balance: float = 0, is_default: bool = False) -> int:
        """Добавление нового кошелька"""
        cursor = self.conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, name, icon, balance, 1 if is_default else 0))
            
            wallet_id = cursor.lastrowid
            
            # Если это кошелёк по умолчанию, сбрасываем другие
            if is_default:
                cursor.execute('''
                    UPDATE wallets SET is_default = 0 
                    WHERE user_id = ? AND id != ?
                ''', (user_id, wallet_id))
                
                cursor.execute('''
                    UPDATE users SET default_wallet = ? WHERE id = ?
                ''', (name, user_id))
            
            self.conn.commit()
            return wallet_id
            
        except sqlite3.IntegrityError:
            raise ValueError(f"Кошелёк с именем '{name}' уже существует")
    
    def set_default_wallet(self, user_id: int, wallet_name: str) -> bool:
        """Установка кошелька по умолчанию"""
        cursor = self.conn.cursor()
        
        try:
            # Сбрасываем все кошельки
            cursor.execute('''
                UPDATE wallets SET is_default = 0 WHERE user_id = ?
            ''', (user_id,))
            
            # Устанавливаем новый
            cursor.execute('''
                UPDATE wallets SET is_default = 1 
                WHERE user_id = ? AND name = ?
            ''', (user_id, wallet_name))
            
            # Обновляем в пользователе
            cursor.execute('''
                UPDATE users SET default_wallet = ? WHERE id = ?
            ''', (wallet_name, user_id))
            
            self.conn.commit()
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"❌ Ошибка установки кошелька: {e}")
            return False
    
    def get_goals(self, user_id: int) -> List[Dict]:
        """Получение целей пользователя"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                id, name, target_amount, current_amount, icon, color, deadline,
                ROUND((current_amount / target_amount * 100), 1) as progress,
                CASE 
                    WHEN deadline IS NOT NULL THEN 
                        julianday(deadline) - julianday('now')
                    ELSE NULL
                END as days_left
            FROM goals 
            WHERE user_id = ? 
            ORDER BY 
                CASE WHEN deadline IS NOT NULL THEN 0 ELSE 1 END,
                deadline,
                created_at DESC
        ''', (user_id,))
        
        goals = []
        for row in cursor.fetchall():
            goal = dict(row)
            goal['target_amount'] = float(goal['target_amount']) if goal['target_amount'] else 0.0
            goal['current_amount'] = float(goal['current_amount']) if goal['current_amount'] else 0.0
            goal['progress'] = float(goal['progress']) if goal['progress'] else 0.0
            goals.append(goal)
        
        return goals
    
    def add_goal(self, user_id: int, name: str, target_amount: float, 
                icon: str = '🎯', color: str = '#FF9500', 
                deadline: str = None, current_amount: float = 0) -> int:
        """Добавление новой цели"""
        cursor = self.conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO goals (user_id, name, target_amount, current_amount, icon, color, deadline)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, name, target_amount, current_amount, icon, color, deadline))
            
            goal_id = cursor.lastrowid
            self.conn.commit()
            return goal_id
            
        except Exception as e:
            print(f"❌ Ошибка добавления цели: {e}")
            raise
    
    def update_goal_progress(self, goal_id: int, user_id: int, amount: float) -> bool:
        """Обновление прогресса цели"""
        cursor = self.conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE goals 
                SET current_amount = current_amount + ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            ''', (amount, goal_id, user_id))
            
            self.conn.commit()
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"❌ Ошибка обновления цели: {e}")
            return False
    
    def add_category(self, user_id: int, category_type: str, name: str, 
                    icon: str = '💰', color: str = '#007AFF') -> int:
        """Добавление категории"""
        cursor = self.conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO categories (user_id, type, name, icon, color) 
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, category_type, name, icon, color))
            
            category_id = cursor.lastrowid
            self.conn.commit()
            return category_id
            
        except sqlite3.IntegrityError:
            raise ValueError(f"Категория '{name}' уже существует")
    
    def get_categories(self, user_id: int, trans_type: str = None) -> List[Dict]:
        """Получение категорий"""
        cursor = self.conn.cursor()
        
        if trans_type:
            cursor.execute('''
                SELECT id, name, icon, color FROM categories 
                WHERE user_id = ? AND type = ?
                ORDER BY name
            ''', (user_id, trans_type))
        else:
            cursor.execute('''
                SELECT id, name, type, icon, color FROM categories 
                WHERE user_id = ?
                ORDER BY type, name
            ''', (user_id,))
        
        categories = []
        for row in cursor.fetchall():
            categories.append(dict(row))
        
        return categories
    
    def get_user_currency(self, user_id: int) -> str:
        """Получение валюты пользователя"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT currency FROM users WHERE id = ?', (user_id,))
        result = cursor.fetchone()
        return result['currency'] if result else 'RUB'
    
    def update_user_currency(self, user_id: int, currency: str) -> bool:
        """Обновление валюты пользователя"""
        cursor = self.conn.cursor()
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def get_transactions(self, user_id: int, limit: int = 50, offset: int = 0, 
                        month: int = None, year: int = None) -> List[Dict]:
        """Получение транзакций с фильтрацией"""
        cursor = self.conn.cursor()
        
        if month and year:
            cursor.execute('''
                SELECT 
                    t.*,
                    g.name as goal_name,
                    g.icon as goal_icon
                FROM transactions t
                LEFT JOIN goals g ON t.goal_id = g.id
                WHERE t.user_id = ? 
                AND strftime('%Y', t.date) = ? 
                AND strftime('%m', t.date) = ?
                ORDER BY t.date DESC 
                LIMIT ? OFFSET ?
            ''', (user_id, str(year), f'{month:02d}', limit, offset))
        else:
            cursor.execute('''
                SELECT 
                    t.*,
                    g.name as goal_name,
                    g.icon as goal_icon
                FROM transactions t
                LEFT JOIN goals g ON t.goal_id = g.id
                WHERE t.user_id = ? 
                ORDER BY t.date DESC 
                LIMIT ? OFFSET ?
            ''', (user_id, limit, offset))
        
        transactions = []
        for row in cursor.fetchall():
            trans = dict(row)
            trans['amount'] = float(trans['amount']) if trans['amount'] else 0.0
            transactions.append(trans)
        
        return transactions
    
    def get_transactions_count(self, user_id: int, month: int = None, year: int = None) -> int:
        """Количество транзакций"""
        cursor = self.conn.cursor()
        
        if month and year:
            cursor.execute('''
                SELECT COUNT(*) as count FROM transactions 
                WHERE user_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
            ''', (user_id, str(year), f'{month:02d}'))
        else:
            cursor.execute('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', (user_id,))
        
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    def get_monthly_summary(self, user_id: int) -> List[Dict]:
        """Месячная статистика"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type IN ('income', 'savings') THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END) as savings
            FROM transactions WHERE user_id = ?
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month DESC
        ''', (user_id,))
        
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
    
    def get_balance_dynamics(self, user_id: int, period: str = 'week') -> List[Dict]:
        """Динамика баланса за период"""
        cursor = self.conn.cursor()
        
        # Определяем формат группировки и период
        if period == 'days':
            group_format = '%Y-%m-%d'
            days = 30
        elif period == 'week':
            group_format = '%Y-%W'
            days = 90
        elif period == 'month':
            group_format = '%Y-%m'
            days = 365
        else:
            group_format = '%Y-%m-%d'
            days = 30
        
        # Начальная дата
        start_date = datetime.now() - timedelta(days=days)
        
        cursor.execute('''
            SELECT 
                strftime(?, date) as period,
                SUM(CASE WHEN type IN ('income', 'savings') THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions 
            WHERE user_id = ? AND date >= ?
            GROUP BY strftime(?, date)
            ORDER BY period
        ''', (group_format, user_id, start_date.isoformat(), group_format))
        
        dynamics = []
        cumulative_balance = 0
        
        for row in cursor.fetchall():
            income = float(row['income'] or 0)
            expense = float(row['expense'] or 0)
            balance_change = income - expense
            cumulative_balance += balance_change
            
            # Форматируем период для отображения
            if period == 'days':
                period_display = datetime.strptime(row['period'], '%Y-%m-%d').strftime('%d.%m')
            elif period == 'week':
                year, week = row['period'].split('-')
                period_display = f'Неделя {int(week)}'
            else:  # month
                period_display = datetime.strptime(row['period'], '%Y-%m').strftime('%b')
            
            dynamics.append({
                'period': row['period'],
                'period_display': period_display,
                'income': income,
                'expense': expense,
                'balance': cumulative_balance
            })
        
        return dynamics
    
    def get_category_stats(self, user_id: int, trans_type: str, limit: int = 10) -> Dict:
        """Статистика по категориям"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = ?
            GROUP BY category
            ORDER BY total DESC
            LIMIT ?
        ''', (user_id, trans_type, limit))
        
        stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        return stats
    
    def backup_user_data(self, user_id: int) -> Dict:
        """Создание резервной копии данных пользователя"""
        data = {
            'wallets': self.get_wallets(user_id),
            'categories': self.get_categories(user_id),
            'goals': self.get_goals(user_id),
            'transactions': self.get_transactions(user_id, limit=1000),
            'stats': self.get_user_stats(user_id),
            'monthly_summary': self.get_monthly_summary(user_id),
            'backup_date': datetime.now().isoformat()
        }
        
        return data
    
    def __del__(self):
        """Деструктор для закрытия соединения"""
        if hasattr(self, 'conn'):
            self.conn.close()

# Глобальный экземпляр базы данных
db = Database()