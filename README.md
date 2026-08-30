# ZDSPGC Centralized Alumni Monitoring System

A ready-to-deploy React (Vite) project.

## Important: about data storage

This build saves data to the visitor's browser (`localStorage`), not to a shared
server. That means:

- Great for a demo, a portfolio piece, or a single admin using one browser/device.
- **Not** suitable as-is for real multi-campus use, because each admin's browser
  would have its own separate copy of the data — a Super Admin's changes on one
  computer won't show up for a Campus Admin on another.
- For real production use with shared data across users, this front end would
  need to be connected to a real backend/database (e.g. Supabase, Firebase, or a
  custom API) in place of the `loadStore()` / `persist()` functions near the top
  of `src/App.jsx`.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
```

This creates a `dist/` folder containing the static site.

## Deploy — easiest option (no account needed to try it)

1. Go to https://app.netlify.com/drop
2. Drag the `dist/` folder onto the page.
3. Netlify gives you a live public URL immediately.

## Deploy — recommended for ongoing work (auto-redeploys on every change)

1. Push this project to a GitHub repository.
2. Go to https://vercel.com or https://netlify.com, sign in, and "Import" that repo.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Every time you push a change to GitHub, it rebuilds and redeploys automatically.

## Demo accounts

- Super Admin: `superadmin@zdspgc.edu.ph` / `SuperAdmin!123`
- Campus Admin (Molave): `molave.admin@zdspgc.edu.ph` / `Campus!123`
- Alumni: `maria.santos@example.com` / `alumni123`

**Change these default passwords before sharing a live link with anyone**, since
they're visible in the source code.
