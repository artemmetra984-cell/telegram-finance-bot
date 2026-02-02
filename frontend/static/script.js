/* ДИАГРАММЫ */
.charts-section {
    background: #2d2d2d;
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 20px;
    position: relative;
}

.chart-container {
    height: 250px;
    position: relative;
}

.chart-balance {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 10;
}

.balance-label {
    font-size: 14px;
    color: #888;
    margin-bottom: 5px;
}

.balance-amount {
    font-size: 28px;
    font-weight: bold;
    color: white;
}

.chart-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.chart-title {
    color: white;
    font-size: 16px;
    font-weight: 600;
}

.chart-arrow {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.chart-indicator {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 15px;
}

.indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #444;
    cursor: pointer;
}

.indicator-dot.active {
    background: #3498db;
}

/* КНОПКА ИСТОРИИ */
.history-btn-small {
    background: #3498db;
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
}

/* СТРАНИЦА ИСТОРИИ */
.history-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
}

.back-btn {
    background: #3d3d3d;
    border: none;
    color: white;
    padding: 10px 15px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
}

.monthly-history, .all-transactions {
    background: #2d2d2d;
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 20px;
}

.month-item {
    background: #3d3d3d;
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 10px;
}

.month-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.month-title {
    font-weight: 600;
}

.month-balance {
    font-weight: bold;
    font-size: 18px;
}

.month-balance.positive {
    color: #2ecc71;
}

.month-balance.negative {
    color: #e74c3c;
}

/* КНОПКА ЕЩЁ */
.show-more-container {
    text-align: center;
    margin-top: 15px;
}

.show-more-btn {
    background: #3d3d3d;
    border: 1px solid #555;
    color: #aaa;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.show-more-btn:hover {
    background: #444;
}

/* ДЛЯ СВАЙПА */
.swipe-area {
    width: 100%;
    height: 100%;
    position: relative;
}