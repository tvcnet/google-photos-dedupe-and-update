/**
 * dashboard.js
 * Handles the logic for the Photo Info Update card in the Extension Hub.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('gemini-api-key');
    const saveBtn = document.getElementById('save-settings');
    const statusMsg = document.getElementById('status-msg');

    // Load existing settings
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['apiSettings'], (result) => {
            if (result.apiSettings && result.apiSettings.geminiApiKey) {
                apiKeyInput.value = result.apiSettings.geminiApiKey;
                renderState(true);
            }
        });
    }

    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Please enter a valid API key.', 'error');
            return;
        }

        const settings = {
            geminiApiKey: apiKey,
            lastUpdated: new Date().toISOString()
        };

        // We save to chrome.storage.local so the content script can access it cross-origin
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ apiSettings: settings }, () => {
                showStatus('Features unlocked!', 'success');
                createSparkle(saveBtn);
                
                // Transition to features view
                setTimeout(() => renderState(true), 1500);
            });
        } else {
            // Fallback for non-extension environment debugging
            showStatus('Storage API not found. Save simulated.', 'success');
            setTimeout(() => renderState(true), 1500);
        }
    });

    document.getElementById('feature-ai-describe')?.addEventListener('click', () => {
        window.open('https://photos.google.com', '_blank');
    });

    document.getElementById('clear-key')?.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['apiSettings'], () => {
                apiKeyInput.value = '';
                renderState(false);
                showStatus('Settings reset.', 'success');
            });
        } else {
            apiKeyInput.value = '';
            renderState(false);
        }
    });

    function renderState(isActive) {
        const setupView = document.getElementById('setup-view');
        const featuresView = document.getElementById('features-view');
        
        if (isActive) {
            setupView.style.opacity = '0';
            setupView.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                setupView.style.display = 'none';
                featuresView.style.display = 'block';
                setTimeout(() => {
                    featuresView.style.opacity = '1';
                    featuresView.style.transform = 'translateY(0)';
                }, 50);
            }, 400);
        } else {
            featuresView.style.opacity = '0';
            featuresView.style.transform = 'translateY(10px)';
            setTimeout(() => {
                featuresView.style.display = 'none';
                setupView.style.display = 'block';
                setTimeout(() => {
                    setupView.style.opacity = '1';
                    setupView.style.transform = 'translateY(0)';
                }, 50);
            }, 400);
        }
    }

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = `status-msg status-${type}`;
        statusMsg.style.opacity = '1';
        
        setTimeout(() => {
            statusMsg.style.opacity = '0';
        }, 3000);
    }

    function createSparkle(el) {
        const rect = el.getBoundingClientRect();
        for (let i = 0; i < 5; i++) {
            const sparkle = document.createElement('div');
            sparkle.innerHTML = '✨';
            sparkle.style.position = 'fixed';
            sparkle.style.left = `${rect.left + Math.random() * rect.width}px`;
            sparkle.style.top = `${rect.top + Math.random() * rect.height}px`;
            sparkle.style.pointerEvents = 'none';
            sparkle.style.zIndex = '10000';
            sparkle.style.fontSize = '20px';
            sparkle.style.transition = 'all 0.8s ease-out';
            
            document.body.appendChild(sparkle);
            
            setTimeout(() => {
                sparkle.style.transform = `translate(${(Math.random() - 0.5) * 100}px, -100px) scale(0.5)`;
                sparkle.style.opacity = '0';
                setTimeout(() => sparkle.remove(), 800);
            }, 10);
        }
    }
});
