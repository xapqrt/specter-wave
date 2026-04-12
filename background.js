const STATE = {
    awakeAt: Date.now(),
    pings: 0,
    lastTab: null,
    lastError: '',
    queue : []
};

   function log() {
    const args = Array.from(arguments);
    args.unshift('[spectervise/bg]');
    console.log.apply(console, args);
}

function rememberErr(msg) {
    STATE.lastError = String(msg || '');
}

function getActiveTab(cd) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
            rememberErr(chrome.runtime.lastError.message);
            cd(null);
            return;
        }

        if (!tabs || !tabs.length === 0) {
            cd(null);
            return;
        }

        cd(tabs[0]);
    });
}

function sendToTab(tabId, msg, cd) {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
            rememberErr(err.message);
            cb && cb(null, err.message);
            return;
        }

        cb && cb(res, null);
    });
}

function enqueueForRetry(tabId, msg) {
    STATE.queue.push({ tabId, msg, at: Date.now() });
    if (STATE.queue.length > 20) STATE.queue.shift();
}

function flushQueue() {
    if (STATE.queue.length === 0) return;
    const next = STATE.queue.shift();
    if (!next) return;
    sendToTab(next.tabId, next.msg, (res, err) => {
        if (err) {
            log('retry failed', err);
        }else {
            log('retry ok', res? 'ok': 'empty');
        }
    });
}

function triggerSpecterOnActiveTab(reason) {
    getActiveTab((tab) => {
        if (!tab || !tab.id) {
      log('no active tab');
      return;
    }

 STATE.lastTab = tab.id;
   const payload = {
        type: 'SPECTER_TOGGLE',
        reason: reason || 'manual'
        t: Date.now()
    };

    sendToTab(tab.id, payload, (res, err) => {
        if (err) {
            log('toggle failed, queuing', err);
            enqueueForRetry(tab.id, payload);
        } else {
            log('toggle ok', res && res.ok ? 'ok' : 'no-response');
        }
    });
    });
}

function scanNowOnActiveTab(reason) {
    getActiveTab((tab) => {
        if (!tab || !tab.id) return;

    const payload = {
        type: 'SPECTER_SCAN_NOW',
        reason: reason || 'scan-now',
        t: Date.now()
    };

    sendToTab(tab.id, payload, (res, err) => {
        if (err) {
            rememberErr(err);
        }else {
            log('scan-now resp', res && res.ok ? 'ok' : 'none');
        }
    });
    });
}

chrome.runtime.onMessage.addListener((d) => {
 log('installed',d && d.reason);
});

chrome.runtime.onInstalled.addListener(() => {
    log('startup');
});

chrome.commands.onCommand.addListener((cmd) => {
    if (cmd === 'run-specter') {
        triggerSpecterOnActiveTab('command');
    }
});

chrome.action.onClicked.addListener(() => {
    triggerSpecterOnActiveTab('action-click');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'SPECTERVISE_PING') {
    STATE.pings += 1;
    sendResponse({ ok: true, pings: STATE.pings, awakeAt: STATE.awakeAt });
    return true;
  }

  if (msg.type === 'SPECTERVISE_SCAN_ACTIVE') {
    scanNowOnActiveTab('runtime-scan');
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'SPECTERVISE_DEBUG_STATE') {
    sendResponse({ ok: true, state: STATE });
    return true;
  }
});

setInterval(() => {
  flushQueue();
}, 3500);

















