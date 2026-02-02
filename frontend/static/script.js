let currentUser = null;
let financeChart = null;
let currentTransactionType = 'income';
let currentPage = 'main'; // main, history

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Загрузка...');
    
    try {
        await initUser();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        initChart();
        setupEventListeners();
        
        // Настройка Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#1a1a1a');
            Telegram.WebApp.setBackgroundColor('#1a1a1a');
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки', 'error');
    }
});

// Инициализация пользователя
async function initUser() {
    let telegramId;
    let username = '';
    let firstName = 'Пользователь';
    
    if (window.Telegram && Telegram.WebApp) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        if (user) {
            telegramId = user.id;
            username = user.username || '';
            firstName = user.first_name || 'Пользователь';
        }
    }
    
    if (!telegramId) {
        telegramId = Math.floor(Math.random() * 1000000);
    }
    
    const response = await fetch('/api/init', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            telegram_id: telegramId,
            username: username,
            first_name: firstName
        })
    });
    
    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    
    currentUser = {
        id: data.user_id,
        telegramId: telegramId,
        username: username,
        firstName: firstName
    };
    
    window.categories = data.categories;
    
    updateSummaryDisplay(data.summary);
    updateRecentTransactions(data.recent_transactions);
}

// Обновление сводки
function updateSummaryDisplay(summary) {
    document.getElementById('total-income').textContent = 
        formatCurrency(summary.total_income) + ' ₽';
    document.getElementById('total-expense').textContent = 
        formatCurrency(summary.total_expense) + ' ₽';
    document.getElementById('balance').textContent = 
        formatCurrency(summary.balance) + ' ₽';
    
    if (financeChart) {
        updateChart(summary);
    }
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount);
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
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: ['#27ae60', '#c0392b'],
                borderWidth: 3,
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
                            return `${context.label}: ${formatCurrency(context.raw)} ₽`;
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
                ${icon} ${transaction.description || 'Без описания'}
            </div>
            <div class="transaction-meta">
                <span class="transaction-category">${transaction.category}</span>
                <span>${formatDate(transaction.date)}</span>
            </div>
        </div>
        <div class="transaction-amount ${amountClass}">
            ${amountSign}${formatCurrency(transaction.amount)} ₽
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
    // Кнопки добавления
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
    
    // Кнопки навигации
    document.getElementById('history-btn').addEventListener('click', showHistory);
    document.getElementById('back-btn').addEventListener('click', showMain);
}

// Показать форму транзакции
function showTransactionForm() {
    const form = document.getElementById('transaction-form');
    const formTitle = document.getElementById('form-title');
    const categorySelect = document.getElementById('category');
    
    formTitle.textContent = currentTransactionType === 'income' ? 'Добавить доход' : 'Добавить расход';
    
    categorySelect.innerHTML = '';
    
    const categories = window.categories ? window.categories[currentTransactionType] : [];
    
    if (categories.length === 0) {
        categories.push(currentTransactionType === 'income' ? 'Зарплата' : 'Продукты');
    }
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
    
    // Добавляем опцию для новой категории
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Добавить категорию';
    categorySelect.appendChild(newOption);
    
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(() => {
        document.getElementById('amount').focus();
    }, 300);
    
    // Обработчик для новой категории
    categorySelect.onchange = function() {
        if (this.value === '__new__') {
            const newCategory = prompt('Введите название новой категории:');
            if (newCategory && newCategory.trim()) {
                // Добавляем новую категорию
                if (!window.categories) window.categories = { income: [], expense: [] };
                if (!window.categories[currentTransactionType]) {
                    window.categories[currentTransactionType] = [];
                }
                window.categories[currentTransactionType].push(newCategory.trim());
                
                // Обновляем select
                showTransactionForm();
                categorySelect.value = newCategory.trim();
            }
        }
    };
}

// Скрыть форму
function hideTransactionForm() {
    document.getElementById('transaction-form').style.display = 'none';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
}

// Отправить транзакцию
async function submitTransaction() {
    const amount = document.getElementById('amount').value.trim();
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value.trim();
    
    if (!amount || parseFloat(amount) <= 0) {
        showNotification('Введите сумму', 'error');
        return;
    }
    
    if (!category || category === '__new__') {
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
        await reloadUserData();
        
        hideTransactionForm();
        showNotification(
            currentTransactionType === 'income' ? '💵 Доход добавлен!' : '💸 Расход добавлен!',
            'success'
        );
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка добавления', 'error');
    }
}

// Перезагрузка данных пользователя
async function reloadUserData() {
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
        
        if (!data.error) {
            updateSummaryDisplay(data.summary);
            updateRecentTransactions(data.recent_transactions);
        }
    } catch (error) {
        console.error('Ошибка обновления:', error);
    }
}

// Показать историю
async function showHistory() {
    document.getElementById('main-page').style.display = 'none';
    document.getElementById('history-page').style.display = 'block';
    currentPage = 'history';
    
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
    
    if (monthlyData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #888; padding: 40px;">
                📭 Нет данных
            </div>
        `;
        return;
    }
    
    monthlyData.forEach(month => {
        const balanceClass = month.balance >= 0 ? 'positive' : 'negative';
        const balanceSign = month.balance >= 0 ? '+' : '';
        
        const div = document.createElement('div');
        div.className = 'month-item';
        
        div.innerHTML = `
            <div class="month-header" onclick="toggleMonthDetails(this)">
                <div class="month-title">${formatMonth(month.month)}</div>
                <div class="month-balance ${balanceClass}">
                    ${balanceSign}${formatCurrency(month.balance)} ₽
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

// Показать главную
function showMain() {
    document.getElementById('history-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'block';
    currentPage = 'main';
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

// Глобальные функции
window.toggleMonthDetails = toggleMonthDetails;
window.showMain = showMain;