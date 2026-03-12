console.log(
  "%c【问卷星助手】已加载",
  "color:red;font-size:16px;font-weight:bold;"
);

(async () => {
  const TAG = "【问卷星助手】";
  const log = (...a) => console.log(TAG, ...a);

  /***********************
   * ✅ 关键修复：防止新标签页（用来检查错误的）自动跑脚本
   * 如果 URL 里带有 #static，则完全不执行任何逻辑，安静呆着
   ***********************/
  if (location.hash === "#static") {
    log("🛑 检测到 #static 标记，脚本已暂停（静态模式，仅供检查）");
    return;
  }

  /***********************
   * ✅ 硬闸门：只有点过“开始全部任务”才允许运行
   * 用 localStorage，保证新开标签页也能读到同一个授权状态
   ***********************/
  const RUN_TOKEN_KEY = "wjx_run_token_v1";
  const hasRunToken = () => localStorage.getItem(RUN_TOKEN_KEY) === "1";
  const setRunToken = () => localStorage.setItem(RUN_TOKEN_KEY, "1");
  const clearRunToken = () => localStorage.removeItem(RUN_TOKEN_KEY);

  // ✅ 新增：用户输入的 Task List 存储 Key
  const USER_TASKS_KEY = "wjx_user_defined_tasks";

  // ✅ 宽松匹配列表页 URL
  const isListPage = () => /myquestionnaires/i.test(location.href);

  const TASK_KEY = "wjx_tasks";
  const INDEX_KEY = "wjx_task_index";
  const CUR_KEY = "wjx_current_task";
  const LIST_URL_KEY = "wjx_list_url";
  const AUTO_KEY = "wjx_auto_run_all";
  const RUNNING_KEY = "__wjx_multi_running";
  const FAILED_KEY = "wjx_failed";

  const normalize = (s) =>
    (s ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /***********************
   * ✅ 队列管理
   ***********************/
  // 修改：从传入的 rawText 中解析任务，不再依赖全局 TASKS_TEXT
  function initTasksFromInput(rawText) {
    const tasks = rawText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    sessionStorage.setItem(TASK_KEY, JSON.stringify(tasks));
    sessionStorage.setItem(INDEX_KEY, "0");
    sessionStorage.removeItem(CUR_KEY);
    sessionStorage.removeItem(FAILED_KEY);
    sessionStorage.removeItem("wjx_last_searched");
    return tasks; // 返回解析后的数组供检查
  }

  function recordFail(t) {
    let arr = JSON.parse(sessionStorage.getItem(FAILED_KEY) || "[]");
    if (!arr.includes(t)) arr.push(t);
    sessionStorage.setItem(FAILED_KEY, JSON.stringify(arr));
  }

  function getTasks() {
    try {
      return JSON.parse(sessionStorage.getItem(TASK_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function getIndex() {
    const n = parseInt(sessionStorage.getItem(INDEX_KEY) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  function setIndex(i) {
    sessionStorage.setItem(INDEX_KEY, String(i));
  }

  function getCurrentTarget() {
    const cur = sessionStorage.getItem(CUR_KEY);
    if (cur) return cur;

    const tasks = getTasks();
    const idx = getIndex();
    const t = tasks[idx] || "";
    if (t) sessionStorage.setItem(CUR_KEY, t);
    return t;
  }

  function advanceToNextTask() {
    const tasks = getTasks();
    const idx = getIndex();
    const nextIdx = idx + 1;
    sessionStorage.removeItem(CUR_KEY);
    setIndex(nextIdx);
    return tasks[nextIdx] || null;
  }

  function stopAllAndCleanup(message) {
    let fails = JSON.parse(sessionStorage.getItem(FAILED_KEY) || "[]");
    if (fails.length) message += "\n\n⚠️ 未找到:\n" + fails.join("\n");

    sessionStorage.removeItem(AUTO_KEY);
    sessionStorage.removeItem(TASK_KEY);
    sessionStorage.removeItem(INDEX_KEY);
    sessionStorage.removeItem(CUR_KEY);
    sessionStorage.removeItem(LIST_URL_KEY);
    sessionStorage.removeItem(FAILED_KEY);
    sessionStorage.removeItem("wjx_last_searched");

    clearRunToken();

    log("🛑 已停止：", message);
    alert(message);
  }

  /***********************
   * ✅ 搜索工具
   ***********************/
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /***********************
   * ✅ 列表匹配 & 点击
   ***********************/
  function tryClickMatchedAction(maxTry = 10) {
    const TARGET = getCurrentTarget();
    log(`111`);
    const titleSel = (i) =>
      i === 1
        ? `#ctl01_ContentPlaceHolder1_qls > dl:nth-child(${i}) > dt > div.pull-left > a.pull-left.item-tit`
        : `#ctl01_ContentPlaceHolder1_qls > dl:nth-child(${i}) > dt > div.pull-left > a`;

    const actionSel = (i) =>
      `#ctl01_ContentPlaceHolder1_qls > dl:nth-child(${i}) > dd > div.process-box.pull-left > dl.process-3.pull-left > dd > ul > li:nth-child(2) > a`;

    for (let i = 1; i <= maxTry; i++) {
      const tEl = document.querySelector(titleSel(i));
      const tText = normalize(tEl?.innerText);
      log(`[check ${i}] title=`, tText);

      if (tText && tText === normalize(TARGET)) {
        const btn = document.querySelector(actionSel(i));
        if (!btn) {
          log(`✅ 匹配第 ${i} 条，但按钮没找到：`, actionSel(i));
          return { matched: true, index: i, clicked: false, reason: "button_not_found" };
        }

        sessionStorage.setItem("wjx_need_last", "1");
        try { btn.scrollIntoView({ block: "center" }); } catch { }
        btn.click();
        log(`✅ 匹配第 ${i} 条（${TARGET}），已点击按钮`);
        return { matched: true, index: i, clicked: true };
      }
    }
    log("❌ 前 10 条都未匹配");
    return { matched: false };
  }

  /***********************
   * ✅ 列表页自动化主流程
   ***********************/
  async function runListPageFlow() {
    if (!hasRunToken()) return;
    if (!sessionStorage.getItem(AUTO_KEY)) return;
    if (window[RUNNING_KEY]) return;
    window[RUNNING_KEY] = true;

    try {
      if (!sessionStorage.getItem(LIST_URL_KEY)) {
        sessionStorage.setItem(LIST_URL_KEY, location.href);
      }

      const TARGET = getCurrentTarget();
      const tasks = getTasks();
      const idx = getIndex();

      if (!TARGET) {
        stopAllAndCleanup("✅ 已完成：所有 TASK 都已跑完，已自动停止。");
        return;
      }

      log(`➡️ 当前任务 (${idx + 1}/${tasks.length})：`, TARGET);

      const input =
        document.querySelector('input[placeholder*="问卷名"]') ||
        document.querySelector('input[placeholder*="搜索"]') ||
        document.querySelector(".el-input__inner") ||
        document.querySelector('input[type="text"]');

      const SEARCH_FLAG = "wjx_last_searched";

      if (input && sessionStorage.getItem(SEARCH_FLAG) !== TARGET) {
        log(`🔎 准备检索问卷并等待结果：`, TARGET);
        setNativeValue(input, TARGET);
        sessionStorage.setItem(SEARCH_FLAG, TARGET);
        await sleep(120);

        if (window.btnSub && typeof window.btnSub.click === "function") {
          window.btnSub.click();
        } else {
          document.querySelector("#ctl01_ContentPlaceHolder1_divInfo > i")?.click();
        }

        // 关键：点击搜索可能导致整个页面重载 (Postback)。
        // 若没有重载而是 AJAX，则设置 1.5s 后重新调用检测函数。
        // 若重载了，原脚本执行会自然终止，待新页面加载后再接管。
        setTimeout(() => {
          window[RUNNING_KEY] = false;
          runListPageFlow();
        }, 1500);
        return; // 中断本轮执行回合
      }

      // 如果走到这里，说明要么已经搜过并在新页面载入了，要么输入框不存在
      log("👀 正在检查搜索结果是否出现目标...");
      const r = tryClickMatchedAction(10);

      if (r?.matched && r?.clicked) {
        return; // 匹配成功并点击，跳转成绩页逻辑
      }

      log("⚠️ 列表中未查找到该问卷或按钮点击失败，记录并跳过：", TARGET);
      recordFail(TARGET);
      const next = advanceToNextTask();
      if (!next) {
        stopAllAndCleanup("✅ 已完成：所有 TASK 都已跑完，已自动停止。");
        return;
      }

      // 不管是 AJAX 还是啥，直接平滑衔接下一个问卷搜索
      setTimeout(() => {
        window[RUNNING_KEY] = false;
        runListPageFlow();
      }, 500);
      return;
    } finally {
      window[RUNNING_KEY] = false;
    }
  }

  /***********************
   * ✅ 非列表页逻辑
   ***********************/
  if (!isListPage() && !hasRunToken()) return;

  // 成绩页 - 阶段1 选最大条数
  if (hasRunToken() && sessionStorage.getItem("wjx_need_last")) {
    sessionStorage.removeItem("wjx_need_last");
    sessionStorage.setItem("wjx_need_go_last", "1");

    const ddl = document.querySelector("#ctl02_ContentPlaceHolder1_ViewStatSummary1_ddlPageCount");
    if (ddl) {
      ddl.click();
      const opt = ddl.querySelector("option:nth-child(8)");
      if (opt) {
        opt.selected = true;
        ddl.dispatchEvent(new Event("change", { bubbles: true }));
        log("✅ 把每页显示问卷条数改为100");
        return; // ✅ change事件会导致ASP.NET页面重载刷新，必须停止执行！
      } else {
        log("⚠️ 找不到100");
      }
    } else {
      log("⚠️ 找不到clicker");
    }
    // 如果找不到下拉框/100项等，直接往下继续（容错）
  }

  // 成绩页 - 阶段1.5 跳到最后一页
  if (hasRunToken() && sessionStorage.getItem("wjx_need_go_last")) {
    sessionStorage.removeItem("wjx_need_go_last");
    sessionStorage.setItem("wjx_need_detail", "1");
    await sleep(3000);
    try {
      log("✅ 正在翻到最后一页...");
      const f = document.forms[0];
      if (!f || !f.__EVENTTARGET || !f.__EVENTARGUMENT) {
        log("⚠️ 未找到表单隐藏字段，翻页可能失败");
      } else {
        f.__EVENTTARGET.value = "ctl02$ContentPlaceHolder1$ViewStatSummary1$btnLast";
        f.__EVENTARGUMENT.value = "";
        (f.requestSubmit ? f.requestSubmit() : f.submit());
        return; // ✅ 提交表单会导致页面重载刷新！
      }
    } catch (e) {
      log("⚠️ 翻页报错: ", e);
    }
    // 如果没能翻页（比如只有一页，去不掉 btnLast 或者报错），直接 fallthrough 往下走 阶段2
  }



  // 成绩页 - 阶段2 找最后一个是否是截止导出
  if (hasRunToken() && sessionStorage.getItem("wjx_need_detail")) {
    sessionStorage.removeItem("wjx_need_detail");
    const p = new Promise((resolve) => {
      const STOP_TEXT = "截止导出";
      const TABLE = "#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary > tbody";
      const normalize2 = (s) => (s ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();

      const isClickable = (el) => {
        if (!el) return false;
        const a = el.tagName?.toLowerCase() === "a" ? el : el.querySelector?.("a");
        const target = a || el;
        if (target.hasAttribute?.("disabled")) return false;
        if (target.getAttribute?.("aria-disabled") === "true") return false;
        const cs = window.getComputedStyle(target);
        if (cs.pointerEvents === "none") return false;
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
        return true;
      };

      const getClickableValueAtRow = (i) => {
        const tdSel = `${TABLE} > tr:nth-child(${i}) > td:nth-child(6)`;
        const td = document.querySelector(tdSel);
        if (!td) return null;
        const a = td.querySelector("a") || td;
        if (!isClickable(a)) return null;
        return { row: i, tdSel, el: a, text: normalize2(a.innerText || td.innerText) };
      };

      let isFirstHit = true;
      const processRow = (i) => {
        if (i < 1) { resolve(false); return; }

        const hit = getClickableValueAtRow(i);
        if (!hit) { processRow(i - 1); return; }

        log(`✅ 第${i}行可点击：`, hit.text);
        const ok = normalize2(hit.text) === normalize2(STOP_TEXT);

        if (ok) {
          if (!isFirstHit) {
            log(`匹配到截止导出，在新标签页记录当前页面...`);
            window.open(location.href + "#static", "_blank");
          } else {
            log(`第一次直接匹配到截止导出，跳过新标签页打开`);
          }
          resolve(true);
          return;
        }
        isFirstHit = false;

        // else：点击详情 → 等弹窗 iframe 加载完 → 注入下载 → 等待 → 关闭弹窗 → 处理 i-1
        log(hit.text, STOP_TEXT);
        const clickSel = `#ctl02_ContentPlaceHolder1_ViewStatSummary1_tbSummary > tbody > tr:nth-child(${i}) > td:nth-child(4) > a.see.active`;
        const a = document.querySelector(clickSel);
        if (a) {
          try {
            const href = a.getAttribute && (a.getAttribute("href") || "");
            if (href && href.trim().toLowerCase().startsWith("javascript:")) {
              a.removeAttribute("href");
            }
          } catch (e) { }
          a.click();
          log(`已点击第 ${i} 行查看详情`);
        } else {
          log(`第 ${i} 行未找到 a.see.active`);
        }

        // ✅ 修复：用 load 事件（而非 readyState 轮询）等 iframe 加载完毕
        // readyState 轮询会读到上一次关闭弹窗后遗留的旧 document（它仍是 "complete"），
        // 导致 inject.js 被注射进即将被导航替换的旧文档，5秒后静默消失。
        // load 事件只在 iframe 真正加载完新 URL 后触发，不会被旧状态欺骗。
        const INJECT_DELAY = 5000; // inject.js 内部 5s 延迟

        // 给 Layui 500ms 时间创建/复用 iframe 并开始加载新 URL
        // （这段时间内 iframe 从旧 "complete" 变成新 "loading"，load 事件尚未触发）
        setTimeout(() => {
          let popupIframe = null;
          let layerEl = null;
          document.querySelectorAll("[id^='layui-layer']").forEach(el => {
            const iframe = el.querySelector("iframe");
            if (iframe) { popupIframe = iframe; layerEl = el; }
          });

          const doInject = (capturedIframe, capturedLayer) => {
            log(`✅ iframe load事件触发（layer=${capturedLayer?.id}），开始注射 inject.js`);
            try {
              const s = capturedIframe.contentDocument.createElement("script");
              s.src = chrome.runtime.getURL("inject.js");
              s.onload = function () { this.remove(); };
              (capturedIframe.contentDocument.head || capturedIframe.contentDocument.documentElement).appendChild(s);
            } catch (e) {
              log(`⚠️ 注射进 iframe 失败，回退：注射到主页面`);
              const s = document.createElement("script");
              s.src = chrome.runtime.getURL("inject.js");
              s.onload = function () { this.remove(); };
              (document.head || document.documentElement).appendChild(s);
            }
            // inject.js 内部 10s + 1s 缓冲后关弹窗
            setTimeout(() => {
              capturedLayer?.querySelector("span > a")?.click();
              log(`关闭弹窗（${capturedLayer?.id}），继续处理第 ${i - 1} 行`);
              setTimeout(() => processRow(i - 1), 2000);
            }, INJECT_DELAY + 5000);
          };

          if (!popupIframe) {
            log(`⚠️ 500ms 后仍找不到弹窗 iframe，回退：注射到主页面`);
            const s = document.createElement("script");
            s.src = chrome.runtime.getURL("inject.js");
            s.onload = function () { this.remove(); };
            (document.head || document.documentElement).appendChild(s);
            setTimeout(() => {
              log(`关闭弹窗（未知），继续处理第 ${i - 1} 行`);
              setTimeout(() => processRow(i - 1), 2000);
            }, INJECT_DELAY + 1000);
            return;
          }

          log(`已找到弹窗 iframe（${layerEl?.id}），等待 load 事件...`);
          const capturedIframe = popupIframe;
          const capturedLayer = layerEl;

          // 超时兜底：20s 内没有 load 事件就回退
          const fallbackTimer = setTimeout(() => {
            log(`⚠️ 等待 load 事件超时 20s，回退：注射到主页面`);
            const s = document.createElement("script");
            s.src = chrome.runtime.getURL("inject.js");
            s.onload = function () { this.remove(); };
            (document.head || document.documentElement).appendChild(s);
            setTimeout(() => {
              capturedLayer?.querySelector("span > a")?.click();
              log(`关闭弹窗（${capturedLayer?.id || "未知"}），继续处理第 ${i - 1} 行`);
              setTimeout(() => processRow(i - 1), 2000);
            }, INJECT_DELAY + 1000);
          }, 20000);

          // 监听 load 事件（{once:true} 确保只触发一次）
          capturedIframe.addEventListener("load", () => {
            clearTimeout(fallbackTimer);
            doInject(capturedIframe, capturedLayer);
          }, { once: true });

        }, 500); // 给 Layui 500ms 启动 iframe 导航

      };

      setTimeout(() => processRow(100), 600);
    });

    return p.then((foundCutoff) => new Promise(r => setTimeout(() => r(foundCutoff), 2000))).then((foundCutoff) => {
      const lbPage = document.getElementById("ctl02_ContentPlaceHolder1_ViewStatSummary1_lbPage");
      const isPage2 = lbPage && lbPage.textContent.trim() === "2/2";

      if (!foundCutoff && isPage2) {
        log("✅ 当前页(第2页)未找到[截止导出]，准备返回第1页继续...");
        const f = document.forms[0];
        if (f && f.__EVENTTARGET && f.__EVENTARGUMENT) {
          // 当前任务还没找完所有页！把阶段2标记传下去。当页面刷新（回到第一页）后，会自动继续本任务的扫尾
          sessionStorage.setItem("wjx_need_detail", "1");
          f.__EVENTTARGET.value = "ctl02$ContentPlaceHolder1$ViewStatSummary1$btnFirst";
          f.__EVENTARGUMENT.value = "";
          (f.requestSubmit ? f.requestSubmit() : f.submit());
          return;
        }
      }

      // 如果走到了这里说明该任务彻底完成：要么在第2页找到了截止导出；要么两页全部下载完了（没中截止导出）
      const next = advanceToNextTask();
      if (!next) {
        stopAllAndCleanup("✅ 已完成：所有 TASK 都已跑完，已自动停止。");
        return;
      }
      const listUrl = sessionStorage.getItem(LIST_URL_KEY);
      if (listUrl) {
        log("↩️ 回到列表页：", next);
        location.href = listUrl;
      } else {
        stopAllAndCleanup("⚠️ 未记录列表页 URL");
      }
    });
  }

  /***********************
   * ✅ 注入面板（Panel）逻辑
   ***********************/
  function injectControlPanel() {
    if (!isListPage()) return;
    const PANEL_ID = "wjx-helper-panel";
    if (document.getElementById(PANEL_ID)) return;

    // 1. 创建容器
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:999999;" +
      "padding:12px;border-radius:8px;background:#fff;" +
      "box-shadow:0 4px 12px rgba(0,0,0,0.2);border:1px solid #ddd;" +
      "display:flex;flex-direction:column;gap:8px;width:200px;";

    // 2. 标题
    const header = document.createElement("div");
    header.textContent = "问卷星助手 - 任务列表";
    header.style.cssText = "font-weight:bold;font-size:14px;color:#333;";
    panel.appendChild(header);

    // 3. 输入框 (Textarea)
    const textarea = document.createElement("textarea");
    textarea.placeholder = "一行一个编号\n例如：\nPB-17\nPB-18";
    textarea.style.cssText =
      "width:100%;height:120px;box-sizing:border-box;resize:vertical;" +
      "border:1px solid #ccc;border-radius:4px;padding:6px;font-family:monospace;";

    // 自动回填上次保存的内容
    const saved = localStorage.getItem(USER_TASKS_KEY);
    if (saved) textarea.value = saved;
    // 如果没有存过，给个默认例子（可选，或者留空）
    else textarea.value = "PB-17\nPB-17-课后";

    panel.appendChild(textarea);

    // 4. “开始任务”按钮
    const btn = document.createElement("button");
    btn.textContent = "保存并开始全部任务";
    btn.style.cssText =
      "padding:8px;background:#f00;color:#fff;border:none;border-radius:4px;" +
      "cursor:pointer;font-weight:bold;";

    btn.onclick = () => {
      const raw = textarea.value;
      if (!raw.trim()) {
        alert("请输入至少一个任务编号！");
        return;
      }

      // 保存到 localStorage
      localStorage.setItem(USER_TASKS_KEY, raw);

      // 授权
      setRunToken();

      // 初始化任务队列
      const tasks = initTasksFromInput(raw);

      log(`✅ 面板启动，共 ${tasks.length} 个任务：`, tasks);

      sessionStorage.setItem(AUTO_KEY, "1");
      sessionStorage.setItem(LIST_URL_KEY, location.href);

      runListPageFlow();
    };

    panel.appendChild(btn);
    document.documentElement.appendChild(panel);
    log("✅ 已注入控制面板");
  }

  // 启动逻辑
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectControlPanel();
      runListPageFlow();
    });
  } else {
    injectControlPanel();
    runListPageFlow();
  }
})();