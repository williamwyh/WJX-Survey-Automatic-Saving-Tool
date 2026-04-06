// 运行在 Main World，拥有完全的 DOM 访问权限，不受 CSP 限制
(() => {
  const tryClick = (el) => {
    if (!el) return false;
    try {
      const href = el.getAttribute && (el.getAttribute("href") || "");
      if (href && href.trim().toLowerCase().startsWith("javascript:")) el.removeAttribute("href");
    } catch (e) { /* ignore */ }
    el.click();
    return true;
  };

  const findAndClick = (doc) => {
    try {
      const el = doc?.querySelector("#hrefSavecatReport");
      if (el) {
        const ok = tryClick(el);
        console.log(`✅ Helper: 找到按钮，已点击，开始下载:`, ok);
        return true;
      }
    } catch (e) {
      console.warn(`⚠️ Helper: 访问出错，没有下载:`, e);
    }
    return false;
  };

  setTimeout(() => {
    // ① 直接找（注入点如果精准命中，这步直接秒杀）
    if (findAndClick(document)) return;

    // ② 往下探一层框（如果是挂载在主页面，透过主页面的子 iframe 寻找）
    for (let i = 0; i < window.frames.length; i++) {
      if (findAndClick(window.frames[i]?.document)) return;
    }

    console.warn("⚠️ Helper: 下载失败，未找到 #hrefSavecatReport");
  }, 500);
})();
