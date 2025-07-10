document.addEventListener('DOMContentLoaded', () => {
  const copiedTickersList = document.getElementById('copiedTickersList');
  const groupTickersToggle = document.getElementById('groupTickersToggle');
  const reloadButton = document.getElementById('reloadButton');
  const tickerHeader = document.getElementById('tickerHeader');
  const menuToggle = document.getElementById('menuToggle');
  const settingsMenu = document.getElementById('settingsMenu');
  const _browser = typeof browser !== 'undefined' ? browser : chrome;
  const TICKERS_PER_GROUP = 30;

  async function initializePopup() {
    const [lastCopiedTickers, groupTickers] = await Promise.all([
      getStorageValue('lastCopiedTickers', []),
      getStorageValue('groupTickers', false)
    ]);

    groupTickersToggle.checked = groupTickers;
    displayTickers(lastCopiedTickers, groupTickers);
    updateTickerCount(lastCopiedTickers.length);
    settingsMenu.classList.add('hidden');
  }

  async function getStorageValue(key, defaultValue) {
    try {
      const result = await _browser.storage.local.get(key);
      return result[key] === undefined ? defaultValue : result[key];
    } catch (error) {
      console.error(`Error getting ${key} from storage:`, error);
      return defaultValue;
    }
  }

  function updateTickerCount(count) {
    if (tickerHeader) {
      tickerHeader.textContent = `Last Copied Tickers: ${count}`;
    }
  }

  menuToggle.addEventListener('click', () => {
    settingsMenu.classList.toggle('hidden');
  });

  groupTickersToggle.addEventListener('change', async (event) => {
    const groupTickers = event.target.checked;
    try {
      await _browser.storage.local.set({ groupTickers });
      const lastCopiedTickers = await getStorageValue('lastCopiedTickers', []);
      displayTickers(lastCopiedTickers, groupTickers);
    } catch (error) {
      console.error(`Failed to save settings: ${error.message}`);
    }
  });

  _browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lastCopiedTickers) {
      getStorageValue('groupTickers', false).then(groupTickers => {
        displayTickers(changes.lastCopiedTickers.newValue, groupTickers);
        updateTickerCount(changes.lastCopiedTickers.newValue.length);
      });
    }
  });

  function displayTickers(tickers, groupTickers) {
    if (!tickers || tickers.length === 0) {
      copiedTickersList.innerHTML = `
        <div class="ticker-group">
          <div class="ticker-group-list" style="text-align: center;">
            No tickers copied yet
          </div>
        </div>
      `;
      updateTickerCount(0);
      return;
    }

    copiedTickersList.innerHTML = '';
    updateTickerCount(tickers.length);

    if (groupTickers) {
      for (let i = 0; i < tickers.length; i += TICKERS_PER_GROUP) {
        const group = tickers.slice(i, i + TICKERS_PER_GROUP);
        const groupIndex = Math.floor(i / TICKERS_PER_GROUP) + 1;

        const groupHTML = `
          <div class="ticker-group">
            <div class="ticker-group-header">
              Group ${groupIndex} (${group.length} tickers)
            </div>
            <div class="ticker-group-list">
              ${group.join(', ')}
            </div>
            <button class="copy-group-button">
              Copy Group
            </button>
          </div>
        `;
        copiedTickersList.insertAdjacentHTML('beforeend', groupHTML);
      }
    } else {
      const allTickersHTML = `
        <div class="ticker-group">
          <div class="ticker-group-list">
            ${tickers.join(', ')}
          </div>
          <button class="copy-group-button">
            Copy All
          </button>
        </div>
      `;
      copiedTickersList.innerHTML = allTickersHTML;
    }

    document.querySelectorAll('.copy-group-button').forEach(button => {
      button.addEventListener('click', function () {
        try {
          const tickers = this.previousElementSibling.textContent.split(', ');
          copyToClipboard(tickers.join(','));
          this.textContent = 'Copied!';
          setTimeout(() => {
            this.textContent = button.textContent.includes('All') ? 'Copy All' : 'Copy Group';
          }, 2000);
        } catch (error) {
          console.error(`Copy failed: ${error.message}`);
        }
      });
    });
  }

  function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  // 🔁 Reload and Auto-Copy (Chartink style)
  reloadButton.addEventListener('click', () => {
    reloadButton.textContent = 'Reloading...';
    reloadButton.disabled = true;

    _browser.runtime.sendMessage({ message: 'reloadAndCopy' }, (response) => {
      if (response && response.initiated) {
        setTimeout(() => {
          reloadButton.textContent = 'Copied! ✅';
          setTimeout(() => {
            reloadButton.textContent = 'Reload';
            reloadButton.disabled = false;
          }, 2000);
        }, 3000);
      } else {
        console.error('Reload failed:', response?.error || 'Unknown error');
        reloadButton.textContent = 'Failed!';
        setTimeout(() => {
          reloadButton.textContent = 'Reload';
          reloadButton.disabled = false;
        }, 2000);
      }
    });
  });

  initializePopup();
});
