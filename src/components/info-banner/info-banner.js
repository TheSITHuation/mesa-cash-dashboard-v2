
import { listenToTableData, listenToSeats } from \1\2firebase\3;
import { openTableSettingsModal } from '../table-settings-modal/table-settings-modal.js';

const bannerEl = document.getElementById('info-banner');

export function initInfoBanner() {
    bannerEl.addEventListener('click', openTableSettingsModal);
    bannerEl.style.cursor = 'pointer';

    let tableInfo = {};
    let seatsInfo = {};

    listenToTableData(data => {
        tableInfo = data || {};
        renderBanner(tableInfo, seatsInfo);
    });

    listenToSeats(data => {
        seatsInfo = data || {};
        renderBanner(tableInfo, seatsInfo);
    });
}

function renderBanner(tableInfo, seatsInfo) {
    if (!bannerEl) return;

    const availableSeats = Object.values(seatsInfo).filter(s => s.status === 'available').length;
    const buyInRange = `$${tableInfo.buyInMin?.toLocaleString() || 'N/A'} - $${tableInfo.buyInMax?.toLocaleString() || 'N/A'}`;

    if (!bannerEl.innerHTML) {
        bannerEl.innerHTML = `
            <div class="banner-item">
                <div class="label">Blinds</div>
                <div class="value" data-value="blinds">N/A</div>
            </div>
            <div class="banner-item">
                <div class="label">Buy-in</div>
                <div class="value" data-value="buyin">N/A</div>
            </div>
            <div class="banner-item">
                <div class="label">Juego</div>
                <div class="value" data-value="gametype">N/A</div>
            </div>
            <div class="banner-item">
                <div class="label">Asientos Libres</div>
                <div class="value" data-value="seats">0</div>
            </div>
        `;
    }

    bannerEl.querySelector('[data-value="blinds"]').textContent = tableInfo.blinds || 'N/A';
    bannerEl.querySelector('[data-value="buyin"]').textContent = buyInRange;
    bannerEl.querySelector('[data-value="gametype"]').textContent = tableInfo.gameType || 'CASH GAME';
    bannerEl.querySelector('[data-value="seats"]').textContent = availableSeats;
}