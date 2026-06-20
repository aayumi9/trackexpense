let expenses = JSON.parse(localStorage.getItem('moneyTrackerExpenses')) || [];
let incomes = JSON.parse(localStorage.getItem('moneyTrackerIncomes')) || [];
let savingsGoal = JSON.parse(localStorage.getItem('moneyTrackerGoal')) || {name:"", target:0};

function saveData() {
    localStorage.setItem('moneyTrackerExpenses', JSON.stringify(expenses));
    localStorage.setItem('moneyTrackerIncomes', JSON.stringify(incomes));
    localStorage.setItem('moneyTrackerGoal', JSON.stringify(savingsGoal));
}

function getSymbol() { return '₹'; }

function changeCurrency(){ /* stub: currency handling not implemented yet */ }

// Confetti
function launchConfetti() {
    const canvas = document.getElementById('confetti');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for(let i=0; i<200; i++){
        particles.push({
            x: Math.random()*canvas.width,
            y: Math.random()*canvas.height - canvas.height,
            size: Math.random()*12 + 6,
            speed: Math.random()*6 + 3,
            color: ['#ff8ec8','#ffd1e8','#c8a2d8','#ff4d94'][Math.floor(Math.random()*4)]
        });
    }
    function animate(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        particles.forEach((p,i) => {
            p.y += p.speed;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            if(p.y > canvas.height) particles.splice(i,1);
        });
        if(particles.length > 0) requestAnimationFrame(animate);
        else canvas.style.display = 'none';
    }
    animate();
}

function addExpense() {
    const item = document.getElementById('expItem').value.trim();
    const price = parseFloat(document.getElementById('expPrice').value);
    const date = document.getElementById('expDate').value || new Date().toISOString().split('T')[0];

    if(!item || !price) return alert("Please fill all fields 💕");

    expenses.push({id: Date.now(), item, total: price, date});
    saveData();
    alert("Expense added! 💖");
    clearForms();
    refreshAll();
    showTab(0);
}

function addIncome() {
    const source = document.getElementById('incSource').value.trim();
    const amount = parseFloat(document.getElementById('incAmount').value);
    const date = document.getElementById('incDate').value || new Date().toISOString().split('T')[0];

    if(!source || !amount) return alert("Please fill all fields 💕");

    incomes.push({id: Date.now(), source, amount, date});
    saveData();
    alert("Income added! 🌟");
    launchConfetti();
    clearForms();
    refreshAll();
    showTab(0);
}

function clearForms() {
    document.getElementById('expItem').value = '';
    document.getElementById('expPrice').value = '';
    document.getElementById('incSource').value = '';
    document.getElementById('incAmount').value = '';
}

function refreshAll() {
    renderDashboard();
    renderHistory();
}

function renderDashboard() {
    const now = new Date().toISOString().slice(0,7);
    const expTotal = expenses.filter(e => e.date.startsWith(now)).reduce((s,e)=>s+e.total,0);
    const incTotal = incomes.filter(i => i.date.startsWith(now)).reduce((s,i)=>s+i.amount,0);
    const net = incTotal - expTotal;

    document.getElementById('monthExpense').textContent = getSymbol() + expTotal.toFixed(2);
    document.getElementById('monthIncome').textContent = getSymbol() + incTotal.toFixed(2);
    document.getElementById('netBalance').textContent = getSymbol() + net.toFixed(2);
}

function renderHistory() {
    let html = `<tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr>`;
    [...expenses.map(e=>({...e,type:'expense'})), ...incomes.map(i=>({...i,type:'income'}))]
        .sort((a,b)=>b.date.localeCompare(a.date))
        .forEach(item => {
            const isExp = item.type === 'expense';
            html += `<tr>
                <td>${item.date}</td>
                <td>${isExp?'💸':'💰'}</td>
                <td>${isExp?item.item:item.source}</td>
                <td style="color:${isExp?'#c00':'#090'}">${isExp?'-':''}${getSymbol()}${(isExp?item.total:item.amount).toFixed(2)}</td>
            </tr>`;
        });
    document.getElementById('historyTable').innerHTML = html;
}

function showTab(n) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById('tab' + n).style.display = 'block';
    document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i === n));
}

function startVoice() {
    alert("🎤 Voice input started! Speak now (demo)");
}

function previewPhoto(e) {
    const preview = document.getElementById('photoPreview');
    const file = e.target.files[0];
    if(file){
        const reader = new FileReader();
        reader.onload = ev => preview.innerHTML = `<img src="${ev.target.result}" style="max-width:250px;border-radius:12px;margin-top:10px;">`;
        reader.readAsDataURL(file);
    }
}

// Random cute message
const messages = ["You're doing amazing! 💖", "Every rupee saved is a step forward 🌸", "Keep shining! ✨", "Hello Kitty approves! 🎀"];
document.getElementById('kawaiiMessage').textContent = messages[Math.floor(Math.random()*messages.length)];

// Initialize
const today = new Date().toISOString().split('T')[0];
document.getElementById('expDate').value = today;
document.getElementById('incDate').value = today;

refreshAll();
showTab(0);
