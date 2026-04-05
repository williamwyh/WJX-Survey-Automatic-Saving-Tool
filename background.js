chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    world: "MAIN",
    func: () => {
      const el = document.querySelector("#hrefSavecatReport");
      if (el) {
        try {
          const href = el.getAttribute && (el.getAttribute("href") || "");
          if (href && href.trim().toLowerCase().startsWith("javascript:")) el.removeAttribute("href");
        } catch (e) { /* ignore */ }
        el.click();
      }
      // 兜底：直接执行 inline onclick（有些站更吃这个）
      el?.onclick?.call(el);
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SLEEP") {
    // Service Worker 的 setTimeout 不受前台标签页的后台休眠降速影响
    setTimeout(() => {
      sendResponse({ done: true });
    }, request.ms);
    return true; // 保持通信通道异步返回
  }
});