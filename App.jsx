import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, ShieldCheck, Briefcase, Bell, ClipboardList,
  MessageSquare, BarChart3, LogOut, Search, Plus, X, Check, Trash2,
  Edit2, Building2, GraduationCap, Mail, Phone, MapPin, Filter,
  ThumbsUp, Send, Printer, Download, ChevronRight, AlertCircle,
  UserCheck, UserX, Clock, Eye, EyeOff, ArrowLeft, FileSpreadsheet,
  UserCog, KeyRound, History, Home, LogIn, Lock, Power, Upload, FileText,
  CalendarDays, Contact, Heart, MessageCircle, Bookmark, Image as ImageIcon, Settings as SettingsIcon
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from "recharts";

/* ============================== CONSTANTS ============================== */

const CAMPUSES = [
  "Aurora Campus",
  "Pagadian Campus",
  "Josefina Campus",
  "Midsalip Campus",
  "Tambulig Campus",
  "Tukuran Campus",
  "Mahayag Campus",
  "Ramon Magsaysay Campus",
  "Dimataling Campus",
  "Vincenzo Sagun Campus",
  "Lapuyan Campus",
  "Tigbao Campus",
  "Molave Campus",
  "Margosatubig Campus",
  "Sominot Campus",
  "Labangan Campus",
  "Dinas Campus",
  "San Pablo Campus",
  "Dumalinao Campus",
  "Tabina Campus",
];

const COURSES = [
  "BS Agriculture",
  "Bachelor of Physical Education",
  "Bachelor of Technical-Vocational Teacher Education",
  "BS Information Systems",
  "BS Information Technology",
  "BS Business Administration",
  "BS Hospitality Management",
  "BS Criminology",
  "Bachelor of Elementary Education",
  "Bachelor of Secondary Education",
  "BTVTEd major in Computer Hardware Servicing",
  "BS Office Administration",
];

const GRAD_YEARS = Array.from({ length: 12 }, (_, i) => String(2014 + i));

const YN = ["Yes", "No"];

// Annex A data fields. Everything here is saved in the alumni row's `profile` column (jsonb).
// Name, campus, course, graduation year, email, phone, address and the basic employment
// block keep using their existing columns, so nothing already in your database changes.
const ANNEX = [
  { cat: "Identity", fields: [
    ["studentNo", "Student number"], ["middleName", "Middle name"], ["suffix", "Suffix (Jr., III)"],
    ["sex", "Sex", ["Female", "Male"]], ["dob", "Date of birth", "date"], ["pob", "Place of birth"],
    ["civil", "Civil status", ["Single", "Married", "Widowed", "Separated"]], ["nationality", "Nationality"],
  ] },
  { cat: "Contact", fields: [
    ["permAddress", "Permanent address"], ["social", "Social media links"], ["emergency", "Emergency contact (optional)"],
  ] },
  { cat: "Academic", fields: [
    ["major", "Program major"], ["yearAdmitted", "Year admitted"], ["honors", "Honors received"],
    ["scholarships", "Scholarships"], ["orgs", "Organizations / awards"],
  ] },
  { cat: "Employment (more details)", fields: [
    ["empType", "Employment type", ["Regular", "Contractual", "Part-time", "Freelance", "Government", "Private"]],
    ["industry", "Industry"], ["workAbroad", "Work location type", ["Local", "Abroad"]],
    ["furtherStudy", "Pursuing further studies?", YN], ["prevEmployer", "Previous employer (optional)"],
    ["incomeRange", "Monthly income range (optional)", ["Below \u20B110,000", "\u20B110,000\u201319,999", "\u20B120,000\u201329,999", "\u20B130,000\u201349,999", "\u20B150,000 and above"]],
  ] },
  { cat: "Further Studies & Licensure", fields: [
    ["fsSchool", "School"], ["fsProgram", "Degree / program"], ["fsYear", "Year"],
    ["exam", "Board / civil service exam taken"], ["examDate", "Exam date", "date"], ["examRating", "Rating"], ["licenseNo", "License number"],
  ] },
  { cat: "Alumni Engagement", fields: [
    ["assoc", "Alumni association member?", YN], ["eventsAttended", "Events attended (homecomings, seminars)"],
    ["mentor", "Willing to mentor or speak?", YN], ["donate", "Willing to donate?", YN],
    ["achievements", "Achievements after graduation", "area"],
  ] },
  { cat: "Tracer Study & Feedback", fields: [
    ["skillsUsed", "Skills from college used at work", "area"], ["relevance", "Program relevance to your work (1-5)", ["1", "2", "3", "4", "5"]],
    ["suggestions", "Suggestions for the college", "area"],
    ["timeToJob", "Time to first job after graduation", ["Less than 1 month", "1\u20133 months", "4\u20136 months", "7\u201312 months", "More than 1 year", "Not yet employed"]],
  ] },
];

const EMP_COLORS = { Employed: "#1F5D4E", "Self-Employed": "#C9962B", Unemployed: "#B23A34" };

const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const now = () => new Date().toISOString();

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

// Tiny safe wrapper so a blocked/full localStorage never crashes the app.
const ls = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : fmtDate(iso);
};

// Shrinks a chosen photo before it is saved with a post, so the database stays small.
function compressImage(file, maxSide = 720, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

// Compares a pending registration against the official graduate list (the `roster` table).
function matchRoster(a, roster) {
  const no = norm(a.profile?.studentNo);
  let r = no ? roster.find((x) => norm(x.studentNo) === no) : null;
  if (!r) r = roster.find((x) => norm(x.fullName) === norm(a.fullName) && norm(x.course) === norm(a.course));
  if (!r) return { level: "none" };
  const same = norm(r.fullName) === norm(a.fullName) && norm(r.course) === norm(a.course)
    && String(r.gradYear) === String(a.gradYear) && norm(r.campus) === norm(a.campus);
  return { level: same ? "ok" : "warn", record: r };
}

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
    "Juan Dela Cruz", "name@email.com", CAMPUSES[0], COURSES[0], GRAD_YEARS[GRAD_YEARS.length - 1],
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

/* ============================== STORAGE (Supabase) ============================== */

const KEYS = ["users", "alumni", "notifications", "posts", "surveys", "jobs", "logs", "roster", "settings", "events", "requests"];
// Tables the app can live without if they have not been created yet.
const OPTIONAL_KEYS = ["roster", "settings", "events", "requests"];

// Fill these in with your Supabase Project URL and Publishable ("anon") key,
// found under Project Settings \u2192 API Keys. The publishable key is safe to
// ship in a browser app \u2014 never put the secret key here.
const SUPABASE_URL = "https://xafclckrouxgjumwypct.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6fYTCdyMwGT0vwV9pnDh3Q_kGXiK1YX";

// Converts between the app's camelCase JS objects and the database's
// snake_case columns, one converter pair per table.
const ROW = {
  users: {
    toRow: (u) => ({ id: u.id, email: u.email, username: u.username ?? null, password: u.password, role: u.role, name: u.name, campus: u.campus ?? null, status: u.status ?? "active", alumni_id: u.alumniId ?? null, created_at: u.createdAt }),
    fromRow: (r) => ({ id: r.id, email: r.email, username: r.username, password: r.password, role: r.role, name: r.name, campus: r.campus, status: r.status, alumniId: r.alumni_id, createdAt: r.created_at }),
  },
  alumni: {
    toRow: (a) => ({ id: a.id, full_name: a.fullName, campus: a.campus, course: a.course, grad_year: a.gradYear, email: a.email, phone: a.phone ?? null, address: a.address ?? null, employment: a.employment ?? {}, profile: a.profile ?? {}, account_status: a.accountStatus ?? "pending", created_at: a.createdAt, updated_at: a.updatedAt }),
    fromRow: (r) => ({ id: r.id, fullName: r.full_name, campus: r.campus, course: r.course, gradYear: r.grad_year, email: r.email, phone: r.phone, address: r.address, employment: r.employment, profile: r.profile || {}, accountStatus: r.account_status, createdAt: r.created_at, updatedAt: r.updated_at }),
  },
  notifications: {
    toRow: (n) => ({ id: n.id, title: n.title, message: n.message, audience: n.audience, read_by: n.readBy ?? [], created_at: n.createdAt }),
    fromRow: (r) => ({ id: r.id, title: r.title, message: r.message, audience: r.audience, readBy: r.read_by, createdAt: r.created_at }),
  },
  posts: {
    toRow: (p) => ({ id: p.id, author_id: p.authorId, author_name: p.authorName, content: p.content, likes: p.likes ?? [], comments: p.comments ?? [], image: p.image ?? null, saved_by: p.savedBy ?? [], created_at: p.createdAt }),
    fromRow: (r) => ({ id: r.id, authorId: r.author_id, authorName: r.author_name, content: r.content, likes: r.likes || [], comments: r.comments || [], image: r.image || null, savedBy: r.saved_by || [], createdAt: r.created_at }),
  },
  surveys: {
    toRow: (s) => ({ id: s.id, title: s.title, questions: s.questions ?? [], responses: s.responses ?? [], created_at: s.createdAt }),
    fromRow: (r) => ({ id: r.id, title: r.title, questions: r.questions, responses: r.responses, createdAt: r.created_at }),
  },
  jobs: {
    toRow: (j) => ({ id: j.id, title: j.title, company: j.company, requirements: j.requirements ?? null, location: j.location ?? null, deadline: j.deadline ?? null, posted_at: j.postedAt }),
    fromRow: (r) => ({ id: r.id, title: r.title, company: r.company, requirements: r.requirements, location: r.location, deadline: r.deadline, postedAt: r.posted_at }),
  },
  settings: {
    toRow: (r) => ({ id: r.id, value: r.value ?? {}, created_at: r.createdAt ?? now() }),
    fromRow: (r) => ({ id: r.id, value: r.value || {}, createdAt: r.created_at }),
  },
  roster: {
    toRow: (r) => ({ id: r.id, student_no: r.studentNo, full_name: r.fullName, campus: r.campus ?? null, course: r.course ?? null, grad_year: r.gradYear ?? null, created_at: r.createdAt }),
    fromRow: (r) => ({ id: r.id, studentNo: r.student_no, fullName: r.full_name, campus: r.campus, course: r.course, gradYear: r.grad_year, createdAt: r.created_at }),
  },
  requests: {
    toRow: (r) => ({ id: r.id, kind: r.kind, type: r.type ?? null, details: r.details ?? null, alumni_id: r.alumniId, alumni_name: r.alumniName ?? null, campus: r.campus ?? null, target_id: r.targetId ?? null, status: r.status ?? "Pending", note: r.note ?? null, created_at: r.createdAt, updated_at: r.updatedAt }),
    fromRow: (r) => ({ id: r.id, kind: r.kind, type: r.type, details: r.details, alumniId: r.alumni_id, alumniName: r.alumni_name, campus: r.campus, targetId: r.target_id, status: r.status, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at }),
  },
  events: {
    toRow: (e) => ({ id: e.id, title: e.title, description: e.description ?? null, location: e.location ?? null, event_date: e.date ?? null, event_time: e.time ?? null, campus: e.campus ?? "All campuses", rsvps: e.rsvps ?? [], created_at: e.createdAt }),
    fromRow: (r) => ({ id: r.id, title: r.title, description: r.description, location: r.location, date: r.event_date, time: r.event_time, campus: r.campus || "All campuses", rsvps: r.rsvps || [], createdAt: r.created_at }),
  },
  logs: {
    toRow: (l) => ({ id: l.id, ts: l.ts, actor: l.actor, action: l.action, detail: l.detail ?? null }),
    fromRow: (r) => ({ id: r.id, ts: r.ts, actor: r.actor, action: r.action, detail: r.detail }),
  },
};

// Talks to Supabase's auto-generated REST API (PostgREST) directly via fetch \u2014
// no extra npm package required. Uses the publishable key, which only works
// because Row Level Security was left off for these tables during setup.
async function sbFetch(path, options = {}) {
  // A request that never answers (weak signal, sleeping phone) must not freeze live updates
  // or saving forever, so every call gives up after 20 seconds and the app tries again.
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const killer = ctl ? setTimeout(() => ctl.abort(), 20000) : null;
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    ...(ctl ? { signal: ctl.signal } : {}),
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  } finally { if (killer) clearTimeout(killer); }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase request failed (${res.status}): ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const SORT_COL = { jobs: "posted_at", logs: "ts" };
async function loadTable(k) {
  let rows;
  try { rows = await sbFetch(`${k}?select=*&order=${SORT_COL[k] || "created_at"}.asc`, { method: "GET" }); }
  catch (e) {
    // A 400 means the sort column does not exist in this table. Read it unsorted instead of showing nothing.
    if (!/\(400\)/.test(String(e && e.message))) throw e;
    rows = await sbFetch(`${k}?select=*`, { method: "GET" });
    rows = [...(rows || [])].sort((a, b) => String(a.created_at || a.posted_at || a.ts || "").localeCompare(String(b.created_at || b.posted_at || b.ts || "")));
  }
  return (rows || []).map(ROW[k].fromRow);
}

// Reads every table. A table that fails to load is simply left out of the result, so a
// short network hiccup can never make the app think a table is empty.
const loadErrors = {};
async function fetchLatest() {
  const out = {};
  await Promise.all(KEYS.map(async (k) => {
    try { out[k] = await loadTable(k); delete loadErrors[k]; }
    catch (e) { loadErrors[k] = String(e && e.message ? e.message : e).slice(0, 160); console.error("Supabase load error:", k, e); if (OPTIONAL_KEYS.includes(k) && /\(404\)/.test(String(e && e.message))) out[k] = []; }
  }));
  return out;
}

async function upsertAll(key, arr) {
  if (!arr.length) return;
  await sbFetch(`${key}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(arr.map(ROW[key].toRow)),
  });
}

async function loadStore() {
  const out = await fetchLatest();
  // Without the people and alumni tables the app cannot work safely (and must never offer
  // first-time setup by mistake), so report "unreachable" instead.
  if (!out.users || !out.alumni) throw new Error("Could not load the users/alumni tables");
  for (const k of KEYS) if (!out[k]) out[k] = [];
  return out;
}

// Saves ONLY what changed: rows that were added/edited are upserted and rows that were
// removed are deleted by id. (The old version re-sent the whole list and deleted every row
// it did not know about, which wiped out registrations made on other devices.)
let inflight = 0;
let onPersistError = () => {};
const writeQueue = {};
function persistDiff(key, prevArr, nextArr) {
  const conv = ROW[key];
  const prevMap = new Map(prevArr.map((r) => [r.id, JSON.stringify(r)]));
  const changed = nextArr.filter((r) => prevMap.get(r.id) !== JSON.stringify(r));
  const nextIds = new Set(nextArr.map((r) => r.id));
  const removed = prevArr.filter((r) => !nextIds.has(r.id)).map((r) => r.id);
  if (!changed.length && !removed.length) return Promise.resolve(true);
  inflight++;
  const job = (writeQueue[key] || Promise.resolve()).then(async () => {
    try {
      if (changed.length) {
        await sbFetch(`${key}?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(changed.map(conv.toRow)),
        });
      }
      if (removed.length) await sbFetch(`${key}?id=in.(${removed.join(",")})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return true;
    } catch (e) {
      console.error("Supabase persist error:", key, e);
      onPersistError();
      return false;
    } finally { inflight--; }
  });
  writeQueue[key] = job;
  return job; // resolves true when saved, false when the server refused it
}

/* ============================== COMMUNITY HELPERS ============================== */
const POST_TAGS = [
  { id: "achievement", label: "Achievement", emoji: "\u{1F3C6}", color: "#C9962B", prompt: "What did you achieve? A promotion, an award, a board exam pass\u2026" },
  { id: "job", label: "Job lead", emoji: "\u{1F4BC}", color: "#1F5D4E", prompt: "Share an opening: company, role and how to apply\u2026" },
  { id: "question", label: "Question", emoji: "\u2753", color: "#2F6F8F", prompt: "Ask the alumni community anything\u2026" },
  { id: "event", label: "Meetup", emoji: "\u{1F4C5}", color: "#8A5A9E", prompt: "Tell people about a gathering, seminar or reunion\u2026" },
  { id: "story", label: "Memory", emoji: "\u2728", color: "#B23A34", prompt: "Share a memory or a lesson from your ZDSPGC days\u2026" },
];
const REACTS = [["clap", "\u{1F44F}"], ["celebrate", "\u{1F389}"], ["idea", "\u{1F4A1}"], ["wow", "\u{1F62E}"]];
const REACT_EMOJI = { like: "\u2764\uFE0F", clap: "\u{1F44F}", celebrate: "\u{1F389}", idea: "\u{1F4A1}", wow: "\u{1F62E}" };
const QUICK_EMOJI = ["\u{1F600}", "\u{1F389}", "\u{1F64F}", "\u{1F4AA}", "\u2764\uFE0F", "\u{1F393}"];
const POST_MAX = 500;
// A post's topic is stored as a "[tag] " prefix on its text, so no database change is needed.
const parsePost = (c) => { const m = /^\[(\w+)\]\s*/.exec(c || ""); const tag = m ? POST_TAGS.find((t) => t.id === m[1]) : null; return tag ? { tag, text: c.slice(m[0].length) } : { tag: null, text: c || "" }; };
// Reactions live in the same list as likes: "id" = heart, "id~clap" = another reaction.
const reactionOf = (p, id) => { for (const e of p.likes || []) { if (e === id) return "like"; if (e.startsWith(id + "~")) return e.slice(id.length + 1); } return null; };
const reactionCounts = (p) => { const o = {}; (p.likes || []).forEach((e) => { const k = e.includes("~") ? e.split("~").pop() : "like"; o[k] = (o[k] || 0) + 1; }); return o; };
const withReaction = (likes, id, key) => { const base = (likes || []).filter((e) => e !== id && !e.startsWith(id + "~")); return key ? [...base, key === "like" ? id : `${id}~${key}`] : base; };
const postScore = (p) => (p.likes || []).length + (p.comments || []).length * 2;

/* ============================== SMALL UI PARTS ============================== */

// Profile photo when there is one, otherwise the first letter of the name.
function Avatar({ src, name, className = "mini-avatar" }) {
  return <div className={className + (src ? " has-img" : "")}>{src ? <img src={src} alt="" /> : (name || "?")[0]}</div>;
}
const photoOf = (db, id) => (db.alumni.find((a) => a.id === id)?.profile?.photo) || "";
const isStaff = (db, id) => db.users.some((u) => u.id === id && u.role !== "alumni");

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

function AppInner() {
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const dbRef = useRef(null);
  // The login is remembered in this browser, so refreshing the page keeps you signed in.
  const readTmp = () => { try { return window.sessionStorage.getItem("zd_session_tmp"); } catch { return null; } };
  const [session, setSession] = useState(() => { try { return JSON.parse(ls.get("zd_session") || readTmp() || "null"); } catch { return null; } }); // {userId, role}
  // "Keep me signed in" ticked = remembered after the browser closes; unticked = only until it closes.
  const keepRef = useRef(!(ls.get("zd_session") == null && readTmp() != null));
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // Per-device preferences (text size, auto sign-out, ...). Kept in this browser only.
  const [prefs, setPrefsState] = useState(() => { try { return { ...DEFAULT_PREFS, ...JSON.parse(ls.get("zd_prefs") || "{}") }; } catch { return DEFAULT_PREFS; } });
  const setPrefs = useCallback((patch) => setPrefsState((p) => { const n = { ...p, ...patch }; ls.set("zd_prefs", JSON.stringify(n)); return n; }), []);
  // "page" only controls what unauthenticated visitors see (landing / alumni auth / admin
  // login / admin forgot-password). It never grants access by itself — every dashboard
  // below is gated on a verified `session` + the matching role on the stored user record,
  // so typing a dashboard "tab" name directly can't skip login or role verification.
  const [page, setPage] = useState(() => {
    const h = window.location.hash.replace(/^#\/?/, "");
    return h === "login" ? "alumniAuth" : h === "admin-login" ? "adminLogin" : h === "forgot" ? "adminForgot" : "landing";
  }); // landing | alumniAuth | adminLogin | adminForgot
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authError, setAuthError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace(/^#\/?/, "");
    return h && !["login", "admin-login", "forgot"].includes(h) ? h : (ls.get("zd_tab") || "dashboard");
  });
  const [toast, setToast] = useState(null);
  const [syncBad, setSyncBad] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { const d = await loadStore(); if (!cancelled) { dbRef.current = d; setDb(d); } }
      catch (e) { console.error(e); if (!cancelled) setLoadError(true); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Reads the latest data from a ref (not a stale closure) so several updates in one click
  // stack up correctly, then saves only the rows that changed.
  const update = useCallback((key, updater) => {
    const prevArr = dbRef.current[key];
    const nextArr = updater(prevArr);
    dbRef.current = { ...dbRef.current, [key]: nextArr };
    setDb(dbRef.current);
    return persistDiff(key, prevArr, nextArr);
  }, []);

  useEffect(() => { onPersistError = () => showToast("Could not save to the server. Check your connection. If it keeps happening, the database update (SQL file) may not have been run yet."); }, [showToast]);

  // Live updates: pull fresh data every 10 seconds and whenever the tab is focused, so a new
  // registration or an approval made on another device appears without a manual refresh.
  useEffect(() => {
    if (loading) return undefined;
    let busy = false;
    const refresh = async () => {
      if (busy || document.hidden || inflight > 0) return;
      busy = true;
      try {
        const fresh = await fetchLatest();
        setSyncBad((p) => { const n = Object.keys(loadErrors); return p.join() === n.join() ? p : n; });
        if (inflight > 0) return;
        const cur = dbRef.current;
        const next = { ...cur };
        let changed = false;
        for (const k of KEYS) {
          if (fresh[k] && JSON.stringify(fresh[k]) !== JSON.stringify(cur[k])) { next[k] = fresh[k]; changed = true; }
        }
        if (changed) { dbRef.current = next; setDb(next); }
      } finally { busy = false; }
    };
    const timer = setInterval(refresh, Math.max(5, prefs.refreshSec || 10) * 1000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", refresh); };
  }, [loading, prefs.refreshSec]);

  useEffect(() => { document.documentElement.style.fontSize = { normal: "100%", large: "112.5%", xlarge: "125%" }[prefs.textSize] || "100%"; }, [prefs.textSize]);

  // Optional auto sign-out after a period of no activity.
  useEffect(() => {
    if (!session || !prefs.autoLogout) return undefined;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const evs = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last > prefs.autoLogout * 60000) {
        setSession(null); setPage("landing"); setAuthMode("login");
        showToast("You were signed out because you were inactive.");
      }
    }, 15000);
    return () => { clearInterval(timer); evs.forEach((e) => window.removeEventListener(e, bump)); };
  }, [session, prefs.autoLogout, showToast]);

  // Remember where you are: session + current page live in localStorage and the URL hash,
  // so pressing refresh (or the browser's back button) keeps you on the same screen.
  useEffect(() => {
    const v = session ? JSON.stringify(session) : null;
    try {
      if (session && !keepRef.current) { ls.set("zd_session", null); window.sessionStorage.setItem("zd_session_tmp", v); }
      else { ls.set("zd_session", v); window.sessionStorage.removeItem("zd_session_tmp"); }
    } catch { /* ignore */ }
  }, [session]);
  useEffect(() => { ls.set("zd_tab", tab); }, [tab]);
  useEffect(() => {
    const h = session ? `#/${tab}` : page === "alumniAuth" ? "#/login" : page === "adminLogin" ? "#/admin-login" : page === "adminForgot" ? "#/forgot" : "#/";
    if (window.location.hash !== h) { try { window.history.pushState(null, "", h); } catch { /* some embedded browsers block this */ } }
  }, [session, tab, page]);
  useEffect(() => {
    const onPop = () => {
      const h = window.location.hash.replace(/^#\/?/, "");
      if (sessionRef.current) { if (h) setTab(h); }
      else setPage(h === "login" ? "alumniAuth" : h === "admin-login" ? "adminLogin" : h === "forgot" ? "adminForgot" : "landing");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Phones: turn every table row into a labelled card (the labels come from the header cells).
  useEffect(() => {
    const label = () => {
      document.querySelectorAll(".table-wrap table").forEach((t) => {
        const heads = [...t.querySelectorAll("thead th")].map((h) => h.textContent.trim());
        t.querySelectorAll("tbody tr").forEach((r) => {
          [...r.children].forEach((c, i) => { if (c.tagName === "TD" && c.getAttribute("data-l") !== (heads[i] || "")) c.setAttribute("data-l", heads[i] || ""); });
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // Must stay above the early `loading` return below — all hooks in a component need to
  // run in the same order on every render, and this useCallback depends on `update` above.
  const addLog = useCallback((actor, action, detail = "") => {
    update("logs", (list) => [...list, { id: uid("log"), ts: now(), actor, action, detail }]);
  }, [update]);

  const sys = useMemo(() => ({ ...DEFAULT_SYSTEM, ...((db?.settings || []).find((x) => x.id === "system")?.value || {}) }), [db]);

  if (loadError) return <UnreachableScreen />;
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
  const currentAlumni = currentUser?.role === "alumni" ? db.alumni.find((a) => a.id === currentUser.alumniId) : null;
  // An alumni login only counts if its alumni record still exists and is approved. (A login
  // whose record was deleted used to crash the page and leave a blank white screen.)
  const sessionValid = !!currentUser && (isAdminRole ? currentUser.status !== "deactivated" : !!currentAlumni && currentAlumni.accountStatus === "approved");

  const needsSetup = db.users.length === 0;
  async function handleSetup(f) {
    let fresh;
    try { fresh = await loadTable("users"); } catch { return "We could not reach the server. Check your connection and try again."; }
    if (fresh.length) { dbRef.current = { ...dbRef.current, users: fresh }; setDb(dbRef.current); return "Setup was already completed. Please log in."; }
    const u = { id: uid("user"), email: f.email.trim(), username: f.username.trim(), password: await hashPassword(f.password), role: "superadmin", name: f.name.trim(), campus: null, status: "active", createdAt: now() };
    const ok = await update("users", (l) => [...l, u]);
    if (!ok) return "Could not save the account. Check your connection and that the database tables exist.";
    addLog(u.name, "Super Admin account created (first-time setup)");
    keepRef.current = true; setSession({ userId: u.id, role: "superadmin" }); setTab("dashboard"); setPage("landing");
    return "";
  }

  async function handleLogin(identifier, password, keep = true) {
    const wait = lockRemaining();
    if (wait > 0) { setAuthError(`Too many attempts. Please wait ${wait} seconds and try again.`); return; }
    const id = identifier.trim().toLowerCase();
    const cand = db.users.find((x) => x.role === "alumni" && (x.email.toLowerCase() === id || (x.username || "").toLowerCase() === id));
    const u = cand && (await verifyPassword(cand.password, password)) ? cand : null;
    if (!u) {
      registerFailure();
      setAuthError(lockRemaining() > 0 ? "Too many incorrect attempts. Please wait 30 seconds." : "Incorrect username/email or password.");
      return;
    }
    const al = db.alumni.find((a) => a.id === u.alumniId);
    if (!al) { setAuthError("We could not find your alumni record. Please register again or contact the registrar's office."); return; }
    if (al?.accountStatus === "pending") { setAuthError("Your account is awaiting admin verification."); return; }
    if (al?.accountStatus === "rejected") { setAuthError("Your registration was rejected. Please contact the registrar's office."); return; }
    setAuthError("");
    clearFailures();
    keepRef.current = keep;
    if (!isHashed(u.password)) hashPassword(password).then((h) => update("users", (l) => l.map((x) => (x.id === u.id ? { ...x, password: h } : x)))).catch(() => {});
    setSession({ userId: u.id, role: u.role });
    setTab("dashboard");
  }

  // Admins (Super Admin or Campus Admin) are looked up by email OR username — they are
  // never mixed with the public alumni login above, and alumni accounts can never satisfy
  // an admin login even if the credentials happened to match.
  async function handleAdminLogin(identifier, password, keep = true) {
    const wait = lockRemaining();
    if (wait > 0) { setAdminError(`Too many attempts. Please wait ${wait} seconds and try again.`); return; }
    const id = identifier.trim().toLowerCase();
    const cand = db.users.find((x) =>
      (x.role === "superadmin" || x.role === "campusadmin") &&
      (x.email.toLowerCase() === id || (x.username || "").toLowerCase() === id)
    );
    const u = cand && (await verifyPassword(cand.password, password)) ? cand : null;
    if (!u) {
      registerFailure();
      setAdminError(lockRemaining() > 0 ? "Too many incorrect attempts. Please wait 30 seconds." : "Invalid email/username or password. Please try again.");
      addLog(identifier || "Unknown", "Failed admin login attempt");
      return;
    }
    if (u.status === "deactivated") {
      setAdminError("Your admin account is currently deactivated. Please contact the Super Admin.");
      return;
    }
    setAdminError("");
    clearFailures();
    keepRef.current = keep;
    if (!isHashed(u.password)) hashPassword(password).then((h) => update("users", (l) => l.map((x) => (x.id === u.id ? { ...x, password: h } : x)))).catch(() => {});
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

  // "Forgot password": there is no email service, so the request is flagged for the registrar /
  // Super Admin, who set a temporary password. Nothing here reveals whether the account exists.
  function handleAlumniForgot(identifier) {
    const id = identifier.trim().toLowerCase();
    const u = db.users.find((x) => x.role === "alumni" && (x.email.toLowerCase() === id || (x.username || "").toLowerCase() === id));
    if (u?.alumniId && db.alumni.some((a) => a.id === u.alumniId)) {
      update("alumni", (list) => list.map((a) => (a.id === u.alumniId ? { ...a, profile: { ...(a.profile || {}), resetRequestedAt: now() } } : a)));
      addLog(identifier.trim(), "Alumni password reset requested", u.name);
    }
  }
  function handleAdminForgot(identifier) {
    const id = identifier.trim().toLowerCase();
    const u = db.users.find((x) => (x.role === "superadmin" || x.role === "campusadmin") && (x.email.toLowerCase() === id || (x.username || "").toLowerCase() === id));
    addLog(identifier.trim(), "Admin password reset requested", u ? u.name : "no matching account");
  }

  async function handleRegister(form) {
    if (!sys.registrationOpen) { setAuthError(sys.closedMessage || "Registration is currently closed."); return; }
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setAuthError("Enter a valid email address."); return; }
    if (username.length < 4 || /\s/.test(username)) { setAuthError("Username needs at least 4 characters and no spaces."); return; }
    if (db.users.some((u) => (u.username || "").toLowerCase() === username.toLowerCase())) { setAuthError("That username is already taken. Try another."); return; }
    if (db.users.some((u) => u.email.toLowerCase() === email)) { setAuthError("An account with this email already exists."); return; }
    if (form.password.length < 6) { setAuthError("Password needs at least 6 characters."); return; }
    if (form.password !== form.confirm) { setAuthError("Passwords do not match."); return; }
    if (!form.consent) { setAuthError("Please accept the data privacy consent to continue."); return; }
    const dup = db.alumni.some((a) => a.fullName.toLowerCase() === form.fullName.trim().toLowerCase() && a.gradYear === form.gradYear && a.course === form.course);
    if (dup) { setAuthError("A matching alumni record already exists for this name, course, and graduation year."); return; }
    const newAlumni = {
      id: uid("al"), fullName: form.fullName.trim(), campus: form.campus, course: form.course, gradYear: form.gradYear,
      email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(),
      employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false },
      profile: { studentNo: form.studentNo.trim(), sex: form.sex, dob: form.dob, consent: true, consentDate: now(), recordStatus: "Active" },
      accountStatus: "pending", createdAt: now(), updatedAt: now(),
    };
    // Public self-registration always creates an "alumni" account — there is no way for a
    // visitor to create an admin account of any kind from this form.
    const newUser = { id: uid("user"), email: form.email.trim(), username, password: await hashPassword(form.password), role: "alumni", alumniId: newAlumni.id, name: form.fullName.trim(), createdAt: now() };
    // Only show "Registration submitted" once the server has really saved it.
    const savedAlumni = await update("alumni", (list) => [...list, newAlumni]);
    const savedUser = savedAlumni ? await update("users", (list) => [...list, newUser]) : false;
    if (!savedAlumni || !savedUser) { setAuthError("We could not save your registration. Please check your connection and try again in a moment."); return; }
    setAuthError("");
    setAuthMode("registered");
  }

  // Nothing below this line renders an admin dashboard unless `sessionValid` is true AND
  // the stored user's role was verified above — there is no URL/tab a visitor can jump to
  // that bypasses handleAdminLogin's credential + status check.
  return (
    <div className={"zd-root" + (prefs.compact ? " compact" : "") + (prefs.reduceMotion ? " rm" : "")}>
      <style>{CSS}</style>
      {sys.bannerOn && sys.bannerText && <div className="site-banner" role="status">{sys.bannerText}</div>}
      {needsSetup ? (
        <SetupScreen onCreate={handleSetup} />
      ) : !sessionValid ? (
        page === "adminLogin" ? (
          <AdminLoginScreen
            error={adminError} setError={setAdminError}
            onLogin={handleAdminLogin}
            onBackHome={() => { setAdminError(""); setPage("landing"); }}
            onForgot={() => { setAdminError(""); setPage("adminForgot"); }}
            onAlumniPortal={() => { setAdminError(""); setAuthMode("login"); setPage("alumniAuth"); }}
          />
        ) : page === "adminForgot" ? (
          <AdminForgotPassword onBack={() => setPage("adminLogin")} onRequest={handleAdminForgot} />
        ) : page === "alumniAuth" ? (
          <AuthScreen existingUsers={db.users} onForgot={handleAlumniForgot} onAdminLogin={() => { setAuthError(""); setPage("adminLogin"); }} registrationOpen={sys.registrationOpen} closedMessage={sys.closedMessage} mode={authMode} setMode={setAuthMode} error={authError} setError={setAuthError} onLogin={handleLogin} onRegister={handleRegister} onBackHome={() => { setAuthError(""); setAuthMode("login"); setPage("landing"); }} />
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
          prefs={prefs} setPrefs={setPrefs} sys={sys}
          currentUserId={currentUser.id}
        />
      ) : (
        <AlumniShell db={db} update={update} tab={tab} setTab={setTab} onLogout={handleLogout} showToast={showToast} me={currentAlumni} meUser={currentUser} prefs={prefs} setPrefs={setPrefs} sys={sys} />
      )}
      {syncBad.length > 0 && session && (
        <div className="sync-warn" role="status">
          Some data is not loading ({syncBad.join(", ")}). New items may not show up until this is fixed.
          <button onClick={() => { fetchLatest().then(() => setSyncBad(Object.keys(loadErrors))); }}>Retry</button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ============================== FIRST-TIME SETUP / CREDENTIALS ============================== */

// Passwords are never stored as typed. They are salted and hashed (PBKDF2-SHA256) in the browser
// before saving. Older plain-text passwords still work once and are upgraded at the next login.
const b64 = (buf) => { let s = ""; new Uint8Array(buf).forEach((c) => { s += String.fromCharCode(c); }); return btoa(s); };
const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
async function pbkdf2(pw, salt, iter) {
  const subtle = window.crypto && window.crypto.subtle;
  if (!subtle) throw new Error("A secure (https) connection is required.");
  const key = await subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  return subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
const isHashed = (v) => typeof v === "string" && v.startsWith("pbkdf2$");
async function hashPassword(pw) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$100000$${b64(salt)}$${b64(await pbkdf2(pw, salt, 100000))}`;
}
async function verifyPassword(stored, pw) {
  if (!stored) return false;
  if (!isHashed(stored)) return stored === pw;
  const [, it, salt, hash] = stored.split("$");
  try { return b64(await pbkdf2(pw, unb64(salt), Number(it))) === hash; } catch { return false; }
}

// One-time random password (no look-alike characters). Used instead of any shared default.
function makeTempPassword() {
  const U = "ABCDEFGHJKMNPQRSTUVWXYZ", L = "abcdefghjkmnpqrstuvwxyz", D = "23456789";
  const all = U + L + D;
  const rnd = (n) => { const a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] % n; };
  const out = [U[rnd(U.length)], L[rnd(L.length)], D[rnd(D.length)]];
  while (out.length < 10) out.push(all[rnd(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join("");
}

function SetupScreen({ onCreate }) {
  const [f, setF] = useState({ name: "", email: "", username: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); if (err) setErr(""); };
  async function submit() {
    if (busy) return;
    if (f.name.trim().length < 3) return setErr("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr("Enter a valid email address.");
    if (f.username.trim().length < 4 || /\s/.test(f.username.trim())) return setErr("Username needs at least 4 characters and no spaces.");
    if (f.password.length < 8) return setErr("Password needs at least 8 characters.");
    if (f.password !== f.confirm) return setErr("Passwords do not match.");
    setBusy(true);
    const msg = await onCreate(f);
    setBusy(false);
    if (msg) setErr(msg);
  }
  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div className="auth-side-inner">
          <div className="brand-mark"><ShieldCheck size={26} /></div>
          <h1>First-time<br />Setup</h1>
          <p>This system has no accounts yet. Create the Super Admin account. It has full access to every campus and can create the Campus Admin accounts afterwards.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card" onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") submit(); }}>
          <div className="brand-mark small solo"><Lock size={16} /></div>
          <h2>Create the Super Admin</h2>
          <p className="muted">You will only see this screen once.</p>
          {err && <div className="auth-error" role="alert"><AlertCircle size={15} />{err}</div>}
          <Field label="Full name"><input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
          <Field label="Username"><input value={f.username} onChange={(e) => set("username", e.target.value)} autoComplete="username" /></Field>
          <PwField label="Password" value={f.password} onChange={(v) => set("password", v)} placeholder="At least 8 characters" autoComplete="new-password" />
          <StrengthMeter value={f.password} />
          <PwField label="Confirm password" value={f.confirm} onChange={(v) => set("confirm", v)} placeholder="Type it again" autoComplete="new-password" />
          <button className="btn primary block" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create Super Admin"}</button>
        </div>
      </div>
    </div>
  );
}

function UnreachableScreen() {
  return (
    <div className="zd-root zd-loading">
      <style>{CSS}</style>
      <div className="loader" style={{ flexDirection: "column", textAlign: "center", gap: 12 }}>
        <AlertCircle size={30} />
        <span>We could not reach the database.</span>
        <span className="muted" style={{ fontSize: ".8rem", maxWidth: 340 }}>Check your internet connection. Also open your Supabase dashboard: a free project that was idle is paused and must be restored. If this is a new setup, run supabase_migration.sql.</span>
        {Object.keys(loadErrors).length > 0 && <code style={{ fontSize: ".7rem", maxWidth: 340, textAlign: "left", wordBreak: "break-word" }}>{Object.entries(loadErrors).map(([k, v]) => `${k}: ${v}`).join("\n")}</code>}
        <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  );
}

// Shown right after accounts are created, because temporary passwords cannot be viewed again.
function CredentialsModal({ title, rows, onClose }) {
  const text = rows.map((r) => `${r.name}\t${r.email}\t${r.password}`).join("\n");
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* ignore */ } };
  const csv = () => saveFile("alumni-temporary-passwords.csv", "Name,Email,Temporary password\n" + rows.map((r) => [r.name, r.email, r.password].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  return (
    <Modal title={title} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: -4 }}>Give each person their temporary password in person or by phone. <strong>It will not be shown again.</strong> They can change it after logging in (Edit profile).</p>
      <div className="table-wrap" style={{ maxHeight: 280, overflow: "auto" }}>
        <table>
          <thead><tr><th>Name</th><th>Email (login)</th><th>Temporary password</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.email}><td>{r.name}</td><td>{r.email}</td><td><code>{r.password}</code></td></tr>))}</tbody>
        </table>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={copy}>{copied ? "Copied" : "Copy all"}</button>
        <button className="btn ghost" onClick={csv}><Download size={15} />Download CSV</button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

/* ============================== SERVICES: DOCUMENT REQUESTS, MENTORING, ALUMNI ID ============================== */

const DOC_TYPES = ["Alumni ID", "Certificate of Graduation", "Transcript of Records (TOR)", "Certificate of Good Moral Character", "Diploma Authentication", "Other"];
const DOC_STATUSES = ["Pending", "Processing", "Ready for pickup", "Rejected"];
const alumniNo = (a) => `ZD-${a.gradYear}-${a.id.replace(/[^A-Za-z0-9]/g, "").slice(-5).toUpperCase()}`;
const statusTone = (s) => ({ Pending: "#C9962B", Processing: "#2F6F8F", "Ready for pickup": "#1F5D4E", Accepted: "#1F5D4E", Rejected: "#B23A34", Declined: "#B23A34", Cancelled: "#5B6B63" }[s] || "#5B6B63");
const StatusChip = ({ s }) => <span className="status-chip" style={{ background: statusTone(s) }}>{s}</span>;

function notifyAlumni(update, alumniId, title, message) {
  update("notifications", (l) => [...l, { id: uid("notif"), title, message, audience: { type: "alumni", value: alumniId }, createdAt: now(), readBy: [] }]);
}

function AlumniServices({ db, update, me, showToast }) {
  const [type, setType] = useState(DOC_TYPES[0]);
  const [details, setDetails] = useState("");
  const all = db.requests || [];
  const mineDocs = all.filter((r) => r.kind === "document" && r.alumniId === me.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const sent = all.filter((r) => r.kind === "mentorship" && r.alumniId === me.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const incoming = all.filter((r) => r.kind === "mentorship" && r.targetId === me.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const who = (id) => db.alumni.find((a) => a.id === id);
  async function submit() {
    if (!details.trim()) return;
    const r = { id: uid("req"), kind: "document", type, details: details.trim(), alumniId: me.id, alumniName: me.fullName, campus: me.campus, targetId: null, status: "Pending", note: "", createdAt: now(), updatedAt: now() };
    const ok = await update("requests", (l) => [...l, r]);
    if (ok) { setDetails(""); showToast("Request sent. The registrar's office will update its status here."); }
  }
  const cancel = (r) => { update("requests", (l) => l.map((x) => (x.id === r.id ? { ...x, status: "Cancelled", updatedAt: now() } : x))); showToast("Request cancelled."); };
  const answer = (r, status) => {
    update("requests", (l) => l.map((x) => (x.id === r.id ? { ...x, status, updatedAt: now() } : x)));
    notifyAlumni(update, r.alumniId, status === "Accepted" ? "Mentoring request accepted" : "Mentoring request declined", status === "Accepted" ? `${me.fullName} accepted your mentoring request. Open Services to see how to reach them.` : `${me.fullName} is not able to mentor right now. You can ask another mentor in the Alumni Directory.`);
    showToast(status === "Accepted" ? "Accepted. Your contact details are now shared with them." : "Declined.");
  };
  return (
    <div>
      <PageHead eyebrow="Requests & mentoring" title="Alumni Services" />
      <div className="grid-2">
        <div className="panel">
          <h3>Request a document</h3>
          <Field label="What do you need?"><select value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Purpose / details"><textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. For a job application, 2 copies" /></Field>
          <button className="btn primary" onClick={submit} disabled={!details.trim()}><Send size={15} />Send request</button>
        </div>
        <div className="panel">
          <h3>My requests</h3>
          <div className="stack">
            {mineDocs.map((r) => (
              <div className="list-card" key={r.id}>
                <div className="list-card-head"><div style={{ flex: 1 }}><div className="mini-name">{r.type}</div><div className="mini-sub">{fmtDate(r.createdAt)}</div></div><StatusChip s={r.status} /></div>
                <p className="list-card-text">{r.details}</p>
                {r.note && <p className="list-card-text"><strong>Registrar's note:</strong> {r.note}</p>}
                {r.status === "Pending" && <button className="link-btn small" onClick={() => cancel(r)}>Cancel request</button>}
              </div>
            ))}
            {!mineDocs.length && <span className="muted">You have not requested anything yet.</span>}
          </div>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Mentoring requests for you</h3>
          <p className="muted" style={{ marginTop: -6 }}>These come from alumni who found you in the Directory because you said you are willing to mentor.</p>
          <div className="stack">
            {incoming.map((r) => (
              <div className="list-card" key={r.id}>
                <div className="list-card-head"><Avatar src={who(r.alumniId)?.profile?.photo} name={r.alumniName} /><div style={{ flex: 1 }}><div className="mini-name">{r.alumniName}</div><div className="mini-sub">{who(r.alumniId)?.course} · Batch {who(r.alumniId)?.gradYear}</div></div><StatusChip s={r.status} /></div>
                <p className="list-card-text">{r.details}</p>
                {r.status === "Pending" && <div className="row-gap"><button className="btn primary" onClick={() => answer(r, "Accepted")}>Accept</button><button className="btn ghost" onClick={() => answer(r, "Declined")}>Decline</button></div>}
                {r.status === "Accepted" && who(r.alumniId) && <div className="mini-sub">Their contact: {who(r.alumniId).email}{who(r.alumniId).phone ? ` · ${who(r.alumniId).phone}` : ""}</div>}
              </div>
            ))}
            {!incoming.length && <span className="muted">No requests yet. Turn on "Willing to mentor" in your profile and join the Directory.</span>}
          </div>
        </div>
        <div className="panel">
          <h3>Mentors I asked</h3>
          <div className="stack">
            {sent.map((r) => { const m = who(r.targetId); return (
              <div className="list-card" key={r.id}>
                <div className="list-card-head"><Avatar src={m?.profile?.photo} name={m?.fullName || "?"} /><div style={{ flex: 1 }}><div className="mini-name">{m?.fullName || "Mentor"}</div><div className="mini-sub">{fmtDate(r.createdAt)}</div></div><StatusChip s={r.status} /></div>
                <p className="list-card-text">{r.details}</p>
                {r.status === "Accepted" && m && <div className="mini-sub">Mentor contact: {m.email}{m.phone ? ` · ${m.phone}` : ""}</div>}
              </div>); })}
            {!sent.length && <span className="muted">Find a mentor in the Alumni Directory (look for the Mentor tag).</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlumniIdCard({ me }) {
  const no = alumniNo(me);
  return (
    <div>
      <PageHead eyebrow="Digital ID" title="My Alumni ID" action={<button className="btn primary" onClick={() => window.print()}><Printer size={15} />Print</button>} />
      <div className="id-card">
        <div className="id-top"><GraduationCap size={20} /><div><div className="id-school">Zamboanga del Sur Provincial Government College</div><div className="id-sub">Alumni Identification</div></div></div>
        <div className="id-body">
          <Avatar src={me.profile?.photo} name={me.fullName} className="id-photo avatar" />
          <div>
            <div className="id-name">{me.fullName}</div>
            <div className="id-line">{me.course}</div>
            <div className="id-line">Batch {me.gradYear} · {me.campus}</div>
            <div className="id-no">{no}</div>
          </div>
        </div>
        <div className="id-foot">{me.accountStatus === "approved" ? "Verified alumnus" : "Not verified"} · Valid with the registrar's verification</div>
      </div>
      <p className="muted" style={{ maxWidth: 420 }}>Add a photo under My Profile so it shows here. This card is for identification inside the alumni system. For an official printed Alumni ID, request one under Services.</p>
    </div>
  );
}

function RequestsAdmin({ db, update, showToast, lockCampus }) {
  const kind = "document";
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState(null);
  const [st, setSt] = useState("Processing");
  const [note, setNote] = useState("");
  const [idq, setIdq] = useState("");
  const statuses = DOC_STATUSES;
  const scoped = (db.requests || []).filter((r) => !lockCampus || r.campus === lockCampus);
  const list = scoped.filter((r) => r.kind === kind && (!fStatus || r.status === fStatus)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  function open(r) { setEditing(r); setSt(r.status === "Pending" ? "Processing" : r.status); setNote(r.note || ""); }
  function save() {
    const r = editing;
    update("requests", (l) => l.map((x) => (x.id === r.id ? { ...x, status: st, note: note.trim(), updatedAt: now() } : x)));
    notifyAlumni(update, r.alumniId, `Your request: ${st}`, `${r.type} \u2014 ${st}.${note.trim() ? " " + note.trim() : ""}`);
    showToast("Updated and the alumnus was notified.");
    setEditing(null);
  }
  const csv = () => saveFile(`${kind}-requests.csv`, "Alumnus,Type,Details,Date,Status,Note\n" + list.map((r) => [r.alumniName, r.type, r.details, fmtDate(r.createdAt), r.status, r.note || ""].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  const found = idq.trim() ? db.alumni.find((a) => alumniNo(a).toLowerCase() === idq.trim().toLowerCase()) : null;
  return (
    <div>
      <PageHead eyebrow={`${list.length} shown`} title="Document Requests" action={<button className="btn ghost" onClick={csv} disabled={!list.length}><Download size={15} />Export CSV</button>} />
      <div className="panel" style={{ marginBottom: 14 }}>
        <Field label="Verify an Alumni ID number">
          <input value={idq} onChange={(e) => setIdq(e.target.value)} placeholder="e.g. ZD-2020-AB12C" />
        </Field>
        {idq.trim() && (found
          ? <div className="mini-sub" style={{ color: "#1F5D4E", fontWeight: 600 }}>Valid: {found.fullName} · {found.course} · Batch {found.gradYear} · {found.campus} · {found.accountStatus === "approved" ? "verified alumnus" : "account " + found.accountStatus}</div>
          : <div className="mini-sub" style={{ color: "#B23A34", fontWeight: 600 }}>No alumnus has this ID number.</div>)}
      </div>
      <div className="filter-bar">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All statuses</option>{[...statuses, "Cancelled"].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Alumnus</th><th>Document</th><th>Details</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td><div className="cell-name"><Avatar src={photoOf(db, r.alumniId)} name={r.alumniName} />{r.alumniName}</div></td>
                <td>{r.type}</td><td>{r.details}</td><td>{fmtDate(r.createdAt)}</td><td><StatusChip s={r.status} /></td>
                <td>{r.status !== "Cancelled" && <button className="btn ghost" onClick={() => open(r)}>Update</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <EmptyState icon={FileText} text="No document requests." />}
      </div>
      {editing && (
        <Modal title={`${editing.type} \u2014 ${editing.alumniName}`} onClose={() => setEditing(null)}>
          <p className="muted" style={{ marginTop: -4 }}>{editing.details}</p>
          <Field label="Status"><select value={st} onChange={(e) => setSt(e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Note to the alumnus (optional)"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Claim at the registrar, Mon–Fri 8am–4pm" /></Field>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save and notify</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== EVENTS & REUNIONS ============================== */

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtEventDate = (s) => { if (!s) return "Date to be announced"; const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric" }); };
const ALL_CAMPUSES = "All campuses";

function EventsAdmin({ db, update, showToast, lockCampus }) {
  const [creating, setCreating] = useState(false);
  const [seeing, setSeeing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", location: "", date: "", time: "", campus: lockCampus || ALL_CAMPUSES });
  const events = (db.events || []).filter((e) => !lockCampus || e.campus === ALL_CAMPUSES || e.campus === lockCampus).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const canTouch = (e) => !lockCampus || e.campus === lockCampus;
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  function save() {
    if (!form.title.trim() || !form.date) return;
    const ev = { id: uid("evt"), title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), date: form.date, time: form.time, campus: lockCampus || form.campus, rsvps: [], createdAt: now() };
    update("events", (l) => [...l, ev]);
    update("notifications", (l) => [...l, { id: uid("notif"), title: `New event: ${ev.title}`, message: `${fmtEventDate(ev.date)}${ev.location ? " at " + ev.location : ""}. Open Events to let us know if you are coming.`, audience: ev.campus === ALL_CAMPUSES ? { type: "all" } : { type: "campus", value: ev.campus }, createdAt: now(), readBy: [] }]);
    showToast("Event posted and alumni notified.");
    setCreating(false);
    setForm({ title: "", description: "", location: "", date: "", time: "", campus: lockCampus || ALL_CAMPUSES });
  }
  function remove(id) { update("events", (l) => l.filter((e) => e.id !== id)); showToast("Event removed."); }
  const going = (e) => (e.rsvps || []).map((id) => db.alumni.find((a) => a.id === id)).filter(Boolean);
  return (
    <div>
      <PageHead eyebrow={`${events.length} event${events.length === 1 ? "" : "s"}`} title="Events & Reunions" action={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />Post Event</button>} />
      <div className="cards-grid">
        {events.map((e) => (
          <div className="simple-card" key={e.id}>
            <div className="job-card-head">
              <CalendarDays size={18} color="#1F5D4E" />
              {canTouch(e) && <button className="icon-btn danger" aria-label="Delete event" onClick={() => remove(e.id)}><Trash2 size={15} /></button>}
            </div>
            <div className="mini-name">{e.title}</div>
            <div className="mini-sub">{fmtEventDate(e.date)}{e.time ? ` · ${e.time}` : ""}</div>
            {e.location && <div className="mini-sub"><MapPin size={12} /> {e.location}</div>}
            {e.description && <p className="list-card-text">{e.description}</p>}
            <div className="badge-soft">{e.campus}</div>
            <button className="link-btn small" onClick={() => setSeeing(e)}>{(e.rsvps || []).length} going · see list</button>
            {e.date && e.date < todayStr() && <div className="badge-soft">Past event</div>}
          </div>
        ))}
        {!events.length && <EmptyState icon={CalendarDays} text="No events yet. Post a reunion, job fair or seminar." />}
      </div>
      {creating && (
        <Modal title="Post an event" onClose={() => setCreating(false)}>
          <Field label="Title"><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Grand Alumni Homecoming" /></Field>
          <Field label="Date"><input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Time (optional)"><input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></Field>
          <Field label="Place"><input value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Details"><textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          {!lockCampus && <Field label="Who is invited"><select value={form.campus} onChange={(e) => set("campus", e.target.value)}><option>{ALL_CAMPUSES}</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select></Field>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!form.title.trim() || !form.date}>Post event</button>
          </div>
        </Modal>
      )}
      {seeing && (
        <Modal title={`Going — ${seeing.title}`} onClose={() => setSeeing(null)}>
          <ul className="mini-list">
            {going(db.events.find((x) => x.id === seeing.id) || seeing).map((a) => (<li key={a.id}><div className="mini-avatar">{a.fullName[0]}</div><div className="mini-info"><div className="mini-name">{a.fullName}</div><div className="mini-sub">{a.course} · Batch {a.gradYear}</div></div></li>))}
            {!going(db.events.find((x) => x.id === seeing.id) || seeing).length && <li><span className="muted">Nobody has said they are coming yet.</span></li>}
          </ul>
          <div className="modal-actions"><button className="btn primary" onClick={() => setSeeing(null)}>Close</button></div>
        </Modal>
      )}
    </div>
  );
}

function AlumniEvents({ db, update, me, showToast }) {
  const mine = (db.events || []).filter((e) => e.campus === ALL_CAMPUSES || e.campus === me.campus);
  const today = todayStr();
  const upcoming = mine.filter((e) => !e.date || e.date >= today).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const past = mine.filter((e) => e.date && e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  function toggle(e) {
    const isGoing = (e.rsvps || []).includes(me.id);
    update("events", (l) => l.map((x) => (x.id === e.id ? { ...x, rsvps: isGoing ? (x.rsvps || []).filter((i) => i !== me.id) : [...(x.rsvps || []), me.id] } : x)));
    showToast(isGoing ? "RSVP cancelled." : "See you there! You are marked as going.");
  }
  const card = (e, old) => {
    const isGoing = (e.rsvps || []).includes(me.id);
    return (
      <div className="simple-card" key={e.id} style={old ? { opacity: 0.65 } : undefined}>
        <CalendarDays size={18} color="#1F5D4E" />
        <div className="mini-name">{e.title}</div>
        <div className="mini-sub">{fmtEventDate(e.date)}{e.time ? ` · ${e.time}` : ""}</div>
        {e.location && <div className="mini-sub"><MapPin size={12} /> {e.location}</div>}
        {e.description && <p className="list-card-text">{e.description}</p>}
        <div className="badge-soft">{(e.rsvps || []).length} going</div>
        {!old && <button className={"btn " + (isGoing ? "ghost" : "primary")} onClick={() => toggle(e)}>{isGoing ? <><Check size={15} />Going — tap to cancel</> : "I'm going"}</button>}
      </div>
    );
  };
  return (
    <div>
      <PageHead eyebrow={`${upcoming.length} upcoming`} title="Events & Reunions" />
      <div className="cards-grid">
        {upcoming.map((e) => card(e, false))}
        {!upcoming.length && <EmptyState icon={CalendarDays} text="No upcoming events right now. Check back soon." />}
      </div>
      {past.length > 0 && (<><h3 style={{ margin: "22px 0 10px" }}>Past events</h3><div className="cards-grid">{past.map((e) => card(e, true))}</div></>)}
    </div>
  );
}

/* ============================== ALUMNI DIRECTORY (opt-in) ============================== */

function AlumniDirectory({ db, update, me, showToast }) {
  const [q, setQ] = useState("");
  const [fCampus, setFCampus] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fYear, setFYear] = useState("");
  const optedIn = !!me.profile?.directory;
  const [mentorFor, setMentorFor] = useState(null);
  const [mentorMsg, setMentorMsg] = useState("");
  const myReqs = (db.requests || []).filter((r) => r.kind === "mentorship" && r.alumniId === me.id);
  async function askMentor() {
    const m = mentorFor;
    const ok = await update("requests", (l) => [...l, { id: uid("req"), kind: "mentorship", type: "Mentoring", details: mentorMsg.trim(), alumniId: me.id, alumniName: me.fullName, campus: me.campus, targetId: m.id, status: "Pending", note: "", createdAt: now(), updatedAt: now() }]);
    if (ok) { notifyAlumni(update, m.id, "New mentoring request", `${me.fullName} would like you as a mentor. Open Services to respond.`); showToast("Request sent to " + m.fullName.split(" ")[0] + "."); }
    setMentorFor(null); setMentorMsg("");
  }
  const setProf = (patch, msg) => {
    update("alumni", (l) => l.map((a) => (a.id === me.id ? { ...a, profile: { ...(a.profile || {}), ...patch }, updatedAt: now() } : a)));
    if (msg) showToast(msg);
  };
  const list = db.alumni.filter((a) => a.accountStatus === "approved" && a.profile?.directory)
    .filter((a) => (!fCampus || a.campus === fCampus) && (!fCourse || a.course === fCourse) && (!fYear || a.gradYear === fYear))
    .filter((a) => { const s = norm(q); return !s || norm(a.fullName).includes(s) || norm(a.employment?.company).includes(s) || norm(a.employment?.position).includes(s); })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return (
    <div>
      <PageHead eyebrow={`${list.length} listed`} title="Alumni Directory" />
      <div className="panel" style={{ marginBottom: 16 }}>
        <SettingRow title="List me in the directory" desc="Other verified alumni can see your name, course, batch, campus and work. This is off until you turn it on.">
          <Toggle checked={optedIn} onChange={(v) => setProf({ directory: v, ...(v ? {} : { directoryContact: false }) }, v ? "You are now listed in the directory." : "You were removed from the directory.")} label="List me in the directory" />
        </SettingRow>
        {optedIn && (
          <SettingRow title="Also show my email and phone" desc="Lets classmates contact you directly.">
            <Toggle checked={!!me.profile?.directoryContact} onChange={(v) => setProf({ directoryContact: v }, v ? "Your contact details are visible." : "Your contact details are hidden.")} label="Show my email and phone" />
          </SettingRow>
        )}
      </div>
      <div className="filter-bar">
        <div className="search-box"><Search size={15} /><input placeholder="Search name, company or position…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={fCampus} onChange={(e) => setFCampus(e.target.value)}><option value="">All Campuses</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={fCourse} onChange={(e) => setFCourse(e.target.value)}><option value="">All Courses</option>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={fYear} onChange={(e) => setFYear(e.target.value)}><option value="">All Years</option>{GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}</select>
      </div>
      <div className="cards-grid">
        {list.map((a) => (
          <div className="simple-card" key={a.id}>
            <div className="cell-name"><Avatar src={a.profile?.photo} name={a.fullName} /><div className="mini-name">{a.fullName}</div></div>
            <div className="mini-sub">{a.course} · Batch {a.gradYear}</div>
            <div className="mini-sub"><Building2 size={12} /> {a.campus}</div>
            {a.employment?.status && a.employment.status !== "Unemployed" && (a.employment.company || a.employment.position) && <div className="mini-sub"><Briefcase size={12} /> {[a.employment.position, a.employment.company].filter(Boolean).join(" at ")}</div>}
            {a.profile?.directoryContact && <div className="mini-sub"><Mail size={12} /> {a.email}{a.phone ? ` · ${a.phone}` : ""}</div>}
            {a.profile?.mentor === "Yes" && <div className="badge-soft">Open to mentoring</div>}
            {a.profile?.mentor === "Yes" && a.id !== me.id && (() => { const r = myReqs.find((x) => x.targetId === a.id && x.status !== "Declined" && x.status !== "Cancelled"); return r ? <span className="mini-sub">Mentoring request: {r.status}</span> : <button className="btn ghost" onClick={() => setMentorFor(a)}>Request mentoring</button>; })()}
          </div>
        ))}
        {!list.length && <EmptyState icon={Contact} text="No one matches yet. Alumni appear here after they turn on the directory." />}
      </div>
      {mentorFor && (
        <Modal title={`Ask ${mentorFor.fullName} to mentor you`} onClose={() => setMentorFor(null)}>
          <Field label="What would you like help with?"><textarea rows={3} value={mentorMsg} onChange={(e) => setMentorMsg(e.target.value)} placeholder="e.g. Career advice in agriculture, interview tips…" /></Field>
          <p className="muted">If they accept, you will both see each other's email and phone under Services.</p>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setMentorFor(null)}>Cancel</button><button className="btn primary" onClick={askMentor} disabled={!mentorMsg.trim()}>Send request</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== AUTH ============================== */

// ---- sign-in helpers ----
// A basic guard against password guessing: after 5 wrong passwords the login is paused for 30 seconds.
const LOCK_KEY = "zd_lock";
const lockState = () => { try { return JSON.parse(ls.get(LOCK_KEY) || "{}"); } catch { return {}; } };
const lockRemaining = () => Math.max(0, Math.ceil(((lockState().until || 0) - Date.now()) / 1000));
function registerFailure() {
  const s = lockState();
  if ((s.until || 0) > Date.now()) return;
  const count = (s.count || 0) + 1;
  ls.set(LOCK_KEY, JSON.stringify(count >= 5 ? { count: 0, until: Date.now() + 30000 } : { count, until: 0 }));
}
const clearFailures = () => ls.set(LOCK_KEY, null);
function useLock() {
  const [n, setN] = useState(lockRemaining());
  useEffect(() => { const t = setInterval(() => setN(lockRemaining()), 500); return () => clearInterval(t); }, []);
  return n;
}

const pwScore = (p) => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(1, s);
};
const PW_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function StrengthMeter({ value }) {
  const sc = pwScore(value);
  if (!value) return <div className="field-hint">Use 8 or more characters with letters, numbers and a symbol.</div>;
  return (
    <div className="pw-meter" aria-live="polite">
      <div className="pw-bars">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= sc ? "on s" + sc : ""} />)}</div>
      <span>{PW_LABELS[sc]}</span>
    </div>
  );
}

const Hint = ({ h }) => (h ? <div className={"field-hint " + (h.bad ? "bad" : "ok")}>{h.text}</div> : null);

function PrivacyNotice({ onClose }) {
  return (
    <Modal title="Data Privacy Notice" onClose={onClose}>
      <div className="notice-body">
        <p>ZDSPGC collects your information to keep an accurate alumni record and to follow what happens to graduates after school.</p>
        <h4>What we collect</h4>
        <p>Your name, student number, course, campus and graduation year, contact details, employment information, and the optional details you add to your profile (for example licensure, alumni engagement and tracer-study answers).</p>
        <h4>How it is used</h4>
        <p>To verify that you are a graduate, to report employment outcomes, to send announcements and job postings, and to help the school plan its programs.</p>
        <h4>Who can see it</h4>
        <p>The ZDSPGC Super Admin and the Campus Admin of your campus. Other alumni only see what you choose to post in the community.</p>
        <h4>Your rights</h4>
        <p>Under the Data Privacy Act of 2012 (RA 10173) you may ask to see, correct or delete your information, or withdraw your consent. Contact the ZDSPGC registrar's office for any request.</p>
      </div>
      <div className="modal-actions"><button className="btn primary" onClick={onClose}>I understand</button></div>
    </Modal>
  );
}

function PwField({ label, value, onChange, placeholder, onEnter, autoComplete }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const check = (e) => { if (e.getModifierState) setCaps(e.getModifierState("CapsLock")); };
  return (
    <Field label={label}>
      <div className="pw-wrap">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          onKeyDown={(e) => { check(e); if (e.key === "Enter" && onEnter) onEnter(); }} onKeyUp={check} onBlur={() => setCaps(false)} />
        <button type="button" className="pw-eye" onClick={() => setShow((x) => !x)} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"} data-shown={show ? "yes" : "no"}>{show ? <Eye size={16} /> : <EyeOff size={16} />}</button>
      </div>
      {caps && <div className="field-hint warn" role="status">Caps Lock is on</div>}
    </Field>
  );
}

function AuthScreen({ registrationOpen = true, closedMessage = "", existingUsers = [], mode, setMode, error, setError, onLogin, onRegister, onForgot, onAdminLogin, onBackHome }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const lock = useLock();
  const [form, setForm] = useState({ fullName: "", email: "", username: "", studentNo: "", sex: "", dob: "", password: "", confirm: "", campus: CAMPUSES[0], course: COURSES[0], gradYear: GRAD_YEARS[GRAD_YEARS.length - 1], phone: "", address: "", consent: false });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.fullName.trim() && form.email.trim() && form.username.trim() && form.studentNo.trim() && form.password && form.confirm && form.consent;

  useEffect(() => { if (lock === 0 && error && error.startsWith("Too many")) setError(""); }, [lock]); // eslint-disable-line react-hooks/exhaustive-deps

  const un = form.username.trim().toLowerCase();
  const unHint = !un ? null : (un.length < 4 || /\s/.test(un)) ? { bad: true, text: "At least 4 characters and no spaces." } : existingUsers.some((u) => (u.username || "").toLowerCase() === un) ? { bad: true, text: "That username is already taken." } : { text: "Username is available." };
  const em = form.email.trim().toLowerCase();
  const emHint = !em ? null : !/^\S+@\S+\.\S+$/.test(em) ? { bad: true, text: "Enter a valid email address." } : existingUsers.some((u) => u.email.toLowerCase() === em) ? { bad: true, text: "An account with this email already exists." } : null;
  const cfHint = !form.confirm ? null : form.confirm !== form.password ? { bad: true, text: "Passwords do not match." } : { text: "Passwords match." };

  async function doRegister() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try { await onRegister(form); } finally { setBusy(false); }
  }
  const doLogin = () => { if (identifier.trim() && password && lock === 0) onLogin(identifier, password, keep); };
  const goMode = (m) => { setMode(m); setError(""); };

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div className="auth-side-inner">
          <div className="brand-mark"><GraduationCap size={26} /></div>
          <h1>ZDSPGC<br />Centralized Alumni<br />Monitoring System</h1>
          <p>One record, every campus. Track employment outcomes, keep alumni connected, and give ZDSPGC leadership the data it needs to plan ahead.</p>
          <ul className="side-list">
            <li>20 campuses across Zamboanga del Sur</li>
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
            <p className="muted">Your alumni account is now awaiting verification by the ZDSPGC registrar's office. Once approved, log in with the username and password you just created.</p>
            <button className="btn primary" onClick={() => goMode("login")}>Back to log in</button>
          </div>
        ) : mode === "forgotSent" ? (
          <div className="auth-card">
            <UserCheck size={30} color="#1F5D4E" />
            <h2>Request received</h2>
            <p className="muted">If an account matches <strong>{identifier}</strong>, the registrar's office has been told. They will give you a temporary password. Log in with it, then change it under Edit profile.</p>
            <button className="btn primary" onClick={() => goMode("login")}>Back to log in</button>
          </div>
        ) : mode === "forgot" ? (
          <div className="auth-card" onKeyDown={(e) => { if (e.key === "Enter" && identifier.trim()) { onForgot(identifier); setMode("forgotSent"); } }}>
            <h2>Forgot your password?</h2>
            <p className="muted">Enter your username or email. The registrar's office will set a temporary password for you.</p>
            <Field label="Username or email"><input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Your username or email" /></Field>
            <button className="btn primary block" onClick={() => { onForgot(identifier); setMode("forgotSent"); }} disabled={!identifier.trim()}>Send request</button>
            <button className="link-btn" onClick={() => goMode("login")}><ArrowLeft size={13} />Back to log in</button>
          </div>
        ) : mode === "register" && !registrationOpen ? (
          <div className="auth-card">
            <AlertCircle size={30} color="#B23A34" />
            <h2>Registration is closed</h2>
            <p className="muted">{closedMessage || "New alumni registration is not open right now. Please contact the registrar's office."}</p>
            <button className="btn primary" onClick={() => goMode("login")}>Back to log in</button>
          </div>
        ) : mode === "register" ? (
          <div className="auth-card wide" onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") doRegister(); }}>
            <h2>Create alumni account</h2>
            <p className="muted">Choose your own username and password. The registrar's office checks your details against the official graduate list before you can log in.</p>
            {error && <div className="auth-error" role="alert"><AlertCircle size={15} />{error}</div>}
            <div className="form-grid">
              <Field label="Full name"><input autoFocus value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Juan Dela Cruz" /></Field>
              <Field label="Student number"><input value={form.studentNo} onChange={(e) => set("studentNo", e.target.value)} placeholder="e.g. 2022-0104" /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" /><Hint h={emHint} /></Field>
              <Field label="Username"><input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="Pick a username" autoComplete="username" /><Hint h={unHint} /></Field>
              <Field label="Campus">
                <select value={form.campus} onChange={(e) => set("campus", e.target.value)}>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="Course">
                <select value={form.course} onChange={(e) => set("course", e.target.value)}>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="Graduation year">
                <select value={form.gradYear} onChange={(e) => set("gradYear", e.target.value)}>{GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}</select>
              </Field>
              <Field label="Sex (optional)">
                <select value={form.sex} onChange={(e) => set("sex", e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option></select>
              </Field>
              <Field label="Date of birth (optional)"><input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
              <Field label="Contact number"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="09XX XXX XXXX" /></Field>
              <Field label="Address"><input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="City / Municipality" /></Field>
              <span />
              <div>
                <PwField label="Password" value={form.password} onChange={(v) => set("password", v)} placeholder="At least 6 characters" autoComplete="new-password" />
                <StrengthMeter value={form.password} />
              </div>
              <div>
                <PwField label="Confirm password" value={form.confirm} onChange={(v) => set("confirm", v)} placeholder="Type it again" autoComplete="new-password" />
                <Hint h={cfHint} />
              </div>
            </div>
            <label className="consent">
              <input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>I consent to ZDSPGC collecting and processing my information under the Data Privacy Act of 2012 (RA 10173). <button type="button" className="inline-link" onClick={(e) => { e.preventDefault(); setShowNotice(true); }}>Read the Data Privacy Notice</button></span>
            </label>
            <button className="btn primary block" onClick={doRegister} disabled={!canSubmit || busy}>{busy ? "Submitting…" : "Submit for approval"}</button>
            <button className="link-btn" onClick={() => goMode("login")}>Already have an account? Log in</button>
            {showNotice && <PrivacyNotice onClose={() => setShowNotice(false)} />}
          </div>
        ) : (
          <div className="auth-card" onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") doLogin(); }}>
            <h2>Welcome back</h2>
            <p className="muted">Log in to your ZDSPGC alumni account.</p>
            {error && <div className="auth-error" role="alert"><AlertCircle size={15} />{error}</div>}
            <Field label="Username or email"><input autoFocus value={identifier} onChange={(e) => { setIdentifier(e.target.value); if (error) setError(""); }} placeholder="Your username or email" autoComplete="username" /></Field>
            <PwField label="Password" value={password} onChange={(v) => { setPassword(v); if (error) setError(""); }} placeholder="Your password" autoComplete="current-password" />
            <div className="auth-row">
              <label className="consent inline"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /><span>Keep me signed in on this device</span></label>
              <button className="link-btn small" onClick={() => goMode("forgot")}>Forgot password?</button>
            </div>
            <button className="btn primary block" onClick={doLogin} disabled={lock > 0 || !identifier.trim() || !password}>{lock > 0 ? `Try again in ${lock}s` : "Log in"}</button>
            <button className="link-btn" onClick={() => goMode("register")}>New alumnus? Create an account</button>
            <button className="link-btn small" onClick={onAdminLogin}><ShieldCheck size={13} />Admin? Sign in here</button>
            {onBackHome && <button className="link-btn small" onClick={onBackHome}><ArrowLeft size={13} />Back to Home</button>}
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
            <li>20 campuses across Zamboanga del Sur</li>
            <li>Employment monitoring across every course</li>
            <li>Announcements, surveys, and job postings in one place</li>
          </ul>
          <div className="row-gap mt">
            <button className="btn primary" onClick={onAlumniPortal}><GraduationCap size={16} />Alumni Login / Register</button>
            <button className="btn ghost" onClick={onAdminLogin}><ShieldCheck size={16} />Admin Login</button>
          </div>
        </div>
        <div className="landing-hero-panel">
          <div className="landing-stat"><Building2 size={18} /><div><strong>20</strong><span>Campuses</span></div></div>
          <div className="landing-stat"><Users size={18} /><div><strong>Live</strong><span>Alumni records</span></div></div>
          <div className="landing-stat"><Briefcase size={18} /><div><strong>Tracked</strong><span>Employment outcomes</span></div></div>
        </div>
      </section>

      <footer className="landing-foot">© {new Date().getFullYear()} ZDSPGC — Centralized Alumni Monitoring System</footer>
    </div>
  );
}

/* ============================== ADMIN LOGIN ============================== */

function AdminLoginScreen({ error, setError, onLogin, onBackHome, onForgot, onAlumniPortal }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(true);
  const lock = useLock();

  useEffect(() => { if (lock === 0 && error && error.startsWith("Too many")) setError(""); }, [lock]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!identifier.trim() || !password || lock > 0) return;
    onLogin(identifier, password, keep);
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
        <div className="auth-card" onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") submit(); }}>
          <div className="brand-mark small solo"><Lock size={16} /></div>
          <h2>Admin Login</h2>
          <p className="muted">Enter your registered admin credentials to continue.</p>
          {error && <div className="auth-error" role="alert"><AlertCircle size={15} />{error}</div>}
          <Field label="Email or Username">
            <input autoFocus value={identifier} onChange={(e) => { setIdentifier(e.target.value); if (error) setError(""); }} placeholder="you@zdspgc.edu.ph" autoComplete="username" />
          </Field>
          <PwField label="Password" value={password} onChange={(v) => { setPassword(v); if (error) setError(""); }} placeholder="Your password" autoComplete="current-password" />
          <div className="auth-row">
            <label className="consent inline"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /><span>Keep me signed in on this device</span></label>
            <button className="link-btn small" onClick={onForgot}>Forgot Password?</button>
          </div>
          <button className="btn primary block" onClick={submit} disabled={lock > 0 || !identifier.trim() || !password}>{lock > 0 ? `Try again in ${lock}s` : "Login"}</button>
          <button className="btn ghost block" onClick={onBackHome}><ArrowLeft size={15} />Back to Home</button>
          <button className="link-btn small" onClick={onAlumniPortal}><GraduationCap size={13} />Alumni? Go to the alumni portal</button>
        </div>
      </div>
    </div>
  );
}

function AdminForgotPassword({ onBack, onRequest }) {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const send = () => { if (!identifier.trim()) return; onRequest(identifier); setSent(true); };

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
        <div className="auth-card" onKeyDown={(e) => { if (e.key === "Enter" && !sent) send(); }}>
          {sent ? (
            <>
              <UserCheck size={30} color="#1F5D4E" />
              <h2>Request received</h2>
              <p className="muted">If an admin account matches <strong>{identifier}</strong>, the request now appears for the Super Admin on the Manage Admin Accounts page. Contact the Super Admin to receive your new temporary password.</p>
              <button className="btn primary block" onClick={onBack}>Back to Admin Login</button>
            </>
          ) : (
            <>
              <h2>Forgot your password?</h2>
              <p className="muted">Enter the email or username on your admin account. Your Super Admin will need to issue a new temporary password.</p>
              <Field label="Email or Username"><input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@zdspgc.edu.ph" /></Field>
              <button className="btn primary block" onClick={send} disabled={!identifier.trim()}>Send request</button>
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
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "requests", label: "Requests", icon: FileText },
  { id: "posts", label: "Community Posts", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

// Only the Super Admin sees these — account management and the system-wide audit trail.
const SUPERADMIN_NAV = [
  { id: "manageAdmins", label: "Manage Admin Accounts", icon: UserCog },
  { id: "activityLogs", label: "Activity Logs", icon: History },
];

function AdminShell({ db, update, tab, setTab, onLogout, showToast, adminName, role, scopeCampus, addLog, currentUserId, prefs, setPrefs, sys }) {
  const isSuperAdmin = role === "superadmin";
  // Campus Admins only ever see data for their assigned campus; Super Admin sees everything.
  // This filtering happens once, here, so every admin page below just reads `scopedDb`.
  const scopedDb = scopeCampus ? { ...db, alumni: db.alumni.filter((a) => a.campus === scopeCampus) } : db;
  const pendingList = scopedDb.alumni.filter((a) => a.accountStatus === "pending");
  const pendingCount = pendingList.length;
  const nav = isSuperAdmin ? [...ADMIN_NAV, ...SUPERADMIN_NAV] : ADMIN_NAV;
  const t = nav.some((n) => n.id === tab) || tab === "settings" ? tab : "dashboard";

  const [hlId, setHlId] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  const [editingMe, setEditingMe] = useState(false);
  const shownOnce = useRef(false);
  const prevPending = useRef(null);
  const nextPending = pendingList.find((a) => !skipped.includes(a.id));
  const reviewing = reviewId ? pendingList.find((a) => a.id === reviewId) : null;

  // The alumni record pops up automatically so the admin can check it is a real graduate:
  // once after login, and every time the Verification page is open with someone waiting.
  useEffect(() => {
    if (!nextPending || reviewing) return;
    if (t === "verification" || !shownOnce.current) { shownOnce.current = true; setReviewId(nextPending.id); }
  }, [nextPending?.id, t, !!reviewing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevPending.current !== null && pendingCount > prevPending.current) showToast("New alumni registration is waiting for verification.");
    prevPending.current = pendingCount;
  }, [pendingCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function decide(a, status) {
    if (status === "approved" && sys.unlistedRule === "block" && (db.roster || []).length && matchRoster(a, db.roster).level === "none") {
      showToast("Not on the official graduate list. The Super Admin has turned on blocking for this.");
      return;
    }
    update("alumni", (list) => list.map((x) => (x.id === a.id ? { ...x, accountStatus: status, updatedAt: now() } : x)));
    update("notifications", (list) => [...list, { id: uid("notif"), title: status === "approved" ? "Account verified" : "Registration rejected", message: status === "approved" ? "Your ZDSPGC alumni account has been verified. You can now log in and access all features." : "Your registration could not be verified against school records. Please contact the registrar's office.", audience: { type: "alumni", value: a.id }, createdAt: now(), readBy: [] }]);
    setReviewId(null);
    if (status === "approved") {
      showToast(`${a.fullName} approved and added to Alumni Records.`);
      setHlId(a.id);
      setTab("records");
      setTimeout(() => setHlId((cur) => (cur === a.id ? null : cur)), 8000);
    } else {
      showToast(`${a.fullName} rejected.`);
    }
  }

  return (
    <div className="shell">
      <Sidebar
        nav={nav} tab={t} setTab={setTab} onLogout={onLogout} badgeMap={{ verification: pendingCount, requests: (db.requests || []).filter((r) => r.kind === "document" && r.status === "Pending" && (!scopeCampus || r.campus === scopeCampus)).length }}
        roleLabel={isSuperAdmin ? "Super Admin" : `Campus Admin — ${scopeCampus}`}
        personName={adminName}
      />
      <main className="main">
        <TopBar name={adminName} roleLabel={isSuperAdmin ? "Super Admin" : `Campus Admin \u2014 ${scopeCampus}`} onEdit={() => setEditingMe(true)} onSettings={() => setTab("settings")} onLogout={onLogout} />
        {editingMe && <EditProfileModal db={db} update={update} showToast={showToast} user={db.users.find((u) => u.id === currentUserId)} addLog={addLog} onClose={() => setEditingMe(false)} />}
        {t === "settings" && <SettingsPage db={db} update={update} showToast={showToast} prefs={prefs} setPrefs={setPrefs} sys={sys} role={role} user={db.users.find((u) => u.id === currentUserId)} onEditProfile={() => setEditingMe(true)} onLogout={onLogout} />}
        {t === "dashboard" && <AdminDashboard db={scopedDb} setTab={setTab} />}
        {t === "records" && <AlumniRecords db={scopedDb} update={update} showToast={showToast} lockCampus={scopeCampus} highlightId={hlId} addLog={addLog} actorName={adminName} />}
        {t === "verification" && (
          <Verification
            db={scopedDb} update={update} showToast={showToast} onDecide={decide} blockUnlisted={sys.unlistedRule === "block"} roster={db.roster || []}
            onReview={(id) => { setSkipped((x) => x.filter((y) => y !== id)); setReviewId(id); }}
            onReviewAll={() => { setSkipped([]); setReviewId(pendingList[0]?.id || null); }}
          />
        )}
        {t === "employment" && <EmploymentMonitoring db={scopedDb} />}
        {t === "notifications" && <NotificationsAdmin db={db} update={update} showToast={showToast} lockCampus={scopeCampus} />}
        {t === "surveys" && <SurveysAdmin db={db} update={update} showToast={showToast} />}
        {t === "jobs" && <JobsAdmin db={db} update={update} showToast={showToast} />}
        {t === "requests" && <RequestsAdmin db={scopedDb} update={update} showToast={showToast} lockCampus={scopeCampus} />}
        {t === "events" && <EventsAdmin db={db} update={update} showToast={showToast} lockCampus={scopeCampus} />}
        {t === "posts" && <PostsAdmin db={db} update={update} showToast={showToast} adminName={adminName} adminId={currentUserId} />}
        {t === "reports" && <Reports db={scopedDb} />}
        {/* Manage Admin Accounts and Activity Logs are Super Admin–only. Even if a Campus
            Admin somehow set tab to these ids, isSuperAdmin below blocks the render. */}
        {t === "manageAdmins" && isSuperAdmin && <ManageAdmins db={db} update={update} showToast={showToast} addLog={addLog} currentUserId={currentUserId} />}
        {t === "activityLogs" && isSuperAdmin && <ActivityLogs db={db} />}
      </main>
      {reviewing && (
        <ReviewModal
          alumnus={reviewing} roster={db.roster || []} blockUnlisted={sys.unlistedRule === "block"}
          position={pendingList.findIndex((a) => a.id === reviewing.id) + 1} total={pendingList.length}
          onApprove={() => decide(reviewing, "approved")} onReject={() => decide(reviewing, "rejected")}
          onLater={() => { setSkipped((x) => [...x, reviewing.id]); setReviewId(null); }}
          onClose={() => { setSkipped(pendingList.map((x) => x.id)); setReviewId(null); }}
        />
      )}
    </div>
  );
}

const DEFAULT_PREFS = { textSize: "normal", compact: false, reduceMotion: false, autoLogout: 0, refreshSec: 10 };
const DEFAULT_SYSTEM = { registrationOpen: true, closedMessage: "", bannerOn: false, bannerText: "", unlistedRule: "warn" };

// Saves a text file from the browser (used for the data downloads in Settings).
function saveFile(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={"switch" + (checked ? " on" : "")} onClick={() => onChange(!checked)}><span /></button>
  );
}

function SettingRow({ title, desc, children }) {
  return (
    <div className="set-row">
      <div><div className="set-title">{title}</div>{desc && <div className="set-desc">{desc}</div>}</div>
      <div className="set-ctl">{children}</div>
    </div>
  );
}

function SettingsPage({ db, update, showToast, prefs, setPrefs, sys, role, user, alumnus, onEditProfile, onOpenProfile, onLogout }) {
  const isSuper = role === "superadmin";
  const isAlumni = !!alumnus;
  const [draft, setDraft] = useState(sys);
  const [busy, setBusy] = useState(false);
  const st = alumnus?.profile?.settings || {};

  async function setAlumniSetting(k, v) {
    const ok = await update("alumni", (list) => list.map((a) => (a.id === alumnus.id ? { ...a, profile: { ...(a.profile || {}), settings: { ...((a.profile || {}).settings || {}), [k]: v } }, updatedAt: now() } : a)));
    if (ok) showToast("Setting saved.");
  }
  async function saveSystem() {
    setBusy(true);
    const ok = await update("settings", (list) => (list.some((s) => s.id === "system") ? list.map((s) => (s.id === "system" ? { ...s, value: draft } : s)) : [...list, { id: "system", value: draft, createdAt: now() }]));
    setBusy(false);
    if (ok) showToast("System settings saved.");
  }
  function downloadMine() {
    const mine = { exportedAt: now(), account: { name: user.name, email: user.email, username: user.username }, record: alumnus, posts: db.posts.filter((p) => p.authorId === alumnus.id) };
    saveFile("my-zdspgc-data.json", JSON.stringify(mine, null, 2), "application/json");
    showToast("Your data was downloaded.");
  }
  function downloadBackup() {
    const safe = { ...db, users: db.users.map(({ password, ...u }) => u) };
    saveFile(`zdspgc-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(safe, null, 2), "application/json");
    showToast("Backup downloaded (passwords are not included).");
  }

  return (
    <div>
      <PageHead eyebrow="Preferences" title="Settings" />

      <div className="set-panel">
        <h3>Account</h3>
        <SettingRow title="Your profile" desc={`${user.name} · ${user.email}`}>
          <div className="row-gap">
            <button className="btn ghost" onClick={onEditProfile}><Edit2 size={15} />Edit profile</button>
            {isAlumni && <button className="btn ghost" onClick={onOpenProfile}>Full profile</button>}
          </div>
        </SettingRow>
        <SettingRow title="Sign out of this device" desc="Ends your session here. Other devices stay signed in."><button className="btn ghost" onClick={onLogout}><LogOut size={15} />Log out</button></SettingRow>
      </div>

      <div className="set-panel">
        <h3>Appearance</h3>
        <p className="set-note">Saved on this device only.</p>
        <SettingRow title="Text size" desc="Makes everything easier to read.">
          <select aria-label="Text size" value={prefs.textSize} onChange={(e) => setPrefs({ textSize: e.target.value })}>
            <option value="normal">Normal</option><option value="large">Large</option><option value="xlarge">Extra large</option>
          </select>
        </SettingRow>
        <SettingRow title="Compact tables" desc="Fits more rows on the screen."><Toggle label="Compact tables" checked={prefs.compact} onChange={(v) => setPrefs({ compact: v })} /></SettingRow>
        <SettingRow title="Reduce motion" desc="Turns off animations."><Toggle label="Reduce motion" checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} /></SettingRow>
      </div>

      <div className="set-panel">
        <h3>Security and updates</h3>
        <p className="set-note">Saved on this device only.</p>
        <SettingRow title="Sign out when inactive" desc="Protects your account on shared computers.">
          <select aria-label="Sign out when inactive" value={prefs.autoLogout} onChange={(e) => setPrefs({ autoLogout: Number(e.target.value) })}>
            <option value={0}>Never</option><option value={15}>After 15 minutes</option><option value={30}>After 30 minutes</option><option value={60}>After 1 hour</option>
          </select>
        </SettingRow>
        <SettingRow title="Check for new data" desc="How often new registrations and changes appear without refreshing.">
          <select aria-label="Check for new data" value={prefs.refreshSec} onChange={(e) => setPrefs({ refreshSec: Number(e.target.value) })}>
            <option value={10}>Every 10 seconds</option><option value={30}>Every 30 seconds</option><option value={60}>Every minute</option>
          </select>
        </SettingRow>
      </div>

      {isAlumni && (
        <div className="set-panel">
          <h3>Notifications and community</h3>
          <p className="set-note">These follow your account on every device.</p>
          <SettingRow title="Only show announcements meant for me" desc="Hides announcements sent to all alumni. You still see ones for your campus, course or batch.">
            <Toggle label="Only show announcements meant for me" checked={!!st.onlyMine} onChange={(v) => setAlumniSetting("onlyMine", v)} />
          </SettingRow>
          <SettingRow title="Allow comments on my posts" desc="When off, other alumni can still like and save your posts but cannot comment.">
            <Toggle label="Allow comments on my posts" checked={st.allowComments !== false} onChange={(v) => setAlumniSetting("allowComments", v)} />
          </SettingRow>
        </div>
      )}

      <div className="set-panel">
        <h3>Your data</h3>
        {isAlumni && <SettingRow title="Download my data" desc="Your alumni record and your posts as a file."><button className="btn ghost" onClick={downloadMine}><Download size={15} />Download</button></SettingRow>}
        {isSuper && <SettingRow title="Download a full backup" desc="Every table in one file. Passwords are left out."><button className="btn ghost" onClick={downloadBackup}><Download size={15} />Download backup</button></SettingRow>}
        {!isAlumni && !isSuper && <p className="set-note" style={{ padding: "8px 0" }}>Use Reports to export your campus alumni list as a CSV.</p>}
      </div>

      {isSuper && (
        <div className="set-panel">
          <h3>System settings</h3>
          <p className="set-note">Only the Super Admin can change these. They apply to everyone.</p>
          <SettingRow title="Allow new registrations" desc="Turn off to stop new alumni from signing up.">
            <Toggle label="Allow new registrations" checked={draft.registrationOpen} onChange={(v) => setDraft({ ...draft, registrationOpen: v })} />
          </SettingRow>
          {!draft.registrationOpen && (
            <div className="set-stack"><Field label="Message shown instead of the sign-up form"><input type="text" value={draft.closedMessage} onChange={(e) => setDraft({ ...draft, closedMessage: e.target.value })} placeholder="Registration is closed. Please visit the registrar's office." /></Field></div>
          )}
          <SettingRow title="Banner for everyone" desc="Shows a notice at the top of every page.">
            <Toggle label="Banner for everyone" checked={draft.bannerOn} onChange={(v) => setDraft({ ...draft, bannerOn: v })} />
          </SettingRow>
          {draft.bannerOn && (
            <div className="set-stack"><Field label="Banner text"><input type="text" value={draft.bannerText} onChange={(e) => setDraft({ ...draft, bannerText: e.target.value })} placeholder="e.g. Grand Alumni Homecoming on December 14" /></Field></div>
          )}
          <SettingRow title="If a registrant is not on the official list" desc="Applies when admins verify new alumni.">
            <select aria-label="Unlisted rule" value={draft.unlistedRule} onChange={(e) => setDraft({ ...draft, unlistedRule: e.target.value })}>
              <option value="warn">Show a warning only</option><option value="block">Block approval</option>
            </select>
          </SettingRow>
          <div className="set-stack"><button className="btn primary" onClick={saveSystem} disabled={busy}>Save system settings</button></div>
        </div>
      )}
    </div>
  );
}

function EditProfileModal({ db, update, showToast, user, alumnus, addLog, onClose }) {
  const [f, setF] = useState({ name: user.name || "", email: user.email || "", username: user.username || "", phone: alumnus?.phone || "", address: alumnus?.address || "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    const name = f.name.trim(), email = f.email.trim(), un = f.username.trim();
    if (!name) { setErr("Name cannot be empty."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr("Enter a valid email address."); return; }
    if (un && (un.length < 4 || /\s/.test(un))) { setErr("Username needs at least 4 characters and no spaces."); return; }
    if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) { setErr("That email is already used by another account."); return; }
    if (un && db.users.some((u) => u.id !== user.id && (u.username || "").toLowerCase() === un.toLowerCase())) { setErr("That username is already taken."); return; }
    if (f.password && f.password.length < 6) { setErr("New password needs at least 6 characters."); return; }
    if (f.password && f.password !== f.confirm) { setErr("The new passwords do not match."); return; }
    setBusy(true);
    const newHash = f.password ? await hashPassword(f.password) : null;
    const ok1 = await update("users", (list) => list.map((u) => (u.id === user.id ? { ...u, name, email, username: un || u.username, ...(newHash ? { password: newHash } : {}) } : u)));
    let ok2 = true;
    if (alumnus) {
      ok2 = await update("alumni", (list) => list.map((a) => (a.id === alumnus.id ? { ...a, fullName: name, email, phone: f.phone.trim(), address: f.address.trim(), updatedAt: now() } : a)));
      update("posts", (list) => list.map((p) => (p.authorId === alumnus.id ? { ...p, authorName: name } : p)));
    } else if (addLog) {
      addLog(user.name, "Updated own profile");
    }
    setBusy(false);
    if (!ok1 || !ok2) { setErr("We could not save your changes. Please try again."); return; }
    showToast("Profile updated.");
    onClose();
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      {err && <div className="auth-error" role="alert"><AlertCircle size={15} />{err}</div>}
      <div className="form-grid">
        <Field label={alumnus ? "Full name" : "Name"}><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Username"><input value={f.username} onChange={(e) => set("username", e.target.value)} autoComplete="username" /></Field>
        {alumnus && <Field label="Contact number"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>}
        {alumnus && <Field label="Address"><input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>}
      </div>
      <h4 className="section-title">Change password (optional)</h4>
      <div className="form-grid">
        <PwField label="New password" value={f.password} onChange={(v) => set("password", v)} autoComplete="new-password" />
        <PwField label="Confirm new password" value={f.confirm} onChange={(v) => set("confirm", v)} autoComplete="new-password" />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>Save changes</button>
      </div>
    </Modal>
  );
}

function TopBar({ name, roleLabel, photo, onProfile, onEdit, onSettings, onLogout }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="topbar">
      <div className="topbar-profile" ref={box}>
        <button className="profile-chip" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          <span className={"tb-avatar" + (photo ? " has-img" : "")}>{photo ? <img src={photo} alt="" /> : (name?.[0] || "?")}</span>
          <span className="tb-text"><span className="tb-name">{name}</span><span className="tb-role">{roleLabel}</span></span>
          <ChevronRight size={15} className={"tb-caret" + (open ? " open" : "")} />
        </button>
        {open && (
          <div className="profile-menu" role="menu">
            <div className="profile-menu-head"><strong>{name}</strong><span>{roleLabel}</span></div>
            {onEdit && <button role="menuitem" onClick={() => { setOpen(false); onEdit(); }}><Edit2 size={15} />Edit profile</button>}
            {onProfile && <button role="menuitem" onClick={() => { setOpen(false); onProfile(); }}><Users size={15} />My Profile</button>}
            {onSettings && <button role="menuitem" onClick={() => { setOpen(false); onSettings(); }}><SettingsIcon size={15} />Settings</button>}
            <button role="menuitem" className="danger" onClick={() => { setOpen(false); onLogout(); }}><LogOut size={15} />Log out</button>
          </div>
        )}
      </div>
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
        <button className="logout-btn" onClick={onLogout}><LogOut size={15} /><span>Log out</span></button>
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

function AlumniRecords({ db, update, showToast, lockCampus, highlightId, addLog, actorName }) {
  const [creds, setCreds] = useState(null);
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
  const [viewing, setViewing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const resetCount = db.alumni.filter((a) => a.profile?.resetRequestedAt).length;

  async function resetAlumniPassword(a, pw) {
    const pwHash = await hashPassword(pw);
    const ok = await update("users", (list) => list.map((u) => (u.alumniId === a.id && u.role === "alumni" ? { ...u, password: pwHash } : u)));
    update("alumni", (list) => list.map((x) => (x.id === a.id ? { ...x, profile: { ...(x.profile || {}), resetRequestedAt: null } } : x)));
    setResetting(null);
    if (ok) { if (addLog) addLog(actorName || "Admin", "Reset alumni password", a.fullName); showToast(`Temporary password set for ${a.fullName}.`); }
  }

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById("row-" + highlightId);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  const filtered = db.alumni.filter((a) =>
    (!q || a.fullName.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase())) &&
    (!effectiveCampus || a.campus === effectiveCampus) &&
    (!fCourse || a.course === fCourse) &&
    (!fYear || a.gradYear === fYear) &&
    (!fStatus || a.employment?.status === fStatus)
  );

  async function saveRecord(form, id) {
    const dupName = db.alumni.some((a) => a.id !== id && a.fullName.toLowerCase() === form.fullName.trim().toLowerCase() && a.gradYear === form.gradYear && a.course === form.course);
    const dupEmail = db.alumni.some((a) => a.id !== id && a.email.toLowerCase() === form.email.trim().toLowerCase())
      || db.users.some((u) => u.alumniId !== id && u.email.toLowerCase() === form.email.trim().toLowerCase());
    if (dupName || dupEmail) { showToast("A matching alumni record or email already exists."); return; }
    if (id) {
      update("alumni", (list) => list.map((a) => (a.id === id ? { ...a, ...form, updatedAt: now() } : a)));
      // Keep the linked login's email in sync if it was changed here.
      update("users", (list) => list.map((u) => (u.alumniId === id ? { ...u, email: form.email.trim(), name: form.fullName.trim() } : u)));
      showToast("Record updated.");
    } else {
      const rec = { id: uid("al"), ...form, employment: form.employment || { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false }, accountStatus: "approved", createdAt: now(), updatedAt: now() };
      const tempPw = makeTempPassword();
      const loginUser = { id: uid("user"), email: form.email.trim(), password: await hashPassword(tempPw), role: "alumni", alumniId: rec.id, name: form.fullName.trim(), createdAt: now() };
      update("alumni", (list) => [...list, rec]);
      update("users", (list) => [...list, loginUser]);
      setCreds([{ name: form.fullName.trim(), email: form.email.trim(), password: tempPw }]);
      showToast("Alumni record added and login created.");
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
  async function importRecords(validRows) {
    const newAlumni = validRows.map((r) => ({
      id: uid("al"), fullName: r.fullName, campus: r.campus, course: r.course, gradYear: r.gradYear,
      email: r.email, phone: r.phone, address: r.address, employment: r.employment,
      accountStatus: "approved", createdAt: now(), updatedAt: now(),
    }));
    const plain = newAlumni.map(() => makeTempPassword());
    const hashes = await Promise.all(plain.map((p) => hashPassword(p)));
    const newUsers = newAlumni.map((a, i) => ({
      id: uid("user"), email: a.email, password: hashes[i], role: "alumni", alumniId: a.id, name: a.fullName, createdAt: now(),
    }));
    update("alumni", (list) => [...list, ...newAlumni]);
    update("users", (list) => [...list, ...newUsers]);
    setCreds(newUsers.map((u, i) => ({ name: u.name, email: u.email, password: plain[i] })));
    showToast(`Imported ${newAlumni.length} alumni record${newAlumni.length === 1 ? "" : "s"}.`);
    setImporting(false);
  }

  return (
    <div>
      {creds && <CredentialsModal title="Login accounts created" rows={creds} onClose={() => setCreds(null)} />}
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

      {resetCount > 0 && <div className="reset-banner">{resetCount} alumni asked for a password reset. Use the key icon on their row to set a temporary password.</div>}
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
              <tr key={a.id} id={"row-" + a.id} className={a.id === highlightId ? "hl-row" : ""}>
                <td><div className="cell-name"><div className="mini-avatar">{a.fullName[0]}</div>{a.fullName}{a.profile?.resetRequestedAt && <span className="reset-chip">Reset requested</span>}</div></td>
                <td>{a.campus}</td>
                <td>{a.course}</td>
                <td>{a.gradYear}</td>
                <td><EmpTag status={a.employment?.status} /></td>
                <td><Seal status={a.accountStatus} /></td>
                <td className="row-actions">
                  <button className="icon-btn" aria-label="Reset password" title="Reset password" onClick={() => setResetting(a)}><KeyRound size={15} /></button>
                  <button className="icon-btn" aria-label="View record" onClick={() => setViewing(a)}><Eye size={15} /></button>
                  <button className="icon-btn" aria-label="Edit record" onClick={() => setEditing(a)}><Edit2 size={15} /></button>
                  <button className="icon-btn danger" onClick={() => setConfirmDel(a)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7}><EmptyState icon={Users} text="No alumni match these filters." /></td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <AlumniFormModal record={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={saveRecord} lockCampus={lockCampus} />}
      {resetting && <ResetAlumniPasswordModal alumnus={resetting} hasLogin={db.users.some((u) => u.alumniId === resetting.id && u.role === "alumni")} onClose={() => setResetting(null)} onSave={(pw) => resetAlumniPassword(resetting, pw)} />}
      {viewing && <ViewAlumniModal a={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
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
      <p className="muted">Add many alumni records at once, right here — no separate file required. Each valid row also gets a login account with its own random temporary password, shown to you once when the import finishes.</p>
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

      {parseError && <div className="auth-error" role="alert"><AlertCircle size={15} />{parseError}</div>}

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
    email: "", phone: "", address: "", employment: { status: "Unemployed", company: "", position: "", location: "", dateEmployed: "", related: false }, profile: {},
  });
  const prof = form.profile || {};
  const setProf = (k, v) => setForm({ ...form, profile: { ...prof, [k]: v } });
  const emp = form.employment || {};
  const setEmp = (patch) => setForm({ ...form, employment: { ...emp, ...patch } });

  return (
    <Modal title={record ? "Edit alumni record" : "Add alumni record"} onClose={onClose} wide>
      {!record && <p className="muted" style={{ marginTop: -4, marginBottom: 12 }}>A login account is created automatically with a random temporary password, shown to you once after you save.</p>}
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
      <details className="more-details">
        <summary>More details (Annex A: identity, academic, licensure, engagement, tracer study)</summary>
        <AnnexFields values={prof} onChange={setProf} />
        <h4 className="section-title">System records</h4>
        <div className="form-grid">
          <Field label="Record status">
            <select value={prof.recordStatus || "Active"} onChange={(e) => setProf("recordStatus", e.target.value)}><option>Active</option><option>Inactive</option><option>Deceased</option></select>
          </Field>
        </div>
      </details>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(form, record?.id)} disabled={!form.fullName || !form.email}>Save record</button>
      </div>
    </Modal>
  );
}

/* -------- Annex A form / view helpers -------- */

function AnnexFields({ values, onChange }) {
  return ANNEX.map((c) => (
    <div key={c.cat}>
      <h4 className="section-title">{c.cat}</h4>
      <div className="form-grid">
        {c.fields.map(([k, label, type]) => (
          <Field key={k} label={label}>
            {Array.isArray(type) ? (
              <select value={values[k] || ""} onChange={(e) => onChange(k, e.target.value)}>
                <option value="">Select</option>
                {type.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : type === "area" ? (
              <textarea rows={2} value={values[k] || ""} onChange={(e) => onChange(k, e.target.value)} />
            ) : (
              <input type={type || "text"} value={values[k] || ""} onChange={(e) => onChange(k, e.target.value)} />
            )}
          </Field>
        ))}
      </div>
    </div>
  ));
}

function ViewRows({ title, rows }) {
  return (
    <div className="view-block">
      <h4 className="section-title">{title}</h4>
      <div className="view-rows">
        {rows.map(([l, v]) => <div className="view-row" key={l}><span>{l}</span><strong>{v || "\u2014"}</strong></div>)}
      </div>
    </div>
  );
}

function ResetAlumniPasswordModal({ alumnus, hasLogin, onClose, onSave }) {
  const [pw, setPw] = useState("");
  const gen = () => setPw(makeTempPassword());
  return (
    <Modal title={`Reset password — ${alumnus.fullName}`} onClose={onClose}>
      {!hasLogin ? (
        <p>This record has no login account yet, so there is no password to reset.</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: -4 }}>Set a temporary password, then tell {alumnus.fullName.split(" ")[0]} in person or by phone. They can change it under Edit profile after logging in.</p>
          <Field label="Temporary password"><input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" /></Field>
          <button className="link-btn small" onClick={gen}>Generate one for me</button>
        </>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        {hasLogin && <button className="btn primary" onClick={() => onSave(pw)} disabled={pw.length < 6}><KeyRound size={15} />Reset password</button>}
      </div>
    </Modal>
  );
}

function ViewAlumniModal({ a, onClose, onEdit }) {
  const p = a.profile || {};
  const e = a.employment || {};
  return (
    <Modal title={a.fullName} onClose={onClose} wide>
      <ViewRows title="School record" rows={[["Student number", p.studentNo], ["Campus", a.campus], ["Course", a.course], ["Graduation year", a.gradYear], ["Account", a.accountStatus]]} />
      <ViewRows title="Contact" rows={[["Email", a.email], ["Phone", a.phone], ["Current address", a.address]]} />
      <ViewRows title="Employment" rows={[["Status", e.status], ["Company / business", e.company], ["Position", e.position], ["Location", e.location], ["Date employed", e.dateEmployed], ["Related to course", e.related ? "Yes" : "No"]]} />
      {ANNEX.map((c) => <ViewRows key={c.cat} title={c.cat} rows={c.fields.map(([k, l]) => [l, p[k]])} />)}
      <ViewRows title="System records" rows={[["Record status", p.recordStatus || "Active"], ["Data privacy consent", p.consent ? `Yes, ${fmtDate(p.consentDate)}` : "\u2014"], ["Date created", fmtDate(a.createdAt)], ["Last updated", fmtDate(a.updatedAt)]]} />
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={onEdit}><Edit2 size={15} />Edit record</button>
      </div>
    </Modal>
  );
}

function ReviewModal({ alumnus: a, roster, blockUnlisted, position, total, onApprove, onReject, onLater, onClose }) {
  const m = matchRoster(a, roster);
  const blocked = !!blockUnlisted && roster.length > 0 && m.level === "none";
  const r = m.record;
  const banner = m.level === "ok"
    ? { cls: "ok", text: "Match found. This person is in the official graduate list." }
    : m.level === "warn"
      ? { cls: "warn", text: "Partial match. Some details differ from the official list. Check the highlighted rows." }
      : { cls: "none", text: roster.length ? "Not found in the official graduate list. Confirm with the registrar before approving." : "The official graduate list is empty. Import it from the Verification page so registrations can be checked." };
  const rows = [
    ["Student number", a.profile?.studentNo, r?.studentNo],
    ["Name", a.fullName, r?.fullName],
    ["Campus", a.campus, r?.campus],
    ["Course", a.course, r?.course],
    ["Graduation year", a.gradYear, r?.gradYear],
  ];
  return (
    <Modal title="Verify alumni" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: -4 }}>Registration {position} of {total}</p>
      <div className={"match-banner " + banner.cls}>{banner.text}</div>
      <div className="cmp-table">
        <div className="cmp-row head"><span /><strong>Submitted</strong><strong>Official list</strong></div>
        {rows.map(([label, sub, off]) => (
          <div key={label} className={"cmp-row" + (r && norm(sub) !== norm(off) ? " diff" : "")}>
            <span className="cmp-label">{label}</span><span>{sub || "\u2014"}</span><span>{r ? (off || "\u2014") : "\u2014"}</span>
          </div>
        ))}
      </div>
      <div className="profile-rows" style={{ marginTop: 12 }}>
        <div><Mail size={14} />{a.email}</div>
        <div><Phone size={14} />{a.phone || "\u2014"}</div>
        <div><MapPin size={14} />{a.address || "\u2014"}</div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onLater}>Decide later</button>
        <button className="btn danger outline" onClick={onReject}><UserX size={15} />Reject</button>
        <button className="btn primary" onClick={onApprove} disabled={blocked} title={blocked ? "Blocked: not on the official graduate list" : undefined}><UserCheck size={15} />Approve</button>
      </div>
    </Modal>
  );
}

function RosterImportModal({ existing, onClose, onImport }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  function readFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result || ""));
    rd.readAsText(f);
  }
  function submit() {
    const t = text.trim();
    const rows = t ? parseCSV(t, detectDelimiter(t)) : [];
    if (rows.length < 2) { setErr("Paste or upload a header row and at least one student."); return; }
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const ix = (n) => head.indexOf(n);
    const c = { no: ix("student number"), name: ix("full name"), campus: ix("campus"), course: ix("course"), year: ix("graduation year") };
    if (c.no < 0 || c.name < 0) { setErr('The first row must include "Student Number" and "Full Name" columns.'); return; }
    const have = new Set(existing.map((r) => norm(r.studentNo)));
    const out = [];
    rows.slice(1).forEach((r) => {
      const no = (r[c.no] || "").trim(); const name = (r[c.name] || "").trim();
      if (!no || !name || have.has(norm(no))) return;
      have.add(norm(no));
      out.push({ id: uid("ros"), studentNo: no, fullName: name, campus: c.campus >= 0 ? (r[c.campus] || "").trim() : "", course: c.course >= 0 ? (r[c.course] || "").trim() : "", gradYear: c.year >= 0 ? (r[c.year] || "").trim() : "", createdAt: now() });
    });
    if (!out.length) { setErr("No new students found. The rows were empty or already in the list."); return; }
    onImport(out);
  }
  return (
    <Modal title="Official graduate list" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: -4 }}>Paste rows from Excel or upload a CSV. Columns: <strong>Student Number, Full Name, Campus, Course, Graduation Year</strong>. Registrations are checked against this list on the Verification page. {existing.length} students are in the list now.</p>
      <Field label="CSV file"><input type="file" accept=".csv,text/csv,text/plain" onChange={readFile} /></Field>
      <Field label="Or paste the rows here">
        <textarea rows={7} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder={"Student Number,Full Name,Campus,Course,Graduation Year\n2022-0104,Juan Dela Cruz,Aurora Campus,BS Information Systems,2022"} />
      </Field>
      {err && <div className="auth-error" role="alert"><AlertCircle size={15} />{err}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}><Upload size={15} />Add to list</button>
      </div>
    </Modal>
  );
}

/* -------- Verification -------- */

function Verification({ db, update, showToast, onDecide, onReview, onReviewAll, blockUnlisted, roster: rosterAll }) {
  const pending = db.alumni.filter((a) => a.accountStatus === "pending");
  const decided = db.alumni.filter((a) => a.accountStatus !== "pending").slice(-8).reverse();
  const roster = db.roster || [];
  const [importing, setImporting] = useState(false);

  return (
    <div>
      <PageHead
        eyebrow={`${pending.length} awaiting review`} title="Account Verification"
        action={
          <div className="row-gap">
            {!!pending.length && <button className="btn primary" onClick={onReviewAll}><ShieldCheck size={16} />Review {pending.length} pending</button>}
            <button className="btn ghost" onClick={() => setImporting(true)}><Upload size={16} />Official graduate list ({roster.length})</button>
          </div>
        }
      />
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
                <div><FileText size={13} />Student no. {a.profile?.studentNo || "\u2014"}</div>
                <div><Building2 size={13} />{a.campus}</div>
                <div><GraduationCap size={13} />Batch {a.gradYear}</div>
                <div><Mail size={13} />{a.email}</div>
                <div><Phone size={13} />{a.phone}</div>
                <div><MapPin size={13} />{a.address}</div>
              </div>
              <div className="verify-actions">
                <button className="btn danger outline" onClick={() => onDecide(a, "rejected")}><UserX size={15} />Reject</button>
                <button className="btn ghost" onClick={() => onReview(a.id)}><Eye size={15} />Review</button>
                <button className="btn primary" onClick={() => onDecide(a, "approved")} disabled={!!blockUnlisted && (rosterAll || []).length > 0 && matchRoster(a, rosterAll).level === "none"} title="Approve"><UserCheck size={15} />Approve</button>
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
      {importing && (
        <RosterImportModal
          existing={roster} onClose={() => setImporting(false)}
          onImport={(rows) => { update("roster", (list) => [...list, ...rows]); showToast(`${rows.length} students added to the official list.`); setImporting(false); }}
        />
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

  async function send(form) {
    setComposing(false);
    const ok = await update("notifications", (list) => [...list, { id: uid("notif"), title: form.title.trim(), message: form.message.trim(), audience: form.audience, createdAt: now(), readBy: [] }]);
    showToast(ok ? "Notification sent." : "The notification was NOT saved to the server. Please send it again.");
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

  async function createSurvey(form) {
    setCreating(false);
    const ok = await update("surveys", (list) => [...list, { id: uid("survey"), title: form.title.trim(), createdAt: now(), questions: form.questions, responses: [] }]);
    showToast(ok ? "Survey published." : "The survey was NOT saved to the server. Please publish it again.");
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
  const [seeing, setSeeing] = useState(null);
  const apps = (jobId) => (db.requests || []).filter((r) => r.kind === "application" && r.targetId === jobId && r.status !== "Cancelled");

  async function post(form) {
    setCreating(false);
    const ok = await update("jobs", (list) => [{ id: uid("job"), ...form, postedAt: now() }, ...list]);
    showToast(ok ? "Job opportunity posted. Alumni will see it within about 10 seconds." : "The job was NOT saved to the server. Check your connection or the database setup, then post it again.");
  }
  function remove(id) {
    update("jobs", (list) => list.filter((j) => j.id !== id));
    showToast("Job posting removed.");
  }
  const csv = (j) => saveFile(`applicants-${j.title.replace(/\W+/g, "-")}.csv`, "Name,Course,Batch,Campus,Email,Phone,Message,Date\n" + apps(j.id).map((r) => { const a = db.alumni.find((x) => x.id === r.alumniId) || {}; return [r.alumniName, a.course, a.gradYear, a.campus, a.email, a.phone, r.details, fmtDate(r.createdAt)].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","); }).join("\n"), "text/csv");

  return (
    <div>
      <PageHead eyebrow={`${db.jobs.length} postings`} title="Job Opportunity Board" action={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />Post Job</button>} />
      <div className="cards-grid">
        {db.jobs.map((j) => (
          <div className="simple-card" key={j.id}>
            <div className="job-card-head">
              <Briefcase size={18} color="#1F5D4E" />
              <button className="icon-btn danger" aria-label="Delete job" onClick={() => remove(j.id)}><Trash2 size={15} /></button>
            </div>
            <div className="mini-name">{j.title}</div>
            <div className="mini-sub">{j.company} · {j.location}</div>
            <p className="list-card-text">{j.requirements}</p>
            <div className="badge-soft">Deadline: {fmtDate(j.deadline)}</div>
            <button className="link-btn small" onClick={() => setSeeing(j)}>{apps(j.id).length} interested · see list</button>
          </div>
        ))}
        {!db.jobs.length && <EmptyState icon={Briefcase} text="No job postings yet." />}
      </div>
      {creating && (
        <Modal title="Post job opportunity" onClose={() => setCreating(false)}>
          <JobForm onSubmit={post} onCancel={() => setCreating(false)} />
        </Modal>
      )}
      {seeing && (
        <Modal title={`Interested alumni \u2014 ${seeing.title}`} onClose={() => setSeeing(null)} wide>
          <div className="stack">
            {apps(seeing.id).map((r) => { const a = db.alumni.find((x) => x.id === r.alumniId); return (
              <div className="list-card" key={r.id}>
                <div className="list-card-head"><Avatar src={a?.profile?.photo} name={r.alumniName} /><div style={{ flex: 1 }}><div className="mini-name">{r.alumniName}</div><div className="mini-sub">{a ? `${a.course} · Batch ${a.gradYear} · ${a.email}${a.phone ? " · " + a.phone : ""}` : ""}</div></div><div className="mini-sub">{fmtDate(r.createdAt)}</div></div>
                {r.details && <p className="list-card-text">{r.details}</p>}
              </div>); })}
            {!apps(seeing.id).length && <span className="muted">Nobody has applied yet.</span>}
          </div>
          <div className="modal-actions"><button className="btn ghost" onClick={() => csv(seeing)} disabled={!apps(seeing.id).length}><Download size={15} />Export CSV</button><button className="btn primary" onClick={() => setSeeing(null)}>Close</button></div>
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

function PostsAdmin({ db, update, showToast, adminName, adminId }) {
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState("");
  const [tag, setTag] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [onlyOfficial, setOnlyOfficial] = useState(false);
  const [q, setQ] = useState("");
  const [reply, setReply] = useState({});
  const fileRef = useRef(null);
  async function pickPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setPhoto(await compressImage(f)); } catch { showToast("That photo could not be read. Try another one."); }
  }
  function publish() {
    if (!draft.trim() && !photo) return;
    update("posts", (l) => [{ id: uid("post"), authorId: adminId, authorName: adminName, content: (tag ? `[${tag}] ` : "") + draft.trim(), image: photo || null, createdAt: now(), likes: [], comments: [], savedBy: [] }, ...l]);
    setDraft(""); setPhoto(""); setTag("");
    showToast("Posted to the community as an official post.");
  }
  function sendReply(p) {
    const text = (reply[p.id] || "").trim();
    if (!text) return;
    update("posts", (l) => l.map((x) => (x.id === p.id ? { ...x, comments: [...x.comments, { id: uid("cmt"), authorId: adminId, authorName: adminName, content: text, createdAt: now() }] } : x)));
    setReply({ ...reply, [p.id]: "" });
  }
  function removePost(id) { update("posts", (list) => list.filter((p) => p.id !== id)); showToast("Post removed."); }
  function removeComment(postId, cid) { update("posts", (list) => list.map((p) => (p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== cid) } : p))); showToast("Comment removed."); }

  const all = [...db.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const needle = q.trim().toLowerCase();
  const sorted = all
    .filter((p) => !onlyOfficial || isStaff(db, p.authorId))
    .filter((p) => !tagFilter || parsePost(p.content).tag?.id === tagFilter)
    .filter((p) => !needle || (p.content || "").toLowerCase().includes(needle) || p.authorName.toLowerCase().includes(needle));
  const reactions = all.reduce((n, p) => n + (p.likes || []).length, 0);
  const comments = all.reduce((n, p) => n + (p.comments || []).length, 0);
  const thisWeek = all.filter((p) => Date.now() - new Date(p.createdAt).getTime() < 7 * 864e5).length;
  const tally = {};
  all.forEach((p) => { tally[p.authorId] = tally[p.authorId] || { name: p.authorName, n: 0, id: p.authorId }; tally[p.authorId].n += 1; });
  const top = Object.values(tally).sort((a, b) => b.n - a.n).slice(0, 3);
  const curTag = POST_TAGS.find((t) => t.id === tag);

  return (
    <div>
      <PageHead eyebrow={`${all.length} posts`} title="Community Posts — Moderation" />
      <div className="stat-grid">
        <StatCard icon={MessageSquare} label="Posts" value={all.length} ribbon="#1F5D4E" />
        <StatCard icon={Heart} label="Reactions" value={reactions} ribbon="#B23A34" />
        <StatCard icon={MessageCircle} label="Comments" value={comments} ribbon="#2F6F8F" />
        <StatCard icon={Clock} label="Posts this week" value={thisWeek} ribbon="#C9962B" />
      </div>
      {!!top.length && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>Most active</h3>
          <div className="chip-row">{top.map((t) => (<span className="chip" key={t.id}><Avatar src={photoOf(db, t.id)} name={t.name} className="mini-avatar sm" /> {t.name} · {t.n} post{t.n === 1 ? "" : "s"}</span>))}</div>
        </div>
      )}
      <div className="panel ig-composer" style={{ marginBottom: 14 }}>
        <div className="row-gap" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <Avatar src={photoOf(db, adminId)} name={adminName} className="mini-avatar lg" />
          <textarea rows={2} maxLength={POST_MAX} placeholder={curTag ? curTag.prompt : "Share an official announcement or message with all alumni…"} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") publish(); }} />
        </div>
        <div className="chip-row compose-tags">
          {POST_TAGS.map((t) => (<button key={t.id} type="button" className={"chip" + (tag === t.id ? " on" : "")} style={tag === t.id ? { background: t.color, borderColor: t.color } : undefined} onClick={() => setTag(tag === t.id ? "" : t.id)}>{t.emoji} {t.label}</button>))}
        </div>
        {photo && (<div className="ig-preview"><img src={photo} alt="Photo preview" /><button className="btn ghost" onClick={() => setPhoto("")}>Remove photo</button></div>)}
        <div className="ig-composer-actions">
          <div className="row-gap" style={{ gap: 4 }}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            <button className="btn ghost" onClick={() => fileRef.current?.click()}><ImageIcon size={16} />Photo</button>
            {QUICK_EMOJI.map((e) => (<button key={e} type="button" className="emoji-btn" aria-label={`Add ${e}`} onClick={() => setDraft((d) => (d + e).slice(0, POST_MAX))}>{e}</button>))}
          </div>
          <div className="row-gap">
            <span className="char-count">{draft.length}/{POST_MAX}</span>
            <button className="btn primary" onClick={publish} disabled={!draft.trim() && !photo}><Send size={15} />Post to community</button>
          </div>
        </div>
      </div>
      <div className="ig-chips">
        <div className="search-box"><Search size={14} /><input aria-label="Search community posts" placeholder="Search posts or people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chip-row">
          <button className={"chip" + (!tagFilter && !onlyOfficial ? " on" : "")} onClick={() => { setTagFilter(""); setOnlyOfficial(false); }}>All</button>
          <button className={"chip" + (onlyOfficial ? " on" : "")} onClick={() => setOnlyOfficial(!onlyOfficial)}>Official only</button>
          {POST_TAGS.map((t) => (<button key={t.id} className={"chip" + (tagFilter === t.id ? " on" : "")} onClick={() => setTagFilter(tagFilter === t.id ? "" : t.id)}>{t.emoji} {t.label}</button>))}
        </div>
      </div>
      <div className="stack">
        {sorted.map((p) => {
          const parsed = parsePost(p.content);
          const rc = reactionCounts(p);
          return (
            <article className="list-card ig-post" key={p.id} style={parsed.tag ? { borderLeft: `4px solid ${parsed.tag.color}` } : undefined}>
              <div className="ig-head">
                <Avatar src={photoOf(db, p.authorId)} name={p.authorName} />
                <div style={{ flex: 1 }}>
                  <div className="mini-name">{p.authorName}{isStaff(db, p.authorId) && <span className="staff-chip">Official</span>}</div>
                  <div className="mini-sub">{timeAgo(p.createdAt)}</div>
                </div>
                {parsed.tag && <span className="tag-pill" style={{ background: parsed.tag.color }}>{parsed.tag.emoji} {parsed.tag.label}</span>}
                <button className="icon-btn danger" aria-label="Delete post" onClick={() => removePost(p.id)}><Trash2 size={15} /></button>
              </div>
              {parsed.text && <p className="list-card-text ig-text" style={{ padding: "0 14px" }}>{parsed.text}</p>}
              {p.image && <img className="admin-post-img" src={p.image} alt={`Photo posted by ${p.authorName}`} />}
              <div className="react-sum" style={{ padding: "0 14px" }}>{(p.likes || []).length ? Object.entries(rc).map(([k, n]) => `${REACT_EMOJI[k] || ""} ${n}`).join("   ") : "No reactions yet"} · {p.comments.length} comment{p.comments.length === 1 ? "" : "s"}</div>
              {!!p.comments.length && (
                <div className="comment-list">
                  {p.comments.map((c) => (
                    <div className="comment-row" key={c.id}>
                      <Avatar src={photoOf(db, c.authorId)} name={c.authorName} className="mini-avatar sm" />
                      <div style={{ flex: 1 }}><strong>{c.authorName}</strong> <span className="muted">{c.content}</span>{(c.likes || []).length > 0 && <span className="mini-sub"> · ♥ {c.likes.length}</span>}</div>
                      <button className="icon-btn danger" aria-label="Delete comment" onClick={() => removeComment(p.id, c.id)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="ig-comment-box" style={{ marginTop: 8 }}>
                <input aria-label="Reply as admin" placeholder="Reply as admin…" value={reply[p.id] || ""} onChange={(e) => setReply({ ...reply, [p.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && sendReply(p)} />
                <button onClick={() => sendReply(p)}>Reply</button>
              </div>
            </article>
          );
        })}
        {!sorted.length && <EmptyState icon={MessageSquare} text={all.length ? "No posts match these filters." : "No community posts yet. Post the first announcement above."} />}
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

  async function saveAdmin(form, id) {
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
        username: form.username.trim(), password: await hashPassword(form.password), campus: form.campus, status: form.status, createdAt: now(),
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

  async function resetPassword(a, newPassword) {
    const pwHash = await hashPassword(newPassword);
    update("users", (list) => list.map((u) => (u.id === a.id ? { ...u, password: pwHash } : u)));
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
      {(() => {
        const logs = db.logs || [];
        const names = [...new Set(logs.filter((l) => l.action === "Admin password reset requested" && l.detail !== "no matching account" && Date.now() - new Date(l.ts).getTime() < 7 * 86400000
          && !logs.some((r) => r.action === "Reset admin password" && r.detail === l.detail && new Date(r.ts) > new Date(l.ts))).map((l) => l.detail))];
        return names.length ? <div className="reset-banner">Password reset requested by: {names.join(", ")}. Use the key icon on their row to set a temporary password.</div> : null;
      })()}
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
          <button type="button" className="pw-eye" onClick={() => setShowPw((x) => !x)} aria-label={showPw ? "Hide password" : "Show password"} title={showPw ? "Hide password" : "Show password"} data-shown={showPw ? "yes" : "no"}>{showPw ? <Eye size={16} /> : <EyeOff size={16} />}</button>
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
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "directory", label: "Alumni Directory", icon: Contact },
  { id: "services", label: "Services", icon: FileText },
  { id: "idcard", label: "My Alumni ID", icon: GraduationCap },
  { id: "posts", label: "Community", icon: MessageSquare },
];

function AlumniShell({ db, update, tab, setTab, onLogout, showToast, me, meUser, prefs, setPrefs, sys }) {
  const myNotifs = db.notifications.filter((n) => matchesAudience(n.audience, me) && !(me.profile?.settings?.onlyMine && n.audience?.type === "all"));
  const unread = myNotifs.filter((n) => !(n.readBy || []).includes(me.id)).length;
  const t = ALUMNI_NAV.some((n) => n.id === tab) || tab === "settings" ? tab : "dashboard";
  const [editingMe, setEditingMe] = useState(false);

  return (
    <div className="shell">
      <Sidebar nav={ALUMNI_NAV} tab={t} setTab={setTab} onLogout={onLogout} badgeMap={{ notifications: unread, services: (db.requests || []).filter((r) => r.kind === "mentorship" && r.targetId === me.id && r.status === "Pending").length }} roleLabel="Alumni" personName={me.fullName} />
      <main className="main">
        <TopBar name={me.fullName} roleLabel="Alumni" photo={me.profile?.photo} onProfile={() => setTab("profile")} onEdit={() => setEditingMe(true)} onSettings={() => setTab("settings")} onLogout={onLogout} />
        {editingMe && <EditProfileModal db={db} update={update} showToast={showToast} user={meUser} alumnus={me} onClose={() => setEditingMe(false)} />}
        {t === "settings" && <SettingsPage db={db} update={update} showToast={showToast} prefs={prefs} setPrefs={setPrefs} sys={sys} role="alumni" user={meUser} alumnus={me} onEditProfile={() => setEditingMe(true)} onOpenProfile={() => setTab("profile")} onLogout={onLogout} />}
        {t === "dashboard" && <AlumniDashboard db={db} me={me} setTab={setTab} myNotifs={myNotifs} />}
        {t === "profile" && <AlumniProfile db={db} update={update} me={me} meUser={meUser} showToast={showToast} />}
        {t === "employment" && <AlumniEmployment db={db} update={update} me={me} showToast={showToast} />}
        {t === "notifications" && <AlumniNotifications db={db} update={update} me={me} myNotifs={myNotifs} />}
        {t === "jobs" && <AlumniJobs db={db} update={update} me={me} showToast={showToast} />}
        {t === "surveys" && <AlumniSurveys db={db} update={update} me={me} showToast={showToast} />}
        {t === "events" && <AlumniEvents db={db} update={update} me={me} showToast={showToast} />}
        {t === "services" && <AlumniServices db={db} update={update} me={me} showToast={showToast} />}
        {t === "idcard" && <AlumniIdCard me={me} />}
        {t === "directory" && <AlumniDirectory db={db} update={update} me={me} showToast={showToast} />}
        {t === "posts" && <AlumniPosts db={db} update={update} me={me} showToast={showToast} />}
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
        <StatCard icon={CalendarDays} label="Upcoming Events" value={(db.events || []).filter((e) => (e.campus === ALL_CAMPUSES || e.campus === me.campus) && (!e.date || e.date >= todayStr())).length} ribbon="#C9962B" />
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

function AlumniProfile({ db, update, me, meUser, showToast }) {
  const [form, setForm] = useState({ phone: me.phone || "", address: me.address || "" });
  const [prof, setProf] = useState({ ...(me.profile || {}) });
  const [acct, setAcct] = useState({ username: meUser?.username || "", password: "", confirm: "" });
  const [acctErr, setAcctErr] = useState("");
  const photoRef = useRef(null);
  function setPhoto(v) {
    setProf((p) => ({ ...p, photo: v }));
    update("alumni", (list) => list.map((a) => (a.id === me.id ? { ...a, profile: { ...(a.profile || {}), photo: v }, updatedAt: now() } : a)));
    showToast(v ? "Profile photo updated." : "Profile photo removed.");
  }
  async function pickPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setPhoto(await compressImage(f, 256, 0.8)); } catch { showToast("That photo could not be read. Try another one."); }
  }

  function saveProfile() {
    update("alumni", (list) => list.map((a) => (a.id === me.id ? { ...a, ...form, profile: { ...(a.profile || {}), ...prof }, updatedAt: now() } : a)));
    showToast("Profile updated.");
  }
  async function saveAccount() {
    const un = acct.username.trim();
    if (un.length < 4 || /\s/.test(un)) { setAcctErr("Username needs at least 4 characters and no spaces."); return; }
    if (db.users.some((u) => u.id !== meUser.id && (u.username || "").toLowerCase() === un.toLowerCase())) { setAcctErr("That username is already taken."); return; }
    if (acct.password && acct.password.length < 6) { setAcctErr("New password needs at least 6 characters."); return; }
    if (acct.password && acct.password !== acct.confirm) { setAcctErr("The new passwords do not match."); return; }
    const newHash = acct.password ? await hashPassword(acct.password) : null;
    update("users", (list) => list.map((u) => (u.id === meUser.id ? { ...u, username: un, ...(newHash ? { password: newHash } : {}) } : u)));
    setAcct({ ...acct, password: "", confirm: "" });
    setAcctErr("");
    showToast("Account updated. Use your new details the next time you log in.");
  }

  return (
    <div>
      <PageHead eyebrow="Account" title="My Profile" />
      <div className="panel narrow">
        <div className="profile-hero">
          <Avatar src={prof.photo} name={me.fullName} className="avatar lg" />
          <div>
            <div className="mini-name">{me.fullName}</div><Seal status={me.accountStatus} />
            <div className="row-gap" style={{ marginTop: 8 }}>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
              <button className="btn ghost" onClick={() => photoRef.current?.click()}><ImageIcon size={15} />{prof.photo ? "Change photo" : "Add photo"}</button>
              {prof.photo && <button className="btn ghost" onClick={() => setPhoto("")}>Remove</button>}
            </div>
          </div>
        </div>
        <h4 className="section-title">Login details</h4>
        {acctErr && <div className="auth-error" role="alert"><AlertCircle size={15} />{acctErr}</div>}
        <div className="form-grid">
          <Field label="Username"><input value={acct.username} onChange={(e) => setAcct({ ...acct, username: e.target.value })} autoComplete="username" /></Field>
          <span />
          <PwField label="New password (leave blank to keep)" value={acct.password} onChange={(v) => setAcct({ ...acct, password: v })} autoComplete="new-password" />
          <PwField label="Confirm new password" value={acct.confirm} onChange={(v) => setAcct({ ...acct, confirm: v })} autoComplete="new-password" />
        </div>
        <button className="btn primary" onClick={saveAccount}><KeyRound size={15} />Update login details</button>

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
          <Field label="Current address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
        <AnnexFields values={prof} onChange={(k, v) => setProf((x) => ({ ...x, [k]: v }))} />
        <button className="btn primary" onClick={saveProfile}>Save changes</button>
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
  const markAll = () => update("notifications", (list) => list.map((n) => (matchesAudience(n.audience, me) && !(n.readBy || []).includes(me.id) ? { ...n, readBy: [...(n.readBy || []), me.id] } : n)));
  const sorted = [...myNotifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div>
      <PageHead eyebrow={`${sorted.length} total`} title="Notifications" action={sorted.some((n) => !(n.readBy || []).includes(me.id)) && <button className="btn ghost" onClick={markAll}><Check size={15} />Mark all as read</button>} />
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

function AlumniJobs({ db, update, me, showToast }) {
  const [applying, setApplying] = useState(null);
  const [msg, setMsg] = useState("");
  const sorted = [...db.jobs].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  const mine = (jobId) => (db.requests || []).find((r) => r.kind === "application" && r.targetId === jobId && r.alumniId === me.id && r.status !== "Cancelled");
  const closed = (j) => !!j.deadline && j.deadline < todayStr();
  async function apply() {
    const j = applying;
    const ok = await update("requests", (l) => [...l, { id: uid("req"), kind: "application", type: j.title, details: msg.trim(), alumniId: me.id, alumniName: me.fullName, campus: me.campus, targetId: j.id, status: "Applied", note: "", createdAt: now(), updatedAt: now() }]);
    if (ok) showToast("Your interest was sent to the school. They will pass it on.");
    setApplying(null); setMsg("");
  }
  const withdraw = (r) => { update("requests", (l) => l.map((x) => (x.id === r.id ? { ...x, status: "Cancelled", updatedAt: now() } : x))); showToast("Application withdrawn."); };
  return (
    <div>
      <PageHead eyebrow={`${sorted.length} open`} title="Job Opportunity Board" />
      <div className="cards-grid">
        {sorted.map((j) => { const r = mine(j.id); return (
          <div className="simple-card" key={j.id}>
            <Briefcase size={18} color="#1F5D4E" />
            <div className="mini-name">{j.title}</div>
            <div className="mini-sub">{j.company} · {j.location}</div>
            <p className="list-card-text">{j.requirements}</p>
            <div className="badge-soft">{closed(j) ? "Closed" : "Deadline"}: {fmtDate(j.deadline)}</div>
            {r ? (<><span className="status-chip" style={{ background: "#1F5D4E", alignSelf: "flex-start" }}>Interest sent</span><button className="link-btn small" onClick={() => withdraw(r)}>Withdraw</button></>)
              : !closed(j) && <button className="btn primary" onClick={() => setApplying(j)}>I'm interested</button>}
          </div>); })}
        {!sorted.length && <EmptyState icon={Briefcase} text="No job postings right now." />}
      </div>
      {applying && (
        <Modal title={`Interested in ${applying.title}`} onClose={() => setApplying(null)}>
          <p className="muted" style={{ marginTop: -4 }}>The school will receive your name, course and contact details.</p>
          <Field label="Short message (optional)"><textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Why you fit, availability, etc." /></Field>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setApplying(null)}>Cancel</button><button className="btn primary" onClick={apply}>Send</button></div>
        </Modal>
      )}
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

function AlumniPosts({ db, update, me, showToast }) {
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState("");
  const [filter, setFilter] = useState("all"); // all | saved | <authorId>
  const [expanded, setExpanded] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [burst, setBurst] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [tag, setTag] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [q, setQ] = useState("");
  const fileRef = useRef(null);
  const draftRef = useRef(null);
  function saveEdit(p) {
    const old = parsePost(p.content);
    if (!editText.trim() && !p.image) return;
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, content: (old.tag ? `[${old.tag.id}] ` : "") + editText.trim(), edited: true } : x)));
    setEditing(null); showToast("Post updated.");
  }
  function removeMyComment(p, cid) { update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, comments: x.comments.filter((c) => c.id !== cid) } : x))); }

  const sorted = [...db.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const isPinned = (p) => isStaff(db, p.authorId) && Date.now() - new Date(p.createdAt).getTime() < 7 * 864e5;
  const needle = q.trim().toLowerCase();
  let visible = sorted.filter((p) => filter === "all" ? true : filter === "saved" ? (p.savedBy || []).includes(me.id) : filter === "official" ? isStaff(db, p.authorId) : p.authorId === filter)
    .filter((p) => !tagFilter || tagFilter === "trending" || parsePost(p.content).tag?.id === tagFilter)
    .filter((p) => !needle || (p.content || "").toLowerCase().includes(needle) || p.authorName.toLowerCase().includes(needle));
  if (tagFilter === "trending") visible = visible.filter((p) => postScore(p) > 0).sort((a, b) => postScore(b) - postScore(a));
  else if (filter === "all" && !tagFilter && !needle) visible = [...visible.filter(isPinned), ...visible.filter((p) => !isPinned(p))];
  // People in the strip: everyone who has posted, plus alumni who joined the directory.
  const authors = [];
  sorted.forEach((p) => { if (!isStaff(db, p.authorId) && !authors.some((a) => a.id === p.authorId)) authors.push({ id: p.authorId, name: p.authorName }); });
  db.alumni.forEach((a) => { if (a.accountStatus === "approved" && a.profile?.directory && !authors.some((x) => x.id === a.id)) authors.push({ id: a.id, name: a.fullName }); });
  authors.sort((x, y) => (x.id === me.id ? -1 : y.id === me.id ? 1 : 0));
  const hasOfficial = sorted.some((p) => isStaff(db, p.authorId));
  const savedCount = sorted.filter((p) => (p.savedBy || []).includes(me.id)).length;
  const recent = (id) => sorted.some((p) => p.authorId === id && Date.now() - new Date(p.createdAt).getTime() < 864e5);
  const person = !["all", "saved", "official"].includes(filter) ? db.alumni.find((a) => a.id === filter) : null;

  async function pickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setPhoto(await compressImage(f)); } catch { showToast("That photo could not be read. Try another one."); }
    e.target.value = "";
  }
  function addPost() {
    if (!draft.trim() && !photo) return;
    update("posts", (list) => [{ id: uid("post"), authorId: me.id, authorName: me.fullName, content: (tag ? `[${tag}] ` : "") + draft.trim(), image: photo || null, createdAt: now(), likes: [], comments: [], savedBy: [] }, ...list]);
    setDraft(""); setPhoto(""); setTag(""); setFilter("all"); setTagFilter(""); setQ("");
    showToast("Posted.");
  }
  function like(p, forceOn) {
    update("posts", (list) => list.map((x) => {
      if (x.id !== p.id) return x;
      const cur = reactionOf(x, me.id);
      if (forceOn && cur === "like") return x;
      return { ...x, likes: withReaction(x.likes, me.id, cur === "like" ? null : "like") };
    }));
  }
  function react(p, key) {
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, likes: withReaction(x.likes, me.id, reactionOf(x, me.id) === key ? null : key) } : x)));
  }
  function likeComment(p, c) {
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, comments: x.comments.map((y) => (y.id === c.id ? { ...y, likes: (y.likes || []).includes(me.id) ? y.likes.filter((i) => i !== me.id) : [...(y.likes || []), me.id] } : y)) } : x)));
  }
  const renderText = (text) => text.split(/(#[\p{L}\p{N}_]+)/u).map((part, i) => (/^#/.test(part) ? <button key={i} className="hashtag" onClick={() => { setQ(part); setFilter("all"); setTagFilter(""); }}>{part}</button> : <React.Fragment key={i}>{part}</React.Fragment>));
  const curTag = POST_TAGS.find((t) => t.id === tag);
  const addEmoji = (e) => { setDraft((d) => (d + e).slice(0, POST_MAX)); draftRef.current?.focus(); };
  function doubleTapLike(p) { like(p, true); setBurst(p.id); setTimeout(() => setBurst((b) => (b === p.id ? null : b)), 700); }
  function toggleSave(p) {
    const saved = (p.savedBy || []).includes(me.id);
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, savedBy: saved ? (x.savedBy || []).filter((id) => id !== me.id) : [...(x.savedBy || []), me.id] } : x)));
    showToast(saved ? "Removed from saved." : "Saved to your bookmarks.");
  }
  function share(p) {
    const link = `${window.location.origin}${window.location.pathname}#/posts`;
    const done = () => showToast("Link copied.");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => showToast("Copying is not available in this browser."));
    else showToast("Copying is not available in this browser.");
  }
  function addComment(p) {
    const text = (commentDraft[p.id] || "").trim();
    if (!text) return;
    update("posts", (list) => list.map((x) => (x.id === p.id ? { ...x, comments: [...x.comments, { id: uid("cmt"), authorId: me.id, authorName: me.fullName, content: text, createdAt: now() }] } : x)));
    setCommentDraft({ ...commentDraft, [p.id]: "" });
    setExpanded({ ...expanded, [p.id]: true });
  }
  function removePost(p) { update("posts", (list) => list.filter((x) => x.id !== p.id)); showToast("Post deleted."); }

  return (
    <div>
      <PageHead eyebrow="Community" title="Alumni Posts" />
      <div className="ig-wrap">
        <div className="ig-stories">
          <button className={"ig-story" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}><span className="ig-ring"><span className="mini-avatar"><Home size={18} /></span></span>All</button>
          {hasOfficial && <button className={"ig-story" + (filter === "official" ? " on" : "")} onClick={() => setFilter("official")}><span className="ig-ring"><span className="mini-avatar gold"><GraduationCap size={18} /></span></span>Official</button>}
          <button className={"ig-story" + (filter === "saved" ? " on" : "")} onClick={() => setFilter("saved")}><span className="ig-ring"><span className="mini-avatar"><Bookmark size={18} /></span></span>Saved{savedCount ? ` (${savedCount})` : ""}</button>
          {authors.map((a) => (
            <button key={a.id} className={"ig-story" + (filter === a.id ? " on" : "") + (recent(a.id) ? " fresh" : "")} onClick={() => setFilter(a.id)} aria-label={`Posts by ${a.name}`}>
              <span className="ig-ring"><Avatar src={photoOf(db, a.id)} name={a.name} /></span>{a.id === me.id ? "You" : a.name.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="ig-chips">
          <div className="search-box"><Search size={14} /><input aria-label="Search posts" placeholder="Search posts or #tags" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="chip-row">
            <button className={"chip" + (tagFilter === "" ? " on" : "")} onClick={() => setTagFilter("")}>All topics</button>
            <button className={"chip" + (tagFilter === "trending" ? " on" : "")} onClick={() => setTagFilter("trending")}>{"\u{1F525}"} Trending</button>
            {POST_TAGS.map((t) => (<button key={t.id} className={"chip" + (tagFilter === t.id ? " on" : "")} onClick={() => setTagFilter(tagFilter === t.id ? "" : t.id)}>{t.emoji} {t.label}</button>))}
          </div>
        </div>
        {person && (
          <div className="panel ig-person">
            <Avatar src={person.profile?.photo} name={person.fullName} className="avatar lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mini-name">{person.fullName}{person.id === me.id && " (you)"}</div>
              <div className="mini-sub">{person.course} · Batch {person.gradYear}</div>
              <div className="mini-sub">{person.campus}{person.employment?.status && person.employment.status !== "Unemployed" && (person.employment.company || person.employment.position) ? " · " + [person.employment.position, person.employment.company].filter(Boolean).join(" at ") : ""}</div>
              {person.profile?.directoryContact && <div className="mini-sub">{person.email}{person.phone ? " · " + person.phone : ""}</div>}
            </div>
            <button className="btn ghost" onClick={() => setFilter("all")}>Show all</button>
          </div>
        )}
        <div className="panel ig-composer">
          <div className="row-gap" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            <Avatar src={me.profile?.photo} name={me.fullName} className="mini-avatar lg" />
            <textarea ref={draftRef} rows={2} maxLength={POST_MAX} placeholder={curTag ? curTag.prompt : `What's on your mind, ${me.fullName.split(" ")[0]}?`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") addPost(); }} />
          </div>
          <div className="chip-row compose-tags">
            {POST_TAGS.map((t) => (<button key={t.id} type="button" className={"chip" + (tag === t.id ? " on" : "")} style={tag === t.id ? { background: t.color, borderColor: t.color } : undefined} onClick={() => setTag(tag === t.id ? "" : t.id)}>{t.emoji} {t.label}</button>))}
          </div>
          {photo && (
            <div className="ig-preview">
              <img src={photo} alt="Photo preview" />
              <button className="btn ghost" onClick={() => setPhoto("")}>Remove photo</button>
            </div>
          )}
          <div className="ig-composer-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            <div className="row-gap" style={{ gap: 4 }}>
              <button className="btn ghost" onClick={() => fileRef.current?.click()}><ImageIcon size={16} />Photo</button>
              {QUICK_EMOJI.map((e) => (<button key={e} type="button" className="emoji-btn" aria-label={`Add ${e}`} onClick={() => addEmoji(e)}>{e}</button>))}
            </div>
            <div className="row-gap">
              <span className={"char-count" + (draft.length > POST_MAX - 40 ? " warn" : "")}>{draft.length}/{POST_MAX}</span>
              <button className="btn primary" onClick={addPost} disabled={!draft.trim() && !photo}>Post</button>
            </div>
          </div>
        </div>

        {visible.map((p) => {
          const mine = reactionOf(p, me.id);
          const liked = mine === "like";
          const rc = reactionCounts(p);
          const parsed = parsePost(p.content);
          const pinned = filter === "all" && !tagFilter && !needle && isPinned(p);
          const saved = (p.savedBy || []).includes(me.id);
          const canComment = p.authorId === me.id || db.alumni.find((x) => x.id === p.authorId)?.profile?.settings?.allowComments !== false;
          const shown = expanded[p.id] ? p.comments : p.comments.slice(-2);
          return (
            <article className={"ig-post" + (parsed.tag ? " tagged" : "") + (pinned ? " pinned" : "")} key={p.id} style={parsed.tag ? { borderLeft: `4px solid ${parsed.tag.color}` } : undefined}>
              <div className="ig-head">
                <Avatar src={photoOf(db, p.authorId)} name={p.authorName} />
                <div style={{ flex: 1 }}><div className="mini-name">{p.authorName}{isStaff(db, p.authorId) && <span className="staff-chip">Official</span>}</div><div className="mini-sub">{timeAgo(p.createdAt)}{pinned && <span className="pin-label">{" \u00b7 \u{1F4CC} Pinned"}</span>}</div></div>
                {parsed.tag && <span className="tag-pill" style={{ background: parsed.tag.color }}>{parsed.tag.emoji} {parsed.tag.label}</span>}
                {p.authorId === me.id && <button className="icon-btn" aria-label="Edit post" onClick={() => { setEditing(p.id); setEditText(parsed.text); }}><Edit2 size={15} /></button>}
                {p.authorId === me.id && <button className="icon-btn danger" aria-label="Delete post" onClick={() => removePost(p)}><Trash2 size={15} /></button>}
              </div>
              {p.image && (
                <div className="ig-media" onDoubleClick={() => doubleTapLike(p)}>
                  <img src={p.image} alt={`Photo posted by ${p.authorName}`} />
                  {burst === p.id && <Heart className="ig-burst" size={88} fill="#fff" color="#fff" />}
                </div>
              )}
              <div className="ig-actions">
                <button className={"ig-btn" + (liked ? " liked" : "")} aria-label={liked ? "Unlike" : "Like"} onClick={() => like(p)}><Heart size={22} /></button>
                <button className="ig-btn" aria-label="Comment" onClick={() => document.getElementById("cmt-" + p.id)?.focus()}><MessageCircle size={22} />{p.comments.length > 0 && <span className="ig-count">{p.comments.length}</span>}</button>
                <button className="ig-btn" aria-label="Share" onClick={() => share(p)}><Send size={21} /></button>
                <button className={"ig-btn push" + (saved ? " saved" : "")} aria-label={saved ? "Unsave" : "Save"} onClick={() => toggleSave(p)}><Bookmark size={22} /></button>
              </div>
              <div className="ig-body">
                {editing === p.id ? (
                  <div className="ig-edit"><textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} /><div className="row-gap"><button className="btn primary" onClick={() => saveEdit(p)}>Save</button><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button></div></div>
                ) : parsed.text && <p className="ig-text" onDoubleClick={() => doubleTapLike(p)}><strong>{p.authorName}</strong> {renderText(parsed.text)}{p.edited && <span className="mini-sub"> (edited)</span>}</p>}
                <div className="react-row">
                  {REACTS.map(([k, e]) => (<button key={k} type="button" className={"react-chip" + (mine === k ? " on" : "")} aria-label={`React ${k}`} onClick={() => react(p, k)}>{e}{rc[k] ? <span>{rc[k]}</span> : null}</button>))}
                </div>
                <div className="react-sum">{p.likes.length ? Object.entries(rc).map(([k, n]) => `${REACT_EMOJI[k] || ""} ${n}`).join("   ") : "Be the first to react"}</div>
                {p.comments.length > 2 && !expanded[p.id] && <button className="ig-more" onClick={() => setExpanded({ ...expanded, [p.id]: true })}>View all {p.comments.length} comments</button>}
                {shown.map((c) => <div className="ig-cmt" key={c.id}><strong>{c.authorName}</strong> {c.content}<button className={"cmt-like" + ((c.likes || []).includes(me.id) ? " on" : "")} aria-label="Like comment" onClick={() => likeComment(p, c)}>{(c.likes || []).includes(me.id) ? "\u2665" : "\u2661"}{(c.likes || []).length || ""}</button>{c.authorId === me.id && <button className="ig-del" aria-label="Delete comment" onClick={() => removeMyComment(p, c.id)}>delete</button>}</div>)}
              </div>
              {canComment ? (
                <div className="ig-comment-box">
                  <input id={"cmt-" + p.id} placeholder="Add a comment" value={commentDraft[p.id] || ""} onChange={(e) => setCommentDraft({ ...commentDraft, [p.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addComment(p)} />
                  <button onClick={() => addComment(p)}>Post</button>
                </div>
              ) : <div className="ig-comment-box"><span className="mini-sub">Comments are turned off for this post.</span></div>}
            </article>
          );
        })}
        {!visible.length && (filter === "all" && !tagFilter && !needle && !sorted.length ? (
          <div className="panel prompt-panel">
            <h3>Start the conversation</h3>
            <p className="muted">Nothing here yet. Pick a topic to begin:</p>
            <div className="chip-row">{POST_TAGS.map((t) => (<button key={t.id} className="chip" onClick={() => { setTag(t.id); draftRef.current?.focus(); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>{t.emoji} {t.label}</button>))}</div>
          </div>
        ) : <EmptyState icon={filter === "saved" ? Bookmark : MessageSquare} text={needle || tagFilter ? "No posts match. Try another topic or search." : filter === "saved" ? "Nothing saved yet. Tap the bookmark on a post." : filter === "official" ? "No official posts yet." : filter !== "all" ? "No posts from this person yet." : "No posts yet. Be the first to share!"} />)}
      </div>
    </div>
  );
}

/* ============================== CSS ============================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');

:root{
  color-scheme:light;
  --ink:#16302B; --primary:#1F5D4E; --primary-d:#164138; --gold:#C9962B; --gold-d:#8A6D00;
  --paper:#F6F3EA; --paper-alt:#FFFFFF; --muted:#6B7A73; --border:#E2DCC8; --danger:#B23A34;
}
.zd-root{ font-family:'Inter',sans-serif; color:var(--ink); background:var(--paper); min-height:100vh; }
.zd-root *{ box-sizing:border-box; }
html,body{ margin:0; background:#F6F3EA; color:#16302B; color-scheme:light; }
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
.side-nav{ display:flex; flex-direction:column; gap:2px; flex:1; min-height:0; overflow-y:auto; }
.side-item{ display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; background:none; border:none; text-align:left; font-size:.86rem; color:var(--ink); cursor:pointer; font-weight:500; }
.side-item:hover{ background:var(--paper); }
.side-item.active{ background:var(--primary); color:#fff; }
.side-badge{ margin-left:auto; background:var(--gold); color:var(--ink); font-size:.68rem; font-weight:700; padding:1px 7px; border-radius:20px; }
.side-item.active .side-badge{ background:#fff; color:var(--primary); }
.sidebar-foot{ border-top:1px solid var(--border); padding-top:12px; margin-top:8px; flex-shrink:0; }
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
.table-wrap{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; }
.table-wrap table{ min-width:560px; }
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
.has-img{ overflow:hidden; padding:0; background:var(--paper-alt) !important; }
.has-img img{ width:100%; height:100%; object-fit:cover; display:block; border-radius:50%; }
.cel-row{ display:flex; align-items:center; gap:10px; }
.celebrate{ margin-bottom:14px; }
.ig-chips{ margin-bottom:12px; }
.ig-chips .search-box{ margin-bottom:8px; }
.chip-row{ display:flex; gap:6px; overflow-x:auto; padding:2px 0 4px; scrollbar-width:none; flex-wrap:wrap; }
.chip{ border:1px solid var(--border); background:var(--paper-alt); color:var(--ink); border-radius:20px; padding:5px 12px; font-size:.78rem; font-weight:600; cursor:pointer; white-space:nowrap; }
.chip:hover{ border-color:var(--primary); }
.chip.on{ background:var(--primary); color:#fff; border-color:var(--primary); }
.compose-tags{ margin-top:10px; }
.emoji-btn{ background:none; border:0; font-size:1.1rem; cursor:pointer; padding:4px; border-radius:8px; }
.emoji-btn:hover{ background:var(--paper); }
.char-count{ font-size:.72rem; color:var(--muted); }
.char-count.warn{ color:var(--danger); font-weight:700; }
.tag-pill{ color:#fff; font-size:.68rem; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; }
.pin-label{ color:var(--gold); font-weight:700; }
.ig-post.pinned{ box-shadow:0 0 0 1px var(--gold) inset; }
.ig-post{ transition:box-shadow .15s, transform .15s; }
.ig-post:hover{ box-shadow:0 4px 18px #16302b14; }
.ig-count{ font-size:.8rem; font-weight:600; margin-left:4px; align-self:center; }
.react-row{ display:flex; gap:6px; margin:6px 0 2px; flex-wrap:wrap; }
.react-chip{ border:1px solid var(--border); background:var(--paper); border-radius:20px; padding:3px 10px; font-size:.95rem; cursor:pointer; display:inline-flex; gap:5px; align-items:center; transition:transform .1s; }
.react-chip span{ font-size:.72rem; font-weight:700; color:var(--muted); }
.react-chip:hover{ transform:scale(1.08); }
.react-chip.on{ background:var(--gold); border-color:var(--gold); } .react-chip.on span{ color:var(--ink); }
.react-sum{ font-size:.78rem; color:var(--muted); margin:2px 0 4px; }
.hashtag{ background:none; border:0; padding:0; color:var(--primary); font-weight:700; cursor:pointer; font:inherit; }
.cmt-like{ margin-left:8px; background:none; border:0; color:var(--muted); font-size:.74rem; cursor:pointer; }
.cmt-like.on{ color:var(--danger); font-weight:700; }
.prompt-panel{ text-align:center; }
.ig-story.fresh .ig-ring{ box-shadow:0 0 0 2px var(--gold); }
.ig-person{ display:flex; gap:12px; align-items:center; margin-bottom:12px; }
.msg-thread{ display:flex; flex-direction:column; gap:6px; max-height:360px; min-height:160px; overflow:auto; padding:6px 2px 10px; }
.msg{ max-width:78%; padding:8px 12px; border-radius:14px; font-size:.9rem; line-height:1.35; word-break:break-word; }
.msg.mine{ align-self:flex-end; background:var(--primary); color:#fff; border-bottom-right-radius:4px; }
.msg.theirs{ align-self:flex-start; background:var(--paper-alt); border:1px solid var(--border); border-bottom-left-radius:4px; }
.msg-time{ display:block; font-size:.62rem; opacity:.7; margin-top:2px; }
.status-chip{ display:inline-block; color:#fff; font-size:.68rem; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; }
.id-card{ max-width:420px; background:linear-gradient(135deg,#1F5D4E,#16413A); color:#fff; border-radius:18px; padding:18px; box-shadow:0 6px 24px #0003; margin-bottom:16px; border-top:6px solid #C9962B; }
.id-top{ display:flex; gap:10px; align-items:center; margin-bottom:14px; }
.id-school{ font-weight:700; font-size:.82rem; line-height:1.2; } .id-sub{ font-size:.7rem; opacity:.8; letter-spacing:.06em; text-transform:uppercase; }
.id-body{ display:flex; gap:14px; align-items:center; }
.id-photo{ width:84px !important; height:84px !important; border-radius:12px !important; font-size:2rem !important; background:#C9962B !important; color:#16302B !important; }
.id-photo img{ border-radius:12px !important; }
.id-name{ font-size:1.15rem; font-weight:700; } .id-line{ font-size:.8rem; opacity:.9; }
.id-no{ margin-top:8px; font-family:ui-monospace,monospace; letter-spacing:.08em; background:#ffffff22; display:inline-block; padding:3px 9px; border-radius:8px; font-size:.82rem; }
.id-foot{ margin-top:14px; font-size:.68rem; opacity:.85; border-top:1px solid #ffffff44; padding-top:8px; }
@media print{ body *{ visibility:hidden; } .id-card, .id-card *{ visibility:visible; } .id-card{ position:absolute; left:0; top:0; box-shadow:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
.staff-chip{ margin-left:6px; font-size:.62rem; font-weight:700; background:var(--gold); color:var(--ink); padding:1px 7px; border-radius:20px; vertical-align:middle; }
.ig-del{ margin-left:8px; background:none; border:0; color:var(--muted); font-size:.7rem; cursor:pointer; text-decoration:underline; }
.ig-edit textarea{ width:100%; box-sizing:border-box; margin-bottom:6px; }
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

.sync-warn{ position:fixed; top:10px; left:50%; transform:translateX(-50%); max-width:min(92vw,560px); background:#FFF4D6; color:#6B4E00; border:1px solid #E0B94A; padding:9px 14px; border-radius:12px; font-size:.8rem; font-weight:600; z-index:99; display:flex; gap:10px; align-items:center; box-shadow:0 6px 18px rgba(0,0,0,.12); }
.sync-warn button{ background:#1F5D4E; color:#fff; border:0; border-radius:8px; padding:5px 10px; font-weight:700; cursor:pointer; }
.toast{ position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:11px 20px; border-radius:30px; font-size:.85rem; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.18); z-index:100; }

@media (max-width: 900px){
  .auth-side{ display:none; }
  .top-nav{ padding:14px 18px; }
  .top-nav-brand div:last-child .brand-sub{ display:block; }
  .landing-hero{ padding:32px 20px; }
  .landing-hero-copy h1{ font-size:1.9rem; }
  .sidebar{ width:78px; }
  .sidebar-brand div, .side-item span, .person-name, .person-role, .brand-sub, .logout-btn span{ display:none; }
  .side-item{ justify-content:center; }
  .logout-btn{ padding:8px 0; }
  .grid-2{ grid-template-columns:1fr; }
  .form-grid{ grid-template-columns:1fr; }
  .main{ padding:22px 16px; }
}

/* ---- Phone-sized screens ---- */
@media (max-width: 640px){
  html{ -webkit-text-size-adjust:100%; }
  .shell{ flex-direction:column; }
  .sidebar{
    width:100%; height:auto; position:fixed; left:0; right:0; bottom:0; top:auto;
    flex-direction:row; align-items:center; padding:6px 6px calc(6px + env(safe-area-inset-bottom));
    border-right:none; border-top:1px solid var(--border); z-index:40;
  }
  .sidebar-brand{ display:none; }
  .side-nav{ flex:1; flex-direction:row; overflow-x:auto; gap:2px; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
  .side-nav::-webkit-scrollbar{ display:none; }
  .side-item{ flex-direction:column; gap:2px; padding:7px 10px; min-width:52px; flex-shrink:0; }
  .side-badge{ position:absolute; margin-left:0; transform:translate(10px,-10px); padding:1px 5px; font-size:.62rem; }
  .side-item{ position:relative; }
  .sidebar-foot{ border-top:none; padding-top:0; margin-top:0; flex-shrink:0; }
  .person{ display:none; }
  .logout-btn{ width:auto; border:none; padding:7px 10px; flex-direction:column; gap:2px; font-size:.62rem; }
  .main{ padding:16px 12px 84px; }
  .page-head{ flex-direction:column; align-items:flex-start; gap:10px; }
  .page-head h1{ font-size:1.25rem; }
  .stat-grid{ grid-template-columns:repeat(2,1fr); gap:10px; }
  .landing-hero-panel{ flex-direction:row; flex-wrap:wrap; }
  .landing-stat{ flex:1; min-width:130px; }
  .top-nav{ padding:12px 14px; }
  .top-nav-actions{ gap:6px; }
  .top-nav-actions .btn{ padding:8px 10px; font-size:.78rem; }
  .landing-hero-copy h1{ font-size:1.55rem; }
  .auth-form-side{ padding:24px 16px; }
  .auth-card{ padding:0; }
  .modal-backdrop{ padding:0; align-items:flex-end; }
  .modal{ width:100%; max-width:100%; max-height:92vh; border-radius:16px 16px 0 0; }
  .modal.modal-wide{ width:100%; }
  .search-box{ width:100%; }
  .filter-bar select{ flex:1; min-width:120px; }
  .btn, .field input, .field select, .field textarea{ font-size:16px; }
}
/* ---- Live review, Annex A, community feed ---- */
.main{ min-width:0; }
.page-head{ flex-wrap:wrap; gap:10px; }
.row-gap{ flex-wrap:wrap; }
.verify-actions{ flex-wrap:wrap; }
.verify-actions .btn{ flex:1 1 auto; justify-content:center; }
.hl-row td{ background:#FFF6D8; animation:hlfade 6s ease-out; }
@keyframes hlfade{ from{ background:#F3D98B; } to{ background:#FFF6D8; } }
.consent{ display:flex; gap:8px; align-items:flex-start; font-size:.8rem; color:var(--muted); margin:6px 0 10px; line-height:1.4; cursor:pointer; }
.consent input{ margin-top:3px; }
.pw-wrap input{ width:100%; padding-right:38px; }
.match-banner{ padding:10px 12px; border-radius:10px; font-size:.85rem; font-weight:600; margin:8px 0 12px; }
.match-banner.ok{ background:#E3F1EA; color:var(--primary-d); }
.match-banner.warn{ background:#FDF1D3; color:var(--gold-d); }
.match-banner.none{ background:#FBEAE8; color:var(--danger); }
.cmp-table{ border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.cmp-row{ display:grid; grid-template-columns:120px 1fr 1fr; gap:10px; padding:9px 12px; font-size:.84rem; border-bottom:1px solid var(--border); align-items:center; }
.cmp-row:last-child{ border-bottom:none; }
.cmp-row.head{ background:var(--paper); font-size:.76rem; color:var(--muted); }
.cmp-row.diff{ background:#FDF1D3; }
.cmp-label{ color:var(--muted); font-size:.78rem; }
.more-details{ margin:14px 0; border:1px solid var(--border); border-radius:12px; padding:10px 14px; }
.more-details summary{ cursor:pointer; font-weight:600; color:var(--primary); font-size:.86rem; }
.view-block{ margin-bottom:10px; }
.view-rows{ display:grid; grid-template-columns:1fr 1fr; gap:4px 18px; }
.view-row{ display:flex; flex-direction:column; padding:5px 0; border-bottom:1px solid var(--border); font-size:.82rem; }
.view-row span{ color:var(--muted); font-size:.72rem; }
.admin-post-img{ width:100%; max-width:360px; border-radius:10px; margin-top:8px; display:block; }
.ig-wrap{ max-width:560px; margin:0 auto; }
.ig-stories{ display:flex; gap:14px; overflow-x:auto; padding:2px 2px 14px; scrollbar-width:none; }
.ig-stories::-webkit-scrollbar{ display:none; }
.ig-story{ background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; min-width:62px; font-size:.72rem; color:var(--ink); }
.ig-ring{ padding:2px; border-radius:50%; background:linear-gradient(135deg,var(--gold),var(--danger)); display:block; }
.ig-story.on .ig-ring{ background:var(--primary); }
.ig-ring .mini-avatar{ width:50px; height:50px; font-size:1.05rem; border:2px solid var(--paper-alt); }
.ig-composer{ margin-bottom:14px; }
.ig-composer textarea{ flex:1; width:100%; border:1px solid var(--border); border-radius:10px; padding:9px 11px; font-family:'Inter',sans-serif; font-size:.88rem; resize:vertical; }
.ig-composer-actions{ display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; }
.ig-composer-actions .row-gap{ flex-wrap:wrap; align-items:center; }
.ig-composer-actions > .row-gap:last-child{ margin-left:auto; flex-wrap:nowrap; }
.ig-preview{ display:flex; gap:10px; align-items:center; margin-top:10px; }
.ig-preview img{ max-height:110px; border-radius:10px; }
.ig-post{ background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; margin-bottom:14px; overflow:hidden; }
.ig-head{ display:flex; align-items:center; gap:10px; padding:11px 14px; }
.ig-media{ position:relative; background:#000; touch-action:manipulation; }
.ig-media img{ display:block; width:100%; max-height:540px; object-fit:cover; }
.ig-burst{ position:absolute; left:50%; top:50%; margin:-44px 0 0 -44px; pointer-events:none; animation:igburst .7s ease-out forwards; }
@keyframes igburst{ 0%{ opacity:0; transform:scale(.4); } 30%{ opacity:1; transform:scale(1.15); } 100%{ opacity:0; transform:scale(1); } }
.ig-actions{ display:flex; align-items:center; gap:2px; padding:6px 8px; }
.ig-actions .push{ margin-left:auto; }
.ig-btn{ background:none; border:none; padding:8px; border-radius:8px; cursor:pointer; color:var(--ink); display:flex; touch-action:manipulation; }
.ig-btn:hover{ background:var(--paper); }
.ig-btn.liked{ color:var(--danger); }
.ig-btn.liked svg, .ig-btn.saved svg{ fill:currentColor; }
.ig-body{ padding:0 16px 6px; font-size:.86rem; }
.ig-body p{ margin:4px 0; line-height:1.5; }
.ig-more{ background:none; border:none; padding:0; color:var(--muted); cursor:pointer; font-size:.82rem; margin:2px 0; }
.ig-cmt{ margin:3px 0; font-size:.84rem; }
.ig-comment-box{ display:flex; gap:8px; border-top:1px solid var(--border); padding:6px 14px; align-items:center; }
.ig-comment-box input{ flex:1; border:none; background:none; padding:8px 0; font-size:.85rem; outline:none; font-family:'Inter',sans-serif; }
.ig-comment-box button{ background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; }
@media (prefers-reduced-motion:reduce){ .ig-burst{ animation:none; opacity:0; } .hl-row td{ animation:none; } }

/* ---- Tables become labelled cards on phones ---- */
@media (max-width: 640px){
  .view-rows{ grid-template-columns:1fr; }
  .cmp-row{ grid-template-columns:92px 1fr 1fr; font-size:.78rem; gap:6px; padding:8px; }
  .table-wrap{ background:none; border:none; overflow:visible; }
  .table-wrap table, .table-wrap tbody, .table-wrap tr, .table-wrap td{ display:block; width:100%; min-width:0; }
  .table-wrap thead{ display:none; }
  .table-wrap tr{ background:var(--paper-alt); border:1px solid var(--border); border-radius:12px; margin-bottom:8px; padding:6px 12px; }
  .table-wrap td{ border:none; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:5px 0; text-align:right; min-width:0; overflow-wrap:anywhere; }
  .table-wrap td::before{ content:attr(data-l); color:var(--muted); font-size:.74rem; text-align:left; flex-shrink:0; }
  .table-wrap td[colspan]{ display:block; text-align:center; }
  .table-wrap td[colspan]::before{ content:none; }
  .table-wrap td.row-actions{ justify-content:flex-end; }
  .table-wrap td.row-actions::before{ content:none; }
  .verify-actions{ flex-wrap:wrap; }
  .verify-actions .btn{ flex:1 1 auto; justify-content:center; }
}

/* ---- Profile in the top bar ---- */
.topbar{ position:sticky; top:0; z-index:30; display:flex; justify-content:flex-end; background:var(--paper); padding:2px 0 10px; margin-bottom:6px; }
.topbar-profile{ position:relative; }
.profile-chip{ display:flex; align-items:center; gap:10px; background:var(--paper-alt); border:1px solid var(--border); border-radius:999px; padding:5px 12px 5px 5px; cursor:pointer; color:var(--ink); max-width:100%; }
.profile-chip:hover{ border-color:var(--primary); }
.tb-avatar{ width:34px; height:34px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0; }
.tb-text{ display:flex; flex-direction:column; text-align:left; line-height:1.2; min-width:0; }
.tb-name{ font-size:.84rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }
.tb-role{ font-size:.7rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }
.tb-caret{ transform:rotate(90deg); color:var(--muted); transition:transform .15s; flex-shrink:0; }
.tb-caret.open{ transform:rotate(-90deg); }
.profile-menu{ position:absolute; right:0; top:calc(100% + 6px); min-width:230px; background:var(--paper-alt); border:1px solid var(--border); border-radius:14px; box-shadow:0 12px 30px rgba(22,48,43,.16); padding:6px; z-index:40; }
.profile-menu-head{ display:flex; flex-direction:column; padding:8px 10px 10px; border-bottom:1px solid var(--border); margin-bottom:4px; font-size:.84rem; }
.profile-menu-head span{ font-size:.72rem; color:var(--muted); }
.profile-menu button{ display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; padding:9px 10px; border-radius:9px; font-size:.85rem; font-weight:500; cursor:pointer; color:var(--ink); text-align:left; }
.profile-menu button:hover{ background:var(--paper); }
.profile-menu button.danger{ color:var(--danger); }
@media (max-width: 640px){
  .tb-role{ display:none; }
  .tb-name{ max-width:140px; }
  .topbar{ padding-bottom:8px; }
}
@media (prefers-reduced-motion:reduce){ .tb-caret{ transition:none; } }

/* ---- Settings ---- */
.switch{ width:44px; height:26px; border-radius:999px; border:1px solid var(--border); background:#D9D4C2; position:relative; cursor:pointer; padding:0; flex-shrink:0; transition:background .15s; }
.switch span{ position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .15s; box-shadow:0 1px 3px rgba(0,0,0,.25); }
.switch.on{ background:var(--primary); border-color:var(--primary); }
.switch.on span{ left:20px; }
.set-panel{ background:var(--paper-alt); border:1px solid var(--border); border-radius:16px; padding:6px 20px; margin-bottom:16px; max-width:760px; }
.set-panel h3{ font-family:'Fraunces',serif; margin:14px 0 4px; font-size:1.05rem; }
.set-note{ font-size:.76rem; color:var(--muted); margin:0 0 6px; }
.set-row{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); }
.set-row:last-child{ border-bottom:none; }
.set-title{ font-weight:600; font-size:.88rem; }
.set-desc{ font-size:.76rem; color:var(--muted); margin-top:2px; overflow-wrap:anywhere; }
.set-ctl{ flex-shrink:0; max-width:55%; }
.set-ctl select{ min-width:170px; }
.set-stack{ padding:12px 0; border-bottom:1px solid var(--border); }
.set-stack:last-child{ border-bottom:none; }
.site-banner{ background:var(--gold); color:#2B2100; text-align:center; padding:9px 16px; font-size:.84rem; font-weight:600; }
.zd-root.compact td, .zd-root.compact th{ padding-top:6px; padding-bottom:6px; }
.zd-root.compact .panel{ padding:14px; }
.zd-root.rm *, .zd-root.rm *::before, .zd-root.rm *::after{ animation:none !important; transition:none !important; }
@media (max-width: 640px){ .set-row{ flex-wrap:wrap; } .set-ctl{ max-width:100%; } .set-panel{ padding:4px 14px; } .set-ctl select{ min-width:0; width:100%; } }

/* ---- Sign-in extras ---- */
.field-hint{ font-size:.74rem; color:var(--muted); margin-top:4px; line-height:1.35; }
.field-hint.ok{ color:var(--primary); }
.field-hint.bad{ color:var(--danger); }
.field-hint.warn{ color:var(--gold-d); font-weight:600; }
.auth-row{ display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin:6px 0 12px; }
.auth-row .link-btn{ margin-top:0; }
.consent.inline{ margin:0; align-items:center; }
.inline-link{ background:none; border:none; padding:0; color:var(--primary); font-weight:600; font-size:inherit; cursor:pointer; text-decoration:underline; }
.pw-meter{ display:flex; align-items:center; gap:10px; margin-top:6px; font-size:.74rem; color:var(--muted); }
.pw-bars{ display:flex; gap:4px; flex:1; }
.pw-bars i{ height:5px; flex:1; border-radius:3px; background:var(--border); }
.pw-bars i.on.s1{ background:var(--danger); }
.pw-bars i.on.s2{ background:#D98B2B; }
.pw-bars i.on.s3{ background:#8AA83A; }
.pw-bars i.on.s4{ background:var(--primary); }
.notice-body h4{ margin:14px 0 4px; font-size:.9rem; }
.notice-body p{ margin:0 0 6px; font-size:.86rem; line-height:1.55; color:var(--ink); }
.reset-chip{ display:inline-block; margin-left:6px; font-size:.66rem; font-weight:700; background:#FDF1D3; color:var(--gold-d); border-radius:999px; padding:1px 8px; white-space:nowrap; }
.reset-banner{ background:#FDF1D3; border:1px solid #F0DFA6; color:var(--gold-d); border-radius:12px; padding:10px 14px; font-size:.84rem; font-weight:600; margin-bottom:14px; }
.auth-card{ min-width:0; }
.form-grid > *{ min-width:0; }
.form-grid input, .form-grid select, .form-grid textarea{ min-width:0; max-width:100%; }
@media (max-width: 640px){
  .form-grid{ grid-template-columns:1fr; }
  .auth-form-side{ padding:20px 16px; }
}

/* ---- Motion: keeps every screen lively. Turned off by "Reduce motion" and by the device setting. ---- */
@keyframes zdRise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes zdFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes zdPop{ from{ opacity:0; transform:translateY(10px) scale(.96); } to{ opacity:1; transform:none; } }
@keyframes zdSlideIn{ from{ opacity:0; transform:translateX(-12px); } to{ opacity:1; transform:none; } }
@keyframes zdToast{ from{ opacity:0; transform:translate(-50%,16px); } to{ opacity:1; transform:translate(-50%,0); } }
@keyframes zdFloat{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
@keyframes zdPulse{ 0%{ box-shadow:0 0 0 0 rgba(201,150,43,.55); } 70%{ box-shadow:0 0 0 8px rgba(201,150,43,0); } 100%{ box-shadow:0 0 0 0 rgba(201,150,43,0); } }
@keyframes zdShimmer{ 0%{ background-position:-200% 0; } 100%{ background-position:200% 0; } }
@keyframes zdSpin{ to{ transform:rotate(360deg); } }

/* every page slides up as it opens, then its blocks follow one after another */
.main > *{ animation:zdRise .45s cubic-bezier(.2,.7,.2,1) backwards; }
.main > *:nth-child(2){ animation-delay:.06s; }
.main > *:nth-child(3){ animation-delay:.12s; }
.main > *:nth-child(4){ animation-delay:.18s; }
.main > *:nth-child(n+5){ animation-delay:.24s; }
.stat-grid > *, .grid-2 > *, .list-card, .ig-post, .cel-row{ animation:zdRise .5s cubic-bezier(.2,.7,.2,1) backwards; }
.stat-grid > *:nth-child(1), .grid-2 > *:nth-child(1){ animation-delay:.08s; }
.stat-grid > *:nth-child(2), .grid-2 > *:nth-child(2){ animation-delay:.16s; }
.stat-grid > *:nth-child(3){ animation-delay:.24s; }
.stat-grid > *:nth-child(4){ animation-delay:.32s; }
.stat-grid > *:nth-child(5){ animation-delay:.4s; }
.stat-grid > *:nth-child(n+6){ animation-delay:.48s; }
.stack > .list-card:nth-child(1), .stack > .ig-post:nth-child(1){ animation-delay:.05s; }
.stack > .list-card:nth-child(2), .stack > .ig-post:nth-child(2){ animation-delay:.1s; }
.stack > .list-card:nth-child(3), .stack > .ig-post:nth-child(3){ animation-delay:.15s; }
.stack > .list-card:nth-child(n+4), .stack > .ig-post:nth-child(n+4){ animation-delay:.2s; }
tbody tr{ animation:zdFade .4s ease backwards; }
tbody tr:nth-child(1){ animation-delay:.04s; } tbody tr:nth-child(2){ animation-delay:.08s; } tbody tr:nth-child(3){ animation-delay:.12s; } tbody tr:nth-child(4){ animation-delay:.16s; } tbody tr:nth-child(5){ animation-delay:.2s; } tbody tr:nth-child(n+6){ animation-delay:.24s; }

/* things you can touch respond */
.stat-card, .list-card, .panel, .landing-stat{ transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.stat-card:hover, .list-card:hover, .landing-stat:hover{ transform:translateY(-3px); box-shadow:0 8px 22px #16302b1f; border-color:#cfc7aa; }
.btn{ transition:transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease; }
.btn:not(:disabled):hover{ transform:translateY(-2px); box-shadow:0 6px 14px #16302b26; }
.btn:not(:disabled):active{ transform:translateY(0) scale(.97); box-shadow:none; }
.btn svg{ transition:transform .2s ease; }
.btn:not(:disabled):hover svg{ transform:scale(1.12) rotate(-4deg); }
.icon-btn{ transition:transform .15s ease, background .15s ease, color .15s ease; }
.icon-btn:hover{ transform:scale(1.18); }
.icon-btn:active{ transform:scale(.92); }
.chip{ transition:transform .15s ease, background .15s ease, border-color .15s ease; }
.chip:hover{ transform:translateY(-2px); }
tbody tr{ transition:background .15s ease; }
tbody tr:hover{ background:#F6F3EA; }
input, select, textarea{ transition:border-color .15s ease, box-shadow .2s ease; }
input:focus, select:focus, textarea:focus{ border-color:var(--primary); box-shadow:0 0 0 3px rgba(31,93,78,.16); outline:none; }
.avatar, .mini-avatar{ transition:transform .2s ease; }
.avatar:hover, .mini-avatar:hover{ transform:scale(1.08); }

/* sidebar */
.sidebar{ animation:zdSlideIn .5s cubic-bezier(.2,.7,.2,1) backwards; }
.side-item{ transition:background .15s ease, color .15s ease, transform .15s ease, padding-left .15s ease; }
.side-item:hover{ transform:translateX(4px); }
.side-item svg{ transition:transform .2s ease; }
.side-item:hover svg{ transform:scale(1.18) rotate(-6deg); }
.side-badge{ animation:zdPulse 1.8s ease-out infinite; }

/* popups */
.modal-backdrop{ animation:zdFade .2s ease; }
.modal{ animation:zdPop .28s cubic-bezier(.2,.8,.2,1); }
.toast{ animation:zdToast .3s cubic-bezier(.2,.8,.2,1); }

/* sign-in and landing */
.auth-side-inner > *{ animation:zdRise .6s cubic-bezier(.2,.7,.2,1) backwards; }
.auth-side-inner > *:nth-child(2){ animation-delay:.1s; } .auth-side-inner > *:nth-child(3){ animation-delay:.2s; } .auth-side-inner > *:nth-child(n+4){ animation-delay:.3s; }
.auth-card{ animation:zdPop .5s cubic-bezier(.2,.8,.2,1) .1s backwards; }
.brand-mark{ animation:zdFloat 3.2s ease-in-out infinite; }
.brand-mark.small{ animation:none; }
.landing-hero-copy > *{ animation:zdRise .65s cubic-bezier(.2,.7,.2,1) backwards; }
.landing-hero-copy > *:nth-child(2){ animation-delay:.12s; } .landing-hero-copy > *:nth-child(3){ animation-delay:.24s; } .landing-hero-copy > *:nth-child(n+4){ animation-delay:.36s; }
.landing-hero-panel{ animation:zdPop .7s cubic-bezier(.2,.8,.2,1) .25s backwards; }
.landing-stat{ animation:zdRise .6s cubic-bezier(.2,.7,.2,1) backwards; }
.landing-stat:nth-child(2){ animation-delay:.15s; } .landing-stat:nth-child(3){ animation-delay:.3s; } .landing-stat:nth-child(n+4){ animation-delay:.45s; }

/* loading */
.loader svg{ animation:zdFloat 1.4s ease-in-out infinite; }

@media (prefers-reduced-motion:reduce){
  .main > *, .stat-grid > *, .grid-2 > *, .list-card, .ig-post, .cel-row, tbody tr, .sidebar, .side-badge, .modal-backdrop, .modal, .toast,
  .auth-side-inner > *, .auth-card, .brand-mark, .landing-hero-copy > *, .landing-hero-panel, .landing-stat{ animation:none !important; }
  .stat-card, .list-card, .btn, .icon-btn, .chip, .side-item, .avatar, .mini-avatar{ transition:none !important; transform:none !important; }
}

`;

// If anything ever crashes, show a readable message instead of a blank white page.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("App crashed:", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error);
    const btn = { border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer", background: "#1F5D4E", color: "#fff", fontSize: 14 };
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F3EA", color: "#16302B", fontFamily: "Inter, system-ui, sans-serif", padding: 20, colorScheme: "light" }}>
        <div style={{ maxWidth: 460, width: "100%", background: "#FFFFFF", border: "1px solid #E2DCC8", borderRadius: 16, padding: 24 }}>
          <h2 style={{ margin: "0 0 8px", color: "#16302B" }}>Something went wrong</h2>
          <p style={{ margin: "0 0 12px", color: "#6B7A73", lineHeight: 1.5 }}>The page hit a problem and stopped. Your saved data is safe. Try reloading, or sign out and sign in again.</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#F6F3EA", padding: 10, borderRadius: 8, fontSize: 12, color: "#B23A34" }}>{msg}</pre>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={btn} onClick={() => window.location.reload()}>Reload</button>
            <button style={{ ...btn, background: "#FFFFFF", color: "#16302B", border: "1px solid #E2DCC8" }} onClick={() => { try { window.localStorage.removeItem("zd_session"); window.localStorage.removeItem("zd_tab"); window.sessionStorage.removeItem("zd_session_tmp"); } catch { /* ignore */ } window.location.hash = ""; window.location.reload(); }}>Sign out and reload</button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
