import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.constants import ParseMode
from dotenv import load_dotenv

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Загружаем переменные окружения
load_dotenv()
TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', '') + '/' if os.getenv('WEBHOOK_URL') else ''

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    user = update.effective_user
    
    # Приветственное сообщение
    welcome_text = f"""
👋 Привет, {user.first_name}!

💼 *Финансовый помощник* поможет вам:
• 📊 Отслеживать доходы и расходы
• 📈 Смотреть статистику в графиках
• 💰 Контролировать бюджет
• 🔔 Получать уведомления

🚀 Для начала работы нажмите кнопку ниже!
"""
    
    # Кнопка для открытия Mini App
    keyboard = [
        [InlineKeyboardButton("📱 Открыть приложение", web_app={'url': f'{WEBHOOK_URL}'})]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode=ParseMode.MARKDOWN
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /help"""
    help_text = """
🤖 *Доступные команды:*
/start - Запустить бота и открыть приложение
/help - Показать это сообщение
/stats - Показать краткую статистику

📱 *Как пользоваться:*
1. Нажмите "Открыть приложение"
2. Добавляйте доходы и расходы
3. Следите за статистикой на графике
4. Анализируйте свои финансы

💡 *Советы:*
• Регулярно добавляйте операции
• Используйте категории для анализа
• Ставьте финансовые цели
"""
    
    await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)

async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /stats"""
    # Эта функция будет расширена позже для показа статистики
    stats_text = """
📊 *Статистика*

Функция статистики в разработке.
Откройте приложение для полного доступа к данным.
"""
    
    keyboard = [
        [InlineKeyboardButton("📊 Открыть статистику", web_app={'url': f'{WEBHOOK_URL}'})]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        stats_text,
        reply_markup=reply_markup,
        parse_mode=ParseMode.MARKDOWN
    )

async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик данных из Web App"""
    data = update.effective_message.web_app_data.data
    logger.info(f"Received web app data: {data}")
    # Здесь можно обработать данные из мини-приложения
    await update.message.reply_text("Данные получены!")

def main():
    """Запуск бота"""
    # Создаем приложение
    application = Application.builder().token(TOKEN).build()
    
    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("stats", stats_command))
    
    # Обработчик данных из Web App
    application.add_handler(CallbackQueryHandler(web_app_data))
    
    # Запускаем бота
    print("🤖 Бот запущен! Нажмите Ctrl+C для остановки.")
    application.run_polling()

if __name__ == '__main__':
    main()