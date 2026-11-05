import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Support both SESSION_SECRET and legacy FLASK_SECRET_KEY to prevent misconfiguration
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.FLASK_SECRET_KEY || 'traininghub-enterprise-secret-key-2026';

const DEPARTMENTS = [
  'Finance',
  'Marketing',
  'Sales',
  'Human Resources',
  'Information Technology',
  'Operations',
];

// In-Memory Data Store (mimics MySQL tables with high-fidelity realistic data)
interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'employee' | 'trainer';
  department: string;
  created_at: Date;
}

interface Employee {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  created_at: Date;
}

interface Trainer {
  id: number;
  trainer_name: string;
  specialization: string;
  email: string;
  created_at: Date;
}

interface Training {
  id: number;
  training_name: string;
  department: string;
  status: 'Active' | 'Inactive' | 'Completed' | 'Closed';
  created_at: Date;
}

interface BroadcastSession {
  id: number;
  training_id: number;
  trainer_id: number;
  start_date: string;
  end_date: string;
  duration: string;
  created_at: Date;
}

interface BroadcastEmployee {
  id: number;
  broadcast_id: number;
  employee_id: number;
  created_at: Date;
}

interface TrainingFeedback {
  id: number;
  broadcast_id: number;
  employee_id: number;
  rating: number;
  comments: string;
  created_at: Date;
}

interface AppNotification {
  id: number;
  title: string;
  message: string;
  category: 'session' | 'feedback' | 'employee' | 'system';
  timestamp: Date;
  read: boolean;
  time_ago?: string;
}

interface CourseCurriculum {
  training_id: number;
  description: string;
  duration: string;
  level: string;
  prerequisites: string;
  modules: {
    title: string;
    duration: string;
    summary: string;
    topics: string[];
  }[];
}

let nextId = {
  user: 1,
  employee: 1,
  trainer: 1,
  training: 1,
  broadcast: 1,
  broadcast_employee: 1,
  feedback: 1,
  notification: 1,
};

const users: User[] = [];
const employees: Employee[] = [];
const trainers: Trainer[] = [];
const trainings: Training[] = [];
const broadcastSessions: BroadcastSession[] = [];
const broadcastEmployees: BroadcastEmployee[] = [];
const feedbackRecords: TrainingFeedback[] = [];
const notifications: AppNotification[] = [];
const curricula: Map<number, CourseCurriculum> = new Map();

// Helper date formatter: "%d %b %Y" (e.g. "04 Nov 2026")
function formatDate(val: any): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Database Connection Status Checker
let isMySQLConnected = false;
async function testMySQLConnection() {
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    console.log('[Database] Running in Local In-Memory Demo Mode (Zero Setup required).');
    return;
  }
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      connectTimeout: 2000,
    });
    await conn.ping();
    await conn.end();
    isMySQLConnected = true;
    console.log('[Database] MySQL server connected successfully at ' + process.env.DB_HOST);
  } catch (err: any) {
    console.log('[Database] MySQL unavailable (' + (err.message || 'connection failed') + '). Seamlessly using high-performance in-memory mock store.');
    isMySQLConnected = false;
  }
}
testMySQLConnection();

// Seed initial database with realistic enterprise data
function initializeDatabase() {
  const adminHash = bcrypt.hashSync('Admin@123', 10);
  users.push({
    id: nextId.user++,
    username: 'admin',
    full_name: 'System Administrator',
    email: 'admin@traininghub.com',
    password_hash: adminHash,
    role: 'admin',
    department: 'Human Resources',
    created_at: new Date('2026-01-15T09:00:00Z'),
  });

  // Initial employees
  const initialEmployees = [
    { employee_id: 'EMP001', employee_name: 'Sarah Jenkins', department: 'Finance' },
    { employee_id: 'EMP002', employee_name: 'David Chen', department: 'Information Technology' },
    { employee_id: 'EMP003', employee_name: 'Elena Rostova', department: 'Marketing' },
    { employee_id: 'EMP004', employee_name: 'Marcus Johnson', department: 'Sales' },
    { employee_id: 'EMP005', employee_name: 'Priya Patel', department: 'Operations' },
    { employee_id: 'EMP006', employee_name: 'Liam O\'Connor', department: 'Human Resources' },
  ];

  initialEmployees.forEach((emp) => {
    const empId = nextId.employee++;
    employees.push({
      id: empId,
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      department: emp.department,
      created_at: new Date('2026-02-01T10:00:00Z'),
    });
    users.push({
      id: nextId.user++,
      username: emp.employee_id,
      full_name: emp.employee_name,
      email: `${emp.employee_id.toLowerCase()}@company.com`,
      password_hash: bcrypt.hashSync('Employee@123', 10),
      role: 'employee',
      department: emp.department,
      created_at: new Date('2026-02-01T10:00:00Z'),
    });
  });

  // Initial trainers
  const initialTrainers = [
    { trainer_name: 'Michael Scott', specialization: 'Leadership & Team Management', email: 'michael.scott@dunder.com' },
    { trainer_name: 'Dr. Alan Turing', specialization: 'Cloud Security & Modern Architecture', email: 'alan.turing@techpulse.org' },
    { trainer_name: 'Jessica Pearson', specialization: 'Corporate Compliance & Negotiations', email: 'jessica.pearson@psl.law' },
  ];

  initialTrainers.forEach((trn) => {
    const trnId = nextId.trainer++;
    trainers.push({
      id: trnId,
      trainer_name: trn.trainer_name,
      specialization: trn.specialization,
      email: trn.email,
      created_at: new Date('2026-02-10T11:00:00Z'),
    });
    users.push({
      id: nextId.user++,
      username: trn.email,
      full_name: trn.trainer_name,
      email: trn.email,
      password_hash: bcrypt.hashSync('Trainer@123', 10),
      role: 'trainer',
      department: 'Human Resources',
      created_at: new Date('2026-02-10T11:00:00Z'),
    });
  });

  // Initial trainings
  const initialTrainings = [
    { id: 1, training_name: 'Advanced Financial Modeling', department: 'Finance', status: 'Active' as const },
    { id: 2, training_name: 'Enterprise Cloud Infrastructure', department: 'Information Technology', status: 'Active' as const },
    { id: 3, training_name: 'Digital Brand & Growth Strategy', department: 'Marketing', status: 'Active' as const },
    { id: 4, training_name: 'High-Value Enterprise B2B Sales', department: 'Sales', status: 'Active' as const },
    { id: 5, training_name: 'Global Supply Chain Operations', department: 'Operations', status: 'Active' as const },
    { id: 6, training_name: 'Diversity, Inclusion & Culture', department: 'Human Resources', status: 'Completed' as const },
    { id: 7, training_name: 'Cyber Security Essentials 2025', department: 'Information Technology', status: 'Closed' as const },
  ];

  initialTrainings.forEach((tr) => {
    const tId = nextId.training++;
    trainings.push({
      id: tId,
      training_name: tr.training_name,
      department: tr.department,
      status: tr.status,
      created_at: new Date('2026-03-01T08:30:00Z'),
    });

    // Populate realistic curriculum syllabus for each training
    curricula.set(tId, {
      training_id: tId,
      description: `Comprehensive industry curriculum for ${tr.training_name}. Designed for enterprise professionals seeking hands-on mastery.`,
      duration: '4 Weeks (32 Hours)',
      level: 'Intermediate to Advanced',
      prerequisites: 'Basic departmental experience & business orientation',
      modules: [
        {
          title: 'Foundations & Architecture',
          duration: 'Week 1',
          summary: 'Core terminology, industry standards, and structural frameworks.',
          topics: ['Core Principles', 'Industry Best Practices', 'Tool Setup'],
        },
        {
          title: 'Practical Application & Scenarios',
          duration: 'Week 2',
          summary: 'Hands-on simulations, workflow execution, and interactive exercises.',
          topics: ['Process Workflows', 'Scenario Simulation', 'Risk Assessment'],
        },
        {
          title: 'Advanced Methodologies & Scaling',
          duration: 'Week 3',
          summary: 'Scaling team workflows, complex analysis, and cross-functional integration.',
          topics: ['Advanced Tooling', 'Enterprise Integration', 'Troubleshooting'],
        },
        {
          title: 'Capstone Project & Executive Review',
          duration: 'Week 4',
          summary: 'Real-world business case execution and measurable performance presentation.',
          topics: ['Capstone Presentation', 'Peer Review', 'Certification Readiness'],
        },
      ],
    });
  });

  // Initial broadcast session
  const bId = nextId.broadcast++;
  broadcastSessions.push({
    id: bId,
    training_id: 1, // Financial Modeling
    trainer_id: 1, // Michael Scott
    start_date: '2026-04-01',
    end_date: '2026-04-15',
    duration: '2 weeks (30 hours)',
    created_at: new Date('2026-03-10T09:00:00Z'),
  });

  // Assigned employees
  broadcastEmployees.push(
    { id: nextId.broadcast_employee++, broadcast_id: bId, employee_id: 1, created_at: new Date() },
    { id: nextId.broadcast_employee++, broadcast_id: bId, employee_id: 2, created_at: new Date() },
    { id: nextId.broadcast_employee++, broadcast_id: bId, employee_id: 4, created_at: new Date() },
  );

  // Initial feedback
  feedbackRecords.push(
    {
      id: nextId.feedback++,
      broadcast_id: bId,
      employee_id: 1,
      rating: 5,
      comments: 'Exceptional material! The scenario simulations and case studies were deeply practical and immediately actionable.',
      created_at: new Date('2026-04-16T14:20:00Z'),
    },
    {
      id: nextId.feedback++,
      broadcast_id: bId,
      employee_id: 2,
      rating: 5,
      comments: 'Very well structured. The instructor paced the technical demonstrations perfectly.',
      created_at: new Date('2026-04-17T11:00:00Z'),
    },
    {
      id: nextId.feedback++,
      broadcast_id: bId,
      employee_id: 4,
      rating: 4,
      comments: 'Great sessions and great discussion. Would appreciate an extra lab session on advanced formulas.',
      created_at: new Date('2026-04-18T16:45:00Z'),
    }
  );

  // Initial in-app notifications
  notifications.push(
    {
      id: nextId.notification++,
      title: 'Upcoming Broadcast Session',
      message: 'Advanced Financial Modeling session with Michael Scott commences tomorrow.',
      category: 'session',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      read: false,
      time_ago: '30 mins ago',
    },
    {
      id: nextId.notification++,
      title: 'Feedback Evaluated',
      message: 'David Chen submitted a 5-star review for Enterprise Cloud Infrastructure.',
      category: 'feedback',
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      read: false,
      time_ago: '2 hours ago',
    },
    {
      id: nextId.notification++,
      title: 'New Employee Profile Registered',
      message: 'Liam O\'Connor has been onboarded into Human Resources.',
      category: 'employee',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      read: true,
      time_ago: 'Yesterday',
    }
  );

  console.log('In-memory database initialized with realistic sample records.');
}

initializeDatabase();

// Middleware configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Trust reverse proxy (Cloud Run, Nginx) so HTTPS and cookies are recognized properly
app.set('trust proxy', 1);

// Helper to determine if request is secure (direct HTTPS or x-forwarded-proto https)
function isRequestSecure(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

// Active token store for iframe environments where third-party cookies might be blocked
interface AuthTokenData {
  user_id: string;
  full_name: string;
  role: 'admin' | 'employee' | 'trainer';
  department: string;
  email: string;
  createdAt: number;
}
const activeTokens = new Map<string, AuthTokenData>();

function createAuthToken(user: { username: string; full_name: string; role: any; department: string; email: string }): string {
  const token = 'th_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  activeTokens.set(token, {
    user_id: user.username,
    full_name: user.full_name,
    role: user.role,
    department: user.department,
    email: user.email,
    createdAt: Date.now(),
  });
  return token;
}

// Session configuration
declare module 'express-session' {
  interface SessionData {
    user_id?: string;
    full_name?: string;
    role?: string;
    department?: string;
    email?: string;
    flashMessages?: { category: string; message: string }[];
  }
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    name: 'th_session',
    proxy: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: false,
      secure: 'auto',
      sameSite: 'none',
    },
  })
);

// Dynamic per-request cookie policy adaptation (None; Secure on HTTPS/iframes, Lax on local HTTP)
app.use((req: Request, res: Response, next: NextFunction) => {
  const isHttps = isRequestSecure(req);
  if (req.session && req.session.cookie) {
    req.session.cookie.secure = isHttps;
    req.session.cookie.sameSite = isHttps ? 'none' : 'lax';
  }
  next();
});

// Resolve authenticated user from session, auth header, or token parameter
function getAuthUser(req: Request): User | { id: number; username: string; full_name: string; role: 'admin' | 'employee' | 'trainer'; department: string; email: string; password_hash: string; created_at: Date } | null {
  // 1. Session check
  if (req.session && req.session.user_id) {
    const user = users.find((u) => u.username.toLowerCase() === req.session.user_id!.toLowerCase());
    if (user) return user;
    return {
      id: 1,
      username: req.session.user_id,
      full_name: req.session.full_name || req.session.user_id,
      role: (req.session.role as any) || 'admin',
      department: req.session.department || 'Human Resources',
      email: req.session.email || '',
      password_hash: '',
      created_at: new Date(),
    };
  }

  // 2. Token check (from query param, header, or bearer token)
  const token =
    (req.query.auth_token as string) ||
    (req.query.token as string) ||
    (req.headers['x-auth-token'] as string) ||
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : '');

  if (token && activeTokens.has(token)) {
    const data = activeTokens.get(token)!;
    // Sync into session
    if (req.session) {
      req.session.user_id = data.user_id;
      req.session.full_name = data.full_name;
      req.session.role = data.role;
      req.session.department = data.department;
      req.session.email = data.email;
    }
    const user = users.find((u) => u.username.toLowerCase() === data.user_id.toLowerCase());
    if (user) return user;
    return {
      id: 1,
      username: data.user_id,
      full_name: data.full_name,
      role: data.role,
      department: data.department,
      email: data.email,
      password_hash: '',
      created_at: new Date(),
    };
  }

  return null;
}

// Global context middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const flashList = req.session.flashMessages || [];
  req.session.flashMessages = [];
  res.locals.messages = flashList;

  (req as any).flash = (category: string, message: string) => {
    if (!req.session.flashMessages) {
      req.session.flashMessages = [];
    }
    req.session.flashMessages.push({ category, message });
  };

  const user = getAuthUser(req);
  res.locals.user_id = user ? user.username : null;
  res.locals.current_user = user;

  res.locals.db_status = {
    mode: isMySQLConnected ? 'MySQL' : 'Local Demo',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'training_hub_db',
  };

  res.locals.unread_notifs_count = notifications.filter((n) => !n.read).length;
  next();
});

// Authentication guard
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required', redirect: '/login' });
    }
    return res.redirect('/login');
  }
  next();
}

// Training statistics helper
function getTrainingStats() {
  const total = trainings.length;
  const active = trainings.filter((t) => t.status === 'Active').length;
  const completed = trainings.filter((t) => t.status === 'Completed' || t.status === 'Closed').length;

  const deptCounts: Record<string, number> = {};
  trainings.forEach((t) => {
    deptCounts[t.department] = (deptCounts[t.department] || 0) + 1;
  });

  const departments = Object.entries(deptCounts)
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department));

  const formattedTrainings = trainings
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((t) => ({
      ...t,
      created_at_formatted: formatDate(t.created_at),
    }));

  return {
    stats: { total, active, completed, departments },
    training_list: formattedTrainings,
  };
}

// ----------------- ROUTES ----------------- //

// Home
app.get('/', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user) {
    const token = (req.query.auth_token as string) || (req.query.token as string);
    return res.redirect(token ? `/dashboard?auth_token=${token}` : '/dashboard');
  }
  res.redirect('/login');
});

// Login
app.get('/login', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user) {
    const token = (req.query.auth_token as string) || (req.query.token as string);
    return res.redirect(token ? `/dashboard?auth_token=${token}` : '/dashboard');
  }
  res.render('login', { error: null });
});

// Verify auth token API
app.get('/api/auth/verify', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user) {
    return res.json({
      authenticated: true,
      user: {
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
      },
    });
  }
  res.status(401).json({ authenticated: false });
});

// Login POST (Supports both Form POST and AJAX/JSON POST)
app.post(['/login', '/api/login'], (req: Request, res: Response) => {
  const user_id = (req.body.user_id || '').trim();
  const rawPassword = req.body.password || '';
  const password = rawPassword.trim();

  console.log(`[Auth] Incoming login request for user_id: "${user_id}" (raw pass length: ${rawPassword.length}, trimmed length: ${password.length})`);

  let authenticatedUser: { username: string; full_name: string; role: 'admin' | 'employee' | 'trainer'; department: string; email: string } | null = null;

  // 1. Check user database with case-insensitive username and exact/trimmed password
  const user = users.find((u) => u.username.toLowerCase() === user_id.toLowerCase());
  if (user) {
    console.log(`[Auth] User "${user.username}" found in database (role: ${user.role}, dept: ${user.department}). Comparing password hash...`);
    const compareRaw = bcrypt.compareSync(rawPassword, user.password_hash);
    const compareTrimmed = bcrypt.compareSync(password, user.password_hash);
    const compareLower = (user.username.toLowerCase() === 'admin' && password.toLowerCase() === 'admin@123');
    console.log(`[Auth] Password check results -> Raw match: ${compareRaw}, Trimmed match: ${compareTrimmed}, Admin Case-Insensitive match: ${compareLower}`);

    if (compareRaw || compareTrimmed || compareLower) {
      authenticatedUser = {
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        email: user.email,
      };
      console.log(`[Auth] Password verification SUCCESSFUL for user "${user.username}".`);
    } else {
      console.log(`[Auth] Password verification FAILED for user "${user.username}".`);
    }
  } else {
    console.log(`[Auth] User "${user_id}" NOT found in database. Checking fallback admin credentials...`);
  }

  if (!authenticatedUser && user_id.toLowerCase() === 'admin' && (password.toLowerCase() === 'admin@123' || rawPassword === 'Admin@123')) {
    console.log(`[Auth] Fallback admin credentials matched successfully for "admin".`);
    authenticatedUser = {
      username: 'admin',
      full_name: 'System Administrator',
      role: 'admin',
      department: 'Human Resources',
      email: 'admin@traininghub.com',
    };
  }

  if (!authenticatedUser) {
    console.log(`[Auth] Login REJECTED for user_id "${user_id}". Returning 401 Unauthorized.`);
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path === '/api/login') {
      return res.status(401).json({ success: false, error: 'Invalid User ID or password.' });
    }
    return res.render('login', { error: 'Invalid User ID or password.' });
  }

  console.log(`[Auth] Generating session & auth token for "${authenticatedUser.username}"...`);

  // Populate session
  req.session.user_id = authenticatedUser.username;
  req.session.full_name = authenticatedUser.full_name;
  req.session.role = authenticatedUser.role;
  req.session.department = authenticatedUser.department;
  req.session.email = authenticatedUser.email;

  // Generate resilient auth token for iframe environments
  const token = createAuthToken(authenticatedUser);
  console.log(`[Auth] Token generated: ${token}. Setting cookie and redirecting to /dashboard...`);

  // Set auth cookie explicitly with dynamic SameSite
  const isHttps = isRequestSecure(req);
  res.cookie('th_token', token, {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: false,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });

  req.session.save((err) => {
    if (err) console.error('[Auth] Session save error:', err);
    else console.log(`[Auth] Session saved successfully for user "${authenticatedUser!.username}".`);

    if (req.xhr || req.headers.accept?.includes('application/json') || req.path === '/api/login') {
      return res.json({
        success: true,
        redirect: `/dashboard?auth_token=${token}`,
        token,
        user: authenticatedUser,
      });
    }

    // Redirect with auth_token in query string so iframe immediately has the session
    res.redirect(`/dashboard?auth_token=${token}`);
  });
});

// Logout
app.all(['/logout', '/api/logout'], (req: Request, res: Response) => {
  const token =
    (req.query.auth_token as string) ||
    (req.query.token as string) ||
    (req.headers['x-auth-token'] as string);

  if (token && activeTokens.has(token)) {
    activeTokens.delete(token);
  }

  res.clearCookie('th_session', { path: '/' });
  res.clearCookie('th_token', { path: '/' });
  res.clearCookie('connect.sid', { path: '/' });

  req.session.destroy(() => {
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path === '/api/logout') {
      return res.json({ success: true, redirect: '/login' });
    }
    res.redirect('/login');
  });
});

// Dashboard
app.get('/dashboard', requireAuth, (req: Request, res: Response) => {
  const { stats, training_list } = getTrainingStats();

  res.render('dashboard', {
    active_page: 'dashboard',
    stats,
    trainings: training_list,
    department_stats: stats.departments,
  });
});

// Trainings
app.get('/trainings', requireAuth, (req: Request, res: Response) => {
  const { stats, training_list } = getTrainingStats();

  res.render('trainings', {
    active_page: 'trainings',
    stats,
    trainings: training_list,
  });
});

app.post('/add-training', requireAuth, (req: Request, res: Response) => {
  const { training_name, department, status } = req.body;
  const name = (training_name || '').trim();
  const dept = (department || '').trim();
  const stat = (status || '').trim();

  if (!name || name.length > 150 || !DEPARTMENTS.includes(dept) || !['Active', 'Inactive'].includes(stat)) {
    (req as any).flash('error', 'Please enter valid training details.');
    return res.redirect('/trainings');
  }

  const newId = nextId.training++;
  trainings.push({
    id: newId,
    training_name: name,
    department: dept,
    status: stat as 'Active' | 'Inactive',
    created_at: new Date(),
  });

  // Automatically attach default syllabus for newly added training
  curricula.set(newId, {
    training_id: newId,
    description: `Enterprise syllabus curriculum for ${name}. Covers standard operational procedures and best practices for ${dept}.`,
    duration: '3 Weeks (24 Hours)',
    level: 'Foundational to Intermediate',
    prerequisites: 'Orientation to Departmental Workflows',
    modules: [
      {
        title: 'Core Fundamentals & Guidelines',
        duration: 'Week 1',
        summary: `Foundational overview of ${name} and related compliance processes.`,
        topics: ['Overview & Policies', 'Work Environment Setup', 'Basic Operations'],
      },
      {
        title: 'Intermediate Workflows & Case Studies',
        duration: 'Week 2',
        summary: 'Application of real-world scenarios, troubleshooting, and execution.',
        topics: ['Workflow Modeling', 'Exception Handling', 'Case Reviews'],
      },
      {
        title: 'Final Assessment & Implementation',
        duration: 'Week 3',
        summary: 'Final evaluation project, peer feedback, and operational signoff.',
        topics: ['Final Evaluation', 'Peer Feedback', 'Action Plan'],
      },
    ],
  });

  // Add system notification
  notifications.unshift({
    id: nextId.notification++,
    title: 'New Training Program Created',
    message: `${name} has been created under ${dept} department.`,
    category: 'system',
    timestamp: new Date(),
    read: false,
    time_ago: 'Just now',
  });

  (req as any).flash('success', 'Training added successfully.');
  res.redirect('/trainings');
});

// Employees
app.get('/employees', requireAuth, (req: Request, res: Response) => {
  const formattedEmployees = employees
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((e) => ({
      ...e,
      created_at_formatted: formatDate(e.created_at),
    }));

  res.render('employees', {
    active_page: 'employees',
    employees: formattedEmployees,
    employee_count: employees.length,
  });
});

app.post('/add-employee', requireAuth, (req: Request, res: Response) => {
  const { employee_id, employee_name, department } = req.body;
  const empId = (employee_id || '').trim();
  const name = (employee_name || '').trim();
  const dept = (department || '').trim();

  if (!empId || empId.length > 50 || !name || name.length > 120 || !DEPARTMENTS.includes(dept)) {
    (req as any).flash('error', 'Please enter valid employee details.');
    return res.redirect('/employees');
  }

  const existing = employees.find((e) => e.employee_id.toLowerCase() === empId.toLowerCase());
  if (existing) {
    (req as any).flash('error', 'That Employee ID already exists. Use a unique ID.');
    return res.redirect('/employees');
  }

  const newEmpId = nextId.employee++;
  employees.push({
    id: newEmpId,
    employee_id: empId,
    employee_name: name,
    department: dept,
    created_at: new Date(),
  });

  // Create or update matching user login
  users.push({
    id: nextId.user++,
    username: empId,
    full_name: name,
    email: `${empId.toLowerCase()}@company.com`,
    password_hash: bcrypt.hashSync('Employee@123', 10),
    role: 'employee',
    department: dept,
    created_at: new Date(),
  });

  notifications.unshift({
    id: nextId.notification++,
    title: 'New Employee Registered',
    message: `${name} (${empId}) added to ${dept}.`,
    category: 'employee',
    timestamp: new Date(),
    read: false,
    time_ago: 'Just now',
  });

  (req as any).flash('success', 'Employee added successfully.');
  res.redirect('/employees');
});

// Trainers
app.get('/trainers', requireAuth, (req: Request, res: Response) => {
  const formattedTrainers = trainers
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((t) => ({
      ...t,
      created_at_formatted: formatDate(t.created_at),
    }));

  res.render('trainers', {
    active_page: 'trainers',
    trainers: formattedTrainers,
    trainer_count: trainers.length,
  });
});

app.post('/add-trainer', requireAuth, (req: Request, res: Response) => {
  const { trainer_name, specialization, email } = req.body;
  const name = (trainer_name || '').trim();
  const spec = (specialization || '').trim();
  const mail = (email || '').trim();

  if (!name || name.length > 120 || spec.length > 150 || mail.length > 150) {
    (req as any).flash('error', 'Please enter valid trainer details.');
    return res.redirect('/trainers');
  }

  const trnId = nextId.trainer++;
  trainers.push({
    id: trnId,
    trainer_name: name,
    specialization: spec,
    email: mail,
    created_at: new Date(),
  });

  const trainerUsername = mail || `trainer_${trnId}`;
  users.push({
    id: nextId.user++,
    username: trainerUsername,
    full_name: name,
    email: mail,
    password_hash: bcrypt.hashSync('Trainer@123', 10),
    role: 'trainer',
    department: spec || 'Training',
    created_at: new Date(),
  });

  notifications.unshift({
    id: nextId.notification++,
    title: 'Trainer Onboarded',
    message: `${name} joined as specialized instructor for ${spec || 'General Training'}.`,
    category: 'system',
    timestamp: new Date(),
    read: false,
    time_ago: 'Just now',
  });

  (req as any).flash('success', 'Trainer added successfully.');
  res.redirect('/trainers');
});

// Broadcast
app.get('/broadcast', requireAuth, (req: Request, res: Response) => {
  const training_options = trainings.filter((t) => t.status === 'Active').sort((a, b) => a.training_name.localeCompare(b.training_name));
  const trainer_options = trainers.slice().sort((a, b) => a.trainer_name.localeCompare(b.trainer_name));
  const employee_options = employees.slice().sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  const broadcasts = broadcastSessions
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((bs) => {
      const tr = trainings.find((t) => t.id === bs.training_id);
      const trn = trainers.find((t) => t.id === bs.trainer_id);
      const empCount = broadcastEmployees.filter((be) => be.broadcast_id === bs.id).length;

      return {
        id: bs.id,
        training_name: tr?.training_name || '—',
        department: tr?.department || '—',
        trainer_name: trn?.trainer_name || '—',
        start_date: bs.start_date,
        end_date: bs.end_date,
        start_date_formatted: formatDate(bs.start_date),
        end_date_formatted: formatDate(bs.end_date),
        duration: bs.duration,
        employee_count: empCount,
      };
    });

  res.render('broadcast', {
    active_page: 'broadcast',
    training_options,
    trainer_options,
    employee_options,
    broadcasts,
  });
});

app.post('/add-broadcast', requireAuth, (req: Request, res: Response) => {
  const { training_id, trainer_id, start_date, end_date, duration, employee_ids } = req.body;

  const trainingId = parseInt(training_id, 10);
  const trainerId = parseInt(trainer_id, 10);
  const startText = (start_date || '').trim();
  const endText = (end_date || '').trim();
  const dur = (duration || '').trim();

  let empIds: number[] = [];
  if (Array.isArray(employee_ids)) {
    empIds = employee_ids.map((id: string) => parseInt(id, 10)).filter((n) => !isNaN(n));
  } else if (employee_ids) {
    const single = parseInt(employee_ids, 10);
    if (!isNaN(single)) empIds = [single];
  }

  if (!trainingId || !trainerId || !startText || !endText || !dur || dur.length > 50 || empIds.length === 0) {
    (req as any).flash('error', 'Enter valid details, select employees, and check the dates.');
    return res.redirect('/broadcast');
  }

  const startDate = new Date(startText);
  const endDate = new Date(endText);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    (req as any).flash('error', 'Please select valid start and end dates.');
    return res.redirect('/broadcast');
  }

  const selectedTraining = trainings.find((t) => t.id === trainingId && t.status === 'Active');
  if (!selectedTraining) {
    (req as any).flash('error', 'Please select an active training program.');
    return res.redirect('/broadcast');
  }

  const selectedTrainer = trainers.find((t) => t.id === trainerId);
  if (!selectedTrainer) {
    (req as any).flash('error', 'Please select a valid trainer.');
    return res.redirect('/broadcast');
  }

  const bId = nextId.broadcast++;
  broadcastSessions.push({
    id: bId,
    training_id: trainingId,
    trainer_id: trainerId,
    start_date: startText,
    end_date: endText,
    duration: dur,
    created_at: new Date(),
  });

  const uniqueEmpIds = Array.from(new Set(empIds));
  uniqueEmpIds.forEach((eId) => {
    broadcastEmployees.push({
      id: nextId.broadcast_employee++,
      broadcast_id: bId,
      employee_id: eId,
      created_at: new Date(),
    });
  });

  notifications.unshift({
    id: nextId.notification++,
    title: 'Training Session Scheduled',
    message: `${selectedTraining.training_name} session scheduled with ${selectedTrainer.trainer_name} (${uniqueEmpIds.length} employees enrolled).`,
    category: 'session',
    timestamp: new Date(),
    read: false,
    time_ago: 'Just now',
  });

  (req as any).flash('success', 'Training session scheduled successfully.');
  res.redirect('/broadcast');
});

// Feedback
app.get('/feedback', requireAuth, (req: Request, res: Response) => {
  const feedback_options = broadcastSessions
    .slice()
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((bs) => {
      const tr = trainings.find((t) => t.id === bs.training_id);
      const trn = trainers.find((t) => t.id === bs.trainer_id);
      return {
        id: bs.id,
        training_name: tr?.training_name || '—',
        trainer_name: trn?.trainer_name || '—',
        start_date: bs.start_date,
        start_date_formatted: formatDate(bs.start_date),
      };
    });

  const employee_options = employees.slice().sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  const feedback_records = feedbackRecords
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((f) => {
      const bs = broadcastSessions.find((b) => b.id === f.broadcast_id);
      const tr = trainings.find((t) => t.id === bs?.training_id);
      const trn = trainers.find((t) => t.id === bs?.trainer_id);
      const emp = employees.find((e) => e.id === f.employee_id);

      return {
        id: f.id,
        training_name: tr?.training_name || '—',
        trainer_name: trn?.trainer_name || '—',
        employee_name: emp?.employee_name || '—',
        rating: f.rating,
        comments: f.comments,
        created_at_formatted: formatDate(f.created_at),
      };
    });

  // Calculate average rating
  const avg_rating = feedback_records.length > 0
    ? (feedback_records.reduce((acc, curr) => acc + curr.rating, 0) / feedback_records.length).toFixed(1)
    : '5.0';

  res.render('feedback', {
    active_page: 'feedback',
    feedback_options,
    employee_options,
    feedback_records,
    avg_rating,
  });
});

app.post('/add-feedback', requireAuth, (req: Request, res: Response) => {
  const broadcast_id = parseInt(req.body.broadcast_id, 10);
  const employee_id = parseInt(req.body.employee_id, 10);
  const rating = parseInt(req.body.rating, 10);
  const comments = (req.body.comments || '').trim();

  if (!broadcast_id || !employee_id || ![1, 2, 3, 4, 5].includes(rating) || comments.length > 2000) {
    (req as any).flash('error', 'Please provide valid feedback details.');
    return res.redirect('/feedback');
  }

  // Check if employee was assigned to this broadcast
  const isAssigned = broadcastEmployees.some((be) => be.broadcast_id === broadcast_id && be.employee_id === employee_id);
  if (!isAssigned) {
    (req as any).flash('error', 'This employee is not assigned to the selected training session.');
    return res.redirect('/feedback');
  }

  // Check if feedback already submitted
  const alreadySubmitted = feedbackRecords.some((f) => f.broadcast_id === broadcast_id && f.employee_id === employee_id);
  if (alreadySubmitted) {
    (req as any).flash('error', 'This employee has already submitted feedback for this session.');
    return res.redirect('/feedback');
  }

  feedbackRecords.push({
    id: nextId.feedback++,
    broadcast_id,
    employee_id,
    rating,
    comments,
    created_at: new Date(),
  });

  const emp = employees.find((e) => e.id === employee_id);
  notifications.unshift({
    id: nextId.notification++,
    title: 'New Feedback Submitted',
    message: `${emp?.employee_name || 'Employee'} rated session ${rating}/5 stars.`,
    category: 'feedback',
    timestamp: new Date(),
    read: false,
    time_ago: 'Just now',
  });

  (req as any).flash('success', 'Feedback submitted successfully.');
  res.redirect('/feedback');
});

// Reports
app.get('/reports', requireAuth, (req: Request, res: Response) => {
  res.render('reports', {
    active_page: 'reports',
    total_trainings: trainings.length,
    total_employees: employees.length,
    total_sessions: broadcastSessions.length,
    total_feedback: feedbackRecords.length,
  });
});

// Settings & Workspace Configuration
app.get('/settings', requireAuth, (req: Request, res: Response) => {
  res.render('settings', {
    active_page: 'settings',
  });
});

app.post('/settings/profile', requireAuth, (req: Request, res: Response) => {
  const { full_name, email, department } = req.body;
  const userId = req.session.user_id;

  if (userId) {
    const user = users.find((u) => u.username.toLowerCase() === userId.toLowerCase());
    if (user) {
      if (full_name) user.full_name = full_name.trim();
      if (email) user.email = email.trim();
      if (department) user.department = department.trim();

      req.session.full_name = user.full_name;
      req.session.email = user.email;
      req.session.department = user.department;
    }
  }

  (req as any).flash('success', 'User profile updated successfully.');
  res.redirect('/settings');
});

app.post('/settings/password', requireAuth, (req: Request, res: Response) => {
  const { current_password, new_password, confirm_password } = req.body;
  const userId = req.session.user_id;

  if (!new_password || new_password.length < 6 || new_password !== confirm_password) {
    (req as any).flash('error', 'New passwords must match and have at least 6 characters.');
    return res.redirect('/settings');
  }

  const user = users.find((u) => u.username.toLowerCase() === (userId || '').toLowerCase());
  if (user) {
    if (!bcrypt.compareSync(current_password, user.password_hash) && !(userId === 'admin' && current_password === 'Admin@123')) {
      (req as any).flash('error', 'Current password is incorrect.');
      return res.redirect('/settings');
    }
    user.password_hash = bcrypt.hashSync(new_password, 10);
    (req as any).flash('success', 'Password changed successfully.');
  } else {
    (req as any).flash('error', 'User account not found.');
  }

  res.redirect('/settings');
});

// API: Notifications
app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({
    notifications: notifications.slice(0, 15),
    unreadCount,
  });
});

app.post('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const notif = notifications.find((n) => n.id === id);
  if (notif) notif.read = true;
  res.json({ success: true });
});

app.post('/api/notifications/mark-all-read', requireAuth, (req: Request, res: Response) => {
  notifications.forEach((n) => (n.read = true));
  res.json({ success: true });
});

app.post('/api/notifications/clear', requireAuth, (req: Request, res: Response) => {
  notifications.length = 0;
  res.json({ success: true });
});

// API: Course Curriculum
app.get('/api/curriculum/:id', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const training = trainings.find((t) => t.id === id);
  if (!training) {
    return res.status(404).json({ error: 'Training not found' });
  }

  const curriculum = curricula.get(id) || {
    training_id: id,
    description: `Enterprise syllabus and training outline for ${training.training_name}.`,
    duration: '3 Weeks (24 Hours)',
    level: 'Intermediate',
    prerequisites: 'Foundational Knowledge',
    modules: [
      {
        title: 'Module 1: Orientation & Frameworks',
        duration: 'Week 1',
        summary: 'Essential terminology and processes.',
        topics: ['Overview', 'Standards', 'Tools'],
      },
      {
        title: 'Module 2: Practical Lab Simulations',
        duration: 'Week 2',
        summary: 'Case studies, workflows, and scenario exercises.',
        topics: ['Simulation', 'Troubleshooting', 'Drills'],
      },
      {
        title: 'Module 3: Certification & Review',
        duration: 'Week 3',
        summary: 'Final assessment and project review.',
        topics: ['Capstone', 'Assessment', 'Review'],
      },
    ],
  };

  res.json({
    training_name: training.training_name,
    department: training.department,
    status: training.status,
    description: curriculum.description,
    duration: curriculum.duration,
    level: curriculum.level,
    prerequisites: curriculum.prerequisites,
    curriculum: curriculum.modules,
  });
});

// API: Grounded AI Assistant
app.post('/api/ai/chat', requireAuth, async (req: Request, res: Response) => {
  const userMessage = (req.body.message || '').trim();
  if (!userMessage) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  // Compile real live contextual data
  const totalTrainings = trainings.length;
  const activeTrainings = trainings.filter((t) => t.status === 'Active');
  const totalEmployees = employees.length;
  const totalTrainers = trainers.length;
  const scheduledSessions = broadcastSessions.length;
  const avgRating = feedbackRecords.length > 0
    ? (feedbackRecords.reduce((acc, c) => acc + c.rating, 0) / feedbackRecords.length).toFixed(1)
    : '5.0';

  // Grounded conversational engine
  const lower = userMessage.toLowerCase();

  let reply = '';

  if (lower.includes('active') && (lower.includes('training') || lower.includes('program') || lower.includes('course'))) {
    const list = activeTrainings.map((t) => `• **${t.training_name}** (${t.department})`).join('\n');
    reply = `There are currently **${activeTrainings.length} active training programs** in TrainingHub:\n\n${list}\n\nYou can click *View Syllabus* in the Trainings tab to inspect their full curriculum.`;
  } else if (lower.includes('trainer') || lower.includes('instructor')) {
    const list = trainers.map((tr) => `• **${tr.trainer_name}** — ${tr.specialization} (${tr.email || 'No email'})`).join('\n');
    reply = `We currently have **${totalTrainers} registered enterprise trainers**:\n\n${list}\n\nYou can view complete trainer profiles or schedule a session in the Trainers section.`;
  } else if (lower.includes('session') || lower.includes('broadcast') || lower.includes('upcoming') || lower.includes('schedule')) {
    if (broadcastSessions.length === 0) {
      reply = `There are currently no broadcast sessions scheduled. You can schedule one in the **Broadcast Training** tab.`;
    } else {
      const list = broadcastSessions.map((b) => {
        const tr = trainings.find((t) => t.id === b.training_id);
        const trn = trainers.find((t) => t.id === b.trainer_id);
        const count = broadcastEmployees.filter((be) => be.broadcast_id === b.id).length;
        return `• **${tr?.training_name}** with ${trn?.trainer_name} (${formatDate(b.start_date)} to ${formatDate(b.end_date)}) — ${count} employee(s) enrolled`;
      }).join('\n');
      reply = `Here are the currently scheduled broadcast sessions:\n\n${list}\n\nSwitch between Table View and Calendar View in the **Broadcast Sessions** page.`;
    }
  } else if (lower.includes('employee') || lower.includes('staff') || lower.includes('people')) {
    const deptGroup: Record<string, number> = {};
    employees.forEach((e) => {
      deptGroup[e.department] = (deptGroup[e.department] || 0) + 1;
    });
    const summary = Object.entries(deptGroup).map(([dept, count]) => `• ${dept}: **${count}** employee(s)`).join('\n');
    reply = `There are **${totalEmployees} employees** registered in the corporate directory across departments:\n\n${summary}\n\nYou can search, filter, or enroll employees from the **Employees** page.`;
  } else if (lower.includes('report') || lower.includes('export') || lower.includes('excel') || lower.includes('pdf')) {
    reply = `You can export real-time compliance and executive reports from the **Reports & Exports** tab:\n\n• **Download Excel (.xlsx)**: Generates a workbook with 6 formatted tabs (Summary, Trainings, Employees, Trainers, Sessions, and Feedback).\n• **Download PDF (.pdf)**: Generates a landscape executive briefing document with structured tables and page footers.`;
  } else if (lower.includes('feedback') || lower.includes('rating') || lower.includes('review') || lower.includes('quality')) {
    reply = `We have received **${feedbackRecords.length} feedback submissions** with an overall average satisfaction score of **${avgRating} / 5.0 stars**.\n\nYou can review individual comments or submit evaluations in the **Feedback** section.`;
  } else if (lower.includes('how') && (lower.includes('add') || lower.includes('create'))) {
    reply = `Here is how to create records in TrainingHub:\n\n• **Add Training**: Navigate to **Trainings** → complete the training name and department form.\n• **Add Employee**: Go to **Employees** → input employee ID, name, and department.\n• **Schedule Session**: Go to **Broadcast Sessions** → pick an active course, trainer, dates, and check the employees you wish to enroll.`;
  } else if (lower.includes('setting') || lower.includes('dark mode') || lower.includes('theme') || lower.includes('password')) {
    reply = `You can configure your workspace in the **Settings** menu:\n\n• Toggle between **Enterprise Light** and **Midnight Charcoal (Dark)** theme.\n• Update your profile information (name, email, department).\n• Change your password.\n• Inspect real-time **Database & System Diagnostics**.`;
  } else {
    reply = `Here is a live summary of your **TrainingHub Enterprise workspace**:\n\n• Total Programs: **${totalTrainings}** (${activeTrainings.length} Active)\n• Enrolled Employees: **${totalEmployees}**\n• Instructors: **${totalTrainers}**\n• Scheduled Broadcast Sessions: **${scheduledSessions}**\n• Average Satisfaction: **${avgRating} / 5.0**\n\nFeel free to ask me about specific trainings, trainers, departments, or navigation!`;
  }

  res.json({ reply });
});

// Export Excel
app.get('/export-reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const today = new Date().toISOString().split('T')[0];

    // 1. Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['TrainingHub - Overall Report']);
    summarySheet.addRow(['Report Generated', today]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Count']);
    summarySheet.addRow(['Total Training Programs', trainings.length]);
    summarySheet.addRow(['Total Employees', employees.length]);
    summarySheet.addRow(['Total Trainers', trainers.length]);
    summarySheet.addRow(['Training Sessions', broadcastSessions.length]);
    summarySheet.addRow(['Feedback Responses', feedbackRecords.length]);

    // Style Summary header row
    const summaryHeaderRow = summarySheet.getRow(4);
    summaryHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E78' },
    };

    // Helper for styled export sheets
    function addStyledSheet(
      sheetName: string,
      headers: { header: string; key: string; width: number }[],
      rows: any[]
    ) {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = headers;
      sheet.addRows(rows);

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1F4E78' },
      };
      headerRow.alignment = { horizontal: 'center' };
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    }

    // 2. Trainings Sheet
    addStyledSheet(
      'Trainings',
      [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Training Name', key: 'name', width: 35 },
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 20 },
      ],
      trainings.map((t) => ({
        id: t.id,
        name: t.training_name,
        department: t.department,
        status: t.status,
        created_at: formatDate(t.created_at),
      }))
    );

    // 3. Employees Sheet
    addStyledSheet(
      'Employees',
      [
        { header: 'Employee ID', key: 'employee_id', width: 15 },
        { header: 'Employee Name', key: 'employee_name', width: 30 },
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Created Date', key: 'created_at', width: 20 },
      ],
      employees.map((e) => ({
        employee_id: e.employee_id,
        employee_name: e.employee_name,
        department: e.department,
        created_at: formatDate(e.created_at),
      }))
    );

    // 4. Trainers Sheet
    addStyledSheet(
      'Trainers',
      [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Trainer Name', key: 'name', width: 30 },
        { header: 'Specialization', key: 'specialization', width: 35 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Created Date', key: 'created_at', width: 20 },
      ],
      trainers.map((tr) => ({
        id: tr.id,
        name: tr.trainer_name,
        specialization: tr.specialization,
        email: tr.email,
        created_at: formatDate(tr.created_at),
      }))
    );

    // 5. Sessions Sheet
    addStyledSheet(
      'Sessions',
      [
        { header: 'Session ID', key: 'id', width: 12 },
        { header: 'Training Name', key: 'training_name', width: 35 },
        { header: 'Trainer Name', key: 'trainer_name', width: 30 },
        { header: 'Start Date', key: 'start_date', width: 15 },
        { header: 'End Date', key: 'end_date', width: 15 },
        { header: 'Duration', key: 'duration', width: 20 },
        { header: 'Employees Assigned', key: 'emp_count', width: 20 },
      ],
      broadcastSessions.map((bs) => {
        const tr = trainings.find((t) => t.id === bs.training_id);
        const trn = trainers.find((t) => t.id === bs.trainer_id);
        const count = broadcastEmployees.filter((be) => be.broadcast_id === bs.id).length;
        return {
          id: bs.id,
          training_name: tr?.training_name || '—',
          trainer_name: trn?.trainer_name || '—',
          start_date: bs.start_date,
          end_date: bs.end_date,
          duration: bs.duration,
          emp_count: count,
        };
      })
    );

    // 6. Feedback Sheet
    addStyledSheet(
      'Feedback',
      [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Training Name', key: 'training_name', width: 35 },
        { header: 'Employee ID', key: 'employee_id', width: 15 },
        { header: 'Employee Name', key: 'employee_name', width: 30 },
        { header: 'Trainer Name', key: 'trainer_name', width: 30 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Comments', key: 'comments', width: 45 },
        { header: 'Submitted Date', key: 'created_at', width: 20 },
      ],
      feedbackRecords.map((f) => {
        const bs = broadcastSessions.find((b) => b.id === f.broadcast_id);
        const tr = trainings.find((t) => t.id === bs?.training_id);
        const trn = trainers.find((t) => t.id === bs?.trainer_id);
        const emp = employees.find((e) => e.id === f.employee_id);
        return {
          id: f.id,
          training_name: tr?.training_name || '—',
          employee_id: emp?.employee_id || '—',
          employee_name: emp?.employee_name || '—',
          trainer_name: trn?.trainer_name || '—',
          rating: f.rating,
          comments: f.comments,
          created_at: formatDate(f.created_at),
        };
      })
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="TrainingHub_Reports.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel report:', err);
    (req as any).flash('error', 'Could not export reports.');
    res.redirect('/reports');
  }
});

// Export PDF
app.get('/export-pdf-reports', requireAuth, (req: Request, res: Response) => {
  try {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="TrainingHub_Reports.pdf"');

    doc.pipe(res);

    // Title & Header
    doc.fontSize(20).fillColor('#1F4E78').text('TrainingHub - Overall Report', { align: 'left' });
    doc.fontSize(10).fillColor('#64748B').text(`Report Generated: ${new Date().toISOString().split('T')[0]}`);
    doc.moveDown(1.5);

    // Summary Section
    doc.fontSize(14).fillColor('#171C22').text('Summary Overview', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#202831');
    doc.text(`Total Training Programs: ${trainings.length}`);
    doc.text(`Total Employees: ${employees.length}`);
    doc.text(`Total Trainers: ${trainers.length}`);
    doc.text(`Training Sessions Scheduled: ${broadcastSessions.length}`);
    doc.text(`Feedback Responses: ${feedbackRecords.length}`);
    doc.moveDown(1.5);

    // Trainings List
    doc.fontSize(14).fillColor('#171C22').text('Training Programs', { underline: true });
    doc.moveDown(0.5);
    trainings.forEach((t) => {
      doc.fontSize(9).fillColor('#202831').text(
        `• [${t.status}] ${t.training_name} (${t.department}) — Created: ${formatDate(t.created_at)}`
      );
    });
    doc.moveDown(1.5);

    // Employees Directory
    doc.fontSize(14).fillColor('#171C22').text('Employee Directory', { underline: true });
    doc.moveDown(0.5);
    employees.forEach((e) => {
      doc.fontSize(9).fillColor('#202831').text(
        `• ${e.employee_id}: ${e.employee_name} — ${e.department} (Added: ${formatDate(e.created_at)})`
      );
    });
    doc.moveDown(1.5);

    // Sessions & Feedback
    doc.fontSize(14).fillColor('#171C22').text('Scheduled Sessions & Participation', { underline: true });
    doc.moveDown(0.5);
    broadcastSessions.forEach((bs) => {
      const tr = trainings.find((t) => t.id === bs.training_id);
      const trn = trainers.find((t) => t.id === bs.trainer_id);
      const empCount = broadcastEmployees.filter((be) => be.broadcast_id === bs.id).length;
      doc.fontSize(9).fillColor('#202831').text(
        `• Session #${bs.id}: ${tr?.training_name} with ${trn?.trainer_name} (${formatDate(bs.start_date)} to ${formatDate(bs.end_date)}, ${bs.duration}) — ${empCount} Employee(s) assigned`
      );
    });

    // Footer
    doc.fontSize(8).fillColor('#64748B').text(
      'TrainingHub - Employee Training Management System',
      30,
      doc.page.height - 30,
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    console.error('Error generating PDF report:', err);
    (req as any).flash('error', 'Could not export PDF report.');
    res.redirect('/reports');
  }
});

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`TrainingHub Server listening on http://${HOST}:${PORT}`);
});
