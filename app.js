const currencyOptions = {
    INR: { symbol: '₹', locale: 'en-IN', label: 'INR' },
    AUD: { symbol: 'A$', locale: 'en-AU', label: 'AUD' },
    NPR: { symbol: '₨', locale: 'ne-NP', label: 'NPR' }
};

const exchangeRates = {
    INR: { INR: 1, AUD: 0.018, NPR: 1.45 },
    AUD: { INR: 85.5, AUD: 1, NPR: 124.5 },
    NPR: { INR: 0.69, AUD: 0.008, NPR: 1 }
};

let expenses = [];
let incomes = [];
let savingsGoal = { name: '', target: 0 };
let currency = 'INR';
let currentReceiptData = '';
let budgetChart = null;

function loadData() {
    try {
        expenses = JSON.parse(localStorage.getItem('moneyTrackerExpenses')) || [];
        incomes = JSON.parse(localStorage.getItem('moneyTrackerIncomes')) || [];
        savingsGoal = JSON.parse(localStorage.getItem('moneyTrackerGoal')) || { name: '', target: 0 };
        currency = localStorage.getItem('moneyTrackerCurrency') || 'INR';
    } catch (error) {
        expenses = [];
        incomes = [];
        savingsGoal = { name: '', target: 0, currency: currency };
        currency = 'INR';
    }
    migrateLegacyData();
}

function saveData() {
    localStorage.setItem('moneyTrackerExpenses', JSON.stringify(expenses));
    localStorage.setItem('moneyTrackerIncomes', JSON.stringify(incomes));
    localStorage.setItem('moneyTrackerGoal', JSON.stringify(savingsGoal));
    localStorage.setItem('moneyTrackerCurrency', currency);
}

function formatCurrency(value) {
    const options = currencyOptions[currency] || currencyOptions.INR;
    return new Intl.NumberFormat(options.locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 2
    }).format(value);
}

function convertValue(amount, fromCurrency, toCurrency) {
    const fromRates = exchangeRates[fromCurrency] || exchangeRates.INR;
    return amount * (fromRates[toCurrency] ?? 1);
}

function migrateLegacyData() {
    expenses = expenses.map(item => ({
        currency: item.currency || currency,
        ...item
    }));
    incomes = incomes.map(item => ({
        currency: item.currency || currency,
        ...item
    }));
    savingsGoal = {
        name: savingsGoal.name || '',
        target: Number.isFinite(savingsGoal.target) ? savingsGoal.target : 0,
        currency: savingsGoal.currency || currency
    };
}

function changeCurrency() {
    currency = document.getElementById('currencySelect').value;
    saveData();
    refreshAll();
}

function setGoal() {
    const name = document.getElementById('goalName').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);

    if (!name || !Number.isFinite(target) || target <= 0) {
        return alert('Please enter a goal name and a valid target amount.');
    }

    savingsGoal = { name, target, currency };
    saveData();
    renderGoal();
    alert('Savings goal saved successfully.');
}

function addExpense() {
    const item = document.getElementById('expItem').value.trim();
    const qty = parseInt(document.getElementById('expQty').value, 10);
    const price = parseFloat(document.getElementById('expPrice').value);
    const entryCurrency = document.getElementById('expCurrency').value;
    const date = document.getElementById('expDate').value || new Date().toISOString().split('T')[0];

    if (!item || !Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty < 1) {
        return alert('Please provide a valid item, quantity, and amount.');
    }

    const total = qty * price;

    expenses.push({
        id: Date.now(),
        item,
        qty,
        price,
        total,
        date,
        currency: entryCurrency,
        receipt: currentReceiptData
    });

    saveData();
    alert('Expense saved successfully.');
    clearForms();
    refreshAll();
    showTab(0);
}

function addIncome() {
    const source = document.getElementById('incSource').value.trim();
    const amount = parseFloat(document.getElementById('incAmount').value);
    const entryCurrency = document.getElementById('incCurrency').value;
    const date = document.getElementById('incDate').value || new Date().toISOString().split('T')[0];

    if (!source || !Number.isFinite(amount) || amount <= 0) {
        return alert('Please provide a valid source and amount.');
    }

    incomes.push({ id: Date.now(), source, amount, date, currency: entryCurrency });
    saveData();
    alert('Income recorded successfully.');
    launchConfetti();
    clearForms();
    refreshAll();
    showTab(0);
}

function clearForms() {
    document.getElementById('expItem').value = '';
    document.getElementById('expQty').value = 1;
    document.getElementById('expCurrency').value = currency;
    document.getElementById('expPrice').value = '';
    document.getElementById('receiptPhoto').value = '';
    document.getElementById('incSource').value = '';
    document.getElementById('incCurrency').value = currency;
    document.getElementById('incAmount').value = '';
    currentReceiptData = '';
    document.getElementById('photoPreview').innerHTML = '';
}

function refreshAll() {
    renderDashboard();
    renderHistory();
    renderGoal();
    renderCurrency();
    renderChart();
}

function renderCurrency() {
    const select = document.getElementById('currencySelect');
    select.value = currency;
}

function renderDashboard() {
    const now = new Date().toISOString().slice(0, 7);
    const expTotal = expenses
        .filter(e => e.date.startsWith(now))
        .reduce((sum, e) => sum + convertValue(e.total, e.currency || currency, currency), 0);
    const incTotal = incomes
        .filter(i => i.date.startsWith(now))
        .reduce((sum, i) => sum + convertValue(i.amount, i.currency || currency, currency), 0);
    const net = incTotal - expTotal;

    document.getElementById('monthExpense').textContent = formatCurrency(expTotal);
    document.getElementById('monthIncome').textContent = formatCurrency(incTotal);
    document.getElementById('netBalance').textContent = formatCurrency(net);
}

function renderGoal() {
    const goalContainer = document.getElementById('goalProgress');

    if (!savingsGoal.name || !Number.isFinite(savingsGoal.target) || savingsGoal.target <= 0) {
        goalContainer.innerHTML = '<p>No savings goal set yet. Add a goal to track progress.</p>';
        return;
    }

    const now = new Date().toISOString().slice(0, 7);
    const totalSaved = Math.max(0,
        incomes.filter(i => i.date.startsWith(now)).reduce(
            (sum, i) => sum + convertValue(i.amount, i.currency || currency, currency), 0
        ) - expenses.filter(e => e.date.startsWith(now)).reduce(
            (sum, e) => sum + convertValue(e.total, e.currency || currency, currency), 0
        )
    );
    const goalTargetInDisplay = convertValue(savingsGoal.target, savingsGoal.currency || currency, currency);
    const progress = Math.min(1, totalSaved / Math.max(goalTargetInDisplay, 1));
    const percent = Math.round(progress * 100);

    goalContainer.innerHTML = `
        <p><strong>${savingsGoal.name}</strong> — ${formatCurrency(totalSaved)} of ${formatCurrency(goalTargetInDisplay)}</p>
        <div class="progress-track"><div class="progress-fill" style="width: ${percent}%;"></div></div>
        <p>${percent}% of goal completed</p>
    `;
}

function renderHistory() {
    const table = document.getElementById('historyTable');
    table.innerHTML = '';

    const header = table.insertRow();
    ['Date', 'Type', 'Description', 'Amount', 'Actions'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        header.appendChild(th);
    });

    const timeline = [
        ...expenses.map(exp => ({ ...exp, type: 'expense' })),
        ...incomes.map(inc => ({ ...inc, type: 'income' }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    timeline.forEach(item => {
        const row = table.insertRow();
        const dateCell = row.insertCell();
        dateCell.textContent = item.date;
        dateCell.dataset.label = 'Date';

        const typeCell = row.insertCell();
        typeCell.innerHTML = item.type === 'expense' ? '<span class="tag">Expense</span>' : '<span class="tag">Income</span>';
        typeCell.dataset.label = 'Type';

        const descCell = row.insertCell();
        descCell.textContent = item.type === 'expense' ? `${item.item} × ${item.qty}` : item.source;
        descCell.dataset.label = 'Description';

        const converted = item.type === 'expense'
            ? convertValue(item.total, item.currency || currency, currency)
            : convertValue(item.amount, item.currency || currency, currency);
        const amountCell = row.insertCell();
        amountCell.textContent = `${item.type === 'expense' ? '-' : ''}${formatCurrency(converted)}`;
        amountCell.style.color = item.type === 'expense' ? '#ff9caa' : '#7ef3c5';
        amountCell.dataset.label = 'Amount';

        const actionsCell = row.insertCell();
        actionsCell.className = 'actions-cell';
        actionsCell.dataset.label = 'Actions';

        if (item.type === 'expense' && item.receipt) {
            const receiptButton = document.createElement('button');
            receiptButton.className = 'action-button';
            receiptButton.textContent = 'View receipt';
            receiptButton.title = 'View receipt';
            receiptButton.onclick = () => viewReceipt(item.receipt);
            actionsCell.appendChild(receiptButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button';
        deleteButton.textContent = 'Delete';
        deleteButton.title = 'Delete entry';
        deleteButton.onclick = () => deleteTransaction(item.type, item.id);
        actionsCell.appendChild(deleteButton);
    });
}

function showTab(index) {
    document.querySelectorAll('.tab-content').forEach((section, idx) => {
        section.classList.toggle('active', idx === index);
    });
    document.querySelectorAll('.tab').forEach((tab, idx) => {
        tab.classList.toggle('active', idx === index);
    });
}

function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return alert('Voice input is not supported in this browser.');
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('expItem').value = transcript;
        alert(`Voice entry recognized: ${transcript}`);
    };

    recognition.onerror = () => alert('Voice input could not be captured.');
    recognition.start();
}

function previewPhoto(event) {
    const preview = document.getElementById('photoPreview');
    const file = event.target.files[0];
    if (!file) {
        preview.innerHTML = '';
        currentReceiptData = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
        currentReceiptData = ev.target.result;
        preview.innerHTML = `<img src="${currentReceiptData}" alt="Receipt preview">`;
    };
    reader.readAsDataURL(file);
}

function viewReceipt(url) {
    const modal = document.getElementById('receiptModal');
    const image = document.getElementById('receiptModalImage');
    image.src = url;
    modal.classList.add('open');
}

function hideReceiptModal(event) {
    event.stopPropagation();
    if (event.target.id === 'receiptModal' || event.target.classList.contains('close-button')) {
        document.getElementById('receiptModal').classList.remove('open');
    }
}

function deleteTransaction(type, id) {
    if (!confirm('Delete this transaction?')) return;
    if (type === 'expense') {
        expenses = expenses.filter(item => item.id !== id);
    } else {
        incomes = incomes.filter(item => item.id !== id);
    }
    saveData();
    refreshAll();
}

function getMonthlyTotals(months = 6) {
    const labels = [];
    const expensesData = [];
    const incomesData = [];
    const today = new Date();

    for (let offset = months - 1; offset >= 0; offset--) {
        const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        const key = date.toISOString().slice(0, 7);
        labels.push(date.toLocaleString('default', { month: 'short', year: 'numeric' }));
        expensesData.push(expenses
            .filter(item => item.date.startsWith(key))
            .reduce((sum, item) => sum + convertValue(item.total, item.currency || currency, currency), 0));
        incomesData.push(incomes
            .filter(item => item.date.startsWith(key))
            .reduce((sum, item) => sum + convertValue(item.amount, item.currency || currency, currency), 0));
    }

    return { labels, expensesData, incomesData };
}

function renderChart() {
    const ctx = document.getElementById('budgetChart');
    const totals = getMonthlyTotals();

    if (!budgetChart) {
        budgetChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: totals.labels,
                datasets: [
                    {
                        label: 'Income',
                        data: totals.incomesData,
                        borderColor: '#7ef3c5',
                        backgroundColor: 'rgba(126, 243, 197, 0.18)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4
                    },
                    {
                        label: 'Expenses',
                        data: totals.expensesData,
                        borderColor: '#ff9caa',
                        backgroundColor: 'rgba(255, 156, 170, 0.16)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#d8ccf4' } }
                },
                scales: {
                    x: { ticks: { color: '#d8ccf4' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    y: { ticks: { color: '#d8ccf4' }, grid: { color: 'rgba(255,255,255,0.08)' } }
                }
            }
        });
    } else {
        budgetChart.data.labels = totals.labels;
        budgetChart.data.datasets[0].data = totals.incomesData;
        budgetChart.data.datasets[1].data = totals.expensesData;
        budgetChart.update();
    }
}

function launchConfetti() {
    const canvas = document.getElementById('confetti');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];

    for (let i = 0; i < 200; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 12 + 6,
            speed: Math.random() * 6 + 3,
            color: ['#ff78b0', '#9f7aea', '#7ef3c5', '#ffd1e8'][Math.floor(Math.random() * 4)]
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((particle, index) => {
            particle.y += particle.speed;
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
            if (particle.y > canvas.height) particles.splice(index, 1);
        });
        if (particles.length > 0) {
            requestAnimationFrame(animate);
        } else {
            canvas.style.display = 'none';
        }
    }

    animate();
}

function init() {
    loadData();
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('incDate').value = new Date().toISOString().split('T')[0];
    renderCurrency();
    refreshAll();
}

init();
