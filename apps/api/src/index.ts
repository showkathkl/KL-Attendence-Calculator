import express, { Response } from 'express';
import compression from 'compression';
import cors from 'cors';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import {
  startERPBridge,
  submitERPLogin,
  syncERPAttendance,
  getAttendanceYearOptions,
  getAttendanceSemesterOptions,
  getERPState,
  getCaptchaScreenshot,
  getERPTimetable,
  closeERPBridge,
  warmUpERPBrowser,
} from './erp.js';

const app = express();

const port = Number(process.env.PORT || 3001);

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────

const allowedOrigins = new Set<string>([
  'http://localhost:5173',
  'http://localhost:3000',

  'https://kl-attendence-calculator07.vercel.app',

  'https://kl-attendence-calculator07-64ob9uf66-showkathkls-projects.vercel.app',
]);

if (process.env.VERCEL_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
}

if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => allowedOrigins.add(origin));
}

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  if (origin.endsWith('.vercel.app')) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────
// SECURITY / CORS
// ─────────────────────────────────────────────

app.disable('x-powered-by');

// Cast only the middleware factory.
// This avoids the TypeScript interop issue with the installed typings.
const helmetMiddleware = (helmet as unknown as {
  (options?: Record<string, unknown>): express.RequestHandler;
});

const rateLimitMiddleware = (
  rateLimit as unknown as {
    (options?: Record<string, unknown>): express.RequestHandler;
  }
);

app.use(
  helmetMiddleware({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn('CORS blocked origin:', origin);

      return callback(
        new Error(`CORS blocked origin: ${origin}`)
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
    ],
  })
);

app.options('*', cors());

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

app.use(compression());

app.use(
  express.json({
    limit: '256kb',
  })
);

app.use(
  rateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ─────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────

function ok(
  res: Response,
  data: unknown,
  status = 200
) {
  return res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function fail(
  res: Response,
  code: string,
  message: string,
  status = 400
) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────

app.get(['/health', '/api/health'], (_req, res) => {
  return ok(res, {
    status: 'ok',
    service: 'klu-attend-plus-api',
  });
});

// ─────────────────────────────────────────────
// ERP START
// ─────────────────────────────────────────────

app.post('/api/erp/start', async (_req, res) => {
  console.log('────────────────────────────────');
  console.log('ERP START REQUEST RECEIVED');
  console.log('Time:', new Date().toISOString());
  console.log('────────────────────────────────');

  try {
    console.log('Starting ERP bridge...');

    const result = await startERPBridge();

    console.log('ERP bridge started successfully.');
    console.log('Bridge ID:', result.bridgeId);

    return ok(res, {
      bridgeId: result.bridgeId,
      loginScreenshot: '',
    });
  } catch (e) {
    console.error('================================');
    console.error('ERP START ERROR');
    console.error('================================');

    if (e instanceof Error) {
      console.error('Name:', e.name);
      console.error('Message:', e.message);
      console.error('Stack:', e.stack);
    } else {
      console.error('Unknown error:', e);
    }

    console.error('================================');

    return fail(
      res,
      'ERP_UNAVAILABLE',
      e instanceof Error
        ? e.message
        : 'Could not open the KLU ERP login page.',
      503
    );
  }
});

// ─────────────────────────────────────────────
// ERP CAPTCHA
// ─────────────────────────────────────────────

app.get(
  '/api/erp/captcha/:bridgeId',
  async (req, res) => {
    try {
      const image = await getCaptchaScreenshot(
        req.params.bridgeId
      );

      if (!image) {
        return fail(
          res,
          'CAPTCHA_NOT_FOUND',
          'No CAPTCHA image was detected. The ERP may be using an interactive verification widget.',
          404
        );
      }

      res.setHeader(
        'Content-Type',
        'image/png'
      );

      return res.send(image);
    } catch (e) {
      console.error('CAPTCHA ERROR:', e);

      return fail(
        res,
        'ERP_SESSION_EXPIRED',
        'ERP bridge expired. Start a new connection.',
        410
      );
    }
  }
);

// ─────────────────────────────────────────────
// ERP LOGIN
// ─────────────────────────────────────────────

app.post(
  '/api/erp/login',
  async (req, res) => {
    const {
      bridgeId,
      username,
      password,
      captcha,
    } = req.body || {};

    if (
      !bridgeId ||
      !username ||
      !password
    ) {
      return fail(
        res,
        'INVALID_REQUEST',
        'Username, password and ERP bridge are required.'
      );
    }

    try {
      const result =
        await submitERPLogin({
          bridgeId,
          username,
          password,
          captcha,
        });

      // A failed ERP credential/CAPTCHA check is an expected application
      // result, not an HTTP authentication challenge for this API. Returning
      // 200 lets the frontend receive `result.message` instead of collapsing
      // it into the generic "Request failed (401)" message.
      return ok(res, result);
    } catch (e) {
      console.error(
        'ERP LOGIN ERROR:',
        e
      );

      return fail(
        res,
        'ERP_LOGIN_FAILED',
        e instanceof Error
          ? e.message
          : 'ERP login failed.',
        401
      );
    }
  }
);

// ─────────────────────────────────────────────
// ERP STATUS
// ─────────────────────────────────────────────

app.get(
  '/api/erp/status/:bridgeId',
  async (req, res) => {
    try {
      return ok(
        res,
        await getERPState(
          req.params.bridgeId
        )
      );
    } catch (e) {
      console.error(
        'ERP STATUS ERROR:',
        e
      );

      return fail(
        res,
        'ERP_SESSION_EXPIRED',
        'ERP bridge expired.',
        410
      );
    }
  }
);

// ─────────────────────────────────────────────
// ATTENDANCE YEAR OPTIONS
// ─────────────────────────────────────────────

app.get(
  '/api/erp/attendance/options/:bridgeId',
  async (req, res) => {
    try {
      return ok(
        res,
        await getAttendanceYearOptions(
          req.params.bridgeId
        )
      );
    } catch (e) {
      console.error(
        'ATTENDANCE OPTIONS ERROR:',
        e
      );

      return fail(
        res,
        'ATTENDANCE_OPTIONS_FAILED',
        e instanceof Error
          ? e.message
          : 'Could not load attendance year options.',
        502
      );
    }
  }
);

// ─────────────────────────────────────────────
// ATTENDANCE SEMESTER OPTIONS
// ─────────────────────────────────────────────

app.get(
  '/api/erp/attendance/semester-options/:bridgeId',
  async (req, res) => {
    try {
      const academicYear =
        typeof req.query.academicYear === 'string'
          ? req.query.academicYear
          : '';

      if (!academicYear) {
        return fail(
          res,
          'INVALID_ATTENDANCE_FILTER',
          'Academic Year is required.'
        );
      }

      return ok(
        res,
        await getAttendanceSemesterOptions(
          req.params.bridgeId,
          academicYear
        )
      );
    } catch (e) {
      console.error(
        'SEMESTER OPTIONS ERROR:',
        e
      );

      return fail(
        res,
        'ATTENDANCE_OPTIONS_FAILED',
        e instanceof Error
          ? e.message
          : 'Could not load semester options.',
        502
      );
    }
  }
);

// ─────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────

app.get(
  '/api/erp/timetable/:bridgeId',
  async (req, res) => {
    try {
      const academicYear =
        typeof req.query.academicYear === 'string'
          ? req.query.academicYear
          : '';

      const semester =
        typeof req.query.semester === 'string'
          ? req.query.semester
          : '';

      if (
        !academicYear ||
        !semester
      ) {
        return fail(
          res,
          'INVALID_TIMETABLE_FILTER',
          'Academic Year and Semester are required.'
        );
      }

      return ok(
        res,
        await getERPTimetable(
          req.params.bridgeId,
          academicYear,
          semester
        )
      );
    } catch (e) {
      console.error(
        'TIMETABLE ERROR:',
        e
      );

      return fail(
        res,
        'TIMETABLE_SYNC_FAILED',
        e instanceof Error
          ? e.message
          : 'Could not load the ERP timetable.',
        502
      );
    }
  }
);

// ─────────────────────────────────────────────
// ATTENDANCE SYNC
// ─────────────────────────────────────────────

app.post(
  '/api/erp/sync/:bridgeId',
  async (req, res) => {
    try {
      const academicYear =
        typeof req.body?.academicYear === 'string'
          ? req.body.academicYear
          : '';

      const semester =
        typeof req.body?.semester === 'string'
          ? req.body.semester
          : '';

      if (
        !academicYear ||
        !semester
      ) {
        return fail(
          res,
          'INVALID_ATTENDANCE_FILTER',
          'Academic Year and Semester are required.'
        );
      }

      return ok(
        res,
        await syncERPAttendance(
          req.params.bridgeId,
          academicYear,
          semester
        )
      );
    } catch (e) {
      console.error(
        'ATTENDANCE SYNC ERROR:',
        e
      );

      return fail(
        res,
        'ATTENDANCE_SYNC_FAILED',
        e instanceof Error
          ? e.message
          : 'Attendance sync failed.',
        502
      );
    }
  }
);

// ─────────────────────────────────────────────
// CLOSE ERP BRIDGE
// ─────────────────────────────────────────────

app.delete(
  '/api/erp/:bridgeId',
  async (req, res) => {
    try {
      await closeERPBridge(
        req.params.bridgeId
      );

      return ok(res, {
        disconnected: true,
      });
    } catch (e) {
      console.error(
        'ERP CLOSE ERROR:',
        e
      );

      return fail(
        res,
        'ERP_CLOSE_FAILED',
        'Could not close ERP bridge.',
        500
      );
    }
  }
);

// ─────────────────────────────────────────────
// 404
// ─────────────────────────────────────────────

app.use(
  (_req, res) => {
    return fail(
      res,
      'NOT_FOUND',
      'Endpoint not found.',
      404
    );
  }
);

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: Response,
    _next: express.NextFunction
  ) => {
    console.error(
      'GLOBAL SERVER ERROR:',
      err
    );

    if (
      err instanceof Error &&
      err.message.startsWith(
        'CORS blocked origin'
      )
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CORS_ERROR',
          message: err.message,
        },
        timestamp:
          new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          err instanceof Error
            ? err.message
            : 'Internal server error.',
      },
      timestamp:
        new Date().toISOString(),
    });
  }
);

// ─────────────────────────────────────────────
// SERVER / VERCEL HANDLER
// ─────────────────────────────────────────────
// Vercel imports this Express app as a serverless function, so the module
// must NOT call app.listen() there. Local development still uses the normal
// long-running Express server.
if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`KLU Attend+ API running on port ${port}`);
    console.log('Allowed CORS origins:');
    for (const origin of allowedOrigins) {
      console.log(' -', origin);
    }
    console.log('Starting ERP browser warm-up...');
    void warmUpERPBrowser()
      .then(() => console.log('ERP browser warm-up completed.'))
      .catch((error) => console.error('ERP browser warm-up failed:', error));
  });
}

export default app;
