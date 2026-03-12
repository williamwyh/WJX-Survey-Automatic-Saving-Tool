// 运行在 Main World，拥有完全的 DOM 访问权限，不受 CSP 限制
// 支持两种场景：
//   场景A: 被注射进弹窗 iframe 自身（content.js 新逻辑）→ 用 window.frames[0] 找子 iframe
//   场景B: 被注射进主页面（旧逻辑兜底）→ 用 top.frames[1].frames[0] 穿透
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

  // 在指定 doc 里找按钮并点击，返回是否成功
  const findAndClick = (doc, label) => {
    try {
      const el = doc?.querySelector("#hrefSavecatReport");
      if (el) {
        const ok = tryClick(el);
        console.log(`Helper: [${label}] 找到按钮，已点击:`, ok);
        return true;
      }
    } catch (e) {
      console.warn(`Helper: [${label}] 访问 document 出错:`, e);
    }
    return false;
  };

  setTimeout(() => {
    // ① 当前 document 直接找（按钮就在弹窗 iframe 的顶层 document 里）
    if (findAndClick(document, "当前document")) return;

    // ② 当前 window 的子 frames（按钮在弹窗 iframe 内嵌的子 iframe 里）
    //    这是最关键的路径：inject.js 在 layui-layerN 里运行时，
    //    window.frames[0] 就是它自己内部的子 iframe，
    //    不会因为多个弹窗并存而索引错位
    for (let i = 0; i < window.frames.length; i++) {
      if (findAndClick(window.frames[i]?.document, `子frame[${i}]`)) return;
    }

    // ③ 最终兜底：从 top 往下穿透（inject.js 在主页面时走这里）
    //    注意：多个弹窗并存时 top.frames 的索引可能不稳定
    console.warn("Helper: ①②未找到，尝试 top.frames 兜底...");
    try {
      for (let j = 0; j < top.frames.length; j++) {
        try {
          for (let k = 0; k < top.frames[j].frames.length; k++) {
            if (findAndClick(top.frames[j].frames[k]?.document, `top.frames[${j}].frames[${k}]`)) return;
          }
        } catch (e) { /* 跨域或不可访问，跳过 */ }
      }
      console.warn("Helper: 所有路径均未找到 #hrefSavecatReport");
    } catch (e) {
      console.error("Helper: 下载点击失败:", e);
    }
  }, 1000); // 给弹窗页面 1 秒时间完全渲染
})();
