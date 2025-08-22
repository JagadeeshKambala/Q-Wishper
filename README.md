# Q-Whisper — Quantum-Flavored Secure Messaging

> A demo-ready messaging app that blends **AES-GCM encryption** with a **BB84 QKD simulation** and a clean, responsive UI.  
> Frontend: **React + TypeScript + Tailwind** · Backend: **FastAPI (Python)** · Realtime: **Firebase (Auth + Firestore)**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)]() [![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)]() [![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg)]() [![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28.svg)]()

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Screenshots](#screenshots)
5. [Tech Stack](#tech-stack)
6. [Prerequisites](#prerequisites)
7. [Quick Start (Local, No Hosting)](#quick-start-local-no-hosting)
8. [Configuration](#configuration)
9. [Run the App](#run-the-app)
10. [Project Structure](#project-structure)
11. [Firestore Rules (Example)](#firestore-rules-example)
12. [Useful Scripts](#useful-scripts)
13. [Troubleshooting](#troubleshooting)
14. [Security Notes](#security-notes)
15. [Roadmap](#roadmap)
16. [Contributing](#contributing)
17. [License](#license)

---

## Overview

**Q-Whisper** is a secure chat prototype that demonstrates how **quantum-inspired key exchange (BB84 simulation)** can be combined with **practical client-side encryption (AES-GCM)** and **Firebase realtime sync**. It’s designed for demos, hackathons, and learning.

---

## Features

- 🔐 **Auth & Profiles** — Firebase Authentication (Google + Email/Password), unique usernames, profile display name.
- 💬 **Realtime Messaging** — Firestore listeners, unread badges, highlighted chats.
- 🛡️ **Security Layer** — BB84 QKD simulation + QRNG endpoint → HKDF → **per-chat AES-GCM session keys**.
- 🧭 **Clean UI/UX** — Responsive layout for desktop & mobile, settings sidebar, readable color palette.
- 🧪 **Demo-Ready** — Runs locally end-to-end with clear commands and configs.

---

## Architecture

Browser (React + TS + Tailwind)
│
├── Firebase Auth (login) ──> User identities
├── Firestore (RT sync) ────> Chats, messages (ciphertext)
│
└── FastAPI (Python)
├─ /qrng → quantum-flavored randomness
└─ /simulate_bb84 → BB84 bits + QBER (simulation)

**Crypto flow**: QRNG/seed → BB84 simulated bits → HKDF → AES-GCM key → encrypt/decrypt in browser.

---

## Screenshots

> Place images in `/docs/` and reference here.

- **Login & Username** — `docs/screenshot-login.png`
- **Chat List (unread badges)** — `docs/screenshot-chatlist.png`
- **Chat Window (encrypted messages)** — `docs/screenshot-chatwindow.png`
- **Settings Sidebar** — `docs/screenshot-settings.png`
- **Firebase Firestore Structure** — `docs/screenshot-firestore.png`

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Python 3.10+, FastAPI, Uvicorn
- **Realtime & Auth**: Firebase Firestore + Firebase Authentication
- **Crypto (browser)**: Web Crypto API (AES-GCM), HKDF helpers

---

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x (or **pnpm**/**yarn**)
- **Python** ≥ 3.10
- A **Firebase** project with **Authentication** and **Firestore** enabled
  > Tip (macOS): install via Homebrew
  >
  > ```bash
  > brew install node python@3.11
  > ```

---

## Quick Start (Local, No Hosting)

### Option A — Download ZIP

```bash
unzip Q-Whisper.zip
cd Q-Whisper
```

Configuration

1. Firebase (Frontend)
   Update frontend/src/lib/firebaseClient.ts:
   export const firebaseConfig = {
   apiKey: "YOUR_API_KEY",
   authDomain: "YOUR_PROJECT.firebaseapp.com",
   projectId: "YOUR_PROJECT_ID",
   storageBucket: "YOUR_PROJECT.appspot.com",
   messagingSenderId: "123456789",
   appId: "1:123456789:web:abcdef",
   };
   Whitelist domains in Firebase Auth → Authorized domains:
   localhost
   127.0.0.1
2. Frontend → Backend URL
   Create frontend/.env:
   VITE_BACKEND_URL=http://127.0.0.1:8000
3. Backend (FastAPI)
   If you need custom settings, create backend/.env:
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   Enable in FastAPI:
   from fastapi.middleware.cors import CORSMiddleware
   origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
   app.add_middleware(
   CORSMiddleware,
   allow_origins=origins,
   allow_credentials=True,
   allow_methods=["*"],
   allow_headers=["*"],
   )

Install & Run (short version)

# Backend

cd backend
python -m venv .venv && source .venv/bin/activate # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# New terminal → Frontend

cd frontend
npm install
npm run dev
