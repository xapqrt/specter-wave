chrome.runtime.onInstalled.addListener(() => {
    console.log('spectervise installed');
});

chrome.commands.onCommand.addListener((cmd) => {
    if (cmd!=='run-spectervise') return;
    chrome.tabs.query({active: true, currentWindow:true }, (tabs) => {
        if (!tabs || tabs.length) return;
        const t = tabs[0];
        if (!t || !t.id) return;
        chrome.tab.sendMessage(t.id, { type: 'SPECTERVISE_TOGGLE'}, () => {
            const err = chrome.runtime.lastError;
            if (err) {
                console.log('sendMeassage err',err.message);
            }
        });
    });
});