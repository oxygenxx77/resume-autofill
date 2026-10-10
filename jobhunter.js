// 与本机「求职助手」联动（简历同步、识别岗位、AI 写自我评价、标记已投递）
// 求职助手没开时这些功能自动隐藏，不影响原来的填充
const JOB_HUNTER = 'http://127.0.0.1:8001';

async function jobHunter(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeout || 3000);
  try {
    const res = await fetch(JOB_HUNTER + path, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '请求失败（' + res.status + '）');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('求职助手响应超时');
    if (error instanceof TypeError) throw new Error('连接不上求职助手，请先双击桌面的「求职助手.command」');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
