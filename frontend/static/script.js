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
        setupNavigation();
        loadPanelPage();
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
        // После успешной инициализации пользователя
    // Загружаем статистику для панели
    if (window.location.hash !== '#history' && window.location.hash !== '#report') {
        setTimeout(() => {
            updateCategoriesStats();
        }, 1000);
    }
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


// ==================== //
// НАВИГАЦИЯ ПО СТРАНИЦАМ //
// ==================== //

function setupNavigation() {
    console.log('Настраиваю навигацию...');
    
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const pageName = this.dataset.page;
            
            console.log('Переключаю на страницу:', pageName);
            
            // Убираем активный класс у всех кнопок
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Добавляем активный класс нажатой кнопке
            this.classList.add('active');
            
            // Скрываем все страницы
            document.querySelectorAll('.page').forEach(pageEl => {
                pageEl.classList.remove('active');
            });
            
            // Показываем нужную страницу
            const targetPage = document.getElementById(`${pageName}-page`);
            if (targetPage) {
                targetPage.classList.add('active');
                
                // Загружаем данные для страницы если нужно
                if (pageName === 'history') {
                    loadHistoryPage();
                } else if (pageName === 'report') {
                    loadReportPage();
                } else if (pageName === 'panel') {
                    loadPanelPage();
                }
            }
        });
    });
    
    console.log('Навигация настроена');
}

// ==================== //
// ПАНЕЛЬ УПРАВЛЕНИЯ КАТЕГОРИЯМИ //
// ==================== //

function loadPanelPage() {
    console.log('Загружаю панель управления...');
    
    // Загружаем статистику по категориям
    updateCategoriesStats();
    
    // Настраиваем обработчики для кнопок "Добавить"
    setupCategoryButtons();
}

// Обновление статистики по категориям
async function updateCategoriesStats() {
    if (!currentUser) return;
    
    try {
        // Загружаем транзакции пользователя
        const response = await fetch(`/api/transactions/${currentUser.id}`);
        const transactions = await response.json();
        
        // Считаем суммы по категориям
        const categoryStats = {};
        
        transactions.forEach(trans => {
            const category = trans.category;
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    income: 0,
                    expense: 0,
                    total: 0
                };
            }
            
            if (trans.type === 'income') {
                categoryStats[category].income += trans.amount;
                categoryStats[category].total += trans.amount;
            } else {
                categoryStats[category].expense += trans.amount;
                categoryStats[category].total -= trans.amount;
            }
        });
        
        // Обновляем отображение на категориях
        updateCategoryDisplays(categoryStats);
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Обновление отображения категорий
function updateCategoryDisplays(stats) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Обновляем все категории
    document.querySelectorAll('.category-item').forEach(item => {
        const categoryId = item.dataset.id;
        if (categoryId && stats[categoryId]) {
            const amountElement = item.querySelector('.category-amount');
            if (amountElement) {
                const amount = stats[categoryId].total;
                amountElement.textContent = `${formatCurrency(Math.abs(amount))} ${symbol}`;
                
                // Цвет в зависимости от суммы
                if (amount > 0) {
                    amountElement.style.color = '#2ecc71';
                } else if (amount < 0) {
                    amountElement.style.color = '#e74c3c';
                }
            }
        }
    });
}

// Настройка кнопок добавления категорий
function setupCategoryButtons() {
    // Кнопки "Добавить" категорию
    document.querySelectorAll('.category-item.add-new').forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type;
            showAddCategoryModal(type);
        });
    });
    
    // Существующие категории - можно редактировать по долгому нажатию
    document.querySelectorAll('.category-item:not(.add-new)').forEach(item => {
        item.addEventListener('click', function() {
            // Показываем транзакции этой категории
            const category = this.dataset.id;
            const type = this.dataset.type;
            showCategoryTransactions(category, type);
        });
        
        // Долгое нажатие для редактирования
        let pressTimer;
        item.addEventListener('touchstart', function(e) {
            pressTimer = setTimeout(() => {
                showEditCategoryModal(this.dataset.id, this.dataset.type);
            }, 1000);
            e.preventDefault();
        });
        
        item.addEventListener('touchend', function() {
            clearTimeout(pressTimer);
        });
        
        item.addEventListener('touchmove', function() {
            clearTimeout(pressTimer);
        });
    });
    
    // Настройка модального окна
    setupCategoryModal();
}

// Показать транзакции категории
function showCategoryTransactions(category, type) {
    // Переключаемся на вкладку истории и фильтруем
    document.querySelector('[data-page="history"]').click();
    
    // TODO: Реализовать фильтрацию по категории
    console.log('Показываю транзакции категории:', category, type);
}

// Показать модальное окно добавления категории
function showAddCategoryModal(type) {
    const modal = document.getElementById('category-modal');
    const title = modal.querySelector('.modal-title');
    
    // Устанавливаем заголовок по типу
    const typeNames = {
        'income': 'дохода',
        'expense': 'расхода', 
        'wallet': 'кошелька',
        'savings': 'накопления'
    };
    
    title.textContent = `Добавить категорию ${typeNames[type] || ''}`;
    
    // Сохраняем тип в data-атрибут
    modal.dataset.categoryType = type;
    
    // Заполняем иконки
    fillIconsGrid();
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на поле ввода
    setTimeout(() => {
        document.getElementById('category-name').focus();
    }, 300);
}

// Заполнение сетки иконок
function fillIconsGrid() {
    const iconsGrid = document.getElementById('icons-grid');
    iconsGrid.innerHTML = '';
    
    const icons = ['💰', '💵', '💳', '🏠', '🛒', '🚗', '🍕', '🎬', '📈', '🐷', '✈️', '🎁', '🏥', '📱', '👕', '🎓', '⚽', '🍔', '☕', '📚'];
    
    icons.forEach(icon => {
        const div = document.createElement('div');
        div.className = 'icon-option';
        div.textContent = icon;
        div.dataset.icon = icon;
        
        div.addEventListener('click', function() {
            // Убираем выделение у всех
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            // Выделяем текущую
            this.classList.add('selected');
        });
        
        iconsGrid.appendChild(div);
    });
    
    // Выбираем первую иконку по умолчанию
    if (iconsGrid.firstChild) {
        iconsGrid.firstChild.classList.add('selected');
    }
}

// Настройка модального окна категории
function setupCategoryModal() {
    const modal = document.getElementById('category-modal');
    const form = modal.querySelector('.modal-form');
    const cancelBtn = document.getElementById('modal-cancel');
    
    // Отмена
    cancelBtn.addEventListener('click', function() {
        modal.classList.remove('active');
        form.reset();
    });
    
    // Закрытие по клику вне окна
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            form.reset();
        }
    });
    
    // Сохранение
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('category-name').value.trim();
        const selectedIcon = document.querySelector('.icon-option.selected');
        const icon = selectedIcon ? selectedIcon.dataset.icon : '💰';
        const type = modal.dataset.categoryType;
        
        if (!name) {
            showNotification('Введите название категории', 'error');
            return;
        }
        
        // Добавляем новую категорию
        addNewCategory(name, icon, type);
        
        // Закрываем модальное окно
        modal.classList.remove('active');
        form.reset();
    });
}

// Добавление новой категории
function addNewCategory(name, icon, type) {
    // Создаем элемент категории
    const categoryGrid = document.getElementById(`${type}-categories`);
    if (!categoryGrid) return;
    
    // Создаем уникальный ID
    const id = `${type}_${Date.now()}`;
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.dataset.id = id;
    categoryItem.dataset.type = type;
    
    categoryItem.innerHTML = `
        <div class="category-icon">${icon}</div>
        <div class="category-name">${name}</div>
        <div class="category-amount">0 ${currencySymbols[currentCurrency] || '₽'}</div>
    `;
    
    // Вставляем перед кнопкой "Добавить"
    const addButton = categoryGrid.querySelector('.add-new');
    if (addButton) {
        categoryGrid.insertBefore(categoryItem, addButton);
    } else {
        categoryGrid.appendChild(categoryItem);
    }
    
    // Добавляем обработчики
    setupCategoryItemListeners(categoryItem);
    
    showNotification(`Категория "${name}" добавлена`, 'success');
    
    // TODO: Сохранить категорию на сервере
    console.log('Добавлена категория:', { id, name, icon, type });
}

// Настройка обработчиков для новой категории
function setupCategoryItemListeners(item) {
    // Клик - показать транзакции
    item.addEventListener('click', function() {
        const category = this.dataset.id;
        const type = this.dataset.type;
        showCategoryTransactions(category, type);
    });
    
    // Долгое нажатие - редактирование
    let pressTimer;
    item.addEventListener('touchstart', function(e) {
        pressTimer = setTimeout(() => {
            showEditCategoryModal(this.dataset.id, this.dataset.type);
        }, 1000);
        e.preventDefault();
    });
    
    item.addEventListener('touchend', function() {
        clearTimeout(pressTimer);
    });
    
    item.addEventListener('touchmove', function() {
        clearTimeout(pressTimer);
    });
}

// Показать модальное окно редактирования категории
function showEditCategoryModal(categoryId, type) {
    // TODO: Реализовать редактирование категории
    console.log('Редактировать категорию:', categoryId, type);
    showNotification('Редактирование категорий будет доступно в следующем обновлении', 'info');
}

f// ==================== //
// ИСТОРИЯ ТРАНЗАКЦИЙ ПО МЕСЯЦАМ //
// ==================== //

let currentHistoryMonth = new Date(); // Текущий отображаемый месяц
let currentFilter = 'all';

function loadHistoryPage() {
    console.log('Загружаю историю...');
    
    // Устанавливаем текущий месяц
    updateMonthDisplay();
    
    // Загружаем данные за месяц
    loadMonthTransactions();
    
    // Настраиваем обработчики
    setupHistoryControls();
}

// Обновление отображения месяца
function updateMonthDisplay() {
    const monthElement = document.getElementById('current-month');
    const monthName = currentHistoryMonth.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric'
    });
    
    // Делаем первую букву заглавной
    monthElement.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

// Загрузка транзакций за месяц
async function loadMonthTransactions() {
    if (!currentUser) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    try {
        // Показываем загрузку
        const container = document.getElementById('month-transactions');
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #888;">
                <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 15px;"></div>
                <p>Загрузка транзакций...</p>
            </div>
        `;
        
        // Получаем все транзакции пользователя
        const response = await fetch(`/api/transactions/${currentUser.id}`);
        const allTransactions = await response.json();
        
        // Фильтруем по месяцу
        const monthStart = new Date(currentHistoryMonth.getFullYear(), currentHistoryMonth.getMonth(), 1);
        const monthEnd = new Date(currentHistoryMonth.getFullYear(), currentHistoryMonth.getMonth() + 1, 0);
        
        const monthTransactions = allTransactions.filter(trans => {
            const transDate = new Date(trans.date);
            return transDate >= monthStart && transDate <= monthEnd;
        });
        
        // Считаем статистику
        let totalIncome = 0;
        let totalExpense = 0;
        let totalSavings = 0;
        
        monthTransactions.forEach(trans => {
            if (trans.type === 'income') {
                totalIncome += trans.amount;
            } else {
                totalExpense += trans.amount;
                if (trans.category === 'Накопления') {
                    totalSavings += trans.amount;
                }
            }
        });
        
        const balance = totalIncome - totalExpense;
        
        // Обновляем статистику
        document.getElementById('month-income').textContent = `${formatCurrency(totalIncome)} ${symbol}`;
        document.getElementById('month-expense').textContent = `${formatCurrency(totalExpense)} ${symbol}`;
        document.getElementById('month-savings').textContent = `${formatCurrency(totalSavings)} ${symbol}`;
        document.getElementById('month-balance').textContent = `Баланс: ${formatCurrency(balance)} ${symbol}`;
        
        // Применяем фильтр
        let filteredTransactions = monthTransactions;
        if (currentFilter === 'income') {
            filteredTransactions = monthTransactions.filter(t => t.type === 'income');
        } else if (currentFilter === 'expense') {
            filteredTransactions = monthTransactions.filter(t => t.type === 'expense');
        }
        
        // Отображаем транзакции
        displayMonthTransactions(filteredTransactions);
        
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        
        const container = document.getElementById('month-transactions');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #888;">
                <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
                <p>Не удалось загрузить транзакции</p>
                <button onclick="loadMonthTransactions()" style="margin-top: 15px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

// Отображение транзакций месяца
function displayMonthTransactions(transactions) {
    const container = document.getElementById('month-transactions');
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #888;">
                <div style="font-size: 48px; margin-bottom: 20px;">📭</div>
                <p>Нет транзакций за этот месяц</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    transactions.forEach((trans, index) => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'transaction-income' : 'transaction-expense';
        const amountSign = isIncome ? '+' : '-';
        const icon = isIncome ? '💵' : '💸';
        
        // Форматируем дату
        const transDate = new Date(trans.date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateDisplay = transDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit'
        });
        
        if (transDate.toDateString() === today.toDateString()) {
            dateDisplay = 'Сегодня';
        } else if (transDate.toDateString() === yesterday.toDateString()) {
            dateDisplay = 'Вчера';
        }
        
        html += `
            <div class="transaction-item history-item" data-id="${trans.id}">
                <div class="transaction-info">
                    <div class="transaction-description">
                        ${icon} ${trans.description || 'Без описания'}
                    </div>
                    <div class="transaction-meta">
                        <span class="transaction-category">${trans.category}</span>
                        <span>${dateDisplay}</span>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Добавляем обработчики для редактирования
    setupTransactionEditHandlers();
}

// Настройка элементов управления историей
function setupHistoryControls() {
    // Кнопки переключения месяцев
    document.getElementById('prev-month').addEventListener('click', () => {
        currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() - 1);
        updateMonthDisplay();
        loadMonthTransactions();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() + 1);
        updateMonthDisplay();
        loadMonthTransactions();
    });
    
    // Кнопки фильтрации
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Обновляем активную кнопку
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Устанавливаем фильтр
            currentFilter = this.dataset.filter;
            
            // Перезагружаем транзакции
            loadMonthTransactions();
        });
    });
}

// Настройка обработчиков для редактирования транзакций
function setupTransactionEditHandlers() {
    document.querySelectorAll('.history-item').forEach(item => {
        // Клик - показываем детали
        item.addEventListener('click', function() {
            const transactionId = this.dataset.id;
            showTransactionDetails(transactionId);
        });
        
        // Долгое нажатие - редактирование
        let pressTimer;
        item.addEventListener('touchstart', function(e) {
            pressTimer = setTimeout(() => {
                const transactionId = this.dataset.id;
                editTransaction(transactionId);
            }, 800);
            e.preventDefault();
        });
        
        item.addEventListener('touchend', function() {
            clearTimeout(pressTimer);
        });
        
        item.addEventListener('touchmove', function() {
            clearTimeout(pressTimer);
        });
    });
}

// Показать детали транзакции
function showTransactionDetails(transactionId) {
    // TODO: Реализовать показ деталей
    console.log('Детали транзакции:', transactionId);
}

// Редактировать транзакцию
function editTransaction(transactionId) {
    // TODO: Реализовать редактирование
    console.log('Редактировать транзакцию:', transactionId);
    showNotification('Редактирование транзакций будет доступно в следующем обновлении', 'info');
}

// ==================== //
// ОТЧЁТЫ И СТАТИСТИКА //
// ==================== //

let reportCharts = {
    overview: null,
    income: null,
    expense: null,
    ratio: null,
    savings: null,
    balance: null
};

function loadReportPage() {
    console.log('Загружаю отчёты...');
    
    // Настраиваем переключение подвкладок
    setupReportTabs();
    
    // Загружаем данные для отчётов
    loadReportData();
    
    // Настраиваем кнопку добавления транзакции
    setupAddTransactionButton();
}

// Настройка подвкладок отчёта
function setupReportTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Обновляем активную кнопку
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Показываем нужную подвкладку
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Обновляем диаграмму если нужно
            updateChartForTab(tabId);
        });
    });
}

// Загрузка данных для отчётов
async function loadReportData() {
    if (!currentUser) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    try {
        // Загружаем все транзакции
        const response = await fetch(`/api/transactions/${currentUser.id}`);
        const transactions = await response.json();
        
        // Загружаем месячную историю
        const historyResponse = await fetch(`/api/history/${currentUser.id}`);
        const monthlyData = await historyResponse.json();
        
        // Считаем общую статистику
        let totalIncome = 0;
        let totalExpense = 0;
        let totalSavings = 0;
        let incomeByCategory = {};
        let expenseByCategory = {};
        
        transactions.forEach(trans => {
            if (trans.type === 'income') {
                totalIncome += trans.amount;
                
                // Статистика по категориям доходов
                if (!incomeByCategory[trans.category]) {
                    incomeByCategory[trans.category] = 0;
                }
                incomeByCategory[trans.category] += trans.amount;
            } else {
                totalExpense += trans.amount;
                
                // Статистика по категориям расходов
                if (!expenseByCategory[trans.category]) {
                    expenseByCategory[trans.category] = 0;
                }
                expenseByCategory[trans.category] += trans.amount;
                
                // Накопления
                if (trans.category === 'Накопления') {
                    totalSavings += trans.amount;
                }
            }
        });
        
        const totalBalance = totalIncome - totalExpense;
        
        // Обновляем общую статистику
        document.getElementById('total-income-stat').textContent = `${formatCurrency(totalIncome)} ${symbol}`;
        document.getElementById('total-expense-stat').textContent = `${formatCurrency(totalExpense)} ${symbol}`;
        document.getElementById('total-savings-stat').textContent = `${formatCurrency(totalSavings)} ${symbol}`;
        document.getElementById('total-balance-stat').textContent = `${formatCurrency(totalBalance)} ${symbol}`;
        document.getElementById('total-balance-stat').style.color = totalBalance >= 0 ? '#2ecc71' : '#e74c3c';
        
        // Создаём диаграммы
        createCharts({
            totalIncome,
            totalExpense,
            totalSavings,
            incomeByCategory,
            expenseByCategory,
            monthlyData
        });
        
        // Обновляем детализацию по категориям
        updateCategoryBreakdown(incomeByCategory, expenseByCategory);
        
        // Обновляем соотношение доходов/расходов
        updateRatioChart(totalIncome, totalExpense);
        
        // Обновляем динамику баланса
        updateBalanceTrend(monthlyData);
        
    } catch (error) {
        console.error('Ошибка загрузки данных для отчёта:', error);
    }
}

// Создание диаграмм
function createCharts(data) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // 1. Общая диаграмма
    createOverviewChart(data.totalIncome, data.totalExpense, symbol);
    
    // 2. Диаграмма доходов по категориям
    createIncomeChart(data.incomeByCategory, symbol);
    
    // 3. Диаграмма расходов по категориям
    createExpenseChart(data.expenseByCategory, symbol);
    
    // 4. Диаграмма соотношения
    createRatioChart(data.totalIncome, data.totalExpense);
    
    // 5. Диаграмма накоплений
    createSavingsChart(data.totalSavings, data.totalExpense, symbol);
    
    // 6. Диаграмма баланса
    createBalanceChart(data.monthlyData, symbol);
}

// Создание общей диаграммы
function createOverviewChart(income, expense, symbol) {
    const ctx = document.getElementById('overview-chart').getContext('2d');
    
    if (reportCharts.overview) {
        reportCharts.overview.destroy();
    }
    
    reportCharts.overview = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Доходы', 'Расходы'],
            datasets: [{
                data: [income, expense],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: ['#27ae60', '#c0392b'],
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            }
        }
    });
}

// Создание диаграммы доходов по категориям
function createIncomeChart(incomeByCategory, symbol) {
    const ctx = document.getElementById('income-chart').getContext('2d');
    
    const categories = Object.keys(incomeByCategory);
    const amounts = Object.values(incomeByCategory);
    
    if (reportCharts.income) {
        reportCharts.income.destroy();
    }
    
    if (categories.length === 0) {
        // Нет данных
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных о доходах', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    // Создаём цвета для категорий
    const backgroundColors = categories.map((_, i) => {
        const hue = (i * 137) % 360; // Золотое сечение для разных цветов
        return `hsl(${hue}, 70%, 60%)`;
    });
    
    reportCharts.income = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#1a1a1a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = amounts.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Создание диаграммы расходов по категориям (аналогично доходам)
function createExpenseChart(expenseByCategory, symbol) {
    const ctx = document.getElementById('expense-chart').getContext('2d');
    
    const categories = Object.keys(expenseByCategory);
    const amounts = Object.values(expenseByCategory);
    
    if (reportCharts.expense) {
        reportCharts.expense.destroy();
    }
    
    if (categories.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных о расходах', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const backgroundColors = categories.map((_, i) => {
        const hue = 0 + (i * 50) % 60; // Оттенки красного
        return `hsl(${hue}, 70%, 60%)`;
    });
    
    reportCharts.expense = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#1a1a1a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = amounts.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Создание диаграммы соотношения
function createRatioChart(income, expense) {
    const ctx = document.getElementById('ratio-chart').getContext('2d');
    const total = income + expense;
    const incomePercentage = total > 0 ? (income / total * 100) : 0;
    const expensePercentage = total > 0 ? (expense / total * 100) : 0;
    
    if (reportCharts.ratio) {
        reportCharts.ratio.destroy();
    }
    
    reportCharts.ratio = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Доходы', 'Расходы'],
            datasets: [{
                data: [incomePercentage, expensePercentage],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: ['#27ae60', '#c0392b'],
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#888',
                        callback: (value) => `${value}%`
                    },
                    grid: {
                        color: '#2d2d2d'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

// Создание диаграммы накоплений
function createSavingsChart(savings, totalExpense, symbol) {
    const ctx = document.getElementById('savings-chart').getContext('2d');
    const percentage = totalExpense > 0 ? (savings / totalExpense * 100) : 0;
    const remaining = 100 - percentage;
    
    if (reportCharts.savings) {
        reportCharts.savings.destroy();
    }
    
    reportCharts.savings = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Накопления', 'Остаток'],
            datasets: [{
                data: [percentage, remaining],
                backgroundColor: ['#f39c12', '#2d2d2d'],
                borderColor: ['#e67e22', '#1a1a1a'],
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            if (context.label === 'Накопления') {
                                return `Накопления: ${formatCurrency(savings)} ${symbol} (${context.raw.toFixed(1)}%)`;
                            }
                            return `${context.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

// Создание диаграммы баланса
function createBalanceChart(monthlyData, symbol) {
    const ctx = document.getElementById('balance-chart').getContext('2d');
    
    // Подготавливаем данные (последние 6 месяцев)
    const last6Months = monthlyData.slice(0, 6).reverse();
    const labels = last6Months.map(m => {
        const [year, month] = m.month.split('-');
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });
    
    const balances = last6Months.map(m => m.balance);
    
    if (reportCharts.balance) {
        reportCharts.balance.destroy();
    }
    
    if (last6Months.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных о балансе', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    reportCharts.balance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Баланс',
                data: balances,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        color: '#888',
                        callback: (value) => `${formatCurrency(value)} ${symbol}`
                    },
                    grid: {
                        color: '#2d2d2d'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#2d2d2d'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `Баланс: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            }
        }
    });
    
    // Обновляем текущий баланс и изменение
    if (last6Months.length > 0) {
        const currentBalance = last6Months[last6Months.length - 1].balance;
        const previousBalance = last6Months.length > 1 ? last6Months[last6Months.length - 2].balance : 0;
        const change = currentBalance - previousBalance;
        
        document.getElementById('current-balance').textContent = `${formatCurrency(currentBalance)} ${symbol}`;
        document.getElementById('month-change').textContent = `${change >= 0 ? '+' : ''}${formatCurrency(change)} ${symbol}`;
        document.getElementById('month-change').className = `trend-value ${change >= 0 ? 'positive' : 'negative'}`;
    }
}

// Обновление детализации по категориям
function updateCategoryBreakdown(incomeByCategory, expenseByCategory) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Доходы
    const incomeContainer = document.getElementById('income-breakdown');
    let incomeHtml = '';
    
    const incomeCategories = Object.entries(incomeByCategory);
    const totalIncome = incomeCategories.reduce((sum, [_, amount]) => sum + amount, 0);
    
    incomeCategories.forEach(([category, amount]) => {
        const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(1) : '0.0';
        
        incomeHtml += `
            <div class="category-item-detailed">
                <div class="category-info">
                    <div class="category-icon-small">💰</div>
                    <div>
                        <div class="category-name-detailed">${category}</div>
                        <div class="category-percentage">${percentage}%</div>
                    </div>
                </div>
                <div class="category-amount-detailed income">
                    ${formatCurrency(amount)} ${symbol}
                </div>
            </div>
        `;
    });
    
    incomeContainer.innerHTML = incomeHtml || '<div style="text-align: center; color: #888; padding: 20px;">Нет данных</div>';
    
    // Расходы
    const expenseContainer = document.getElementById('expense-breakdown');
    let expenseHtml = '';
    
    const expenseCategories = Object.entries(expenseByCategory);
    const totalExpense = expenseCategories.reduce((sum, [_, amount]) => sum + amount, 0);
    
    expenseCategories.forEach(([category, amount]) => {
        const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0.0';
        
        expenseHtml += `
            <div class="category-item-detailed">
                <div class="category-info">
                    <div class="category-icon-small">📉</div>
                    <div>
                        <div class="category-name-detailed">${category}</div>
                        <div class="category-percentage">${percentage}%</div>
                    </div>
                </div>
                <div class="category-amount-detailed expense">
                    ${formatCurrency(amount)} ${symbol}
                </div>
            </div>
        `;
    });
    
    expenseContainer.innerHTML = expenseHtml || '<div style="text-align: center; color: #888; padding: 20px;">Нет данных</div>';
}

// Обновление соотношения доходов/расходов
function updateRatioChart(income, expense) {
    const total = income + expense;
    const incomePercentage = total > 0 ? (income / total * 100) : 0;
    const expensePercentage = total > 0 ? (expense / total * 100) : 0;
    
    // Анимируем заполнение полосок
    setTimeout(() => {
        document.getElementById('income-ratio-bar').style.width = `${incomePercentage}%`;
        document.getElementById('expense-ratio-bar').style.width = `${expensePercentage}%`;
        
        document.getElementById('income-ratio-value').textContent = `${incomePercentage.toFixed(1)}%`;
        document.getElementById('expense-ratio-value').textContent = `${expensePercentage.toFixed(1)}%`;
    }, 300);
}

// Обновление динамики баланса
function updateBalanceTrend(monthlyData) {
    // Уже обновлено в createBalanceChart
}

// Обновление диаграммы при переключении вкладок
function updateChartForTab(tabId) {
    // При необходимости перерисовываем диаграмму
    if (reportCharts[tabId]) {
        reportCharts[tabId].resize();
    }
}

// Настройка кнопки добавления транзакции
function setupAddTransactionButton() {
    const addBtn = document.getElementById('add-transaction-btn');
    
    addBtn.addEventListener('click', function() {
        // Показываем старую форму транзакции
        currentTransactionType = 'income';
        showTransactionForm();
    });
}

// Настройка обработчиков
function setupEventListeners() {
    // Удаляем старые обработчики истории если есть
    const oldHistoryBtn = document.getElementById('history-btn');
    const oldBackBtn = document.getElementById('back-btn');
    
    if (oldHistoryBtn) oldHistoryBtn.remove();
    if (oldBackBtn) oldBackBtn.remove();
    
    // Удаляем старые кнопки дохода/расхода если есть
    const oldIncomeBtn = document.getElementById('income-btn');
    const oldExpenseBtn = document.getElementById('expense-btn');
    const oldSavingsBtn = document.getElementById('savings-btn');
    
    if (oldIncomeBtn) oldIncomeBtn.remove();
    if (oldExpenseBtn) oldExpenseBtn.remove();
    if (oldSavingsBtn) oldSavingsBtn.remove();
    
    // Остальные обработчики...
    // [старый код оставляем]
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
