'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  CircleStop,
  Clock3,
  Cpu,
  FileText,
  HardDrive,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Maximize2,
  MemoryStick,
  Menu,
  MonitorPlay,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Device = {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  identityFile?: string;
  connected?: boolean;
  state: '空闲' | '发送中' | '待清理';
  free: number;
  progress?: number;
  script: string;
  defaultScriptName?: string;
  killScript: string;
  cleanScript: string;
  groupFile: string;
  testGroupFile: string;
  runtimeGroupFile: string;
  remoteDesktopUrl?: string;
  vncUsername?: string;
  vncPassword?: string;
  hasVncPassword?: boolean;
  vncPort?: number;
  customScripts?: Array<{ id: string; name: string; path: string; mode?: 'forward' | 'text' | 'both' }>;
  lastSeen?: string | null;
  lastError?: string | null;
  cpu: number;
  memory: number;
  memoryUsed: number;
  memoryTotal: number;
  diskTotal: number;
};
type Task = {
  id: string;
  device: string;
  type: string;
  status: string;
  created: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
};
type Log = { id: number; time: string; rawTime: string; action: string; detail: string };
type ConsoleUser = { id?: string; name: string; email: string; role: string; permissions: string[]; hasPassword?: boolean; hasSsoToken?: boolean; ssoTokenCreatedAt?: string };
type SignedInUser = { name: string; role: string; permissions: string[] };
type ConsoleSettings = { refreshInterval: number; diskThreshold: number; autoClean: boolean };
type SendMessageItem = { id: string; name: string; content: string };
type GroupEnvironment = 'production' | 'test';
type GroupList = { deviceId: string; environment?: GroupEnvironment; names: string[]; groupFile?: string; fileError?: string | null; fileReadAt?: string | null; updatedAt?: string | null; updatedBy?: string | null; versions?: Array<{ id: string; name?: string; names: string[]; createdAt: string; createdBy: string }> };
const groupStateKey = (deviceId: string, environment: GroupEnvironment) => `${deviceId}:${environment}`;
const EXECUTOR_API = '/api';
let sessionToken = '';

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function inDateRange(value: string | undefined, start: string, end: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  const startTime = start ? new Date(`${start}T00:00:00`).getTime() : -Infinity;
  const endTime = end ? new Date(`${end}T23:59:59`).getTime() : Infinity;
  return time >= startTime && time <= endTime;
}

function formatDuration(durationMs?: number, startedAt?: string, finishedAt?: string) {
  const started = startedAt ? new Date(startedAt).getTime() : 0;
  const finished = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const totalMs = durationMs ?? (started ? Math.max(0, finished - started) : 0);
  if (!totalMs) return '-';
  const totalSeconds = Math.max(1, Math.round(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}小时${minutes}分`;
  if (minutes) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

async function executorRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  const apiPath = `${EXECUTOR_API}${pathname}`;
  // A URL entered as https://user:pass@host may remain in document.baseURI.
  // Resolve API calls against an origin rebuilt without userinfo because Fetch
  // deliberately rejects request URLs containing embedded credentials.
  const requestUrl = typeof window === 'undefined'
    ? apiPath
    : new URL(apiPath, `${window.location.protocol}//${window.location.host}`).toString();
  const response = await fetch(requestUrl, {
    ...init,
    headers: { 'content-type': 'application/json', ...(sessionToken ? { 'x-session-token': sessionToken } : {}), ...(init?.headers || {}) },
  });
  const result = await response.json() as { error?: string; lastError?: string } & T;
  if (!response.ok) throw new Error(result.error || result.lastError || '中央执行服务请求失败');
  return result;
}

function normalizeTask(task: any): Task {
  return {
    id: task.id,
    device: task.deviceId || task.device,
    type: task.type,
    status: task.status,
    created: new Date(task.createdAt || task.created).toLocaleString('zh-CN'),
    createdAt: task.createdAt || task.created,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    durationMs: task.durationMs,
  };
}

function normalizeLog(item: any): Log {
  return {
    id: Number(item.id),
    time: new Date(item.time).toLocaleString('zh-CN'),
    rawTime: item.time,
    action: item.action,
    detail: item.detail,
  };
}
const initialDevices: Device[] = [
  {
    id: '2106',
    name: 'Mac mini 2106',
    ip: '192.168.2.106',
    port: 22,
    username: 'test',
    identityFile: '使用系统默认密钥',
    connected: false,
    state: '空闲',
    free: 0,
    script: '/opt/weixin/zf/twsend/2106/cs.sh',
    defaultScriptName: '默认图文转发',
    killScript: '/opt/weixin/zf/twsend/2106/kill2106.sh',
    cleanScript: '/opt/weixin/zf/twsend/2106/clean2106.sh',
    groupFile: '/opt/weixin/aotmac2106/list/schoollist.txt',
    testGroupFile: '/opt/weixin/csmac2106/list/test.txt',
    runtimeGroupFile: '/opt/weixin/zf/twsend/2106/list/schoollist.txt',
    remoteDesktopUrl: '',
    customScripts: [],
    cpu: 0,
    memory: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    diskTotal: 0,
  },
  {
    id: '2108',
    name: 'Mac mini 2108',
    ip: '192.168.2.108',
    port: 22,
    username: 'test',
    identityFile: '使用系统默认密钥',
    connected: false,
    state: '空闲',
    free: 0,
    script: '/opt/weixin/zf/twsend/2108/cs.sh',
    defaultScriptName: '默认图文转发',
    killScript: '/opt/weixin/zf/twsend/2108/kill2108.sh',
    cleanScript: '/opt/weixin/zf/twsend/2108/clean2108.sh',
    groupFile: '/opt/weixin/aotmac2108/list/schoollist.txt',
    testGroupFile: '/opt/weixin/csmac2108/list/test.txt',
    runtimeGroupFile: '/opt/weixin/zf/twsend/2108/list/schoollist.txt',
    remoteDesktopUrl: '',
    customScripts: [],
    cpu: 0,
    memory: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    diskTotal: 0,
  },
  {
    id: '2104',
    name: 'Mac mini 2104',
    ip: '192.168.2.104',
    port: 22,
    username: 'test',
    identityFile: '使用系统默认密钥',
    connected: false,
    state: '空闲',
    free: 0,
    script: '/opt/weixin/zf/twsend/2104/cs.sh',
    defaultScriptName: '默认图文转发',
    killScript: '/opt/weixin/zf/twsend/2104/kill2104.sh',
    cleanScript: '/opt/weixin/zf/twsend/2104/clean2104.sh',
    groupFile: '/opt/weixin/aotmac2104/list/schoollist.txt',
    testGroupFile: '/opt/weixin/csmac2104/list/test.txt',
    runtimeGroupFile: '/opt/weixin/zf/twsend/2104/list/schoollist.txt',
    remoteDesktopUrl: '',
    customScripts: [],
    cpu: 0,
    memory: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    diskTotal: 0,
  },
];
const menu = [
  ['工作台', LayoutDashboard],
  ['发送中心', Send],
  ['群名管理', ListChecks],
  ['发送信息', Inbox],
  ['设备管理', Server],
  ['任务记录', FileText],
] as const;

export default function Home() {
  const [login, setLogin] = useState(false),
    [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null),
    [mobile, setMobile] = useState(false),
    [active, setActive] = useState('工作台');
  const [devices, setDevices] = useState(initialDevices),
    [groups, setGroups] = useState<Record<string, GroupList>>({}),
    [tasks, setTasks] = useState<Task[]>([]),
    [logs, setLogs] = useState<Log[]>([]),
    [users, setUsers] = useState<ConsoleUser[]>([]),
    [messages, setMessages] = useState<SendMessageItem[]>([]),
    [settings, setSettings] = useState<ConsoleSettings>({ refreshInterval: 15, diskThreshold: 40, autoClean: true });
  const [ssoError, setSsoError] = useState('');
  const [panel, setPanel] = useState<'send' | 'batch' | 'clean' | 'stop' | null>(null),
    [selected, setSelected] = useState('2106'),
    [taskQuery, setTaskQuery] = useState(''),
    [toast, setToast] = useState('');
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 2400);
  };
  const enterSession = (result: { token: string; user: SignedInUser }) => {
    sessionToken = result.token;
    setSignedInUser(result.user);
    const firstPage = result.user.role === '管理员' ? '工作台' : result.user.permissions.includes('群名管理') ? '群名管理' : result.user.permissions.includes('创建任务') ? '发送中心' : result.user.permissions.includes('设备配置') ? '设备管理' : '任务记录';
    setActive(firstPage);
    setLogin(true);
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('sso_token');
    if (!ticket) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setSsoError('正在验证 IT 小爱免登授权…');
    void executorRequest<{ token: string; user: SignedInUser }>('/auth/sso', { method: 'POST', body: JSON.stringify({ ticket }) })
      .then((result) => { setSsoError(''); enterSession(result); })
      .catch((error) => setSsoError(`免登失败：${(error as Error).message}`));
  }, []);
  const syncState = async (showMessage = false) => {
    try {
      const next = await executorRequest<any>('/state');
      setDevices(next.devices || []);
      setGroups(next.groups || {});
      setTasks((next.tasks || []).map(normalizeTask));
      setLogs((next.logs || []).map(normalizeLog));
      setUsers(next.users || []);
      setMessages(next.messages || []);
      if (next.settings) setSettings(next.settings);
      if (showMessage) notify('设备状态和任务记录已刷新');
    } catch (error) {
      if (showMessage) notify(`中央执行服务未连接：${(error as Error).message}`);
    }
  };
  useEffect(() => {
    if (!login) return;
    void syncState();
    const timer = window.setInterval(() => void syncState(), 5000);
    return () => window.clearInterval(timer);
  }, [login]);
  const pick = (id: string, p: 'send' | 'clean' | 'stop') => {
    setSelected(id);
    setPanel(p);
  };
  const mutate = async (kind: 'send' | 'clean' | 'stop' | 'custom', type?: string, scheduledAt?: string, deviceId = selected, scriptId?: string, groupEnvironment: GroupEnvironment = 'production', sendOptions?: { sendMode: 'local' | 'select'; messageId?: string }) => {
    const taskType = type || (kind === 'send' ? '图文发送' : kind === 'clean' ? '磁盘清理' : kind === 'stop' ? '停止发送' : '自定义任务');
    try {
      await executorRequest(`/devices/${encodeURIComponent(deviceId)}/actions`, {
        method: 'POST',
        body: JSON.stringify({ action: kind, type: taskType, scheduledAt, scriptId, groupEnvironment, ...sendOptions }),
      });
      setPanel(null);
      await syncState();
      notify(scheduledAt ? `设备 ${deviceId} 的定时任务已创建` : `设备 ${deviceId} 的任务已提交`);
    } catch (error) {
      notify(`操作失败：${(error as Error).message}`);
    }
  };
  const runAllDevices = async (kind: 'send' | 'clean' | 'stop') => {
    if (!devices.length) return notify('当前没有可操作的设备');
    const label = kind === 'send' ? '开始发送' : kind === 'clean' ? '清理磁盘' : '停止发送';
    const results = await Promise.allSettled(devices.map((device) =>
      executorRequest(`/devices/${encodeURIComponent(device.id)}/actions`, {
        method: 'POST',
        body: JSON.stringify({ action: kind, type: label }),
      }),
    ));
    await syncState();
    const failed = results.filter((result) => result.status === 'rejected').length;
    notify(failed ? `${label}已提交：成功 ${devices.length - failed} 台，失败 ${failed} 台` : `${devices.length} 台设备已提交${label}任务`);
  };
  const clearAllTasks = async () => {
    try {
      await executorRequest('/tasks', { method: 'DELETE' });
      setTasks([]);
      notify('所有任务记录已删除');
    } catch (error) { notify(`删除失败：${(error as Error).message}`); }
  };
  const removeLog = async (id: number) => {
    try {
      await executorRequest(`/logs/${id}`, { method: 'DELETE' });
      setLogs((items) => items.filter((item) => item.id !== id));
      notify('日志已删除');
    } catch (error) { notify(`删除失败：${(error as Error).message}`); }
  };
  const clearAllLogs = async () => {
    try {
      await executorRequest('/logs', { method: 'DELETE' });
      setLogs([]);
      notify('所有操作日志已删除');
    } catch (error) { notify(`删除失败：${(error as Error).message}`); }
  };
  const permissions = signedInUser?.permissions || [];
  const isAdmin = signedInUser?.role === '管理员';
  const allowedMenu = menu.filter(([name]) => isAdmin ||
    (name === '群名管理' && permissions.includes('群名管理')) ||
    (name === '发送中心' && permissions.includes('创建任务')) ||
    (name === '发送信息' && permissions.includes('创建任务')) ||
    (name === '设备管理' && permissions.includes('设备配置')) ||
    (name === '任务记录' && (permissions.includes('创建任务') || permissions.includes('终止任务') || permissions.includes('查看日志'))) ||
    (name === '工作台' && permissions.some((item) => ['创建任务', '终止任务', '磁盘清理', '查看日志', '设备配置'].includes(item))));
  if (!login) return <Login externalMessage={ssoError} onLogin={async (username, password) => {
    const result = await executorRequest<{ token: string; user: SignedInUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    enterSession(result);
  }} />;
  return (
    <div className="min-h-screen bg-[#f3f7f5] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#102c24] text-white transition lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <img src="/aura-controls.png" alt="AURA Controls" className="size-10 rounded-xl object-cover shadow-md shadow-cyan-400/10 ring-1 ring-white/15" />
          <div>
            <b>机器人中控台</b>
            <p className="text-[10px] text-white/45">Mac 自动化管理</p>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <p className="px-3 py-3 text-[10px] tracking-[.18em] text-white/35">
            系统导航
          </p>
          {allowedMenu.map(([n, I]) => (
            <button
              key={n}
              onClick={() => {
                setActive(n);
                setMobile(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active === n ? 'bg-emerald-300 font-medium text-emerald-950' : 'text-white/65 hover:bg-white/5'}`}
            >
              <I className="size-4" />
              {n}
              {n === '发送中心' &&
                tasks.filter((t) => t.status === '发送中').length > 0 && (
                  <span className="ml-auto rounded-full bg-orange-300 px-2 py-0.5 text-[10px] text-orange-950">
                    {tasks.filter((t) => t.status === '发送中').length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900">
            {(signedInUser?.name || 'A').slice(0, 1).toUpperCase()}
          </span>
          <div className="flex-1">
            <p className="text-xs font-medium">{signedInUser?.name || 'Admin'}</p>
            <p className="text-[10px] text-white/40">{signedInUser?.role}</p>
          </div>
          <button onClick={() => { sessionToken = ''; setSignedInUser(null); setLogin(false); }} title="退出">
            <LogOut className="size-4 text-white/40" />
          </button>
        </div>
      </aside>
      <main className="lg:ml-60">
        <header className="sticky top-0 z-30 flex h-20 items-center border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-8">
          <button className="mr-4 lg:hidden" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <p className="text-[10px] text-slate-400">自动化转发管理系统</p>
            <h1 className="font-semibold">{active}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <label className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                value={taskQuery}
                onFocus={() => setActive('任务记录')}
                onChange={(event) => { setTaskQuery(event.target.value); setActive('任务记录'); }}
                placeholder="搜索任务"
                className="h-9 w-56 rounded-lg border bg-slate-50 pl-9 pr-8 text-xs outline-none focus:border-emerald-500 focus:bg-white"
              />
              {taskQuery && <button type="button" onClick={() => setTaskQuery('')} className="absolute right-2 top-2 grid size-5 place-items-center text-slate-400"><X className="size-3" /></button>}
            </label>
            <img
              src="/aura-controls.png"
              alt="AURA Controls"
              title="AURA Controls"
              className="size-9 rounded-lg border border-slate-200 object-cover shadow-sm"
            />
            <button
              onClick={() => notify('当前没有新通知')}
              className="grid size-9 place-items-center rounded-lg border"
            >
              <Bell className="size-4" />
            </button>
            {(isAdmin || permissions.some((item) => ['用户管理', '查看日志', '设备配置'].includes(item))) && <button onClick={() => setActive('设置')} className="grid size-9 place-items-center rounded-lg border"><Settings className="size-4" /></button>}
          </div>
        </header>
        <div className="mx-auto max-w-[1450px] p-5 md:p-8">
          {active === '工作台' && (
            <Dashboard
              devices={devices}
              tasks={tasks}
              logs={logs}
              send={() => pick('2106', 'send')}
              refresh={async () => {
                try {
                  await executorRequest('/devices/refresh', { method: 'POST' });
                  await syncState(true);
                } catch (error) {
                  notify(`刷新失败：${(error as Error).message}`);
                }
              }}
              clean={(id) => pick(id, 'clean')}
              start={(id) => pick(id, 'send')}
              stop={(id) => pick(id, 'stop')}
              cleanAll={() => void runAllDevices('clean')}
              startAll={() => void runAllDevices('send')}
              stopAll={() => void runAllDevices('stop')}
              removeTask={async (id) => {
                try {
                  await executorRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
                  setTasks((t) => t.filter((x) => x.id !== id));
                  notify('任务记录已删除');
                } catch (error) { notify(`删除失败：${(error as Error).message}`); }
              }}
              clearTasks={clearAllTasks}
              removeLog={removeLog}
              clearLogs={clearAllLogs}
            />
          )}
          {active === '发送中心' && (
            <SendCenter
              devices={devices}
              tasks={tasks}
              create={(id) => pick(id, 'send')}
              stop={(id) => pick(id, 'stop')}
              batch={() => setPanel('batch')}
            />
          )}
          {active === '设备管理' && (
            <DeviceManagement
              devices={devices}
              setDevices={setDevices}
              clean={(id) => pick(id, 'clean')}
              notify={notify}
            />
          )}
          {active === '群名管理' && (
            <GroupManagement
              devices={devices}
              groups={groups}
              setGroups={setGroups}
              notify={notify}
            />
          )}
          {active === '发送信息' && <MessageManagement messages={messages} setMessages={setMessages} notify={notify} />}
          {active === '任务记录' && (
            <TaskRecords
              tasks={tasks}
              query={taskQuery}
              setQuery={setTaskQuery}
              remove={async (id) => {
                try {
                  await executorRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
                  setTasks((t) => t.filter((x) => x.id !== id));
                  notify('任务记录已删除');
                } catch (error) { notify(`删除失败：${(error as Error).message}`); }
              }}
              clear={clearAllTasks}
            />
          )}
          {active === '设置' && (
            <SettingsHub
              logs={logs}
              users={users}
              setUsers={setUsers}
              settings={settings}
              setSettings={setSettings}
              clearLogs={async () => {
                try {
                  await clearAllLogs();
                } catch (error) { notify(`清空失败：${(error as Error).message}`); }
              }}
              removeLog={removeLog}
              notify={notify}
            />
          )}
        </div>
      </main>
      {panel && (
        <TaskPanel
          type={panel === 'batch' ? 'send' : panel}
          batch={panel === 'batch'}
          id={selected}
          devices={devices}
          messages={messages}
          free={devices.find((d) => d.id === selected)?.free || 0}
          close={() => setPanel(null)}
          act={mutate}
        />
      )}{' '}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl bg-[#143a30] px-4 py-3 text-sm text-white shadow-xl">
          <CheckCircle2 className="size-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}

function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({
  icon: Icon = Inbox,
  title,
  sub,
}: {
  icon?: typeof Inbox;
  title: string;
  sub: string;
}) {
  return (
    <div className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon />
        </span>
        <h3 className="mt-4 text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
function Head({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b px-5 py-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function DateRangeToolbar({
  start,
  end,
  setStart,
  setEnd,
  extra,
}: {
  start: string;
  end: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-9 rounded-lg border px-2 text-xs" />
      <span className="text-xs text-slate-400">至</span>
      <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="h-9 rounded-lg border px-2 text-xs" />
      {extra}
    </div>
  );
}

function FullscreenPanel({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] bg-white p-5">
      <div className="mb-4 flex items-center justify-between border-b pb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={close} className="grid size-9 place-items-center rounded-lg border hover:bg-slate-50">
          <X className="size-4" />
        </button>
      </div>
      <div className="h-[calc(100vh-88px)] overflow-auto">{children}</div>
    </div>
  );
}

function Dashboard({
  devices,
  tasks,
  logs,
  send,
  refresh,
  clean,
  start,
  stop,
  removeTask,
  clearTasks,
  removeLog,
  clearLogs,
  cleanAll,
  startAll,
  stopAll,
}: {
  devices: Device[];
  tasks: Task[];
  logs: Log[];
  send: () => void;
  refresh: () => void;
  clean: (id: string) => void;
  start: (id: string) => void;
  stop: (id: string) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  removeLog: (id: number) => void;
  clearLogs: () => void;
  cleanAll: () => void;
  startAll: () => void;
  stopAll: () => void;
}) {
  const defaultRange = defaultDateRange();
  const [taskStart, setTaskStart] = useState(defaultRange.start);
  const [taskEnd, setTaskEnd] = useState(defaultRange.end);
  const [logStart, setLogStart] = useState(defaultRange.start);
  const [logEnd, setLogEnd] = useState(defaultRange.end);
  const [fullscreen, setFullscreen] = useState<'tasks' | 'logs' | null>(null);
  const visibleTasks = tasks.filter((task) => inDateRange(task.createdAt, taskStart, taskEnd));
  const visibleLogs = logs.filter((item) => inDateRange(item.rawTime, logStart, logEnd));
  const statCards: Array<[LucideIcon, string, number, string]> = [
    [Server, '配置设备', devices.length, '已录入设备'],
    [Send, '执行中任务', tasks.filter((t) => t.status === '发送中').length, '当前任务队列'],
    [CheckCircle2, '已完成任务', tasks.filter((t) => t.status === '已完成').length, '来自真实任务'],
    [HardDrive, '需清理设备', devices.filter((d) => d.free < 40).length, '低于 40 GB 告警'],
  ];
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#173f34] p-7 text-white">
        <div className="absolute -right-24 -top-32 size-80 rounded-full border-[54px] border-emerald-300/10" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium text-emerald-300">
              ● 系统服务已启动
            </p>
            <h2 className="text-2xl font-semibold md:text-3xl">
              准备开始转发任务
            </h2>
            <p className="mt-2 text-sm text-white/55">
              接入设备接口后，这里将显示真实在线状态、磁盘空间和任务进度。
            </p>
          </div>
          <button
            onClick={send}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-emerald-950"
          >
            <Send className="size-4" />
            创建发送任务
          </button>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map(([I, n, v, s]) => (
          <Card key={String(n)} className="p-5">
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-slate-500">{String(n)}</p>
                <p className="mt-1 text-2xl font-semibold">{String(v)}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <I className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-[10px] text-slate-400">{String(s)}</p>
          </Card>
        ))}
      </section>
      <Card>
        <Head
          title="设备运行状态"
          sub="接入后按真实状态刷新"
          action={<div className="flex flex-wrap justify-end gap-2">
            <button onClick={cleanAll} className="flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-2 text-xs text-orange-700"><Trash2 className="size-3" />一键清理磁盘 All</button>
            <button onClick={startAll} className="flex items-center gap-1.5 rounded-lg bg-[#153c32] px-3 py-2 text-xs text-white"><Play className="size-3" />一键开始发送 All</button>
            <button onClick={stopAll} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"><CircleStop className="size-3" />一键停止发送 All</button>
            <button onClick={refresh} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><RefreshCw className="size-3" />刷新</button>
          </div>}
        />
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              d={d}
              clean={() => clean(d.id)}
              start={() => start(d.id)}
              stop={() => stop(d.id)}
            />
          ))}
        </div>
      </Card>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <Head title="最近任务" sub="默认显示最新7天" action={<DateRangeToolbar start={taskStart} end={taskEnd} setStart={setTaskStart} setEnd={setTaskEnd} extra={<><button onClick={() => setFullscreen('tasks')} className="grid size-9 place-items-center rounded-lg border text-slate-500"><Maximize2 className="size-3.5" /></button>{tasks.length ? <button onClick={clearTasks} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"><Trash2 className="size-3" />删除所有</button> : null}</>} />} />
          {visibleTasks.length ? (
            <TaskTable tasks={visibleTasks.slice(0, 5)} remove={removeTask} />
          ) : (
            <Empty
              title="暂无任务记录"
              sub="当前时间范围内没有任务"
            />
          )}
        </Card>
        <Card>
          <Head title="操作日志" sub="默认显示最新7天" action={<DateRangeToolbar start={logStart} end={logEnd} setStart={setLogStart} setEnd={setLogEnd} extra={<><button onClick={() => setFullscreen('logs')} className="grid size-9 place-items-center rounded-lg border text-slate-500"><Maximize2 className="size-3.5" /></button>{logs.length ? <button onClick={clearLogs} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"><Trash2 className="size-3" />删除所有</button> : null}</>} />} />
          {visibleLogs.length ? (
            <div className="space-y-1 p-3">
              {visibleLogs.slice(0, 6).map((x) => (
                <LogRow key={x.id} x={x} remove={() => removeLog(x.id)} />
              ))}
            </div>
          ) : (
            <Empty
              icon={Activity}
              title="暂无操作日志"
              sub="执行清理、发送或终止后自动生成"
            />
          )}
        </Card>
      </section>
      {fullscreen === 'tasks' && <FullscreenPanel title="最近任务" close={() => setFullscreen(null)}><TaskTable tasks={visibleTasks} remove={removeTask} /></FullscreenPanel>}
      {fullscreen === 'logs' && <FullscreenPanel title="操作日志" close={() => setFullscreen(null)}><div className="space-y-1 p-3">{visibleLogs.map((x) => <LogRow key={x.id} x={x} remove={() => removeLog(x.id)} />)}</div></FullscreenPanel>}
    </div>
  );
}

function SendCenter({
  devices,
  tasks,
  create,
  stop,
  batch,
}: {
  devices: Device[];
  tasks: Task[];
  create: (id: string) => void;
  stop: (id: string) => void;
  batch: () => void;
}) {
  return (
    <div>
      <PageTitle
        title="发送中心"
        sub="选择设备，创建立即执行或定时执行的企业微信转发任务"
        action={
          <div className="flex gap-2"><button onClick={batch} className="flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-800"><Zap className="size-4" />一键发送</button><button onClick={() => create(devices[0]?.id || '')} className="flex h-10 items-center gap-2 rounded-xl bg-[#153c32] px-4 text-sm font-medium text-white"><Plus className="size-4" />新建定制任务</button></div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {devices.map((d) => (
          <Card key={d.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">发送设备</p>
                <h3 className="mt-1 text-lg font-semibold">Mac mini {d.id}</h3>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] ${d.state === '发送中' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
                {d.state}
              </span>
            </div>
            <p className="mt-5 text-xs text-slate-500">
              当前关联任务：
              {
                tasks.filter((t) => t.device === d.id && t.status === '发送中')
                  .length
              }{' '}
              个
            </p>
            <button
              onClick={() => (d.state === '发送中' ? stop(d.id) : create(d.id))}
              className={`mt-5 h-10 w-full rounded-xl text-xs font-medium ${d.state === '发送中' ? 'bg-red-50 text-red-700' : 'bg-[#153c32] text-white'}`}
            >
              {d.state === '发送中' ? '终止当前任务' : '创建定制任务'}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
function GroupManagement({
  devices,
  groups,
  setGroups,
  notify,
}: {
  devices: Device[];
  groups: Record<string, GroupList>;
  setGroups: React.Dispatch<React.SetStateAction<Record<string, GroupList>>>;
  notify: (message: string) => void;
}) {
  const [deviceId, setDeviceId] = useState(devices[0]?.id || '2106');
  const [environment, setEnvironment] = useState<GroupEnvironment>('production');
  const currentKey = groupStateKey(deviceId, environment);
  const current = groups[currentKey] || { deviceId, environment, names: [] };
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchAddText, setBatchAddText] = useState('');
  const [fixedTopName, setFixedTopName] = useState('');
  const [fixedBottomName, setFixedBottomName] = useState('');
  const [previewVersion, setPreviewVersion] = useState<NonNullable<GroupList['versions']>[number] | null>(null);
  const lineRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const readDeviceGroups = async (nextDeviceId: string, nextEnvironment: GroupEnvironment = environment) => {
    setDeviceId(nextDeviceId);
    setEnvironment(nextEnvironment);
    setReading(true);
    try {
      const result = await executorRequest<GroupList>(`/groups/${encodeURIComponent(nextDeviceId)}?environment=${nextEnvironment}`);
      setGroups((currentGroups) => ({ ...currentGroups, [groupStateKey(nextDeviceId, nextEnvironment)]: result }));
    } catch (error) {
      notify(`读取群名文件失败：${(error as Error).message}`);
    } finally { setReading(false); }
  };
  useEffect(() => {
    setDraft((current.names || []).join('\n'));
    setDirty(false);
    setSelectedLines(new Set());
    setFixedTopName((current.names || [])[0] || '');
    setFixedBottomName((current.names || []).length > 1 ? (current.names || [])[(current.names || []).length - 1] : '');
  }, [deviceId, environment, current.updatedAt, (current.names || []).join('\u0000')]);
  const parsed = draft.split(/\r?\n/).map((name) => name.replace(/^\uFEFF/, '').trim()).filter(Boolean);
  const unique = [...new Set(parsed)];
  const duplicateCount = parsed.length - unique.length;
  const deviceGroups = devices.map((device) => groups[groupStateKey(device.id, environment)]).filter(Boolean);
  const allGroupNames = deviceGroups.flatMap((group) => group.names || []);
  const allDuplicateCount = deviceGroups.reduce((total, group) => total + (group.names.length - new Set(group.names).size), 0);
  const lines = draft.split(/\r?\n/);
  const normalizedLines = lines.map((name) => name.replace(/^\uFEFF/, '').trim());
  const fixedTopIndex = fixedTopName ? normalizedLines.findIndex((name) => name === fixedTopName) : -1;
  const fixedBottomIndex = fixedBottomName ? normalizedLines.findLastIndex((name) => name === fixedBottomName) : -1;
  const setLines = (next: string[], focusIndex?: number) => {
    setDraft(next.join('\n'));
    setSelectedLines(new Set());
    setDirty(true);
    if (typeof focusIndex === 'number') window.setTimeout(() => lineRefs.current[focusIndex]?.focus(), 0);
  };
  const visibleLines = lines.map((name, index) => ({ name, index })).filter(({ name }) => !query.trim() || name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectableVisibleIndexes = visibleLines.filter(({ name }) => name.replace(/^\uFEFF/, '').trim()).map(({ index }) => index);
  const allVisibleSelected = selectableVisibleIndexes.length > 0 && selectableVisibleIndexes.every((index) => selectedLines.has(index));
  const toggleVisibleSelection = () => {
    setSelectedLines((currentSelection) => {
      const next = new Set(currentSelection);
      if (allVisibleSelected) selectableVisibleIndexes.forEach((index) => next.delete(index));
      else selectableVisibleIndexes.forEach((index) => next.add(index));
      return next;
    });
  };
  const deleteSelectedLines = () => {
    if (!selectedLines.size) return;
    if (!window.confirm(`确认删除已选择的 ${selectedLines.size} 个群名？保存前仍可撤销。`)) return;
    const deletedNames = lines.filter((_, index) => selectedLines.has(index)).map((name) => name.replace(/^\uFEFF/, '').trim());
    if (deletedNames.includes(fixedTopName)) setFixedTopName('');
    if (deletedNames.includes(fixedBottomName)) setFixedBottomName('');
    setLines(lines.filter((_, index) => !selectedLines.has(index)));
  };
  const updateLine = (index: number, value: string) => {
    const next = [...lines];
    next[index] = value;
    setDraft(next.join('\n'));
    setDirty(true);
  };
  const addLine = () => {
    const insertIndex = fixedBottomIndex > -1 ? fixedBottomIndex : lines.length;
    const next = [...lines];
    next.splice(insertIndex, 0, '');
    setQuery('');
    setLines(next, insertIndex);
  };
  const insertLine = (index: number, position: 'above' | 'below') => {
    const nextIndex = position === 'above' ? index : index + 1;
    const next = [...lines];
    next.splice(nextIndex, 0, '');
    setLines(next, nextIndex);
  };
  const setFixedLine = (index: number, position: 'top' | 'bottom') => {
    const name = normalizedLines[index];
    if (!name) return notify('请先填写群名');
    const next = lines.filter((_, lineIndex) => lineIndex !== index);
    if (position === 'top') {
      next.unshift(lines[index]);
      setFixedTopName(name);
      if (fixedBottomName === name) setFixedBottomName('');
      setLines(next, 0);
      notify('已设为首行，保存后生效');
    } else {
      next.push(lines[index]);
      setFixedBottomName(name);
      if (fixedTopName === name) setFixedTopName('');
      setLines(next, next.length - 1);
      notify('已设为底部，新增群名会插入到它上方');
    }
  };
  const addBatchLines = () => {
    const additions = batchAddText.split(/\r?\n/).map((name) => name.replace(/^\uFEFF/, '').trim()).filter(Boolean);
    if (!additions.length) return notify('请输入需要批量添加的群名');
    const insertIndex = fixedBottomIndex > -1 ? fixedBottomIndex : lines.length;
    const next = [...lines];
    next.splice(insertIndex, 0, ...additions);
    setLines(next, insertIndex);
    setBatchAddText('');
    setBatchAddOpen(false);
    setQuery('');
    notify(`已添加 ${additions.length} 个群名，保存后生效`);
  };
  const save = async () => {
    try {
      const saved = await executorRequest<GroupList>(`/groups/${encodeURIComponent(deviceId)}?environment=${environment}`, {
        method: 'PUT',
        body: JSON.stringify({ names: parsed, operator: '系统管理员' }),
      });
      setGroups((value) => ({ ...value, [currentKey]: saved }));
      setDraft(saved.names.join('\n'));
      setDirty(false);
      notify(`${deviceId} ${environment === 'test' ? '测试' : '产线'}群名单已保存，共 ${saved.names.length} 个群`);
    } catch (error) {
      notify(`保存失败：${(error as Error).message}`);
    }
  };
  const versionAction = async (versionId: string, action: 'restore' | 'delete') => {
    if (action === 'delete' && !window.confirm('确认删除这个群名版本？删除后无法恢复。')) return;
    try {
      const saved = await executorRequest<GroupList>(`/groups/${encodeURIComponent(deviceId)}/versions/${encodeURIComponent(versionId)}/${action}?environment=${environment}`, { method: 'POST' });
      setGroups((value) => ({ ...value, [currentKey]: saved }));
      if (action === 'restore') { setDraft(saved.names.join('\n')); setDirty(false); }
      notify(action === 'restore' ? '群名版本已恢复并写入文件' : '群名版本已删除');
    } catch (error) { notify(`版本操作失败：${(error as Error).message}`); }
  };
  return (
    <div>
      <PageTitle title="群名管理" sub="每台 Mac mini 分别维护产线和测试群名单" action={<div className="flex rounded-xl border bg-white p-1"><button onClick={() => void readDeviceGroups(deviceId, 'production')} className={`rounded-lg px-5 py-2 text-xs font-medium ${environment === 'production' ? 'bg-[#153c32] text-white shadow-sm' : 'text-slate-500'}`}>产线</button><button onClick={() => void readDeviceGroups(deviceId, 'test')} className={`rounded-lg px-5 py-2 text-xs font-medium ${environment === 'test' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>测试</button></div>} />
      <div className="-mx-2 grid gap-3 xl:grid-cols-[200px_minmax(0,1fr)_260px] 2xl:-mx-5">
        <Card className="h-fit p-3">
          <p className="border-b px-2 pb-3 text-sm font-semibold">设备概览</p>
          <div className="mt-3 space-y-2">
            {devices.map((device) => (
              <button key={device.id} onClick={() => void readDeviceGroups(device.id)} className={`w-full rounded-xl border p-3 text-left transition ${deviceId === device.id ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl ${deviceId === device.id ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-500'}`}><Server className="size-5" /></span><span title={device.lastError || ''} className={`flex items-center gap-1 text-[10px] ${device.connected ? 'text-emerald-600' : 'text-orange-600'}`}><i className={`size-1.5 rounded-full ${device.connected ? 'bg-emerald-500' : 'bg-orange-400'}`} />{device.connected ? '在线' : device.lastError ? '连接失败' : '检测中'}</span></div>
                <b className="mt-3 block text-xs">{device.name}</b>
                <span className="mt-2 inline-flex rounded-md border bg-white px-2 py-1 text-[10px] text-slate-500">{groups[groupStateKey(device.id, environment)]?.fileError ? '文件读取失败' : `${environment === 'test' ? '测试' : '产线'} ${groups[groupStateKey(device.id, environment)]?.names?.length || 0} 个群`}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索群名" className="h-9 w-full rounded-lg border bg-slate-50 pl-9 pr-8 text-xs outline-none focus:border-emerald-500 focus:bg-white" />{query && <button onClick={() => setQuery('')} className="absolute right-2 top-2 grid size-5 place-items-center rounded text-slate-400"><X className="size-3" /></button>}</label>
            <span className={`rounded-lg px-3 py-2 text-xs ${duplicateCount ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{duplicateCount ? `发现 ${duplicateCount} 个重复项，请手动删除` : '没有重复项'}</span>
            <button onClick={toggleVisibleSelection} disabled={!selectableVisibleIndexes.length} className="h-9 rounded-lg border px-3 text-xs disabled:opacity-40">{allVisibleSelected ? '取消全选' : query ? '全选搜索结果' : '全选群名'}</button>
            <button onClick={deleteSelectedLines} disabled={!selectedLines.size} className="flex h-9 items-center gap-1 rounded-lg bg-red-50 px-3 text-xs text-red-600 disabled:opacity-40"><Trash2 className="size-3" />删除所选{selectedLines.size ? `（${selectedLines.size}）` : ''}</button>
            <button onClick={() => { setDraft(parsed.join('\n')); setSelectedLines(new Set()); setDirty(true); }} className="h-9 rounded-lg border px-3 text-xs">清除空行</button>
            <button onClick={() => setBatchAddOpen(true)} className="flex h-9 items-center gap-1 rounded-lg border border-emerald-200 px-3 text-xs text-emerald-700"><Upload className="size-3" />批量添加</button>
            <button onClick={addLine} className="flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white"><Plus className="size-3" />添加群名</button>
          </div>
          <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><b className="text-sm">{devices.find((device) => device.id === deviceId)?.name || deviceId} 编辑列表</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${environment === 'test' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{environment === 'test' ? '测试' : '产线'}</span></div><p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">服务端文件：{(environment === 'test' ? devices.find((device) => device.id === deviceId)?.testGroupFile : devices.find((device) => device.id === deviceId)?.groupFile) || current.groupFile}</p>{current.fileError && <p className="mt-1 text-[10px] text-orange-600">{current.fileError}</p>}</div><button onClick={() => void readDeviceGroups(deviceId, environment)} disabled={reading} className={`ml-3 shrink-0 rounded-full px-3 py-1 text-[10px] ${current.fileError ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{reading ? '正在读取…' : current.fileError ? '重新读取' : '刷新文件'}</button></div>
          <div className="h-[470px] overflow-y-auto bg-white">
            {visibleLines.length ? visibleLines.map(({ name, index }) => {
              const normalized = name.replace(/^\uFEFF/, '').trim();
              const duplicate = normalized && parsed.filter((item) => item === normalized).length > 1;
              return <div key={`${index}-${deviceId}-${environment}`} className={`group grid grid-cols-[34px_42px_1fr_230px] items-center border-b border-slate-100 ${selectedLines.has(index) ? 'bg-emerald-50' : duplicate ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}><span className="grid place-items-center"><input type="checkbox" aria-label={`选择群名 ${name || index + 1}`} disabled={!normalized} checked={selectedLines.has(index)} onChange={(event) => setSelectedLines((currentSelection) => { const next = new Set(currentSelection); if (event.target.checked) next.add(index); else next.delete(index); return next; })} className="size-4 accent-emerald-600 disabled:opacity-30" /></span><span className="px-2 text-right font-mono text-[10px] text-slate-400">{index + 1}</span><div className="flex min-w-0 items-center gap-2"><input ref={(element) => { lineRefs.current[index] = element; }} value={name} onChange={(event) => updateLine(index, event.target.value)} placeholder="输入群名" className="h-10 min-w-0 flex-1 bg-transparent px-3 text-xs outline-none focus:bg-emerald-50" />{index === fixedTopIndex && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">首行</span>}{index === fixedBottomIndex && <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700">底部</span>}</div><div className="flex justify-end gap-1 pr-2 opacity-0 transition group-hover:opacity-100"><button onClick={() => insertLine(index, 'above')} title="在上方插入" className="rounded border px-2 py-1 text-[10px] text-slate-500 hover:border-emerald-300 hover:text-emerald-700">上方</button><button onClick={() => insertLine(index, 'below')} title="在下方插入" className="rounded border px-2 py-1 text-[10px] text-slate-500 hover:border-emerald-300 hover:text-emerald-700">下方</button><button onClick={() => setFixedLine(index, 'top')} disabled={!normalized || index === fixedTopIndex} title="设为首行" className="rounded border px-2 py-1 text-[10px] text-slate-500 hover:border-blue-300 hover:text-blue-700 disabled:opacity-30">首行</button><button onClick={() => setFixedLine(index, 'bottom')} disabled={!normalized || index === fixedBottomIndex} title="设为底部" className="rounded border px-2 py-1 text-[10px] text-slate-500 hover:border-orange-300 hover:text-orange-700 disabled:opacity-30">底部</button><button onClick={() => { const deletedName = normalizedLines[index]; if (deletedName === fixedTopName) setFixedTopName(''); if (deletedName === fixedBottomName) setFixedBottomName(''); setLines(lines.filter((_, lineIndex) => lineIndex !== index)); }} title="删除这一行" className="grid size-7 place-items-center rounded text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3" /></button></div></div>;
            }) : <div className="grid h-full place-items-center text-center"><div><Search className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-xs text-slate-500">未找到匹配的群名</p><button onClick={() => setQuery('')} className="mt-2 text-xs text-emerald-700">清除搜索条件</button></div></div>}
          </div>
          <div className="border-t bg-slate-50 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-4 text-[11px] text-slate-500"><span className="text-emerald-700">● 有效 {unique.length}</span><span className={duplicateCount ? 'text-red-600' : ''}>● 重复 {duplicateCount}</span><span>空行 {lines.length - parsed.length}</span>{fixedTopName && <span className="text-blue-700">首行：{fixedTopName}</span>}{fixedBottomName && <span className="text-orange-700">底部：{fixedBottomName}</span>}{query && <span>搜索结果 {visibleLines.length}</span>}{selectedLines.size > 0 && <span className="font-medium text-emerald-700">已选择 {selectedLines.size} 项</span>}</div><button onClick={() => { setDraft((current.names || []).join('\n')); setSelectedLines(new Set()); setFixedTopName((current.names || [])[0] || ''); setFixedBottomName((current.names || []).length > 1 ? (current.names || [])[(current.names || []).length - 1] : ''); setDirty(false); }} disabled={!dirty} className="text-xs text-slate-500 disabled:opacity-30">撤销修改</button></div>
            <button onClick={save} disabled={!dirty} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#153c32] text-sm font-medium text-white disabled:opacity-40"><Save className="size-4" />保存并应用修改</button>
            </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5"><p className="text-sm font-semibold">全部设备群名单统计</p><div className="mt-5 flex items-center gap-5"><div className="grid size-24 place-items-center rounded-full bg-[conic-gradient(#34d399_0_88%,#fca5a5_88%)]"><div className="grid size-16 place-items-center rounded-full bg-white text-center"><b className="text-xl">{allGroupNames.length}</b><span className="-mt-4 text-[9px] text-slate-400">总群数</span></div></div><div className="space-y-3 text-xs"><p><i className="mr-2 inline-block size-2 rounded-full bg-emerald-400" />设备 <b className="ml-2">{devices.length}</b></p><p><i className="mr-2 inline-block size-2 rounded-full bg-emerald-400" />群名记录 <b className="ml-2">{allGroupNames.length}</b></p><p><i className="mr-2 inline-block size-2 rounded-full bg-red-300" />设备内重复 <b className="ml-2">{allDuplicateCount}</b></p></div></div></Card>
          <Card><Head title="版本历史" sub="可预览、恢复或删除历史版本" /><div className="max-h-[390px] divide-y overflow-y-auto">{(current.versions || []).slice(0, 12).map((version) => <div key={version.id} className="relative ml-5 border-l border-slate-200 py-4 pl-5 pr-4 before:absolute before:-left-1 before:top-5 before:size-2 before:rounded-full before:bg-emerald-400"><b className="block break-all text-xs">{version.name || `${devices.find((device) => device.id === deviceId)?.name || deviceId}-${new Date(version.createdAt).toLocaleDateString('zh-CN')}`}</b><div className="mt-1 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">{version.names.length} 个群 · {version.createdBy}</span><span className="whitespace-nowrap text-[9px] text-slate-400">{new Date(version.createdAt).toLocaleString('zh-CN')}</span></div><div className="mt-3 flex gap-2"><button onClick={() => setPreviewVersion(version)} className="rounded-md bg-blue-50 px-2 py-1 text-[10px] text-blue-700">预览</button><button onClick={() => void versionAction(version.id, 'restore')} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">恢复</button><button onClick={() => void versionAction(version.id, 'delete')} className="rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-600">删除</button></div></div>)}{!(current.versions || []).length && <div className="p-8 text-center text-xs text-slate-400">保存群名单后，版本记录会显示在这里</div>}</div></Card>
        </div>
      </div>
      {batchAddOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setBatchAddOpen(false)}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">批量添加群名</h3><p className="mt-1 text-xs text-slate-400">{fixedBottomName ? `将插入到底部群名“${fixedBottomName}”上方` : '将添加到列表末尾'}</p></div><button onClick={() => setBatchAddOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-slate-100"><X className="size-4" /></button></div><textarea value={batchAddText} onChange={(event) => setBatchAddText(event.target.value)} autoFocus placeholder="每行一个群名" className="mt-5 h-56 w-full resize-none rounded-xl border bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:bg-white" /><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => setBatchAddOpen(false)} className="h-10 rounded-xl border text-sm">取消</button><button onClick={addBatchLines} className="h-10 rounded-xl bg-[#153c32] text-sm font-medium text-white">添加到列表</button></div></div></div>}
      {previewVersion && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setPreviewVersion(null)}><div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b p-5"><div><h3 className="font-semibold">{previewVersion.name || '群名历史版本'}</h3><p className="mt-1 text-xs text-slate-400">共 {previewVersion.names.length} 个群 · {new Date(previewVersion.createdAt).toLocaleString('zh-CN')}</p></div><button onClick={() => setPreviewVersion(null)} className="grid size-8 place-items-center rounded-lg hover:bg-slate-100"><X className="size-4" /></button></div><div className="overflow-y-auto p-3">{previewVersion.names.map((name, index) => <div key={`${name}-${index}`} className="grid grid-cols-[44px_1fr] border-b border-slate-100 px-2 py-2.5 text-xs"><span className="font-mono text-slate-400">{index + 1}</span><span>{name}</span></div>)}</div></div></div>}
    </div>
  );
}

function MessageManagement({ messages, setMessages, notify }: { messages: SendMessageItem[]; setMessages: React.Dispatch<React.SetStateAction<SendMessageItem[]>>; notify: (message: string) => void }) {
  const [editing, setEditing] = useState<SendMessageItem | null>(null);
  const saveAll = async (next: SendMessageItem[], success: string) => {
    try {
      const saved = await executorRequest<SendMessageItem[]>('/messages', { method: 'PUT', body: JSON.stringify({ messages: next }) });
      setMessages(saved); setEditing(null); notify(success);
    } catch (error) { notify(`保存失败：${(error as Error).message}`); }
  };
  return <div><PageTitle title="发送信息管理" sub="维护创建发送任务时可选择的信息内容" action={<button onClick={() => setEditing({ id: `MSG-${Date.now()}`, name: '', content: '' })} className="flex h-10 items-center gap-2 rounded-xl bg-[#153c32] px-4 text-xs text-white"><Plus className="size-4" />添加发送信息</button>} /><Card>{messages.length ? messages.map((item, index) => <div key={item.id} className={`grid gap-4 p-5 md:grid-cols-[1fr_2fr_auto] md:items-center ${index ? 'border-t' : ''}`}><div><b className="text-sm">{item.name}</b><p className="mt-1 font-mono text-[10px] text-slate-400">{item.id}</p></div><p className="line-clamp-2 text-xs leading-5 text-slate-500">{item.content || '仅作为任务选项使用，暂未填写具体内容'}</p><div className="flex gap-2"><button onClick={() => setEditing(item)} className="rounded-lg border px-3 py-2 text-xs">编辑</button><button onClick={() => { if (window.confirm(`确认删除“${item.name}”？`)) void saveAll(messages.filter((message) => message.id !== item.id), '发送信息已删除'); }} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">删除</button></div></div>) : <Empty icon={Inbox} title="暂无发送信息" sub="点击右上角添加" />}</Card>{editing && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-4"><form onSubmit={(event) => { event.preventDefault(); const next = messages.some((item) => item.id === editing.id) ? messages.map((item) => item.id === editing.id ? editing : item) : [...messages, editing]; void saveAll(next, '发送信息已保存'); }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{messages.some((item) => item.id === editing.id) ? '编辑发送信息' : '添加发送信息'}</h3><button type="button" onClick={() => setEditing(null)}><X className="size-4" /></button></div><label className="mt-6 block text-xs font-medium">信息名称<input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" /></label><label className="mt-4 block text-xs font-medium">信息内容<textarea value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} className="mt-2 h-36 w-full rounded-xl border p-3 text-sm" placeholder="可选，填写该发送信息的说明或内容" /></label><div className="mt-6 flex gap-3"><button type="button" onClick={() => setEditing(null)} className="h-10 flex-1 rounded-xl border text-sm">取消</button><button className="h-10 flex-1 rounded-xl bg-[#153c32] text-sm text-white">保存</button></div></form></div>}</div>;
}

function DeviceManagement({
  devices,
  setDevices,
  clean,
  notify,
}: {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  clean: (id: string) => void;
  notify: (s: string) => void;
}) {
  const [editing, setEditing] = useState<Device | null>(null),
    [adding, setAdding] = useState(false),
    [deleting, setDeleting] = useState<Device | null>(null);
  const openAdd = () => {
    setAdding(true);
    setEditing({
      id: '',
      name: '',
      ip: '',
      port: 22,
      username: '',
      identityFile: '使用系统默认密钥',
      connected: false,
      state: '空闲',
      free: 0,
      script: '',
      defaultScriptName: '默认图文转发',
      killScript: '',
      cleanScript: '',
      groupFile: '',
      testGroupFile: '',
      runtimeGroupFile: '',
      remoteDesktopUrl: '',
      customScripts: [],
      cpu: 0,
      memory: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      diskTotal: 0,
    });
  };
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget),
      next: Device = {
        ...editing,
        id: String(f.get('id') || editing.id).trim(),
        name: String(f.get('name')),
        ip: String(f.get('ip')),
        port: Number(f.get('port') || 22),
        username: String(f.get('username')),
        identityFile: String(f.get('identityFile') || '使用系统默认密钥'),
        connected: false,
        script: String(f.get('script')),
        defaultScriptName: editing.defaultScriptName || '默认图文转发',
        killScript: String(f.get('killScript')),
        cleanScript: String(f.get('cleanScript')),
        groupFile: String(f.get('groupFile')),
        testGroupFile: String(f.get('testGroupFile')),
        runtimeGroupFile: editing.runtimeGroupFile || '',
        remoteDesktopUrl: String(f.get('remoteDesktopUrl') || ''),
        vncUsername: String(f.get('vncUsername') || ''),
        vncPassword: String(f.get('vncPassword') || editing.vncPassword || ''),
        vncPort: Number(f.get('vncPort') || 5900),
        customScripts: editing.customScripts || [],
        diskTotal: Number(f.get('diskTotal') || 0),
        memoryTotal: Number(f.get('memoryTotal') || 0),
      };
    try {
      const saved = await executorRequest<Device>(adding ? '/devices' : `/devices/${encodeURIComponent(editing.id)}`, {
        method: adding ? 'POST' : 'PUT',
        body: JSON.stringify(next),
      });
      setDevices((v) => adding ? [...v, saved] : v.map((x) => (x.id === editing.id ? saved : x)));
      setEditing(null);
      setAdding(false);
      notify(adding ? '设备已保存，请执行连接测试' : '设备配置已持久保存');
    } catch (error) {
      notify(`保存失败：${(error as Error).message}`);
    }
  };
  return (
    <div>
      <PageTitle
        title="设备管理"
        sub="添加、修改和删除设备，维护连接凭证与执行脚本"
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-[#153c32] px-4 py-2.5 text-xs text-white"
          >
            <Plus className="size-4" />
            添加设备
          </button>
        }
      />
      <Card>
        {devices.length ? (
          devices.map((d, i) => (
            <div
              key={d.id}
              className={`grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr_1.4fr_auto] lg:items-center ${i ? 'border-t' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Server className="size-5" />
                </span>
                <div>
                  <b>{d.name}</b>
                  <p className="text-[10px] text-slate-400">
                    编号 {d.id} · {d.state}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium">
                  {d.ip}:{d.port}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  用户 {d.username} · SSH免密认证
                </p>
              </div>
              <div>
                <p className="truncate font-mono text-[11px] text-slate-600">
                  {d.script}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  磁盘 {d.free} GB 可用 · 内存 {d.memoryTotal} GB
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const checked = await executorRequest<Device>(`/devices/${encodeURIComponent(d.id)}/test`, { method: 'POST' });
                      setDevices((v) => v.map((x) => x.id === d.id ? checked : x));
                      notify(`${d.name} SSH连接和指标采集正常`);
                    } catch (error) {
                      notify(`${d.name} 连接失败：${(error as Error).message}`);
                    }
                  }}
                  className="rounded-lg border px-3 py-2 text-xs"
                >
                  测试连接
                </button>
                <button
                  onClick={() => clean(d.id)}
                  className="rounded-lg border px-3 py-2 text-xs"
                >
                  清理
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setEditing(d);
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs"
                >
                  编辑配置
                </button>
                <button
                  onClick={() => setDeleting(d)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="删除设备"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <Empty icon={Server} title="暂无设备" sub="点击右上角添加设备" />
        )}
      </Card>
      {editing && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/35 p-4">
          <form
            onSubmit={save}
            className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {adding ? '添加设备' : '编辑设备配置'}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  使用当前执行机器的SSH密钥，不在系统中保存设备密码
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="设备名称" name="name" value={editing.name} />
              <Field
                label="设备编号"
                name="id"
                value={editing.id}
              />
              <Field
                label="IP 地址"
                name="ip"
                value={editing.ip}
                placeholder="例如 192.168.1.106"
              />
              <Field label="SSH 端口" name="port" value={editing.port} />
              <Field label="用户名" name="username" value={editing.username} />
              <label className="block text-xs font-medium">
                SSH认证方式
                <select name="identityFile" defaultValue={editing.identityFile || '使用系统默认密钥'} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm">
                  <option>使用系统默认密钥</option>
                  <option>使用SSH配置别名</option>
                  <option>指定私钥路径</option>
                </select>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700"><ShieldCheck className="size-3" />无需保存Mac登录密码</span>
              </label>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium">发送脚本路径（默认图文脚本，可选）<input name="script" value={editing.script} onChange={(event) => setEditing({ ...editing, script: event.target.value })} placeholder="/opt/weixin/zf/twsend/2106/cs.sh" className="mt-2 h-11 w-full rounded-xl border px-3 font-mono text-sm" /></label>
              </div>
              <div className="sm:col-span-2 rounded-xl border p-4">
                <b className="text-xs">VNC远程桌面（可选）</b>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="VNC用户名" name="vncUsername" value={editing.vncUsername || ''} required={false} placeholder="例如 test" />
                  <Field label="VNC密码" name="vncPassword" value="" required={false} placeholder={editing.hasVncPassword ? '已加密保存，留空保持不变' : '未设置'} type="password" />
                  <Field label="VNC端口" name="vncPort" value={editing.vncPort || 5900} required={false} />
                </div>
                <p className="mt-2 text-[10px] text-slate-400">使用设备IP自动生成 vnc:// 连接；点击远程桌面后由VNC客户端连接。</p>
              </div>
              <Field
                label="终止脚本"
                name="killScript"
                value={editing.killScript}
              />
              <Field
                label="磁盘清理脚本"
                name="cleanScript"
                value={editing.cleanScript}
              />
              <div className="sm:col-span-2">
                <Field
                  label="线上群名路径"
                  name="groupFile"
                  value={editing.groupFile}
                  placeholder={`/opt/weixin/aotmac${editing.id || '2104'}/list/schoollist.txt`}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="测试群名路径"
                  name="testGroupFile"
                  value={editing.testGroupFile || ''}
                  placeholder={`/opt/weixin/csmac${editing.id || '2104'}/list/test.txt`}
                />
              </div>
              <p className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">发送任务会由系统自动同步所选的线上或测试群名单，无需另外配置脚本读取路径。</p>
              <div className="sm:col-span-2 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div><b className="text-xs">发送执行脚本组</b><p className="mt-1 text-[10px] text-slate-400">可添加、修改和删除带绝对路径的发送脚本，创建发送任务时直接选择</p></div>
                  <button type="button" onClick={() => setEditing({ ...editing, customScripts: [...(editing.customScripts || []), { id: `SCRIPT-${Date.now()}`, name: '', path: '', mode: 'text' }] })} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><Plus className="size-3" />添加脚本</button>
                </div>
                <div className="mt-3 space-y-3">
                  {editing.script && <div className="grid gap-2 rounded-lg bg-emerald-50 p-2 sm:grid-cols-[1fr_2fr_110px_32px]"><input value={editing.defaultScriptName || '默认图文转发'} onChange={(event) => setEditing({ ...editing, defaultScriptName: event.target.value })} className="h-10 rounded-lg border bg-white px-3 text-xs" /><input value={editing.script} onChange={(event) => setEditing({ ...editing, script: event.target.value })} className="h-10 rounded-lg border bg-white px-3 font-mono text-xs" /><span className="grid h-10 place-items-center rounded-lg border bg-white text-xs text-emerald-700">图文转发</span><button type="button" title="删除默认脚本" onClick={() => setEditing({ ...editing, script: '' })} className="grid size-8 place-items-center self-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button></div>}
                  {(editing.customScripts || []).map((script, index) => (
                    <div key={script.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_110px_32px]">
                      <input value={script.name} onChange={(e) => setEditing({ ...editing, customScripts: (editing.customScripts || []).map((item, i) => i === index ? { ...item, name: e.target.value } : item) })} placeholder="脚本名称" className="h-10 rounded-lg border px-3 text-xs" />
                      <input value={script.path} onChange={(e) => setEditing({ ...editing, customScripts: (editing.customScripts || []).map((item, i) => i === index ? { ...item, path: e.target.value } : item) })} placeholder="/opt/weixin/custom/task.sh" className="h-10 rounded-lg border px-3 font-mono text-xs" />
                      <select value={script.mode || 'both'} onChange={(e) => setEditing({ ...editing, customScripts: (editing.customScripts || []).map((item, i) => i === index ? { ...item, mode: e.target.value as 'forward' | 'text' | 'both' } : item) })} className="h-10 rounded-lg border px-2 text-xs"><option value="forward">图文转发</option><option value="text">文本发送</option><option value="both">通用脚本</option></select>
                      <button type="button" title="删除脚本" onClick={() => setEditing({ ...editing, customScripts: (editing.customScripts || []).filter((_, i) => i !== index) })} className="grid size-8 place-items-center self-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                  {!(editing.customScripts || []).length && <p className="rounded-lg bg-slate-50 p-3 text-center text-[10px] text-slate-400">默认图文脚本已显示在组内；可继续添加文本发送或其他脚本</p>}
                </div>
              </div>
              <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">磁盘容量和内存容量无需填写，设备连接成功后由系统自动采集。</div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 rounded-xl border px-5 text-sm"
              >
                取消
              </button>
              <button className="h-10 rounded-xl bg-[#153c32] px-5 text-sm font-medium text-white">
                {adding ? '添加设备' : '保存配置'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid size-12 place-items-center rounded-xl bg-red-50 text-red-600">
              <Trash2 />
            </span>
            <h3 className="mt-5 text-lg font-semibold">
              删除设备 {deleting.id}？
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              设备配置和连接信息将从控制台移除，历史任务记录不会被删除。
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="h-10 flex-1 rounded-xl border text-sm"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  try {
                    await executorRequest(`/devices/${encodeURIComponent(deleting.id)}`, { method: 'DELETE' });
                    setDevices((v) => v.filter((x) => x.id !== deleting.id));
                    setDeleting(null);
                    notify('设备已删除');
                  } catch (error) {
                    notify(`删除失败：${(error as Error).message}`);
                  }
                }}
                className="h-10 flex-1 rounded-xl bg-red-600 text-sm text-white"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  name,
  value,
  placeholder,
  disabled,
  required = true,
  type = 'text',
}: {
  label: string;
  name: string;
  value: string | number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        type={type}
        className="mt-2 h-11 w-full rounded-xl border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
      />
    </label>
  );
}
function TaskRecords({
  tasks,
  query,
  setQuery,
  remove,
  clear,
}: {
  tasks: Task[];
  query: string;
  setQuery: (value: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}) {
  const defaultRange = defaultDateRange();
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);
  const [fullscreen, setFullscreen] = useState(false);
  const filteredTasks = tasks
    .filter((task) => inDateRange(task.createdAt, start, end))
    .filter((task) => [task.id, task.device, task.type, task.status, task.created].some((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  return (
    <div>
      <PageTitle
        title="任务记录"
        sub="查看、筛选和删除实际任务记录"
        action={
          tasks.length ? (
            <button
              onClick={clear}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"
            >
              <Trash2 className="size-3" />
              清空全部
            </button>
          ) : undefined
        }
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务编号、设备、类型或状态" className="h-10 w-full rounded-xl border bg-slate-50 pl-10 pr-10 text-sm outline-none focus:border-emerald-500 focus:bg-white" />{query && <button onClick={() => setQuery('')} className="absolute right-3 top-2.5 grid size-5 place-items-center text-slate-400"><X className="size-4" /></button>}</label>
          <DateRangeToolbar start={start} end={end} setStart={setStart} setEnd={setEnd} extra={<button onClick={() => setFullscreen(true)} className="grid size-9 place-items-center rounded-lg border text-slate-500"><Maximize2 className="size-3.5" /></button>} />
        </div>
        <p className="mt-2 text-xs text-slate-400">当前显示 {filteredTasks.length} 条任务，默认最近7天</p>
      </Card>
      <Card>
        {filteredTasks.length ? (
          <TaskTable tasks={filteredTasks} remove={remove} />
        ) : (
          <Empty title={query ? '没有匹配的任务' : '没有任务记录'} sub={query ? '请尝试更换搜索关键词' : '这里不会再展示任何预置或演示数据'} />
        )}
      </Card>
      {fullscreen && <FullscreenPanel title="任务记录" close={() => setFullscreen(false)}><TaskTable tasks={filteredTasks} remove={remove} /></FullscreenPanel>}
    </div>
  );
}
function TaskTable({
  tasks,
  remove,
}: {
  tasks: Task[];
  remove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 text-[10px] text-slate-400">
          <tr>
            {['任务编号', '设备', '类型', '创建时间', '耗时', '状态', '操作'].map(
              (x) => (
                <th className={`px-5 py-3 ${x === '状态' ? 'w-24 min-w-24' : ''}`} key={x}>
                  {x}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr className="border-t" key={t.id}>
              <td className="px-5 py-4 font-mono text-xs">{t.id}</td>
              <td className="px-5 py-4">{t.device}</td>
              <td className="px-5 py-4">{t.type}</td>
              <td className="px-5 py-4 text-xs text-slate-500">{t.created}</td>
              <td className="px-5 py-4 text-xs text-slate-500">{formatDuration(t.durationMs, t.startedAt, t.finishedAt)}</td>
              <td className="w-24 min-w-24 px-5 py-4">
                <span className="inline-flex min-w-14 justify-center whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-[10px] text-blue-700">
                  {t.status}
                </span>
              </td>
              <td className="px-5 py-4">
                <button
                  onClick={() => remove(t.id)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="删除"
                >
                  <Trash2 className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LogRecords({ logs, clear, remove }: { logs: Log[]; clear: () => void; remove: (id: number) => void }) {
  const defaultRange = defaultDateRange();
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);
  const [fullscreen, setFullscreen] = useState(false);
  const visibleLogs = logs.filter((item) => inDateRange(item.rawTime, start, end));
  return (
    <div>
      <PageTitle
        title="操作日志"
        sub="记录清理、发送、终止和配置操作，默认显示最新7天"
        action={
          <DateRangeToolbar start={start} end={end} setStart={setStart} setEnd={setEnd} extra={<><button onClick={() => setFullscreen(true)} className="grid size-9 place-items-center rounded-lg border text-slate-500"><Maximize2 className="size-3.5" /></button>{logs.length ? <button onClick={clear} className="rounded-lg border px-3 py-2 text-xs">清空日志</button> : null}</>} />
        }
      />
      <Card>
        {visibleLogs.length ? (
          <div className="p-3">
            {visibleLogs.map((x) => (
              <LogRow key={x.id} x={x} remove={() => remove(x.id)} />
            ))}
          </div>
        ) : (
          <Empty
            icon={Activity}
            title="暂无操作日志"
            sub="系统不会展示虚构日志，实际操作后自动生成"
          />
        )}
      </Card>
      {fullscreen && <FullscreenPanel title="操作日志" close={() => setFullscreen(false)}><div className="space-y-1 p-3">{visibleLogs.map((x) => <LogRow key={x.id} x={x} remove={() => remove(x.id)} />)}</div></FullscreenPanel>}
    </div>
  );
}
function LogRow({ x, remove }: { x: Log; remove?: () => void }) {
  return (
    <div className="flex gap-3 rounded-xl p-3 hover:bg-slate-50">
      <i className="mt-1.5 size-2 rounded-full bg-emerald-500" />
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <b>{x.action}</b>
          <time className="text-[10px] text-slate-400">{x.time}</time>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{x.detail}</p>
      </div>
      {remove && <button type="button" onClick={remove} title="删除此条日志" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button>}
    </div>
  );
}
function SettingsHub({
  logs,
  clearLogs,
  removeLog,
  notify,
  users,
  setUsers,
  settings,
  setSettings,
}: {
  logs: Log[];
  clearLogs: () => void;
  removeLog: (id: number) => void;
  notify: (s: string) => void;
  users: ConsoleUser[];
  setUsers: React.Dispatch<React.SetStateAction<ConsoleUser[]>>;
  settings: ConsoleSettings;
  setSettings: React.Dispatch<React.SetStateAction<ConsoleSettings>>;
}) {
  const [tab, setTab] = useState<'system' | 'users' | 'logs'>('system');
  return (
    <div>
      <PageTitle title="设置" sub="集中管理系统参数、用户权限和操作日志" />
      <div className="mb-6 flex w-fit gap-1 rounded-xl border bg-white p-1">
        {[
          ['system', '系统设置', Settings],
          ['users', '用户与权限', Users],
          ['logs', '操作日志', Activity],
        ].map(([id, name, I]) => (
          <button
            key={String(id)}
            onClick={() => setTab(id as typeof tab)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${tab === id ? 'bg-[#153c32] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <I className="size-4" />
            {String(name)}
          </button>
        ))}
      </div>
      {tab === 'system' && <SystemSettings notify={notify} settings={settings} setSettings={setSettings} />}{' '}
      {tab === 'users' && <UserManagement notify={notify} users={users} setUsers={setUsers} />}{' '}
      {tab === 'logs' && <LogRecords logs={logs} clear={clearLogs} remove={removeLog} />}
    </div>
  );
}
function UserManagement({ notify, users, setUsers }: { notify: (s: string) => void; users: ConsoleUser[]; setUsers: React.Dispatch<React.SetStateAction<ConsoleUser[]>> }) {
  const [modal, setModal] = useState<'add' | 'edit' | null>(null),
    [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [ssoCredential, setSsoCredential] = useState<{ userName: string; token: string; exchangeEndpoint: string } | null>(null);
  const generateSsoToken = async (user: ConsoleUser) => {
    if (!user.id) return;
    if (user.hasSsoToken && !window.confirm(`重新生成后，“${user.name}”原来的 IT 小爱授权密钥将立即失效，是否继续？`)) return;
    try {
      const result = await executorRequest<{ token: string; user: ConsoleUser; exchangeEndpoint: string }>(`/users/${encodeURIComponent(user.id)}/sso-token`, { method: 'POST' });
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item));
      setSsoCredential({ userName: user.name, token: result.token, exchangeEndpoint: result.exchangeEndpoint });
      notify('IT 小爱授权密钥已生成，请立即安全保存');
    } catch (error) { notify(`生成失败：${(error as Error).message}`); }
  };
  const revokeSsoToken = async (user: ConsoleUser) => {
    if (!user.id || !window.confirm(`确认吊销“${user.name}”的 IT 小爱免登授权？`)) return;
    try {
      const saved = await executorRequest<ConsoleUser>(`/users/${encodeURIComponent(user.id)}/sso-token`, { method: 'DELETE' });
      setUsers((current) => current.map((item) => item.id === user.id ? saved : item));
      notify('IT 小爱免登授权已吊销');
    } catch (error) { notify(`吊销失败：${(error as Error).message}`); }
  };
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const permissions = data.getAll('permissions').map(String);
    const next = { name: String(data.get('name') || '新用户'), email: String(data.get('email') || ''), role: String(data.get('role') || '操作员'), permissions, password: String(data.get('password') || '') };
    const updated = modal === 'add' ? [...users, next] : users.map((u, i) => i === editingIndex ? { ...u, ...next } : u);
    try {
      const saved = await executorRequest<ConsoleUser[]>('/users', { method: 'PUT', body: JSON.stringify({ users: updated }) });
      setUsers(saved);
      setModal(null);
      setEditingIndex(null);
      notify(modal === 'add' ? '用户已添加并持久保存' : '用户权限已持久保存');
    } catch (error) { notify(`保存失败：${(error as Error).message}`); }
  };
  return (
    <div>
      <PageTitle
        title="用户与权限"
        sub="控制用户可以查看和执行的操作"
        action={
          <button
            onClick={() => { setEditingIndex(null); setModal('add'); }}
            className="flex items-center gap-2 rounded-xl bg-[#153c32] px-4 py-2.5 text-xs text-white"
          >
            <UserPlus className="size-4" />
            新增用户
          </button>
        }
      />
      <Card>
        {users.map((u, i) => (
          <div
            key={u.email}
            className={`grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto] md:items-center ${i ? 'border-t' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                {u.name[0]}
              </span>
              <div>
                <b className="text-sm">{u.name}</b>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
            </div>
            <div><span className="w-fit rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-700">{u.role}</span><p className="mt-2 text-[10px] text-slate-400">已授权 {u.permissions.length} 项功能</p></div>
            <div className="flex flex-wrap justify-end gap-2"><button onClick={() => void generateSsoToken(u)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs text-emerald-700">{u.hasSsoToken ? '重置免登密钥' : '生成免登密钥'}</button>{u.hasSsoToken && <button onClick={() => void revokeSsoToken(u)} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">吊销免登</button>}<button onClick={() => { setEditingIndex(i); setModal('edit'); }} className="rounded-lg border px-3 py-2 text-xs">编辑设置</button></div>
          </div>
        ))}
      </Card>
      {ssoCredential && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setSsoCredential(null)}><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">IT 小爱免登授权密钥</h3><p className="mt-1 text-xs text-slate-500">用户：{ssoCredential.userName} · 密钥只显示这一次</p></div><button onClick={() => setSsoCredential(null)}><X className="size-4" /></button></div><div className="mt-5 rounded-xl bg-orange-50 p-4 text-xs leading-5 text-orange-700">请立即复制到 IT 小爱的安全配置中。中控台只保存哈希，关闭后无法再次查看原文。</div><label className="mt-4 block text-xs font-medium">长期授权密钥<textarea readOnly value={ssoCredential.token} className="mt-2 h-24 w-full resize-none rounded-xl border bg-slate-50 p-3 font-mono text-xs" /></label><label className="mt-4 block text-xs font-medium">换取一次性登录地址接口<input readOnly value={ssoCredential.exchangeEndpoint} className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-3 font-mono text-xs" /></label><button onClick={async () => { try { await navigator.clipboard.writeText(ssoCredential.token); notify('授权密钥已复制'); } catch { notify('浏览器无法自动复制，请手动选择密钥复制'); } }} className="mt-5 h-11 w-full rounded-xl bg-[#153c32] text-sm font-medium text-white">复制授权密钥</button></div></div>}
      {modal && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {modal === 'add' ? '新增用户' : '编辑管理员设置'}
              </h3>
              <button type="button" onClick={() => setModal(null)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-medium">
                姓名
                <input
                  name="name"
                  defaultValue={modal === 'edit' && editingIndex !== null ? users[editingIndex].name : ''}
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-medium">
                登录邮箱
                <input
                  name="email"
                  type="email"
                  defaultValue={modal === 'edit' && editingIndex !== null ? users[editingIndex].email : ''}
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-medium">
                登录密码
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required={modal === 'add'}
                  autoComplete="new-password"
                  placeholder={modal === 'add' ? '至少 8 位' : '留空表示不修改密码'}
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-medium">
                角色
                <select
                  name="role"
                  defaultValue={modal === 'edit' && editingIndex !== null ? users[editingIndex].role : '操作员'}
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                >
                  <option>管理员</option>
                  <option>主管</option>
                  <option>操作员</option>
                  <option>审计员</option>
                </select>
              </label>
              <fieldset className="rounded-xl border p-4">
                <legend className="px-1 text-xs font-medium">功能权限</legend>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  {[
                    '创建任务',
                    '终止任务',
                    '磁盘清理',
                    '查看日志',
                    '设备配置',
                    '群名管理',
                    '用户管理',
                  ].map((x) => (
                    <label key={x} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="permissions"
                        value={x}
                        defaultChecked={modal === 'edit' && editingIndex !== null ? users[editingIndex].permissions.includes(x) : false}
                        className="accent-emerald-600"
                      />
                      {x}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="h-10 flex-1 rounded-xl border text-sm"
              >
                取消
              </button>
              <button className="h-10 flex-1 rounded-xl bg-[#153c32] text-sm text-white">
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function SystemSettings({ notify, settings, setSettings }: { notify: (s: string) => void; settings: ConsoleSettings; setSettings: React.Dispatch<React.SetStateAction<ConsoleSettings>> }) {
  const [interval, setInterval] = useState(String(settings.refreshInterval)),
    [threshold, setThreshold] = useState(String(settings.diskThreshold)),
    [autoClean, setAutoClean] = useState(settings.autoClean),
    [currentPassword, setCurrentPassword] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [confirmPassword, setConfirmPassword] = useState(''),
    [passwordError, setPasswordError] = useState(''),
    [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setInterval(String(settings.refreshInterval));
    setThreshold(String(settings.diskThreshold));
    setAutoClean(settings.autoClean);
  }, [settings]);

  async function saveSettings() {
    try {
      const saved = await executorRequest<ConsoleSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ refreshInterval: Number(interval), diskThreshold: Number(threshold), autoClean }),
      });
      setSettings(saved);
      notify('系统设置已持久保存');
    } catch (error) { notify(`保存失败：${(error as Error).message}`); }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError('');
    if (newPassword.length < 8) return setPasswordError('新密码至少需要 8 位');
    if (newPassword !== confirmPassword) return setPasswordError('两次输入的新密码不一致');
    setPasswordSaving(true);
    try {
      await executorRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify('管理员密码修改成功，下次登录请使用新密码');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : '密码修改失败');
    } finally {
      setPasswordSaving(false);
    }
  }
  return (
    <div>
      <PageTitle title="系统设置" sub="管理状态刷新、磁盘清理和任务安全策略" />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <Head title="运行参数" sub="修改后点击保存生效" />
          <div className="space-y-5 p-5">
            <label className="block text-xs font-medium">
              设备状态刷新间隔（秒）
              <input
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                type="number"
                min="5"
                className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-medium">
              磁盘空间告警阈值（GB）
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                type="number"
                min="10"
                className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <b className="text-sm">发送前自动清理</b>
                <p className="mt-1 text-xs text-slate-400">
                  磁盘不足时先执行清理脚本
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoClean}
                onChange={(e) => setAutoClean(e.target.checked)}
                className="size-5 accent-emerald-600"
              />
            </label>
            <button
              onClick={saveSettings}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#153c32] text-sm font-medium text-white"
            >
              <Save className="size-4" />
              保存设置
            </button>
          </div>
        </Card>
        <Card>
          <Head title="服务状态" sub="后台组件连接情况" />
          <div className="space-y-3 p-5">
            {[
              ['任务调度服务', '正常'],
              ['设备通信接口', '已连接'],
              ['日志存储', '已启用'],
            ].map(([a, b], i) => (
              <div
                className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                key={a}
              >
                <span className="flex items-center gap-2 text-xs">
                  <Wifi
                    className="size-4 text-emerald-600"
                  />
                  {a}
                </span>
                <span
                  className="text-[10px] text-emerald-700"
                >
                  {b}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Head title="管理员密码" sub="修改当前 admin 账号的登录密码" />
          <form className="space-y-4 p-5" onSubmit={changePassword}>
            <label className="block text-xs font-medium">
              当前密码
              <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium">
              新密码
              <input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" placeholder="至少 8 位" />
            </label>
            <label className="block text-xs font-medium">
              确认新密码
              <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            {passwordError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{passwordError}</p>}
            <button disabled={passwordSaving} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#153c32] text-sm font-medium text-white disabled:opacity-50">
              <ShieldCheck className="size-4" />
              {passwordSaving ? '正在保存…' : '修改密码'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  detail,
  color = 'bg-emerald-500',
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  color?: string;
  icon: typeof Cpu;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5 text-slate-500">
          <Icon className="size-3" />
          {label}
        </span>
        <b>{detail}</b>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
function VncLauncher({ device, href }: { device: Device; href: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  async function copyAddress() {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(href);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = href;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
        textarea.remove();
      }
      setMessage('连接地址已复制');
    } catch {
      setMessage('浏览器禁止自动复制，请手动选择上方地址复制');
    }
  }
  function launchClient() {
    setMessage('已请求打开VNC客户端；如果没有响应，请先安装VNC Viewer并关联 vnc:// 协议');
    window.location.href = href;
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex h-9 items-center justify-center rounded-lg border border-emerald-200 text-xs text-emerald-700">VNC远程桌面</button>
    {open && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setOpen(false)}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">连接 {device.name}</h3><p className="mt-1 text-xs text-slate-400">通过本机安装的VNC客户端打开</p></div><button onClick={() => setOpen(false)}><X className="size-4" /></button></div><div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-xs"><p><span className="text-slate-400">连接地址：</span><code className="select-all break-all">{href}</code></p><p><span className="text-slate-400">用户名：</span>{device.vncUsername || device.username}</p><p><span className="text-slate-400">密码：</span>{device.hasVncPassword ? '已加密配置' : '未配置，将由VNC客户端询问'}</p></div><p className="mt-4 text-xs leading-5 text-orange-700">浏览器不能直接显示原生VNC画面。Windows需要安装 RealVNC Viewer、TigerVNC 等客户端，并允许浏览器打开 vnc:// 链接。</p>{message && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">{message}</p>}<div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => void copyAddress()} className="h-10 rounded-xl border text-xs">复制连接地址</button><button type="button" onClick={launchClient} className="h-10 rounded-xl bg-[#153c32] text-xs text-white">打开VNC客户端</button></div></div></div>}
  </>;
}
function DeviceCard({
  d,
  clean,
  start,
  stop,
}: {
  d: Device;
  clean: () => void;
  start: () => void;
  stop: () => void;
}) {
  const remoteHref = d.vncUsername ? `vnc://${encodeURIComponent(d.vncUsername)}@${d.ip}:${d.vncPort || 5900}` : d.remoteDesktopUrl;
  const connectionError = d.lastError?.includes('Permission denied')
    ? `SSH密钥未被该Mac授权。请从服务端执行 ssh-copy-id ${d.username}@${d.ip}，或检查该用户的 authorized_keys。`
    : d.lastError;
  if (!d.connected) {
    return (
      <article className="rounded-2xl border border-dashed p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><Server className="size-5" /></span>
          <div><b>{d.name}</b><p className="text-[10px] text-orange-600">未连接 · 运行数据待采集</p></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {['CPU', '内存', '磁盘'].map((x) => <div key={x} className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[10px] text-slate-400">{x}</p><b className="mt-1 block text-sm">--</b></div>)}
        </div>
        <div className="mt-4 rounded-lg bg-orange-50 p-3 text-[10px] leading-4 text-orange-700">
          <b className="block">{d.lastError ? '连接失败原因' : '正在等待首次检测'}</b>
          <span className="mt-1 block break-all">{connectionError || '服务启动后会自动采集设备状态，也可以在设备管理中点击“测试连接”。'}</span>
          <span className="mt-1 block text-orange-600">连接地址：{d.username}@{d.ip}:{d.port}</span>
        </div>
        <div className={`mt-4 grid gap-2 ${remoteHref ? 'grid-cols-4' : 'grid-cols-3'}`}><button disabled className="h-9 rounded-lg border text-xs opacity-40">磁盘清理</button><button disabled className="h-9 rounded-lg bg-slate-200 text-xs text-slate-400">开始发送</button><button disabled className="h-9 rounded-lg bg-red-50 text-xs text-red-400 opacity-40">停止发送</button>{remoteHref && <VncLauncher device={d} href={remoteHref} />}</div>
      </article>
    );
  }
  let running = d.state === '发送中',
    warn = d.state === '待清理',
    diskUsed = Math.round((d.diskTotal - d.free) * 10) / 10,
    diskPercent = Math.round((diskUsed / d.diskTotal) * 100);
  return (
    <article
      className={`rounded-2xl border p-4 ${warn ? 'border-orange-200 bg-orange-50/30' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-xl ${running ? 'bg-blue-50 text-blue-600' : warn ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}
        >
          <Server className="size-5" />
        </span>
        <div>
          <b>{d.name}</b>
          <p className="text-[10px] text-slate-400">在线 · 运行指标已更新</p>
        </div>
        <span
          className={`ml-auto rounded-full px-2 py-1 text-[10px] ${running ? 'bg-blue-50 text-blue-700' : warn ? 'bg-orange-100 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {d.state}
        </span>
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-3">
        <Meter
          icon={Cpu}
          label="CPU 使用率"
          value={d.cpu}
          detail={`${d.cpu}%`}
          color={d.cpu > 80 ? 'bg-red-500' : 'bg-blue-500'}
        />
        <Meter
          icon={MemoryStick}
          label="内存使用率"
          value={d.memory}
          detail={`${d.memoryUsed} / ${d.memoryTotal} GB`}
          color="bg-violet-500"
        />
        <Meter
          icon={HardDrive}
          label="磁盘使用率"
          value={diskPercent}
          detail={`${diskUsed} / ${d.diskTotal} GB`}
          color={diskPercent > 85 ? 'bg-orange-500' : 'bg-emerald-500'}
        />
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[10px]">
          <span className="text-slate-500">磁盘剩余</span>
          <b className={d.free < 40 ? 'text-orange-600' : 'text-emerald-700'}>
            {d.free} GB · {100 - diskPercent}%
          </b>
        </div>
      </div>
      {running && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px]">
            <span>任务进度</span>
            <b>{d.progress}%</b>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${d.progress}%` }}
            />
          </div>
        </div>
      )}
      <div className={`mt-5 grid gap-2 ${remoteHref ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <button
          onClick={clean}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border text-xs"
        >
          <Trash2 className="size-3" />
          磁盘清理
        </button>
        <button
          onClick={start}
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#153c32] text-xs text-white"
        >
          <Play className="size-3" />
          开始发送
        </button>
        <button onClick={stop} className="flex h-9 items-center justify-center gap-2 rounded-lg bg-red-50 text-xs text-red-700"><CircleStop className="size-3" />停止发送</button>
        {remoteHref && <VncLauncher device={d} href={remoteHref} />}
      </div>
    </article>
  );
}
function Login({ onLogin, externalMessage = '' }: { onLogin: (username: string, password: string) => Promise<void>; externalMessage?: string }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <main className="grid min-h-screen bg-[#eef3f1] lg:grid-cols-2">
      <section className="hidden bg-[#102d25] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <img src="/aura-controls.png" alt="AURA Controls" className="size-16 rounded-2xl object-cover shadow-lg shadow-cyan-400/10 ring-1 ring-white/15" />
          <div><b className="block">机器人中控台</b><span className="text-[10px] tracking-[.16em] text-cyan-200/70">AURA CONTROLS</span></div>
        </div>
        <div>
          <p className="mb-5 text-sm text-emerald-300">安全 · 稳定 · 可追溯</p>
          <h1 className="text-5xl font-semibold leading-tight">
            让每一次自动化转发
            <br />
            都清晰可控
          </h1>
          <p className="mt-6 max-w-xl leading-7 text-white/55">
            集中管理多台 Mac
            mini，自动完成磁盘检查、脚本执行、任务终止与操作审计。
          </p>
        </div>
        <p className="text-xs text-white/35">内部管理系统 · 操作全程留痕</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true); setError('');
            try { await onLogin(username, password); }
            catch (reason) { setError((reason as Error).message); }
            finally { setLoading(false); }
          }}
          className="w-full max-w-md rounded-3xl bg-white p-9 shadow-2xl shadow-emerald-950/10"
        >
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src="/aura-controls.png" alt="AURA Controls" className="size-16 rounded-2xl object-cover shadow-md" />
            <div><b className="block text-sm">机器人中控台</b><span className="text-[10px] tracking-[.14em] text-slate-400">AURA CONTROLS</span></div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
            <ShieldCheck className="size-3" />
            授权访问
          </span>
          <h2 className="mt-5 text-3xl font-semibold">欢迎回来</h2>
          <p className="mt-2 text-sm text-slate-500">
            请使用管理员分配的账号登录
          </p>
          <label className="mt-8 block text-xs font-medium">
            账号
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-slate-50 px-4 text-sm"
            />
          </label>
          <label className="mt-5 block text-xs font-medium">
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-slate-50 px-4 text-sm"
            />
          </label>
          {externalMessage && <p className={`mt-4 rounded-xl p-3 text-xs ${externalMessage.startsWith('正在') ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>{externalMessage}</p>}
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>}
          <button disabled={loading} className="mt-7 h-12 w-full rounded-xl bg-[#12382e] text-sm font-semibold text-white disabled:opacity-50">
            {loading ? '正在验证…' : '登录系统'}
          </button>
        </form>
      </section>
    </main>
  );
}
function Panel({
  type,
  id,
  free,
  close,
  act,
}: {
  type: 'send' | 'clean' | 'stop';
  id: string;
  free: number;
  close: () => void;
  act: (x: 'send' | 'clean' | 'stop', t?: string) => void;
}) {
  const [kind, setKind] = useState('图片发送');
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25"
      onMouseDown={close}
    >
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-white p-8 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="float-right grid size-9 place-items-center rounded-lg bg-slate-100"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium text-emerald-700">Mac mini {id}</p>
        <h2 className="mt-1 text-2xl font-semibold">
          {type === 'send'
            ? '创建发送任务'
            : type === 'clean'
              ? '磁盘清理确认'
              : '终止任务确认'}
        </h2>
        {type === 'send' ? (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {['图片发送', '图文信息'].map((x, i) => (
                <button
                  key={x}
                  onClick={() => setKind(x)}
                  className={`rounded-xl p-4 text-left ${kind === x ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}
                >
                  {i ? (
                    <FileText className="mb-4 size-5" />
                  ) : (
                    <Upload className="mb-4 size-5 text-emerald-600" />
                  )}
                  <b className="block text-sm">{x}</b>
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium">
              任务名称
              <input
                defaultValue={`${id}-新建转发任务`}
                className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
              />
            </label>
            <div className="grid h-32 place-items-center rounded-xl border border-dashed bg-slate-50 text-center">
              <div>
                <Upload className="mx-auto mb-2 size-5 text-slate-400" />
                <p className="text-xs">点击或拖放图片到这里</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  JPG、PNG，单个不超过 20 MB
                </p>
              </div>
            </div>
            <button
              onClick={() => act('send', kind)}
              className="h-12 w-full rounded-xl bg-[#153c32] text-sm font-semibold text-white"
            >
              确认并开始发送
            </button>
          </div>
        ) : (
          <div className="mt-10">
            <span
              className={`grid size-16 place-items-center rounded-2xl ${type === 'stop' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}
            >
              {type === 'stop' ? <CircleStop /> : <HardDrive />}
            </span>
            <h3 className="mt-6 text-lg font-semibold">
              {type === 'stop'
                ? '确定终止正在执行的任务？'
                : '清理设备上的临时文件？'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {type === 'stop'
                ? '系统将运行安全终止脚本并核验进程。'
                : `当前记录的可用空间 ${free} GB，仅清理缓存和任务临时文件。`}
            </p>
            {type === 'stop' && (
              <textarea
                placeholder="请输入终止原因"
                className="mt-5 h-24 w-full rounded-xl border p-3 text-sm"
              />
            )}
            <div className="mt-8 flex gap-3">
              <button
                onClick={close}
                className="h-11 flex-1 rounded-xl border text-sm"
              >
                取消
              </button>
              <button
                onClick={() => act(type)}
                className={`h-11 flex-1 rounded-xl text-sm font-semibold text-white ${type === 'stop' ? 'bg-red-600' : 'bg-orange-500'}`}
              >
                确认{type === 'stop' ? '终止' : '清理'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function TaskPanel({
  type,
  id,
  devices,
  messages,
  batch = false,
  free,
  close,
  act,
}: {
  type: 'send' | 'clean' | 'stop';
  id: string;
  devices: Device[];
  messages: SendMessageItem[];
  batch?: boolean;
  free: number;
  close: () => void;
  act: (x: 'send' | 'clean' | 'stop' | 'custom', t?: string, scheduledAt?: string, deviceId?: string, scriptId?: string, groupEnvironment?: GroupEnvironment, sendOptions?: { sendMode: 'local' | 'select'; messageId?: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'local' | 'select'>('local'),
    [timing, setTiming] = useState<'now' | 'schedule'>('now'),
    [startAt, setStartAt] = useState(''),
    [content, setContent] = useState(''),
    [deviceId, setDeviceId] = useState(id),
    [groupEnvironment, setGroupEnvironment] = useState<GroupEnvironment>('production'),
    [scriptChoice, setScriptChoice] = useState('send'),
    [multi, setMulti] = useState(batch),
    [batchDeviceIds, setBatchDeviceIds] = useState<string[]>(devices.map((device) => device.id)),
    [batchScripts, setBatchScripts] = useState<Record<string, string>>(Object.fromEntries(devices.map((device) => [device.id, 'send'])));
  const selectedDevice = devices.find((device) => device.id === deviceId) || devices[0];
  const submit = async () => {
    if (timing === 'schedule' && !startAt) return;
    if (mode === 'select' && !content) return;
    if (!multi && mode === 'select' && !scriptChoice) return;
    if (!multi && scriptChoice === 'send' && !selectedDevice?.script) return;
    if (multi && batchDeviceIds.some((targetId) => !(batchScripts[targetId] || (mode === 'local' ? 'send' : '')))) return;
    if (multi && batchDeviceIds.some((targetId) => (batchScripts[targetId] || (mode === 'local' ? 'send' : '')) === 'send' && !devices.find((device) => device.id === targetId)?.script)) return;
    const scheduledAt = timing === 'schedule' ? new Date(startAt).toISOString() : undefined;
    if (multi) {
      await Promise.all(batchDeviceIds.map((targetId) => {
        const device = devices.find((item) => item.id === targetId)!;
        const choice = batchScripts[targetId] || 'send';
        const customId = choice.startsWith('custom:') ? choice.slice(7) : undefined;
        const customName = device.customScripts?.find((script) => script.id === customId)?.name;
        const action = choice === 'clean' ? 'clean' : 'send';
        return act(action, `一键发送 · ${groupEnvironment === 'test' ? '测试群' : '正式群'} · ${customName || (choice === 'clean' ? '磁盘清理' : '图文发送')} · ${timing === 'now' ? '立即执行' : `定时 ${startAt.replace('T', ' ')}`}`, scheduledAt, targetId, customId, groupEnvironment, { sendMode: mode, messageId: mode === 'select' ? content : undefined });
      }));
      return;
    }
    const customId = scriptChoice.startsWith('custom:') ? scriptChoice.slice(7) : undefined;
    const customName = selectedDevice?.customScripts?.find((script) => script.id === customId)?.name;
    const action = scriptChoice === 'clean' ? 'clean' : 'send';
    const scriptName = scriptChoice === 'clean' ? '磁盘清理' : customName || '图文发送';
    const selectedMessageName = messages.find((message) => message.id === content)?.name;
    if (action === 'send' && mode === 'select' && !content) return;
    const label = `${scriptName} · ${groupEnvironment === 'test' ? '测试群' : '正式群'} · ${mode === 'local' ? '脚本默认发送内容' : `选择发送消息：${selectedMessageName}`} · ${timing === 'now' ? '立即执行' : `定时 ${startAt.replace('T', ' ')}`}`;
    await act(action, label, scheduledAt, deviceId, customId, groupEnvironment, { sendMode: mode, messageId: mode === 'select' ? content : undefined });
  };
  const compatibleScripts = (device: Device) => (device.customScripts || []).filter((script) => !script.mode || script.mode === 'both' || script.mode === (mode === 'select' ? 'text' : 'forward'));
  const executionSelector = multi ? (
    <div><p className="mb-2 text-xs font-medium">执行设备与脚本</p><div className="space-y-2 rounded-xl border p-3">{devices.map((device) => <div key={device.id} className="grid grid-cols-[24px_1fr_1.4fr] items-center gap-3 rounded-lg bg-slate-50 p-3"><input type="checkbox" checked={batchDeviceIds.includes(device.id)} onChange={(e) => setBatchDeviceIds((current) => e.target.checked ? [...current, device.id] : current.filter((item) => item !== device.id))} className="size-4 accent-emerald-600" /><span className="text-xs font-medium">{device.name}</span><select disabled={!batchDeviceIds.includes(device.id)} value={batchScripts[device.id] || (mode === 'select' ? '' : device.script ? 'send' : '')} onChange={(e) => setBatchScripts({ ...batchScripts, [device.id]: e.target.value })} className="h-9 min-w-0 rounded-lg border bg-white px-2 text-xs disabled:opacity-40">{mode === 'local' && device.script && <option value="send">{device.defaultScriptName || '默认图文转发'}</option>}<option value="">请选择执行脚本</option>{compatibleScripts(device).map((script) => <option key={script.id} value={`custom:${script.id}`}>{script.name}</option>)}</select></div>)}</div></div>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-medium">执行设备<select value={deviceId} onChange={(e) => { const nextDevice = devices.find((device) => device.id === e.target.value); setDeviceId(e.target.value); setScriptChoice(mode === 'select' || !nextDevice?.script ? '' : 'send'); }} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm">{devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.connected ? '在线' : '未连接'}</option>)}</select></label><label className="block text-xs font-medium">执行脚本<select value={scriptChoice} onChange={(e) => setScriptChoice(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm">{mode === 'local' && selectedDevice?.script && <option value="send">{selectedDevice.defaultScriptName || '默认图文转发'}</option>}<option value="">请选择执行脚本</option>{compatibleScripts(selectedDevice).map((script) => <option key={script.id} value={`custom:${script.id}`}>{script.name}</option>)}</select></label></div>
  );
  const transferSelector = <>
    <div><p className="mb-2 text-xs font-medium">转发方式</p><div className="grid grid-cols-2 gap-3"><button onClick={() => { setMode('local'); setScriptChoice(selectedDevice?.script ? 'send' : ''); setBatchScripts(Object.fromEntries(devices.map((device) => [device.id, device.script ? 'send' : '']))); }} className={`rounded-xl p-4 text-left ${mode === 'local' ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}><MonitorPlay className="mb-3 size-5 text-emerald-700" /><b className="block text-sm">直接转发现有消息</b><span className="mt-1 block text-[10px] leading-4 text-slate-500">按所选执行脚本转发企业微信中预设的图片或图文</span></button><button onClick={() => { setMode('select'); setScriptChoice(''); setBatchScripts({}); }} className={`rounded-xl p-4 text-left ${mode === 'select' ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}><FileText className="mb-3 size-5 text-emerald-700" /><b className="block text-sm">发送指定文本内容</b><span className="mt-1 block text-[10px] leading-4 text-slate-500">向所选正式群或测试群发送后台维护的文本</span></button></div></div>
  </>;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25"
      onMouseDown={close}
    >
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-7 shadow-2xl md:p-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="float-right grid size-9 place-items-center rounded-lg bg-slate-100"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium text-emerald-700">{multi ? '多设备批量任务' : `Mac mini ${id}`}</p>
        <h2 className="mt-1 text-2xl font-semibold">
          {type === 'send'
            ? multi ? '创建多设备发送任务' : '创建单设备发送任务'
            : type === 'clean'
              ? '磁盘清理确认'
              : '终止任务确认'}
        </h2>
        {type === 'send' ? (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setMulti(false)} className={`h-10 rounded-lg text-xs font-medium ${!multi ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>单台Mini</button>
              <button type="button" onClick={() => setMulti(true)} className={`h-10 rounded-lg text-xs font-medium ${multi ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>多台Mini同时发送</button>
            </div>
            <label className="block text-xs font-medium">
              任务名称
              <input defaultValue={multi ? '多设备一键发送任务' : `${id}-企业微信转发任务`} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            {transferSelector}
            {executionSelector}
            {mode === 'select' && <label className="block text-xs font-medium">选择文本内容<select value={content} onChange={(e) => setContent(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"><option value="">请选择已配置的文本内容</option>{messages.map((message) => <option key={message.id} value={message.id}>{message.name}</option>)}</select></label>}
            {mode === 'select' && ((!multi && !compatibleScripts(selectedDevice).length) || (multi && batchDeviceIds.some((targetId) => !compatibleScripts(devices.find((device) => device.id === targetId)!).length))) && <p className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-700">所选设备尚未配置“文本发送”脚本。请先到设备管理的发送执行脚本组中添加文本脚本。</p>}
            <div>
              <p className="mb-2 text-xs font-medium">发送群列表</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setGroupEnvironment('production')} className={`rounded-xl border p-4 text-left ${groupEnvironment === 'production' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : ''}`}><b className="block text-sm">正式群列表</b><span className="mt-1 block text-[10px] text-slate-500">使用设备配置中的线上群名路径</span></button>
                <button type="button" onClick={() => setGroupEnvironment('test')} className={`rounded-xl border p-4 text-left ${groupEnvironment === 'test' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : ''}`}><b className="block text-sm">测试群列表</b><span className="mt-1 block text-[10px] text-slate-500">使用设备配置中的测试群名路径</span></button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium">开始执行时间</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTiming('now')}
                  className={`flex items-center gap-3 rounded-xl p-4 text-left ${timing === 'now' ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}
                >
                  <Play className="size-5" />
                  <div>
                    <b className="block text-sm">立即执行</b>
                    <span className="text-[10px] text-slate-500">
                      确认后马上运行脚本
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setTiming('schedule')}
                  className={`flex items-center gap-3 rounded-xl p-4 text-left ${timing === 'schedule' ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}
                >
                  <Clock3 className="size-5" />
                  <div>
                    <b className="block text-sm">定时执行</b>
                    <span className="text-[10px] text-slate-500">
                      到指定时间自动启动
                    </span>
                  </div>
                </button>
              </div>
            </div>
            {timing === 'schedule' && (
              <label className="block text-xs font-medium">
                计划开始时间
                <input
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  type="datetime-local"
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                />
                {!startAt && (
                  <span className="mt-1 block text-[10px] text-orange-600">
                    请选择任务开始日期和时间
                  </span>
                )}
              </label>
            )}
            <div className="rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">
              <b className="block">执行说明</b>
              {timing === 'now'
                ? `确认后将在 ${selectedDevice?.name || deviceId} 上立即执行所选脚本。`
                : `任务会进入待执行队列，到达指定时间后在 ${selectedDevice?.name || deviceId} 上运行所选脚本。`}
            </div>
            <button
              onClick={submit}
              disabled={
                (timing === 'schedule' && !startAt) ||
                (mode === 'select' && !content) || (multi && batchDeviceIds.length === 0)
              }
              className="h-12 w-full rounded-xl bg-[#153c32] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {timing === 'now' ? '确认并立即执行' : '创建定时任务'}
            </button>
          </div>
        ) : (
          <div className="mt-10">
            <span
              className={`grid size-16 place-items-center rounded-2xl ${type === 'stop' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}
            >
              {type === 'stop' ? <CircleStop /> : <HardDrive />}
            </span>
            <h3 className="mt-6 text-lg font-semibold">
              {type === 'stop'
                ? '确定终止正在执行的任务？'
                : '清理设备上的临时文件？'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {type === 'stop'
                ? '系统将运行安全终止脚本并核验进程。'
                : `当前记录的可用空间 ${free} GB，仅清理缓存和任务临时文件。`}
            </p>
            {type === 'stop' && (
              <textarea
                placeholder="请输入终止原因"
                className="mt-5 h-24 w-full rounded-xl border p-3 text-sm"
              />
            )}
            <div className="mt-8 flex gap-3">
              <button
                onClick={close}
                className="h-11 flex-1 rounded-xl border text-sm"
              >
                取消
              </button>
              <button
                onClick={() => act(type)}
                className={`h-11 flex-1 rounded-xl text-sm font-semibold text-white ${type === 'stop' ? 'bg-red-600' : 'bg-orange-500'}`}
              >
                确认{type === 'stop' ? '终止' : '清理'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
