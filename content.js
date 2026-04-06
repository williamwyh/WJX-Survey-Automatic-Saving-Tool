// 截止导出版本final
console.log(
  "%c【问卷星助手】已加载",
  "color:red;font-size:16px;font-weight:bold;"
);

(async () => {
  const TAG = "【问卷星助手】";
  const log = (...a) => console.log(TAG, ...a);

  if (location.hash === "#static") {
    log("🛑 检测到 #static 标记，脚本已暂停（静态模式，仅供检查）");
    return;
  }

  // ==========================================
  // 1. 核心工具类 (Utils)
  // ==========================================
  const Utils = {
    normalizeString(s) { // 规范化字符串（统一小写，忽略大小写差异）
      return (s ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    },
    setNativeValue(el, value) { // 强制设置输入框的值
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc?.set) desc.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  // 背景定时器加速 (委托给 background.js 处理)
  let fastTimerIdCounter = 0;
  const activeTimers = new Set();
  const fastSetTimeout = (cb, ms) => {
    const id = ++fastTimerIdCounter;
    activeTimers.add(id);
    try {
      chrome.runtime.sendMessage({ type: "SLEEP", ms: ms }, (response) => {
        if (chrome.runtime.lastError) {
          window.setTimeout(() => { if (activeTimers.has(id)) { activeTimers.delete(id); cb(); } }, ms);
          return;
        }
        if (activeTimers.has(id)) { activeTimers.delete(id); cb(); }
      });
    } catch (e) {
      window.setTimeout(() => { if (activeTimers.has(id)) { activeTimers.delete(id); cb(); } }, ms);
    }
    return id;
  };
  const fastClearTimeout = (id) => activeTimers.delete(id);
  const setTimeout = fastSetTimeout;
  const clearTimeout = fastClearTimeout;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ==========================================
  // 2. 状态管理 (Store)
  // 集中管理 localStorage 与 sessionStorage
  // ==========================================
  const KEYS = {
    RUN_TOKEN: "wjx_run_token", // 【持久化】总开关，只要它为 1，哪怕重启浏览器也会继续跑
    USER_TASKS: "wjx_user_defined_tasks", // 【持久化】用户初始输入的全部任务名单
    TASK: "wjx_tasks", // 【暂存】当前正在跑的任务数组（解析后的列表）
    INDEX: "wjx_task_index", // 【暂存】当前进度跑到数组的第几个了
    CUR: "wjx_current_task", // 【暂存】当前正在死磕的任务名字（防止网页刷新丢失目标）
    LIST_URL: "wjx_list_url", // 【暂存】干完活后需要回退回去的列表真网址
    AUTO: "wjx_auto_run_all",
    FAILED: "wjx_failed", // 【暂存】装满没找到或失败的任务黑名单
    SUCCESS: "wjx_success", // 【暂存】装满成功下载的任务列表
    LAST_SEARCHED: "wjx_last_searched",
    HAS_DOWNLOADED: "wjx_has_downloaded", // 【暂存】标记这一单到底有没有下过东西
    // 页面跳转状态机（在详情页疯狂刷新时用来当作“接力棒”）
    NEED_100: "wjx_need_100", // 挂档 1：是否需要改 100 条
    NEED_LAST_PAGE: "wjx_need_last_page", // 挂档 2：是否需要翻到最后一页
    NEED_DOWNLOAD: "wjx_need_download" // 挂档 3：前面搞定了，正式进入表单爬取和下载
  };

  const Store = {
    get hasRunToken() { return localStorage.getItem(KEYS.RUN_TOKEN) === "1"; },
    setRunToken() { localStorage.setItem(KEYS.RUN_TOKEN, "1"); },
    clearRunToken() { localStorage.removeItem(KEYS.RUN_TOKEN); },

    get isAutoRun() { return sessionStorage.getItem(KEYS.AUTO) === "1"; },
    startAutoRun() { sessionStorage.setItem(KEYS.AUTO, "1"); },

    initTasksFromInput(rawText) { // 初始化任务列表
      const tasks = rawText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      sessionStorage.setItem(KEYS.TASK, JSON.stringify(tasks));
      sessionStorage.setItem(KEYS.INDEX, "0");
      sessionStorage.removeItem(KEYS.CUR);
      sessionStorage.removeItem(KEYS.FAILED);
      sessionStorage.removeItem(KEYS.LAST_SEARCHED);
      sessionStorage.removeItem(KEYS.HAS_DOWNLOADED);
      return tasks;
    },

    getTasks() { // 获取任务列表
      try { return JSON.parse(sessionStorage.getItem(KEYS.TASK) || "[]"); }
      catch { return []; }
    },
    getIndex() { // 获取当前任务索引
      const n = parseInt(sessionStorage.getItem(KEYS.INDEX) || "0", 10);
      return Number.isFinite(n) ? n : 0;
    },
    setIndex(i) { sessionStorage.setItem(KEYS.INDEX, String(i)); }, // 设置当前任务索引

    getCurrentTarget() { // 获取当前任务
      const cur = sessionStorage.getItem(KEYS.CUR);
      if (cur) return cur;
      const tasks = this.getTasks();
      const t = tasks[this.getIndex()] || "";
      if (t) sessionStorage.setItem(KEYS.CUR, t);
      return t;
    },

    advanceToNextTask() { // 进入下一个任务
      const tasks = this.getTasks();
      const nextIdx = this.getIndex() + 1;
      sessionStorage.removeItem(KEYS.CUR);
      sessionStorage.removeItem(KEYS.HAS_DOWNLOADED);
      this.setIndex(nextIdx);
      return tasks[nextIdx] || null;
    },

    recordFail(t) { // 记录失败任务
      let arr = JSON.parse(sessionStorage.getItem(KEYS.FAILED) || "[]");
      if (!arr.includes(t)) arr.push(t);
      sessionStorage.setItem(KEYS.FAILED, JSON.stringify(arr));
    },

    recordSuccess(t) { // 记录成功任务
      let arr = JSON.parse(sessionStorage.getItem(KEYS.SUCCESS) || "[]");
      if (!arr.includes(t)) arr.push(t);
      sessionStorage.setItem(KEYS.SUCCESS, JSON.stringify(arr));
    },

    recordDownloaded() { sessionStorage.setItem(KEYS.HAS_DOWNLOADED, "1"); }, // 记录已下载
    hasDownloaded() { return sessionStorage.getItem(KEYS.HAS_DOWNLOADED) === "1"; }, // 判断是否已下载

    setListUrl(url) { sessionStorage.setItem(KEYS.LIST_URL, url); }, // 设置列表页URL
    getListUrl() { return sessionStorage.getItem(KEYS.LIST_URL); }, // 获取列表页URL

    // 页面跳转状态处理
    getStage(stageKey) { return sessionStorage.getItem(stageKey); },
    setStage(stageKey, val = "1") { sessionStorage.setItem(stageKey, val); },
    clearStage(stageKey) { sessionStorage.removeItem(stageKey); },

    stopAllAndCleanup(message) {
      const success = JSON.parse(sessionStorage.getItem(KEYS.SUCCESS) || "[]");
      const fails = JSON.parse(sessionStorage.getItem(KEYS.FAILED) || "[]");
      const total = success.length + fails.length;

      // 构建完整的结账报告
      let report = message;
      report += `\n\n📊 运行报告（共 ${total} 个任务）`;
      if (success.length) report += `\n\n✅ 成功下载 (${success.length}):\n` + success.join("\n");
      if (fails.length) report += `\n\n⚠️ 未找到 (${fails.length}):\n` + fails.join("\n");

      // 清理除了 USER_TASKS 和 RUN_TOKEN 之外的所有状态
      Object.values(KEYS).forEach(k => {
        if (k !== KEYS.USER_TASKS && k !== KEYS.RUN_TOKEN) sessionStorage.removeItem(k);
      });
      // 单独清理 Token 停止运行
      this.clearRunToken();

      log("🛑 已停止：", report);
      alert(report);
    }
  };

  // ==========================================
  // 3. 业务层 - 列表页逻辑 (List Page) 搜索并点击进入目标问卷
  // ==========================================
  const ListPage = {
    isMatch() { return /myquestionnaires/i.test(location.href); }, // 判断是否是列表页
    tryClickMatchedAction(maxTry = 10) { // 尝试点击搜索出的目标问卷并进入详情页的函数
      const TARGET = Store.getCurrentTarget();
      for (let i = 1; i <= maxTry; i++) {
        const titleSel = i === 1
          ? `#ctl01_ContentPlaceHolder1_qls > dl:nth-child(${i}) > dt > div.pull-left > a.pull-left.item-tit`
          : `#ctl01_ContentPlaceHolder1_qls > dl:nth-child(${i}) > dt > div.pull-left > a`;
        const actionSel = `#ctl01_ContentPlaceHolder1_qls > dl:nth-child(${i}) > dd > div.process-box.pull-left > dl.process-3.pull-left > dd > ul > li:nth-child(2) > a`;
        const tEl = document.querySelector(titleSel);
        const tText = Utils.normalizeString(tEl?.innerText);

        if (tText && tText === Utils.normalizeString(TARGET)) {
          const btn = document.querySelector(actionSel);
          if (!btn) {
            log(`⚠️ 匹配第 ${i} 条，但按钮没找到：`, actionSel);
            return { matched: true, clicked: false };
          }
          // 进入详情页前注入状态
          Store.setStage(KEYS.NEED_100);
          try { btn.scrollIntoView({ block: "center" }); } catch { }
          btn.click();
          log(`✅ 匹配第 ${i} 条（${TARGET}），已点击按钮`);
          return { matched: true, clicked: true };
        }
      }
      log("⚠️ 前 10 条都未匹配");
      return { matched: false };
    },

    async run() { //实际程序运行逻辑
      if (!Store.hasRunToken || !Store.isAutoRun) return;
      if (window.__wjx_multi_running) return;
      window.__wjx_multi_running = true;

      try {
        if (!Store.getListUrl()) Store.setListUrl(location.href); // 设置当前URL
        const TARGET = Store.getCurrentTarget(); // 获取当前任务问卷
        if (!TARGET) {
          Store.stopAllAndCleanup("✅ 已完成：所有 TASK 都已跑完，已自动停止。");
          return;
        }
        // 搜索问卷
        const input = document.querySelector('input[placeholder*="问卷名"], input[placeholder*="搜索"], .el-input__inner, input[type="text"]');
        if (input && sessionStorage.getItem(KEYS.LAST_SEARCHED) !== TARGET) {
          Utils.setNativeValue(input, TARGET); // 输入问卷名
          sessionStorage.setItem(KEYS.LAST_SEARCHED, TARGET); // 记录已搜索
          await sleep(120); // 等待搜索结果
          document.querySelector("#ctl01_ContentPlaceHolder1_divInfo > i")?.click(); // 点击搜索按钮
          setTimeout(() => { window.__wjx_multi_running = false; this.run(); }, 1500);
          return;
        }
        const r = this.tryClickMatchedAction(10); // 尝试点击匹配的问卷
        if (r?.matched && r?.clicked) return; // 如果匹配并点击了，就返回
        else {
          log("⚠️ 列表中未查找到该问卷或按钮点击失败，记录并跳过：", TARGET);
          Store.recordFail(TARGET);
        }
        const next = Store.advanceToNextTask(); // 进入下一个任务
        if (!next) {
          Store.stopAllAndCleanup("✅ 已完成：所有 TASK 都已跑完，已自动停止。");
          return;
        }
        setTimeout(() => { window.__wjx_multi_running = false; this.run(); }, 500);
      } finally {
        window.__wjx_multi_running = false;
      }
    }
  };

  // ==========================================
  // 4. 业务层 - 成绩明细页逻辑 (Detail Page) 搜索所有符合条件的问卷并下载
  // ==========================================
  const DetailPage = {
    isClickable(el) { // 判断元素是否可以点击的函数
      if (!el) return false;
      const target = el.tagName?.toLowerCase() === "a" ? el : (el.querySelector?.("a") || el);
      if (target.hasAttribute?.("disabled") || target.getAttribute?.("aria-disabled") === "true") return false;
      const cs = window.getComputedStyle(target);
      if (cs.pointerEvents === "none" || cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
      return true;
    },

    async setPageSize100() { // 设置每页显示100条的函数
      Store.clearStage(KEYS.NEED_100);
      Store.setStage(KEYS.NEED_LAST_PAGE);
      const pageSizeSelect = document.querySelector("#ctl02_ContentPlaceHolder1_ViewStatSummary1_ddlPageCount");
      if (pageSizeSelect) {
        pageSizeSelect.click();
        const option100 = pageSizeSelect.querySelector("option:nth-child(8)"); // 100条
        if (option100) {
          option100.selected = true;
          pageSizeSelect.dispatchEvent(new Event("change", { bubbles: true }));
          log("✅ 把每页显示问卷条数改为100");
          return true;
        }
      }
      log("⚠️ 把每页显示问卷条数改为100失败");
      return false;
    },

    async goToLastPage() { // 翻到最后一页的函数
      Store.clearStage(KEYS.NEED_LAST_PAGE);
      Store.setStage(KEYS.NEED_DOWNLOAD);
      await sleep(3000);
      try {
        log("✅ 正在翻到最后一页...");
        const f = document.forms[0];
        if (f && f.__EVENTTARGET && f.__EVENTARGUMENT) {
          f.__EVENTTARGET.value = "ctl02$ContentPlaceHolder1$ViewStatSummary1$btnLast";
          f.__EVENTARGUMENT.value = "";
          (f.requestSubmit ? f.requestSubmit() : f.submit());
          return true;
        }
      } catch (e) { log("⚠️ 翻页报错: ", e); }
      log("⚠️ 翻到最后一页失败（如果只有一页则忽略）");
      return false;
    },

    injectIframeDownload(rowNum, processRowFn) { // 注入iframe并下载的函数
      setTimeout(() => {
        let popupIframe = null;
        let layerEl = null;
        document.querySelectorAll("[id^='layui-layer']").forEach(el => {
          const iframe = el.querySelector("iframe");
          if (iframe) { popupIframe = iframe; layerEl = el; }
        });

        // inject进入iframe，下载问卷
        const doInject = (targetDocument) => {
          const s = targetDocument.createElement("script");
          s.src = chrome.runtime.getURL("inject.js");
          s.onload = function () { this.remove(); };
          (targetDocument.head || targetDocument.documentElement).appendChild(s);
        };
        const doInjectWithClose = (iframeDoc, layerElement) => {
          log(`✅ iframe load事件触发, 开始注射`);
          let doc = iframeDoc;
          try {
            const test = doc.location;
          } catch (e) {
            log(`⚠️ 跨域或读取失败, 回退：注射到主页面`);
            doc = document;
          }
          doInject(doc);
          // 保持你原本的 3500 毫秒延时
          setTimeout(() => {
            if (layerElement) layerElement.querySelector("span > a")?.click();
            log(`关闭弹窗, 继续处理...`);
            setTimeout(() => processRowFn(rowNum - 1), 500);
          }, 3500);
        };

        if (!popupIframe) {
          log(`⚠️ 等待 500ms 后依然未找到弹窗，强制脱壳处理`);
          doInjectWithClose(document, null);
          return;
        }

        // 15秒兜底超时，防止 iframe 永远不触发 load 导致脚本彻底卡死在这个 i 上
        const fallbackTimer = setTimeout(() => {
          log(`⚠️ iframe load 事件超时，降级执行主页面注射`);
          doInjectWithClose(document, layerEl);
        }, 15000);

        // 完美主线：直接监听弹窗的加载完成
        popupIframe.addEventListener("load", () => {
          clearTimeout(fallbackTimer);
          doInjectWithClose(popupIframe.contentDocument, layerEl);
        }, { once: true });
      }, 500);
    },

    async processDetails() { // 处理详情页的函数,判断截止导出条件
      Store.clearStage(KEYS.NEED_DOWNLOAD);

      const foundCutoff = await new Promise((resolve) => { // 找到截止导出条件
        const processRow = (i) => {
          if (i < 1) { resolve(false); return; }
          const tdSel = `#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary > tbody > tr:nth-child(${i}) > td:nth-child(6)`;
          const td = document.querySelector(tdSel);
          if (!td || !this.isClickable(td)) { processRow(i - 1); return; }
          const text = Utils.normalizeString(td.innerText);
          log(`✅ 第${i}行可点击：`, text);
          if (text === "截止导出") {// 遇到截止点
            if (Store.hasDownloaded()) {
              log(`匹配到截止导出，当前问卷也已经有下载触发过，在新标签页记录当前页面，以便后续手动添加截止导出`);
              window.open(location.href + "#static", "_blank");
            }
            resolve(true);
            return;
          }
          // 如果当前行不是截止导出，则记录已下载，并点击查看详情
          Store.recordDownloaded();
          const clickSel = `#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary > tbody > tr:nth-child(${i}) > td:nth-child(4) > a.see.active`;
          const clickEl = document.querySelector(clickSel);
          if (clickEl) {
            try { if (clickEl.getAttribute("href")?.trim().toLowerCase().startsWith("javascript:")) clickEl.removeAttribute("href"); } catch (e) { }
            clickEl.click();
            log(`已点击第 ${i} 行查看详情`);
          }
          this.injectIframeDownload(i, processRow); // 注入iframe并下载
        };
        setTimeout(() => processRow(100), 600);
      });
      await sleep(2000); // 等待下载完成

      // 处理第二页
      const lbPage = document.getElementById("ctl02_ContentPlaceHolder1_ViewStatSummary1_lbPage");
      const isPage2 = lbPage && lbPage.textContent.trim() === "2/2";

      if (!foundCutoff && isPage2) {
        log("✅ 当前页(第2页)未找到截止导出, 准备返回第1页继续");
        const f = document.forms[0];
        if (f && f.__EVENTTARGET && f.__EVENTARGUMENT) {
          Store.setStage(KEYS.NEED_DOWNLOAD);
          f.__EVENTTARGET.value = "ctl02$ContentPlaceHolder1$ViewStatSummary1$btnFirst";
          f.__EVENTARGUMENT.value = "";
          (f.requestSubmit ? f.requestSubmit() : f.submit());
          return;
        }
      }

      // 未遇到截止导出
      if (!foundCutoff && Store.hasDownloaded()) {
        log(`✅ 数据已全部下完，未遇到截止导出，在新标签页记录当前页面`);
        window.open(location.href + "#static", "_blank");
      }

      // 记录当前任务成功，切换下一个
      const currentTarget = Store.getCurrentTarget();
      if (currentTarget) Store.recordSuccess(currentTarget);

      const next = Store.advanceToNextTask();
      if (!next) {
        Store.stopAllAndCleanup("✅ 已完成：所有 TASK 都已跑完，已自动停止");
        return;
      }

      const listUrl = Store.getListUrl();
      if (listUrl) {
        log("✅ 回到主页面，进行下一个任务");
        location.href = listUrl;
      } else {
        Store.stopAllAndCleanup("⚠️ 未记录主页面 URL");
      }
    },

    async run() { // 运行函数
      if (!Store.hasRunToken) return;
      // 这里的 if 控制了成绩页内串行的加载链路 (通过自动重载推进)
      if (Store.getStage(KEYS.NEED_100)) {
        const reloaded = await this.setPageSize100();
        if (reloaded) return;
      }
      if (Store.getStage(KEYS.NEED_LAST_PAGE)) {
        const reloaded = await this.goToLastPage();
        if (reloaded) return;
      }
      if (Store.getStage(KEYS.NEED_DOWNLOAD)) {
        await this.processDetails();
      }
    }
  };

  // ==========================================
  // 5. UI 控制面板 (Panel)
  // ==========================================
  const UI = {
    inject() {
      if (!ListPage.isMatch()) return;
      const PANEL_ID = "wjx-helper-panel";
      if (document.getElementById(PANEL_ID)) return;
      const panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:999999;padding:12px;border-radius:8px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.2);border:1px solid #ddd;display:flex;flex-direction:column;gap:8px;width:200px;";
      const header = document.createElement("div");
      header.textContent = "问卷星助手 - 任务列表";
      header.style.cssText = "font-weight:bold;font-size:14px;color:#333;";
      panel.appendChild(header);
      const textarea = document.createElement("textarea");
      textarea.placeholder = "一行一个编号\n例如：\nPB-17\nPB-18";
      textarea.style.cssText = "width:100%;height:120px;box-sizing:border-box;resize:vertical;border:1px solid #ccc;border-radius:4px;padding:6px;font-family:monospace;";
      textarea.value = localStorage.getItem(KEYS.USER_TASKS) || "PB-17\nPB-17-课后";
      panel.appendChild(textarea);
      const btn = document.createElement("button");
      btn.textContent = "保存并开始全部任务";
      btn.style.cssText = "padding:8px;background:#f00;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;";
      btn.onclick = () => {
        const raw = textarea.value;
        if (!raw.trim()) return alert("请输入至少一个任务编号！");
        localStorage.setItem(KEYS.USER_TASKS, raw);
        Store.setRunToken();
        const tasks = Store.initTasksFromInput(raw);
        log(`✅ 面板启动，共 ${tasks.length} 个任务：`, tasks);
        Store.startAutoRun();
        Store.setListUrl(location.href);
        ListPage.run();
      };
      panel.appendChild(btn);
      document.documentElement.appendChild(panel);
      log("✅ 已注入控制面板");
    }
  };

  // ==========================================
  // 6. 主程序入口 (Main)
  // ==========================================
  const start = () => {
    UI.inject(); // 只在列表页面生效
    if (ListPage.isMatch()) {
      ListPage.run();
    } else {
      DetailPage.run();
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();