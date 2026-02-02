// Глобальные переменные
let currentUser = null;
let mainChart = null;
let savingsChart = null;
let currentTransactionType = 'income';
let currentChart = 'main'; // 'main' или 'savings'
let showingMoreTransactions = false;
let transactionsOffset = 0;
const TRANSACTIONS_PER_PAGE = 10;

// Курсы валют (упрощенные)
const CURRENCY_RATES = {
    'RUB': { symbol: '₽', rate: 1 },
    'USD': { symbol: '$', rate: 0.011 },
    'EUR': { symbol: '€', rate: 0.010 },
    'GEL': { symbol: '₾', rate: 0.033 }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Загрузка...');
    
    try {
        await initUser();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        initCharts();
        setupEventListeners();
        setupSwipe();
        
        // Настройка Telegram
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
        firstName: firstName,
        currency: data.currency || 'RUB'
    };
    
    window.categories = data.categories;
    window.availableCurrencies = data.available_currencies || ['RUB', 'USD', 'EUR', 'GEL'];
    
    updateCurrencyDisplay(currentUser.currency);
    updateSummaryDisplay(data.summary);
    updateRecentTransactions(data.recent_transactions);
}

// Обновление отображения валюты
function updateCurrencyDisplay(currency) {
    const currencySymbol = CURRENCY_RATES[currency]?.symbol || '₽';
    document.getElementById('current-currency').textContent = currencySymbol;
    document.getElementById('current-currency-symbol').textContent = currencySymbol;
    
    // Обновляем активную опцию в dropdown
    document.querySelectorAll('.currency-option').forEach(option => {
        option.classList.toggle('active', option.dataset.currency === currency);
    });
    
    // Обновляем отображение сумм
    updateAllAmounts();
}

// Обновление всех сумм на странице
function updateAllAmounts() {
    // Эта функция будет вызываться после смены валюты
    // Пока просто обновим символ валюты
    const currencySymbol = CURRENCY_RATES[currentUser?.currency]?.symbol || '₽';
    
    // Обновим баланс
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        const amount = balanceElement.textContent.replace(/[^0-9.,]/g, '');
        balanceElement.textContent = amount + ' ' + currencySymbol;
    }
}

// Обновление сводки
function updateSummaryDisplay(summary) {
    const currencySymbol = CURRENCY_RATES[currentUser?.currency]?.symbol || '₽';
    
    // Основные доходы/расходы
    document.getElementById('total-income').textContent = 
        formatCurrency(summary.total_income) + ' ' + currencySymbol;
    document.getElementById('total-expense').textContent = 
        formatCurrency(summary.total_expense) + ' ' + currencySymbol;
    document.getElementById('balance').textContent = 
        formatCurrency(summary.balance) + ' ' + currencySymbol;
    
    // Накопления
    document.getElementById('total-savings').textContent = 
        formatCurrency(summary.total_savings || 0) + ' ' + currencySymbol;
    
    if (mainChart) {
        updateMainChart(summary);
    }
    
    if (savingsChart) {
        updateSavingsChart(summary);
    }
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Инициализация диаграмм
function initCharts() {
    // Основная диаграмма (доходы/расходы)
    const mainCtx = document.getElementById('finance-chart').getContext('2d');
    mainChart = new Chart(mainCtx, {
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
                            const currencySymbol = CURRENCY_RATES[currentUser?.currency]?.symbol || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${currencySymbol}`;
                        }
                    }
                }
            }
        }
    });
    
    // Диаграмма накоплений
    const savingsCtx = document.getElementById('savings-chart').getContext('2d');
    savingsChart = new Chart(savingsCtx, {
        type: 'doughnut',
        data: {
            labels: ['Накопления'],
            datasets: [{
                data: [0],
                backgroundColor: ['#9b59b6'],
                borderColor: ['#8e44ad'],
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
                            const currencySymbol = CURRENCY_RATES[currentUser?.currency]?.symbol || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${currencySymbol}`;
                        }
                    }
                }
            }
        }
    });
}

// Обновление основной диаграммы
function updateMainChart(summary) {
    mainChart.data.datasets[0].data = [
        summary.total_income || 0,
        summary.total_expense || 0
    ];
    mainChart.update();
}

// Обновление диаграммы накоплений
function updateSavingsChart(summary) {
    savingsChart.data.datasets[0].data = [
        summary.total_savings || 0
    ];
    savingsChart.update();
}

// Переключение диаграмм
function switchChart(direction) {
    const chartContainer = document.getElementById('chart-container');
    const chartTitle = document.getElementById('chart-title');
    const indicatorDots = document.querySelectorAll('.indicator-dot');
    
    if (direction === 'next') {
        currentChart = currentChart === 'main' ? 'savings' : 'main';
    } else if (direction === 'prev') {
        currentChart = currentChart === 'main' ? 'savings' : 'main';
    }
    
    // Обновляем отображение
    if (currentChart === 'main') {
        chartContainer.style.transform = 'translateX(0)';
        chartTitle.textContent = 'Финансы';
        indicatorDots[0].classList.add('active');
        indicatorDots[1].classList.remove('active');
    } else {
        chartContainer.style.transform = 'translateX(-100%)';
        chartTitle.textContent = 'Накопления';
        indicatorDots[0].classList.remove('active');
        indicatorDots[1].classList.add('active');
    }
}

// Настройка свайпа
function setupSwipe() {
    const chartWrapper = document.querySelector('.chart-wrapper');
    let startX = 0;
    let endX = 0;
    
    chartWrapper.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });
    
    chartWrapper.addEventListener('touchend', (e) => {
        endX = e.changedTouches[0].clientX;
        handleSwipe();
    });
    
    function handleSwipe() {
        const diff = startX - endX;
        const minSwipe = 50; // минимальное расстояние свайпа
        
        if (Math.abs(diff) > minSwipe) {
            if (diff > 0) {
                // Свайп влево
                switchChart('next');
            } else {
                // Свайп вправо
                switchChart('prev');
            }
        }
    }
}

// Обновление последних транзакций
function updateRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions');
    const moreContainer = document.getElementById('more-transactions');
    
    if (!container) return;
    
    // Очищаем контейнеры
    container.innerHTML = '';
    if (moreContainer) moreContainer.innerHTML = '';
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="transaction-item" style="text-align: center; color: #888; padding: 20px;">
                📭 Нет операций
            </div>
        `;
        return;
    }
    
    // Показываем первые 3 транзакции
    const recent = transactions.slice(0, 3);
    recent.forEach(transaction => {
        const transactionElement = createTransactionElement(transaction);
        container.appendChild(transactionElement);
    });
    
    // Если есть еще транзакции, показываем кнопку "Ещё"
    if (transactions.length > 3 && !showingMoreTransactions) {
        const showMoreBtn = document.createElement('button');
        showMoreBtn.className = 'show-more-btn';
        showMoreBtn.innerHTML = '<span>⬇️</span> Показать все операции';
        showMoreBtn.onclick = showAllTransactions;
        container.parentNode.appendChild(showMoreBtn);
    }
}

// Показать все транзакции
async function showAllTransactions() {
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=50`);
        const allTransactions = await response.json();
        
        const moreContainer = document.createElement('div');
        moreContainer.id = 'more-transactions';
        moreContainer.className = 'more-transactions';
        
        // Пропускаем первые 3, которые уже показаны
        const additionalTransactions = allTransactions.slice(3);
        
        additionalTransactions.forEach(transaction => {
            const transactionElement = createTransactionElement(transaction);
            moreContainer.appendChild(transactionElement);
        });
        
        // Добавляем контейнер после основных транзакций
        const container = document.getElementById('recent-transactions');
        container.parentNode.insertBefore(moreContainer, container.nextSibling);
        
        // Меняем кнопку на "Скрыть"
        const showMoreBtn = document.querySelector('.show-more-btn');
        if (showMoreBtn) {
            showMoreBtn.innerHTML = '<span>⬆️</span> Скрыть';
            showMoreBtn.onclick = hideAllTransactions;
        }
        
        showingMoreTransactions = true;
        
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        showNotification('Ошибка загрузки', 'error');
    }
}

// Скрыть дополнительные транзакции
function hideAllTransactions() {
    const moreContainer = document.getElementById('more-transactions');
    if (moreContainer) {
        moreContainer.remove();
    }
    
    const showMoreBtn = document.querySelector('.show-more-btn');
    if (showMoreBtn) {
        showMoreBtn.innerHTML = '<span>⬇️</span> Показать все операции';
        showMoreBtn.onclick = showAllTransactions;
    }
    
    showingMoreTransactions = false;
}

// Создание элемента транзакции
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    
    const isIncome = transaction.type === 'income';
    const isSavings = transaction.type === 'savings';
    const amountClass = isIncome ? 'transaction-income' : 
                       isSavings ? 'transaction-savings' : 'transaction-expense';
    const amountSign = isIncome ? '+' : 
                      isSavings ? '💰' : '-';
    const icon = isIncome ? '💰' : 
                isSavings ? '🏦' : '💸';
    
    const currencySymbol = CURRENCY_RATES[currentUser?.currency]?.symbol || '₽';
    
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
            ${amountSign}${formatCurrency(transaction.amount)} ${currencySymbol}
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
    
    document.getElementById('savings-btn').addEventListener('click', () => {
        currentTransactionType = 'savings';
        showTransactionForm();
    });
    
    // Кнопки формы
    document.getElementById('cancel-btn').addEventListener('click', hideTransactionForm);
    document.getElementById('submit-btn').addEventListener('click', submitTransaction);
    
    // Кнопки навигации
    document.getElementById('history-btn').addEventListener('click', showHistory);
    document.getElementById('back-btn').addEventListener('click', showMain);
    
    // Кнопки переключения диаграмм
    document.getElementById('next-chart').addEventListener('click', () => switchChart('next'));
    document.getElementById('prev-chart').addEventListener('click', () => switchChart('prev'));
    
    // Выбор валюты
    document.getElementById('currency-btn').addEventListener('click', toggleCurrencyDropdown);
    
    // Закрытие dropdown при клике вне его
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.currency-selector')) {
            document.getElementById('currency-dropdown').classList.remove('active');
        }
    });
}

// Показать/скрыть выбор валюты
function toggleCurrencyDropdown() {
    document.getElementById('currency-dropdown').classList.toggle('active');
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
        
        // Перезагружаем данные для обновления сумм
        await reloadUserData();
        
        showNotification(`Валюта изменена на ${currency}`, 'success');
        document.getElementById('currency-dropdown').classList.remove('active');
        
    } catch (error) {
        console.error('Ошибка смены валюты:', error);
        showNotification('Ошибка смены валюты', 'error');
    }
}

// Показать форму транзакции
function showTransactionForm() {
    const form = document.getElementById('transaction-form');
    const formTitle = document.getElementById('form-title');
    const categorySelect = document.getElementById('category');
    
    let title = 'Добавить доход';
    if (currentTransactionType === 'expense') title = 'Добавить расход';
    if (currentTransactionType === 'savings') title = 'Добавить в копилку';
    
    formTitle.textContent = title;
    
    categorySelect.innerHTML = '';
    
    const categories = window.categories ? window.categories[currentTransactionType] : [];
    
    if (categories.length === 0) {
        if (currentTransactionType === 'income') categories.push('Зарплата');
        else if (currentTransactionType === 'expense') categories.push('Продукты');
        else categories.push('Накопления');
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
    newOption.textContent = '+ Новая категория';
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
                if (!window.categories) window.categories = { income: [], expense: [], savings: [] };
                if (!window.categories[currentTransactionType]) {
                    window.categories[currentTransactionType] = [];
                }
                window.categories[currentTransactionType].push(newCategory.trim());
                
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
        
        let message = '💵 Доход добавлен!';
        if (currentTransactionType === 'expense') message = '💸 Расход добавлен!';
        if (currentTransactionType === 'savings') message = '💰 Добавлено в копилку!';
        
        showNotification(message, 'success');
        
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
    
    const currencySymbol = CURRENCY_RATES[currentUser?.currency]?.symbol || '₽';
    
    monthlyData.forEach(month => {
        const balanceClass = month.balance >= 0 ? 'positive' : 'negative';
        const balanceSign = month.balance >= 0 ? '+' : '';
        
        const div = document.createElement('div');
        div.className = 'month-item';
        
        div.innerHTML = `
            <div class="month-header" onclick="toggleMonthDetails(this)">
                <div class="month-title">${formatMonth(month.month)}</div>
                <div class="month-balance ${balanceClass}">
                    ${balanceSign}${formatCurrency(month.balance)} ${currencySymbol}
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
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                   'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

// Показать главную
function showMain() {
    document.getElementById('history-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'block';
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
window.toggleMonthDetails = function(element) {
    const details = element.nextElementSibling;
    details.classList.toggle('active');
};

window.showMain = showMain;
window.switchChart = switchChart;
window.changeCurrency = changeCurrency;
window.toggleCurrencyDropdown = toggleCurrencyDropdown;
window.showAllTransactions = showAllTransactions;
window.hideAllTransactions = hideAllTransactions;