import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Users, ShieldCheck, Briefcase, Bell, ClipboardList,
  MessageSquare, BarChart3, LogOut, Search, Plus, X, Check, Trash2,
  Edit2, Building2, GraduationCap, Mail, Phone, MapPin, Filter,
  ThumbsUp, Send, Printer, Download, ChevronRight, AlertCircle,
  UserCheck, UserX, Clock, Eye, EyeOff, ArrowLeft, FileSpreadsheet,
  UserCog, KeyRound, History, Home, LogIn, Lock, Power, Upload, FileText
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from "recharts";

/* ============================== CONSTANTS ============================== */

const CAMPUSES = [
  "Aurora Campus",
  "Pagadian Campus",
  "Dimataling Campus",
  "Mahayag Campus",
  "Tambulig Campus",
  "Margosatubig Campus",
  "Vincenzo A. Sagun Campus",
  "Dumingag Campus",
  "Guipos Campus",
  "Sominot Campus",
  "Tabina Campus",
  "Tigbao Campus",
  "Lapuyan Campus",
  "Ramon Magsaysay Campus",
];

const COURSES = [
  "BS Agriculture",
  "BS Information System",
  "Bachelor of Physical Education",
  "Bachelor of Technical-Vocational Teacher Education",
  "BS Biology",
  "Associate in Computer Technology",
  "BS Civil Engineering",
  "BS Psychology",
];

const GRAD_YEARS = Array.from({ length: 12 }, (_, i) => String(2014 + i));

const EMP_COLORS = { Employed: "#1F5D4E", "Self-Employed": "#C9962B", Unemployed: "#B23A34" };

const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const now = () => new Date().toISOString();

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

/* ============================== CSV IMPORT HELPERS ============================== */

// Minimal RFC4180-ish delimited-text parser — handles quoted fields, escaped quotes (""),
// and delimiters/newlines inside quotes, without pulling in an external dependency.
// `delimiter` defaults to comma (CSV files) but is set to tab when parsing text pasted
// straight out of Excel/Google Sheets, which uses tabs between columns.
function parseCSV(text, delimiter = ",") {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// Copy/paste out of Excel or Google Sheets is tab-separated; a manually typed or exported
// CSV is comma-separated. Sniff the first line to pick the right delimiter automatically.
function detectDelimiter(text) {
  const firstLine = text.slice(0, text.indexOf("\n") > -1 ? text.indexOf("\n") : text.length);
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

const IMPORT_TEMPLATE_HEADERS = [
  "Full Name", "Email", "Campus", "Course", "Graduation Year", "Phone", "Address",
  "Employment Status", "Company", "Position", "Employment Location", "Date Employed", "Related to Course",
];

function downloadImportTemplate() {
  const sample = [
    "Juan Dela Cruz", "juan.delacruz2026@example.com", CAMPUSES[0], COURSES[0], GRAD_YEARS[GRAD_YEARS.length - 1],
    "0917 000 0000", "Pagadian City", "Unemployed", "", "", "", "", "No",
  ];
  const csv = [IMPORT_TEMPLATE_HEADERS, sample].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "zdspgc_alumni_import_template.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Validates and normalizes parsed CSV rows against existing alumni/user records.
// `lockCampus`, when set (Campus Admin), forces every row into that campus regardless
// of what the CSV says, so a Campus Admin can never bulk-import into another campus.
function validateImportRows(rawRows, existingAlumni, existingUsers, lockCampus) {
  if (!rawRows.length) return [];
  const header = rawRows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const col = { name: idx("full name"), email: idx("email"), campus: idx("campus"), course: idx("course"), year: idx("graduation year"), phone: idx("phone"), address: idx("address"), empStatus: idx("employment status"), company: idx("company"), position: idx("position"), empLoc: idx("employment location"), empDate: idx("date employed"), related: idx("related to course") };

  const seenEmails = new Set();
  return rawRows.slice(1).map((r, i) => {
    const get = (key) => (col[key] >= 0 ? (r[col[key]] || "").trim() : "");
    const fullName = get("name");
    const email = get("email");
    const campus = lockCampus || get("campus");
    const course = get("course");
    const gradYear = get("year");
    const empStatusRaw = get("empStatus") || "Unemployed";
    const empStatus = ["Employed", "Self-Employed", "Unemployed"].find((s) => s.toLowerCase() === empStatusRaw.toLowerCase()) || null;
    const related = /^(y|yes|true)$/i.test(get("related"));

    const errors = [];
    if (!fullName) errors.push("Missing full name");
    if (!email) errors.push("Missing email");
    else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Invalid email format");
    if (!campus) errors.push("Missing campus");
    else if (!CAMPUSES.includes(campus)) errors.push(`Unknown campus "${campus}"`);
    if (!course) errors.push("Missing course");
    else if (!COURSES.includes(course)) errors.push(`Unknown course "${course}"`);
    if (!gradYear) errors.push("Missing graduation year");
    else if (!GRAD_YEARS.includes(gradYear)) errors.push(`Unrecognized graduation year "${gradYear}"`);
    if (!empStatus) errors.push(`Unknown employment status "${empStatusRaw}"`);
    const emailLower = email.toLowerCase();
    if (email) {
      if (seenEmails.has(emailLower)) errors.push("Duplicate email within this file");
      if (existingAlumni.some((a) => a.email.toLowerCase() === emailLower) || existingUsers.some((u) => u.email.toLowerCase() === emailLower)) errors.push("Email already exists in the system");
    }
    seenEmails.add(emailLower);

    return {
      rowNum: i + 2, // +2 = 1-indexed + header row
      fullName, email, campus, course, gradYear,
      phone: get("phone"), address: get("address"),
      employment: { status: empStatus || "Unemployed", company: get("company"), position: get("position"), location: get("empLoc"), dateEmployed: get("empDate"), related },
      errors,
      valid: errors.length === 0,
    };
  });
}

/* ============================== SEED DATA ============================== */

function seedData() {
  // Default Super Admin account — provisioned during initial system setup only.
  // There is no public registration path for admin accounts of any kind.
  const superAdminUser = {
    id: uid("user"), email: "superadmin@zdspgc.edu.ph", username: "superadmin", password: "SuperAdmin!123",
    role: "superadmin", name: "System Super Administrator", campus: null, status: "active", createdAt: now(),
  };

  // A sample Campus Admin, created the way a Super Admin would create one
  // via the Manage Admin Accounts page — included here only to demo the flow.
  const campusAdminUser = {
    id: uid("user"), email: "aurora.admin@zdspgc.edu.ph", username: "aurora.admin", password: "Campus!123",
    role: "campusadmin", name: "Aurora Campus Admin", campus: "Aurora Campus", status: "active", createdAt: now(),
  };

  const alumniSeed = [
    { fullName: "Maria Santos", campus: CAMPUSES[0], course: COURSES[0], gradYear: "2019", email: "maria.santos@example.com", phone: "0917 111 2222", address: "Aurora", employment: { status: "Employed", company: "TechCorp PH", position: "Software Developer", location: "Cebu City", dateEmployed: "2020-03-01", related: true }, accountStatus: "approved" },
    { fullName: "Juan Dela Cruz", campus: CAMPUSES[1], course: COURSES[2], gradYear: "2020", email: "juan.delacruz@example.com", phone: "0917 222 3333", address: "Pagadian City", employment: { status: "Self-Employed", company: "JDC Trading", position: "Owner", location: "Pagadian City", dateEmployed: "2021-06-15", related: false }, accountStatus: "approved" },
    { fullName: "Angelica Reyes", campus: CAMPUSES[0], course: COURSES[3], gradYear: "2018", email: "angelica.reyes@example.com", phone: "0917 333 4444", address: "Aurora", employment: { status: "Employed", company: "DepEd Zamboanga del Sur", position: "Elementary Teacher", location: "Pagadian City", dateEmployed: "2019-08-01", related: true }, accountStatus: "approved" },
    { fullName: "Mark Villanueva", campus: CAMPUSES[2], course: COURSES[4], gradYear: "2021", email: "mark.villanueva@example.com", phone: "0917 444 5555", address: "Dimataling", employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false }, accountStatus: "approved" },
    { fullName: "Christine Bautista", campus: CAMPUSES[3], course: COURSES[5], gradYear: "2022", email: "christine.bautista@example.com", phone: "0917 555 6666", address: "Mahayag", employment: { status: "Employed", company: "Seda Hotel", position: "Front Desk Officer", location: "Davao City", dateEmployed: "2022-11-10", related: true }, accountStatus: "approved" },
    { fullName: "Rey Fernandez", campus: CAMPUSES[1], course: COURSES[0], gradYear: "2020", email: "rey.fernandez@example.com", phone: "0917 666 7777", address: "Pagadian City", employment: { status: "Employed", company: "Globe Telecom", position: "IT Support", location: "Zamboanga City", dateEmployed: "2021-01-20", related: true }, accountStatus: "approved" },
    { fullName: "Kim Aquino", campus: CAMPUSES[0], course: COURSES[1], gradYear: "2023", email: "kim.aquino@example.com", phone: "0917 777 8888", address: "Aurora", employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false }, accountStatus: "pending" },
    { fullName: "Paolo Ramos", campus: CAMPUSES[4], course: COURSES[2], gradYear: "2019", email: "paolo.ramos@example.com", phone: "0917 888 9999", address: "Tambulig", employment: { status: "Self-Employed", company: "Ramos Agri-Supply", position: "Manager", location: "Tambulig", dateEmployed: "2020-02-01", related: true }, accountStatus: "approved" },
    { fullName: "Diane Cortez", campus: CAMPUSES[2], course: COURSES[3], gradYear: "2024", email: "diane.cortez@example.com", phone: "0917 999 0000", address: "Dimataling", employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false }, accountStatus: "pending" },
    { fullName: "Ivan Mendoza", campus: CAMPUSES[3], course: COURSES[4], gradYear: "2021", email: "ivan.mendoza@example.com", phone: "0917 000 1111", address: "Mahayag", employment: { status: "Employed", company: "Nestle Philippines", position: "Field Agriculturist", location: "Cagayan de Oro", dateEmployed: "2021-09-05", related: true }, accountStatus: "approved" },
  ];

  const alumni = alumniSeed.map((a) => ({ id: uid("al"), ...a, createdAt: now(), updatedAt: now() }));

  const users = [superAdminUser, campusAdminUser];
  alumni.forEach((a) => {
    if (a.accountStatus !== "rejected") {
      users.push({ id: uid("user"), email: a.email, password: "alumni123", role: "alumni", alumniId: a.id, name: a.fullName, createdAt: now() });
    }
  });

  const notifications = [
    { id: uid("notif"), title: "Grand Alumni Homecoming 2026", message: "Join us for the ZDSPGC Grand Alumni Homecoming this December! Reconnect with batchmates and mentors across all campuses.", audience: { type: "all" }, createdAt: now(), readBy: [] },
    { id: uid("notif"), title: "Agriculture Alumni Job Fair", message: "A job fair for BS Agriculture graduates will be held at the Aurora Campus gymnasium.", audience: { type: "course", value: COURSES[0] }, createdAt: now(), readBy: [] },
  ];

  const posts = [
    { id: uid("post"), authorId: alumni[0].id, authorName: alumni[0].fullName, content: "Grateful for everything ZDSPGC taught me. Now working as a developer in Cebu — happy to mentor IT batchmates looking for their first job!", createdAt: now(), likes: [], comments: [ { id: uid("cmt"), authorId: alumni[5].id, authorName: alumni[5].fullName, content: "Inspiring, Maria! Would love some tips.", createdAt: now() } ] },
    { id: uid("post"), authorId: alumni[2].id, authorName: alumni[2].fullName, content: "Any batch 2018 Education alumni interested in a mini reunion this December?", createdAt: now(), likes: [], comments: [] },
  ];

  const surveys = [
    { id: uid("survey"), title: "2026 Alumni Employment & Feedback Survey", createdAt: now(), questions: [
        { id: uid("q"), text: "How would you rate your preparedness for employment after graduating from ZDSPGC?", type: "rating" },
        { id: uid("q"), text: "Is your current job related to your ZDSPGC course?", type: "choice", options: ["Yes", "No", "Not applicable"] },
        { id: uid("q"), text: "What skills or programs would you like ZDSPGC to strengthen?", type: "text" },
      ], responses: [] },
  ];

  const jobs = [
    { id: uid("job"), title: "Junior Software Developer", company: "TechCorp PH", requirements: "BS IT/CS graduate, knowledge of JavaScript and SQL", location: "Cebu City", deadline: "2026-11-30", postedAt: now() },
    { id: uid("job"), title: "Agricultural Field Officer", company: "Nestle Philippines", requirements: "BS Agriculture graduate, willing to travel", location: "Cagayan de Oro", deadline: "2026-10-15", postedAt: now() },
  ];

  const logs = [
    { id: uid("log"), ts: now(), actor: "System", action: "Super Admin account initialized", detail: "Default Super Admin account created during system setup." },
  ];

  return { users, alumni, notifications, posts, surveys, jobs, logs };
}

/* ============================== STORAGE ============================== */

const KEYS = ["users", "alumni", "notifications", "posts", "surveys", "jobs", "logs"];

const STORAGE_PREFIX = "zdspgc_alumni_";

async function loadStore() {
  const out = {};
  for (const k of KEYS) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + k);
      out[k] = raw ? JSON.parse(raw) : null;
    } catch { out[k] = null; }
  }
  if (KEYS.some((k) => !out[k])) {
    const seeded = seedData();
    for (const k of KEYS) {
      if (!out[k]) {
        out[k] = seeded[k];
        try { localStorage.setItem(STORAGE_PREFIX + k, JSON.stringify(seeded[k])); } catch {}
      }
    }
  }
  return out;
}

async function persist(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch (e) { console.error("storage error", e); }
}

/* ============================== SMALL UI PARTS ============================== */

function Seal({ status }) {
  const map = {
    approved: { c: "#1F5D4E", label: "Verified" },
    pending: { c: "#C9962B", label: "Pending" },
    rejected: { c: "#B23A34", label: "Rejected" },
  };
  const s = map[status] || map.pending;
  return (
    <span className="seal" style={{ "--seal-c": s.c }}>
      <span className="seal-dot" />{s.label}
    </span>
  );
}

function EmpTag({ status }) {
  const c = EMP_COLORS[status] || "#5B6B63";
  return <span className="emp-tag" style={{ "--tag-c": c }}>{status || "Unknown"}</span>;
}

function StatCard({ icon: Icon, label, value, ribbon }) {
  return (
    <div className="stat-card">
      <div className="stat-ribbon" style={ribbon ? { background: ribbon } : undefined} />
      <div className="stat-top">
        <Icon size={18} strokeWidth={2} />
        <span>{label}</span>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal" + (wide ? " modal-wide" : "")}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="empty-state">
      <Icon size={26} strokeWidth={1.5} />
      <p>{text}</p>
    </div>
  );
}

/* ============================== APP ============================== */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null); // {userId, role}
  // "page" only controls what unauthenticated visitors see (landing / alumni auth / admin
  // login / admin forgot-password). It never grants access by itself — every dashboard
  // below is gated on a verified `session` + the matching role on the stored user record,
  // so typing a dashboard "tab" name directly can't skip login or role verification.
  const [page, setPage] = useState("landing"); // landing | alumniAuth | adminLogin | adminForgot
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authError, setAuthError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  useEffect(() => { (async () => { const d = await loadStore(); setDb(d); setLoading(false); })(); }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const update = useCallback((key, updater) => {
    setDb((prev) => {
      const next = { ...prev, [key]: updater(prev[key]) };
      persist(key, next[key]);
      return next;
    });
  }, []);

  // Must stay above the early `loading` return below — all hooks in a component need to
  // run in the same order on every render, and this useCallback depends on `update` above.
  const addLog = useCallback((actor, action, detail = "") => {
    update("logs", (list) => [...list, { id: uid("log"), ts: now(), actor, action, detail }]);
  }, [update]);

  if (loading || !db) {
    return (
      <div className="zd-root zd-loading">
        <style>{CSS}</style>
        <div className="loader"><GraduationCap size={30} /><span>Loading ZDSPGC Alumni System…</span></div>
      </div>
    );
  }

  // Re-derive the logged-in user from the live db on every render, rather than trusting
  // the session snapshot, so a deactivated/deleted admin loses access immediately.
  const currentUser = session ? db.users.find((u) => u.id === session.userId) : null;
  const isAdminRole = currentUser?.role === "superadmin" || currentUser?.role === "campusadmin";
  const sessionValid = !!currentUser && (!isAdminRole || currentUser.status !== "deactivated");
  const currentAlumni = currentUser?.role === "alumni" ? db.alumni.find((a) => a.id === currentUser.alumniId) : null;

  function handleLogin(email, password) {
    const u = db.users.find((x) => x.role === "alumni" && x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) { setAuthError("Incorrect email or password."); return; }
    const al = db.alumni.find((a) => a.id === u.alumniId);
    if (al?.accountStatus === "pending") { setAuthError("Your account is awaiting admin verification."); return; }
    if (al?.accountStatus === "rejected") { setAuthError("Your registration was rejected. Please contact the registrar's office."); return; }
    setAuthError("");
    setSession({ userId: u.id, role: u.role });
    setTab("dashboard");
  }

  // Admins (Super Admin or Campus Admin) are looked up by email OR username — they are
  // never mixed with the public alumni login above, and alumni accounts can never satisfy
  // an admin login even if the credentials happened to match.
  function handleAdminLogin(identifier, password) {
    const id = identifier.trim().toLowerCase();
    const u = db.users.find((x) =>
      (x.role === "superadmin" || x.role === "campusadmin") &&
      password === x.password &&
      (x.email.toLowerCase() === id || (x.username || "").toLowerCase() === id)
    );
    if (!u) {
      setAdminError("Invalid email/username or password. Please try again.");
      addLog(identifier || "Unknown", "Failed admin login attempt");
      return;
    }
    if (u.status === "deactivated") {
      setAdminError("Your admin account is currently deactivated. Please contact the Super Admin.");
      return;
    }
    setAdminError("");
    setSession({ userId: u.id, role: u.role });
    setTab("dashboard");
    setPage("landing");
    addLog(u.name, u.role === "superadmin" ? "Super Admin logged in" : "Campus Admin logged in", u.campus || "");
  }

  function handleLogout() {
    if (currentUser && isAdminRole) addLog(currentUser.name, "Logged out");
    setSession(null);
    setAuthMode("login");
    setAuthError("");
    setAdminError("");
    setAdminNotice("");
    setPage("landing");
    setTab("dashboard");
  }

  function handleRegister(form) {
    const emailTaken = db.users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase());
    const dup = db.alumni.some((a) => a.fullName.toLowerCase() === form.fullName.trim().toLowerCase() && a.gradYear === form.gradYear && a.course === form.course);
    if (emailTaken) { setAuthError("An account with this email already exists."); return; }
    if (dup) { setAuthError("A matching alumni record already exists for this name, course, and graduation year."); return; }
    const newAlumni = {
      id: uid("al"), fullName: form.fullName.trim(), campus: form.campus, course: form.course, gradYear: form.gradYear,
      email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(),
      employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false },
      accountStatus: "pending", createdAt: now(), updatedAt: now(),
    };
    // Public self-registration always creates an "alumni" account — there is no way for a
    // visitor to create an admin account of any kind from this form.
    const newUser = { id: uid("user"), email: form.email.trim(), password: form.password, role: "alumni", alumniId: newAlumni.id, name: form.fullName.trim(), createdAt: now() };
    update("alumni", (list) => [...list, newAlumni]);
    update("users", (list) => [...list, newUser]);
    setAuthError("");
    setAuthMode("registered");
  }

  // Nothing below this line renders an admin dashboard unless `sessionValid` is true AND
  // the stored user's role was verified above — there is no URL/tab a visitor can jump to
  // that bypasses handleAdminLogin's credential + status check.
  return (
    <div className="zd-root">
      <style>{CSS}</style>
      {!sessionValid ? (
        page === "adminLogin" ? (
          <AdminLoginScreen
            error={adminError} setError={setAdminError}
            onLogin={handleAdminLogin}
            onBackHome={() => { setAdminError(""); setPage("landing"); }}
            onForgot={() => { setAdminError(""); setPage("adminForgot"); }}
          />
        ) : page === "adminForgot" ? (
          <AdminForgotPassword onBack={() => setPage("adminLogin")} />
        ) : page === "alumniAuth" ? (
          <AuthScreen mode={authMode} setMode={setAuthMode} error={authError} setError={setAuthError} onLogin={handleLogin} onRegister={handleRegister} onBackHome={() => { setAuthError(""); setAuthMode("login"); setPage("landing"); }} />
        ) : (
          <LandingPage
            onAdminLogin={() => { setAdminError(""); setPage("adminLogin"); }}
            onAlumniPortal={() => { setAuthError(""); setAuthMode("login"); setPage("alumniAuth"); }}
          />
        )
      ) : isAdminRole ? (
        <AdminShell
          db={db} update={update} tab={tab} setTab={setTab} onLogout={handleLogout} showToast={showToast}
          addLog={addLog}
          role={currentUser.role}
          scopeCampus={currentUser.role === "campusadmin" ? currentUser.campus : null}
          adminName={currentUser.name}
          currentUserId={currentUser.id}
        />
      ) : (
        <AlumniShell db={db} update={update} tab={tab} setTab={setTab} onLogout={handleLogout} showToast={showToast} me={currentAlumni} meUser={currentUser} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ============================== AUTH ============================== */

function AuthScreen({ mode, setMode, error, setError, onLogin, onRegister, onBackHome }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", campus: CAMPUSES[0], course: COURSES[0], gradYear: GRAD_YEARS[GRAD_YEARS.length - 1], phone: "", address: "" });

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div className="auth-side-inner">
          <div className="brand-mark"><GraduationCap size={26} /></div>
          <h1>ZDSPGC<br />Centralized Alumni<br />Monitoring System</h1>
          <p>One record, every campus. Track employment outcomes, keep alumni connected, and give ZDSPGC leadership the data it needs to plan ahead.</p>
          <ul className="side-list">
            <li>14 campuses across Zamboanga del Sur</li>
            <li>Employment monitoring across every course</li>
            <li>Announcements, surveys, and job postings in one place</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-side">
        {mode === "registered" ? (
          <div className="auth-card">
            <UserCheck size={30} color="#1F5D4E" />
            <h2>Registration submitted</h2>
            <p className="muted">Your alumni account is now awaiting verification by the ZDSPGC registrar's office. You'll be able to log in once approved.</p>
            <button className="btn primary" onClick={() => { setMode("login"); setError(""); }}>Back to log in</button>
          </div>
        ) : mode === "register" ? (
          <div className="auth-card wide">
            <h2>Create alumni account</h2>
            <p className="muted">Register once — the registrar's office will verify your record before you can log in.</p>
            {error && <div className="auth-error"><AlertCircle size={15} />{error}</div>}
            <div className="form-grid">
              <Field label="Full name"><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Juan Dela Cruz" /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></Field>
              <Field label="Campus">
                <select value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })}>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="Course">
                <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="Graduation year">
                <select value={form.gradYear} onChange={(e) => setForm({ ...form, gradYear: e.target.value })}>{GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}</select>
              </Field>
              <Field label="Contact number"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09XX XXX XXXX" /></Field>
              <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="City / Municipality" /></Field>
              <Field label="Password"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create a password" /></Field>
            </div>
            <button className="btn primary block" onClick={() => onRegister(form)} disabled={!form.fullName || !form.email || !form.password}>Submit registration</button>
            <button className="link-btn" onClick={() => { setMode("login"); setError(""); }}>Already have an account? Log in</button>
          </div>
        ) : (
          <div className="auth-card">
            <h2>Welcome back</h2>
            <p className="muted">Log in to your ZDSPGC alumni account.</p>
            {error && <div className="auth-error"><AlertCircle size={15} />{error}</div>}
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Password">
              <div className="pw-wrap">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
                <button className="pw-eye" onClick={() => setShowPw((s) => !s)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </Field>
            <button className="btn primary block" onClick={() => onLogin(email, password)}>Log in</button>
            <button className="link-btn" onClick={() => { setMode("register"); setError(""); }}>New alumnus? Create an account</button>
            {onBackHome && <button className="link-btn small" onClick={onBackHome}><ArrowLeft size={13} />Back to Home</button>}
            <div className="demo-hint">Demo — Alumni: maria.santos@example.com / alumni123</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== LANDING / HOME PAGE ============================== */

function LandingPage({ onAdminLogin, onAlumniPortal }) {
  return (
    <div className="landing">
      <header className="top-nav">
        <div className="top-nav-brand">
          <div className="brand-mark small"><GraduationCap size={18} /></div>
          <div>
            <div className="brand-title">ZDSPGC</div>
            <div className="brand-sub">Alumni System</div>
          </div>
        </div>
        <div className="top-nav-actions">
          <button className="btn ghost" onClick={onAlumniPortal}><LogIn size={15} />Alumni Login</button>
          <button className="btn primary" onClick={onAdminLogin}><ShieldCheck size={15} />Admin Login</button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="eyebrow">Zamboanga del Sur Provincial Government College</div>
          <h1>Centralized Alumni<br />Monitoring System</h1>
          <p>One record, every campus. Track employment outcomes, keep alumni connected, and give ZDSPGC leadership the data it needs to plan ahead.</p>
          <ul className="side-list dark">
            <li>14 campuses across Zamboanga del Sur</li>
            <li>Employment monitoring across every course</li>
            <li>Announcements, surveys, and job postings in one place</li>
          </ul>
          <div className="row-gap mt">
            <button className="btn primary" onClick={onAlumniPortal}><GraduationCap size={16} />Alumni Login / Register</button>
            <button className="btn ghost" onClick={onAdminLogin}><ShieldCheck size={16} />Admin Login</button>
          </div>
        </div>
        <div className="landing-hero-panel">
          <div className="landing-stat"><Building2 size={18} /><div><strong>14</strong><span>Campuses</span></div></div>
          <div className="landing-stat"><Users size={18} /><div><strong>Live</strong><span>Alumni records</span></div></div>
          <div className="landing-stat"><Briefcase size={18} /><div><strong>Tracked</strong><span>Employment outcomes</span></div></div>
        </div>
      </section>

      <footer className="landing-foot">© {new Date().getFullYear()} ZDSPGC — Centralized Alumni Monitoring System</footer>
    </div>
  );
}

/* ============================== ADMIN LOGIN ============================== */

function AdminLoginScreen({ error, setError, onLogin, onBackHome, onForgot }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  function submit() {
    if (!identifier.trim() || !password) return;
    onLogin(identifier, password);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div className="auth-side-inner">
          <div className="brand-mark"><ShieldCheck size={26} /></div>
          <h1>Admin<br />Access Portal</h1>
          <p>Restricted to ZDSPGC Super Admin and Campus Admin accounts. Admin accounts are provisioned by the Super Admin only — there is no public admin sign-up.</p>
          <ul className="side-list">
            <li>Super Admin — full system access, every campus</li>
            <li>Campus Admin — scoped to their assigned campus</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="brand-mark small solo"><Lock size={16} /></div>
          <h2>Admin Login</h2>
          <p className="muted">Enter your registered admin credentials to continue.</p>
          {error && <div className="auth-error"><AlertCircle size={15} />{error}</div>}
          <Field label="Email or Username">
            <input value={identifier} onChange={(e) => { setIdentifier(e.target.value); if (error) setError(""); }} placeholder="you@zdspgc.edu.ph" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          <Field label="Password">
            <div className="pw-wrap">
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }} placeholder="Your password" onKeyDown={(e) => e.key === "Enter" && submit()} />
              <button className="pw-eye" onClick={() => setShowPw((s) => !s)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </Field>
          <button className="link-btn small" onClick={onForgot}>Forgot Password?</button>
          <button className="btn primary block" onClick={submit} disabled={!identifier.trim() || !password}>Login</button>
          <button className="btn ghost block" onClick={onBackHome}><ArrowLeft size={15} />Back to Home</button>
          <div className="demo-hint">Demo — Super Admin: superadmin@zdspgc.edu.ph / SuperAdmin!123 &nbsp;·&nbsp; Campus Admin: aurora.admin@zdspgc.edu.ph / Campus!123</div>
        </div>
      </div>
    </div>
  );
}

function AdminForgotPassword({ onBack }) {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div className="auth-side-inner">
          <div className="brand-mark"><KeyRound size={26} /></div>
          <h1>Reset Admin<br />Password</h1>
          <p>For security, admin passwords can only be reset by the Super Admin from the Manage Admin Accounts page.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          {sent ? (
            <>
              <UserCheck size={30} color="#1F5D4E" />
              <h2>Request received</h2>
              <p className="muted">If an admin account matches <strong>{identifier}</strong>, the Super Admin has been notified to reset the password. Please contact the Super Admin directly to receive your new temporary password.</p>
              <button className="btn primary block" onClick={onBack}>Back to Admin Login</button>
            </>
          ) : (
            <>
              <h2>Forgot your password?</h2>
              <p className="muted">Enter the email or username on your admin account. Your Super Admin will need to issue a new temporary password.</p>
              <Field label="Email or Username"><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@zdspgc.edu.ph" /></Field>
              <button className="btn primary block" onClick={() => identifier.trim() && setSent(true)} disabled={!identifier.trim()}>Send request</button>
              <button className="link-btn small" onClick={onBack}><ArrowLeft size={13} />Back to Admin Login</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== ADMIN SHELL ============================== */

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "records", label: "Alumni Records", icon: Users },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "surveys", label: "Surveys", icon: ClipboardList },
  { id: "jobs", label: "Job Board", icon: Briefcase },
  { id: "posts", label: "Community Posts", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

// Only the Super Admin sees these — account management and the system-wide audit trail.
const SUPERADMIN_NAV = [
  { id: "manageAdmins", label: "Manage Admin Accounts", icon: UserCog },
  { id: "activityLogs", label: "Activity Logs", icon: History },
];

function AdminShell({ db, update, tab, setTab, onLogout, showToast, adminName, role, scopeCampus, addLog, currentUserId }) {
  const isSuperAdmin = role === "superadmin";
  // Campus Admins only ever see data for their assigned campus; Super Admin sees everything.
  // This filtering happens once, here, so every admin page below just reads `scopedDb`.
  const scopedDb = scopeCampus ? { ...db, alumni: db.alumni.filter((a) => a.campus === scopeCampus) } : db;
  const pendingCount = scopedDb.alumni.filter((a) => a.accountStatus === "pending").length;
  const nav = isSuperAdmin ? [...ADMIN_NAV, ...SUPERADMIN_NAV] : ADMIN_NAV;

  return (
    <div className="shell">
      <Sidebar
        nav={nav} tab={tab} setTab={setTab} onLogout={onLogout} badgeMap={{ verification: pendingCount }}
        roleLabel={isSuperAdmin ? "Super Admin" : `Campus Admin — ${scopeCampus}`}
        personName={adminName}
      />
      <main className="main">
        {tab === "dashboard" && <AdminDashboard db={scopedDb} setTab={setTab} />}
        {tab === "records" && <AlumniRecords db={scopedDb} update={update} showToast={showToast} lockCampus={scopeCampus} />}
        {tab === "verification" && <Verification db={scopedDb} update={update} showToast={showToast} />}
        {tab === "employment" && <EmploymentMonitoring db={scopedDb} />}
        {tab === "notifications" && <NotificationsAdmin db={db} update={update} showToast={showToast} lockCampus={scopeCampus} />}
        {tab === "surveys" && <SurveysAdmin db={db} update={update} showToast={showToast} />}
        {tab === "jobs" && <JobsAdmin db={db} update={update} showToast={showToast} />}
        {tab === "posts" && <PostsAdmin db={db} update={update} showToast={showToast} />}
        {tab === "reports" && <Reports db={scopedDb} />}
        {/* Manage Admin Accounts and Activity Logs are Super Admin–only. Even if a Campus
            Admin somehow set tab to these ids, isSuperAdmin below blocks the render. */}
        {tab === "manageAdmins" && isSuperAdmin && <ManageAdmins db={db} update={update} showToast={showToast} addLog={addLog} currentUserId={currentUserId} />}
        {tab === "activityLogs" && isSuperAdmin && <ActivityLogs db={db} />}
      </main>
    </div>
  );
}

function Sidebar({ nav, tab, setTab, onLogout, badgeMap = {}, roleLabel, personName }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark small"><GraduationCap size={18} /></div>
        <div>
          <div className="brand-title">ZDSPGC</div>
          <div className="brand-sub">Alumni System</div>
        </div>
      </div>
      <nav className="side-nav">
        {nav.map((n) => (
          <button key={n.id} className={"side-item" + (tab === n.id ? " active" : "")} onClick={() => setTab(n.id)}>
            <n.icon size={17} strokeWidth={2} />
            <span>{n.label}</span>
            {!!badgeMap[n.id] && <span className="side-badge">{badgeMap[n.id]}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="person">
          <div className="avatar">{personName?.[0] || "?"}</div>
          <div>
            <div className="person-name">{personName}</div>
            <div className="person-role">{roleLabel}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout}><LogOut size={15} />Log out</button>
      </div>
    </aside>
  );
}

function PageHead({ eyebrow, title, action }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

/* -------- Admin Dashboard -------- */

function AdminDashboard({ db, setTab }) {
  const total = db.alumni.length;
  const employed = db.alumni.filter((a) => a.employment?.status === "Employed").length;
  const selfEmployed = db.alumni.filter((a) => a.employment?.status === "Self-Employed").length;
  const unemployed = db.alumni.filter((a) => a.employment?.status === "Unemployed").length;
  const pending = db.alumni.filter((a) => a.accountStatus === "pending").length;

  const pieData = [
    { name: "Employed", value: employed },
    { name: "Self-Employed", value: selfEmployed },
    { name: "Unemployed", value: unemployed },
  ].filter((d) => d.value > 0);

  const perCampus = CAMPUSES.map((c) => ({ name: c.replace(" Campus", ""), value: db.alumni.filter((a) => a.campus === c).length }));
  const perCourse = COURSES.map((c) => ({ name: c.replace("BS ", ""), value: db.alumni.filter((a) => a.course === c).length }));

  const recentAlumni = [...db.alumni].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentNotifs = [...db.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

  return (
    <div>
      <PageHead eyebrow="Overview" title="Admin Dashboard" />
      <div className="stat-grid">
        <StatCard icon={Users} label="Total Alumni" value={total} ribbon="#1F5D4E" />
        <StatCard icon={Briefcase} label="Employed" value={employed} ribbon="#1F5D4E" />
        <StatCard icon={Briefcase} label="Self-Employed" value={selfEmployed} ribbon="#C9962B" />
        <StatCard icon={Briefcase} label="Unemployed" value={unemployed} ribbon="#B23A34" />
        <StatCard icon={ShieldCheck} label="Pending Verification" value={pending} ribbon="#8A6D00" />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Employment Breakdown</h3>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={EMP_COLORS[d.name]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={Briefcase} text="No employment data yet." />}
        </div>
        <div className="panel">
          <h3>Alumni per Campus</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={perCampus} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DCC8" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#1F5D4E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Alumni per Course</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={perCourse} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DCC8" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#C9962B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <div className="panel-head-row"><h3>Recent Registrations</h3><button className="link-btn small" onClick={() => setTab("verification")}>Review all<ChevronRight size={14} /></button></div>
          <ul className="mini-list">
            {recentAlumni.map((a) => (
              <li key={a.id}>
                <div className="mini-avatar">{a.fullName[0]}</div>
                <div className="mini-info">
                  <div className="mini-name">{a.fullName}</div>
                  <div className="mini-sub">{a.course} · {a.campus}</div>
                </div>
                <Seal status={a.accountStatus} />
              </li>
            ))}
          </ul>
          <h3 className="mt">Recent Notifications</h3>
          <ul className="mini-list">
            {recentNotifs.map((n) => (
              <li key={n.id}>
                <div className="mini-avatar gold"><Bell size={14} /></div>
                <div className="mini-info">
                  <div className="mini-name">{n.title}</div>
                  <div className="mini-sub">{fmtDate(n.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* -------- Alumni Records -------- */

function AlumniRecords({ db, update, showToast, lockCampus }) {
  const [q, setQ] = useState("");
  const [fCampus, setFCampus] = useState("");
  // Campus Admins only ever browse/add within their own campus, so lock the filter to it.
  const effectiveCampus = lockCampus || fCampus;
  const [fCourse, setFCourse] = useState("");
  const [fYear, setFYear] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState(null); // alumni obj or "new"
  const [confirmDel, setConfirmDel] = useState(null);
  const [importing, setImporting] = useState(false);

  const filtered = db.alumni.filter((a) =>
    (!q || a.fullName.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase())) &&
    (!effectiveCampus || a.campus === effectiveCampus) &&
    (!fCourse || a.course === fCourse) &&
    (!fYear || a.gradYear === fYear) &&
    (!fStatus || a.employment?.status === fStatus)
  );

  function saveRecord(form, id) {
    const dupName = db.alumni.some((a) => a.id !== id && a.fullName.toLowerCase() === form.fullName.trim().toLowerCase() && a.gradYear === form.gradYear && a.course === form.course);
    const dupEmail = db.alumni.some((a) => a.id !== id && a.email.toLowerCase() === form.email.trim().toLowerCase());
    if (dupName || dupEmail) { showToast("A matching alumni record already exists."); return; }
    if (id) {
      update("alumni", (list) => list.map((a) => (a.id === id ? { ...a, ...form, updatedAt: now() } : a)));
      showToast("Record updated.");
    } else {
      const rec = { id: uid("al"), ...form, employment: form.employment || { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false }, accountStatus: "approved", createdAt: now(), updatedAt: now() };
      update("alumni", (list) => [...list, rec]);
      showToast("Alumni record added.");
    }
    setEditing(null);
  }

  function deleteRecord(id) {
    update("alumni", (list) => list.filter((a) => a.id !== id));
    update("users", (list) => list.filter((u) => u.alumniId !== id));
    setConfirmDel(null);
    showToast("Record deleted.");
  }

  // Bulk-add every valid row from the CSV in one shot: one alumni record plus one
  // pre-approved login account per row, using a shared default temporary password.
  function importRecords(validRows) {
    const newAlumni = validRows.map((r) => ({
      id: uid("al"), fullName: r.fullName, campus: r.campus, course: r.course, gradYear: r.gradYear,
      email: r.email, phone: r.phone, address: r.address, employment: r.employment,
      accountStatus: "approved", createdAt: now(), updatedAt: now(),
    }));
    const newUsers = newAlumni.map((a) => ({
      id: uid("user"), email: a.email, password: "Alumni@2026", role: "alumni", alumniId: a.id, name: a.fullName, createdAt: now(),
    }));
    update("alumni", (list) => [...list, ...newAlumni]);
    update("users", (list) => [...list, ...newUsers]);
    showToast(`Imported ${newAlumni.length} alumni record${newAlumni.length === 1 ? "" : "s"}.`);
    setImporting(false);
  }

  return (
    <div>
      <PageHead
        eyebrow={`${filtered.length} of ${db.alumni.length}`}
        title="Alumni Records"
        action={
          <div className="row-gap">
            <button className="btn ghost" onClick={() => setImporting(true)}><Upload size={16} />Import Students</button>
            <button className="btn primary" onClick={() => setEditing("new")}><Plus size={16} />Add Alumni</button>
          </div>
        }
      />

      <div className="filter-bar">
        <div className="search-box"><Search size={15} /><input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {lockCampus ? (
          <span className="badge-soft"><Building2 size={12} /> {lockCampus}</span>
        ) : (
          <select value={fCampus} onChange={(e) => setFCampus(e.target.value)}><option value="">All Campuses</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
        )}
        <select value={fCourse} onChange={(e) => setFCourse(e.target.value)}><option value="">All Courses</option>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={fYear} onChange={(e) => setFYear(e.target.value)}><option value="">All Years</option>{GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All Employment</option><option>Employed</option><option>Self-Employed</option><option>Unemployed</option></select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Campus</th><th>Course</th><th>Year</th><th>Employment</th><th>Account</th><th></th></tr></thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td><div className="cell-name"><div className="mini-avatar">{a.fullName[0]}</div>{a.fullName}</div></td>
                <td>{a.campus}</td>
                <td>{a.course}</td>
                <td>{a.gradYear}</td>
                <td><EmpTag status={a.employment?.status} /></td>
                <td><Seal status={a.accountStatus} /></td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => setEditing(a)}><Edit2 size={15} /></button>
                  <button className="icon-btn danger" onClick={() => setConfirmDel(a)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7}><EmptyState icon={Users} text="No alumni match these filters." /></td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <AlumniFormModal record={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={saveRecord} lockCampus={lockCampus} />}
      {importing && <ImportAlumniModal db={db} lockCampus={lockCampus} onClose={() => setImporting(false)} onImport={importRecords} />}
      {confirmDel && (
        <Modal title="Delete alumni record" onClose={() => setConfirmDel(null)}>
          <p>Remove <strong>{confirmDel.fullName}</strong> from the centralized database? This also removes their alumni account and cannot be undone.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className="btn danger" onClick={() => deleteRecord(confirmDel.id)}>Delete record</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ImportAlumniModal({ db, lockCampus, onClose, onImport }) {
  const [mode, setMode] = useState("paste"); // "paste" | "file" — paste-in is the fastest path, so lead with it
  const [fileName, setFileName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState(null); // validated rows, or null before data has been parsed
  const [parseError, setParseError] = useState("");

  function parseAndValidate(text) {
    try {
      const raw = parseCSV(text, detectDelimiter(text));
      if (raw.length < 2) { setParseError("No data rows found below the header row."); setRows(null); return; }
      setParseError("");
      setRows(validateImportRows(raw, db.alumni, db.users, lockCampus));
    } catch {
      setParseError("Couldn't read that data. Check it's plain text copied from a spreadsheet, or a CSV export.");
      setRows(null);
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => parseAndValidate(String(reader.result));
    reader.onerror = () => { setParseError("Couldn't read that file."); setRows(null); };
    reader.readAsText(file);
  }

  function handlePasteChange(text) {
    setPasteText(text);
    if (text.trim()) parseAndValidate(text);
    else { setRows(null); setParseError(""); }
  }

  const validRows = rows ? rows.filter((r) => r.valid) : [];
  const invalidRows = rows ? rows.filter((r) => !r.valid) : [];

  return (
    <Modal title="Import Student / Alumni Records" onClose={onClose} wide>
      <p className="muted">Add many alumni records at once, right here — no separate file required. Each valid row also gets a login account with the temporary password <strong>Alumni@2026</strong>.</p>
      {lockCampus && <div className="badge-soft mt"><Building2 size={12} /> All imported records will be assigned to {lockCampus}</div>}

      <div className="tab-toggle mt">
        <button className={mode === "paste" ? "active" : ""} onClick={() => setMode("paste")}>Paste data</button>
        <button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}>Upload CSV file</button>
      </div>

      {mode === "paste" ? (
        <>
          <p className="mini-sub mt">Open your spreadsheet, select the header row plus your student rows, copy (<kbd>Ctrl/Cmd+C</kbd>), and paste below (<kbd>Ctrl/Cmd+V</kbd>).</p>
          <div className="row-gap">
            <button className="btn ghost" onClick={downloadImportTemplate}><FileText size={15} />Download a starter template</button>
          </div>
          <div className="field mt">
            <span>Paste rows here (include the header row)</span>
            <textarea
              rows={7}
              placeholder={"Full Name\tEmail\tCampus\tCourse\tGraduation Year\u2026\nJuan Dela Cruz\tjuan@example.com\tAurora Campus\tBS Agriculture\t2024"}
              value={pasteText}
              onChange={(e) => handlePasteChange(e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="row-gap mt">
            <button className="btn ghost" onClick={downloadImportTemplate}><FileText size={15} />Download CSV template</button>
          </div>
          <div className="field mt">
            <span>CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
          </div>
          {fileName && <div className="mini-sub">Selected: {fileName}</div>}
        </>
      )}

      {parseError && <div className="auth-error"><AlertCircle size={15} />{parseError}</div>}

      {rows && (
        <>
          <div className="stat-grid mt">
            <StatCard icon={Users} label="Rows found" value={rows.length} ribbon="#1F5D4E" />
            <StatCard icon={UserCheck} label="Ready to import" value={validRows.length} ribbon="#1F5D4E" />
            <StatCard icon={AlertCircle} label="Rows with errors" value={invalidRows.length} ribbon="#B23A34" />
          </div>
          <div className="table-wrap mt" style={{ maxHeight: 260, overflowY: "auto" }}>
            <table>
              <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Campus</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNum}>
                    <td>{r.rowNum}</td>
                    <td>{r.fullName || "—"}</td>
                    <td>{r.email || "—"}</td>
                    <td>{r.campus || "—"}</td>
                    <td>{r.valid ? <Seal status="approved" /> : <span style={{ color: "var(--danger)", fontSize: ".78rem" }}>{r.errors.join("; ")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onImport(validRows)} disabled={!validRows.length}>
          <Upload size={15} />Import {validRows.length ? `${validRows.length} record${validRows.length === 1 ? "" : "s"}` : ""}
        </button>
      </div>
    </Modal>
  );
}

function AlumniFormModal({ record, onClose, onSave, lockCampus }) {
  const [form, setForm] = useState(record ? { ...record } : {
    fullName: "", campus: lockCampus || CAMPUSES[0], course: COURSES[0], gradYear: GRAD_YEARS[GRAD_YEARS.length - 1],
    email: "", phone: "", address: "", employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false },
  });
  const emp = form.employment || {};
  const setEmp = (patch) => setForm({ ...form, employment: { ...emp, ...patch } });

  return (
    <Modal title={record ? "Edit alumni record" : "Add alumni record"} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Full name"><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Campus">
          {lockCampus ? (
            <input value={lockCampus} disabled />
          ) : (
            <select value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })}>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
          )}
        </Field>
        <Field label="Course"><select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>{COURSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Graduation year"><select value={form.gradYear} onChange={(e) => setForm({ ...form, gradYear: e.target.value })}>{GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}</select></Field>
        <Field label="Contact number"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      </div>
      <h4 className="section-title">Employment details</h4>
      <div className="form-grid">
        <Field label="Status">
          <select value={emp.status} onChange={(e) => setEmp({ status: e.target.value })}><option>Unemployed</option><option>Employed</option><option>Self-Employed</option></select>
        </Field>
        <Field label="Company / Business name"><input value={emp.company || ""} onChange={(e) => setEmp({ company: e.target.value })} /></Field>
        <Field label="Job position"><input value={emp.position || ""} onChange={(e) => setEmp({ position: e.target.value })} /></Field>
        <Field label="Employment location"><input value={emp.location || ""} onChange={(e) => setEmp({ location: e.target.value })} /></Field>
        <Field label="Date employed"><input type="date" value={emp.dateEmployed || ""} onChange={(e) => setEmp({ dateEmployed: e.target.value })} /></Field>
        <Field label="Related to course?">
          <select value={emp.related ? "yes" : "no"} onChange={(e) => setEmp({ related: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></select>
        </Field>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(form, record?.id)} disabled={!form.fullName || !form.email}>Save record</button>
      </div>
    </Modal>
  );
}

/* -------- Verification -------- */

function Verification({ db, update, showToast }) {
  const pending = db.alumni.filter((a) => a.accountStatus === "pending");
  const decided = db.alumni.filter((a) => a.accountStatus !== "pending").slice(-8).reverse();

  function decide(a, status) {
    update("alumni", (list) => list.map((x) => (x.id === a.id ? { ...x, accountStatus: status, updatedAt: now() } : x)));
    update("notifications", (list) => [...list, { id: uid("notif"), title: status === "approved" ? "Account verified" : "Registration rejected", message: status === "approved" ? "Your ZDSPGC alumni account has been verified. You can now log in and access all features." : "Your registration could not be verified against school records. Please contact the registrar's office.", audience: { type: "alumni", value: a.id }, createdAt: now(), readBy: [] }]);
    showToast(`${a.fullName} ${status === "approved" ? "approved" : "rejected"}.`);
  }

  return (
    <div>
      <PageHead eyebrow={`${pending.length} awaiting review`} title="Account Verification" />
      {!pending.length ? <EmptyState icon={ShieldCheck} text="No pending verifications. All caught up." /> : (
        <div className="verify-grid">
          {pending.map((a) => (
            <div className="verify-card" key={a.id}>
              <div className="verify-top">
                <div className="mini-avatar lg">{a.fullName[0]}</div>
                <div>
                  <div className="mini-name">{a.fullName}</div>
                  <div className="mini-sub">{a.course}</div>
                </div>
              </div>
              <div className="verify-details">
                <div><Building2 size={13} />{a.campus}</div>
                <div><GraduationCap size={13} />Batch {a.gradYear}</div>
                <div><Mail size={13} />{a.email}</div>
                <div><Phone size={13} />{a.phone}</div>
                <div><MapPin size={13} />{a.address}</div>
              </div>
              <div className="verify-actions">
                <button className="btn danger outline" onClick={() => decide(a, "rejected")}><UserX size={15} />Reject</button>
                <button className="btn primary" onClick={() => decide(a, "approved")}><UserCheck size={15} />Approve</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!!decided.length && (
        <>
          <h3 className="mt">Recently decided</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Campus</th><th>Course</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                {decided.map((a) => (
                  <tr key={a.id}><td>{a.fullName}</td><td>{a.campus}</td><td>{a.course}</td><td><Seal status={a.accountStatus} /></td><td>{fmtDate(a.updatedAt)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* -------- Employment Monitoring -------- */

function EmploymentMonitoring({ db }) {
  const [fStatus, setFStatus] = useState("");
  const list = db.alumni.filter((a) => !fStatus || a.employment?.status === fStatus);
  const related = db.alumni.filter((a) => a.employment?.status !== "Unemployed");
  const relatedCount = related.filter((a) => a.employment?.related).length;

  return (
    <div>
      <PageHead eyebrow="Outcomes tracking" title="Employment Monitoring" />
      <div className="stat-grid">
        <StatCard icon={Briefcase} label="Employed" value={db.alumni.filter((a) => a.employment?.status === "Employed").length} ribbon="#1F5D4E" />
        <StatCard icon={Briefcase} label="Self-Employed" value={db.alumni.filter((a) => a.employment?.status === "Self-Employed").length} ribbon="#C9962B" />
        <StatCard icon={Briefcase} label="Unemployed" value={db.alumni.filter((a) => a.employment?.status === "Unemployed").length} ribbon="#B23A34" />
        <StatCard icon={GraduationCap} label="Course-Related Jobs" value={related.length ? `${relatedCount}/${related.length}` : "0/0"} ribbon="#1F5D4E" />
      </div>
      <div className="filter-bar">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All Employment Status</option><option>Employed</option><option>Self-Employed</option><option>Unemployed</option></select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Company / Business</th><th>Position</th><th>Location</th><th>Date</th><th>Related</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>{a.fullName}</td>
                <td><EmpTag status={a.employment?.status} /></td>
                <td>{a.employment?.company || "—"}</td>
                <td>{a.employment?.position || "—"}</td>
                <td>{a.employment?.location || "—"}</td>
                <td>{a.employment?.dateEmployed ? fmtDate(a.employment.dateEmployed) : "—"}</td>
                <td>{a.employment?.status === "Unemployed" ? "—" : a.employment?.related ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------- Notifications (Admin) -------- */

function audienceLabel(aud) {
  if (!aud || aud.type === "all") return "All alumni";
  if (aud.type === "campus") return `Campus: ${aud.value}`;
  if (aud.type === "course") return `Course: ${aud.value}`;
  if (aud.type === "year") return `Batch ${aud.value}`;
  if (aud.type === "alumni") return "Direct message";
  return "All alumni";
}

function matchesAudience(aud, alumnus) {
  if (!aud || aud.type === "all") return true;
  if (aud.type === "campus") return alumnus.campus === aud.value;
  if (aud.type === "course") return alumnus.course === aud.value;
  if (aud.type === "year") return alumnus.gradYear === aud.value;
  if (aud.type === "alumni") return alumnus.id === aud.value;
  return false;
}

function NotificationsAdmin({ db, update, showToast, lockCampus }) {
  const [composing, setComposing] = useState(false);
  const sorted = [...db.notifications].filter((n) => n.audience?.type !== "alumni").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function send(form) {
    update("notifications", (list) => [...list, { id: uid("notif"), title: form.title.trim(), message: form.message.trim(), audience: form.audience, createdAt: now(), readBy: [] }]);
    showToast("Notification sent.");
    setComposing(false);
  }

  return (
    <div>
      <PageHead eyebrow={`${sorted.length} sent`} title="Notifications & Announcements" action={<button className="btn primary" onClick={() => setComposing(true)}><Plus size={16} />New Announcement</button>} />
      <div className="stack">
        {sorted.map((n) => {
          const recipients = db.alumni.filter((a) => matchesAudience(n.audience, a));
          const read = recipients.filter((a) => (n.readBy || []).includes(a.id)).length;
          return (
            <div className="list-card" key={n.id}>
              <div className="list-card-head">
                <div className="mini-avatar gold"><Bell size={14} /></div>
                <div style={{ flex: 1 }}>
                  <div className="mini-name">{n.title}</div>
                  <div className="mini-sub">{audienceLabel(n.audience)} · {fmtDate(n.createdAt)}</div>
                </div>
                <span className="badge-soft">{read}/{recipients.length} read</span>
              </div>
              <p className="list-card-text">{n.message}</p>
            </div>
          );
        })}
        {!sorted.length && <EmptyState icon={Bell} text="No announcements sent yet." />}
      </div>
      {composing && <ComposeNotifModal onClose={() => setComposing(false)} onSend={send} lockCampus={lockCampus} />}
    </div>
  );
}

function ComposeNotifModal({ onClose, onSend, lockCampus }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audType, setAudType] = useState("all");
  const [audValue, setAudValue] = useState(CAMPUSES[0]);

  // The stored audience model only supports one filter at a time (campus OR course OR year),
  // not a combination. So a Campus Admin, who must never reach another campus's alumni, is
  // restricted to the single "their campus" audience rather than being offered course/year
  // options that would silently broadcast beyond their campus.
  const audience = lockCampus ? { type: "campus", value: lockCampus } : (audType === "all" ? { type: "all" } : { type: audType, value: audValue });

  return (
    <Modal title="New announcement" onClose={onClose}>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grand Alumni Homecoming" /></Field>
      <Field label="Message"><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write the announcement…" /></Field>
      {lockCampus ? (
        <Field label="Send to"><input value={`All alumni — ${lockCampus}`} disabled /></Field>
      ) : (
        <>
          <Field label="Send to">
            <select value={audType} onChange={(e) => { setAudType(e.target.value); setAudValue(e.target.value === "campus" ? CAMPUSES[0] : e.target.value === "course" ? COURSES[0] : GRAD_YEARS[0]); }}>
              <option value="all">All alumni</option>
              <option value="campus">Specific campus</option>
              <option value="course">Specific course</option>
              <option value="year">Specific graduation year</option>
            </select>
          </Field>
          {audType !== "all" && (
            <Field label={audType === "campus" ? "Campus" : audType === "course" ? "Course" : "Graduation year"}>
              <select value={audValue} onChange={(e) => setAudValue(e.target.value)}>
                {(audType === "campus" ? CAMPUSES : audType === "course" ? COURSES : GRAD_YEARS).map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
          )}
        </>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSend({ title, message, audience })} disabled={!title.trim() || !message.trim()}><Send size={15} />Send</button>
      </div>
    </Modal>
  );
}

/* -------- Surveys (Admin) -------- */

function SurveysAdmin({ db, update, showToast }) {
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);

  function createSurvey(form) {
    update("surveys", (list) => [...list, { id: uid("survey"), title: form.title.trim(), createdAt: now(), questions: form.questions, responses: [] }]);
    showToast("Survey published.");
    setCreating(false);
  }

  return (
    <div>
      <PageHead eyebrow={`${db.surveys.length} surveys`} title="Surveys & Feedback" action={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />New Survey</button>} />
      <div className="cards-grid">
        {db.surveys.map((s) => (
          <div className="simple-card" key={s.id}>
            <ClipboardList size={18} color="#1F5D4E" />
            <div className="mini-name">{s.title}</div>
            <div className="mini-sub">{s.questions.length} questions · {s.responses.length} responses</div>
            <button className="link-btn small" onClick={() => setViewing(s)}>View responses<ChevronRight size={14} /></button>
          </div>
        ))}
        {!db.surveys.length && <EmptyState icon={ClipboardList} text="No surveys created yet." />}
      </div>
      {creating && <SurveyFormModal onClose={() => setCreating(false)} onSave={createSurvey} />}
      {viewing && <SurveyResponsesModal survey={viewing} db={db} onClose={() => setViewing(null)} />}
    </div>
  );
}

function SurveyFormModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ id: uid("q"), text: "", type: "text", options: "" }]);

  const addQ = () => setQuestions([...questions, { id: uid("q"), text: "", type: "text", options: "" }]);
  const setQ = (id, patch) => setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const rmQ = (id) => setQuestions(questions.filter((q) => q.id !== id));

  function save() {
    const clean = questions.filter((q) => q.text.trim()).map((q) => ({ id: q.id, text: q.text.trim(), type: q.type, options: q.type === "choice" ? q.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined }));
    onSave({ title, questions: clean });
  }

  return (
    <Modal title="Create survey" onClose={onClose} wide>
      <Field label="Survey title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2026 Employment & Feedback Survey" /></Field>
      <h4 className="section-title">Questions</h4>
      <div className="stack">
        {questions.map((q, i) => (
          <div className="qbuilder-row" key={q.id}>
            <span className="qnum">{i + 1}</span>
            <div style={{ flex: 1 }}>
              <input placeholder="Question text" value={q.text} onChange={(e) => setQ(q.id, { text: e.target.value })} />
              <div className="qbuilder-sub">
                <select value={q.type} onChange={(e) => setQ(q.id, { type: e.target.value })}>
                  <option value="text">Short text</option>
                  <option value="rating">Rating (1–5)</option>
                  <option value="choice">Multiple choice</option>
                </select>
                {q.type === "choice" && <input placeholder="Options, comma separated" value={q.options} onChange={(e) => setQ(q.id, { options: e.target.value })} />}
              </div>
            </div>
            <button className="icon-btn danger" onClick={() => rmQ(q.id)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <button className="link-btn small" onClick={addQ}><Plus size={14} />Add question</button>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!title.trim()}>Publish survey</button>
      </div>
    </Modal>
  );
}

function SurveyResponsesModal({ survey, db, onClose }) {
  return (
    <Modal title={survey.title} onClose={onClose} wide>
      <p className="muted">{survey.responses.length} response{survey.responses.length === 1 ? "" : "s"}</p>
      <div className="stack">
        {survey.questions.map((q) => {
          const answers = survey.responses.map((r) => r.answers[q.id]).filter((a) => a !== undefined && a !== "");
          return (
            <div className="panel" key={q.id}>
              <h4 style={{ marginTop: 0 }}>{q.text}</h4>
              {q.type === "text" ? (
                <ul className="mini-list">{answers.length ? answers.map((a, i) => <li key={i}><div className="mini-info"><div className="mini-sub">{a}</div></div></li>) : <li><span className="muted">No responses yet.</span></li>}</ul>
              ) : (
                <div className="tally">
                  {(q.type === "rating" ? ["1", "2", "3", "4", "5"] : q.options || []).map((opt) => {
                    const c = answers.filter((a) => String(a) === String(opt)).length;
                    return <div className="tally-row" key={opt}><span>{opt}</span><div className="tally-bar"><div style={{ width: `${answers.length ? (c / answers.length) * 100 : 0}%` }} /></div><span>{c}</span></div>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* -------- Jobs (Admin) -------- */

function JobsAdmin({ db, update, showToast }) {
  const [creating, setCreating] = useState(false);

  function post(form) {
    update("jobs", (list) => [{ id: uid("job"), ...form, postedAt: now() }, ...list]);
    showToast("Job opportunity posted.");
    setCreating(false);
  }
  function remove(id) {
    update("jobs", (list) => list.filter((j) => j.id !== id));
    showToast("Job posting removed.");
  }

  return (
    <div>
      <PageHead eyebrow={`${db.jobs.length} postings`} title="Job Opportunity Board" action={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />Post Job</button>} />
      <div className="cards-grid">
        {db.jobs.map((j) => (
          <div className="simple-card" key={j.id}>
            <div className="job-card-head">
              <Briefcase size={18} color="#1F5D4E" />
              <button className="icon-btn danger" onClick={() => remove(j.id)}><Trash2 size={15} /></button>
            </div>
            <div className="mini-name">{j.title}</div>
            <div className="mini-sub">{j.company} · {j.location}</div>
            <p className="list-card-text">{j.requirements}</p>
            <div className="badge-soft">Deadline: {fmtDate(j.deadline)}</div>
          </div>
        ))}
        {!db.jobs.length && <EmptyState icon={Briefcase} text="No job postings yet." />}
      </div>
      {creating && (
        <Modal title="Post job opportunity" onClose={() => setCreating(false)}>
          <JobForm onSubmit={post} onCancel={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}

function JobForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ title: "", company: "", requirements: "", location: "", deadline: "" });
  return (
    <>
      <Field label="Job title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <Field label="Company"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
      <Field label="Requirements"><textarea rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></Field>
      <Field label="Location"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
      <Field label="Application deadline"><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" onClick={() => onSubmit(form)} disabled={!form.title.trim() || !form.company.trim()}>Post opening</button>
      </div>
    </>
  );
}

/* -------- Posts (Admin moderation) -------- */

function PostsAdmin({ db, update, showToast }) {
  function removePost(id) { update("posts", (list) => list.filter((p) => p.id !== id)); showToast("Post removed."); }
  function removeComment(postId, cid) { update("posts", (list) => list.map((p) => (p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== cid) } : p))); showToast("Comment removed."); }

  const sorted = [...db.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div>
      <PageHead eyebrow={`${db.posts.length} posts`} title="Community Posts — Moderation" />
      <div className="stack">
        {sorted.map((p) => (
          <div className="list-card" key={p.id}>
            <div className="list-card-head">
              <div className="mini-avatar">{p.authorName[0]}</div>
              <div style={{ flex: 1 }}>
                <div className="mini-name">{p.authorName}</div>
                <div className="mini-sub">{fmtDate(p.createdAt)}</div>
              </div>
              <button className="icon-btn danger" onClick={() => removePost(p.id)}><Trash2 size={15} /></button>
            </div>
            <p className="list-card-text">{p.content}</p>
            <div className="post-meta"><ThumbsUp size={13} />{p.likes.length}<MessageSquare size={13} />{p.comments.length}</div>
            {!!p.comments.length && (
              <div className="comment-list">
                {p.comments.map((c) => (
                  <div className="comment-row" key={c.id}>
                    <div className="mini-avatar sm">{c.authorName[0]}</div>
                    <div style={{ flex: 1 }}><strong>{c.authorName}</strong> <span className="muted">{c.content}</span></div>
                    <button className="icon-btn danger" onClick={() => removeComment(p.id, c.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!sorted.length && <EmptyState icon={MessageSquare} text="No community posts yet." />}
      </div>
    </div>
  );
}

/* -------- Reports -------- */

function Reports({ db }) {
  const [fCampus, setFCampus] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fYear, setFYear] = useState("");
  const [fStatus, setFStatus] = useState("");

  const filtered = db.alumni.filter((a) =>
    (!fCampus || a.campus === fCampus) && (!fCourse || a.course === fCourse) && (!fYear || a.gradYear === fYear) && (!fStatus || a.employment?.status === fStatus)
  );

  function exportCsv() {
    const header = ["Full Name", "Campus", "Course", "Graduation Year", "Employment Status", "Company", "Position", "Location"];
    const rows = filtered.map((a) => [a.fullName, a.campus, a.course, a.gradYear, a.employment?.status || "", a.employment?.company || "", a.employment?.position || "", a.employment?.location || ""]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "zdspgc-alumni-report.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHead eyebrow="Analytics" title="Reports" action={
        <div className="row-gap">
          <button className="btn ghost" onClick={() => window.print()}><Printer size={15} />Print</button>
          <button className="btn primary" onClick={exportCsv}><Download size={15} />Export CSV</button>
        </div>
      } />
      <div className="filter-bar">
        <select value={fCampus} onChange={(e) => setFCampus(e.target.value)}><option value="">All Campuses</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={fCourse} onChange={(e) => setFCourse(e.target.value)}><option value="">All Courses</option>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={fYear} onChange={(e) => setFYear(e.target.value)}><option value="">All Years</option>{GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All Employment</option><option>Employed</option><option>Self-Employed</option><option>Unemployed</option></select>
      </div>
      <div className="stat-grid">
        <StatCard icon={FileSpreadsheet} label="Records in Report" value={filtered.length} ribbon="#1F5D4E" />
        <StatCard icon={Briefcase} label="Employed" value={filtered.filter((a) => a.employment?.status === "Employed").length} ribbon="#1F5D4E" />
        <StatCard icon={Briefcase} label="Self-Employed" value={filtered.filter((a) => a.employment?.status === "Self-Employed").length} ribbon="#C9962B" />
        <StatCard icon={Briefcase} label="Unemployed" value={filtered.filter((a) => a.employment?.status === "Unemployed").length} ribbon="#B23A34" />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Campus</th><th>Course</th><th>Year</th><th>Employment</th><th>Company</th></tr></thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}><td>{a.fullName}</td><td>{a.campus}</td><td>{a.course}</td><td>{a.gradYear}</td><td><EmpTag status={a.employment?.status} /></td><td>{a.employment?.company || "—"}</td></tr>
            ))}
            {!filtered.length && <tr><td colSpan={6}><EmptyState icon={BarChart3} text="No records match this report filter." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------- Manage Admin Accounts (Super Admin only) -------- */

function ManageAdmins({ db, update, showToast, addLog, currentUserId }) {
  const admins = db.users.filter((u) => u.role === "superadmin" || u.role === "campusadmin");
  const [editing, setEditing] = useState(null); // "new" | admin obj
  const [resetting, setResetting] = useState(null); // admin obj
  const [confirmDel, setConfirmDel] = useState(null);

  function saveAdmin(form, id) {
    const emailTaken = db.users.some((u) => u.id !== id && u.email.toLowerCase() === form.email.trim().toLowerCase());
    const userTaken = db.users.some((u) => u.id !== id && (u.username || "").toLowerCase() === form.username.trim().toLowerCase());
    if (emailTaken) { showToast("Another account already uses this email."); return; }
    if (userTaken) { showToast("Another account already uses this username."); return; }
    if (id) {
      update("users", (list) => list.map((u) => (u.id === id ? { ...u, ...form } : u)));
      addLog("Super Admin", "Updated Campus Admin account", form.name);
      showToast("Admin account updated.");
    } else {
      const rec = {
        id: uid("user"), role: "campusadmin", name: form.name.trim(), email: form.email.trim(),
        username: form.username.trim(), password: form.password, campus: form.campus, status: form.status, createdAt: now(),
      };
      update("users", (list) => [...list, rec]);
      addLog("Super Admin", "Created Campus Admin account", `${rec.name} — ${rec.campus}`);
      showToast("Campus Admin account created.");
    }
    setEditing(null);
  }

  function toggleStatus(a) {
    const next = a.status === "active" ? "deactivated" : "active";
    update("users", (list) => list.map((u) => (u.id === a.id ? { ...u, status: next } : u)));
    addLog("Super Admin", next === "active" ? "Activated admin account" : "Deactivated admin account", a.name);
    showToast(`${a.name} ${next === "active" ? "activated" : "deactivated"}.`);
  }

  function resetPassword(a, newPassword) {
    update("users", (list) => list.map((u) => (u.id === a.id ? { ...u, password: newPassword } : u)));
    addLog("Super Admin", "Reset admin password", a.name);
    setResetting(null);
    showToast(`Password reset for ${a.name}.`);
  }

  function deleteAdmin(a) {
    update("users", (list) => list.filter((u) => u.id !== a.id));
    addLog("Super Admin", "Deleted admin account", a.name);
    setConfirmDel(null);
    showToast("Admin account deleted.");
  }

  return (
    <div>
      <PageHead eyebrow={`${admins.length} admin accounts`} title="Manage Admin Accounts" action={<button className="btn primary" onClick={() => setEditing("new")}><Plus size={16} />Add Campus Admin</button>} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Campus</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => {
              const isSuper = a.role === "superadmin";
              const isSelf = a.id === currentUserId;
              return (
                <tr key={a.id}>
                  <td><div className="cell-name"><div className="mini-avatar gold">{a.name[0]}</div>{a.name}{isSelf && <span className="badge-soft">You</span>}</div></td>
                  <td>{a.username || "—"}</td>
                  <td>{a.email}</td>
                  <td>{isSuper ? "Super Admin" : "Campus Admin"}</td>
                  <td>{a.campus || "All campuses"}</td>
                  <td><span className={"admin-status " + (a.status === "deactivated" ? "off" : "on")}>{a.status === "deactivated" ? "Deactivated" : "Active"}</span></td>
                  <td className="row-actions">
                    {!isSuper && (
                      <>
                        <button className="icon-btn" title="Edit" onClick={() => setEditing(a)}><Edit2 size={15} /></button>
                        <button className="icon-btn" title="Reset password" onClick={() => setResetting(a)}><KeyRound size={15} /></button>
                        <button className="icon-btn" title={a.status === "deactivated" ? "Activate" : "Deactivate"} onClick={() => toggleStatus(a)}><Power size={15} /></button>
                        <button className="icon-btn danger" title="Delete" onClick={() => setConfirmDel(a)}><Trash2 size={15} /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <AdminFormModal admin={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={saveAdmin} />}

      {resetting && <ResetPasswordModal admin={resetting} onClose={() => setResetting(null)} onSave={resetPassword} />}

      {confirmDel && (
        <Modal title="Delete admin account" onClose={() => setConfirmDel(null)}>
          <p>Remove <strong>{confirmDel.name}</strong>'s Campus Admin account? They will immediately lose access and cannot be undone.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className="btn danger" onClick={() => deleteAdmin(confirmDel)}>Delete account</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminFormModal({ admin, onClose, onSave }) {
  const [form, setForm] = useState(admin ? { ...admin } : {
    name: "", email: "", username: "", password: "", campus: CAMPUSES[0], status: "active",
  });
  return (
    <Modal title={admin ? "Edit Campus Admin" : "Add Campus Admin"} onClose={onClose}>
      <Field label="Full Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Dela Cruz" /></Field>
      <Field label="Email Address"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@zdspgc.edu.ph" /></Field>
      <Field label="Username"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="firstname.lastname" /></Field>
      {!admin && <Field label="Temporary Password"><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Assign a temporary password" /></Field>}
      <Field label="Assigned Campus"><select value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })}>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Account Status">
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="deactivated">Deactivated</option></select>
      </Field>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(form, admin?.id)} disabled={!form.name || !form.email || !form.username || (!admin && !form.password)}>Save account</button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ admin, onClose, onSave }) {
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  return (
    <Modal title={`Reset password — ${admin.name}`} onClose={onClose}>
      <Field label="New Temporary Password">
        <div className="pw-wrap">
          <input type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter new temporary password" />
          <button className="pw-eye" onClick={() => setShowPw((s) => !s)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </Field>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(admin, pw)} disabled={pw.length < 4}>Reset password</button>
      </div>
    </Modal>
  );
}

/* -------- Activity Logs (Super Admin only) -------- */

function ActivityLogs({ db }) {
  const logs = [...(db.logs || [])].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return (
    <div>
      <PageHead eyebrow={`${logs.length} events`} title="System Activity Logs" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}><td>{new Date(l.ts).toLocaleString("en-PH")}</td><td>{l.actor}</td><td>{l.action}</td><td>{l.detail || "—"}</td></tr>
            ))}
            {!logs.length && <tr><td colSpan={4}><EmptyState icon={History} text="No activity recorded yet." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== ALUMNI SHELL ============================== */

const ALUMNI_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "profile", label: "My Profile", icon: Users },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "jobs", label: "Job Board", icon: Briefcase },
  { id: "surveys", label: "Surveys", icon: ClipboardList },
  { id: "posts", label: "Community", icon: MessageSquare },
];

function AlumniShell({ db, update, tab, setTab, onLogout, showToast, me, meUser }) {
  const myNotifs = db.notifications.filter((n) => matchesAudience(n.audience, me));
  const unread = myNotifs.filter((n) => !(n.readBy || []).includes(me.id)).length;

  return (
    <div className="shell">
      <Sidebar nav={ALUMNI_NAV} tab={tab} setTab={setTab} onLogout={onLogout} badgeMap={{ notifications: unread }} roleLabel="Alumni" personName={me.fullName} />
      <main className="main">
        {tab === "dashboard" && <AlumniDashboard db={db} me={me} setTab={setTab} myNotifs={myNotifs} />}
        {tab === "profile" && <AlumniProfile db={db} update={update} me={me} showToast={showToast} />}
        {tab === "employment" && <AlumniEmployment db={db} update={update} me={me} showToast={showToast} />}
        {tab === "notifications" && <AlumniNotifications db={db} update={update} me={me} myNotifs={myNotifs} />}
        {tab === "jobs" && <AlumniJobs db={db} />}
        {tab === "surveys" && <AlumniSurveys db={db} update={update} me={me} showToast={showToast} />}
        {tab === "posts" && <AlumniPosts db={db} update={update} me={me} />}
      </main>
    </div>
  );
}

function AlumniDashboard({ db, me, setTab, myNotifs }) {
  const unread = myNotifs.filter((n) => !(n.readBy || []).includes(me.id)).length;
  return (
    <div>
      <PageHead eyebrow={`Welcome back`} title={me.fullName} />
      <div className="stat-grid">
        <StatCard icon={Briefcase} label="Employment Status" value={me.employment?.status || "Unemployed"} ribbon={EMP_COLORS[me.employment?.status] || "#5B6B63"} />
        <StatCard icon={Bell} label="Unread Notifications" value={unread} ribbon="#C9962B" />
        <StatCard icon={Briefcase} label="Open Job Postings" value={db.jobs.length} ribbon="#1F5D4E" />
        <StatCard icon={ClipboardList} label="Surveys Available" value={db.surveys.filter((s) => !s.responses.some((r) => r.alumniId === me.id)).length} ribbon="#1F5D4E" />
      </div>
      <div className="grid-2">
        <div className="panel">
          <h3>Your record</h3>
          <div className="profile-rows">
            <div><Building2 size={14} />{me.campus}</div>
            <div><GraduationCap size={14} />{me.course} · Batch {me.gradYear}</div>
            <div><Mail size={14} />{me.email}</div>
            <div><Phone size={14} />{me.phone}</div>
            <div><MapPin size={14} />{me.address}</div>
          </div>
          <button className="link-btn small" onClick={() => setTab("profile")}>Update profile<ChevronRight size={14} /></button>
        </div>
        <div className="panel">
          <h3>Latest announcements</h3>
          <ul className="mini-list">
            {[...myNotifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4).map((n) => (
              <li key={n.id}>
                <div className="mini-avatar gold"><Bell size={14} /></div>
                <div className="mini-info"><div className="mini-name">{n.title}</div><div className="mini-sub">{fmtDate(n.createdAt)}</div></div>
              </li>
            ))}
            {!myNotifs.length && <li><span className="muted">No announcements yet.</span></li>}
          </ul>
          <button className="link-btn small" onClick={() => setTab("notifications")}>View all<ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function AlumniProfile({ db, update, me, showToast }) {
  const [form, setForm] = useState({ phone: me.phone, address: me.address });
  function save() {
    update("alumni", (list) => list.map((a) => (a.id === me.id ? { ...a, ...form, updatedAt: now() } : a)));
    showToast("Profile updated.");
  }
  return (
    <div>
      <PageHead eyebrow="Account" title="My Profile" />
      <div className="panel narrow">
        <div className="profile-hero">
          <div className="avatar lg">{me.fullName[0]}</div>
          <div><div className="mini-name">{me.fullName}</div><Seal status={me.accountStatus} /></div>
        </div>
        <h4 className="section-title">School record (verified — contact registrar to correct)</h4>
        <div className="form-grid">
          <Field label="Campus"><input value={me.campus} disabled /></Field>
          <Field label="Course"><input value={me.course} disabled /></Field>
          <Field label="Graduation year"><input value={me.gradYear} disabled /></Field>
          <Field label="Email"><input value={me.email} disabled /></Field>
        </div>
        <h4 className="section-title">Contact details</h4>
        <div className="form-grid">
          <Field label="Contact number"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
        <button className="btn primary" onClick={save}>Save changes</button>
      </div>
    </div>
  );
}

function AlumniEmployment({ db, update, me, showToast }) {
  const [form, setForm] = useState({ ...me.employment });
  function save() {
    update("alumni", (list) => list.map((a) => (a.id === me.id ? { ...a, employment: form, updatedAt: now() } : a)));
    showToast("Employment status updated.");
  }
  return (
    <div>
      <PageHead eyebrow="Outcomes" title="Employment Status" />
      <div className="panel narrow">
        <div className="form-grid">
          <Field label="Current status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Unemployed</option><option>Employed</option><option>Self-Employed</option></select></Field>
          {form.status !== "Unemployed" && (
            <>
              <Field label="Company / Business name"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
              <Field label="Job position"><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
              <Field label="Employment location"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <Field label="Date started"><input type="date" value={form.dateEmployed} onChange={(e) => setForm({ ...form, dateEmployed: e.target.value })} /></Field>
              <Field label="Related to your course?"><select value={form.related ? "yes" : "no"} onChange={(e) => setForm({ ...form, related: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></select></Field>
            </>
          )}
        </div>
        <button className="btn primary" onClick={save}>Save changes</button>
      </div>
    </div>
  );
}

function AlumniNotifications({ db, update, me, myNotifs }) {
  function markRead(id) {
    update("notifications", (list) => list.map((n) => (n.id === id && !(n.readBy || []).includes(me.id) ? { ...n, readBy: [...(n.readBy || []), me.id] } : n)));
  }
  const sorted = [...myNotifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div>
      <PageHead eyebrow={`${sorted.length} total`} title="Notifications" />
      <div className="stack">
        {sorted.map((n) => {
          const isRead = (n.readBy || []).includes(me.id);
          return (
            <div className={"list-card" + (isRead ? "" : " unread")} key={n.id} onClick={() => markRead(n.id)}>
              <div className="list-card-head">
                <div className="mini-avatar gold"><Bell size={14} /></div>
                <div style={{ flex: 1 }}><div className="mini-name">{n.title}</div><div className="mini-sub">{fmtDate(n.createdAt)}</div></div>
                {!isRead && <span className="dot-unread" />}
              </div>
              <p className="list-card-text">{n.message}</p>
            </div>
          );
        })}
        {!sorted.length && <EmptyState icon={Bell} text="No notifications yet." />}
      </div>
    </div>
  );
}

function AlumniJobs({ db }) {
  const sorted = [...db.jobs].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  return (
    <div>
      <PageHead eyebrow={`${sorted.length} open`} title="Job Opportunity Board" />
      <div className="cards-grid">
        {sorted.map((j) => (
          <div className="simple-card" key={j.id}>
            <Briefcase size={18} color="#1F5D4E" />
            <div className="mini-name">{j.title}</div>
            <div className="mini-sub">{j.company} · {j.location}</div>
            <p className="list-card-text">{j.requirements}</p>
            <div className="badge-soft">Deadline: {fmtDate(j.deadline)}</div>
          </div>
        ))}
        {!sorted.length && <EmptyState icon={Briefcase} text="No job postings right now." />}
      </div>
    </div>
  );
}

function AlumniSurveys({ db, update, me, showToast }) {
  const [taking, setTaking] = useState(null);
  function submit(survey, answers) {
    update("surveys", (list) => list.map((s) => (s.id === survey.id ? { ...s, responses: [...s.responses, { id: uid("resp"), alumniId: me.id, answers, createdAt: now() }] } : s)));
    showToast("Thanks! Your response was submitted.");
    setTaking(null);
  }
  return (
    <div>
      <PageHead eyebrow="Feedback" title="Surveys" />
      <div className="cards-grid">
        {db.surveys.map((s) => {
          const done = s.responses.some((r) => r.alumniId === me.id);
          return (
            <div className="simple-card" key={s.id}>
              <ClipboardList size={18} color="#1F5D4E" />
              <div className="mini-name">{s.title}</div>
              <div className="mini-sub">{s.questions.length} questions</div>
              {done ? <span className="badge-soft">Completed</span> : <button className="link-btn small" onClick={() => setTaking(s)}>Answer survey<ChevronRight size={14} /></button>}
            </div>
          );
        })}
        {!db.surveys.length && <EmptyState icon={ClipboardList} text="No surveys available." />}
      </div>
      {taking && <SurveyTakeModal survey={taking} onClose={() => setTaking(null)} onSubmit={submit} />}
    </div>
  );
}

function SurveyTakeModal({ survey, onClose, onSubmit }) {
  const [answers, setAnswers] = useState({});
  return (
    <Modal title={survey.title} onClose={onClose} wide>
      <div className="stack">
        {survey.questions.map((q, i) => (
          <div key={q.id} className="field">
            <span>{i + 1}. {q.text}</span>
            {q.type === "text" && <textarea rows={2} value={answers[q.id] || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />}
            {q.type === "rating" && (
              <div className="rating-row">
                {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={"rate-btn" + (Number(answers[q.id]) === n ? " active" : "")} onClick={() => setAnswers({ ...answers, [q.id]: n })}>{n}</button>)}
              </div>
            )}
            {q.type === "choice" && (
              <select value={answers[q.id] || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>
                <option value="">Select…</option>
                {(q.options || []).map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSubmit(survey, answers)}>Submit response</button>
      </div>
    </Modal>
  );
}

function AlumniPosts({ db, update, me }) {
  const [draft, setDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState({});

  function addPost() {
    if (!draft.trim()) return;
    update("posts", (list) => [{ id: uid("post"), authorId: me.id, authorName: me.fullName, content: draft.trim(), createdAt: now(), likes: [], comments: [] }, ...list]);
    setDraft("");
  }
  function toggleLike(p) {
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, likes: x.likes.includes(me.id) ? x.likes.filter((id) => id !== me.id) : [...x.likes, me.id] } : x)));
  }
  function addComment(p) {
    const text = (commentDraft[p.id] || "").trim();
    if (!text) return;
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, comments: [...x.comments, { id: uid("cmt"), authorId: me.id, authorName: me.fullName, content: text, createdAt: now() }] } : x)));
    setCommentDraft({ ...commentDraft, [p.id]: "" });
  }

  const sorted = [...db.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div>
      <PageHead eyebrow="Community" title="Alumni Posts" />
      <div className="panel narrow">
        <textarea rows={3} placeholder="Share something with fellow alumni…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn primary" onClick={addPost} disabled={!draft.trim()}>Post</button>
      </div>
      <div className="stack">
        {sorted.map((p) => (
          <div className="list-card" key={p.id}>
            <div className="list-card-head">
              <div className="mini-avatar">{p.authorName[0]}</div>
              <div style={{ flex: 1 }}><div className="mini-name">{p.authorName}</div><div className="mini-sub">{fmtDate(p.createdAt)}</div></div>
            </div>
            <p className="list-card-text">{p.content}</p>
            <div className="post-actions">
              <button className={"reaction-btn" + (p.likes.includes(me.id) ? " active" : "")} onClick={() => toggleLike(p)}><ThumbsUp size={14} />{p.likes.length}</button>
              <span className="reaction-btn static"><MessageSquare size={14} />{p.comments.length}</span>
            </div>
            {!!p.comments.length && (
              <div className="comment-list">
                {p.comments.map((c) => (
                  <div className="comment-row" key={c.id}>
                    <div className="mini-avatar sm">{c.authorName[0]}</div>
                    <div><strong>{c.authorName}</strong> <span className="muted">{c.content}</span></div>
                  </div>
                ))}
              </div>
            )}
            <div className="comment-input">
              <input placeholder="Write a comment…" value={commentDraft[p.id] || ""} onChange={(e) => setCommentDraft({ ...commentDraft, [p.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addComment(p)} />
              <button className="icon-btn" onClick={() => addComment(p)}><Send size={15} /></button>
            </div>
          </div>
        ))}
        {!sorted.length && <EmptyState icon={MessageSquare} text="No posts yet. Be the first to share!" />}
      </div>
    </div>
  );
}

/* ============================== CSS ============================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');

:root{
  --ink:#16302B; --primary:#1F5D4E; --primary-d:#164138; --gold:#C9962B; --gold-d:#8A6D00;
  --paper:#F6F3EA; --paper-alt:#FFFFFF; --muted:#6B7A73; --border:#E2DCC8; --danger:#B23A34;
}
.zd-root{ font-family:'Inter',sans-serif; color:var(--ink); background:var(--paper); min-height:100vh; }
.zd-root *{ box-sizing:border-box; }
.zd-loading{ display:flex; align-items:center; justify-content:center; height:100vh; }
.loader{ display:flex; align-items:center; gap:10px; color:var(--primary); font-weight:600; }

/* ---- Auth ---- */
.auth-wrap{ display:flex; min-height:100vh; }
.auth-side{ flex:1.1; background:linear-gradient(160deg,var(--primary-d),var(--primary) 60%, #2F7864); color:#F6F3EA; display:flex; align-items:center; padding:56px; position:relative; overflow:hidden; }
.auth-side::after{ content:""; position:absolute; right:-120px; bottom:-120px; width:340px; height:340px; border-radius:50%; border:1px solid rgba(246,243,234,.18); }
.auth-side::before{ content:""; position:absolute; right:-40px; bottom:-200px; width:340px; height:340px; border-radius:50%; border:1px solid rgba(246,243,234,.12); }
.auth-side-inner{ position:relative; z-index:1; max-width:440px; }
.brand-mark{ width:52px; height:52px; border-radius:14px; background:var(--gold); color:var(--ink); display:flex; align-items:center; justify-content:center; margin-bottom:22px; }
.brand-mark.small{ width:34px; height:34px; border-radius:10px; }
.auth-side h1{ font-family:'Fraunces',serif; font-weight:600; font-size:2.15rem; line-height:1.15; margin:0 0 16px; }
.auth-side p{ color:#DDEAE4; line-height:1.6; margin:0 0 22px; }
.side-list{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
.side-list li{ font-size:.85rem; color:#CFE3DA; padding-left:16px; position:relative; }
.side-list li::before{ content:""; position:absolute; left:0; top:7px; width:6px; height:6px; border-radius:50%; background:var(--gold); }
.auth-form-side{ flex:1; display:flex; align-items:center; justify-content:center; padding:40px; }
.auth-card{ width:100%; max-width:400px; }
.auth-card.wide{ max-width:560px; }
.auth-card h2{ font-family:'Fraunces',serif; font-size:1.6rem; margin:10px 0 4px; }
.auth-error{ display:flex; align-items:center; gap:8px; background:#FBEAE8; color:var(--danger); border:1px solid #F0C7C2; padding:10px 12px; border-radius:10px; font-size:.85rem; margin-bottom:14px; }
.pw-wrap{ position:relative; }
.pw-eye{ position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--muted); cursor:pointer; }
.link-btn{ background:none; border:none; color:var(--primary); font-weight:600; cursor:pointer; margin-top:14px; font-size:.86rem; display:flex; align-items:center; gap:2px; }
.link-btn.small{ margin-top:8px; font-size:.8rem; }
.demo-hint{ margin-top:18px; font-size:.72rem; color:var(--muted); background:var(--paper); border:1px dashed var(--border); border-radius:8px; padding:8px 10px; }
.brand-mark.small.solo{ margin-bottom:10px; }

/* ---- Landing / Home page ---- */
.landing{ min-height:100vh; display:flex; flex-direction:column; }
.top-nav{ display:flex; align-items:center; justify-content:space-between; padding:16px 36px; border-bottom:1px solid var(--border); background:var(--paper-alt); position:sticky; top:0; z-index:10; }
.top-nav-brand{ display:flex; align-items:center; gap:10px; }
.top-nav-actions{ display:flex; gap:10px; }
.landing-hero{ flex:1; display:flex; align-items:center; gap:48px; padding:56px 64px; max-width:1280px; margin:0 auto; width:100%; flex-wrap:wrap; }
.landing-hero-copy{ flex:1.2; min-width:320px; }
.landing-hero-copy h1{ font-family:'Fraunces',serif; font-weight:600; font-size:2.6rem; line-height:1.15; margin:10px 0 16px; color:var(--ink); }
.landing-hero-copy > p{ color:var(--muted); line-height:1.6; margin:0 0 18px; max-width:520px; }
.side-list.dark li{ color:var(--muted); }
.side-list.dark li::before{ background:var(--primary); }
.landing-hero-panel{ flex:0.8; min-width:240px; display:flex; flex-direction:column; gap:14px; }
.landing-stat{ display:flex; align-items:center; gap:14px; background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; padding:16px 18px; color:var(--primary); }
.landing-stat div{ display:flex; flex-direction:column; color:var(--ink); }
.landing-stat strong{ font-family:'Fraunces',serif; font-size:1.15rem; }
.landing-stat span{ font-size:.76rem; color:var(--muted); }
.landing-foot{ text-align:center; padding:18px; font-size:.76rem; color:var(--muted); border-top:1px solid var(--border); }

/* ---- Admin status pill ---- */
.admin-status{ font-size:.72rem; font-weight:700; padding:3px 9px; border-radius:20px; }
.admin-status.on{ color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, white); }
.admin-status.off{ color:var(--danger); background:#FBEAE8; }

/* ---- Shell / Sidebar ---- */
.shell{ display:flex; min-height:100vh; }
.sidebar{ width:246px; background:var(--paper-alt); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:20px 14px; position:sticky; top:0; height:100vh; }
.sidebar-brand{ display:flex; align-items:center; gap:10px; padding:6px 8px 20px; }
.brand-title{ font-family:'Fraunces',serif; font-weight:700; font-size:1rem; }
.brand-sub{ font-size:.7rem; color:var(--muted); }
.side-nav{ display:flex; flex-direction:column; gap:2px; flex:1; }
.side-item{ display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; background:none; border:none; text-align:left; font-size:.86rem; color:var(--ink); cursor:pointer; font-weight:500; }
.side-item:hover{ background:var(--paper); }
.side-item.active{ background:var(--primary); color:#fff; }
.side-badge{ margin-left:auto; background:var(--gold); color:var(--ink); font-size:.68rem; font-weight:700; padding:1px 7px; border-radius:20px; }
.side-item.active .side-badge{ background:#fff; color:var(--primary); }
.sidebar-foot{ border-top:1px solid var(--border); padding-top:12px; margin-top:8px; }
.person{ display:flex; align-items:center; gap:9px; padding:4px 8px 10px; }
.person-name{ font-size:.83rem; font-weight:600; }
.person-role{ font-size:.72rem; color:var(--muted); }
.avatar{ width:34px; height:34px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.85rem; flex-shrink:0; }
.avatar.lg{ width:52px; height:52px; font-size:1.2rem; }
.logout-btn{ width:100%; display:flex; align-items:center; gap:8px; justify-content:center; padding:8px; border-radius:9px; border:1px solid var(--border); background:none; cursor:pointer; font-size:.82rem; font-weight:600; color:var(--ink); }
.logout-btn:hover{ background:var(--paper); }

.main{ flex:1; padding:32px 36px; max-width:1180px; }
.page-head{ display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:22px; gap:12px; flex-wrap:wrap; }
.eyebrow{ font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; color:var(--gold-d); font-weight:700; margin-bottom:4px; }
.page-head h1{ font-family:'Fraunces',serif; font-size:1.65rem; margin:0; }

/* ---- Stat cards ---- */
.stat-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:24px; }
.stat-card{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; padding:16px; position:relative; overflow:hidden; }
.stat-ribbon{ position:absolute; top:0; left:0; width:100%; height:4px; background:var(--primary); }
.stat-top{ display:flex; align-items:center; gap:7px; color:var(--muted); font-size:.78rem; font-weight:600; margin-bottom:10px; }
.stat-value{ font-family:'Fraunces',serif; font-size:1.7rem; font-weight:600; }

/* ---- Panels / grids ---- */
.grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.panel{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; padding:18px; }
.panel.narrow{ max-width:640px; }
.panel h3{ margin:0 0 12px; font-family:'Fraunces',serif; font-size:1rem; }
.panel h3.mt{ margin-top:18px; }
.panel-head-row{ display:flex; align-items:center; justify-content:space-between; }
.mt{ margin-top:18px; }
.section-title{ font-family:'Fraunces',serif; font-size:.95rem; margin:18px 0 10px; color:var(--primary-d); }

/* ---- Filter bar / search ---- */
.filter-bar{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
.filter-bar select{ padding:8px 10px; border-radius:9px; border:1px solid var(--border); background:var(--paper-alt); font-size:.82rem; }
.search-box{ display:flex; align-items:center; gap:7px; border:1px solid var(--border); border-radius:9px; padding:8px 12px; background:var(--paper-alt); flex:1; min-width:200px; color:var(--muted); }
.search-box input{ border:none; outline:none; font-size:.85rem; width:100%; background:none; }

/* ---- Table ---- */
.table-wrap{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
table{ width:100%; border-collapse:collapse; font-size:.84rem; }
thead tr{ background:var(--paper); }
th{ text-align:left; padding:11px 14px; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); font-weight:700; }
td{ padding:11px 14px; border-top:1px solid var(--border); vertical-align:middle; }
.cell-name{ display:flex; align-items:center; gap:9px; font-weight:600; }
.row-actions{ display:flex; gap:6px; }

/* ---- Badges / tags ---- */
.seal{ display:inline-flex; align-items:center; gap:5px; font-size:.72rem; font-weight:700; color:var(--seal-c); }
.seal-dot{ width:7px; height:7px; border-radius:50%; background:var(--seal-c); }
.emp-tag{ display:inline-flex; align-items:center; font-size:.72rem; font-weight:700; color:var(--tag-c); background:color-mix(in srgb, var(--tag-c) 12%, white); padding:3px 9px; border-radius:20px; }
.badge-soft{ display:inline-block; font-size:.72rem; font-weight:600; background:var(--paper); border:1px solid var(--border); padding:3px 9px; border-radius:20px; color:var(--muted); margin-top:6px; }

/* ---- Buttons ---- */
.btn{ display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:10px; font-size:.85rem; font-weight:600; cursor:pointer; border:1px solid transparent; }
.btn.primary{ background:var(--primary); color:#fff; }
.btn.primary:hover{ background:var(--primary-d); }
.btn.primary:disabled{ opacity:.5; cursor:not-allowed; }
.btn.ghost{ background:var(--paper-alt); border:1px solid var(--border); color:var(--ink); }
.btn.ghost:hover{ background:var(--paper); }
.btn.danger{ background:var(--danger); color:#fff; }
.btn.danger.outline{ background:none; border:1px solid var(--danger); color:var(--danger); }
.btn.block{ width:100%; justify-content:center; margin-top:6px; }
.icon-btn{ background:none; border:1px solid var(--border); border-radius:8px; padding:6px; cursor:pointer; color:var(--ink); display:inline-flex; }
.icon-btn:hover{ background:var(--paper); }
.icon-btn.danger{ color:var(--danger); border-color:#F0C7C2; }
.row-gap{ display:flex; gap:10px; }

/* ---- Forms ---- */
.field{ display:flex; flex-direction:column; gap:6px; font-size:.8rem; font-weight:600; color:var(--ink); margin-bottom:12px; }
.field input, .field select, .field textarea{ font-family:'Inter',sans-serif; font-weight:400; padding:9px 11px; border-radius:9px; border:1px solid var(--border); font-size:.86rem; background:var(--paper-alt); }
.field textarea{ resize:vertical; font-family:'IBM Plex Mono',monospace; font-size:.78rem; line-height:1.5; }
.field input:disabled{ background:var(--paper); color:var(--muted); }
.tab-toggle{ display:inline-flex; border:1px solid var(--border); border-radius:10px; padding:3px; gap:3px; background:var(--paper-alt); }
.tab-toggle button{ border:none; background:transparent; padding:7px 14px; border-radius:7px; font-size:.8rem; font-weight:600; color:var(--muted); cursor:pointer; font-family:'Inter',sans-serif; }
.tab-toggle button.active{ background:var(--primary); color:#fff; }
kbd{ font-family:'IBM Plex Mono',monospace; font-size:.72rem; background:var(--paper); border:1px solid var(--border); border-bottom-width:2px; border-radius:5px; padding:1px 5px; }
.form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:0 14px; }

/* ---- Modal ---- */
.modal-backdrop{ position:fixed; inset:0; background:rgba(22,48,43,.45); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; }
.modal{ background:var(--paper-alt); border-radius:16px; width:460px; max-width:100%; max-height:88vh; overflow-y:auto; }
.modal.modal-wide{ width:640px; }
.modal-head{ display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid var(--border); }
.modal-head h3{ margin:0; font-family:'Fraunces',serif; font-size:1.1rem; }
.modal-body{ padding:20px; }
.modal-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }

/* ---- Verification cards ---- */
.verify-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; margin-bottom:10px; }
.verify-card{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; padding:16px; }
.verify-top{ display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.verify-details{ display:flex; flex-direction:column; gap:7px; font-size:.78rem; color:var(--muted); margin-bottom:14px; }
.verify-details div{ display:flex; align-items:center; gap:7px; }
.verify-actions{ display:flex; gap:8px; }
.verify-actions .btn{ flex:1; justify-content:center; }

/* ---- Mini list ---- */
.mini-list{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
.mini-list li{ display:flex; align-items:center; gap:10px; }
.mini-avatar{ width:32px; height:32px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.78rem; flex-shrink:0; }
.mini-avatar.gold{ background:var(--gold); color:var(--ink); }
.mini-avatar.lg{ width:44px; height:44px; font-size:.95rem; }
.mini-avatar.sm{ width:24px; height:24px; font-size:.68rem; }
.mini-info{ flex:1; }
.mini-name{ font-weight:700; font-size:.86rem; }
.mini-sub{ font-size:.76rem; color:var(--muted); }

/* ---- Cards grid ---- */
.cards-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; }
.simple-card{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:6px; }
.job-card-head{ display:flex; align-items:center; justify-content:space-between; }

/* ---- Stack / list cards ---- */
.stack{ display:flex; flex-direction:column; gap:12px; }
.list-card{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; padding:15px 16px; }
.list-card.unread{ border-color:var(--gold); background:#FFFBF1; cursor:pointer; }
.list-card-head{ display:flex; align-items:center; gap:10px; }
.list-card-text{ font-size:.85rem; color:var(--ink); margin:8px 0 0; line-height:1.5; }
.dot-unread{ width:8px; height:8px; border-radius:50%; background:var(--gold); }
.post-meta{ display:flex; align-items:center; gap:5px; font-size:.78rem; color:var(--muted); margin-top:10px; }
.post-meta svg{ margin-right:5px; }
.post-actions{ display:flex; gap:10px; margin-top:10px; }
.reaction-btn{ display:flex; align-items:center; gap:6px; border:1px solid var(--border); background:var(--paper-alt); border-radius:20px; padding:5px 12px; font-size:.78rem; font-weight:600; cursor:pointer; color:var(--ink); }
.reaction-btn.active{ background:var(--primary); color:#fff; border-color:var(--primary); }
.reaction-btn.static{ cursor:default; }
.comment-list{ margin-top:10px; padding-top:10px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:8px; }
.comment-row{ display:flex; align-items:center; gap:8px; font-size:.8rem; }
.comment-input{ display:flex; gap:8px; margin-top:10px; }
.comment-input input{ flex:1; padding:8px 12px; border-radius:20px; border:1px solid var(--border); font-size:.82rem; }

/* ---- Survey builder ---- */
.qbuilder-row{ display:flex; align-items:flex-start; gap:10px; }
.qnum{ width:24px; height:24px; border-radius:50%; background:var(--paper); display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:700; color:var(--primary); flex-shrink:0; margin-top:8px; }
.qbuilder-row input{ width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--border); font-size:.85rem; margin-bottom:6px; }
.qbuilder-sub{ display:flex; gap:8px; }
.qbuilder-sub select{ padding:7px 9px; border-radius:8px; border:1px solid var(--border); font-size:.8rem; }
.rating-row{ display:flex; gap:8px; }
.rate-btn{ width:36px; height:36px; border-radius:9px; border:1px solid var(--border); background:var(--paper-alt); font-weight:700; cursor:pointer; }
.rate-btn.active{ background:var(--primary); color:#fff; border-color:var(--primary); }
.tally{ display:flex; flex-direction:column; gap:8px; }
.tally-row{ display:grid; grid-template-columns:90px 1fr 24px; align-items:center; gap:10px; font-size:.8rem; }
.tally-bar{ height:8px; background:var(--paper); border-radius:6px; overflow:hidden; }
.tally-bar div{ height:100%; background:var(--primary); }

.profile-hero{ display:flex; align-items:center; gap:14px; margin-bottom:10px; }
.profile-rows{ display:flex; flex-direction:column; gap:8px; font-size:.83rem; color:var(--ink); margin-bottom:10px; }
.profile-rows div{ display:flex; align-items:center; gap:8px; }

.empty-state{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:36px 10px; color:var(--muted); text-align:center; font-size:.85rem; }

.toast{ position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:11px 20px; border-radius:30px; font-size:.85rem; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.18); z-index:100; }

@media (max-width: 900px){
  .auth-side{ display:none; }
  .top-nav{ padding:14px 18px; }
  .top-nav-brand div:last-child .brand-sub{ display:block; }
  .landing-hero{ padding:32px 20px; }
  .landing-hero-copy h1{ font-size:1.9rem; }
  .sidebar{ width:78px; }
  .sidebar-brand div, .side-item span, .person-name, .person-role, .brand-sub{ display:none; }
  .side-item{ justify-content:center; }
  .grid-2{ grid-template-columns:1fr; }
  .form-grid{ grid-template-columns:1fr; }
  .main{ padding:22px 16px; }
}
`;
