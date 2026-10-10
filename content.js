(() => {
  // 重新加载扩展后，页面里可能还留着旧版脚本：版本号不同就用新代码覆盖
  const VERSION = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : 'dev';
  if (window.__resumeAutofillFill && window.__resumeAutofillVersion === VERSION) return;
  window.__resumeAutofillVersion = VERSION;

  // 基本信息：标签关键词 → 简历字段（同一控件取最长命中的关键词）
  const BASIC_DICT = {
    name: ['真实姓名', '中文姓名', '姓名', 'fullname', 'full name'],
    gender: ['性别', 'gender'],
    phone: ['手机号码', '手机号', '移动电话', '联系电话', '电话号码', '联系方式', '手机', 'mobile', 'phone'],
    address: ['通信地址', '通讯地址', '联系地址', '详细地址', '邮寄地址', '居住地址'],
    email: ['电子邮箱', '电子邮件', '邮箱', 'e-mail', 'email'],
    birth: ['出生日期', '出生年月', '生日', 'birthday'],
    hukou: ['户口所在地', '户籍所在地', '户口所在城市', '户籍地址', '户口地址', '户籍地', '籍贯', '生源地', '户口', '户籍'],
    currentCity: ['现居地', '现居住地', '现居住城市', '现居城市', '目前所在城市', '现住址', '现居住地址'],
    lastPinyin: ['姓全拼', '姓拼音', '姓氏拼音', '姓（拼音', 'last name', 'surname'],
    firstPinyin: ['名全拼', '名拼音', '名（拼音', 'first name', 'given name'],
    nationality: ['国籍', 'nationality'],
    wechat: ['微信号', '微信', 'qq'],
    homepage: ['个人主页', '个人网站', '个人博客', 'github'],
    portfolio: ['作品链接', '作品集', '作品地址'],
    englishName: ['英文名', '英文姓名', 'english name'],
    ethnicity: ['民族'],
    politics: ['政治面貌'],
    marital: ['婚姻状况', '婚姻状态', '婚否'],
    workYears: ['工作年限', '工作经验年限', '参加工作年限', '工作年数'],
    idType: ['证件类型'],
    idNumber: ['身份证号码', '身份证号', '证件号码', '证件号'],
    gradYear: ['毕业届别', '应届届别', '届别', '毕业年份'],
    availableDate: ['最快到岗时间', '可到岗时间', '到岗时间', '可入职时间', '预计入职时间', '最早入职时间'],
    internDays: ['每周实习天数', '每周可实习天数', '每周出勤天数', '每周可实习', '实习天数'],
    internMonths: ['可实习时长', '实习时长', '实习周期', '可实习月数'],
    expectedSalary: ['期望薪资', '期望薪酬', '期望月薪', '薪资要求', '期望工资'],
    expectedJob: ['意向岗位', '应聘岗位', '期望岗位', '意向职位', '期望职位', '求职意向'],
    englishLevel: ['英语水平', '英语等级', '外语水平', '英语四六级', '四六级'],
    expectedCity: ['意向工作地点', '期望工作城市', '期望工作地点', '期望城市', '意向城市'],
    school: ['毕业院校', '就读院校', '学校名称', '院校名称', '院校', '学校'],
    major: ['所学专业', '专业名称', '专业'],
    degree: ['最高学历', '学历'],
    academicDegree: ['最高学位', '学位'],
    studyForm: ['学习形式', '培养方式', '攻读方式', '教育类型'],
    skills: ['专业技能', '技能特长', '技能'],
    summary: ['自我评价', '自我介绍', '自我描述', '个人简介', '个人优势', '评价内容', '个人评价']
  };

  const EXP_DICT = {
    company: ['单位名称', '公司名称', '企业名称', '用人单位', '实习单位', '工作单位', '实习公司', '所在公司', '公司', '组织名称', '实践单位'],
    department: ['所在部门', '任职部门', '部门名称', '部门'],
    title: ['实习岗位', '实习职位', '担任职位', '职位名称', '岗位名称', '职位', '岗位', '职务', '角色'],
    start: ['开始时间', '开始日期', '起始时间', '入职时间', '实习开始', '就读时间', '项目时间'],
    end: ['结束时间', '结束日期', '终止时间', '离职时间', '实习结束', '毕业时间', '项目时间'],
    description: ['实习内容', '工作内容', '工作描述', '职责描述', '内容描述', '主要职责', '工作职责', '实习职责', '岗位职责', '职责', '项目描述', '项目内容', '项目职责', '描述'],
    industry: ['所在行业', '所属行业', '公司行业', '行业类别', '行业'],
    jobType: ['工作性质', '工作类型', '职位性质', '实习性质'],
    location: ['工作地点', '工作城市', '实习地点', '实习城市']
  };

  const PROJECT_DICT = {
    name: ['项目名称', '项目主题', '课题名称', '作品名称'],
    company: ['项目单位', '实践单位', '所在单位', '单位名称'],
    title: ['项目角色', '担任角色', '项目职责', '角色'],
    start: ['项目时间', '开始时间', '起始时间', '开始日期'],
    end: ['项目时间', '结束时间', '终止时间', '结束日期'],
    description: ['项目描述', '项目内容', '项目职责', '项目介绍', '项目成果', '主要职责', '内容描述', '描述']
  };

  const EDU_DICT = {
    school: ['毕业院校', '就读院校', '学校名称', '院校名称', '院校', '学校'],
    major: ['所学专业', '专业名称', '专业'],
    degree: ['最高学历', '学历'],
    academicDegree: ['最高学位', '学位'],
    form: ['学习形式', '培养方式', '攻读方式', '教育类型'],
    college: ['学院名称', '所在学院', '所在院系', '院系名称', '院系', '学院'],
    schoolCity: ['学校所在地', '学校所在城市', '院校所在地', '院校所在城市'],
    gpa: ['gpa', '绩点', '平均学分绩', '平均成绩'],
    rank: ['专业排名', '成绩排名', '年级排名', '排名'],
    courses: ['主修课程', '核心课程', '主要课程', '相关课程'],
    start: ['入学时间', '入学日期', '就读时间', '开始时间', '起始时间'],
    end: ['毕业时间', '毕业日期', '结束时间', '终止时间']
  };

  const AWARD_DICT = {
    name: ['获奖项', '奖项名称', '获奖名称', '荣誉名称', '获得奖项', '荣誉称号', '奖励名称', '奖项'],
    level: ['获奖级别', '奖项级别', '级别'],
    date: ['获奖时间', '获奖日期']
  };

  const CAMPUS_DICT = {
    company: ['组织名称', '社团名称', '学生组织', '所在组织', '组织/社团', '社团', '组织', '单位名称'],
    title: ['担任职务', '担任职位', '职务', '职位', '角色'],
    start: ['开始时间', '开始日期', '起始时间'],
    end: ['结束时间', '结束日期', '终止时间'],
    description: ['经历描述', '主要工作', '工作内容', '经历内容', '内容描述', '职责描述', '描述', '职责']
  };

  const LANG_DICT = {
    language: ['语种', '外语语种', '语言类型', '语言名称', '语言'],
    level: ['掌握程度', '熟练程度', '精通程度', '语言水平', '语言等级', '水平', '程度'],
    cert: ['证书名称', '语言证书', '考试类型', '考试名称', '证书'],
    score: ['考试成绩', '成绩', '分数', '得分']
  };

  const SKILL_DICT = {
    name: ['技能名称', '技能类型', '技能项'],
    level: ['熟练程度', '掌握程度', '精通程度', '程度', '水平']
  };

  const CERT_DICT = {
    name: ['证书名称', '资格证书', '证书'],
    date: ['获得时间', '获证时间', '取得时间', '颁发时间', '发证时间', '获得日期']
  };

  function mergeDicts(...dicts) {
    const out = {};
    for (const d of dicts) {
      for (const [k, words] of Object.entries(d)) {
        out[k] = (out[k] || []).concat(words.filter((w) => !(out[k] || []).includes(w)));
      }
    }
    return out;
  }
  const COMBINED_DICT = mergeDicts(EXP_DICT, PROJECT_DICT);
  const ALL_DICT = mergeDicts(BASIC_DICT, EDU_DICT, EXP_DICT, PROJECT_DICT, AWARD_DICT);

  // 可重复的区块：标题、「添加」按钮文案、字段词典、每条记录的首字段
  const SECTIONS = {
    // 「添加」文案前面常带图标字符（如 ⊞、iconfont 私有字符），所以不锚定开头
    edu: { titles: ['教育经历', '教育背景', '学习经历'], add: /(添加|新增)(教育|学习)(经历|背景)/, dict: EDU_DICT, first: 'school' },
    exp: { titles: ['实习经历', '实习经验', '实习/工作经历', '工作/实习经历', '实习及工作经历', '实习工作经历', '工作实习经历'], add: /(添加|新增)(实习|实习\/工作|工作\/实习)(经历|经验)?/, dict: EXP_DICT, first: 'company' },
    work: { titles: ['工作经历', '工作经验'], add: /(添加|新增)工作(经历|经验)?/, dict: EXP_DICT, first: 'company' },
    project: { titles: ['项目经历', '项目经验', '项目实践', '项目作品'], add: /(添加|新增)项目(经历|经验|作品|实践)?/, dict: PROJECT_DICT, first: 'name' },
    combined: { titles: ['实习及项目经历', '实习/项目经历', '实习与项目经历'], add: /(添加|新增)(实习项目|实习及项目|项目实习|实习\/项目)(经历|经验)?/, dict: COMBINED_DICT, first: 'company' },
    award: { titles: ['获奖', '获奖情况', '获奖经历', '荣誉奖项', '奖励荣誉', '奖励荣誉', '奖励情况', '获奖信息', '奖惩情况', '荣誉奖励', '获奖记录', '所获荣誉', '荣誉情况', '在校获奖'], add: /(添加|新增)(获奖|奖项|荣誉|奖励|奖惩)/, dict: AWARD_DICT, first: 'name' },
    campus: { titles: ['校园经历', '在校经历', '学生工作', '社团经历', '学生干部经历', '校内实践', '社会实践', '在校任职', '校内职务', '社团活动', '学生干部', '校园活动'], add: /(添加|新增)(校园|在校|学生工作|学生干部|社团|实践|任职)(经历)?/, dict: CAMPUS_DICT, first: 'company' },
    lang: { titles: ['语言能力', '外语能力', '语言水平', '英语能力', '外语水平'], add: /(添加|新增)(语言|外语|英语)/, dict: LANG_DICT, first: 'language' },
    cert: { titles: ['证书', '资格证书', '技能证书', '证书情况', '获得证书', '证书信息', '职业资格证书'], add: /(添加|新增)证书/, dict: CERT_DICT, first: 'name' },
    skill: { titles: ['专业技能', '技能特长', '个人技能', '技能'], add: /(添加|新增)(专业)?技能/, dict: SKILL_DICT, first: 'name' },
    // 飞书等：自我评价是一个要先点「添加」才出现输入框的区块
    summary: { titles: ['自我评价', '个人评价', '自我描述'], add: /(添加|新增)(自我评价|个人评价|自我描述)/, dict: { summary: BASIC_DICT.summary }, first: 'summary' }
  };

  const ALL_SECTION_TITLES = [
    '上传简历', '投递意向', '求职意向', '个人信息', '基本信息', '个人基本信息',
    '附件', '附件信息', '附加问题', '自我评价', '个人评价', '其他信息', '证件信息',
    ...Object.values(SECTIONS).flatMap((s) => s.titles)
  ];
  const GENERIC_ADD = /^[+＋]?(添加|新增|继续添加)$/;
  const SKIP_LABEL = /验证码|密码|captcha|搜索|search|推荐码|内推码|紧急|联系人|父亲|母亲|家庭/i;
  const DATE_KEYS = new Set(['birth', 'start', 'end', 'date', 'availableDate']);
  const AREA_KEYS = new Set(['hukou', 'expectedCity', 'currentCity', 'schoolCity']);

  const ITEM_SEL = '.ant-form-item, .el-form-item, .arco-form-item, .ivu-form-item, .n-form-item, .ud-formily-item, .form-item, .form-group, [class*="form-item"], [class*="formItem"], [class*="field-item"]';
  const LABEL_SEL = 'label, .ant-form-item-label, .el-form-item__label, .arco-form-label-item, .ivu-form-item-label, [class*="label"]';
  const DATE_WRAP = '.ant-picker, .ant-calendar-picker, .el-date-editor, .el-picker, .arco-picker, .ivu-date-picker, .n-date-picker, [class*="date-picker"], [class*="datepicker"], [class*="DatePicker"], [class*="DatePicker"], [class*="picker-input"]';
  const SELECT_WRAP = '.ant-select, .ant-cascader-picker, .el-select, .el-cascader, .arco-select, .arco-cascader, .ivu-select, .ivu-cascader, .n-select, .n-cascader, [class*="select"], [class*="Select"], [class*="cascader"], [class*="Cascader"]';
  const OPTION_SEL = '[role="option"], [role="menuitem"], [role="treeitem"], .ant-select-item-option, .ant-cascader-menu-item, .el-select-dropdown__item, .el-cascader-node, .el-autocomplete-suggestion li, .arco-select-option, .arco-cascader-list-item, .ivu-select-item, .ud__select__list__item, .ud__select__list__item, .ivu-cascader-menu-item, .n-base-select-option, [class*="option"], [class*="dropdown"] li, [class*="menu-item"], [class*="suggest"] li, [class*="Select"] li, [class*="select-item"]';
  const PANEL_SEL = '.ant-picker-dropdown, .ant-calendar-picker-container, .el-picker-panel, .el-popper, .arco-picker-container, .ivu-picker-panel-body, [class*="picker-panel"], [class*="picker-dropdown"], [class*="picker-popup"], [class*="calendar"], [class*="DatePicker"], [class*="datepicker"], [class*="month-table"], [class*="year-table"]';
  const PREV_YEAR = ['.ant-picker-header-super-prev-btn', '.ant-calendar-prev-year-btn', '.el-icon-d-arrow-left', '.arco-picker-header-icon-super-prev', '[class*="super-prev"]', '[class*="prev-year"]', '[aria-label*="上一年"]', '[title*="上一年"]'];
  const NEXT_YEAR = ['.ant-picker-header-super-next-btn', '.ant-calendar-next-year-btn', '.el-icon-d-arrow-right', '.arco-picker-header-icon-super-next', '[class*="super-next"]', '[class*="next-year"]', '[aria-label*="下一年"]', '[title*="下一年"]'];
  const PREV_MONTH = ['.ant-picker-header-prev-btn', '.ant-calendar-prev-month-btn', '.el-icon-arrow-left', '.arco-picker-header-icon-prev', '[class*="prev-month"]', '[aria-label*="上个月"]', '[title*="上个月"]'];
  const NEXT_MONTH = ['.ant-picker-header-next-btn', '.ant-calendar-next-month-btn', '.el-icon-arrow-right', '.arco-picker-header-icon-next', '[class*="next-month"]', '[aria-label*="下个月"]', '[title*="下个月"]'];
  const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // 去掉空白、星号、冒号，以及图标字符（⊕⊞□ 等符号、iconfont 私有区字符）
  const norm = (s) => String(s || '').replace(/[\s*＊:：\u2295-\u22A1\u25A0-\u25FF\u2610-\u2612\uE000-\uF8FF]/g, '');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(check, timeout, step) {
    const end = Date.now() + (timeout || 1000);
    while (Date.now() < end) {
      const value = check();
      if (value) return value;
      await sleep(step || 60);
    }
    return check();
  }

  function isShown(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // a 在文档顺序上位于 b 之前
  function precedes(a, b) {
    return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  // 模拟一次真实点击：各 UI 库分别监听 pointerdown / mousedown / click
  function press(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) { /* 旧环境无 PointerEvent */ }
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) { /* 同上 */ }
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', opts));
  }

  // 有些组件的勾选框只在鼠标悬停时才响应
  function hover(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent('pointerover', opts)); } catch (e) { /* 旧环境无 PointerEvent */ }
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
  }

  function pressKey(el, name) {
    const codes = { Enter: 13, Escape: 27 };
    const opts = { key: name, code: name, keyCode: codes[name], which: codes[name], bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  // 点页面空白处收起弹层（不用 Esc，避免关掉网申页本身的弹窗）
  function clickOutside(el) {
    press(document.body);
    if (el && typeof el.blur === 'function') el.blur();
    // Ant v3 下拉靠搜索框失焦才收起，点空白处没用
    const active = document.activeElement;
    if (active && active !== document.body && active.closest && active.closest(SELECT_WRAP) && !active.closest(DATE_WRAP)) {
      pressKey(active, 'Escape');
      active.blur();
    }
  }

  // 走原生 value setter，React / Vue 受控输入框才能感知到变化
  function nativeSet(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function highlight(el) {
    if (!el || !el.style) return;
    const prev = el.style.boxShadow;
    el.style.boxShadow = '0 0 0 2px #c4451f';
    setTimeout(() => {
      el.style.boxShadow = prev;
    }, 1500);
  }

  const cleanLabel = (t) => String(t || '').replace(/[*＊]/g, '').replace(/\s+/g, ' ').trim();
  const okLabel = (t) => !!t && t.length <= 20 && !/^请(选择|输入|填写)/.test(t);

  /**
   * 找控件对应的标签文字：表单项 label → label[for] → 左侧相邻文字 → aria-label → placeholder
   */
  function labelOf(el) {
    // 飞书招聘（*.jobs.feishu.cn）把字段名直接写在属性上，控件外面套了 7 层，按层级找不到
    const named = el.closest('[data-form-field-i18n-name]');
    if (named && okLabel(cleanLabel(named.getAttribute('data-form-field-i18n-name')))) {
      return cleanLabel(named.getAttribute('data-form-field-i18n-name'));
    }

    let item = el.closest(ITEM_SEL);
    for (let i = 0; item && i < 4; i += 1) {
      const labels = [...item.querySelectorAll(LABEL_SEL)]
        .filter((n) => !n.contains(el) && precedes(n, el) && okLabel(cleanLabel(n.textContent)));
      if (labels.length) return cleanLabel(labels[labels.length - 1].textContent);
      item = item.parentElement && item.parentElement.closest(ITEM_SEL);
    }

    if (el.id) {
      try {
        const byFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (byFor && okLabel(cleanLabel(byFor.textContent))) return cleanLabel(byFor.textContent);
      } catch (e) { /* 非法 id */ }
    }

    let node = el;
    for (let i = 0; i < 3 && node; i += 1) {
      let sib = node.previousElementSibling;
      while (sib && !cleanLabel(sib.textContent)) sib = sib.previousElementSibling;
      if (sib) {
        const t = cleanLabel(sib.textContent);
        if (okLabel(t)) return t;
        break;
      }
      node = node.parentElement;
    }

    const aria = cleanLabel(el.getAttribute('aria-label'));
    if (okLabel(aria)) return aria;
    const ph = cleanLabel(el.placeholder).replace(/^请(选择|输入|填写)(您的|你的)?/, '');
    if (ph && ph.length <= 20) return ph;

    // 网申页常见：标签在同一格子的上方或左侧，控件本身套了好几层
    let up = el;
    for (let i = 0; i < 6 && up && up.parentElement; i += 1) {
      const parent = up.parentElement;
      const kids = [...parent.children];
      const idx = kids.indexOf(up);
      if (idx > 0) {
        for (let j = idx - 1; j >= 0; j -= 1) {
          const t = cleanLabel(kids[j].innerText);
          if (okLabel(t) && t.length <= 8) return t;
        }
      }
      if (kids.length >= 2 && kids[0] !== up && !kids[0].contains(el)) {
        const t = cleanLabel(kids[0].innerText);
        if (okLabel(t) && t.length <= 8) return t;
      }
      up = parent;
    }
    return cleanLabel(el.name || '');
  }

  function matchKey(label, dict) {
    if (!label || SKIP_LABEL.test(label)) return null;
    const lower = label.toLowerCase();
    let bestKey = null;
    let bestLen = 0;
    for (const [key, words] of Object.entries(dict)) {
      for (const word of words) {
        if (!lower.includes(word.toLowerCase()) || word.length <= bestLen) continue;
        // 「学校所在地」里有「学校」，但不能当成学校名称
        if (key === 'school' && /所在地|地址|类型|性质/.test(label)) continue;
        // 「姓名」不要误匹配学校/公司；「奖项名称」要留给获奖区块，所以带奖且不像奖项的才排除
        if (key === 'name' && /(花名|昵称|学校|单位|公司|游戏|专业|学院)/.test(label)) continue;
        if (key === 'name' && /奖/.test(label) && !/奖项|获奖|荣誉|奖励/.test(label)) continue;
        if (key === 'hukou' && /类型|性质/.test(label)) continue;
        if (key === 'title' && /调剂/.test(label)) continue;
        // 「最高学历专业」「最高学历毕业时间」不是学历本身
        if (key === 'degree' && /专业|时间|日期|学校|院校|年份/.test(label)) continue;
        if (key === 'major' && /第二|辅修|双学位|双专业/.test(label)) continue;
        bestKey = key;
        bestLen = word.length;
      }
    }
    return bestKey;
  }

  const RANGE_SEL = '.ant-picker-range, .el-date-editor--daterange, .el-date-editor--monthrange, .el-date-editor--datetimerange, [class*="RangePicker"], [class*="picker-range"], [class*="range-picker"]';
  const rangeInputsOf = (range) => [...range.querySelectorAll('input')].filter((n) => !['hidden', 'button', 'checkbox', 'radio'].includes((n.type || '').toLowerCase()));

  // 范围框的外壳：飞书的起止两个框各自也带 range-picker 类名，要往上找到同时包住两个框的那层
  function rangeRoot(el) {
    for (let r = el.closest(RANGE_SEL); r; r = r.parentElement && r.parentElement.closest(RANGE_SEL)) {
      if (rangeInputsOf(r).length >= 2) return r;
    }
    return null;
  }

  // 日期范围框（起止时间）左右两个 input 分别是开始 / 结束
  function rangeKey(el) {
    const range = rangeRoot(el);
    if (!range) return null;
    const inputs = rangeInputsOf(range);
    const i = inputs.indexOf(el);
    if (i === 0) return 'start';
    if (i === 1) return 'end';
    return null;
  }

  function controlKey(el, dict) {
    const rk = rangeKey(el);
    if (rk && dict[rk]) return rk;
    const label = labelOf(el);
    const ph = cleanLabel(el.placeholder).replace(/^请(选择|输入|填写)(您的|你的)?/, '');
    return matchKey(label, dict) || matchKey(ph, dict);
  }

  const isEditable = (el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  const isDateControl = (el) => el.type === 'date' || el.type === 'month' || !!el.closest(DATE_WRAP);
  const isSelectControl = (el) => el.tagName === 'SELECT' || !!el.closest(SELECT_WRAP)
    || (el.readOnly && /请选择/.test(el.placeholder || ''))
    || (!isEditable(el) && /请选择/.test(norm(el.textContent)) && norm(el.textContent).length < 12);

  function usable(el) {
    if (!el || el.disabled) return false;
    if (el.tagName === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      if (['submit', 'button', 'file', 'password', 'image', 'reset', 'checkbox', 'radio', 'range', 'color'].includes(t)) return false;
      if (t === 'hidden') {
        const wrap = el.closest(DATE_WRAP + ',' + SELECT_WRAP);
        return !!wrap && isShown(wrap);
      }
    }
    if (isShown(el)) return true;
    const wrap = el.closest(DATE_WRAP + ',' + SELECT_WRAP);
    return !!wrap && isShown(wrap);
  }

  // 按类名逐个判断：外层布局的「ant-layout-has-sider」只说明页面带侧栏，里面的表单不是导航
  const NAV_CLASS = /anchor|sider|sidebar|nav-?item|menu-?item/i;
  const NOT_NAV_CLASS = /has-?sider/i;
  function isNavChrome(el) {
    if (el.closest('nav, aside, header, footer')) return true;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cls = typeof n.className === 'string' ? n.className : (n.className && n.className.baseVal) || '';
      if (cls && cls.split(/\s+/).some((c) => NAV_CLASS.test(c) && !NOT_NAV_CLASS.test(c))) return true;
    }
    return false;
  }

  // 找文案最短、且可见的可点击节点（用来点「添加实习经历」）
  function findClickable(re, root) {
    const scope = root || document.body;
    const nodes = [...scope.querySelectorAll('button, a, span, div, p, li, i, [role="button"]')];
    let best = null;
    let bestLen = Infinity;
    for (const el of nodes) {
      const quick = norm(el.textContent);
      if (!quick || quick.length > 16 || !re.test(quick)) continue;
      if (!isShown(el) || isNavChrome(el)) continue;
      const raw = quick;
      if (raw.length < bestLen) {
        best = el;
        bestLen = raw.length;
      }
    }
    return best && (best.closest('button, a, [role="button"]') || best);
  }

  function allControls() {
    const seen = new Set();
    const list = [];
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      list.push(el);
    };
    [...document.querySelectorAll('input, textarea, select')].filter(usable).forEach(add);

    // 自定义日期 / 下拉有时整块是 div，没有可用的 input（Ant v3 可搜索下拉的搜索框平时是隐藏的）：
    // 取最外层那一块；包着好几个下拉的外壳（省 / 市并排）不算，让里面的下拉各自算一个
    const hasUsableInput = (el) => [...el.querySelectorAll('input, textarea, select')].some(usable);
    const multi = (el) => el.querySelectorAll('[role="combobox"]').length >= 2;
    const wraps = [...document.querySelectorAll(DATE_WRAP + ',' + SELECT_WRAP)]
      .filter((el) => isShown(el) && !isNavChrome(el) && !hasUsableInput(el) && !multi(el));
    for (const el of wraps) {
      const outer = el.parentElement && el.parentElement.closest(DATE_WRAP + ',' + SELECT_WRAP);
      if (outer && !multi(outer) && (wraps.includes(outer) || hasUsableInput(outer))) continue;
      if (norm(el.innerText).length > 20) continue;
      add(el);
    }
    return list.sort((a, b) => (a === b ? 0 : precedes(a, b) ? -1 : 1));
  }

  function visibleOptions() {
    return [...document.querySelectorAll(OPTION_SEL)].filter((n) => {
      const t = norm(n.textContent);
      return t && t.length <= 80 && isShown(n);
    });
  }

  const newOptions = (before) => visibleOptions().filter((n) => !before.has(n));

  // 兜底：自定义组件的选项类名千奇百怪，就比较点击前后「新出现的短文字叶子节点」
  function visibleLeaves() {
    return [...document.body.querySelectorAll('li, span, div, td, a, p, em, b')].filter((n) => {
      if (n.childElementCount > 0) return false;
      const t = norm(n.textContent);
      return t && t.length <= 30 && n.getClientRects().length > 0;
    });
  }

  const snapshot = () => ({ opts: new Set(visibleOptions()), leaves: new Set(visibleLeaves()) });

  function freshCands(snap, el) {
    const opts = visibleOptions().filter((n) => !snap.opts.has(n));
    if (opts.length) return opts;
    const leaves = visibleLeaves().filter((n) => !snap.leaves.has(n) && !(el && el.contains(n)));
    return leaves.length >= 2 ? leaves : [];
  }

  // 新出现节点的最近公共祖先，当作弹出层
  function commonAncestor(nodes) {
    if (!nodes.length) return null;
    let anc = nodes[0].parentElement;
    while (anc && !nodes.every((n) => anc.contains(n))) anc = anc.parentElement;
    return anc && anc !== document.body && anc !== document.documentElement ? anc : null;
  }

  const stripRegion = (s) => s.replace(/(省|市|自治区|特别行政区|自治州|地区|盟|县|区)$/, '');

  // 选项文字与目标值的匹配分：完全一致 > 前缀 > 选项被目标包含 > 选项包含目标
  function scoreText(text, value) {
    const t = norm(text);
    const v = norm(value);
    if (!t || !v) return 0;
    if (t === v) return 1000;
    if (stripRegion(t) && stripRegion(t) === stripRegion(v)) return 900;
    if (t.startsWith(v)) return 600 - (t.length - v.length);
    if (stripRegion(t).length >= 2 && v.startsWith(stripRegion(t))) return 450 + t.length;
    if (t.length >= 2 && v.includes(t)) return 400 + t.length;
    if (t.includes(v)) return 200 - (t.length - v.length);
    return 0;
  }

  function pickBest(cands, value) {
    let best = null;
    let bestScore = 0;
    for (const n of cands) {
      const s = scoreText(n.textContent, value);
      if (s > bestScore || (s > 0 && s === bestScore && ((best && best.contains(n))
        || (best && n.textContent.length < best.textContent.length)))) {
        best = n;
        bestScore = s;
      }
    }
    return best;
  }

  async function openAndCollect(el, trigger) {
    const snap = snapshot();
    const fresh = () => {
      const c = freshCands(snap, trigger);
      return c.length ? c : null;
    };
    if (typeof el.focus === 'function') el.focus();
    press(trigger);
    let cands = await waitFor(fresh, 800, 80);
    if (!cands && trigger !== el) {
      press(el);
      cands = await waitFor(fresh, 600, 80);
    }
    return { snap, cands: cands || [] };
  }

  /**
   * 下拉框：原生 select 直接选；自定义下拉先展开再点最匹配的选项，可搜索的下拉会先输入关键字
   */
  async function fillChoice(el, value) {
    if (el.tagName === 'SELECT') {
      let best = null;
      let bestScore = 0;
      for (const o of el.options) {
        const s = Math.max(scoreText(o.textContent, value), scoreText(o.value, value));
        if (s > bestScore) {
          best = o;
          bestScore = s;
        }
      }
      if (!best) return false;
      el.value = best.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlight(el);
      return true;
    }

    // 先找组件根节点：Ant v3 下拉展开时搜索框本身也带 select 类名，不能把它当成整个下拉
    const wrap = el.closest('.ant-select, .ant-cascader-picker, .el-select, .el-cascader, .arco-select, .ivu-select, .n-select') || el.closest(SELECT_WRAP);
    const trigger = (wrap && wrap.querySelector('.ant-select-selector, .ant-select-selection, .el-input__inner, .arco-select-view, .ivu-select-selection, [class*="selector"], [class*="trigger"]')) || wrap || el;
    const { snap, cands } = await openAndCollect(el, trigger);

    const listed = () => {
      const fresh = freshCands(snap, trigger);
      return fresh.length ? fresh : visibleOptions();
    };
    const scored = (n) => Math.max(scoreText(n.textContent, value), scoreText(n.getAttribute && n.getAttribute('title'), value));
    const good = (b) => b && scored(b) >= 400;
    let best = pickBest(cands, value);

    // 可搜索的下拉（学校名称等）要先打字，选项往往是远程搜出来的
    // 展开后才出现的搜索框（Ant v3 可搜索下拉）也能打字
    const typeEl = el.tagName === 'INPUT' && !el.readOnly ? el
      : (!good(best) && wrap ? [...wrap.querySelectorAll('input')].find((n) => isShown(n) && !n.readOnly) : null);
    let typed = false;
    if (typeEl) {
      if (typeEl !== el) typeEl.focus();
      nativeSet(typeEl, value);
      typed = true;
      await sleep(500);
      best = pickBest(listed(), value) || best;
    }
    if (!good(best)) {
      best = (await waitFor(() => {
        const b = pickBest(listed(), value);
        return good(b) ? b : null;
      }, 1500, 100)) || best;
    }

    if (good(best)) {
      // 学校等搜索框：优先选完全一致的短项，避免「中山大学」匹配到「中山大学新华学院」
      const exact = listed().find((n) => norm(n.textContent) === norm(value) && isShown(n));
      const pick = exact || best;
      const cell = pick.closest('[role="option"], .ant-select-item-option, .ud__select__list__item, [class*="option"]') || pick;
      press(cell);
      await sleep(180);
      if (freshCands(snap, trigger).length) clickOutside(el);
      highlight(trigger);
      dateTrace.push('choice ' + norm(pick.textContent).slice(0, 20));
      return true;
    }
    // 列表里没有这所学校时，有的网页提供「使用“XX”作为我的学校」
    const custom = typed && listed().find((n) => /使用|作为|添加/.test(norm(n.textContent)) && norm(n.textContent).includes(norm(value)));
    if (custom) {
      press(custom.closest('[role="option"], [class*="option"]') || custom);
      await sleep(180);
      highlight(trigger);
      dateTrace.push('choice custom ' + norm(custom.textContent).slice(0, 24));
      return true;
    }
    if (typed) {
      pressKey(typeEl, 'Enter');
      await sleep(150);
      nativeSet(typeEl, '');
    }
    dateTrace.push('choice miss ' + listed().slice(0, 6).map((n) => norm(n.textContent)).join(','));
    clickOutside(el);
    return false;
  }

  function regionParts(value) {
    const v = String(value).trim();
    if (/[\s/／,，\-]/.test(v)) return v.split(/[\s/／,，\-]+/).filter(Boolean);
    const parts = v.match(/.+?(省|自治区|特别行政区|市|自治州|地区|盟|区|县)/g) || [];
    const rest = v.slice(parts.join('').length);
    return rest ? parts.concat(rest) : (parts.length ? parts : [v]);
  }

  // 同一标签下连续排着的几个下拉（省 / 市 / 区）
  function regionRun(el) {
    const label = labelOf(el);
    const controls = allControls();
    const i = controls.indexOf(el);
    if (i < 0 || !label) return [el];
    const same = (c) => c && isSelectControl(c) && labelOf(c) === label;
    let a = i;
    let b = i;
    while (same(controls[a - 1])) a -= 1;
    while (same(controls[b + 1])) b += 1;
    return controls.slice(a, b + 1);
  }

  // 行内的勾选框 / 单选圈（排除展开箭头）
  const TICK_SEL = '[class*="check"], [class*="radio"], input[type="checkbox"], input[type="radio"], '
    + '[class*="icon"]:not([class*="arrow"]):not([class*="expand"]):not([class*="loading"])';

  /**
   * 级联选择（户口所在地等）：逐级点省 → 市；直辖市第二级重名时自动再点一次
   */
  async function fillCascade(el, value) {
    const parts = regionParts(value);
    const wrap = el.closest(SELECT_WRAP) || el;
    const { snap, cands } = await openAndCollect(el, wrap);
    if (!cands.length) return fillChoice(el, value);

    // 整个弹层：从新出现的选项往上找，直到挂在 body 下（或碰到控件所在的容器）
    // 弹层外面常包一层高度为 0 的挂载 div，不能往上爬到那一层
    let root = commonAncestor(cands) || cands[0].parentElement;
    while (root && root.parentElement && root.parentElement !== document.body
      && !root.parentElement.contains(wrap) && isShown(root.parentElement)) {
      root = root.parentElement;
    }
    const isOpen = () => !!root && root.isConnected && (isShown(root) || [...root.children].some(isShown));
    // 在弹层里找选项；省市列表切换时节点可能被复用，所以不只看「新出现的」
    const inPopup = () => (isOpen()
      ? [...root.querySelectorAll(OPTION_SEL), ...root.querySelectorAll('li, span, div, a, td')]
        .filter((n) => (n.matches(OPTION_SEL) || n.childElementCount === 0) && isShown(n))
      : freshCands(snap, wrap));
    const findPart = (part) => waitFor(() => {
      const b = pickBest(inPopup(), part);
      return b && scoreText(b.textContent, part) >= 400 ? b : null;
    }, 1500, 100);

    let picked = 0;
    let last = null;
    dateTrace.push('parts=' + parts.join('/'));
    for (let i = 0; i < parts.length; i += 1) {
      const best = await findPart(parts[i]);
      if (!best) {
        dateTrace.push('没找到 ' + parts[i] + '，弹层里有：' + inPopup().slice(0, 8).map((n) => norm(n.textContent)).join(','));
        break;
      }
      // 「广东广州」这种没写省市后缀的：选中「广东省」后把剩下的「广州」当下一级
      const st = stripRegion(norm(best.textContent));
      const part = norm(parts[i]);
      if (i === parts.length - 1 && st.length >= 2 && part.startsWith(st) && part.length > st.length + 1) {
        parts.push(part.slice(st.length).replace(/^(省|市|自治区)/, ''));
      }
      // 末级不点文字：带箭头的行点文字会钻进下一级（区县），留给后面勾选
      const tickEl = best.parentElement && best.parentElement.querySelector(TICK_SEL);
      if (i === parts.length - 1 && tickEl && !tickEl.contains(best) && precedes(tickEl, best)) {
        picked += 1;
        last = best;
        break;
      }
      press(best);
      picked += 1;
      last = best;
      await sleep(300);
      if (!isOpen()) break;
      // 点文字没进入下一级的，改点这一行右侧的箭头
      if (i < parts.length - 1) {
        const seen = await waitFor(() => {
          const b = pickBest(inPopup(), parts[i + 1]);
          return b && scoreText(b.textContent, parts[i + 1]) >= 400;
        }, 700, 100);
        const row = best.parentElement;
        dateTrace.push(norm(best.textContent) + (seen ? ' 已展开' : ' 未展开'));
        if (!seen && row) {
          const arrow = [...row.querySelectorAll('svg, [class*="arrow"], [class*="expand"]')].pop();
          press(arrow || row);
          await sleep(300);
        }
      }
    }
    // 直辖市：点完「北京市」后下一级可能还是「北京市」
    if (picked && picked === parts.length && isOpen()) {
      const again = pickBest(inPopup(), parts[parts.length - 1]);
      if (again && again !== last && norm(again.textContent) === norm(last.textContent) && !again.closest('[class*="breadcrumb"], [class*="tab"]')) {
        press(again);
        last = again;
        await sleep(300);
      }
    }

    const lastPart = picked ? stripRegion(norm(parts[Math.min(picked, parts.length) - 1])) : '';
    // 勾选状态：aria-checked / checked，或类名以 checked、selected 结尾（排除 unchecked）
    const tickOn = (row) => !!row && [row, ...row.querySelectorAll('*')].some((n) => n.getAttribute('aria-checked') === 'true'
      || n.checked === true
      || [...(n.classList || [])].some((c) => /(^|[-_])(checked|selected)$/i.test(c) && !/un-?(checked|selected)$/i.test(c)));
    dateTrace.push('levels=' + picked + '/' + parts.length + ' last=' + (last ? norm(last.textContent) : ''));

    if (picked && isOpen()) {
      let row = last.parentElement;
      dateTrace.push('row=' + brief(row, 200));
      const notNav = (n) => !n.closest('[class*="breadcrumb"], [class*="tab"]');
      // 列表行：勾选框在文字前面
      const isListRow = (n) => {
        const t = n.parentElement && n.parentElement.querySelector(TICK_SEL);
        return !!t && !t.contains(n) && precedes(t, n);
      };
      // 弹层里列表行以外（例如右侧「已选」区）出现目标文字的次数
      const chips = () => (isOpen() ? [...root.querySelectorAll('*')] : [])
        .filter((n) => n.childElementCount === 0 && isShown(n) && notNav(n) && !isListRow(n) && norm(n.textContent).includes(lastPart)).length;
      // 列表重新渲染后节点会换掉，按名字重新找回这一行
      const relocate = () => {
        if (row.isConnected) return;
        const name = norm(last.textContent);
        const n = inPopup().find((x) => norm(x.textContent) === name && notNav(x) && isListRow(x));
        if (n) {
          last = n;
          row = n.parentElement;
        }
      };
      // 点一下并判断是否选上：框里显示了 / 弹层关了 / 勾上了 / 勾选图标变了 / 弹层里多出一个「已选」标签
      const trySelect = async (target, why) => {
        hover(target);
        await sleep(60);
        const icon = row.querySelector(TICK_SEL);
        const sig = icon ? icon.outerHTML : '';
        const before = chips();
        press(target);
        await sleep(350);
        relocate();
        const drilled = !row.isConnected || !isShown(row);
        const icon2 = row.querySelector(TICK_SEL);
        const sel = norm(fieldText(el)).includes(lastPart) || !isOpen() || tickOn(row)
          || (!drilled && ((icon2 && icon2.outerHTML !== sig) || chips() > before));
        dateTrace.push(why + ': ' + (sel ? '选上' : '没选上') + (drilled ? '，进了下一级' : ''));
        return { sel, drilled };
      };
      // 钻进了区县一级：本级顶部通常有一项「汕头市」代表整个市，没有就点面包屑退回去
      const recover = async () => {
        const whole = pickBest(inPopup().filter(notNav), lastPart);
        if (whole && scoreText(whole.textContent, lastPart) >= 900 && whole.parentElement) {
          row = whole.parentElement;
          last = whole;
          if ((await trySelect(row.querySelector(TICK_SEL) || whole, 'whole')).sel) return true;
        }
        const crumbs = [...root.querySelectorAll('[class*="breadcrumb"] *')].filter((n) => n.childElementCount === 0 && isShown(n));
        const back = parts.length > 1 ? pickBest(crumbs, parts[parts.length - 2]) : crumbs[0];
        if (back) {
          press(back.closest('[class*="item"]') || back);
          const again = await findPart(parts[parts.length - 1]);
          if (again && again.parentElement) {
            last = again;
            row = again.parentElement;
          }
        }
        return false;
      };

      let selected = norm(fieldText(el)).includes(lastPart) || tickOn(row);
      for (const why of ['icon', 'iconSvg', 'label', 'row']) {
        if (selected || !isOpen()) break;
        const icon = row.querySelector(TICK_SEL);
        const target = { icon, iconSvg: icon && icon.querySelector('svg'), label: last, row }[why];
        if (!target || (why === 'iconSvg' && target === icon)) continue;
        const r = await trySelect(target, why);
        selected = r.sel || (r.drilled && await recover());
      }

      // 优先点真正的按钮；外面包的 div 收不到点击
      const oks = isOpen() ? [...root.querySelectorAll('button, a, span, div')]
        .filter((b) => b.childElementCount <= 1 && /^(确定|确认|OK)$/i.test(norm(b.textContent)) && isShown(b)) : [];
      const ok = oks.find((b) => b.matches('button, a')) || oks.map((b) => b.closest('button, a')).find(Boolean) || oks.pop();
      if (ok) {
        press(ok);
        await sleep(250);
      }
      dateTrace.push('ok=' + !!ok + ' open=' + isOpen());
      if (isOpen()) clickOutside(el);
      await sleep(200);
    }

    // 以控件上实际显示的文字为准，别把「点过」当成「选上」
    const shown = norm(fieldText(el));
    dateTrace.push('shown=' + shown.slice(0, 30));
    const success = picked > 0 && (shown.includes(lastPart) || shown.includes(stripRegion(norm(parts[0]))));
    if (success) highlight(wrap);
    return success;
  }

  function visiblePanels() {
    return [...document.querySelectorAll(PANEL_SEL)].filter(isShown);
  }

  // 点击后新出现的弹层：同一个日历里很多子元素类名都带 calendar，取最外层那个
  function newPanel(before, el) {
    const fresh = visiblePanels().filter((p) => !before.has(p) && !p.contains(el));
    const outer = fresh.filter((p) => !fresh.some((q) => q !== p && q.contains(p)));
    return outer[outer.length - 1] || null;
  }

  // 控件外框上显示的文字（很多下拉把选中值显示在 input 旁边的 div 里，而不是 input.value）
  function fieldText(el) {
    const own = isEditable(el) ? (el.value || '') : '';
    let text = own;
    let box = isEditable(el) ? el.parentElement : el;
    for (let i = 0; i < 4 && box; i += 1, box = box.parentElement) {
      const t = (box.innerText || '').replace(/请选择/g, '').trim();
      if (t.length > 40) break;
      if (t) text = own ? own + ' ' + t : t;
    }
    return text;
  }

  // ignoreOwn：往下拉的搜索框里打过字时，输入框里的字不算「已选中」
  function dateStuck(el, y, m, precision, ignoreOwn) {
    const text = ignoreOwn && isEditable(el) ? fieldText(el).slice((el.value || '').length) : fieldText(el);
    const digits = text.replace(/\D/g, '');
    if (precision === 1) return digits.startsWith(y);
    return digits.startsWith(y + m) || digits.startsWith(y + String(Number(m)));
  }

  // 先按选择器找翻页按钮，找不到再按 « ‹ 之类的文字找
  function clickFirst(panel, selectors, texts) {
    for (const sel of selectors) {
      const btn = [...panel.querySelectorAll(sel)].find(isShown);
      if (btn) {
        press(btn);
        return true;
      }
    }
    const byText = [...panel.querySelectorAll('button, a, span, i, div')]
      .find((n) => n.childElementCount === 0 && (texts || []).includes((n.textContent || '').trim()) && isShown(n));
    if (byText) {
      press(byText.closest('button, a') || byText);
      return true;
    }
    return false;
  }

  // 日历切到「选月 / 选年」时，月份面板是叠在日历头部里的一层，以它为准
  function activeSub(panel) {
    const subs = [...panel.querySelectorAll('*')]
      .filter((n) => [...n.classList].some((c) => /-(month|year|decade)-panel$/.test(c)) && isShown(n));
    return subs[subs.length - 1] || null;
  }

  // 面板里可点的格子（排除面板头部）
  function panelCells(panel) {
    let cells = [...panel.querySelectorAll('td, li, [class*="cell"], [class*="item"]')];
    if (!cells.length) cells = [...panel.querySelectorAll('*')].filter((n) => n.childElementCount === 0);
    return cells.filter((c) => {
      const head = c.closest('[class*="header"], [class*="head"], thead');
      return !(head && panel.contains(head)) && isShown(c);
    });
  }

  function headerYear(panel) {
    const head = [...panel.querySelectorAll('[class*="header"], [class*="head"], [class*="title"]')].find(isShown);
    const hit = ((head || panel).textContent || '').match(/(19|20)\d{2}/);
    return hit ? Number(hit[0]) : null;
  }

  // 同一格子套了好几层时取最里层：飞书的点击事件挂在最里面那层，点外层没反应
  const deepest = (hits) => hits.find((h) => !hits.some((o) => o !== h && h.contains(o))) || null;

  function monthTarget(cells, mi, m) {
    const names = [mi + '月', m + '月', CN_MONTHS[mi - 1], EN_MONTHS[mi - 1], EN_MONTHS[mi - 1] + '.'];
    const hit = deepest(cells.filter((c) => names.includes(norm(c.textContent))));
    if (hit) return hit;
    // 纯数字 1~12 的月份格子
    const nums = cells.filter((c) => /^\d{1,2}$/.test(norm(c.textContent)) && Number(norm(c.textContent)) <= 12);
    if (nums.length === 12) return nums.find((c) => Number(norm(c.textContent)) === mi) || null;
    return null;
  }

  /**
   * 日期面板点选：支持「年月面板」「先选年再选月」「日历面板」，翻到目标年份 / 月份后点对应格子
   */
  async function pickInPanel(root, y, m, d, dayMode, rangeSide) {
    // 日期范围有两个面板：左面板是 start，右面板是 end
    let panel = root;
    if (rangeSide && root.querySelector('.ant-picker-panels, [class*="panels"], [class*="range-wrapper"]')) {
      const panels = [...root.querySelectorAll('.ant-picker-panel, [class*="picker-panel"]')].filter(isShown);
      panel = panels[rangeSide === 'right' && panels.length > 1 ? 1 : 0] || root;
    }
    const yi = Number(y);
    const mi = Number(m);
    const di = Number(d);
    const titleSel = dayMode
      ? '[title="' + y + '-' + m + '-' + d + '"], [title="' + y + '年' + mi + '月' + di + '日"]'
      : '[title="' + y + '-' + m + '"], [title="' + y + '年' + mi + '月"]';
    let yearClicked = false;
    let yearListOpened = false;

    for (let i = 0; i < 80; i += 1) {
      panel = (!dayMode && activeSub(root)) || root;
      const cell = panel.querySelector(titleSel);
      if (cell && isShown(cell)) {
        press(cell);
        return true;
      }
      const cells = panelCells(panel);
      const hy = headerYear(panel);
      if (!dayMode && (hy === yi || (hy === null && yearClicked))) {
        const target = monthTarget(cells, mi, m);
        if (target) {
          press(target);
          return true;
        }
      }
      // 年份列表：直接点目标年份，面板会切到月份
      if (!yearClicked) {
        const yearCell = deepest(cells.filter((c) => [y, y + '年'].includes(norm(c.textContent))));
        if (yearCell) {
          press(yearCell);
          yearClicked = true;
          await sleep(200);
          continue;
        }
      }
      if (hy === null) break;
      if (hy !== yi) {
        if (clickFirst(panel, hy < yi ? NEXT_YEAR : PREV_YEAR, hy < yi ? ['»', '>>', '››'] : ['«', '<<', '‹‹'])) {
          await sleep(60);
          continue;
        }
        // 飞书：翻年按钮没有可辨认的类名，点头部的「2026年」切到年份列表再选
        const headYear = !yearListOpened && [...panel.querySelectorAll('[class*="header"] *')]
          .find((n) => n.childElementCount === 0 && /^(19|20)\d{2}年?$/.test(norm(n.textContent)) && isShown(n));
        if (!headYear) break;
        yearListOpened = true;
        press(headYear);
        await sleep(200);
        continue;
      }
      if (dayMode) {
        const monthMatch = (panel.textContent || '').match(/(19|20)\d{2}\s*[年\-/.]\s*(\d{1,2})/);
        const hm = monthMatch ? Number(monthMatch[2]) : null;
        if (hm && hm !== mi) {
          if (!clickFirst(panel, hm < mi ? NEXT_MONTH : PREV_MONTH, hm < mi ? ['›', '>'] : ['‹', '<'])) break;
          await sleep(60);
          continue;
        }
      }
      break;
    }

    panel = (!dayMode && activeSub(root)) || root;
    const cells = panelCells(panel);
    const target = dayMode
      ? cells.find((c) => norm(c.textContent) === String(di) && !/(prev|next|last|other|outside|disabled)/i.test(c.className))
      : monthTarget(cells, mi, m);
    dateTrace.push('hy=' + headerYear(panel) + ' target=' + (target ? norm(target.textContent) : 'none'));
    if (target) {
      press(target);
      return true;
    }
    return false;
  }

  /**
   * 日期：弹出面板就点选；没有面板或点选失败再打字 + 回车；都不行就清掉，避免留下错误日期
   */
  async function fillDate(el, value) {
    const parts = value.split('-');
    const y = parts[0];
    const m = (parts[1] || '01').padStart(2, '0');
    const d = (parts[2] || '01').padStart(2, '0');

    if (el.type === 'date' || el.type === 'month') {
      nativeSet(el, el.type === 'date' ? y + '-' + m + '-' + d : y + '-' + m);
      highlight(el);
      return true;
    }

    const wrap = el.closest(DATE_WRAP) || el;
    const range = rangeRoot(el);
    const isRange = !!range;

    // 日期范围框优先直接打字：Ant Design 等组件的 input 可编辑，比点面板更稳
    // 飞书（ud__ 组件）打字只改了显示，表单里的值还是空的，必须点面板
    const typeOnlyShows = !!el.closest('.throne-biz-date-range-picker-wrapper, [class*="ud__picker"], .ud__input');
    if (isRange && isEditable(el) && !el.readOnly && !typeOnlyShows) {
      const fmt = parts.length === 3 ? y + '-' + m + '-' + d : y + '-' + m;
      nativeSet(el, fmt);
      pressKey(el, 'Tab');
      await sleep(120);
      if (dateStuck(el, y, m, parts.length)) {
        dateTrace.push('range type ok');
        highlight(wrap);
        return true;
      }
    }

    const snap = snapshot();
    const before = new Set(visiblePanels());
    const focusTarget = isEditable(el) ? el : wrap;
    if (typeof focusTarget.focus === 'function') focusTarget.focus();
    press(focusTarget);

    let panel = null;
    await waitFor(() => {
      panel = newPanel(before, el);
      if (panel) return true;
      const leaves = freshCands(snap, wrap);
      if (leaves.length >= 4) panel = commonAncestor(leaves);
      return !!panel;
    }, 800, 80);
    if (panel) {
      await sleep(150);
      panel = newPanel(before, el) || panel;
    } else {
      // 选完开始时间后，有的范围框自动切到结束时间、面板一直开着，不算「新出现」
      const open = visiblePanels().filter((p) => !p.contains(el));
      panel = open.filter((p) => !open.some((q) => q !== p && q.contains(p))).pop() || null;
    }

    const isOpen = () => !!panel && panel.isConnected && isShown(panel);
    const numeric = panel ? panelCells(panel).filter((c) => /^\d{1,2}$/.test(norm(c.textContent))).length : 0;
    const sub = panel && activeSub(panel);
    // 只有 12 个月份格子的面板（飞书的类名也叫 date-panel）不是按天选的日历
    const monthGrid = !!panel && numeric < 28 && !!monthTarget(panelCells(panel), 1, '01');
    const dayMode = panel
      ? !sub && !monthGrid && (!!panel.querySelector('.ant-picker-date-panel, .ant-calendar-date-panel, .el-date-table, .arco-picker-body-date, [class*="date-panel"], [class*="date-table"]') || numeric >= 28)
      : parts.length === 3;

    // 有「确定」按钮的面板要点一下，再收起
    const finish = async () => {
      await sleep(150);
      if (isOpen()) {
        const ok = [...panel.querySelectorAll('button, a, span')]
          .find((b) => /^(确定|确认|OK)$/i.test(norm(b.textContent)) && isShown(b));
        if (ok) {
          press(ok.closest('button, a') || ok);
          await sleep(120);
        }
      }
      if (isOpen()) clickOutside(el);
      await sleep(60);
    };

    dateTrace.push('panel=' + tagOf(panel) + ' day=' + dayMode + ' cells=' + (panel ? panelCells(panel).length : 0)
      + ' head=' + (panel ? norm(((panel.querySelector('[class*="header"]') || {}).textContent) || '').slice(0, 20) : ''));

    // 日期范围框：先确认当前 focus 的是左框还是右框，再按对应位置的面板选
    const rangeInputs = isRange ? rangeInputsOf(range) : [];
    const rangeSide = isRange ? (() => {
      const active = document.activeElement;
      const byActive = active && rangeInputs.includes(active) ? rangeInputs.indexOf(active) : -1;
      if (byActive >= 0) return byActive === 1 ? 'right' : 'left';
      const byEl = rangeInputs.indexOf(el);
      if (byEl >= 0) return byEl === 1 ? 'right' : 'left';
      return 'left';
    })() : null;

    const picked = panel && await pickInPanel(panel, y, m, d, dayMode, isRange ? rangeSide : null);
    if (picked) {
      await finish();
      dateTrace.push('picked shown=' + norm(fieldText(el)).slice(0, 24));
      if (dateStuck(el, y, m, parts.length)) {
        highlight(wrap);
        return true;
      }
    } else if (panel) {
      dateTrace.push('pickFail head=' + norm(((panel.querySelector('[class*="header"]') || {}).textContent) || '').slice(0, 20)
        + ' sample=' + panelCells(panel).slice(0, 6).map((c) => norm(c.textContent)).join(','));
    }
    // 只能选年份的框（如飞书的获奖时间）：点了年份、框里显示的正好是这一年就算填好
    if (panel && norm(fieldText(el)) === y) {
      await finish();
      highlight(wrap);
      return true;
    }

    // 面板被收起了就重新点开
    const reopen = async () => {
      if (isOpen()) return;
      const again = new Set(visiblePanels());
      press(isEditable(el) ? el : wrap);
      await waitFor(() => {
        panel = newPanel(again, el) || panel;
        return isOpen();
      }, 700, 80);
    };

    // 下拉列表式的年月（选项就是「2023-09」或先选年再选月）
    const listPick = async () => {
      await reopen();
      const leaves = () => (isOpen()
        ? [...panel.querySelectorAll('*')].filter((n) => n.childElementCount === 0 && isShown(n))
        : visibleLeaves());
      const want = [y + m, y + String(Number(m))];
      const hit = leaves().find((n) => want.includes(norm(n.textContent).replace(/\D/g, '')) && /\d{4}\D+\d{1,2}/.test(n.textContent));
      if (hit) {
        press(hit.closest('li, td, [role="option"], [class*="option"], [class*="item"]') || hit);
        return true;
      }
      return false;
    };

    // 面板自带的日期输入框优先（如 rc-calendar），其次才是控件本身
    await reopen();
    const panelInput = isOpen() && [...panel.querySelectorAll('input')].find((i) => !i.readOnly && isShown(i));
    if (panelInput) {
      const formats = dayMode ? [y + '-' + m + '-' + d] : [y + '-' + m, y + '-' + m + '-' + d];
      for (const text of formats) {
        panelInput.focus();
        nativeSet(panelInput, text);
        await sleep(120);
        pressKey(panelInput, 'Enter');
        await sleep(200);
        if (dateStuck(el, y, m, parts.length)) {
          dateTrace.push('panelInput ok');
          await finish();
          highlight(wrap);
          return true;
        }
      }
      dateTrace.push('panelInput fail shown=' + norm(fieldText(el)).slice(0, 24));
    }

    if (await listPick()) {
      await finish();
      dateTrace.push('list shown=' + norm(fieldText(el)).slice(0, 24));
      if (dateStuck(el, y, m, parts.length)) {
        highlight(wrap);
        return true;
      }
    }

    const typeTarget = isEditable(el) && !el.readOnly && !typeOnlyShows ? el : null;
    if (typeTarget) {
      const formats = dayMode
        ? [y + '-' + m + '-' + d, y + '/' + m + '/' + d, y + '年' + m + '月' + d + '日']
        : [y + '-' + m, y + '/' + m, y + '年' + m + '月', y + '-' + m + '-' + d];
      const ignoreOwn = typeTarget === el && isSelectControl(el);
      for (const text of formats) {
        nativeSet(typeTarget, text);
        pressKey(typeTarget, 'Enter');
        await sleep(150);
        if (dateStuck(el, y, m, parts.length, ignoreOwn)) {
          await finish();
          highlight(wrap);
          return true;
        }
      }
      clickOutside(el);
      await sleep(150);
      if (dateStuck(el, y, m, parts.length, ignoreOwn)) {
        highlight(wrap);
        return true;
      }
      if (typeTarget === el) nativeSet(el, '');
    }
    dateTrace.push('end shown=' + norm(fieldText(el)).slice(0, 24));
    if (isOpen()) clickOutside(el);
    return false;
  }

  const MODAL_SEL = '.ant-modal-wrap, .el-dialog__wrapper, .arco-modal-wrapper, .ivu-modal-wrap, .n-modal-container, [role="dialog"]';
  const visibleModals = () => [...document.querySelectorAll(MODAL_SEL)].filter(isShown);

  // 点输入框弹出「请选择专业/学校」对话框：在对话框里搜索并点选，选不上就关掉对话框
  async function pickInModal(modal, value) {
    const search = [...modal.querySelectorAll('input[type="text"], input:not([type])')].find(isShown);
    if (search) {
      search.focus();
      nativeSet(search, value);
      pressKey(search, 'Enter');
      const btn = [...modal.querySelectorAll('button')].find((b) => /搜\s*索|查\s*询/.test(norm(b.textContent)));
      if (btn) btn.click();
      await sleep(600);
    }
    const target = norm(value);
    const leaves = () => [...modal.querySelectorAll('div, li, span, a, td, p')]
      .filter((n) => !n.querySelector('div, li, span, a, td, p, input, button') && isShown(n))
      .map((n) => ({ n, t: norm(n.textContent) }))
      .filter(({ t }) => t && t.length <= 30 && !/^(清\s*空|确\s*定|取\s*消|搜\s*索)$/.test(t));
    const pick = () => {
      const all = leaves();
      return (all.find(({ t }) => t === target)
        || all.filter(({ t }) => t.includes(target) || (t.length >= 2 && target.includes(t)))
          .sort((a, b) => Math.abs(a.t.length - target.length) - Math.abs(b.t.length - target.length))[0] || {}).n;
    };
    const hit = pick();
    if (hit) {
      press(hit);
      await sleep(400);
      const ok = [...modal.querySelectorAll('button')].find((b) => /^确\s*定$|^确\s*认$/.test(norm(b.textContent)) && isShown(b));
      if (ok && isShown(modal)) {
        ok.click();
        await sleep(300);
      }
    }
    if (!isShown(modal)) return !!hit;
    const close = modal.querySelector('.ant-modal-close, .el-dialog__headerbtn, .arco-modal-close-btn, .ivu-modal-close, [aria-label="Close"]');
    if (close) close.click();
    else pressKey(document.activeElement || document.body, 'Escape');
    await sleep(300);
    return false;
  }

  // 普通输入框；带联想的输入框（如学校），联想列表里有完全一致的项就点上
  async function fillText(el, value) {
    const text = el.maxLength > 0 ? value.slice(0, el.maxLength) : value;
    const suggests = el.getAttribute('role') === 'combobox'
      || !!el.getAttribute('aria-autocomplete')
      || !!el.closest('[class*="autocomplete"], [class*="AutoComplete"], [class*="suggest"]');
    const before = suggests ? new Set(visibleOptions()) : null;

    const modalsBefore = new Set(visibleModals());
    if (typeof el.focus === 'function') el.focus();
    el.click();
    const modal = await waitFor(() => visibleModals().find((m) => !modalsBefore.has(m) && !m.contains(el)), 150, 50);
    if (modal) {
      const ok = await pickInModal(modal, text);
      highlight(el);
      return ok;
    }
    nativeSet(el, text);
    highlight(el);

    if (suggests) {
      const cands = await waitFor(() => {
        const fresh = newOptions(before);
        return fresh.length ? fresh : null;
      }, 400);
      const exact = cands && cands.find((n) => norm(n.textContent) === norm(text));
      if (exact) {
        press(exact);
        await sleep(120);
      }
    }
    if (typeof el.blur === 'function') el.blur();
    return true;
  }

  const DATE_VALUE = /^\d{4}(-\d{1,2}){0,2}$/;

  async function fillFieldInner(el, key, v) {
    // 「A|B|C」：依次尝试，哪个选得上用哪个
    if (v.includes('|')) {
      for (const alt of v.split('|')) {
        if (alt && await fillFieldInner(el, key, alt)) return true;
      }
      return false;
    }
    // 日期类字段一律走日期逻辑（网申页的日期框大多是「请选择」+ 弹出面板）
    if ((DATE_KEYS.has(key) || isDateControl(el)) && DATE_VALUE.test(v)) return fillDate(el, v);
    if (AREA_KEYS.has(key) && isSelectControl(el)) {
      // 「现居住地」是并排的省、市两个下拉：第几个下拉就选地址的第几级
      const siblings = regionRun(el);
      if (siblings.length >= 2) {
        const parts = regionParts(v);
        const idx = siblings.indexOf(el);
        const part = idx === siblings.length - 1 ? parts.slice(idx).join('') : parts[idx];
        return part ? fillChoice(el, part) : false;
      }
      return fillCascade(el, v);
    }
    if (isSelectControl(el) || !isEditable(el)) return fillChoice(el, v);
    return fillText(el, v);
  }

  // 每个字段的填充结果都记下来，方便告诉用户哪些没填上、以及导出诊断信息
  let fillLog = [];
  // 日期填充每一步的情况，写进诊断信息
  let dateTrace = [];
  const tagOf = (n) => (n ? n.tagName.toLowerCase() + '.' + String(n.className || '').trim().split(/\s+/)[0] : 'none');

  async function fillField(el, key, value) {
    const v = value == null ? '' : String(value).trim();
    if (!v) return false;
    let ok = false;
    let error = '';
    dateTrace = [];
    try {
      ok = !!(await fillFieldInner(el, key, v));
    } catch (e) {
      error = String(e && e.message || e).slice(0, 120);
    }
    fillLog.push({
      label: labelOf(el),
      key,
      ok,
      error,
      trace: dateTrace.join(' | ').slice(0, 400),
      via: DATE_KEYS.has(key) || isDateControl(el) ? 'date' : AREA_KEYS.has(key) && isSelectControl(el) ? 'cascade'
        : isSelectControl(el) || !isEditable(el) ? 'choice' : 'text'
    });
    return ok;
  }

  function textMatches(root, test) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const t = norm(node.nodeValue);
      const el = node.parentElement;
      if (t && t.length <= 14 && test(t) && el && !el.closest('script, style, option') && isShown(el)) out.push(el);
      node = walker.nextNode();
    }
    return out;
  }

  // 文字往上找可点击容器：优先 button/a，再看 cursor:pointer（避免点到按钮里的 span）
  function clickBoxOf(el) {
    const tagged = el.closest('button, a, [role="button"]');
    if (tagged) return tagged;
    for (let n = el, i = 0; n && n !== document.body && i < 4; n = n.parentElement, i += 1) {
      if (getComputedStyle(n).cursor === 'pointer') return n;
    }
    return null;
  }

  // 像「＋ 实习经历」这种文字和标题相同的添加按钮：要带 + 图标、虚线/add 样式，或文字里有 +/添加
  function isAddLike(el) {
    const box = clickBoxOf(el);
    if (!box || norm(box.textContent).length > 12) return null;
    const text = norm(box.textContent);
    const cls = String(box.className && box.className.baseVal != null ? box.className.baseVal : box.className || '');
    const icon = box.querySelector('[class*="plus" i], [aria-label*="plus" i], [data-icon*="plus" i], [class*="icon-add" i], [class*="add-icon" i]');
    if (/^[+＋]|添加|新增/.test(text) || icon || /dashed|add/i.test(cls)) return box;
    return null;
  }

  // 同一标题文字既有纯文字又有可点击的：纯文字是标题，可点击的多半是「＋ 实习经历」按钮
  function splitTitleMatches(titles) {
    const set = new Set(titles.map(norm));
    const heads = [];
    const adds = [];
    const byText = new Map();
    for (const el of textMatches(document.body, (t) => set.has(t))) {
      if (isAddLike(el)) {
        adds.push(el);
        continue;
      }
      const k = norm(el.textContent);
      if (!byText.has(k)) byText.set(k, []);
      byText.get(k).push(el);
    }
    for (const list of byText.values()) {
      const plain = list.filter((el) => !clickBoxOf(el));
      if (!plain.length) {
        heads.push(...list);
        continue;
      }
      heads.push(...plain);
      adds.push(...list.filter((el) => clickBoxOf(el) && plain.some((p) => precedes(p, el))));
    }
    return { heads, adds };
  }

  function findHeadings(titles) {
    const all = splitTitleMatches(titles).heads;
    const main = all.filter((el) => !isNavChrome(el));
    const heads = main.length ? main : all;
    // 「技能」「证书」这类短标题也常是字段 label，字段 label 不能当区块标题
    const notLabel = heads.filter((el) => !el.closest('label, .ant-form-item-label, .el-form-item__label, .arco-form-label-item, .ivu-form-item-label'));
    return notLabel.length ? notLabel : heads;
  }

  // 区块标题对应的添加按钮：「＋ 实习经历」「添加实习经历」「新增 项目经历」
  function findTitleAdds(titles) {
    const plain = new Set(titles.map(norm));
    const res = titles.map((t) => new RegExp('^[+＋]?(添加|新增|继续添加)?(新的|一个|一条|一段|一项)?' + norm(t).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '$'));
    const out = [];
    const push = (box) => {
      if (box && !isNavChrome(box) && !out.includes(box)) out.push(box);
    };
    splitTitleMatches(titles).adds.forEach((el) => push(isAddLike(el) || clickBoxOf(el)));
    textMatches(document.body, (t) => !plain.has(t) && res.some((re) => re.test(t)))
      .forEach((el) => push(clickBoxOf(el)));
    return out;
  }

  function findAddButtons(re) {
    return textMatches(document.body, (t) => re.test(t) || re.test(t.replace(/新的|一个|一条|一段|一项/, '')))
      .map((el) => el.closest('button, a, [role="button"]') || el);
  }

  // 先把页面滚一遍，把懒加载的区块渲染出来
  async function scrollToRender() {
    const html = document.documentElement;
    const step = Math.max(400, Math.floor(html.scrollHeight / 8));
    for (let y = 0; y < html.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await sleep(120);
    }
    window.scrollTo({ top: html.scrollHeight, behavior: 'instant' });
    await sleep(150);
    window.scrollTo({ top: 0, behavior: 'instant' });
    await sleep(80);
  }

  /**
   * 把区块内的控件按记录分组：遇到首字段或重复字段就开始新的一条
   */
  function groupEntries(controls, sec) {
    const keyed = controls.map((el) => ({ el, key: controlKey(el, sec.dict) })).filter((f) => f.key);
    // 有的网站每条记录先放「起止时间」再放公司名：首字段前紧挨着的字段才是一条记录的开头
    const firstAt = keyed.findIndex((f) => f.key === sec.first);
    const leader = firstAt > 0 && firstAt <= 3 ? keyed[0].key : sec.first;
    const groups = [];
    let current = [];
    let keys = new Set();
    for (const { el, key } of keyed) {
      if (keys.has(key) || (key === leader && keys.size)) {
        groups.push(current);
        current = [];
        keys = new Set();
      }
      current.push({ el, key });
      keys.add(key);
    }
    if (current.length) groups.push(current);
    return groups.filter((g) => g.some((f) => f.key === sec.first) || g.length >= 2);
  }

  /**
   * 定位区块：标题到下一个区块标题之间的控件；同名标题（如右侧导航）取控件最少的有效区间
   */
  function locateSection(sec) {
    const heads = findHeadings(sec.titles);
    if (!heads.length) return null;
    const allHeads = findHeadings(ALL_SECTION_TITLES);
    const addBtns = findAddButtons(sec.add);
    const looseAdd = findClickable(sec.add);
    const titleAdds = findTitleAdds(sec.titles);
    const genericAdds = findAddButtons(GENERIC_ADD);
    const controls = allControls();
    let best = null;

    for (const head of heads) {
      const nextHead = allHeads.find((h) => h !== head && !head.contains(h) && !h.contains(head) && precedes(head, h));
      const inSec = (n) => precedes(head, n) && (!nextHead || precedes(n, nextHead));
      const inRange = controls.filter(inSec);
      const groups = groupEntries(inRange, sec);

      // 区块内的按钮：「添加实习经历」→「＋ 实习经历」→ 通用「添加」
      const ownAdd = addBtns.find(inSec)
        || titleAdds.find(inSec)
        || (looseAdd && inSec(looseAdd) ? looseAdd : null)
        || genericAdds.find(inSec);
      // 空区块（一个控件都没有）只有在区块内找到添加按钮时才算数，避免误认导航里的同名标题
      if (!groups.length && !ownAdd) continue;
      const addBtn = ownAdd
        || (looseAdd && precedes(head, looseAdd) ? looseAdd : null)
        || addBtns.find((b) => precedes(head, b) && !isNavChrome(b));
      const better = !best
        || (groups.length > 0) > (best.groups.length > 0)
        || ((groups.length > 0) === (best.groups.length > 0) && inRange.length < best.inRange.length);
      if (better) best = { head, inRange, groups, addBtn };
    }
    return best;
  }

  async function clickUntilNow(group) {
    const anchor = (group.find((f) => f.key === 'end') || group[group.length - 1]).el;
    let box = anchor.parentElement;
    for (let i = 0; i < 5 && box; i += 1, box = box.parentElement) {
      const hit = textMatches(box, (t) => t === '至今')[0];
      if (!hit) continue;
      const lab = hit.closest('label');
      const cb = (lab || hit.parentElement).querySelector('input[type="checkbox"]');
      if (cb && cb.checked) return true;
      if (lab) press(lab);
      else if (cb) cb.click();
      else press(hit);
      await sleep(120);
      return true;
    }
    // 飞书等：「至今」在结束时间弹出的日期面板底部
    const endEl = (group.find((f) => f.key === 'end') || {}).el;
    if (!endEl || !isDateControl(endEl)) return false;
    if (norm(fieldText(endEl)).includes('至今')) return true;
    const before = new Set(visiblePanels());
    if (typeof endEl.focus === 'function') endEl.focus();
    press(isEditable(endEl) ? endEl : (endEl.closest(DATE_WRAP) || endEl));
    const now = await waitFor(() => {
      const panel = newPanel(before, endEl) || visiblePanels().find((p) => !p.contains(endEl));
      return panel && textMatches(panel, (t) => t === '至今')[0];
    }, 800, 80);
    if (!now) {
      clickOutside(endEl);
      return false;
    }
    press(now);
    await sleep(200);
    if (visiblePanels().some((p) => p.contains(now))) clickOutside(endEl);
    return norm(fieldText(endEl)).includes('至今');
  }

  /**
   * 填一个可重复区块；网页上的条数不够时自动点「添加」按钮
   */
  async function fillSection(sec, items, claimed, stats, statKey) {
    if (!items || !items.length) return 0;
    let loc = locateSection(sec);
    if (!loc) return 0;

    // 把区块滚到视野里，确保控件都在 DOM 中且可见
    if (loc.head && typeof loc.head.scrollIntoView === 'function') {
      loc.head.scrollIntoView({ block: 'center', behavior: 'instant' });
      await sleep(200);
    }

    let added = 0;
    for (let guard = 0; loc.groups.length < items.length && guard < items.length + 3; guard += 1) {
      if (!loc.addBtn) break;
      const prev = loc.groups.length;
      press(loc.addBtn);
      if (loc.addBtn && typeof loc.addBtn.scrollIntoView === 'function') {
        loc.addBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      const grown = await waitFor(() => {
        const next = locateSection(sec);
        if (next && next.groups.length > prev) {
          loc = next;
          return true;
        }
        return false;
      }, 2000, 120);
      if (!grown) break;
      added += 1;
    }

    let filled = 0;
    const count = Math.min(items.length, loc.groups.length);
    for (let i = 0; i < count; i += 1) {
      const fresh = locateSection(sec);
      if (fresh && fresh.groups[i]) loc = fresh;
      const group = loc.groups[i];
      const item = items[i];
      for (const { el, key } of group) {
        claimed.add(el);
        if (key === 'end' && item.untilNow) continue;
        if (await fillField(el, key, item[key])) filled += 1;
        await sleep(40);
      }
      if (item.untilNow && await clickUntilNow(group)) filled += 1;
    }

    stats[statKey] = { entries: count, added, wanted: items.length };
    return filled;
  }

  /**
   * 兜底：按标题找不到区块时，把全页未认领且匹配该词典的控件抓出来分组填
   */
  async function fillLooseSection(dict, items, claimed, stats, statKey) {
    if (!items || !items.length) return 0;
    const controls = allControls().filter((el) => !claimed.has(el));
    const groups = groupEntries(controls, { dict, first: Object.keys(dict)[0] });
    if (!groups.length) return 0;

    let filled = 0;
    const count = Math.min(items.length, groups.length);
    for (let i = 0; i < count; i += 1) {
      const group = groups[i];
      const item = items[i];
      for (const { el, key } of group) {
        claimed.add(el);
        if (key === 'end' && item.untilNow) continue;
        if (await fillField(el, key, item[key])) filled += 1;
        await sleep(40);
      }
      if (item.untilNow && await clickUntilNow(group)) filled += 1;
    }
    stats[statKey] = { entries: count, added: 0, wanted: items.length, loose: true };
    return filled;
  }

  // 性别多为单选按钮：在「性别」标签附近点文字为 男/女 的选项
  async function fillGender(value) {
    for (const labelEl of findHeadings(['性别'])) {
      const item = labelEl.closest(ITEM_SEL);
      let box = item || labelEl.parentElement;
      for (let i = 0; i < 4 && box; i += 1, box = box.parentElement) {
        const opts = [...box.querySelectorAll('label, span, div, li')]
          .filter((n) => norm(n.textContent) === value && isShown(n));
        if (opts.length) {
          const target = opts.find((n) => n.tagName === 'LABEL') || opts[0];
          const radio = target.querySelector('input[type="radio"]');
          if (!(radio && radio.checked)) press(target);
          highlight(target);
          return true;
        }
        const select = [...box.querySelectorAll('input, select')].find((c) => usable(c) && isSelectControl(c));
        if (select) return fillChoice(select, value);
      }
    }
    return false;
  }

  // 经历类字段：散落在页面上时说不清属于哪段经历，宁可不填也不能把实习内容塞进工作经历/在校职务
  const ENTRY_ONLY_KEYS = new Set(['company', 'title', 'description', 'industry', 'location', 'department', 'jobType', 'date', 'level', 'language', 'cert', 'score']);

  async function fillBasic(resume, claimed, skipRanges) {
    let filled = 0;
    if (resume.gender && await fillGender(resume.gender)) filled += 1;
    const edu0 = (resume.edu && resume.edu[0]) || {};
    const top = { school: resume.school, major: resume.major, degree: resume.degree, academicDegree: resume.academicDegree, start: resume.eduStart, end: resume.eduEnd };
    // 区块没对上时，再按标签把剩下的控件扫一遍（学历、专业、入学/毕业时间等）
    for (const el of allControls()) {
      if (claimed.has(el)) continue;
      const key = controlKey(el, ALL_DICT);
      if (!key || ENTRY_ONLY_KEYS.has(key)) continue;
      const label = labelOf(el);
      const inEntrySection = skipRanges.some((inRange) => inRange(el));
      if (inEntrySection && !(key in BASIC_DICT)) continue;
      if ((key === 'start' || key === 'end') && !/入学|毕业|就读|最高学历/.test(label)) continue;
      if (key === 'name' && !/姓名|name/i.test(label)) continue;
      let v;
      if (/最高/.test(label) && top[key]) v = top[key];
      else if (key === 'start' || key === 'end') v = top[key] || edu0[key];
      else {
        v = (resume[key] && String(resume[key]).trim())
          || edu0[key]
          || (key === 'form' ? resume.studyForm : '')
          || (key === 'studyForm' ? edu0.form : '');
      }
      claimed.add(el);
      if (await fillField(el, key, v)) filled += 1;
      await sleep(30);
    }
    return filled;
  }

  // 已定位的经历类区块（工作经历、在校任职等）的范围：基本信息兜底时不碰这些区块里的控件
  function entryRanges() {
    const out = [];
    for (const [name, sec] of Object.entries(SECTIONS)) {
      if (name === 'edu') continue;
      const loc = locateSection(sec);
      if (!loc) continue;
      const allHeads = findHeadings(ALL_SECTION_TITLES);
      const head = loc.head;
      const nextHead = allHeads.find((h) => h !== head && !head.contains(h) && !h.contains(head) && precedes(head, h));
      out.push((n) => precedes(head, n) && (!nextHead || precedes(n, nextHead)));
    }
    return out;
  }

  // 学历 → 学位：网页里「最高学位」是 学士 / 硕士 / 博士 / 无
  function academicOf(degree) {
    const d = String(degree || '');
    if (/博士/.test(d)) return '博士';
    if (/硕士|研究生/.test(d)) return '硕士';
    if (/本科|学士/.test(d)) return '学士';
    if (/专科|大专/.test(d)) return '无|无学位';
    return '';
  }

  // 英语证书在各网页叫法不同：CET-6 / 大学英语六级 / 大学英语六级考试
  function certAlts(cert) {
    const c = String(cert || '').trim();
    if (!c) return '';
    const map = [
      [/专业?八级|专八|TEM-?8/i, '大学生英语专业八级考试|英语专业八级|专业八级|TEM-8|TEM8'],
      [/专业?四级|专四|TEM-?4/i, '大学生英语专业四级考试|英语专业四级|专业四级|TEM-4|TEM4'],
      [/六级|CET-?6/i, '大学英语六级考试|大学英语六级|英语六级|CET-6|CET6|六级'],
      [/四级|CET-?4/i, '大学英语四级考试|大学英语四级|英语四级|CET-4|CET4|四级'],
      [/雅思|IELTS/i, '雅思|IELTS'],
      [/托福|TOEFL/i, '托福|TOEFL']
    ];
    const hit = map.find(([re]) => re.test(c));
    return hit ? hit[1] + '|' + c : c;
  }

  function prepare(resume) {
    const eduList = resume.educationList || [];
    const edu0 = eduList[0] || {};
    const r = Object.assign({}, resume);
    r.school = r.school || edu0.school;
    r.major = r.major || edu0.major;
    r.degree = r.degree || edu0.degree;
    r.studyForm = r.studyForm || edu0.form;
    r.currentCity = r.currentCity || r.hukou;
    r.address = r.address || r.currentCity;
    r.workYears = r.workYears || '无经验|无工作经验|无|应届生|应届|0年|1年以下|一年以下|不足1年';
    r.academicDegree = r.academicDegree || academicOf(r.degree);
    if (r.ethnicity && !/族$/.test(r.ethnicity)) r.ethnicity += '族';
    if (r.ethnicity) r.ethnicity += '|' + r.ethnicity.replace(/族$/, '');
    if (r.marital === '未婚') r.marital = '未婚|单身|否';
    r.nationality = r.nationality || '中国|中国大陆';
    if (r.idNumber && !r.idType) r.idType = '居民身份证|身份证|中国大陆居民身份证';
    if (r.politics === '共青团员') r.politics = '共青团员|团员|中国共产主义青年团团员';
    if (r.politics === '中共党员') r.politics = '中共党员|中国共产党党员|党员';
    if (r.politics === '中共预备党员') r.politics = '中共预备党员|预备党员';
    if (!r.englishLevel) {
      const en = (resume.languageList || []).find((l) => /英语|english/i.test(l.language || ''));
      if (en) r.englishLevel = [en.cert, en.score].filter(Boolean).join(' ') || en.level;
    }

    // 每段用自己的字段；只有第一段缺字段时才用旧版单独存的教育信息补
    const top = (e, i, own, legacy) => e[own] || (i === 0 ? r[legacy] : '');
    r.edu = eduList.map((e, i) => ({
      school: e.school,
      major: e.major,
      degree: top(e, i, 'degree', 'degree'),
      academicDegree: academicOf(top(e, i, 'degree', 'degree')),
      form: top(e, i, 'form', 'studyForm'),
      college: top(e, i, 'college', 'college'),
      schoolCity: top(e, i, 'schoolCity', 'schoolCity'),
      gpa: e.gpa,
      rank: e.rank,
      courses: e.courses,
      start: top(e, i, 'start', 'eduStart'),
      end: top(e, i, 'end', 'eduEnd')
    }));
    if (!r.edu.length && r.school) {
      r.edu = [{ school: r.school, major: r.major, degree: r.degree, form: r.studyForm, college: r.college, schoolCity: r.schoolCity, start: r.eduStart, end: r.eduEnd }];
    }
    // PDF 解析偶尔把同一所学校拆出第二条残缺记录：同校同学历的、或既没专业也没学历的都去掉
    r.edu = r.edu.filter((e, i) => {
      if (i === 0) return true;
      const s = norm(e.school);
      if (!s || !(e.major || e.degree)) return false;
      return !r.edu.slice(0, i).some((p) => {
        const ps = norm(p.school);
        return (ps.includes(s) || s.includes(ps)) && (!e.degree || !p.degree || e.degree === p.degree);
      });
    });

    r.exp = (resume.experienceList || []).map((e) => {
      const untilNow = !!(e.untilNow || e.end === '至今');
      return {
        company: e.company,
        title: e.title,
        start: e.start,
        end: untilNow ? '' : e.end,
        untilNow,
        description: e.description,
        industry: e.industry,
        location: e.location,
        department: e.department,
        jobType: e.jobType || '实习|实习生'
      };
    });

    // 旧版存的简历只有一段项目文字：现场拆成条目
    let projectList = resume.projectList || [];
    if (!projectList.length && resume.projects && typeof parseProjectItems === 'function') {
      projectList = parseProjectItems('项目经历\n' + resume.projects);
    }
    r.project = projectList.map((e) => ({
      name: e.name,
      company: e.company,
      title: e.title,
      start: e.start,
      end: e.end === '至今' ? '' : e.end,
      untilNow: e.end === '至今',
      description: e.description
    }));

    // 获奖级别：没填时按「院级」处理；下拉里叫法不一，依次尝试相近的选项
    const LEVEL_ALTS = {
      国家级: '国家级|国际级|全国',
      省级: '省级|省部级|省市级',
      市级: '市级|省市级|地市级',
      校级: '校级|院校级|学校级',
      院级: '院级|院校级|学院级|院系级|校级'
    };
    r.award = (resume.awardList || []).map((a) => ({
      name: a.name,
      level: LEVEL_ALTS[a.level] || a.level || LEVEL_ALTS['院级'],
      date: a.date
    }));

    const until = (e) => !!(e.untilNow || e.end === '至今');
    r.campus = (resume.campusList || []).map((e) => ({
      company: e.company, title: e.title, start: e.start,
      end: until(e) ? '' : e.end, untilNow: until(e), description: e.description
    }));
    r.lang = (resume.languageList || []).map((l) => ({
      language: l.language,
      level: l.level,
      cert: certAlts(l.cert),
      // 有的网页「成绩」是通过/优秀的下拉
      score: l.cert ? [l.score, '通过'].filter(Boolean).join('|') : l.score
    }));
    r.cert = (resume.certList || []).map((c) => ({ name: c.name, date: c.date }));
    // 技能文字按行/顿号/分号拆成一条条；熟练程度网页上叫法不一，依次尝试
    r.skill = String(resume.skills || '')
      .split(/[\n、；;]+/)
      .map((s) => s.replace(/^[\s•·\-*\d.、]+/, '').trim())
      .filter((s) => s && s.length <= 30)
      .slice(0, 10)
      .map((s) => ({ name: s, level: '熟练|良好|掌握|一般' }));
    return r;
  }

  // overrides：本次填充临时替换的字段（求职助手关联岗位后的应聘岗位、意向城市、AI 定制的自我评价），不改动已保存的简历
  async function fillAll(overrides) {
    const saved = await new Promise((resolve) => {
      chrome.storage.local.get('resume', (res) => resolve(res.resume || null));
    });
    const resume = saved && overrides ? Object.assign({}, saved, overrides) : saved;
    if (!resume || !(resume.name || resume.phone || resume.email || (resume.experienceList || []).length)) {
      return { filled: 0, error: 'no-resume' };
    }
    // 空区块（只有「＋ 实习经历」按钮、还没有控件）也要继续填，不能当成「无表单」跳过
    const hasControls = !!document.querySelector('input, textarea, select');
    const hasSection = Object.values(SECTIONS).some((sec) => locateSection(sec));
    if (!hasControls && !hasSection) return { filled: 0, skipped: true };

    // 先把懒加载内容滚出来，否则下方的实习/项目区块可能还没渲染
    await scrollToRender();

    const r = prepare(resume);
    const claimed = new Set();
    const stats = {};
    let filled = 0;
    fillLog = [];

    const steps = [
      () => fillSection(SECTIONS.edu, r.edu, claimed, stats, 'edu'),
      async () => {
        // 简历里的经历都是实习：只填实习经历；纯「工作经历」区块一律不碰，兜底扫描也要跳过它
        const workLoc = locateSection(SECTIONS.work);
        if (workLoc) workLoc.inRange.forEach((el) => claimed.add(el));
        if (locateSection(SECTIONS.exp)) return fillSection(SECTIONS.exp, r.exp, claimed, stats, 'exp');
        return fillLooseSection(EXP_DICT, r.exp, claimed, stats, 'exp');
      },
      async () => {
        // 实习及项目经历（合并区块）：用实习+项目数据一起填
        const combined = locateSection(SECTIONS.combined) ? SECTIONS.combined : null;
        if (combined) {
          // 合并区块：实习在前、项目在后；实习条目的「项目名称」用公司名兜底
          const combinedItems = r.exp.map((e) => Object.assign({ name: e.company }, e)).concat(r.project);
          return fillSection(combined, combinedItems, claimed, stats, 'combined');
        }
        const sec = locateSection(SECTIONS.project) ? SECTIONS.project : null;
        if (sec) return fillSection(sec, r.project, claimed, stats, 'project');
        return fillLooseSection(PROJECT_DICT, r.project, claimed, stats, 'project');
      },
      () => (locateSection(SECTIONS.award)
        ? fillSection(SECTIONS.award, r.award, claimed, stats, 'award')
        : fillLooseSection(AWARD_DICT, r.award, claimed, stats, 'award')),
      () => fillSection(SECTIONS.campus, r.campus, claimed, stats, 'campus'),
      () => fillSection(SECTIONS.lang, r.lang, claimed, stats, 'lang'),
      () => fillSection(SECTIONS.cert, r.cert, claimed, stats, 'cert'),
      () => fillSection(SECTIONS.skill, r.skill, claimed, stats, 'skill'),
      () => fillSection(SECTIONS.summary, r.summary ? [{ summary: r.summary }] : [], claimed, stats, 'summary'),
      () => fillBasic(r, claimed, entryRanges())
    ];
    // 某一块出错不影响其它块继续填
    for (const step of steps) {
      try {
        filled += await step();
      } catch (e) {
        fillLog.push({ label: '(区块出错)', key: '', ok: false, error: String(e && e.message || e).slice(0, 120) });
      }
    }

    window.__resumeAutofillLastLog = fillLog;
    const missed = [...new Set(fillLog.filter((f) => !f.ok).map((f) => f.label || f.key))];
    return { filled, stats, missed, expInResume: r.exp.length };
  }

  // ---------- 诊断：填不上时导出页面结构，方便针对具体网站修 ----------

  function brief(el, max) {
    if (!el) return null;
    const html = (el.outerHTML || '')
      .replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>')
      .replace(/\sstyle="[^"]*"/g, '')
      .replace(/\s(data-v-[\w-]+|data-reactid)(="[^"]*")?/g, '')
      .replace(/\svalue="[^"]*"/g, ' value="…"');
    return html.slice(0, max || 600);
  }

  function chainOf(el) {
    const out = [];
    for (let n = el, i = 0; n && n !== document.body && i < 5; n = n.parentElement, i += 1) {
      const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      out.push(n.tagName.toLowerCase() + (cls ? '.' + cls : ''));
    }
    return out.join(' < ');
  }

  async function diagnose() {
    const controls = allControls();
    const info = {
      version: VERSION,
      page: location.host + location.pathname,
      frame: window === window.top ? 'top' : 'iframe',
      controls: controls.slice(0, 150).map((el) => {
        const label = labelOf(el);
        return {
          label,
          basic: matchKey(label, BASIC_DICT),
          exp: matchKey(label, EXP_DICT),
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          ro: !!el.readOnly,
          ph: el.placeholder || '',
          date: isDateControl(el),
          select: isSelectControl(el),
          chain: chainOf(el)
        };
      }),
      sections: {},
      lastFill: (window.__resumeAutofillLastLog || []).slice(0, 150)
    };

    for (const [name, sec] of Object.entries(SECTIONS)) {
      const loc = locateSection(sec);
      info.sections[name] = {
        headings: findHeadings(sec.titles).length,
        groups: loc ? loc.groups.map((g) => g.map((f) => f.key).join(',')) : null,
        addBtn: loc ? brief(loc.addBtn, 300) : null,
        titleAdds: findTitleAdds(sec.titles).slice(0, 3).map((e) => brief(e, 300)),
        addTexts: textMatches(document.body, (t) => /添加|新增/.test(t)).slice(0, 6).map((e) => brief(e, 300))
      };
    }

    // 点开第一个日期框和第一个「请选择」下拉，看看弹出层长什么样，然后收起
    const sample = async (pred) => {
      const el = controls.find(pred);
      if (!el) return null;
      const item = el.closest(ITEM_SEL) || (el.parentElement && el.parentElement.parentElement) || el;
      const snap = snapshot();
      const before = new Set(visiblePanels());
      press(isEditable(el) ? el : (el.closest(DATE_WRAP + ',' + SELECT_WRAP) || el));
      await sleep(600);
      const panel = newPanel(before, el) || commonAncestor(freshCands(snap, el));
      const out = { label: labelOf(el), field: brief(item, 1200), popup: brief(panel, 2500) };
      clickOutside(el);
      await sleep(200);
      return out;
    };
    const keyOf = (el) => controlKey(el, ALL_DICT);
    info.dateSample = await sample((el) => DATE_KEYS.has(keyOf(el)));
    info.startSample = await sample((el) => keyOf(el) === 'start');
    info.selectSample = await sample((el) => ['studyForm', 'hukou', 'degree'].includes(keyOf(el)));
    return info;
  }

  window.__resumeAutofillFill = fillAll;
  window.__resumeAutofillDiagnose = diagnose;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== 'fill') return false;
    if (!document.querySelector('input, textarea, select')) return false;
    fillAll().then(sendResponse).catch(() => sendResponse({ filled: 0 }));
    return true;
  });
})();
