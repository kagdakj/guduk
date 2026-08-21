document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM References ───
    const inputView = document.getElementById('input-view');
    const dashboardView = document.getElementById('dashboard-view');
    const textarea = document.getElementById('billing-text');
    const analyzeBtn = document.getElementById('analyze-btn');
    const cancelInputBtn = document.getElementById('cancel-input-btn');
    const navAddBtn = document.getElementById('nav-add-btn');
    const navCalBtn = document.getElementById('nav-calendar-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    const dashMonthly = document.getElementById('dash-monthly');
    const dashYearly = document.getElementById('dash-yearly');
    const dashSubCount = document.getElementById('dash-sub-count');
    const dashSubsList = document.getElementById('dash-subs-list');
    const dashSavings = document.getElementById('dash-savings');
    const sectionSavings = document.getElementById('section-savings');
    const receiptDate = document.getElementById('receipt-date');
    const receiptNo = document.getElementById('receipt-no');
    const receiptCode = document.getElementById('receipt-code');

    const sectionInsights = document.getElementById('section-insights');
    const listInsights = document.getElementById('list-insights');
    const sectionAshes = document.getElementById('section-ashes');
    const ashesCount = document.getElementById('ashes-count');
    const dashAshesYearly = document.getElementById('dash-ashes-yearly');

    const sectionUpcoming = document.getElementById('section-upcoming');
    const listUpcoming = document.getElementById('list-upcoming');
    const sectionOverlaps = document.getElementById('section-overlaps');
    const listOverlaps = document.getElementById('list-overlaps');
    const sectionPrice = document.getElementById('section-price');
    const listPrice = document.getElementById('list-price');
    const sectionTrial = document.getElementById('section-trial');
    const listTrial = document.getElementById('list-trial');
    const sectionCycle = document.getElementById('section-cycle');
    const listCycle = document.getElementById('list-cycle');

    const editModal = document.getElementById('edit-modal');
    const editName = document.getElementById('edit-name');
    const editAmount = document.getElementById('edit-amount');
    const editFreq = document.getElementById('edit-freq');
    const editCategory = document.getElementById('edit-category');
    const editBillingDay = document.getElementById('edit-billing-day');
    const editSaveBtn = document.getElementById('edit-save');
    const editCancelBtn = document.getElementById('edit-cancel');

    const shareModal = document.getElementById('share-modal');
    const shareCanvas = document.getElementById('share-canvas');
    const shareClose = document.getElementById('share-close');
    const shareDownload = document.getElementById('share-download');

    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const btnShare = document.getElementById('btn-share');
    const btnRemind = document.getElementById('btn-remind');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    let editingSubIndex = -1;
    let chartInstance = null;

    // ─── Cancel Links ───
    const CANCEL_LINKS = {
        '넷플릭스': 'https://www.netflix.com/cancelplan',
        '유튜브 프리미엄': 'https://www.youtube.com/paid_memberships',
        '유튜브프리미엄': 'https://www.youtube.com/paid_memberships',
        '스포티파이': 'https://www.spotify.com/account/subscription/',
        '애플뮤직': 'https://support.apple.com/ko-kr/HT202039',
        '멜론': 'https://www.melon.com/mymusic/ticket/mymusicticket_listForm.htm',
        '쿠팡플레이': 'https://www.coupang.com/np/coupangplay',
        '쿠팡': 'https://mc.coupang.com/ssr/desktop/membership/landing',
        '웨이브': 'https://www.wavve.com/my/subscription',
        '왓챠': 'https://watcha.com/settings/account',
        '티빙': 'https://www.tving.com/my/membership',
        '디즈니+': 'https://www.disneyplus.com/account/subscription',
        '디즈니플러스': 'https://www.disneyplus.com/account/subscription',
        '네이버플러스': 'https://nid.naver.com/membership/my',
        '노션': 'https://www.notion.so/my-account',
        '어도비': 'https://account.adobe.com/plans',
        '챗gpt': 'https://chat.openai.com/#settings',
        'chatgpt': 'https://chat.openai.com/#settings',
    };

    // ─── Helpers ───
    const STORAGE_KEY = 'subscription_burner_data';
    const saveData = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    const loadData = () => { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; };
    const formatKRW = (n) => Number(n).toLocaleString('ko-KR');

    const animateValue = (el, start, end, dur) => {
        if (end === 0) { el.textContent = '0'; return; }
        const range = end - start;
        let cur = start;
        const step = Math.max(1, Math.floor(range / (dur / 16)));
        const t = setInterval(() => {
            cur += step;
            if (cur >= end) { cur = end; clearInterval(t); }
            el.textContent = formatKRW(cur);
        }, 16);
    };

    const findCancelLink = (name) => {
        if (!name) return null;
        const lower = name.toLowerCase().trim();
        for (const [k, url] of Object.entries(CANCEL_LINKS)) {
            if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return url;
        }
        return null;
    };

    // ─── Ashes: cumulative realized savings from subs actually deleted ───
    const ASHES_KEY = 'subscription_burner_ashes';
    const loadAshes = () => {
        const r = localStorage.getItem(ASHES_KEY);
        return r ? JSON.parse(r) : { count: 0, monthly: 0, yearly: 0, items: [] };
    };
    const saveAshes = (a) => localStorage.setItem(ASHES_KEY, JSON.stringify(a));
    const addToAshes = (sub) => {
        const ashes = loadAshes();
        const monthlyEq = sub.frequency === 'yearly' ? Math.round(sub.amount / 12) : sub.amount;
        const yearlyEq = sub.frequency === 'yearly' ? sub.amount : sub.amount * 12;
        ashes.count += 1;
        ashes.monthly += monthlyEq;
        ashes.yearly += yearlyEq;
        ashes.items.push({ name: sub.name, amount: sub.amount, frequency: sub.frequency, at: new Date().toISOString() });
        if (ashes.items.length > 50) ashes.items = ashes.items.slice(-50);
        saveAshes(ashes);
        return ashes;
    };

    // ─── Spending Insights: rule-based, computed from verifiable data only ───
    const computeInsights = (data) => {
        const insights = [];
        const subs = data.subscriptions || [];
        if (subs.length === 0) return insights;

        const monthlyTotal = data.totals?.monthly || 0;

        // 1) Alert signal summary (highest priority — actionable, time-sensitive)
        const alertCount = (data.price_changes || []).length + (data.trial_conversions || []).length + (data.cycle_mismatches || []).length;
        if (alertCount > 0) {
            insights.push({
                type: 'warning',
                text: `이번 분석에서 주의할 점이 ${alertCount}건 발견됐습니다. 위 항목을 확인해보세요.`
            });
        }

        // 2) Category concentration
        if (monthlyTotal > 0) {
            const catMap = {};
            subs.forEach(s => {
                const amt = s.frequency === 'yearly' ? Math.round(s.amount / 12) : s.amount;
                catMap[s.category || '기타'] = (catMap[s.category || '기타'] || 0) + amt;
            });
            const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
            if (cats.length >= 2) {
                const [topCat, topAmt] = cats[0];
                const pct = Math.round((topAmt / monthlyTotal) * 100);
                if (pct >= 40) {
                    insights.push({
                        type: pct >= 55 ? 'warning' : 'info',
                        text: `'${topCat}' 카테고리가 전체 구독 지출의 ${pct}%를 차지합니다.`
                    });
                }
            }

            // 3) Single subscription concentration
            const top1 = [...subs].sort((a, b) => {
                const am = a.frequency === 'yearly' ? Math.round(a.amount / 12) : a.amount;
                const bm = b.frequency === 'yearly' ? Math.round(b.amount / 12) : b.amount;
                return bm - am;
            })[0];
            if (top1) {
                const top1Eq = top1.frequency === 'yearly' ? Math.round(top1.amount / 12) : top1.amount;
                const pct1 = Math.round((top1Eq / monthlyTotal) * 100);
                if (pct1 >= 30 && subs.length >= 3) {
                    insights.push({
                        type: 'info',
                        text: `'${top1.name}' 한 건이 전체 구독 지출의 ${pct1}%를 차지합니다.`
                    });
                }
            }
        }

        // 4) Overlap potential vs current spend ratio
        let potentialSavings = 0;
        (data.overlaps || []).forEach(o => potentialSavings += (o.potential_yearly_savings || 0));
        const yearlyTotal = data.totals?.yearly || 0;
        if (potentialSavings > 0 && yearlyTotal > 0) {
            const savePct = Math.round((potentialSavings / yearlyTotal) * 100);
            if (savePct >= 15) {
                insights.push({
                    type: 'positive',
                    text: `중복 구독만 정리하면 연간 지출의 ${savePct}%를 아낄 수 있습니다.`
                });
            }
        }

        return insights.slice(0, 3);
    };

    // ─── Chart ───
    const COLORS = ['#201f1c','#b1372c','#8a8578','#a8631a','#595650','#c9c3b0','#6e6a5f','#4a473f','#d8452f','#b9b4a6'];

    const renderChart = (subs) => {
        const catMap = {};
        subs.forEach(s => {
            const amt = s.frequency === 'yearly' ? Math.round(s.amount / 12) : s.amount;
            catMap[s.category || '기타'] = (catMap[s.category || '기타'] || 0) + amt;
        });
        if (chartInstance) chartInstance.destroy();
        const ctx = document.getElementById('category-chart').getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catMap),
                datasets: [{ data: Object.values(catMap), backgroundColor: COLORS.slice(0, Object.keys(catMap).length), borderWidth: 2, borderColor: '#faf8f0', hoverOffset: 6 }]
            },
            options: {
                responsive: true, maintainAspectRatio: true, cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { color: '#201f1c', padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 11, family: "'Nanum Gothic Coding', monospace" } } } },
                animation: { animateRotate: true, duration: 800 }
            }
        });
    };

    // ─── Upcoming Payments ───
    const renderUpcoming = (subs) => {
        const today = new Date();
        const todayDay = today.getDate();
        const upcoming = [];

        subs.forEach(s => {
            if (!s.estimated_billing_day) return;
            const bDay = s.estimated_billing_day;
            let diff = bDay - todayDay;
            if (diff < 0) diff += 30; // next month
            if (diff <= 7) {
                upcoming.push({ ...s, daysUntil: diff });
            }
        });

        if (upcoming.length === 0) {
            sectionUpcoming.classList.add('hidden');
            return;
        }

        upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
        sectionUpcoming.classList.remove('hidden');
        listUpcoming.innerHTML = '';

        upcoming.forEach(s => {
            const li = document.createElement('li');
            li.className = 'upcoming-item';
            const dayLabel = s.daysUntil === 0 ? '오늘' : s.daysUntil === 1 ? '내일' : `${s.daysUntil}일 후`;
            li.innerHTML = `
                <div class="upcoming-left">
                    <span class="upcoming-day">${dayLabel}</span>
                    <span class="upcoming-name">${s.name}</span>
                </div>
                <span class="upcoming-amount">${formatKRW(s.amount)}원</span>
            `;
            listUpcoming.appendChild(li);
        });
    };

    // ─── Render Dashboard ───
    const renderDashboard = (data) => {
        try {
            inputView.classList.add('hidden');
            dashboardView.classList.remove('hidden');
            navAddBtn.classList.remove('hidden');
            navCalBtn.classList.remove('hidden');

            if (!data.subscriptions) data.subscriptions = [];

            // Receipt header
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            receiptDate.textContent = `발행일 ${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            receiptNo.textContent = `NO. ${pad(data.subscriptions.length)}${pad(now.getDate())}`;

            let mTotal = 0, yTotal = 0;
            data.subscriptions.forEach(s => {
                if (s.frequency === 'yearly') { yTotal += s.amount; mTotal += Math.round(s.amount / 12); }
                else { mTotal += s.amount; yTotal += s.amount * 12; }
            });
            data.totals = { monthly: mTotal, yearly: yTotal };
            saveData(data);

            animateValue(dashMonthly, 0, mTotal, 1200);
            animateValue(dashYearly, 0, yTotal, 1200);

            // Upcoming
            renderUpcoming(data.subscriptions);

            // Chart
            if (data.subscriptions.length > 0) renderChart(data.subscriptions);

            // Sub list
            dashSubCount.textContent = data.subscriptions.length;
            dashSubsList.innerHTML = '';
            data.subscriptions.forEach((sub, i) => {
                const li = document.createElement('li');
                li.className = 'sub-item';
                const cancelUrl = findCancelLink(sub.name);
                const cancelHtml = cancelUrl ? `<a href="${cancelUrl}" target="_blank" rel="noopener" class="cancel-link">해지하기</a>` : '';
                const noteHtml = sub.note ? `<span class="sub-note">${sub.note}</span>` : '';
                const billingDayHtml = sub.estimated_billing_day ? `매월 ${sub.estimated_billing_day}일` : '';
                const metaParts = [sub.category || '기타', sub.frequency === 'yearly' ? '연간' : '월간', billingDayHtml].filter(Boolean);

                li.innerHTML = `
                    <div class="sub-info">
                        <span class="sub-name">${sub.name} ${noteHtml}</span>
                        <span class="sub-meta">${metaParts.join(' · ')} ${cancelHtml}</span>
                    </div>
                    <div class="sub-right">
                        <span class="sub-amount">${formatKRW(sub.amount)}원</span>
                        <div class="sub-actions">
                            <button class="btn-icon btn-icon-sm edit-sub" data-index="${i}"><i data-lucide="pencil" style="width:14px;height:14px"></i></button>
                            <button class="btn-icon btn-icon-sm text-danger del-sub" data-index="${i}"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
                        </div>
                    </div>
                `;
                dashSubsList.appendChild(li);
            });

            // Spending Insights (rule-based, from verifiable computed data only)
            const insights = computeInsights(data);
            if (insights.length > 0) {
                sectionInsights.classList.remove('hidden');
                listInsights.innerHTML = insights.map(ins =>
                    `<li class="insight-${ins.type}">${ins.text}</li>`
                ).join('');
            } else {
                sectionInsights.classList.add('hidden');
            }

            // Ashes: cumulative realized savings from subs actually deleted
            const ashes = loadAshes();
            if (ashes.count > 0) {
                sectionAshes.classList.remove('hidden');
                ashesCount.textContent = ashes.count;
                animateValue(dashAshesYearly, 0, ashes.yearly, 1500);
            } else {
                sectionAshes.classList.add('hidden');
            }

            // Alerts
            renderAlert(sectionOverlaps, listOverlaps, data.overlaps, o =>
                `<strong>${(o.services || []).join(' + ')}</strong> — ${o.reason || o.category + ' 중복'}`);

            let totalSavings = 0;
            (data.overlaps || []).forEach(o => totalSavings += (o.potential_yearly_savings || 0));
            if (totalSavings > 0) {
                sectionSavings.classList.remove('hidden');
                animateValue(dashSavings, 0, totalSavings, 1500);
            } else {
                sectionSavings.classList.add('hidden');
            }

            receiptCode.textContent = `*${pad(mTotal % 10000)}-${pad(data.subscriptions.length)}-${pad(yTotal % 100)}*`;

            renderAlert(sectionPrice, listPrice, data.price_changes, p =>
                `<strong>${p.name}</strong>: ${formatKRW(p.previous_amount)}원 → ${formatKRW(p.current_amount)}원 (${formatKRW(p.current_amount - p.previous_amount)}원 인상)`);
            renderAlert(sectionTrial, listTrial, data.trial_conversions, t =>
                `<strong>${t.name}</strong> — ${t.message}`);
            renderAlert(sectionCycle, listCycle, data.cycle_mismatches, c =>
                `<strong>${c.name}</strong> — ${c.message}`);

            lucide.createIcons();
            bindSubActions();
        } catch (e) { console.error('Dashboard render error:', e); }
    };

    const renderAlert = (section, list, items, fmt) => {
        if (items && items.length > 0) {
            section.classList.remove('hidden');
            list.innerHTML = '';
            items.forEach(item => { const li = document.createElement('li'); li.innerHTML = fmt(item); list.appendChild(li); });
        } else { section.classList.add('hidden'); }
    };

    const bindSubActions = () => {
        document.querySelectorAll('.edit-sub').forEach(b => b.addEventListener('click', () => openEditModal(b.dataset.index)));
        document.querySelectorAll('.del-sub').forEach(b => b.addEventListener('click', () => deleteSub(b.dataset.index)));
    };

    // ─── Edit Modal ───
    const openEditModal = (index) => {
        const data = loadData();
        if (!data) return;
        editingSubIndex = parseInt(index);
        const sub = data.subscriptions[editingSubIndex];
        editName.value = sub.name || '';
        editAmount.value = sub.amount || 0;
        editFreq.value = sub.frequency || 'monthly';
        editCategory.value = sub.category || '';
        editBillingDay.value = sub.estimated_billing_day || '';
        editModal.classList.remove('hidden');
    };

    editCancelBtn.addEventListener('click', () => editModal.classList.add('hidden'));

    editSaveBtn.addEventListener('click', () => {
        const data = loadData();
        if (!data || editingSubIndex < 0) return;
        data.subscriptions[editingSubIndex] = {
            ...data.subscriptions[editingSubIndex],
            name: editName.value.trim(),
            amount: parseInt(editAmount.value) || 0,
            frequency: editFreq.value,
            category: editCategory.value.trim(),
            estimated_billing_day: parseInt(editBillingDay.value) || null,
        };
        saveData(data);
        editModal.classList.add('hidden');
        renderDashboard(data);
    });

    // ─── Delete with Burn ───
    const deleteSub = (index) => {
        if (!confirm('이 구독을 삭제하시겠습니까?')) return;
        const items = document.querySelectorAll('.sub-item');
        const target = items[parseInt(index)];
        const doDelete = () => {
            const data = loadData(); if (!data) return;
            const removed = data.subscriptions[parseInt(index)];
            if (removed) addToAshes(removed);
            data.subscriptions.splice(parseInt(index), 1);
            saveData(data); renderDashboard(data);
        };
        if (target) {
            target.classList.add('burn-out');
            target.addEventListener('animationend', doDelete, { once: true });
        } else { doDelete(); }
    };

    // ─── Navigation ───
    navAddBtn.addEventListener('click', () => {
        dashboardView.classList.add('hidden');
        inputView.classList.remove('hidden');
        textarea.value = ''; textarea.focus();
        if (loadData()) cancelInputBtn.classList.remove('hidden');
    });

    cancelInputBtn.addEventListener('click', () => {
        const data = loadData();
        if (data) renderDashboard(data);
    });

    // ─── Analyze (merge) ───
    analyzeBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) { alert('결제 내역을 입력해주세요.'); return; }
        loadingOverlay.classList.remove('hidden');

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 35000);

        try {
            const res = await fetch('api/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }), signal: ctrl.signal
            });
            clearTimeout(tid);
            if (!res.ok) throw new Error('API error');
            const newData = await res.json();

            const existing = loadData();
            let finalData = newData;

            if (existing && existing.subscriptions && existing.subscriptions.length > 0) {
                const merged = [...existing.subscriptions];
                (newData.subscriptions || []).forEach(ns => {
                    const idx = merged.findIndex(s => s.name === ns.name);
                    if (idx === -1) merged.push(ns); else merged[idx] = { ...merged[idx], ...ns };
                });
                finalData = {
                    subscriptions: merged,
                    totals: newData.totals,
                    overlaps: newData.overlaps || existing.overlaps || [],
                    price_changes: newData.price_changes || existing.price_changes || [],
                    trial_conversions: newData.trial_conversions || existing.trial_conversions || [],
                    cycle_mismatches: newData.cycle_mismatches || existing.cycle_mismatches || [],
                };
            }

            loadingOverlay.classList.add('hidden');
            saveData(finalData);
            renderDashboard(finalData);
        } catch (err) {
            clearTimeout(tid);
            loadingOverlay.classList.add('hidden');
            alert(err.name === 'AbortError' ? '서버 응답 시간 초과. 다시 시도해주세요.' : '분석 실패. 텍스트를 확인해주세요.');
        }
    });

    // ─── CSV Export ───
    btnExport.addEventListener('click', () => {
        const data = loadData();
        if (!data || !data.subscriptions.length) { alert('내보낼 데이터가 없습니다.'); return; }
        const BOM = '\uFEFF';
        let csv = BOM + '서비스,금액(원),주기,카테고리,결제일,메모\n';
        data.subscriptions.forEach(s => {
            csv += `"${s.name}",${s.amount},${s.frequency === 'yearly' ? '연간' : '월간'},"${s.category || ''}",${s.estimated_billing_day || ''},"${s.note || ''}"\n`;
        });
        csv += `\n"월간 합계",${data.totals.monthly},,,,\n"연간 합계",${data.totals.yearly},,,,\n`;
        downloadBlob(csv, 'text/csv;charset=utf-8;', `구독소각기_${new Date().toISOString().slice(0,10)}.csv`);
    });

    // ─── CSV Import ───
    btnImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
                if (lines.length < 2) { alert('유효한 CSV 파일이 아닙니다.'); return; }

                const imported = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('"월간') || line.startsWith('"연간') || !line) continue;
                    const cols = parseCSVLine(line);
                    if (cols.length < 4) continue;
                    imported.push({
                        name: cols[0].replace(/"/g, ''),
                        amount: parseInt(cols[1]) || 0,
                        frequency: cols[2].includes('연') ? 'yearly' : 'monthly',
                        category: cols[3].replace(/"/g, ''),
                        estimated_billing_day: parseInt(cols[4]) || null,
                        note: (cols[5] || '').replace(/"/g, '') || null,
                    });
                }

                if (imported.length === 0) { alert('가져올 구독 데이터가 없습니다.'); return; }

                const existing = loadData();
                let subs = existing && existing.subscriptions ? [...existing.subscriptions] : [];
                imported.forEach(ns => {
                    const idx = subs.findIndex(s => s.name === ns.name);
                    if (idx === -1) subs.push(ns); else subs[idx] = { ...subs[idx], ...ns };
                });

                const finalData = {
                    subscriptions: subs,
                    totals: { monthly: 0, yearly: 0 },
                    overlaps: existing?.overlaps || [],
                    price_changes: existing?.price_changes || [],
                    trial_conversions: existing?.trial_conversions || [],
                    cycle_mismatches: existing?.cycle_mismatches || [],
                };
                saveData(finalData);
                renderDashboard(finalData);
                alert(`${imported.length}개 구독이 가져오기 되었습니다.`);
            } catch (err) {
                console.error(err);
                alert('CSV 파싱 실패. 파일 형식을 확인해주세요.');
            }
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = ''; // reset
    });

    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
            else { current += ch; }
        }
        result.push(current);
        return result;
    };

    // ─── Share Card Preview (renders an actual receipt image) ───
    btnShare.addEventListener('click', async () => {
        const data = loadData();
        if (!data) return;
        await drawShareReceipt(data);
        shareModal.classList.remove('hidden');
    });

    shareClose.addEventListener('click', () => shareModal.classList.add('hidden'));

    shareDownload.addEventListener('click', () => {
        shareCanvas.toBlob(blob => {
            downloadBlob(blob, null, '구독소각기_영수증.png');
        });
    });

    const drawShareReceipt = async (data) => {
        try {
            await Promise.all([
                document.fonts.load('700 40px "Nanum Gothic Coding"'),
                document.fonts.load('400 24px "Nanum Gothic Coding"'),
                document.fonts.load('700 30px "Space Mono"'),
                document.fonts.load('400 24px "Space Mono"'),
            ]);
        } catch (e) { /* fonts may fail to preload; canvas will fall back gracefully */ }

        const MONO = '"Nanum Gothic Coding", monospace';
        const NUM = '"Space Mono", monospace';
        const INK = '#201f1c', INK_SOFT = '#595650', RED = '#b1372c', ORANGE = '#e8a13a', GREEN = '#2f6b4f', PAPER = '#faf8f0';

        const insights = computeInsights(data);
        const ashes = loadAshes();
        let totalSavings = 0;
        (data.overlaps || []).forEach(o => totalSavings += (o.potential_yearly_savings || 0));

        const LW = 720; // logical (CSS) width
        const marginX = 40, topPad = 60, bottomPad = 60;
        const padX = marginX + 44;
        const contentW = LW - padX * 2;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');

        // Use a scratch context (unresized) purely for text measurement during layout.
        const measureCtx = shareCanvas.getContext('2d');

        const items = [...data.subscriptions].sort((a, b) => b.amount - a.amount).slice(0, 6);
        const overflowCount = data.subscriptions.length - items.length;

        let insightLines = [];
        if (insights.length > 0) {
            measureCtx.font = `13px ${MONO}`;
            insights.forEach(ins => {
                const wrapped = wrapText(measureCtx, '· ' + ins.text, contentW);
                insightLines.push(...wrapped);
            });
        }

        // ─ Layout pass: compute content height up front so the canvas fits exactly ─
        let y = topPad + 70;
        y += 44;  // flame icon
        y += 28;  // title
        y += 40;  // subtitle
        y += 30;  // date
        y += 50;  // divider + gap
        y += 34;  // monthly total
        y += 40;  // yearly total
        y += 40;  // divider + gap
        y += items.length * 32;
        if (overflowCount > 0) y += 30;
        y += 10;
        y += 50;  // divider + gap
        if (insightLines.length > 0) {
            y += 34; // section label
            y += insightLines.length * 22;
            y += 26; // gap
            y += 40; // divider + gap
        }
        if (ashes.count > 0) {
            y += 32; // label line
            y += 56; // big number
            y += 40; // divider + gap
        }
        if (totalSavings > 0) {
            y += 46;
            y += 56;
        } else {
            y += 40;
        }
        y += 46; // divider + gap
        y += 66; // barcode
        y += 34; // code text
        y += 22; // thanks
        y += 22; // tagline
        const LH = Math.round(y + bottomPad);

        // ─ Resize canvas to fit content, at 2x resolution for crisp export ─
        const DPR = 2;
        shareCanvas.width = LW * DPR;
        shareCanvas.height = LH * DPR;
        const ctx = shareCanvas.getContext('2d');
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        const W = LW, H = LH, CX = W / 2;

        // Desk background
        ctx.fillStyle = '#141414';
        ctx.fillRect(0, 0, W, H);

        // Receipt paper with jagged top/bottom edges
        const top = topPad, bottom = H - bottomPad;
        const jag = 14;
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.moveTo(marginX, top);
        for (let x = marginX; x < W - marginX; x += jag * 2) {
            ctx.lineTo(x + jag, top - jag / 2);
            ctx.lineTo(x + jag * 2, top);
        }
        ctx.lineTo(W - marginX, bottom);
        for (let x = W - marginX; x > marginX; x -= jag * 2) {
            ctx.lineTo(x - jag, bottom + jag / 2);
            ctx.lineTo(x - jag * 2, bottom);
        }
        ctx.closePath();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 40;
        ctx.fill();
        ctx.shadowBlur = 0;

        // ─ Content ─
        ctx.textAlign = 'center';
        y = top + 70;

        drawFlameIcon(ctx, CX, y, 34, RED, ORANGE);
        y += 44;

        ctx.fillStyle = INK;
        ctx.font = `800 36px ${MONO}`;
        ctx.fillText('구 독 소 각 기', CX, y);
        y += 28;

        ctx.fillStyle = INK_SOFT;
        ctx.font = `14px ${NUM}`;
        ctx.fillText('SUBSCRIPTION RECEIPT', CX, y);
        y += 40;

        ctx.font = `13px ${NUM}`;
        ctx.fillText(`${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}  ${pad(now.getHours())}:${pad(now.getMinutes())}`, CX, y);
        y += 30;

        dashedLine(ctx, padX, W - padX, y, INK, 2);
        y += 50;

        // Totals
        ctx.textAlign = 'left';
        ctx.fillStyle = INK_SOFT;
        ctx.font = `14px ${MONO}`;
        ctx.fillText('월간 합계', padX, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = INK;
        ctx.font = `700 20px ${NUM}`;
        ctx.fillText(`${formatKRW(data.totals.monthly)}원`, W - padX, y);
        y += 34;

        ctx.textAlign = 'left';
        ctx.fillStyle = INK_SOFT;
        ctx.font = `14px ${MONO}`;
        ctx.fillText('연간 환산', padX, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = INK;
        ctx.font = `700 20px ${NUM}`;
        ctx.fillText(`${formatKRW(data.totals.yearly)}원`, W - padX, y);
        y += 40;

        dashedLine(ctx, padX, W - padX, y, INK, 1);
        y += 40;

        // Item list (up to 6)
        ctx.font = `15px ${MONO}`;
        items.forEach(s => {
            ctx.textAlign = 'left';
            ctx.fillStyle = INK;
            ctx.fillText(truncate(s.name, 14), padX, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = INK_SOFT;
            ctx.font = `14px ${NUM}`;
            ctx.fillText(`${formatKRW(s.amount)}원`, W - padX, y);
            ctx.font = `15px ${MONO}`;
            y += 32;
        });
        if (overflowCount > 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = INK_SOFT;
            ctx.font = `13px ${MONO}`;
            ctx.fillText(`… 외 ${overflowCount}건`, CX, y);
            y += 30;
        }
        y += 10;

        dashedLine(ctx, padX, W - padX, y, INK, 2);
        y += 50;

        // Spending insights
        if (insightLines.length > 0) {
            ctx.textAlign = 'left';
            ctx.fillStyle = RED;
            ctx.font = `700 15px ${MONO}`;
            ctx.fillText('소비 인사이트', padX, y);
            y += 34;
            ctx.fillStyle = INK;
            ctx.font = `13px ${MONO}`;
            insightLines.forEach(line => {
                ctx.fillText(line, padX, y);
                y += 22;
            });
            y += 26;
            dashedLine(ctx, padX, W - padX, y, INK, 1);
            y += 40;
        }

        // Ashes: confirmed realized savings
        if (ashes.count > 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = INK_SOFT;
            ctx.font = `14px ${MONO}`;
            ctx.fillText(`${ashes.count}개 구독을 태워서 확정된 절약액`, CX, y);
            y += 46;
            ctx.fillStyle = GREEN;
            ctx.font = `700 40px ${NUM}`;
            ctx.fillText(`연 ${formatKRW(ashes.yearly)}원`, CX, y);
            y += 46;
            dashedLine(ctx, padX, W - padX, y, INK, 1);
            y += 40;
        }

        // Potential savings from overlaps
        if (totalSavings > 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = INK_SOFT;
            ctx.font = `14px ${MONO}`;
            ctx.fillText('겹치는 구독만 정리해도 아끼는 돈', CX, y);
            y += 46;
            ctx.fillStyle = RED;
            ctx.font = `700 44px ${NUM}`;
            ctx.fillText(`연 ${formatKRW(totalSavings)}원`, CX, y);
            y += 56;
        } else {
            ctx.textAlign = 'center';
            ctx.fillStyle = INK_SOFT;
            ctx.font = `14px ${MONO}`;
            ctx.fillText(`${data.subscriptions.length}개 구독, 확인 완료`, CX, y);
            y += 40;
        }

        dashedLine(ctx, padX, W - padX, y, INK, 1);
        y += 46;

        // Barcode
        drawBarcode(ctx, CX - 130, y, 260, 46, INK);
        y += 66;
        ctx.textAlign = 'center';
        ctx.fillStyle = INK_SOFT;
        ctx.font = `13px ${NUM}`;
        ctx.fillText(`*${pad(data.totals.monthly % 10000)}-${pad(data.subscriptions.length)}-${pad(data.totals.yearly % 100)}*`, CX, y);
        y += 34;

        ctx.fillStyle = INK;
        ctx.font = `700 16px ${MONO}`;
        ctx.fillText('감사합니다', CX, y);
        y += 22;
        ctx.fillStyle = INK_SOFT;
        ctx.font = `12px ${MONO}`;
        ctx.fillText('구독소각기 — 안 쓰는 구독, 태워버리세요', CX, y);
    };

    function truncate(str, n) {
        if (!str) return '';
        return str.length > n ? str.slice(0, n - 1) + '…' : str;
    }

    function wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let current = '';
        words.forEach(w => {
            const test = current ? current + ' ' + w : w;
            if (current && ctx.measureText(test).width > maxWidth) {
                lines.push(current);
                current = w;
            } else {
                current = test;
            }
        });
        if (current) lines.push(current);
        return lines;
    }

    function dashedLine(ctx, x1, x2, y, color, width) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.restore();
    }

    function drawBarcode(ctx, x, y, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        let cx = x;
        let seed = 17;
        while (cx < x + w) {
            seed = (seed * 9301 + 49297) % 233280;
            const barW = 2 + (seed % 4);
            const on = (seed % 3) !== 0;
            if (on) ctx.fillRect(cx, y, barW, h);
            cx += barW + 2;
        }
        ctx.restore();
    }

    // Vector flame icon (replaces emoji, which renders inconsistently on canvas across platforms)
    function drawFlameIcon(ctx, cx, baseY, size, outerColor, innerColor) {
        ctx.save();
        // Outer flame body
        ctx.beginPath();
        ctx.moveTo(cx, baseY);
        ctx.bezierCurveTo(cx - size * 0.55, baseY - size * 0.1, cx - size * 0.5, baseY - size * 0.65, cx - size * 0.15, baseY - size * 0.9);
        ctx.bezierCurveTo(cx - size * 0.05, baseY - size * 1.02, cx + size * 0.08, baseY - size * 1.12, cx, baseY - size * 1.25);
        ctx.bezierCurveTo(cx + size * 0.3, baseY - size * 0.95, cx + size * 0.55, baseY - size * 0.6, cx + size * 0.38, baseY - size * 0.18);
        ctx.bezierCurveTo(cx + size * 0.32, baseY - size * 0.02, cx + size * 0.15, baseY + size * 0.02, cx, baseY);
        ctx.closePath();
        ctx.fillStyle = outerColor;
        ctx.fill();
        ctx.restore();

        // Inner flame highlight
        ctx.save();
        const s2 = size * 0.5;
        const cy2 = baseY - size * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx, cy2);
        ctx.bezierCurveTo(cx - s2 * 0.45, cy2 - s2 * 0.25, cx - s2 * 0.3, cy2 - s2 * 0.7, cx, cy2 - s2 * 0.95);
        ctx.bezierCurveTo(cx + s2 * 0.3, cy2 - s2 * 0.7, cx + s2 * 0.45, cy2 - s2 * 0.25, cx, cy2);
        ctx.closePath();
        ctx.fillStyle = innerColor;
        ctx.fill();
        ctx.restore();
    }

    // ─── Calendar Reminder (.ics) ───
    btnRemind.addEventListener('click', () => {
        const now = new Date();
        const remind = new Date(now.getTime() + 90 * 86400000);
        const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const ics = [
            'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//구독소각기//KO','BEGIN:VEVENT',
            `DTSTART:${fmt(remind)}`,`DTEND:${fmt(new Date(remind.getTime()+3600000))}`,
            'SUMMARY:🔥 구독소각기: 3개월 점검 알림',
            'DESCRIPTION:카드 결제 문자를 다시 붙여넣어 구독 현황을 점검하세요!',
            `DTSTAMP:${fmt(now)}`,`UID:${Date.now()}@subscription-burner`,
            'END:VEVENT','END:VCALENDAR'
        ].join('\r\n');
        downloadBlob(ics, 'text/calendar;charset=utf-8', '구독소각기_리마인더.ics');
        alert('캘린더 파일이 다운로드되었습니다!');
    });

    // ─── Clear ───
    clearHistoryBtn.addEventListener('click', () => {
        if (!confirm('모든 기록을 삭제합니다. 되돌릴 수 없습니다.')) return;
        localStorage.removeItem(STORAGE_KEY);
        dashboardView.classList.add('hidden');
        inputView.classList.remove('hidden');
        navAddBtn.classList.add('hidden');
        navCalBtn.classList.add('hidden');
        cancelInputBtn.classList.add('hidden');
    });

    // ─── Util ───
    function downloadBlob(content, type, filename) {
        const blob = content instanceof Blob ? content : new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    // ─── Init ───
    const saved = loadData();
    if (saved && saved.subscriptions && saved.subscriptions.length > 0) {
        renderDashboard(saved);
    } else {
        inputView.classList.remove('hidden');
    }
});
