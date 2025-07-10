const _browser = typeof browser !== 'undefined' ? browser : chrome;
let popupWindowId = null;

// Create the popup window
function createPopupWindow() {
  _browser.windows.create({
    url: _browser.runtime.getURL("popup.html"),
    type: "popup",
    width: 320,
    height: 500,
    focused: true,
    left: 100,
    top: 100
  }, (windowInfo) => {
    popupWindowId = windowInfo.id;

    _browser.windows.onRemoved.addListener((removedWindowId) => {
      if (removedWindowId === popupWindowId) {
        popupWindowId = null;
      }
    });
  });
}

// On extension icon click
_browser.action.onClicked.addListener((tab) => {
  if (popupWindowId !== null) {
    _browser.windows.get(popupWindowId, {}, (windowInfo) => {
      if (_browser.runtime.lastError) {
        createPopupWindow();
      } else {
        _browser.windows.update(popupWindowId, { focused: true });
      }
    });
  } else {
    createPopupWindow();
  }
});

// Storage getter
async function getStorageValue(key, defaultValue) {
  try {
    const result = await _browser.storage.local.get(key);
    return result[key] === undefined ? defaultValue : result[key];
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error);
    return defaultValue;
  }
}

// On install
_browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await _browser.storage.local.set({
      lastCopiedTickers: [],
      groupTickers: false
    });
  }
});

// Handle messages
_browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let isAsync = false;

  switch (request.message) {
    case "getLastCopiedTickers":
      getStorageValue("lastCopiedTickers", []).then(tickers => {
        sendResponse({ tickers });
      });
      isAsync = true;
      break;

    case "reloadAndCopy":
      _browser.tabs.query({ active: true, url: "https://app.deepvue.com/*" }, (tabs) => {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          _browser.storage.local.set({ pendingCopyAfterReload: tabId });
          _browser.tabs.reload(tabId);
          sendResponse({ initiated: true });
        } else {
          sendResponse({ initiated: false, error: "No active Deepvue tab found." });
        }
      });
      isAsync = true;
      break;

    default:
      console.warn("Unknown message:", request.message);
  }

  return isAsync;
});

// On tab updated (for post-reload auto-copy)
_browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes("https://app.deepvue.com/")) {
    const pendingCopy = await getStorageValue("pendingCopyAfterReload", null);
    if (pendingCopy === tabId) {
      _browser.storage.local.remove("pendingCopyAfterReload");

      setTimeout(() => {
        _browser.tabs.sendMessage(tabId, { message: "clickAutoCopyWidget" }, (response) => {
          console.log("Auto-copy after reload result:", response?.success || "No response");
        });
      }, 1500);
    }
  }
});