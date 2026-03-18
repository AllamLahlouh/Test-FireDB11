# 🔬 MedLab LIS v5

A fully client-side **Laboratory Information System** built with plain HTML, CSS, and JavaScript. No server, no database — all data is stored in your browser's `localStorage`.

## ✨ Features

| Feature | Description |
|---|---|
| 🛡️ Role-based Access | Admin, Doctor, and Lab Technician roles |
| 👤 Patient Management | Register, search, and view full patient profiles |
| 🧪 Tests Catalog | 25+ pre-loaded tests with sub-parameters (CBC, LFT, etc.) |
| 📋 Lab Orders | Create and track orders with priority levels |
| 🔬 Result Entry | Enter results per parameter with auto H/L/N flagging |
| 🖨️ Print Report | Generate a formatted lab report for any patient/order |
| 💰 Billing | Invoice tracking with payment status |
| 🔄 Shift Management | Lab tech shift tracking |
| 📤 Excel Export/Import | Full data export & import via `.xlsx` |

## 🚀 Getting Started

### Option 1 — Open locally
Just open `index.html` directly in your browser. No build step needed.

### Option 2 — GitHub Pages (live demo)
1. Fork this repository
2. Go to **Settings → Pages**
3. Set source to **GitHub Actions**
4. Push to `main` — the site deploys automatically

> The included `.github/workflows/deploy.yml` handles deployment on every push to `main`.

## 🔑 Demo Credentials

| Role | Username | Password |
|---|---|---|
| Admin | `Admin` | `Admin12345` |
| Doctor | `dr.khatib` | `doctor123` |
| Doctor | `dr.najjar` | `doctor123` |
| Lab Tech | `labtech1` | `lab123` |
| Lab Tech | `labtech2` | `lab123` |

## 📁 Project Structure

```
medlab-lis/
├── index.html              # Main HTML structure & all views
├── css/
│   └── style.css           # All styles (including print fix)
├── js/
│   └── app.js              # All application logic
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages auto-deploy
└── README.md
```

## 🖨️ Printing Fix (v5.3)

Previous versions had a bug where the print report would show a blank page. This was caused by a mismatch between the CSS `@media print` selector (`#repView`) and the actual HTML element ID (`#report-view`). This has been corrected in `css/style.css`.

## 🔒 Data & Privacy

All data is stored exclusively in your browser's `localStorage`. Nothing is sent to any server. Clearing browser data will reset the application to its demo state.

## 📋 Notes

- Passwords are stored in plain text in `localStorage` — this is a **demo/local-use application** and is not intended for production use without proper backend security.
- The app uses the [SheetJS (xlsx)](https://sheetjs.com/) library for Excel export/import, loaded from CDN.

---

Built for educational and clinical demo purposes. © MedLab LIS v5.0
