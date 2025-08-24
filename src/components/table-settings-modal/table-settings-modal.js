import { listenToTableData, updateTableDetails } from \1\2firebase\3;

const settingsModalEl = document.getElementById('table-settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-modal');
const settingsForm = document.getElementById('table-settings-form');
const gameTypeInput = document.getElementById('game-type-input');
const blindsInput = document.getElementById('blinds-input');
const buyInMinInput = document.getElementById('buyin-min-input');
const buyInMaxInput = document.getElementById('buyin-max-input');

export function initTableSettingsModal() {
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
    settingsModalEl.addEventListener('click', (e) => {
        if (e.target === settingsModalEl) closeSettingsModal();
    });

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newDetails = {
            gameType: gameTypeInput.value,
            blinds: blindsInput.value,
            buyInMin: Number(buyInMinInput.value),
            buyInMax: Number(buyInMaxInput.value)
        };
        updateTableDetails(newDetails);
        alert("¡Configuración de la mesa guardada!");
        closeSettingsModal();
    });
}

export function openTableSettingsModal() {
    listenToTableData((tableData) => {
        if (!tableData) return;
        gameTypeInput.value = tableData.gameType || '';
        blindsInput.value = tableData.blinds || '';
        buyInMinInput.value = tableData.buyInMin || '';
        buyInMaxInput.value = tableData.buyInMax || '';
    });
    settingsModalEl.classList.remove('hidden');
}

function closeSettingsModal() {
    settingsModalEl.classList.add('hidden');
}