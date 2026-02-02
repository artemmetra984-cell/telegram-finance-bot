// Глобальные переменные
let currentUser = null;
let financeChart = null;
let savingsChart = null;
let currentPage = 'main'; // main, history, savings
let currentTransactionType = 'income';
let transactionsOffset = 0;
const TRANSACTIONS_PER_PAGE = 10;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Страница загружена');
    
    try {
        await initTelegramUser();
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        initChart();
        await loadUserData();
        setupEventListeners();
        
        // Настраиваем Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#1a1a1a');
            Telegram.WebApp.setBackgroundColor('#1a1a1a');
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
});

// Инициализация пользователя
async function initTelegramUser() {
    if (window.Telegram && Telegram.WebApp) {
        const tg = Telegram.WebApp;
        const user = tg.initDataUnsafe.user;
        
        if (user) {
            const response = await fetch('/api/init', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    telegram_id: user.id,
                    username: user.username,
                    first_name: user.first_name
                })
            });
            
            const data = await response.json();
            
            if (data.error) throw new Error(data.error);
            
            currentUser = {
                id: data.user_id,
                telegramId: user.id,
                username: user.username,
                firstName: user.first_name,
                currency: data.currency
            };
            
            // Сохраняем данные
            window.categories = data.categories;
            window.currencies = data.currencies;
            window.savings = data.savings;
            
            // Обновляем интерфейс
            updateCurrencyDisplay(data.currency);
            updateSummaryDisplay(data.summary);
            updateRecentTransactions(data.recent_transactions);
            updateSavingsList(data.savings);
            
            console.log('Пользователь инициализирован:', currentUser);
        }
    } else {
        // Тестовый режим
        await initTestUser();
    }
}

async function initTestUser() {
    const testId = Math.floor(Math.random() * 1000000);
    
    const response = await fetch('/api/init', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            telegram_id: testId,
            username: 'test_user_' + testId,
            first_name: 'Тестовый'
        })
    });
    
    const data = await response.json();
    
    currentUser = {
        id: data.user_id,
        telegramId: testId,
        username: 'test_user_' + testId,
        firstName: 'Тестовый',
        currency: data.currency
    };
    
    window.categories = data.categories;
    window.currencies = data.currencies;
    window.savings = data.savings;
    
    updateCurrencyDisplay(data.currency);
    updateSummaryDisplay(data.summary);
    updateRecentTransactions(data.recent_transactions);
    updateSavingsList(data.savings);
}

// Загрузка данных пользователя
async function loadUserData() {
    if (!currentUser) await initTestUser();
    
    try {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                telegram_id: currentUser.telegramId,
                username: currentUser.username,
                first_name: currentUser.firstName
            })
        });
        
        const data = await response.json();
        
        updateCurrencyDisplay(data.currency);
        updateSummaryDisplay(data.summary);
        updateRecentTransactions(data.recent_transactions);
        updateSavingsList(data.savings);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Обновление отображения валюты
function updateCurrencyDisplay(currency) {
    document.getElementById('current-currency').textContent = getCurrencySymbol(currency);
    document.querySelectorAll('.currency-option').forEach(option => {
        option.classList.toggle('active', option.dataset.currency === currency);
    });
}

// Получение символа валюты
function getCurrencySymbol(currency) {
    const symbols = {
        'RUB': '₽',
        'USD': '$',
        'EUR': '€',
        'GEL': '₾'
    };
    return symbols[currency] || currency;
}

// Обновление сводки
function updateSummaryDisplay(summary) {
    const currencySymbol = getCurrencySymbol(currentUser?.currency || 'RUB');
    
    document.getElementById('total-income').textContent = 
        formatCurrency(summary.total_income) + ' ' + currencySymbol;
    document.getElementById('total-expense').textContent = 
        formatCurrency(summary.total_expense) + ' ' + currencySymbol;
    document.getElementById('balance').textContent = 
        formatCurrency(summary.balance) + ' ' + currencySymbol;
    
    if (financeChart) {
        updateChart(summary);
    }
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
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
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatCurrency(context.raw)} ${getCurrencySymbol(currentUser?.currency || 'RUB')}`;
                        }
                    }
                }
            }
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

// Обновление последних транзакций
function updateRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="transaction-item" style="text-align: center; color: #888; padding: 20px;">
                📭 Нет операций
            </div>
        `;
        return;
    }
    
    transactions.slice(0, 3).forEach(transaction => {
        const transactionElement = createTransactionElement(transaction);
        container.appendChild(transactionElement);
    });
}

// Обновление списка сбережений
function updateSavingsList(savings) {
    const container = document.getElementById('savings-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    savings.forEach(item => {
        const progress = item.target_amount > 0 ? (item.current_amount / item.target_amount) * 100 : 0;
        const progressColor = progress >= 100 ? '#2ecc71' : 
                            progress >= 50 ? '#f39c12' : '#e74c3c';
        
        const div = document.createElement('div');
        div.className = 'savings-item';
        div.style.borderLeftColor = progressColor;
        
        div.innerHTML = `
            <div class="savings-header">
                <div class="savings-title">${item.category}</div>
                <div class="savings-amount">${formatCurrency(item.current_amount)} ${getCurrencySymbol(item.currency)}</div>
            </div>
            <div class="savings-progress">
                <div class="savings-progress-bar" style="width: ${Math.min(progress, 100)}%; background: ${progressColor};"></div>
            </div>
            ${item.target_amount > 0 ? `
                <div class="savings-target">
                    Цель: ${formatCurrency(item.target_amount)} ${getCurrencySymbol(item.currency)}
                </div>
            ` : ''}
        `;
        
        container.appendChild(div);
    });
}

// Загрузка истории по месяцам
async function loadMonthlyHistory() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/history/${currentUser.id}`);
        const monthlyData = await response.json();
        
        updateMonthlyHistory(monthlyData);
        
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        showNotification('Ошибка загрузки истории', 'error');
    }
}

// Обновление истории по месяцам
function updateMonthlyHistory(monthlyData) {
    const container = document.getElementById('monthly-history');
    if (!container) return;
    
    container.innerHTML = '';
    
    monthlyData.forEach(month => {
        const balanceClass = month.balance >= 0 ? 'positive' : 'negative';
        const balanceSign = month.balance >= 0 ? '+' : '';
        
        const div = document.createElement('div');
        div.className = 'month-item';
        
        div.innerHTML = `
            <div class="month-header" onclick="toggleMonthDetails(this)">
                <div class="month-title">${formatMonth(month.month)}</div>
                <div class="month-balance ${balanceClass}">
                    ${balanceSign}${formatCurrency(month.balance)} ${getCurrencySymbol(currentUser?.currency || 'RUB')}
                </div>
            </div>
            <div class="month-details">
                <div class="month-stats">
                    <div class="month-stat income">
                        <div class="month-stat-label">Доходы</div>
                        <div class="month-stat-value">${formatCurrency(month.income)}</div>
                    </div>
                    <div class="month-stat expense">
                        <div class="month-stat-label">Расходы</div>
                        <div class="month-stat-value">${formatCurrency(month.expense)}</div>
                    </div>
                    <div class="month-stat investment">
                        <div class="month-stat-label">Инвестиции</div>
                        <div class="month-stat-value">${formatCurrency(month.investment)}</div>
                    </div>
                    <div class="month-stat savings">
                        <div class="month-stat-label">Накопления</div>
                        <div class="month-stat-value">${formatCurrency(month.savings)}</div>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Форматирование месяца
function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

// Переключение деталей месяца
function toggleMonthDetails(element) {
    const details = element.nextElementSibling;
    details.classList.toggle('active');
}

// Навигация по страницам
function showPage(page) {
    currentPage = page;
    
    // Скрываем все страницы
    document.getElementById('main-page').style.display = 'none';
    document.getElementById('history-page').style.display = 'none';
    document.getElementById('savings-page').style.display = 'none';
    
    // Показываем нужную страницу
    document.getElementById(`${page}-page`).style.display = 'block';
    
    // Обновляем активные кнопки
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    // Загружаем данные для страницы
    if (page === 'history') {
        loadMonthlyHistory();
    } else if (page === 'savings') {
        initSavingsChart();
    }
}

// Инициализация диаграммы сбережений
function initSavingsChart() {
    if (!window.savings || window.savings.length === 0) return;
    
    const ctx = document.getElementById('savings-chart')?.getContext('2d');
    if (!ctx) return;
    
    if (savingsChart) {
        savingsChart.destroy();
    }
    
    const labels = window.savings.map(s => s.category);
    const data = window.savings.map(s => s.current_amount);
    const colors = window.savings.map(s => {
        const progress = s.target_amount > 0 ? (s.current_amount / s.target_amount) * 100 : 0;
        return progress >= 100 ? '#2ecc71' : 
               progress >= 50 ? '#f39c12' : '#e74c3c';
    });
    
    savingsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const saving = window.savings[context.dataIndex];
                            const progress = saving.target_amount > 0 ? 
                                ` (${Math.round((saving.current_amount / saving.target_amount) * 100)}%)` : '';
                            return `${context.label}: ${formatCurrency(context.raw)} ${getCurrencySymbol(saving.currency)}${progress}`;
                        }
                    }
                }
            }
        }
    });
}

// Смена валюты
async function changeCurrency(currency) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/currency/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: currentUser.id,
                currency: currency
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        currentUser.currency = currency;
        updateCurrencyDisplay(currency);
        updateSummaryDisplay(data.summary);
        
        showNotification(`Валюта изменена на ${currency}`, 'success');
        
        // Закрываем dropdown
        document.getElementById('currency-dropdown').classList.remove('active');
        
    } catch (error) {
        console.error('Ошибка смены валюты:', error);
        showNotification('Ошибка смены валюты', 'error');
    }
}

// Показать/скрыть выбор валюты
function toggleCurrencyDropdown() {
    document.getElementById('currency-dropdown').classList.toggle('active');
}

// Закрыть dropdown при клике вне его
document.addEventListener('click', (e) => {
    if (!e.target.closest('.currency-selector')) {
        document.getElementById('currency-dropdown').classList.remove('active');
    }
});

// Создание элемента транзакции
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    
    const isIncome = transaction.type === 'income';
    const amountClass = isIncome ? 'transaction-income' : 'transaction-expense';
    const amountSign = isIncome ? '+' : '-';
    const icon = isIncome ? '💰' : '💸';
    
    div.innerHTML = `
        <div class="transaction-info">
            <div class="transaction-description">
                ${icon} ${transaction.description}
            </div>
            <div class="transaction-meta">
                <span class="transaction-category">${transaction.category}</span>
                <span>${formatDate(transaction.date)}</span>
            </div>
        </div>
        <div class="transaction-amount ${amountClass}">
            ${amountSign}${formatCurrency(transaction.amount)} ${getCurrencySymbol(currentUser?.currency || 'RUB')}
        </div>
    `;
    
    return div;
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    if (diff < 7) return `${diff} дней назад`;
    
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit'
    });
}

// Настройка обработчиков
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
    
    document.getElementById('investment-btn').addEventListener('click', () => {
        currentTransactionType = 'investment';
        showTransactionForm();
    });
    
    // Кнопки навигации
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showPage(btn.dataset.page);
        });
    });
    
    // Кнопки формы
    document.getElementById('cancel-btn').addEventListener('click', hideTransactionForm);
    document.getElementById('submit-btn').addEventListener('click', submitTransaction);
    
    // Кнопка пополнения копилки
    document.getElementById('add-savings-btn')?.addEventListener('click', showAddSavingsModal);
}

// Показать форму добавления транзакции
function showTransactionForm() {
    const form = document.getElementById('transaction-form');
    const formTitle = document.getElementById('form-title');
    const categorySelect = document.getElementById('category');
    
    formTitle.textContent = 
        currentTransactionType === 'income' ? 'Добавить доход' :
        currentTransactionType === 'expense' ? 'Добавить расход' :
        currentTransactionType === 'investment' ? 'Добавить инвестицию' : 'Добавить в копилку';
    
    categorySelect.innerHTML = '';
    
    const categories = window.categories ? 
        (window.categories[currentTransactionType] || []) : [];
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        option.style.color = cat.color;
        categorySelect.appendChild(option);
    });
    
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth' });
    
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: currentUser.id,
                type: currentTransactionType,
                amount: parseFloat(amount),
                category: category,
                description: description || 'Без описания'
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        updateSummaryDisplay(data.summary);
        await loadUserData(); // Обновляем все данные
        
        hideTransactionForm();
        showNotification(
            currentTransactionType === 'income' ? '💵 Доход добавлен!' :
            currentTransactionType === 'expense' ? '💸 Расход добавлен!' :
            currentTransactionType === 'investment' ? '📈 Инвестиция добавлена!' : '💰 Накопление добавлено!',
            'success'
        );
        
        // Если мы на странице сбережений, обновляем график
        if (currentTransactionType === 'savings' && currentPage === 'savings') {
            initSavingsChart();
        }
        
    } catch (error) {
        console.error('Ошибка добавления транзакции:', error);
        showNotification('Ошибка добавления транзакции', 'error');
    }
}

// Показать модальное окно пополнения копилки
function showAddSavingsModal() {
    const modal = document.getElementById('add-savings-modal');
    const select = document.getElementById('savings-category');
    
    select.innerHTML = '';
    
    if (window.savings && window.savings.length > 0) {
        window.savings.forEach(saving => {
            const option = document.createElement('option');
            option.value = saving.category;
            option.textContent = `${saving.category} (${formatCurrency(saving.current_amount)}/${formatCurrency(saving.target_amount)})`;
            select.appendChild(option);
        });
    }
    
    modal.classList.add('active');
}

// Закрыть модальное окно
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Пополнение копилки
async function addToSavings() {
    const category = document.getElementById('savings-category').value;
    const amount = document.getElementById('savings-amount').value.trim();
    
    if (!category || !amount || parseFloat(amount) <= 0) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/savings/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: currentUser.id,
                category: category,
                amount: parseFloat(amount)
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        window.savings = data.savings;
        updateSavingsList(data.savings);
        
        closeModal('add-savings-modal');
        showNotification('Копилка пополнена!', 'success');
        
        // Обновляем график сбережений
        if (currentPage === 'savings') {
            initSavingsChart();
        }
        
    } catch (error) {
        console.error('Ошибка пополнения копилки:', error);
        showNotification('Ошибка пополнения копилки', 'error');
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.transform = 'translateX(0)';
    
    setTimeout(() => {
        notification.style.transform = 'translateX(150%)';
    }, 3000);
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('Произошла ошибка', 'error');
});

// Глобальные функции для HTML
window.showPage = showPage;
window.toggleMonthDetails = toggleMonthDetails;
window.changeCurrency = changeCurrency;
window.toggleCurrencyDropdown = toggleCurrencyDropdown;
window.showAddSavingsModal = showAddSavingsModal;
window.closeModal = closeModal;
window.addToSavings = addToSavings;