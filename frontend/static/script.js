// frontend/static/script.js
/* ==================== */
/* TELEGRAM FINANCE - iOS 26 STYLE */
/* ОБНОВЛЕНИЯ: */
/* 1. Сворачиваемые категории на панели */
/* 2. Исправлен выбор накоплений (копилка/цель) */
/* 3. Анимации разворачивания */
/* ==================== */

// Глобальные переменные
function getCurrentMonthPeriodValue() {
    const now = new Date();
    return `month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let currentUser = null;
let currentTransactionType = 'income';
let currentPage = 'panel';
let currentCurrency = 'RUB';
let categoriesData = { income: [], expense: [], savings: [] };
let walletsData = [];
let goalsData = [];
let debtsData = [];
let categoryStats = { income: {}, expense: {}, wallets: {} };
let currentHistoryMonth = new Date();
let currentFilter = 'all';
let incomeStatsPeriod = getCurrentMonthPeriodValue();
let expenseStatsPeriod = getCurrentMonthPeriodValue();
let reportChartPeriods = {
    overview: getCurrentMonthPeriodValue(),
    income: getCurrentMonthPeriodValue(),
    expense: getCurrentMonthPeriodValue(),
    panel: getCurrentMonthPeriodValue()
};
let reportChartRanges = {
    overview: { from: '', to: '' },
    income: { from: '', to: '' },
    expense: { from: '', to: '' },
    panel: { from: '', to: '' }
};
let reportChartMonthValues = {
    overview: [],
    income: [],
    expense: [],
    panel: []
};
let reportChartSwipeInitialized = false;
let reportPeriodModalTabId = null;
let reportRangeModalTabId = null;
let reportChartPeriodOptions = {
    overview: [],
    income: [],
    expense: [],
    panel: []
};
let sessionToken = null;
let defaultWallet = 'Карта';
let charts = {};
let allTransactions = [];
let panelTransactions = [];
let panelScopedStats = { income: {}, expense: {} };
let panelScopedSummary = { income: 0, expense: 0, savings: 0, balance: 0 };
let panelInitSummary = null;
let currentSavingsDestination = 'piggybank';
let selectedGoalId = null;
let editingTransactionId = null;
let currentMonthTransactions = [];
let isCreatingGoal = false;
let editingGoalId = null;
let debtsEnabled = false;
let currentDebtId = null;
let editingDebtId = null;
let compoundListenersInitialized = false;
const compoundStorageKey = 'finance_compound_calc';
let marketState = { crypto: 'gainers', stocks: 'gainers' };
let marketCache = { crypto: {}, stocks: {} };
let marketRangeInitialized = false;
let marketChartState = { market: '', id: '', range: '1m' };
let sharedWalletState = { status: 'none', code: '', link: '' };
let pendingInviteCode = null;
let subscriptionActive = false;
let subscriptionStart = null;
let subscriptionEnd = null;
const subscriptionProvider = 'cryptopay';
const subscriptionPrices = { 1: 2, 3: 5.6, 6: 10.5, 12: 21.5 };
let subscriptionDuration = 1;
let subscriptionPayment = {
    invoiceId: null,
    status: '',
    asset: 'USDT',
    amount: '',
    currency: '',
    invoiceUrl: '',
    miniAppUrl: '',
    webAppUrl: '',
    botUrl: '',
    months: 1
};
let subscriptionPoller = null;
let subscriptionAsset = 'USDT';
const marketCacheKey = (market, kind) => `market_cache_${market}_${kind}`;
const marketChartCacheKey = (market, id, range) => `market_chart_${market}_${id}_${range}`;
const PANEL_RECENT_LIMIT = 3;
let baseViewportHeight = window.innerHeight;
let keyboardOpen = false;
let viewportRaf = null;
let lastViewportHeight = null;
let lastViewportOffsetTop = null;
let lastKeyboardHeight = null;
let bodyScrollLocked = false;
let bodyScrollTop = 0;
let modalTouchStartY = 0;
let focusScrollTimer = null;
let categorySwipeInitialized = false;
let activeCategorySwipeItem = null;
let categorySwipeState = null;
let categorySwipeSuppressClickUntil = 0;
const CATEGORY_SWIPE_MAX = 72;
const CATEGORY_SWIPE_THRESHOLD = 28;

function getActiveModalContent() {
    return document.querySelector('.modal-overlay.active .modal-content');
}

function lockBodyScroll() {
    if (bodyScrollLocked) return;
    bodyScrollTop = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${bodyScrollTop}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    bodyScrollLocked = true;
}

function unlockBodyScroll() {
    if (!bodyScrollLocked) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, bodyScrollTop);
    bodyScrollLocked = false;
}

function ensureFocusedFieldVisible(target = document.activeElement, smooth = true) {
    const modalContent = getActiveModalContent();
    if (!modalContent || !target || !(target instanceof HTMLElement) || !modalContent.contains(target)) {
        return;
    }
    const fieldRect = target.getBoundingClientRect();
    const modalRect = modalContent.getBoundingClientRect();
    const topPadding = 18;
    const bottomPadding = keyboardOpen ? 26 : 18;
    let delta = 0;

    if (fieldRect.bottom > modalRect.bottom - bottomPadding) {
        delta = fieldRect.bottom - (modalRect.bottom - bottomPadding);
    } else if (fieldRect.top < modalRect.top + topPadding) {
        delta = fieldRect.top - (modalRect.top + topPadding);
    }

    if (Math.abs(delta) < 2) return;
    modalContent.scrollBy({
        top: delta,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

function queueEnsureFocusedFieldVisible(delay = 90, smooth = true) {
    if (focusScrollTimer) {
        clearTimeout(focusScrollTimer);
    }
    const target = document.activeElement;
    focusScrollTimer = setTimeout(() => {
        focusScrollTimer = null;
        ensureFocusedFieldVisible(target, smooth);
    }, delay);
}

function updateViewportVars() {
    if (viewportRaf) cancelAnimationFrame(viewportRaf);
    viewportRaf = requestAnimationFrame(() => {
        viewportRaf = null;
        const vv = window.visualViewport;
        const rawHeight = vv ? vv.height : window.innerHeight;
        const rawOffsetTop = vv ? vv.offsetTop : 0;
        const height = Math.max(0, Math.round(rawHeight));
        if (height > baseViewportHeight) {
            baseViewportHeight = height;
        }
        document.documentElement.style.setProperty('--app-base-height', `${baseViewportHeight}px`);
        let keyboardHeight = Math.max(0, baseViewportHeight - height);
        if (keyboardHeight < 20) {
            baseViewportHeight = height;
            keyboardHeight = 0;
        }
        keyboardHeight = Math.round(keyboardHeight);
        const offsetTop = keyboardHeight > 0 ? 0 : Math.round(rawOffsetTop);

        const openThreshold = 90;
        const closeThreshold = 40;
        if (!keyboardOpen && keyboardHeight > openThreshold) {
            keyboardOpen = true;
        } else if (keyboardOpen && keyboardHeight < closeThreshold) {
            keyboardOpen = false;
        }

        if (lastViewportHeight !== height) {
            document.documentElement.style.setProperty('--app-height', `${height}px`);
            lastViewportHeight = height;
        }
        if (lastViewportOffsetTop !== offsetTop) {
            document.documentElement.style.setProperty('--app-offset-top', `${offsetTop}px`);
            lastViewportOffsetTop = offsetTop;
        }
        if (lastKeyboardHeight !== keyboardHeight) {
            document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
            lastKeyboardHeight = keyboardHeight;
        }
        document.body.classList.toggle('keyboard-open', keyboardOpen);

        if (keyboardOpen && document.body.classList.contains('modal-open')) {
            queueEnsureFocusedFieldVisible(60, true);
        }
    });
}

function initViewportVars() {
    updateViewportVars();
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateViewportVars);
        window.visualViewport.addEventListener('scroll', updateViewportVars);
    }
    window.addEventListener('resize', updateViewportVars);
}

function updateBodyModalState() {
    const hasActiveModal = !!document.querySelector('.modal-overlay.active');
    document.body.classList.toggle('modal-open', hasActiveModal);
    if (hasActiveModal) {
        lockBodyScroll();
    } else {
        unlockBodyScroll();
    }
}

function isSavingsCategoryName(name) {
    return name === 'Накопления' || name === 'Цели';
}

function getSavingsWallet() {
    return (walletsData || []).find(wallet => wallet && wallet.name === 'Накопления') || null;
}

function getSavingsAmount() {
    if (currentPage === 'panel' && panelTransactions.length > 0) {
        return Number(panelScopedSummary?.savings) || 0;
    }
    const savingsWallet = getSavingsWallet();
    if (savingsWallet) {
        const walletBalance = Number(savingsWallet.balance);
        if (Number.isFinite(walletBalance)) {
            return Math.max(0, walletBalance);
        }
    }
    return (categoryStats.expense?.['Накопления'] || 0) + (categoryStats.expense?.['Цели'] || 0);
}

function getPanelSavingsCategorySet() {
    const names = new Set(['Накопления', 'Цели']);
    (categoriesData.savings || []).forEach((category) => {
        if (category && category.name) {
            names.add(category.name);
        }
    });
    return names;
}

function buildCategoryStatsFromTransactions(transactions) {
    const stats = { income: {}, expense: {} };
    if (!Array.isArray(transactions)) return stats;

    transactions.forEach((transaction) => {
        if (!transaction) return;
        const type = transaction.type === 'income' ? 'income' : 'expense';
        const name = transaction.category || '';
        const amount = Number(transaction.amount) || 0;
        if (!name || !Number.isFinite(amount)) return;
        stats[type][name] = (stats[type][name] || 0) + amount;
    });

    return stats;
}

function recalculatePanelScopedData() {
    const filteredTransactions = filterTransactionsByPeriod(
        panelTransactions || [],
        reportChartPeriods.panel,
        reportChartRanges.panel
    );
    panelScopedStats = buildCategoryStatsFromTransactions(filteredTransactions);

    const totalIncome = Object.values(panelScopedStats.income || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalExpense = Object.values(panelScopedStats.expense || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const savingsCategories = getPanelSavingsCategorySet();
    const totalSavings = Object.entries(panelScopedStats.expense || {}).reduce((sum, [name, value]) => {
        if (!savingsCategories.has(name)) return sum;
        return sum + (Number(value) || 0);
    }, 0);

    panelScopedSummary = {
        income: totalIncome,
        expense: totalExpense,
        savings: totalSavings,
        balance: totalIncome - totalExpense
    };

    return filteredTransactions;
}

function getDisplayCategoryStats(type) {
    if (currentPage === 'panel' && panelTransactions.length > 0) {
        return panelScopedStats[type] || {};
    }
    return categoryStats[type] || {};
}

const translations = {
    en: {
        'Финансы': 'Finance',
        'Загрузка...': 'Loading...',
        'Остаток': 'Balance',
        'Общий баланс': 'Total balance',
        'Доходы': 'Income',
        'Расходы': 'Expenses',
        'Накопления': 'Savings',
        'Цели': 'Goals',
        'Скрыть': 'Hide',
        'Мои цели': 'Goals',
        'Кошельки': 'Wallets',
        'Последние операции': 'Recent transactions',
        'Все': 'All',
        'История': 'History',
        'Отчёт': 'Report',
        'Инвестиции': 'Investments',
        'Сервисы': 'Services',
        'Панель': 'Dashboard',
        'Обзор': 'Overview',
        'Баланс': 'Balance',
        'Подписка': 'Subscription',
        'Подписка активна': 'Subscription active',
        'Подписка активна.': 'Subscription active.',
        'Не активна': 'Inactive',
        'Настройки': 'Settings',
        'Основной кошелёк': 'Primary wallet',
        'Используется по умолчанию': 'Default wallet',
        'Валюта': 'Currency',
        'Калькулятор': 'Calculator',
        'Статьи': 'Articles',
        'Добавить на экран': 'Add to Home',
        'Сбросить всё': 'Reset all',
        'Сбросить все данные?': 'Reset all data?',
        'Будут удалены все операции, категории, кошельки, цели и долги. Это действие нельзя отменить.': 'All transactions, categories, wallets, goals, and debts will be deleted. This action cannot be undone.',
        'Все данные сброшены': 'All data has been reset',
        'Ошибка сброса данных': 'Failed to reset data',
        'Общий кошелёк': 'Shared wallet',
        'Полный доступ': 'Full access',
        'Оплата через Crypto Bot': 'Payment via Crypto Bot',
        'USDT • сеть TON': 'USDT • TON network',
        'Создайте оплату': 'Create payment',
        'Промокод': 'Promo code',
        'Активировать промокод': 'Redeem promo',
        'Адрес': 'Address',
        'Сумма': 'Amount',
        'Дата и время': 'Date and time',
        'Создать оплату': 'Create payment',
        'Скопировать адрес': 'Copy address',
        'Скопировать сумму': 'Copy amount',
        'Открыть оплату': 'Open invoice',
        'Проверить оплату': 'Check payment',
        'Админ доступ': 'Admin access',
        'Ваш username:': 'Your username:',
        'Ожидает оплаты': 'Awaiting payment',
        'Оплата завершена': 'Payment completed',
        'Счёт истёк': 'Invoice expired',
        'Платёж отменён': 'Payment canceled',
        'Недостаточно средств на выбранном кошельке': 'Insufficient funds in selected wallet',
        'Подписка уже активна': 'Subscription already active',
        'Введите промокод': 'Enter promo code',
        'С': 'From',
        'по': 'to',
        'User ID или @username': 'User ID or @username',
        '1 месяц — $2': '1 month — $2',
        '3 месяца — $5.6': '3 months — $5.6',
        '6 месяцев — $10.5': '6 months — $10.5',
        '12 месяцев — $21.5': '12 months — $21.5',
        'Admin key': 'Admin key',
        'Выдать подписку': 'Grant subscription',
        'Использовать мой username': 'Use my username',
        'Язык': 'Language',
        'Русский': 'Russian',
        'Добавить операцию': 'Add transaction',
        'Добавить доход': 'Add income',
        'Добавить расход': 'Add expense',
        'Добавить накопление': 'Add savings',
        'Все операции': 'All transactions',
        'Сложные проценты': 'Compound interest',
        'Стартовый капитал': 'Initial capital',
        'Ежемесячное пополнение': 'Monthly contribution',
        'Годовая ставка, %': 'Annual rate, %',
        'Начисление процентов': 'Compounding',
        'Ежемесячно': 'Monthly',
        'Ежеквартально': 'Quarterly',
        'Ежегодно': 'Yearly',
        'Срок, лет': 'Years',
        'Рассчитать': 'Calculate',
        'Результат': 'Result',
        'Итоговая сумма': 'Total amount',
        'Взносы всего': 'Contributions',
        'Проценты': 'Interest',
        'Расчет учитывает выбранную частоту начисления и ежемесячное пополнение.': 'Calculation accounts for the selected compounding and monthly contributions.',
        'Рост капитала': 'Capital growth',
        'Четыре принципа финансовой грамотности': 'Four principles of financial literacy',
        'Бюджет и привычки': 'Budget and habits',
        'Добавить на экран': 'Add to Home',
        'Добавление работает через браузер. Внутри Telegram меню недоступно.': 'Add works via browser. Telegram menu is unavailable.',
        'Откройте в Safari → «Поделиться» → «На экран Домой».': 'Open in Safari → Share → Add to Home Screen.',
        'Откройте меню браузера → «Установить приложение».': 'Open browser menu → Install app.',
        'Открыть в браузере': 'Open in browser',
        'Общий кошелёк': 'Shared wallet',
        'Загрузка...': 'Loading...',
        'Создайте общий кошелёк или подключитесь по коду.': 'Create a shared wallet or join with a code.',
        'Создать общий кошелёк': 'Create shared wallet',
        'Вы будете владельцем и сможете пригласить друга.': 'You will be the owner and can invite a friend.',
        'Подключиться по коду': 'Join with code',
        'Введите код приглашения от владельца.': 'Enter the invite code from the owner.',
        'Код приглашения': 'Invite code',
        'Подключиться': 'Join',
        'Приглашение': 'Invite',
        'Код:': 'Code:',
        'Скопировать код': 'Copy code',
        'Скопировать ссылку': 'Copy link',
        'Отключиться': 'Disconnect',
        'Статус: не подключен': 'Status: not connected',
        'Статус: владелец': 'Status: owner',
        'Статус: участник': 'Status: member',
        'Не удалось загрузить статус.': 'Failed to load status.',
        'Кошелёк создан': 'Wallet created',
        'Не удалось создать общий кошелёк': 'Failed to create shared wallet',
        'Создать общий кошелёк': 'Create shared wallet',
        'Подключиться по коду': 'Join with code',
        'Создать': 'Create',
        'Подключиться': 'Join',
        'Код приглашения': 'Invite code',
        'Добавить': 'Add',
        'Отмена': 'Cancel',
        'Ошибка загрузки': 'Load error',
        'Ошибка сохранения': 'Save error',
        'Пожалуйста, обновите страницу': 'Please refresh the page',
        'Обновить': 'Reload',
        'Добавить цель': 'Add goal',
        'Название цели': 'Goal name',
        'Сумма цели': 'Target amount',
        'Срок (необязательно)': 'Deadline (optional)',
        'Добавить кошелёк': 'Add wallet',
        'Название кошелька': 'Wallet name',
        'Добавить категорию': 'Add category',
        'Название категории': 'Category name',
        'Категория': 'Category',
        'Кошелёк': 'Wallet',
        'Примечание (необязательно)': 'Note (optional)',
        'Например: Зарплата за февраль': 'Example: Salary for February',
        'Например: Кафе': 'Example: Cafe',
        'Например: Копилка': 'Example: Piggy bank',
        'Иконка': 'Icon',
        'Цвет': 'Color',
        'Сохранить': 'Save',
        'Новая цель': 'New goal',
        'Название цели': 'Goal name',
        'Например: Новый телефон': 'Example: New phone',
        'Целевая сумма': 'Target amount',
        'Срок': 'Duration',
        'Бессрочная': 'No deadline',
        '1 месяц': '1 month',
        '3 месяца': '3 months',
        '6 месяцев': '6 months',
        '12 месяцев': '12 months',
        '1 год': '1 year',
        'Указать дату': 'Pick a date',
        'Дата окончания': 'End date',
        'Цвет прогресс-бара': 'Progress bar color',
        'Создать цель': 'Create goal',
        'Изменить цель': 'Edit goal',
        'Цель обновлена': 'Goal updated',
        'Цель архивирована': 'Goal archived',
        'Цель возвращена': 'Goal restored',
        'Цель в архиве': 'Goal is archived',
        'Описание': 'Description',
        'Удалить цель': 'Delete goal',
        'Удалить цель?': 'Delete goal?',
        'Цель удалена': 'Goal deleted',
        'Средства переведены в копилку': 'Funds moved to piggy bank',
        'Выберите месяц': 'Select month',
        'Например: Тинькофф': 'Example: Tinkoff',
        'Сделать кошельком по умолчанию': 'Set as default wallet',
        'Доход': 'Income',
        'Расход': 'Expense',
        'Накопление': 'Savings',
        'Месяц': 'Month',
        'Неделя': 'Week',
        'День': 'Day',
        'Все': 'All',
        'Финансовый обзор': 'Financial overview',
        'Всего накоплено': 'Total saved',
        'Текущий остаток': 'Current balance',
        'Доходы по категориям': 'Income by category',
        'Статистика доходов': 'Income stats',
        'Статистика расходов': 'Expense stats',
        'Период': 'Period',
        'За год': 'Year',
        'За всё время': 'All time',
        'Свой интервал': 'Custom range',
        'Свой': 'Custom',
        'Данные загружаются...': 'Loading data...',
        'Расходы по категориям': 'Expenses by category',
        'Топ расходов': 'Top expenses',
        'Распределение средств': 'Funds distribution',
        'Динамика баланса': 'Balance dynamics',
        'Топ дня': 'Top of the day',
        'Посмотреть все': 'View all',
        'Криптовалюты': 'Cryptocurrencies',
        'Акции': 'Stocks',
        'Топ роста': 'Top gainers',
        'Топ падения': 'Top losers',
        'Поддержка': 'Support',
        'Закрыть': 'Close',
        'Все категории': 'All categories',
        'Нет данных для отображения': 'No data to display',
        'Нет доходов за период': 'No income for this period',
        'Нет расходов за период': 'No expenses for this period',
        'Нет накоплений за период': 'No savings for this period',
        'Нет данных о распределении': 'No distribution data',
        'Нет данных за выбранный период': 'No data for the selected period',
        'Нет доходов за выбранный период': 'No income for the selected period',
        'Нет расходов за выбранный период': 'No expenses for the selected period',
        'Всего расходов': 'Total expenses',
        'Средний расход': 'Average expense',
        'Топ категорий': 'Top categories',
        'Всего': 'Total',
        'Средний доход': 'Average income',
        'Топ категория': 'Top category',
        'Прогресс': 'Progress',
        'Добавить первую цель': 'Add your first goal',
        'Нажмите чтобы начать': 'Tap to start',
        'Новая категория': 'New category',
        'по умолчанию': 'default',
        'Куда накопления?': 'Where to save?',
        'В копилку': 'To piggy bank',
        'На цель': 'To goal',
        'Выберите цель': 'Choose a goal',
        'Введите корректную сумму': 'Enter a valid amount',
        'Накопления добавлены в цель': 'Savings added to goal',
        'Ошибка добавления в цель': 'Failed to add to goal',
        'Операция обновлена': 'Transaction updated',
        '✅ Доход добавлен': 'Income added',
        '✅ Расход добавлен': 'Expense added',
        '✅ Накопление добавлено': 'Savings added',
        'Операция добавлена': 'Transaction added',
        'Ошибка': 'Error',
        'Добавить категорию дохода': 'Add income category',
        'Добавить категорию расхода': 'Add expense category',
        'Добавить категорию накопления': 'Add savings category',
        'Введите название категории': 'Enter category name',
        'Категория добавлена': 'Category added',
        'Ошибка добавления категории': 'Failed to add category',
        'Категория удалена': 'Category deleted',
        'Ошибка удаления категории': 'Failed to delete category',
        'Будут удалены все операции этой категории': 'All transactions in this category will be deleted',
        'Добавить первую категорию': 'Add your first category',
        'Введите название цели': 'Enter goal name',
        'Сначала создайте цель': 'Create a goal first',
        'Сессия устарела, перезайдите': 'Session expired, please re-open',
        'Цель создана': 'Goal created',
        'Ошибка создания цели': 'Failed to create goal',
        'Валюта изменена на': 'Currency changed to',
        'Ошибка изменения валюты': 'Failed to change currency',
        'Кошелёк выбран по умолчанию': 'Default wallet set',
        'Ошибка установки кошелька': 'Failed to set wallet',
        'Изменить операцию': 'Edit transaction',
        'Введите название кошелька': 'Enter wallet name',
        'Кошелёк добавлен': 'Wallet added',
        'Ошибка добавления кошелька': 'Failed to add wallet',
        'Нет операций': 'No transactions',
        'Экспорт данных...': 'Exporting data...',
        'Данные экспортированы': 'Data exported',
        'Скоро будет полный список': 'Full list coming soon',
        'На iOS добавление доступно только через Safari. Внутри Telegram меню недоступно.': 'On iOS, adding is available only in Safari. Telegram menu is unavailable.',
        'Добавление доступно через браузер. Внутри Telegram меню недоступно.': 'Add is available via browser. Telegram menu is unavailable.',
        'Адрес скопирован': 'Address copied',
        'Сумма скопирована': 'Amount copied',
        'Подписка активирована': 'Subscription activated',
        'Не удалось проверить оплату': 'Failed to check payment',
        'Недостаточно прав': 'Insufficient permissions',
        'Введите ID/username и ключ': 'Enter ID/username and key',
        'Промокод активирован на': 'Promo activated for',
        'мес.': 'mo.',
        'дн.': 'd.',
        'Не удалось активировать промокод': 'Failed to redeem promo',
        'Не удалось создать оплату': 'Failed to create payment',
        'Ошибка выдачи': 'Grant failed',
        'Пользователь': 'User',
        'Вы уже подключены': 'You are already connected',
        'Неверный код': 'Invalid code',
        'Кошелёк уже заполнен': 'Wallet is full',
        'Это ваш код': 'This is your code',
        'Не удалось подключиться': 'Failed to connect',
        'Вы подключились': 'Connected',
        'Отключено': 'Disconnected',
        'Не удалось отключиться': 'Failed to disconnect',
        'Код скопирован': 'Code copied',
        'Ссылка скопирована': 'Link copied',
        'Изменение': 'Change',
        'Цена': 'Price',
        'получил подписку на': 'received subscription for',
        'Ошибка загрузки данных': 'Failed to load data',
        'Операция не найдена': 'Transaction not found',
        'Операция удалена': 'Transaction deleted',
        'Ошибка удаления': 'Delete error',
        'Показываем операции кошелька': 'Showing wallet transactions',
        'Введите код': 'Enter code',
        'Без описания': 'No description',
        'Изменить': 'Edit',
        'Удалить': 'Delete',
        'Удалить операцию?': 'Delete transaction?',
        'Нет данных': 'No data',
        'Карта': 'Card',
        'Наличные': 'Cash',
        'Долги': 'Debts',
        'Долг': 'Debt',
        'Добавить долг': 'Add debt',
        'Долг добавлен': 'Debt added',
        'Погашено': 'Paid',
        'Создать долг': 'Create debt',
        'Название долга': 'Debt name',
        'Сумма долга': 'Debt amount',
        'Комментарий (необязательно)': 'Comment (optional)',
        'Долг создан': 'Debt created',
        'Долг обновлён': 'Debt updated',
        'Долг удалён': 'Debt deleted',
        'Сначала создайте долг': 'Create a debt first',
        'Например: Рассрочка': 'Example: Installment',
        'Например: Кредит': 'Example: Loan',
        'Выберите долг': 'Select debt',
        'Введите название долга': 'Enter debt name',
        'Удалить долг': 'Delete debt',
        'Изменить долг': 'Edit debt',
        'Архив': 'Archive',
        'Архивировать': 'Archive',
        'Вернуть': 'Restore',
        'Нельзя удалить долг с платежами': 'Cannot delete a debt with payments',
        'Зарплата': 'Salary',
        'Фриланс': 'Freelance',
        'Инвестиции': 'Investments',
        'Продукты': 'Groceries',
        'Транспорт': 'Transport',
        'Развлечения': 'Entertainment',
        'ЖКХ': 'Utilities',
        'Связь': 'Mobile',
        'Еда вне дома': 'Dining out',
        'Накопления': 'Savings',
        'Промокоды': 'Promo codes',
        'Показать статистику': 'Show stats',
        'Использовано': 'Used',
        'Многоразовый': 'Reusable',
        'Одноразовый': 'Single-use',
        'Введите admin key': 'Enter admin key',
        'За этот период данных нет': 'No data for this period',
        'Добавляйте операции в разделе «Панель»': 'Add transactions in the Dashboard section',
        'Цель': 'Goal'
    }
};

let currentLang = 'ru';

function t(key) {
    if (currentLang === 'en') {
        return translations.en[key] || key;
    }
    return key;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', t(key));
    });
    const titleText = t('Финансы');
    document.title = titleText;
    const appTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appTitleMeta) appTitleMeta.setAttribute('content', titleText);
    document.documentElement.lang = currentLang;
}

function getLocale() {
    return currentLang === 'en' ? 'en-US' : 'ru-RU';
}

function detectLanguage() {
    const manual = localStorage.getItem('finance_lang_manual') === '1';
    const stored = localStorage.getItem('finance_lang');
    if (manual && (stored === 'ru' || stored === 'en')) return stored;
    if (!manual && stored) {
        try { localStorage.removeItem('finance_lang'); } catch {}
    }
    const telegramLang = (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || '').toLowerCase();
    if (telegramLang) {
        return telegramLang.startsWith('en') ? 'en' : 'ru';
    }
    const deviceLang = (navigator.language || '').toLowerCase();
    return deviceLang.startsWith('en') ? 'en' : 'ru';
}

function setLanguage(lang) {
    currentLang = lang === 'en' ? 'en' : 'ru';
    try {
        localStorage.setItem('finance_lang', currentLang);
        localStorage.setItem('finance_lang_manual', '1');
    } catch {}
    const selector = document.getElementById('language-select');
    if (selector) selector.value = currentLang;
    applyTranslations();
    updateSubscriptionUI();
    updateMonthDisplay();
    if (currentPage === 'panel') {
        renderPanelPeriodControls();
        applyPanelPeriodFilter();
    }
}

function initLanguage() {
    currentLang = detectLanguage();
    const selector = document.getElementById('language-select');
    if (selector) selector.value = currentLang;
    applyTranslations();
}

function readMarketCache(market, kind) {
    try {
        const raw = localStorage.getItem(marketCacheKey(market, kind));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.items)) return null;
        return parsed.items;
    } catch {
        return null;
    }
}

function writeMarketCache(market, kind, items) {
    try {
        localStorage.setItem(marketCacheKey(market, kind), JSON.stringify({
            ts: Date.now(),
            items: items || []
        }));
    } catch {}
}

function readMarketChartCache(market, id, range) {
    try {
        const raw = localStorage.getItem(marketChartCacheKey(market, id, range));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.points)) return null;
        return parsed.points;
    } catch {
        return null;
    }
}

function writeMarketChartCache(market, id, range, points) {
    try {
        localStorage.setItem(marketChartCacheKey(market, id, range), JSON.stringify({
            ts: Date.now(),
            points: points || []
        }));
    } catch {}
}

// Константы
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = {
    ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};

function getMonthName(index) {
    const list = monthNames[currentLang] || monthNames.ru;
    return list[index] || '';
}

function parseTransactionDate(value) {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const cleaned = value.trim();
        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(cleaned)) {
            return new Date(cleaned.replace(' ', 'T'));
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
            return new Date(`${cleaned}T00:00:00`);
        }
    }
    return new Date(value);
}

function getMonthLabelFromValue(value) {
    if (!value || !value.startsWith('month:')) return '';
    const monthKey = value.slice(6);
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;
    const year = parts[0];
    const monthIndex = Number(parts[1]) - 1;
    if (!Number.isFinite(monthIndex)) return monthKey;
    return `${getMonthName(monthIndex)} ${year}`;
}
const colorPalette = [
  '#2ED9FF', '#22D3A6', '#F5D547', '#FF9F1C',
  '#FF6B6B', '#FF4D9E', '#8A5CFF', '#5B8CFF',
  '#00B0FF', '#00C2A8', '#7BDFF2', '#A3F7BF',
  '#FFD166', '#FFA69E', '#C77DFF', '#4D96FF'
];
const colorPaletteGlow = [
  'rgba(46, 217, 255, 0.5)', 'rgba(34, 211, 166, 0.5)', 'rgba(245, 213, 71, 0.5)', 'rgba(255, 159, 28, 0.5)',
  'rgba(255, 107, 107, 0.5)', 'rgba(255, 77, 158, 0.5)', 'rgba(138, 92, 255, 0.5)', 'rgba(91, 140, 255, 0.5)',
  'rgba(0, 176, 255, 0.5)', 'rgba(0, 194, 168, 0.5)', 'rgba(123, 223, 242, 0.5)', 'rgba(163, 247, 191, 0.5)',
  'rgba(255, 209, 102, 0.5)', 'rgba(255, 166, 158, 0.5)', 'rgba(199, 125, 255, 0.5)', 'rgba(77, 150, 255, 0.5)'
];

const articlesLibrary = {
    budget_principles: {
        title: {
            ru: 'Управление бюджетом: 4 принципа финансовой грамотности',
            en: 'Budget Management: 4 Principles of Financial Literacy'
        },
        body: {
            ru: `
                <p>Эффективное распределение личных финансов строится на простых, но проверенных правилах. Вот ключевые законы, которые работают:</p>
                <h2>1. Правило 50/30/20</h2>
                <ul>
                    <li><strong>50%</strong> — обязательные расходы (аренда, коммуналка, продукты)</li>
                    <li><strong>30%</strong> — желания (развлечения, хобби, подписки)</li>
                    <li><strong>20%</strong> — сбережения и инвестиции</li>
                </ul>
                <p>Эта базовая структура сохраняет баланс между текущими нуждами и будущими целями.</p>
                <h2>2. Сначала заплати себе</h2>
                <p>Откладывайте 10–20% дохода <strong>сразу после получения</strong>, а не по остаточному принципу. Это формирует финансовую подушку и инвестиционный капитал.</p>
                <h2>3. Разделение счетов</h2>
                <p>Используйте три отдельных счета:</p>
                <ul>
                    <li><strong>Расчетный</strong> — для ежедневных операций</li>
                    <li><strong>Накопительный</strong> — неприкосновенный запас (6 месячных доходов)</li>
                    <li><strong>Инвестиционный</strong> — для долгосрочных целей</li>
                </ul>
                <h2>4. Правило 24 часов</h2>
                <p>Перед крупной покупкой выдержите паузу. Часто импульсивное желание проходит, сохраняя деньги для действительно важного.</p>
                <p>Финансовая грамотность — не в ограничении каждой копейки, а в осознанном распределении ресурсов. Начните с отслеживания расходов в течение месяца, затем примените эти принципы, адаптировав проценты под свои реалии. Система важнее сумм: даже небольшие, но регулярные отложения создают устойчивость.</p>
            `,
            en: `
                <p>Effective personal finance management follows simple, proven rules. Here are the key principles that work:</p>
                <h2>1. The 50/30/20 rule</h2>
                <ul>
                    <li><strong>50%</strong> — necessities (rent, utilities, groceries)</li>
                    <li><strong>30%</strong> — wants (entertainment, hobbies, subscriptions)</li>
                    <li><strong>20%</strong> — savings and investments</li>
                </ul>
                <p>This basic structure keeps balance between current needs and future goals.</p>
                <h2>2. Pay yourself first</h2>
                <p>Set aside 10–20% of income <strong>right after you receive it</strong>, not from what is left. This builds a financial cushion and investment capital.</p>
                <h2>3. Separate accounts</h2>
                <p>Use three separate accounts:</p>
                <ul>
                    <li><strong>Spending</strong> — for daily operations</li>
                    <li><strong>Savings</strong> — an emergency fund (6 months of income)</li>
                    <li><strong>Investment</strong> — for long-term goals</li>
                </ul>
                <h2>4. The 24-hour rule</h2>
                <p>Pause before a large purchase. Often the impulse fades, saving money for what truly matters.</p>
                <p>Financial literacy is not about counting every penny, but about conscious allocation of resources. Start by tracking expenses for a month, then apply these principles and adjust the percentages to your reality. Systems beat sums: even small, regular contributions create stability.</p>
            `
        }
    }
};

const chartShadowPlugin = {
    id: 'chartShadow',
    beforeDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        const ctx = chart.ctx;
        ctx.save();
        chart.$shadowActive = true;
        ctx.shadowColor = pluginOptions?.shadowColor || 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = pluginOptions?.shadowBlur ?? 22;
        ctx.shadowOffsetY = pluginOptions?.shadowOffsetY ?? 8;
    },
    afterDatasetDraw(chart) {
        if (!chart.$shadowActive) return;
        chart.$shadowActive = false;
        const ctx = chart.ctx;
        ctx.restore();
    }
};

function normalizeColor(color) {
    if (!color || typeof color !== 'string') return '#ffffff';
    return color;
}

function mixWithWhite(color, weight = 0.2) {
    const c = normalizeColor(color).trim();
    if (c.startsWith('#')) {
        const hex = c.length === 4
            ? c.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3')
            : c;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const nr = Math.round(r + (255 - r) * weight);
        const ng = Math.round(g + (255 - g) * weight);
        const nb = Math.round(b + (255 - b) * weight);
        return `rgb(${nr}, ${ng}, ${nb})`;
    }
    if (c.startsWith('rgb')) {
        return c;
    }
    return c;
}

function colorWithAlpha(color, alpha = 1) {
    const c = normalizeColor(color).trim();
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map(ch => ch + ch).join('');
        }
        if (hex.length < 6) return c;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(v => Number.isNaN(v))) return c;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const rgbMatch = c.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map(part => part.trim());
        if (parts.length >= 3) {
            const r = parseFloat(parts[0]);
            const g = parseFloat(parts[1]);
            const b = parseFloat(parts[2]);
            if ([r, g, b].every(v => Number.isFinite(v))) {
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
        }
    }
    return c;
}

function pickDistinctColor(baseColor, index, usedColors) {
    let color = baseColor || colorPalette[index % colorPalette.length];
    if (usedColors && usedColors.has(color)) {
        const fallback = colorPalette.find(c => !usedColors.has(c));
        color = fallback || colorPalette[(index + 1) % colorPalette.length];
    }
    if (usedColors) usedColors.add(color);
    return color;
}

function buildDisplayValuesWithMinimumPercent(values, minPercent = 10) {
    const rawValues = (values || []).map((value) => {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? num : 0;
    });
    const total = rawValues.reduce((sum, value) => sum + value, 0);
    if (!total || minPercent <= 0) {
        return { rawValues, displayValues: rawValues.slice() };
    }

    const positiveIndexes = rawValues
        .map((value, index) => ({ value, index }))
        .filter(item => item.value > 0)
        .map(item => item.index);

    if (positiveIndexes.length <= 1) {
        return { rawValues, displayValues: rawValues.slice() };
    }

    const targetMinValue = total * (minPercent / 100);

    const canFitMinValue = (minValue) => {
        let deficit = 0;
        let headroom = 0;
        positiveIndexes.forEach((index) => {
            const value = rawValues[index];
            if (value < minValue) {
                deficit += (minValue - value);
            } else {
                headroom += (value - minValue);
            }
        });
        return deficit <= headroom + 1e-9;
    };

    let low = 0;
    let high = targetMinValue;
    for (let i = 0; i < 28; i += 1) {
        const mid = (low + high) / 2;
        if (canFitMinValue(mid)) {
            low = mid;
        } else {
            high = mid;
        }
    }

    const minValue = Math.min(targetMinValue, low);
    if (minValue <= 0) {
        return { rawValues, displayValues: rawValues.slice() };
    }

    const displayValues = rawValues.slice();
    let deficit = 0;
    let totalHeadroom = 0;
    const donors = [];

    positiveIndexes.forEach((index) => {
        const value = rawValues[index];
        if (value < minValue) {
            displayValues[index] = minValue;
            deficit += (minValue - value);
            return;
        }
        if (value > minValue) {
            const headroom = value - minValue;
            donors.push({ index, headroom });
            totalHeadroom += headroom;
        }
    });

    if (deficit > 0 && totalHeadroom > 0) {
        donors.forEach((donor) => {
            const reduceBy = deficit * (donor.headroom / totalHeadroom);
            displayValues[donor.index] = rawValues[donor.index] - reduceBy;
        });
    }

    const displayTotal = displayValues.reduce((sum, value) => sum + value, 0);
    const drift = total - displayTotal;
    if (Math.abs(drift) > 1e-6) {
        const fixIndex = positiveIndexes.reduce((bestIndex, currentIndex) => {
            if (bestIndex === -1) return currentIndex;
            return displayValues[currentIndex] > displayValues[bestIndex] ? currentIndex : bestIndex;
        }, -1);
        if (fixIndex !== -1) {
            displayValues[fixIndex] += drift;
        }
    }

    return { rawValues, displayValues };
}

function destroyChartInstance(chartKey) {
    if (!charts[chartKey]) return;
    charts[chartKey].destroy();
    charts[chartKey] = null;
}

function getPlaceholderCircularColors(sliceCount = 4) {
    const alphaPattern = [0.2, 0.14, 0.17, 0.11, 0.15];
    return Array.from({ length: sliceCount }, (_, index) => `rgba(255, 255, 255, ${alphaPattern[index % alphaPattern.length]})`);
}

function renderPlaceholderCircularChart(chartKey, canvas, options = {}) {
    if (!canvas) return;
    destroyChartInstance(chartKey);
    const sliceCount = Math.max(3, Number(options.sliceCount) || 4);
    const colors = getPlaceholderCircularColors(sliceCount);
    const borderColors = colors.map(() => 'rgba(255, 255, 255, 0.22)');
    const data = Array.from({ length: sliceCount }, () => 1);
    charts[chartKey] = new Chart(canvas, {
        type: options.type || 'doughnut',
        data: {
            labels: Array.from({ length: sliceCount }, () => ''),
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 0,
                borderRadius: 0,
                spacing: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: Number(options.padding) || 14 },
            cutout: options.cutout || '72%',
            radius: options.radius || '90%',
            rotation: Number.isFinite(options.rotation) ? options.rotation : -90,
            events: [],
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                chartShadow: false
            },
            animation: {
                duration: 650,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderPlaceholderBarChart(chartKey, canvas) {
    if (!canvas) return;
    destroyChartInstance(chartKey);
    charts[chartKey] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['', '', '', '', ''],
            datasets: [{
                data: [4, 6, 5, 7, 6],
                backgroundColor: 'rgba(255, 255, 255, 0.16)',
                borderColor: 'rgba(255, 255, 255, 0.24)',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            events: [],
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: {
                    ticks: { display: false },
                    grid: { color: 'rgba(255,255,255,0.06)', drawTicks: false },
                    border: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { display: false },
                    grid: { color: 'rgba(255,255,255,0.06)', drawTicks: false },
                    border: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            animation: {
                duration: 650,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderPlaceholderLineChart(chartKey, canvas) {
    if (!canvas) return;
    destroyChartInstance(chartKey);
    charts[chartKey] = new Chart(canvas, {
        type: 'line',
        data: {
            labels: ['', '', '', '', '', ''],
            datasets: [{
                data: [2.5, 3.2, 2.8, 3.6, 3.1, 3.7],
                borderColor: 'rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            events: [],
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: {
                    ticks: { display: false },
                    grid: { color: 'rgba(255,255,255,0.06)', drawTicks: false },
                    border: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    ticks: { display: false },
                    grid: { color: 'rgba(255,255,255,0.06)', drawTicks: false },
                    border: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            animation: {
                duration: 650,
                easing: 'easeOutQuart'
            }
        }
    });
}

const segmentIconsPlugin = {
    id: 'segmentIcons',
    afterDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        const icons = pluginOptions?.icons || [];
        if (!icons.length) return;
        const colors = pluginOptions?.colors || chart.data.datasets[args.index]?.backgroundColor || [];
        const meta = chart.getDatasetMeta(args.index);
        const displayData = chart.data.datasets[args.index]?.data || [];
        const rawData = chart.data.datasets[args.index]?.rawData || displayData;
        const total = rawData.reduce((a, b) => a + b, 0);
        if (!total) return;
        const ctx = chart.ctx;
        const area = chart.chartArea || { left: 0, top: 0, right: chart.width, bottom: chart.height };
        const clamp = (value, min, max) => {
            if (min > max) return value;
            return Math.max(min, Math.min(max, value));
        };
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        meta.data.forEach((arc, i) => {
            const value = rawData[i] || 0;
            if (value <= 0) return;
            const icon = icons[i] || '';
            if (!icon) return;
            const color = Array.isArray(colors) ? colors[i] : colors;
            const thickness = arc.outerRadius - arc.innerRadius;
            const ringFill = Number.isFinite(pluginOptions?.ringFill) ? pluginOptions.ringFill : 0.36;
            const minRadius = Number.isFinite(pluginOptions?.minRadius) ? pluginOptions.minRadius : 6;
            const maxRadius = Number.isFinite(pluginOptions?.maxRadius) ? pluginOptions.maxRadius : 15;
            const fontScale = Number.isFinite(pluginOptions?.fontScale) ? pluginOptions.fontScale : 1.1;
            const iconOffsetY = Number.isFinite(pluginOptions?.iconOffsetY) ? pluginOptions.iconOffsetY : 0.5;
            const maxBadgeRadius = Math.max(4, (thickness * 0.5) - 1.2);
            const badgeRadius = Math.min(maxRadius, maxBadgeRadius, Math.max(minRadius, thickness * ringFill));
            // Place icon badge on the segment edge (legacy visual style).
            const angle = arc.endAngle;
            const radius = arc.innerRadius + thickness * 0.5;
            const rawX = arc.x + Math.cos(angle) * radius;
            const rawY = arc.y + Math.sin(angle) * radius;
            const x = clamp(rawX, area.left + badgeRadius + 2, area.right - badgeRadius - 2);
            const y = clamp(rawY, area.top + badgeRadius + 2, area.bottom - badgeRadius - 2);
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = mixWithWhite(color, 0.15);
            ctx.beginPath();
            ctx.arc(x, y, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.round(badgeRadius * fontScale)}px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.fillText(icon, x, y + iconOffsetY);
        });
        ctx.restore();
    }
};

const segmentJoinCapsPlugin = {
    id: 'segmentJoinCaps',
    afterDatasetDraw(chart, args, pluginOptions) {
        if (!pluginOptions || pluginOptions.enabled === false) return;
        const type = chart?.config?.type;
        if (type !== 'doughnut') return;

        const dataset = chart.data.datasets[args.index];
        if (!dataset) return;
        const values = dataset.rawData || dataset.data || [];
        const positiveCount = values.filter(value => Number(value) > 0).length;
        if (positiveCount <= 1) return;

        const colors = pluginOptions.colors || dataset.backgroundColor || [];
        const meta = chart.getDatasetMeta(args.index);
        const ctx = chart.ctx;
        const area = chart.chartArea || { left: 0, top: 0, right: chart.width, bottom: chart.height };
        const clamp = (value, min, max) => {
            if (min > max) return value;
            return Math.max(min, Math.min(max, value));
        };

        ctx.save();
        meta.data.forEach((arc, i) => {
            const value = Number(values[i] || 0);
            if (value <= 0) return;

            const color = Array.isArray(colors) ? colors[i] : colors;
            if (!color) return;

            const thickness = arc.outerRadius - arc.innerRadius;
            // Keep join cap fully inside ring width so it never protrudes outside chart edge.
            const capRadius = Math.max(2, (thickness * 0.5) - 0.4);
            const angle = arc.endAngle;
            const radius = arc.innerRadius + thickness * 0.5;
            const rawX = arc.x + Math.cos(angle) * radius;
            const rawY = arc.y + Math.sin(angle) * radius;
            const x = clamp(rawX, area.left + capRadius + 1, area.right - capRadius - 1);
            const y = clamp(rawY, area.top + capRadius + 1, area.bottom - capRadius - 1);

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, capRadius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
};

const segmentPercentagesPlugin = {
    id: 'segmentPercentages',
    afterDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        if (!pluginOptions) return;
        const meta = chart.getDatasetMeta(args.index);
        const displayData = chart.data.datasets[args.index]?.data || [];
        const rawData = chart.data.datasets[args.index]?.rawData || displayData;
        const total = rawData.reduce((a, b) => a + b, 0);
        if (!total) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '14px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        meta.data.forEach((arc, i) => {
            const value = rawData[i] || 0;
            const percent = ((value / total) * 100);
            if (percent < 3) return;
            const angle = (arc.startAngle + arc.endAngle) / 2;
            const radius = arc.outerRadius + 20;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;
            ctx.fillText(`${percent.toFixed(0)}%`, x, y);
        });
        ctx.restore();
    }
};

const segmentPopupPlugin = {
    id: 'segmentPopup',
    afterDatasetsDraw(chart, args, pluginOptions) {
        if (!pluginOptions || pluginOptions.enabled === false) return;
        const idx = chart.$segmentPopupIndex;
        if (idx === null || idx === undefined) return;
        const meta = chart.getDatasetMeta(0);
        const arc = meta?.data?.[idx];
        if (!arc) return;
        const dataset = chart.data.datasets[0];
        const displayValues = dataset.data || [];
        const values = dataset.rawData || displayValues;
        const total = values.reduce((a, b) => a + b, 0);
        const value = Number(values[idx] || 0);
        const percent = total > 0 ? (value / total * 100).toFixed(1) : '0.0';
        const symbol = currencySymbols[currentCurrency] || '₽';
        const labels = chart.data.labels || [];
        const rawLabel = String(labels[idx] || t('Категория'));
        const categoryName = rawLabel.length > 26 ? `${rawLabel.slice(0, 25)}…` : rawLabel;
        const iconList = chart?.options?.plugins?.segmentIcons?.icons || [];
        const categoryIcon = iconList[idx] || '';
        const categoryColorList = dataset.backgroundColor || [];
        const categoryColor = Array.isArray(categoryColorList)
            ? (categoryColorList[idx] || '#5D9CEC')
            : (categoryColorList || '#5D9CEC');
        const popupFillColor = colorWithAlpha(categoryColor, 0.24);
        const popupStrokeColor = colorWithAlpha(categoryColor, 0.62);

        const anchorAngle = arc.endAngle;
        // Якорь в крайней точке у внутренней кромки сегмента
        const anchorRadius = arc.innerRadius + 1;
        const anchorX = arc.x + Math.cos(anchorAngle) * anchorRadius;
        const anchorY = arc.y + Math.sin(anchorAngle) * anchorRadius;

        const lines = [
            `${categoryIcon ? `${categoryIcon} ` : ''}${categoryName}`,
            `${formatCurrency(value)} ${symbol}`,
            `${percent}%`
        ];

        const ctx = chart.ctx;
        ctx.save();

        const area = chart.chartArea || { left: 0, top: 0, right: chart.width, bottom: chart.height };
        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
        const width0 = ctx.measureText(lines[0]).width;
        ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
        const width1 = ctx.measureText(lines[1]).width;
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
        const width2 = ctx.measureText(lines[2]).width;
        const textWidth = Math.max(width0, width1, width2);

        const paddingX = 10;
        const paddingY = 8;
        const lineHeights = [14, 16, 13];
        const lineGap = 2;
        const contentHeight = lineHeights.reduce((a, b) => a + b, 0) + lineGap * 2;

        const maxPopupWidth = Math.min(area.right - area.left - 12, Math.max(124, arc.innerRadius * 1.6));
        const boxWidth = Math.min(textWidth + paddingX * 2, maxPopupWidth);
        const boxHeight = paddingY * 2 + contentHeight;

        // Держим окно внутри внутреннего круга графика
        const halfDiag = Math.hypot(boxWidth / 2, boxHeight / 2);
        const maxInsideOffset = Math.max(0, arc.innerRadius - halfDiag - 6);
        const insideOffset = Math.min(maxInsideOffset, arc.innerRadius * 0.34);
        const targetCenterX = arc.x + Math.cos(anchorAngle) * insideOffset;
        const targetCenterY = arc.y + Math.sin(anchorAngle) * insideOffset;

        let boxX = targetCenterX - boxWidth / 2;
        let boxY = targetCenterY - boxHeight / 2;
        boxX = clamp(boxX, area.left + 6, area.right - boxWidth - 6);
        boxY = clamp(boxY, area.top + 6, area.bottom - boxHeight - 6);

        // Дополнительно удерживаем попап внутри внутреннего отверстия пончика.
        let boxCenterX = boxX + boxWidth / 2;
        let boxCenterY = boxY + boxHeight / 2;
        const maxCenterDistance = Math.max(0, arc.innerRadius - halfDiag - 5);
        const centerDx = boxCenterX - arc.x;
        const centerDy = boxCenterY - arc.y;
        const centerDist = Math.hypot(centerDx, centerDy);
        if (maxCenterDistance > 0 && centerDist > maxCenterDistance) {
            const scale = maxCenterDistance / centerDist;
            boxCenterX = arc.x + centerDx * scale;
            boxCenterY = arc.y + centerDy * scale;
            boxX = boxCenterX - boxWidth / 2;
            boxY = boxCenterY - boxHeight / 2;
        }

        const radius = 14;
        boxCenterX = boxX + boxWidth / 2;
        boxCenterY = boxY + boxHeight / 2;
        const angle = Math.atan2(anchorY - boxCenterY, anchorX - boxCenterX);
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const halfW = boxWidth / 2 - radius / 2;
        const halfH = boxHeight / 2 - radius / 2;
        const scaleX = Math.abs(dirX) > 0.001 ? halfW / Math.abs(dirX) : Number.POSITIVE_INFINITY;
        const scaleY = Math.abs(dirY) > 0.001 ? halfH / Math.abs(dirY) : Number.POSITIVE_INFINITY;
        const scale = Math.min(scaleX, scaleY);
        const edgeX = boxCenterX + dirX * scale;
        const edgeY = boxCenterY + dirY * scale;

        // Bubble body.
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + boxWidth - radius, boxY);
        ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
        ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
        ctx.lineTo(boxX + radius, boxY + boxHeight);
        ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.closePath();
        ctx.fillStyle = popupFillColor;
        ctx.strokeStyle = popupStrokeColor;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Tail that visually merges into the bubble.
        const edgeToAnchorX = anchorX - edgeX;
        const edgeToAnchorY = anchorY - edgeY;
        const tailLen = Math.max(1, Math.hypot(edgeToAnchorX, edgeToAnchorY));
        const tailUx = edgeToAnchorX / tailLen;
        const tailUy = edgeToAnchorY / tailLen;
        const tailNx = -tailUy;
        const tailNy = tailUx;
        const rootHalf = Math.min(9, Math.max(5, Math.min(boxWidth, boxHeight) * 0.08));
        const tipHalf = Math.max(2.6, rootHalf * 0.44);
        const pull = Math.min(22, tailLen * 0.38);
        const approach = Math.min(12, tailLen * 0.28);

        const rootLeftX = edgeX + tailNx * rootHalf;
        const rootLeftY = edgeY + tailNy * rootHalf;
        const rootRightX = edgeX - tailNx * rootHalf;
        const rootRightY = edgeY - tailNy * rootHalf;
        const tipLeftX = anchorX + tailNx * tipHalf;
        const tipLeftY = anchorY + tailNy * tipHalf;
        const tipRightX = anchorX - tailNx * tipHalf;
        const tipRightY = anchorY - tailNy * tipHalf;

        ctx.beginPath();
        ctx.moveTo(rootLeftX, rootLeftY);
        ctx.bezierCurveTo(
            rootLeftX + tailUx * pull + tailNx * rootHalf * 0.35,
            rootLeftY + tailUy * pull + tailNy * rootHalf * 0.35,
            tipLeftX - tailUx * approach + tailNx * tipHalf * 0.25,
            tipLeftY - tailUy * approach + tailNy * tipHalf * 0.25,
            tipLeftX,
            tipLeftY
        );
        ctx.quadraticCurveTo(anchorX, anchorY, tipRightX, tipRightY);
        ctx.bezierCurveTo(
            tipRightX - tailUx * approach - tailNx * tipHalf * 0.25,
            tipRightY - tailUy * approach - tailNy * tipHalf * 0.25,
            rootRightX + tailUx * pull - tailNx * rootHalf * 0.35,
            rootRightY + tailUy * pull - tailNy * rootHalf * 0.35,
            rootRightX,
            rootRightY
        );
        ctx.closePath();
        ctx.fillStyle = popupFillColor;
        ctx.strokeStyle = popupStrokeColor;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Outline sides/tip only (skip root segment to avoid a visible seam).
        ctx.beginPath();
        ctx.moveTo(rootLeftX, rootLeftY);
        ctx.bezierCurveTo(
            rootLeftX + tailUx * pull + tailNx * rootHalf * 0.35,
            rootLeftY + tailUy * pull + tailNy * rootHalf * 0.35,
            tipLeftX - tailUx * approach + tailNx * tipHalf * 0.25,
            tipLeftY - tailUy * approach + tailNy * tipHalf * 0.25,
            tipLeftX,
            tipLeftY
        );
        ctx.quadraticCurveTo(anchorX, anchorY, tipRightX, tipRightY);
        ctx.bezierCurveTo(
            tipRightX - tailUx * approach - tailNx * tipHalf * 0.25,
            tipRightY - tailUy * approach - tailNy * tipHalf * 0.25,
            rootRightX + tailUx * pull - tailNx * rootHalf * 0.35,
            rootRightY + tailUy * pull - tailNy * rootHalf * 0.35,
            rootRightX,
            rootRightY
        );
        ctx.stroke();

        // Blend cap over the root so the join reads as a single organic shape.
        ctx.beginPath();
        ctx.arc(edgeX, edgeY, Math.max(2.2, rootHalf * 0.62), 0, Math.PI * 2);
        ctx.fillStyle = popupFillColor;
        ctx.fill();

        // Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let textY = boxY + paddingY + lineHeights[0] * 0.5;
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(lines[0], boxCenterX, textY);
        textY += lineHeights[0] + lineGap + lineHeights[1] * 0.5;
        ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(lines[1], boxCenterX, textY);
        textY += lineHeights[1] * 0.5 + lineGap + lineHeights[2] * 0.5;
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(lines[2], boxCenterX, textY);

        ctx.restore();
    }
};

if (window.Chart && Chart.register) {
    Chart.register(chartShadowPlugin, segmentJoinCapsPlugin, segmentIconsPlugin, segmentPercentagesPlugin, segmentPopupPlugin);
}

// ==================== //
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ //
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Загрузка приложения (iOS 26 стиль)...');
    
    try {
        if (await cleanupServiceWorkerCache()) return;
        initInviteFromUrl();
        initLanguage();
        // Восстанавливаем сессию
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        await initUser();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        initEventListeners();
        initNavigation();
        initCategorySwipe();
        updateCurrencyDisplay();
        setupAddButton();
        initViewportVars();
        // Service worker отключен, чтобы обновления приходили автоматически
        
        // Инициализируем сворачиваемые секции
        initCollapsibleSections();
        
        // Загружаем начальные данные
        await loadPanelData();
        handlePendingInvite();
        
        // Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            try { Telegram.WebApp.expand(); } catch (e) {}
            try { Telegram.WebApp.setHeaderColor && Telegram.WebApp.setHeaderColor('#000000'); } catch (e) {}
            try { Telegram.WebApp.setBackgroundColor && Telegram.WebApp.setBackgroundColor('#000000'); } catch (e) {}
            try { Telegram.WebApp.ready && Telegram.WebApp.ready(); } catch (e) {}
            try { Telegram.WebApp.setupClosingBehavior && Telegram.WebApp.setupClosingBehavior(); } catch (e) {}
        }
        
        console.log('✅ Приложение загружено в стиле iOS 26');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--ios-text-primary);">${t('Ошибка загрузки')}</div>
                <div style="font-size: 14px; color: var(--ios-text-secondary); margin-bottom: 20px;">${t('Пожалуйста, обновите страницу')}</div>
                <button onclick="location.reload()" style="background: var(--ios-accent); color: white; border: none; padding: 12px 24px; border-radius: var(--border-radius); font-size: 16px; cursor: pointer; margin-top: 10px;">${t('Обновить')}</button>
            </div>
        `;
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        refreshSubscriptionInfo();
    }
});

async function cleanupServiceWorkerCache() {
    if (!('serviceWorker' in navigator)) return false;
    const forced = localStorage.getItem('sw_cleanup_done');
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs && regs.length) {
            await Promise.all(regs.map((reg) => reg.unregister()));
        }
        if (window.caches && caches.keys) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if (!forced) {
            localStorage.setItem('sw_cleanup_done', '1');
            window.location.reload();
            return true;
        }
    } catch {}
    return false;
}

async function initUser() {
    let telegramId, username = '', firstName = t('Пользователь');
    
    if (window.Telegram && Telegram.WebApp) {
        const user = Telegram.WebApp.initDataUnsafe?.user;
        if (user) {
            telegramId = user.id;
            username = user.username || '';
            firstName = user.first_name || t('Пользователь');
        }
    }
    
    if (!telegramId) {
        const savedId = localStorage.getItem('finance_user_id');
        telegramId = savedId ? parseInt(savedId) : Math.floor(Math.random() * 1000000);
        localStorage.setItem('finance_user_id', telegramId.toString());
    }
    
    if (!sessionToken) {
        sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('finance_session_token', sessionToken);
    }
    
    try {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegramId,
                username: username,
                first_name: firstName,
                session_token: sessionToken
            })
        });
        
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
        
        currentUser = {
            id: data.user_id,
            telegramId: data.telegram_id,
            firstName: data.first_name,
            sessionToken: data.session_token,
            username: username
        };
        
        // Восстанавливаем выбранную валюту
        if (localStorage.getItem('finance_currency')) {
            currentCurrency = localStorage.getItem('finance_currency');
        } else {
            currentCurrency = data.currency || 'RUB';
        }
        
        defaultWallet = data.default_wallet || 'Карта';
        categoriesData = data.categories || { income: [], expense: [], savings: [] };
        walletsData = data.wallets || [];
        goalsData = data.goals || [];
        debtsData = data.debts || [];
        categoryStats = data.category_stats || { income: {}, expense: {}, wallets: {} };
        allTransactions = data.recent_transactions || [];
        debtsEnabled = !!data.debts_enabled;
        subscriptionActive = !!data.subscription_active;
        subscriptionStart = data.subscription_start || null;
        subscriptionEnd = data.subscription_end || null;
        if (subscriptionActive) {
            subscriptionPayment = { invoiceId: null, status: '', asset: 'USDT', amount: '', currency: '', invoiceUrl: '', miniAppUrl: '', webAppUrl: '', botUrl: '', months: subscriptionDuration };
            try { localStorage.removeItem('subscription_payment'); } catch {}
        }
        
        // Обновляем отображение
        updateCurrencyDisplay();
        updateBalanceDisplay(data.summary);
        updateSubscriptionPeriod();
        updateDebtsUI(false);
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        throw error;
    }
}

// ==================== //
// СВОРАЧИВАЕМЫЕ СЕКЦИИ - НОВАЯ ФУНКЦИОНАЛЬНОСТЬ //
// ==================== //

function initCollapsibleSections() {
    // Обработчики для заголовков секций
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const section = this.closest('.collapsible-section');
            const type = section.dataset.type;
            toggleCollapsibleSection(type);
        });
    });
    
    // Обработчики для кнопок "Скрыть"
    document.querySelectorAll('.hide-categories-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const type = this.dataset.type;
            toggleCollapsibleSection(type, false);
        });
    });
}

function toggleCollapsibleSection(type, forceState = null) {
    const section = document.querySelector(`.collapsible-section[data-type="${type}"]`);
    if (!section) return;
    
    const isExpanded = section.classList.contains('expanded');
    const shouldExpand = forceState !== null ? forceState : !isExpanded;
    
    if (shouldExpand) {
        section.classList.add('expanded');
        // Прокручиваем к секции если она была скрыта
        if (!isExpanded) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    } else {
        section.classList.remove('expanded');
    }
}

function toggleSettingsCard(forceState = null) {
    const card = document.getElementById('settings-card');
    if (!card) return;
    const isExpanded = card.classList.contains('expanded');
    const shouldExpand = forceState !== null ? forceState : !isExpanded;
    const items = card.querySelector('.settings-items');
    if (items) {
        const currentHeight = items.scrollHeight;
        if (shouldExpand) {
            items.style.maxHeight = `${currentHeight}px`;
        } else {
            items.style.maxHeight = `${currentHeight}px`;
            requestAnimationFrame(() => {
                items.style.maxHeight = '0px';
            });
        }
    }
    card.classList.toggle('expanded', shouldExpand);
    card.classList.toggle('collapsed', !shouldExpand);
    const header = card.querySelector('.settings-header');
    if (header) header.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
}

async function resetAllData() {
    if (!currentUser) return;

    const confirmText = `${t('Сбросить все данные?')}\n\n${t('Будут удалены все операции, категории, кошельки, цели и долги. Это действие нельзя отменить.')}`;
    if (!window.confirm(confirmText)) return;

    try {
        const response = await fetch('/api/settings/reset_all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                confirm: true
            })
        });
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error || t('Ошибка сброса данных'));
        }

        const currentMonth = getCurrentMonthPeriodValue();
        incomeStatsPeriod = currentMonth;
        expenseStatsPeriod = currentMonth;
        reportChartPeriods = {
            overview: currentMonth,
            income: currentMonth,
            expense: currentMonth,
            panel: currentMonth
        };
        reportChartRanges = {
            overview: { from: '', to: '' },
            income: { from: '', to: '' },
            expense: { from: '', to: '' },
            panel: { from: '', to: '' }
        };

        await loadPanelData();
        await loadMonthTransactions();
        await loadReportData();
        updateDefaultWalletDisplay();

        showNotification(t('Все данные сброшены'), 'success');
    } catch (error) {
        console.error('❌ Ошибка сброса данных:', error);
        showNotification(`${t('Ошибка сброса данных')}: ${error.message}`, 'error');
    }
}

// ==================== //
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА //
// ==================== //

function updateBalanceDisplay(summary) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    panelInitSummary = summary || panelInitSummary;
    
    // Остаток
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        let balanceValue = summary?.balance ?? 0;
        if (currentPage === 'panel' && panelTransactions.length > 0) {
            balanceValue = Number(panelScopedSummary?.balance) || 0;
        } else {
            const walletsTotal = walletsData.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
            if (Number.isFinite(walletsTotal) && walletsTotal > 0) {
                balanceValue = walletsTotal;
            }
        }
        balanceElement.textContent = formatCurrency(balanceValue) + ' ' + symbol;
    }
    
    // Обновляем суммы в заголовках секций
    updateSectionTotals();
}

function updateSectionTotals() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    const incomeStats = getDisplayCategoryStats('income');
    const expenseStats = getDisplayCategoryStats('expense');
    
    // Доходы
    let incomeTotal = 0;
    Object.values(incomeStats || {}).forEach(value => {
        incomeTotal += value;
    });
    document.getElementById('income-total').textContent = formatCurrency(incomeTotal) + ' ' + symbol;
    
    // Расходы
    let expenseTotal = 0;
    Object.values(expenseStats || {}).forEach(value => {
        expenseTotal += value;
    });
    document.getElementById('expense-total').textContent = formatCurrency(expenseTotal) + ' ' + symbol;
    
    // Накопления
    let savingsTotal = getSavingsAmount();
    document.getElementById('savings-total').textContent = formatCurrency(savingsTotal) + ' ' + symbol;
    
    // Цели
    let goalsTotal = 0;
    goalsData.filter(goal => !goal.archived).forEach(goal => {
        goalsTotal += parseFloat(goal.current_amount) || 0;
    });
    const goalsSummaryEl = document.getElementById('goals-summary');
    if (goalsSummaryEl) {
        goalsSummaryEl.textContent = formatCurrency(goalsTotal) + ' ' + symbol;
    }
    
    // Кошельки
    let walletsTotal = 0;
    walletsData.forEach(wallet => {
        walletsTotal += wallet.balance || 0;
    });
    document.getElementById('wallets-total').textContent = formatCurrency(walletsTotal) + ' ' + symbol;

    // Долги
    const debtsTotalEl = document.getElementById('debts-total');
    if (debtsTotalEl) {
        const activeDebts = debtsData.filter(debt => !debt.archived);
        if (activeDebts.length > 0) {
            const remaining = activeDebts.reduce((sum, debt) => {
                const target = Number(debt.target_amount) || 0;
                const paid = Number(debt.paid_amount) || 0;
                return sum + Math.max(target - paid, 0);
            }, 0);
            debtsTotalEl.textContent = `${formatCurrency(remaining)} ${symbol}`;
        } else {
            debtsTotalEl.textContent = `0 ${symbol}`;
        }
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ - ПЕРЕРАБОТАННАЯ //
/* НОВОЕ: сворачиваемые секции */
// ==================== //

function sortTransactionsByDateDesc(items) {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => {
        const aTs = parseTransactionDate(a?.date).getTime();
        const bTs = parseTransactionDate(b?.date).getTime();
        if (Number.isFinite(aTs) && Number.isFinite(bTs)) {
            return bTs - aTs;
        }
        return Number(b?.id || 0) - Number(a?.id || 0);
    });
}

async function loadPanelTransactions() {
    if (!currentUser) return [];
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        panelTransactions = sortTransactionsByDateDesc(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error('❌ Ошибка загрузки транзакций панели:', error);
        panelTransactions = sortTransactionsByDateDesc(Array.isArray(allTransactions) ? allTransactions : []);
    }
    allTransactions = panelTransactions;
    return panelTransactions;
}

function renderPanelPeriodControls() {
    const anchor = document.getElementById('panel-period-anchor');
    if (!anchor) return;

    const periodOptions = getReportStatsPeriodOptions(panelTransactions || [], true);
    reportChartPeriodOptions.panel = periodOptions;
    reportChartMonthValues.panel = periodOptions
        .map(option => option.value)
        .filter(value => typeof value === 'string' && value.startsWith('month:'));

    const defaultPeriod = getCurrentMonthPeriodValue();
    if (!periodOptions.some(option => option.value === reportChartPeriods.panel)) {
        reportChartPeriods.panel = periodOptions.some(option => option.value === defaultPeriod) ? defaultPeriod : 'all';
    }
    if (!reportChartRanges.panel) {
        reportChartRanges.panel = { from: '', to: '' };
    }
    const selectedPeriod = reportChartPeriods.panel || defaultPeriod;
    const periodLabel = selectedPeriod === 'range'
        ? t('Свой')
        : getReportPeriodLabel('panel', selectedPeriod);

    anchor.innerHTML = `
        <div class="panel-period-controls">
            <button type="button" class="panel-period-trigger" id="panel-period-trigger">
                <span class="panel-period-trigger-text">${periodLabel}</span>
                <span class="panel-period-trigger-caret">▾</span>
            </button>
            <span class="panel-period-label">${t('Период')}</span>
        </div>
    `;

    const trigger = document.getElementById('panel-period-trigger');
    if (trigger) {
        trigger.onclick = () => openReportPeriodModal('panel');
    }
}

function applyPanelPeriodFilter() {
    const filteredTransactions = recalculatePanelScopedData();
    updatePanelCategories();
    updateWalletsDisplay();
    updateSavingsDisplay();
    updateDebtsDisplay();
    updatePanelGoals();
    updateRecentTransactions(filteredTransactions);
    updateBalanceDisplay(panelInitSummary || {});
}

function openPanelRangeModal() {
    const modal = document.getElementById('panel-range-modal');
    if (!modal) return;
    const fromInput = document.getElementById('panel-range-modal-from');
    const toInput = document.getElementById('panel-range-modal-to');
    const range = reportChartRanges.panel || { from: '', to: '' };
    if (fromInput) fromInput.value = range.from || '';
    if (toInput) toInput.value = range.to || '';
    modal.classList.add('active');
    updateBodyModalState();
}

function closePanelRangeModal() {
    closeModal('panel-range-modal');
}

function applyPanelCustomRange() {
    const fromInput = document.getElementById('panel-range-modal-from');
    const toInput = document.getElementById('panel-range-modal-to');
    reportChartPeriods.panel = 'range';
    reportChartRanges.panel = {
        from: fromInput?.value || '',
        to: toInput?.value || ''
    };
    renderPanelPeriodControls();
    applyPanelPeriodFilter();
    closePanelRangeModal();
}

async function loadPanelData() {
    if (!currentUser) return;
    
    try {
        // Загружаем обновлённые данные
        const response = await fetch(`/api/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: currentUser.telegramId,
                first_name: currentUser.firstName || 'Пользователь',
                session_token: sessionToken
            })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Обновляем категории
        categoriesData = data.categories || categoriesData;
        walletsData = data.wallets || walletsData;
        goalsData = data.goals || goalsData;
        debtsData = data.debts || debtsData;
        categoryStats = data.category_stats || categoryStats;
        allTransactions = sortTransactionsByDateDesc(data.recent_transactions || allTransactions);
        panelInitSummary = data.summary || panelInitSummary;
        if (typeof data.debts_enabled !== 'undefined') {
            debtsEnabled = !!data.debts_enabled;
        }

        await loadPanelTransactions();
        renderPanelPeriodControls();
        applyPanelPeriodFilter();
        
        // Обновляем отображение
        updateDebtsUI(false);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

function updatePanelCategories() {
    injectDebtCategory();
    updateCategorySection('income', 'Доходы');
    updateCategorySection('expense', 'Расходы');
}

function renderSwipeCategoryCard(type, name, icon, color, amountMarkup) {
    const encodedName = encodeURIComponent(name);
    return `
        <div class="category-swipe-item" data-category-type="${type}" data-category-name="${encodedName}">
            <button type="button" class="category-swipe-action" onclick="event.stopPropagation(); handleCategoryDeleteFromSwipe(this)" aria-label="${t('Удалить')}">
                🗑
            </button>
            <button type="button" class="category-card category-card--swipe" data-category-type="${type}" data-category-name="${encodedName}" onclick="handleCategoryCardTap(event, this)">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${t(name)}</span>
                    </div>
                </div>
                ${amountMarkup}
            </button>
        </div>
    `;
}

function updateCategorySection(type, title) {
    const container = document.getElementById(`${type}-categories`);
    if (!container) return;
    
    const categories = categoriesData[type] || [];
    const stats = getDisplayCategoryStats(type);
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    
    const usedColors = new Set();
    categories.forEach((cat, index) => {
        const amount = stats[cat.name] || 0;
        const isPositive = type !== 'expense';
        const icon = cat.icon || (type === 'income' ? '📈' : '📉');
        const color = pickDistinctColor(cat.color, index, usedColors);

        const amountMarkup = `<div class="category-amount ${isPositive ? 'amount-positive' : 'amount-negative'}">
                ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
            </div>`;
        const isDeletable = !(type === 'expense' && cat.name === 'Долги');
        if (isDeletable) {
            html += renderSwipeCategoryCard(type, cat.name, icon, color, amountMarkup);
        } else {
            html += `
                <button class="category-card" onclick="showAddTransactionForCategory('${type}', '${cat.name}')">
                    <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                        ${icon}
                    </div>
                    <div class="category-info">
                        <div class="category-name">
                            <span class="category-name-text">${t(cat.name)}</span>
                        </div>
                    </div>
                    ${amountMarkup}
                </button>
            `;
        }
    });
    
    // Добавляем кнопку "Добавить категорию" если есть категории
    if (categories.length > 0) {
        html += `
            <button class="add-category-btn" onclick="showAddCategoryModal('${type}')">
                <span>+</span>
                <span>${t('Добавить категорию')}</span>
            </button>
        `;
    } else {
        html += `
            <button class="add-category-btn" onclick="showAddCategoryModal('${type}')" style="padding: 20px;">
                <span>+</span>
                <span>${t('Добавить первую категорию')}</span>
            </button>
        `;
    }
    
    container.innerHTML = html;
}

function updateSavingsDisplay() {
    const container = document.getElementById('savings-categories');
    if (!container) return;
    
    const categories = categoriesData.savings || [];
    const stats = getDisplayCategoryStats('expense');
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    
    const usedColors = new Set();
    const hasPiggyCategory = categories.some(cat => cat.name === 'Накопления');
    const piggyAmount = getSavingsAmount();
    if (!hasPiggyCategory && piggyAmount > 0) {
        const piggyColor = pickDistinctColor('#FFD166', 0, usedColors);
        const amountMarkup = `<div class="category-amount" style="color: ${piggyColor};">
                ${formatCurrency(piggyAmount)} ${symbol}
            </div>`;
        html += renderSwipeCategoryCard('savings', 'Накопления', '💰', piggyColor, amountMarkup);
    }
    
    // Показываем накопления из категорий
    categories.forEach((cat, index) => {
        const amount = stats[cat.name] || 0;
        const icon = cat.icon || '💰';
        const color = pickDistinctColor(cat.color, index, usedColors);
        const amountMarkup = `<div class="category-amount" style="color: ${color};">
                ${formatCurrency(amount)} ${symbol}
            </div>`;
        html += renderSwipeCategoryCard('savings', cat.name, icon, color, amountMarkup);
    });
    
    
    // Добавляем кнопку "Добавить категорию"
    html += `
        <button class="add-category-btn" onclick="showAddCategoryModal('savings')">
            <span>+</span>
            <span>${t('Добавить категорию')}</span>
        </button>
    `;
    
    container.innerHTML = html;
}

function decodeCategoryName(encodedName) {
    if (!encodedName) return '';
    try {
        return decodeURIComponent(encodedName);
    } catch {
        return encodedName;
    }
}

function setCategorySwipeOffset(item, offset) {
    if (!item) return;
    const clamped = Math.max(-CATEGORY_SWIPE_MAX, Math.min(0, offset));
    const progress = Math.max(0, Math.min(1, Math.abs(clamped) / CATEGORY_SWIPE_MAX));
    item.style.setProperty('--swipe-offset', `${clamped}px`);
    item.style.setProperty('--swipe-progress', progress.toFixed(3));
}

function closeCategorySwipeItem(item = activeCategorySwipeItem) {
    if (!item) return;
    item.classList.remove('swipe-open');
    item.classList.remove('swiping');
    setCategorySwipeOffset(item, 0);
    if (activeCategorySwipeItem === item) {
        activeCategorySwipeItem = null;
    }
}

function openCategorySwipeItem(item) {
    if (!item) return;
    if (activeCategorySwipeItem && activeCategorySwipeItem !== item) {
        closeCategorySwipeItem(activeCategorySwipeItem);
    }
    item.classList.add('swipe-open');
    setCategorySwipeOffset(item, -CATEGORY_SWIPE_MAX);
    activeCategorySwipeItem = item;
}

function handleCategoryCardTap(event, button) {
    if (!button) return;
    const now = Date.now();
    if (now < categorySwipeSuppressClickUntil) {
        event.preventDefault();
        return;
    }
    const swipeItem = button.closest('.category-swipe-item');
    if (swipeItem && swipeItem.classList.contains('swipe-open')) {
        event.preventDefault();
        closeCategorySwipeItem(swipeItem);
        categorySwipeSuppressClickUntil = Date.now() + 160;
        return;
    }

    const type = button.dataset.categoryType;
    const category = decodeCategoryName(button.dataset.categoryName);
    if (!type || !category) return;
    showAddTransactionForCategory(type, category);
}

async function deleteCategoryAndTransactions(type, name) {
    if (!currentUser || !type || !name) return;
    const confirmText = `${t('Удалить')} "${name}"?\n${t('Будут удалены все операции этой категории')}`;
    if (!window.confirm(confirmText)) {
        return;
    }

    try {
        const response = await fetch('/api/category/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                type,
                name
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        closeCategorySwipeItem();
        showNotification(t('Категория удалена'), 'success');
        await loadPanelData();
        if (currentPage === 'history') {
            loadMonthTransactions();
        } else if (currentPage === 'report') {
            await loadReportData();
        }
    } catch (error) {
        console.error('❌ Ошибка удаления категории:', error);
        showNotification(t('Ошибка удаления категории'), 'error');
    }
}

function handleCategoryDeleteFromSwipe(button) {
    const item = button?.closest('.category-swipe-item');
    if (!item) return;
    const type = item.dataset.categoryType;
    const name = decodeCategoryName(item.dataset.categoryName);
    deleteCategoryAndTransactions(type, name);
}

function initCategorySwipe() {
    if (categorySwipeInitialized) return;
    categorySwipeInitialized = true;

    document.addEventListener('touchstart', (event) => {
        const card = event.target.closest('.category-card--swipe');
        if (!card) {
            if (!event.target.closest('.category-swipe-action')) {
                closeCategorySwipeItem();
            }
            categorySwipeState = null;
            return;
        }

        const touch = event.touches && event.touches[0];
        if (!touch) return;
        const item = card.closest('.category-swipe-item');
        if (!item) return;

        if (activeCategorySwipeItem && activeCategorySwipeItem !== item) {
            closeCategorySwipeItem(activeCategorySwipeItem);
        }

        const opened = item.classList.contains('swipe-open');
        categorySwipeState = {
            item,
            startX: touch.clientX,
            startY: touch.clientY,
            startOffset: opened ? -CATEGORY_SWIPE_MAX : 0,
            offset: opened ? -CATEGORY_SWIPE_MAX : 0,
            axis: null,
            dragging: false
        };
    }, { passive: true });

    document.addEventListener('touchmove', (event) => {
        if (!categorySwipeState) return;
        const touch = event.touches && event.touches[0];
        if (!touch) return;

        const dx = touch.clientX - categorySwipeState.startX;
        const dy = touch.clientY - categorySwipeState.startY;

        if (!categorySwipeState.axis) {
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            categorySwipeState.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }

        if (categorySwipeState.axis !== 'x') {
            categorySwipeState.item.classList.remove('swiping');
            categorySwipeState = null;
            return;
        }

        if (!categorySwipeState.dragging && Math.abs(dx) < 8) {
            return;
        }

        event.preventDefault();
        categorySwipeState.dragging = true;
        if (!categorySwipeState.item.classList.contains('swiping')) {
            categorySwipeState.item.classList.add('swiping');
        }
        const offset = categorySwipeState.startOffset + dx;
        categorySwipeState.offset = Math.max(-CATEGORY_SWIPE_MAX, Math.min(0, offset));
        setCategorySwipeOffset(categorySwipeState.item, categorySwipeState.offset);
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!categorySwipeState) return;
        const { item, dragging, offset } = categorySwipeState;
        item.classList.remove('swiping');

        if (!dragging) {
            categorySwipeState = null;
            return;
        }

        if (offset <= -CATEGORY_SWIPE_THRESHOLD) {
            openCategorySwipeItem(item);
        } else {
            closeCategorySwipeItem(item);
        }
        categorySwipeSuppressClickUntil = Date.now() + 220;
        categorySwipeState = null;
    }, { passive: true });

    document.addEventListener('click', (event) => {
        const swipeTarget = event.target.closest('.category-swipe-item');
        if (!swipeTarget && !event.target.closest('.category-swipe-action')) {
            closeCategorySwipeItem();
        }
    });
}

function updateDebtsDisplay() {
    const section = document.getElementById('debts-section');
    const container = document.getElementById('debts-categories');
    if (!section || !container) return;
    
    if (!debtsEnabled) {
        section.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    
    section.style.display = 'block';
    injectDebtCategory();

    const symbol = currencySymbols[currentCurrency] || '₽';
    const color = '#AF52DE';
    const icon = '💸';
    let html = '';
    
    const activeDebts = debtsData.filter(debt => !debt.archived);
    const archivedDebts = debtsData.filter(debt => debt.archived);
    activeDebts.forEach(debt => {
        const paid = Number(debt.paid_amount) || 0;
        const target = Number(debt.target_amount) || 0;
        const progress = target > 0 ? Math.min((paid / target) * 100, 100) : 0;
        const progressText = `${progress.toFixed(0)}%`;
        const formattedPaid = formatCurrency(paid);
        const formattedTarget = formatCurrency(target);
        const note = debt.note ? ` • ${debt.note}` : '';
        const canArchive = progress >= 100;
        
        html += `
            <div class="category-card debt-card" onclick="openDebtPayment(${debt.id})">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${debt.name}</span>
                    </div>
                    <div class="category-stats">${t('Погашено')}: ${formattedPaid} / ${formattedTarget} ${symbol}${note}</div>
                    <div class="debt-progress">
                        <div class="debt-progress-fill" style="width: ${progress}%; background: ${color};"></div>
                    </div>
                    <div class="debt-actions goal-actions">
                        <button class="debt-action-btn goal-action-btn" onclick="event.stopPropagation(); openDebtModal(${debt.id})">${t('Изменить')}</button>
                        ${canArchive ? `<button class="debt-action-btn goal-action-btn goal-action-btn--archive" onclick="event.stopPropagation(); archiveDebt(${debt.id}, true)">${t('Архивировать')}</button>` : ''}
                    </div>
                </div>
                <div class="category-amount" style="color: ${color};">
                    ${progressText}
                </div>
            </div>
        `;
    });
    
    html += `
        <button class="add-category-btn" onclick="openDebtModal()">
            <span>+</span>
            <span>${t('Создать долг')}</span>
        </button>
    `;

    if (archivedDebts.length > 0) {
        html += `
            <div class="debt-archive-block">
                <div class="debt-archive-title">${t('Архив')}</div>
                ${archivedDebts.map(debt => {
                    const paid = Number(debt.paid_amount) || 0;
                    const target = Number(debt.target_amount) || 0;
                    const progress = target > 0 ? Math.min((paid / target) * 100, 100) : 0;
                    const progressText = `${progress.toFixed(0)}%`;
                    const formattedPaid = formatCurrency(paid);
                    const formattedTarget = formatCurrency(target);
                    const note = debt.note ? ` • ${debt.note}` : '';
                    return `
                        <div class="category-card debt-card archived">
                            <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                                ${icon}
                            </div>
                        <div class="category-info">
                            <div class="category-name">
                                <span class="category-name-text">${debt.name}</span>
                            </div>
                            <div class="category-stats">${t('Погашено')}: ${formattedPaid} / ${formattedTarget} ${symbol}${note}</div>
                            <div class="debt-progress">
                                <div class="debt-progress-fill" style="width: ${progress}%; background: ${color};"></div>
                            </div>
                            <div class="debt-actions goal-actions">
                                <button class="debt-action-btn goal-action-btn" onclick="archiveDebt(${debt.id}, false)">${t('Вернуть')}</button>
                            </div>
                        </div>
                        <div class="category-amount" style="color: ${color};">
                            ${progressText}
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateDebtsUI(syncToggle = true) {
    const section = document.getElementById('debts-section');
    const tab = document.querySelector('.modal-tab.debt');
    const toggle = document.getElementById('debts-toggle');
    const hasDebt = debtsData.some(debt => !debt.archived);
    const shouldShowTab = (debtsEnabled && hasDebt) || currentTransactionType === 'debt';
    
    if (section) section.style.display = debtsEnabled ? 'block' : 'none';
    if (tab) tab.style.display = shouldShowTab ? 'inline-flex' : 'none';
    if (toggle) toggle.checked = debtsEnabled;
    
    if (!debtsEnabled && currentTransactionType === 'debt' && !editingTransactionId) {
        currentTransactionType = 'income';
        const incomeTab = document.querySelector('.modal-tab.income');
        const modal = document.getElementById('add-transaction-modal');
        if (modal && modal.classList.contains('active') && incomeTab) {
            incomeTab.click();
        }
    }
}

function injectDebtCategory() {
    if (!categoriesData.expense) categoriesData.expense = [];
    const hasDebt = debtsEnabled && debtsData.some(debt => !debt.archived);
    const existingIndex = categoriesData.expense.findIndex(cat => cat.name === 'Долги');
    if (hasDebt && existingIndex === -1) {
        categoriesData.expense.unshift({ name: 'Долги', icon: '💸', color: '#AF52DE' });
    }
    if (!hasDebt && existingIndex !== -1) {
        categoriesData.expense.splice(existingIndex, 1);
    }
}

async function setDebtsEnabled(enabled) {
    const nextValue = !!enabled;
    const prevValue = debtsEnabled;
    debtsEnabled = nextValue;
    updateDebtsUI(true);
    updateDebtsDisplay();
    updatePanelCategories();
    if (!currentUser) return;
    try {
        const response = await fetch('/api/settings/debts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                enabled: nextValue
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        debtsEnabled = !!data.debts_enabled;
        updateDebtsUI(true);
        updateDebtsDisplay();
        updatePanelCategories();
    } catch (error) {
        debtsEnabled = prevValue;
        updateDebtsUI(true);
        updateDebtsDisplay();
        updatePanelCategories();
        showNotification('Ошибка сохранения', 'error');
    }
}

function updatePanelGoals() {
    const container = document.getElementById('panel-goals');
    if (!container) return;

    const activeGoals = (goalsData || []).filter(goal => !goal.archived);
    const archivedGoals = (goalsData || []).filter(goal => goal.archived);
    const symbol = currencySymbols[currentCurrency] || '₽';

    let html = '';
    
    activeGoals.forEach(goal => {
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
        const color = goal.color || '#FF9500';
        const icon = goal.icon || '🎯';
        
        html += `
            <div class="category-card debt-card" onclick="addToGoal(${goal.id})">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${goal.name}</span>
                    </div>
                    <div class="category-stats">${t('Цель')}: ${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                    <div class="debt-progress">
                        <div class="debt-progress-fill" style="width: ${progress}%; background: ${color};"></div>
                    </div>
                    <div class="debt-actions goal-actions">
                        <button class="debt-action-btn goal-action-btn" onclick="event.stopPropagation(); showAddGoalModal(${goal.id})">${t('Изменить')}</button>
                        <button class="debt-action-btn goal-action-btn goal-action-btn--archive" onclick="event.stopPropagation(); archiveGoal(${goal.id}, true)">${t('Архивировать')}</button>
                    </div>
                </div>
                <div class="category-amount" style="color: ${color};">
                    ${progress.toFixed(0)}%
                </div>
            </div>
        `;
    });
    
    html += `
        <button class="add-category-btn" onclick="showAddGoalModal()">
            <span>+</span>
            <span>${t('Создать цель')}</span>
        </button>
    `;

    if (archivedGoals.length > 0) {
        html += `
            <div class="goal-archive-block">
                <div class="goal-archive-title">${t('Архив')}</div>
                ${archivedGoals.map(goal => {
                    const currentAmount = parseFloat(goal.current_amount) || 0;
                    const targetAmount = parseFloat(goal.target_amount) || 0;
                    const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
                    const color = goal.color || '#FF9500';
                    const icon = goal.icon || '🎯';
                    return `
                        <div class="category-card debt-card archived">
                            <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                                ${icon}
                            </div>
                            <div class="category-info">
                                <div class="category-name">
                                    <span class="category-name-text">${goal.name}</span>
                                </div>
                                <div class="category-stats">${t('Цель')}: ${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                                <div class="debt-progress">
                                    <div class="debt-progress-fill" style="width: ${progress}%; background: ${color};"></div>
                                </div>
                                <div class="debt-actions">
                                    <button class="debt-action-btn" onclick="archiveGoal(${goal.id}, false)">${t('Вернуть')}</button>
                                </div>
                            </div>
                            <div class="category-amount" style="color: ${color};">
                                ${progress.toFixed(0)}%
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

function updateWalletsDisplay() {
    const container = document.getElementById('wallet-categories');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let html = '';
    
    walletsData.forEach(wallet => {
        const balance = wallet.balance || 0;
        const isDefault = wallet.is_default;
        const icon = wallet.icon || '💳';
        const color = isDefault ? 'var(--ios-accent)' : 'var(--ios-text-secondary)';
        
        html += `
            <button class="category-card" onclick="showWalletTransactions('${wallet.name}')">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${t(wallet.name)}</span>
                    </div>
                </div>
                <div class="category-amount">
                    ${formatCurrency(balance)} ${symbol}
                </div>
            </button>
        `;
    });

    const savingsTotal = getSavingsAmount();
    const hasSavingsWallet = walletsData.some(wallet => wallet.name === 'Накопления');
    if (savingsTotal > 0 && !hasSavingsWallet) {
        const savingsColor = 'var(--pastel-yellow)';
        html += `
            <button class="category-card">
                <div class="category-icon" style="background: ${savingsColor}20; color: ${savingsColor}; box-shadow: 0 0 15px ${savingsColor}80;">
                    💰
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${t('Накопления')}</span>
                    </div>
                </div>
                <div class="category-amount">
                    ${formatCurrency(savingsTotal)} ${symbol}
                </div>
            </button>
        `;
    }
    
    html += `
        <button class="add-category-btn" onclick="showAddWalletModal()">
            <span>+</span>
            <span>${t('Добавить кошелёк')}</span>
        </button>
    `;
    
    container.innerHTML = html;
}

const LONG_TRANSACTION_HINT_LENGTH = 28;

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderTransactionDescription(description) {
    const rawText = typeof description === 'string' ? description.trim() : '';
    const text = rawText || t('Без описания');
    const safeText = escapeHtml(text);
    const hintClass = text.length > LONG_TRANSACTION_HINT_LENGTH ? ' transaction-title-btn--long' : '';
    const encodedText = encodeURIComponent(text).replace(/'/g, '%27');
    return `<button class="transaction-title transaction-title-btn${hintClass}" title="${safeText}" onclick="openTextModalFromEncoded('${encodedText}')">${safeText}</button>`;
}

function updateRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions-list');
    if (!container) return;
    const panelTransactions = Array.isArray(transactions) ? transactions.slice(0, PANEL_RECENT_LIMIT) : [];
    
    if (panelTransactions.length === 0) {
        container.innerHTML = `
            <div class="transaction-item" style="justify-content: center; padding: 30px;">
                <div style="text-align: center; color: var(--ios-text-secondary);">
                    <div style="font-size: 24px; margin-bottom: 8px;">📭</div>
                    <div>${t('Нет операций')}</div>
                </div>
            </div>
        `;
        return;
    }
    
    let html = '';
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    panelTransactions.forEach(trans => {
        const isSavings = isSavingsCategoryName(trans.category);
        const isDebt = trans.category === 'Долги';
        const isIncome = isSavings ? true : trans.type === 'income';
        const amountClass = isSavings ? 'amount-savings' : (isIncome ? 'amount-positive' : 'amount-negative');
        const amountSign = isSavings ? '+' : (isIncome ? '+' : '−');
        const icon = isDebt ? '💸' : (isSavings ? '💰' : (isIncome ? '📈' : '📉'));
        const iconClass = isDebt ? 'debt' : (isSavings ? 'savings' : (isIncome ? 'income' : 'expense'));
        const descriptionMarkup = renderTransactionDescription(trans.description);
        const categoryLabel = t(trans.category);
        html += `
            <div class="transaction-item">
                <div class="transaction-icon ${iconClass}">${icon}</div>
                <div class="transaction-info">
                    ${descriptionMarkup}
                    <div class="transaction-category-line">
                        <div class="transaction-category">${categoryLabel}</div>
                    </div>
                </div>
                <div class="transaction-right">
                    <div class="transaction-amount ${amountClass}">
                        ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                    </div>
                    <div class="transaction-actions">
                        <button class="debt-action-btn panel-recent-edit-btn" onclick="openEditTransactionById(${trans.id})">${t('Изменить')}</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function findTransactionById(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    const fromMonth = currentMonthTransactions.find(t => Number(t.id) === numericId);
    if (fromMonth) return fromMonth;
    const fromRecent = allTransactions.find(t => Number(t.id) === numericId);
    return fromRecent || null;
}

function formatDateForDateTimeInput(value) {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        const hours = String(value.getHours()).padStart(2, '0');
        const minutes = String(value.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    const rawValue = String(value).trim();
    const directMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (directMatch) {
        return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}T${directMatch[4]}:${directMatch[5]}`;
    }

    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatDateForDateTimeInput(parsed);
}

function openEditTransactionById(id) {
    const transaction = findTransactionById(id);
    if (!transaction) {
        showNotification('Операция не найдена', 'error');
        return;
    }
    openEditTransaction(transaction);
}

function openEditTransaction(transaction) {
    if (!transaction) return;
    editingTransactionId = transaction.id;
    const isDebt = transaction.category === 'Долги';
    currentTransactionType = isDebt ? 'debt' : (isSavingsCategoryName(transaction.category) ? 'savings' : transaction.type);
    currentSavingsDestination = 'piggybank';
    selectedGoalId = null;
    currentDebtId = isDebt ? (transaction.debt_id || null) : null;
    showAddTransactionModal(transaction.category);

    const amountInput = document.getElementById('transaction-amount');
    const categorySelect = document.getElementById('transaction-category');
    const walletSelect = document.getElementById('transaction-wallet');
    const descriptionInput = document.getElementById('transaction-description');
    const dateTimeInput = document.getElementById('transaction-date-time');

    if (amountInput) amountInput.value = transaction.amount;
    if (descriptionInput) descriptionInput.value = transaction.description || '';
    if (categorySelect) categorySelect.value = transaction.category;
    if (walletSelect) walletSelect.value = transaction.wallet;
    if (dateTimeInput) {
        dateTimeInput.value = formatDateForDateTimeInput(transaction.date) || formatDateForDateTimeInput(new Date());
    }

    const title = document.getElementById('transaction-modal-title');
    if (title) title.textContent = t('Изменить операцию');
}

function resetTransactionEditing() {
    editingTransactionId = null;
}

async function deleteTransactionById(id) {
    if (!currentUser) return false;
    const transaction = findTransactionById(id);
    if (!transaction) {
        showNotification('Операция не найдена', 'error');
        return false;
    }
    if (!confirm(t('Удалить операцию?'))) return false;
    try {
        const response = await fetch('/api/transaction/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                transaction_id: id
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        categoryStats = data.category_stats || categoryStats;
        if (data.wallets) {
            data.wallets.forEach(walletUpdate => {
                const wallet = walletsData.find(w => w.name === walletUpdate.name);
                if (wallet) wallet.balance = walletUpdate.balance;
            });
        }
        if (data.recent_transactions) {
            allTransactions = data.recent_transactions;
            updateRecentTransactions(allTransactions);
        }
        updateBalanceDisplay(data.summary);
        updateSectionTotals();

        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'history') {
            await loadMonthTransactions();
        } else if (currentPage === 'report') {
            await loadReportData();
        }

        showNotification('Операция удалена', 'success');
        return true;
    } catch (error) {
        console.error('❌ Ошибка удаления транзакции:', error);
        showNotification('Ошибка удаления', 'error');
        return false;
    }
}

async function deleteEditingTransaction() {
    if (!editingTransactionId) return;
    const deleted = await deleteTransactionById(editingTransactionId);
    if (deleted) {
        closeModal('add-transaction-modal');
    }
}

function showAddTransactionForCategory(type, category) {
    if (type === 'debt' && debtsData.length === 0) {
        openDebtModal();
        return;
    }
    if (type === 'expense' && category === 'Долги') {
        const activeDebts = debtsData.filter(debt => !debt.archived);
        if (!activeDebts.length) {
            openDebtModal();
            return;
        }
        openDebtPayment(activeDebts[0].id);
        return;
    }
    currentTransactionType = type;
    showAddTransactionModal(category);
}

function openDebtPayment(debtId) {
    if (!debtsData.some(d => d.id === debtId && !d.archived)) return;
    currentTransactionType = 'debt';
    currentDebtId = debtId;
    showAddTransactionModal('Долги');
}

function showWalletTransactions(walletName) {
    switchPage('history');
    showNotification(`${t('Показываем операции кошелька')}: ${t(walletName)}`, 'info');
}

// ==================== //
// ВКЛАДКА ИСТОРИЯ //
// ==================== //

function loadHistoryPage() {
    updateMonthDisplay();
    loadMonthTransactions();
    setupHistoryControls();
}

function updateMonthDisplay() {
    const monthElement = document.getElementById('current-month');
    if (monthElement) {
        const month = getMonthName(currentHistoryMonth.getMonth());
        const year = currentHistoryMonth.getFullYear();
        monthElement.textContent = `${month} ${year}`;
    }
}

async function loadMonthTransactions() {
    if (!currentUser) return;
    
    try {
        const month = currentHistoryMonth.getMonth() + 1;
        const year = currentHistoryMonth.getFullYear();
        
        const response = await fetch(`/api/transactions/${currentUser.id}?month=${month}&year=${year}&limit=100`);
        const transactions = await response.json();
        currentMonthTransactions = Array.isArray(transactions) ? transactions : [];
        
        displayMonthTransactions(currentMonthTransactions);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки транзакций:', error);
        showEmptyHistoryState();
    }
}

function displayMonthTransactions(transactions) {
    const container = document.getElementById('month-transactions');
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    if (!transactions || transactions.length === 0) {
        showEmptyHistoryState();
        return;
    }
    
    let filteredTransactions = transactions;
    if (currentFilter === 'income') {
        filteredTransactions = transactions.filter(t => t.type === 'income');
    } else if (currentFilter === 'expense') {
        filteredTransactions = transactions.filter(t => t.type === 'expense');
    } else if (currentFilter === 'savings') {
        filteredTransactions = transactions.filter(t => isSavingsCategoryName(t.category));
    }
    
    let html = '';
    
    filteredTransactions.forEach(trans => {
        const isSavings = isSavingsCategoryName(trans.category);
        const isDebt = trans.category === 'Долги';
        const isIncome = isSavings ? true : trans.type === 'income';
        const amountClass = isSavings ? 'amount-savings' : (isIncome ? 'amount-positive' : 'amount-negative');
        const amountSign = isSavings ? '+' : (isIncome ? '+' : '−');
        const icon = isDebt ? '💸' : (isSavings ? '💰' : (isIncome ? '📈' : '📉'));
        const iconClass = isDebt ? 'debt' : (isSavings ? 'savings' : (isIncome ? 'income' : 'expense'));
        const dateValue = parseTransactionDate(trans.date);
        const date = Number.isNaN(dateValue.getTime())
            ? ''
            : dateValue.toLocaleDateString(getLocale(), {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        
        const categoryLabel = t(trans.category);
        const descriptionMarkup = renderTransactionDescription(trans.description);
        html += `
            <div class="transaction-item">
                <div class="transaction-icon ${iconClass}">${icon}</div>
                <div class="transaction-info">
                    ${descriptionMarkup}
                    <div class="transaction-category-line">
                        <div class="transaction-category">${categoryLabel}</div>
                    </div>
                    <div class="transaction-details">${date} • ${t(trans.wallet)}</div>
                </div>
                <div class="transaction-right">
                    <div class="transaction-amount ${amountClass}">
                        ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                    </div>
                    <div class="transaction-actions">
                        <button class="debt-action-btn" onclick="openEditTransactionById(${trans.id})">${t('Изменить')}</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showEmptyHistoryState() {
    const container = document.getElementById('month-transactions');
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--ios-text-tertiary);">
            <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
            <div style="font-size: 17px; font-weight: 600; margin-bottom: 8px; color: var(--ios-text-secondary);">${t('За этот период данных нет')}</div>
            <div style="font-size: 15px;">${t('Добавляйте операции в разделе «Панель»')}</div>
        </div>
    `;
}

function setupHistoryControls() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const monthDisplay = document.getElementById('current-month');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() - 1);
            updateMonthDisplay();
            loadMonthTransactions();
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() + 1);
            updateMonthDisplay();
            loadMonthTransactions();
        };
    }
    
    if (monthDisplay) {
        monthDisplay.onclick = showCalendar;
    }
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadMonthTransactions();
        };
    });
}

// ==================== //
// ВКЛАДКА ОТЧЁТ //
// ==================== //

function loadReportPage() {
    setupReportTabs();
    setupReportChartSwipes();
    setupReportChartArrows();
    loadGoals();
    setupBalancePeriods();
    const activeTab = document.querySelector('.report-tab.active')?.dataset.tab || 'overview';
    requestAnimationFrame(() => updateReportTab(activeTab));
}

function loadInvestPage() {
    setupInvestToggles();
    loadMarketSection('crypto');
    loadMarketSection('stocks');
}

function setupInvestToggles() {
    document.querySelectorAll('.invest-toggle').forEach(toggle => {
        const market = toggle.dataset.market;
        if (!market) return;
        toggle.querySelectorAll('.invest-toggle-btn').forEach(btn => {
            btn.onclick = () => {
                toggle.querySelectorAll('.invest-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                marketState[market] = btn.dataset.kind || 'gainers';
                loadMarketSection(market);
            };
        });
    });
}

async function loadMarketSection(market) {
    const kind = marketState[market] || 'gainers';
    const gridId = market === 'crypto' ? 'crypto-grid' : 'stocks-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const cachedItems = marketCache[market]?.[kind];
    if (cachedItems && cachedItems.length) {
        renderMarketGrid(grid, cachedItems, market);
        return;
    }
    const persistedItems = readMarketCache(market, kind);
    if (persistedItems && persistedItems.length) {
        renderMarketGrid(grid, persistedItems, market);
    }
    if (!persistedItems || !persistedItems.length) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">${t('Загрузка...')}</div>`;
    }
    try {
        const res = await fetch(`/api/market_movers/${market}?type=${kind}`);
        const data = await res.json();
        if (data.error) {
            if (cachedItems && cachedItems.length) {
                renderMarketGrid(grid, cachedItems, market);
                return;
            }
            if (persistedItems && persistedItems.length) {
                renderMarketGrid(grid, persistedItems, market);
                return;
            }
            grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">${data.error}</div>`;
            return;
        }
        if (!marketCache[market]) marketCache[market] = {};
        marketCache[market][kind] = data.items || [];
        writeMarketCache(market, kind, data.items || []);
        renderMarketGrid(grid, data.items || [], market);
    } catch (e) {
        if (cachedItems && cachedItems.length) {
            renderMarketGrid(grid, cachedItems, market);
            return;
        }
        if (persistedItems && persistedItems.length) {
            renderMarketGrid(grid, persistedItems, market);
            return;
        }
        grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">${t('Нет данных')}</div>`;
        console.error('❌ Ошибка загрузки рынка:', e);
    }
}

function renderMarketGrid(container, items, market) {
    if (!items.length) {
        container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">${t('Нет данных')}</div>`;
        return;
    }
    container.innerHTML = items.map(item => {
        const change = Number(item.change) || 0;
        const changeClass = change >= 0 ? 'up' : 'down';
        const primaryLogo = item.image || item.logo || item.logo_alt || '';
        const fallbackLogo = item.image ? '' : (item.logo_alt && item.logo_alt !== primaryLogo ? item.logo_alt : '');
        const symbol = (item.symbol || '').toUpperCase();
        return `
            <button class="invest-card"
                data-market="${market}"
                data-id="${item.id || ''}"
                data-symbol="${item.symbol || ''}"
                data-name="${(item.name || '').replace(/"/g, '&quot;')}"
                data-change="${change}"
                data-price="${item.price || ''}">
                <div class="invest-logo">
                    ${primaryLogo ? `<img class="invest-logo-img" src="${primaryLogo}" alt="${item.symbol || ''}"${fallbackLogo ? ` data-alt-src="${fallbackLogo}"` : ''}>` : ''}
                    <div class="invest-logo-text">${symbol.slice(0, 3)}</div>
                </div>
                <div class="invest-symbol">${symbol}</div>
                <div class="invest-change ${changeClass}">${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%</div>
            </button>
        `;
    }).join('');
    container.querySelectorAll('.invest-logo-img').forEach(img => {
        img.onerror = () => {
            const alt = img.dataset.altSrc;
            if (alt) {
                img.src = alt;
                img.dataset.altSrc = '';
                return;
            }
            const wrap = img.closest('.invest-logo');
            if (wrap) wrap.classList.add('logo-fallback');
            img.remove();
        };
    });
    container.querySelectorAll('.invest-card').forEach(card => {
        card.onclick = () => {
            openMarketModal({
                id: card.dataset.id || '',
                symbol: card.dataset.symbol || '',
                name: card.dataset.name || '',
                change: parseFloat(card.dataset.change || '0') || 0,
                price: card.dataset.price || '',
                market: card.dataset.market || ''
            });
        };
    });
}

function openInvestAll() {
    showNotification('Скоро будет полный список', 'info');
}

function openAddToHome() {
    const modal = document.getElementById('add-to-home-modal');
    const note = document.getElementById('add-home-note');
    const iosStep = document.getElementById('add-home-ios');
    const androidStep = document.getElementById('add-home-android');
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iP(hone|ad|od)/i.test(ua);
    if (iosStep) iosStep.style.display = isAndroid ? 'none' : 'block';
    if (androidStep) androidStep.style.display = isIOS ? 'none' : 'block';
    if (note) {
        if (isIOS) {
            note.textContent = t('На iOS добавление доступно только через Safari. Внутри Telegram меню недоступно.');
        } else if (isAndroid) {
            note.textContent = t('Добавление доступно через браузер. Внутри Telegram меню недоступно.');
        } else {
            note.textContent = t('Добавление работает через браузер. Внутри Telegram меню недоступно.');
        }
    }
    if (modal) modal.classList.add('active');
    updateBodyModalState();
}

function closeAddToHome() {
    const modal = document.getElementById('add-to-home-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
}

function openAddToHomeLink() {
    const url = window.location.href;
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openLink) {
        Telegram.WebApp.openLink(url);
        return;
    }
    window.open(url, '_blank');
}

function openSharedWallet() {
    const modal = document.getElementById('shared-wallet-modal');
    if (modal) modal.classList.add('active');
    updateBodyModalState();
    loadSharedWalletStatus();
}

function openSubscriptionModal() {
    const modal = document.getElementById('subscription-modal');
    if (modal) modal.classList.add('active');
    updateBodyModalState();
    loadSubscriptionState();
    updateSubscriptionUI();
    refreshSubscriptionInfo();
    startSubscriptionPolling();
}

function openSupportChat() {
    const url = 'https://t.me/uppersupp';
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) {
        try {
            Telegram.WebApp.openTelegramLink(url);
            return;
        } catch (e) {}
    }
    window.open(url, '_blank');
}

function getSubscriptionPrice(months) {
    return subscriptionPrices[months] || subscriptionPrices[1] || 2;
}

function updateSubscriptionPrice() {
    const priceEl = document.getElementById('subscription-price');
    const durationSelect = document.getElementById('subscription-duration');
    if (durationSelect && subscriptionPrices[subscriptionDuration]) {
        durationSelect.value = String(subscriptionDuration);
    }
    const priceValue = getSubscriptionPrice(subscriptionDuration);
    if (priceEl) priceEl.textContent = `$${priceValue}`;
}

function setSubscriptionDuration(value) {
    const months = parseInt(value, 10);
    if (!subscriptionPrices[months]) return;
    subscriptionDuration = months;
    try { localStorage.setItem('subscription_duration', String(months)); } catch {}
    updateSubscriptionPrice();
}

function formatSubscriptionDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(getLocale());
}

function updateSubscriptionPeriod() {
    const el = document.getElementById('subscription-period');
    if (!el) return;
    if (subscriptionActive && subscriptionStart && subscriptionEnd) {
        const start = formatSubscriptionDate(subscriptionStart);
        const end = formatSubscriptionDate(subscriptionEnd);
        if (start && end) {
            el.innerHTML = `${t('С')} <span class="subscription-date">${start}</span> ${t('по')} <span class="subscription-date">${end}</span>`;
            return;
        }
    }
    if (subscriptionActive) {
        el.textContent = t('Подписка активна');
    } else {
        el.textContent = t('Не активна');
    }
}

function activateSubscriptionState(data = {}, closeModalOnSuccess = false) {
    subscriptionActive = true;
    subscriptionStart = data.subscription_start || subscriptionStart;
    subscriptionEnd = data.subscription_end || subscriptionEnd;
    subscriptionPayment = {
        invoiceId: null,
        status: '',
        asset: 'USDT',
        amount: '',
        currency: '',
        invoiceUrl: '',
        miniAppUrl: '',
        webAppUrl: '',
        botUrl: '',
        months: subscriptionDuration
    };
    try { localStorage.removeItem('subscription_payment'); } catch {}
    stopSubscriptionPolling();
    updateSubscriptionUI();
    if (closeModalOnSuccess) {
        closeSubscriptionModal();
    }
    refreshSubscriptionInfo();
}

async function refreshSubscriptionInfo() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/subscription/info?user_id=${currentUser.id}`);
        const data = await res.json();
        if (data.error) return;
        subscriptionActive = !!data.active;
        subscriptionStart = data.subscription_start || null;
        subscriptionEnd = data.subscription_end || null;
        updateSubscriptionUI();
    } catch {}
}

function closeSubscriptionModal() {
    const modal = document.getElementById('subscription-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
    stopSubscriptionPolling();
}

function copySubscriptionAddress() {
    if (!subscriptionPayment.address) return;
    navigator.clipboard?.writeText(subscriptionPayment.address).then(() => {
        showNotification('Адрес скопирован', 'success');
    });
}

function copySubscriptionAmount() {
    if (!subscriptionPayment.amount) return;
    navigator.clipboard?.writeText(subscriptionPayment.amount).then(() => {
        showNotification('Сумма скопирована', 'success');
    });
}

function openSubscriptionInvoice() {
    const url = getSubscriptionInvoiceUrl();
    if (!url) return;
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openLink) {
        Telegram.WebApp.openLink(url);
        return;
    }
    window.open(url, '_blank');
}

function loadSubscriptionState() {
    try {
        const raw = localStorage.getItem('subscription_payment');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        subscriptionPayment = { ...subscriptionPayment, ...parsed };
        const url = (subscriptionPayment.invoiceUrl || '') +
            (subscriptionPayment.webAppUrl || '') +
            (subscriptionPayment.miniAppUrl || '') +
            (subscriptionPayment.botUrl || '');
        const badProvider = url.includes('lecryptio') || url.includes('cryptocloud');
        const providerMismatch = parsed && parsed.provider && parsed.provider !== subscriptionProvider;
        if (badProvider || providerMismatch) {
            subscriptionPayment = { invoiceId: null, status: '', asset: 'USDT', amount: '', currency: '', invoiceUrl: '', miniAppUrl: '', webAppUrl: '', botUrl: '', months: subscriptionDuration };
            localStorage.removeItem('subscription_payment');
        }
        if (parsed && parsed.asset) {
            subscriptionAsset = 'USDT';
        }
        if (parsed && parsed.months) {
            const parsedMonths = parseInt(parsed.months, 10);
            if (subscriptionPrices[parsedMonths]) {
                subscriptionDuration = parsedMonths;
            }
        }
    } catch {}
    try {
        const savedAsset = localStorage.getItem('subscription_asset');
        if (savedAsset) {
            subscriptionAsset = 'USDT';
        }
    } catch {}
    try {
        const savedDuration = localStorage.getItem('subscription_duration');
        if (savedDuration) {
            const parsedDuration = parseInt(savedDuration, 10);
            if (subscriptionPrices[parsedDuration]) {
                subscriptionDuration = parsedDuration;
            }
        }
    } catch {}
}

function saveSubscriptionState() {
    try {
        localStorage.setItem('subscription_payment', JSON.stringify({ ...subscriptionPayment, provider: subscriptionProvider }));
    } catch {}
}

function updateSubscriptionUI() {
    const statusEl = document.getElementById('subscription-status');
    const addressWrap = document.getElementById('subscription-address-wrap');
    const amountWrap = document.getElementById('subscription-amount-wrap');
    const addressEl = document.getElementById('subscription-address');
    const amountEl = document.getElementById('subscription-amount');
    const createBtn = document.getElementById('subscription-create');
    const copyAddrBtn = document.getElementById('subscription-copy-address');
    const copyAmtBtn = document.getElementById('subscription-copy-amount');
    const openInvoiceBtn = document.getElementById('subscription-open-invoice');
    const checkBtn = document.getElementById('subscription-check');
    const promoBtn = document.getElementById('subscription-promo-apply');
    const adminBlock = document.getElementById('subscription-admin');
    const durationSelect = document.getElementById('subscription-duration');
    updateSubscriptionPrice();
    if (subscriptionActive) {
        if (statusEl) statusEl.textContent = t('Подписка активна.');
        if (createBtn) createBtn.style.display = 'none';
        if (addressWrap) addressWrap.style.display = 'none';
        if (amountWrap) amountWrap.style.display = 'none';
        if (copyAddrBtn) copyAddrBtn.style.display = 'none';
        if (copyAmtBtn) copyAmtBtn.style.display = 'none';
        if (openInvoiceBtn) openInvoiceBtn.style.display = 'none';
        if (checkBtn) checkBtn.style.display = 'none';
        if (adminBlock) adminBlock.style.display = isAdminUser() ? 'block' : 'none';
        if (durationSelect) durationSelect.disabled = true;
        updateSubscriptionPeriod();
        return;
    }
    if (statusEl) statusEl.textContent = formatSubscriptionStatus(subscriptionPayment.status) || t('Создайте оплату');
    if (addressEl) addressEl.textContent = subscriptionPayment.address || '';
    const displayAsset = subscriptionPayment.asset || subscriptionPayment.currency || subscriptionAsset || 'USDT';
    if (amountEl) amountEl.textContent = subscriptionPayment.amount ? `${subscriptionPayment.amount} ${displayAsset}` : '';
    const hasOpenUrl = !!(subscriptionPayment.invoiceUrl || subscriptionPayment.miniAppUrl || subscriptionPayment.webAppUrl || subscriptionPayment.botUrl);
    const hasInvoice = !!subscriptionPayment.invoiceId || hasOpenUrl;
    if (durationSelect) durationSelect.disabled = hasInvoice;
    if (addressWrap) addressWrap.style.display = subscriptionPayment.address ? 'block' : 'none';
    if (amountWrap) amountWrap.style.display = subscriptionPayment.amount ? 'block' : 'none';
    if (createBtn) createBtn.style.display = hasInvoice ? 'none' : 'flex';
    if (copyAddrBtn) copyAddrBtn.style.display = subscriptionPayment.address ? 'flex' : 'none';
    if (copyAmtBtn) copyAmtBtn.style.display = subscriptionPayment.amount ? 'flex' : 'none';
    if (openInvoiceBtn) openInvoiceBtn.style.display = hasOpenUrl ? 'flex' : 'none';
    if (checkBtn) checkBtn.style.display = hasInvoice ? 'flex' : 'none';
    if (promoBtn) promoBtn.disabled = subscriptionActive;
    if (adminBlock) adminBlock.style.display = isAdminUser() ? 'block' : 'none';
    const userNameEl = document.getElementById('subscription-user-name');
    if (userNameEl) userNameEl.textContent = currentUser?.username ? '@' + currentUser.username : '—';

    subscriptionAsset = 'USDT';
    updateSubscriptionPeriod();
}

async function redeemPromoCode() {
    if (!currentUser) return;
    if (subscriptionActive) {
        showNotification('Подписка уже активна', 'info');
        return;
    }
    const input = document.getElementById('subscription-promo-code');
    const code = (input?.value || '').trim();
    if (!code) {
        showNotification('Введите промокод', 'error');
        return;
    }
    try {
        const res = await fetch('/api/subscription/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, code })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (input) input.value = '';
        const promoUnit = data.promo_unit || (data.days ? 'days' : 'months');
        const promoValue = Number(data.promo_value ?? data.days ?? data.months ?? 0);
        const promoSuffix = promoUnit === 'days' ? t('дн.') : t('мес.');
        showNotification(`${t('Промокод активирован на')} ${promoValue} ${promoSuffix}`, 'success');
        activateSubscriptionState(data, true);
    } catch (e) {
        showNotification(e.message || 'Не удалось активировать промокод', 'error');
    }
}

function formatSubscriptionStatus(status) {
    const map = {
        active: 'Ожидает оплаты',
        paid: 'Оплата завершена',
        expired: 'Счёт истёк',
        canceled: 'Платёж отменён'
    };
    const label = map[status] || status;
    return t(label);
}

function getSubscriptionInvoiceUrl() {
    if (window.Telegram && Telegram.WebApp) {
        return subscriptionPayment.miniAppUrl || subscriptionPayment.webAppUrl || subscriptionPayment.botUrl || subscriptionPayment.invoiceUrl;
    }
    return subscriptionPayment.webAppUrl || subscriptionPayment.botUrl || subscriptionPayment.miniAppUrl || subscriptionPayment.invoiceUrl;
}

function setSubscriptionAsset(asset) {
    subscriptionAsset = 'USDT';
    subscriptionPayment.asset = subscriptionAsset;
    try { localStorage.setItem('subscription_asset', subscriptionAsset); } catch {}
    saveSubscriptionState();
    updateSubscriptionUI();
}

async function createCryptoPayPayment() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/subscription/cryptopay/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, asset: subscriptionAsset, months: subscriptionDuration })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.active) {
            activateSubscriptionState(data, true);
            return;
        }
        subscriptionPayment = {
            invoiceId: data.invoice_id || null,
            status: data.status || 'active',
            asset: (data.asset || subscriptionAsset || 'USDT').toUpperCase(),
            amount: data.amount ? String(data.amount) : '',
            currency: (data.asset || subscriptionAsset || 'USDT').toUpperCase(),
            invoiceUrl: data.web_app_invoice_url || data.bot_invoice_url || data.mini_app_invoice_url || '',
            miniAppUrl: data.mini_app_invoice_url || '',
            webAppUrl: data.web_app_invoice_url || '',
            botUrl: data.bot_invoice_url || '',
            months: data.months || subscriptionDuration
        };
        saveSubscriptionState();
        updateSubscriptionUI();
        startSubscriptionPolling();
    } catch (e) {
        showNotification(e.message || 'Не удалось создать оплату', 'error');
    }
}

async function checkSubscriptionStatus() {
    const hasPayment = !!subscriptionPayment.invoiceId;
    if (!hasPayment) return;
    try {
        const query = `invoice_id=${encodeURIComponent(subscriptionPayment.invoiceId)}`;
        const res = await fetch(`/api/subscription/cryptopay/status?${query}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        subscriptionPayment.status = data.status || subscriptionPayment.status;
        if (data.active) {
            showNotification('Подписка активирована', 'success');
            activateSubscriptionState(data, true);
            return;
        }
        saveSubscriptionState();
        updateSubscriptionUI();
    } catch (e) {
        showNotification('Не удалось проверить оплату', 'error');
    }
}

function startSubscriptionPolling() {
    if (subscriptionPoller) return;
    if (!subscriptionPayment.invoiceId || subscriptionActive) return;
    subscriptionPoller = setInterval(() => {
        checkSubscriptionStatus();
    }, 15000);
}

function stopSubscriptionPolling() {
    if (subscriptionPoller) {
        clearInterval(subscriptionPoller);
        subscriptionPoller = null;
    }
}

async function grantSubscriptionManual() {
    if (!isAdminUser()) {
        showNotification('Недостаточно прав', 'error');
        return;
    }
    const rawUser = document.getElementById('subscription-admin-user')?.value || '';
    const trimmed = rawUser.trim();
    const username = trimmed.replace('@', '').trim();
    const match = trimmed.match(/^\d+$/);
    const userId = match ? parseInt(trimmed, 10) : 0;
    const adminKey = document.getElementById('subscription-admin-key')?.value || '';
    const monthsRaw = document.getElementById('subscription-admin-months')?.value || '1';
    const months = parseInt(monthsRaw, 10) || 1;
    if ((!userId && !username) || !adminKey) {
        showNotification('Введите ID/username и ключ', 'error');
        return;
    }
    try {
        const res = await fetch('/api/subscription/grant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId || undefined, username: userId ? undefined : username, admin_key: adminKey, months })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        let nameLabel = username ? '@' + username : (trimmed ? trimmed : t('Пользователь'));
        if (data.username) {
            nameLabel = data.username.startsWith('@') ? data.username : '@' + data.username;
        }
        showNotification(`${nameLabel} ${t('получил подписку на')} ${data.months || months} ${t('мес.')}`, 'success');
        if (currentUser) {
            const currentName = (currentUser.username || '').toLowerCase();
            if (userId && currentUser.id === userId) {
                subscriptionActive = true;
                subscriptionStart = data.subscription_start || subscriptionStart;
                subscriptionEnd = data.subscription_end || subscriptionEnd;
                updateSubscriptionUI();
            } else if (username && currentName === username.toLowerCase()) {
                subscriptionActive = true;
                subscriptionStart = data.subscription_start || subscriptionStart;
                subscriptionEnd = data.subscription_end || subscriptionEnd;
                updateSubscriptionUI();
            }
        }
        refreshSubscriptionInfo();
    } catch (e) {
        showNotification(e.message || 'Ошибка выдачи', 'error');
    }
}

async function loadPromoStats() {
    if (!isAdminUser()) {
        showNotification('Недостаточно прав', 'error');
        return;
    }
    const adminKey = document.getElementById('subscription-admin-key')?.value || '';
    if (!adminKey) {
        showNotification('Введите admin key', 'error');
        return;
    }
    const container = document.getElementById('promo-stats');
    if (container) {
        container.innerHTML = `<div style="color: var(--ios-text-secondary); text-align: center;">${t('Загрузка...')}</div>`;
    }
    try {
        const res = await fetch('/api/subscription/promo_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_key: adminKey })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
            if (container) {
                container.innerHTML = `<div style="color: var(--ios-text-secondary); text-align: center;">${t('Нет данных')}</div>`;
            }
            return;
        }
        if (container) {
            container.innerHTML = items.map((item) => {
                const periodValue = Number(item.period_value ?? item.days ?? item.months ?? 0);
                const periodUnit = item.period_unit || (item.days ? 'days' : 'months');
                const periodText = `${periodValue} ${periodUnit === 'days' ? t('дн.') : t('мес.')}`;
                const typeText = item.type === 'multi' ? t('Многоразовый') : t('Одноразовый');
                const usedText = item.limit ? `${item.used}/${item.limit}` : `${item.used}`;
                return `
                    <div class="promo-stat-item">
                        <div class="promo-stat-code">${item.code}</div>
                        <div class="promo-stat-meta">${periodText} • ${typeText} • ${t('Использовано')}: ${usedText}</div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        showNotification(e.message || 'Ошибка', 'error');
        if (container) {
            container.innerHTML = `<div style="color: var(--ios-text-secondary); text-align: center;">${t('Нет данных')}</div>`;
        }
    }
}

function isAdminUser() {
    const name = (currentUser?.username || '').replace('@', '').toLowerCase();
    return name === 'artem_katsay' || name === 'antonzayar';
}

function prefillAdminUsername() {
    const input = document.getElementById('subscription-admin-user');
    if (input && currentUser?.username) {
        input.value = '@' + currentUser.username;
    }
}

function closeSharedWallet() {
    const modal = document.getElementById('shared-wallet-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
}

async function loadSharedWalletStatus() {
    if (!currentUser) return;
    const statusEl = document.getElementById('shared-wallet-status');
    const actionsEl = document.getElementById('shared-wallet-actions');
    const shareEl = document.getElementById('shared-wallet-share');
    const codeEl = document.getElementById('shared-code-value');
    const copyCodeBtn = document.getElementById('shared-copy-code');
    const copyLinkBtn = document.getElementById('shared-copy-link');
    const leaveBtn = document.getElementById('shared-leave-btn');
    if (statusEl) statusEl.textContent = t('Загрузка...');
    try {
        const res = await fetch(`/api/shared_wallet/status?user_id=${currentUser.id}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        sharedWalletState = { status: data.status || 'none', code: data.code || '', link: data.link || '' };
        if (sharedWalletState.status === 'none') {
            if (statusEl) statusEl.textContent = t('Статус: не подключен');
            if (actionsEl) actionsEl.style.display = 'block';
            if (shareEl) shareEl.style.display = 'none';
        } else if (sharedWalletState.status === 'owner') {
            if (statusEl) statusEl.textContent = t('Статус: владелец');
            if (actionsEl) actionsEl.style.display = 'none';
            if (shareEl) shareEl.style.display = 'grid';
            if (codeEl) codeEl.textContent = sharedWalletState.code;
            if (copyCodeBtn) copyCodeBtn.style.display = 'flex';
            if (copyLinkBtn) copyLinkBtn.style.display = 'flex';
            if (leaveBtn) leaveBtn.style.display = 'flex';
        } else {
            const ownerName = data.owner_name ? ` ${data.owner_name}` : '';
            const ownerLabel = ownerName ? ' • ' + ownerName : '';
            if (statusEl) statusEl.textContent = `${t('Статус: участник')}${ownerLabel}`;
            if (actionsEl) actionsEl.style.display = 'none';
            if (shareEl) shareEl.style.display = 'grid';
            if (codeEl) codeEl.textContent = '';
            if (copyCodeBtn) copyCodeBtn.style.display = 'none';
            if (copyLinkBtn) copyLinkBtn.style.display = 'none';
            if (leaveBtn) leaveBtn.style.display = 'flex';
        }
        if (pendingInviteCode) {
            const input = document.getElementById('shared-code-input');
            if (input) input.value = pendingInviteCode;
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = t('Не удалось загрузить статус.');
    }
}

async function createSharedWallet() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/shared_wallet/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        sharedWalletState = { status: 'owner', code: data.code || '', link: data.link || '' };
        showNotification('Кошелёк создан', 'success');
        loadSharedWalletStatus();
    } catch (e) {
        showNotification('Не удалось создать общий кошелёк', 'error');
    }
}

async function joinSharedWallet() {
    if (!currentUser) return;
    const input = document.getElementById('shared-code-input');
    const code = (input?.value || '').trim().toUpperCase();
    if (!code) {
        showNotification('Введите код', 'error');
        return;
    }
    try {
        const res = await fetch('/api/shared_wallet/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, code })
        });
        const data = await res.json();
        if (data.error) {
            const map = {
                already_in: 'Вы уже подключены',
                not_found: 'Неверный код',
                full: 'Кошелёк уже заполнен',
                owner: 'Это ваш код'
            };
            throw new Error(map[data.error] || 'Не удалось подключиться');
        }
        pendingInviteCode = null;
        localStorage.removeItem('pending_invite_code');
        showNotification('Вы подключились', 'success');
        await initUser();
        await loadPanelData();
        loadSharedWalletStatus();
    } catch (e) {
        showNotification(e.message || 'Не удалось подключиться', 'error');
    }
}

async function leaveSharedWallet() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/shared_wallet/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showNotification('Отключено', 'info');
        await initUser();
        await loadPanelData();
        loadSharedWalletStatus();
    } catch (e) {
        showNotification('Не удалось отключиться', 'error');
    }
}

function copySharedCode() {
    if (!sharedWalletState.code) return;
    navigator.clipboard?.writeText(sharedWalletState.code).then(() => {
        showNotification('Код скопирован', 'success');
    });
}

function copySharedLink() {
    if (!sharedWalletState.link) return;
    navigator.clipboard?.writeText(sharedWalletState.link).then(() => {
        showNotification('Ссылка скопирована', 'success');
    });
}

function initInviteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (!code) return;
    pendingInviteCode = code.toUpperCase();
    localStorage.setItem('pending_invite_code', pendingInviteCode);
    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function handlePendingInvite() {
    if (!pendingInviteCode) {
        const saved = localStorage.getItem('pending_invite_code');
        if (saved) pendingInviteCode = saved;
    }
    if (!pendingInviteCode) return;
    openSharedWallet();
    const input = document.getElementById('shared-code-input');
    if (input) input.value = pendingInviteCode;
}

async function openMarketModal(item) {
    const modal = document.getElementById('market-modal');
    const title = document.getElementById('market-modal-title');
    const sub = document.getElementById('market-modal-sub');
    if (!modal || !title || !sub) return;
    title.textContent = `${(item.symbol || '').toUpperCase()}${item.name ? ' • ' + item.name : ''}`;
    const symbol = currencySymbols[currentCurrency] || '₽';
    sub.textContent = `${t('Изменение')}: ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%${item.price ? ` • ${t('Цена')}: ${item.price} ${item.market === 'crypto' ? '$' : symbol}` : ''}`;
    modal.classList.add('active');
    updateBodyModalState();
    marketChartState.market = item.market || '';
    marketChartState.id = item.id || item.symbol || '';
    marketChartState.symbol = item.symbol || '';
    if (!marketChartState.range) marketChartState.range = '1m';
    setupMarketRangeButtons();
    setActiveMarketRange(marketChartState.range);
    await loadMarketChart(marketChartState.market, marketChartState.id, marketChartState.range, marketChartState.symbol);
}

function closeMarketModal() {
    const modal = document.getElementById('market-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
}

function setupMarketRangeButtons() {
    if (marketRangeInitialized) return;
    const wrap = document.getElementById('market-range');
    if (!wrap) return;
    wrap.querySelectorAll('.market-range-btn').forEach(btn => {
        btn.onclick = () => {
            const range = btn.dataset.range || '1m';
            marketChartState.range = range;
            setActiveMarketRange(range);
            if (marketChartState.market && marketChartState.id) {
                loadMarketChart(marketChartState.market, marketChartState.id, range, marketChartState.symbol || '');
            }
        };
    });
    marketRangeInitialized = true;
}

function setActiveMarketRange(range) {
    const wrap = document.getElementById('market-range');
    if (!wrap) return;
    wrap.querySelectorAll('.market-range-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.range || '') === range);
    });
}

function formatMarketLabel(value, range) {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    if (range === '1d') {
        return date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit' });
}

async function loadMarketChart(market, id, range = '1m', symbol = '') {
    const canvas = document.getElementById('market-chart');
    if (!canvas) return;
    const cachedPoints = readMarketChartCache(market, id, range);
    try {
        const symbolParam = symbol ? `&symbol=${encodeURIComponent(symbol)}` : '';
        const res = await fetch(`/api/market_chart/${market}?id=${encodeURIComponent(id)}&range=${encodeURIComponent(range)}${symbolParam}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const points = data.points || [];
        writeMarketChartCache(market, id, range, points);
        if (charts['market-chart']) charts['market-chart'].destroy();
        const labels = points.map(p => formatMarketLabel(p.t, range));
        const chartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: points.map(p => p.v),
                    borderColor: 'rgba(93, 156, 236, 0.9)',
                    backgroundColor: 'rgba(93, 156, 236, 0.2)',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: (ctx) => {
                                const value = ctx.parsed?.y;
                                if (value === null || value === undefined) return '';
                                return `${t('Цена')}: ${Number(value).toLocaleString(getLocale(), { maximumFractionDigits: 4 })}`;
                            }
                        }
                    }
                },
                interaction: { mode: 'nearest', intersect: false },
                scales: {
                    x: {
                        display: true,
                        grid: { display: false },
                        ticks: { color: '#8b8b90', maxTicksLimit: 6 }
                    },
                    y: {
                        display: true,
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        ticks: { color: '#8b8b90', maxTicksLimit: 5 }
                    }
                }
            }
        });
        charts['market-chart'] = chartInstance;
        canvas.onclick = (evt) => {
            const points = chartInstance.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
            if (!points.length) return;
            chartInstance.setActiveElements(points);
            chartInstance.tooltip.setActiveElements(points, { x: evt.offsetX, y: evt.offsetY });
            chartInstance.update();
        };
    } catch (e) {
        if (cachedPoints && cachedPoints.length) {
            if (charts['market-chart']) charts['market-chart'].destroy();
            const labels = cachedPoints.map(p => formatMarketLabel(p.t, range));
            const chartInstance = new Chart(canvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        data: cachedPoints.map(p => p.v),
                        borderColor: 'rgba(93, 156, 236, 0.9)',
                        backgroundColor: 'rgba(93, 156, 236, 0.2)',
                        pointRadius: 0,
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                label: (ctx) => {
                                    const value = ctx.parsed?.y;
                                    if (value === null || value === undefined) return '';
                                    return `${t('Цена')}: ${Number(value).toLocaleString(getLocale(), { maximumFractionDigits: 4 })}`;
                                }
                            }
                        }
                    },
                    interaction: { mode: 'nearest', intersect: false },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { color: '#8b8b90', maxTicksLimit: 6 }
                        },
                        y: {
                            display: true,
                            grid: { color: 'rgba(0,0,0,0.06)' },
                            ticks: { color: '#8b8b90', maxTicksLimit: 5 }
                        }
                    }
                }
            });
            charts['market-chart'] = chartInstance;
            canvas.onclick = (evt) => {
                const points = chartInstance.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                if (!points.length) return;
                chartInstance.setActiveElements(points);
                chartInstance.tooltip.setActiveElements(points, { x: evt.offsetX, y: evt.offsetY });
                chartInstance.update();
            };
            return;
        }
        console.error('❌ Ошибка графика:', e);
    }
}

function setupReportTabs() {
    document.querySelectorAll('.report-tab').forEach(btn => {
        btn.onclick = function() {
            const tabId = this.dataset.tab;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.report-tab').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показываем контент вкладки
            document.querySelectorAll('.report-section').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
                requestAnimationFrame(() => updateReportTab(tabId));
            }
        };
    });
    
    // Инициализируем первую вкладку
    requestAnimationFrame(() => updateReportTab('overview'));
}

async function updateReportTab(tabId) {
    const shouldAnimateChartSwap = tabId === 'overview' || tabId === 'income' || tabId === 'expense';
    if (shouldAnimateChartSwap) {
        startReportChartSwapAnimation(tabId);
    }
    switch(tabId) {
        case 'overview':
            await updateOverviewTab();
            break;
        case 'income':
            await updateIncomeTab();
            break;
        case 'expense':
            await updateExpenseTab();
            break;
        case 'savings':
            await updateSavingsTab();
            break;
        case 'balance':
            await updateBalanceTab();
            break;
    }
    if (shouldAnimateChartSwap) {
        endReportChartSwapAnimation(tabId);
    }
}

async function loadReportData() {
    if (!currentUser) return;
    const activeTab = document.querySelector('.report-tab.active')?.dataset.tab || 'overview';
    await updateReportTab(activeTab);
}

function setupReportChartSwipes() {
    if (reportChartSwipeInitialized) return;
    reportChartSwipeInitialized = true;
    bindReportChartSwipe('overview', 'overview-chart');
    bindReportChartSwipe('income', 'income-chart');
    bindReportChartSwipe('expense', 'expense-chart');
}

function getReportChartCanvasId(tabId) {
    if (tabId === 'overview') return 'overview-chart';
    if (tabId === 'income') return 'income-chart';
    if (tabId === 'expense') return 'expense-chart';
    return '';
}

function getReportChartWrapper(tabId) {
    const canvasId = getReportChartCanvasId(tabId);
    if (!canvasId) return null;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return canvas.closest('.report-chart-wrapper');
}

function startReportChartSwapAnimation(tabId) {
    const wrapper = getReportChartWrapper(tabId);
    if (!wrapper) return;
    wrapper.classList.remove('is-updated');
    wrapper.classList.add('is-updating');
}

function endReportChartSwapAnimation(tabId) {
    const wrapper = getReportChartWrapper(tabId);
    if (!wrapper) return;
    wrapper.classList.remove('is-updating');
    wrapper.classList.add('is-updated');
    setTimeout(() => {
        wrapper.classList.remove('is-updated');
    }, 240);
}

function setupReportChartArrows() {
    document.querySelectorAll('.report-chart-arrow').forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        const tabId = btn.dataset.tab;
        if (!tabId) return;
        const direction = btn.classList.contains('report-chart-arrow--prev') ? 'older' : 'newer';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            shiftReportChartMonth(tabId, direction);
        });
        btn.dataset.bound = '1';
    });
}

function bindReportChartSwipe(tabId, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    bindReportSwipeElement(tabId, canvas, canvasId);
}

function shiftReportChartMonth(tabId, direction) {
    const monthValues = reportChartMonthValues[tabId] || [];
    if (!monthValues.length) {
        updateReportChartArrows(tabId);
        return;
    }

    const currentValue = reportChartPeriods[tabId];
    let currentIndex = monthValues.indexOf(currentValue);

    if (currentIndex === -1) {
        if (direction === 'older') {
            currentIndex = Math.min(1, monthValues.length - 1);
        } else {
            currentIndex = 0;
        }
    } else if (direction === 'older') {
        currentIndex = Math.min(currentIndex + 1, monthValues.length - 1);
    } else {
        currentIndex = Math.max(currentIndex - 1, 0);
    }

    const nextValue = monthValues[currentIndex];
    if (!nextValue || nextValue === currentValue) {
        updateReportChartArrows(tabId);
        return;
    }
    reportChartPeriods[tabId] = nextValue;
    updateReportChartArrows(tabId);
    requestAnimationFrame(() => updateReportTab(tabId));
}

function updateReportChartArrows(tabId) {
    const prev = document.querySelector(`.report-chart-arrow--prev[data-tab="${tabId}"]`);
    const next = document.querySelector(`.report-chart-arrow--next[data-tab="${tabId}"]`);
    if (!prev || !next) return;

    const monthValues = reportChartMonthValues[tabId] || [];
    if (!monthValues.length) {
        prev.disabled = true;
        next.disabled = true;
        return;
    }

    const currentValue = reportChartPeriods[tabId];
    let currentIndex = monthValues.indexOf(currentValue);
    if (currentIndex < 0) currentIndex = 0;

    const canGoOlder = currentIndex < monthValues.length - 1;
    const canGoNewer = currentIndex > 0;
    prev.disabled = !canGoOlder;
    next.disabled = !canGoNewer;
}

function getReportPeriodLabel(tabId, value) {
    if (!value) return '';
    const options = reportChartPeriodOptions[tabId] || [];
    const found = options.find(option => option.value === value);
    if (found) return found.label;
    if (value === 'year') return t('За год');
    if (value === 'all') return t('За всё время');
    if (value === 'range') return t('Свой интервал');
    if (value.startsWith('month:')) return getMonthLabelFromValue(value);
    return value;
}

function openReportPeriodModal(tabId) {
    if (tabId === 'panel') {
        renderPanelPeriodControls();
    }
    reportPeriodModalTabId = tabId;
    renderReportPeriodModal(tabId);
    const modal = document.getElementById('report-period-modal');
    if (modal) {
        modal.classList.add('active');
        updateBodyModalState();
    }
}

function closeReportPeriodModal() {
    reportPeriodModalTabId = null;
    closeModal('report-period-modal');
}

function selectReportPeriod(tabId, value) {
    if (!tabId || !value) return;
    if (tabId === 'panel') {
        if (value === 'range') {
            closeReportPeriodModal();
            openPanelRangeModal();
            return;
        }
        reportChartPeriods.panel = value;
        renderPanelPeriodControls();
        applyPanelPeriodFilter();
        closeReportPeriodModal();
        return;
    }
    if (value === 'range') {
        closeReportPeriodModal();
        openReportRangeModal(tabId);
        return;
    }
    reportChartPeriods[tabId] = value;
    updateReportChartArrows(tabId);
    requestAnimationFrame(() => updateReportTab(tabId));
    closeReportPeriodModal();
}

function renderReportPeriodModal(tabId) {
    const grid = document.getElementById('report-period-grid');
    const quick = document.getElementById('report-period-quick');
    const title = document.getElementById('report-period-title');
    if (!grid || !quick) return;
    if (title) title.textContent = t('Период');

    const options = reportChartPeriodOptions[tabId] || [];
    const currentValue = reportChartPeriods[tabId] || getCurrentMonthPeriodValue();
    const monthOptions = options.filter(option => typeof option.value === 'string' && option.value.startsWith('month:'));

    grid.innerHTML = monthOptions.map(option => `
        <button class="period-btn ${option.value === currentValue ? 'active' : ''}"
                onclick="selectReportPeriod('${tabId}', '${option.value}')">
            ${option.label}
        </button>
    `).join('');

    const quickOptions = [
        { value: 'year', label: t('За год') },
        { value: 'all', label: t('За всё время') },
        { value: 'range', label: t('Свой интервал') }
    ];
    quick.innerHTML = quickOptions.map(option => `
        <button class="period-btn ${option.value === currentValue ? 'active' : ''}"
                onclick="selectReportPeriod('${tabId}', '${option.value}')">
            ${option.label}
        </button>
    `).join('');
}

function openReportRangeModal(tabId) {
    if (!tabId) return;
    reportRangeModalTabId = tabId;
    const modal = document.getElementById('report-range-modal');
    if (!modal) return;

    const fromInput = document.getElementById('report-range-modal-from');
    const toInput = document.getElementById('report-range-modal-to');
    const range = reportChartRanges[tabId] || { from: '', to: '' };
    if (fromInput) fromInput.value = range.from || '';
    if (toInput) toInput.value = range.to || '';

    modal.classList.add('active');
    updateBodyModalState();
}

function closeReportRangeModal() {
    reportRangeModalTabId = null;
    closeModal('report-range-modal');
}

function applyReportCustomRange() {
    const tabId = reportRangeModalTabId;
    if (!tabId) {
        closeReportRangeModal();
        return;
    }
    const fromInput = document.getElementById('report-range-modal-from');
    const toInput = document.getElementById('report-range-modal-to');
    reportChartPeriods[tabId] = 'range';
    reportChartRanges[tabId] = {
        from: fromInput?.value || '',
        to: toInput?.value || ''
    };
    updateReportChartArrows(tabId);
    requestAnimationFrame(() => updateReportTab(tabId));
    closeReportRangeModal();
}

function handleReportChartTap(canvasId, event) {
    const chart = charts[canvasId];
    if (!chart) return;
    const touch = event?.changedTouches ? event.changedTouches[0] : null;
    if (!touch) return;
    const rect = chart.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const points = chart.getElementsAtEventForMode({ x, y }, 'nearest', { intersect: false }, true);
    if (!points.length) {
        chart.$segmentPopupIndex = null;
        chart.update();
        return;
    }
    const nextIndex = points[0].index;
    chart.$segmentPopupIndex = chart.$segmentPopupIndex === nextIndex ? null : nextIndex;
    chart.update();
}

function bindReportSwipeElement(tabId, element, canvasId = null) {
    if (!element || element.dataset.swipeBound === '1') return;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let handled = false;

    element.addEventListener('touchstart', (event) => {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
        startedAt = Date.now();
        handled = false;
    }, { passive: true });

    element.addEventListener('touchmove', (event) => {
        if (!startedAt || handled) return;
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 32 && absX > absY * 1.2) {
            handled = true;
            if (event.cancelable) event.preventDefault();
            shiftReportChartMonth(tabId, deltaX < 0 ? 'newer' : 'older');
        }
    }, { passive: false });

    element.addEventListener('touchend', (event) => {
        if (!startedAt) return;
        const elapsed = Date.now() - startedAt;
        startedAt = 0;
        if (handled || elapsed > 600) return;
        if (canvasId) {
            handleReportChartTap(canvasId, event);
        }
    }, { passive: true });

    element.dataset.swipeBound = '1';
}

function renderReportChartPeriodControls(tabId, sourceTransactions) {
    const anchor = document.getElementById(`${tabId}-chart-period-anchor`);
    if (!anchor) return;

    const periodOptions = getReportStatsPeriodOptions(sourceTransactions, true);
    reportChartPeriodOptions[tabId] = periodOptions;
    reportChartMonthValues[tabId] = periodOptions
        .map(option => option.value)
        .filter(value => typeof value === 'string' && value.startsWith('month:'));
    const defaultPeriod = getCurrentMonthPeriodValue();
    const hasStoredPeriod = periodOptions.some(option => option.value === reportChartPeriods[tabId]);
    if (!hasStoredPeriod) {
        reportChartPeriods[tabId] = periodOptions.some(option => option.value === defaultPeriod) ? defaultPeriod : 'all';
    }
    updateReportChartArrows(tabId);

    const selectedPeriod = reportChartPeriods[tabId] || defaultPeriod;
    const periodLabel = getReportPeriodLabel(tabId, selectedPeriod);

    anchor.innerHTML = `
        <div class="report-chart-period-controls">
            <button type="button" class="report-chart-period-trigger" id="${tabId}-chart-period-trigger" data-tab="${tabId}">
                <span class="report-chart-period-text">${periodLabel}</span>
                <span class="report-chart-period-caret">▾</span>
            </button>
        </div>
    `;

    const periodTrigger = document.getElementById(`${tabId}-chart-period-trigger`);
    if (periodTrigger) {
        periodTrigger.onclick = () => openReportPeriodModal(tabId);
        bindReportSwipeElement(tabId, periodTrigger);
    }
}

async function updateOverviewTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        renderReportChartPeriodControls('overview', transactions);

        const scopedTransactions = filterTransactionsByPeriod(
            transactions,
            reportChartPeriods.overview,
            reportChartRanges.overview
        );
        
        const incomeTransactions = scopedTransactions.filter(t => t.type === 'income');
        const expenseTransactions = scopedTransactions.filter(t => t.type === 'expense');

        const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const savingsTransactions = expenseTransactions.filter(t => isSavingsCategoryName(t.category));
        const debtTransactions = expenseTransactions.filter(t => t.category === 'Долги');
        const regularExpenseTransactions = expenseTransactions.filter(
            t => !isSavingsCategoryName(t.category) && t.category !== 'Долги'
        );

        const totalSavings = savingsTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalDebts = debtTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalRegularExpense = regularExpenseTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalOutflow = totalRegularExpense + totalSavings + totalDebts;

        const symbol = currencySymbols[currentCurrency] || '₽';
        document.getElementById('overview-income').textContent = formatCurrency(totalIncome) + ' ' + symbol;
        document.getElementById('overview-expense').textContent = formatCurrency(totalRegularExpense) + ' ' + symbol;
        document.getElementById('overview-balance').textContent = formatCurrency(totalIncome - totalOutflow) + ' ' + symbol;

        const overviewSegments = [];
        if (totalIncome > 0) {
            overviewSegments.push({ label: t('Доходы'), value: totalIncome, color: '#30D158', icon: '💰' });
        }
        if (totalRegularExpense > 0) {
            overviewSegments.push({ label: t('Расходы'), value: totalRegularExpense, color: '#FF453A', icon: '📉' });
        }
        if (totalSavings > 0) {
            overviewSegments.push({ label: t('Накопления'), value: totalSavings, color: '#FFD166', icon: '🐷' });
        }
        if (totalDebts > 0) {
            overviewSegments.push({ label: t('Долги'), value: totalDebts, color: '#AF52DE', icon: '💸' });
        }

        updateOverviewChart(overviewSegments);
        
    } catch (error) {
        console.error('❌ Ошибка обновления обзора:', error);
    }
}

function updateOverviewChart(segments) {
    const ctx = document.getElementById('overview-chart');
    if (!ctx) return;
    
    destroyChartInstance('overview-chart');
    
    if (!Array.isArray(segments) || segments.length === 0) {
        renderPlaceholderCircularChart('overview-chart', ctx, {
            type: 'doughnut',
            cutout: '72%',
            radius: '92%',
            rotation: -90,
            padding: 14
        });
        return;
    }

    const labels = segments.map(segment => segment.label);
    const values = segments.map(segment => segment.value);
    const colors = segments.map(segment => segment.color);
    const icons = segments.map(segment => segment.icon);
    const spacing = 0;
    const overviewDisplayData = buildDisplayValuesWithMinimumPercent(values, 10);
    charts['overview-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: overviewDisplayData.displayValues,
                rawData: overviewDisplayData.rawValues,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 0,
                borderRadius: 0,
                spacing: spacing,
                borderAlign: 'inner',
                borderJoinStyle: 'round',
                hoverBackgroundColor: colors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverBorderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 14 },
            cutout: '72%',
            radius: '92%',
            rotation: -90,
            onClick: (evt, elements, chart) => {
                const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                if (!points.length) {
                    chart.$segmentPopupIndex = null;
                    chart.update();
                    return;
                }
                const nextIndex = points[0].index;
                chart.$segmentPopupIndex = chart.$segmentPopupIndex === nextIndex ? null : nextIndex;
                chart.update();
            },
            plugins: {
                legend: { display: false },
                chartShadow: {
                    shadowColor: 'rgba(0, 0, 0, 0.7)',
                    shadowBlur: 40,
                    shadowOffsetY: 16
                },
                segmentJoinCaps: {
                    enabled: true,
                    colors: colors,
                    overdraw: 0.6
                },
                segmentIcons: {
                    icons: icons,
                    colors: colors
                },
                segmentPercentages: true,
                segmentPopup: { enabled: true },
                tooltip: {
                    enabled: false
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

async function updateIncomeTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        const incomeTransactions = transactions.filter(t => t.type === 'income');
        renderReportChartPeriodControls('income', incomeTransactions);
        const scopedIncomeTransactions = filterTransactionsByPeriod(
            incomeTransactions,
            reportChartPeriods.income,
            reportChartRanges.income
        );
        await updateIncomeChart(scopedIncomeTransactions);
        updateIncomeStats(scopedIncomeTransactions, { prefiltered: true, showControls: false });
    } catch (error) {
        console.error('❌ Ошибка обновления доходов:', error);
    }
}

async function updateIncomeChart(transactions) {
    const ctx = document.getElementById('income-chart');
    if (!ctx) return;

    destroyChartInstance('income-chart');
    const baseContext = ctx.getContext('2d');
    if (baseContext) {
        baseContext.clearRect(0, 0, ctx.width, ctx.height);
    }
    
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    
    if (incomeTransactions.length === 0) {
        renderPlaceholderCircularChart('income-chart', ctx, {
            type: 'doughnut',
            cutout: '72%',
            radius: '90%',
            rotation: -90,
            padding: 14
        });
        return;
    }
    
    // Группируем по категориям
    const incomeByCategory = {};
    incomeTransactions.forEach(trans => {
        incomeByCategory[trans.category] = (incomeByCategory[trans.category] || 0) + trans.amount;
    });
    
    const sorted = Object.entries(incomeByCategory)
        .sort((a, b) => b[1] - a[1]); // от большего к меньшему
    const categories = sorted.map(([name]) => name);
    const displayLabels = categories.map(name => t(name));
    const amounts = sorted.map(([, value]) => value);
    
    // Получаем цвета категорий
    const usedColors = new Set();
    const backgroundColors = categories.map((category, index) => {
        const cat = categoriesData.income?.find(c => c.name === category);
        return pickDistinctColor(cat?.color, index, usedColors);
    });
    
    const borderColors = backgroundColors.map(color => color);
    const hoverColors = backgroundColors.map(color => color);
    const icons = categories.map(category => {
        const cat = categoriesData.income?.find(c => c.name === category);
        return cat?.icon || '💰';
    });
    
    // Создаем новый график с улучшенным стилем
    const spacing = 0;
    const incomeDisplayData = buildDisplayValuesWithMinimumPercent(amounts, 10);
    charts['income-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: displayLabels,
            datasets: [{
                data: incomeDisplayData.displayValues,
                rawData: incomeDisplayData.rawValues,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 0,
                borderRadius: 0,
                spacing: spacing,
                borderAlign: 'inner',
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverBorderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 14 },
            onClick: (evt, elements, chart) => {
                const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                if (!points.length) {
                    chart.$segmentPopupIndex = null;
                    chart.update();
                    return;
                }
                const nextIndex = points[0].index;
                chart.$segmentPopupIndex = chart.$segmentPopupIndex === nextIndex ? null : nextIndex;
                chart.update();
            },
            plugins: {
                legend: { display: false },
                chartShadow: {
                    shadowColor: 'rgba(0, 0, 0, 0.7)',
                    shadowBlur: 38,
                    shadowOffsetY: 14
                },
                segmentJoinCaps: {
                    enabled: true,
                    colors: backgroundColors,
                    overdraw: 0.6
                },
                segmentIcons: {
                    icons,
                    colors: backgroundColors
                },
                segmentPercentages: true,
                segmentPopup: { enabled: true },
                tooltip: {
                    enabled: false
                }
            },
            cutout: '72%',
            radius: '90%',
            rotation: -90,
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

async function updateExpenseTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        renderReportChartPeriodControls('expense', expenseTransactions);
        const scopedExpenseTransactions = filterTransactionsByPeriod(
            expenseTransactions,
            reportChartPeriods.expense,
            reportChartRanges.expense
        );
        await updateExpenseChart(scopedExpenseTransactions);
        updateExpenseTop(scopedExpenseTransactions, { prefiltered: true, showControls: false });
    } catch (error) {
        console.error('❌ Ошибка обновления расходов:', error);
    }
}

async function updateExpenseChart(transactions) {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;

    destroyChartInstance('expense-chart');
    const baseContext = ctx.getContext('2d');
    if (baseContext) {
        baseContext.clearRect(0, 0, ctx.width, ctx.height);
    }

    // Ensure debt category exists for color/icon lookup in charts
    injectDebtCategory();
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    if (expenseTransactions.length === 0) {
        renderPlaceholderCircularChart('expense-chart', ctx, {
            type: 'doughnut',
            cutout: '72%',
            radius: '90%',
            rotation: -90,
            padding: 14
        });
        return;
    }
    
    // Группируем по категориям
    const expenseByCategory = {};
    expenseTransactions.forEach(trans => {
        expenseByCategory[trans.category] = (expenseByCategory[trans.category] || 0) + trans.amount;
    });
    
    const sorted = Object.entries(expenseByCategory)
        .sort((a, b) => b[1] - a[1]); // от большего к меньшему
    const categories = sorted.map(([name]) => name);
    const displayLabels = categories.map(name => t(name));
    const amounts = sorted.map(([, value]) => value);
    
    // Получаем цвета категорий
    const usedColors = new Set();
    const backgroundColors = categories.map((category, index) => {
        const cat = categoriesData.expense?.find(c => c.name === category);
        return pickDistinctColor(cat?.color, index, usedColors);
    });
    
    const borderColors = backgroundColors.map(color => color);
    const hoverColors = backgroundColors.map(color => color);
    const icons = categories.map(category => {
        const cat = categoriesData.expense?.find(c => c.name === category);
        return cat?.icon || '💸';
    });
    
    // Создаем новый график с улучшенным стилем
    const spacing = 0;
    const expenseDisplayData = buildDisplayValuesWithMinimumPercent(amounts, 10);
    charts['expense-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: displayLabels,
            datasets: [{
                data: expenseDisplayData.displayValues,
                rawData: expenseDisplayData.rawValues,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 0,
                borderRadius: 0,
                spacing: spacing,
                borderAlign: 'inner',
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverBorderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 14 },
            onClick: (evt, elements, chart) => {
                const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                if (!points.length) {
                    chart.$segmentPopupIndex = null;
                    chart.update();
                    return;
                }
                const nextIndex = points[0].index;
                chart.$segmentPopupIndex = chart.$segmentPopupIndex === nextIndex ? null : nextIndex;
                chart.update();
            },
            plugins: {
                legend: { display: false },
                chartShadow: {
                    shadowColor: 'rgba(0, 0, 0, 0.7)',
                    shadowBlur: 38,
                    shadowOffsetY: 14
                },
                segmentJoinCaps: {
                    enabled: true,
                    colors: backgroundColors,
                    overdraw: 0.6
                },
                segmentIcons: {
                    icons,
                    colors: backgroundColors
                },
                segmentPercentages: true,
                segmentPopup: { enabled: true },
                tooltip: {
                    enabled: false
                }
            },
            cutout: '72%',
            radius: '90%',
            rotation: -90,
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function updateIncomeStats(transactions, options = {}) {
    const container = document.getElementById('income-stats');
    if (!container) return;

    const prefiltered = !!options.prefiltered;
    const showControls = options.showControls !== false;
    const incomeTransactions = prefiltered ? transactions : transactions.filter(t => t.type === 'income');
    let filteredTransactions = incomeTransactions;
    let periodOptions = [];
    const defaultPeriod = getCurrentMonthPeriodValue();

    if (!prefiltered) {
        periodOptions = getReportStatsPeriodOptions(incomeTransactions);
        if (!periodOptions.some(option => option.value === incomeStatsPeriod)) {
            incomeStatsPeriod = periodOptions.some(option => option.value === defaultPeriod) ? defaultPeriod : 'all';
        }
        filteredTransactions = filterTransactionsByPeriod(incomeTransactions, incomeStatsPeriod);
    }

    const symbol = currencySymbols[currentCurrency] || '₽';

    let statsHtml = `
        <div class="report-stats-empty">${t('Нет доходов за выбранный период')}</div>
    `;

    if (filteredTransactions.length > 0) {
        const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
        const avg = total / filteredTransactions.length;
        const byCategory = {};
        filteredTransactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });
        const top = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1]);
        statsHtml = `
            <div class="report-stats-list report-stats-list--income">
                <div class="report-stats-row">
                    <span class="report-stats-row-label">${t('Всего доходов')}:</span>
                    <strong>${formatCurrency(total)} ${symbol}</strong>
                </div>
                <div class="report-stats-row">
                    <span class="report-stats-row-label">${t('Средний доход')}:</span>
                    <strong>${formatCurrency(avg)} ${symbol}</strong>
                </div>
            </div>
            <div class="report-stats-top-title report-stats-top-title--income">${t('Топ категорий')}</div>
            <div class="report-stats-top-list">
                ${top.map(([name, amount]) => `
                    <div class="report-stats-top-item">
                        <span class="report-stats-top-name">${t(name)}</span>
                        <strong>${formatCurrency(amount)} ${symbol}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (showControls) {
        container.innerHTML = `
            <div class="report-stats-controls">
                <label class="report-stats-label" for="income-stats-period">${t('Период')}</label>
                <select id="income-stats-period" class="form-select report-stats-period">
                    ${periodOptions.map(option => `
                        <option value="${option.value}" ${option.value === incomeStatsPeriod ? 'selected' : ''}>${option.label}</option>
                    `).join('')}
                </select>
            </div>
            ${statsHtml}
        `;

        const periodSelect = document.getElementById('income-stats-period');
        if (periodSelect) {
            periodSelect.onchange = function() {
                incomeStatsPeriod = this.value || defaultPeriod;
                updateIncomeStats(transactions);
            };
        }
    } else {
        container.innerHTML = statsHtml;
    }
}

function updateExpenseTop(transactions, options = {}) {
    const container = document.getElementById('expense-top');
    if (!container) return;

    const prefiltered = !!options.prefiltered;
    const showControls = options.showControls !== false;
    const expenseTransactions = prefiltered ? transactions : transactions.filter(t => t.type === 'expense');
    let filteredTransactions = expenseTransactions;
    let periodOptions = [];
    const defaultPeriod = getCurrentMonthPeriodValue();

    if (!prefiltered) {
        periodOptions = getReportStatsPeriodOptions(expenseTransactions);
        if (!periodOptions.some(option => option.value === expenseStatsPeriod)) {
            expenseStatsPeriod = periodOptions.some(option => option.value === defaultPeriod) ? defaultPeriod : 'all';
        }
        filteredTransactions = filterTransactionsByPeriod(expenseTransactions, expenseStatsPeriod);
    }
    const symbol = currencySymbols[currentCurrency] || '₽';

    let statsHtml = `
        <div class="report-stats-empty">${t('Нет расходов за выбранный период')}</div>
    `;

    if (filteredTransactions.length > 0) {
        const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
        const avg = total / filteredTransactions.length;
        const byCategory = {};
        filteredTransactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });
        const top = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        statsHtml = `
            <div class="report-stats-list report-stats-list--expense">
                <div class="report-stats-row">
                    <span class="report-stats-row-label">${t('Всего расходов')}:</span>
                    <strong>${formatCurrency(total)} ${symbol}</strong>
                </div>
                <div class="report-stats-row">
                    <span class="report-stats-row-label">${t('Средний расход')}:</span>
                    <strong>${formatCurrency(avg)} ${symbol}</strong>
                </div>
            </div>
            <div class="report-stats-top-title">${t('Топ категорий')}</div>
            <div class="report-stats-top-list">
                ${top.map(([name, amount]) => `
                    <div class="report-stats-top-item">
                        <span class="report-stats-top-name">${t(name)}</span>
                        <strong>${formatCurrency(amount)} ${symbol}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (showControls) {
        container.innerHTML = `
            <div class="report-stats-controls">
                <label class="report-stats-label" for="expense-stats-period">${t('Период')}</label>
                <select id="expense-stats-period" class="form-select report-stats-period">
                    ${periodOptions.map(option => `
                        <option value="${option.value}" ${option.value === expenseStatsPeriod ? 'selected' : ''}>${option.label}</option>
                    `).join('')}
                </select>
            </div>
            ${statsHtml}
        `;

        const periodSelect = document.getElementById('expense-stats-period');
        if (periodSelect) {
            periodSelect.onchange = function() {
                expenseStatsPeriod = this.value || defaultPeriod;
                updateExpenseTop(transactions);
            };
        }
    } else {
        container.innerHTML = statsHtml;
    }
}

function getReportStatsPeriodOptions(items, includeCustomRange = false) {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthValue = `month:${currentMonthKey}`;
    const options = [
        { value: currentMonthValue, label: `${getMonthName(now.getMonth())} ${now.getFullYear()}` },
        { value: 'year', label: t('За год') },
        { value: 'all', label: t('За всё время') }
    ];
    if (includeCustomRange) {
        options.push({ value: 'range', label: t('Свой интервал') });
    }

    if (!items.length) return options;

    const validDates = items
        .map(transaction => parseTransactionDate(transaction.date))
        .filter(date => !Number.isNaN(date.getTime()))
        .sort((a, b) => a - b);

    if (!validDates.length) return options;

    const firstMonth = new Date(validDates[0].getFullYear(), validDates[0].getMonth(), 1);
    const lastDataMonth = new Date(validDates[validDates.length - 1].getFullYear(), validDates[validDates.length - 1].getMonth(), 1);
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const lastMonth = lastDataMonth > currentMonth ? lastDataMonth : currentMonth;
    const monthKeys = [];
    const cursor = new Date(firstMonth);
    const addedMonthValues = new Set([currentMonthValue]);

    while (cursor <= lastMonth) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        monthKeys.push(key);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    monthKeys.reverse().forEach((key) => {
        const monthValue = `month:${key}`;
        if (addedMonthValues.has(monthValue)) return;
        const [year, month] = key.split('-');
        const monthIndex = Number(month) - 1;
        options.push({
            value: monthValue,
            label: `${getMonthName(monthIndex)} ${year}`
        });
        addedMonthValues.add(monthValue);
    });

    return options;
}

function filterTransactionsByPeriod(items, period, customRange = null) {
    if (!items.length) return [];

    if (period === 'range') {
        const fromRaw = customRange?.from || '';
        const toRaw = customRange?.to || '';
        if (!fromRaw && !toRaw) {
            return items;
        }
        const fromTsRaw = fromRaw ? new Date(`${fromRaw}T00:00:00`).getTime() : null;
        const toTsRaw = toRaw ? new Date(`${toRaw}T23:59:59.999`).getTime() : null;
        const validFrom = Number.isFinite(fromTsRaw) ? fromTsRaw : null;
        const validTo = Number.isFinite(toTsRaw) ? toTsRaw : null;
        if (validFrom === null && validTo === null) {
            return items;
        }
        const minTs = validFrom !== null && validTo !== null ? Math.min(validFrom, validTo) : validFrom;
        const maxTs = validFrom !== null && validTo !== null ? Math.max(validFrom, validTo) : validTo;
        return items.filter((transaction) => {
            const ts = parseTransactionDate(transaction.date).getTime();
            if (!Number.isFinite(ts)) return false;
            if (minTs !== null && ts < minTs) return false;
            if (maxTs !== null && ts > maxTs) return false;
            return true;
        });
    }

    if (period === 'year') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const startTs = start.getTime();
        const endTs = now.getTime();
        return items.filter((transaction) => {
            const date = parseTransactionDate(transaction.date);
            const ts = date.getTime();
            return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
        });
    }

    if (period && period.startsWith('month:')) {
        const monthKey = period.slice(6);
        return items.filter((transaction) => {
            const date = parseTransactionDate(transaction.date);
            if (Number.isNaN(date.getTime())) return false;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return key === monthKey;
        });
    }

    return items;
}

async function updateSavingsTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        await updateSavingsChart(transactions);
        await loadGoals();
    } catch (error) {
        console.error('❌ Ошибка обновления накоплений:', error);
    }
}

async function updateSavingsChart(transactions) {
    const ctx = document.getElementById('savings-chart');
    if (!ctx) return;
    destroyChartInstance('savings-chart');
    
    const savingsTransactions = transactions.filter(t => isSavingsCategoryName(t.category));
    
    if (savingsTransactions.length === 0) {
        renderPlaceholderBarChart('savings-chart', ctx);
        return;
    }
    
    // Группируем по месяцам
    const savingsByMonth = {};
    savingsTransactions.forEach(trans => {
        const date = parseTransactionDate(trans.date);
        if (Number.isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        savingsByMonth[monthKey] = (savingsByMonth[monthKey] || 0) + trans.amount;
    });
    
    const months = Object.keys(savingsByMonth).sort();
    const amounts = months.map(month => savingsByMonth[month]);
    
    // Создаем новый график
    charts['savings-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(month => {
                const [year, monthNum] = month.split('-');
                return `${getMonthName(parseInt(monthNum) - 1)} ${year}`;
            }),
            datasets: [{
                label: t('Накопления'),
                data: amounts,
                backgroundColor: 'rgba(255, 214, 10, 0.7)',
                borderColor: 'rgba(255, 214, 10, 1)',
                borderWidth: 2,
                borderRadius: 8,
                hoverBackgroundColor: 'rgba(255, 214, 10, 0.9)',
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${t('Накопления')}: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return formatCurrency(value) + ' ' + symbol;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

async function updateBalanceTab() {
    if (!currentUser) return;
    
    try {
        await updateDistributionChart();
        await updateBalanceDynamicsChart('week');
    } catch (error) {
        console.error('❌ Ошибка обновления баланса:', error);
    }
}

async function updateDistributionChart() {
    const ctx = document.getElementById('distribution-chart');
    if (!ctx) return;
    const legendContainer = document.getElementById('distribution-legend');
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let totalBalance = 0;
    walletsData.forEach(wallet => totalBalance += wallet.balance || 0);
    const savingsTotal = getSavingsAmount();
    const hasSavingsWallet = walletsData.some(wallet => wallet.name === 'Накопления');
    const includeSavings = !hasSavingsWallet && savingsTotal > 0;
    if (includeSavings) {
        totalBalance += savingsTotal;
    }
    
    if (totalBalance === 0) {
        if (legendContainer) legendContainer.innerHTML = '';
        renderPlaceholderCircularChart('distribution-chart', ctx, {
            type: 'pie',
            cutout: '72%',
            radius: '86%',
            rotation: -90,
            padding: 18
        });
        return;
    }
    
    const labels = walletsData.map(w => t(w.name));
    const amounts = walletsData.map(w => w.balance || 0);
    const colors = walletsData.map((w, i) => colorPalette[i % colorPalette.length]);
    const icons = walletsData.map(w => w.icon || '💳');
    const borderColors = colors.map(color => color + 'FF');
    const hoverColors = colors.map(color => color + 'CC');

    if (includeSavings) {
        const savingsColor = '#FFD166';
        labels.push(t('Накопления'));
        amounts.push(savingsTotal);
        colors.push(savingsColor);
        icons.push('💰');
        borderColors.push(savingsColor + 'FF');
        hoverColors.push(savingsColor + 'CC');
    }
    
    destroyChartInstance('distribution-chart');
    
    // Обновляем легенду
    if (legendContainer) {
        let html = '';
        walletsData.forEach((wallet, index) => {
            const percentage = totalBalance > 0 ? ((wallet.balance || 0) / totalBalance * 100).toFixed(1) : '0';
            html += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${colors[index]}; box-shadow: 0 0 15px ${colors[index]}80;"></div>
                    <div class="legend-name">${t(wallet.name)}</div>
                    <div class="legend-percentage">${percentage}%</div>
                </div>
            `;
        });
        if (includeSavings) {
            const percentage = totalBalance > 0 ? (savingsTotal / totalBalance * 100).toFixed(1) : '0';
            const color = colors[colors.length - 1];
            html += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
                    <div class="legend-name">${t('Накопления')}</div>
                    <div class="legend-percentage">${percentage}%</div>
                </div>
            `;
        }
        legendContainer.innerHTML = html;
    }
    
    const distributionDisplayData = buildDisplayValuesWithMinimumPercent(amounts, 10);

    charts['distribution-chart'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: distributionDisplayData.displayValues,
                rawData: distributionDisplayData.rawValues,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 18 },
            onClick: (evt, elements, chart) => {
                const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                if (!points.length) {
                    chart.$segmentPopupIndex = null;
                    chart.update();
                    return;
                }
                const nextIndex = points[0].index;
                chart.$segmentPopupIndex = chart.$segmentPopupIndex === nextIndex ? null : nextIndex;
                chart.update();
            },
            plugins: {
                legend: { display: false },
                segmentIcons: {
                    icons,
                    colors,
                    ringFill: 0.49,
                    minRadius: 10,
                    maxRadius: 26,
                    fontScale: 1.2,
                    iconOffsetY: 0.4
                },
                segmentPopup: { enabled: true },
                tooltip: {
                    enabled: false
                }
            },
            cutout: '72%',
            radius: '86%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function setupBalancePeriods() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = function() {
            const period = this.dataset.period;
            
            // Обновляем активную кнопку
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Обновляем график динамики баланса
            updateBalanceDynamicsChart(period);
        };
    });
    
    // Инициализируем график
    updateBalanceDynamicsChart('week');
}

async function updateBalanceDynamicsChart(period) {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/balance_dynamics/${currentUser.id}?period=${period}`);
        const dynamics = await response.json();
        
        updateDynamicsChart(dynamics, period);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки динамики:', error);
    }
}

function updateDynamicsChart(data, period) {
    const ctx = document.getElementById('dynamics-chart');
    if (!ctx) return;
    
    destroyChartInstance('dynamics-chart');
    
    if (!data || data.length === 0) {
        renderPlaceholderLineChart('dynamics-chart', ctx);
        return;
    }
    
    const labels = data.map(item => {
        if (period === 'day') {
            return new Date(item.period).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
        } else if (period === 'week') {
            const date = new Date(item.period);
            return date.toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric' });
        } else if (period === 'month') {
            return item.period;
        }
        return item.period;
    });
    
    const balances = data.map(item => item.balance);
    const savingsSeries = data.map(item => item.savings ?? 0);
    
    charts['dynamics-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: t('Баланс'),
                    data: balances,
                    backgroundColor: 'rgba(10, 132, 255, 0.1)',
                    borderColor: 'rgba(10, 132, 255, 1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(10, 132, 255, 1)',
                    pointBorderColor: 'rgba(255, 255, 255, 1)',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                },
                {
                    label: t('Накопления'),
                    data: savingsSeries,
                    backgroundColor: 'rgba(255, 209, 102, 0.12)',
                    borderColor: 'rgba(255, 209, 102, 0.9)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(255, 209, 102, 0.9)',
                    pointBorderColor: 'rgba(0, 0, 0, 0.2)',
                    pointBorderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${context.dataset.label}: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return formatCurrency(value) + ' ' + symbol;
                        }
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
}

function updateChartLegend(legendId, categories, amounts, colors) {
    const legendContainer = document.getElementById(legendId);
    if (!legendContainer) return;
    
    const total = amounts.reduce((a, b) => a + b, 0);
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    categories.forEach((category, index) => {
        const amount = amounts[index];
        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
        const color = colors[index];
        
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
                <div class="legend-text">
                    <div class="legend-title">${t(category)}</div>
                    <div class="legend-meta">${formatCurrency(amount)} ${symbol} • ${percentage}%</div>
                </div>
            </div>
        `;
    });
    
    legendContainer.innerHTML = html;
}

// ==================== //
// ЦЕЛИ НАКОПЛЕНИЙ //
// ==================== //

async function loadGoals() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/goals?user_id=' + currentUser.id);
        const goals = await response.json();
        goalsData = goals;
        if (selectedGoalId && !goalsData.some(goal => goal.id === selectedGoalId && !goal.archived)) {
            selectedGoalId = null;
        }
        updateGoalsDisplay();
        updatePanelGoals();
    } catch (error) {
        console.error('❌ Ошибка загрузки целей:', error);
    }
}

function updateGoalsDisplay() {
    const container = document.getElementById('goals-list');
    if (!container) return;

    const activeGoals = (goalsData || []).filter(goal => !goal.archived);
    const archivedGoals = (goalsData || []).filter(goal => goal.archived);
    const symbol = currencySymbols[currentCurrency] || '₽';

    if (activeGoals.length === 0) {
        container.innerHTML = `
            <button class="add-goal-btn" onclick="showAddGoalModal()">
                <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">${t('Добавить первую цель')}</div>
                <div style="font-size: 13px; color: var(--ios-text-tertiary);">${t('Нажмите чтобы начать')}</div>
            </button>
            ${archivedGoals.length > 0 ? `<div class="goal-archive-block"><div class="goal-archive-title">${t('Архив')}</div>${archivedGoals.map(goal => {
                const currentAmount = parseFloat(goal.current_amount) || 0;
                const targetAmount = parseFloat(goal.target_amount) || 0;
                const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
                const color = goal.color || '#FF9500';
                const icon = goal.icon || '🎯';
                return `
                    <div class="goal-card archived">
                        <div class="goal-header">
                            <div class="goal-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 25px ${color}80;">${icon}</div>
                            <div class="goal-info">
                                <div class="goal-name">${goal.name}</div>
                                <div class="goal-date">${goal.deadline || t('Бессрочная')}</div>
                            </div>
                            <div class="goal-amount" style="color: ${color}; text-shadow: 0 0 10px ${color}80;">${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                        </div>
                        <div class="goal-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%; background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
                            </div>
                            <div class="progress-text">
                                <span>${t('Прогресс')}</span>
                                <span>${progress.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div class="debt-actions">
                            <button class="debt-action-btn" onclick="archiveGoal(${goal.id}, false)">${t('Вернуть')}</button>
                        </div>
                    </div>
                `;
            }).join('')}</div>` : ''}
        `;
        return;
    }
    
    let html = '';
    
    activeGoals.forEach(goal => {
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
        const color = goal.color || '#FF9500';
        const icon = goal.icon || '🎯';
        
        html += `
            <div class="goal-card" onclick="addToGoal(${goal.id})">
                <div class="goal-header">
                    <div class="goal-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 25px ${color}80;">${icon}</div>
                    <div class="goal-info">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-date">${goal.deadline || t('Бессрочная')}</div>
                    </div>
                    <div class="goal-amount" style="color: ${color}; text-shadow: 0 0 10px ${color}80;">${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%; background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
                    </div>
                    <div class="progress-text">
                        <span>${t('Прогресс')}</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="debt-actions">
                    <button class="debt-action-btn" onclick="event.stopPropagation(); showAddGoalModal(${goal.id})">${t('Изменить')}</button>
                    <button class="debt-action-btn" onclick="event.stopPropagation(); archiveGoal(${goal.id}, true)">${t('Архивировать')}</button>
                </div>
            </div>
        `;
    });
    
    html += `
        <button class="add-goal-btn" onclick="showAddGoalModal()" style="margin-top: 12px;">
            <div style="font-size: 20px; margin-bottom: 4px;">+</div>
            <div style="font-size: 15px; font-weight: 500;">${t('Добавить цель')}</div>
        </button>
    `;

    if (archivedGoals.length > 0) {
        html += `
            <div class="goal-archive-block">
                <div class="goal-archive-title">${t('Архив')}</div>
                ${archivedGoals.map(goal => {
                    const currentAmount = parseFloat(goal.current_amount) || 0;
                    const targetAmount = parseFloat(goal.target_amount) || 0;
                    const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
                    const color = goal.color || '#FF9500';
                    const icon = goal.icon || '🎯';
                    return `
                        <div class="goal-card archived">
                            <div class="goal-header">
                                <div class="goal-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 25px ${color}80;">${icon}</div>
                                <div class="goal-info">
                                    <div class="goal-name">${goal.name}</div>
                                    <div class="goal-date">${goal.deadline || t('Бессрочная')}</div>
                                </div>
                                <div class="goal-amount" style="color: ${color}; text-shadow: 0 0 10px ${color}80;">${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                            </div>
                            <div class="goal-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progress}%; background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
                                </div>
                                <div class="progress-text">
                                    <span>${t('Прогресс')}</span>
                                    <span>${progress.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="debt-actions">
                                <button class="debt-action-btn" onclick="archiveGoal(${goal.id}, false)">${t('Вернуть')}</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function addToGoal(goalId) {
    const goal = goalsData.find(g => g.id === goalId);
    if (goal && goal.archived) {
        showNotification(t('Цель в архиве'), 'error');
        return;
    }
    selectedGoalId = goalId;
    currentTransactionType = 'savings';
    currentSavingsDestination = 'goal';
    showAddTransactionModal();
}

async function archiveGoal(goalId, archived) {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/goal/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                goal_id: goalId,
                archived: !!archived
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (data.goal) {
            goalsData = goalsData.map(g => g.id === data.goal.id ? { ...g, ...data.goal } : g);
        } else {
            goalsData = goalsData.map(g => g.id === goalId ? { ...g, archived: !!archived } : g);
        }
        if (archived && selectedGoalId === goalId) {
            selectedGoalId = null;
        }
        updateGoalsDisplay();
        updatePanelGoals();
        updateSectionTotals();
        showNotification(archived ? t('Цель архивирована') : t('Цель возвращена'), 'success');
    } catch (error) {
        console.error('❌ Ошибка архивации цели:', error);
        showNotification('Ошибка сохранения', 'error');
    }
}

async function deleteGoal() {
    if (!currentUser || !editingGoalId) return;
    if (!confirm(t('Удалить цель?'))) return;
    try {
        const response = await fetch('/api/goal/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                goal_id: editingGoalId
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        goalsData = (goalsData || []).filter(goal => goal.id !== editingGoalId);
        if (selectedGoalId === editingGoalId) {
            selectedGoalId = null;
            currentSavingsDestination = 'piggybank';
        }
        closeModal('add-goal-modal');
        updateGoalsDisplay();
        updatePanelGoals();
        updateSavingsDisplay();
        updateSectionTotals();
        await loadPanelData();
        if (currentPage === 'report') {
            await loadReportData();
            await updateOverviewTab();
        }
        const movedNote = data.moved_to_piggybank ? ` ${t('Средства переведены в копилку')}` : '';
        showNotification(`${t('Цель удалена')}.${movedNote}`, 'success');
        editingGoalId = null;
    } catch (error) {
        console.error('❌ Ошибка удаления цели:', error);
        showNotification(`${t('Ошибка')}: ${error.message}`, 'error');
    }
}

async function addToGoalApi(goalId, amount, wallet) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/add_to_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                goal_id: goalId,
                amount: amount,
                wallet: wallet
            })
        });
        
        const data = await response.json();
        if (data.error) {
            if (data.error === 'insufficient_funds') {
                throw new Error('insufficient_funds');
            }
            if (data.error === 'goal_archived') {
                throw new Error('goal_archived');
            }
            throw new Error(data.error);
        }
        
        // Обновляем цели и связанные показатели
        await loadGoals();
        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'report') {
            await loadReportData();
        }
        
        return data.success;
        
    } catch (error) {
        console.error('❌ Ошибка добавления в цель:', error);
        throw error;
    }
}

// ==================== //
// ВАЛЮТА //
// ==================== //

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Обновляем символ валюты в интерфейсе
    const currencySymbolElements = document.querySelectorAll('#modal-currency-symbol, #goal-currency-symbol, #debt-currency-symbol');
    currencySymbolElements.forEach(el => {
        el.textContent = symbol;
    });
    
    // Обновляем кнопки валюты в сервисах
    document.querySelectorAll('.currency-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.currency === currentCurrency) {
            option.classList.add('active');
        }
    });
    
    // Обновляем все суммы
    if (currentUser) {
        loadPanelData();
        if (currentPage === 'report') {
            loadReportData();
        }
        if (currentPage === 'history') {
            loadMonthTransactions();
        }
    }
}

async function selectCurrency(currency) {
    if (!currentUser) return;
    
    currentCurrency = currency;
    localStorage.setItem('finance_currency', currency);
    
    try {
        await fetch('/api/update_currency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                currency: currency
            })
        });
        
        updateCurrencyDisplay();
        showNotification(`${t('Валюта изменена на')} ${currency}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка обновления валюты:', error);
        showNotification('Ошибка изменения валюты', 'error');
    }
}

// ==================== //
// ВЫБОР ОСНОВНОГО КОШЕЛЬКА //
// ==================== //

async function loadDefaultWallet() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                session_token: sessionToken
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        defaultWallet = data.default_wallet || 'Карта';
        walletsData = data.wallets || [];
        
        // Обновляем отображение основного кошелька в сервисах
        updateDefaultWalletDisplay();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки основного кошелька:', error);
    }
}

function updateDefaultWalletDisplay() {
    const defaultWalletDisplay = document.querySelector('.default-wallet-display');
    const defaultWalletName = document.querySelector('.default-wallet-name');
    const defaultWalletIcon = document.querySelector('.default-wallet-icon');
    
    if (!defaultWalletDisplay || !defaultWalletName || !defaultWalletIcon) return;
    
    // Находим текущий основной кошелёк
    const defaultWalletData = walletsData.find(w => w.name === defaultWallet);
    
    if (defaultWalletData) {
        defaultWalletName.textContent = t(defaultWalletData.name);
        defaultWalletIcon.textContent = defaultWalletData.icon || '💳';
        defaultWalletIcon.style.boxShadow = '0 0 20px var(--ios-accent-glow)';
    } else {
        defaultWalletName.textContent = t(defaultWallet);
        defaultWalletIcon.textContent = '💳';
    }
    
    // Обновляем выпадающий список
    updateWalletDropdown();
}

function updateWalletDropdown() {
    const walletDropdown = document.getElementById('wallet-dropdown');
    if (!walletDropdown) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let html = '';
    
    walletsData.forEach(wallet => {
        const isDefault = wallet.name === defaultWallet;
        
        html += `
            <div class="wallet-option ${isDefault ? 'active' : ''}" onclick="selectDefaultWallet('${wallet.name}')">
                <div class="wallet-option-info">
                    <div class="wallet-option-icon">${wallet.icon || '💳'}</div>
                    <div class="wallet-option-text">
                    <div class="wallet-option-name">${t(wallet.name)}</div>
                        <div class="wallet-option-balance">${formatCurrency(wallet.balance || 0)} ${symbol}</div>
                    </div>
                </div>
                <div class="wallet-option-check">
                    ${isDefault ? '✓' : ''}
                </div>
            </div>
        `;
    });
    
    walletDropdown.innerHTML = html;
}

function toggleWalletDropdown() {
    const dropdown = document.getElementById('wallet-dropdown');
    const display = document.querySelector('.default-wallet-display');
    
    if (dropdown && display) {
        dropdown.classList.toggle('active');
        display.classList.toggle('active');
    }
}

async function selectDefaultWallet(walletName) {
    if (!currentUser || !walletName) return;
    
    try {
        const response = await fetch('/api/set_default_wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                wallet_name: walletName
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Обновляем локальные данные
        walletsData.forEach(wallet => {
            wallet.is_default = wallet.name === walletName;
        });
        defaultWallet = walletName;
        
        // Обновляем отображение
        updateDefaultWalletDisplay();
        updateWalletsDisplay();
        
        // Закрываем выпадающий список
        toggleWalletDropdown();
        
        showNotification(`${t('Кошелёк выбран по умолчанию')}: ${walletName}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка установки кошелька:', error);
        showNotification('Ошибка установки кошелька', 'error');
    }
}

// ==================== //
// МОДАЛЬНЫЕ ОКНА И ФОРМЫ //
/* ИСПРАВЛЕНО: выбор накоплений (копилка/цель) */
// ==================== //

function showAddTransactionModal(prefilledCategory = null) {
    if (!subscriptionActive && !editingTransactionId) {
        openSubscriptionModal();
        return;
    }
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;

    updateDebtsUI(false);
    
    // Сбрасываем форму
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-description').value = '';
    const dateTimeInput = document.getElementById('transaction-date-time');
    const dateTimeGroup = document.getElementById('transaction-date-time-group');
    if (dateTimeInput) {
        dateTimeInput.value = '';
    }
    if (dateTimeGroup) {
        dateTimeGroup.style.display = editingTransactionId ? '' : 'none';
    }
    
    // Устанавливаем тип транзакции
    const typeTabs = document.querySelectorAll('.modal-tab');
    typeTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.type === currentTransactionType) {
            tab.classList.add('active');
        }
    });
    
    // Обновляем заголовок
    const titleMap = {
        'income': t('Добавить доход'),
        'expense': t('Добавить расход'),
        'savings': t('Добавить накопление'),
        'debt': t('Добавить долг')
    };
    document.getElementById('transaction-modal-title').textContent = titleMap[currentTransactionType] || t('Добавить операцию');

    const deleteBtn = document.getElementById('transaction-delete-btn');
    if (deleteBtn) {
        deleteBtn.style.display = editingTransactionId ? 'inline-flex' : 'none';
    }
    
    // Заполняем категории
    populateTransactionCategories();
    updateTransactionCategoryVisibility();
    
    // Заполняем кошельки
    populateWallets();
    
    // Устанавливаем категорию если передана
    if (prefilledCategory) {
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.value = prefilledCategory;
        }
    }
    
    // Показываем модальное окно
    modal.classList.add('active');
    updateBodyModalState();
    
    // Настройка для накоплений
    setupSavingsDestination();
    setupDebtSelector();
    
    // Фокус на сумму
    setTimeout(() => {
        document.getElementById('transaction-amount').focus();
    }, 100);
}

function populateTransactionCategories() {
    const select = document.getElementById('transaction-category');
    if (!select) return;
    
    select.innerHTML = '';
    select.disabled = false;

    if (currentTransactionType === 'debt') {
        const option = document.createElement('option');
        option.value = 'Долги';
        option.textContent = t('Долги');
        select.appendChild(option);
        select.disabled = true;
        return;
    }
    
    let categories = [];
    if (currentTransactionType === 'income') {
        categories = categoriesData.income || [];
    } else if (currentTransactionType === 'expense') {
        categories = categoriesData.expense || [];
    } else if (currentTransactionType === 'savings') {
        categories = categoriesData.savings || [];
    }
    
    // Добавляем существующие категории
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = t(cat.name);
        select.appendChild(option);
    });
    
    // Добавляем опцию для новой категории
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = `+ ${t('Новая категория')}`;
    select.appendChild(newOption);
}

function populateWallets() {
    const select = document.getElementById('transaction-wallet');
    if (!select) return;
    
    select.innerHTML = '';
    
    walletsData.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.name;
        option.textContent = `${t(wallet.name)} ${wallet.name === defaultWallet ? `(${t('по умолчанию')})` : ''}`;
        if (wallet.name === defaultWallet) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    const hasSavingsWallet = walletsData.some(wallet => wallet.name === 'Накопления');
    const savingsAmount = getSavingsAmount();
    if (!hasSavingsWallet && savingsAmount > 0) {
        const option = document.createElement('option');
        option.value = 'Накопления';
        option.textContent = t('Накопления');
        select.appendChild(option);
    }
}

function openDebtModal(debtId = null) {
    const modal = document.getElementById('add-debt-modal');
    if (!modal) return;
    editingDebtId = debtId;
    const nameInput = document.getElementById('debt-name-input');
    const amountInput = document.getElementById('debt-amount-input');
    const noteInput = document.getElementById('debt-note-input');
    const title = modal.querySelector('.modal-title');
    const submitText = document.getElementById('debt-submit-text');
    const deleteBtn = document.getElementById('debt-delete-btn');

    if (editingDebtId) {
        const debt = debtsData.find(d => d.id === editingDebtId);
        if (debt) {
            if (nameInput) nameInput.value = debt.name || '';
            if (amountInput) amountInput.value = debt.target_amount || '';
            if (noteInput) noteInput.value = debt.note || '';
        }
        if (title) title.textContent = t('Изменить долг');
        if (submitText) submitText.textContent = t('Сохранить');
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
        if (nameInput) nameInput.value = '';
        if (amountInput) amountInput.value = '';
        if (noteInput) noteInput.value = '';
        if (title) title.textContent = t('Создать долг');
        if (submitText) submitText.textContent = t('Создать долг');
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    modal.classList.add('active');
    updateBodyModalState();
    setTimeout(() => (nameInput || amountInput)?.focus(), 100);
}

function closeDebtModal() {
    const modal = document.getElementById('add-debt-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
    editingDebtId = null;
}

async function saveDebt(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('debt-name-input');
    const amountInput = document.getElementById('debt-amount-input');
    const noteInput = document.getElementById('debt-note-input');
    if (!amountInput || !currentUser || !nameInput) return;
    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const note = noteInput ? noteInput.value.trim() : '';
    if (!name) {
        showNotification('Введите название долга', 'error');
        return;
    }
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    try {
        const endpoint = editingDebtId ? '/api/debt/update' : '/api/debt';
        const payload = {
            user_id: currentUser.id,
            name: name,
            amount: amount,
            note: note
        };
        if (editingDebtId) payload.debt_id = editingDebtId;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (data.debt) {
            if (editingDebtId) {
                debtsData = debtsData.map(d => d.id === data.debt.id ? data.debt : d);
            } else {
                debtsData = [data.debt, ...debtsData];
            }
        }
        debtsEnabled = !!data.debts_enabled;
        updateDebtsUI(true);
        updateDebtsDisplay();
        updateSectionTotals();
        updatePanelCategories();
        if (!currentDebtId && data.debt) currentDebtId = data.debt.id;
        closeDebtModal();
        showNotification(editingDebtId ? t('Долг обновлён') : t('Долг создан'), 'success');
        editingDebtId = null;
    } catch (error) {
        console.error('❌ Ошибка сохранения долга:', error);
        showNotification('Ошибка сохранения', 'error');
    }
}

async function deleteDebt() {
    if (!editingDebtId || !currentUser) return;
    if (!confirm(t('Удалить долг') + '?')) return;
    try {
        const response = await fetch('/api/debt/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                debt_id: editingDebtId
            })
        });
        const data = await response.json();
        if (data.error) {
            if (data.error === 'debt_has_payments') {
                showNotification(t('Нельзя удалить долг с платежами'), 'error');
                return;
            }
            throw new Error(data.error);
        }
        debtsData = debtsData.filter(d => d.id !== editingDebtId);
        if (currentDebtId === editingDebtId) {
            const active = debtsData.find(d => !d.archived);
            currentDebtId = active ? active.id : null;
        }
        editingDebtId = null;
        updateDebtsUI(true);
        updateDebtsDisplay();
        updateSectionTotals();
        updatePanelCategories();
        closeDebtModal();
        showNotification(t('Долг удалён'), 'success');
    } catch (error) {
        console.error('❌ Ошибка удаления долга:', error);
        showNotification('Ошибка удаления', 'error');
    }
}

async function archiveDebt(debtId, archived) {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/debt/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                debt_id: debtId,
                archived: !!archived
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        debtsData = debtsData.map(d => d.id === debtId ? { ...d, archived: !!archived } : d);
        updateDebtsUI(true);
        updateDebtsDisplay();
        updateSectionTotals();
        updatePanelCategories();
    } catch (error) {
        console.error('❌ Ошибка архивации:', error);
        showNotification('Ошибка сохранения', 'error');
    }
}

function updateTransactionCategoryVisibility() {
    const group = document.getElementById('transaction-category-group');
    const select = document.getElementById('transaction-category');
    if (!group) return;
    if (currentTransactionType === 'debt') {
        group.style.display = 'none';
        if (select) select.disabled = true;
    } else {
        group.style.display = '';
        if (select) select.disabled = false;
    }
}

// ИСПРАВЛЕНО: настройка выбора накоплений
function setupSavingsDestination() {
    const form = document.getElementById('add-transaction-form');
    const amountField = document.getElementById('transaction-amount').parentNode.parentNode;
    
    // Удаляем старые элементы если есть
    const oldDestination = document.getElementById('savings-destination');
    const oldGoalSelector = document.getElementById('goal-selector');
    if (oldDestination) oldDestination.remove();
    if (oldGoalSelector) oldGoalSelector.remove();
    
    // Для накоплений добавляем выбор назначения
    if (currentTransactionType === 'savings') {
        // Добавляем выбор назначения после поля суммы
        const destinationHTML = `
            <div class="form-group" id="savings-destination">
                <label class="form-label">${t('Куда накопления?')}</label>
                <div class="savings-destination">
                    <button type="button" class="destination-option ${currentSavingsDestination === 'piggybank' ? 'active' : ''}" 
                            data-destination="piggybank" onclick="selectSavingsDestination('piggybank')">
                        <div class="destination-icon">💰</div>
                        <div>${t('В копилку')}</div>
                    </button>
                    <button type="button" class="destination-option ${currentSavingsDestination === 'goal' ? 'active' : ''}" 
                            data-destination="goal" onclick="selectSavingsDestination('goal')">
                        <div class="destination-icon">🎯</div>
                        <div>${t('На цель')}</div>
                    </button>
                </div>
            </div>
        `;
        
        // Вставляем после поля суммы
        amountField.insertAdjacentHTML('afterend', destinationHTML);
        
        // Если есть цели, добавляем выбор цели
        const activeGoals = goalsData.filter(goal => !goal.archived);
        if (activeGoals.length > 0 && currentSavingsDestination === 'goal') {
            const goalSelectorHTML = `
                <div class="form-group" id="goal-selector">
                    <label class="form-label">${t('Выберите цель')}</label>
                    <div id="goal-options" style="max-height: 200px; overflow-y: auto;">
                        ${generateGoalOptions()}
                    </div>
                </div>
            `;
            document.getElementById('savings-destination').insertAdjacentHTML('afterend', goalSelectorHTML);
        } else if (currentSavingsDestination === 'goal') {
            const emptyHTML = `
                <div class="form-group" id="goal-selector">
                    <label class="form-label">${t('Цель')}</label>
                    <div style="color: var(--ios-text-secondary); font-size: 14px; margin-bottom: 12px;">
                        ${t('Сначала создайте цель')}
                    </div>
                    <button type="button" class="modal-btn secondary" onclick="showAddGoalModal()" style="width: 100%;">
                        <span>${t('Создать цель')}</span>
                    </button>
                </div>
            `;
            document.getElementById('savings-destination').insertAdjacentHTML('afterend', emptyHTML);
        }
    }
}

function setupDebtSelector() {
    const amountField = document.getElementById('transaction-amount')?.parentNode?.parentNode;
    const oldSelector = document.getElementById('debt-selector');
    if (oldSelector) oldSelector.remove();
    if (currentTransactionType !== 'debt' || !amountField) return;

    const activeDebts = debtsData.filter(debt => !debt.archived);
    if (!activeDebts.length) {
        const emptyHTML = `
            <div class="form-group" id="debt-selector">
                <label class="form-label">${t('Долг')}</label>
                <div style="color: var(--ios-text-secondary); font-size: 14px; margin-bottom: 12px;">
                    ${t('Сначала создайте долг')}
                </div>
                <button type="button" class="modal-btn secondary" onclick="openDebtModal()" style="width: 100%;">
                    <span>${t('Создать долг')}</span>
                </button>
            </div>
        `;
        amountField.insertAdjacentHTML('afterend', emptyHTML);
        return;
    }
    
    if (!currentDebtId || !activeDebts.some(d => d.id === currentDebtId)) {
        currentDebtId = activeDebts[0].id;
    }
    
    const selectorHTML = `
        <div class="form-group" id="debt-selector">
            <label class="form-label">${t('Выберите долг')}</label>
            <div id="debt-options" style="max-height: 200px; overflow-y: auto;">
                ${generateDebtOptions(activeDebts)}
            </div>
        </div>
    `;
    amountField.insertAdjacentHTML('afterend', selectorHTML);
}

function generateDebtOptions(list) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    return (list || []).map(debt => {
        const paid = Number(debt.paid_amount) || 0;
        const target = Number(debt.target_amount) || 0;
        const progress = target > 0 ? Math.min((paid / target) * 100, 100) : 0;
        const isSelected = debt.id === currentDebtId;
        const color = '#AF52DE';
        
        return `
            <div class="goal-option ${isSelected ? 'active' : ''}" onclick="selectDebt(${debt.id})">
                <div class="goal-option-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    💸
                </div>
                <div class="goal-option-info">
                    <div class="goal-option-name">${debt.name}</div>
                    <div class="goal-option-details">
                        ${formatCurrency(paid)} / ${formatCurrency(target)} ${symbol} (${progress.toFixed(1)}%)
                    </div>
                    <div class="goal-option-progress">
                        <div class="goal-option-progress-fill" style="width: ${progress}%; background: ${color}; color: ${color};"></div>
                    </div>
                </div>
                <div class="goal-option-check">
                    ${isSelected ? '✓' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function selectDebt(debtId) {
    currentDebtId = debtId;
    document.querySelectorAll('#debt-options .goal-option').forEach(option => {
        option.classList.remove('active');
    });
    const selectedOption = document.querySelector(`#debt-options .goal-option[onclick="selectDebt(${debtId})"]`);
    if (selectedOption) {
        selectedOption.classList.add('active');
        const check = selectedOption.querySelector('.goal-option-check');
        if (check) check.textContent = '✓';
    }
    document.querySelectorAll('#debt-options .goal-option').forEach(option => {
        if (!option.classList.contains('active')) {
            const check = option.querySelector('.goal-option-check');
            if (check) check.textContent = '';
        }
    });
}

function selectSavingsDestination(destination) {
    currentSavingsDestination = destination;
    selectedGoalId = null;
    
    // Обновляем активные кнопки
    document.querySelectorAll('.destination-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.destination === destination) {
            btn.classList.add('active');
        }
    });
    
    // Обновляем выбор цели
    const goalSelector = document.getElementById('goal-selector');
    if (goalSelector) {
        const activeGoals = goalsData.filter(goal => !goal.archived);
        if (destination === 'goal' && activeGoals.length > 0) {
            goalSelector.style.display = 'block';
            document.getElementById('goal-options').innerHTML = generateGoalOptions();
        } else {
            goalSelector.style.display = 'none';
        }
    } else if (destination === 'goal' && goalsData.filter(goal => !goal.archived).length > 0) {
        // Создаем выбор цели если его нет
        const goalSelectorHTML = `
            <div class="form-group" id="goal-selector">
                <label class="form-label">${t('Выберите цель')}</label>
                <div id="goal-options" style="max-height: 200px; overflow-y: auto;">
                    ${generateGoalOptions()}
                </div>
            </div>
        `;
        const savingsDestination = document.getElementById('savings-destination');
        if (savingsDestination) {
            savingsDestination.insertAdjacentHTML('afterend', goalSelectorHTML);
        }
    } else if (destination === 'goal') {
        const emptyHTML = `
            <div class="form-group" id="goal-selector">
                <label class="form-label">${t('Цель')}</label>
                <div style="color: var(--ios-text-secondary); font-size: 14px; margin-bottom: 12px;">
                    ${t('Сначала создайте цель')}
                </div>
                <button type="button" class="modal-btn secondary" onclick="showAddGoalModal()" style="width: 100%;">
                    <span>${t('Создать цель')}</span>
                </button>
            </div>
        `;
        const savingsDestination = document.getElementById('savings-destination');
        if (savingsDestination) {
            savingsDestination.insertAdjacentHTML('afterend', emptyHTML);
        }
    }
}

function generateGoalOptions() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    const activeGoals = goalsData.filter(goal => !goal.archived);
    return activeGoals.map(goal => {
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
        const isSelected = goal.id === selectedGoalId;
        const color = goal.color || '#FF9500';
        
        return `
            <div class="goal-option ${isSelected ? 'active' : ''}" onclick="selectGoal(${goal.id})">
                <div class="goal-option-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${goal.icon || '🎯'}
                </div>
                <div class="goal-option-info">
                    <div class="goal-option-name">${goal.name}</div>
                    <div class="goal-option-details">
                        ${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol} (${progress.toFixed(1)}%)
                    </div>
                    <div class="goal-option-progress">
                        <div class="goal-option-progress-fill" style="width: ${progress}%; background: ${color}; color: ${color};"></div>
                    </div>
                </div>
                <div class="goal-option-check">
                    ${isSelected ? '✓' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function selectGoal(goalId) {
    selectedGoalId = goalId;
    
    // Убираем выделение со всех целей
    document.querySelectorAll('.goal-option').forEach(option => {
        option.classList.remove('active');
    });
    
    // Выделяем выбранную цель
    const selectedOption = document.querySelector(`.goal-option[onclick="selectGoal(${goalId})"]`);
    if (selectedOption) {
        selectedOption.classList.add('active');
    }
}

async function submitTransaction(e) {
    if (e) e.preventDefault();
    
    const amountInput = document.getElementById('transaction-amount');
    const categorySelect = document.getElementById('transaction-category');
    const walletSelect = document.getElementById('transaction-wallet');
    const descriptionInput = document.getElementById('transaction-description');
    const dateTimeInput = document.getElementById('transaction-date-time');
    
    if (!amountInput || !categorySelect || !currentUser) return;
    
    const amount = parseFloat(amountInput.value);
    let category = categorySelect.value;
    const wallet = walletSelect ? walletSelect.value : defaultWallet;
    const description = descriptionInput?.value || '';
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }

    if (currentTransactionType === 'debt') {
        if (!currentDebtId) {
            showNotification(t('Сначала создайте долг'), 'error');
            openDebtModal();
            return;
        }
        category = 'Долги';
    }
    
    if (!category || category === '__new__') {
        showAddCategoryModal(currentTransactionType);
        return;
    }
    
    const isEditing = editingTransactionId !== null;

    // Обработка накоплений
    let goalAdded = false;
    if (currentTransactionType === 'savings') {
        if (!isEditing && currentSavingsDestination === 'goal' && selectedGoalId) {
            try {
                const walletForGoal = walletSelect ? walletSelect.value : defaultWallet;
                await addToGoalApi(selectedGoalId, amount, walletForGoal);
                goalAdded = true;
                showNotification('Накопления добавлены в цель', 'success');
            } catch (error) {
                console.error('❌ Ошибка добавления в цель:', error);
                if (error && error.message === 'insufficient_funds') {
                    showNotification('Недостаточно средств на выбранном кошельке', 'error');
                    return;
                }
                if (error && error.message === 'goal_archived') {
                    showNotification(t('Цель в архиве'), 'error');
                    return;
                }
                showNotification('Ошибка добавления в цель', 'error');
                return;
            }
        }
        // Для накоплений используем категорию "Накопления"
        category = 'Накопления';
    }
    
    // Если накопления уже добавлены в цель, не добавляем транзакцию
    if (!isEditing && currentTransactionType === 'savings' && currentSavingsDestination === 'goal' && goalAdded) {
        closeModal('add-transaction-modal');
        amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Обновляем данные
        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'report') {
            await loadReportData();
        }
        return;
    }
    
    try {
        let transactionType = currentTransactionType;
        if (currentTransactionType === 'savings' || currentTransactionType === 'debt') {
            transactionType = 'expense';
        }
        const endpoint = isEditing ? '/api/transaction/update' : '/api/transaction';
        const payload = {
            user_id: currentUser.id,
            type: transactionType,
            amount: amount,
            category: category,
            wallet: wallet,
            description: description
        };
        if (currentTransactionType === 'debt') {
            payload.debt_id = currentDebtId;
        }
        if (isEditing) {
            payload.transaction_id = editingTransactionId;
            if (dateTimeInput && dateTimeInput.value) {
                payload.date = dateTimeInput.value;
            }
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            if (data.error === 'subscription_required') {
                closeModal('add-transaction-modal');
                openSubscriptionModal();
                return;
            }
            if (data.error === 'insufficient_funds') {
                showNotification('Недостаточно средств на выбранном кошельке', 'error');
                return;
            }
            throw new Error(data.error);
        }
        
        // Обновляем данные
        categoryStats = data.category_stats || categoryStats;
        if (data.wallets) {
            data.wallets.forEach(walletUpdate => {
                const wallet = walletsData.find(w => w.name === walletUpdate.name);
                if (wallet) wallet.balance = walletUpdate.balance;
            });
        }

        if (category === 'Накопления' || category === 'Цели') {
            const exists = categoriesData.expense?.some(cat => cat.name === category);
            if (!exists) {
                const icon = category === 'Цели' ? '🎯' : '💰';
                const color = category === 'Цели' ? '#FF9500' : '#FFD166';
                categoriesData.expense = [{ name: category, icon, color }, ...(categoriesData.expense || [])];
            }
        }
        
        // Обновляем интерфейс
        updateBalanceDisplay(data.summary);
        updateSectionTotals();
        if (currentPage === 'panel') {
            updatePanelCategories();
        }
        
        if (data.recent_transactions) {
            allTransactions = data.recent_transactions;
            updateRecentTransactions(allTransactions);
        }
        
        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'history') {
            loadMonthTransactions();
        } else if (currentPage === 'report') {
            loadReportData();
        }
        
        // Закрываем и очищаем
        closeModal('add-transaction-modal');
        resetTransactionEditing();
        amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Уведомление
        if (isEditing) {
            showNotification('Операция обновлена', 'success');
        } else {
            if (currentTransactionType === 'debt') {
                showNotification(t('Долг добавлен'), 'success');
            } else {
                const messages = {
                    'income': '✅ Доход добавлен',
                    'expense': '✅ Расход добавлен',
                    'savings': '✅ Накопление добавлено'
                };
                showNotification(messages[currentTransactionType] || 'Операция добавлена', 'success');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка добавления транзакции:', error);
        showNotification(`${t('Ошибка')}: ${error.message}`, 'error');
    }
}

function showAddCategoryModal(type) {
    const modal = document.getElementById('add-category-modal');
    if (!modal) return;
    
    const title = modal.querySelector('.modal-title');
    const titleMap = {
        'income': t('Добавить категорию дохода'),
        'expense': t('Добавить категорию расхода'),
        'savings': t('Добавить категорию накопления')
    };
    
    title.textContent = titleMap[type] || t('Добавить категорию');
    modal.dataset.categoryType = type;

    const nameInput = document.getElementById('category-name-input');
    if (nameInput) {
        const placeholderByType = {
            income: 'Например: Зарплата за февраль',
            expense: 'Например: Кафе',
            savings: 'Например: Копилка'
        };
        const placeholderKey = placeholderByType[type] || 'Например: Кафе';
        nameInput.setAttribute('data-i18n-placeholder', placeholderKey);
        nameInput.setAttribute('placeholder', t(placeholderKey));
    }
    
    fillIconsGrid();
    setupColorPicker();
    
    modal.classList.add('active');
    updateBodyModalState();
    
    setTimeout(() => {
        document.getElementById('category-name-input').focus();
    }, 100);
}

function fillIconsGrid() {
    const grid = document.getElementById('icons-grid');
    if (!grid) return;
    
    const icons = ['💰', '💵', '💳', '🏠', '🛒', '🚗', '🍕', '🎬', '📈', '🐷', '✈️', '🎁', '🏥', '📱', '👕', '🎓', '⚽', '🍔', '☕', '📚'];
    
    grid.innerHTML = '';
    icons.forEach(icon => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-option';
        button.textContent = icon;
        button.dataset.icon = icon;
        
        button.onclick = function() {
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        };
        
        grid.appendChild(button);
    });
    
    if (grid.firstChild) {
        grid.firstChild.classList.add('selected');
    }
}

function setupColorPicker() {
    const colorGrid = document.getElementById('color-grid');
    if (!colorGrid) return;
    
    colorGrid.innerHTML = '';
    colorPalette.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-option-small';
        div.style.backgroundColor = color;
        div.dataset.color = color;
        
        div.onclick = function() {
            document.querySelectorAll('.color-option-small').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        };
        
        colorGrid.appendChild(div);
    });
    
    if (colorGrid.firstChild) {
        colorGrid.firstChild.classList.add('selected');
    }
}

async function addNewCategory() {
    const nameInput = document.getElementById('category-name-input');
    const iconsGrid = document.getElementById('icons-grid');
    const colorGrid = document.getElementById('color-grid');
    
    if (!nameInput || !iconsGrid || !colorGrid) return;
    
    const name = nameInput.value.trim();
    const selectedIcon = iconsGrid.querySelector('.icon-option.selected');
    const selectedColor = colorGrid.querySelector('.color-option-small.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '💰';
    const color = selectedColor ? selectedColor.dataset.color : '#007AFF';
    const type = document.getElementById('add-category-modal').dataset.categoryType;
    
    if (!name) {
        showNotification('Введите название категории', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/add_category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                type: type,
                name: name,
                icon: icon,
                color: color
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Добавляем категорию в данные
        if (!categoriesData[type]) {
            categoriesData[type] = [];
        }
        categoriesData[type].push({
            name: name,
            icon: icon,
            color: color
        });
        
        // Обновляем интерфейс
        if (currentPage === 'panel') {
            updatePanelCategories();
            if (type === 'savings') {
                updateSavingsDisplay();
            }
        }
        
        closeModal('add-category-modal');
        nameInput.value = '';
        
        showNotification(`${t('Категория добавлена')}: ${name}`, 'success');
        
        // Автоматически выбираем новую категорию в форме транзакции
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            const option = Array.from(categorySelect.options).find(opt => opt.value === name);
            if (option) {
                categorySelect.value = name;
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка добавления категории:', error);
        showNotification('Ошибка добавления категории', 'error');
    }
}

function showAddGoalModal(goalId = null) {
    const modal = document.getElementById('add-goal-modal');
    if (!modal) return;
    editingGoalId = goalId;

    const titleEl = document.getElementById('goal-modal-title');
    const submitText = document.getElementById('goal-submit-text');
    const nameInput = document.getElementById('goal-name-input');
    const amountInput = document.getElementById('goal-target-amount');
    const deadlineSelect = document.getElementById('goal-deadline');
    const customDateInput = document.getElementById('goal-custom-date');
    const customDateContainer = document.getElementById('custom-date-container');
    const deleteBtn = document.getElementById('goal-delete-btn');

    const goal = editingGoalId ? goalsData.find(g => g.id === editingGoalId) : null;
    if (titleEl) titleEl.textContent = goal ? t('Изменить цель') : t('Новая цель');
    if (submitText) submitText.textContent = goal ? t('Сохранить') : t('Создать цель');
    if (deleteBtn) deleteBtn.style.display = goal ? 'inline-flex' : 'none';

    if (nameInput) nameInput.value = goal?.name || '';
    if (amountInput) amountInput.value = goal?.target_amount || '';
    if (deadlineSelect) deadlineSelect.value = 'none';
    if (customDateInput) customDateInput.value = '';
    if (customDateContainer) customDateContainer.style.display = 'none';

    // Заполняем иконки
    const iconsGrid = document.getElementById('goal-icons-grid');
    if (iconsGrid) {
        const icons = ['🎯', '💰', '🏠', '🚗', '✈️', '📱', '💻', '👕', '🎁', '🍔'];
        iconsGrid.innerHTML = '';
        icons.forEach(icon => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.textContent = icon;
            button.dataset.icon = icon;
            
            button.onclick = function() {
                document.querySelectorAll('#goal-icons-grid .icon-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            };
            
            iconsGrid.appendChild(button);
        });
        const selectedIcon = goal?.icon || iconsGrid.firstChild?.dataset.icon;
        const selectedButton = selectedIcon
            ? iconsGrid.querySelector(`.icon-option[data-icon="${selectedIcon}"]`)
            : null;
        if (selectedButton) {
            selectedButton.classList.add('selected');
        } else if (iconsGrid.firstChild) {
            iconsGrid.firstChild.classList.add('selected');
        }
    }
    
    // Заполняем цвета
    const colorGrid = document.getElementById('goal-color-grid');
    if (colorGrid) {
        colorGrid.innerHTML = '';
        colorPalette.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-option-small';
            div.style.backgroundColor = color;
            div.dataset.color = color;
            
            div.onclick = function() {
                document.querySelectorAll('#goal-color-grid .color-option-small').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            };
            
            colorGrid.appendChild(div);
        });
        const selectedColor = goal?.color || colorGrid.firstChild?.dataset.color;
        const selectedDiv = selectedColor
            ? colorGrid.querySelector(`.color-option-small[data-color="${selectedColor}"]`)
            : null;
        if (selectedDiv) {
            selectedDiv.classList.add('selected');
        } else if (colorGrid.firstChild) {
            colorGrid.firstChild.classList.add('selected');
        }
    }
    
    // Обработчик выбора срока
    if (deadlineSelect && customDateContainer) {
        deadlineSelect.onchange = function() {
            customDateContainer.style.display = this.value === 'custom' ? 'block' : 'none';
        };
    }

    if (goal && deadlineSelect) {
        const optionMatch = Array.from(deadlineSelect.options).find(option => option.text === goal.deadline);
        if (optionMatch) {
            deadlineSelect.value = optionMatch.value;
        } else if (goal.deadline) {
            deadlineSelect.value = 'custom';
            if (customDateInput) customDateInput.value = goal.deadline;
            if (customDateContainer) customDateContainer.style.display = 'block';
        }
    }
    
    modal.classList.add('active');
    updateBodyModalState();
    
    setTimeout(() => {
        document.getElementById('goal-name-input').focus();
    }, 100);
}

async function addNewGoal(e) {
    if (e) e.preventDefault();
    if (isCreatingGoal) return;
    isCreatingGoal = true;
    
    const nameInput = document.getElementById('goal-name-input');
    const amountInput = document.getElementById('goal-target-amount');
    const deadlineSelect = document.getElementById('goal-deadline');
    const customDateInput = document.getElementById('goal-custom-date');
    const iconsGrid = document.getElementById('goal-icons-grid');
    const colorGrid = document.getElementById('goal-color-grid');
    
    if (!nameInput || !amountInput) return;
    
    const name = nameInput.value.trim();
    const amount = parseFloat((amountInput.value || '').replace(',', '.'));
    const selectedIcon = iconsGrid?.querySelector('.icon-option.selected');
    const selectedColor = colorGrid?.querySelector('.color-option-small.selected');
    
    const icon = selectedIcon ? selectedIcon.dataset.icon : '🎯';
    const color = selectedColor ? selectedColor.dataset.color : '#FF9500';
    
    let deadline = '';
    if (deadlineSelect.value === 'custom') {
        deadline = customDateInput.value;
    } else if (deadlineSelect.value !== 'none') {
        deadline = deadlineSelect.options[deadlineSelect.selectedIndex].text;
    }
    
    if (!name) {
        showNotification('Введите название цели', 'error');
        isCreatingGoal = false;
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        isCreatingGoal = false;
        return;
    }
    
    try {
        if (!currentUser || !currentUser.id) {
            showNotification('Сессия устарела, перезайдите', 'error');
            isCreatingGoal = false;
            return;
        }
        const isEditing = !!editingGoalId;
        const endpoint = isEditing ? '/api/goal/update' : '/api/add_goal';
        const payload = {
            user_id: currentUser.id,
            name: name,
            target_amount: amount,
            icon: icon,
            color: color,
            deadline: deadline
        };
        if (isEditing) payload.goal_id = editingGoalId;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        let createdGoalId = null;
        if (data.goal) {
            const goalData = data.goal;
            createdGoalId = goalData.id;
            const existingIndex = goalsData.findIndex(g => g.id === goalData.id);
            if (existingIndex >= 0) {
                goalsData[existingIndex] = { ...goalsData[existingIndex], ...goalData };
            } else {
                goalsData.unshift(goalData);
            }
        } else if (data.goal_id) {
            createdGoalId = data.goal_id;
            goalsData.push({
                id: data.goal_id,
                name: name,
                target_amount: amount,
                current_amount: 0,
                icon: icon,
                color: color,
                deadline: deadline,
                archived: false
            });
        }
        
        // Обновляем интерфейс
        updateGoalsDisplay();
        updatePanelGoals();
        updateSectionTotals();
        
        closeModal('add-goal-modal');
        if (createdGoalId && currentSavingsDestination === 'goal') {
            selectedGoalId = createdGoalId;
        }
        const addTransactionModal = document.getElementById('add-transaction-modal');
        if (addTransactionModal && addTransactionModal.classList.contains('active')) {
            setupSavingsDestination();
        }
        nameInput.value = '';
        amountInput.value = '';
        
        showNotification(isEditing ? t('Цель обновлена') : `${t('Цель создана')}: ${name}`, 'success');
        editingGoalId = null;
        isCreatingGoal = false;
        
    } catch (error) {
        console.error('❌ Ошибка создания цели:', error);
        showNotification('Ошибка создания цели', 'error');
        isCreatingGoal = false;
    }
}

// ==================== //
// НАВИГАЦИЯ //
// ==================== //

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.onclick = function() {
            const pageName = this.dataset.page;
            switchPage(pageName);
        };
    });
}

function switchPage(pageName) {
    console.log('🔄 Переключаем на страницу:', pageName);
    
    // Обновляем активную вкладку
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    // Показываем страницу
    document.querySelectorAll('.page').forEach(pageEl => {
        pageEl.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageName;
        
        // Загружаем данные для страницы
        switch(pageName) {
            case 'panel':
                loadPanelData();
                break;
            case 'history':
                loadHistoryPage();
                break;
            case 'report':
                loadReportPage();
                break;
            case 'invest':
                loadInvestPage();
                break;
            case 'services':
                loadDefaultWallet();
                refreshSubscriptionInfo();
                break;
        }
    }
}

// ==================== //
// ОБРАБОТЧИКИ СОБЫТИЙ //
// ==================== //

function initEventListeners() {
    // Выбор типа транзакции
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.onclick = function() {
            currentTransactionType = this.dataset.type;
            selectedGoalId = null;
            currentSavingsDestination = 'piggybank';
            
            // Обновляем активную вкладку
            document.querySelectorAll('.modal-tab').forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // Обновляем заголовок
            const titleMap = {
                'income': t('Добавить доход'),
                'expense': t('Добавить расход'),
                'savings': t('Добавить накопление'),
                'debt': t('Добавить долг')
            };
            document.getElementById('transaction-modal-title').textContent = editingTransactionId ? t('Изменить операцию') : (titleMap[currentTransactionType] || t('Добавить операцию'));
            
            // Обновляем категории
            populateTransactionCategories();
            updateTransactionCategoryVisibility();
            
            // Настройка для накоплений
            setupSavingsDestination();
            setupDebtSelector();
        };
    });
    
    // Форма транзакции
    const transactionForm = document.getElementById('add-transaction-form');
    if (transactionForm) {
        transactionForm.onsubmit = submitTransaction;
    }

    const debtForm = document.getElementById('add-debt-form');
    if (debtForm) {
        debtForm.onsubmit = saveDebt;
    }
    
    // Выбор категории
    const categorySelect = document.getElementById('transaction-category');
    if (categorySelect) {
        categorySelect.onchange = function() {
            if (this.value === '__new__') {
                closeModal('add-transaction-modal');
                showAddCategoryModal(currentTransactionType);
            }
        };
    }

    const debtsToggle = document.getElementById('debts-toggle');
    if (debtsToggle) {
        debtsToggle.onchange = function() {
            setDebtsEnabled(this.checked);
        };
    }
    
    // Форма категории
    const categoryForm = document.getElementById('add-category-form');
    if (categoryForm) {
        categoryForm.onsubmit = function(e) {
            e.preventDefault();
            addNewCategory();
        };
    }
    
    // Форма цели
    const goalForm = document.getElementById('add-goal-form');
    if (goalForm) {
        goalForm.onsubmit = function(e) {
            e.preventDefault();
            addNewGoal();
        };
    }
    
    // Форма кошелька
    const walletForm = document.getElementById('add-wallet-form');
    if (walletForm) {
        walletForm.onsubmit = function(e) {
            e.preventDefault();
            addNewWallet();
        };
    }
    
    // Периоды для графика баланса
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = function() {
            const period = this.dataset.period;
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            updateBalanceDynamicsChart(period);
        };
    });
    
    // Закрытие модальных окон по клику на оверлей
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                updateBodyModalState();
            }
        };
    });
    
    // Обработчик для выбора основного кошелька
    const defaultWalletDisplay = document.querySelector('.default-wallet-display');
    if (defaultWalletDisplay) {
        defaultWalletDisplay.onclick = toggleWalletDropdown;
    }
    
    // Закрытие выпадающего списка кошельков при клике вне его
    document.addEventListener('click', function(e) {
        const defaultWalletDisplay = document.querySelector('.default-wallet-display');
        const walletDropdown = document.getElementById('wallet-dropdown');
        
        if (defaultWalletDisplay && walletDropdown && 
            !defaultWalletDisplay.contains(e.target) && 
            !walletDropdown.contains(e.target)) {
            
            walletDropdown.classList.remove('active');
            defaultWalletDisplay.classList.remove('active');
        }
    });

    document.addEventListener('touchstart', function(e) {
        if (!document.body.classList.contains('modal-open')) return;
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        modalTouchStartY = touch.clientY;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!document.body.classList.contains('modal-open')) return;
        const modalContent = e.target.closest('.modal-content');
        if (!modalContent) {
            if (e.cancelable) e.preventDefault();
            return;
        }

        const touch = e.touches && e.touches[0];
        if (!touch) return;
        const deltaY = touch.clientY - modalTouchStartY;
        let scroller = modalContent;
        let cursor = e.target;
        while (cursor && cursor !== modalContent) {
            if (cursor instanceof HTMLElement && cursor.scrollHeight > cursor.clientHeight + 1) {
                scroller = cursor;
                break;
            }
            cursor = cursor.parentElement;
        }
        const canScroll = scroller.scrollHeight > scroller.clientHeight + 1;

        if (!canScroll) {
            if (e.cancelable) e.preventDefault();
            return;
        }

        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('focusin', function(e) {
        if (!document.body.classList.contains('modal-open')) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const isInputLike = target.matches('input, textarea, select, [contenteditable="true"]');
        if (!isInputLike) return;
        queueEnsureFocusedFieldVisible(130, true);
    }, true);
}

function setupAddButton() {
    const addButton = document.getElementById('add-transaction-btn');
    if (addButton) {
        addButton.onclick = () => {
            currentTransactionType = 'income';
            selectedGoalId = null;
            currentSavingsDestination = 'piggybank';
            showAddTransactionModal();
        };
    }
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ //
// ==================== //

function showAllCategories(type) {
    // Разворачиваем соответствующую секцию
    toggleCollapsibleSection(type, true);
    
    // Прокручиваем к секции
    const section = document.querySelector(`.collapsible-section[data-type="${type}"]`);
    if (section) {
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
}

function showAllTransactions() {
    const modal = document.getElementById('all-transactions-modal');
    const list = document.getElementById('all-transactions-list');
    
    if (!modal || !list) return;

    modal.classList.add('active');
    updateBodyModalState();
    list.innerHTML = `
        <div style="text-align: center; padding: 26px 20px; color: var(--ios-text-secondary);">
            ${t('Загрузка...')}
        </div>
    `;

    const renderTransactions = (transactions) => {
        if (!transactions.length) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--ios-text-tertiary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div style="font-size: 15px;">${t('Нет операций')}</div>
                </div>
            `;
            return;
        }

        const symbol = currencySymbols[currentCurrency] || '₽';
        let html = '';
        transactions.forEach(trans => {
            const isSavings = isSavingsCategoryName(trans.category);
            const isDebt = trans.category === 'Долги';
            const isIncome = isSavings ? true : trans.type === 'income';
            const amountClass = isSavings ? 'amount-savings' : (isIncome ? 'amount-positive' : 'amount-negative');
            const amountSign = isSavings ? '+' : (isIncome ? '+' : '−');
            const icon = isDebt ? '💸' : (isSavings ? '💰' : (isIncome ? '📈' : '📉'));
            const iconClass = isDebt ? 'debt' : (isSavings ? 'savings' : (isIncome ? 'income' : 'expense'));
            const dateValue = parseTransactionDate(trans.date);
            const date = Number.isNaN(dateValue.getTime())
                ? ''
                : dateValue.toLocaleDateString(getLocale(), {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            const categoryLabel = t(trans.category);
            const descriptionMarkup = renderTransactionDescription(trans.description);
            html += `
                <div class="transaction-item">
                    <div class="transaction-icon ${iconClass}">${icon}</div>
                    <div class="transaction-info">
                        ${descriptionMarkup}
                        <div class="transaction-category-line">
                            <div class="transaction-category">${categoryLabel}</div>
                        </div>
                        <div class="transaction-details">${date} • ${t(trans.wallet)}</div>
                    </div>
                    <div class="transaction-right">
                        <div class="transaction-amount ${amountClass}">
                            ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                        </div>
                        <div class="transaction-actions">
                            <button class="debt-action-btn panel-recent-edit-btn" onclick="openEditTransactionFromAll(${trans.id})">${t('Изменить')}</button>
                        </div>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    };

    const sortByDateDesc = (items) => {
        return [...items].sort((a, b) => {
            const tsA = new Date(a?.date || 0).getTime();
            const tsB = new Date(b?.date || 0).getTime();
            if (Number.isFinite(tsA) && Number.isFinite(tsB)) return tsB - tsA;
            return Number(b?.id || 0) - Number(a?.id || 0);
        });
    };

    if (currentUser) {
        fetch(`/api/transactions/${currentUser.id}?limit=1000`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    allTransactions = sortByDateDesc(data);
                }
            })
            .catch(() => {})
            .finally(() => {
                renderTransactions(sortByDateDesc(Array.isArray(allTransactions) ? allTransactions : []));
            });
        return;
    }

    renderTransactions(sortByDateDesc(Array.isArray(allTransactions) ? allTransactions : []));
}

function openEditTransactionFromAll(id) {
    closeModal('all-transactions-modal');
    openEditTransactionById(id);
}

function showAddWalletModal() {
    const modal = document.getElementById('add-wallet-modal');
    if (!modal) return;
    
    // Заполняем иконки
    const iconsGrid = document.getElementById('wallet-icons-grid');
    if (iconsGrid) {
        const icons = ['💳', '💵', '🏦', '💰', '💎', '🏠', '📱', '💼'];
        iconsGrid.innerHTML = '';
        icons.forEach(icon => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.textContent = icon;
            button.dataset.icon = icon;
            
            button.onclick = function() {
                document.querySelectorAll('#wallet-icons-grid .icon-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            };
            
            iconsGrid.appendChild(button);
        });
        if (iconsGrid.firstChild) iconsGrid.firstChild.classList.add('selected');
    }
    
    modal.classList.add('active');
    updateBodyModalState();
    
    setTimeout(() => {
        document.getElementById('wallet-name-input').focus();
    }, 100);
}

async function addNewWallet() {
    const nameInput = document.getElementById('wallet-name-input');
    const iconsGrid = document.getElementById('wallet-icons-grid');
    const isDefaultCheckbox = document.getElementById('wallet-is-default');
    
    if (!nameInput || !iconsGrid) return;
    
    const name = nameInput.value.trim();
    const selectedIcon = iconsGrid.querySelector('.icon-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '💳';
    const isDefault = isDefaultCheckbox ? isDefaultCheckbox.checked : false;
    
    if (!name) {
        showNotification('Введите название кошелька', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/add_wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                name: name,
                icon: icon,
                is_default: isDefault
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Добавляем кошелёк в данные
        const newWallet = {
            name: name,
            icon: icon,
            balance: 0,
            is_default: isDefault
        };
        walletsData.push(newWallet);
        
        // Если установлен как дефолтный, обновляем все кошельки и основной
        if (isDefault) {
            walletsData.forEach(wallet => {
                if (wallet.name !== name) {
                    wallet.is_default = false;
                }
            });
            defaultWallet = name;
            
            // Обновляем отображение в сервисах
            updateDefaultWalletDisplay();
        }
        
        // Обновляем интерфейс
        updateWalletsDisplay();
        updateSectionTotals();
        
        closeModal('add-wallet-modal');
        nameInput.value = '';
        if (isDefaultCheckbox) isDefaultCheckbox.checked = false;
        
        showNotification(`${t('Кошелёк добавлен')}: ${name}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка добавления кошелька:', error);
        showNotification('Ошибка добавления кошелька', 'error');
    }
}

// ==================== //
// КАЛЕНДАРЬ //
// ==================== //

function showCalendar() {
    const modal = document.getElementById('calendar-modal');
    const grid = document.getElementById('calendar-grid');
    const yearDisplay = document.getElementById('calendar-year');
    
    if (!modal || !grid || !yearDisplay) return;
    
    const currentYear = currentHistoryMonth.getFullYear();
    const currentMonth = currentHistoryMonth.getMonth();
    
    // Заполняем месяцы
    let html = '';
    (monthNames[currentLang] || monthNames.ru).forEach((month, index) => {
        const isActive = index === currentMonth;
        html += `
            <button class="period-btn ${isActive ? 'active' : ''}" 
                    onclick="selectCalendarMonth(${index})"
                    style="padding: 12px;">
                ${month}
            </button>
        `;
    });
    grid.innerHTML = html;
    
    // Устанавливаем год
    yearDisplay.textContent = currentYear;
    
    modal.classList.add('active');
    updateBodyModalState();
}

function selectCalendarMonth(monthIndex) {
    currentHistoryMonth.setMonth(monthIndex);
    updateMonthDisplay();
    loadMonthTransactions();
    
    closeModal('calendar-modal');
}

function changeCalendarYear(delta) {
    const yearDisplay = document.getElementById('calendar-year');
    if (!yearDisplay) return;
    
    let currentYear = parseInt(yearDisplay.textContent);
    currentYear += delta;
    yearDisplay.textContent = currentYear;
    
    // Обновляем текущий месяц если нужно
    currentHistoryMonth.setFullYear(currentYear);
}

// ==================== //
/* УВЕДОМЛЕНИЯ */
// ==================== //

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Скрываем предыдущее уведомление
    notification.classList.remove('show');
    
    // Ждём немного и показываем новое
    setTimeout(() => {
        notification.textContent = t(message);
        notification.className = `notification ${type}`;
        
        // Добавляем класс show с небольшой задержкой для анимации
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Автоматически скрываем через 1 секунду
        setTimeout(() => {
            notification.classList.remove('show');
        }, 1000);
        
    }, 100);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
    if (modalId === 'add-transaction-modal') {
        resetTransactionEditing();
    }
    if (modalId === 'add-goal-modal') {
        editingGoalId = null;
    }
}

function exportData() {
    if (!currentUser) return;
    
    showNotification('Экспорт данных...', 'info');
    
    const link = document.createElement('a');
    link.href = `/api/export/${currentUser.id}`;
    link.download = `transactions_${currentUser.id}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        showNotification('Данные экспортированы', 'success');
    }, 1000);
}

function openCompoundCalculator() {
    const modal = document.getElementById('compound-modal');
    if (!modal) return;
    modal.classList.add('active');
    updateBodyModalState();
    const result = document.getElementById('calc-result');
    if (result) result.style.display = 'none';
    const chartWrap = document.getElementById('calc-chart-wrap');
    if (chartWrap) chartWrap.style.display = 'none';
    loadCompoundState();
    if (!compoundListenersInitialized) {
        ['calc-principal', 'calc-monthly', 'calc-rate', 'calc-years', 'calc-frequency'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const handler = () => saveCompoundState();
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
        compoundListenersInitialized = true;
    }
}

function calculateCompound() {
    const principalInput = document.getElementById('calc-principal');
    const monthlyInput = document.getElementById('calc-monthly');
    const rateInput = document.getElementById('calc-rate');
    const yearsInput = document.getElementById('calc-years');
    const result = document.getElementById('calc-result');
    if (!principalInput || !monthlyInput || !rateInput || !yearsInput || !result) return;
    
    const principal = parseFloat((principalInput.value || '0').replace(',', '.')) || 0;
    const monthly = parseFloat((monthlyInput.value || '0').replace(',', '.')) || 0;
    const rate = parseFloat((rateInput.value || '0').replace(',', '.')) || 0;
    const years = parseFloat((yearsInput.value || '0').replace(',', '.')) || 0;
    const frequencyInput = document.getElementById('calc-frequency');
    const frequency = parseInt(frequencyInput?.value || '12', 10);
    
    const periods = Math.max(0, Math.round(years * 12));
    const monthlyRate = frequency > 0
        ? Math.pow(1 + rate / 100 / frequency, frequency / 12) - 1
        : 0;
    let total = principal;
    if (periods > 0) {
        if (monthlyRate > 0) {
            total = principal * Math.pow(1 + monthlyRate, periods) +
                monthly * ((Math.pow(1 + monthlyRate, periods) - 1) / monthlyRate);
        } else {
            total = principal + monthly * periods;
        }
    }
    const contributions = principal + monthly * periods;
    const interest = total - contributions;
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    const totalEl = document.getElementById('calc-total');
    const contribEl = document.getElementById('calc-contrib');
    const interestEl = document.getElementById('calc-interest');
    if (totalEl) totalEl.textContent = `${formatCurrency(Math.max(0, total))} ${symbol}`;
    if (contribEl) contribEl.textContent = `${formatCurrency(Math.max(0, contributions))} ${symbol}`;
    if (interestEl) interestEl.textContent = `${formatCurrency(Math.max(0, interest))} ${symbol}`;
    result.style.display = 'block';
    saveCompoundState();
    renderCompoundChart(principal, monthly, monthlyRate, periods);
}

function closeCompoundCalculator() {
    const modal = document.getElementById('compound-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
}

function saveCompoundState() {
    const principalInput = document.getElementById('calc-principal');
    const monthlyInput = document.getElementById('calc-monthly');
    const rateInput = document.getElementById('calc-rate');
    const yearsInput = document.getElementById('calc-years');
    const frequencyInput = document.getElementById('calc-frequency');
    if (!principalInput || !monthlyInput || !rateInput || !yearsInput || !frequencyInput) return;
    const payload = {
        principal: principalInput.value || '',
        monthly: monthlyInput.value || '',
        rate: rateInput.value || '',
        years: yearsInput.value || '',
        frequency: frequencyInput.value || '12'
    };
    localStorage.setItem(compoundStorageKey, JSON.stringify(payload));
}

function loadCompoundState() {
    const raw = localStorage.getItem(compoundStorageKey);
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        const principalInput = document.getElementById('calc-principal');
        const monthlyInput = document.getElementById('calc-monthly');
        const rateInput = document.getElementById('calc-rate');
        const yearsInput = document.getElementById('calc-years');
        const frequencyInput = document.getElementById('calc-frequency');
        if (principalInput && data.principal !== undefined) principalInput.value = data.principal;
        if (monthlyInput && data.monthly !== undefined) monthlyInput.value = data.monthly;
        if (rateInput && data.rate !== undefined) rateInput.value = data.rate;
        if (yearsInput && data.years !== undefined) yearsInput.value = data.years;
        if (frequencyInput && data.frequency !== undefined) frequencyInput.value = data.frequency;
    } catch (e) {
        // ignore
    }
}

function renderCompoundChart(principal, monthly, monthlyRate, periods) {
    const canvas = document.getElementById('compound-chart');
    const wrap = document.getElementById('calc-chart-wrap');
    if (!canvas || !wrap) return;
    const dataPoints = [];
    let balance = principal;
    dataPoints.push(balance);
    for (let i = 1; i <= periods; i += 1) {
        balance = balance * (1 + monthlyRate) + monthly;
        dataPoints.push(balance);
    }
    if (charts['compound-chart']) {
        charts['compound-chart'].destroy();
    }
    charts['compound-chart'] = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i),
            datasets: [{
                data: dataPoints,
                borderColor: 'rgba(93, 156, 236, 0.9)',
                backgroundColor: 'rgba(93, 156, 236, 0.2)',
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        callback: (value) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${formatCurrency(value)} ${symbol}`;
                        }
                    }
                }
            }
        }
    });
    wrap.style.display = 'block';
}

function openArticlesLibrary() {
    switchPage('articles');
    const servicesNav = document.querySelector('.nav-item[data-page="services"]');
    if (servicesNav) servicesNav.classList.add('active');
}

function openArticle(articleId) {
    const article = articlesLibrary[articleId];
    if (!article) return;
    const titleEl = document.getElementById('article-modal-title');
    const bodyEl = document.getElementById('article-modal-body');
    const modal = document.getElementById('article-modal');
    if (!titleEl || !bodyEl || !modal) return;
    const title = typeof article.title === 'string'
        ? article.title
        : (article.title?.[currentLang] || article.title?.ru || '');
    const body = typeof article.body === 'string'
        ? article.body
        : (article.body?.[currentLang] || article.body?.ru || '');
    titleEl.textContent = title;
    bodyEl.innerHTML = body;
    modal.classList.add('active');
    updateBodyModalState();
}

function closeArticle() {
    const modal = document.getElementById('article-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
}

function openTextModal(text) {
    const modal = document.getElementById('text-modal');
    const body = document.getElementById('text-modal-body');
    if (!modal || !body) return;
    body.textContent = text || '';
    modal.classList.add('active');
    updateBodyModalState();
}

function openTextModalFromEncoded(encodedText) {
    if (!encodedText) {
        openTextModal('');
        return;
    }
    try {
        openTextModal(decodeURIComponent(encodedText));
    } catch {
        openTextModal(encodedText);
    }
}

function closeTextModal() {
    const modal = document.getElementById('text-modal');
    if (modal) modal.classList.remove('active');
    updateBodyModalState();
}

// Глобальные функции
window.selectCurrency = selectCurrency;
window.addNewCategory = addNewCategory;
window.addNewGoal = addNewGoal;
window.addNewWallet = addNewWallet;
window.showAddTransactionModal = showAddTransactionModal;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddGoalModal = showAddGoalModal;
window.showAddWalletModal = showAddWalletModal;
window.closeModal = closeModal;
window.selectCalendarMonth = selectCalendarMonth;
window.changeCalendarYear = changeCalendarYear;
window.showCalendar = showCalendar;
window.showAddTransactionForCategory = showAddTransactionForCategory;
window.handleCategoryCardTap = handleCategoryCardTap;
window.handleCategoryDeleteFromSwipe = handleCategoryDeleteFromSwipe;
window.showWalletTransactions = showWalletTransactions;
window.openEditTransactionById = openEditTransactionById;
window.openEditTransactionFromAll = openEditTransactionFromAll;
window.deleteTransactionById = deleteTransactionById;
window.deleteEditingTransaction = deleteEditingTransaction;
window.selectDefaultWallet = selectDefaultWallet;
window.toggleWalletDropdown = toggleWalletDropdown;
window.showAllTransactions = showAllTransactions;
window.showAllCategories = showAllCategories;
window.selectSavingsDestination = selectSavingsDestination;
window.selectDebt = selectDebt;
window.selectGoal = selectGoal;
window.addToGoal = addToGoal;
window.exportData = exportData;
window.toggleCollapsibleSection = toggleCollapsibleSection;
window.openArticlesLibrary = openArticlesLibrary;
window.openArticle = openArticle;
window.closeArticle = closeArticle;
window.openTextModal = openTextModal;
window.closeTextModal = closeTextModal;
window.openReportPeriodModal = openReportPeriodModal;
window.closeReportPeriodModal = closeReportPeriodModal;
window.selectReportPeriod = selectReportPeriod;
window.closeReportRangeModal = closeReportRangeModal;
window.applyReportCustomRange = applyReportCustomRange;
window.openCompoundCalculator = openCompoundCalculator;
window.calculateCompound = calculateCompound;
window.closeCompoundCalculator = closeCompoundCalculator;
window.openInvestAll = openInvestAll;
window.closeMarketModal = closeMarketModal;
window.openSubscriptionModal = openSubscriptionModal;
window.openSupportChat = openSupportChat;
window.closeSubscriptionModal = closeSubscriptionModal;
window.openDebtModal = openDebtModal;
window.closeDebtModal = closeDebtModal;
window.openDebtPayment = openDebtPayment;
window.deleteDebt = deleteDebt;
window.archiveDebt = archiveDebt;
window.archiveGoal = archiveGoal;
window.deleteGoal = deleteGoal;
window.copySubscriptionAddress = copySubscriptionAddress;
window.createCryptoPayPayment = createCryptoPayPayment;
window.checkSubscriptionStatus = checkSubscriptionStatus;
window.openSubscriptionInvoice = openSubscriptionInvoice;
window.copySubscriptionAmount = copySubscriptionAmount;
window.grantSubscriptionManual = grantSubscriptionManual;
window.loadPromoStats = loadPromoStats;
window.prefillAdminUsername = prefillAdminUsername;
window.setSubscriptionAsset = setSubscriptionAsset;
window.setSubscriptionDuration = setSubscriptionDuration;
window.setLanguage = setLanguage;
window.redeemPromoCode = redeemPromoCode;
window.openSharedWallet = openSharedWallet;
window.closeSharedWallet = closeSharedWallet;
window.copySharedCode = copySharedCode;
window.copySharedLink = copySharedLink;
window.createSharedWallet = createSharedWallet;
window.joinSharedWallet = joinSharedWallet;
window.leaveSharedWallet = leaveSharedWallet;
window.openAddToHome = openAddToHome;
window.closeAddToHome = closeAddToHome;
window.openAddToHomeLink = openAddToHomeLink;
window.toggleSettingsCard = toggleSettingsCard;
window.resetAllData = resetAllData;
window.switchPage = switchPage;
