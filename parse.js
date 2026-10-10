function isCjk(ch) {
  return /[\u3400-\u9FFF\u3040-\u30FF\uF900-\uFAFF]/.test(ch);
}

function fontSizeOf(item) {
  return Math.abs(item.transform && item.transform[0]) || item.height || 12;
}

function xOf(item) {
  return item.transform[4];
}

function yOf(item) {
  return item.transform[5];
}

function needsSpace(left, right, gap, fontSize) {
  if (!left || !right) return false;
  if (isCjk(left) && isCjk(right)) return false;
  if (isCjk(left) && /[，。：:、；！？,.!?）」』】]/.test(right)) return false;
  if (/[，。：:、；！？,.!?（「『【]/.test(left) && isCjk(right)) return false;
  if (/[A-Za-z]/.test(left) && /[A-Za-z]/.test(right)) return gap > fontSize * 0.12;
  if (/\d/.test(left) && /\d/.test(right) && gap < fontSize * 0.2) return false;
  if (isCjk(left) && /[A-Za-z]/.test(right)) return gap > fontSize * 0.35;
  if (/[A-Za-z0-9]/.test(left) && isCjk(right)) return false;
  return gap > fontSize * 0.28;
}

/**
 * 同一行内按水平间距拼接：中文碎片不加空格，日期等右对齐块保留间隔
 */
function joinLineItems(items) {
  const sorted = [...items].sort((a, b) => xOf(a) - xOf(b));
  let out = '';
  let prev = null;

  for (const item of sorted) {
    const str = (item.str || '').replace(/\s+/g, ' ');
    if (!str.trim()) continue;
    if (!prev) {
      out = str;
      prev = item;
      continue;
    }

    const prevEnd = xOf(prev) + (prev.width || 0);
    const gap = xOf(item) - prevEnd;
    const size = fontSizeOf(item);
    const left = out.slice(-1);
    const right = str.trimStart()[0];

    if (gap > size * 1.6) {
      out += '  ' + str.trim();
    } else if (needsSpace(left, right, gap, size)) {
      out += ' ' + str.trim();
    } else {
      out += str.trim();
    }
    prev = item;
  }

  return out.replace(/[ \t]{2,}/g, '  ').trim();
}

/**
 * 从 PDF.js 文本项按视觉行还原
 */
function itemsToLines(items) {
  const usable = items.filter((item) => (item.str || '').trim());
  usable.sort((a, b) => {
    const dy = yOf(b) - yOf(a);
    if (Math.abs(dy) > 2) return dy;
    return xOf(a) - xOf(b);
  });

  const rows = [];
  let currentY = null;
  let row = [];

  for (const item of usable) {
    const size = fontSizeOf(item);
    const y = yOf(item);
    const threshold = Math.max(3.5, size * 0.32);
    if (currentY === null || Math.abs(y - currentY) <= threshold) {
      row.push(item);
      if (currentY === null) currentY = y;
    } else {
      rows.push(row);
      row = [item];
      currentY = y;
    }
  }
  if (row.length) rows.push(row);

  return rows.map((group) => {
    const text = joinLineItems(group);
    const maxFont = Math.max(...group.map(fontSizeOf));
    return { text, fontSize: maxFont };
  }).filter((line) => line.text);
}

function isSectionHeader(text) {
  return /^(个人优势|工作经历|实习经历|工作经验|实践经历|社会实践|校园经历|项目经历|项目经验|教育经历|教育背景|荣誉奖项|获奖情况|获奖经历|专业技能|技能特长|自我评价|个人简介|自我介绍|求职意向)[:：]?$/.test(text.trim());
}

function isJobOrSchoolLine(text) {
  const t = text.trim();
  if (t.length > 72 || t.length < 4) return false;
  if (/[。！？]$/.test(t)) return false;
  if (/\d{4}([./年-]\d{1,2})?(\s*[-–—~至到]|至今)/.test(t)) return true;
  if (/(有限公司|集团|大学|学院|部门)/.test(t) && t.length < 48) return true;
  return false;
}

function isBulletStart(text) {
  const t = text.trim();
  if (/^\d+\s*[\.、．]/.test(t)) return true;
  if (/^[\u4e00-\u9fa5A-Za-z0-9+（）()]{2,28}：/.test(t)) return true;
  return false;
}

/**
 * 把 PDF 纸面宽度造成的断行拼回段落，并在公司名 / 要点前真正换行
 */
function reflowLines(lineObjs) {
  const blocks = [];
  let acc = '';

  const flush = () => {
    if (acc) {
      blocks.push(acc);
      acc = '';
    }
  };

  for (const line of lineObjs) {
    const t = line.text.trim();
    if (!t) {
      flush();
      continue;
    }

    const header = isSectionHeader(t) || line.fontSize >= 18;
    const job = isJobOrSchoolLine(t) || (line.fontSize >= 15 && t.length < 48 && !/[。：]$/.test(t));
    const bullet = isBulletStart(t);

    if (header || job || bullet) {
      flush();
      if (header || job) blocks.push(t);
      else acc = t;
      continue;
    }

    if (!acc) acc = t;
    else acc += t;
  }
  flush();

  const out = [];
  for (const block of blocks) {
    if (isSectionHeader(block) || isJobOrSchoolLine(block)) {
      if (out.length) out.push('');
      out.push(block);
    } else {
      out.push(block);
    }
  }
  return out.join('\n');
}

/**
 * 读取 PDF 全部页面文本（仅文字层，扫描件图片无法识别）
 */
async function extractPdfText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({ disableCombineTextItems: true });
    allLines.push(...itemsToLines(content.items));
    if (pageNum < pdf.numPages) {
      allLines.push({ text: '', fontSize: 0 });
    }
  }

  return reflowLines(allLines);
}

function normalizeText(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseDateRange(line) {
  const patterns = [
    /(\d{4}[.．/年\-]\d{1,2})\s*[-–—~～至到]+\s*(\d{4}[.．/年\-]\d{1,2}|至今)/,
    /(\d{4})\s*[-–—~～至到]+\s*(\d{4}|至今)/
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) {
      return {
        start: m[1],
        end: m[2] === '至今' ? '至今' : m[2],
        raw: m[0]
      };
    }
  }
  return null;
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr === '至今') return '至今';
  const month = dateStr.match(/(\d{4})[.．/年\-](\d{1,2})/);
  if (month) return month[1] + '-' + month[2].padStart(2, '0');
  const year = dateStr.match(/^(\d{4})$/);
  if (year) return year[1];
  return dateStr;
}

function isSchoolLine(text) {
  return /(大学|学院|职业技术|学校)/.test(text) && !/(有限公司|集团)/.test(text);
}

function splitCompanyTitle(rest) {
  const cleaned = rest.replace(/\s+/g, ' ').trim();
  const titled = cleaned.match(/^(.*)\s+((?:TikTok|Tiktok|Temu|京东|天猫|社区|电商|商家|脚本)?[\u4e00-\u9fa5A-Za-z0-9]{0,16}(?:运营|经理|专员|助理|工程师|实习生|制作|撰写|产品|设计).*)$/i);
  if (titled) return { company: titled[1].trim(), title: titled[2].trim() };
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return { company: parts.slice(0, -1).join(' '), title: parts[parts.length - 1] };
  }
  return { company: cleaned, title: '' };
}

function isCompanyLine(text) {
  const t = text.trim();
  if (t.length > 80 || t.length < 3) return false;
  if (/[。！？;；]$/.test(t)) return false;
  if (t.includes('有限公司') || t.includes('集团') || t.includes('公司') || t.includes('工作室')) return true;
  return false;
}

function isJobTitleLine(text) {
  const t = text.trim();
  if (t.length > 40 || t.length < 2) return false;
  if (/[。！？;；]$/.test(t)) return false;
  if (/(实习生|工程师|产品经理|运营|专员|助理|顾问|经理|主管|分析师|设计师)/.test(t)) return true;
  return false;
}

function splitSectionBlocks(sectionText) {
  if (!sectionText) return [];
  const lines = sectionText.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks = [];
  let current = [];

  const isEntryStart = (line) => {
    if (parseDateRange(line)) return true;
    if (isCompanyLine(line)) return true;
    if (isJobTitleLine(line) && /\d{4}/.test(line)) return true;
    return false;
  };

  for (const line of lines) {
    if (isEntryStart(line)) {
      if (current.length) blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

/**
 * 抽出每段实习/工作经历：只在「工作/实习/实践」标题下收集，避免把项目、教育混进来
 */
function parseExperienceItems(text, headerRe = /工作|实习|实践/, startInside = true) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];
  let current = null;
  let pending = ''; // 日期上一行的「公司 职位」或「项目名 角色」
  let inWork = startInside;

  const flush = () => {
    if (current && pending) {
      current.description = current.description ? current.description + '\n' + pending : pending;
      pending = '';
    }
    if (current && (current.company || current.title || current.description)) {
      current.description = (current.description || '').trim();
      items.push(current);
    }
    current = null;
    pending = '';
  };

  for (const line of lines) {
    if (isSectionHeader(line)) {
      flush();
      inWork = headerRe.test(line);
      continue;
    }
    if (!inWork) continue;

    const date = parseDateRange(line);
    if (date) {
      const rest = line.replace(date.raw, ' ').replace(/\s+/g, ' ').trim();
      if (isSchoolLine(rest) || isSchoolLine(line)) {
        flush();
        continue;
      }
      const savedPending = pending;
      pending = '';
      flush();
      const split = splitCompanyTitle(rest || savedPending);
      current = {
        company: split.company,
        title: split.title,
        period: date.raw,
        start: normalizeDate(date.start),
        end: normalizeDate(date.end),
        description: ''
      };
      continue;
    }

    if (isCompanyLine(line) && line.length < 40 && !current) {
      current = { company: line, title: '', period: '', start: '', end: '', description: '' };
      pending = '';
      continue;
    }

    // 常见排版：上一行公司/项目名，下一行才是日期；多段时也先挂起，避免并进上一段描述
    if (line.length >= 2 && line.length <= 48 && !/[。！？;；]/.test(line)) {
      if (current && pending) {
        current.description = current.description ? current.description + '\n' + pending : pending;
      }
      pending = line;
      continue;
    }

    if (current) {
      if (pending) {
        current.description = current.description ? current.description + '\n' + pending : pending;
        pending = '';
      }
      current.description = current.description ? current.description + '\n' + line : line;
    }
  }
  flush();
  return items;
}

// 项目经历：只收「项目经历/项目经验」标题下的条目，首行拆成项目名 + 角色
function parseProjectItems(text) {
  const items = parseExperienceItems(text, /项目/, false).map((e) => ({
    name: e.company,
    title: e.title,
    start: e.start,
    end: e.end,
    description: e.description
  }));
  if (items.length) return items;

  // 没写日期的项目：首行当项目名（+角色），其余当描述
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const at = lines.findIndex((l) => isSectionHeader(l) && /项目/.test(l));
  if (at < 0) return [];
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (isSectionHeader(line)) break;
    body.push(line);
  }
  if (!body.length) return [];
  const head = body[0].length <= 48 ? splitCompanyTitle(body[0]) : { company: '', title: '' };
  return [{
    name: head.company,
    title: head.title,
    start: '',
    end: '',
    description: (head.company ? body.slice(1) : body).join('\n')
  }];
}

function parseEducationItems(text) {
  const items = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!isSchoolLine(line) || line.length > 60) continue;
    const date = parseDateRange(line);
    const degreeMatch = line.match(/(本科|硕士|博士|专科|大专|研究生|MBA|EMBA)/);
    if (!date && !degreeMatch) continue;
    const schoolMatch = line.match(/([\u4e00-\u9fa5A-Za-z]{2,20}(?:大学|学院))/);
    const majorMatch = line.match(/(?:本科|硕士|博士|专科|大专|研究生)\s+([\u4e00-\u9fa5A-Za-z]{2,16})/)
      || line.match(/专业[:：\s]*([\u4e00-\u9fa5]{2,12})/);
    const formMatch = line.match(/(非全日制|全日制)/);

    const item = {
      school: schoolMatch ? schoolMatch[1] : line,
      major: majorMatch ? majorMatch[1] : '',
      degree: degreeMatch ? degreeMatch[1] : '',
      start: date ? schoolMonth(normalizeDate(date.start), '09') : '',
      end: date ? schoolMonth(normalizeDate(date.end), '06') : '',
      form: formMatch ? formMatch[1] : ''
    };

    if (item.school) items.push(item);
  }

  if (items.length) return items;

  const blocks = splitSectionBlocks(pickSection(
    text,
    ['教育经历', '教育背景', '学习经历'],
    ['工作经历', '实习经历', '工作经验', '项目经历', '项目经验', '专业技能', '荣誉奖项']
  ));

  for (const block of blocks) {
    const schoolMatch = block.match(/([\u4e00-\u9fa5A-Za-z]{2,20}(?:大学|学院))/);
    const degreeMatch = block.match(/(本科|硕士|博士|专科|大专)/);
    const date = parseDateRange(block);
    if (!schoolMatch) continue;
    items.push({
      school: schoolMatch[1],
      major: '',
      degree: degreeMatch ? degreeMatch[1] : '',
      start: date ? schoolMonth(normalizeDate(date.start), '09') : '',
      end: date ? schoolMonth(normalizeDate(date.end), '06') : '',
      form: ''
    });
  }
  return items;
}

// 简历只写年份时，按惯例补入学 9 月 / 毕业 6 月，选项页里可改
function schoolMonth(value, month) {
  return /^\d{4}$/.test(value) ? value + '-' + month : value;
}

function parseAwardItems(text) {
  const section = pickSection(
    text,
    ['荣誉奖项', '获奖情况', '获奖经历'],
    ['教育经历', '工作经历', '实习经历', '项目经历', '专业技能', '自我评价', '个人优势']
  );
  if (!section) return [];
  const body = section.split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !parseDateRange(line))
    .join('；');
  return body.split(/[；;]/).map((part) => part.replace(/荣誉奖项/g, '').trim()).filter(Boolean).map(splitAwardLine);
}

// 「2023.05 校级一等奖学金」→ 名称 + 时间
function splitAwardLine(line) {
  const m = line.match(/(\d{4})\s*[.．/年\-]\s*(\d{1,2})\s*月?/);
  const name = (m ? line.replace(m[0], ' ') : line).replace(/^[\s,，、|｜:：-]+|[\s,，、|｜:：-]+$/g, '').trim();
  return {
    name,
    level: (name.match(/国家级|省级|市级|校级|院级/) || [''])[0],
    date: m ? m[1] + '-' + m[2].padStart(2, '0') : ''
  };
}

function pickSection(text, titles, nextTitles) {
  const lines = text.split('\n');
  const isTitle = (line, list) => list.some((title) => {
    const t = line.trim();
    return t === title || t === title + ':' || t === title + '：';
  });

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isTitle(lines[i], titles)) {
      start = i;
      break;
    }
  }
  if (start < 0) return '';

  let from = start;
  while (from > 0) {
    const prev = lines[from - 1].trim();
    if (!prev) {
      from -= 1;
      continue;
    }
    if (isTitle(prev, nextTitles) || isTitle(prev, titles) || isSectionHeader(prev)) break;
    if (isJobOrSchoolLine(prev)) {
      from -= 1;
      continue;
    }
    break;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isTitle(lines[i], nextTitles)) {
      end = i;
      break;
    }
  }

  return lines
    .slice(from, end)
    .filter((line) => !isTitle(line, titles))
    .join('\n')
    .trim();
}

/**
 * 从简历纯文本里启发式抽出常用字段
 */
function parseResumeText(text) {
  const compact = normalizeText(text);
  const resume = {
    name: '',
    phone: '',
    email: '',
    school: '',
    major: '',
    education: '',
    experience: '',
    projects: '',
    skills: '',
    summary: '',
    rawText: compact,
    experienceList: [],
    projectList: [],
    educationList: [],
    awardList: [],
    gender: '',
    expectedCity: '',
    degree: '',
    studyForm: ''
  };

  const emailMatch = compact.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (emailMatch) resume.email = emailMatch[0];

  const phoneMatch = compact.match(/1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/);
  if (phoneMatch) resume.phone = phoneMatch[0].replace(/[\s-]/g, '');

  const nameLabeled = compact.match(/姓名[:：\s]*([\u4e00-\u9fa5]{2,4})/);
  if (nameLabeled) {
    resume.name = nameLabeled[1];
  } else {
    const firstLine = compact.split('\n').map((l) => l.trim()).find(Boolean) || '';
    const maybeName = firstLine.match(/^([\u4e00-\u9fa5]{2,4})(?:\s|$)/);
    if (maybeName && !/简历|个人|求职/.test(maybeName[1])) {
      resume.name = maybeName[1];
    }
  }

  const schoolLabeled = compact.match(/(?:毕业院校|就读院校|学校|院校)[:：\s]*([^\n，,]{2,30})/);
  const schoolWord = compact.match(/([\u4e00-\u9fa5A-Za-z]{2,20}(?:大学|学院|职业技术学院|科技大学|理工大学|师范大学))/);
  if (schoolLabeled) {
    resume.school = schoolLabeled[1].replace(/专业.*/, '').trim();
  } else if (schoolWord) {
    resume.school = schoolWord[1];
  }

  const majorLabeled = compact.match(/(?:所学专业|专业名称|专业)[:：]\s*([^\n，,]{2,20})/);
  if (majorLabeled) {
    resume.major = majorLabeled[1].replace(/学历.*/, '').trim();
  } else {
    const majorLine = compact.match(/大学[^\n]*?(本科|硕士|博士)?[^\n]*?([\u4e00-\u9fa5]{2,12})(?:\s+\d{4})?/);
    if (majorLine && !/荣誉|奖/.test(majorLine[2])) {
      const candidate = compact.match(/本科\s+([\u4e00-\u9fa5]{2,12})/);
      if (candidate) resume.major = candidate[1];
    }
  }

  const sectionHeads = [
    '教育经历', '教育背景', '学习经历',
    '工作经历', '实习经历', '工作经验',
    '项目经历', '项目经验',
    '专业技能', '技能特长', '掌握技能',
    '自我评价', '个人简介', '自我介绍', '个人总结',
    '个人优势', '荣誉奖项'
  ];

  resume.education = pickSection(
    compact,
    ['教育经历', '教育背景', '学习经历'],
    sectionHeads.filter((s) => !s.includes('教育') && !s.includes('学习'))
  );
  const honors = pickSection(compact, ['荣誉奖项'], sectionHeads.filter((s) => s !== '荣誉奖项'));
  if (honors) {
    resume.education = [resume.education, '荣誉奖项', honors].filter(Boolean).join('\n');
  }

  resume.experience = pickSection(
    compact,
    ['工作经历', '实习经历', '工作经验'],
    sectionHeads.filter((s) => !s.includes('工作') && !s.includes('实习'))
  );
  resume.projects = pickSection(
    compact,
    ['项目经历', '项目经验'],
    sectionHeads.filter((s) => !s.includes('项目'))
  );
  resume.skills = pickSection(
    compact,
    ['专业技能', '技能特长', '掌握技能'],
    sectionHeads.filter((s) => !s.includes('技能'))
  );
  resume.summary = pickSection(
    compact,
    ['自我评价', '个人简介', '自我介绍', '个人总结', '个人优势'],
    sectionHeads.filter((s) => !/自我|个人简介|个人总结|个人优势/.test(s))
  );

  if (!resume.education && resume.school) {
    resume.education = [resume.school, resume.major].filter(Boolean).join(' ');
  }

  resume.experienceList = parseExperienceItems(compact);
  resume.projectList = parseProjectItems(compact);
  resume.educationList = parseEducationItems(compact);
  resume.awardList = parseAwardItems(compact);

  if (resume.educationList[0]) {
    const edu = resume.educationList[0];
    resume.school = edu.school || resume.school;
    resume.major = edu.major || resume.major;
    resume.degree = edu.degree;
    resume.studyForm = edu.form;
    resume.eduStart = edu.start;
    resume.eduEnd = edu.end;
  }

  const genderMatch = compact.match(/(?:^|\n|[|｜])\s*(男|女)\s*(?:[|｜]|$)/m)
    || compact.match(/性别[:：\s]*(男|女)/);
  if (genderMatch) resume.gender = genderMatch[1];

  const birthMatch = compact.match(/出生(?:日期|年月)?[:：\s]*(\d{4})[.\-/年](\d{1,2})(?:[.\-/月](\d{1,2}))?/)
    || compact.match(/(\d{4})[.\-/年](\d{1,2})(?:[.\-/月](\d{1,2}))?日?\s*出生/);
  if (birthMatch) {
    resume.birth = birthMatch[1] + '-' + birthMatch[2].padStart(2, '0')
      + (birthMatch[3] ? '-' + birthMatch[3].padStart(2, '0') : '');
  }

  const hukouMatch = compact.match(/(?:户口所在地|户籍所在地|户口|户籍)[:：\s]*([\u4e00-\u9fa5]{2,20})/);
  if (hukouMatch) resume.hukou = hukouMatch[1];

  const cityMatch = compact.match(/期望城市[:：]\s*([\u4e00-\u9fa5]{2,10})/);
  if (cityMatch) resume.expectedCity = cityMatch[1];

  return resume;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseResumeText,
    extractPdfText,
    normalizeText,
    parseDateRange,
    normalizeDate,
    parseExperienceItems,
    parseEducationItems,
    parseAwardItems,
    pickSection
  };
}
