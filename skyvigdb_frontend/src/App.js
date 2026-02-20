import React, { useState, useEffect } from "react";
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

/* ================= MEDDRA SIMULATION ================= */
const MEDDRA_DB = [
  { llt:"Headache",              pt:"Headache",              hlt:"Headaches NEC",          soc:"Nervous system disorders" },
  { llt:"Nausea",                pt:"Nausea",                hlt:"Nausea and vomiting",    soc:"Gastrointestinal disorders" },
  { llt:"Skin rash",             pt:"Rash",                  hlt:"Rashes, eruptions and exanthems NEC", soc:"Skin and subcutaneous tissue disorders" },
  { llt:"Pyrexia",               pt:"Fever",                 hlt:"Febrile disorders",      soc:"General disorders" },
  { llt:"Vomiting",              pt:"Vomiting",              hlt:"Nausea and vomiting",    soc:"Gastrointestinal disorders" },
  { llt:"Anaphylactic reaction", pt:"Anaphylaxis",           hlt:"Allergic conditions NEC",soc:"Immune system disorders" },
  { llt:"Dizziness",             pt:"Dizziness",             hlt:"Vestibular disorders NEC",soc:"Nervous system disorders" },
  { llt:"Breathlessness",        pt:"Dyspnoea",              hlt:"Respiratory disorders NEC",soc:"Respiratory disorders" },
  { llt:"Itching skin",          pt:"Pruritus",              hlt:"Pruritis NEC",           soc:"Skin and subcutaneous tissue disorders" },
  { llt:"Fatigue",               pt:"Fatigue",               hlt:"Asthenic conditions",    soc:"General disorders" },
  { llt:"Liver function test abnormal", pt:"Hepatotoxicity",hlt:"Hepatic disorders NEC",  soc:"Hepatobiliary disorders" },
  { llt:"QT prolongation",       pt:"QT prolongation",       hlt:"Cardiac arrhythmias NEC",soc:"Cardiac disorders" },
  { llt:"Agranulocytosis",       pt:"Agranulocytosis",       hlt:"Bone marrow disorders",  soc:"Blood and lymphatic system disorders" },
  { llt:"Stevens-Johnson syndrome",pt:"Stevens-Johnson syndrome",hlt:"Epidermal disorders",soc:"Skin and subcutaneous tissue disorders" },
  { llt:"Seizure",               pt:"Seizure",               hlt:"Seizures NEC",           soc:"Nervous system disorders" },
];

const STAGES = [
  { name:"Triage",     step:1 },
  { name:"Data Entry", step:2 },
  { name:"Medical",    step:3 },
  { name:"Quality",    step:4 },
  { name:"Approved",   step:5 }
];

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

const C = (label, checked, onChange, color="indigo") => (
  <label className="flex items-start gap-2 text-sm cursor-pointer py-1">
    <input type="checkbox" checked={!!checked} onChange={onChange}
      className={`mt-0.5 w-4 h-4 accent-${color}-600 flex-shrink-0`} />
    <span>{label}</span>
  </label>
);

const TA = (props) => (
  <textarea className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full resize-none" rows={3} {...props} />
);

const SectionHead = ({children, color="indigo"}) => (
  <div className={`text-xs font-bold text-${color}-700 uppercase tracking-widest border-b border-${color}-200 pb-1 mb-3 mt-4`}>{children}</div>
);

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
  const [msg, setMsg]                 = useState(null);
  const [auditLog, setAuditLog]       = useState([]);
  const [showAudit, setShowAudit]     = useState(false);

  useEffect(() => { if (user) fetchCases(); }, [user]);

  const fetchCases = async () => {
    try {
      const res = await axios.get(API + "/cases");
      setCases(res.data || []);
    } catch { flash("Could not load cases — check backend connection.", "error"); }
  };

  const fetchAudit = async (caseId) => {
    try {
      const res = await axios.get(API + "/cases/" + caseId + "/audit");
      setAuditLog(res.data || []);
    } catch { setAuditLog([]); }
  };

  const flash = (text, type="ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
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
          <p className="text-xs text-gray-400 mt-1">Safety Database Platform</p>
        </div>
        <input placeholder="Username" className="border border-gray-300 rounded px-3 py-2 w-full mb-2 text-sm"
          value={login.username} onChange={e => setLogin({...login, username:e.target.value})}
          onKeyDown={e => e.key === "Enter" && doLogin()} />
        <input type="password" placeholder="Password" className="border border-gray-300 rounded px-3 py-2 w-full mb-4 text-sm"
          value={login.password} onChange={e => setLogin({...login, password:e.target.value})}
          onKeyDown={e => e.key === "Enter" && doLogin()} />
        <button onClick={doLogin} className="bg-indigo-700 hover:bg-indigo-800 text-white w-full py-2 rounded-lg font-semibold transition">
          Login
        </button>
      </div>
      {/* Login page footer */}
      <p className="mt-6 text-xs text-blue-200 opacity-75">A VigiServe Foundation Initiative</p>
    </div>
  );

  /* ---- STATE HELPERS ---- */
  const setNested = (section, key, value) =>
    setForm(f => ({ ...f, [section]: { ...(f[section] || {}), [key]: value } }));

  const setDeep = (section, subkey, key, value) =>
    setForm(f => ({
      ...f,
      [section]: { ...(f[section] || {}),
        [subkey]: { ...((f[section] || {})[subkey] || {}), [key]: value }
      }
    }));

  const isMyCase = (c) => c.currentStep === user.step;

  /* ---- DUPLICATE CHECK ---- */
  const detectDuplicate = () => {
    const t = form.triage || {};
    const drug = (form.products || [])[0]?.name || "";
    const event = (form.events || [])[0]?.term || "";
    const dup = cases.find(c =>
      c.triage?.patientInitials === t.patientInitials &&
      (c.products||[])[0]?.name === drug &&
      (c.events||[])[0]?.term === event
    );
    if (dup) { alert("⚠️ Possible duplicate: " + dup.caseNumber); return true; }
    return false;
  };

  /* ---- CREATE (Triage → Data Entry) ---- */
  const createCase = async () => {
    if (!form.triage?.receiptDate) { alert("Initial Receipt Date is required."); return; }
    if (!form.triage?.country)     { alert("Country of Incidence is required.");  return; }
    if (detectDuplicate()) return;
    try {
      await axios.post(API + "/cases", {
        triage:   form.triage   || {},
        general:  form.general  || {},
        patient:  form.patient  || {},
        products: form.products || [],
        events:   form.events   || [],
        _audit:   { performedBy: user.username, role: user.role }
      });
      setForm({});
      fetchCases();
      flash("✅ Case booked-in successfully.");
    } catch { flash("❌ Could not create case.", "error"); }
  };

  /* ---- UPDATE (role-gated) ---- */
  const updateCase = async () => {
    if (!isMyCase(selected)) {
      alert("⛔ You can only submit cases assigned to your role step.");
      return;
    }
    try {
      await axios.put(API + "/cases/" + selected.id, { ...form, _audit: { performedBy: user.username, role: user.role } });
      setSelected(null);
      setForm({});
      fetchCases();
      flash("✅ Case submitted successfully.");
    } catch { flash("❌ Update failed.", "error"); }
  };

  /* ---- RETURN TO DATA ENTRY (from Medical Review) ---- */
  const returnCaseToDataEntry = async () => {
    if (!isMyCase(selected)) {
      alert("⛔ You can only route cases assigned to your role step.");
      return;
    }
    if (!window.confirm("Return this case to Data Entry for further information?")) return;
    try {
      await axios.put(API + "/cases/" + selected.id, {
        ...form,
        medical: { ...(form.medical || {}), routeBackToDataEntry: true },
        _audit: { performedBy: user.username, role: user.role }
      });
      setSelected(null);
      setForm({});
      fetchCases();
      flash("↩️ Case returned to Data Entry.");
    } catch { flash("❌ Routing failed.", "error"); }
  };

  /* ---- TAB-LEVEL SAVE (PATCH — no step advance) ---- */
  const saveTab = async (fields, label = "tab") => {
    if (!selected?.id) { flash("No case selected.", "error"); return; }
    try {
      const res = await axios.patch(API + "/cases/" + selected.id, { ...fields, _audit: { performedBy: user.username, role: user.role } });
      // Merge saved data back into form & selected so state stays in sync
      setForm(f => ({ ...f, ...res.data }));
      setSelected(s => ({ ...s, ...res.data }));
      flash("💾 " + label + " saved.");
    } catch { flash("❌ Save failed — check connection.", "error"); }
  };

  /* ---- MEDDRA ---- */
  const searchMeddra = (q) => {
    setMeddraQuery(q);
    setMeddraResults(q.length > 1 ? MEDDRA_DB.filter(m =>
      m.llt.toLowerCase().includes(q.toLowerCase()) ||
      m.pt.toLowerCase().includes(q.toLowerCase())
    ) : []);
  };

  const pickMeddra = (m) => {
    const events = [...((form.events && form.events.length) ? form.events : [{}])];
    events[0] = { ...events[0], llt:m.llt, pt:m.pt, hlt:m.hlt, soc:m.soc, term:events[0]?.term || m.llt };
    setForm(f => ({ ...f, events }));
    setMeddraQuery(m.pt);
    setMeddraResults([]);
  };

  /* ---- AUTO SERIOUSNESS ---- */
  const autoSerious = () => {
    const pt = (form.events||[])[0]?.pt || "";
    const s  = form.general?.seriousness || {};
    return IME_TERMS.some(t => t.toLowerCase() === pt.toLowerCase()) ||
           Object.values(s).some(v => v === true);
  };

  /* ---- WHO-UMC CAUSALITY ---- */
  const runWHOUMC = () => {
    const m = form.medical || {};
    let result = "Unassessable";
    if (m.rechallenge)                                   result = "Certain";
    else if (m.temporal && m.dechallenge && !m.alternative) result = "Probable";
    else if (m.temporal && !m.alternative)               result = "Possible";
    else if (m.temporal)                                 result = "Unlikely";
    setForm(f => ({ ...f, medical: { ...m, causality:result } }));
  };

  /* ---- NARANJO SCORE ---- */
  const runNaranjo = () => {
    const m = form.medical || {};
    let score = 0;
    if (m.nar_previous)     score += 1;
    if (m.nar_reaction)     score += 2;
    if (m.nar_dechallenge)  score += 1;
    if (m.nar_rechallenge)  score += 2;
    if (m.nar_alternative)  score -= 1;
    if (m.nar_placebo)      score += 1;
    if (m.nar_drug_level)   score += 1;
    if (m.nar_dose_related) score += 1;
    if (m.nar_prior_exp)    score += 1;
    if (m.nar_confirmed)    score += 1;
    let cat = score >= 9 ? "Definite" : score >= 5 ? "Probable" : score >= 1 ? "Possible" : "Doubtful";
    setForm(f => ({ ...f, medical: { ...m, naranjScore:score, naranjResult:cat } }));
  };

  /* ---- NARRATIVE AUTO-GENERATE ---- */
  const generateNarrative = () => {
    const caseId = selected?.caseNumber || selected?.id || "[Case ID]";
    const p   = form.patient  || {};
    const d   = (form.products || [{}])[0];
    const e   = (form.events   || [{}])[0];
    const g   = form.general   || {};
    const t   = form.triage    || {};
    const med = form.medical   || {};
    const serious = autoSerious() ? "serious (" +
      Object.entries(g.seriousness || {}).filter(([,v]) => v).map(([k]) => k).join(", ") + ")" : "non-serious";
    const text =
      `Case ID: ${caseId}. ` +
      `A ${p.age||"[age]"}-year-old ${p.sex||"[sex]"} patient${p.weight ? " (" + p.weight + " kg)" : ""} ` +
      `with a medical history of ${p.medHistory||"no relevant past history"} ` +
      `was receiving ${d?.name||"[drug]"} (${d?.dose||"dose not reported"}, ${d?.route||"route not reported"}) ` +
      `for ${d?.indication||"[indication]"}. ` +
      `On ${e?.onsetDate||"[onset date]"}, the patient developed ${e?.pt||e?.term||"[event]"}. ` +
      `The event was considered ${serious}. ` +
      (med.causality   ? `Causality was assessed as ${med.causality} per WHO-UMC criteria. ` : "") +
      (med.listedness  ? `The event is ${med.listedness} per the reference safety information. ` : "") +
      `The case was reported by a ${t.qualification||"reporter"} from ${t.country||"[country]"}. ` +
      (e?.outcome ? `Outcome: ${e.outcome}.` : "Outcome: Unknown.");
    setForm(f => ({ ...f, narrative: text }));
  };

  /* ---- CIOMS I PDF ---- */
  const exportCIOMS = () => {
    const doc = new jsPDF();
    const p  = form.patient  || {};
    const d  = (form.products||[{}])[0];
    const e  = (form.events  ||[{}])[0];
    const g  = form.general  || {};
    const m  = form.medical  || {};
    const t  = form.triage   || {};

    doc.setFontSize(12); doc.setFont("helvetica","bold");
    doc.text("CIOMS I Form – Individual Case Safety Report", 10, 15);
    doc.setFont("helvetica","normal"); doc.setFontSize(9);

    const row = (label, val, y) => {
      doc.setFont("helvetica","bold"); doc.text(label+":", 10, y);
      doc.setFont("helvetica","normal"); doc.text(String(val||"Not reported"), 65, y);
    };

    row("Case Number",        selected.caseNumber,       28);
    row("Receipt Date",       t.receiptDate,             35);
    row("Country of Incidence",t.country,                42);
    row("Report Type",        g.reportType||"Spontaneous",49);
    row("Medically Confirmed",g.medConfirmed?"Yes":"No",  56);
    row("Patient Initials",   t.patientInitials,         63);
    row("Patient Age",        p.age ? p.age+" years" : "?", 70);
    row("Patient Sex",        p.sex,                     77);
    row("Weight",             p.weight ? p.weight+" kg" : "?", 84);
    row("Suspect Drug",       d?.name,                   91);
    row("Generic Name",       d?.genericName,            98);
    row("Dose & Route",       (d?.dose||"?")+" / "+(d?.route||"?"), 105);
    row("Indication",         d?.indication,             112);
    row("Start Date",         d?.startDate,              119);
    row("Action Taken",       d?.actionTaken,            126);
    row("Dechallenge",        d?.dechallenge,            133);
    row("Rechallenge",        d?.rechallenge,            140);
    row("Event (Verbatim)",   e?.term,                   147);
    row("MedDRA PT",          e?.pt,                     154);
    row("MedDRA SOC",         e?.soc,                    161);
    row("Onset Date",         e?.onsetDate,              168);
    row("Outcome",            e?.outcome,                175);
    row("Seriousness",        autoSerious()?"Serious":"Non-serious", 182);
    row("Causality (WHO-UMC)",m?.causality,              189);
    row("Listedness",         m?.listedness,             196);

    doc.setFont("helvetica","bold"); doc.text("Narrative:", 10, 206);
    doc.setFont("helvetica","normal");
    const narLines = doc.splitTextToSize(form.narrative||"No narrative generated.", 185);
    doc.text(narLines, 10, 213);

    doc.setFontSize(7); doc.setTextColor(120);
    doc.text("Generated by SkyVigilance Training Platform – For training purposes only", 10, 290);
    doc.save(`CIOMS_${selected.caseNumber}.pdf`);
  };

  /* ---- DASHBOARD CHART ---- */
  const chartData = STAGES.map(s => ({
    name: s.name,
    value: cases.filter(c => c.currentStep === s.step).length
  }));

  /* ====================================================
     STEP FORMS
  ==================================================== */

  /* ---- STEP 1: TRIAGE / BOOK-IN ---- */
  const TriageForm = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📥</span>
        <h3 className="font-bold text-blue-900 text-sm uppercase tracking-widest">New Case Book-In</h3>
      </div>

      <SectionHead color="blue">Case Identification</SectionHead>
      <div className="grid grid-cols-3 gap-3">
        {F("Initial Receipt Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            value={form.triage?.receiptDate||""} onChange={e => setNested("triage","receiptDate",e.target.value)} />, true,
          "Date your company became aware")}
        {F("Central Receipt Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            value={form.triage?.centralReceiptDate||""} onChange={e => setNested("triage","centralReceiptDate",e.target.value)} />, false,
          "Received by Central Safety")}
        {F("Country of Incidence", S(["United States","United Kingdom","Germany","France","Japan","India","Canada","Australia","Brazil","Other"],
            { value:form.triage?.country||"", onChange:e => setNested("triage","country",e.target.value) }), true)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {F("Report Type", S(["Spontaneous","Literature","Clinical Study","Regulatory Authority","Other"],
            { value:form.triage?.reportType||"", onChange:e => setNested("triage","reportType",e.target.value) }), true)}
        {F("Patient Initials", I({ placeholder:"e.g. J.D.", value:form.triage?.patientInitials||"",
            onChange:e => setNested("triage","patientInitials",e.target.value) }))}
        {F("Initial Justification", S(["Medically Significant","Serious","Non-serious","Unknown"],
            { value:form.triage?.justification||"", onChange:e => setNested("triage","justification",e.target.value) }))}
      </div>

      <SectionHead color="blue">Reporter Information</SectionHead>
      <div className="grid grid-cols-3 gap-3">
        {F("Reporter First Name", I({ placeholder:"First", value:form.triage?.reporterFirst||"",
            onChange:e => setNested("triage","reporterFirst",e.target.value) }))}
        {F("Reporter Last Name",  I({ placeholder:"Last",  value:form.triage?.reporterLast||"",
            onChange:e => setNested("triage","reporterLast",e.target.value) }))}
        {F("Qualification", S(["Physician","Pharmacist","Nurse","Consumer","Lawyer","Other HCP","Unknown"],
            { value:form.triage?.qualification||"", onChange:e => setNested("triage","qualification",e.target.value) }))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {F("Institution", I({ placeholder:"Hospital/Company name", value:form.triage?.institution||"",
            onChange:e => setNested("triage","institution",e.target.value) }))}
        {F("Institution ID", I({ placeholder:"Optional", value:form.triage?.institutionId||"",
            onChange:e => setNested("triage","institutionId",e.target.value) }))}
        <div className="flex flex-col justify-end pb-3">
          {C("Protect Reporter Confidentiality", form.triage?.protectReporter,
            e => setNested("triage","protectReporter",e.target.checked))}
          {C("Primary Reporter", form.triage?.primaryReporter,
            e => setNested("triage","primaryReporter",e.target.checked))}
        </div>
      </div>

      <SectionHead color="blue">Suspect Product &amp; Event</SectionHead>
      <div className="grid grid-cols-2 gap-3">
        {F("Suspect Drug / Product Name", I({ placeholder:"Brand or generic name",
            value:(form.products||[])[0]?.name||"",
            onChange:e => setForm(f => ({ ...f, products:[{ ...(f.products?.[0]||{}), name:e.target.value }] })) }), true)}
        {F("Event Description as Reported", I({ placeholder:"Verbatim reporter term",
            value:(form.events||[])[0]?.term||"",
            onChange:e => setForm(f => ({ ...f, events:[{ ...(f.events?.[0]||{}), term:e.target.value }] })) }), true)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {F("Onset Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            value={(form.events||[])[0]?.onsetDate||""}
            onChange={e => setForm(f => ({ ...f, events:[{ ...(f.events?.[0]||{}), onsetDate:e.target.value }] }))} />)}
        {F("Reported Causality", S(["Related","Possibly Related","Not Related","Unknown"],
            { value:(form.events||[])[0]?.reportedCausality||"",
              onChange:e => setForm(f => ({ ...f, events:[{ ...(f.events?.[0]||{}), reportedCausality:e.target.value }] })) }))}
      </div>

      <SectionHead color="blue">Seriousness Criteria</SectionHead>
      <div className="grid grid-cols-3 gap-1 bg-red-50 p-3 rounded-lg border border-red-100">
        {[["Death","death"],["Life-threatening","lifeThreatening"],["Hospitalisation","hospitalisation"],
          ["Disability/Incapacity","disability"],["Congenital Anomaly","congenital"],["Medically Significant","medSignificant"]
        ].map(([label, key]) =>
          C(label, form.triage?.seriousness?.[key],
            e => setForm(f => ({ ...f, triage:{ ...f.triage,
              seriousness:{ ...(f.triage?.seriousness||{}), [key]:e.target.checked }
            }})), "red")
        )}
      </div>

      <button onClick={createCase}
        className="mt-4 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2">
        📋 Book-In Case
      </button>
    </div>
  );


  /* ---- RENDER AUDIT TRAIL ---- */
  const renderAuditTrail = () => {
    const ACTION_META = {
      CASE_CREATED:         { label: "Case Created",            color: "bg-blue-100 text-blue-800",   icon: "📥" },
      TAB_SAVED:            { label: "Tab Saved",               color: "bg-teal-100 text-teal-800",   icon: "💾" },
      SUBMITTED:            { label: "Submitted",               color: "bg-green-100 text-green-800", icon: "✅" },
      ROUTE_BACK_TO_DE:     { label: "Returned to Data Entry",  color: "bg-amber-100 text-amber-800", icon: "↩️" },
      RETURNED_TO_MEDICAL:  { label: "Returned to Medical",     color: "bg-amber-100 text-amber-800", icon: "↩️" },
      APPROVED:             { label: "Approved",                color: "bg-emerald-100 text-emerald-800", icon: "🏆" },
    };

    const STEP_NAMES = { 1:"Triage", 2:"Data Entry", 3:"Medical Review", 4:"Quality Review", 5:"Approved" };

    const fmtTime = (iso) => {
      const d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) +
             " " + d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
    };

    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">GxP Audit Trail</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Complete chronological record of all actions on this case — mirrors enterprise PV system audit logs.
            </p>
          </div>
          <button onClick={() => fetchAudit(selected.id)}
            className="text-xs text-indigo-500 hover:underline">↻ Refresh</button>
        </div>

        {/* Training note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-xs text-amber-800">
          <span className="font-bold">📚 Training Note: </span>
          In real pharmacovigilance systems (Oracle Argus Safety, Veeva Vault), every field-level change is
          recorded in an audit trail that is permanently tamper-proof and required by regulations including
          21 CFR Part 11, EU Annex 11, and ICH E6(R2) GCP. This trail below shows workflow-level actions.
        </div>

        {/* Timeline */}
        {auditLog.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-sm">No audit entries yet for this case.</div>
            <div className="text-xs mt-1">Actions will appear here as the case moves through the workflow.</div>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {auditLog.map((entry, i) => {
                const meta = ACTION_META[entry.actionType] || { label: entry.actionType, color: "bg-gray-100 text-gray-700", icon: "⚙️" };
                return (
                  <div key={entry.id || i} className="flex gap-4 relative">
                    {/* Timeline dot */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0 z-10 border-2 border-white shadow-sm ${meta.color}`}>
                      {meta.icon}
                    </div>
                    {/* Content card */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                            {meta.label}
                          </span>
                          {entry.stepFrom !== null && entry.stepTo !== null && entry.stepFrom !== entry.stepTo && (
                            <span className="text-xs text-gray-500">
                              {STEP_NAMES[entry.stepFrom] || "Step "+entry.stepFrom}
                              {" → "}
                              {STEP_NAMES[entry.stepTo] || "Step "+entry.stepTo}
                            </span>
                          )}
                          {entry.section && entry.actionType === "TAB_SAVED" && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {entry.section}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {fmtTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 leading-relaxed mb-2">{entry.details}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-600">👤 {entry.performedBy}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{entry.role}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary table */}
        {auditLog.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Summary</div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Events",    value: auditLog.length,                                                             color: "bg-blue-50 text-blue-800" },
                { label: "Tab Saves",        value: auditLog.filter(e => e.actionType==="TAB_SAVED").length,                     color: "bg-teal-50 text-teal-800" },
                { label: "Submissions",      value: auditLog.filter(e => e.actionType==="SUBMITTED").length,                     color: "bg-green-50 text-green-800" },
                { label: "Returns / Rework", value: auditLog.filter(e => ["ROUTE_BACK_TO_DE","RETURNED_TO_MEDICAL"].includes(e.actionType)).length, color: "bg-amber-50 text-amber-800" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                  <div className="text-lg font-bold">{value}</div>
                  <div className="text-xs">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ---- STEP 2: DATA ENTRY (Tabbed) ---- */
  const DataEntryForm = () => {
    const tabs2 = ["general","reporter","patient","history","lab","products","events"];
    return (
      <div>
        <div className="flex gap-0.5 mb-4 flex-wrap border-b border-gray-200">
          {tabs2.map(t2 => (
            <button key={t2} onClick={() => setTab(t2)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border-b-2 transition
                ${tab===t2 ? "border-indigo-600 text-indigo-600 bg-indigo-50" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
              {t2}
            </button>
          ))}
        </div>

        {/* GENERAL */}
        {tab === "general" && (
          <div>
            <SectionHead>Case Classification</SectionHead>
            <div className="grid grid-cols-2 gap-3">
              {F("Source Type", S(["Spontaneous","Literature","Clinical Study","Regulatory Authority","Compassionate Use","Other"],
                  { value:form.general?.sourceType||"", onChange:e => setNested("general","sourceType",e.target.value) }))}
              {F("Report Type", S(["Initial","Follow-up","Amendment","Final"],
                  { value:form.general?.reportType||"", onChange:e => setNested("general","reportType",e.target.value) }))}
              {F("Central Receipt Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                  value={form.general?.centralReceiptDate||""} onChange={e => setNested("general","centralReceiptDate",e.target.value)} />)}
              {F("Case Classification", S(["Adverse Drug Reaction","Product Quality","Medical Error","Off-label Use","Overdose","Unknown"],
                  { value:form.general?.classification||"", onChange:e => setNested("general","classification",e.target.value) }))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {F("Initial Justification", S(["Medically Significant","Serious Event","Non-serious","Unknown"],
                  { value:form.general?.justification||"", onChange:e => setNested("general","justification",e.target.value) }))}
              <div className="flex flex-col justify-end pb-3">
                {C("Medically Confirmed",      form.general?.medConfirmed,    e => setNested("general","medConfirmed",e.target.checked))}
                {C("Case Requires Follow-up",  form.general?.requiresFollowup,e => setNested("general","requiresFollowup",e.target.checked))}
              </div>
            </div>

            <SectionHead>Seriousness Criteria</SectionHead>
            <div className="grid grid-cols-2 gap-1 bg-red-50 p-3 rounded-lg border border-red-100 mb-3">
              {[["Death","death"],["Life-threatening","lifeThreatening"],["Hospitalisation (initial or prolonged)","hospitalisation"],
                ["Disability / Permanent Incapacity","disability"],["Congenital Anomaly / Birth Defect","congenital"],
                ["Other Medically Important Condition","medSignificant"]
              ].map(([label, key]) =>
                C(label, form.general?.seriousness?.[key],
                  e => setForm(f => ({
                    ...f, general:{ ...f.general,
                      seriousness:{ ...(f.general?.seriousness||{}), [key]:e.target.checked },
                      serious: e.target.checked || Object.values(f.general?.seriousness||{}).some(v => v)
                    }
                  })), "red")
              )}
            </div>
            {autoSerious() && (
              <div className="bg-red-100 border border-red-400 text-red-800 text-xs px-3 py-2 rounded-lg font-semibold mb-3">
                ⚠️ IME term detected — this case MUST be classified as SERIOUS
              </div>
            )}

            {F("Other Seriousness Details", TA({ placeholder:"Specify if 'Other Medically Important Condition' is checked...",
                value:form.general?.seriousnessOther||"",
                onChange:e => setNested("general","seriousnessOther",e.target.value) }))}
          
          <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end">
            <button onClick={() => saveTab({ general: form.general }, "General")}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save General
            </button>
          </div>
          </div>
        )}

        {/* REPORTER */}
        {tab === "reporter" && (
          <div>
            <SectionHead>Primary Reporter Details</SectionHead>
            <div className="grid grid-cols-3 gap-3">
              {F("Title",       S(["Dr","Prof","Mr","Mrs","Ms","Other"],
                  { value:form.general?.reporter?.title||"", onChange:e => setDeep("general","reporter","title",e.target.value) }))}
              {F("First Name",  I({ value:form.general?.reporter?.firstName||"",  onChange:e => setDeep("general","reporter","firstName",e.target.value) }))}
              {F("Middle Name", I({ value:form.general?.reporter?.middleName||"", onChange:e => setDeep("general","reporter","middleName",e.target.value) }))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {F("Last Name",   I({ value:form.general?.reporter?.lastName||"",   onChange:e => setDeep("general","reporter","lastName",e.target.value) }))}
              {F("Qualification", S(["Physician","Pharmacist","Nurse","Consumer","Lawyer","Other HCP","Unknown"],
                  { value:form.general?.reporter?.qualification||"", onChange:e => setDeep("general","reporter","qualification",e.target.value) }))}
              {F("Reporter ID", I({ placeholder:"Optional", value:form.general?.reporter?.reporterId||"",
                  onChange:e => setDeep("general","reporter","reporterId",e.target.value) }))}
            </div>

            <SectionHead>Institution</SectionHead>
            <div className="grid grid-cols-2 gap-3">
              {F("Institution Name",   I({ value:form.general?.reporter?.institution||"",   onChange:e => setDeep("general","reporter","institution",e.target.value) }))}
              {F("Institution ID",     I({ value:form.general?.reporter?.institutionId||"", onChange:e => setDeep("general","reporter","institutionId",e.target.value) }))}
              {F("Department",         I({ value:form.general?.reporter?.department||"",    onChange:e => setDeep("general","reporter","department",e.target.value) }))}
              {F("Country",            S(["United States","United Kingdom","Germany","France","Japan","India","Canada","Australia","Brazil","Other"],
                  { value:form.general?.reporter?.country||"", onChange:e => setDeep("general","reporter","country",e.target.value) }))}
            </div>
            {F("Reporter Notes", TA({ value:form.general?.reporter?.notes||"", onChange:e => setDeep("general","reporter","notes",e.target.value) }))}

            <div className="flex gap-4 mt-2">
              {C("Protect Reporter Confidentiality",  form.general?.reporter?.protect,       e => setDeep("general","reporter","protect",e.target.checked))}
              {C("Correspondence Contact",            form.general?.reporter?.correspondence, e => setDeep("general","reporter","correspondence",e.target.checked))}
            </div>
          
          <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end">
            <button onClick={() => saveTab({ general: form.general }, "Reporter")}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save Reporter
            </button>
          </div>
          </div>
        )}

        {/* PATIENT */}
        {tab === "patient" && (
          <div>
            <SectionHead>Patient Identification</SectionHead>
            <div className="grid grid-cols-3 gap-3">
              {F("Patient ID",     I({ placeholder:"Pat ID / Subject No.", value:form.patient?.patId||"",
                  onChange:e => setNested("patient","patId",e.target.value) }))}
              {F("Initials",       I({ placeholder:"e.g. J.D.", value:form.patient?.initials||"",
                  onChange:e => setNested("patient","initials",e.target.value) }))}
              {F("Number of Patients", I({ type:"number", min:1, value:form.patient?.numPatients||"1",
                  onChange:e => setNested("patient","numPatients",e.target.value) }))}
            </div>
            {C("Protect Patient Confidentiality", form.patient?.protect,
              e => setNested("patient","protect",e.target.checked))}

            <SectionHead>Demographics</SectionHead>
            <div className="grid grid-cols-3 gap-3">
              {F("Age",           I({ type:"number", placeholder:"Years", value:form.patient?.age||"",
                  onChange:e => setNested("patient","age",e.target.value) }))}
              {F("Date of Birth", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                  value={form.patient?.dob||""} onChange={e => setNested("patient","dob",e.target.value)} />)}
              {F("Gender at Birth", S(["Male","Female","Unknown"],
                  { value:form.patient?.sex||"", onChange:e => setNested("patient","sex",e.target.value) }))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {F("Current Gender", S(["Male","Female","Non-binary","Prefer not to say","Unknown"],
                  { value:form.patient?.currentGender||"", onChange:e => setNested("patient","currentGender",e.target.value) }))}
              {F("Weight (kg)",   I({ type:"number", value:form.patient?.weight||"",
                  onChange:e => setNested("patient","weight",e.target.value) }))}
              {F("Height (cm)",   I({ type:"number", value:form.patient?.height||"",
                  onChange:e => setNested("patient","height",e.target.value) }))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {F("Ethnic Group",  S(["Hispanic or Latino","Not Hispanic or Latino","Unknown","Other"],
                  { value:form.patient?.ethnicity||"", onChange:e => setNested("patient","ethnicity",e.target.value) }))}
              {F("Race",          S(["White","Black or African American","Asian","American Indian or Alaska Native","Native Hawaiian or Pacific Islander","Other","Unknown"],
                  { value:form.patient?.race||"", onChange:e => setNested("patient","race",e.target.value) }))}
            </div>

            <SectionHead>Medical Status</SectionHead>
            {F("Past Medical History", TA({ placeholder:"Relevant past conditions, surgeries, allergies...",
                value:form.patient?.medHistory||"", onChange:e => setNested("patient","medHistory",e.target.value) }))}
            {F("Concomitant Medications", TA({ placeholder:"List all co-medications with doses...",
                value:form.patient?.concomitant||"", onChange:e => setNested("patient","concomitant",e.target.value) }))}

            <div className="grid grid-cols-2 gap-3">
              {F("Pregnant at time of event", S(["Yes","No","Unknown","N/A"],
                  { value:form.patient?.pregnant||"", onChange:e => setNested("patient","pregnant",e.target.value) }))}
              {form.patient?.pregnant === "Yes" && F("Last Menstrual Period",
                <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                  value={form.patient?.lmp||""} onChange={e => setNested("patient","lmp",e.target.value)} />
              )}
            </div>
            {F("Patient Notes", TA({ placeholder:"Additional notes about the patient...",
                value:form.patient?.notes||"", onChange:e => setNested("patient","notes",e.target.value) }))}
          
          <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end">
            <button onClick={() => saveTab({ patient: form.patient }, "Patient")}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save Patient
            </button>
          </div>
          </div>
        )}

        {/* OTHER RELEVANT HISTORY */}
        {tab === "history" && (() => {
          const history = (form.patient?.otherHistory && form.patient.otherHistory.length) ? form.patient.otherHistory : [{}];
          const setH = (idx, key, val) => {
            const arr = [...history];
            arr[idx] = { ...arr[idx], [key]:val };
            setForm(f => ({ ...f, patient:{ ...f.patient, otherHistory:arr } }));
          };
          return (
            <div>
              <SectionHead>Other Relevant History</SectionHead>
              <p className="text-xs text-gray-400 mb-3">Record prior medications, medical conditions, and family history relevant to this case.</p>
              {history.map((h, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Entry {i+1}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Condition Type", S(["Medical History Episode","Patient Other Relevant Therapy","Family History"],
                        { value:h.condType||"", onChange:e => setH(i,"condType",e.target.value) }))}
                    {F("Description / Coded PT", I({ placeholder:"e.g. Hypertension", value:h.description||"",
                        onChange:e => setH(i,"description",e.target.value) }))}
                    {F("Start Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={h.startDate||""} onChange={e => setH(i,"startDate",e.target.value)} />)}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Stop Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={h.stopDate||""} onChange={e => setH(i,"stopDate",e.target.value)} />)}
                    {F("Substance / Drug (if therapy)", I({ placeholder:"Drug name if applicable", value:h.substance||"",
                        onChange:e => setH(i,"substance",e.target.value) }))}
                    <div className="flex flex-col justify-end pb-3">
                      {C("Ongoing",        h.ongoing,       e => setH(i,"ongoing",e.target.checked))}
                      {C("Family History", h.familyHistory, e => setH(i,"familyHistory",e.target.checked))}
                    </div>
                  </div>
                  {F("Notes", I({ placeholder:"Additional notes...", value:h.notes||"", onChange:e => setH(i,"notes",e.target.value) }))}
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, patient:{ ...f.patient, otherHistory:[...(f.patient?.otherHistory||[{}]),{}] }}))}
                className="text-indigo-600 text-sm font-semibold hover:underline">+ Add Row</button>
              
          <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end">
            <button onClick={() => saveTab({ patient: form.patient }, "History")}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save History
            </button>
          </div>
            </div>
          );
        })()}

        {/* LAB DATA */}
        {tab === "lab" && (() => {
          const labs = (form.patient?.labData && form.patient.labData.length) ? form.patient.labData : [{}];
          const setL = (idx, key, val) => {
            const arr = [...labs];
            arr[idx] = { ...arr[idx], [key]:val };
            setForm(f => ({ ...f, patient:{ ...f.patient, labData:arr } }));
          };
          return (
            <div>
              <SectionHead>Lab Data – Tests & Results</SectionHead>
              <p className="text-xs text-gray-400 mb-3">Enter relevant laboratory test results for this case.</p>
              {labs.map((l, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Lab Test {i+1}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Test Name",    I({ placeholder:"e.g. ALT / SGPT", value:l.testName||"",  onChange:e => setL(i,"testName",e.target.value) }))}
                    {F("Test Date",    <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={l.testDate||""} onChange={e => setL(i,"testDate",e.target.value)} />)}
                    {F("Result",       I({ placeholder:"e.g. 125", value:l.result||"",            onChange:e => setL(i,"result",e.target.value) }))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Units",        I({ placeholder:"e.g. U/L", value:l.units||"",             onChange:e => setL(i,"units",e.target.value) }))}
                    {F("Normal Low",   I({ placeholder:"Lower normal",  value:l.normLow||"",      onChange:e => setL(i,"normLow",e.target.value) }))}
                    {F("Normal High",  I({ placeholder:"Upper normal",  value:l.normHigh||"",     onChange:e => setL(i,"normHigh",e.target.value) }))}
                  </div>
                  {F("Assessment",   S(["Normal","Abnormal","Abnormal – Clinically Significant","Unknown"],
                      { value:l.assessment||"", onChange:e => setL(i,"assessment",e.target.value) }))}
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, patient:{ ...f.patient, labData:[...(f.patient?.labData||[{}]),{}] }}))}
                className="text-indigo-600 text-sm font-semibold hover:underline">+ Add Lab Test</button>
              
          <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end">
            <button onClick={() => saveTab({ patient: form.patient }, "Lab Data")}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save Lab Data
            </button>
          </div>
            </div>
          );
        })()}

        {/* PRODUCTS */}
        {tab === "products" && (() => {
          const products = (form.products && form.products.length) ? form.products : [{}];
          const setP = (idx, key, val) => {
            const arr = [...products];
            arr[idx] = { ...arr[idx], [key]:val };
            setForm(f => ({ ...f, products:arr }));
          };
          return (
            <div>
              {products.map((p, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-gray-500 uppercase">Product {i+1}</span>
                    {F("Role", S(["Suspect","Concomitant","Treatment/Other"],
                        { value:p.role||"", onChange:e => setP(i,"role",e.target.value) }))}
                  </div>
                  <SectionHead>Product Identification</SectionHead>
                  <div className="grid grid-cols-2 gap-3">
                    {F("Trade / Brand Name",  I({ placeholder:"Brand name", value:p.name||"",         onChange:e => setP(i,"name",e.target.value) }))}
                    {F("Generic Name",        I({ placeholder:"INN/generic", value:p.genericName||"", onChange:e => setP(i,"genericName",e.target.value) }))}
                    {F("Batch / Lot Number",  I({ placeholder:"LOT-XXXXX",   value:p.batch||"",       onChange:e => setP(i,"batch",e.target.value) }))}
                    {F("Formulation",         S(["Tablet","Capsule","Solution","Suspension","Injection","Inhalation","Patch","Suppository","Cream","Other"],
                        { value:p.formulation||"", onChange:e => setP(i,"formulation",e.target.value) }))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {F("Market Authorization Holder", I({ value:p.mah||"", onChange:e => setP(i,"mah",e.target.value) }))}
                    {F("Authorization Number",        I({ value:p.authNumber||"", onChange:e => setP(i,"authNumber",e.target.value) }))}
                    {F("Drug Authorization Country",  S(["United States","United Kingdom","EU","Japan","Other"],
                        { value:p.authCountry||"", onChange:e => setP(i,"authCountry",e.target.value) }))}
                    {F("WHO Drug Code",               I({ placeholder:"Optional", value:p.drugCode||"", onChange:e => setP(i,"drugCode",e.target.value) }))}
                  </div>

                  <SectionHead>Dosage Regimen</SectionHead>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Dose",             I({ placeholder:"e.g. 10 mg", value:p.dose||"",     onChange:e => setP(i,"dose",e.target.value) }))}
                    {F("Dose Units",       S(["mg","g","mcg","ml","L","IU","%","Other"],
                        { value:p.doseUnit||"", onChange:e => setP(i,"doseUnit",e.target.value) }))}
                    {F("Frequency",        S(["Once daily","Twice daily","Three times daily","Weekly","Monthly","As needed","Other"],
                        { value:p.frequency||"", onChange:e => setP(i,"frequency",e.target.value) }))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Route of Administration", S(["Oral","Intravenous","Subcutaneous","Intramuscular","Topical","Inhalation","Intranasal","Rectal","Other"],
                        { value:p.route||"", onChange:e => setP(i,"route",e.target.value) }))}
                    {F("Start Date", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={p.startDate||""} onChange={e => setP(i,"startDate",e.target.value)} />)}
                    {F("Stop Date",  <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={p.stopDate||""}  onChange={e => setP(i,"stopDate",e.target.value)} />)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {F("Indication (as reported)", I({ value:p.indication||"", onChange:e => setP(i,"indication",e.target.value) }))}
                    {F("Action Taken",             S(["Withdrawn","Dose reduced","Dose increased","Dose not changed","Unknown","Not applicable"],
                        { value:p.actionTaken||"", onChange:e => setP(i,"actionTaken",e.target.value) }))}
                  </div>

                  <SectionHead>Challenge Information</SectionHead>
                  <div className="grid grid-cols-2 gap-3">
                    {F("Dechallenge Result", S(["Positive – Event abated on withdrawal","Negative – Event did not abate","Not done","Unknown","N/A"],
                        { value:p.dechallenge||"", onChange:e => setP(i,"dechallenge",e.target.value) }))}
                    {F("Rechallenge Result", S(["Positive – Event recurred","Negative – Event did not recur","Not done","Unknown","N/A"],
                        { value:p.rechallenge||"", onChange:e => setP(i,"rechallenge",e.target.value) }))}
                  </div>
                  <div className="flex gap-4 mt-1">
                    {C("Ongoing", p.ongoing, e => setP(i,"ongoing",e.target.checked))}
                    {C("Drug Interaction?", p.interaction, e => setP(i,"interaction",e.target.checked))}
                    {C("Contraindicated?", p.contraindicated, e => setP(i,"contraindicated",e.target.checked))}
                    {C("OTC Product", p.otc, e => setP(i,"otc",e.target.checked))}
                  </div>

                  <SectionHead>Quality Control</SectionHead>
                  <div className="grid grid-cols-3 gap-3">
                    {F("QC Safety Date",       <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={p.qcDate||""} onChange={e => setP(i,"qcDate",e.target.value)} />)}
                    {F("QC Cross Reference",   I({ placeholder:"QC Ref #", value:p.qcRef||"",    onChange:e => setP(i,"qcRef",e.target.value) }))}
                    {F("QC Result Date",       <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={p.qcResultDate||""} onChange={e => setP(i,"qcResultDate",e.target.value)} />)}
                  </div>
                  {F("QC Result Notes", TA({ placeholder:"Enter QC analysis result notes...", rows:2,
                      value:p.qcNotes||"", onChange:e => setP(i,"qcNotes",e.target.value) }))}
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, products:[...(f.products||[{}]),{}] }))}
                className="text-indigo-600 text-sm font-semibold hover:underline">+ Add Product</button>
              <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end">
                <button onClick={() => saveTab({ products: form.products }, "Products")}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
                  💾 Save Products
                </button>
              </div>
            </div>
          );
        })()}

        {/* EVENTS */}
        {tab === "events" && (() => {
          const events = (form.events && form.events.length) ? form.events : [{}];
          const setEv = (idx, key, val) => {
            const arr = [...events];
            arr[idx] = { ...arr[idx], [key]:val };
            setForm(f => ({ ...f, events:arr }));
          };
          return (
            <div>
              {events.map((e, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Event {i+1}</div>

                  <SectionHead>Event Description</SectionHead>
                  <div className="grid grid-cols-2 gap-3">
                    {F("Description as Reported (Verbatim)", I({ placeholder:"Exact words used by reporter",
                        value:e.term||"", onChange:ev => setEv(i,"term",ev.target.value) }), true)}
                    {F("Description to be Coded", I({ placeholder:"Modified/translated for coding",
                        value:e.descToCoded||e.term||"", onChange:ev => setEv(i,"descToCoded",ev.target.value) }))}
                  </div>
                  {F("Term Highlighted by Reporter", S(["Yes","No","Unknown"],
                      { value:e.highlighted||"", onChange:ev => setEv(i,"highlighted",ev.target.value) }),
                    false, "Was this event specifically emphasized by the reporter?")}

                  <SectionHead>Timing</SectionHead>
                  <div className="grid grid-cols-3 gap-3">
                    {F("Onset Date / Time", <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={e.onsetDate||""} onChange={ev => setEv(i,"onsetDate",ev.target.value)} />)}
                    {F("Stop Date / Time",  <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        value={e.stopDate||""}  onChange={ev => setEv(i,"stopDate",ev.target.value)} />)}
                    {F("Onset from Last Dose", I({ placeholder:"e.g. 2 days", value:e.onsetFromLastDose||"",
                        onChange:ev => setEv(i,"onsetFromLastDose",ev.target.value) }))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {F("Outcome", S(["Recovered / Resolved","Recovering / Resolving","Not recovered / Not resolved",
                          "Recovered with sequelae","Fatal","Unknown"],
                        { value:e.outcome||"", onChange:ev => setEv(i,"outcome",ev.target.value) }))}
                    {F("Nature of Event", S(["Congenital anomaly","Abuse","Accidental exposure","Overdose",
                          "Medication error","Off-label use","Misuse","Drug interaction","Unknown"],
                        { value:e.natureOfEvent||"", onChange:ev => setEv(i,"natureOfEvent",ev.target.value) }))}
                  </div>

                  <SectionHead>Seriousness at Event Level</SectionHead>
                  <div className="grid grid-cols-2 gap-1 bg-red-50 p-3 rounded-lg border border-red-100 mb-3">
                    {[["Death","death"],["Life-threatening","lifeThreatening"],["Hospitalised","hospitalised"],
                      ["Disability/Incapacity","disability"],["Congenital anomaly","congenital"],["Medically significant","medSignificant"]
                    ].map(([label, key]) =>
                      C(label, e.seriousness?.[key],
                        ev => {
                          const s = { ...(e.seriousness||{}), [key]:ev.target.checked };
                          setEv(i,"seriousness",s);
                        }, "red")
                    )}
                  </div>

                  {e.seriousness?.death && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-3">
                      <div className="text-xs font-bold text-gray-600 uppercase mb-2">Death Details</div>
                      <div className="grid grid-cols-2 gap-3">
                        {F("Date of Death",         <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                            value={e.deathDate||""} onChange={ev => setEv(i,"deathDate",ev.target.value)} />)}
                        {F("Autopsy Done?",          S(["Yes","No","Unknown"],
                            { value:e.autopsyDone||"", onChange:ev => setEv(i,"autopsyDone",ev.target.value) }))}
                        {e.autopsyDone === "Yes" &&
                          F("Autopsy Results Available?", S(["Yes","No"],
                              { value:e.autopsyResultsAvailable||"", onChange:ev => setEv(i,"autopsyResultsAvailable",ev.target.value) }))}
                        {F("Cause of Death as Reported", I({ value:e.causeOfDeath||"",
                            onChange:ev => setEv(i,"causeOfDeath",ev.target.value) }))}
                      </div>
                    </div>
                  )}

                  {e.seriousness?.hospitalised && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-3">
                      <div className="text-xs font-bold text-gray-600 uppercase mb-2">Hospitalisation Details</div>
                      <div className="grid grid-cols-3 gap-3">
                        {F("Hospital Name",        I({ value:e.hospitalName||"", onChange:ev => setEv(i,"hospitalName",ev.target.value) }))}
                        {F("Admission Date",       <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                            value={e.admissionDate||""} onChange={ev => setEv(i,"admissionDate",ev.target.value)} />)}
                        {F("Discharge Date",       <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                            value={e.dischargeDate||""} onChange={ev => setEv(i,"dischargeDate",ev.target.value)} />)}
                      </div>
                    </div>
                  )}

                  {F("Event Notes", TA({ placeholder:"Additional notes about this event...", rows:2,
                      value:e.notes||"", onChange:ev => setEv(i,"notes",ev.target.value) }))}
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, events:[...(f.events||[{}]),{}] }))}
                className="text-indigo-600 text-sm font-semibold hover:underline">+ Add Event</button>

              {/* ── Auto-Narrative ── */}
              <div className="mt-6 border-t border-gray-200 pt-5">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-bold text-teal-700 uppercase tracking-widest">
                    Case Narrative
                  </div>
                  <button onClick={generateNarrative}
                    className="text-xs bg-teal-100 hover:bg-teal-200 text-teal-800 px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1">
                    ⚡ Auto-generate Narrative
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  Auto-generate populates the narrative from the data entered above. You can freely edit it. Case ID is automatically included. Click <strong>Save Events &amp; Narrative</strong> below to persist.
                </p>
                <textarea
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 w-full resize-none"
                  rows={7}
                  placeholder="Enter or auto-generate the full case narrative. The Case ID will be included automatically..."
                  value={form.narrative || ""}
                  onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))}
                />
                <div className="mt-3 flex justify-end">
                  <button onClick={() => saveTab({ events: form.events, narrative: form.narrative }, "Events & Narrative")}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
                    💾 Save Events &amp; Narrative
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  /* ---- STEP 3: MEDICAL REVIEW ---- */
  const MedicalForm = () => {
    const m = form.medical || {};
    return (
      <div className="space-y-5">

        {/* Narrative status banner at top of Medical Review */}
        {form.narrative
          ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">
                  📄 Case Narrative — submitted by Data Entry
                </span>
                <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">✓ Present</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{form.narrative}</p>
              <p className="text-xs text-gray-400 mt-2">You can refine this narrative in the <strong>Full Case Narrative</strong> section below.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">⚠️ No Narrative Submitted</span>
              <p className="text-xs text-amber-700 mt-1">The Data Entry team has not yet submitted a case narrative. You may return the case to Data Entry using the routing button at the bottom.</p>
            </div>
          )
        }

        {/* MedDRA Coding */}
        <div>
          <SectionHead color="purple">MedDRA Coding (Events Tab)</SectionHead>
          <div className="relative mb-3">
            <input className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Search Preferred Term or LLT..."
              value={meddraQuery}
              onChange={e => searchMeddra(e.target.value)} />
            {meddraResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                {meddraResults.map(m2 => (
                  <div key={m2.pt} onClick={() => pickMeddra(m2)}
                    className="px-4 py-2 hover:bg-purple-50 cursor-pointer text-sm border-b last:border-0">
                    <div className="font-semibold">{m2.pt}</div>
                    <div className="text-xs text-gray-400 flex gap-4 mt-0.5">
                      <span>LLT: {m2.llt}</span>
                      <span>HLT: {m2.hlt}</span>
                      <span>SOC: {m2.soc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(form.events||[])[0]?.pt && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-purple-900">MedDRA Hierarchy</span>
                {IME_TERMS.includes((form.events)[0].pt) && (
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold text-xs">⚠️ IME TERM</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-purple-800">
                <span><b>LLT:</b> {(form.events)[0].llt}</span>
                <span><b>PT:</b>  {(form.events)[0].pt}</span>
                <span><b>HLT:</b> {(form.events)[0].hlt}</span>
                <span><b>SOC:</b> {(form.events)[0].soc}</span>
              </div>
            </div>
          )}
        </div>

        {/* Event Assessment */}
        <div>
          <SectionHead color="purple">Event Assessment</SectionHead>
          <div className="grid grid-cols-2 gap-3">
            {F("Listedness", S(["Listed","Unlisted","Unknown"],
                { value:m.listedness||"", onChange:e => setNested("medical","listedness",e.target.value) }))}
            {F("Diagnosis / Symptom", S([{v:"D",l:"D – Diagnosis"},{v:"S",l:"S – Symptom/Sign"}],
                { value:m.diagSymptom||"", onChange:e => setNested("medical","diagSymptom",e.target.value) }))}
            {F("Causality as Reported", S(["Related","Possibly Related","Unlikely Related","Not Related","Unknown"],
                { value:m.causalityReported||"", onChange:e => setNested("medical","causalityReported",e.target.value) }))}
            {F("Causality Method", S(["WHO-UMC","Naranjo","CIOMS","Other"],
                { value:m.causalityMethod||"", onChange:e => setNested("medical","causalityMethod",e.target.value) }))}
          </div>
        </div>

        {/* WHO-UMC */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <SectionHead color="yellow">WHO-UMC Causality Algorithm</SectionHead>
          <p className="text-xs text-gray-500 mb-3">Select criteria then click Run Algorithm to compute result.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {C("Temporal association (plausible time relationship)",      m.temporal,     e => setNested("medical","temporal",e.target.checked))}
            {C("Dechallenge – event abated on drug withdrawal",           m.dechallenge,  e => setNested("medical","dechallenge",e.target.checked))}
            {C("Rechallenge – event reappeared on reintroduction",        m.rechallenge,  e => setNested("medical","rechallenge",e.target.checked))}
            {C("Alternative cause can explain the reaction",              m.alternative,  e => setNested("medical","alternative",e.target.checked))}
            {C("Reaction known to the drug (listed in label)",            m.knownReaction,e => setNested("medical","knownReaction",e.target.checked))}
            {C("Reaction confirmed by objective evidence",                m.confirmed,    e => setNested("medical","confirmed",e.target.checked))}
          </div>
          <button onClick={runWHOUMC}
            className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-4 py-1.5 rounded-lg font-semibold">
            ⚙️ Run WHO-UMC Algorithm
          </button>
          {m.causality && (
            <span className="ml-3 bg-white border border-yellow-400 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
              Result: {m.causality}
            </span>
          )}
        </div>

        {/* Naranjo */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <SectionHead color="orange">Naranjo Algorithm</SectionHead>
          <p className="text-xs text-gray-500 mb-3">Check applicable criteria to calculate Naranjo score.</p>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {C("Previous conclusive reports on this reaction",     m.nar_previous,     e => setNested("medical","nar_previous",e.target.checked))}
            {C("ADE appeared after the suspect drug",              m.nar_reaction,     e => setNested("medical","nar_reaction",e.target.checked))}
            {C("Adverse reaction improved when drug was stopped",  m.nar_dechallenge,  e => setNested("medical","nar_dechallenge",e.target.checked))}
            {C("ADE reappeared when drug was readministered",      m.nar_rechallenge,  e => setNested("medical","nar_rechallenge",e.target.checked))}
            {C("Alternative causes that could cause the ADE",      m.nar_alternative,  e => setNested("medical","nar_alternative",e.target.checked))}
            {C("ADE reappeared when placebo was given",            m.nar_placebo,      e => setNested("medical","nar_placebo",e.target.checked))}
            {C("Drug detected in blood/other fluids in toxic range",m.nar_drug_level,  e => setNested("medical","nar_drug_level",e.target.checked))}
            {C("ADE more severe when dose increased",              m.nar_dose_related, e => setNested("medical","nar_dose_related",e.target.checked))}
            {C("Patient had similar reaction to same/related drug", m.nar_prior_exp,   e => setNested("medical","nar_prior_exp",e.target.checked))}
            {C("ADE confirmed by objective evidence",              m.nar_confirmed,    e => setNested("medical","nar_confirmed",e.target.checked))}
          </div>
          <button onClick={runNaranjo}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-1.5 rounded-lg font-semibold">
            ⚙️ Calculate Naranjo Score
          </button>
          {m.naranjScore !== undefined && (
            <span className="ml-3 bg-white border border-orange-400 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">
              Score: {m.naranjScore} → {m.naranjResult}
            </span>
          )}
        </div>

        {/* Case Analysis */}
        <div>
          <SectionHead color="purple">Case Analysis</SectionHead>
          <div className="grid grid-cols-2 gap-3">
            {F("Medical Comments", TA({ rows:2, value:m.comments||"", onChange:e => setNested("medical","comments",e.target.value) }))}
            {F("Evaluation in light of similar events", TA({ rows:2, value:m.similarEvents||"",
                onChange:e => setNested("medical","similarEvents",e.target.value) }))}
          </div>
          {F("Abbreviated Narrative", TA({ rows:2, value:m.abbreviatedNarrative||"",
              onChange:e => setNested("medical","abbreviatedNarrative",e.target.value) }))}
          <div className="mt-3 flex justify-end">
            <button onClick={() => saveTab({ medical: form.medical, events: form.events }, "Medical Review")}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save Medical Review
            </button>
          </div>
        </div>

        {/* Full Case Narrative — editable by medical reviewer, with its own save */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <SectionHead color="purple">Full Case Narrative</SectionHead>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Narrative submitted by Data Entry is shown below. You may refine it here. Use <strong>Save Narrative</strong> to persist your changes without advancing the case.
          </p>
          <textarea
            className="border border-purple-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-full resize-none bg-white"
            rows={8}
            placeholder="Narrative submitted by Data Entry will appear here. You may edit and save..."
            value={form.narrative || ""}
            onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))}
          />
          <div className="mt-2 flex justify-end mb-4">
            <button onClick={() => saveTab({ narrative: form.narrative, medical: form.medical }, "Narrative")}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
              💾 Save Narrative
            </button>
          </div>
          {F("Company Comment", TA({ rows:2, value:m.companyComment||"", onChange:e => setNested("medical","companyComment",e.target.value) }))}
        </div>

        {/* Route Back to Data Entry */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Routing</div>
          <p className="text-xs text-gray-500 mb-3">
            If additional information is needed from the data entry team, return the case below. Otherwise use the <strong>Submit →</strong> button above to advance to Quality Review.
          </p>
          <button onClick={returnCaseToDataEntry}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2">
            ↩️ Return Case to Data Entry
          </button>
        </div>
      </div>
    );
  };

  /* ---- STEP 4: QUALITY REVIEW ---- */
  const QualityForm = () => {
    const q = form.quality || {};
    const p = form.patient  || {};
    const d = (form.products||[{}])[0];
    const e = (form.events  ||[{}])[0];
    const g = form.general  || {};
    const m = form.medical  || {};

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
      <div className="space-y-4">
        {/* Case Summary Panel */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Case Summary</div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Case Number</span>    <span className="font-mono font-semibold">{selected.caseNumber}</span>
            <span className="text-gray-500">Patient</span>        <span>{p.age||"?"} y/o {p.sex||"?"}{p.weight?" · "+p.weight+" kg":""}</span>
            <span className="text-gray-500">Suspect Drug</span>   <span>{d?.name||"?"} {d?.dose?"("+d.dose+")":""}</span>
            <span className="text-gray-500">MedDRA PT</span>      <span>{e?.pt||e?.term||"Not coded"}</span>
            <span className="text-gray-500">SOC</span>            <span>{e?.soc||"?"}</span>
            <span className="text-gray-500">Serious</span>
            <span className={autoSerious()?"text-red-600 font-semibold":"text-green-600"}>
              {autoSerious() ? "🔴 Serious" : "🟢 Non-serious"}
            </span>
            <span className="text-gray-500">Causality</span>     <span>{m?.causality||"Not assessed"}</span>
            <span className="text-gray-500">Listedness</span>    <span>{m?.listedness||"Not assessed"}</span>
          </div>
          {form.narrative && (
            <div className="mt-3 bg-white border border-gray-200 rounded p-3 text-xs text-gray-700 leading-relaxed">
              <span className="font-semibold block mb-1">Narrative:</span>{form.narrative}
            </div>
          )}
        </div>

        {/* QC Completeness Checklist */}
        <div>
          <SectionHead color="orange">Quality Control Checklist</SectionHead>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1">
            {qcItems.map(([key, label]) =>
              C(label, q[key], e => setForm(f => ({ ...f, quality:{ ...f.quality, [key]:e.target.checked } })),
                q[key] ? "green" : "orange")
            )}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {qcItems.filter(([k])=>q[k]).length} / {qcItems.length} items completed
          </div>
        </div>

        {/* QC Comments */}
        {F("Quality Review Comments", TA({ rows:4, placeholder:"Enter QC review findings and comments...",
            value:q.comments||"", onChange:e => setForm(f => ({ ...f, quality:{ ...f.quality, comments:e.target.value } })) }))}

        {/* Final Decision */}
        <div>
          <SectionHead color="orange">Final Decision</SectionHead>
          <div className="flex gap-3 flex-wrap">
            {[["approved","✅ Approve Case","bg-green-500 hover:bg-green-600"],
              ["returned","↩️ Return to Medical","bg-orange-500 hover:bg-orange-600"],
            ].map(([val, label, cls]) => (
              <button key={val} onClick={() => setForm(f => ({ ...f, quality:{ ...f.quality, finalStatus:val } }))}
                className={`${cls} text-white px-5 py-2 rounded-lg text-sm font-semibold transition
                  ${q.finalStatus === val ? "ring-4 ring-offset-2 ring-gray-300" : ""}`}>
                {label}
              </button>
            ))}
          </div>
          {q.finalStatus && (
            <div className={`mt-3 text-xs font-bold px-3 py-2 rounded-lg inline-block
              ${q.finalStatus==="approved" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
              Decision: {q.finalStatus.toUpperCase()} · Reviewer: {user.username} · {new Date().toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ---- READ-ONLY SUMMARY ---- */
  const ReadOnlySummary = () => (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg font-medium">
        👁️ Read-only — this case is at <strong>{selected.status}</strong> (Step {selected.currentStep}).
        Your role: <strong>{user.role}</strong> (Step {user.step}).
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-2 text-gray-700">
        {[
          ["Status",    selected.status],
          ["Country",   form.triage?.country],
          ["Report Type", form.triage?.reportType || form.general?.reportType],
          ["Patient",   form.patient?.age ? form.patient.age+" y/o "+form.patient.sex : "Not entered"],
          ["Drug",      (form.products||[])[0]?.name || "Not entered"],
          ["Event (PT)", (form.events||[])[0]?.pt || (form.events||[])[0]?.term || "Not coded"],
          ["Serious",   form.general?.serious ? "Yes" : "No"],
          ["Causality", form.medical?.causality || "Pending"],
          ["Listedness",form.medical?.listedness || "Pending"],
        ].map(([k,v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-gray-400 w-28 flex-shrink-0 font-medium">{k}:</span>
            <span>{v||"—"}</span>
          </div>
        ))}
        {form.narrative && (
          <div className="mt-2 bg-white border border-gray-200 rounded p-3 text-xs">{form.narrative}</div>
        )}
      </div>
    </div>
  );

  /* ---- MODAL ROUTER ---- */
  const renderModalForm = () => {
    if (!selected) return null;
    const canEdit = isMyCase(selected);
    if (!canEdit) return ReadOnlySummary();
    if (selected.currentStep === 2) return DataEntryForm();
    if (selected.currentStep === 3) return MedicalForm();
    if (selected.currentStep === 4) return QualityForm();
    if (selected.currentStep === 5) return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700 font-semibold">
        ✅ This case has been approved and closed.
      </div>
    );
  };

  /* ====================================================
     MAIN RENDER
  ==================================================== */
  return (
    <div className="min-h-screen bg-sky-50 font-sans flex flex-col">

      {/* Topbar */}
      <div className="bg-blue-900 border-b border-blue-800 px-6 py-3 flex justify-between items-center shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-white">SkyVigilance SafetyDB Workflow</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold
            ${user.step===1?"bg-blue-200 text-blue-900":user.step===2?"bg-teal-200 text-teal-900":
              user.step===3?"bg-purple-200 text-purple-900":"bg-orange-200 text-orange-900"}`}>
            {user.role}
          </span>
          <span className="text-xs text-blue-200">{user.username}</span>
          <button onClick={() => setUser(null)} className="text-xs text-blue-300 hover:text-red-300 transition">Logout</button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`fixed top-16 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold
          ${msg.type==="error" ? "bg-red-100 text-red-700 border border-red-200" : "bg-green-100 text-green-700 border border-green-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full">

        {/* Dashboard */}
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

        {/* Triage book-in form */}
        {user.step === 1 && TriageForm()}

        {/* Kanban Board */}
        <div className="grid grid-cols-5 gap-4">
          {STAGES.map(stage => {
            const stageCases = cases.filter(c => c.currentStep === stage.step);
            return (
              <div key={stage.step}
                className={`rounded-xl p-4 border min-h-32
                  ${stage.step===user.step ? "bg-indigo-100 border-indigo-300" : "bg-white border-blue-100"}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className={`font-semibold text-xs uppercase tracking-wide
                    ${stage.step===user.step ? "text-indigo-700" : "text-gray-500"}`}>
                    {stage.name}
                  </h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {stageCases.length}
                  </span>
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
                    <div className="text-xs mt-0.5 truncate">
                      {c.triage?.country || "—"} · {(c.products||[])[0]?.name||"—"}
                    </div>
                    {isMyCase(c) && <div className="text-indigo-500 text-xs mt-0.5">▶ Your queue</div>}
                  </div>
                ))}
                {stageCases.length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-6">No cases</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Footer */}
      <footer className="bg-blue-900 border-t border-blue-800 py-3 text-center">
        <p className="text-xs text-blue-300">A VigiServe Foundation Initiative</p>
      </footer>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start pt-8 pb-8 z-40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[760px] shadow-2xl mx-4 flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <div className="font-bold text-gray-800 text-base">{selected.caseNumber}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Step {selected.currentStep} · {selected.status}
                  {selected.triage?.country ? " · " + selected.triage.country : ""}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button onClick={exportCIOMS}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
                  📄 CIOMS I
                </button>
                <button onClick={() => { setShowAudit(a => !a); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition
                    ${showAudit ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-amber-100 hover:bg-amber-200 text-amber-800"}`}>
                  📋 Audit Trail {auditLog.length > 0 ? `(${auditLog.length})` : ""}
                </button>
                {isMyCase(selected) && selected.currentStep < 5 && !showAudit && (
                  <button onClick={updateCase}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-1.5 rounded-lg font-semibold transition">
                    Submit →
                  </button>
                )}
                <button onClick={() => { setSelected(null); setShowAudit(false); setAuditLog([]); setMeddraQuery(""); setMeddraResults([]); }}
                  className="text-gray-400 hover:text-red-500 text-2xl leading-none transition ml-1">✕</button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {showAudit ? renderAuditTrail() : renderModalForm()}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
