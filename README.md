# Life OS

A beautiful, mobile-first, offline-first Progressive Web App (PWA) designed to be your ultimate "calm" productivity operating system. 

Built with React, Vite, Tailwind CSS v4, Dexie (IndexedDB), and Supabase.

## Features

- 📱 **Mobile-First PWA**: Install it on your phone's home screen for a native app experience.
- ⚡️ **Offline-First Architecture**: Everything saves instantly to local IndexedDB for zero latency, then syncs quietly to Supabase in the background when you have internet.
- ☀️ **Morning & Evening Routines**: Step-by-step flows to set your daily intent, carry over tasks, and wind down at night.
- ✅ **Task Management**: Simple, gesture-based task list with automatic next-day carry-over.
- 💰 **Finance Tracking**: Log expenses and income against a daily budget.
- 🎯 **Goals**: Track progress on daily, weekly, or monthly habits.
- 📚 **Library**: Manage your reading list and track book progress.
- 🗓️ **Time-Blocked Agenda**: Plan your day out in chunks.
- 📥 **Inbox & Notes**: Capture passing thoughts instantly and process them later into tasks or freewriting markdown notes.
- 🔍 **Global Search**: Instantly find tasks, notes, books, and thoughts across the entire system.
- 💾 **Data Ownership**: Export your entire Life OS as a JSON backup or CSV at any time.

## Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS v4 + Tailwind Typography
- **Database (Cloud)**: Supabase (PostgreSQL)
- **Database (Local)**: Dexie.js (IndexedDB wrapper)
- **State & Sync**: Zustand (global state) + TanStack Query (mutations) + custom background Sync Queue.
- **PWA**: `vite-plugin-pwa` + Workbox
- **Icons**: Lucide React
- **UI Components**: Radix UI Primitives

## Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase Project

### 1. Database Setup
1. Go to your Supabase project dashboard.
2. Run the SQL script found in `supabase_schema.sql` in the SQL Editor. This will create all 12 necessary tables, row-level security (RLS) policies, and database triggers.

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Build for Production
```bash
npm run build
npm run preview
```

## Architecture Notes

### Optimistic Updates
Every data mutation (adding a task, logging a transaction) updates local IndexedDB instantly. A background queue (`src/db/syncQueue.ts`) then pushes the change to Supabase. If the user is offline, the queue waits until the connection is restored.

### Time Travel
The app operates strictly on a `selectedDate` state. Navigating through the header calendar changes this date, and the entire app (tasks, finance, agenda) instantly shifts to show that day's data without refetching from the server.

## License
MIT
