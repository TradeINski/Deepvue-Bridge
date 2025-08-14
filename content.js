// Initialize when the page loads
window.onload = function() {
  setupClipboardListener();
  addCopyButtons();
  overrideExistingCopyButtons();
};

// log a message to the console  
console.log("Deepvue content script loaded");

// Set up a mutation observer to handle dynamic content
const observer = new MutationObserver(function(mutations) {
  const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
  if (!hasAddedNodes) return;
  
  // Check for new ticker elements and add copy buttons
  addCopyButtons();
  overrideExistingCopyButtons();
});

observer.observe(document.body, { childList: true, subtree: true });

// Function to override existing copy buttons
function overrideExistingCopyButtons() {
  // Target the specific button class from your screenshot
  const copyButtons = document.querySelectorAll('button[class*="ScreenButtonGroup_ButtonControlElementCopy"], [role="button"][class*="ScreenButtonGroup_iconWrapper"]');
  
  copyButtons.forEach(button => {
    // Skip if we already modified this button
    if (button.dataset.deepvueModified) return;
    
    // Mark as modified to avoid duplicate event listeners
    button.dataset.deepvueModified = 'true';
    
    // Add click event listener
    button.addEventListener('click', function(e) {
      // Let the original click event happen to get the text into clipboard
      setTimeout(() => {
        // Read from clipboard
        navigator.clipboard.readText().then(text => {
          // Check if the text looks like tickers - MODIFIED to be more flexible
          if (text && text.trim()) {
            // Format the tickers - handle potential different formats
            const formattedText = formatTickers(text);
            
            // Write back to clipboard
            navigator.clipboard.writeText(formattedText).then(() => {
              console.log('Formatted tickers copied to clipboard');
              
              // Save to storage
              chrome.storage.local.set({ lastCopiedTickers: formattedText.split(',').filter(t => t.trim()) });
            });
          }
        }).catch(err => {
          console.error('Failed to read clipboard contents: ', err);
        });
      }, 300); // Increased delay to ensure original copy happens first
    });
  });
}

// Function to add copy buttons to ticker elements
function addCopyButtons() {
  // Find ticker elements - this selector needs to be adjusted based on Deepvue's actual DOM structure
  const tickerElements = document.querySelectorAll('.ticker-element'); // Replace with actual selector
  
  tickerElements.forEach(element => {
    // Skip if we already added a button
    if (element.querySelector('.deepvue-copy-btn')) return;
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'deepvue-copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.style.marginLeft = '5px';
    copyBtn.style.cursor = 'pointer';
    copyBtn.title = 'Copy with commas';
    
    copyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const tickerText = element.textContent.trim();
      const formattedText = formatTickers(tickerText);
      copyToClipboard(formattedText);
      
      // Visual feedback
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.textContent = '📋';
      }, 1500);
    });
    
    element.appendChild(copyBtn);
  });
}

// Function to set up clipboard event listener
function setupClipboardListener() {
  // Listen for copy events
  document.addEventListener('copy', function(e) {
    // Get selected text
    const selection = window.getSelection().toString().trim();
    
    // Check if the selection looks like tickers (space-separated text)
    if (selection && /^[A-Z0-9\s]+$/.test(selection)) {
      // Format the tickers
      const formattedTickers = formatTickers(selection);
      
      // Replace the clipboard content
      e.clipboardData.setData('text/plain', formattedTickers);
      e.preventDefault();
      
      // Save to storage
      chrome.storage.local.set({ lastCopiedTickers: formattedTickers.split(', ').filter(t => t) });
    }
  });
}

// Function to format tickers by adding commas
function formatTickers(text) {
  // First, try to clean up the text by removing any non-alphanumeric characters except spaces
  const cleanedText = text.replace(/[^A-Z0-9\s]/gi, ' ');
  
  // Split by whitespace and filter out empty strings
  const tickers = cleanedText.split(/\s+/).filter(ticker => ticker.trim());
  
  // Join with comma (no space)
  return tickers.join(',');
}

// Function to copy text to clipboard
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  
  // Save to storage
  chrome.storage.local.set({ lastCopiedTickers: text.split(', ').filter(t => t) });
}

// Add a global copy button to the page
function addGlobalCopyButton() {
  // Find a good location to add the button - adjust selector based on Deepvue's structure
  const container = document.querySelector('.ticker-container'); // Replace with actual selector
  
  if (container && !document.getElementById('deepvue-global-copy')) {
    const button = document.createElement('button');
    button.id = 'deepvue-global-copy';
    button.className = 'deepvue-global-copy-btn';
    button.textContent = 'Copy All Tickers';
    button.style.margin = '10px';
    button.style.padding = '5px 10px';
    button.style.cursor = 'pointer';
    
    button.addEventListener('click', function() {
      // Find all ticker elements and extract their text
      const tickerElements = document.querySelectorAll('.ticker-element'); // Replace with actual selector
      const tickers = Array.from(tickerElements).map(el => el.textContent.trim());
      
      // Format and copy
      const formattedText = formatTickers(tickers.join(' '));
      copyToClipboard(formattedText);
      
      // Visual feedback
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = 'Copy All Tickers';
      }, 1500);
    });
    
    container.appendChild(button);
  }
}

// Call this function periodically to ensure the button is added
setInterval(addGlobalCopyButton, 1000); // <-- Interval changed to 1 sec

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "clickAutoCopyWidget") {
    try {
      const copyButton = document.querySelector('div[title="Copy widget"]');
      if (copyButton) {
        copyButton.click();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    } catch (err) {
      console.error("Auto-copy widget failed:", err);
      sendResponse({ success: false });
    }
    return true;
  }
});
