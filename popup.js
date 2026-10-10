const fillBtn = document.getElementById('fill-btn');
const editBtn = document.getElementById('edit-btn');
const statusEl = document.getElementById('status');

document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;

editBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get(['pdfName', 'resume'], (result) => {
  if (result.pdfName) {
    statusEl.textContent = '已导入：' + result.pdfName;
  } else if (result.resume && result.resume.name) {
    statusEl.textContent = '已保存：' + result.resume.name;
  } else {
    statusEl.textContent = '请先在选项页上传 PDF 或填写简历';
  }
});

// 在所有 frame 里跑填充，返回每个 frame 的结果；overrides 为本次临时替换的简历字段
async function runFill(tabId, allFrames, overrides) {
  const target = { tabId, allFrames };
  await chrome.scripting.executeScript({ target, files: ['parse.js', 'content.js'] });
  return chrome.scripting.executeScript({
    target,
    func: (o) => (window.__resumeAutofillFill ? window.__resumeAutofillFill(o) : null),
    args: [overrides || null]
  });
}

function summarize(results) {
  let filled = 0;
  let noResume = false;
  let exp = null;
  let noExp = false;
  const missed = [];
  for (const { result } of results) {
    if (!result) continue;
    if (result.error === 'no-resume') noResume = true;
    if (result.expInResume === 0) noExp = true;
    filled += result.filled || 0;
    if (result.stats && result.stats.exp) exp = result.stats.exp;
    (result.missed || []).forEach((m) => {
      if (m && !missed.includes(m)) missed.push(m);
    });
  }
  if (noResume && !filled) return '⚠️ 请先在选项页解析或填写简历';
  if (!filled) return '⚠️ 未找到可填充字段';

  let text = '✅ 已填充 ' + filled + ' 个字段';
  if (exp) {
    text += '，实习 ' + exp.entries + ' 段';
    if (exp.added) text += '（自动添加 ' + exp.added + ' 段）';
    if (exp.entries < exp.wanted) text += '，还有 ' + (exp.wanted - exp.entries) + ' 段没找到位置';
  }
  if (noExp) text += '。保存的简历里没有实习经历，请点「编辑简历」检查';
  if (missed.length) text += '。未能填上：' + missed.slice(0, 8).join('、');
  return text + '。请核对后再提交';
}

// 导出诊断信息：页面结构 + 上次填充记录，复制后发给开发者
const diagBtn = document.getElementById('diag-btn');
const diagOut = document.getElementById('diag-out');

diagBtn.addEventListener('click', async () => {
  diagBtn.disabled = true;
  statusEl.textContent = '正在收集页面结构（会短暂点开日期框）...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const target = { tabId: tab.id, allFrames: true };
    await chrome.scripting.executeScript({ target, files: ['parse.js', 'content.js'] });
    const results = await chrome.scripting.executeScript({
      target,
      func: () => (window.__resumeAutofillDiagnose ? window.__resumeAutofillDiagnose() : null)
    });
    const frames = results.map((r) => r.result).filter((r) => r && r.controls && r.controls.length);
    const text = JSON.stringify(frames, null, 1);
    diagOut.style.display = 'block';
    diagOut.value = text;
    diagOut.select();
    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = '✅ 已复制诊断信息（' + text.length + ' 字），直接粘贴发给我即可';
    } catch (e) {
      statusEl.textContent = '已生成诊断信息，请在下方框里全选复制';
    }
  } catch (error) {
    statusEl.textContent = '⚠️ 收集失败：' + (error && error.message ? error.message : error);
  } finally {
    diagBtn.disabled = false;
  }
});

fillBtn.addEventListener('click', async () => {
  statusEl.textContent = '正在填充，请不要关闭本窗口...';
  fillBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      statusEl.textContent = '⚠️ 未找到当前页面';
      return;
    }

    const overrides = await fillOverrides();
    let results;
    try {
      results = await runFill(tab.id, true, overrides);
    } catch (error) {
      results = await runFill(tab.id, false, overrides);
    }
    statusEl.textContent = summarize(results || []);
    if (overrides && jh.job) {
      const used = [overrides.expectedJob && '应聘岗位', overrides.expectedCity && '意向城市', overrides.summary && 'AI 自我评价'].filter(Boolean);
      statusEl.textContent += '（' + used.join('、') + '已按「' + jh.job.company + '」这个岗位填写）';
    }
  } catch (error) {
    statusEl.textContent = '⚠️ 当前页面无法填充（浏览器内置页面、扩展商店等不允许注入）';
  } finally {
    fillBtn.disabled = false;
  }
});

// ---------- 求职助手联动 ----------

const $ = (id) => document.getElementById(id);
const STATUS_TEXT = { pending: '待确认', approved: '待投递', applied: '已投递', rejected: '已拒绝' };
const MAX_DRAFTS = 30;

const jh = {
  ctx: null,     // 求职助手返回的上下文：{ job, matched_by, candidates, ai_configured }
  job: null,     // 当前选中的岗位
  pageKey: '',   // 当前网页（去掉参数）——手动选的岗位按网页记住
  picks: {},     // { 网页: 岗位 id }
  drafts: {}     // { 岗位 id: { summary, question, answer } }
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const splitCities = (s) => String(s || '').split(/[\/、,，|\s]+/).filter((c) => c && !/^(全国|海外|城市未知|不限)$/.test(c));

function pageKeyOf(url) {
  try {
    const u = new URL(url);
    return u.host + u.pathname.replace(/\/$/, '');
  } catch (e) {
    return '';
  }
}

async function initJobHunter() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (tab && tab.url) || '';
  try {
    jh.ctx = await jobHunter('/api/autofill/context?url=' + encodeURIComponent(url), { timeout: 1500 });
  } catch (error) {
    $('jh-offline').hidden = false;
    return;
  }

  const store = await chrome.storage.local.get(['jhPicks', 'jhDrafts']);
  jh.picks = store.jhPicks || {};
  jh.drafts = store.jhDrafts || {};
  jh.pageKey = pageKeyOf(url);

  const select = $('jh-job');
  select.innerHTML = '<option value="">— 不关联岗位 —</option>' + jh.ctx.candidates.map((j) =>
    '<option value="' + j.id + '">' + (j.match_score == null ? '分析中' : j.match_score + ' 分') + ' · '
    + esc(j.company) + ' - ' + esc(j.title) + '</option>').join('');

  const picked = jh.picks[jh.pageKey];
  const initial = picked !== undefined ? picked : (jh.ctx.job ? jh.ctx.job.id : '');
  select.value = String(initial);
  if (select.selectedIndex < 0) select.value = '';

  $('jh').hidden = false;
  renderJob();
}

function renderJob() {
  const id = Number($('jh-job').value) || null;
  const ctx = jh.ctx;
  jh.job = id ? ctx.candidates.find((j) => j.id === id) || null : null;

  const badge = $('jh-badge');
  const auto = ctx.job && jh.job && ctx.job.id === jh.job.id && jh.picks[jh.pageKey] === undefined;
  badge.className = 'jh-badge' + (auto ? ' ok' : '');
  badge.textContent = auto
    ? (ctx.matched_by === 'url' ? '✓ 已识别当前页面' : '✓ 刚在求职助手点了投递')
    : (jh.job ? '手动选择' : '未识别，可手动选择');

  const show = !!jh.job;
  $('jh-tools').hidden = !show;
  $('jh-applied').hidden = !show || jh.job.status === 'applied';
  $('jh-info').textContent = '';
  $('jh-warn').hidden = true;
  if (!show) return;

  const j = jh.job;
  $('jh-info').textContent = [
    j.match_score == null ? '匹配度分析中' : '匹配 ' + j.match_score + ' 分',
    j.match_advice,
    STATUS_TEXT[j.status] || j.status,
    j.city
  ].filter(Boolean).join(' · ');

  const kb = j.kanban;
  let warn = '';
  if (j.status === 'applied') warn = '这个岗位已经标记过已投递';
  else if (kb) warn = '⚠️ 秋招看板里已有「' + kb.company + '」（' + kb.status_label + '）' + (kb.positions ? '：' + kb.positions : '') + '，注意别重复投同类岗位';
  $('jh-warn').textContent = warn;
  $('jh-warn').hidden = !warn;

  const gen = $('jh-gen');
  gen.disabled = !ctx.ai_configured;
  gen.title = ctx.ai_configured ? '' : '求职助手未配置 AI Key';
  $('jh-answer-btn').disabled = !ctx.ai_configured;

  const draft = jh.drafts[j.id] || {};
  $('jh-summary').value = draft.summary || '';
  $('jh-summary').hidden = !draft.summary;
  $('jh-question').value = draft.question || '';
  $('jh-answer').value = draft.answer || '';
  $('jh-answer').hidden = !draft.answer;
  $('jh-copy').hidden = !draft.answer;
}

// AI 生成的内容按岗位存起来：弹窗关掉再打开不会丢
function saveDraft() {
  if (!jh.job) return;
  jh.drafts[jh.job.id] = {
    summary: $('jh-summary').value,
    question: $('jh-question').value,
    answer: $('jh-answer').value,
    at: Date.now()
  };
  const ids = Object.keys(jh.drafts).sort((a, b) => (jh.drafts[b].at || 0) - (jh.drafts[a].at || 0));
  ids.slice(MAX_DRAFTS).forEach((k) => delete jh.drafts[k]);
  chrome.storage.local.set({ jhDrafts: jh.drafts });
}

// 关联岗位后本次填充要临时替换的字段
async function fillOverrides() {
  if (!jh.job) return null;
  const o = {};
  if ($('jh-use-job').checked) {
    const title = jh.job.title || '';
    const cities = splitCities(jh.job.city);
    // 去掉「【2027校园招聘】」「（27届秋招）」和结尾的「-上海」，网申页的岗位下拉框更容易匹配上
    let clean = title.replace(/【[^】]*】|\[[^\]]*\]|[（(][^）)]*(届|招|批)[^）)]*[)）]/g, '').trim();
    cities.forEach((c) => {
      clean = clean.replace(new RegExp('\\s*[-－—]\\s*' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');
    });
    o.expectedJob = clean.trim() || title;
    if (cities.length) {
      const { resume } = await chrome.storage.local.get('resume');
      const wanted = splitCities(resume && resume.expectedCity);
      o.expectedCity = cities.find((c) => wanted.some((w) => w.includes(c) || c.includes(w))) || cities[0];
    }
  }
  const summary = $('jh-summary').value.trim();
  if (summary) o.summary = summary;
  return Object.keys(o).length ? o : null;
}

async function aiWrite(button, body, onDone) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = '正在生成（10-30 秒，别点网页）...';
  try {
    const r = await jobHunter('/api/autofill/write', { body: Object.assign({ job_id: jh.job.id }, body), timeout: 120000 });
    onDone(r.text);
    saveDraft();
  } catch (error) {
    statusEl.textContent = '⚠️ ' + error.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

$('jh-job').addEventListener('change', () => {
  jh.picks[jh.pageKey] = Number($('jh-job').value) || 0;
  chrome.storage.local.set({ jhPicks: jh.picks });
  renderJob();
});

$('jh-gen').addEventListener('click', () => aiWrite($('jh-gen'), { kind: 'summary', max_chars: 300 }, (text) => {
  $('jh-summary').value = text;
  $('jh-summary').hidden = false;
  statusEl.textContent = '✅ 已生成，点「一键填充」时会用它作为自我评价（可先修改）';
}));

$('jh-answer-btn').addEventListener('click', () => {
  const question = $('jh-question').value.trim();
  if (!question) {
    statusEl.textContent = '⚠️ 先把题目粘贴进来';
    return;
  }
  const limit = question.match(/(\d{2,4})\s*字/);
  aiWrite($('jh-answer-btn'), { kind: 'answer', question, max_chars: limit ? Number(limit[1]) : 300 }, (text) => {
    $('jh-answer').value = text;
    $('jh-answer').hidden = false;
    $('jh-copy').hidden = false;
    statusEl.textContent = '✅ 已生成回答，复制后粘贴到网页里';
  });
});

$('jh-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('jh-answer').value);
    statusEl.textContent = '✅ 已复制';
  } catch (error) {
    $('jh-answer').select();
    statusEl.textContent = '请手动复制（已全选）';
  }
});

['jh-summary', 'jh-question', 'jh-answer'].forEach((id) => $(id).addEventListener('input', saveDraft));

// 标记已投递：点两次确认，防止误触；会同时同步到秋招看板
let appliedConfirmTimer = null;
$('jh-applied').addEventListener('click', async () => {
  const btn = $('jh-applied');
  if (!btn.dataset.confirm) {
    btn.dataset.confirm = '1';
    btn.textContent = '确认已在网站上提交？再点一次';
    appliedConfirmTimer = setTimeout(() => {
      delete btn.dataset.confirm;
      btn.textContent = '✓ 投完了，在求职助手标记已投递';
    }, 5000);
    return;
  }
  clearTimeout(appliedConfirmTimer);
  delete btn.dataset.confirm;
  btn.disabled = true;
  try {
    const r = await jobHunter('/api/mark_applied/' + jh.job.id, { method: 'POST', timeout: 10000 });
    statusEl.textContent = r.already_applied
      ? '这个岗位之前已经标记过已投递'
      : '✅ 已在求职助手标记已投递' + (r.kanban_sync ? '；' + r.kanban_sync : '');
    jh.job.status = 'applied';
    renderJob();
  } catch (error) {
    statusEl.textContent = '⚠️ ' + error.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ 投完了，在求职助手标记已投递';
  }
});

initJobHunter();
