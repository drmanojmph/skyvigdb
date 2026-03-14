import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.REACT_APP_API_URL || "https://skyvigdb-backend.onrender.com/api";

const IME_TERMS = [
  "Anaphylaxis","Stevens-Johnson syndrome","Toxic epidermal necrolysis","Agranulocytosis",
  "Seizure","Drug reaction with eosinophilia and systemic symptoms","Liver failure",
  "Acute liver failure","Aplastic anaemia","Acute kidney injury","Pulmonary embolism",
  "Ventricular fibrillation","Sudden death","QT prolongation"
];

const BASE_ACCOUNTS = [
  { basename: "anand", password: "password123" },
  { basename: "student1", password: "train123" },
  { basename: "demo", password: "demo123" }
];

const ROLE_MAPPING = {
  "triage":      { role: "Triage",      step: 1 },
  "dataentry":   { role: "Data Entry",  step: 2 },
  "medical":     { role: "Medical",     step: 3 },
  "quality":     { role: "Quality",     step: 4 },
  "submissions": { role: "Submissions", step: 5 },
  "archival":    { role: "Archival",    step: 6 }
};

const STAGES = [
  { name:"Triage",      step:1 }, { name:"Data Entry",  step:2 },
  { name:"Medical",     step:3 }, { name:"Quality",     step:4 },
  { name:"Submissions", step:5 }, { name:"Archived",    step:6 }
];

const AGENCIES = [
  { id:"fda",    label:"FDA",           country:"United States",  portal:"https://www.accessdata.fda.gov/scripts/foi/SpringFOI/FOIFullTextSearchAction.do" },
  { id:"ema",    label:"EMA",           country:"European Union", portal:"https://eudravigilance.ema.europa.eu" },
  { id:"mhra",   label:"MHRA",          country:"United Kingdom", portal:"https://yellowcard.mhra.gov.uk" },
  { id:"tga",    label:"TGA",           country:"Australia",      portal:"https://www.tga.gov.au/reporting-adverse-events" },
  { id:"hc",     label:"Health Canada", country:"Canada",         portal:"https://www.canada.ca/en/health-canada/services/drugs-health-products/medeffect-canada.html" },
  { id:"dcgi",   label:"DCGI",          country:"India",          portal:"https://cdsco.gov.in/opencms/opencms/en/pharmacovigilance/" },
  { id:"pmda",   label:"PMDA",          country:"Japan",          portal:"https://www.pmda.go.jp/english" },
  { id:"anvisa", label:"ANVISA",        country:"Brazil",         portal:"https://www.gov.br/anvisa" },
  { id:"sfda",   label:"SFDA",          country:"Saudi Arabia",   portal:"https://www.sfda.gov.sa" },
  { id:"other",  label:"Other",         country:"",               portal:"" },
];

const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China",
  "Colombia", "Czech Republic", "Denmark", "Egypt", "Finland", "France", "Germany",
  "Greece", "Hungary", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan",
  "Malaysia", "Mexico", "Netherlands", "New Zealand", "Norway", "Peru", "Philippines",
  "Poland", "Portugal", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa",
  "South Korea", "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand", "Turkey",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam"
];

const F = (label, el, required=false, hint="") => (
  <div className="flex flex-col gap-1 mb-3">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
      {label}{required && <span className="text-red-500">*</span>}
    </label>
    {hint && <p className="text-xs text-slate-400 -mt-1">{hint}</p>}
    {el}
  </div>
);

const I = (props) => <input className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white w-full transition-all" {...props} />;

const S = (opts, props) => (
  <select className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white w-full transition-all" {...props}>
    <option value="">— Select —</option>
    {opts.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

const C = (label, checked, onChange, color="indigo") => (
  <label className="flex items-start gap-2 text-sm cursor-pointer py-1">
    <input type="checkbox" checked={!!checked} onChange={onChange} className={`mt-0.5 w-4 h-4 accent-${color}-600 flex-shrink-0 cursor-pointer`} />
    <span className="text-slate-700 font-medium">{label}</span>
  </label>
);

const TA = (props) => <textarea className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white w-full resize-none transition-all" rows={3} {...props} />;

const SectionHead = ({children, color="indigo"}) => (
  <div className={`text-xs font-extrabold text-${color}-700 uppercase tracking-widest border-b border-${color}-100 pb-1 mb-4 mt-6`}>{children}</div>
);

const MedDRAWidget = ({ targetSection, targetIdx, currentPt, currentPtCode, currentLlt, currentSoc,
                        meddraQuery, meddraResults, meddraLoading, meddraTarget, setMeddraTarget,
                        searchMeddra, pickMeddra, onClear }) => {
  const isActive = meddraTarget?.section === targetSection && meddraTarget?.idx === targetIdx;
  return (
    <div className="mt-2 mb-2">
      {currentPt && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-white border border-purple-100 rounded-xl px-3 py-2 text-xs mb-1 shadow-sm">
          <span className="text-purple-600 font-bold">MedDRA 28.1:</span>
          <span className="font-semibold text-purple-900">{currentPt}</span>
          {currentPtCode && <span className="text-purple-400">({currentPtCode})</span>}
          {currentLlt && currentLlt !== currentPt && <span className="text-purple-500">← {currentLlt}</span>}
          {currentSoc && <span className="text-slate-400 ml-1">· {currentSoc}</span>}
          <button onClick={onClear} className="ml-auto text-purple-300 hover:text-red-500 text-xs font-bold transition-colors">✕</button>
        </div>
      )}
      {!isActive ? (
        <button onClick={() => setMeddraTarget({ section: targetSection, idx: targetIdx })}
          className="text-xs text-purple-600 hover:text-purple-800 underline font-semibold transition-colors">
          {currentPt ? "🔄 Recode with MedDRA" : "🔍 Code with MedDRA 28.1"}
        </button>
      ) : (
        <div className="relative">
          <input autoFocus
            className="bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm w-full pr-16 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
            placeholder="Type LLT or PT (2+ chars)…"
            value={meddraQuery} onChange={e => searchMeddra(e.target.value)} />
          <div className="absolute right-2 top-2 flex gap-2 items-center">
            {meddraLoading && <span className="text-xs text-slate-400 animate-pulse font-medium">…</span>}
            <button onClick={() => { setMeddraTarget(null); searchMeddra(""); }}
              className="text-slate-400 hover:text-red-500 text-sm font-bold transition-colors">✕</button>
          </div>
          {meddraResults.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto">
              {meddraResults.map(m2 => (
                <div key={m2.llt_code} onClick={() => pickMeddra(m2)}
                  className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors">
                  <div className="font-bold text-sm text-slate-800">{m2.pt} <span className="text-xs text-slate-400 font-normal">PT {m2.pt_code}</span></div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 mt-1">
                    <span>LLT: {m2.llt}</span><span>HLT: {m2.hlt}</span><span className="text-purple-600 font-medium">{m2.soc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!meddraLoading && meddraQuery.length >= 2 && meddraResults.length === 0 && (
            <div className="absolute z-30 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-md mt-1 px-4 py-3 text-sm text-slate-500 font-medium">
              No MedDRA 28.1 terms found for "{meddraQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function SearchPanel({ cases, onOpenCase }) {
  const [qCase,    setQCase]    = React.useState("");
  const [qProduct, setQProduct] = React.useState("");
  const [qCountry, setQCountry] = React.useState("");

  const hasQuery = qCase.trim() || qProduct.trim() || qCountry.trim();

  const results = hasQuery ? cases.filter(c => {
    const caseNum  = (c.caseNumber || c.id || "").toLowerCase();
    const country  = (c.triage?.country || "").toLowerCase();
    const products = (c.products || []).map(p => (p.name || "") + " " + (p.genericName || "")).join(" ").toLowerCase();
    const matchCase    = !qCase.trim()    || caseNum.includes(qCase.trim().toLowerCase());
    const matchProduct = !qProduct.trim() || products.includes(qProduct.trim().toLowerCase());
    const matchCountry = !qCountry.trim() || country.includes(qCountry.trim().toLowerCase());
    return matchCase && matchProduct && matchCountry;
  }) : [];

  const stepColor = (step) => {
    const map = {1:"bg-blue-100 text-blue-800", 2:"bg-teal-100 text-teal-800",
                 3:"bg-purple-100 text-purple-800", 4:"bg-orange-100 text-orange-800",
                 5:"bg-violet-100 text-violet-800", 6:"bg-slate-100 text-slate-700"};
    return map[step] || "bg-slate-100 text-slate-600";
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 w-full">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
        <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-widest mb-5 flex items-center gap-2">🔍 Case Search</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Case Number</label>
            <input
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white w-full transition-all"
              placeholder="e.g. Pharmacovigilance-1718..."
              value={qCase}
              onChange={e => setQCase(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Product / Drug Name</label>
            <input
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white w-full transition-all"
              placeholder="Brand or generic name"
              value={qProduct}
              onChange={e => setQProduct(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Country of Incidence</label>
            <input
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white w-full transition-all"
              placeholder="e.g. India, Germany..."
              value={qCountry}
              onChange={e => setQCountry(e.target.value)}
            />
          </div>
        </div>
        {hasQuery && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {results.length === 0
                ? "No cases match your search."
                : `${results.length} case${results.length === 1 ? "" : "s"} found`}
            </span>
            <button
              onClick={() => { setQCase(""); setQProduct(""); setQCountry(""); }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-bold">
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {hasQuery && results.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-indigo-50/50 border-b border-indigo-100">
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Case #</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Receipt Date</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Country</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Product</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Event (verbatim)</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">MedDRA PT</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Reporter</th>
                <th className="text-left px-5 py-4 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((c) => {
                const t  = c.triage    || {};
                const ev = (c.events   || [{}])[0] || {};
                const d  = (c.products || [{}])[0] || {};
                return (
                  <tr key={c.id}
                    onClick={() => onOpenCase(c)}
                    className="cursor-pointer hover:bg-indigo-50/50 transition-colors bg-white/50">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-700 whitespace-nowrap">{c.caseNumber}</td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap font-medium">{t.receiptDate || "-"}</td>
                    <td className="px-5 py-4 text-slate-700 font-medium">{t.country || "-"}</td>
                    <td className="px-5 py-4 font-bold text-slate-800">{d.name || "-"}{d.genericName ? <span className="text-slate-400 font-normal"> / {d.genericName}</span> : ""}</td>
                    <td className="px-5 py-4 text-slate-600 italic max-w-xs truncate">{ev.term || "-"}</td>
                    <td className="px-5 py-4 font-bold text-purple-700">{ev.pt || "-"}</td>
                    <td className="px-5 py-4 text-slate-500 font-medium">{t.qualification || "-"}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${stepColor(c.currentStep)}`}>
                        {c.status || "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!hasQuery && (
        <div className="text-center py-24">
          <div className="text-5xl mb-4 opacity-50 text-slate-400 drop-shadow-sm">🔍</div>
          <div className="text-sm font-bold text-slate-500">Enter a case number, product name, or country above to search.</div>
          <div className="text-xs text-slate-400 mt-2 font-medium">Searches across active, submitted, and archived cases.</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser]           = useState(null);
  const [cases, setCases]         = useState([]);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState({});
  const [login, setLogin]         = useState({ username:"", password:"" });
  const [tab, setTab]             = useState("general");
  const [meddraQuery, setMeddraQuery]   = useState("");
  const [meddraResults, setMeddraResults] = useState([]);
  const [meddraLoading, setMeddraLoading] = useState(false);
  const [msg, setMsg]             = useState(null);
  const [auditLog, setAuditLog]   = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const meddraDebounce            = useRef(null);
  const [meddraTarget, setMeddraTarget] = useState(null);
  const [dupResults, setDupResults]     = useState(null);
  const [dupLoading, setDupLoading]     = useState(false);
  const [showLineListing, setShowLineListing] = useState(false);
  const [activeView,      setActiveView]      = useState("dashboard");
  const [llFilter,        setLlFilter]        = useState("");
  const [llSortKey,       setLlSortKey]       = useState("receiptDate");
  const [llSortDir,       setLlSortDir]       = useState("desc");
  const [llStepFilter,    setLlStepFilter]    = useState("all");
  const [llSeriousFilter, setLlSeriousFilter] = useState("all");

  useEffect(() => { if (user) { fetchCases(); axios.get(API + "/health").catch(() => {}); } }, [user]);

  const fetchCases = async () => {
    try { const res = await axios.get(API + "/cases"); setCases(res.data || []); }
    catch { flash("Could not load cases — check backend connection.", "error"); }
  };

  const fetchAudit = async (caseId) => {
    try { const res = await axios.get(API + "/cases/" + caseId + "/audit"); setAuditLog(res.data || []); }
    catch { setAuditLog([]); }
  };

  const downloadE2B = async () => {
    if (!selected?.id) return;
    if (selected.currentStep < 3) { flash("⚠️ E2B R3 XML is available from Medical Review (Step 3) onward.", "error"); return; }
    try {
      flash("⏳ Generating E2B(R3) XML…");
      const params = new URLSearchParams({ user: user?.username || "unknown", role: user?.role || "unknown" });
      const res = await axios.get(`${API}/cases/${selected.id}/e2b?${params.toString()}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/xml" }));
      const link = document.createElement("a");
      link.href = url; link.download = `E2B_${selected.caseNumber}.xml`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      flash("📨 E2B(R3) XML downloaded — " + selected.caseNumber);
    } catch { flash("❌ E2B export failed — check backend connection.", "error"); }
  };

  const flash = (text, type="ok") => { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000); };

  const resetSession = () => {
    setForm({});
    setSelected(null);
    setCases([]);
    setAuditLog([]);
    setShowAudit(false);
    setDupResults(null);
    setDupLoading(false);
    setMeddraQuery("");
    setMeddraResults([]);
    setMeddraTarget(null);
    setTab("general");
    setMsg(null);
    setShowLineListing(false);
    setActiveView("dashboard");
    setLlFilter("");
    setLlSortKey("receiptDate");
    setLlSortDir("desc");
    setLlStepFilter("all");
    setLlSeriousFilter("all");
  };

  const doLogin = () => {
    const inputUser = login.username.toLowerCase().trim();
    const inputPass = login.password;
    let foundUser = null;

    if (inputUser.includes("_")) {
      const [basename, suffix] = inputUser.split("_");
      const isValidAccount = BASE_ACCOUNTS.find(b => b.basename === basename && b.password === inputPass);
      const isValidRole = ROLE_MAPPING[suffix];

      if (isValidAccount && isValidRole) {
        foundUser = {
          username: inputUser,
          password: inputPass,
          role: isValidRole.role,
          step: isValidRole.step
        };
      }
    }

    if (foundUser) {
      resetSession();
      setUser(foundUser);
      setLogin({ username:"", password:"" });
    } else {
      alert("Invalid credentials. Ensure format is basename_role (e.g., anand_triage).");
    }
  };

  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center px-4 font-sans text-slate-800">
      <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/20 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 drop-shadow-md">🛡️</div>
          <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 to-blue-800 tracking-tight">SkyVigilance</h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">SafetyDB Platform</p>
        </div>
        <input placeholder="Username (e.g. anand_triage)" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 w-full mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all font-medium"
          value={login.username} onChange={e => setLogin({...login, username:e.target.value})}
          onKeyDown={e => e.key === "Enter" && doLogin()} />
        <input type="password" placeholder="Password" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 w-full mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all font-medium"
          value={login.password} onChange={e => setLogin({...login, password:e.target.value})}
          onKeyDown={e => e.key === "Enter" && doLogin()} />
        <button onClick={doLogin} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white w-full py-3 rounded-xl font-bold shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-sm">
          Sign In
        </button>
        <p className="text-xs text-slate-400 font-medium text-center mt-6">Format: basename_role (e.g. anand_medical)</p>
      </div>
      <p className="mt-8 text-xs font-bold text-slate-400/60 uppercase tracking-widest">A VigiServe Foundation Initiative</p>
    </div>
  );

  const setNested = (section, key, value) =>
    setForm(f => ({ ...f, [section]: { ...(f[section] || {}), [key]: value } }));

  const setDeep = (section, subkey, key, value) =>
    setForm(f => ({ ...f, [section]: { ...(f[section] || {}), [subkey]: { ...((f[section] || {})[subkey] || {}), [key]: value } } }));

  const isMyCase = (c) => c.currentStep === user.step;

  const detectDuplicate = async (silent = false) => {
    const t     = form.triage   || {};
    const drug  = (form.products || [])[0]?.name  || "";
    const event = (form.events   || [])[0]?.term  || "";
    const pt    = (form.events   || [])[0]?.pt    || "";
    if (!drug && !event) return false;
    setDupLoading(true);
    try {
      const res = await axios.post(API + "/cases/duplicate-check", {
        patientInitials: t.patientInitials || "", drugName: drug,
        eventTerm: event, eventPt: pt, country: t.country || "",
        onsetDate: (form.events || [])[0]?.onsetDate || "",
      });
      const { duplicates, fuzzyAvailable } = res.data;
      setDupLoading(false);
      if (!fuzzyAvailable) {
        const dup = cases.find(c =>
          c.triage?.patientInitials === t.patientInitials &&
          (c.products||[])[0]?.name === drug && (c.events||[])[0]?.term === event
        );
        if (dup && !silent) { alert("⚠️ Possible duplicate: " + dup.caseNumber); return true; }
        return false;
      }
      if (duplicates && duplicates.length > 0) {
        setDupResults(duplicates);
        if (!silent) {
          const top = duplicates[0];
          const proceed = window.confirm(
            `⚠️  Potential duplicate detected!\n\nCase: ${top.caseNumber}\nSimilarity: ${top.score}%  (${top.band})\nDrug: ${top.drug}\nEvent: ${top.event || top.eventPt}\nCountry: ${top.country}\nStatus: ${top.status}\n\nClick OK to create anyway, or Cancel to abort.`
          );
          return !proceed;
        }
        return false;
      } else { setDupResults([]); }
    } catch {
      setDupLoading(false);
      const dup = cases.find(c =>
        c.triage?.patientInitials === (form.triage||{}).patientInitials &&
        (c.products||[])[0]?.name === drug && (c.events||[])[0]?.term === event
      );
      if (dup && !silent) { alert("⚠️ Possible duplicate: " + dup.caseNumber); return true; }
    }
    return false;
  };

  const createCase = async () => {
    if (!form.triage?.receiptDate) { alert("Initial Receipt Date is required."); return; }
    if (!form.triage?.country)     { alert("Country of Incidence is required.");  return; }
    const blocked = await detectDuplicate(false);
    if (blocked) return;
    try {
      await axios.post(API + "/cases", {
        triage: form.triage || {}, general: form.general || {}, patient: form.patient || {},
        products: form.products || [], events: form.events || [],
        _audit: { performedBy: user.username, role: user.role }
      });
      setForm({}); setDupResults(null); fetchCases(); flash("✅ Case booked-in successfully.");
    } catch (err) {
      flash("❌ " + (err?.response?.data?.error || "Could not create case — check backend connection."), "error");
    }
  };

  const updateCase = async () => {
    if (!isMyCase(selected)) { alert("⛔ You can only submit cases assigned to your role step."); return; }
    try {
      await axios.put(API + "/cases/" + selected.id, { ...form, _audit: { performedBy: user.username, role: user.role } });
      setSelected(null); setForm({}); fetchCases(); flash("✅ Case submitted successfully.");
    } catch { flash("❌ Update failed.", "error"); }
  };

  const returnCaseToDataEntry = async () => {
    if (!isMyCase(selected)) { alert("⛔ You can only route cases assigned to your role step."); return; }
    if (!window.confirm("Return this case to Data Entry for further information?")) return;
    try {
      await axios.put(API + "/cases/" + selected.id, {
        ...form, medical: { ...(form.medical || {}), routeBackToDataEntry: true },
        _audit: { performedBy: user.username, role: user.role }
      });
      setSelected(null); setForm({}); fetchCases(); flash("↩️ Case returned to Data Entry.");
    } catch { flash("❌ Routing failed.", "error"); }
  };

  const returnCaseToQuality = async () => {
    if (!isMyCase(selected)) { alert("⛔ You can only route cases assigned to your role step."); return; }
    const reason = window.prompt("Return reason (required):");
    if (!reason) return;
    try {
      await axios.put(API + "/cases/" + selected.id, {
        ...form,
        submissions: { ...(form.submissions || {}), routeBackToQuality: true, returnReason: reason },
        _audit: { performedBy: user.username, role: user.role }
      });
      setSelected(null); setForm({}); fetchCases(); flash("↩️ Case returned to Quality Review.");
    } catch { flash("❌ Routing failed.", "error"); }
  };

  const saveTab = async (fields, label = "tab") => {
    if (!selected?.id) { flash("No case selected.", "error"); return; }
    try {
      const res = await axios.patch(API + "/cases/" + selected.id, { ...fields, _audit: { performedBy: user.username, role: user.role } });
      setForm(f => ({ ...f, ...res.data })); setSelected(s => ({ ...s, ...res.data }));
      flash("💾 " + label + " saved.");
    } catch { flash("❌ Save failed — check connection.", "error"); }
  };

  const searchMeddra = (q) => {
    setMeddraQuery(q);
    if (meddraDebounce.current) clearTimeout(meddraDebounce.current);
    if (q.length < 2) { setMeddraResults([]); setMeddraLoading(false); return; }
    setMeddraLoading(true);
    meddraDebounce.current = setTimeout(async () => {
      try {
        const res = await axios.get(API + "/meddra/search", { params: { q, current: "true", limit: 20 } });
        setMeddraResults(res.data || []);
      } catch { setMeddraResults([]); flash("MedDRA search unavailable.", "error"); }
      finally { setMeddraLoading(false); }
    }, 300);
  };

  const pickMeddra = (m) => {
    const target = meddraTarget;
    if (!target || target.section === "medical_event") {
      const events = [...((form.events?.length) ? form.events : [{}])];
      events[0] = { ...events[0], llt:m.llt, llt_code:m.llt_code, pt:m.pt, pt_code:m.pt_code, hlt:m.hlt, hlgt:m.hlgt, soc:m.soc, meddra_version:m.version||"28.1", term:events[0]?.term||m.llt };
      setForm(f => ({ ...f, events })); setMeddraQuery(m.pt);
    } else if (target.section === "event") {
      const events = [...((form.events?.length) ? form.events : [{}])];
      events[target.idx] = { ...events[target.idx], llt:m.llt, llt_code:m.llt_code, pt:m.pt, pt_code:m.pt_code, hlt:m.hlt, hlgt:m.hlgt, soc:m.soc, meddra_version:m.version||"28.1", term:events[target.idx]?.term||m.llt };
      setForm(f => ({ ...f, events }));
    } else if (target.section === "lab") {
      const labData = [...((form.patient?.labData?.length) ? form.patient.labData : [{}])];
      labData[target.idx] = { ...labData[target.idx], meddraPt:m.pt, meddraPtCode:m.pt_code, meddraLlt:m.llt, meddraHlt:m.hlt, meddraSoc:m.soc };
      setForm(f => ({ ...f, patient: { ...f.patient, labData } }));
    } else if (target.section === "history") {
      const otherHistory = [...((form.patient?.otherHistory?.length) ? form.patient.otherHistory : [{}])];
      otherHistory[target.idx] = { ...otherHistory[target.idx], meddraPt:m.pt, meddraPtCode:m.pt_code, meddraLlt:m.llt, meddraHlt:m.hlt, meddraSoc:m.soc };
      setForm(f => ({ ...f, patient: { ...f.patient, otherHistory } }));
    } else if (target.section === "indication") {
      const products = [...((form.products?.length) ? form.products : [{}])];
      products[target.idx] = { ...products[target.idx], indicationPt:m.pt, indicationPtCode:m.pt_code, indicationLlt:m.llt, indicationSoc:m.soc };
      setForm(f => ({ ...f, products }));
    } else if (target.section === "medHistory") {
      setForm(f => ({ ...f, patient: { ...f.patient, medHistoryPt:m.pt, medHistoryPtCode:m.pt_code, medHistoryLlt:m.llt, medHistorySoc:m.soc } }));
    }
    setMeddraResults([]); setMeddraLoading(false); setMeddraTarget(null);
  };

  const autoSerious = () => {
    const pt = (form.events||[])[0]?.pt || "";
    const s  = form.general?.seriousness || {};
    return IME_TERMS.some(t => t.toLowerCase() === pt.toLowerCase()) || Object.values(s).some(v => v === true);
  };

  const runWHOUMC = () => {
    const m = form.medical || {};
    let result = "Unassessable";
    if (m.rechallenge) result = "Certain";
    else if (m.temporal && m.dechallenge && !m.alternative) result = "Probable";
    else if (m.temporal && !m.alternative) result = "Possible";
    else if (m.temporal) result = "Unlikely";
    setForm(f => ({ ...f, medical: { ...m, causality:result } }));
  };

  const runNaranjo = () => {
    const m = form.medical || {};
    let score = 0;
    if (m.nar_previous) score += 1; if (m.nar_reaction) score += 2; if (m.nar_dechallenge) score += 1;
    if (m.nar_rechallenge) score += 2; if (m.nar_alternative) score -= 1; if (m.nar_placebo) score += 1;
    if (m.nar_drug_level) score += 1; if (m.nar_dose_related) score += 1; if (m.nar_prior_exp) score += 1;
    if (m.nar_confirmed) score += 1;
    const cat = score >= 9 ? "Definite" : score >= 5 ? "Probable" : score >= 1 ? "Possible" : "Doubtful";
    setForm(f => ({ ...f, medical: { ...m, naranjScore:score, naranjResult:cat } }));
  };

  const buildMedHistoryText = (p) => {
    const parts = [];
    if (p.medHistory) parts.push(p.medHistory);
    (p.otherHistory || []).filter(h => h.description || h.substance).forEach(h => {
      let entry = h.description || h.substance || "";
      if (h.meddraPt && h.meddraPt !== entry) entry += ` [MedDRA: ${h.meddraPt}]`;
      if (h.startDate) {
        entry += ` (from ${h.startDate}`;
        if (h.stopDate) entry += ` to ${h.stopDate}`;
        else if (h.ongoing) entry += ", ongoing";
        entry += ")";
      }
      if (entry.trim()) parts.push(entry.trim());
    });
    if (p.medHistoryPt && !parts.some(s => s.includes(p.medHistoryPt)))
      parts.push(`${p.medHistoryPt} [MedDRA PT]`);
    return parts.length > 0 ? parts.join("; ") : "no relevant past history";
  };

  const generateNarrative = () => {
    const caseId = selected?.caseNumber || selected?.id || "[Case ID]";
    const p   = form.patient  || {};
    const d   = (form.products || [{}])[0];
    const e   = (form.events   || [{}])[0];
    const g   = form.general  || {};
    const t   = form.triage    || {};
    const med = form.medical   || {};
    const medHistoryDisplay = buildMedHistoryText(p);
    const concomText = p.concomitant ? `Concomitant medications: ${p.concomitant}. ` : "";
    const labs = (p.labData || []).filter(l => l.testName && l.result);
    const labText = labs.length > 0
      ? `Relevant laboratory findings: ${labs.slice(0,3).map(l => `${l.testName} ${l.result}${l.units ? " " + l.units : ""}${l.assessment && l.assessment !== "Normal" ? " (" + l.assessment + ")" : ""}`).join(", ")}. ` : "";
    const serious = autoSerious()
      ? "serious (" + Object.entries(g.seriousness || {}).filter(([,v]) => v).map(([k]) => k).join(", ") + ")" : "non-serious";
    const text =
      `Case ID: ${caseId}. ` +
      `A ${p.age||"[age]"}-year-old ${p.sex||"[sex]"} patient${p.weight ? " (" + p.weight + " kg)" : ""} ` +
      `with a medical history of ${medHistoryDisplay} ` +
      `was receiving ${d?.name||"[drug]"} (${d?.dose||"dose not reported"}, ${d?.route||"route not reported"}) ` +
      `for ${d?.indication||"[indication]"}. ` + concomText +
      `On ${e?.onsetDate||"[onset date]"}, the patient developed ${e?.pt||e?.term||"[event]"}. ` +
      `The event was considered ${serious}. ` + labText +
      (med.causality   ? `Causality was assessed as ${med.causality} per WHO-UMC criteria. ` : "") +
      (med.listedness  ? `The event is ${med.listedness} per the reference safety information. ` : "") +
      `The case was reported by a ${t.qualification||"reporter"} from ${t.country||"[country]"}. ` +
      (e?.outcome ? `Outcome: ${e.outcome}.` : "Outcome: Unknown.");
    setForm(f => ({ ...f, narrative: text }));
  };

  const exportCIOMS = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = 210, PH = 297, M = 10, CW = PW - M * 2;
    const p = form.patient || {}, d = (form.products||[{}])[0], ev = (form.events||[{}])[0];
    const g = form.general || {}, m = form.medical || {}, t = form.triage || {};
    const val = (v) => String(v || ""), na = (v) => v ? String(v) : "—";
    const box = (x,y,w,h) => { doc.setDrawColor(100); doc.rect(x,y,w,h); };
    const hdr = (text,x,y,w,h=5,fill="dark") => {
      doc.setFillColor(fill==="dark"?26:240, fill==="dark"?58:240, fill==="dark"?92:240);
      doc.rect(x,y,w,h,"F"); doc.setTextColor(fill==="dark"?255:40,fill==="dark"?255:40,fill==="dark"?255:40);
      doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.text(text,x+2,y+3.5); doc.setTextColor(0,0,0);
    };
    const lbl = (text,x,y) => { doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(80,80,80); doc.text(text,x,y); doc.setTextColor(0,0,0); };
    const fld = (text,x,y,maxW) => { doc.setFont("helvetica","normal"); doc.setFontSize(8); const ln = doc.splitTextToSize(val(text), maxW); doc.text(ln,x,y); };
    const chk = (checked,x,y) => { box(x,y-2.5,3,3); if(checked){doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("X",x+0.4,y);} };
    let y = M;
    const ensureSpace = (h) => { if (y+h > PH-12) { doc.addPage(); y = M; } };

    doc.setFillColor(26,58,92); doc.rect(M,y,CW,9,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.text("CIOMS I FORM — SUSPECT ADVERSE REACTION REPORT", M+2, y+6);
    doc.setTextColor(0,0,0); y += 10;
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(120,120,120);
    doc.text("Case No: "+na(selected?.caseNumber)+"   |   Generated: "+new Date().toLocaleDateString("en-GB")+"   |   SkyVigilance Training Platform", M, y+3);
    doc.setTextColor(0,0,0); y += 6;

    hdr("I.  REACTION INFORMATION", M, y, CW); y += 6;
    box(M,y,38,14); lbl("1. PATIENT INITIALS",M+1,y+3.5); fld(t.patientInitials,M+1,y+10,36);
    box(M+38,y,40,14); lbl("1a. COUNTRY",M+39,y+3.5); fld(t.country,M+39,y+10,38);
    box(M+78,y,30,14); lbl("2. DATE OF BIRTH",M+79,y+3.5); fld(p.dob||"—",M+79,y+10,28);
    box(M+108,y,22,14); lbl("2a. AGE",M+109,y+3.5); fld(p.age?p.age+" yrs":"—",M+109,y+10,20);
    box(M+130,y,60,14); lbl("3. SEX",M+131,y+3.5);
    chk(p.sex==="Male",M+131,y+10); doc.setFontSize(7); doc.text("Male",M+135,y+10);
    chk(p.sex==="Female",M+146,y+10); doc.text("Female",M+150,y+10);
    chk(!p.sex||p.sex==="Unknown",M+162,y+10); doc.text("Unknown",M+166,y+10); y += 15;

    box(M,y,95,12); lbl("4-6. REACTION ONSET DATE",M+1,y+3.5);
    const op=(ev.onsetDate||"").split("-"); fld(op.length===3?op[2]+"/"+op[1]+"/"+op[0]:na(ev.onsetDate),M+1,y+10,93);
    box(M+95,y,95,12); lbl("7+13. REACTION STOP / RECOVERY DATE",M+96,y+3.5);
    const sp=(ev.stopDate||"").split("-"); fld(sp.length===3?sp[2]+"/"+sp[1]+"/"+sp[0]:"—",M+96,y+10,93); y += 13;

    const ser = ev.seriousness || g.seriousness || {};
    box(M,y,CW,12); lbl("8-12. CHECK ALL APPROPRIATE:",M+1,y+4);
    chk(!!ser.death,M+1,y+10); doc.setFontSize(6.5); doc.text("Patient Died",M+5,y+10);
    chk(!!ser.hospitalisation,M+35,y+10); doc.text("Hospitalisation",M+39,y+10);
    chk(!!ser.disability,M+90,y+10); doc.text("Disability",M+94,y+10);
    chk(!!ser.lifeThreatening,M+145,y+10); doc.text("Life Threatening",M+149,y+10); y += 13;

    let reactionText = "";
    if (ev.term) reactionText += "Verbatim: "+ev.term+"\n";
    if (ev.pt)   reactionText += "MedDRA PT: "+ev.pt+(ev.pt_code?" ("+ev.pt_code+")":"")+" | SOC: "+(ev.soc||"—")+"\n";
    if (ev.outcome) reactionText += "Outcome: "+ev.outcome+"\n";
    const labs=(form.patient?.labData||[]).filter(l=>l.testName);
    if (labs.length>0) reactionText += "Lab: "+labs.map(l=>l.testName+" "+(l.result||"")+" "+(l.units||"")).join("; ");
    box(M,y,CW,28); lbl("DESCRIBE REACTION(S):",M+1,y+4);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(doc.splitTextToSize(reactionText||"—",CW-4).slice(0,5),M+1,y+9); y += 29;

    hdr("II.  SUSPECT DRUG(S) INFORMATION", M, y, CW); y += 6;
    box(M,y,70,12); lbl("14. SUSPECT DRUG(S)",M+1,y+3.5); fld((d?.name||"—")+(d?.genericName?" / "+d.genericName:""),M+1,y+10,68);
    box(M+70,y,35,12); lbl("15. DAILY DOSE(S)",M+71,y+3.5); fld((d?.dose||"—")+" "+(d?.doseUnit||""),M+71,y+10,33);
    box(M+105,y,85,12); lbl("16. ROUTE",M+106,y+3.5); fld(d?.route||"—",M+106,y+10,83); y += 13;
    box(M,y,70,12); lbl("17. INDICATION",M+1,y+3.5); fld(d?.indication||"—",M+1,y+8,68);
    box(M+70,y,60,12); lbl("18. THERAPY DATES",M+71,y+3.5); fld((d?.startDate||"—")+" to "+(d?.stopDate||"—"),M+71,y+10,58);
    box(M+130,y,60,12); lbl("19. DURATION",M+131,y+3.5); fld(d?.duration||"—",M+131,y+10,58); y += 13;
    const dp=d?.dechallenge?.toLowerCase().includes("positive"),dn=d?.dechallenge?.toLowerCase().includes("negative");
    box(M,y,95,12); lbl("20. ABATE ON STOPPING?",M+1,y+3.5);
    chk(dp,M+1,y+10); doc.setFontSize(7); doc.text("YES",M+5,y+10); chk(dn,M+18,y+10); doc.text("NO",M+22,y+10); chk(!dp&&!dn,M+35,y+10); doc.text("NA/NK",M+39,y+10);
    const rp=d?.rechallenge?.toLowerCase().includes("positive"),rn=d?.rechallenge?.toLowerCase().includes("negative");
    box(M+95,y,95,12); lbl("21. REAPPEAR ON REINTRODUCTION?",M+96,y+3.5);
    chk(rp,M+96,y+10); doc.text("YES",M+100,y+10); chk(rn,M+113,y+10); doc.text("NO",M+117,y+10); chk(!rp&&!rn,M+130,y+10); doc.text("NA/NK",M+134,y+10); y += 13;

    hdr("III.  CONCOMITANT DRUG(S) AND HISTORY", M, y, CW); y += 6;
    box(M,y,CW,18); lbl("22. CONCOMITANT DRUG(S):",M+1,y+4);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(doc.splitTextToSize(p.concomitant||"None reported",CW-4).slice(0,3),M+1,y+9); y += 19;

    const histText23 = buildMedHistoryText(p);
    box(M,y,CW,22); lbl("23. OTHER RELEVANT HISTORY:",M+1,y+4);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(doc.splitTextToSize(histText23,CW-4).slice(0,4),M+1,y+9); y += 23;

    hdr("IV.  MANUFACTURER INFORMATION", M, y, CW); y += 6;
    box(M,y,90,16); lbl("24a. MANUFACTURER / MAH",M+1,y+3.5); fld((d?.mah||"SkyVigilance Training Platform")+"\nFor training purposes only",M+1,y+9,88);
    box(M+90,y,40,16); lbl("24b. MFR CONTROL NO.",M+91,y+3.5); fld(selected?.caseNumber||"—",M+91,y+10,38);
    box(M+130,y,60,16); lbl("24c. DATE RECEIVED",M+131,y+3.5); fld(t.receiptDate||"—",M+131,y+10,58); y += 17;
    box(M,y,CW,12); lbl("24d. REPORT SOURCE:",M+1,y+4);
    const rt=(t.reportType||g.reportType||"").toLowerCase();
    chk(rt.includes("stud"),M+35,y+9); doc.setFontSize(7); doc.text("STUDY",M+39,y+9);
    chk(rt.includes("lit"),M+65,y+9); doc.text("LITERATURE",M+69,y+9);
    chk(!rt.includes("stud")&&!rt.includes("lit"),M+100,y+9); doc.text("HEALTH PROFESSIONAL/SPONTANEOUS",M+104,y+9); y += 13;
    box(M,y,95,10); lbl("DATE OF THIS REPORT:",M+1,y+3.5); fld(new Date().toLocaleDateString("en-GB"),M+1,y+8,93);
    box(M+95,y,95,10); lbl("25a. REPORT TYPE:",M+96,y+3.5);
    chk((g.reportType||"Initial").toLowerCase()==="initial",M+96,y+8); doc.setFontSize(7); doc.text("INITIAL",M+100,y+8);
    chk((g.reportType||"").toLowerCase().includes("follow"),M+125,y+8); doc.text("FOLLOWUP",M+129,y+8); y += 12;

    if (m.causality||m.listedness||ev.pt) {
      ensureSpace(28);
      hdr("MEDICAL ASSESSMENT (SkyVigilance supplementary)", M, y, CW, 5, "light"); y += 6;
      box(M,y,60,10); lbl("MedDRA PT",M+1,y+3.5); fld(ev.pt||"Not coded",M+1,y+8,58);
      box(M+60,y,40,10); lbl("PT Code",M+61,y+3.5); fld(ev.pt_code||"—",M+61,y+8,38);
      box(M+100,y,40,10); lbl("SOC",M+101,y+3.5); fld(ev.soc||"—",M+101,y+8,38);
      box(M+140,y,50,10); lbl("MedDRA Version",M+141,y+3.5); fld("28.1",M+141,y+8,48); y += 11;
      box(M,y,60,10); lbl("WHO-UMC Causality",M+1,y+3.5); fld(m.causality||"Not assessed",M+1,y+8,58);
      box(M+60,y,60,10); lbl("Listedness",M+61,y+3.5); fld(m.listedness||"Not assessed",M+61,y+8,58);
      box(M+120,y,70,10); lbl("Seriousness",M+121,y+3.5); fld(autoSerious()?"SERIOUS":"Non-serious",M+121,y+8,68); y += 11;
    }

    const narrativeText = form.narrative || "";
    if (narrativeText) {
      ensureSpace(50);
      hdr("CASE NARRATIVE", M, y, CW); y += 6;
      const avail = PH - y - 15, boxH = Math.min(65, Math.max(25, avail));
      const maxLn = Math.floor(boxH / 4.5);
      box(M,y,CW,boxH);
      const narLn = doc.splitTextToSize(narrativeText, CW-4);
      doc.setFont("helvetica","normal"); doc.setFontSize(8);
      doc.text(narLn.slice(0, maxLn), M+1, y+5);
      if (narLn.length > maxLn) {
        doc.addPage(); let y2 = M;
        hdr("CASE NARRATIVE (continued)", M, y2, CW); y2 += 6;
        const avail2 = PH - y2 - 15; box(M,y2,CW,avail2);
        doc.text(narLn.slice(maxLn, maxLn + Math.floor(avail2/4.5)), M+1, y2+5);
      }
    }

    const pc = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= pc; pg++) {
      doc.setPage(pg); doc.setFont("helvetica","italic"); doc.setFontSize(6.5); doc.setTextColor(150,150,150);
      doc.text("Generated by SkyVigilance Training Platform — For training purposes only — Not for regulatory submission", M, PH-5);
      doc.setTextColor(0,0,0);
    }
    doc.save("CIOMS_I_"+(selected?.caseNumber||"case")+".pdf");
  };

  const exportMedWatch = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW=210, PH=297, M=10, CW=PW-M*2;
    const p=form.patient||{}, d=(form.products||[{}])[0], ev=(form.events||[{}])[0];
    const g=form.general||{}, t=form.triage||{}, m=form.medical||{};
    const val = (v) => v ? String(v) : "";
    const na  = (v) => v ? String(v) : "—";
    const box = (x,y,w,h) => { doc.setDrawColor(0,0,0); doc.setLineWidth(0.3); doc.rect(x,y,w,h); };
    const hdrBlue = (text,x,y,w,h=6) => {
      doc.setFillColor(0,102,204); doc.rect(x,y,w,h,"F");
      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(8);
      doc.text(text,x+2,y+4); doc.setTextColor(0,0,0);
    };
    const lbl = (text,x,y) => { doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(60,60,60); doc.text(text,x,y); doc.setTextColor(0,0,0); };
    const fld = (text,x,y,maxW) => { doc.setFont("helvetica","normal"); doc.setFontSize(8); if(!text)return; const ln=doc.splitTextToSize(String(text),maxW); doc.text(ln,x,y); };
    const chkBox = (checked,x,y) => { box(x,y-2.5,3,3); if(checked){doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text("✓",x+0.2,y);} };
    let y = M;
    const ensureSpace = (h) => { if (y+h > PH-12) { doc.addPage(); y = M; } };

    doc.setFillColor(0,102,204); doc.rect(M,y,CW,16,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(9);
    doc.text("U.S. DEPARTMENT OF HEALTH AND HUMAN SERVICES",M+2,y+5);
    doc.text("Food and Drug Administration",M+2,y+10);
    doc.setFontSize(13); doc.text("MEDWATCH — FORM FDA 3500",M+95,y+11);
    doc.setTextColor(0,0,0); y += 17;
    doc.setFont("helvetica","italic"); doc.setFontSize(7); doc.setTextColor(80,80,80);
    doc.text("For use by Health Professionals for VOLUNTARY reporting of adverse events, product problems and product use / medication errors",M,y+3.5);
    doc.setTextColor(0,0,0); y += 6;
    doc.setFont("helvetica","italic"); doc.setFontSize(6.5); doc.setTextColor(150,150,150);
    doc.text("Case: "+na(selected?.caseNumber)+"   |   Generated: "+new Date().toLocaleDateString("en-GB")+"   |   SkyVigilance Training Platform — For training purposes only",M,y+3);
    doc.setTextColor(0,0,0); y += 6;

    hdrBlue("A.  PATIENT INFORMATION",M,y,CW); y += 7;
    const initials=val(p.initials||t.patientInitials);
    box(M,y,52,15); lbl("1. Patient Identifier",M+1,y+3.5); fld(initials||"—",M+1,y+11,50);
    box(M+52,y,25,15); lbl("2. Age at onset",M+53,y+3.5); fld(p.age?p.age+" yrs":"—",M+53,y+11,23);
    box(M+77,y,33,15); lbl("3. Sex",M+78,y+3.5);
    chkBox(p.sex==="Male",M+78,y+11); doc.setFontSize(7); doc.text("Male",M+82,y+11);
    chkBox(p.sex==="Female",M+95,y+11); doc.text("Female",M+99,y+11);
    box(M+110,y,30,15); lbl("4. Weight",M+111,y+3.5); fld(p.weight?p.weight+" kg":"—",M+111,y+11,28);
    box(M+140,y,50,15); lbl("5. Race / Ethnicity",M+141,y+3.5); fld(p.ethnicity||p.race||"—",M+141,y+11,48); y += 16;

    ensureSpace(55); hdrBlue("B.  ADVERSE EVENT, PRODUCT PROBLEM",M,y,CW); y += 7;
    box(M,y,80,22); lbl("1. Type of Report",M+1,y+4);
    chkBox(true,M+1,y+11); doc.setFontSize(7); doc.text("Adverse Event",M+5,y+11);
    chkBox(false,M+1,y+17); doc.text("Product Use / Medication Error",M+5,y+17);
    chkBox(false,M+55,y+11); doc.text("Product Problem",M+59,y+11);
    box(M+80,y,110,22); lbl("2. Outcomes (check all that apply)",M+81,y+4);
    const ser=ev.seriousness||g.seriousness||t.seriousness||{};
    chkBox(!!ser.death,M+81,y+11); doc.setFontSize(7); doc.text("Death",M+85,y+11);
    chkBox(!!ser.lifeThreatening,M+81,y+17); doc.text("Life-Threatening",M+85,y+17);
    chkBox(!!ser.hospitalisation||!!ser.hospitalization,M+120,y+11); doc.text("Hospitalization",M+124,y+11);
    chkBox(!!ser.disability,M+120,y+17); doc.text("Disability",M+124,y+17);
    chkBox(!!ser.congenital,M+155,y+11); doc.text("Congenital Anomaly",M+159,y+11);
    chkBox(!!ser.medSignificant,M+155,y+17); doc.text("Other Med. Signif.",M+159,y+17); y += 23;

    box(M,y,95,12); lbl("3. Date of Adverse Event (DD/MM/YYYY)",M+1,y+3.5);
    const op2=(ev.onsetDate||"").split("-");
    fld(op2.length===3?op2[2]+"/"+op2[1]+"/"+op2[0]:na(ev.onsetDate),M+1,y+10,93);
    box(M+95,y,95,12); lbl("4. Date of this Report",M+96,y+3.5);
    fld(new Date().toLocaleDateString("en-GB"),M+96,y+10,93); y += 13;

    const narrativeText = form.narrative || (ev.term ? `Verbatim: ${ev.term}${ev.pt ? `\nMedDRA PT: ${ev.pt} (${ev.pt_code||""}) | SOC: ${ev.soc||""}` : ""}` : "");
    const narLn2 = doc.splitTextToSize(narrativeText||"—", CW-4);
    const narBoxH2 = Math.min(70, Math.max(25, narLn2.length * 4.5 + 10));
    ensureSpace(narBoxH2+10);
    box(M,y,CW,narBoxH2+6); lbl("5. Describe Event or Problem:",M+1,y+4);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(narLn2.slice(0, Math.floor(narBoxH2/4.5)),M+1,y+10);
    if (narLn2.length > Math.floor(narBoxH2/4.5)) {
      doc.addPage(); let y2=M; hdrBlue("B.5  NARRATIVE (continued)",M,y2,CW); y2+=7;
      const av2=PH-y2-20; box(M,y2,CW,av2); doc.setFont("helvetica","normal"); doc.setFontSize(8);
      doc.text(narLn2.slice(Math.floor(narBoxH2/4.5),Math.floor(narBoxH2/4.5)+Math.floor(av2/4.5)),M+1,y2+5);
      doc.addPage(); y=M;
    } else { y += narBoxH2+8; }

    ensureSpace(10); doc.setFont("helvetica","italic"); doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text("C.  SUSPECT MEDICAL DEVICE — Not applicable (drug / biologic case)",M+2,y+5); doc.setTextColor(0,0,0); y += 8;

    ensureSpace(30); hdrBlue("D.  SUSPECT PRODUCT(S)",M,y,CW); y += 7;
    const colW=[42,22,22,24,42,38];
    const colHd=["Name (Brand / Generic)","Dose","Frequency","Route","Therapy Dates (from / to)","Indication"];
    let xc=M; doc.setFillColor(230,240,255);
    colW.forEach((w,i) => { doc.rect(xc,y,w,7,"F"); box(xc,y,w,7); doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(30,60,120); doc.text(colHd[i],xc+1,y+5); doc.setTextColor(0,0,0); xc+=w; });
    y += 8;
    ((form.products||[]).length>0?form.products:[d||{}]).forEach(drug => {
      ensureSpace(12);
      const rd=[(drug.name||"—")+(drug.genericName?"\n("+drug.genericName+")":""), (drug.dose||"—")+(drug.doseUnit?" "+drug.doseUnit:""), drug.frequency||"—", drug.route||"—", (drug.startDate||"—")+"\nto "+(drug.stopDate||"ongoing"), drug.indication||drug.indicationPt||"—"];
      let rowH=10; colW.forEach((w,i) => { const cl=doc.splitTextToSize(rd[i],w-2); rowH=Math.max(rowH,cl.length*4+4); }); rowH=Math.min(rowH,22);
      xc=M; rd.forEach((cell,i) => { box(xc,y,colW[i],rowH); doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.text(doc.splitTextToSize(cell,colW[i]-2).slice(0,4),xc+1,y+4); xc+=colW[i]; });
      if (drug.dechallenge||drug.rechallenge) {
        y+=rowH; ensureSpace(8); doc.setFont("helvetica","italic"); doc.setFontSize(6.5); doc.setTextColor(80,80,80);
        doc.text(((drug.dechallenge?"Dechallenge: "+drug.dechallenge+"  ":"")+( drug.rechallenge?"Rechallenge: "+drug.rechallenge:"")).trim(),M+2,y+4); doc.setTextColor(0,0,0); y+=6;
      } else { y+=rowH+1; }
    }); y+=3;

    ensureSpace(22); hdrBlue("E.  CONCOMITANT MEDICAL PRODUCTS AND THERAPY DATES",M,y,CW); y+=7;
    box(M,y,CW,18); doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(doc.splitTextToSize(val(p.concomitant)||"None reported",CW-4).slice(0,3),M+1,y+5); y+=20;

    ensureSpace(30); hdrBlue("F.  RELEVANT TESTS / LAB DATA / MEDICAL HISTORY",M,y,CW); y+=7;
    const histFull = buildMedHistoryText(p);
    const labSummary=(p.labData||[]).filter(l=>l.testName&&l.result).map(l=>`${l.testName} ${l.result}${l.units?" "+l.units:""}${l.assessment&&l.assessment!=="Normal"?" ("+l.assessment+")":""}`).join("; ");
    const fText="Medical History: "+histFull+(labSummary?"\n\nLab Data: "+labSummary:"");
    const fLn=doc.splitTextToSize(fText,CW-4), fBoxH=Math.min(55,Math.max(20,fLn.length*4.5+6));
    box(M,y,CW,fBoxH); doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(fLn.slice(0,Math.floor(fBoxH/4.5)),M+1,y+5); y+=fBoxH+4;

    ensureSpace(45); hdrBlue("G.  REPORTER",M,y,CW); y+=7;
    const repName=([val(t.reporterFirst||g.reporter?.firstName),val(t.reporterLast||g.reporter?.lastName)].filter(Boolean).join(" "))||"—";
    const repInst=val(t.institution||g.reporter?.institution)||"—";
    const repQual=val(t.qualification||g.reporter?.qualification);
    box(M,y,95,12); lbl("1. Name",M+1,y+3.5); fld(repName,M+1,y+10,93);
    box(M+95,y,95,12); lbl("2. Institution",M+96,y+3.5); fld(repInst,M+96,y+10,93); y+=13;
    box(M,y,62,10); lbl("3. Phone",M+1,y+3.5); fld(val(g.reporter?.phone)||"—",M+1,y+8,60);
    box(M+62,y,78,10); lbl("4. Email",M+63,y+3.5); fld(val(g.reporter?.email)||"—",M+63,y+8,76);
    box(M+140,y,50,10); lbl("5. Occupation",M+141,y+3.5); fld(repQual||"—",M+141,y+8,48); y+=11;
    box(M,y,CW,10); lbl("6. Health Professional?",M+1,y+3.5);
    const isHP=["Physician","Pharmacist","Nurse","Other HCP","Other health professional"].includes(repQual);
    chkBox(isHP,M+70,y+8); doc.setFontSize(7); doc.text("Yes",M+74,y+8);
    chkBox(!isHP,M+90,y+8); doc.text("No",M+94,y+8); y+=12;
    box(M,y,CW,10); lbl("Also Submitted to:",M+1,y+3.5);
    fld("SkyVigilance SafetyDB Training Platform",M+1,y+8,CW-4); y+=12;

    if (ev.pt||m.causality||m.listedness) {
      ensureSpace(28);
      doc.setFillColor(240,240,255); doc.rect(M,y,CW,5,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(40,40,120);
      doc.text("MEDICAL ASSESSMENT — SkyVigilance supplementary (not part of standard FDA 3500)",M+2,y+3.5);
      doc.setTextColor(0,0,0); y+=6;
      box(M,y,65,10); lbl("MedDRA PT",M+1,y+3.5); fld(ev.pt||"Not coded",M+1,y+8,63);
      box(M+65,y,35,10); lbl("PT Code",M+66,y+3.5); fld(ev.pt_code||"—",M+66,y+8,33);
      box(M+100,y,50,10); lbl("SOC",M+101,y+3.5); fld(ev.soc||"—",M+101,y+8,48);
      box(M+150,y,40,10); lbl("MedDRA Version",M+151,y+3.5); fld("28.1",M+151,y+8,38); y+=11;
      box(M,y,65,10); lbl("WHO-UMC Causality",M+1,y+3.5); fld(m.causality||"Not assessed",M+1,y+8,63);
      box(M+65,y,65,10); lbl("Listedness",M+66,y+3.5); fld(m.listedness||"Not assessed",M+66,y+8,63);
      box(M+130,y,60,10); lbl("Seriousness",M+131,y+3.5); fld(autoSerious()?"SERIOUS":"Non-serious",M+131,y+8,58); y+=12;
    }

    const pc=doc.internal.getNumberOfPages();
    for (let pg=1;pg<=pc;pg++) {
      doc.setPage(pg); doc.setFont("helvetica","italic"); doc.setFontSize(6.5); doc.setTextColor(150,150,150);
      doc.text(`Form FDA 3500 MedWatch (09/2025) — SkyVigilance Training Platform — For training purposes only [Page ${pg}/${pc}]`,M,PH-5);
      doc.setTextColor(0,0,0);
    }
    doc.save("MedWatch_3500_"+(selected?.caseNumber||"case")+".pdf");
  };

  const chartData = STAGES.map(s => ({ name:s.name, value:cases.filter(c=>c.currentStep===s.step).length }));

  const ACTION_META = {
    CASE_CREATED:        { color:"bg-blue-100 text-blue-800",    icon:"📥", label:"Case Created" },
    CASE_UPDATED:        { color:"bg-indigo-100 text-indigo-800",icon:"✏️", label:"Case Updated" },
    CASE_SUBMITTED:      { color:"bg-green-100 text-green-800",  icon:"✅", label:"Case Submitted" },
    SUBMITTED:           { color:"bg-green-100 text-green-800",  icon:"✅", label:"Submitted" },
    CASE_RETURNED:       { color:"bg-amber-100 text-amber-800",  icon:"↩️", label:"Returned for Query" },
    ROUTE_BACK_TO_DE:    { color:"bg-amber-100 text-amber-800",  icon:"↩️", label:"Returned to Data Entry" },
    RETURNED_TO_MEDICAL: { color:"bg-amber-100 text-amber-800",  icon:"↩️", label:"Returned to Medical" },
    APPROVED:            { color:"bg-green-100 text-green-800",  icon:"✅", label:"Approved" },
    E2B_EXPORTED:        { color:"bg-violet-100 text-violet-800",icon:"📨", label:"E2B XML Exported" },
    TAB_SAVED:           { color:"bg-teal-100 text-teal-800",    icon:"💾", label:"Tab Saved" },
    DUPLICATE_CHECK:     { color:"bg-yellow-100 text-yellow-800",icon:"🔍", label:"Duplicate Check" },
  };

  const renderAuditTrail = () => {
    const fmtDate = (raw) => {
      if (!raw) return "—";
      const s = String(raw).trim();
      if (!s || s === "null" || s === "undefined") return "—";
      if (/^\d{1,2} \w{3} \d{4}/.test(s)) return s;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (m) {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${m[3]} ${months[parseInt(m[2],10)-1]} ${m[1]}, ${m[4]}:${m[5]}`;
      }
      return s.slice(0, 16) || "—";
    };
    return (
    <div>
      <div className="text-xs font-extrabold text-amber-700 uppercase tracking-widest mb-4 border-b border-amber-100 pb-2">📋 Audit Trail — {selected?.caseNumber}</div>
      {auditLog.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6 font-medium">No audit entries found.</div>
      ) : auditLog.map((entry, i) => {
        const meta = ACTION_META[entry.actionType] || { color:"bg-slate-100 text-slate-700", icon:"•", label:entry.actionType || entry.action || "Event" };
        return (
          <div key={i} className="flex gap-4 mb-4 pb-4 border-b border-slate-100 last:border-0">
            <div className="text-2xl leading-none drop-shadow-sm">{meta.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${meta.color}`}>{meta.label}</span>
                <span className="text-xs font-medium text-slate-400">{fmtDate(entry.timestamp || entry.performedAt)}</span>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-700">{entry.performedBy}</span>
                {entry.role && <span className="ml-1">({entry.role})</span>}
                {(entry.stepFrom || entry.stepTo) && (
                  <span className="ml-1 text-slate-400">
                    · Step {entry.stepFrom}{entry.stepTo && entry.stepTo !== entry.stepFrom ? ` → ${entry.stepTo}` : ""}
                  </span>
                )}
              </div>
              {entry.details && (
                <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed shadow-inner">
                  {entry.details}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    );
  };

  const TriageForm = () => (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
      <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-widest mb-5">📥 New Case — Triage / Initial Book-in</h3>

      {dupResults !== null && (
        <div className={`rounded-xl border px-4 py-3 mb-4 text-xs shadow-sm ${dupResults.length>0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          {dupResults.length > 0 ? (
            <>
              <div className="font-extrabold text-amber-800 mb-2">⚠️ {dupResults.length} potential duplicate{dupResults.length>1?"s":""} found</div>
              {dupResults.slice(0,3).map((d,i) => (
                <div key={i} className={`flex items-center gap-2 mb-1 px-3 py-1.5 rounded-lg shadow-sm ${d.band==="HIGH"?"bg-red-100 text-red-800":d.band==="MEDIUM"?"bg-orange-100 text-orange-800":"bg-yellow-100 text-yellow-800"}`}>
                  <span className="font-bold">{d.band}</span>
                  <span className="font-mono font-semibold">{d.caseNumber}</span>
                  <span className="font-medium">{d.score}% match</span>
                  <span className="text-slate-600">· {d.drug} · {d.event||d.eventPt}</span>
                  <span className="ml-auto text-slate-500 font-medium">{d.country} · {d.status}</span>
                </div>
              ))}
              <button onClick={() => setDupResults(null)} className="mt-2 text-amber-600 font-bold hover:underline transition-all">Dismiss</button>
            </>
          ) : (
            <span className="text-green-700 font-bold">✅ No duplicates found — safe to create.</span>
          )}
        </div>
      )}

      <SectionHead>Report Details</SectionHead>
      <div className="grid grid-cols-3 gap-4">
        {F("Initial Receipt Date *", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            value={form.triage?.receiptDate||""} onChange={e => setNested("triage","receiptDate",e.target.value)} />, true)}
        {F("Country of Incidence *", S(COUNTRIES, 
            { value:form.triage?.country||"", onChange:e => setNested("triage","country",e.target.value) }), true)}
        {F("Report Type", S(["Spontaneous","Literature","Regulatory","Clinical Trial","Other"],
            { value:form.general?.reportType||"", onChange:e => setNested("general","reportType",e.target.value) }))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {F("Patient Initials", I({ placeholder:"e.g. J.D.", value:form.triage?.patientInitials||"", onChange:e => setNested("triage","patientInitials",e.target.value) }))}
        {F("Age at Onset", <input type="number" min="0" max="120" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            placeholder="Years" value={form.triage?.age||""} onChange={e => setNested("triage","age",e.target.value)} />)}
        {F("Sex", S(["Male","Female","Unknown"],
            { value:form.triage?.sex||"", onChange:e => setNested("triage","sex",e.target.value) }))}
      </div>

      <SectionHead>Suspect Drug</SectionHead>
      <div className="grid grid-cols-3 gap-4">
        {F("Drug Name *", I({ placeholder:"Brand or generic name",
            value:(form.products||[])[0]?.name||"", onChange:e => {
              const p=[...((form.products?.length)?form.products:[{}])]; p[0]={...p[0],name:e.target.value};
              setForm(f=>({...f,products:p}));
            } }), true)}
        {F("Dose",       I({ placeholder:"e.g. 10 mg", value:(form.products||[])[0]?.dose||"", onChange:e => {
            const p=[...((form.products?.length)?form.products:[{}])]; p[0]={...p[0],dose:e.target.value}; setForm(f=>({...f,products:p}));
          } }))}
        {F("Route",     S(["Oral","Intravenous","Intramuscular","Subcutaneous","Topical","Inhalation","Other"],
            { value:(form.products||[])[0]?.route||"", onChange:e => {
              const p=[...((form.products?.length)?form.products:[{}])]; p[0]={...p[0],route:e.target.value}; setForm(f=>({...f,products:p}));
            } }))}
      </div>

      <SectionHead>Adverse Event</SectionHead>
      <div className="grid grid-cols-2 gap-4">
        {F("Event as Reported *", I({ placeholder:"Exact words used by reporter",
            value:(form.events||[])[0]?.term||"", onChange:e => {
              const ev=[...((form.events?.length)?form.events:[{}])]; ev[0]={...ev[0],term:e.target.value}; setForm(f=>({...f,events:ev}));
            } }), true)}
        {F("Onset Date", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            value={(form.events||[])[0]?.onsetDate||""} onChange={e => {
              const ev=[...((form.events?.length)?form.events:[{}])]; ev[0]={...ev[0],onsetDate:e.target.value}; setForm(f=>({...f,events:ev}));
            }} />)}
      </div>

      <SectionHead>Reporter</SectionHead>
      <div className="grid grid-cols-3 gap-4">
        {F("Reporter Qualification", S(["Physician","Pharmacist","Nurse","Patient","Lawyer","Other health professional","Consumer"],
            { value:form.triage?.qualification||"", onChange:e => setNested("triage","qualification",e.target.value) }))}
        {F("Reporter's Country", I({ placeholder:"Country", value:form.triage?.reporterCountry||"",
            onChange:e => setNested("triage","reporterCountry",e.target.value) }))}
        {F("FAERS Report ID (if applicable)", I({ placeholder:"Optional",
            value:form.triage?.faersId||"", onChange:e => setNested("triage","faersId",e.target.value) }))}
      </div>

      <div className="mt-6 flex gap-4 flex-wrap">
        <button onClick={() => detectDuplicate(true)}
          disabled={dupLoading}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
          {dupLoading ? "⏳ Checking…" : "🔍 Check Duplicates"}
        </button>
        <button onClick={createCase}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
          📥 Book-in Case
        </button>
      </div>
    </div>
  );

  const DATA_TABS = [
    { id:"general",  label:"General" },
    { id:"patient",  label:"Patient" },
    { id:"products", label:"Products" },
    { id:"events",   label:"Events + Narrative" },
  ];

  const DataEntryForm = () => {
    const setP = (idx, key, val2) => {
      const arr = [...((form.products?.length)?form.products:[{}])];
      arr[idx] = { ...arr[idx], [key]:val2 }; setForm(f=>({...f,products:arr}));
    };

    return (
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-0">
          {DATA_TABS.map(t2 => (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`text-sm px-5 py-2.5 rounded-t-xl font-bold transition-all
                ${tab===t2.id ? "bg-white border-x border-t border-slate-200 text-indigo-700 -mb-px shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]" : "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
              {t2.label}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="animate-in fade-in duration-300">
            <SectionHead>Report Identifiers</SectionHead>
            <div className="grid grid-cols-3 gap-4">
              {F("Report Type",          S(["Spontaneous","Literature","Regulatory","Clinical Trial","Other"],
                  { value:form.general?.reportType||"",  onChange:e => setNested("general","reportType",e.target.value) }))}
              {F("Worldwide Case Number",I({ placeholder:"HQ-2024-0001", value:form.general?.wwCaseNum||"",
                  onChange:e => setNested("general","wwCaseNum",e.target.value) }))}
              {F("Local Case Number",    I({ placeholder:"Local ID", value:form.general?.localCaseNum||"",
                  onChange:e => setNested("general","localCaseNum",e.target.value) }))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {F("Source of Information", S(["Healthcare professional","Patient/Consumer","Regulatory authority","Literature","Other"],
                  { value:form.general?.source||"",    onChange:e => setNested("general","source",e.target.value) }))}
              {F("Literature Reference",  I({ placeholder:"Author, journal, year…", value:form.general?.literature||"",
                  onChange:e => setNested("general","literature",e.target.value) }))}
              {F("Date Received by MAH", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  value={form.general?.dateReceivedMAH||""} onChange={e => setNested("general","dateReceivedMAH",e.target.value)} />)}
            </div>

            <SectionHead>Reporter Information</SectionHead>
            <div className="grid grid-cols-2 gap-4">
              {F("First Name", I({ value:form.general?.reporter?.firstName||"", onChange:e => setDeep("general","reporter","firstName",e.target.value) }))}
              {F("Last Name",  I({ value:form.general?.reporter?.lastName||"",  onChange:e => setDeep("general","reporter","lastName",e.target.value)  }))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {F("Institution",    I({ value:form.general?.reporter?.institution||"", onChange:e => setDeep("general","reporter","institution",e.target.value) }))}
              {F("Phone",          I({ placeholder:"+1-555-000-0000",  value:form.general?.reporter?.phone||"",    onChange:e => setDeep("general","reporter","phone",e.target.value) }))}
              {F("Email",          I({ placeholder:"reporter@example.com", value:form.general?.reporter?.email||"", onChange:e => setDeep("general","reporter","email",e.target.value) }))}
            </div>
            {F("Qualification",  S(["Physician","Pharmacist","Nurse","Patient","Lawyer","Other health professional","Consumer"],
                { value:form.general?.reporter?.qualification||"", onChange:e => setDeep("general","reporter","qualification",e.target.value) }))}
            {C("Reporter also patient?", form.general?.reporterIsPatient, e => setNested("general","reporterIsPatient",e.target.checked))}
            {C("Reporter requests anonymity?", form.general?.reporterAnonymous, e => setNested("general","reporterAnonymous",e.target.checked))}

            <SectionHead>Seriousness Classification</SectionHead>
            <div className="bg-gradient-to-r from-red-50 to-white border border-red-100 rounded-2xl p-5 mb-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                {[["Death","death"],["Life-threatening","lifeThreatening"],["Hospitalisation","hospitalisation"],
                  ["Disability/Incapacity","disability"],["Congenital anomaly","congenital"],["Medically significant","medSignificant"]
                ].map(([l2,k]) => (
                  <React.Fragment key={k}>
                    {C(l2, (form.general?.seriousness||{})[k], e => setForm(f=>({...f,general:{...f.general,seriousness:{...(f.general?.seriousness||{}),[k]:e.target.checked}}})), "red")}
                  </React.Fragment>
                ))}
              </div>
              {autoSerious() && (
                <div className="mt-4 bg-red-100 border border-red-300 text-red-800 text-sm px-4 py-3 rounded-xl font-bold shadow-sm">
                  ⚠️ Case classified as SERIOUS based on criteria selected or IME term detected.
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => saveTab({ general: form.general }, "General")}
                className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
                💾 Save General
              </button>
            </div>
          </div>
        )}

        {tab === "patient" && (
          <div className="animate-in fade-in duration-300">
            <SectionHead>Demographics</SectionHead>
            <div className="grid grid-cols-3 gap-4">
              {F("Date of Birth",  <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  value={form.patient?.dob||""} onChange={e => setNested("patient","dob",e.target.value)} />)}
              {F("Age at Onset",   <input type="number" min="0" max="120" placeholder="Years" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  value={form.patient?.age||""} onChange={e => setNested("patient","age",e.target.value)} />)}
              {F("Age Unit",       S(["Years","Months","Weeks","Days","Hours"],
                  { value:form.patient?.ageUnit||"Years", onChange:e => setNested("patient","ageUnit",e.target.value) }))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {F("Sex",            S(["Male","Female","Unknown"],
                  { value:form.patient?.sex||"", onChange:e => setNested("patient","sex",e.target.value) }))}
              {F("Weight (kg)",    <input type="number" min="0" step="0.1" placeholder="kg" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  value={form.patient?.weight||""} onChange={e => setNested("patient","weight",e.target.value)} />)}
              {F("Height (cm)",    <input type="number" min="0" placeholder="cm" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  value={form.patient?.height||""} onChange={e => setNested("patient","height",e.target.value)} />)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {F("Ethnicity / Race", I({ value:form.patient?.ethnicity||"", onChange:e => setNested("patient","ethnicity",e.target.value) }))}
              {form.patient?.sex !== "Male" && F("Pregnancy Status", S(["Not pregnant","Pregnant","Postpartum","Unknown","N/A"],
                  { value:form.patient?.pregnancy||"", onChange:e => setNested("patient","pregnancy",e.target.value) }))}
            </div>

            <SectionHead>Medical History &amp; Conditions</SectionHead>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Enter free-text history below, then add structured entries with MedDRA coding using the table. All entries will be included in auto-generated narratives and CIOMS/MedWatch exports.
            </p>
            {F("Medical History (free text)", TA({ placeholder:"Relevant past medical history…", rows:3,
                value:form.patient?.medHistory||"", onChange:e => setNested("patient","medHistory",e.target.value) }))}
            <MedDRAWidget
              targetSection="medHistory" targetIdx={0}
              currentPt={form.patient?.medHistoryPt} currentPtCode={form.patient?.medHistoryPtCode}
              currentLlt={form.patient?.medHistoryLlt} currentSoc={form.patient?.medHistorySoc}
              meddraQuery={meddraQuery} meddraResults={meddraResults}
              meddraLoading={meddraLoading} meddraTarget={meddraTarget}
              setMeddraTarget={setMeddraTarget}
              searchMeddra={searchMeddra} pickMeddra={pickMeddra}
              onClear={() => setForm(f => ({ ...f, patient:{ ...f.patient, medHistoryPt:"", medHistoryPtCode:"" } }))}
            />

            <div className="mt-5">
              <div className="text-xs font-extrabold text-teal-700 uppercase tracking-widest mb-3">Structured History Entries</div>
              {(form.patient?.otherHistory||[{}]).map((h,idx) => (
                <div key={idx} className="border border-slate-200 rounded-2xl p-4 mb-4 bg-slate-50 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {F("Description / Condition", I({ placeholder:"Condition or diagnosis", value:h.description||"",
                        onChange:e => { const arr=[...(form.patient?.otherHistory||[{}])]; arr[idx]={...arr[idx],description:e.target.value}; setForm(f=>({...f,patient:{...f.patient,otherHistory:arr}})); } }))}
                    {F("Substance / Drug", I({ placeholder:"If drug-related", value:h.substance||"",
                        onChange:e => { const arr=[...(form.patient?.otherHistory||[{}])]; arr[idx]={...arr[idx],substance:e.target.value}; setForm(f=>({...f,patient:{...f.patient,otherHistory:arr}})); } }))}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    {F("Start Date", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={h.startDate||""} onChange={e => { const arr=[...(form.patient?.otherHistory||[{}])]; arr[idx]={...arr[idx],startDate:e.target.value}; setForm(f=>({...f,patient:{...f.patient,otherHistory:arr}})); }} />)}
                    {F("Stop Date",  <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={h.stopDate||""}  onChange={e => { const arr=[...(form.patient?.otherHistory||[{}])]; arr[idx]={...arr[idx],stopDate:e.target.value};  setForm(f=>({...f,patient:{...f.patient,otherHistory:arr}})); }} />)}
                    {F("Ongoing", <div className="flex items-center h-9">{C("Still active",h.ongoing,e=>{const arr=[...(form.patient?.otherHistory||[{}])];arr[idx]={...arr[idx],ongoing:e.target.checked};setForm(f=>({...f,patient:{...f.patient,otherHistory:arr}}));})}</div>)}
                  </div>
                  <MedDRAWidget
                    targetSection="history" targetIdx={idx}
                    currentPt={h.meddraPt} currentPtCode={h.meddraPtCode}
                    currentLlt={h.meddraLlt} currentSoc={h.meddraSoc}
                    meddraQuery={meddraQuery} meddraResults={meddraResults}
                    meddraLoading={meddraLoading} meddraTarget={meddraTarget}
                    setMeddraTarget={setMeddraTarget}
                    searchMeddra={searchMeddra} pickMeddra={pickMeddra}
                    onClear={() => { const arr=[...(form.patient?.otherHistory||[{}])]; arr[idx]={...arr[idx],meddraPt:"",meddraPtCode:""}; setForm(f=>({...f,patient:{...f.patient,otherHistory:arr}})); }}
                  />
                </div>
              ))}
              <button onClick={() => setForm(f=>({...f,patient:{...f.patient,otherHistory:[...(f.patient?.otherHistory||[{}]),{}]}}))}
                className="text-indigo-600 text-sm font-bold hover:text-indigo-800 transition-colors">+ Add History Entry</button>
            </div>

            <SectionHead>Other Patient Data</SectionHead>
            {F("Concomitant Medications", TA({ placeholder:"List concomitant drugs with dose and indication…", rows:3,
                value:form.patient?.concomitant||"", onChange:e => setNested("patient","concomitant",e.target.value) }))}

            <div className="mt-5">
              <div className="text-xs font-extrabold text-teal-700 uppercase tracking-widest mb-3">Lab / Test Results</div>
              {(form.patient?.labData||[{}]).map((lab,idx) => (
                <div key={idx} className="border border-slate-200 rounded-2xl p-4 mb-4 bg-slate-50 shadow-sm">
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    {F("Test Name",   I({ placeholder:"e.g. ALT, Creatinine", value:lab.testName||"",
                        onChange:e=>{const a=[...(form.patient?.labData||[{}])];a[idx]={...a[idx],testName:e.target.value};setForm(f=>({...f,patient:{...f.patient,labData:a}}));} }))}
                    {F("Result",      I({ placeholder:"Value", value:lab.result||"",
                        onChange:e=>{const a=[...(form.patient?.labData||[{}])];a[idx]={...a[idx],result:e.target.value};setForm(f=>({...f,patient:{...f.patient,labData:a}}));} }))}
                    {F("Units",       I({ placeholder:"e.g. mg/dL", value:lab.units||"",
                        onChange:e=>{const a=[...(form.patient?.labData||[{}])];a[idx]={...a[idx],units:e.target.value};setForm(f=>({...f,patient:{...f.patient,labData:a}}));} }))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {F("Test Date", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={lab.testDate||""} onChange={e=>{const a=[...(form.patient?.labData||[{}])];a[idx]={...a[idx],testDate:e.target.value};setForm(f=>({...f,patient:{...f.patient,labData:a}}));}} />)}
                    {F("Assessment", S(["Normal","Abnormal – not clinically significant","Abnormal – clinically significant","Not done"],
                        { value:lab.assessment||"", onChange:e=>{const a=[...(form.patient?.labData||[{}])];a[idx]={...a[idx],assessment:e.target.value};setForm(f=>({...f,patient:{...f.patient,labData:a}}));} }))}
                  </div>
                  <MedDRAWidget
                    targetSection="lab" targetIdx={idx}
                    currentPt={lab.meddraPt} currentPtCode={lab.meddraPtCode}
                    currentLlt={lab.meddraLlt} currentSoc={lab.meddraSoc}
                    meddraQuery={meddraQuery} meddraResults={meddraResults}
                    meddraLoading={meddraLoading} meddraTarget={meddraTarget}
                    setMeddraTarget={setMeddraTarget}
                    searchMeddra={searchMeddra} pickMeddra={pickMeddra}
                    onClear={() => {const a=[...(form.patient?.labData||[{}])];a[idx]={...a[idx],meddraPt:"",meddraPtCode:""};setForm(f=>({...f,patient:{...f.patient,labData:a}}));}}
                  />
                </div>
              ))}
              <button onClick={() => setForm(f=>({...f,patient:{...f.patient,labData:[...(f.patient?.labData||[{}]),{}]}}))}
                className="text-indigo-600 text-sm font-bold hover:text-indigo-800 transition-colors">+ Add Lab Result</button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
              <button onClick={() => saveTab({ patient: form.patient }, "Patient")}
                className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
                💾 Save Patient
              </button>
            </div>
          </div>
        )}

        {tab === "products" && (<div className="animate-in fade-in duration-300">
          {(() => {
          const products = (form.products?.length) ? form.products : [{}];
          return (
            <div>
              {products.map((p2,i) => {
                const hideChallenge = ["Concomitant", "Past therapy"].includes(p2.role);
                return (
                <div key={i} className="border border-slate-200 rounded-2xl p-5 mb-5 bg-slate-50 shadow-sm">
                  <div className="text-xs font-extrabold text-slate-400 uppercase mb-3 tracking-widest">Product {i+1}</div>

                  <SectionHead>Identification</SectionHead>
                  <div className="grid grid-cols-3 gap-4">
                    {F("Product Role *", S(["Suspect", "Co-suspect", "Interacting", "Concomitant", "Past therapy"],
                        { value:p2.role||"Suspect", onChange:e => setP(i,"role",e.target.value) }), true)}
                    {F("Brand Name",     I({ placeholder:"Brand / trade name", value:p2.name||"",        onChange:e => setP(i,"name",e.target.value)        }), true)}
                    {F("Generic Name",   I({ placeholder:"INN / generic",      value:p2.genericName||"", onChange:e => setP(i,"genericName",e.target.value)  }))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {F("MAH / Manufacturer",  I({ value:p2.mah||"",          onChange:e => setP(i,"mah",e.target.value)          }))}
                    {F("Batch / Lot Number",  I({ value:p2.batch||"",        onChange:e => setP(i,"batch",e.target.value)        }))}
                    {F("Expiry Date", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={p2.expiry||""} onChange={e => setP(i,"expiry",e.target.value)} />)}
                  </div>
                  {F("Indication", I({ placeholder:"Reason for use", value:p2.indication||"", onChange:e => setP(i,"indication",e.target.value) }))}
                  <MedDRAWidget
                    targetSection="indication" targetIdx={i}
                    currentPt={p2.indicationPt} currentPtCode={p2.indicationPtCode}
                    currentLlt={p2.indicationLlt} currentSoc={p2.indicationSoc}
                    meddraQuery={meddraQuery} meddraResults={meddraResults}
                    meddraLoading={meddraLoading} meddraTarget={meddraTarget}
                    setMeddraTarget={setMeddraTarget}
                    searchMeddra={searchMeddra} pickMeddra={pickMeddra}
                    onClear={() => setP(i,"indicationPt","")}
                  />

                  <SectionHead>Dosing</SectionHead>
                  <div className="grid grid-cols-3 gap-4">
                    {F("Dose",           I({ placeholder:"Amount", value:p2.dose||"",      onChange:e => setP(i,"dose",e.target.value)      }))}
                    {F("Dose Unit",      S(["mg","mcg","g","IU","mL","mg/kg","mg/m²","Other"],
                        { value:p2.doseUnit||"", onChange:e => setP(i,"doseUnit",e.target.value) }))}
                    {F("Frequency",      S(["Once daily","Twice daily","Three times daily","Four times daily","Weekly","Biweekly","Monthly","As needed","Other"],
                        { value:p2.frequency||"", onChange:e => setP(i,"frequency",e.target.value) }))}
                    {F("Route",          S(["Oral","Intravenous","Intramuscular","Subcutaneous","Topical","Inhalation","Transdermal","Rectal","Ophthalmic","Other"],
                        { value:p2.route||"", onChange:e => setP(i,"route",e.target.value) }))}
                    {F("Formulation",    S(["Tablet","Capsule","Solution","Suspension","Injection","Patch","Cream/Ointment","Inhaler","Other"],
                        { value:p2.formulation||"", onChange:e => setP(i,"formulation",e.target.value) }))}
                    {F("Cumulative Dose",I({ placeholder:"Total dose if known", value:p2.cumulativeDose||"",
                        onChange:e => setP(i,"cumulativeDose",e.target.value) }))}
                  </div>

                  <SectionHead>Therapy Dates &amp; Causality</SectionHead>
                  <div className="grid grid-cols-3 gap-4">
                    {F("Start Date", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={p2.startDate||""} onChange={e => setP(i,"startDate",e.target.value)} />)}
                    {F("Stop Date",  <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={p2.stopDate||""}  onChange={e => setP(i,"stopDate",e.target.value)}  />)}
                    {F("Duration",   I({ placeholder:"e.g. 3 months", value:p2.duration||"",
                        onChange:e => setP(i,"duration",e.target.value) }))}
                  </div>
                  {!hideChallenge && F("Dechallenge Result", S(["Positive – Event abated on withdrawal","Negative – Event did not abate","Not done","Unknown","N/A"],
                      { value:p2.dechallenge||"", onChange:e => setP(i,"dechallenge",e.target.value) }))}
                  {!hideChallenge && F("Rechallenge Result", S(["Positive – Event recurred","Negative – Event did not recur","Not done","Unknown","N/A"],
                      { value:p2.rechallenge||"", onChange:e => setP(i,"rechallenge",e.target.value) }))}
                  <div className="flex gap-6 mt-3 flex-wrap">
                    {C("Ongoing",           p2.ongoing,       e => setP(i,"ongoing",e.target.checked))}
                    {C("Drug Interaction?", p2.interaction,   e => setP(i,"interaction",e.target.checked))}
                    {C("Contraindicated?",  p2.contraindicated,e => setP(i,"contraindicated",e.target.checked))}
                    {C("OTC Product",       p2.otc,           e => setP(i,"otc",e.target.checked))}
                  </div>

                  <SectionHead>Quality Control</SectionHead>
                  <div className="grid grid-cols-3 gap-4">
                    {F("QC Safety Date",   <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={p2.qcDate||""} onChange={e => setP(i,"qcDate",e.target.value)} />)}
                    {F("QC Cross Reference", I({ placeholder:"QC Ref #", value:p2.qcRef||"",
                        onChange:e => setP(i,"qcRef",e.target.value) }))}
                    {F("QC Result Date",   <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={p2.qcResultDate||""} onChange={e => setP(i,"qcResultDate",e.target.value)} />)}
                  </div>
                  {F("QC Result Notes", TA({ placeholder:"Enter QC analysis result notes…", rows:2,
                      value:p2.qcNotes||"", onChange:e => setP(i,"qcNotes",e.target.value) }))}
                </div>
                );
              })}
              <button onClick={() => setForm(f=>({...f,products:[...(f.products||[{}]),{}]}))}
                className="text-indigo-600 text-sm font-bold hover:text-indigo-800 transition-colors">+ Add Product</button>
              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                <button onClick={() => saveTab({ products: form.products }, "Products")}
                  className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
                  💾 Save Products
                </button>
              </div>
            </div>
          );
          })()}
        </div>)}

        {tab === "events" && (<div className="animate-in fade-in duration-300">
          {(() => {
          const events = (form.events?.length) ? form.events : [{}];
          const setEv = (idx, key, val2) => {
            const arr = [...events]; arr[idx] = { ...arr[idx], [key]:val2 }; setForm(f=>({...f,events:arr}));
          };
          return (
            <div>
              {events.map((e,i) => (
                <div key={i} className="border border-slate-200 rounded-2xl p-5 mb-5 bg-slate-50 shadow-sm">
                  <div className="text-xs font-extrabold text-slate-400 uppercase mb-3 tracking-widest">Event {i+1}</div>

                  <SectionHead>Event Description &amp; MedDRA Coding</SectionHead>
                  <div className="grid grid-cols-2 gap-4">
                    {F("Description as Reported (Verbatim)", I({ placeholder:"Exact words used by reporter",
                        value:e.term||"", onChange:ev=>setEv(i,"term",ev.target.value) }), true)}
                    {F("Description to be Coded", I({ placeholder:"Modified/translated for coding",
                        value:e.descToCoded||e.term||"", onChange:ev=>setEv(i,"descToCoded",ev.target.value) }))}
                  </div>
                  {F("Term Highlighted by Reporter", S(["Yes","No","Unknown"],
                      { value:e.highlighted||"", onChange:ev=>setEv(i,"highlighted",ev.target.value) }),
                    false, "Was this event specifically emphasized by the reporter?")}
                  <MedDRAWidget
                    targetSection="event" targetIdx={i}
                    currentPt={e.pt} currentPtCode={e.pt_code}
                    currentLlt={e.llt} currentSoc={e.soc}
                    meddraQuery={meddraQuery} meddraResults={meddraResults}
                    meddraLoading={meddraLoading} meddraTarget={meddraTarget}
                    setMeddraTarget={setMeddraTarget}
                    searchMeddra={searchMeddra} pickMeddra={pickMeddra}
                    onClear={() => setEv(i,"pt","")}
                  />
                  {e.pt && IME_TERMS.includes(e.pt) && (
                    <div className="bg-red-100 border border-red-300 text-red-800 text-sm px-4 py-3 rounded-xl font-bold mb-2 shadow-sm">
                      ⚠️ IME term detected — this case MUST be classified as SERIOUS
                    </div>
                  )}

                  <SectionHead>Timing</SectionHead>
                  <div className="grid grid-cols-3 gap-4">
                    {F("Onset Date", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={e.onsetDate||""} onChange={ev=>setEv(i,"onsetDate",ev.target.value)} />)}
                    {F("Stop Date",  <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                        value={e.stopDate||""}  onChange={ev=>setEv(i,"stopDate",ev.target.value)} />)}
                    {F("Onset from Last Dose", I({ placeholder:"e.g. 2 days", value:e.onsetFromLastDose||"",
                        onChange:ev=>setEv(i,"onsetFromLastDose",ev.target.value) }))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {F("Outcome", S(["Recovered / Resolved","Recovering / Resolving","Not recovered / Not resolved","Recovered with sequelae","Fatal","Unknown"],
                        { value:e.outcome||"", onChange:ev=>setEv(i,"outcome",ev.target.value) }))}
                    {F("Nature of Event", S(["Congenital anomaly","Abuse","Accidental exposure","Overdose","Medication error","Off-label use","Misuse","Drug interaction","Unknown"],
                        { value:e.natureOfEvent||"", onChange:ev=>setEv(i,"natureOfEvent",ev.target.value) }))}
                  </div>

                  <SectionHead>Seriousness at Event Level</SectionHead>
                  <div className="grid grid-cols-2 gap-3 bg-gradient-to-r from-red-50 to-white p-5 rounded-2xl border border-red-100 mb-4 shadow-sm">
                    {[["Death","death"],["Life-threatening","lifeThreatening"],["Hospitalised","hospitalised"],
                      ["Disability/Incapacity","disability"],["Congenital anomaly","congenital"],["Medically significant","medSignificant"]
                    ].map(([lbl5,key]) => (
                      <React.Fragment key={key}>
                        {C(lbl5, e.seriousness?.[key], ev => {
                          const s={...(e.seriousness||{}),[key]:ev.target.checked}; setEv(i,"seriousness",s);
                        }, "red")}
                      </React.Fragment>
                    ))}
                  </div>

                  {e.seriousness?.death && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-3">Death Details</div>
                      <div className="grid grid-cols-2 gap-4">
                        {F("Date of Death", <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                            value={e.deathDate||""} onChange={ev=>setEv(i,"deathDate",ev.target.value)} />)}
                        {F("Autopsy Done?", S(["Yes","No","Unknown"],
                            { value:e.autopsyDone||"", onChange:ev=>setEv(i,"autopsyDone",ev.target.value) }))}
                        {e.autopsyDone==="Yes" &&
                          F("Autopsy Results Available?", S(["Yes","No"],
                              { value:e.autopsyResultsAvailable||"", onChange:ev=>setEv(i,"autopsyResultsAvailable",ev.target.value) }))}
                        {F("Cause of Death as Reported", I({ value:e.causeOfDeath||"", onChange:ev=>setEv(i,"causeOfDeath",ev.target.value) }))}
                      </div>
                    </div>
                  )}

                  {e.seriousness?.hospitalised && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-3">Hospitalisation Details</div>
                      <div className="grid grid-cols-3 gap-4">
                        {F("Hospital Name",    I({ value:e.hospitalName||"",   onChange:ev=>setEv(i,"hospitalName",ev.target.value)   }))}
                        {F("Admission Date",   <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                            value={e.admissionDate||""} onChange={ev=>setEv(i,"admissionDate",ev.target.value)} />)}
                        {F("Discharge Date",   <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                            value={e.dischargeDate||""} onChange={ev=>setEv(i,"dischargeDate",ev.target.value)} />)}
                      </div>
                    </div>
                  )}

                  {F("Event Notes", TA({ placeholder:"Additional notes about this event…", rows:2,
                      value:e.notes||"", onChange:ev=>setEv(i,"notes",ev.target.value) }))}
                </div>
              ))}
              <button onClick={() => setForm(f=>({...f,events:[...(f.events||[{}]),{}]}))}
                className="text-indigo-600 text-sm font-bold hover:text-indigo-800 transition-colors">+ Add Event</button>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm font-extrabold text-teal-700 uppercase tracking-widest">Case Narrative</div>
                  <button onClick={generateNarrative}
                    className="text-xs bg-teal-100 hover:bg-teal-200 text-teal-900 px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1">
                    ⚡ Auto-generate Narrative
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-3 font-medium">
                  Auto-generate pulls all patient demographics, complete medical history (including structured entries with MedDRA coding), concomitant medications, lab data, and event details into a full narrative. Edit freely after generation.
                </p>
                <textarea
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-full resize-none shadow-inner"
                  rows={10}
                  placeholder="Enter or auto-generate the full case narrative…"
                  value={form.narrative||""}
                  onChange={e => setForm(f=>({...f,narrative:e.target.value}))}
                />
                <div className="mt-5 flex justify-end">
                  <button onClick={() => saveTab({ events:form.events, narrative:form.narrative }, "Events & Narrative")}
                    className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
                    💾 Save Events &amp; Narrative
                  </button>
                </div>
              </div>
            </div>
          );
          })()}
        </div>)}
      </div>
    );
  };

  const MedicalForm = () => {
    const m = form.medical || {};
    return (
      <div className="space-y-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
        {form.narrative ? (
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest">📄 Case Narrative — submitted by Data Entry</span>
              <span className="text-xs bg-indigo-200 text-indigo-900 px-3 py-1 rounded-full font-bold shadow-sm">✓ Present</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{form.narrative}</p>
            <p className="text-xs text-slate-400 mt-3 font-medium">You can refine this narrative in the Full Case Narrative section below.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 shadow-sm">
            <span className="text-xs font-extrabold text-amber-800 uppercase tracking-widest">⚠️ No Narrative Submitted</span>
            <p className="text-sm text-amber-900 mt-2">The Data Entry team has not yet submitted a case narrative. You may return the case to Data Entry using the routing button at the bottom.</p>
          </div>
        )}

        <div>
          <SectionHead color="purple">MedDRA Coding (Events Tab) — v28.1</SectionHead>
          <div className="relative mb-4">
            <input className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm w-full pr-8 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner transition-all"
              placeholder="Search Preferred Term or LLT (type 2+ characters)…"
              value={meddraQuery}
              onFocus={() => setMeddraTarget({ section:"medical_event", idx:0 })}
              onChange={e => searchMeddra(e.target.value)} />
            {meddraLoading && <div className="absolute right-4 top-3.5 text-slate-400 text-xs animate-pulse font-bold">searching…</div>}
            {meddraResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl mt-2 max-h-64 overflow-y-auto">
                {meddraResults.map(m2 => (
                  <div key={m2.llt_code} onClick={() => pickMeddra(m2)}
                    className="px-5 py-3 hover:bg-purple-50 cursor-pointer text-sm border-b border-slate-100 last:border-0 transition-colors">
                    <div className="font-bold text-slate-800">{m2.pt} <span className="ml-2 text-xs text-slate-400 font-normal">PT {m2.pt_code}</span></div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span>LLT: {m2.llt} ({m2.llt_code})</span>
                      <span>HLT: {m2.hlt}</span>
                      <span className="text-purple-600 font-bold">SOC: {m2.soc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!meddraLoading && meddraQuery.length >= 2 && meddraResults.length === 0 && (
              <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-md mt-2 px-5 py-4 text-sm text-slate-500 font-medium">
                No terms found for "{meddraQuery}" in MedDRA 28.1
              </div>
            )}
          </div>
          {(form.events||[])[0]?.pt && (
            <div className="bg-gradient-to-r from-purple-50 to-white border border-purple-100 rounded-2xl p-4 text-sm space-y-2 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="font-extrabold text-purple-900 tracking-wide">MedDRA 28.1 Hierarchy</span>
                {IME_TERMS.includes((form.events)[0].pt) && (
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-xs shadow-sm">⚠️ IME TERM</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-purple-800">
                <span><b className="text-purple-950">LLT:</b> {(form.events)[0].llt} <span className="text-purple-500">({(form.events)[0].llt_code})</span></span>
                <span><b className="text-purple-950">PT:</b>  {(form.events)[0].pt}  <span className="text-purple-500">({(form.events)[0].pt_code})</span></span>
                <span><b className="text-purple-950">HLT:</b> {(form.events)[0].hlt}</span>
                <span><b className="text-purple-950">HLGT:</b> {(form.events)[0].hlgt}</span>
                <span className="col-span-2"><b className="text-purple-950">SOC:</b> {(form.events)[0].soc}</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <SectionHead color="purple">Event Assessment</SectionHead>
          <div className="grid grid-cols-2 gap-4">
            {F("Listedness", S(["Listed","Unlisted","Unknown"],
                { value:m.listedness||"", onChange:e => setNested("medical","listedness",e.target.value) }))}
            {F("Diagnosis / Symptom", S([{v:"D",l:"D – Diagnosis"},{v:"S",l:"S – Symptom/Sign"}],
                { value:m.diagSymptom||"", onChange:e => setNested("medical","diagSymptom",e.target.value) }))}
            {F("Company Causality", S(["Related","Possibly Related","Unlikely Related","Not Related","Unknown"],
                { value:m.causalityReported||"", onChange:e => setNested("medical","causalityReported",e.target.value) }))}
            {F("Causality Method", S(["WHO-UMC","Naranjo","CIOMS","Other"],
                { value:m.causalityMethod||"", onChange:e => setNested("medical","causalityMethod",e.target.value) }))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-white border border-yellow-200 rounded-2xl p-5 shadow-sm">
          <SectionHead color="yellow">WHO-UMC Causality Algorithm</SectionHead>
          <p className="text-xs text-slate-500 mb-4 font-medium">Select criteria then click Run Algorithm to compute result.</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {C("Temporal association (plausible time relationship)",m.temporal,e=>setNested("medical","temporal",e.target.checked))}
            {C("Dechallenge – event abated on drug withdrawal",m.dechallenge,e=>setNested("medical","dechallenge",e.target.checked))}
            {C("Rechallenge – event reappeared on reintroduction",m.rechallenge,e=>setNested("medical","rechallenge",e.target.checked))}
            {C("Alternative cause can explain the reaction",m.alternative,e=>setNested("medical","alternative",e.target.checked))}
            {C("Reaction known to the drug (listed in label)",m.knownReaction,e=>setNested("medical","knownReaction",e.target.checked))}
            {C("Reaction confirmed by objective evidence",m.confirmed,e=>setNested("medical","confirmed",e.target.checked))}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={runWHOUMC}
              className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white text-sm px-5 py-2.5 rounded-xl font-bold shadow-md shadow-yellow-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              ⚙️ Run WHO-UMC Algorithm
            </button>
            {m.causality && (
              <span className="bg-white border-2 border-yellow-400 text-yellow-900 text-sm font-extrabold px-4 py-2 rounded-xl shadow-sm">
                Result: {m.causality}
              </span>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-2xl p-5 shadow-sm">
          <SectionHead color="orange">Naranjo Algorithm</SectionHead>
          <p className="text-xs text-slate-500 mb-4 font-medium">Check applicable criteria to calculate Naranjo score.</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {C("Previous conclusive reports on this reaction",m.nar_previous,e=>setNested("medical","nar_previous",e.target.checked))}
            {C("ADE appeared after the suspect drug",m.nar_reaction,e=>setNested("medical","nar_reaction",e.target.checked))}
            {C("Adverse reaction improved when drug was stopped",m.nar_dechallenge,e=>setNested("medical","nar_dechallenge",e.target.checked))}
            {C("ADE reappeared when drug was readministered",m.nar_rechallenge,e=>setNested("medical","nar_rechallenge",e.target.checked))}
            {C("Alternative causes that could cause the ADE",m.nar_alternative,e=>setNested("medical","nar_alternative",e.target.checked))}
            {C("ADE reappeared when placebo was given",m.nar_placebo,e=>setNested("medical","nar_placebo",e.target.checked))}
            {C("Drug detected in blood/other fluids in toxic range",m.nar_drug_level,e=>setNested("medical","nar_drug_level",e.target.checked))}
            {C("ADE more severe when dose increased",m.nar_dose_related,e=>setNested("medical","nar_dose_related",e.target.checked))}
            {C("Patient had similar reaction to same/related drug",m.nar_prior_exp,e=>setNested("medical","nar_prior_exp",e.target.checked))}
            {C("ADE confirmed by objective evidence",m.nar_confirmed,e=>setNested("medical","nar_confirmed",e.target.checked))}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={runNaranjo}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm px-5 py-2.5 rounded-xl font-bold shadow-md shadow-orange-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              ⚙️ Calculate Naranjo Score
            </button>
            {m.naranjScore !== undefined && (
              <span className="bg-white border-2 border-orange-400 text-orange-900 text-sm font-extrabold px-4 py-2 rounded-xl shadow-sm">
                Score: {m.naranjScore} → {m.naranjResult}
              </span>
            )}
          </div>
        </div>

        <div>
          <SectionHead color="purple">Case Analysis</SectionHead>
          <div className="grid grid-cols-2 gap-4">
            {F("Medical Comments", TA({ rows:3, value:m.comments||"", onChange:e=>setNested("medical","comments",e.target.value) }))}
            {F("Evaluation in light of similar events", TA({ rows:3, value:m.similarEvents||"", onChange:e=>setNested("medical","similarEvents",e.target.value) }))}
          </div>
          {F("Abbreviated Narrative", TA({ rows:3, value:m.abbreviatedNarrative||"", onChange:e=>setNested("medical","abbreviatedNarrative",e.target.value) }))}
          <div className="mt-4 flex justify-end">
            <button onClick={() => saveTab({ medical:form.medical, events:form.events }, "Medical Review")}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-purple-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
              💾 Save Medical Review
            </button>
          </div>
        </div>

        <div>
          <SectionHead color="purple">Full Case Narrative</SectionHead>
          <p className="text-xs text-slate-500 mb-3 font-medium">Narrative submitted by Data Entry is shown below. You may refine it here.</p>
          <textarea
            className="bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-full resize-none shadow-inner transition-all"
            rows={8}
            placeholder="Narrative submitted by Data Entry will appear here…"
            value={form.narrative||""}
            onChange={e => setForm(f=>({...f,narrative:e.target.value}))}
          />
          <div className="mt-4 flex justify-end mb-6">
            <button onClick={() => saveTab({ narrative:form.narrative, medical:form.medical }, "Narrative")}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-purple-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
              💾 Save Narrative
            </button>
          </div>
          {F("Company Comment", TA({ rows:3, value:m.companyComment||"", onChange:e=>setNested("medical","companyComment",e.target.value) }))}
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-white border border-amber-200 rounded-2xl p-5 shadow-sm mt-6">
          <div className="text-sm font-extrabold text-amber-800 uppercase tracking-widest mb-2">Routing</div>
          <p className="text-xs text-slate-600 mb-4 font-medium">If additional information is needed, return the case below. Otherwise use Submit → to advance to Quality Review.</p>
          <button onClick={returnCaseToDataEntry}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
            ↩️ Return Case to Data Entry
          </button>
        </div>
      </div>
    );
  };

  const QualityForm = () => {
    const q=form.quality||{}, p=form.patient||{}, d2=(form.products||[{}])[0], e2=(form.events||[{}])[0], m=form.medical||{};
    const qcItems = [
      ["patientComplete",   "Patient demographics complete (age, sex, weight)?"],
      ["drugComplete",      "Suspect drug information complete (dose, route, dates)?"],
      ["eventCoded",        "Adverse event(s) MedDRA coded?"],
      ["narrativeComplete", "Case narrative present and adequate?"],
      ["causalityAssessed", "Causality assessed by medical reviewer?"],
      ["seriousnessCorrect","Seriousness classification correct?"],
      ["listednessSet",     "Listedness assessed against reference safety information?"],
      ["duplicateChecked",  "Duplicate search performed?"],
      ["followupRequired",  "Follow-up information needed?"],
    ];
    return (
      <div className="space-y-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4">Case Summary</div>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {[["Case Number",selected.caseNumber],["Patient",p.age?p.age+" y/o "+(p.sex||"")+(p.weight?" · "+p.weight+" kg":""):"Not entered"],
              ["Suspect Drug",(d2?.name||"?")+(d2?.dose?" ("+d2.dose+")":"")],["MedDRA PT",e2?.pt||e2?.term||"Not coded"],
              ["SOC",e2?.soc||"?"],["Causality",m?.causality||"Not assessed"],["Listedness",m?.listedness||"Not assessed"]
            ].map(([k,v]) => (
              <React.Fragment key={k}>
                <span className="text-slate-500 font-medium">{k}</span>
                <span className={`font-bold ${k==="Serious"&&autoSerious()?"text-red-600":"text-slate-800"}`}>{v}</span>
              </React.Fragment>
            ))}
            <span className="text-slate-500 font-medium">Serious</span>
            <span className={`font-extrabold ${autoSerious()?"text-red-600":"text-green-600"}`}>
              {autoSerious() ? "🔴 Serious" : "🟢 Non-serious"}
            </span>
          </div>
          {form.narrative && (
            <div className="mt-5 bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed shadow-inner">
              <span className="font-bold text-slate-900 block mb-2">Narrative:</span>{form.narrative}
            </div>
          )}
        </div>

        <div>
          <SectionHead color="orange">Quality Control Checklist</SectionHead>
          <div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-2xl p-5 space-y-2 shadow-sm">
            {qcItems.map(([key,lbl6]) => (
              <React.Fragment key={key}>
                {C(lbl6, q[key], e => setForm(f=>({...f,quality:{...f.quality,[key]:e.target.checked}})), q[key]?"green":"orange")}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-3 text-xs font-bold text-slate-500">{qcItems.filter(([k])=>q[k]).length} / {qcItems.length} items completed</div>
        </div>

        {F("Quality Review Comments", TA({ rows:4, placeholder:"Enter QC review findings and comments…",
            value:q.comments||"", onChange:e=>setForm(f=>({...f,quality:{...f.quality,comments:e.target.value}})) }))}

        <div>
          <SectionHead color="orange">Final Decision</SectionHead>
          <div className="flex gap-4 flex-wrap">
            {[["approved","✅ Approve Case","bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-200"],
              ["returned","↩️ Return to Medical","bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-200"]
            ].map(([val2,lbl7,cls]) => (
              <button key={val2} onClick={() => setForm(f=>({...f,quality:{...f.quality,finalStatus:val2}}))}
                className={`${cls} text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${q.finalStatus===val2?"ring-4 ring-offset-2 ring-slate-300 scale-105":""}`}>
                {lbl7}
              </button>
            ))}
          </div>
          {q.finalStatus && (
            <div className={`mt-5 text-sm font-extrabold px-4 py-3 rounded-xl inline-block shadow-sm ${q.finalStatus==="approved"?"bg-green-100 text-green-800 border border-green-200":"bg-orange-100 text-orange-900 border border-orange-200"}`}>
              Decision: {q.finalStatus.toUpperCase()} · Reviewer: {user.username} · {new Date().toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const ReadOnlySummary = () => (
    <div className="space-y-4 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl font-bold shadow-sm">
        👁️ Read-only — this case is at <strong>{selected.status}</strong> (Step {selected.currentStep}). Your role: <strong>{user.role}</strong> (Step {user.step}).
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm space-y-3 text-slate-700 shadow-sm">
        {[["Status",selected.status],["Country",form.triage?.country],["Report Type",form.triage?.reportType||form.general?.reportType],
          ["Patient",form.patient?.age?form.patient.age+" y/o "+form.patient.sex:"Not entered"],
          ["Drug",(form.products||[])[0]?.name||"Not entered"],
          ["Event (PT)",(form.events||[])[0]?.pt||(form.events||[])[0]?.term||"Not coded"],
          ["Serious",form.general?.serious?"Yes":"No"],["Causality",form.medical?.causality||"Pending"],
          ["Listedness",form.medical?.listedness||"Pending"]
        ].map(([k,v]) => (
          <div key={k} className="flex gap-3">
            <span className="text-slate-500 w-32 flex-shrink-0 font-bold">{k}:</span>
            <span className="font-medium">{v||"—"}</span>
          </div>
        ))}
        {form.narrative && <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 text-sm leading-relaxed shadow-inner">{form.narrative}</div>}
      </div>
    </div>
  );

  const SubmissionsForm = () => {
    const sub = form.submissions || {};
    const selected_agencies = sub.agencies || {};

    const toggleAgency = (id) => {
      setForm(f => ({
        ...f,
        submissions: {
          ...f.submissions,
          agencies: {
            ...(f.submissions?.agencies || {}),
            [id]: {
              ...(f.submissions?.agencies?.[id] || {}),
              selected: !(f.submissions?.agencies?.[id]?.selected),
            }
          }
        }
      }));
    };

    const setAgencyField = (id, key, val2) => {
      setForm(f => ({
        ...f,
        submissions: {
          ...f.submissions,
          agencies: {
            ...(f.submissions?.agencies || {}),
            [id]: { ...(f.submissions?.agencies?.[id] || {}), [key]: val2 }
          }
        }
      }));
    };

    const selectedCount = AGENCIES.filter(a => selected_agencies[a.id]?.selected).length;
    const submittedCount = AGENCIES.filter(a => selected_agencies[a.id]?.selected && selected_agencies[a.id]?.submittedDate).length;

    return (
      <div className="space-y-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
        <div className="bg-gradient-to-r from-violet-50 to-white border border-violet-200 rounded-2xl p-5 shadow-sm">
          <div className="text-sm font-extrabold text-violet-800 uppercase tracking-widest mb-2">Regulatory Submissions</div>
          <p className="text-sm text-slate-600 font-medium">
            Select the regulatory agencies this case must be submitted to and record submission dates. Cases with all selected agencies submitted will advance to archival.
          </p>
          {selectedCount > 0 && (
            <div className="mt-4 flex gap-3 text-sm">
              <span className="bg-violet-100 text-violet-900 px-3 py-1 rounded-full font-bold shadow-sm">{selectedCount} agencies selected</span>
              <span className={`px-3 py-1 rounded-full font-bold shadow-sm ${submittedCount === selectedCount ? "bg-green-100 text-green-800 border border-green-200" : "bg-amber-100 text-amber-900 border border-amber-200"}`}>
                {submittedCount}/{selectedCount} submitted
              </span>
            </div>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(submittedCount / selectedCount) * 100}%` }}
            />
          </div>
        )}

        <div className="space-y-4">
          {AGENCIES.map(agency => {
            const ag = selected_agencies[agency.id] || {};
            const isSelected = !!ag.selected;
            const isSubmitted = isSelected && !!ag.submittedDate;
            return (
              <div key={agency.id}
                className={`border-2 rounded-2xl transition-all duration-300 shadow-sm ${
                  isSubmitted  ? "border-green-300 bg-gradient-to-r from-green-50 to-white" :
                  isSelected   ? "border-violet-300 bg-gradient-to-r from-violet-50 to-white shadow-md" :
                                 "border-slate-200 bg-white hover:border-slate-300"}`}>
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => toggleAgency(agency.id)}>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${isSelected ? "bg-violet-600 border-violet-600" : "border-slate-300 bg-white"}`}>
                    {isSelected && <span className="text-white text-sm font-extrabold">✓</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`font-extrabold text-base ${isSelected ? "text-violet-950" : "text-slate-700"}`}>{agency.label}</span>
                      {agency.country && <span className="text-sm font-medium text-slate-400">{agency.country}</span>}
                      {isSubmitted && (
                        <span className="text-xs bg-green-200 text-green-900 border border-green-300 px-3 py-1 rounded-full font-bold ml-auto shadow-sm">✅ Submitted</span>
                      )}
                      {isSelected && !isSubmitted && (
                        <span className="text-xs bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1 rounded-full font-bold ml-auto shadow-sm">⏳ Pending</span>
                      )}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      {F("Submission Date *",
                        <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                          value={ag.submittedDate||""} onChange={e => setAgencyField(agency.id,"submittedDate",e.target.value)} />
                      )}
                      {F("Due Date (expedited)",
                        <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                          value={ag.dueDate||""} onChange={e => setAgencyField(agency.id,"dueDate",e.target.value)} />
                      )}
                      {F("Acknowledgement Date",
                        <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                          value={ag.ackDate||""} onChange={e => setAgencyField(agency.id,"ackDate",e.target.value)} />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {F("Submission Reference / Tracking No.",
                        <input className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all" placeholder="e.g. EudraVigilance ref, FAERS ID…"
                          value={ag.refNumber||""} onChange={e => setAgencyField(agency.id,"refNumber",e.target.value)} />
                      )}
                      {F("Submission Method",
                        <select className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                          value={ag.method||""} onChange={e => setAgencyField(agency.id,"method",e.target.value)}>
                          <option value="">— Select —</option>
                          <option>E2B(R3) XML — Electronic</option>
                          <option>E2B(R2) XML — Electronic</option>
                          <option>Paper / Manual</option>
                          <option>Agency Portal</option>
                          <option>Email</option>
                          <option>Other</option>
                        </select>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {F("Report Type",
                        <select className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                          value={ag.reportType||""} onChange={e => setAgencyField(agency.id,"reportType",e.target.value)}>
                          <option value="">— Select —</option>
                          <option>Initial</option>
                          <option>Follow-up 1</option>
                          <option>Follow-up 2</option>
                          <option>Follow-up 3</option>
                          <option>Final</option>
                        </select>
                      )}
                      {F("Submitted By",
                        <input className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all" placeholder="Submitter name or system"
                          value={ag.submittedBy||user.username} onChange={e => setAgencyField(agency.id,"submittedBy",e.target.value)} />
                      )}
                    </div>
                    {F("Notes",
                      <textarea className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white resize-none transition-all" rows={2}
                        placeholder={`Notes for ${agency.label} submission…`}
                        value={ag.notes||""} onChange={e => setAgencyField(agency.id,"notes",e.target.value)} />
                    )}
                    {agency.portal && (
                      <a href={agency.portal} target="_blank" rel="noreferrer"
                        className="text-sm text-violet-600 hover:text-violet-800 font-bold hover:underline transition-colors mt-2 inline-block">
                        🔗 Open {agency.label} submission portal
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {F("Submission Coordinator Comments",
          <textarea className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 w-full resize-none shadow-inner transition-all mt-4" rows={3}
            placeholder="Overall submission notes, issues, or follow-up actions required…"
            value={sub.coordinatorNotes||""} onChange={e => setForm(f => ({ ...f, submissions:{ ...f.submissions, coordinatorNotes:e.target.value }}))} />
        )}

        <div className="flex justify-end pt-4">
          <button onClick={() => saveTab({ submissions: form.submissions }, "Submissions")}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md shadow-violet-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
            💾 Save Submissions
          </button>
        </div>
      </div>
    );
  };

  const ArchivalForm = () => {
    const arc = form.archival || {};
    const sub = form.submissions || {};
    const submittedAgencies = AGENCIES.filter(a => sub.agencies?.[a.id]?.selected && sub.agencies?.[a.id]?.submittedDate);

    return (
      <div className="space-y-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4">Submissions Summary</div>
          {submittedAgencies.length > 0 ? (
            <div className="space-y-3">
              {submittedAgencies.map(a => {
                const ag = sub.agencies[a.id];
                return (
                  <div key={a.id} className="flex items-center gap-4 text-sm bg-white border border-green-200 rounded-xl px-4 py-3 shadow-sm">
                    <span className="text-green-500 font-extrabold text-lg">✅</span>
                    <span className="font-extrabold text-slate-800 w-32">{a.label}</span>
                    <span className="text-slate-500 font-medium">{a.country}</span>
                    <span className="ml-auto font-mono text-slate-600 font-bold bg-slate-100 px-3 py-1 rounded-lg">Submitted: {ag.submittedDate}</span>
                    {ag.refNumber && <span className="text-slate-400 font-medium ml-2">· Ref: {ag.refNumber}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-sm">
              ⚠️ No agency submissions recorded. Ensure all required submissions are logged in Step 5 before archiving.
            </div>
          )}
        </div>

        <div>
          <SectionHead color="indigo">Archival Details</SectionHead>
          <div className="grid grid-cols-2 gap-4">
            {F("Archival Date",
              <input type="date" className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                value={arc.archivalDate || new Date().toISOString().split("T")[0]}
                onChange={e => setNested("archival","archivalDate",e.target.value)} />
            )}
            {F("Archived By",
              <input className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                value={arc.archivedBy || user.username}
                onChange={e => setNested("archival","archivedBy",e.target.value)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {F("Archive Location / System",
              <input className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                placeholder="e.g. Veeva Vault, document ID, folder path…"
                value={arc.location||""} onChange={e => setNested("archival","location",e.target.value)} />
            )}
            {F("Retention Period",
              <select className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                value={arc.retention||""} onChange={e => setNested("archival","retention",e.target.value)}>
                <option value="">— Select —</option>
                <option>5 years from last submission</option>
                <option>7 years from last submission</option>
                <option>10 years from last submission</option>
                <option>Lifetime of product + 10 years</option>
                <option>Per local regulation</option>
              </select>
            )}
          </div>
          {F("Final Case Disposition",
            <select className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
              value={arc.disposition||""} onChange={e => setNested("archival","disposition",e.target.value)}>
              <option value="">— Select —</option>
              <option>Complete — no further action</option>
              <option>Complete — follow-up pending</option>
              <option>Complete — signal detected, under evaluation</option>
              <option>Closed — duplicate (cross-reference recorded)</option>
              <option>Closed — unconfirmed</option>
            </select>
          )}
          {F("Archival Notes",
            <textarea className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white resize-none transition-all" rows={3}
              placeholder="Any final notes, cross-references, or signal tracking references…"
              value={arc.notes||""} onChange={e => setNested("archival","notes",e.target.value)} />
          )}
        </div>

        <div className="bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-2xl p-5 shadow-sm">
          <div className="text-sm font-extrabold text-green-800 uppercase tracking-widest mb-4">Archival Checklist</div>
          <div className="space-y-2">
            {[
              ["allSubmitted",    "All required regulatory submissions completed"],
              ["narrativeFinal",  "Final case narrative confirmed and signed off"],
              ["documentsStored", "Supporting documents stored in archive system"],
              ["signalReviewed",  "Signal detection review completed if applicable"],
              ["retentionSet",    "Document retention period recorded"],
            ].map(([key, lbl]) => (
              <React.Fragment key={key}>
                {C(lbl, arc[key], e => setNested("archival", key, e.target.checked), arc[key] ? "green" : "indigo")}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-4 text-xs font-bold text-slate-500">
            {["allSubmitted","narrativeFinal","documentsStored","signalReviewed","retentionSet"].filter(k=>arc[k]).length} / 5 items completed
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button onClick={() => saveTab({ archival: form.archival }, "Case Archival")}
            className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white text-sm px-6 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2">
            🗄️ Save &amp; Archive Case
          </button>
        </div>
      </div>
    );
  };

  const lineListingRows = () => cases.map(c => {
    const t = c.triage    || {};
    const g = c.general   || {};
    const p = c.patient   || {};
    const d = (c.products || [{}])[0] || {};
    const e = (c.events   || [{}])[0] || {};
    const m = c.medical   || {};
    const s = g.seriousness || t.seriousness || {};
    const seriousFlags = Object.entries(s).filter(([,v]) => v).map(([k]) =>
      ({ death:"Death", lifeThreatening:"Life-threatening", hospitalised:"Hospitalisation",
         disability:"Disability", congenital:"Congenital anomaly", medSignificant:"Medically significant" }[k] || k)
    );
    return {
      caseNumber:   c.caseNumber,
      receiptDate:  t.receiptDate    || "—",
      country:      t.country        || "—",
      reportType:   t.reportType     || g.reportType || "—",
      patientInitials: p.initials    || t.patientInitials || "—",
      age:          p.age ? `${p.age} ${p.ageUnit || "yrs"}` : "—",
      sex:          p.sex            || "—",
      drug:         d.name           || "—",
      genericName:  d.genericName    || "—",
      dose:         d.dose ? `${d.dose} ${d.doseUnit || ""}`.trim() : "—",
      route:        d.route          || "—",
      indication:   d.indication     || "—",
      startDate:    d.startDate      || "—",
      stopDate:     d.stopDate       || "—",
      eventVerbatim: e.term          || "—",
      pt:           e.pt             || "—",
      ptCode:       e.pt_code        || "—",
      soc:          e.soc            || "—",
      onsetDate:    e.onsetDate      || "—",
      serious:      seriousFlags.length ? seriousFlags.join("; ") : "Non-serious",
      causality:    m.causality      || "—",
      listedness:   m.listedness     || "—",
      outcome:      e.outcome        || "—",
      status:       c.status         || "—",
      reporter:     t.qualification  || "—",
    };
  });

  const exportLineListing = (format) => {
    const rows = lineListingRows();
    const headers = [
      "Case #","Receipt Date","Country","Report Type","Patient Initials","Age","Sex",
      "Drug (Brand)","Generic Name","Dose","Route","Indication","Drug Start","Drug Stop",
      "Event Verbatim","MedDRA PT","PT Code","SOC","Onset Date",
      "Seriousness","Causality","Listedness","Outcome","Status","Reporter Qualification"
    ];
    const keys = [
      "caseNumber","receiptDate","country","reportType","patientInitials","age","sex",
      "drug","genericName","dose","route","indication","startDate","stopDate",
      "eventVerbatim","pt","ptCode","soc","onsetDate",
      "serious","causality","listedness","outcome","status","reporter"
    ];

    if (format === "csv") {
      const escape = v => `"${String(v).replace(/"/g,'""')}"`;
      const csv = [headers.map(escape).join(","),
        ...rows.map(r => keys.map(k => escape(r[k])).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `LineListing_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      flash("📊 Line listing exported as CSV.");
    } else if (format === "pdf") {
      const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a3" });
      const PW=420, M=10;
      doc.setFillColor(30,58,138); doc.rect(M,M,PW-M*2,10,"F");
      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(11);
      doc.text("SkyVigilance SafetyDB — ICSR Line Listing", M+2, M+7);
      doc.setFontSize(7);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")} | Total cases: ${rows.length}`, PW-M-80, M+7);
      doc.setTextColor(0,0,0);

      const colW = [16,18,18,14,12,10,8,22,18,14,12,16,14,14,22,20,10,16,14,24,14,14,16,16,16];
      const PH_A3 = 297;
      let x = M, y = M+14;
      doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.setFillColor(230,232,240);
      const drawHeader = (startY) => {
        let hx = M;
        headers.forEach((h,i) => {
          doc.rect(hx, startY, colW[i], 8,"F"); doc.setDrawColor(180,180,200); doc.rect(hx,startY,colW[i],8);
          doc.setFont("helvetica","bold"); doc.setFontSize(5.5);
          doc.text(h, hx+1, startY+5.5, { maxWidth: colW[i]-2 });
          hx += colW[i];
        });
      };
      drawHeader(y);
      y += 9;

      doc.setFont("helvetica","normal"); doc.setFontSize(5);
      rows.forEach((r, ri) => {
        if (y > PH_A3 - 22) { doc.addPage(); y = M; drawHeader(y); y += 9; }
        if (ri % 2 === 0) { doc.setFillColor(248,249,255); x=M; keys.forEach((_,i) => { doc.rect(x,y,colW[i],7,"F"); x+=colW[i]; }); }
        x = M;
        keys.forEach((k,i) => {
          doc.setDrawColor(210,210,225); doc.rect(x,y,colW[i],7);
          doc.setFont("helvetica","normal"); doc.setFontSize(5);
          doc.text(String(r[k]).slice(0,35), x+1, y+4.5, { maxWidth: colW[i]-2 });
          x += colW[i];
        });
        y += 7;
      });

      const pc = doc.internal.getNumberOfPages();
      for (let pg=1; pg<=pc; pg++) {
        doc.setPage(pg); doc.setFont("helvetica","italic"); doc.setFontSize(6); doc.setTextColor(150,150,150);
        doc.text("SkyVigilance SafetyDB — For training purposes only — Not for regulatory submission", M, PH_A3-5);
        doc.text(`Page ${pg} of ${pc}`, PW-M-20, PH_A3-5);
        doc.setTextColor(0,0,0);
      }
      doc.save(`LineListing_${new Date().toISOString().slice(0,10)}.pdf`);
      flash("📄 Line listing exported as PDF.");
    }
  };

  const renderLineListing = () => {
    const filter        = llFilter;
    const sortKey       = llSortKey;
    const sortDir       = llSortDir;
    const stepFilter    = llStepFilter;
    const seriousFilter = llSeriousFilter;

    const rows = lineListingRows().filter(r => {
      const txt = filter.toLowerCase();
      const matchText = !txt ||
        r.caseNumber.toLowerCase().includes(txt) ||
        r.drug.toLowerCase().includes(txt) ||
        r.pt.toLowerCase().includes(txt) ||
        r.country.toLowerCase().includes(txt) ||
        r.patientInitials.toLowerCase().includes(txt);
      const matchStep = stepFilter === "all" || r.status === stepFilter;
      const matchSerious = seriousFilter === "all"
        ? true
        : seriousFilter === "serious"
          ? r.serious !== "Non-serious"
          : r.serious === "Non-serious";
      return matchText && matchStep && matchSerious;
    }).sort((a,b) => {
      const av = a[sortKey] || "", bv = b[sortKey] || "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    const renderTh = (k, label, w="auto") => (
      <th key={k} onClick={() => {
            if (k === sortKey) { setLlSortDir(d => d === "asc" ? "desc" : "asc"); }
            else { setLlSortKey(k); setLlSortDir("asc"); }
          }}
        className="px-4 py-4 text-left text-xs font-extrabold text-indigo-900 uppercase tracking-wider cursor-pointer whitespace-nowrap hover:bg-indigo-100 transition-colors"
        style={{ minWidth: w }}>
        {label}{sortKey===k ? (sortDir==="asc"?" ↑":" ↓") : ""}
      </th>
    );

    const statuses = [...new Set(cases.map(c => c.status).filter(Boolean))];

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col z-50 transition-opacity">
        <div className="bg-white flex flex-col flex-1 overflow-hidden m-4 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border border-white/20">
          <div className="bg-gradient-to-r from-indigo-900 to-blue-900 px-8 py-5 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="text-white font-extrabold text-xl tracking-tight">📊 ICSR Line Listing</div>
              <div className="text-indigo-200 text-sm mt-1 font-medium">{rows.length} of {cases.length} cases shown</div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => exportLineListing("csv")}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 text-sm px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all duration-200 backdrop-blur-md">
                ⬇ Export CSV
              </button>
              <button onClick={() => exportLineListing("pdf")}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 text-sm px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all duration-200 backdrop-blur-md">
                📄 Export PDF
              </button>
              <button onClick={() => setShowLineListing(false)}
                className="text-indigo-200 hover:text-white text-3xl leading-none transition-colors ml-4 drop-shadow-sm">✕</button>
            </div>
          </div>

          <div className="bg-indigo-50/50 border-b border-indigo-100 px-8 py-4 flex items-center gap-5 flex-shrink-0">
            <input placeholder="Search case #, drug, PT, country, initials…"
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-inner transition-all font-medium"
              value={filter} onChange={e => setLlFilter(e.target.value)} />
            <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm transition-all font-medium"
              value={stepFilter} onChange={e => setLlStepFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm transition-all font-medium"
              value={seriousFilter} onChange={e => setLlSeriousFilter(e.target.value)}>
              <option value="all">All (serious + non)</option>
              <option value="serious">Serious only</option>
              <option value="nonserious">Non-serious only</option>
            </select>
          </div>

          <div className="overflow-auto flex-1">
            <table className="min-w-max w-full text-sm border-collapse">
              <thead className="bg-indigo-50/80 sticky top-0 z-10 backdrop-blur-md shadow-[0_4px_10px_-4px_rgba(0,0,0,0.05)] border-b border-indigo-100">
                <tr>
                  {renderTh("caseNumber", "Case #", "110px")}
                  {renderTh("receiptDate", "Receipt Date", "110px")}
                  {renderTh("country", "Country", "110px")}
                  {renderTh("reportType", "Report Type", "100px")}
                  {renderTh("patientInitials", "Patient", "80px")}
                  {renderTh("age", "Age", "80px")}
                  {renderTh("sex", "Sex", "70px")}
                  {renderTh("drug", "Drug (Brand)", "130px")}
                  {renderTh("genericName", "Generic", "120px")}
                  {renderTh("dose", "Dose", "90px")}
                  {renderTh("route", "Route", "90px")}
                  {renderTh("indication", "Indication", "120px")}
                  {renderTh("startDate", "Drug Start", "100px")}
                  {renderTh("stopDate", "Drug Stop", "100px")}
                  {renderTh("eventVerbatim", "Event Verbatim", "150px")}
                  {renderTh("pt", "MedDRA PT", "140px")}
                  {renderTh("ptCode", "PT Code", "90px")}
                  {renderTh("soc", "SOC", "130px")}
                  {renderTh("onsetDate", "Onset Date", "100px")}
                  {renderTh("serious", "Seriousness", "150px")}
                  {renderTh("causality", "Causality", "110px")}
                  {renderTh("listedness", "Listedness", "110px")}
                  {renderTh("outcome", "Outcome", "130px")}
                  {renderTh("reporter", "Reporter Qual", "110px")}
                  {renderTh("status", "WF Status", "120px")}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.caseNumber}
                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer bg-white/50"
                    onClick={() => {
                      const c = cases.find(x => x.caseNumber === r.caseNumber);
                      if (c) { setSelected(c); setForm(c); fetchAudit(c.id); setShowLineListing(false); setShowAudit(false); setTab("general"); }
                    }}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{r.caseNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{r.receiptDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.country}</td>
                    <td className="px-4 py-3 text-slate-600">{r.reportType}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 font-bold">{r.patientInitials}</td>
                    <td className="px-4 py-3 text-slate-600">{r.age}</td>
                    <td className="px-4 py-3 text-slate-600">{r.sex}</td>
                    <td className="px-4 py-3 font-extrabold text-slate-800">{r.drug}</td>
                    <td className="px-4 py-3 font-medium text-slate-500">{r.genericName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.dose}</td>
                    <td className="px-4 py-3 text-slate-600">{r.route}</td>
                    <td className="px-4 py-3 text-slate-600">{r.indication}</td>
                    <td className="px-4 py-3 text-slate-600">{r.startDate}</td>
                    <td className="px-4 py-3 text-slate-600">{r.stopDate}</td>
                    <td className="px-4 py-3 italic text-slate-700">{r.eventVerbatim}</td>
                    <td className="px-4 py-3 font-bold text-purple-700">{r.pt}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono font-medium">{r.ptCode}</td>
                    <td className="px-4 py-3 text-slate-500">{r.soc}</td>
                    <td className="px-4 py-3 text-slate-600">{r.onsetDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${r.serious==="Non-serious"?"bg-slate-100 text-slate-600 border border-slate-200":"bg-red-100 text-red-800 border border-red-200"}`}>
                        {r.serious}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.causality}</td>
                    <td className="px-4 py-3 text-slate-600">{r.listedness}</td>
                    <td className="px-4 py-3 text-slate-600">{r.outcome}</td>
                    <td className="px-4 py-3 text-slate-600">{r.reporter}</td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">{r.status}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={25} className="text-center py-24 text-slate-400 font-bold text-lg">No cases match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderModalForm = () => {
    if (!selected) return null;
    if (selected.currentStep > 6) return ReadOnlySummary();
    if (!isMyCase(selected)) return ReadOnlySummary();
    if (selected.currentStep === 2) return DataEntryForm();
    if (selected.currentStep === 3) return MedicalForm();
    if (selected.currentStep === 4) return QualityForm();
    if (selected.currentStep === 5) return SubmissionsForm();
    if (selected.currentStep === 6) return ArchivalForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-sans flex flex-col text-slate-800">
      <div className="sticky top-0 z-30 bg-white/70 backdrop-blur-lg border-b border-white/50 px-6 py-4 flex justify-between items-center shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-xl shadow-sm">
            <span className="text-xl text-white drop-shadow-md">🛡️</span>
          </div>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 to-blue-800 text-lg tracking-tight">
            SkyVigilance SafetyDB
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button onClick={() => setShowLineListing(true)}
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm px-5 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            📊 Line Listing
          </button>
          <div className="flex items-center gap-3 bg-white/60 border border-slate-200 px-4 py-1.5 rounded-2xl shadow-sm">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold shadow-sm
              ${user.step===1?"bg-blue-100 text-blue-900 border border-blue-200":user.step===2?"bg-teal-100 text-teal-900 border border-teal-200":user.step===3?"bg-purple-100 text-purple-900 border border-purple-200":user.step===4?"bg-orange-100 text-orange-900 border border-orange-200":user.step===5?"bg-violet-100 text-violet-900 border border-violet-200":"bg-slate-200 text-slate-800 border border-slate-300"}`}>
              {user.role}
            </span>
            <span className="text-sm font-bold text-slate-700">{user.username}</span>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <button onClick={() => { resetSession(); setUser(null); }} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Logout</button>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] text-sm font-bold animate-in slide-in-from-top-5 duration-300
          ${msg.type==="error"?"bg-red-50 text-red-800 border-2 border-red-200":"bg-green-50 text-green-800 border-2 border-green-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white/60 backdrop-blur-md border-b border-slate-200 px-8 flex items-center gap-2 shadow-sm">
        {[
          { id:"dashboard", label:"📋 Dashboard" },
          { id:"search",    label:"🔍 Search" },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            className={`text-sm px-5 py-4 font-extrabold border-b-2 transition-all duration-200
              ${activeView===v.id
                ? "border-indigo-600 text-indigo-800"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50/50"}`}>
            {v.label}
          </button>
        ))}
      </div>

      {activeView === "search" && (
        <SearchPanel
          cases={cases}
          onOpenCase={(c) => {
            setSelected(c); setForm(c); setShowAudit(false);
            setTab("general"); setMeddraQuery(""); setMeddraResults([]);
            fetchAudit(c.id);
          }}
        />
      )}

      {activeView === "dashboard" && <div className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">Workflow Dashboard</h3>
            <button onClick={fetchCases} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">↻ Refresh Data</button>
          </div>
          <div style={{ height:180 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize:11, fill:'#64748b', fontWeight:600 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize:11, fill:'#94a3b8', fontWeight:600 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold'}} />
                <Bar dataKey="value" fill="#4f46e5" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {user.step === 1 && TriageForm()}

        <div className="grid grid-cols-6 gap-4">
          {STAGES.map(stage => {
            const stageCases = cases.filter(c => c.currentStep === stage.step);
            return (
              <div key={stage.step}
                className={`rounded-3xl p-5 border-2 min-h-32 transition-all shadow-sm ${stage.step===user.step?"bg-gradient-to-b from-indigo-50 to-white border-indigo-300 shadow-md":"bg-white/80 backdrop-blur-sm border-white"}`}>
                <div className="flex justify-between items-center mb-4">
                  <h4 className={`font-extrabold text-xs uppercase tracking-widest ${stage.step===user.step?"text-indigo-800":"text-slate-500"}`}>
                    {stage.name}
                  </h4>
                  <span className="text-xs bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full font-bold shadow-sm">{stageCases.length}</span>
                </div>
                {stageCases.map(c => (
                  <div key={c.id}
                    onClick={() => {
                      setSelected(c); setForm(c); setShowAudit(false);
                      setTab("general"); setMeddraQuery(""); setMeddraResults([]);
                      fetchAudit(c.id);
                    }}
                    className={`p-3 rounded-2xl mb-3 cursor-pointer border-2 text-sm transition-all duration-200
                      ${isMyCase(c)
                        ? "bg-white border-indigo-200 hover:border-indigo-400 text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                        : "bg-slate-50 border-slate-100 hover:border-slate-300 hover:bg-white text-slate-600"}`}>
                    <div className="font-mono font-extrabold text-indigo-700">{c.caseNumber}</div>
                    <div className="text-xs mt-1.5 truncate font-medium text-slate-500">{c.triage?.country||"—"} · {(c.products||[])[0]?.name||"—"}</div>
                    {isMyCase(c) && <div className="text-indigo-600 text-xs mt-2 font-bold bg-indigo-50 inline-block px-2 py-0.5 rounded-md">▶ Your queue</div>}
                  </div>
                ))}
                {stageCases.length === 0 && <div className="text-sm text-slate-400 font-bold text-center py-8 opacity-50">Empty</div>}
              </div>
            );
          })}
        </div>

        {(() => {
          const closedCases = cases.filter(c => c.currentStep >= 7);
          if (closedCases.length === 0) return null;
          return (
            <details className="mt-6 bg-white/80 backdrop-blur-md border border-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <summary className="px-6 py-5 text-sm font-extrabold text-slate-600 cursor-pointer flex items-center gap-3 hover:bg-slate-50/50 rounded-3xl transition-colors select-none">
                <span className="text-lg">🗄️</span>
                <span>Closed &amp; Archived Cases</span>
                <span className="ml-2 bg-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full font-bold">{closedCases.length}</span>
                <span className="ml-auto text-xs text-slate-400 font-medium">Click to expand</span>
              </summary>
              <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-4 mt-3 md:grid-cols-4 xl:grid-cols-6">
                  {closedCases.map(c => (
                    <div key={c.id}
                      onClick={() => { setSelected(c); setForm(c); setShowAudit(false); setTab("general"); setMeddraQuery(""); setMeddraResults([]); fetchAudit(c.id); }}
                      className="p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer text-sm transition-all duration-200 hover:-translate-y-0.5">
                      <div className="font-mono font-extrabold text-slate-700">{c.caseNumber}</div>
                      <div className="text-slate-500 mt-2 truncate font-medium">{c.triage?.country || "—"}</div>
                      <div className="text-slate-600 truncate font-bold">{(c.products||[])[0]?.name || "—"}</div>
                      <div className="mt-2 text-slate-400 font-mono text-xs">{c.triage?.receiptDate || "—"}</div>
                      <div className="mt-2">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">Closed</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          );
        })()}
      </div>}

      {showLineListing && renderLineListing()}

      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200 py-4 text-center mt-auto">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">A VigiServe Foundation Initiative</p>
      </footer>

      {selected && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-start pt-10 pb-10 z-40 overflow-y-auto transition-opacity">
          <div className="bg-white rounded-3xl w-[850px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] mx-4 flex flex-col max-h-[85vh] border border-white/20">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white/90 backdrop-blur-md rounded-t-3xl z-20">
              <div>
                <div className="font-extrabold text-slate-900 text-xl tracking-tight">{selected.caseNumber}</div>
                <div className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Step {selected.currentStep}</span> 
                  <span className="font-bold text-slate-700">{selected.status}</span>
                  {selected.triage?.country && <span className="text-slate-400">· {selected.triage.country}</span>}
                  {selected.currentStep >= 3 && <span className="ml-2 text-violet-600 font-bold bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">E2B R3 ready</span>}
                  {selected.currentStep === 5 && <span className="ml-2 text-indigo-700 font-bold">· Submissions</span>}
                  {selected.currentStep === 6 && <span className="ml-2 text-slate-500 font-bold">· Archived</span>}
                </div>
              </div>
              <div className="flex gap-3 flex-wrap justify-end">
                <button onClick={exportCIOMS}
                  className="bg-white border-2 border-indigo-100 hover:border-indigo-300 text-indigo-800 text-sm px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1">
                  📄 CIOMS I
                </button>
                <button onClick={exportMedWatch}
                  className="bg-white border-2 border-rose-100 hover:border-rose-300 text-rose-800 text-sm px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1"
                  title="Generate FDA MedWatch Form 3500 PDF">
                  📋 MedWatch
                </button>
                {selected.currentStep >= 3 && (
                  <button onClick={downloadE2B}
                    className="bg-white border-2 border-violet-100 hover:border-violet-300 text-violet-800 text-sm px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1"
                    title="Generate ICH E2B(R3) ICHICSR XML">
                    📨 E2B R3
                  </button>
                )}
                <div className="w-px h-8 bg-slate-200 mx-1 self-center"></div>
                <button onClick={() => setShowAudit(a => !a)}
                  className={`text-sm px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1 border-2
                    ${showAudit?"bg-amber-500 hover:bg-amber-600 text-white border-amber-500":"bg-white border-amber-200 hover:border-amber-400 text-amber-800"}`}>
                  📋 Audit Trail {auditLog.length > 0 ? `(${auditLog.length})` : ""}
                </button>
              {isMyCase(selected) && selected.currentStep === 5 && !showAudit && (
                  <button onClick={returnCaseToQuality}
                    className="bg-gradient-to-r from-orange-50 to-white hover:from-orange-100 border-2 border-orange-200 text-orange-900 text-sm px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1">
                    ↩️ Return to Quality
                  </button>
                )}
                {isMyCase(selected) && selected.currentStep < 7 && !showAudit && (
                  <button onClick={updateCase}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm px-6 py-2 rounded-xl font-bold shadow-md shadow-green-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-1">
                    {selected.currentStep === 4 ? "📋 Forward to Submissions →" :
                     selected.currentStep === 5 ? "📬 Complete Submissions →" :
                     selected.currentStep === 6 ? "🗄️ Archive & Close →" :
                     "Submit →"}
                  </button>
                )}
                <button onClick={() => { setSelected(null); setShowAudit(false); setAuditLog([]); setMeddraQuery(""); setMeddraResults([]); }}
                  className="bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 text-xl font-bold w-10 h-10 rounded-xl flex items-center justify-center transition-colors ml-2">✕</button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30">
              {showAudit ? renderAuditTrail() : renderModalForm()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
