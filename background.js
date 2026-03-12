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