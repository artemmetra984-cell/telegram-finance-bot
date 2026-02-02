let currentUser = null;
let financeChart = null;
let savingsChart = null;
let currentTransactionType = 'income';
let currentPage = 'main';
let currentCurrency = 'RUB';
let currencySymbols = {
    'RUB': '₽',
    'USD': '$',
    'EUR': '€',
    'GEL': '₾'
};
let currentChart = 'main'; // 'main' или 'savings'
let allTransactionsLoaded = false;
let transactionsOffset = 3;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Загрузка...');
    
    try {
        await initUser();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        initCharts();
        setupEventListeners();
        setupSwipe();
        
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
    
    currentCurrency = data.currency || 'RUB';
    updateCurrencyDisplay();
    
    window.categories = data.categories;
    window.totalTransactions = data.total_transactions || 0;
    
    updateSummaryDisplay(data.summary);
    updateRecentTransactions(data.recent_transactions);
    
    // Обновляем кнопку "Ещё"
    updateShowMoreButton();
}

// Обновление сводки
function updateSummaryDisplay(summary) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    document.getElementById('total-income').textContent = 
        formatCurrency(summary.total_income) + ' ' + symbol;
    document.getElementById('total-expense').textContent = 
        formatCurrency(summary.total_expense) + ' ' + symbol;
    document.getElementById('total-savings').textContent = 
        formatCurrency(summary.total_savings) + ' ' + symbol;
    document.getElementById('balance').textContent = 
        formatCurrency(summary.balance) + ' ' + symbol;
    document.getElementById('savings-balance').textContent = 
        formatCurrency(summary.total_savings) + ' ' + symbol;
    
    if (financeChart) {
        updateMainChart(summary);
    }
    if (savingsChart) {
        updateSavingsChart(summary);
    }
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount);
}

// Инициализация диаграмм
function initCharts() {
    // Основная диаграмма
    const ctx1 = document.getElementById('finance-chart').getContext('2d');
    financeChart = new Chart(ctx1, {
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
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            }
        }
    });
    
    // Диаграмма накоплений
    const ctx2 = document.getElementById('savings-chart').getContext('2d');
    savingsChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Накопления', 'Остаток'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#f39c12', '#3d3d3d'],
                borderColor: ['#e67e22', '#2d2d2d'],
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
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            }
        }
    });
}

// Обновление основной диаграммы
function updateMainChart(summary) {
    financeChart.data.datasets[0].data = [
        summary.total_income || 0,
        summary.total_expense || 0
    ];
    financeChart.update();
}

// Обновление диаграммы накоплений
function updateSavingsChart(summary) {
    const savings = summary.total_savings || 0;
    const totalExpense = summary.total_expense || 1;
    const percentage = (savings / totalExpense) * 100 || 0;
    const remaining = 100 - percentage;
    
    savingsChart.data.datasets[0].data = [
        percentage,
        remaining
    ];
    savingsChart.update();
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

// Загрузка всех транзакций
async function loadAllTransactions() {
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=50&offset=0`);
        const transactions = await response.json();
        
        const container = document.getElementById('all-transactions-list');
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
        
        transactions.forEach(transaction => {
            const transactionElement = createTransactionElement(transaction);
            container.appendChild(transactionElement);
        });
        
        allTransactionsLoaded = true;
        
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        showNotification('Ошибка загрузки', 'error');
    }
}

// Создание элемента транзакции
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    
    const isIncome = transaction.type === 'income';
    const isSaving = transaction.category === 'Накопления';
    const amountClass = isIncome ? 'transaction-income' : 'transaction-expense';
    const amountSign = isIncome ? '+' : '-';
    const icon = isSaving ? '💰' : (isIncome ? '💵' : '💸');
    const symbol = currencySymbols[currentCurrency] || '₽';
    
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
            ${amountSign}${formatCurrency(transaction.amount)} ${symbol}
        </div>
    `;
    
    return div;
}

// Обновление кнопки "Ещё"
function updateShowMoreButton() {
    const button = document.getElementById('show-more-btn');
    if (!button) return;
    
    if (window.totalTransactions > 3) {
        button.style.display = 'flex';
        button.innerHTML = `<span>📋</span> Ещё (${window.totalTransactions - 3})`;
    } else {
        button.style.display = 'none';
    }
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
        currentTransactionType = 'expense';
        showTransactionForm();
        // Автоматически выбираем категорию "Накопления"
        setTimeout(() => {
            const categorySelect = document.getElementById('category');
            if (categorySelect) {
                const savingOption = Array.from(categorySelect.options)
                    .find(opt => opt.value === 'Накопления');
                if (savingOption) {
                    categorySelect.value = 'Накопления';
                }
            }
        }, 100);
    });
    
    // Кнопки формы
    document.getElementById('cancel-btn').addEventListener('click', hideTransactionForm);
    document.getElementById('submit-btn').addEventListener('click', submitTransaction);
    
    // Кнопки навигации
    document.getElementById('history-btn-small').addEventListener('click', showHistory);
    document.getElementById('back-btn').addEventListener('click', showMain);
    
    // Кнопка "Ещё"
    document.getElementById('show-more-btn').addEventListener('click', toggleAllTransactions);
    
    // Кнопки переключения диаграмм
    document.getElementById('prev-chart').addEventListener('click', showPrevChart);
    document.getElementById('next-chart').addEventListener('click', showNextChart);
    
    // Выбор валюты
    document.getElementById('currency-btn').addEventListener('click', toggleCurrencyDropdown);
    
    // Закрытие выпадающего списка при клике вне его
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.currency-selector')) {
            document.getElementById('currency-dropdown').classList.remove('show');
        }
    });
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
            window.totalTransactions = data.total_transactions || 0;
            updateShowMoreButton();
            
            // Обновляем счетчик транзакций
            const countResponse = await fetch(`/api/transactions_count/${currentUser.id}`);
            const countData = await countResponse.json();
            window.totalTransactions = countData.count || 0;
        }
    } catch (error) {
        console.error('Ошибка обновления:', error);
    }
}

// Показать/скрыть все транзакции
async function toggleAllTransactions() {
    const container = document.getElementById('all-transactions-container');
    const button = document.getElementById('show-more-btn');
    
    if (container.classList.contains('show')) {
        container.classList.remove('show');
        button.innerHTML = `<span>📋</span> Ещё (${window.totalTransactions - 3})`;
    } else {
        if (!allTransactionsLoaded) {
            await loadAllTransactions();
        }
        container.classList.add('show');
        button.innerHTML = `<span>📋</span> Скрыть`;
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
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    monthlyData.forEach(month => {
        const balanceClass = month.balance >= 0 ? 'positive' : 'negative';
        const balanceSign = month.balance >= 0 ? '+' : '';
        
        const div = document.createElement('div');
        div.className = 'month-item';
        
        div.innerHTML = `
            <div class="month-header" onclick="toggleMonthDetails(this)">
                <div class="month-title">${formatMonth(month.month)}</div>
                <div class="month-balance ${balanceClass}">
                    ${balanceSign}${formatCurrency(month.balance)} ${symbol}
                </div>
            </div>
            <div class="month-details">
                <div class="month-stats">
                    <div class="month-stat income">
                        <div class="month-stat-label">Доходы</div>
                        <div class="month-stat-value">${formatCurrency(month.income)} ${symbol}</div>
                    </div>
                    <div class="month-stat expense">
                        <div class="month-stat-label">Расходы</div>
                        <div class="month-stat-value">${formatCurrency(month.expense)} ${symbol}</div>
                    </div>
                    <div class="month-stat savings">
                        <div class="month-stat-label">Накопления</div>
                        <div class="month-stat-value">${formatCurrency(month.savings)} ${symbol}</div>
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

// Показать главную
function showMain() {
    document.getElementById('history-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'block';
    currentPage = 'main';
}

// Настройка свайпа
function setupSwipe() {
    const chartsContainer = document.querySelector('.charts-wrapper');
    let startX = 0;
    let endX = 0;
    const threshold = 50;
    
    chartsContainer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });
    
    chartsContainer.addEventListener('touchend', (e) => {
        endX = e.changedTouches[0].clientX;
        handleSwipe();
    });
    
    function handleSwipe() {
        const diff = startX - endX;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0 && currentChart === 'main') {
                // Свайп влево - показываем накопления
                showSavingsChart();
            } else if (diff < 0 && currentChart === 'savings') {
                // Свайп вправо - показываем основную
                showMainChart();
            }
        }
    }
}

// Показать основную диаграмму
function showMainChart() {
    currentChart = 'main';
    document.querySelector('.charts-wrapper').classList.remove('savings');
    document.querySelector('.charts-wrapper').classList.add('main');
    updateChartIndicators();
}

// Показать диаграмму накоплений
function showSavingsChart() {
    currentChart = 'savings';
    document.querySelector('.charts-wrapper').classList.remove('main');
    document.querySelector('.charts-wrapper').classList.add('savings');
    updateChartIndicators();
}

// Переключение на предыдущую диаграмму
function showPrevChart() {
    if (currentChart === 'savings') {
        showMainChart();
    }
}

// Переключение на следующую диаграмму
function showNextChart() {
    if (currentChart === 'main') {
        showSavingsChart();
    }
}

// Обновление индикаторов диаграмм
function updateChartIndicators() {
    const dots = document.querySelectorAll('.chart-dot');
    dots.forEach((dot, index) => {
        if ((index === 0 && currentChart === 'main') || (index === 1 && currentChart === 'savings')) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// Выбор валюты
async function selectCurrency(currency) {
    currentCurrency = currency;
    updateCurrencyDisplay();
    
    // Закрываем выпадающий список
    document.getElementById('currency-dropdown').classList.remove('show');
    
    // Сохраняем валюту на сервере
    if (currentUser) {
        try {
            await fetch('/api/update_currency', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    user_id: currentUser.id,
                    currency: currency
                })
            });
            
            // Перезагружаем данные с новой валютой
            await reloadUserData();
            
        } catch (error) {
            console.error('Ошибка обновления валюты:', error);
        }
    }
}

// Обновление отображения валюты
function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    document.getElementById('currency-symbol').textContent = symbol;
    document.getElementById('currency-code').textContent = currentCurrency;
    
    // Обновляем выбранную опцию в выпадающем списке
    document.querySelectorAll('.currency-option').forEach(option => {
        if (option.dataset.currency === currentCurrency) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Показать/скрыть выпадающий список валют
function toggleCurrencyDropdown() {
    document.getElementById('currency-dropdown').classList.toggle('show');
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

// Переключение деталей месяца
function toggleMonthDetails(element) {
    const details = element.nextElementSibling;
    details.classList.toggle('active');
}

// Глобальные функции
window.toggleMonthDetails = toggleMonthDetails;
window.showMain = showMain;
window.selectCurrency = selectCurrency;
window.showMainChart = showMainChart;
window.showSavingsChart = showSavingsChart;