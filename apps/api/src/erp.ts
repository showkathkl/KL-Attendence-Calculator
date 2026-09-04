import { chromium as playwrightChromium, type Browser, type BrowserContext, type Page } from 'playwright';
import serverlessChromium from '@sparticuz/chromium';
import crypto from 'node:crypto';

// A cold `chromium.launch()` costs ~500ms-2s. Since every ERP session used to
// launch its own browser process, that latency was paid on every single
// "Connect to ERP" click. We now launch one Chromium process for the life of
// the server and hand out a fresh, isolated BrowserContext (cheap, ~10-30ms)
// per session instead — sessions stay fully isolated (separate cookies/
// storage per context) while start-up latency drops dramatically.
let sharedBrowserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    const executablePath = await serverlessChromium.executablePath();
    return playwrightChromium.launch({
      executablePath,
      headless: true,
      args: [
        ...serverlessChromium.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }

  return playwrightChromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--disable-gpu'],
  });
}

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchBrowser().then((browser) => {
      browser.on('disconnected', () => {
        sharedBrowserPromise = null;
      });
      return browser;
    });
  }

  try {
    return await sharedBrowserPromise;
  } catch (e) {
    sharedBrowserPromise = null;
    throw e;
  }
}

// Resource types that are never needed to read attendance/timetable data or
// to render the login CAPTCHA image. Blocking them cuts page-load time on
// the (often slow) ERP significantly since fonts/analytics/media are pure
// dead weight for a scraping session. Stylesheets and images are left alone
// on purpose — the CAPTCHA is an <img>, and some ERP screens rely on CSS to
// decide what is "visible" (used by visibleLocator()).
const BLOCKED_RESOURCE_TYPES = new Set(['font', 'media']);
const BLOCKED_URL_HINTS = ['google-analytics', 'googletagmanager', 'facebook.net', 'doubleclick', 'hotjar'];

async function applyFastRouting(context: BrowserContext) {
  await context.route('**/*', (route) => {
    const req = route.request();
    if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) return route.abort();
    if (BLOCKED_URL_HINTS.some((hint) => req.url().includes(hint))) return route.abort();
    return route.continue();
  });
}

const ERP_BASE = process.env.KLU_ERP_BASE_URL || 'https://newerp.kluniversity.in';
const ATTENDANCE_URL = process.env.KLU_ERP_ATTENDANCE_URL ||
  'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchinput';
const ATTENDANCE_FALLBACK_URL =
  'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput';
const SESSION_TTL_MS = Number(process.env.ERP_SESSION_TTL_MS || 10 * 60 * 1000);

type SelectOption = { value: string; label: string };
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
  components: ComponentAttendance[];
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

type BridgePayload = {
  version: 1;
  expiresAt: number;
  authenticated: boolean;
  url: string;
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>;
};

type Bridge = BridgePayload & {
  id: string;
  context: BrowserContext;
  page: Page;
};

// Vercel functions are stateless: a later request can run on a different
// function instance, so keeping Playwright BrowserContext objects in a module
// level Map is not reliable. The bridge token below contains an encrypted
// Playwright storageState (cookies + localStorage) and the current ERP URL.
// Each API request reconstructs a short-lived BrowserContext from that state,
// then returns an updated token when the ERP session changes.
const BRIDGE_SECRET = process.env.ERP_BRIDGE_SECRET || (process.env.VERCEL ? '' : 'local-development-erp-bridge-secret');
const BRIDGE_KEY = BRIDGE_SECRET ? crypto.createHash('sha256').update(BRIDGE_SECRET).digest() : null;

function requireBridgeKey() {
  if (!BRIDGE_KEY) {
    throw new Error('ERP_BRIDGE_SECRET is not configured. Add a strong random ERP_BRIDGE_SECRET environment variable in Vercel.');
  }
  return BRIDGE_KEY;
}

function base64Url(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function encodeBridge(payload: BridgePayload) {
  const key = requireBridgeKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(base64Url).join('.');
}

function decodeBridge(id: string): BridgePayload {
  const key = requireBridgeKey();
  const parts = id.split('.');
  if (parts.length !== 3) throw new Error('Invalid ERP bridge. Start a new connection.');
  try {
    const iv = fromBase64Url(parts[0]);
    const tag = fromBase64Url(parts[1]);
    const encrypted = fromBase64Url(parts[2]);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(plaintext) as BridgePayload;
    if (payload.version !== 1 || !payload.storageState || typeof payload.url !== 'string') {
      throw new Error('Invalid ERP bridge payload.');
    }
    if (payload.expiresAt <= Date.now()) throw new Error('ERP bridge expired. Start a new connection.');
    return payload;
  } catch (error) {
    if (error instanceof Error && /expired/i.test(error.message)) throw error;
    throw new Error('Invalid or expired ERP bridge. Start a new connection.');
  }
}

async function getBridge(id: string): Promise<Bridge> {
  const payload = decodeBridge(id);
  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    storageState: payload.storageState,
    ignoreHTTPSErrors: false,
  });
  await applyFastRouting(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto(payload.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(300);
  return {
    ...payload,
    id,
    context,
    page,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

async function persistBridge(bridge: Bridge) {
  const storageState = await bridge.context.storageState();
  return encodeBridge({
    version: 1,
    expiresAt: Date.now() + SESSION_TTL_MS,
    authenticated: bridge.authenticated,
    url: bridge.page.url() || bridge.url,
    storageState,
  });
}

async function closeBridgeContext(bridge: Bridge) {
  await bridge.context.close().catch(() => undefined);
}

async function visibleLocator(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function fillVisible(page: Page, selectors: string[], value: string) {
  const locator = await visibleLocator(page, selectors);
  if (!locator || !(await locator.isEnabled().catch(() => false))) return false;
  await locator.fill(value);
  return true;
}

async function clickVisible(page: Page, selectors: string[]) {
  const locator = await visibleLocator(page, selectors);
  if (!locator || !(await locator.isEnabled().catch(() => false))) return false;
  await locator.click();
  return true;
}

async function loginFormVisible(page: Page) {
  const username = await visibleLocator(page, [
    'input[placeholder*="Username" i]',
    'input[name*="user" i]',
    'input[id*="user" i]',
  ]);
  const password = await visibleLocator(page, [
    'input[placeholder*="Password" i]',
    'input[name*="pass" i]',
    'input[id*="pass" i]',
    'input[type="password"]',
  ]);
  return Boolean(username || password);
}

async function loggedInPageVisible(page: Page) {
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return /attendance register|academic registration|counselling diary|fee payments|hostel management|student profile|logout|dashboard|welcome/.test(body);
}

async function loginErrorVisible(page: Page) {
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return /invalid username|invalid password|incorrect password|wrong password|invalid verification|wrong verification|invalid captcha|captcha.*invalid|verification.*incorrect|authentication failed|login failed|invalid credentials/.test(body);
}

async function readLoginErrorMessage(page: Page) {
  const candidates = page.locator('.error, .alert, .help-block, [role="alert"], .has-error');
  const messages: string[] = [];
  for (let i = 0; i < Math.min(await candidates.count(), 10); i++) {
    const text = normalize(await candidates.nth(i).innerText().catch(() => ''));
    if (text && !messages.includes(text)) messages.push(text);
  }
  return messages.join(' | ').slice(0, 1000);
}

async function waitForLoginResult(page: Page) {
  // KLU may submit the login form through a normal navigation or through an
  // AJAX request. The old implementation waited for a full 15-second
  // Playwright timeout before checking the result, which made every rejected
  // login look like a Vercel 401 timeout. Poll the actual page state instead.
  for (let i = 0; i < 20; i++) {
    if (await loggedInPageVisible(page)) return true;
    if (await loginErrorVisible(page)) return false;
    if (!(await loginFormVisible(page))) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

export async function startERPBridge() {
  const browser = await getSharedBrowser();
  const context = await browser.newContext({ ignoreHTTPSErrors: false });
  await applyFastRouting(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  try {
    await page.goto(ERP_BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(300);

    const token = encodeBridge({
      version: 1,
      expiresAt: Date.now() + SESSION_TTL_MS,
      authenticated: false,
      url: page.url() || ERP_BASE,
      storageState: await context.storageState(),
    });

    return { bridgeId: token };
  } finally {
    // The encrypted storageState is the persistent bridge. Do not leave a
    // Playwright context attached to this serverless invocation.
    await context.close().catch(() => undefined);
  }
}

export async function submitERPLogin(input: {
  bridgeId: string;
  username: string;
  password: string;
  captcha?: string;
}) {
  const bridge = await getBridge(input.bridgeId);
  const { page } = bridge;

  const usernameFilled = await fillVisible(page, [
    'input[placeholder*="Enter Username" i]',
    'input[placeholder*="Username" i]',
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[type="text"]',
  ], input.username.trim());

  const passwordFilled = await fillVisible(page, [
    'input[placeholder*="Enter Password" i]',
    'input[placeholder*="Password" i]',
    'input[name*="pass" i]',
    'input[id*="pass" i]',
    'input[type="password"]',
  ], input.password);

  if (!usernameFilled || !passwordFilled) {
    throw new Error('Could not find the visible ERP username/password fields.');
  }

  if (!input.captcha?.trim()) {
    throw new Error('Enter the verification code shown by KLU ERP.');
  }

  const captchaFilled = await fillVisible(page, [
    'input[placeholder*="verification" i]',
    'input[name*="captcha" i]',
    'input[id*="captcha" i]',
  ], input.captcha.trim());

  if (!captchaFilled) {
    throw new Error('Could not find the visible ERP verification-code field.');
  }

  // KLU currently exposes an MFA/QR input in the HTML, but it is hidden in the
  // normal student login screen. We deliberately do not fill or bypass it.
  const clicked = await clickVisible(page, [
    'button:has-text("Login")',
    'input[type="submit"]',
    'button[type="submit"]',
  ]);

  if (!clicked) throw new Error('Could not find the visible ERP Login button.');

  const authenticated = await waitForLoginResult(page);
  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 15_000);
  const rejected = /invalid username|invalid password|incorrect password|wrong password|invalid verification|wrong verification|invalid captcha|captcha.*invalid|verification.*incorrect|authentication failed|login failed|invalid credentials/i.test(body);
  const erpError = await readLoginErrorMessage(page);

  if (!authenticated || rejected) {
    console.warn('ERP login was not accepted.', {
      url: page.url(),
      rejected,
      erpError,
    });
    const updatedBridgeId = await persistBridge(bridge);
    await closeBridgeContext(bridge);
    return {
      authenticated: false,
      requiresCaptcha: Boolean(await visibleLocator(page, [
        'input[placeholder*="verification" i]',
        'input[name*="captcha" i]',
        'input[id*="captcha" i]',
      ])),
      requiresMfa: false,
      message: erpError || (rejected
        ? 'KLU ERP rejected the username, password or verification code.'
        : 'ERP login was not completed. Check the credentials and verification code.'),
      bridgeId: await persistBridge(bridge),
    };
  }

  bridge.authenticated = true;
  const updatedBridgeId = await persistBridge(bridge);
  await closeBridgeContext(bridge);
  return {
    authenticated: true,
    requiresCaptcha: false,
    requiresMfa: false,
    message: 'ERP login succeeded. Opening Attendance Register…',
    bridgeId: updatedBridgeId,
  };
}

async function ensureAttendancePage(page: Page) {
  if (await loginFormVisible(page)) {
    throw new Error('ERP session is not logged in. Please connect again.');
  }

  const currentUrl = page.url().toLowerCase();
  const currentBody = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  if (currentUrl.includes('studentattendance') && /attendance\s*register/.test(currentBody) && await page.locator('select').count() > 0) {
    return page.url();
  }

  // Use the current Attendance Register route first. The older ERP route is kept
  // as a compatibility fallback because KLU has used both endpoints.
  const routes = [ATTENDANCE_URL, ATTENDANCE_FALLBACK_URL];
  let lastUrl = '';

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(500);

    if (await loginFormVisible(page)) {
      throw new Error('ERP redirected back to login. The ERP session may have expired.');
    }

    const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    const hasAttendance = /attendance register|academicyear|academic year/.test(body);
    const hasSelect = await page.locator('select').count() > 0;
    if (hasAttendance && hasSelect) return page.url();
    lastUrl = page.url();
  }

  throw new Error(`Logged-in ERP opened Attendance Register, but its filter controls were not available. URL: ${lastUrl}`);
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function optionIsPlaceholder(label: string) {
  return !label || /^(select|choose|please select)/i.test(label.trim());
}

function isAcademicYearOption(label: string) {
  return /^(?:20\d{2}\s*[-–]\s*20\d{2}|20\d{2}\s*\/\s*20\d{2})$/i.test(normalize(label));
}

function isSemesterOption(label: string) {
  return /odd\s*sem|even\s*sem|summer\s*term|term\s*\d+|semester\s*\d+|sem\s*\d+/i.test(normalize(label));
}

async function readSelect(
  select: ReturnType<Page['locator']>
): Promise<SelectOption[]> {
  const items = await select.locator('option').evaluateAll((elements) =>
    elements.map((element) => {
      // Playwright's evaluateAll callback runs in the browser, but this API
      // project does not include the DOM lib in its TypeScript configuration.
      // Use a small structural type instead of HTMLElement/HTMLInputElement.
      const el = element as unknown as {
        getAttribute?: (name: string) => string | null;
        textContent?: string | null;
        disabled?: boolean;
      };

      return {
        value: el.getAttribute?.('value') || el.textContent || '',
        label: el.textContent || '',
        disabled: Boolean(el.disabled),
      };
    })
  );

  return items
    .map((item) => ({
      value: normalize(item.value),
      label: normalize(item.label),
      disabled: item.disabled,
    }))
    .filter((item) => !optionIsPlaceholder(item.label))
    .map(({ value, label }) => ({
      value: value || label,
      label,
    }));
}

async function selectMeta(select: ReturnType<Page['locator']>) {
  return normalize(await select.evaluate((el) => {
    const e = el as any;
    const parent = e.parentElement;
    const labels = e.ownerDocument?.querySelectorAll?.('label') || [];
    let labelText = '';
    for (const label of Array.from(labels) as any[]) {
      if (label.htmlFor && label.htmlFor === e.id) {
        labelText = label.textContent || '';
        break;
      }
    }
    return [
      e.id,
      e.name,
      e.getAttribute?.('data-field-name'),
      e.getAttribute?.('aria-label'),
      labelText,
      parent?.innerText || '',
      parent?.parentElement?.innerText || '',
    ].filter(Boolean).join(' | ');
  }));
}

async function allNativeSelects(page: Page) {
  // Do not use :visible here. KLU uses a select2-style UI where the native
  // <select> can be visually hidden while the real options remain in the DOM.
  return page.locator('select');
}

async function findAcademicYearSelect(page: Page) {
  const selects = await allNativeSelects(page);
  let fallback: ReturnType<Page['locator']> | null = null;
  for (let i = 0; i < await selects.count(); i++) {
    const select = selects.nth(i);
    const options = await readSelect(select);
    const meta = await selectMeta(select);
    const joined = `${meta} ${options.map((o) => o.label).join(' ')}`;
    if (/academic\s*year|academicyear|academic_year/i.test(joined)) return select;
    if (options.some((option) => isAcademicYearOption(option.label))) fallback = select;
  }
  return fallback;
}

async function findSemesterSelect(page: Page) {
  const selects = await allNativeSelects(page);
  let fallback: ReturnType<Page['locator']> | null = null;
  for (let i = 0; i < await selects.count(); i++) {
    const select = selects.nth(i);
    const options = await readSelect(select);
    const meta = await selectMeta(select);
    const joined = `${meta} ${options.map((o) => o.label).join(' ')}`;
    if (/semester\s*id|semesterid|semester|semid/i.test(joined)) return select;
    if (options.some((option) => isSemesterOption(option.label))) fallback = select;
  }
  return fallback;
}

async function waitForAttendanceControls(page: Page) {
  for (let i = 0; i < 30; i++) {
    const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    if (/attendance\s*register/.test(body) && await page.locator('select').count() > 0) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(150);
}

async function readAttendanceFilters(page: Page) {
  await waitForAttendanceControls(page);
  const academic = await findAcademicYearSelect(page);
  const semester = await findSemesterSelect(page);
  if (!academic) throw new Error('Attendance Register loaded, but the ERP Academic Year <select> was not found. KLU may have changed the page markup.');

  const academicOptions = await readSelect(academic);
  if (!academicOptions.length) throw new Error('The ERP Academic Year dropdown was found, but it contains no options.');

  // Semester can be populated only after Academic Year is selected. Do not
  // fail the whole connection just because the initial page has an empty list.
  const semesterOptions = semester ? await readSelect(semester) : [];
  return { academic, semester, academicOptions, semesterOptions };
}

async function waitForSemesterOptions(page: Page) {
  for (let i = 0; i < 30; i++) {
    const semester = await findSemesterSelect(page);
    if (semester) {
      const options = await readSelect(semester);
      if (options.length) return semester;
    }
    await page.waitForTimeout(400);
  }
  return await findSemesterSelect(page);
}

async function selectExactOrContains(page: Page, select: ReturnType<Page['locator']>, requested: string) {
  const options = await readSelect(select);
  const requestedNormalized = normalize(requested).toLowerCase();
  const exact = options.find((option) => option.value.toLowerCase() === requestedNormalized || option.label.toLowerCase() === requestedNormalized);
  const contains = exact || options.find((option) =>
    option.label.toLowerCase().includes(requestedNormalized) || option.value.toLowerCase().includes(requestedNormalized)
  );
  if (!contains) {
    throw new Error(`ERP dropdown option "${requested}" was not found. Available: ${options.map((o) => o.label).join(', ')}`);
  }

  await select.scrollIntoViewIfNeeded().catch(() => undefined);
  await select.selectOption({ value: contains.value }).catch(async () => {
    await select.selectOption({ label: contains.label });
  });

  // KLU's form reacts to the native change event. selectOption dispatches it,
  // but give the page time to complete any AJAX refresh before the next step.
  await page.waitForTimeout(300);
  return contains;
}

function cleanText(value: string) {
  return normalize(value);
}

function numeric(value: string) {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function parseAttendanceValues(cells: string[]) {
  const ratio = cells.map((cell) => cell.match(/(\d{1,4})\s*(?:\/|of)\s*(\d{1,4})/i)).find(Boolean);
  if (ratio) return { attended: Number(ratio[1]), conducted: Number(ratio[2]) };

  const numbers = cells.map(numeric).filter((value) => Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 1000);
  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const attended = numbers[i];
      const conducted = numbers[j];
      if (conducted > 0 && attended <= conducted) return { attended, conducted };
    }
  }
  return null;
}

function isLikelyCourseCode(value: string) {
  return /\b(?:\d{2,4}[A-Z]{2,8}\d{3,8}[A-Z]?|[A-Z]{2,8}\d{3,8}[A-Z]?)\b/i.test(value);
}


function componentWeight(name: string) {
  const value = normalize(name).toLowerCase();
  if (value === 'l' || /lecture|theory/.test(value)) return 1;
  if (value === 't' || /tutorial/.test(value)) return 1;
  if (value === 'p' || /practical|lab/.test(value)) return 0.5;
  if (value === 's' || /skill|skilling/.test(value)) return 0.25;
  return 1;
}

function calculateKLUWeightedAttendance(components: ComponentAttendance[]) {
  let weighted = 0;
  let totalWeight = 0;
  for (const component of components) {
    if (component.conducted <= 0) continue;
    const w = componentWeight(component.name);
    const pct = (component.attended / component.conducted) * 100;
    weighted += pct * w;
    totalWeight += w;
  }
  const rawPercentage = totalWeight ? weighted / totalWeight : 0;
  return { rawPercentage, percentage: totalWeight ? Math.ceil(rawPercentage) : 0 };
}

function recalculateCourse(course: Course): Course {
  const result = calculateKLUWeightedAttendance(course.components);
  // KLU displays the subject result as the ceiling of the weighted percentage.
  course.percentage = result.percentage;
  course.attended = course.components.reduce((sum, c) => sum + c.attended, 0);
  course.conducted = course.components.reduce((sum, c) => sum + c.conducted, 0);
  return course;
}

function normalizeComponent(value: string) {
  const text = normalize(value);
  if (/^(?:l|lec|lecture|theory)$/i.test(text) || /\blecture|theory\b/i.test(text)) return 'Lecture';
  if (/^(?:p|prac|practical|lab)$/i.test(text) || /\bpractical|\blab\b/i.test(text)) return 'Practical';
  if (/^(?:s|skill|skilling)$/i.test(text) || /\bskill|skilling\b/i.test(text)) return 'Skill';
  if (/^(?:t|tutorial)$/i.test(text) || /\btutorial\b/i.test(text)) return 'Tutorial';
  return text || 'Lecture';
}

function extractLtpComponent(value: string) {
  const text = normalize(value);
  const token = text.match(/(?:^|[-\s(])([LPS])(?:[-\s)]|$)/i)?.[1];
  return token ? normalizeComponent(token) : normalizeComponent(text);
}

function parseTimetableCell(value: string) {
  const text = normalize(value);
  if (!text || /^[-–—]+$/.test(text)) return null;
  const codeMatch = text.match(/\b(?:\d{2,4}[A-Z]{2,8}\d{3,8}[A-Z]?|[A-Z]{2,8}\d{3,8}[A-Z]?)\b/i);
  if (!codeMatch) return null;
  const code = codeMatch[0].toUpperCase();
  const after = text.slice(codeMatch.index! + codeMatch[0].length);
  const componentMatch = after.match(/(?:^|[-\s(])([LPS])(?:[-\s)]|$)/i);
  const component = componentMatch ? normalizeComponent(componentMatch[1]) : 'Lecture';
  const roomMatch = text.match(/RoomNo[-: ]*([A-Za-z0-9-]+)/i) || text.match(/\b(?:Room|Lab)[-: ]*([A-Za-z0-9-]+)/i);
  const sectionMatch = text.match(/(?:^|[-\s])S[-: ]*([A-Za-z0-9-]+)/i);
  return { code, component, room: roomMatch?.[1] ? normalize(roomMatch[1]) : undefined, section: sectionMatch?.[1] ? normalize(sectionMatch[1]) : undefined };
}


function rowFromCells(cells: string[], headers: string[]): Course | null {
  // IMPORTANT: keep the original cell indexes. KLU's attendance table contains
  // empty cells (for example Fr Date / TCBR), and filtering them shifts the
  // Total Conducted / Total Attended columns and can make every component read
  // the wrong numbers.
  if (cells.length < 2 || headers.length < 2) return null;

  const lower = headers.map((value) => normalize(value).toLowerCase());
  const findHeader = (patterns: RegExp[]) => lower.findIndex((value) => patterns.some((pattern) => pattern.test(value)));

  const codeIndex = findHeader([/course\s*(code|id)/, /^coursecode$/, /^code$/]);
  const nameIndex = findHeader([/course\s*(?:name|desc|description)/, /^coursedesc$/, /subject/]);
  const componentIndex = findHeader([/^ltps?$/, /^ltp$/, /component/, /delivery\s*component/, /type/, /category/]);
  const attendedIndex = findHeader([/^total\s*attended$/, /^attended$/, /classes\s*attended/, /present/]);
  const conductedIndex = findHeader([/^total\s*conducted$/, /^conducted$/, /classes\s*conducted/, /total\s*classes/, /held/]);
  const percentageIndex = findHeader([/percent/, /^%$/]);

  // The real KLU table has explicit "Total Conducted" and "Total Attended"
  // columns. Never use a generic numeric-pair fallback when those headers are
  // present: the row number and other numeric fields can otherwise be mistaken
  // for attendance counts.
  let values: { attended: number; conducted: number } | null = null;
  if (attendedIndex >= 0 && conductedIndex >= 0) {
    const attended = numeric(cells[attendedIndex] || '');
    const conducted = numeric(cells[conductedIndex] || '');
    if (Number.isFinite(attended) && Number.isFinite(conducted) && conducted >= 0 && attended >= 0 && attended <= conducted) {
      values = { attended, conducted };
    }
  }

  // Only fall back when the ERP table genuinely has no attendance headers.
  // This keeps compatibility with older ERP table layouts without corrupting
  // the current Attendance Register.
  if (!values && attendedIndex < 0 && conductedIndex < 0) {
    values = parseAttendanceValues(cells);
  }
  if (!values) return null;

  const pctValue = percentageIndex >= 0 ? numeric(cells[percentageIndex] || '') : NaN;
  const percentage = Number.isFinite(pctValue) && pctValue >= 0 && pctValue <= 100
    ? pctValue
    : (values.conducted > 0 ? (values.attended / values.conducted) * 100 : 0);

  const courseCode = codeIndex >= 0 ? normalize(cells[codeIndex] || '') : cells.find(isLikelyCourseCode) || '';
  if (!courseCode || !isLikelyCourseCode(courseCode)) return null;

  const courseName = nameIndex >= 0
    ? normalize(cells[nameIndex] || '')
    : cells.find((cell, index) =>
        index !== attendedIndex && index !== conductedIndex && index !== percentageIndex && index !== componentIndex &&
        index !== codeIndex && cell && !/^\d+(?:\.\d+)?%?$/.test(cell) && !/\d+\s*\/\s*\d+/.test(cell)
      ) || courseCode;

  // In the KLU Attendance Register the LTP/LTPS column contains L, P or S.
  // If the current ERP layout has no component column, keep the legacy Lecture
  // fallback rather than inventing a component from unrelated text.
  const component = componentIndex >= 0 ? normalizeComponent(cells[componentIndex] || '') : 'Lecture';

  const course: Course = {
    course_code: cleanText(courseCode),
    course_name: cleanText(courseName || courseCode),
    // These are row-level ERP values. They are not hard-coded and are not
    // copied from another component/subject.
    attended: values.attended,
    conducted: values.conducted,
    percentage: Number(percentage.toFixed(2)),
    components: [{
      name: component,
      attended: values.attended,
      conducted: values.conducted,
      percentage: Number(percentage.toFixed(2)),
    }],
  };

  return recalculateCourse(course);
}

function mergeCourse(target: Course, incoming: Course) {
  const existingComponent = target.components.find((item) => item.name.toLowerCase() === incoming.components[0]?.name.toLowerCase());
  if (existingComponent) {
    existingComponent.attended += incoming.components[0].attended;
    existingComponent.conducted += incoming.components[0].conducted;
    existingComponent.percentage = existingComponent.conducted
      ? Number(((existingComponent.attended / existingComponent.conducted) * 100).toFixed(2))
      : 0;
  } else {
    target.components.push(...incoming.components);
  }
  target.attended += incoming.attended;
  target.conducted += incoming.conducted;
  recalculateCourse(target);
}

async function extractTableRows(page: Page) {
  const tables = page.locator('table:visible');
  const result = new Map<string, Course>();

  for (let tableIndex = 0; tableIndex < await tables.count(); tableIndex++) {
    const table = tables.nth(tableIndex);
    const rows = table.locator('tr:visible');
    if (await rows.count() < 2) continue;

    let headerIndex = 0;
    let headers = (await rows.nth(headerIndex).locator('th,td').allTextContents()).map(cleanText);
    if (!headers.some((h) => /attend|course|subject|present|conduct/i.test(h))) {
      for (let i = 1; i < Math.min(await rows.count(), 5); i++) {
        const candidate = (await rows.nth(i).locator('th,td').allTextContents()).map(cleanText);
        if (candidate.some((h) => /attend|course|subject|present|conduct/i.test(h))) {
          headerIndex = i;
          headers = candidate;
          break;
        }
      }
    }

    for (let rowIndex = headerIndex + 1; rowIndex < await rows.count(); rowIndex++) {
      const cells = (await rows.nth(rowIndex).locator('th,td').allTextContents()).map(cleanText);
      const course = rowFromCells(cells, headers);
      if (!course) continue;
      const key = `${course.course_code}:${course.course_name}`.toLowerCase();
      const existing = result.get(key);
      if (existing) mergeCourse(existing, course);
      else result.set(key, course);
    }
  }
  return [...result.values()];
}

function extractRowsFromText(text: string) {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  const result = new Map<string, Course>();

  for (const line of lines) {
    const ratio = line.match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
    if (!ratio) continue;
    const attended = Number(ratio[1]);
    const conducted = Number(ratio[2]);
    if (conducted <= 0 || attended > conducted || conducted > 1000) continue;

    const percentageMatch = line.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    const percentage = percentageMatch ? Number(percentageMatch[1]) : (attended / conducted) * 100;
    const code = line.match(/\b(?:\d{2,4}[A-Z]{2,8}\d{3,8}[A-Z]?|[A-Z]{2,8}\d{3,8}[A-Z]?)\b/i)?.[0] || `COURSE-${result.size + 1}`;
    const beforeRatio = line.slice(0, line.indexOf(ratio[0])).replace(code, '').trim();
    const courseName = beforeRatio || code;
    const course: Course = {
      course_code: code,
      course_name: courseName,
      attended,
      conducted,
      percentage: Number(percentage.toFixed(2)),
      components: [{ name: 'Lecture', attended, conducted, percentage: Number(percentage.toFixed(2)) }],
    };
    recalculateCourse(course);
    const key = `${course.course_code}:${course.course_name}`.toLowerCase();
    const existing = result.get(key);
    if (existing) mergeCourse(existing, course);
    else result.set(key, course);
  }
  return [...result.values()];
}

function parseTimeRange(value: string): { start_time: string; end_time: string } | null {
  const text = normalize(value).replace(/[–—]/g, '-');
  const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!match) return null;
  return { start_time: normalize(match[1]), end_time: normalize(match[2]) };
}

function normalizeDay(value: string) {
  const text = normalize(value).toLowerCase();
  const map: Record<string, string> = {
    mon: 'Monday', monday: 'Monday', tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
    wed: 'Wednesday', wednesday: 'Wednesday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
    fri: 'Friday', friday: 'Friday', sat: 'Saturday', saturday: 'Saturday', sun: 'Sunday', sunday: 'Sunday',
  };
  return map[text.replace(/[^a-z]/g, '')] || '';
}

function looksLikeCourse(value: string) {
  return isLikelyCourseCode(value) || /\b[A-Z]{2,8}\s*[-:]?\s*\d{2,6}\b/i.test(value);
}


async function openTimetablePage(page: Page) {
  // KLU puts Academic Timetable under Courses in the left navigation. The
  // exact href has changed between ERP builds, so discover the authenticated
  // link instead of relying on one guessed route.
  for (const label of ['Courses', 'Course']) {
    const candidates = page.getByText(new RegExp(`^${label}$`, 'i'));
    for (let i = 0; i < Math.min(await candidates.count(), 3); i++) {
      const candidate = candidates.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(100);
        break;
      }
    }
  }

  const navigables = page.locator('a, button');
  const discovered: Array<{ href: string; text: string; onclick: string }> = [];
  for (let i = 0; i < await navigables.count(); i++) {
    const item = navigables.nth(i);
    const text = normalize(await item.innerText().catch(() => ''));
    const href = await item.getAttribute('href').catch(() => null) || '';
    const onclick = await item.getAttribute('onclick').catch(() => null) || '';
    const title = await item.getAttribute('title').catch(() => null) || '';
    const aria = await item.getAttribute('aria-label').catch(() => null) || '';
    const signature = `${text} ${href} ${onclick} ${title} ${aria}`;
    if (/time\s*table|academic\s*table|student.*timetable|studenttimetable/i.test(signature)) {
      discovered.push({ href, text, onclick });
    }
  }

  // Prefer a real href because it is more reliable than a click on a hidden
  // Bootstrap/Yii menu item. Keep javascript menu items as a fallback.
  for (const item of discovered) {
    if (!item.href || item.href.startsWith('#') || /^javascript:/i.test(item.href)) continue;
    const target = new URL(item.href, ERP_BASE).toString();
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(200);
    if (await loginFormVisible(page)) throw new Error('ERP session expired while opening Academic Timetable.');
    const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    if (/academic\s*timetable|time\s*tables?|timetable|schedule/.test(body)) return page.url();
  }

  for (const item of discovered) {
    const target = item.href && !item.href.startsWith('#') && !/^javascript:/i.test(item.href)
      ? new URL(item.href, ERP_BASE).toString()
      : '';
    const locator = page.getByText(item.text, { exact: true }).first();
    if (await locator.count()) {
      await locator.click({ force: true }).catch(async () => {
        if (target) await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => undefined);
        else await locator.evaluate((el: any) => el.click()).catch(() => undefined);
      });
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
      const url = page.url().toLowerCase();
      if (/academic\s*timetable|time\s*tables?|timetable|schedule/.test(body) || /timetable|studenttimetable/.test(url)) return page.url();
    }
  }

  // Last-resort route discovery for common Yii controller names. These are
  // only attempted after the authenticated navigation link was inspected.
  const candidates = [
    `${ERP_BASE}/index.php?r=studentinfo%2Fstudenttimetable%2Findex`,
    `${ERP_BASE}/index.php?r=studentinfo%2Fstudenttimetable%2Ftimetable`,
    `${ERP_BASE}/index.php?r=studentinfo%2Fstudenttimetable%2Fsearchinput`,
    `${ERP_BASE}/index.php?r=studenttimetable%2Fstudenttimetable%2Findex`,
    `${ERP_BASE}/index.php?r=studenttimetable%2Fstudenttimetable%2Fsearchinput`,
    `${ERP_BASE}/index.php?r=studentacademictimetable%2Fstudentacademictimetable%2Findex`,
    `${ERP_BASE}/index.php?r=studentacademictimetable%2Fstudentacademictimetable%2Fsearchinput`,
    `${ERP_BASE}/index.php?r=studentacademic%2Fstudentacademictimetable%2Findex`,
    `${ERP_BASE}/index.php?r=studentacademic%2Fstudentacademictimetable%2Fsearchinput`,
  ];
  let lastUrl = page.url();
  for (const route of candidates) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    if (await loginFormVisible(page)) throw new Error('ERP session expired while opening Academic Timetable.');
    const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    if (/academic\s*timetable|time\s*tables?|timetable|schedule/.test(body) && await page.locator('table').count()) return page.url();
    lastUrl = page.url();
  }
  throw new Error(`Could not open the KLU ERP Academic Timetable page. Last URL: ${lastUrl}`);
}

async function applyTimetableFilters(page: Page, academicYear: string, semester: string) {
  const academic = await findAcademicYearSelect(page);
  if (!academic) return; // Current KLU Academic Timetable is session-scoped and has no year/semester filters.
  await selectExactOrContains(page, academic, academicYear);
  const semesterSelect = await waitForSemesterOptions(page);
  if (semesterSelect) await selectExactOrContains(page, semesterSelect, semester);

  const form = academic.locator('xpath=ancestor::form[1]');
  const scoped = form.locator('button, input[type="submit"], input[type="button"]');
  const count = await scoped.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const candidate = scoped.nth(i);
    const label = normalize((await candidate.innerText().catch(() => '')) || (await candidate.getAttribute('value').catch(() => '') || ''));
    if (/^search$/i.test(label)) {
      await candidate.click({ force: true });
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(200);
      return;
    }
  }
}

const KLU_PERIOD_TIMES: Record<number, { start_time: string; end_time: string }> = {
  1: { start_time: '7:10 AM', end_time: '8:00 AM' },
  2: { start_time: '8:00 AM', end_time: '8:50 AM' },
  3: { start_time: '9:20 AM', end_time: '10:10 AM' },
  4: { start_time: '10:10 AM', end_time: '11:00 AM' },
  5: { start_time: '11:10 AM', end_time: '12:00 PM' },
  6: { start_time: '12:00 PM', end_time: '12:50 PM' },
  8: { start_time: '1:50 PM', end_time: '2:40 PM' },
  9: { start_time: '2:40 PM', end_time: '3:30 PM' },
  10: { start_time: '3:50 PM', end_time: '4:40 PM' },
  11: { start_time: '4:40 PM', end_time: '5:30 PM' },
};

function parsePeriodNumber(value: string) {
  const match = normalize(value).match(/^(?:period|p)?\s*(\d{1,2})$/i);
  return match ? Number(match[1]) : undefined;
}

function parseTimetableMatrix(rows: string[][]): TimetableEntry[] {
  if (rows.length < 2) return [];
  const header = rows.find((row) => row.filter((cell) => /^\d{1,2}$/.test(normalize(cell))).length >= 3);
  if (!header) return [];
  const headerIndex = rows.indexOf(header);
  const periodColumns = new Map<number, number>();
  for (let i = 0; i < header.length; i++) {
    const period = parsePeriodNumber(header[i]);
    if (period !== undefined) periodColumns.set(i, period);
  }
  if (!periodColumns.size) return [];

  const entries: TimetableEntry[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const day = normalizeDay(row[0] || '');
    if (!day) continue;
    for (const [column, period] of periodColumns) {
      const parsed = parseTimetableCell(row[column] || '');
      if (!parsed) continue;
      entries.push({
        course_code: parsed.code,
        course_name: parsed.code,
        component: parsed.component,
        day_of_week: day,
        start_time: KLU_PERIOD_TIMES[period]?.start_time || '',
        end_time: KLU_PERIOD_TIMES[period]?.end_time || '',
        period,
        period_label: `Period ${period}`,
        room: parsed.room,
      });
    }
  }
  return entries;
}

async function extractPeriodTimeMap(page: Page, extraSources: string[] = []) {
  const map: Record<number, { start_time: string; end_time: string }> = { ...KLU_PERIOD_TIMES };

  const add = (periodText: string, rangeText: string) => {
    const period = Number(String(periodText).match(/\d{1,2}/)?.[0]);
    const range = parseTimeRange(rangeText);
    if (Number.isFinite(period) && range) map[period] = range;
  };

  // Visible/DOM metadata: title, data-* attributes, aria labels and cells.
  const nodes = page.locator('[title], [data-time], [data-start-time], [data-end-time], [data-period], th, td');
  for (let i = 0; i < Math.min(await nodes.count(), 2000); i++) {
    const node = nodes.nth(i);
    const attrs = [
      await node.innerText().catch(() => ''),
      await node.getAttribute('title').catch(() => '') || '',
      await node.getAttribute('aria-label').catch(() => '') || '',
      await node.getAttribute('data-time').catch(() => '') || '',
      await node.getAttribute('data-start-time').catch(() => '') || '',
      await node.getAttribute('data-end-time').catch(() => '') || '',
    ].join(' ');
    const periodAttr = await node.getAttribute('data-period').catch(() => null);
    const range = parseTimeRange(attrs);
    if (periodAttr && range) add(periodAttr, attrs);
    for (const match of attrs.matchAll(/(?:period|slot|p)\s*[-_:#]?\s*(\d{1,2})[^\d]{0,12}((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?))/gi)) {
      add(match[1], match[2]);
    }
  }

  // KLU has also exposed period/time maps inside javascript rather than visible
  // DOM. page.content() includes those scripts and is still the authenticated ERP
  // page, so read it without inventing a local period schedule.
  const html = await page.content().catch(() => '');
  const sources = [html, ...await page.locator('script').allTextContents().catch(() => []), ...extraSources];
  const patterns = [
    /(?:period|slot|p)\s*[-_:#]?\s*["']?(\d{1,2})["']?\s*[:=,>-]\s*["']?((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?))["']?/gi,
    /["'](\d{1,2})["']\s*:\s*["']((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?))["']/gi,
  ];
  for (const source of sources) {
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) add(match[1], match[2]);
    }
  }

  // Finally, support a plain legend such as "1 9:00 AM - 9:50 AM".
  const body = await page.locator('body').innerText().catch(() => '');
  for (const match of body.matchAll(/(?:period|slot)?\s*(\d{1,2})\s*[:.)-]?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi)) {
    add(match[1], `${match[2]} - ${match[3]}`);
  }

  return map;
}

async function extractTimetable(page: Page, extraSources: string[] = []): Promise<TimetableEntry[]> {
  const result: TimetableEntry[] = [];
  const seen = new Set<string>();
  const tables = page.locator('table');
  const periodTimes = await extractPeriodTimeMap(page, extraSources);

  for (let tableIndex = 0; tableIndex < await tables.count(); tableIndex++) {
    const table = tables.nth(tableIndex);
    const rowsLocator = table.locator('tr');
    const rows: string[][] = [];
    for (let i = 0; i < await rowsLocator.count(); i++) {
      const cells = (await rowsLocator.nth(i).locator('th,td').allTextContents()).map(cleanText);
      if (cells.length) rows.push(cells);
    }
    const matrixEntries = parseTimetableMatrix(rows);
    for (const entry of matrixEntries) {
      const range = entry.period ? periodTimes[entry.period] : undefined;
      if (range) Object.assign(entry, range);
      const key = [entry.day_of_week, entry.period, entry.course_code, entry.component, entry.room || ''].join('|').toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push(entry); }
    }

    // Also support a conventional row-based timetable if KLU changes the view.
    if (!matrixEntries.length && rows.length >= 2) {
      const headers = rows[0];
      for (const cells of rows.slice(1)) {
        const lower = headers.map((h) => h.toLowerCase());
        const idx = (patterns: RegExp[]) => lower.findIndex((h) => patterns.some((p) => p.test(h)));
        const dayIndex = idx([/^day$/, /day\s*of\s*week/]);
        const periodIndex = idx([/^period$/, /slot/]);
        const timeIndex = idx([/time/, /start/]);
        const codeIndex = idx([/course\s*(code|id)/, /^code$/]);
        const componentIndex = idx([/component/, /ltp/, /l\.?t\.?p/]);
        const roomIndex = idx([/room/, /venue/]);
        const day = dayIndex >= 0 ? normalizeDay(cells[dayIndex] || '') : '';
        const code = codeIndex >= 0 ? cells[codeIndex] : cells.find(looksLikeCourse) || '';
        if (!day || !code) continue;
        let range = timeIndex >= 0 ? parseTimeRange(cells[timeIndex] || '') : null;
        const period = periodIndex >= 0 ? parsePeriodNumber(cells[periodIndex] || '') : undefined;
        if (!range && period) range = periodTimes[period] || KLU_PERIOD_TIMES[period] || null;
        const component = componentIndex >= 0 ? extractLtpComponent(cells[componentIndex]) : 'Lecture';
        const entry: TimetableEntry = { course_code: cleanText(code), course_name: cleanText(code), component, day_of_week: day, start_time: range?.start_time || '', end_time: range?.end_time || '', period, period_label: period ? `Period ${period}` : undefined, room: roomIndex >= 0 ? cleanText(cells[roomIndex]) : undefined };
        const key = [entry.day_of_week, entry.period, entry.course_code, entry.component, entry.room || ''].join('|').toLowerCase();
        if (!seen.has(key)) { seen.add(key); result.push(entry); }
      }
    }
  }
  return result;
}

export async function getERPTimetable(bridgeId: string, academicYear: string, semester: string) {
  const bridge = await getBridge(bridgeId);
  if (!bridge.authenticated) throw new Error('ERP session is not authenticated.');
  const page = await bridge.context.newPage();
  page.setDefaultTimeout(15_000);
  // Some KLU builds render the timetable grid from an authenticated AJAX/JSON
  // response. Capture those response bodies while opening the page so period
  // times can be read from the same ERP session instead of being hard-coded.
  const responseBodies: string[] = [];
  const onResponse = async (response: import('playwright').Response) => {
    const type = response.request().resourceType();
    if (!['xhr', 'fetch', 'document'].includes(type)) return;
    try {
      const body = await response.text();
      if (/\b(?:period|slot|timetable|time)\b/i.test(body)) responseBodies.push(body);
    } catch {
      // Some ERP responses cannot be read after navigation; DOM extraction still runs.
    }
  };
  page.on('response', onResponse);

  let sourceUrl = '';
  try {
    await page.goto(bridge.page.url(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    sourceUrl = await openTimetablePage(page);
    await applyTimetableFilters(page, academicYear, semester);

  let entries: TimetableEntry[] = [];
  for (let i = 0; i < 15; i++) {
    entries = await extractTimetable(page, responseBodies);
    if (entries.length) break;
    await page.waitForTimeout(200);
  }

  if (!entries.length) {
    const visibleText = (await page.locator('body').innerText().catch(() => '')).slice(0, 5000).replace(/\s+/g, ' ');
    throw new Error(`ERP Academic Timetable opened, but no timetable entries were detected for ${academicYear} / ${semester}. Visible text: ${visibleText}`);
  }

  // The ERP grid exposes period numbers; KLU's campus schedule maps those
  // periods to the clock ranges below. Preserve ERP-provided times if present,
  // otherwise fill the known KLU period schedule.
  for (const entry of entries) {
    if (entry.period && KLU_PERIOD_TIMES[entry.period]) {
      entry.start_time ||= KLU_PERIOD_TIMES[entry.period].start_time;
      entry.end_time ||= KLU_PERIOD_TIMES[entry.period].end_time;
    }
  }

    return {
      entries,
      fetched_at: new Date().toISOString(),
      source_url: page.url() || sourceUrl,
      academic_year: academicYear,
      semester,
    };
  } finally {
    page.off('response', onResponse);
    await page.close().catch(() => undefined);
    await closeBridgeContext(bridge);
  }
}

export async function getAttendanceYearOptions(bridgeId: string) {
  const bridge = await getBridge(bridgeId);
  if (!bridge.authenticated) throw new Error('ERP session is not authenticated.');

  const { page } = bridge;
  const url = await ensureAttendancePage(page);
  const filters = await readAttendanceFilters(page);

  const result = {
    academicYearOptions: filters.academicOptions,
    semesterOptions: filters.semesterOptions,
    url,
  };
  await closeBridgeContext(bridge);
  return result;
}

export async function getAttendanceSemesterOptions(bridgeId: string, academicYear: string) {
  const bridge = await getBridge(bridgeId);
  if (!bridge.authenticated) throw new Error('ERP session is not authenticated.');
  const { page } = bridge;
  await ensureAttendancePage(page);
  const filters = await readAttendanceFilters(page);
  const selectedYear = await selectExactOrContains(page, filters.academic, academicYear);
  const semester = await waitForSemesterOptions(page);
  if (!semester) throw new Error('The ERP Semester dropdown was not found after selecting the Academic Year.');
  const semesterOptions = await readSelect(semester);
  if (!semesterOptions.length) throw new Error(`No Semester options were returned by KLU ERP for ${selectedYear.label}.`);
  const result = { academicYear: selectedYear, semesterOptions };
  await closeBridgeContext(bridge);
  return result;
}

async function clickSearch(page: Page) {
  const selectors = [
    'button:has-text("Search")',
    'input[type="submit"][value*="Search" i]',
    'input[type="button"][value*="Search" i]',
    'button[type="submit"]',
    'input[type="submit"]',
  ];

  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if (!(await candidate.count()) || !(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;
    await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
    await candidate.click().catch(async () => {
      await candidate.evaluate((el: any) => el.click());
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(200);
    return;
  }

  throw new Error('The KLU ERP Search button was not found on the Attendance Register.');
}

export async function syncERPAttendance(
  bridgeId: string,
  academicYear: string,
  semester: string,
) {
  const bridge = await getBridge(bridgeId);
  if (!bridge.authenticated) throw new Error('ERP session is not authenticated.');

  const { page } = bridge;
  const sourceUrl = await ensureAttendancePage(page);
  const filters = await readAttendanceFilters(page);

  const selectedYear = await selectExactOrContains(page, filters.academic, academicYear);
  // The semester list is commonly refreshed by KLU after the academic-year
  // change. Re-discover the native select and wait for its real ERP options.
  const refreshedSemester = await waitForSemesterOptions(page);
  if (!refreshedSemester) throw new Error('The ERP Semester dropdown was not found after selecting the Academic Year.');
  const selectedSemester = await selectExactOrContains(page, refreshedSemester, semester);

  // This is the actual ERP Search action. We do not fabricate an attendance URL
  // or scrape before the ERP applies its filters.
  await clickSearch(page);

  let courses: Course[] = [];
  for (let i = 0; i < 20; i++) {
    courses = await extractTableRows(page);
    if (courses.length) break;
    await page.waitForTimeout(200);
  }

  if (!courses.length) {
    courses = extractRowsFromText(await page.locator('body').innerText().catch(() => ''));
  }

  if (!courses.length) {
    const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 4_000).replace(/\s+/g, ' ');
    throw new Error(
      `ERP Search completed for ${selectedYear.label} / ${selectedSemester.label}, but no attendance rows were detected. ` +
      `The ERP may still require another filter or the result table may have changed. ` +
      `Visible text: ${body}`
    );
  }

  const result = {
    courses,
    fetched_at: new Date().toISOString(),
    source_url: page.url() || sourceUrl,
    page_title: await page.title(),
    academic_year: selectedYear.label,
    semester: selectedSemester.label,
  };
  await closeBridgeContext(bridge);
  return result;
}

export async function getERPState(bridgeId: string) {
  const bridge = decodeBridge(bridgeId);
  return {
    authenticated: bridge.authenticated,
    expiresAt: new Date(bridge.expiresAt).toISOString(),
    url: bridge.url,
  };
}

export async function getCaptchaScreenshot(bridgeId: string) {
  const bridge = await getBridge(bridgeId);
  const { page } = bridge;
  try {
    const input = await visibleLocator(page, [
      'input[placeholder*="verification" i]',
      'input[name*="captcha" i]',
      'input[id*="captcha" i]',
    ]);

    if (input) {
      const parent = input.locator('xpath=..');
      const img = parent.locator('img:visible').first();
      if (await img.count()) return await img.screenshot({ type: 'png' });
    }

    const images = page.locator('img:visible');
    for (let i = 0; i < Math.min(await images.count(), 20); i++) {
      const img = images.nth(i);
      const box = await img.boundingBox().catch(() => null);
      if (box && box.width >= 60 && box.height >= 20 && box.width <= 600 && box.height <= 300) {
        return await img.screenshot({ type: 'png' });
      }
    }
    return null;
  } finally {
    await closeBridgeContext(bridge);
  }
}

// Called once at server boot so the (slow, ~0.5-2s) Chromium process is
// already warm by the time the first student clicks "Connect to ERP",
// instead of that cost landing on their first request.
export async function warmUpERPBrowser() {
  try { await getSharedBrowser(); } catch { /* first real request will retry */ }
}

export async function closeERPBridge(_bridgeId: string) {
  // Nothing persistent is kept in the serverless invocation. The browser
  // context is closed at the end of every request; the encrypted token simply
  // expires naturally after SESSION_TTL_MS.
}
