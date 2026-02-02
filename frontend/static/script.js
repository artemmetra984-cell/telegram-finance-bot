// Глобальные переменные
let currentUser = null;
let financeChart = null;
let currentTransactionType = 'income';
let transactionsOffset = 0;
const TRANSACTIONS_PER_PAGE = 10;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Страница загружена');
    
    try {
        // Инициализируем пользователя через Telegram Web App
        await initTelegramUser();
        
        // Показываем основной контент
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        // Инициализируем диаграмму
        initChart();
        
        // Загружаем данные
        await loadUserData();
        
        // Загружаем историю транзакций
        await loadTransactions();
        
        // Настраиваем обработчики событий
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
});

// Инициализация пользователя Telegram
async function initTelegramUser() {
    // Проверяем, запущено ли в Telegram Web App
    if (window.Telegram && Telegram.WebApp) {
        const tg = Telegram.WebApp;
        
        // Расширяем на весь экран
        tg.expand();
        
        // Получаем данные пользователя
        const user = tg.initDataUnsafe.user;
        
        if (user) {
            // Отправляем данные на сервер
            const response = await fetch('/api/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_id: user.id,
                    username: user.username,
                    first_name: user.first_name
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            currentUser = {
                id: data.user_id,
                telegramId: user.id,
                username: user.username,
                firstName: user.first_name
            };
            
            console.log('Пользователь инициализирован:', currentUser);
        } else {
            // Для тестирования вне Telegram
            await initTestUser();
        }
    } else {
        // Для тестирования вне Telegram
        await initTestUser();
    }
}

// Инициализация тестового пользователя
async function initTestUser() {
    console.log('Тестовый режим (вне Telegram)');
    
    const response = await fetch('/api/init', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            telegram_id: 123456789,
            username: 'test_user',
            first_name: 'Тестовый'
        })
    });
    
    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    
    currentUser = {
        id: data.user_id,
        telegramId: 123456789,
        username: 'test_user',
        firstName: 'Тестовый'
    };
    
    showNotification('Тестовый режим активен', 'info');
}

// Загрузка данных пользователя
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        // Загружаем сводку
        const summaryResponse = await fetch(`/api/summary/${currentUser.id}`);
        const summary = await summaryResponse.json();
        
        if (summary.error) {
            throw new Error(summary.error);
        }
        
        // Обновляем отображение
        updateSummaryDisplay(summary);
        
        // Загружаем категории
        await loadCategories();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Обновление отображения сводки
function updateSummaryDisplay(summary) {
    document.getElementById('total-income').textContent = 
        formatCurrency(summary.total_income);
    document.getElementById('total-expense').textContent = 
        formatCurrency(summary.total_expense);
    document.getElementById('balance').textContent = 
        formatCurrency(summary.balance);
    
    // Обновляем диаграмму
    if (financeChart) {
        updateChart(summary);
    }
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + ' ₽';
}

// Инициализация диаграммы
function initChart() {
    const ctx = document.getElementById('finance-chart').getContext('2d');
    
    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Доходы', 'Расходы'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 12
                        },
                        color: '#333'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.raw);
                            return label;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Обновление диаграммы
function updateChart(summary) {
    financeChart.data.datasets[0].data = [
        summary.total_income || 0,
        summary.total_expense || 0
    ];
    financeChart.update();
}

// Загрузка категорий
async function loadCategories() {
    if (!currentUser) return;
    
    try {
        // Загружаем категории доходов
        const incomeResponse = await fetch(`/api/categories/${currentUser.id}?type=income`);
        const incomeCategories = await incomeResponse.json();
        
        // Загружаем категории расходов
        const expenseResponse = await fetch(`/api/categories/${currentUser.id}?type=expense`);
        const expenseCategories = await expenseResponse.json();
        
        // Сохраняем категории для использования в форме
        window.categories = {
            income: incomeCategories,
            expense: expenseCategories
        };
        
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

// Загрузка истории транзакций
async function loadTransactions() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=${TRANSACTIONS_PER_PAGE}&offset=${transactionsOffset}`);
        const transactions = await response.json();
        
        if (transactions.error) {
            throw new Error(transactions.error);
        }
        
        updateTransactionsList(transactions);
        
        // Показываем кнопку "Загрузить еще", если есть еще транзакции
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (transactions.length === TRANSACTIONS_PER_PAGE) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        showNotification('Ошибка загрузки истории', 'error');
    }
}

// Обновление списка транзакций
function updateTransactionsList(transactions) {
    const container = document.getElementById('transactions-list');
    
    if (transactionsOffset === 0) {
        container.innerHTML = '';
    }
    
    if (transactions.length === 0 && transactionsOffset === 0) {
        container.innerHTML = `
            <div class="transaction-item" style="text-align: center; color: #7f8c8d;">
                Нет операций. Добавьте первую!
            </div>
        `;
        return;
    }
    
    transactions.forEach(transaction => {
        const transactionElement = createTransactionElement(transaction);
        container.appendChild(transactionElement);
    });
}

// Создание элемента транзакции
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    
    const isIncome = transaction.type === 'income';
    const amountClass = isIncome ? 'transaction-income' : 'transaction-expense';
    const amountSign = isIncome ? '+' : '-';
    
    div.innerHTML = `
        <div class="transaction-info">
            <div class="transaction-description">
                ${transaction.description || 'Без описания'}
            </div>
            <div class="transaction-meta">
                <span class="transaction-category">${transaction.category}</span>
                <span>${formatDate(transaction.date)}</span>
            </div>
        </div>
        <div class="transaction-amount ${amountClass}">
            ${amountSign}${formatCurrency(transaction.amount)}
        </div>
    `;
    
    return div;
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопки добавления транзакций
    document.getElementById('income-btn').addEventListener('click', () => {
        currentTransactionType = 'income';
        showTransactionForm();
    });
    
    document.getElementById('expense-btn').addEventListener('click', () => {
        currentTransactionType = 'expense';
        showTransactionForm();
    });
    
    // Кнопки формы
    document.getElementById('cancel-btn').addEventListener('click', hideTransactionForm);
    document.getElementById('submit-btn').addEventListener('click', submitTransaction);
    
    // Кнопка "Загрузить еще"
    document.getElementById('load-more-btn').addEventListener('click', loadMoreTransactions);
    
    // Закрытие формы при клике вне ее
    document.addEventListener('click', (event) => {
        const form = document.getElementById('transaction-form');
        if (form.style.display === 'block' && 
            !form.contains(event.target) &&
            !document.getElementById('income-btn').contains(event.target) &&
            !document.getElementById('expense-btn').contains(event.target)) {
            hideTransactionForm();
        }
    });
}

// Показать форму добавления транзакции
function showTransactionForm() {
    const form = document.getElementById('transaction-form');
    const formTitle = document.getElementById('form-title');
    const categorySelect = document.getElementById('category');
    
    // Устанавливаем заголовок
    formTitle.textContent = currentTransactionType === 'income' 
        ? 'Добавить доход' 
        : 'Добавить расход';
    
    // Заполняем категории
    categorySelect.innerHTML = '';
    const categories = window.categories ? window.categories[currentTransactionType] : [];
    
    if (categories && categories.length > 0) {
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    } else {
        // Стандартные категории, если не загружены
        const defaultCategories = currentTransactionType === 'income' 
            ? ['Зарплата', 'Фриланс', 'Инвестиции', 'Подарок']
            : ['Продукты', 'Транспорт', 'Развлечения', 'Кафе', 'Аренда'];
        
        defaultCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }
    
    // Показываем форму
    form.style.display = 'block';
    
    // Прокручиваем к форме
    form.scrollIntoView({ behavior: 'smooth' });
    
    // Фокусируемся на поле суммы
    setTimeout(() => {
        document.getElementById('amount').focus();
    }, 300);
}

// Скрыть форму
function hideTransactionForm() {
    document.getElementById('transaction-form').style.display = 'none';
    clearForm();
}

// Очистка формы
function clearForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
}

// Отправка транзакции
async function submitTransaction() {
    const amount = document.getElementById('amount').value.trim();
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value.trim();
    
    // Валидация
    if (!amount || parseFloat(amount) <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    if (!category) {
        showNotification('Выберите категорию', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                type: currentTransactionType,
                amount: parseFloat(amount),
                category: category,
                description: description || ''
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Обновляем данные
        updateSummaryDisplay(data.summary);
        
        // Сбрасываем offset и перезагружаем транзакции
        transactionsOffset = 0;
        await loadTransactions();
        
        // Скрываем форму и показываем уведомление
        hideTransactionForm();
        showNotification(
            currentTransactionType === 'income' ? 'Доход добавлен!' : 'Расход добавлен!',
            'success'
        );
        
    } catch (error) {
        console.error('Ошибка добавления транзакции:', error);
        showNotification('Ошибка добавления транзакции', 'error');
    }
}

// Загрузка дополнительных транзакций
async function loadMoreTransactions() {
    transactionsOffset += TRANSACTIONS_PER_PAGE;
    await loadTransactions();
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.transform = 'translateX(0)';
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.style.transform = 'translateX(150%)';
    }, 3000);
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('Произошла ошибка', 'error');
});