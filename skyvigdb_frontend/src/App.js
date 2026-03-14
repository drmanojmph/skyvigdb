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

const USERS = [
  { username:"triage1",      password:"train123", role:"Triage",       step:1 },
  { username:"dataentry1",   password:"train123", role:"Data Entry",   step:2 },
  { username:"medical1",     password:"train123", role:"Medical",      step:3 },
  { username:"quality1",     password:"train123", role:"Quality",      step:4 },
  { username:"submissions1", password:"train123", role:"Submissions",  step:5 },
  { username:"archival1",    password:"train123", role:"Archival",     step:6 }
];

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
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
      {label}{required && <span className="text-red-500">*</span>}
    </label>
    {hint && <p className="text-xs text-gray-400 -mt-1">{hint}</p>}
    {el}
  </div>
);

const I = (props) => <input className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" {...props} />;

const S = (opts, props) => (
  <select className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" {...props}>
    <option value="">— Select —</option>
    {opts.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

const C = (label, checked, onChange, color="indigo") => (
  <label className="flex items-start gap-2 text-sm cursor-pointer py-1">
    <input type="checkbox" checked={!!checked} onChange={onChange} className={`mt-0.5 w-4 h-4 accent-${color}-600 flex-shrink-0`} />
    <span>{label}</span>
  </label>
);

const TA = (props) => <textarea className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full resize-none" rows={3} {...props} />;

const SectionHead = ({children, color="indigo"}) => (
  <div className={`text-xs font-bold text-${color}-700 uppercase tracking-widest border-b border-${color}-200 pb-1 mb-3 mt-4`}>{children}</div>
);

const MedDRAWidget = ({ targetSection, targetIdx, currentPt, currentPtCode, currentLlt, currentSoc,
                        meddraQuery, meddraResults, meddraLoading, meddraTarget, setMeddraTarget,
                        searchMeddra, pickMeddra, onClear }) => {
  const isActive = meddraTarget?.section === targetSection && meddraTarget?.idx === targetIdx;
  return (
    <div className="mt-2 mb-1">
      {currentPt && (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs mb-1">
          <span className="text-purple-600 font-bold">MedDRA 28.1:</span>
          <span className="font-semibold text-purple-900">{currentPt}</span>
          {currentPtCode && <span className="text-purple-400">({currentPtCode})</span>}
          {currentLlt && currentLlt !== currentPt && <span className="text-purple-500">← {currentLlt}</span>}
          {currentSoc && <span className="text-gray-400 ml-1">· {currentSoc}</span>}
          <button onClick={onClear} className="ml-auto text-purple-300 hover:text-red-400 text-xs font-bold">✕</button>
        </div>
      )}
      {!isActive ? (
        <button onClick={() => setMeddraTarget({ section: targetSection, idx: targetIdx })}
          className="text-xs text-purple-600 hover:text-purple-800 underline font-medium">
          {currentPt ? "🔄 Recode with MedDRA" : "🔍 Code with MedDRA 28.1"}
        </button>
      ) : (
        <div className="relative">
          <input autoFocus
            className="border border-purple-300 rounded px-3 py-1.5 text-sm w-full pr-16 focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="Type LLT or PT (2+ chars)…"
            value={meddraQuery} onChange={e => searchMeddra(e.target.value)} />
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
                  <div className="font-semibold text-sm text-gray-800">{m2.pt} <span className="text-xs text-gray-400 font-normal">PT {m2.pt_code}</span></div>
                  <div className="text-xs text-gray-400 flex flex-wrap gap-x-3 mt-0.5">
                    <span>LLT: {m2.llt}</span><span>HLT: {m2.hlt}</span><span className="text-purple-500">{m2.soc}</span>
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
                 5:"bg-violet-100 text-violet-800", 6:"bg-gray-100 text-gray-700"};
    return map[step] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 w-full">
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 mb-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">🔍 Case Search</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Case Number</label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
              placeholder="e.g. Pharmacovigilance-1718..."
              value={qCase}
              onChange={e => setQCase(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Product / Drug Name</label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
              placeholder="Brand or generic name"
              value={qProduct}
              onChange={e => setQProduct(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Country of Incidence</label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
              placeholder="e.g. India, Germany..."
              value={qCountry}
              onChange={e => setQCountry(e.target.value)}
            />
          </div>
        </div>
        {hasQuery && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {results.length === 0
                ? "No cases match your search."
                : `${results.length} case${results.length === 1 ? "" : "s"} found`}
            </span>
            <button
              onClick={() => { setQCase(""); setQProduct(""); setQCountry(""); }}
              className="text-xs text-gray-400 hover:text-red-500 transition font-medium">
              Clear
            </button>
          </div>
        )}
      </div>

      {hasQuery && results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-indigo-50 border-b border-indigo-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Case #</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Receipt Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Country</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Event (verbatim)</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">MedDRA PT</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Reporter</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((c, i) => {
                const t  = c.triage    || {};
                const ev = (c.events   || [{}])[0] || {};
                const d  = (c.products || [{}])[0] || {};
                return (
                  <tr key={c.id}
                    onClick={() => onOpenCase(c)}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-indigo-50 transition ${i%2===0?"bg-white":"bg-gray-50/50"}`}>
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700 whitespace-nowrap">{c.caseNumber}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.receiptDate || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{t.country || "-"}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.name || "-"}{d.genericName ? <span className="text-gray-400 font-normal"> / {d.genericName}</span> : ""}</td>
                    <td className="px-4 py-3 text-gray-600 italic max-w-xs truncate">{ev.term || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-purple-800">{ev.pt || "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{t.qualification || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stepColor(c.currentStep)}`}>
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
        <div className="text-center py-20">
          <div className="text-5xl mb-3">🔍</div>
          <div className="text-sm font-medium text-gray-400">Enter a case number, product name, or country above to search across all cases.</div>
          <div className="text-xs text-gray-300 mt-1">Searches across active, submitted, and archived cases.</div>
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
    const found = USERS.find(u => u.username === login.username && u.password === login.password);
    if (found) { resetSession(); setUser(found); setLogin({ username:"", password:"" }); }
    else alert("Invalid credentials");
  };

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🛡️</div>
          <h2 className="text-xl font-bold text-gray-800">SkyVigilance</h2>
          <p className="text-xs text-gray-400 mt-1">Safety Database Training Platform</p>
        </div>
        <input placeholder="Username" className="border border-gray-300 rounded px-3 py-2 w-full mb-2 text-sm"
          value={login.username} onChange={e => setLogin({...login, username:e.target.value})}
          onKeyDown={e => e.key === "Enter" && doLogin()} />
        <input type="password" placeholder="Password" className="border border-gray-300 rounded px-3 py-2 w-full mb-4 text-sm"
          value={login.password} onChange={e => setLogin({...login, password:e.target.value})}
          onKeyDown={e => e.key === "Enter" && doLogin()} />
        <button onClick={doLogin} className="bg-indigo-700 hover:bg-indigo-800 text-white w-full py-2 rounded-lg font-semibold transition">Login</button>
        <p className="text-xs text-gray-400 text-center mt-4">Contact your training coordinator for login credentials.</p>
      </div>
      <p className="mt-5 text-xs text-blue-200 opacity-50">A VigiServe Foundation Initiative</p>
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
        className="px-2 py-2 text-left text-xs font-bold text-indigo-900 uppercase tracking-wide cursor-pointer whitespace-nowrap hover:bg-indigo-100 transition"
        style={{ minWidth: w }}>
        {label}{sortKey===k ? (sortDir==="asc"?" ↑":" ↓") : ""}
      </th>
    );

    const statuses = [...new Set(cases.map(c => c.status).filter(Boolean))];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col z-50">
        <div className="bg-white flex flex-col flex-1 overflow-hidden">
          <div className="bg-indigo-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="text-white font-bold text-lg">📊 ICSR Line Listing</div>
              <div className="text-indigo-300 text-xs mt-0.5">{rows.length} of {cases.length} cases shown</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => exportLineListing("csv")}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 rounded-lg font-semibold transition">
                ⬇ Export CSV
              </button>
              <button onClick={() => exportLineListing("pdf")}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 rounded-lg font-semibold transition">
                📄 Export PDF
              </button>
              <button onClick={() => setShowLineListing(false)}
                className="text-indigo-300 hover:text-white text-2xl leading-none transition ml-2">✕</button>
            </div>
          </div>

          <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
            <input placeholder="Search case #, drug, PT, country, initials…"
              className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={filter} onChange={e => setLlFilter(e.target.value)} />
            <select className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={stepFilter} onChange={e => setLlStepFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={seriousFilter} onChange={e => setLlSeriousFilter(e.target.value)}>
              <option value="all">All (serious + non)</option>
              <option value="serious">Serious only</option>
              <option value="nonserious">Non-serious only</option>
            </select>
          </div>

          <div className="overflow-auto flex-1">
            <table className="min-w-max w-full text-xs border-collapse">
              <thead className="bg-indigo-50 sticky top-0 z-10">
                <tr>
                  {renderTh("caseNumber", "Case #", "90px")}
                  {renderTh("receiptDate", "Receipt Date", "90px")}
                  {renderTh("country", "Country", "90px")}
                  {renderTh("reportType", "Report Type", "80px")}
                  {renderTh("patientInitials", "Patient", "60px")}
                  {renderTh("age", "Age", "60px")}
                  {renderTh("sex", "Sex", "50px")}
                  {renderTh("drug", "Drug (Brand)", "110px")}
                  {renderTh("genericName", "Generic", "100px")}
                  {renderTh("dose", "Dose", "70px")}
                  {renderTh("route", "Route", "70px")}
                  {renderTh("indication", "Indication", "100px")}
                  {renderTh("startDate", "Drug Start", "80px")}
                  {renderTh("stopDate", "Drug Stop", "80px")}
                  {renderTh("eventVerbatim", "Event Verbatim", "130px")}
                  {renderTh("pt", "MedDRA PT", "120px")}
                  {renderTh("ptCode", "PT Code", "70px")}
                  {renderTh("soc", "SOC", "110px")}
                  {renderTh("onsetDate", "Onset Date", "80px")}
                  {renderTh("serious", "Seriousness", "130px")}
                  {renderTh("causality", "Causality", "90px")}
                  {renderTh("listedness", "Listedness", "90px")}
                  {renderTh("outcome", "Outcome", "110px")}
                  {renderTh("reporter", "Reporter Qual", "90px")}
                  {renderTh("status", "WF Status", "100px")}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.caseNumber}
                    className={`border-b border-gray-100 hover:bg-indigo-50 transition cursor-pointer ${i%2===0?"bg-white":"bg-gray-50"}`}
                    onClick={() => {
                      const c = cases.find(x => x.caseNumber === r.caseNumber);
                      if (c) { setSelected(c); setForm(c); fetchAudit(c.id); setShowLineListing(false); setShowAudit(false); setTab("general"); }
                    }}>
                    <td className="px-2 py-2 font-mono font-semibold text-indigo-700">{r.caseNumber}</td>
                    <td className="px-2 py-2">{r.receiptDate}</td>
                    <td className="px-2 py-2">{r.country}</td>
                    <td className="px-2 py-2">{r.reportType}</td>
                    <td className="px-2 py-2 font-mono">{r.patientInitials}</td>
                    <td className="px-2 py-2">{r.age}</td>
                    <td className="px-2 py-2">{r.sex}</td>
                    <td className="px-2 py-2 font-semibold">{r.drug}</td>
                    <td className="px-2 py-2 text-gray-500">{r.genericName}</td>
                    <td className="px-2 py-2">{r.dose}</td>
                    <td className="px-2 py-2">{r.route}</td>
                    <td className="px-2 py-2">{r.indication}</td>
                    <td className="px-2 py-2">{r.startDate}</td>
                    <td className="px-2 py-2">{r.stopDate}</td>
                    <td className="px-2 py-2 italic text-gray-700">{r.eventVerbatim}</td>
                    <td className="px-2 py-2 font-semibold text-purple-800">{r.pt}</td>
                    <td className="px-2 py-2 text-gray-400 font-mono">{r.ptCode}</td>
                    <td className="px-2 py-2 text-gray-500">{r.soc}</td>
                    <td className="px-2 py-2">{r.onsetDate}</td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${r.serious==="Non-serious"?"bg-gray-100 text-gray-600":"bg-red-100 text-red-700"}`}>
                        {r.serious}
                      </span>
                    </td>
                    <td className="px-2 py-2">{r.causality}</td>
                    <td className="px-2 py-2">{r.listedness}</td>
                    <td className="px-2 py-2">{r.outcome}</td>
                    <td className="px-2 py-2">{r.reporter}</td>
                    <td className="px-2 py-2">
                      <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-xs font-medium">{r.status}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={25} className="text-center py-12 text-gray-400">No cases match the current filters.</td></tr>
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
    <div className="min-h-screen bg-sky-50 font-sans flex flex-col">
      <div className="bg-blue-900 border-b border-blue-800 px-6 py-3 flex justify-between items-center shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-white">SkyVigilance SafetyDB Workflow</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowLineListing(true)}
            className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
            📊 Line Listing
          </button>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold
            ${user.step===1?"bg-blue-200 text-blue-900":user.step===2?"bg-teal-200 text-teal-900":user.step===3?"bg-purple-200 text-purple-900":user.step===4?"bg-orange-200 text-orange-900":user.step===5?"bg-violet-200 text-violet-900":"bg-gray-200 text-gray-800"}`}>
            {user.role}
          </span>
          <span className="text-xs text-blue-200">{user.username}</span>
          <button onClick={() => { resetSession(); setUser(null); }} className="text-xs text-blue-300 hover:text-red-300 transition">Logout</button>
        </div>
      </div>

      {msg && (
        <div className={`fixed top-16 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold
          ${msg.type==="error"?"bg-red-100 text-red-700 border border-red-200":"bg-green-100 text-green-700 border border-green-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-1">
        {[
          { id:"dashboard", label:"📋 Dashboard" },
          { id:"search",    label:"🔍 Search" },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            className={`text-sm px-4 py-3 font-semibold border-b-2 transition
              ${activeView===v.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
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

      {activeView === "dashboard" && <div className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Workflow Dashboard</h3>
            <button onClick={fetchCases} className="text-xs text-indigo-500 hover:underline">↻ Refresh</button>
          </div>
          <div style={{ height:160 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize:11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize:11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {user.step === 1 && TriageForm()}

        <div className="grid grid-cols-6 gap-3">
          {STAGES.map(stage => {
            const stageCases = cases.filter(c => c.currentStep === stage.step);
            return (
              <div key={stage.step}
                className={`rounded-xl p-4 border min-h-32 ${stage.step===user.step?"bg-indigo-100 border-indigo-300":"bg-white border-blue-100"}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className={`font-semibold text-xs uppercase tracking-wide ${stage.step===user.step?"text-indigo-700":"text-gray-500"}`}>
                    {stage.name}
                  </h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{stageCases.length}</span>
                </div>
                {stageCases.map(c => (
                  <div key={c.id}
                    onClick={() => {
                      setSelected(c); setForm(c); setShowAudit(false);
                      setTab("general"); setMeddraQuery(""); setMeddraResults([]);
                      fetchAudit(c.id);
                    }}
                    className={`p-2 rounded-lg mb-2 cursor-pointer border text-xs font-mono transition
                      ${isMyCase(c)
                        ? "bg-indigo-100 border-indigo-300 hover:bg-indigo-200 text-indigo-800"
                        : "bg-sky-50 border-blue-100 hover:bg-sky-100 text-slate-500"}`}>
                    <div className="font-semibold">{c.caseNumber}</div>
                    <div className="text-xs mt-0.5 truncate">{c.triage?.country||"—"} · {(c.products||[])[0]?.name||"—"}</div>
                    {isMyCase(c) && <div className="text-indigo-500 text-xs mt-0.5">▶ Your queue</div>}
                  </div>
                ))}
                {stageCases.length === 0 && <div className="text-xs text-gray-300 text-center py-6">No cases</div>}
              </div>
            );
          })}
        </div>

        {(() => {
          const closedCases = cases.filter(c => c.currentStep >= 7);
          if (closedCases.length === 0) return null;
          return (
            <details className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm">
              <summary className="px-5 py-3 text-sm font-semibold text-gray-600 cursor-pointer flex items-center gap-2 hover:bg-gray-50 rounded-xl transition select-none">
                <span>🗄️</span>
                <span>Closed &amp; Archived Cases</span>
                <span className="ml-1 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">{closedCases.length}</span>
                <span className="ml-auto text-xs text-gray-400">Click to expand</span>
              </summary>
              <div className="px-5 pb-4 pt-2 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-3 mt-2 md:grid-cols-4 xl:grid-cols-6">
                  {closedCases.map(c => (
                    <div key={c.id}
                      onClick={() => { setSelected(c); setForm(c); setShowAudit(false); setTab("general"); setMeddraQuery(""); setMeddraResults([]); fetchAudit(c.id); }}
                      className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer text-xs transition">
                      <div className="font-mono font-semibold text-gray-700">{c.caseNumber}</div>
                      <div className="text-gray-400 mt-1 truncate">{c.triage?.country || "—"}</div>
                      <div className="text-gray-500 truncate">{(c.products||[])[0]?.name || "—"}</div>
                      <div className="mt-1 text-gray-400 font-mono text-xs">{c.triage?.receiptDate || "—"}</div>
                      <div className="mt-1">
                        <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-xs">Closed</span>
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

      <footer className="bg-blue-900 border-t border-blue-800 py-3 text-center">
        <p className="text-xs text-blue-300">A VigiServe Foundation Initiative</p>
      </footer>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start pt-8 pb-8 z-40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[760px] shadow-2xl mx-4 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <div className="font-bold text-gray-800 text-base">{selected.caseNumber}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Step {selected.currentStep} · {selected.status}
                  {selected.triage?.country?" · "+selected.triage.country:""}
                  {selected.currentStep >= 3 && <span className="ml-2 text-violet-500 font-semibold">· E2B R3 ready</span>}
                  {selected.currentStep === 5 && <span className="ml-2 text-violet-700 font-semibold">· Submissions</span>}
                  {selected.currentStep === 6 && <span className="ml-2 text-gray-500 font-semibold">· Archived</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button onClick={exportCIOMS}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
                  📄 CIOMS I
                </button>
                <button onClick={exportMedWatch}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                  title="Generate FDA MedWatch Form 3500 PDF">
                  📋 MedWatch
                </button>
                {selected.currentStep >= 3 && (
                  <button onClick={downloadE2B}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                    title="Generate ICH E2B(R3) ICHICSR XML">
                    📨 E2B R3
                  </button>
                )}
                <button onClick={() => setShowAudit(a => !a)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition
                    ${showAudit?"bg-amber-500 hover:bg-amber-600 text-white":"bg-amber-100 hover:bg-amber-200 text-amber-800"}`}>
                  📋 Audit Trail {auditLog.length > 0 ? `(${auditLog.length})` : ""}
                </button>
              {isMyCase(selected) && selected.currentStep === 5 && !showAudit && (
                  <button onClick={returnCaseToQuality}
                    className="bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs px-3 py-1.5 rounded-lg font-semibold transition border border-orange-300">
                    ↩️ Return to Quality
                  </button>
                )}
                {isMyCase(selected) && selected.currentStep < 7 && !showAudit && (
                  <button onClick={updateCase}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-1.5 rounded-lg font-semibold transition">
                    {selected.currentStep === 4 ? "📋 Forward to Submissions →" :
                     selected.currentStep === 5 ? "📬 Complete Submissions →" :
                     selected.currentStep === 6 ? "🗄️ Archive & Close →" :
                     "Submit →"}
                  </button>
                )}
                <button onClick={() => { setSelected(null); setShowAudit(false); setAuditLog([]); setMeddraQuery(""); setMeddraResults([]); }}
                  className="text-gray-400 hover:text-red-500 text-2xl leading-none transition ml-1">✕</button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {showAudit ? renderAuditTrail() : renderModalForm()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
