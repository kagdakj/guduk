document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'subscription_burner_data';
    const formatKRW = (n) => Number(n).toLocaleString('ko-KR');

    const loadData = () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    };

    const calDays = document.getElementById('cal-days');
    const calMonthLabel = document.getElementById('cal-month-label');
    const calTotal = document.getElementById('cal-total');
    const calCount = document.getElementById('cal-count');
    const calDetail = document.getElementById('cal-detail');
    const calDetailTitle = document.getElementById('cal-detail-title');
    const calDetailList = document.getElementById('cal-detail-list');
    const calEmpty = document.getElementById('cal-empty');
    const calPrev = document.getElementById('cal-prev');
    const calNext = document.getElementById('cal-next');

    let currentYear, currentMonth; // 0-indexed month

    const init = () => {
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth();
        render();
    };

    calPrev.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        render();
    });

    calNext.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        render();
    });

    const render = () => {
        const data = loadData();
        calDetail.classList.add('hidden');

        if (!data || !data.subscriptions || data.subscriptions.length === 0) {
            calEmpty.classList.remove('hidden');
            calDays.innerHTML = '';
            calMonthLabel.textContent = '';
            calTotal.innerHTML = '0<span class="unit">원</span>';
            calCount.innerHTML = '0<span class="unit">건</span>';
            return;
        }
        calEmpty.classList.add('hidden');

        // Month label
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        calMonthLabel.textContent = `${currentYear}년 ${monthNames[currentMonth]}`;

        // Build billing day map
        const dayMap = {}; // day -> [subs]
        let monthTotal = 0;
        let monthCount = 0;

        data.subscriptions.forEach(sub => {
            let day = parseInt(sub.estimated_billing_day);
            
            // Fallback for missing or invalid dates (legacy data or AI failure)
            if (isNaN(day) || day < 1 || day > 31) {
                day = 1; 
                sub._isFallbackDay = true;
            }

            // Check if this day exists in current month (e.g. Feb 30 -> Feb 28)
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const effectiveDay = Math.min(day, daysInMonth);

            if (!dayMap[effectiveDay]) dayMap[effectiveDay] = [];
            dayMap[effectiveDay].push(sub);

            if (sub.frequency === 'yearly') {
                monthTotal += Math.round(sub.amount / 12);
            } else {
                monthTotal += sub.amount;
            }
            monthCount++;
        });

        calTotal.innerHTML = `${formatKRW(monthTotal)}<span class="unit">원</span>`;
        calCount.innerHTML = `${monthCount}<span class="unit">건</span>`;

        // Render calendar grid
        const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

        calDays.innerHTML = '';

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-cell cal-empty-cell';
            calDays.appendChild(empty);
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell';

            const hasSubs = dayMap[d] && dayMap[d].length > 0;
            const isToday = isCurrentMonth && today.getDate() === d;

            if (isToday) cell.classList.add('cal-today');
            if (hasSubs) cell.classList.add('cal-has-event');

            let html = `<span class="cal-date">${d}</span>`;
            if (hasSubs) {
                const count = dayMap[d].length;
                const total = dayMap[d].reduce((sum, s) => {
                    return sum + (s.frequency === 'yearly' ? Math.round(s.amount / 12) : s.amount);
                }, 0);
                html += `<span class="cal-dot-row">`;
                for (let i = 0; i < Math.min(count, 3); i++) html += `<span class="cal-dot"></span>`;
                if (count > 3) html += `<span class="cal-dot-more">+${count - 3}</span>`;
                html += `</span>`;
                html += `<span class="cal-cell-amount">${formatKRW(total)}원</span>`;
            }
            cell.innerHTML = html;

            if (hasSubs) {
                cell.addEventListener('click', () => showDayDetail(d, dayMap[d]));
            }

            calDays.appendChild(cell);
        }

        lucide.createIcons();
    };

    const showDayDetail = (day, subs) => {
        calDetail.classList.remove('hidden');
        calDetailTitle.textContent = `${currentMonth + 1}월 ${day}일 결제 예정`;
        calDetailList.innerHTML = '';

        subs.forEach(sub => {
            const li = document.createElement('li');
            li.className = 'sub-item';
            const displayAmount = sub.frequency === 'yearly' ? sub.amount : sub.amount;
            const freqLabel = sub.frequency === 'yearly' ? '연간' : '월간';
            const fallbackNote = sub._isFallbackDay ? ' <span class="sub-note" style="color:var(--orange)">결제일 미상 (1일로 표시)</span>' : '';
            
            li.innerHTML = `
                <div class="sub-info">
                    <span class="sub-name">${sub.name}${fallbackNote}</span>
                    <span class="sub-meta">${sub.category || '기타'} · ${freqLabel}${sub.note ? ' · ' + sub.note : ''}</span>
                </div>
                <div class="sub-right">
                    <span class="sub-amount">${formatKRW(displayAmount)}원</span>
                </div>
            `;
            calDetailList.appendChild(li);
        });

        // Scroll to detail
        calDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    init();
});
