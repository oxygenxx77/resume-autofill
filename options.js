const SIMPLE_FIELDS = [
  'name', 'gender', 'lastPinyin', 'firstPinyin', 'englishName', 'birth', 'phone', 'email', 'wechat',
  'nationality', 'ethnicity', 'politics', 'marital', 'hukou', 'currentCity', 'address', 'idNumber', 'homepage', 'portfolio',
  'expectedJob', 'expectedCity', 'expectedSalary', 'gradYear', 'availableDate', 'internDays', 'internMonths',
  'skills', 'summary'
];

const DEFAULTS = { nationality: '中国' };

const form = document.getElementById('resume-form');
const toast = document.getElementById('toast');
const pdfInput = document.getElementById('pdf-file');
const pdfHint = document.getElementById('pdf-hint');
const parseBtn = document.getElementById('parse-btn');
let toastTimer = null;

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');

function showToast(message, isError) {
  toast.textContent = message;
  toast.style.color = isError ? '#b91c1c' : '#15803d';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.textContent = '';
  }, 3000);
}

// 下拉框里没有的旧值（如「全日制本科」「研究生」）临时加一个选项，免得保存时丢掉
function setValue(input, value) {
  const v = value || '';
  if (input.tagName === 'SELECT' && v && ![...input.options].some((o) => o.value === v)) {
    input.add(new Option(v, v));
  }
  input.value = v;
}

/**
 * 可增删的卡片列表（教育、实习、项目、校园、获奖、语言、证书共用）
 */
function cardList(name, titlePrefix, keys, mustHave) {
  const list = document.getElementById(name + '-list');
  const template = document.getElementById(name + '-template');

  const renumber = () => {
    list.querySelectorAll('.exp-card').forEach((card, i) => {
      card.querySelector('.exp-title').textContent = titlePrefix + ' ' + (i + 1);
    });
  };

  const add = (item) => {
    const data = item || {};
    const card = template.content.firstElementChild.cloneNode(true);
    const untilBox = card.querySelector('[data-k="untilNow"]');
    const untilNow = !!untilBox && !!(data.untilNow || data.end === '至今');
    keys.forEach((k) => {
      const input = card.querySelector('[data-k="' + k + '"]');
      if (input) setValue(input, k === 'end' && untilNow ? '' : data[k]);
    });

    if (untilBox) {
      const endInput = card.querySelector('[data-k="end"]');
      untilBox.checked = untilNow;
      endInput.disabled = untilNow;
      untilBox.addEventListener('change', () => {
        endInput.disabled = untilBox.checked;
        if (untilBox.checked) endInput.value = '';
      });
    }

    card.querySelector('[data-act="del"]').addEventListener('click', () => {
      card.remove();
      renumber();
    });

    list.appendChild(card);
    renumber();
  };

  const read = () => [...list.querySelectorAll('.exp-card')].map((card) => {
    const item = {};
    keys.forEach((k) => {
      const input = card.querySelector('[data-k="' + k + '"]');
      item[k] = input ? input.value.trim() : '';
    });
    const untilBox = card.querySelector('[data-k="untilNow"]');
    if (untilBox) {
      item.untilNow = untilBox.checked;
      if (item.untilNow) item.end = '至今';
    }
    return item;
  }).filter((item) => mustHave.some((k) => item[k]));

  const render = (items) => {
    list.innerHTML = '';
    (items || []).forEach((item) => add(item));
    if (!list.children.length) add();
  };

  document.getElementById('add-' + name).addEventListener('click', () => add());
  return { read, render };
}

const cards = {
  edu: cardList('edu', '教育', ['school', 'college', 'major', 'degree', 'start', 'end', 'form', 'schoolCity', 'gpa', 'rank', 'courses'], ['school']),
  exp: cardList('exp', '经历', ['company', 'title', 'department', 'start', 'end', 'industry', 'location', 'description'], ['company', 'title', 'description']),
  proj: cardList('proj', '项目', ['name', 'title', 'start', 'end', 'description'], ['name', 'description']),
  campus: cardList('campus', '校园经历', ['company', 'title', 'start', 'end', 'description'], ['company', 'title']),
  award: cardList('award', '奖项', ['name', 'date', 'level'], ['name']),
  lang: cardList('lang', '语言', ['language', 'level', 'cert', 'score'], ['language', 'cert']),
  cert: cardList('cert', '证书', ['name', 'date'], ['name'])
};

// 旧版只存了一段项目文字：没有 projectList 时从文字里拆一次
function projectsOf(resume) {
  if ((resume.projectList || []).length) return resume.projectList;
  if (resume.projects && typeof parseProjectItems === 'function') return parseProjectItems('项目经历\n' + resume.projects);
  return [];
}

// 旧版的教育信息是一组单独字段：合成第一段教育经历
function educationOf(resume) {
  const list = (resume.educationList || []).map((e) => Object.assign({}, e));
  const first = list[0] || {};
  const top = {
    school: resume.school, major: resume.major, degree: resume.degree, form: resume.studyForm,
    start: resume.eduStart, end: resume.eduEnd, college: resume.college, schoolCity: resume.schoolCity
  };
  Object.keys(top).forEach((k) => {
    if (!first[k] && top[k]) first[k] = top[k];
  });
  if (!list.length && first.school) list.push(first);
  else if (list.length) list[0] = first;
  return list;
}

function fillForm(resume) {
  const values = Object.assign({}, resume, { nationality: resume.nationality || DEFAULTS.nationality });
  SIMPLE_FIELDS.forEach((key) => {
    const input = document.getElementById(key);
    if (input) setValue(input, values[key]);
  });

  cards.edu.render(educationOf(resume));
  cards.exp.render(resume.experienceList);
  cards.proj.render(projectsOf(resume));
  cards.campus.render(resume.campusList);
  cards.award.render(resume.awardList);
  cards.lang.render(resume.languageList);
  cards.cert.render(resume.certList);
}

function readForm() {
  const resume = {};
  SIMPLE_FIELDS.forEach((key) => {
    resume[key] = document.getElementById(key).value.trim();
  });

  resume.educationList = cards.edu.read();
  resume.experienceList = cards.exp.read();
  resume.projectList = cards.proj.read();
  resume.campusList = cards.campus.read();
  resume.awardList = cards.award.read();
  resume.languageList = cards.lang.read();
  resume.certList = cards.cert.read();

  setTopEdu(resume);
  return resume;
}

const DEGREE_RANK = ['大专', '专科', '本科', '硕士', '研究生', '博士'];
const degreeRank = (d) => DEGREE_RANK.findIndex((x) => (d || '').includes(x));

// 网申页的「最高学历 / 学校 / 专业」等单独字段取学历最高的那段教育经历
function setTopEdu(resume) {
  const list = resume.educationList || [];
  if (!list.length) return;
  const edu = list.reduce((best, e) => (degreeRank(e.degree) > degreeRank(best.degree) ? e : best), list[0]);
  Object.assign(resume, {
    school: edu.school || '',
    major: edu.major || '',
    degree: edu.degree || '',
    studyForm: edu.form || '',
    eduStart: edu.start || '',
    eduEnd: edu.end || '',
    college: edu.college || '',
    schoolCity: edu.schoolCity || ''
  });
}

const sameText = (a, b) => !!(a && b && (a.includes(b) || b.includes(a)));

// 新解析的条目按名字找到旧条目，把旧条目里手填的字段补回来；旧条目没被解析到的也留着
function mergeList(parsed, old, keyOf) {
  const out = (parsed || []).map((item) => {
    const same = (old || []).find((o) => sameText(keyOf(o), keyOf(item)));
    if (!same) return item;
    const merged = Object.assign({}, item);
    Object.keys(same).forEach((k) => {
      if (!merged[k] && same[k]) merged[k] = same[k];
    });
    return merged;
  });
  (old || []).forEach((o) => {
    if (!out.some((item) => sameText(keyOf(o), keyOf(item)))) out.push(o);
  });
  return out;
}

// 重新解析 PDF 时：手填过的内容一律保留
function keepManualParts(parsed, old) {
  SIMPLE_FIELDS.forEach((key) => {
    if (!parsed[key] && old[key]) parsed[key] = old[key];
  });
  parsed.educationList = mergeList(parsed.educationList, educationOf(old), (e) => e.school);
  parsed.experienceList = mergeList(parsed.experienceList, old.experienceList, (e) => e.company);
  parsed.projectList = mergeList(parsed.projectList, projectsOf(old), (e) => e.name);
  parsed.awardList = mergeList(parsed.awardList, old.awardList, (e) => e.name);
  ['campusList', 'languageList', 'certList'].forEach((k) => {
    if (!(parsed[k] || []).length && (old[k] || []).length) parsed[k] = old[k];
  });
  setTopEdu(parsed);
}

function loadResume() {
  chrome.storage.local.get(['resume', 'pdfName'], (result) => {
    fillForm(result.resume || {});
    if (result.pdfName) {
      pdfHint.textContent = '当前文件：' + result.pdfName;
    }
  });
}

async function parseSelectedPdf() {
  const file = pdfInput.files && pdfInput.files[0];
  if (!file) {
    showToast('⚠️ 请先选择 PDF 文件', true);
    return;
  }

  parseBtn.disabled = true;
  parseBtn.textContent = '正在解析...';

  try {
    const buffer = await file.arrayBuffer();
    const text = await extractPdfText(buffer);
    if (!text || text.replace(/\s/g, '').length < 8) {
      showToast('⚠️ 未能读到文字，可能是扫描件图片 PDF', true);
      return;
    }

    const parsed = parseResumeText(text);
    chrome.storage.local.get('resume', (result) => {
      const old = result.resume || {};
      keepManualParts(parsed, old);
      fillForm(parsed);
      chrome.storage.local.set({ resume: Object.assign({}, old, parsed), pdfName: file.name }, () => {
        const jobs = (parsed.experienceList || []).length;
        const projs = (parsed.projectList || []).length;
        pdfHint.textContent = '已解析：' + file.name + '（实习/工作 ' + jobs + ' 段，项目 ' + projs + ' 个，请核对后保存）';
        showToast('✅ 已抽出 ' + jobs + ' 段经历、' + projs + ' 个项目，请核对、补全后点保存');
      });
    });
  } catch (error) {
    showToast('⚠️ 解析失败，请换一份可选中文字的 PDF', true);
  } finally {
    parseBtn.disabled = false;
    parseBtn.textContent = '解析 PDF';
  }
}

function saveResume(event) {
  event.preventDefault();
  chrome.storage.local.get('resume', (result) => {
    const old = result.resume || {};
    const resume = Object.assign({}, old, readForm());
    chrome.storage.local.set({ resume }, () => {
      showToast('✅ 已保存（教育 ' + resume.educationList.length + ' 段 / 经历 ' + resume.experienceList.length
        + ' 段 / 项目 ' + resume.projectList.length + ' 个 / 奖项 ' + resume.awardList.length + ' 项）');
    });
  });
}

// 先保存，再把简历同步给求职助手（后端只取白名单字段，隐私信息不会进入它的简历文件）
const syncBtn = document.getElementById('sync-btn');

async function syncToJobHunter() {
  if (!form.reportValidity()) return;
  syncBtn.disabled = true;
  syncBtn.textContent = '正在同步...';
  try {
    const { resume: old } = await chrome.storage.local.get('resume');
    const resume = Object.assign({}, old || {}, readForm());
    await chrome.storage.local.set({ resume });
    const r = await jobHunter('/api/resume/sync', { body: { resume }, timeout: 10000 });
    showToast('✅ ' + r.summary);
    if (r.changed && confirm(r.summary + '\n\n要让求职助手按新简历重新分析「待确认」岗位的匹配度吗？（会调用 AI，岗位多时需要几分钟）')) {
      const m = await jobHunter('/api/rematch', { body: { ids: null } });
      showToast(m.reset ? '✅ 已同步，' + m.reset + ' 个岗位正在后台重新分析' : '✅ 已同步，没有需要重新分析的岗位');
    }
  } catch (error) {
    showToast('⚠️ ' + error.message, true);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = '保存并同步到求职助手';
  }
}

document.addEventListener('DOMContentLoaded', loadResume);
parseBtn.addEventListener('click', parseSelectedPdf);
form.addEventListener('submit', saveResume);
syncBtn.addEventListener('click', syncToJobHunter);
