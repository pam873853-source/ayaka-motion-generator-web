// app.js - Logika Utama Aplikasi
import { CONFIG } from './config.js';
import { SupabaseClient } from './supabase-service.js';
import { AlightMotionAuthBrowser } from './auth-service.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let SUPABASE_URL = localStorage.getItem('supabase_url') || "";
let SUPABASE_KEY = localStorage.getItem('supabase_key') || "";
let supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_KEY);
const ampAuth = new AlightMotionAuthBrowser();

let app, db, auth, userId = null;
let historyLogs = [];
let totalVisitors = 0;
let reportsLogs = [];
let realTimeChart = null;
let activeTabName = 'dashboard';
let verifiedEmailTemp = '';

let startTime = localStorage.getItem('ayaka_uptime_start');
if (!startTime) {
    startTime = Date.now();
    localStorage.setItem('ayaka_uptime_start', startTime);
} else {
    startTime = parseInt(startTime, 10);
}

function initActivationChart() {
    const ctx = document.getElementById('activation-chart');
    if (!ctx) return;
    if (realTimeChart) realTimeChart.destroy();

    realTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Total Aktivasi',
                data: new Array(12).fill(0),
                borderColor: '#000000',
                backgroundColor: 'rgba(250, 204, 21, 0.45)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#facc15',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10, weight: 'bold' }, color: '#000000' } },
                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Inter', size: 10, weight: 'bold' }, color: '#000000' }, grid: { color: 'rgba(0, 0, 0, 0.08)' } }
            }
        }
    });
    updateChartData();
}

function updateChartData() {
    if (!realTimeChart) return;
    const monthlyCounts = new Array(12).fill(0);
    historyLogs.forEach(item => {
        if (item.timestamp) {
            const date = new Date(item.timestamp);
            const monthIdx = date.getMonth();
            if (monthIdx >= 0 && monthIdx < 12) monthlyCounts[monthIdx]++;
        }
    });
    realTimeChart.data.datasets[0].data = monthlyCounts;
    realTimeChart.update();
}

window.saveSupabaseConfig = function() {
    const urlInput = document.getElementById('supabase-url').value.trim();
    const keyInput = document.getElementById('supabase-key').value.trim();
    if (!urlInput || !keyInput) {
        showToast("URL & Anon Key Supabase wajib diisi!");
        return;
    }
    localStorage.setItem('supabase_url', urlInput);
    localStorage.setItem('supabase_key', keyInput);
    SUPABASE_URL = urlInput;
    SUPABASE_KEY = keyInput;
    supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_KEY);

    checkSupabaseStatus();
    syncSupabaseActivations();
    syncSupabaseReports();
    showToast("Konfigurasi Supabase Tersimpan!");
}

function checkSupabaseStatus() {
    const badge = document.getElementById('supabase-status-badge');
    if (!badge) return;
    if (supabase.isConfigured()) {
        badge.textContent = "TERHUBUNG";
        badge.className = "text-[10px] font-black px-2 py-0.5 rounded bg-emerald-300 text-emerald-900 border border-black";
    } else {
        badge.textContent = "STANDBY";
        badge.className = "text-[10px] font-black px-2 py-0.5 rounded bg-gray-200 text-gray-700";
    }
}

window.setActiveTab = function(tab) {
    activeTabName = tab;
    ['dashboard', 'aktivasi', 'riwayat', 'laporan'].forEach(t => {
        const view = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`nav-${t}`);
        if (view) view.classList.toggle('hidden', t !== tab);
        if (btn) {
            btn.className = (t === tab) 
                ? "neo-btn-yellow py-2 text-[10px] flex flex-col items-center justify-center gap-0.5" 
                : "neo-btn py-2 text-[10px] flex flex-col items-center justify-center gap-0.5";
        }
    });
    if (tab === 'riwayat') {
        renderHistory();
        setTimeout(() => {
            if (!realTimeChart) initActivationChart();
            else updateChartData();
        }, 100);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.switchActivationStep = function(step) {
    const s1 = document.getElementById('neo-step-1');
    const s2 = document.getElementById('neo-step-2');
    const b1 = document.getElementById('tab-btn-kirim');
    const b2 = document.getElementById('tab-btn-verifikasi');
    if (step === 1) {
        s1.classList.remove('hidden');
        s2.classList.add('hidden');
        b1.className = "neo-btn-dark py-2.5 text-xs flex items-center justify-center gap-2";
        b2.className = "neo-btn py-2.5 text-xs flex items-center justify-center gap-2";
    } else {
        s1.classList.add('hidden');
        s2.classList.remove('hidden');
        b1.className = "neo-btn py-2.5 text-xs flex items-center justify-center gap-2";
        b2.className = "neo-btn-dark py-2.5 text-xs flex items-center justify-center gap-2";
    }
}

window.handleSendMagicLink = async function() {
    const email = document.getElementById('amp-email').value.trim();
    if (!email) { showToast("Masukkan email terlebih dahulu!"); return; }
    const btn = document.getElementById('btn-send-link');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Mengirim...`;

    const res = await ampAuth.sendMagicLink(email);
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Magic Link ke Email`;

    if (res.success) {
        verifiedEmailTemp = email;
        showToast("Magic Link berhasil dikirim!");
        switchActivationStep(2);
    } else {
        showToast("Gagal: " + res.error);
    }
}

window.handleVerifyAndApply = async function() {
    const email = verifiedEmailTemp || document.getElementById('amp-email').value.trim();
    const link = document.getElementById('amp-magic-link').value.trim();
    const pkg = document.getElementById('amp-package').value;

    if (!email || !link) { showToast("Email dan Magic Link wajib diisi!"); return; }
    const btn = document.getElementById('btn-verify-apply');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;

    const res = await ampAuth.verifyAndApply(email, link, pkg);
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-bolt"></i> Verifikasi & Aktifkan Sekarang`;

    if (res.success) {
        showToast("Akun Berhasil Diaktifkan ke Premium!");
        const logData = {
            user: email,
            type: pkg.includes('annual') ? '1 Tahun Premium' : '1 Bulan Premium',
            timestamp: Date.now(),
            dateString: new Date().toDateString(),
            sender_id: userId
        };

        await supabase.addActivation(logData);
        if (db && userId) {
            try { await addDoc(collection(db, 'artifacts', CONFIG.APP_ID, 'public', 'data', 'activations'), logData); } catch (e) {}
        }

        document.getElementById('amp-email').value = '';
        document.getElementById('amp-magic-link').value = '';
        switchActivationStep(1);
        syncSupabaseActivations();
    } else {
        showToast("Gagal: " + res.error);
    }
}

function renderHistory() {
    const container = document.getElementById('history-feed-container');
    if (!historyLogs || historyLogs.length === 0) {
        container.innerHTML = `<div class="neo-card p-8 text-center space-y-2 bg-white"><i class="fa-solid fa-box-open text-3xl text-gray-400"></i><p class="text-xs font-black">Belum Ada Riwayat Aktivasi</p></div>`;
        return;
    }
    container.innerHTML = historyLogs.map(item => `
        <div class="neo-card p-3.5 flex items-center justify-between bg-white">
            <div><p class="text-xs font-black">${item.user}</p><p class="text-[10px] font-bold text-gray-500">${item.type}</p></div>
            <span class="px-2.5 py-1 bg-emerald-400 border-2 border-black rounded-lg text-[10px] font-black">AKTIF</span>
        </div>
    `).join('');
}

window.clearHistoryFeed = function() {
    if (confirm("Hapus seluruh riwayat lokal?")) {
        historyLogs = [];
        renderHistory();
        updateCounts();
        updateChartData();
        showToast("Riwayat dibersihkan.");
    }
}

window.submitBugReport = async function() {
    const category = document.getElementById('report-category').value;
    const description = document.getElementById('report-description').value.trim();
    if (!description) { showToast("Mohon isi deskripsi kendala/saran!"); return; }

    const reportData = {
        category,
        description,
        timestamp: Date.now(),
        date_string: new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID'),
        sender_id: userId || 'Anonymous'
    };

    await supabase.addReport(reportData);
    if (db && userId) {
        try { await addDoc(collection(db, 'artifacts', CONFIG.APP_ID, 'public', 'data', 'reports'), reportData); } catch (e) {}
    }

    document.getElementById('report-description').value = '';
    showToast("Laporan berhasil disimpan!");
    syncSupabaseReports();
}

function renderReports() {
    const container = document.getElementById('reports-list-container');
    const badge = document.getElementById('reports-count-badge');
    if (!container) return;
    if (badge) badge.textContent = (reportsLogs ? reportsLogs.length : 0) + " Laporan";

    if (!reportsLogs || reportsLogs.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 font-bold text-center py-4">Belum ada laporan tersimpan.</p>`;
        return;
    }

    container.innerHTML = reportsLogs.map(item => `
        <div class="neo-card p-3 bg-zinc-50 border-2 border-black space-y-1">
            <div class="flex items-center justify-between">
                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-yellow-300 border border-black">${item.category}</span>
                <span class="text-[9px] font-mono font-bold text-gray-500">${item.date_string || ''}</span>
            </div>
            <p class="text-xs font-semibold text-black break-words pt-1">${item.description}</p>
        </div>
    `).join('');
}

async function syncSupabaseReports() {
    if (supabase.isConfigured()) {
        const sbReports = await supabase.getReports();
        if (sbReports) { reportsLogs = sbReports; renderReports(); }
    }
}

async function syncSupabaseActivations() {
    if (supabase.isConfigured()) {
        const sbData = await supabase.getActivations();
        if (sbData) {
            historyLogs = sbData;
            historyLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            updateCounts();
            if (activeTabName === 'riwayat') { renderHistory(); updateChartData(); }
        }
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast-notif');
    document.getElementById('toast-message').textContent = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => toast.classList.add('opacity-0', 'pointer-events-none'), 3000);
}

function updateCounts() {
    const countActivations = historyLogs.length;
    document.getElementById('activations-count').textContent = countActivations;
    document.getElementById('act-total-count').textContent = countActivations;

    const todayStr = new Date().toDateString();
    const todayCount = historyLogs.filter(h => h.dateString === todayStr || h.date_string?.includes(todayStr)).length;
    document.getElementById('act-today-count').textContent = todayCount;
    document.getElementById('visitors-count').textContent = totalVisitors;
    updateChartData();
}

async function initFirebase() {
    try {
        if (CONFIG.FIREBASE_CONFIG && Object.keys(CONFIG.FIREBASE_CONFIG).length > 0) {
            app = initializeApp(CONFIG.FIREBASE_CONFIG);
            db = getFirestore(app);
            auth = getAuth(app);

            if (CONFIG.INITIAL_AUTH_TOKEN) await signInWithCustomToken(auth, CONFIG.INITIAL_AUTH_TOKEN);
            else await signInAnonymously(auth);
            userId = auth.currentUser?.uid || crypto.randomUUID();

            await setDoc(doc(db, 'artifacts', CONFIG.APP_ID, 'public', 'data', 'visitors', userId), { lastSeen: Date.now() }, { merge: true });

            onSnapshot(collection(db, 'artifacts', CONFIG.APP_ID, 'public', 'data', 'visitors'), (snapshot) => {
                if (!supabase.isConfigured()) { totalVisitors = snapshot.size; updateCounts(); }
            });

            onSnapshot(collection(db, 'artifacts', CONFIG.APP_ID, 'public', 'data', 'activations'), (snapshot) => {
                let firestoreLogs = [];
                snapshot.forEach(docSnap => firestoreLogs.push(docSnap.data()));
                if (!supabase.isConfigured() || firestoreLogs.length > historyLogs.length) {
                    historyLogs = firestoreLogs;
                    historyLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    updateCounts();
                    if (activeTabName === 'riwayat') renderHistory();
                }
            });
        }
    } catch (e) { console.error("Firebase init error:", e); }
}

async function pingPresence() {
    if (supabase.isConfigured()) {
        if (!userId) userId = crypto.randomUUID();
        await supabase.updatePresence(userId);
        const sbVisitors = await supabase.getActiveVisitors();
        if (sbVisitors !== null) { totalVisitors = sbVisitors; updateCounts(); }
    }
}

initFirebase();
pingPresence();
setInterval(pingPresence, 10000);
syncSupabaseActivations();
syncSupabaseReports();
setInterval(() => { syncSupabaseActivations(); syncSupabaseReports(); }, 5000);

// Inisialisasi awal UI
setTimeout(() => {
    document.getElementById('supabase-url').value = localStorage.getItem('supabase_url') || '';
    document.getElementById('supabase-key').value = localStorage.getItem('supabase_key') || '';
    checkSupabaseStatus();
}, 300);

setInterval(() => {
    const now = new Date();
    document.getElementById('live-clock').textContent = now.toLocaleTimeString('id-ID');
    document.getElementById('current-date-time').textContent = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID');
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('live-uptime').textContent = `${Math.floor(elapsedSec / 60).toString().padStart(2, '0')}:${(elapsedSec % 60).toString().padStart(2, '0')}`;
}, 1000);
