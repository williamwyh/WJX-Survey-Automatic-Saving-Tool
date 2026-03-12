/*console.log(
  "%c【问卷星助手】已加载（手动搜索→自动进成绩&数据）",
  "color:red;font-size:16px;font-weight:bold;"
);

(async () => {
  const $ = (s, doc = document) => doc.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ===== 你已有的 selector（不改）=====
  const FIRST_SELECTOR =
    "#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary > tbody > tr:nth-child(1) > td:nth-child(5)";
  const NEXT_SELECTOR =
    "#viewDetail > div.section-horizontal.section-horizontal-3.text-center > div > a:nth-child(2)";
  const DOWNLOAD_SELECTOR = "#KsDownload";

  // ===== iframe 查找（不改思路）=====
  function findDoc(selector) {
    if (document.querySelector(selector)) return { doc: document, win: window };
    for (const f of document.querySelectorAll("iframe")) {
      try {
        if (f.contentDocument?.querySelector(selector))
          return { doc: f.contentDocument, win: f.contentWindow };
      } catch {}
    }
    return null;
  }

  // ===== 成绩&数据页：下载当前 + 点下一份；下一份点不了就停 =====
  function nextUnavailable(doc) {
    const el = $(NEXT_SELECTOR, doc);
    if (!el) return true;
    const cls = el.className || "";
    return (
      el.disabled ||
      el.getAttribute("disabled") != null ||
      el.getAttribute("aria-disabled") === "true" ||
      cls.includes("disabled") ||
      cls.includes("is-disabled") ||
      cls.includes("wjxui-btn-disabled")
    );
  }

  function clickDownload(doc) {
    const btn = $(DOWNLOAD_SELECTOR, doc);
    if (!btn) return false;
    try {
      btn.scrollIntoView({ block: "center" });
      btn.click();
      return true;
    } catch {
      return false;
    }
  }

  function clickNext(doc) {
    const el = $(NEXT_SELECTOR, doc);
    if (!el) return false;
    try {
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    } catch {
      return false;
    }
  }

  // ====== ✅ 按你的要求：去掉“把 PB-17 塞进搜索框”这一步 ======
  // 现在只做：识别当前列表页已筛选出的结果 → 直接进入第一条“成绩&数据”
  const runEnter = async (e) => {
    if (!location.href.includes("myquestionnaires.aspx"))
      return alert("请在问卷列表页运行（先手动搜索/筛选好）");

    const btn = e.target;
    btn.disabled = true;
    btn.innerText = "执行中...";

    try {
      // 可选：你之前习惯先点到最后页，保留（不依赖 PB-17）
      $("#ctl02_ContentPlaceHolder1_ViewStatSummary1_btnLast")?.click();
      await sleep(1000);

      // 直接找第一条“成绩&数据”
      const link =
        $('#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary a[title="成绩&数据"]') ||
        $('a[title="成绩&数据"]');

      if (!link) return alert("当前列表里没找到“成绩&数据”，请确认已手动搜索出目标问卷");

      location.href = link.href;
    } finally {
      btn.disabled = false;
      btn.innerText = "进入当前结果的成绩&数据";
    }
  };

  // ====== 自动下载+翻页（保持你之前正确逻辑）=====
  const runNext = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    const old = btn.innerText;
    btn.innerText = "执行中...";

    try {
      const whereFirst = findDoc(FIRST_SELECTOR);
      if (!whereFirst) return alert("找不到第一份");
      let first = $(FIRST_SELECTOR, whereFirst.doc);
      first = first?.querySelector("a") || first;
      if (!first) return alert("第一份元素不存在");
      first.click();
      await sleep(1200);

      let where = findDoc(NEXT_SELECTOR) || findDoc(DOWNLOAD_SELECTOR);
      if (!where) {
        await sleep(1200);
        where = findDoc(NEXT_SELECTOR) || findDoc(DOWNLOAD_SELECTOR);
      }
      if (!where) return alert("找不到翻页/下载区域");

      let count = 0;
      const MAX = 20000;

      while (count < MAX) {
        clickDownload(where.doc);
        await sleep(1000);

        if (nextUnavailable(where.doc)) {
          alert(`检测到“下一份”不可用，已停止。已处理 ${count + 1} 份`);
          break;
        }

        const ok = clickNext(where.doc);
        if (!ok) {
          alert(`点击“下一份”失败，已停止。已处理 ${count + 1} 份`);
          break;
        }

        count++;
        btn.innerText = `已处理 ${count} 份`;
        await sleep(700);
      }

      if (count >= MAX) alert(`达到安全上限 ${MAX}，已停止`);
    } catch (err) {
      console.error("【问卷星助手】runNext error:", err);
      alert("执行出错，打开控制台看日志");
    } finally {
      btn.disabled = false;
      btn.innerText = old;
    }
  };

  // ====== 注入按钮 ======
  const makeBtn = (text, right, bg, fn) => {
    const b = document.createElement("button");
    b.innerText = text;
    Object.assign(b.style, {
      position: "fixed",
      bottom: "20px",
      right,
      zIndex: 10000,
      padding: "10px 15px",
      background: bg,
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "bold",
    });
    b.onclick = fn;
    document.body.appendChild(b);
  };

  makeBtn("进入当前结果的成绩&数据", "20px", "#ff4d4f", runEnter);
  makeBtn("第一份 → 下载 → 下一份", "260px", "#1677ff", runNext);
})();*/

//WebForms 回传

/*console.log("【问卷星助手】已加载（点击按钮才执行）");

(() => {
  // 列表页：点按钮 → 进成绩&数据
  if (location.href.includes("myquestionnaires.aspx")) {
    const btn = document.createElement("button");
    btn.innerText = "开始运行";
    btn.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:9999;";
    btn.onclick = () => {
      sessionStorage.setItem("wjx_need_last", "1");
      const link = document.querySelector('a[title="成绩&数据"]');
      if (!link) return alert("没找到“成绩&数据”");
      location.href = link.href;
    };
    document.body.appendChild(btn);
    return;
  }

  // 成绩&数据页：WebForms 跳最后一页（简化版）
  if (sessionStorage.getItem("wjx_need_last")) {
    sessionStorage.removeItem("wjx_need_last");

    const jumpLast = () => {
      const f = document.forms[0];
      if (!f) return false;
      const t = f.__EVENTTARGET;
      const a = f.__EVENTARGUMENT;
      if (!t || !a) return false;
      t.value = "ctl02$ContentPlaceHolder1$ViewStatSummary1$btnLast";
      a.value = "";
      (f.requestSubmit ? f.requestSubmit() : f.submit());
      return true;
    };

    const timer = setInterval(() => {
      if (jumpLast()) clearInterval(timer);
    }, 300);
  }
})();*/

/*console.log("【问卷星助手】已加载（点击按钮才执行）");

(async () => {
  // ===== 列表页：点按钮 → 进成绩&数据 =====
  if (location.href.includes("myquestionnaires.aspx")) {
    const btn = document.createElement("button");
    btn.innerText = "开始运行";
    btn.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;";
    btn.onclick = () => {
      sessionStorage.setItem("wjx_need_last", "1");
      const link = document.querySelector('a[title="成绩&数据"]');
      if (!link) return alert("没找到“成绩&数据”");
      location.href = link.href;
    };
    document.body.appendChild(btn);
    return;
  }

  // ===== 成绩&数据页：阶段1：WebForms 回传跳到最后一页（会刷新页面）=====
  if (sessionStorage.getItem("wjx_need_last")) {
    sessionStorage.removeItem("wjx_need_last");
    sessionStorage.setItem("wjx_need_detail", "1"); // 刷新后继续点详情
    const f = document.forms[0];
    if (!f || !f.__EVENTTARGET || !f.__EVENTARGUMENT) return;
    f.__EVENTTARGET.value = "ctl02$ContentPlaceHolder1$ViewStatSummary1$btnLast";
    f.__EVENTARGUMENT.value = "";
    (f.requestSubmit ? f.requestSubmit() : f.submit());
    return;
  }

  // ===== 成绩&数据页：阶段2：到最后一页后，点第2行“查看详情”=====
  if (sessionStorage.getItem("wjx_need_detail")) {
    sessionStorage.removeItem("wjx_need_detail");
    const DETAIL_SELECTOR = "#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary > tbody > tr:nth-child(2) a.see";
    setTimeout(() => {
      let el = document.querySelector(DETAIL_SELECTOR);
      el = el?.querySelector("a") || el;
      if (el) {
        el.removeAttribute("href");
        el.click();
      }
    }, 600);
  }
  
  try {
  const el = document.querySelector("#hrefSavecatReport");
  el.removeAttribute("href");
  el.click();
} catch (e) {
  // 什么都不做，程序继续跑
}
})();*/

//const el = document.querySelector("#hrefSavecatReport"); el.removeAttribute("href"); el.click();

//为什么我一打开这个页面在console中输入document.querySelector("#hrefSavecatReport")为null,但是在打开了这个按键的检查element之后，再此操作就会返回正确值了呢