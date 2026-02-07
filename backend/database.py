"""
DATABASE MODULE - iOS 26 Finance
Полная переработка - только реальные данные пользователя
Версия 4.0
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import hashlib

class Database:
    def __init__(self, db_path: str = 'finance.db'):
        """Инициализация базы данных"""
        self.db_path = db_path
        self.connection = None
        self.init_db()
        print(f"📊 База данных инициализирована: {os.path.abspath(db_path)}")
        
    def get_connection(self):
        """Получение подключения к базе данных"""
        if self.connection is None:
            self.connection = sqlite3.connect(
                self.db_path, 
                check_same_thread=False,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            self.connection.row_factory = sqlite3.Row
            # Включаем внешние ключи и журналирование
            self.connection.execute("PRAGMA foreign_keys = ON")
            self.connection.execute("PRAGMA journal_mode = WAL")
            self.connection.execute("PRAGMA synchronous = NORMAL")
        return self.connection
    
    def close(self):
        """Закрытие соединения с базой данных"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    def init_db(self):
        """Инициализация всех таблиц базы данных"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE,
                username TEXT,
                first_name TEXT,
                session_token TEXT UNIQUE,
                currency TEXT DEFAULT 'RUB',
                theme TEXT DEFAULT 'dark',
                language TEXT DEFAULT 'ru',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        ''')
        
        # Таблица кошельков
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💳',
                balance REAL DEFAULT 0.0,
                is_default INTEGER DEFAULT 0,
                color TEXT DEFAULT '#007AFF',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        ''')
        
        # Таблица категорий доходов
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS income_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💰',
                color TEXT DEFAULT '#34C759',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        ''')
        
        # Таблица категорий расходов
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS expense_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '🛒',
                color TEXT DEFAULT '#FF9500',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        ''')
        
        # Таблица категорий накоплений
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💰',
                color TEXT DEFAULT '#FFD60A',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
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
                current_amount REAL DEFAULT 0.0,
                icon TEXT DEFAULT '🎯',
                color TEXT DEFAULT '#FF9500',
                deadline DATE,
                is_completed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Таблица транзакций
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer', 'savings')),
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                wallet_id INTEGER NOT NULL,
                goal_id INTEGER,
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE,
                FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE SET NULL
            )
        ''')
        
        # Индексы для ускорения поиска
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_income_categories_user_id ON income_categories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON expense_categories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_savings_categories_user_id ON savings_categories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id)')
        
        conn.commit()
        print("✅ Таблицы базы данных созданы/проверены")
    
    def get_or_create_user(self, telegram_id: int, username: str, first_name: str, session_token: str = None) -> Tuple[int, str, str]:
        """Создание или получение пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if not session_token:
            # Генерируем уникальный токен сессии
            session_token = hashlib.sha256(f"{telegram_id}{datetime.now().timestamp()}".encode()).hexdigest()[:32]
        
        # Проверяем существование пользователя
        cursor.execute('''
            SELECT id, currency, session_token FROM users 
            WHERE telegram_id = ? OR session_token = ?
        ''', (telegram_id, session_token))
        
        user = cursor.fetchone()
        
        if user:
            # Обновляем сессию и время входа
            cursor.execute('''
                UPDATE users SET 
                    session_token = ?,
                    last_login = CURRENT_TIMESTAMP,
                    username = COALESCE(?, username),
                    first_name = COALESCE(?, first_name)
                WHERE id = ?
            ''', (session_token, username, first_name, user['id']))
            
            user_id = user['id']
            currency = user['currency'] or 'RUB'
            
        else:
            # Создаем нового пользователя
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, session_token, last_login)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (telegram_id, username, first_name, session_token))
            
            user_id = cursor.lastrowid
            currency = 'RUB'
            
            # Создаем первый кошелек по умолчанию
            cursor.execute('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, 'Наличные', '💵', 0.0, 1))
            
            # Создаем базовые категории (минимум по одной каждого типа)
            base_categories = [
                (user_id, 'Зарплата', '💰', '#34C759', 'income'),
                (user_id, 'Продукты', '🛒', '#FF9500', 'expense'),
                (user_id, 'Накопления', '💰', '#FFD60A', 'savings')
            ]
            
            for cat_user_id, name, icon, color, cat_type in base_categories:
                if cat_type == 'income':
                    cursor.execute('''
                        INSERT INTO income_categories (user_id, name, icon, color)
                        VALUES (?, ?, ?, ?)
                    ''', (cat_user_id, name, icon, color))
                elif cat_type == 'expense':
                    cursor.execute('''
                        INSERT INTO expense_categories (user_id, name, icon, color)
                        VALUES (?, ?, ?, ?)
                    ''', (cat_user_id, name, icon, color))
                elif cat_type == 'savings':
                    cursor.execute('''
                        INSERT INTO savings_categories (user_id, name, icon, color)
                        VALUES (?, ?, ?, ?)
                    ''', (cat_user_id, name, icon, color))
        
        conn.commit()
        return user_id, currency, session_token
    
    def get_user_by_session(self, session_token: str) -> Optional[Dict]:
        """Получение пользователя по токену сессии"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, telegram_id, username, first_name, currency, theme, language
            FROM users WHERE session_token = ? AND is_active = 1
        ''', (session_token,))
        
        user = cursor.fetchone()
        return dict(user) if user else None
    
    def update_user_currency(self, user_id: int, currency: str) -> bool:
        """Обновление валюты пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
        conn.commit()
        return cursor.rowcount > 0
    
    # ==================== КОШЕЛЬКИ ====================
    
    def create_wallet(self, user_id: int, name: str, icon: str = '💳', balance: float = 0.0, color: str = '#007AFF') -> Optional[int]:
        """Создание нового кошелька"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Если это первый кошелек, делаем его по умолчанию
            cursor.execute('SELECT COUNT(*) as count FROM wallets WHERE user_id = ?', (user_id,))
            count = cursor.fetchone()['count']
            is_default = 1 if count == 0 else 0
            
            cursor.execute('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default, color)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, name, icon, balance, is_default, color))
            
            wallet_id = cursor.lastrowid
            conn.commit()
            return wallet_id
            
        except sqlite3.IntegrityError:
            return None
    
    def get_wallets(self, user_id: int) -> List[Dict]:
        """Получение всех кошельков пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, icon, balance, is_default, color
            FROM wallets 
            WHERE user_id = ? 
            ORDER BY is_default DESC, created_at DESC
        ''', (user_id,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def update_wallet_balance(self, wallet_id: int, amount: float, operation: str = 'add') -> bool:
        """Обновление баланса кошелька"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if operation == 'add':
            cursor.execute('UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                          (amount, wallet_id))
        elif operation == 'subtract':
            cursor.execute('UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                          (amount, wallet_id))
        else:
            cursor.execute('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                          (amount, wallet_id))
        
        conn.commit()
        return cursor.rowcount > 0
    
    def set_default_wallet(self, user_id: int, wallet_id: int) -> bool:
        """Установка кошелька по умолчанию"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Сбрасываем все кошельки пользователя
            cursor.execute('UPDATE wallets SET is_default = 0 WHERE user_id = ?', (user_id,))
            
            # Устанавливаем новый кошелек по умолчанию
            cursor.execute('UPDATE wallets SET is_default = 1 WHERE id = ? AND user_id = ?', (wallet_id, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"Ошибка установки кошелька по умолчанию: {e}")
            return False
    
    # ==================== КАТЕГОРИИ ====================
    
    def create_category(self, user_id: int, category_type: str, name: str, icon: str, color: str) -> Optional[int]:
        """Создание новой категории"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if category_type == 'income':
                cursor.execute('''
                    INSERT INTO income_categories (user_id, name, icon, color)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, name, icon, color))
            elif category_type == 'expense':
                cursor.execute('''
                    INSERT INTO expense_categories (user_id, name, icon, color)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, name, icon, color))
            elif category_type == 'savings':
                cursor.execute('''
                    INSERT INTO savings_categories (user_id, name, icon, color)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, name, icon, color))
            else:
                return None
            
            category_id = cursor.lastrowid
            conn.commit()
            return category_id
            
        except sqlite3.IntegrityError:
            return None
    
    def get_categories(self, user_id: int, category_type: str = None) -> Dict[str, List[Dict]]:
        """Получение категорий пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        result = {'income': [], 'expense': [], 'savings': []}
        
        if category_type is None or category_type == 'income':
            cursor.execute('''
                SELECT id, name, icon, color
                FROM income_categories 
                WHERE user_id = ? AND is_active = 1
                ORDER BY name
            ''', (user_id,))
            result['income'] = [dict(row) for row in cursor.fetchall()]
        
        if category_type is None or category_type == 'expense':
            cursor.execute('''
                SELECT id, name, icon, color
                FROM expense_categories 
                WHERE user_id = ? AND is_active = 1
                ORDER BY name
            ''', (user_id,))
            result['expense'] = [dict(row) for row in cursor.fetchall()]
        
        if category_type is None or category_type == 'savings':
            cursor.execute('''
                SELECT id, name, icon, color
                FROM savings_categories 
                WHERE user_id = ? AND is_active = 1
                ORDER BY name
            ''', (user_id,))
            result['savings'] = [dict(row) for row in cursor.fetchall()]
        
        return result if category_type is None else result.get(category_type, [])
    
    # ==================== ЦЕЛИ ====================
    
    def create_goal(self, user_id: int, name: str, target_amount: float, icon: str = '🎯', 
                   color: str = '#FF9500', deadline: str = None) -> Optional[int]:
        """Создание новой цели"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO goals (user_id, name, target_amount, icon, color, deadline)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, name, target_amount, icon, color, deadline))
            
            goal_id = cursor.lastrowid
            conn.commit()
            return goal_id
            
        except Exception as e:
            print(f"Ошибка создания цели: {e}")
            return None
    
    def get_goals(self, user_id: int) -> List[Dict]:
        """Получение всех целей пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, target_amount, current_amount, icon, color, deadline,
                   CASE 
                       WHEN target_amount > 0 THEN ROUND((current_amount / target_amount * 100), 1)
                       ELSE 0
                   END as progress,
                   is_completed
            FROM goals 
            WHERE user_id = ? 
            ORDER BY is_completed, created_at DESC
        ''', (user_id,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def update_goal_progress(self, goal_id: int, amount: float, operation: str = 'add') -> bool:
        """Обновление прогресса цели"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if operation == 'add':
                cursor.execute('''
                    UPDATE goals 
                    SET current_amount = current_amount + ?, 
                        updated_at = CURRENT_TIMESTAMP,
                        is_completed = CASE 
                            WHEN current_amount + ? >= target_amount THEN 1 
                            ELSE 0 
                        END
                    WHERE id = ?
                ''', (amount, amount, goal_id))
            elif operation == 'subtract':
                cursor.execute('''
                    UPDATE goals 
                    SET current_amount = current_amount - ?, 
                        updated_at = CURRENT_TIMESTAMP,
                        is_completed = 0
                    WHERE id = ? AND current_amount - ? >= 0
                ''', (amount, goal_id, amount))
            else:
                cursor.execute('''
                    UPDATE goals 
                    SET current_amount = ?, 
                        updated_at = CURRENT_TIMESTAMP,
                        is_completed = CASE 
                            WHEN ? >= target_amount THEN 1 
                            ELSE 0 
                        END
                    WHERE id = ?
                ''', (amount, amount, goal_id))
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"Ошибка обновления прогресса цели: {e}")
            return False
    
    # ==================== ТРАНЗАКЦИИ ====================
    
    def create_transaction(self, user_id: int, transaction_type: str, amount: float, category: str, 
                          wallet_id: int, goal_id: int = None, description: str = None, 
                          transaction_date: str = None) -> Optional[int]:
        """Создание новой транзакции"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Обновляем баланс кошелька
            if transaction_type == 'income':
                cursor.execute('UPDATE wallets SET balance = balance + ? WHERE id = ?', 
                              (amount, wallet_id))
            elif transaction_type in ['expense', 'savings']:
                cursor.execute('UPDATE wallets SET balance = balance - ? WHERE id = ?', 
                              (amount, wallet_id))
            
            # Если это накопление в цель, обновляем прогресс цели
            if transaction_type == 'savings' and goal_id:
                self.update_goal_progress(goal_id, amount, 'add')
            
            # Создаем запись транзакции
            date_value = transaction_date if transaction_date else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            cursor.execute('''
                INSERT INTO transactions (user_id, type, amount, category, wallet_id, goal_id, description, date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, transaction_type, amount, category, wallet_id, goal_id, description, date_value))
            
            transaction_id = cursor.lastrowid
            conn.commit()
            return transaction_id
            
        except Exception as e:
            print(f"Ошибка создания транзакции: {e}")
            conn.rollback()
            return None
    
    def get_transactions(self, user_id: int, limit: int = 50, offset: int = 0, 
                        transaction_type: str = None, wallet_id: int = None, 
                        start_date: str = None, end_date: str = None) -> List[Dict]:
        """Получение транзакций пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = '''
            SELECT t.id, t.type, t.amount, t.category, t.description, t.date,
                   w.name as wallet_name, w.icon as wallet_icon,
                   g.name as goal_name
            FROM transactions t
            LEFT JOIN wallets w ON t.wallet_id = w.id
            LEFT JOIN goals g ON t.goal_id = g.id
            WHERE t.user_id = ?
        '''
        params = [user_id]
        
        if transaction_type:
            query += ' AND t.type = ?'
            params.append(transaction_type)
        
        if wallet_id:
            query += ' AND t.wallet_id = ?'
            params.append(wallet_id)
        
        if start_date:
            query += ' AND DATE(t.date) >= ?'
            params.append(start_date)
        
        if end_date:
            query += ' AND DATE(t.date) <= ?'
            params.append(end_date)
        
        query += ' ORDER BY t.date DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        
        transactions = []
        for row in cursor.fetchall():
            transaction = dict(row)
            # Форматируем дату для отображения
            transaction_date = datetime.strptime(transaction['date'], '%Y-%m-%d %H:%M:%S')
            transaction['date_formatted'] = transaction_date.strftime('%d.%m.%Y %H:%M')
            transaction['date_short'] = transaction_date.strftime('%d %b')
            transactions.append(transaction)
        
        return transactions
    
    def get_transaction_stats(self, user_id: int, period: str = 'month') -> Dict[str, float]:
        """Получение статистики транзакций"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Определяем период
        now = datetime.now()
        if period == 'day':
            date_filter = now.strftime('%Y-%m-%d')
        elif period == 'week':
            week_ago = now - timedelta(days=7)
            date_filter = week_ago.strftime('%Y-%m-%d')
        elif period == 'month':
            month_ago = now - timedelta(days=30)
            date_filter = month_ago.strftime('%Y-%m-%d')
        elif period == 'year':
            year_ago = now - timedelta(days=365)
            date_filter = year_ago.strftime('%Y-%m-%d')
        else:
            date_filter = '2000-01-01'  # Все время
        
        # Доходы
        cursor.execute('''
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions 
            WHERE user_id = ? AND type = 'income' AND DATE(date) >= ?
        ''', (user_id, date_filter))
        income_total = cursor.fetchone()['total'] or 0
        
        # Расходы
        cursor.execute('''
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions 
            WHERE user_id = ? AND type = 'expense' AND DATE(date) >= ?
        ''', (user_id, date_filter))
        expense_total = cursor.fetchone()['total'] or 0
        
        # Накопления
        cursor.execute('''
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions 
            WHERE user_id = ? AND type = 'savings' AND DATE(date) >= ?
        ''', (user_id, date_filter))
        savings_total = cursor.fetchone()['total'] or 0
        
        # Баланс кошельков
        cursor.execute('SELECT COALESCE(SUM(balance), 0) as total FROM wallets WHERE user_id = ?', (user_id,))
        wallet_balance = cursor.fetchone()['total'] or 0
        
        return {
            'income': float(income_total),
            'expense': float(expense_total),
            'savings': float(savings_total),
            'balance': float(wallet_balance),
            'period': period
        }
    
    def get_category_stats(self, user_id: int, transaction_type: str, period: str = 'month') -> Dict[str, float]:
        """Получение статистики по категориям"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Определяем период
        now = datetime.now()
        if period == 'day':
            date_filter = now.strftime('%Y-%m-%d')
        elif period == 'week':
            week_ago = now - timedelta(days=7)
            date_filter = week_ago.strftime('%Y-%m-%d')
        elif period == 'month':
            month_ago = now - timedelta(days=30)
            date_filter = month_ago.strftime('%Y-%m-%d')
        elif period == 'year':
            year_ago = now - timedelta(days=365)
            date_filter = year_ago.strftime('%Y-%m-%d')
        else:
            date_filter = '2000-01-01'
        
        cursor.execute('''
            SELECT category, SUM(amount) as total
            FROM transactions 
            WHERE user_id = ? AND type = ? AND DATE(date) >= ?
            GROUP BY category
            ORDER BY total DESC
        ''', (user_id, transaction_type, date_filter))
        
        stats = {}
        for row in cursor.fetchall():
            stats[row['category']] = float(row['total'] or 0)
        
        return stats
    
    def get_balance_dynamics(self, user_id: int, period: str = 'week') -> List[Dict]:
        """Получение динамики баланса"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Определяем группировку
        if period == 'week':
            group_format = '%Y-%m-%d'
            days = 7
        elif period == 'month':
            group_format = '%Y-%m-%d'
            days = 30
        elif period == 'year':
            group_format = '%Y-%m'
            days = 365
        else:
            group_format = '%Y-%m-%d'
            days = 7
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        cursor.execute('''
            SELECT 
                strftime(?, date) as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END) as savings
            FROM transactions 
            WHERE user_id = ? AND date >= ?
            GROUP BY strftime(?, date)
            ORDER BY period
        ''', (group_format, user_id, start_date.strftime('%Y-%m-%d'), group_format))
        
        dynamics = []
        cumulative_balance = 0
        
        for row in cursor.fetchall():
            income = float(row['income'] or 0)
            expense = float(row['expense'] or 0)
            savings = float(row['savings'] or 0)
            net_change = income - expense - savings
            cumulative_balance += net_change
            
            dynamics.append({
                'period': row['period'],
                'income': income,
                'expense': expense,
                'savings': savings,
                'balance': cumulative_balance
            })
        
        return dynamics
    
    def get_recent_transactions(self, user_id: int, limit: int = 10) -> List[Dict]:
        """Получение последних транзакций"""
        return self.get_transactions(user_id, limit=limit)
    
    def delete_transaction(self, transaction_id: int) -> bool:
        """Удаление транзакции"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем информацию о транзакции для отката
            cursor.execute('SELECT type, amount, wallet_id, goal_id FROM transactions WHERE id = ?', (transaction_id,))
            transaction = cursor.fetchone()
            
            if not transaction:
                return False
            
            # Откатываем баланс кошелька
            if transaction['type'] == 'income':
                cursor.execute('UPDATE wallets SET balance = balance - ? WHERE id = ?', 
                              (transaction['amount'], transaction['wallet_id']))
            elif transaction['type'] in ['expense', 'savings']:
                cursor.execute('UPDATE wallets SET balance = balance + ? WHERE id = ?', 
                              (transaction['amount'], transaction['wallet_id']))
            
            # Откатываем прогресс цели
            if transaction['type'] == 'savings' and transaction['goal_id']:
                self.update_goal_progress(transaction['goal_id'], transaction['amount'], 'subtract')
            
            # Удаляем транзакцию
            cursor.execute('DELETE FROM transactions WHERE id = ?', (transaction_id,))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"Ошибка удаления транзакции: {e}")
            conn.rollback()
            return False
    
    def get_wallet_by_name(self, user_id: int, wallet_name: str) -> Optional[Dict]:
        """Получение кошелька по имени"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, name, icon, balance, is_default, color FROM wallets WHERE user_id = ? AND name = ?', 
                      (user_id, wallet_name))
        
        wallet = cursor.fetchone()
        return dict(wallet) if wallet else None
    
    def get_goal_by_name(self, user_id: int, goal_name: str) -> Optional[Dict]:
        """Получение цели по имени"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, name, target_amount, current_amount, icon, color, deadline FROM goals WHERE user_id = ? AND name = ?', 
                      (user_id, goal_name))
        
        goal = cursor.fetchone()
        return dict(goal) if goal else None

# Глобальный экземпляр базы данных
db = Database()