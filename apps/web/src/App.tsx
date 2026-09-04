import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Check,
  Ban,
  CalendarRange,
  LogIn,
  RefreshCw,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { calculateKLUWeightedAttendance } from '@klu-attend-plus/attendance-engine';

function Brand() {
  return <div className="brand"><img src="/logo.svg" alt="" /> <span>KLU Attend+</span></div>;
}

function ThemeToggle({ darkMode, onToggle }: { darkMode: boolean; onToggle: () => void }) {
  return <button className="theme-toggle" onClick={onToggle} aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} title={darkMode ? 'Use light mode' : 'Use dark mode'}>
    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
    <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}

type ComponentAttendance = {
  name: string;
  attended: number;
  conducted: number;
  percentage: number;
};

type Course = {
  course_code: string;
  course_name: string;
  attended: number;
  conducted: number;
  percentage: number;
  components?: ComponentAttendance[];
};

type TimetableEntry = {
  course_code: string;
  course_name: string;
  component: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  period?: number;
  period_label?: string;
  room?: string;
  faculty_name?: string;
};

type ERPData = {
  courses: Course[];
  timetable: TimetableEntry[];
  academic_year: string;
  semester: string;
  bridge_id?: string;
};

type Option = { value: string; label: string };

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '/api');
const PERIODS = [
  { number: 1, start: '7:10 AM', end: '8:00 AM' },
  { number: 2, start: '8:00 AM', end: '8:50 AM' },
  { number: 3, start: '9:20 AM', end: '10:10 AM' },
  { number: 4, start: '10:10 AM', end: '11:00 AM' },
  { number: 5, start: '11:10 AM', end: '12:00 PM' },
  { number: 6, start: '12:00 PM', end: '12:50 PM' },
  { number: 8, start: '1:50 PM', end: '2:40 PM' },
  { number: 9, start: '2:40 PM', end: '3:30 PM' },
  { number: 10, start: '3:50 PM', end: '4:40 PM' },
  { number: 11, start: '4:40 PM', end: '5:30 PM' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function apiCall<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error?.message || `Request failed (${response.status})`);
  return data.data as T;
}

function weightedMetrics(course: Course) {
  const components = course.components?.length
    ? course.components
    : [{ name: 'Lecture', attended: course.attended, conducted: course.conducted, percentage: course.percentage }];
  return calculateKLUWeightedAttendance(components);
}

function eligibilityForPercentage(percentage: number) {
  if (percentage >= 85) {
    return { key: 'eligible', label: 'Eligible', className: 'green', detail: '85%+ required' };
  }
  if (percentage >= 75) {
    return { key: 'conditional', label: 'Conditional', className: 'yellow', detail: '75%–84.9%' };
  }
  return { key: 'detained', label: 'Detained', className: 'red', detail: 'Below 75%' };
}

function componentClass(name: string) {
  const value = name.toLowerCase();
  if (value.includes('practical') || value.includes('lab')) return 'component practical';
  if (value.includes('skill')) return 'component skill';
  if (value.includes('tutorial')) return 'component tutorial';
  return 'component lecture';
}

function componentShort(name: string) {
  const value = name.toLowerCase();
  if (value.includes('practical') || value.includes('lab')) return 'P';
  if (value.includes('skill')) return 'S';
  if (value.includes('tutorial')) return 'T';
  return 'L';
}

function AttendanceDashboard({ courses }: { courses: Course[] }) {
  return <section>
    <div className="section-head">
      <div><div className="eyebrow">SUBJECTS</div><h2>Course attendance</h2><p className="muted weight-note">Each course is calculated separately. Lecture 100% • Practical 50% • Skill 25%.</p></div>
      <span className="muted">{courses.length} courses</span>
    </div>
    <div className="threshold-strip card">
      <div><span className="threshold-dot green-dot" /><b>85% and above</b><small>Eligible</small></div>
      <div><span className="threshold-dot yellow-dot" /><b>75%–84.9%</b><small>Conditional eligibility</small></div>
      <div><span className="threshold-dot red-dot" /><b>Below 75%</b><small>Detained</small></div>
    </div>
    <div className="course-grid">
      {courses.map((course) => {
        const weighted = weightedMetrics(course);
        const status = eligibilityForPercentage(weighted.percentage);
        const components = course.components?.length ? course.components : [{ name: 'Lecture', attended: course.attended, conducted: course.conducted, percentage: course.percentage }];
        return <article className={`card course status-${status.key}`} key={course.course_code}>
          <div className="course-top">
            <div><b>{course.course_name || course.course_code}</b><span>{course.course_code}</span></div>
            <span className={`pill ${status.className}`}>{status.label}</span>
          </div>
          <div className="subject-overall">
            <div><span className="eyebrow">SUBJECT ATTENDANCE</span><div className="pct">{weighted.percentage.toFixed(0)}%</div></div>
            <div className="status-copy"><b>{status.label}</b><span>{status.detail}</span></div>
          </div>
          <div className="bar"><div style={{ width: `${Math.min(100, weighted.percentage)}%` }} /></div>
          <div className="course-foot"><span>Weighted subject percentage</span><span>85% target</span></div>
          <div className="component-list">
            <div className="component-title">Components</div>
            {components.map((component) => <div className="component-row" key={`${course.course_code}-${component.name}`}>
              <span className={componentClass(component.name)}>{componentShort(component.name)} · {component.name}</span>
              <b>{component.percentage.toFixed(1)}%</b>
              <span>{component.attended}/{component.conducted}</span>
            </div>)}
          </div>
          <div className="formula-box">Subject % = ceil((Lecture % × 1 + Practical % × 0.5 + Skill % × 0.25) ÷ total weight). L = 100%, P = 50%, S = 25%.</div>
        </article>;
      })}
    </div>
  </section>;
}

function ERPConnect({ onData, onClose }: { onData: (data: ERPData) => void; onClose: () => void }) {
  const [bridgeId, setBridgeId] = useState('');
  const [username, setUsername] = useState(() => localStorage.getItem('klu-attend-remembered-username') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('klu-attend-remembered-password') || '');
  const [captcha, setCaptcha] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('klu-attend-remember-me') === 'true');
  const [academicYears, setAcademicYears] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Option[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const startedRef = useRef(false);

  const start = async () => {
    setBusy(true); setStatus('Opening KLU ERP login…');
    try {
      const data = await apiCall<{ bridgeId: string }>('/api/erp/start', { method: 'POST' });
      setBridgeId(data.bridgeId);
      const captchaResponse = await fetch(`${API}/api/erp/captcha/${data.bridgeId}`);
      if (!captchaResponse.ok) throw new Error('Could not load the ERP verification image.');
      setImage(URL.createObjectURL(await captchaResponse.blob()));
      setStatus('Login is ready. Enter your credentials and the visible verification code.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not open KLU ERP.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, []);

  const refreshCaptcha = async () => {
    if (!bridgeId) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/erp/captcha/${bridgeId}`);
      if (!response.ok) throw new Error('Could not refresh the ERP verification image.');
      setImage(URL.createObjectURL(await response.blob())); setStatus('Verification image refreshed.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not refresh verification image.'); }
    finally { setBusy(false); }
  };

  const loadSemestersForYear = async (year: string) => {
    setAcademicYear(year); setSemester('');
    if (!bridgeId || !year) return;
    setLoadingSemesters(true); setStatus('Reading Semester options from KLU ERP…');
    try {
      const data = await apiCall<{ semesterOptions: Option[] }>(`/api/erp/attendance/semester-options/${bridgeId}?academicYear=${encodeURIComponent(year)}`);
      setSemesters(data.semesterOptions); setSemester(data.semesterOptions[0]?.value || '');
      setStatus('Semester options loaded directly from the logged-in ERP.');
    } catch (error) { setSemesters([]); setStatus(error instanceof Error ? error.message : 'Could not load Semester options.'); }
    finally { setLoadingSemesters(false); }
  };

  const login = async () => {
    if (!bridgeId || !username.trim() || !password || !captcha.trim()) return;
    setBusy(true); setStatus('Logging into KLU ERP…');
    try {
      const result = await apiCall<{ authenticated: boolean; message: string }>('/api/erp/login', {
        method: 'POST', body: JSON.stringify({ bridgeId, username: username.trim(), password, captcha: captcha.trim() }),
      });
      if (!result.authenticated) { setStatus(result.message); return; }
      if (rememberMe) {
        localStorage.setItem('klu-attend-remember-me', 'true');
        localStorage.setItem('klu-attend-remembered-username', username.trim());
        localStorage.setItem('klu-attend-remembered-password', password);
      } else {
        localStorage.removeItem('klu-attend-remember-me');
        localStorage.removeItem('klu-attend-remembered-username');
        localStorage.removeItem('klu-attend-remembered-password');
      }
      setPassword(''); setAuthenticated(true); setStatus('Logged in. Reading the real ERP Attendance Register…');
      const data = await apiCall<{ academicYearOptions: Option[]; semesterOptions: Option[] }>(`/api/erp/attendance/options/${bridgeId}`);
      setAcademicYears(data.academicYearOptions); setSemesters(data.semesterOptions || []);
      const firstYear = data.academicYearOptions[0]?.value || '';
      setAcademicYear(firstYear); setSemester(data.semesterOptions?.[0]?.value || '');
      setStatus('Academic Year and Semester are from the logged-in KLU ERP.');
      if (!data.semesterOptions?.length && firstYear) await loadSemestersForYear(firstYear);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'ERP login failed.'); }
    finally { setBusy(false); }
  };

  const fetchAll = async () => {
    if (!bridgeId || !academicYear || !semester) return;
    setBusy(true); setStatus('Fetching attendance using the selected ERP filters…');
    try {
      const [synced, timetableData] = await Promise.all([
        apiCall<{ courses: Course[]; academic_year: string; semester: string }>('/api/erp/sync/' + bridgeId, {
          method: 'POST', body: JSON.stringify({ academicYear, semester }),
        }),
        apiCall<{ entries: TimetableEntry[] }>(`/api/erp/timetable/${bridgeId}?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}`),
      ]);
      setStatus(`Fetched ${synced.courses.length} subjects and ${timetableData.entries.length} timetable classes.`);
      onData({ courses: synced.courses, timetable: timetableData.entries, academic_year: synced.academic_year, semester: synced.semester, bridge_id: bridgeId });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'ERP sync failed.');
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (bridgeId) await fetch(`${API}/api/erp/${bridgeId}`, { method: 'DELETE' }).catch(() => undefined);
    onClose();
  };

  return <div className="modal-backdrop"><div className="modal card">
    <div className="modal-head"><div><div className="eyebrow">LIVE ERP CONNECT</div><h2>{authenticated ? 'Attendance + Timetable' : 'Connect KLU ERP'}</h2></div><button className="icon-btn" onClick={disconnect}>×</button></div>
    {!bridgeId ? <div className="connect-loading"><span className="spinner" /><b>Preparing secure ERP login…</b><small>The verification image will appear here automatically.</small></div> : !authenticated ? <>
      <div className="captcha-panel"><div><span className="eyebrow">VERIFICATION CODE</span><b>Enter the code shown below</b></div>{image ? <img src={image} alt="KLU ERP verification code" /> : <span className="captcha-placeholder">Loading…</span>}</div>
      <div className="grid2"><label>ERP Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label><label>ERP Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" /></label><label>Verification code<input value={captcha} onChange={(e) => setCaptcha(e.target.value)} /></label></div>
      <label className="remember-row"><input type="checkbox" checked={rememberMe} onChange={(e) => { const checked = e.target.checked; setRememberMe(checked); if (!checked) { localStorage.removeItem('klu-attend-remember-me'); localStorage.removeItem('klu-attend-remembered-username'); localStorage.removeItem('klu-attend-remembered-password'); } }} /> <span><b>Remember me</b><small>Save your ERP username and password on this device. CAPTCHA is still required each login.</small></span></label>
      <div className="row"><button className="btn secondary" onClick={refreshCaptcha} disabled={busy}>Refresh verification image</button><button className="btn primary" onClick={login} disabled={busy || !username.trim() || !password || !captcha.trim()}>{busy ? 'Logging in…' : 'Login to ERP'}</button></div>
    </> : <>
      <p className="muted">The same Academic Year and Semester are used for both Attendance Register and Academic Timetable.</p>
      <div className="grid2 filter-grid"><label>Academic Year<select value={academicYear} onChange={(e) => loadSemestersForYear(e.target.value)} disabled={busy || loadingSemesters}>{academicYears.map((item) => <option key={`${item.value}-${item.label}`} value={item.value}>{item.label}</option>)}</select></label><label>Semester<select value={semester} onChange={(e) => setSemester(e.target.value)} disabled={busy || loadingSemesters || !semesters.length}>{!semesters.length && <option value="">{loadingSemesters ? 'Loading from ERP…' : 'Select Semester'}</option>}{semesters.map((item) => <option key={`${item.value}-${item.label}`} value={item.value}>{item.label}</option>)}</select></label></div>
      <div className="row"><button className="btn secondary" onClick={disconnect} disabled={busy}>Cancel</button><button className="btn primary" onClick={fetchAll} disabled={busy || !academicYear || !semester}>{busy ? 'Fetching ERP…' : 'Fetch Attendance + Timetable'}</button></div>
    </>}
    <div className="status"><ShieldCheck size={16} />{status || 'ERP session is temporary and expires automatically.'}</div>
    <p className="legal">Use only your own authorized KLU ERP account. CAPTCHA is entered by you. The app does not fill or bypass hidden MFA/QR fields.</p>
  </div></div>;
}

function TimetableCalendar({ entries, courses }: { entries: TimetableEntry[]; courses: Course[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const courseNames = useMemo(() => new Map(courses.map((course) => [course.course_code.toLowerCase(), course.course_name])), [courses]);
  const resolved = useMemo(() => entries.map((entry) => ({
    ...entry,
    course_name: courseNames.get(entry.course_code.toLowerCase()) || entry.course_name || entry.course_code,
  })), [entries, courseNames]);
  const grouped = useMemo(() => DAYS.map((day) => resolved.filter((entry) => entry.day_of_week.toLowerCase() === day.toLowerCase()).sort((a, b) => (a.period || 99) - (b.period || 99))), [resolved]);
  const weekDate = useMemo(() => { const date = new Date(); const day = date.getDay(); const diff = day === 0 ? -6 : 1 - day; date.setDate(date.getDate() + diff + weekOffset * 7); return date; }, [weekOffset]);
  const dateForDay = (index: number) => { const date = new Date(weekDate); date.setDate(date.getDate() + index); return date; };
  const label = `${weekDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${dateForDay(5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return <section className="timetable-page">
    <div className="calendar-head"><div><div className="eyebrow">CUSTOM KLU CALENDAR</div><h2>Weekly timetable</h2><p className="muted">Subject names come from the ERP attendance data. L = Lecture · P = Practical · S = Skill.</p></div><div className="calendar-actions"><button className="icon-btn" onClick={() => setWeekOffset((value) => value - 1)}><ChevronLeft size={18} /></button><button className="btn secondary" onClick={() => setWeekOffset(0)}>Today</button><button className="icon-btn" onClick={() => setWeekOffset((value) => value + 1)}><ChevronRight size={18} /></button></div></div>
    <div className="calendar-range">{label}</div>
    {!resolved.length ? <div className="empty card"><CalendarDays size={28} /><b>No ERP timetable classes were returned.</b><span>Reconnect and fetch the Academic Timetable again.</span></div> : <>
      <div className="calendar-legend"><span><i className="legend-dot lecture" /> Lecture</span><span><i className="legend-dot practical" /> Practical</span><span><i className="legend-dot skill" /> Skill</span><span><i className="legend-dot tutorial" /> Tutorial</span></div>
      <div className="custom-calendar">
        <div className="custom-calendar-header timetable-row-header"><div className="time-col-title">DAY</div>{PERIODS.map((period) => <div key={period.number} className="day-title"><b>P{period.number}</b><span>{period.start}</span></div>)}</div>
        <div className="custom-calendar-body">
          {grouped.map((dayEntries, dayIndex) => <div className="calendar-row timetable-day-row" key={DAYS[dayIndex]}>
            <div className="time-label"><b>{DAYS[dayIndex]}</b><span>{dateForDay(dayIndex).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>
            {PERIODS.map((period) => {
              const matches = dayEntries.filter((entry) => entry.period === period.number);
              return <div className="calendar-cell" key={`${DAYS[dayIndex]}-${period.number}`}>
                {matches.length ? matches.map((event, index) => <div className={`calendar-event-card ${componentClass(event.component).split(' ')[1]}`} key={`${event.course_code}-${event.component}-${index}`}>
                  <div className="event-component"><span>{componentShort(event.component)}</span>{event.component}</div>
                  <b>{event.course_name}</b>
                  <small>{event.course_code}</small>
                  <div className="event-meta"><Clock3 size={12} /> {period.start} – {period.end}</div>
                  {event.room && <div className="event-room">Room {event.room}</div>}
                </div>) : <span className="empty-slot">—</span>}
              </div>;
            })}
          </div>)}
          <div className="calendar-break"><span>8:50–9:20 AM Break · 11:00–11:10 AM Break · 12:50–1:50 PM Lunch · 3:30–3:50 PM Break</span></div>
        </div>
      </div>
      <div className="calendar-note status"><Clock3 size={15} /> Period times follow the KLU schedule supplied for this app. ERP supplies the course, day, component, room and period details.</div>
    </>}
  </section>;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

const KLU_HOLIDAYS = new Set([
  '2026-09-04', // Krishnashtami
  '2026-09-14', // Vinayaka Chavithi
  '2026-10-02', // Gandhi Jayanti
  // Dussehra vacation from the official 2026 KLU holiday circular.
  '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
]);

const KLU_HOLIDAY_LABELS = new Map<string, string>([
  ['2026-09-04', 'Krishnashtami'],
  ['2026-09-14', 'Vinayaka Chavithi'],
  ['2026-10-02', 'Gandhi Jayanti'],
  ['2026-10-19', 'Dussehra vacation'],
  ['2026-10-20', 'Dussehra vacation'],
  ['2026-10-21', 'Dussehra vacation'],
  ['2026-10-22', 'Dussehra vacation'],
  ['2026-10-23', 'Dussehra vacation'],
  ['2026-10-24', 'Dussehra vacation'],
]);

// 02-Oct-2026 is treated as a holiday in the planner and is excluded from
// scheduled attendance calculations, per the user's holiday mapping.
const KLU_SPECIAL_DATES = new Map<string, string>();

const PBL_END = '2026-10-15';
const REGULAR_END = '2026-11-12';

function classBlocks(entries: TimetableEntry[]) {
  const sorted = [...entries].filter((entry) => entry.day_of_week && entry.course_code).sort((a, b) => {
    const dayA = DAYS.indexOf(a.day_of_week);
    const dayB = DAYS.indexOf(b.day_of_week);
    return dayA - dayB || (a.period || 99) - (b.period || 99);
  });

  const blocks: Array<TimetableEntry & { id: string; periodCount: number; lastPeriod?: number }> = [];
  for (const entry of sorted) {
    const previous = blocks[blocks.length - 1];
    const sameClass = previous &&
      previous.day_of_week === entry.day_of_week &&
      previous.course_code === entry.course_code &&
      previous.component === entry.component &&
      (previous.room || '') === (entry.room || '') &&
      previous.lastPeriod !== undefined && entry.period !== undefined &&
      entry.period === previous.lastPeriod + 1;

    if (sameClass) {
      previous.lastPeriod = entry.period;
      previous.periodCount += 1;
      previous.end_time = entry.end_time || previous.end_time;
      continue;
    }

    blocks.push({
      ...entry,
      id: `${entry.day_of_week}-${entry.period || entry.start_time}-${entry.course_code}-${entry.component}-${entry.room || ''}`.replace(/\s+/g, '-').toLowerCase(),
      periodCount: 1,
      lastPeriod: entry.period,
    });
  }

  // KLU timetable displays a class across two periods. If an ERP response only
  // returns one half of a pair, still treat that scheduled class as two periods.
  return blocks.map((block) => {
    const count = Math.max(2, block.periodCount);
    const firstPeriod = block.period || 1;
    const lastPeriod = block.lastPeriod || firstPeriod;
    const expectedEnd = PERIODS.find((period) => period.number === (count === 2 && block.periodCount === 1 ? firstPeriod + 1 : lastPeriod))?.end;
    return { ...block, periodCount: count, end_time: expectedEnd || block.end_time };
  });
}

function normalizeComponent(name: string) {
  const value = name.trim().toLowerCase();
  if (value === 'l' || value.includes('lecture') || value.includes('theory')) return 'lecture';
  if (value === 'p' || value.includes('practical') || value.includes('lab')) return 'practical';
  if (value === 's' || value.includes('skill')) return 'skill';
  if (value === 't' || value.includes('tutorial')) return 'tutorial';
  return value;
}

function calculatePlannedCourse(course: Course, blocks: Array<TimetableEntry & { id: string; periodCount: number }>, skippedKeys: Set<string>, extraBlock?: { id: string; periodCount: number }) {
  const base = course.components?.length
    ? course.components.map((component) => ({ ...component }))
    : [{ name: 'Lecture', attended: course.attended, conducted: course.conducted, percentage: course.percentage }];

  const componentMap = new Map(base.map((component) => [normalizeComponent(component.name), component]));
  const addSkipped = (block: { id: string; course_code: string; component: string; periodCount: number }) => {
    if (block.course_code.toLowerCase() !== course.course_code.toLowerCase()) return;
    const component = componentMap.get(normalizeComponent(block.component));
    if (!component) return;
    component.conducted += block.periodCount;
  };

  for (const key of skippedKeys) {
    const separator = key.indexOf('::');
    if (separator < 0) continue;
    const blockId = key.slice(separator + 2);
    const block = blocks.find((item) => item.id === blockId);
    if (block) addSkipped(block);
  }

  if (extraBlock) {
    const block = blocks.find((item) => item.id === extraBlock.id);
    if (block) addSkipped(block);
  }

  for (const component of base) {
    component.percentage = component.conducted > 0 ? (component.attended / component.conducted) * 100 : 0;
  }
  return calculateKLUWeightedAttendance(base);
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function BunkPlanner({ courses, entries, mode }: { courses: Course[]; entries: TimetableEntry[]; mode: 'regular' | 'pbl' }) {
  const semesterEnd = mode === 'regular' ? REGULAR_END : PBL_END;
  const instructionDay = mode === 'regular' ? '12 Nov 2026' : '15 Oct 2026';
  const [month, setMonth] = useState(() => new Date(2026, 8, 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [skipped, setSkipped] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('klu-attend-plus-skips') || '[]'); } catch { return []; }
  });
  const [showForecastPopup, setShowForecastPopup] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('klu-attend-plus-skips', JSON.stringify(skipped));
  }, [skipped]);

  const blocks = useMemo(() => classBlocks(entries), [entries]);
  const courseNames = useMemo(
    () => new Map(courses.map((course) => [course.course_code.toLowerCase(), course.course_name])),
    [courses]
  );
  const resolvedBlocks = useMemo(
    () => blocks.map((block) => ({
      ...block,
      course_name: courseNames.get(block.course_code.toLowerCase()) || block.course_name || block.course_code,
    })),
    [blocks, courseNames]
  );
  const skippedSet = useMemo(() => new Set(skipped), [skipped]);
  const selected = fromDateKey(selectedDate);
  const today = new Date();

  const classesForDate = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    return resolvedBlocks.filter((block) => block.day_of_week.toLowerCase() === day.toLowerCase());
  };

  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    const mondayOffset = (first.getDay() + 6) % 7;
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);

  const isSkipped = (date: Date, block: TimetableEntry & { id: string }) =>
    skippedSet.has(`${dateKey(date)}::${block.id}`);

  const toggleSkip = (date: Date, block: TimetableEntry & { id: string; periodCount: number }) => {
    const keyDate = dateKey(date);
    if (keyDate < dateKey(today) || keyDate > semesterEnd || KLU_HOLIDAYS.has(keyDate)) return;
    const key = `${keyDate}::${block.id}`;
    const alreadySkipped = skippedSet.has(key);
    if (!alreadySkipped && skipped.length === 0) setShowForecastPopup(true);
    setSkipped((current) => {
      return current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    });
  };

  // Every displayed planned value is recalculated from the ERP component
  // counts. A skipped class adds exactly 2 conducted and 0 attended periods.
  const plannedCourses = useMemo(() => courses.map((course) => ({
    course,
    metrics: calculatePlannedCourse(course, resolvedBlocks, skippedSet),
  })), [courses, resolvedBlocks, skippedSet]);

  const selectedClasses = classesForDate(selected);
  const selectedImpacts = selectedClasses.map((block) => {
    const course = courses.find((item) => item.course_code.toLowerCase() === block.course_code.toLowerCase());
    if (!course) return null;
    const before = calculatePlannedCourse(course, resolvedBlocks, skippedSet);
    const key = `${selectedDate}::${block.id}`;
    const alreadySkipped = skippedSet.has(key);
    const after = alreadySkipped
      ? before
      : calculatePlannedCourse(course, resolvedBlocks, skippedSet, block);
    return { block, course, before, after, loss: Math.max(0, before.percentage - after.percentage), alreadySkipped };
  }).filter(Boolean) as Array<{
    block: TimetableEntry & { id: string; periodCount: number };
    course: Course;
    before: ReturnType<typeof calculateKLUWeightedAttendance>;
    after: ReturnType<typeof calculateKLUWeightedAttendance>;
    loss: number;
    alreadySkipped: boolean;
  }>;

  const projectedCourses = useMemo(() => {
    const end = fromDateKey(semesterEnd);
    const start = addDays(new Date(), 1);
    return courses.map((course) => {
      const baseComponents = course.components?.length
        ? course.components.map((component) => ({ ...component }))
        : [{ name: 'Lecture', attended: course.attended, conducted: course.conducted, percentage: course.percentage }];
      const componentMap = new Map(baseComponents.map((component) => [normalizeComponent(component.name), component]));
      const future: Array<{ date: string; block: TimetableEntry & { id: string; periodCount: number }; skipped: boolean }> = [];

      for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
        const key = dateKey(cursor);
        if (KLU_HOLIDAYS.has(key)) continue;
        for (const block of classesForDate(cursor)) {
          if (block.course_code.toLowerCase() !== course.course_code.toLowerCase()) continue;
          future.push({ date: key, block, skipped: skippedSet.has(`${key}::${block.id}`) });
        }
      }

      for (const item of future) {
        if (!item.skipped) continue;
        const component = componentMap.get(normalizeComponent(item.block.component));
        if (component) component.conducted += item.block.periodCount;
      }

      const currentPlanned = calculateKLUWeightedAttendance(baseComponents);
      let reach75: string | null = currentPlanned.percentage >= 75 ? null : null;
      let reach85: string | null = currentPlanned.percentage >= 85 ? null : null;

      for (const item of future) {
        if (item.skipped) continue;
        const component = componentMap.get(normalizeComponent(item.block.component));
        if (!component) continue;
        component.conducted += item.block.periodCount;
        component.attended += item.block.periodCount;
        component.percentage = component.conducted ? (component.attended / component.conducted) * 100 : 0;
        const score = calculateKLUWeightedAttendance(baseComponents).percentage;
        if (score >= 75 && reach75 === null) reach75 = item.date;
        if (score >= 85 && reach85 === null) reach85 = item.date;
      }

      return {
        course,
        projected: calculateKLUWeightedAttendance(baseComponents).percentage,
        reach75,
        reach85,
      };
    });
  }, [courses, resolvedBlocks, skippedSet, semesterEnd]);

  const currentClasses = useMemo(() => {
    const toMinutes = (value: string) => {
      const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (!match) return -1;
      let hour = Number(match[1]) % 12;
      if (match[3].toUpperCase() === 'PM') hour += 12;
      return hour * 60 + Number(match[2] || 0);
    };
    const minute = now.getHours() * 60 + now.getMinutes();
    const todayKey = dateKey(now);
    if (todayKey !== dateKey(today)) return [];
    return resolvedBlocks.filter((block) => {
      if (block.day_of_week.toLowerCase() !== today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()) return false;
      const start = toMinutes(block.start_time);
      const end = toMinutes(block.end_time);
      return start >= 0 && end >= 0 && minute >= start && minute < end;
    });
  }, [now, resolvedBlocks]);

  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const prevMonth = () => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1));
  const nextMonth = () => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1));
  const totalSkippedClasses = skipped.length;
  const totalSkippedPeriods = skipped.reduce((sum, key) => {
    const id = key.slice(key.indexOf('::') + 2);
    return sum + (resolvedBlocks.find((block) => block.id === id)?.periodCount || 2);
  }, 0);

  const formatMilestone = (value: string | null, current: number, threshold: number) => {
    if (current >= threshold) return 'Already reached';
    return value ? formatDate(fromDateKey(value)) : `Not by ${formatDate(fromDateKey(semesterEnd))}`;
  };

  return <section className="bunk-page">
    <div className="planner-top card">
      <div>
        <div className="eyebrow">ATTENDANCE PLANNER</div>
        <h2>Bunk planner</h2>
        <p className="muted">Pick a date, skip individual classes, and see the exact live attendance impact. One timetable class = 2 periods.</p>
      </div>
      <div className="planner-top-meta">
        <div className="live-clock"><Clock3 size={18} /><b>{now.toLocaleTimeString('en-IN')}</b><span>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
        <div className="semester-end"><span>LAST INSTRUCTION DAY</span><b>{instructionDay}</b></div>
      </div>
    </div>

    {currentClasses.length > 0 && <div className="live-class-banner card"><div><span className="live-dot" /> LIVE CLASS NOW</div><b>{currentClasses.map((item) => courseNames.get(item.course_code.toLowerCase()) || item.course_code).join(' · ')}</b><span>{currentClasses.map((item) => `${componentShort(item.component)} ${item.start_time}–${item.end_time}`).join(' · ')}</span></div>}

    <div className="planner-summary card">
      <div className="planner-summary-main"><div className="eyebrow">PLANNED SKIPS</div><h3>{totalSkippedClasses} class{totalSkippedClasses === 1 ? '' : 'es'} selected</h3><p className="muted">{totalSkippedPeriods} timetable periods affected. Changes are stored locally in this browser.</p></div>
      <div className="planner-summary-stats"><div><b>2</b><span>periods per class</span></div><div><b>75%</b><span>conditional threshold</span></div><div><b>85%</b><span>eligibility target</span></div></div>
    </div>

    <div className="planner-grid planner-workspace">
      <div className="big-calendar card">
        <div className="planner-section-title"><div><div className="eyebrow">STEP 1</div><h3>Choose a date</h3><p className="muted">Calendar follows the ERP timetable and KLU holiday circular.</p></div><span>{monthLabel}</span></div>
        <div className="month-toolbar"><button className="icon-btn" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button><h3>{monthLabel}</h3><button className="icon-btn" onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button><button className="btn secondary" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(dateKey(today)); }}>Today</button></div>
        <div className="weekday-row">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day}>{day}</div>)}</div>
        <div className="month-grid">
          {calendarCells.map((date) => {
            const key = dateKey(date);
            const inMonth = date.getMonth() === month.getMonth();
            const holiday = KLU_HOLIDAYS.has(key);
            const special = KLU_SPECIAL_DATES.get(key);
            const dayClasses = classesForDate(date);
            const skippedCount = dayClasses.filter((block) => isSkipped(date, block)).length;
            return <button key={key} className={`month-day ${inMonth ? '' : 'outside'} ${key === selectedDate ? 'selected' : ''} ${isSameDay(date, today) ? 'today' : ''} ${holiday ? 'holiday' : ''} ${special ? 'special-date' : ''}`} onClick={() => setSelectedDate(key)}>
              <span className="month-number">{date.getDate()}</span>
              {holiday && <span className="holiday-label">Holiday</span>}
              {special && <span className="special-label">Activity</span>}
              <div className="day-events">{dayClasses.slice(0, 4).map((block) => <span className={`mini-event ${componentClass(block.component).split(' ')[1]} ${isSkipped(date, block) ? 'skipped' : ''}`} key={block.id}>{componentShort(block.component)} · {(courseNames.get(block.course_code.toLowerCase()) || block.course_code).slice(0, 17)}</span>)}{dayClasses.length > 4 && <span className="more-events">+{dayClasses.length - 4} more</span>}</div>
              {skippedCount > 0 && <span className="skip-badge">{skippedCount} skipped</span>}
            </button>;
          })}
        </div>
        <div className="planner-legend"><span><i className="legend-dot lecture" /> Lecture</span><span><i className="legend-dot practical" /> Practical</span><span><i className="legend-dot skill" /> Skill</span><span><i className="legend-dot skip" /> Planned skip</span><span><i className="legend-dot holiday-dot" /> Holiday</span><span><i className="legend-dot special-dot" /> Mandatory activity</span></div>
      </div>

      <aside className="planner-side skip-side">
        <div className="card day-panel skip-panel">
          <div className="skip-panel-head"><div><div className="eyebrow">STEP 2</div><h3>Skip classes</h3><p className="muted">{formatDate(selected)} · choose individual classes</p></div><span className="selected-count">{selectedClasses.length} scheduled</span></div>
          {KLU_HOLIDAYS.has(selectedDate) ? <div className="holiday-box"><Ban size={20} /><b>{KLU_HOLIDAY_LABELS.get(selectedDate) || 'KLU public holiday'}</b><span>No regular timetable classes are counted on this holiday.</span></div> : <>
            {KLU_SPECIAL_DATES.has(selectedDate) && <div className="special-box"><CalendarRange size={18} /><b>{KLU_SPECIAL_DATES.get(selectedDate)}</b><span>This date is not excluded from attendance calculations.</span></div>}
            {selectedClasses.length ? <div className="planner-class-list">
              {selectedClasses.map((block) => {
                const impact = selectedImpacts.find((item) => item.block.id === block.id);
                const skippedNow = isSkipped(selected, block);
                return <div className={`planner-class ${skippedNow ? 'is-skipped' : ''}`} key={block.id}>
                  <div className="planner-class-main"><span className={`component ${componentClass(block.component).split(' ')[1]}`}>{componentShort(block.component)}</span><div><b>{courseNames.get(block.course_code.toLowerCase()) || block.course_code}</b><small>{block.component} · {block.start_time}–{block.end_time} · {block.periodCount} periods{block.room ? ` · ${block.room}` : ''}</small></div></div>
                  <button disabled={selectedDate < dateKey(today) || selectedDate > semesterEnd} className={`skip-btn ${skippedNow ? 'undo' : ''}`} onClick={() => toggleSkip(selected, block)}>{skippedNow ? <><Check size={15} /> Restore class</> : <><Ban size={15} /> Skip this class</>}</button>
                  {impact && <div className={`impact-line ${skippedNow ? 'skipped-text' : ''}`}><span className="impact-label">{skippedNow ? 'PLANNED RESULT' : 'IF YOU SKIP'}</span><b>{impact.before.percentage.toFixed(0)}% → {impact.after.percentage.toFixed(0)}%</b><span>{impact.loss > 0 ? `-${impact.loss.toFixed(2)} percentage points` : 'No displayed-point change'}</span><small>+{block.periodCount} conducted · +0 attended</small></div>}
                </div>;
              })}
            </div> : <div className="no-classes"><CalendarRange size={26} /><b>No timetable classes</b><span>Select another date with scheduled classes.</span></div>}
            {selectedDate > semesterEnd && <div className="planner-warning">The semester ends on {instructionDay}, so future classes after that date are not part of the recovery forecast.</div>}
          </>}
        </div>
      </aside>
    </div>

    <section className={`forecast-bottom ${showForecastPopup ? 'forecast-popup' : ''}`}>
      <div className="forecast-popup-backdrop" onClick={() => setShowForecastPopup(false)} />
      <div className="forecast-header card"><div><div className="eyebrow">STEP 3 · LIVE RECOVERY FORECAST</div><h2>Attendance forecast</h2><p className="muted">Your plan has changed. These values recalculate from ERP attendance, timetable, holidays and every planned skip.</p></div><div className="forecast-header-actions"><div className="forecast-rules"><span>≥85% Eligible</span><span>75–84.9% Conditional</span><span>&lt;75% Detained</span></div>{showForecastPopup && <button className="icon-btn" onClick={() => setShowForecastPopup(false)} aria-label="Close attendance forecast">×</button>}</div></div>
      <div className="forecast-grid">
        {plannedCourses.map(({ course, metrics }) => {
          const forecast = projectedCourses.find((item) => item.course.course_code === course.course_code);
          const status = eligibilityForPercentage(metrics.percentage);
          const projected = forecast?.projected ?? metrics.percentage;
          const currentComponent = course.components?.length ? course.components : [{ name: 'Lecture', attended: course.attended, conducted: course.conducted, percentage: course.percentage }];
          return <article className={`card forecast-card status-${status.key}`} key={course.course_code}>
            <div className="forecast-card-head"><div><div className="eyebrow">{course.course_code}</div><h3>{course.course_name || course.course_code}</h3></div><span className={`pill ${status.className}`}>{status.label}</span></div>
            <div className="forecast-numbers"><div><span>NOW · PLANNED</span><b>{metrics.percentage.toFixed(0)}%</b></div><div><span>PROJECTED BY {instructionDay.toUpperCase()}</span><b>{projected.toFixed(0)}%</b></div></div>
            <div className="bar large"><div style={{ width: `${Math.min(100, Math.max(0, metrics.percentage))}%` }} /></div>
            <div className="forecast-milestones"><div><span>75% recovery</span><b>{formatMilestone(forecast?.reach75 ?? null, metrics.percentage, 75)}</b></div><div><span>85% recovery</span><b>{formatMilestone(forecast?.reach85 ?? null, metrics.percentage, 85)}</b></div></div>
            <div className="forecast-component-strip">{currentComponent.map((component) => {
              const componentSkips = [...skippedSet].filter((key) => {
                const id = key.slice(key.indexOf('::') + 2);
                const block = resolvedBlocks.find((item) => item.id === id);
                return block && block.course_code.toLowerCase() === course.course_code.toLowerCase() && normalizeComponent(block.component) === normalizeComponent(component.name);
              }).reduce((sum, key) => sum + (resolvedBlocks.find((item) => item.id === key.slice(key.indexOf('::') + 2))?.periodCount || 2), 0);
              const adjustedConducted = component.conducted + componentSkips;
              const adjustedPercentage = adjustedConducted ? (component.attended / adjustedConducted) * 100 : 0;
              return <span key={component.name}><b>{componentShort(component.name)} {adjustedPercentage.toFixed(1)}%</b> <small>{component.attended}/{adjustedConducted}</small></span>;
            })}</div>
            <div className="forecast-note">L 100% · P 50% · S 25% weighting · ERP + planned skips · 2 periods/class</div>
          </article>;
        })}
      </div>
    </section>

    <div className="card planner-info"><b>Calculation rules</b><span>• Each subject is calculated independently; there is no overall attendance across subjects.</span><span>• Component weights are percentage weights: Lecture 100%, Practical 50%, Skill 25%.</span><span>• Skipping one scheduled class adds 2 conducted periods and 0 attended periods to that component.</span><span>• 85%+ = Eligible · 75–84.9% = Conditional · below 75% = Detained.</span><span>• Holiday mapping includes 04-Sep, 14-Sep, 02-Oct (Gandhi Jayanti), and 19–24 Oct (Dussehra vacation); holidays are excluded from attendance calculations.</span></div>
  </section>;
}

function BunkModeModal({ onSelect, onClose }: { onSelect: (mode: 'regular' | 'pbl') => void; onClose: () => void }) {
  return <div className="bunk-mode-overlay" role="dialog" aria-modal="true" aria-labelledby="bunk-mode-title">
    <div className="bunk-mode-modal card">
      <button className="bunk-mode-close" onClick={onClose} aria-label="Close">×</button>
      <div className="bunk-mode-icon"><CalendarRange size={25} /></div>
      <div className="eyebrow">BUNK PLANNER</div>
      <h2 id="bunk-mode-title">Choose your semester type</h2>
      <p className="muted">The recovery forecast uses a different last instruction day for Regular and PBL.</p>
      <div className="bunk-mode-options">
        <button className="bunk-mode-option" onClick={() => onSelect('regular')}>
          <div><b>Regular</b><span>Last instruction day: <strong>12 Nov 2026</strong></span></div><ChevronRight size={20} />
        </button>
        <button className="bunk-mode-option" onClick={() => onSelect('pbl')}>
          <div><b>PBL</b><span>Last instruction day: <strong>15 Oct 2026</strong></span></div><ChevronRight size={20} />
        </button>
      </div>
      <small>The timetable and mapped KLU holidays remain the same; only the forecast end date changes.</small>
    </div>
  </div>;
}

function Dashboard({ data, onConnect, onLogout, darkMode, onToggleTheme }: { data: ERPData; onConnect: () => void; onLogout: () => void; darkMode: boolean; onToggleTheme: () => void }) {
  const [page, setPage] = useState<'dashboard' | 'timetable' | 'bunk'>('dashboard');
  const [bunkMode, setBunkMode] = useState<'regular' | 'pbl' | null>(null);

  const openBunkPlanner = () => {
    setPage('bunk');
    setBunkMode(null);
  };

  return <div className="shell"><aside><Brand /><div className="side-context"><span>Current workspace</span><b>{data.academic_year}</b><small>{data.semester}</small></div><nav>
    <button className={`nav ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}><Activity size={17} /> Dashboard</button>
    <button className={`nav ${page === 'timetable' ? 'active' : ''}`} onClick={() => setPage('timetable')}><CalendarDays size={17} /> Timetable</button>
    <button className={`nav ${page === 'bunk' ? 'active' : ''}`} onClick={openBunkPlanner}><CalendarRange size={17} /> Bunk planner</button>
  </nav><div className="side-note"><ShieldCheck size={18} /><b>ERP connected</b><span>Data is fetched from your active KLU ERP session.</span></div><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} /><button className="logout-btn" onClick={onLogout}><LogOut size={16} /> Log out</button></aside>
  <div className="mobile-bar"><Brand /><div className="mobile-actions"><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} /><button className="btn secondary" onClick={onConnect}><RefreshCw size={15} /> Sync</button><button className="btn secondary" onClick={onLogout} aria-label="Log out"><LogOut size={15} /></button></div></div>
  <main><header><div><div className="eyebrow">{data.academic_year} • {data.semester}</div><h1>{page === 'dashboard' ? 'Your course attendance' : page === 'timetable' ? 'Your timetable' : 'Plan your attendance'}</h1><p className="muted">Live KLU ERP data for the selected Academic Year and Semester.</p></div><button className="btn primary" onClick={onConnect}><RefreshCw size={17} /> Sync ERP</button></header>
    {page === 'dashboard' ? <AttendanceDashboard courses={data.courses} /> : page === 'timetable' ? <TimetableCalendar entries={data.timetable} courses={data.courses} /> : bunkMode ? <BunkPlanner entries={data.timetable} courses={data.courses} mode={bunkMode} /> : <div className="bunk-mode-placeholder" /> }
  </main>
  {page === 'bunk' && !bunkMode && <BunkModeModal onSelect={setBunkMode} onClose={() => setPage('dashboard')} />}
  </div>;
}

function Landing({ onConnect, darkMode, onToggleTheme }: { onConnect: () => void; darkMode: boolean; onToggleTheme: () => void }) {
  return <div className="landing">
    <nav className="landing-nav"><Brand /><div className="landing-links"><a href="#features">Features</a><a href="#how-it-works">How it works</a><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} /><button className="nav-login" onClick={onConnect}>Login</button></div></nav>
    <main>
      <section className="landing-main"><div className="hero-copy"><div className="eyebrow">KLU STUDENT WORKSPACE</div><h1>Know your attendance.<br /><em>Plan every class.</em></h1><p>Connect your KLU ERP account and get your attendance, timetable and personalized bunk planning in one place.</p><button className="btn primary hero-cta" onClick={onConnect}><LogIn size={20} /> Login to ERP <span className="cta-arrow">→</span></button><div className="trust"><ShieldCheck size={17} /> Your ERP password is never stored.</div></div><div className="hero-signal" aria-hidden="true"><div className="signal-line"><span>ATTENDANCE</span><b>Live from ERP</b><i /></div><div className="signal-grid"><div><span>01</span><b>Attendance</b><small>Subject-wise performance</small></div><div><span>02</span><b>Timetable</b><small>Your actual weekly schedule</small></div><div><span>03</span><b>Bunk planner</b><small>Plan with confidence</small></div></div></div></section>
      <section id="features" className="feature-strip"><div><span className="feature-index">01</span><h2>Attendance</h2><p>Track subject-wise attendance and component performance.</p></div><div><span className="feature-index">02</span><h2>Timetable</h2><p>See your actual KLU timetable in a clean calendar.</p></div><div><span className="feature-index">03</span><h2>Bunk Planner</h2><p>Plan skipped classes and instantly see their impact.</p></div></section>
      <section id="how-it-works" className="landing-security"><ShieldCheck size={20} /><div><b>Private by design</b><span>Connect a temporary ERP session, review your academic data, and keep control of your account.</span></div></section>
    </main>
    <footer className="landing-footer">Unofficial student utility. Always verify critical attendance decisions in the official ERP.</footer>
  </div>;
}

export default function App() {
  const [data, setData] = useState<ERPData | null>(null);
  const [connect, setConnect] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('klu-attend-theme') === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('klu-attend-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  const activeData = data;
  const logout = async () => {
    if (data?.bridge_id) await fetch(`${API}/api/erp/${data.bridge_id}`, { method: 'DELETE' }).catch(() => undefined);
    setData(null);
    setConnect(false);
  };
  if (activeData) return <><Dashboard data={activeData} onConnect={() => setConnect(true)} onLogout={() => { void logout(); }} darkMode={darkMode} onToggleTheme={() => setDarkMode((value) => !value)} />{connect && <ERPConnect onData={(value) => { setData(value); setConnect(false); }} onClose={() => setConnect(false)} />}</>;
  return <><Landing onConnect={() => setConnect(true)} darkMode={darkMode} onToggleTheme={() => setDarkMode((value) => !value)} />{connect && <ERPConnect onData={(value) => { setData(value); setConnect(false); }} onClose={() => setConnect(false)} />}</>;
}
