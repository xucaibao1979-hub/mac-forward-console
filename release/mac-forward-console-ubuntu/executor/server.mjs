import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
// Runtime data lives outside the code directory in production, so replacing
// an application release can never overwrite configuration or history.
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const stateFile = path.join(dataDir, 'state.json');
const port = Number(process.env.EXECUTOR_PORT || 8787);
const apiToken = process.env.EXECUTOR_TOKEN || '';
const allowedOrigin = process.env.CONSOLE_ORIGIN || 'http://localhost:3000';
const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || '123456';
const cleanTimeoutMs = Math.max(60, Number(process.env.CLEAN_TIMEOUT_SECONDS || 900)) * 1000;
const sendTimeoutMs = Math.max(600, Number(process.env.SEND_TIMEOUT_SECONDS || 14400)) * 1000;
const secretKey = scryptSync(process.env.CONFIG_ENCRYPTION_KEY || initialAdminPassword, 'mac-forward-console-device-secrets', 32);

const defaultDevices = ['2106', '2108', '2104'].map((id) => ({
  id,
  name: `Mac mini ${id}`,
  ip: `192.168.2.${id.slice(-3)}`,
  port: 22,
  username: 'test',
  identityFile: '',
  script: `/opt/weixin/zf/twsend/${id}/cs.sh`,
  defaultScriptName: '默认图文转发',
  killScript: `/opt/weixin/zf/twsend/${id}/kill${id}.sh`,
  cleanScript: `/opt/weixin/zf/twsend/${id}/clean${id}.sh`,
  groupFile: `/opt/weixin/aotmac${id}/list/schoollist.txt`,
  testGroupFile: `/opt/weixin/csmac${id}/list/test.txt`,
  runtimeGroupFile: `/opt/weixin/zf/twsend/${id}/list/schoollist.txt`,
  remoteDesktopUrl: '',
  customScripts: id === '2108'
    ? [{ id: 'SCRIPT-TEXT-2108', name: '2108文本发送', path: '/opt/weixin/zf/twsend/2108/text.sh', mode: 'text' }]
    : id === '2104'
      ? [{ id: 'SCRIPT-TEXT-2104', name: '2104文本发送', path: '/opt/weixin/zf/twsend/2104/text.sh', mode: 'text' }]
      : [],
  connected: false,
  state: '空闲',
  cpu: 0,
  memory: 0,
  memoryUsed: 0,
  memoryTotal: 0,
  free: 0,
  diskTotal: 0,
  lastSeen: null,
  lastError: null,
}));

const defaultGroups = Object.fromEntries(defaultDevices.flatMap((device) => ['production', 'test'].map((environment) => [`${device.id}:${environment}`, {
  deviceId: device.id,
  environment,
  names: [],
  updatedAt: null,
  updatedBy: null,
  versions: [],
}])));
const defaultUsers = [{ id: 'USER-ADMIN', name: '系统管理员', email: 'admin@company.cn', role: '管理员', permissions: ['创建任务', '终止任务', '磁盘清理', '查看日志', '设备配置', '群名管理', '用户管理'] }];
const defaultMessages = [
  { id: 'MSG-1', name: '客户群日常通知', content: '' },
  { id: 'MSG-2', name: '门店活动信息', content: '' },
  { id: 'MSG-3', name: '内部运营公告', content: '' },
];
let state = { devices: defaultDevices, groups: defaultGroups, tasks: [], logs: [], users: defaultUsers, messages: defaultMessages, auth: null, settings: { refreshInterval: 15, diskThreshold: 40, autoClean: true } };
let saving = Promise.resolve();
const sessions = new Map();
const ssoTickets = new Map();
const ssoTicketTtlMs = 60_000;

async function loadState() {
  await mkdir(dataDir, { recursive: true });
  try {
    const saved = JSON.parse(await readFile(stateFile, 'utf8'));
    state = { ...state, ...saved, groups: { ...defaultGroups, ...(saved.groups || {}) } };
    if (!Array.isArray(state.users) || state.users.length === 0) state.users = defaultUsers;
    if (!Array.isArray(state.messages)) state.messages = defaultMessages;
    state.users = state.users.map((user) => user.role === '管理员' && !user.permissions?.includes('群名管理')
      ? { ...user, permissions: [...(user.permissions || []), '群名管理'] }
      : user);
    const usedDeviceIds = new Set();
    const repairedGroups = {};
    const seed2108TextScript = !state.migrations?.textScript2108;
    const seed2104TextScript = !state.migrations?.textScript2104;
    state.devices = state.devices.map((device, index) => {
      const nameId = String(device.name || '').match(/\b\d{4}\b/)?.[0];
      let repairedId = String(device.id || '').trim();
      if (!repairedId || repairedId === 'null' || repairedId === 'undefined' || usedDeviceIds.has(repairedId)) repairedId = nameId || defaultDevices[index]?.id || `DEVICE-${index + 1}`;
      while (usedDeviceIds.has(repairedId)) repairedId = `${repairedId}-${index + 1}`;
      usedDeviceIds.add(repairedId);
      repairedGroups[repairedId] = repairedId === device.id ? (state.groups[device.id] || { deviceId: repairedId, names: [], versions: [] }) : { deviceId: repairedId, names: [], versions: [] };
      const customScripts = Array.isArray(device.customScripts) ? [...device.customScripts] : [];
      if (seed2108TextScript && repairedId === '2108' && !customScripts.some((script) => script.path === '/opt/weixin/zf/twsend/2108/text.sh')) {
        customScripts.push({ id: 'SCRIPT-TEXT-2108', name: '2108文本发送', path: '/opt/weixin/zf/twsend/2108/text.sh', mode: 'text' });
      }
      if (seed2104TextScript && repairedId === '2104' && !customScripts.some((script) => script.path === '/opt/weixin/zf/twsend/2104/text.sh')) {
        customScripts.push({ id: 'SCRIPT-TEXT-2104', name: '2104文本发送', path: '/opt/weixin/zf/twsend/2104/text.sh', mode: 'text' });
      }
      return {
        ...device,
        id: repairedId,
        name: device.name || `Mac mini ${repairedId}`,
        groupFile: device.groupFile || `/opt/weixin/aotmac${repairedId}/list/schoollist.txt`,
        testGroupFile: device.testGroupFile || `/opt/weixin/csmac${repairedId}/list/test.txt`,
        runtimeGroupFile: device.runtimeGroupFile || `/opt/weixin/zf/twsend/${repairedId}/list/schoollist.txt`,
        customScripts,
        defaultScriptName: device.defaultScriptName || '默认图文转发',
      };
    });
    state.migrations = { ...(state.migrations || {}), textScript2108: true, textScript2104: true };
    state.groups = { ...defaultGroups, ...repairedGroups };
    for (const device of state.devices) {
      const production = state.groups[`${device.id}:production`] || state.groups[device.id] || { deviceId: device.id, names: [], versions: [] };
      state.groups[`${device.id}:production`] = { ...production, deviceId: device.id, environment: 'production' };
      state.groups[`${device.id}:test`] ||= { deviceId: device.id, environment: 'test', names: [], versions: [] };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('读取状态失败:', error.message);
    await persist();
  }
  if (!state.auth) {
    const salt = randomBytes(16).toString('hex');
    state.auth = { username: 'admin', salt, passwordHash: scryptSync(initialAdminPassword, salt, 64).toString('hex'), passwordChangedAt: null };
    await persist();
  }
  await persist();
}

function passwordMatches(password) {
  const actual = Buffer.from(state.auth.passwordHash, 'hex');
  const expected = scryptSync(String(password), state.auth.salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function userPasswordMatches(user, password) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const actual = Buffer.from(user.passwordHash, 'hex');
  const expected = scryptSync(String(password), user.passwordSalt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function safeUser(user) {
  const { passwordHash, passwordSalt, ssoTokenHash, ...safe } = user;
  return { ...safe, hasPassword: Boolean(passwordHash && passwordSalt), hasSsoToken: Boolean(ssoTokenHash) };
}

function tokenHash(value) { return createHash('sha256').update(String(value)).digest('hex'); }

function tokenHashMatches(value, expectedHash) {
  if (!value || !expectedHash) return false;
  const actual = Buffer.from(tokenHash(value), 'hex');
  const expected = Buffer.from(String(expectedHash), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createSession(user) {
  const token = randomBytes(32).toString('hex');
  const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions || [] };
  sessions.set(token, publicUser);
  return { token, user: publicUser };
}

function encryptSecret(value) {
  if (!value) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

function safeDevice(device) {
  const { vncPasswordEncrypted, vncPassword, ...safe } = device;
  return { ...safe, hasVncPassword: Boolean(vncPasswordEncrypted) };
}

function persist() {
  saving = saving.then(async () => {
    const temp = `${stateFile}.tmp`;
    await writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
    await rename(temp, stateFile);
  });
  return saving;
}

function audit(action, detail, level = 'info') {
  state.logs.unshift({ id: Date.now() + Math.random(), time: new Date().toISOString(), action, detail, level });
  state.logs = state.logs.slice(0, 2000);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function validateDevice(device) {
  if (!device.id || ['null', 'undefined'].includes(String(device.id))) throw new Error('设备编号不能为空或使用null');
  if (!device.ip || !device.username) throw new Error('设备地址和用户名不能为空');
  for (const [label, value] of [['终止', device.killScript], ['清理', device.cleanScript]]) {
    if (!String(value || '').startsWith('/')) throw new Error(`${label}脚本必须使用绝对路径`);
  }
  if (device.script && !String(device.script).startsWith('/')) throw new Error('发送脚本必须使用绝对路径');
  if (!String(device.groupFile || '').startsWith('/')) throw new Error('群名文件必须使用绝对路径');
  if (!String(device.testGroupFile || '').startsWith('/')) throw new Error('测试群名文件必须使用绝对路径');
  if (!String(device.runtimeGroupFile || '').startsWith('/')) throw new Error('脚本读取群名路径必须使用绝对路径');
  for (const script of device.customScripts || []) {
    if (!String(script.name || '').trim()) throw new Error('自定义脚本名称不能为空');
    if (!String(script.path || '').startsWith('/')) throw new Error(`自定义脚本“${script.name}”必须使用绝对路径`);
  }
}

function ensureRuntimeGroupFile(device) {
  const sendScript = String(device.script || '');
  device.runtimeGroupFile = sendScript.startsWith('/')
    ? path.join(path.dirname(sendScript), 'list', 'schoollist.txt')
    : `/opt/weixin/zf/twsend/${device.id}/list/schoollist.txt`;
}

function sshArgs(device, command) {
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'ServerAliveInterval=10', '-p', String(device.port || 22)];
  if (device.identityFile && !['使用系统默认密钥', '使用SSH配置别名'].includes(device.identityFile)) args.push('-i', device.identityFile);
  args.push(`${device.username}@${device.ip}`, command);
  return args;
}

function runSsh(device, command, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', sshArgs(device, command), { windowsHide: true });
    let stdout = '', stderr = '', settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`执行超时（${Math.round(timeoutMs / 1000)}秒）`));
    }, timeoutMs);
    child.stdout.on('data', (v) => (stdout += v));
    child.stderr.on('data', (v) => (stderr += v));
    child.on('error', (error) => { clearTimeout(timer); if (!settled) { settled = true; reject(error); } });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      code === 0 ? resolve(result) : reject(Object.assign(new Error(result.stderr || `SSH退出码 ${code}`), { result }));
    });
  });
}

function runLocalScript(script, timeoutMs = 120000, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [script], { windowsHide: true, cwd: path.dirname(script), env: { ...process.env, ...extraEnv } });
    let stdout = '', stderr = '', settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(Object.assign(new Error(`执行超时（${Math.round(timeoutMs / 1000)}秒）`), { timedOut: true, result: { code: null, stdout: stdout.trim(), stderr: stderr.trim() } }));
    }, timeoutMs);
    child.stdout.on('data', (value) => (stdout += value));
    child.stderr.on('data', (value) => (stderr += value));
    child.on('error', (error) => { clearTimeout(timer); if (!settled) { settled = true; reject(error); } });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      code === 0 ? resolve(result) : reject(Object.assign(new Error(result.stderr || `脚本退出码 ${code}`), { result }));
    });
  });
}

function normalizeGroupEnvironment(value) { return value === 'test' ? 'test' : 'production'; }
function groupKey(deviceId, environment = 'production') { return `${deviceId}:${normalizeGroupEnvironment(environment)}`; }
function configuredGroupFile(device, environment = 'production') { return normalizeGroupEnvironment(environment) === 'test' ? device.testGroupFile : device.groupFile; }

async function writeGroupFile(deviceId, names, environment = 'production') {
  const device = state.devices.find((item) => item.id === deviceId);
  if (!device) throw new Error('设备不存在');
  const groupFile = configuredGroupFile(device, environment);
  await mkdir(path.dirname(groupFile), { recursive: true });
  await writeFile(groupFile, `${names.join('\n')}${names.length ? '\n' : ''}`, 'utf8');
  return groupFile;
}

async function readGroupFile(deviceId, environment = 'production') {
  const device = state.devices.find((item) => item.id === deviceId);
  if (!device) throw new Error('设备不存在');
  environment = normalizeGroupEnvironment(environment);
  const key = groupKey(deviceId, environment);
  const groupFile = configuredGroupFile(device, environment);
  const current = state.groups[key] || { deviceId, environment, names: [], versions: [] };
  try {
    const content = await readFile(groupFile, 'utf8');
    const names = content.split(/\r?\n/).map((name) => name.replace(/^\uFEFF/, '').trim()).filter(Boolean);
    state.groups[key] = { ...current, deviceId, environment, names, groupFile, fileError: null, fileReadAt: new Date().toISOString() };
  } catch (error) {
    state.groups[key] = { ...current, deviceId, environment, names: [], groupFile, fileError: error.code === 'ENOENT' ? '群名文件不存在，请检查设备管理中配置的服务端文件路径' : `读取群名文件失败：${error.message}`, fileReadAt: new Date().toISOString() };
  }
  return state.groups[key];
}

function createGroupVersion(device, current, names, createdBy, environment = 'production') {
  const now = new Date();
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replaceAll('-', '');
  const sameDayMax = (current.versions || []).reduce((max, version) => {
    const match = String(version.name || '').match(new RegExp(`-v(\\d+)-${dateKey}$`));
    return Math.max(max, Number(match?.[1] || 0));
  }, 0);
  const environmentName = normalizeGroupEnvironment(environment) === 'test' ? '-测试' : '';
  return { id: `GROUP-${Date.now()}-${randomBytes(3).toString('hex')}`, name: `${device.name}${environmentName}-v${sameDayMax + 1}-${dateKey}`, names: [...names], createdAt: now.toISOString(), createdBy };
}

async function collectMetrics(device) {
  const command = "printf 'CPU='; ps -A -o %cpu | awk '{s+=$1} END {printf \"%.1f\\n\",s}'; " +
    "printf 'MEM_TOTAL='; sysctl -n hw.memsize; " +
    "printf 'MEM_FREE_PERCENT='; memory_pressure -Q 2>/dev/null | awk -F': ' '/System-wide memory free percentage/ {gsub(/%/,\"\",$2); print $2; exit}'; " +
    "df -k / | tail -1 | awk '{print \"DISK_TOTAL=\"$2*1024\"\\nDISK_FREE=\"$4*1024}'";
  try {
    const { stdout } = await runSsh(device, command, 15000);
    const values = Object.fromEntries(stdout.split(/\r?\n/).map((line) => line.split('=')));
    const memoryTotal = Number(values.MEM_TOTAL || 0) / 1073741824;
    const memoryFreePercent = Number(values.MEM_FREE_PERCENT);
    const memoryPercent = Number.isFinite(memoryFreePercent) ? Math.max(0, Math.min(100, Math.round(100 - memoryFreePercent))) : 0;
    const memoryUsed = memoryTotal * memoryPercent / 100;
    Object.assign(device, {
      connected: true,
      cpu: Math.min(100, Math.round(Number(values.CPU || 0))),
      memoryTotal: Math.round(memoryTotal * 10) / 10,
      memoryUsed: Math.round(memoryUsed * 10) / 10,
      memory: memoryPercent,
      diskTotal: Math.round(Number(values.DISK_TOTAL || 0) / 107374182.4) / 10,
      free: Math.round(Number(values.DISK_FREE || 0) / 107374182.4) / 10,
      lastSeen: new Date().toISOString(),
      lastError: null,
    });
  } catch (error) {
    Object.assign(device, { connected: false, lastError: error.message });
  }
}

async function executeTask(task) {
  const device = state.devices.find((d) => d.id === task.deviceId);
  if (!device) throw new Error('设备不存在');
  let script = task.action === 'send' ? device.script : task.action === 'stop' ? device.killScript : device.cleanScript;
  if (task.action === 'send' && task.scriptId) {
    const configured = (device.customScripts || []).find((item) => item.id === task.scriptId);
    if (!configured) throw new Error('发送执行脚本不存在或已被删除');
    script = configured.path;
  }
  if (task.action === 'send' && !script) throw new Error('默认发送脚本已删除，请选择脚本组中的其他发送脚本');
  if (task.action === 'custom') {
    const configured = (device.customScripts || []).find((item) => item.id === task.scriptId);
    if (!configured) throw new Error('自定义脚本不存在或已被删除');
    script = configured.path;
  }
  validateDevice(device);
  task.status = task.action === 'send' ? '发送中' : '执行中';
  task.startedAt = new Date().toISOString();
  delete task.finishedAt;
  delete task.durationMs;
  device.state = task.action === 'send' ? '发送中' : device.state;
  audit('任务开始', `${task.id} · ${device.name} · ${script}`);
  await persist();
  let runtimeBackup;
  const finishTask = (status, output = '', errorMessage = '') => {
    task.status = status;
    task.finishedAt = new Date().toISOString();
    task.durationMs = Math.max(0, new Date(task.finishedAt).getTime() - new Date(task.startedAt || task.createdAt).getTime());
    task.output = String(output || '').slice(-12000);
    if (errorMessage) task.error = errorMessage;
    else delete task.error;
  };
  try {
    const environment = normalizeGroupEnvironment(task.groupEnvironment);
    if (task.action === 'send') {
      const selectedGroup = state.groups[groupKey(device.id, environment)] || { names: [] };
      const runtimeGroupFile = device.runtimeGroupFile || path.join(path.dirname(script), 'list', 'schoollist.txt');
      runtimeBackup = await readFile(runtimeGroupFile).catch(() => null);
      await writeGroupFile(device.id, selectedGroup.names || [], environment);
      await mkdir(path.dirname(runtimeGroupFile), { recursive: true });
      await writeFile(runtimeGroupFile, `${(selectedGroup.names || []).join('\n')}${selectedGroup.names?.length ? '\n' : ''}`, 'utf8');
    }
    const timeoutMs = task.action === 'send' ? sendTimeoutMs : task.action === 'clean' ? cleanTimeoutMs : 180000;
    const result = await runLocalScript(script, timeoutMs, task.action === 'send' ? {
      GROUP_ENVIRONMENT: normalizeGroupEnvironment(task.groupEnvironment),
      GROUP_FILE: configuredGroupFile(device, task.groupEnvironment),
      RUNTIME_GROUP_FILE: device.runtimeGroupFile || path.join(path.dirname(script), 'list', 'schoollist.txt'),
      SEND_MODE: task.sendMode || 'local',
      SEND_MESSAGE_ID: task.messageId || '',
      SEND_MESSAGE_NAME: state.messages.find((item) => item.id === task.messageId)?.name || '',
      SEND_MESSAGE_CONTENT: state.messages.find((item) => item.id === task.messageId)?.content || '',
    } : {});
    finishTask('已完成', result.stdout);
    device.state = '空闲';
    audit('任务完成', `${task.id} · ${device.name}`);
  } catch (error) {
    const remoteClosedDuringStop = task.action === 'stop' && /connection to .* closed by remote host|connection .* closed/i.test(`${error.message}\n${error.result?.stderr || ''}`);
    const sendCompletedInOutput = task.action === 'send' && /发送脚本执行完成/.test(`${error.result?.stdout || ''}\n${error.result?.stderr || ''}`);
    if (remoteClosedDuringStop || sendCompletedInOutput) {
      const output = sendCompletedInOutput
        ? `${error.result?.stdout || ''}\n检测到发送脚本已输出完成标记，已按发送成功处理。`
        : `${error.result?.stdout || ''}\n远端连接在终止过程中关闭，已按停止成功处理。`;
      finishTask('已完成', output);
      device.state = '空闲';
      audit('任务完成', `${task.id} · ${device.name} · ${sendCompletedInOutput ? '检测到发送完成标记' : '停止发送后远端主动关闭连接'}`);
    } else {
      finishTask('失败', error.result?.stdout || '', error.message);
      device.state = '空闲';
      audit('任务失败', `${task.id} · ${device.name} · ${error.message}`, 'error');
    }
  } finally {
    if (runtimeBackup !== undefined && normalizeGroupEnvironment(task.groupEnvironment) === 'test') {
      const runtimeGroupFile = device.runtimeGroupFile || path.join(path.dirname(script), 'list', 'schoollist.txt');
      const restore = runtimeBackup === null ? unlink(runtimeGroupFile).catch((error) => { if (error.code !== 'ENOENT') throw error; }) : writeFile(runtimeGroupFile, runtimeBackup);
      await restore.catch((error) => audit('恢复正式发送群名单失败', `${device.name} · ${error.message}`, 'error'));
    }
  }
  if (task.action === 'stop') await new Promise((resolve) => setTimeout(resolve, 1500));
  await collectMetrics(device);
  await persist();
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': allowedOrigin, 'access-control-allow-headers': 'content-type, authorization, x-session-token, x-aura-sso-key', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 1_000_000) throw new Error('请求内容过大'); }
  return text ? JSON.parse(text) : {};
}

function infrastructureAuthorized(req) { return !apiToken || req.headers.authorization === `Bearer ${apiToken}`; }
function sessionUser(req) { return sessions.get(String(req.headers['x-session-token'] || '')); }
function hasPermission(user, permission) { return user?.role === '管理员' || user?.permissions?.includes(permission); }
function requirePermission(res, user, permission) {
  if (hasPermission(user, permission)) return true;
  json(res, 403, { error: `没有“${permission}”权限` });
  return false;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const independentlyAuthorized = ['/api/auth/login', '/api/auth/sso', '/api/sso/ticket'].includes(url.pathname);
  if (!independentlyAuthorized && !infrastructureAuthorized(req)) return json(res, 401, { error: '服务访问未授权' });
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, time: new Date().toISOString() });
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await body(req);
      const loginName = String(input.username || '').trim().toLocaleLowerCase();
      const isAdmin = loginName === state.auth.username.toLocaleLowerCase() && passwordMatches(input.password);
      const matchedUser = state.users.find((user) =>
        [user.email, user.name].some((value) => String(value || '').trim().toLocaleLowerCase() === loginName) && userPasswordMatches(user, input.password));
      if (!isAdmin && !matchedUser) return json(res, 401, { error: '账号或密码错误' });
      const signedInUser = matchedUser || { name: 'Admin', email: state.auth.username, role: '管理员', permissions: defaultUsers[0].permissions };
      const { token, user: publicUser } = createSession(signedInUser);
      audit('用户登录', signedInUser.name); await persist();
      return json(res, 200, { ok: true, token, user: publicUser });
    }
    if (req.method === 'POST' && url.pathname === '/api/sso/ticket') {
      const longToken = String(req.headers['x-aura-sso-key'] || '').trim();
      const user = state.users.find((item) => tokenHashMatches(longToken, item.ssoTokenHash));
      if (!user) { audit('SSO换票失败', `无效授权密钥 · ${req.socket.remoteAddress || 'unknown'}`, 'error'); await persist(); return json(res, 401, { error: 'SSO授权密钥无效或已吊销' }); }
      const ticket = randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + ssoTicketTtlMs;
      ssoTickets.set(tokenHash(ticket), { userId: user.id, expiresAt });
      for (const [key, value] of ssoTickets) if (value.expiresAt <= Date.now()) ssoTickets.delete(key);
      audit('生成SSO一次性票据', `${user.name} · 60秒有效`); await persist();
      return json(res, 201, { loginUrl: `${allowedOrigin}/?sso_token=${encodeURIComponent(ticket)}`, expiresIn: 60, expiresAt: new Date(expiresAt).toISOString() });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/sso') {
      const input = await body(req);
      const key = tokenHash(input.ticket || '');
      const ticket = ssoTickets.get(key);
      ssoTickets.delete(key);
      if (!ticket || ticket.expiresAt <= Date.now()) { audit('SSO登录失败', '票据无效、已使用或已过期', 'error'); await persist(); return json(res, 401, { error: '免登链接无效、已使用或已过期' }); }
      const user = state.users.find((item) => item.id === ticket.userId && item.ssoTokenHash);
      if (!user) { audit('SSO登录失败', `用户不存在或授权已吊销 · ${ticket.userId}`, 'error'); await persist(); return json(res, 401, { error: '用户不存在或免登授权已吊销' }); }
      const session = createSession(user);
      audit('SSO用户登录', `${user.name} · ${user.role}`); await persist();
      return json(res, 200, { ok: true, ...session });
    }
    const actor = sessionUser(req);
    if (!actor) return json(res, 401, { error: '登录已失效，请重新登录' });
    if (req.method === 'POST' && url.pathname === '/api/auth/change-password') {
      if (actor.role !== '管理员') return json(res, 403, { error: '只有管理员可以修改管理员密码' });
      const input = await body(req);
      if (!passwordMatches(input.currentPassword)) return json(res, 400, { error: '当前密码不正确' });
      if (String(input.newPassword || '').length < 8) return json(res, 400, { error: '新密码至少需要8位' });
      const salt = randomBytes(16).toString('hex');
      state.auth = { ...state.auth, salt, passwordHash: scryptSync(String(input.newPassword), salt, 64).toString('hex'), passwordChangedAt: new Date().toISOString() };
      audit('修改管理员密码', state.auth.username); await persist();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      await Promise.all(state.devices.flatMap((device) => [readGroupFile(device.id, 'production'), readGroupFile(device.id, 'test')]));
      const { passwordHash: _passwordHash, salt: _salt, ...safeAuth } = state.auth;
      const groupOnly = actor.role !== '管理员' && actor.permissions.length === 1 && actor.permissions.includes('群名管理');
      const visibleDevices = groupOnly
        ? state.devices.map(({ id, name, connected, state: deviceState, groupFile, testGroupFile, lastSeen, lastError }) => ({ id, name, connected, state: deviceState, groupFile, testGroupFile, lastSeen, lastError }))
        : state.devices.map(safeDevice);
      return json(res, 200, {
        ...state,
        devices: visibleDevices,
        tasks: hasPermission(actor, '创建任务') || hasPermission(actor, '终止任务') || hasPermission(actor, '查看日志') ? state.tasks : [],
        logs: hasPermission(actor, '查看日志') ? state.logs : [],
        users: hasPermission(actor, '用户管理') ? state.users.map(safeUser) : [],
        messages: hasPermission(actor, '创建任务') ? state.messages : [],
        settings: actor.role === '管理员' ? state.settings : undefined,
        auth: actor.role === '管理员' ? safeAuth : undefined,
        currentUser: actor,
      });
    }
    if (req.method === 'PUT' && url.pathname === '/api/settings') {
      if (actor.role !== '管理员') return json(res, 403, { error: '只有管理员可以修改系统设置' });
      const input = await body(req);
      const refreshInterval = Math.max(5, Math.min(3600, Number(input.refreshInterval || 15)));
      const diskThreshold = Math.max(1, Math.min(10000, Number(input.diskThreshold || 40)));
      state.settings = { refreshInterval, diskThreshold, autoClean: Boolean(input.autoClean) };
      audit('修改系统设置', `刷新 ${refreshInterval} 秒 · 磁盘阈值 ${diskThreshold} GB · 自动清理 ${state.settings.autoClean ? '开启' : '关闭'}`);
      await persist();
      return json(res, 200, state.settings);
    }
    if (req.method === 'PUT' && url.pathname === '/api/users') {
      if (!requirePermission(res, actor, '用户管理')) return;
      const input = await body(req);
      if (!Array.isArray(input.users) || input.users.length > 100) throw new Error('用户数据格式不正确');
      const previousUsers = state.users;
      state.users = input.users.map((user, index) => {
        const id = String(user.id || `USER-${Date.now()}-${index}`);
        const previous = previousUsers.find((item) => item.id === id) || previousUsers.find((item) => item.email === user.email);
        const next = {
          id,
          name: String(user.name || '').trim(),
          email: String(user.email || '').trim(),
          role: String(user.role || '操作员'),
          permissions: Array.isArray(user.permissions) ? user.permissions.map(String) : [],
          passwordHash: previous?.passwordHash,
          passwordSalt: previous?.passwordSalt,
          ssoTokenHash: previous?.ssoTokenHash,
          ssoTokenCreatedAt: previous?.ssoTokenCreatedAt,
        };
        if (user.password) {
          if (String(user.password).length < 8) throw new Error('用户密码至少需要8位');
          next.passwordSalt = randomBytes(16).toString('hex');
          next.passwordHash = scryptSync(String(user.password), next.passwordSalt, 64).toString('hex');
        }
        if (!next.passwordHash && next.id !== 'USER-ADMIN') throw new Error(`请为用户 ${next.name || next.email || index + 1} 设置登录密码`);
        return next;
      });
      if (state.users.some((user) => !user.name || !user.email)) throw new Error('姓名和登录邮箱不能为空');
      audit('更新用户权限', `共 ${state.users.length} 个用户`);
      await persist();
      return json(res, 200, state.users.map(safeUser));
    }
    const userSsoMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/sso-token$/);
    if (userSsoMatch && ['POST', 'DELETE'].includes(req.method)) {
      if (!requirePermission(res, actor, '用户管理')) return;
      const userId = decodeURIComponent(userSsoMatch[1]);
      const user = state.users.find((item) => item.id === userId);
      if (!user) return json(res, 404, { error: '用户不存在' });
      if (req.method === 'DELETE') {
        delete user.ssoTokenHash;
        delete user.ssoTokenCreatedAt;
        audit('吊销SSO授权', `${user.name} · ${user.email}`);
        await persist();
        return json(res, 200, safeUser(user));
      }
      const token = `aura_sso_${randomBytes(32).toString('base64url')}`;
      user.ssoTokenHash = tokenHash(token);
      user.ssoTokenCreatedAt = new Date().toISOString();
      audit('生成SSO授权', `${user.name} · ${user.email}`);
      await persist();
      return json(res, 201, { token, user: safeUser(user), exchangeEndpoint: `${allowedOrigin}/api/sso/ticket` });
    }
    if (req.method === 'PUT' && url.pathname === '/api/messages') {
      if (!requirePermission(res, actor, '创建任务')) return;
      const input = await body(req);
      if (!Array.isArray(input.messages) || input.messages.length > 500) throw new Error('发送信息格式不正确');
      state.messages = input.messages.map((item, index) => ({ id: String(item.id || `MSG-${Date.now()}-${index}`), name: String(item.name || '').trim(), content: String(item.content || '') }));
      if (state.messages.some((item) => !item.name)) throw new Error('发送信息名称不能为空');
      audit('更新发送信息', `共 ${state.messages.length} 条`);
      await persist();
      return json(res, 200, state.messages);
    }
    const versionMatch = url.pathname.match(/^\/api\/groups\/([^/]+)\/versions\/([^/]+)\/(restore|delete)$/);
    if (versionMatch && req.method === 'POST') {
      if (!requirePermission(res, actor, '群名管理')) return;
      const deviceId = decodeURIComponent(versionMatch[1]);
      const versionId = decodeURIComponent(versionMatch[2]);
      const action = versionMatch[3];
      const environment = normalizeGroupEnvironment(url.searchParams.get('environment'));
      const key = groupKey(deviceId, environment);
      const device = state.devices.find((item) => item.id === deviceId);
      if (!device) return json(res, 404, { error: '设备不存在' });
      const current = state.groups[key] || { deviceId, environment, names: [], versions: [] };
      const version = (current.versions || []).find((item) => item.id === versionId);
      if (!version) return json(res, 404, { error: '版本不存在' });
      if (action === 'delete') {
        current.versions = current.versions.filter((item) => item.id !== versionId);
        audit('删除群名版本', `${device.name} · ${version.name || version.id}`);
      } else {
        const restoredNames = [...version.names];
        const restoredVersion = createGroupVersion(device, current, restoredNames, `${actor.name}（恢复）`, environment);
        current.names = restoredNames;
        current.updatedAt = restoredVersion.createdAt;
        current.updatedBy = restoredVersion.createdBy;
        current.versions = [restoredVersion, ...(current.versions || [])].slice(0, 30);
        await writeGroupFile(deviceId, restoredNames, environment);
        audit('恢复群名版本', `${device.name} · ${version.name || version.id}`);
      }
      state.groups[key] = current;
      await persist();
      return json(res, 200, current);
    }
    const groupMatch = url.pathname.match(/^\/api\/groups\/([^/]+)$/);
    if (groupMatch) {
      if (!requirePermission(res, actor, '群名管理')) return;
      const deviceId = decodeURIComponent(groupMatch[1]);
      const environment = normalizeGroupEnvironment(url.searchParams.get('environment'));
      const key = groupKey(deviceId, environment);
      const device = state.devices.find((item) => item.id === deviceId);
      if (!device) return json(res, 404, { error: '设备不存在' });
      const current = state.groups[key] || { deviceId, environment, names: [], versions: [] };
      if (req.method === 'GET') return json(res, 200, await readGroupFile(deviceId, environment));
      if (req.method === 'PUT') {
        const input = await body(req);
        const names = (Array.isArray(input.names) ? input.names : String(input.text || '').split(/\r?\n/))
          .map((name) => String(name).replace(/^\uFEFF/, '').trim()).filter(Boolean);
        if (names.length > 5000) throw new Error('单台设备最多维护5000个群名');
        const createdBy = actor.name;
        const version = createGroupVersion(device, current, names, createdBy, environment);
        const now = version.createdAt;
        const versions = [version, ...(current.versions || [])].slice(0, 30);
        state.groups[key] = { deviceId, environment, names, updatedAt: now, updatedBy: actor.name, versions };
        const groupFile = await writeGroupFile(deviceId, names, environment);
        audit('更新群名单', `${deviceId} · ${environment === 'test' ? '测试' : '产线'} · ${names.length}个群 · ${actor.name}`);
        await persist();
        return json(res, 200, { ...state.groups[key], groupFile });
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/devices/refresh') {
      if (!actor.permissions?.length && actor.role !== '管理员') return json(res, 403, { error: '没有设备查看权限' });
      await Promise.all(state.devices.map(collectMetrics)); await persist(); return json(res, 200, state.devices);
    }
    const match = url.pathname.match(/^\/api\/devices\/([^/]+)(?:\/(test|actions))?$/);
    if (match) {
      const device = state.devices.find((d) => d.id === decodeURIComponent(match[1]));
      if (!device) return json(res, 404, { error: '设备不存在' });
      if (req.method === 'POST' && match[2] === 'test') { if (!requirePermission(res, actor, '设备配置')) return; await collectMetrics(device); await persist(); return json(res, device.connected ? 200 : 503, safeDevice(device)); }
      if (req.method === 'POST' && match[2] === 'actions') {
        const input = await body(req); if (!['send', 'stop', 'clean', 'custom'].includes(input.action)) throw new Error('不支持的操作');
        const required = input.action === 'stop' ? '终止任务' : input.action === 'clean' ? '磁盘清理' : '创建任务';
        if (!requirePermission(res, actor, required)) return;
        if (input.action === 'custom' && !(device.customScripts || []).some((item) => item.id === input.scriptId)) throw new Error('请选择设备中已配置的自定义脚本');
        if (input.action === 'send' && input.scriptId && !(device.customScripts || []).some((item) => item.id === input.scriptId)) throw new Error('请选择设备中已配置的发送执行脚本');
        const task = { id: `TASK-${Date.now()}`, deviceId: device.id, action: input.action, scriptId: input.scriptId || null, groupEnvironment: normalizeGroupEnvironment(input.groupEnvironment), sendMode: input.sendMode === 'select' ? 'select' : 'local', messageId: input.messageId || null, type: input.type || input.action, status: input.scheduledAt ? '等待执行' : '待执行', createdAt: new Date().toISOString(), scheduledAt: input.scheduledAt || null, retries: 0 };
        if (task.action === 'send' && task.sendMode === 'select' && !state.messages.some((item) => item.id === task.messageId)) throw new Error('请选择有效的发送消息');
        state.tasks.unshift(task); audit('创建任务', `${task.id} · ${device.name} · ${task.type}`); await persist();
        if (!task.scheduledAt) void executeTask(task);
        return json(res, 202, task);
      }
      if (req.method === 'PUT' && !match[2]) {
        if (!requirePermission(res, actor, '设备配置')) return;
        const input = await body(req);
        const oldId = device.id;
        const nextId = String(input.id || oldId).trim();
        if (state.devices.some((item) => item !== device && item.id === nextId)) throw new Error(`设备编号 ${nextId} 已存在，每台设备必须使用唯一编号`);
        if (input.vncPassword) input.vncPasswordEncrypted = encryptSecret(input.vncPassword);
        delete input.vncPassword;
        Object.assign(device, input, { id: nextId, connected: false });
        ensureRuntimeGroupFile(device);
        validateDevice(device);
        if (nextId !== oldId) {
          for (const environment of ['production', 'test']) {
            const oldKey = groupKey(oldId, environment);
            const nextKey = groupKey(nextId, environment);
            state.groups[nextKey] = { ...(state.groups[oldKey] || { names: [], versions: [] }), deviceId: nextId, environment };
            delete state.groups[oldKey];
          }
          delete state.groups[oldId];
          state.tasks.forEach((task) => { if (task.deviceId === oldId) task.deviceId = nextId; });
        }
        audit('修改设备', `${device.name} · 编号 ${oldId} → ${nextId}`); await persist(); return json(res, 200, safeDevice(device));
      }
      if (req.method === 'DELETE' && !match[2]) { if (!requirePermission(res, actor, '设备配置')) return; state.devices = state.devices.filter((d) => d.id !== device.id); audit('删除设备', device.name); await persist(); return json(res, 200, { ok: true }); }
    }
    if (req.method === 'POST' && url.pathname === '/api/devices') { if (!requirePermission(res, actor, '设备配置')) return; const input = await body(req); if (input.vncPassword) input.vncPasswordEncrypted = encryptSecret(input.vncPassword); delete input.vncPassword; ensureRuntimeGroupFile(input); validateDevice(input); if (state.devices.some((d) => d.id === input.id)) throw new Error('设备编号已存在'); const created = { ...input, connected: false, state: '空闲' }; state.devices.push(created); audit('添加设备', input.name); await persist(); return json(res, 201, safeDevice(created)); }
    if (req.method === 'DELETE' && url.pathname === '/api/tasks') { if (!requirePermission(res, actor, '查看日志')) return; const count = state.tasks.length; state.tasks = []; audit('删除全部任务记录', `共 ${count} 条`); await persist(); return json(res, 200, { ok: true, deleted: count }); }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/tasks/')) { if (!requirePermission(res, actor, '查看日志')) return; const id = decodeURIComponent(url.pathname.slice(11)); state.tasks = state.tasks.filter((t) => t.id !== id); audit('删除任务记录', id); await persist(); return json(res, 200, { ok: true }); }
    if (req.method === 'DELETE' && url.pathname === '/api/logs') { if (!requirePermission(res, actor, '查看日志')) return; const count = state.logs.length; state.logs = []; await persist(); return json(res, 200, { ok: true, deleted: count }); }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/logs/')) { if (!requirePermission(res, actor, '查看日志')) return; const id = Number(decodeURIComponent(url.pathname.slice(10))); state.logs = state.logs.filter((item) => Number(item.id) !== id); await persist(); return json(res, 200, { ok: true }); }
    return json(res, 404, { error: '接口不存在' });
  } catch (error) { return json(res, 400, { error: error.message }); }
});

await loadState();
setInterval(async () => {
  const now = Date.now();
  for (const task of state.tasks.filter((t) => t.status === '等待执行' && new Date(t.scheduledAt).getTime() <= now)) void executeTask(task);
}, 1000);
setInterval(async () => { await Promise.all(state.devices.map(collectMetrics)); await persist(); }, Math.max(5, state.settings.refreshInterval) * 1000);
server.listen(port, '127.0.0.1', () => console.log(`中央执行服务已启动: http://127.0.0.1:${port}`));

// Refresh persisted connection flags immediately after every service restart.
void Promise.all(state.devices.map(collectMetrics)).then(persist).catch((error) => console.error('首次设备状态采集失败:', error.message));
