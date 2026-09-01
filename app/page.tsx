'use client';
import { useState } from 'react';
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
  LogOut,
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
  killScript: string;
  cleanScript: string;
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
};
type Log = { id: number; time: string; action: string; detail: string };
const initialDevices: Device[] = [
  {
    id: '2106',
    name: 'Mac mini 2106',
    ip: '192.168.1.106',
    port: 22,
    username: 'weixin',
    identityFile: '使用系统默认密钥',
    connected: false,
    state: '空闲',
    free: 0,
    script: '/opt/weixin/zf/twsend/2106/cs.sh',
    killScript: '/opt/weixin/zf/twsend/2106/kill2106.sh',
    cleanScript: '/opt/weixin/zf/twsend/2106/clean2106.sh',
    cpu: 0,
    memory: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    diskTotal: 0,
  },
  {
    id: '2108',
    name: 'Mac mini 2108',
    ip: '192.168.1.108',
    port: 22,
    username: 'weixin',
    identityFile: '使用系统默认密钥',
    connected: false,
    state: '空闲',
    free: 0,
    script: '/opt/weixin/zf/twsend/2108/cs.sh',
    killScript: '/opt/weixin/zf/twsend/2108/kill2108.sh',
    cleanScript: '/opt/weixin/zf/twsend/2108/clean2108.sh',
    cpu: 0,
    memory: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    diskTotal: 0,
  },
  {
    id: '2104',
    name: 'Mac mini 2104',
    ip: '192.168.1.104',
    port: 22,
    username: 'weixin',
    identityFile: '使用系统默认密钥',
    connected: false,
    state: '空闲',
    free: 0,
    script: '/opt/weixin/zf/twsend/2104/cs.sh',
    killScript: '/opt/weixin/zf/twsend/2104/kill2104.sh',
    cleanScript: '/opt/weixin/zf/twsend/2104/clean2104.sh',
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
  ['设备管理', Server],
  ['任务记录', FileText],
] as const;

export default function Home() {
  const [login, setLogin] = useState(false),
    [mobile, setMobile] = useState(false),
    [active, setActive] = useState('工作台');
  const [devices, setDevices] = useState(initialDevices),
    [tasks, setTasks] = useState<Task[]>([]),
    [logs, setLogs] = useState<Log[]>([]);
  const [panel, setPanel] = useState<'send' | 'clean' | 'stop' | null>(null),
    [selected, setSelected] = useState('2106'),
    [toast, setToast] = useState('');
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 2400);
  };
  const pick = (id: string, p: 'send' | 'clean' | 'stop') => {
    setSelected(id);
    setPanel(p);
  };
  const log = (action: string, detail: string) =>
    setLogs((v) => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        action,
        detail,
      },
      ...v,
    ]);
  const mutate = (kind: 'send' | 'clean' | 'stop', type = '图片发送') => {
    const device = devices.find((d) => d.id === selected);
    const command =
      kind === 'send'
        ? device?.script
        : kind === 'stop'
          ? device?.killScript
          : device?.cleanScript;
    setDevices((ds) =>
      ds.map((d) =>
        d.id === selected
          ? kind === 'send'
            ? { ...d, state: '发送中', progress: 0 }
            : kind === 'clean'
              ? { ...d, state: '空闲', free: 168 }
              : { ...d, state: '空闲', progress: undefined }
          : d,
      ),
    );
    if (kind === 'send') {
      const id = `TASK-${String(Date.now()).slice(-8)}`;
      setTasks((t) => [
        {
          id,
          device: selected,
          type,
          status: '发送中',
          created: new Date().toLocaleString('zh-CN'),
        },
        ...t,
      ]);
      log(
        '创建发送任务',
        `${selected} · 调用 ${command || '未配置发送脚本'} · ${type}`,
      );
    }
    if (kind === 'clean')
      log('磁盘清理', `${selected} · 调用 ${command || '未配置清理脚本'}`);
    if (kind === 'stop') {
      setTasks((t) =>
        t.map((x) =>
          x.device === selected && x.status === '发送中'
            ? { ...x, status: '已终止' }
            : x,
        ),
      );
      log('终止任务', `${selected} · 调用 ${command || '未配置终止脚本'}`);
    }
    setPanel(null);
    notify(
      kind === 'send'
        ? `设备 ${selected} 已开始执行任务`
        : kind === 'clean'
          ? `${selected} 磁盘清理完成`
          : `${selected} 的任务已安全终止`,
    );
  };
  if (!login) return <Login onLogin={() => setLogin(true)} />;
  return (
    <div className="min-h-screen bg-[#f3f7f5] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#102c24] text-white transition lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-emerald-950">
            <Zap className="size-5" />
          </span>
          <div>
            <b>流转中控台</b>
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
          {menu.map(([n, I]) => (
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
            管
          </span>
          <div className="flex-1">
            <p className="text-xs font-medium">系统管理员</p>
            <p className="text-[10px] text-white/40">admin@company.cn</p>
          </div>
          <button onClick={() => setLogin(false)} title="退出">
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
            <button
              onClick={() => setActive('任务记录')}
              className="hidden items-center gap-2 rounded-lg border px-3 text-xs text-slate-500 md:flex"
            >
              <Search className="size-4" />
              搜索任务
            </button>
            <button
              onClick={() => notify('当前没有新通知')}
              className="grid size-9 place-items-center rounded-lg border"
            >
              <Bell className="size-4" />
            </button>
            <button
              onClick={() => setActive('设置')}
              className="grid size-9 place-items-center rounded-lg border"
            >
              <Settings className="size-4" />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1450px] p-5 md:p-8">
          {active === '工作台' && (
            <Dashboard
              devices={devices}
              tasks={tasks}
              logs={logs}
              send={() => pick('2106', 'send')}
              refresh={() => notify('设备状态已刷新')}
              clean={(id) => pick(id, 'clean')}
              run={(id, state) =>
                pick(id, state === '发送中' ? 'stop' : 'send')
              }
              removeTask={(id) => {
                setTasks((t) => t.filter((x) => x.id !== id));
                notify('任务记录已删除');
              }}
            />
          )}
          {active === '发送中心' && (
            <SendCenter
              devices={devices}
              tasks={tasks}
              create={(id) => pick(id, 'send')}
              stop={(id) => pick(id, 'stop')}
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
          {active === '任务记录' && (
            <TaskRecords
              tasks={tasks}
              remove={(id) => {
                setTasks((t) => t.filter((x) => x.id !== id));
                notify('任务记录已删除');
              }}
              clear={() => {
                setTasks([]);
                notify('任务记录已清空');
              }}
            />
          )}
          {active === '设置' && (
            <SettingsHub
              logs={logs}
              clearLogs={() => {
                setLogs([]);
                notify('操作日志已清空');
              }}
              notify={notify}
            />
          )}
        </div>
      </main>
      {panel && (
        <TaskPanel
          type={panel}
          id={selected}
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

function Dashboard({
  devices,
  tasks,
  logs,
  send,
  refresh,
  clean,
  run,
  removeTask,
}: {
  devices: Device[];
  tasks: Task[];
  logs: Log[];
  send: () => void;
  refresh: () => void;
  clean: (id: string) => void;
  run: (id: string, s: Device['state']) => void;
  removeTask: (id: string) => void;
}) {
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
        {[
          [Server, '配置设备', devices.length, '已录入设备'],
          [
            Send,
            '执行中任务',
            tasks.filter((t) => t.status === '发送中').length,
            '当前任务队列',
          ],
          [
            CheckCircle2,
            '已完成任务',
            tasks.filter((t) => t.status === '已完成').length,
            '来自真实任务',
          ],
          [
            HardDrive,
            '需清理设备',
            devices.filter((d) => d.free < 40).length,
            '低于 40 GB 告警',
          ],
        ].map(([I, n, v, s]) => (
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
          action={
            <button
              onClick={refresh}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
            >
              <RefreshCw className="size-3" />
              刷新
            </button>
          }
        />
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              d={d}
              clean={() => clean(d.id)}
              run={() => run(d.id, d.state)}
            />
          ))}
        </div>
      </Card>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <Head title="最近任务" sub="仅显示实际创建的任务" />
          {tasks.length ? (
            <TaskTable tasks={tasks.slice(0, 5)} remove={removeTask} />
          ) : (
            <Empty
              title="暂无任务记录"
              sub="创建发送任务后，记录会显示在这里"
            />
          )}
        </Card>
        <Card>
          <Head title="实时操作日志" sub="仅记录实际操作" />
          {logs.length ? (
            <div className="space-y-1 p-3">
              {logs.slice(0, 6).map((x) => (
                <LogRow key={x.id} x={x} />
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
    </div>
  );
}

function SendCenter({
  devices,
  tasks,
  create,
  stop,
}: {
  devices: Device[];
  tasks: Task[];
  create: (id: string) => void;
  stop: (id: string) => void;
}) {
  return (
    <div>
      <PageTitle
        title="发送中心"
        sub="选择设备，创建立即执行或定时执行的企业微信转发任务"
        action={
          <button
            onClick={() => create('2106')}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#153c32] px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            新建定制任务
          </button>
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
      killScript: '',
      cleanScript: '',
      cpu: 0,
      memory: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      diskTotal: 0,
    });
  };
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget),
      next: Device = {
        ...editing,
        id: String(f.get('id')),
        name: String(f.get('name')),
        ip: String(f.get('ip')),
        port: Number(f.get('port') || 22),
        username: String(f.get('username')),
        identityFile: String(f.get('identityFile') || '使用系统默认密钥'),
        connected: false,
        script: String(f.get('script')),
        killScript: String(f.get('killScript')),
        cleanScript: String(f.get('cleanScript')),
        diskTotal: Number(f.get('diskTotal') || 0),
        memoryTotal: Number(f.get('memoryTotal') || 0),
      };
    setDevices((v) =>
      adding ? [...v, next] : v.map((x) => (x.id === editing.id ? next : x)),
    );
    setEditing(null);
    setAdding(false);
    notify(adding ? '设备已添加，请测试SSH连接' : '设备配置已更新，请重新测试连接');
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
                disabled={!adding}
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
                <Field
                  label="发送脚本路径"
                  name="script"
                  value={editing.script}
                />
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
                保存设备
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
                onClick={() => {
                  setDevices((v) => v.filter((x) => x.id !== deleting.id));
                  setDeleting(null);
                  notify('设备已删除');
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
}: {
  label: string;
  name: string;
  value: string | number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        required
        className="mt-2 h-11 w-full rounded-xl border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
      />
    </label>
  );
}
function TaskRecords({
  tasks,
  remove,
  clear,
}: {
  tasks: Task[];
  remove: (id: string) => void;
  clear: () => void;
}) {
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
      <Card>
        {tasks.length ? (
          <TaskTable tasks={tasks} remove={remove} />
        ) : (
          <Empty title="没有任务记录" sub="这里不会再展示任何预置或演示数据" />
        )}
      </Card>
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
            {['任务编号', '设备', '类型', '创建时间', '状态', '操作'].map(
              (x) => (
                <th className="px-5 py-3" key={x}>
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
              <td className="px-5 py-4">
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] text-blue-700">
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
function LogRecords({ logs, clear }: { logs: Log[]; clear: () => void }) {
  return (
    <div>
      <PageTitle
        title="操作日志"
        sub="记录清理、发送、终止和配置操作"
        action={
          logs.length ? (
            <button
              onClick={clear}
              className="rounded-lg border px-3 py-2 text-xs"
            >
              清空日志
            </button>
          ) : undefined
        }
      />
      <Card>
        {logs.length ? (
          <div className="p-3">
            {logs.map((x) => (
              <LogRow key={x.id} x={x} />
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
    </div>
  );
}
function LogRow({ x }: { x: Log }) {
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
    </div>
  );
}
function SettingsHub({
  logs,
  clearLogs,
  notify,
}: {
  logs: Log[];
  clearLogs: () => void;
  notify: (s: string) => void;
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
      {tab === 'system' && <SystemSettings notify={notify} />}{' '}
      {tab === 'users' && <UserManagement notify={notify} />}{' '}
      {tab === 'logs' && <LogRecords logs={logs} clear={clearLogs} />}
    </div>
  );
}
function UserManagement({ notify }: { notify: (s: string) => void }) {
  const [modal, setModal] = useState<'add' | 'edit' | null>(null),
    [editingIndex, setEditingIndex] = useState<number | null>(null),
    [users, setUsers] = useState([
      { name: '系统管理员', email: 'admin@company.cn', role: '管理员', permissions: ['创建任务','终止任务','磁盘清理','查看日志','设备配置','用户管理'] },
    ]);
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const permissions = data.getAll('permissions').map(String);
    const next = { name: String(data.get('name') || '新用户'), email: String(data.get('email') || ''), role: String(data.get('role') || '操作员'), permissions };
    if (modal === 'add')
      setUsers((v) => [
        ...v,
        next,
      ]);
    else if (editingIndex !== null) setUsers((v) => v.map((u, i) => i === editingIndex ? next : u));
    setModal(null);
    setEditingIndex(null);
    notify(modal === 'add' ? '用户已添加' : '管理员权限已更新');
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
            <button
              onClick={() => { setEditingIndex(i); setModal('edit'); }}
              className="rounded-lg border px-3 py-2 text-xs"
            >
              编辑设置
            </button>
          </div>
        ))}
      </Card>
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
function SystemSettings({ notify }: { notify: (s: string) => void }) {
  const [interval, setInterval] = useState('15'),
    [threshold, setThreshold] = useState('40'),
    [autoClean, setAutoClean] = useState(true);
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
              onClick={() => notify('系统设置已保存')}
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
              ['设备通信接口', '需部署中央执行服务'],
              ['日志存储', '已启用'],
            ].map(([a, b], i) => (
              <div
                className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                key={a}
              >
                <span className="flex items-center gap-2 text-xs">
                  <Wifi
                    className={`size-4 ${i === 1 ? 'text-orange-500' : 'text-emerald-600'}`}
                  />
                  {a}
                </span>
                <span
                  className={`text-[10px] ${i === 1 ? 'text-orange-600' : 'text-emerald-700'}`}
                >
                  {b}
                </span>
              </div>
            ))}
          </div>
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
function DeviceCard({
  d,
  clean,
  run,
}: {
  d: Device;
  clean: () => void;
  run: () => void;
}) {
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
        <p className="mt-4 rounded-lg bg-orange-50 p-3 text-[10px] leading-4 text-orange-700">请填写真实IP或SSH主机别名。中央执行服务连接成功后，自动显示实时指标并开放操作按钮。</p>
        <div className="mt-4 grid grid-cols-2 gap-2"><button disabled className="h-9 rounded-lg border text-xs opacity-40">磁盘清理</button><button disabled className="h-9 rounded-lg bg-slate-200 text-xs text-slate-400">开始发送</button></div>
      </article>
    );
  }
  let running = d.state === '发送中',
    warn = d.state === '待清理',
    diskUsed = d.diskTotal - d.free,
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
          <b>Mac mini {d.id}</b>
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
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          disabled={running}
          onClick={clean}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border text-xs disabled:opacity-40"
        >
          <Trash2 className="size-3" />
          磁盘清理
        </button>
        <button
          onClick={run}
          className={`flex h-9 items-center justify-center gap-2 rounded-lg text-xs ${running ? 'bg-red-50 text-red-700' : 'bg-[#153c32] text-white'}`}
        >
          {running ? (
            <>
              <CircleStop className="size-3" />
              终止任务
            </>
          ) : (
            <>
              <Play className="size-3" />
              开始发送
            </>
          )}
        </button>
      </div>
    </article>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="grid min-h-screen bg-[#eef3f1] lg:grid-cols-2">
      <section className="hidden bg-[#102d25] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-300 text-emerald-950">
            <Zap />
          </span>
          <b>流转中控台</b>
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
          onSubmit={(e) => {
            e.preventDefault();
            onLogin();
          }}
          className="w-full max-w-md rounded-3xl bg-white p-9 shadow-2xl shadow-emerald-950/10"
        >
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
              defaultValue="admin"
              className="mt-2 h-12 w-full rounded-xl border bg-slate-50 px-4 text-sm"
            />
          </label>
          <label className="mt-5 block text-xs font-medium">
            密码
            <input
              type="password"
              defaultValue="123456"
              className="mt-2 h-12 w-full rounded-xl border bg-slate-50 px-4 text-sm"
            />
          </label>
          <button className="mt-7 h-12 w-full rounded-xl bg-[#12382e] text-sm font-semibold text-white">
            登录系统
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
  const [mode, setMode] = useState<'local' | 'select'>('local'),
    [timing, setTiming] = useState<'now' | 'schedule'>('now'),
    [startAt, setStartAt] = useState(''),
    [content, setContent] = useState('');
  const submit = () => {
    if (timing === 'schedule' && !startAt) return;
    const label = `${mode === 'local' ? '本地直接转发' : `选择发送信息：${content || '未命名信息'}`} · ${timing === 'now' ? '立即执行' : `定时 ${startAt.replace('T', ' ')}`}`;
    act('send', label);
  };
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
        <p className="text-xs font-medium text-emerald-700">Mac mini {id}</p>
        <h2 className="mt-1 text-2xl font-semibold">
          {type === 'send'
            ? '创建定制发送任务'
            : type === 'clean'
              ? '磁盘清理确认'
              : '终止任务确认'}
        </h2>
        {type === 'send' ? (
          <div className="mt-8 space-y-6">
            <label className="block text-xs font-medium">
              任务名称
              <input
                defaultValue={`${id}-企业微信转发任务`}
                className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium">转发方式</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('local')}
                  className={`rounded-xl p-4 text-left ${mode === 'local' ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}
                >
                  <MonitorPlay className="mb-3 size-5 text-emerald-700" />
                  <b className="block text-sm">本地直接转发</b>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                    直接运行设备脚本，由脚本控制企业微信页面转发
                  </span>
                </button>
                <button
                  onClick={() => setMode('select')}
                  className={`rounded-xl p-4 text-left ${mode === 'select' ? 'border-2 border-emerald-500 bg-emerald-50' : 'border'}`}
                >
                  <FileText className="mb-3 size-5 text-emerald-700" />
                  <b className="block text-sm">选择发送信息</b>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                    从已配置的发送信息中选择本次转发内容
                  </span>
                </button>
              </div>
            </div>
            {mode === 'select' && (
              <label className="block text-xs font-medium">
                选择发送信息
                <select
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                >
                  <option value="">请选择已配置信息</option>
                  <option>客户群日常通知</option>
                  <option>门店活动信息</option>
                  <option>内部运营公告</option>
                </select>
              </label>
            )}
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
                ? '确认后将立即执行设备发送脚本。'
                : '任务会进入待执行队列，到达指定时间后自动运行设备发送脚本。'}
            </div>
            <button
              onClick={submit}
              disabled={
                (timing === 'schedule' && !startAt) ||
                (mode === 'select' && !content)
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
