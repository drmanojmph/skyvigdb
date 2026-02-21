import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const API = process.env.REACT_APP_API_URL || "https://skyvigdb-backend.onrender.com/api";

/* ================= IME TERMS ================= */
const IME_TERMS = [
  "Anaphylaxis","Stevens-Johnson syndrome","Toxic epidermal necrolysis",
  "Agranulocytosis","Seizure","Drug reaction with eosinophilia and systemic symptoms",
  "Liver failure","Acute liver failure","Aplastic anaemia","Acute kidney injury",
  "Pulmonary embolism","Ventricular fibrillation","Sudden death","QT prolongation"
];

/* ================= USERS ================= */
const USERS = [
  { username:"triage1",    password:"train123", role:"Triage",     step:1 },
  { username:"dataentry1", password:"train123", role:"Data Entry",  step:2 },
  { username:"medical1",   password:"train123", role:"Medical",     step:3 },
  { username:"quality1",   password:"train123", role:"Quality",     step:4 }
];

/* ================= MEDDRA ================= */
const STAGES = [
  { name:"Triage",     step:1 },
  { name:"Data Entry", step:2 },
  { name:"Medical",    step:3 },
  { name:"Quality",    step:4 },
  { name:"Approved",   step:5 }
];

/* ================= TAILWIND CLASS MAP ================= */
const getColorClasses = (color) => {
  const maps = {
    indigo: { text: "text-indigo-700", border: "border-indigo-200", accent: "accent-indigo-600" },
    blue: { text: "text-blue-700", border: "border-blue-200", accent: "accent-blue-600" },
    purple: { text: "text-purple-700", border: "border-purple-200", accent: "accent-purple-600" },
    yellow: { text: "text-yellow-700", border: "border-yellow-200", accent: "accent-yellow-600" },
    orange: { text: "text-orange-700", border: "border-orange-200", accent: "accent-orange-600" },
    red: { text: "text-red-700", border: "border-red-200", accent: "accent-red-600" },
    green: { text: "text-green-700", border: "border-green-200", accent: "accent-green-600" },
    gray: { text: "text-gray-700", border: "border-gray-200", accent: "accent-gray-600" },
  };
  return maps[color] || maps.indigo;
};

/* ================= UI HELPERS ================= */
const F = (label, el, required=false, hint="") => (
  <div className="flex flex-col gap-1 mb-3">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
      {label}{required && <span className="text-red-500">*</span>}
    </label>
    {hint && <p className="text-xs text-gray-400 -mt-1">{hint}</p>}
    {el}
  </div>
);

const I = (props) => (
  <input className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" {...props} />
);

const S = (opts, props) => (
  <select className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" {...props}>
    <option value="">— Select —</option>
    {opts.map(o => typeof o === "string"
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.v} value={o.v}>{o.l}</option>
    )}
  </select>
);

const C = (label, checked, onChange, color="indigo") => {
  const cls = getColorClasses(color);
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer py-1">
      <input type="checkbox" checked={!!checked} onChange={onChange}
        className={`mt-0.5 w-4 h-4 ${cls.accent} flex-shrink-0`} />
      <span>{label}</span>
    </label>
  );
};

const TA = (props) => (
  <textarea className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full resize-none" rows={3} {...props} />
);

const SectionHead = ({children, color="indigo"}) => {
  const cls = getColorClasses(color);
  return (
    <div className={`text-xs font-bold ${cls.text} uppercase tracking-widest border-b ${cls.border} pb-1 mb-3 mt-4`}>
      {children}
    </div>
  );
};

/* ================= MEDDRA INLINE WIDGET ================= */
const MedDRAWidget = ({ targetSection, targetIdx, currentPt, currentPtCode, currentLlt, currentSoc,
                         meddraQuery, meddraResults, meddraLoading, meddraTarget, setMeddraTarget,
                         searchMeddra, pickMeddra, onClear }) => {
  const isActive = meddraTarget?.section === targetSection && meddraTarget?.idx === targetIdx;

  return (
    <div className="mt-2 mb-1">
      {currentPt ? (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs mb-1">
          <span className="text-purple-600 font-bold">MedDRA 28.1:</span>
          <span className="font-semibold text-purple-900">{currentPt}</span>
          {currentPtCode && <span className="text-purple-400">({currentPtCode})</span>}
          {currentLlt && currentLlt !== currentPt && <span className="text-purple-500">← {currentLlt}</span>}
          {currentSoc && <span className="text-gray-400 ml-1">· {currentSoc}</span>}
          <button onClick={onClear} className="ml-auto text-purple-300 hover:text-red-400 text-xs font-bold">✕</button>
        </div>
      ) : null}

      {!isActive ? (
        <button
          onClick={() => { setMeddraTarget({ section: targetSection, idx: targetIdx }); }}
          className="text-xs text-purple-600 hover:text-purple-800 underline font-medium">
          {currentPt ? "🔄 Recode with MedDRA" : "🔍 Code with MedDRA 28.1"}
        </button>
      ) : (
        <div className="relative">
          <input
            autoFocus
            className="border border-purple-300 rounded px-3 py-1.5 text-sm w-full pr-16 focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="Type LLT or PT (2+ chars)…"
            value={meddraQuery}
            onChange={e => searchMeddra(e.target.value)}
          />
          <div className="absolute right-2 top-1.5 flex gap-2 items-center">
            {meddraLoading && <span className="text-xs text-gray-400 animate-pulse">…</span>}
            <button onClick={() => { setMeddraTarget(null); searchMeddra(""); }}
              className="text-gray-400 hover:text-red-400 text-sm font-bold">✕</button>
          </div>
          {meddraResults.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-56 overflow-y-auto">
              {meddraResults.map(m2 => (
                <div key={m2.llt_code} onClick={() => pickMeddra(m2)}
                  className="px-4 py-2.5 hover:bg-purple-50 cursor-pointer border-b last:border-0">
                  <div className="font-semibold text-sm text-gray-800">
                    {m2.pt} <span className="text-xs text-gray-400 font-normal">PT {m2.pt_code}</span>
                  </div>
                  <div className="text-xs text-gray-400 flex flex-wrap gap-x-3 mt-0.5">
                    <span>LLT: {m2.llt}</span>
                    <span>HLT: {m2.hlt}</span>
                    <span className="text-purple-500">{m2.soc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!meddraLoading && meddraQuery.length >= 2 && meddraResults.length === 0 && (
            <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-sm mt-1 px-4 py-3 text-sm text-gray-400">
              No MedDRA 28.1 terms found for "{meddraQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ================= MAIN APP ================= */
export default function App() {
  const [user, setUser]               = useState(null);
  const [cases, setCases]             = useState([]);
  const [selected, setSelected]       = useState(null);
  const [form, setForm]               = useState({});
  const [login, setLogin]             = useState({ username:"", password:"" });
  const [tab, setTab]                 = useState("general");
  const [meddraQuery, setMeddraQuery] = useState("");
  const [meddraResults, setMeddraResults] = useState([]);
  const [meddraLoading, setMeddraLoading] = useState(false);
  const [msg, setMsg]                 = useState(null);
  const [auditLog, setAuditLog]       = useState([]);
  const [showAudit, setShowAudit]     = useState(false);
  const meddraDebounce                = useRef(null);
  const [meddraTarget, setMeddraTarget] = useState(null); 

  const flash = useCallback((text, type="ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      const res = await axios.get(API + "/cases");
      setCases(res.data || []);
    } catch { flash("Could not load cases — check backend connection.", "error"); }
  }, [flash]);

  useEffect(() => { 
    if (user) { 
      fetchCases(); 
      axios.get(API + "/health").catch(() => {}); 
    } 
  }, [user, fetchCases]);

  const fetchAudit = async (caseId) => {
    try {
      const res = await axios.get(API + "/cases/" + caseId + "/audit");
      setAuditLog(res.data || []);
    } catch { setAuditLog([]); }
  };

  /* ---- E2B(R3) XML EXPORT ---- */
  const downloadE2B = async () => {
    if (!selected?.id) return;
    if (selected.currentStep < 3) {
      flash("⚠️ E2B R3 XML is available from Medical Review (Step 3) onward.", "error");
      return;
    }
    try {
      flash("⏳ Generating E2B(R3) XML…");
      const params = new URLSearchParams({
        user: user?.username || "unknown",
        role: user?.role     || "unknown",
      });
      const res = await axios.get(
        `${API}/cases/${selected.id}/e2b?${params.toString()}`,
        { responseType: "blob" }
      );
      const url  = URL.createObjectURL(new Blob([res.data], { type: "application/xml" }));
      const link = document.createElement("a");
      link.href     = url;
      link.download = `E2B_${selected.caseNumber}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      flash("📨 E2B(R3) XML downloaded — " + selected.caseNumber);
    } catch {
      flash("❌ E2B export failed — check backend connection.", "error");
    }
  };

  /* ---- LOGIN ---- */
  const doLogin = () => {
    const found = USERS.find(u => u.username === login.username && u.password === login.password);
    if (found) { setUser(found); setLogin({ username:"", password:"" }); }
    else alert("Invalid credentials");
  };

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-80">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🛡️</div>
          <h2 className="text-xl font-bold text-gray-800">SkyVigilance</h2>
          <p className="text-xs text-gray-4
