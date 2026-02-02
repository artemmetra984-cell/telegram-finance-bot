import sqlite3
import os
from datetime import datetime

class Database:
    def __init__(self):
        # На Render используем текущую директорию
        db_path = 'finance.db'
        print(f"📊 Initializing database at: {os.path.abspath(db_path)}")
        
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()
        print(f"✅ Database ready")
    
    def init_db(self):
        cursor = self.conn.cursor()
        
        # Существующие таблицы
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                currency TEXT DEFAULT 'RUB',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense', 'investment', 'savings')) NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense', 'investment', 'savings')) NOT NULL,
                name TEXT NOT NULL,
                color TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Новая таблица для сбережений
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                target_amount REAL,
                current_amount REAL DEFAULT 0,
                currency TEXT DEFAULT 'RUB',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Таблица для курсов валют (кеш)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS currency_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_currency TEXT NOT NULL,
                to_currency TEXT NOT NULL,
                rate REAL NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        self.conn.commit()
        print("✅ Database tables created/verified")
    
    def get_or_create_user(self, telegram_id, username, first_name):
        cursor = self.conn.cursor()
        
        cursor.execute('SELECT id, currency FROM users WHERE telegram_id = ?', (telegram_id,))
        user = cursor.fetchone()
        
        if user:
            print(f"👤 User exists: ID {user['id']}")
            return user['id'], user['currency']
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, currency) 
                VALUES (?, ?, ?, 'RUB')
            ''', (telegram_id, username, first_name))
            user_id = cursor.lastrowid
            
            # Стандартные категории для всех типов
            default_categories = [
                # Доходы
                (user_id, 'income', 'Зарплата', '#27ae60'),
                (user_id, 'income', 'Фриланс', '#2ecc71'),
                (user_id, 'income', 'Инвестиции', '#3498db'),
                (user_id, 'income', 'Подарок', '#9b59b6'),
                # Расходы
                (user_id, 'expense', 'Продукты', '#e74c3c'),
                (user_id, 'expense', 'Транспорт', '#e67e22'),
                (user_id, 'expense', 'Развлечения', '#f39c12'),
                (user_id, 'expense', 'Кафе', '#d35400'),
                (user_id, 'expense', 'Аренда', '#34495e'),
                # Инвестиции
                (user_id, 'investment', 'Акции', '#1abc9c'),
                (user_id, 'investment', 'Криптовалюта', '#e74c3c'),
                (user_id, 'investment', 'Недвижимость', '#f39c12'),
                (user_id, 'investment', 'Облигации', '#3498db'),
                # Накопления
                (user_id, 'savings', 'Отложил', '#9b59b6'),
                (user_id, 'savings', 'Подушка безопасности', '#2ecc71'),
                (user_id, 'savings', 'На отпуск', '#e74c3c'),
                (user_id, 'savings', 'На крупную покупку', '#f39c12'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, color) 
                VALUES (?, ?, ?, ?)
            ''', default_categories)
            
            # Создаем стандартные копилки
            default_savings = [
                (user_id, 'Отложил', 0, 0, 'RUB'),
                (user_id, 'Подушка безопасности', 100000, 0, 'RUB'),
                (user_id, 'На отпуск', 50000, 0, 'RUB'),
            ]
            
            cursor.executemany('''
                INSERT INTO savings (user_id, category, target_amount, current_amount, currency)
                VALUES (?, ?, ?, ?, ?)
            ''', default_savings)
            
            self.conn.commit()
            print(f"👤 Created new user: {first_name} (ID: {user_id})")
            return user_id, 'RUB'
    
    def update_user_currency(self, user_id, currency):
        cursor = self.conn.cursor()
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
        self.conn.commit()
        return currency
    
    def add_transaction(self, user_id, trans_type, amount, category, description):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                INSERT INTO transactions (user_id, type, amount, category, description)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, trans_type, amount, category, description or ''))
            
            # Если это накопление, обновляем копилку
            if trans_type == 'savings':
                cursor.execute('''
                    UPDATE savings 
                    SET current_amount = current_amount + ?
                    WHERE user_id = ? AND category = ?
                ''', (amount, user_id, category))
            
            self.conn.commit()
            transaction_id = cursor.lastrowid
            print(f"💾 Transaction #{transaction_id} saved: {trans_type} {amount} руб.")
            return transaction_id
        except Exception as e:
            print(f"❌ Error saving transaction: {e}")
            self.conn.rollback()
            raise e
    
    def get_financial_summary(self, user_id, month=None, year=None):
        try:
            cursor = self.conn.cursor()
            
            # Базовый запрос
            query = '''
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                    COALESCE(SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END), 0) as total_investment,
                    COALESCE(SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END), 0) as total_savings
                FROM transactions 
                WHERE user_id = ?
            '''
            params = [user_id]
            
            # Фильтр по месяцу/году
            if month and year:
                query += " AND strftime('%m', date) = ? AND strftime('%Y', date) = ?"
                params.extend([f"{month:02d}", str(year)])
            elif year:
                query += " AND strftime('%Y', date) = ?"
                params.append(str(year))
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            
            if result:
                total_income = float(result['total_income']) if result['total_income'] else 0
                total_expense = float(result['total_expense']) if result['total_expense'] else 0
                total_investment = float(result['total_investment']) if result['total_investment'] else 0
                total_savings = float(result['total_savings']) if result['total_savings'] else 0
            else:
                total_income = total_expense = total_investment = total_savings = 0
            
            balance = total_income - total_expense
            
            return {
                'total_income': total_income,
                'total_expense': total_expense,
                'total_investment': total_investment,
                'total_savings': total_savings,
                'balance': balance
            }
        except Exception as e:
            print(f"❌ Error getting summary: {e}")
            return {'total_income': 0, 'total_expense': 0, 'total_investment': 0, 'total_savings': 0, 'balance': 0}
    
    def get_monthly_summary(self, user_id):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT 
                    strftime('%Y-%m', date) as month,
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                    SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END) as investment,
                    SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END) as savings
                FROM transactions 
                WHERE user_id = ?
                GROUP BY strftime('%Y-%m', date)
                ORDER BY month DESC
            ''', (user_id,))
            
            months = []
            for row in cursor.fetchall():
                months.append({
                    'month': row['month'],
                    'income': float(row['income'] or 0),
                    'expense': float(row['expense'] or 0),
                    'investment': float(row['investment'] or 0),
                    'savings': float(row['savings'] or 0),
                    'balance': float((row['income'] or 0) - (row['expense'] or 0))
                })
            
            return months
        except Exception as e:
            print(f"❌ Error getting monthly summary: {e}")
            return []
    
    def get_user_transactions(self, user_id, limit=50, offset=0, trans_type=None):
        try:
            cursor = self.conn.cursor()
            
            query = 'SELECT * FROM transactions WHERE user_id = ?'
            params = [user_id]
            
            if trans_type:
                query += ' AND type = ?'
                params.append(trans_type)
            
            query += ' ORDER BY date DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            return cursor.fetchall()
        except Exception as e:
            print(f"❌ Error getting transactions: {e}")
            return []
    
    def get_categories(self, user_id, category_type=None):
        try:
            cursor = self.conn.cursor()
            
            if category_type:
                cursor.execute('''
                    SELECT name, type, color FROM categories 
                    WHERE user_id = ? AND type = ?
                    ORDER BY name
                ''', (user_id, category_type))
            else:
                cursor.execute('''
                    SELECT name, type, color FROM categories 
                    WHERE user_id = ?
                    ORDER BY type, name
                ''', (user_id,))
            
            return cursor.fetchall()
        except Exception as e:
            print(f"❌ Error getting categories: {e}")
            return []
    
    def get_savings(self, user_id):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT * FROM savings 
                WHERE user_id = ?
                ORDER BY category
            ''', (user_id,))
            
            savings = []
            for row in cursor.fetchall():
                savings.append({
                    'id': row['id'],
                    'category': row['category'],
                    'target_amount': float(row['target_amount'] or 0),
                    'current_amount': float(row['current_amount'] or 0),
                    'currency': row['currency'],
                    'progress': (float(row['current_amount'] or 0) / float(row['target_amount'] or 1)) * 100 if row['target_amount'] else 0
                })
            
            return savings
        except Exception as e:
            print(f"❌ Error getting savings: {e}")
            return []
    
    def add_to_savings(self, user_id, category, amount):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                UPDATE savings 
                SET current_amount = current_amount + ?
                WHERE user_id = ? AND category = ?
            ''', (amount, user_id, category))
            
            # Добавляем запись в транзакции
            cursor.execute('''
                INSERT INTO transactions (user_id, type, amount, category, description)
                VALUES (?, 'savings', ?, ?, 'Пополнение копилки')
            ''', (user_id, amount, category))
            
            self.conn.commit()
            print(f"💰 Added {amount} to savings '{category}'")
            return True
        except Exception as e:
            print(f"❌ Error adding to savings: {e}")
            self.conn.rollback()
            return False

# Глобальный экземпляр базы данных
db = Database()