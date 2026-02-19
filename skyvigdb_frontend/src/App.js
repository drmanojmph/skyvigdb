import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const API =
  process.env.REACT_APP_API_URL ||
  "https://skyvigdb-backend.onrender.com/api";

/* ================= IME TERMS ================= */
const IME_TERMS = [
  "Anaphylaxis",
  "Stevens-Johnson syndrome",
  "Toxic epidermal necrolysis",
  "Agranulocytosis",
  "Seizure"
];

/* ================= USERS ================= */
const USERS = [
  { username: "triage1",     password: "train123", role: "Triage",     step: 1 },
  { username: "dataentry1",  password: "train123", role: "Data Entry",  step: 2 },
  { username: "medical1",    password: "train123", role: "Medical",     step: 3 },
  { username: "quality1",    password: "train123", role: "Quality",     step: 4 }
];

/* ================= MEDDRA SIM ================= */
const MEDDRA_DB = [
  { pt: "Headache",     soc: "Nervous system disorders"       },
  { pt: "Nausea",       soc: "Gastrointestinal disorders"     },
  { pt: "Rash",         soc: "Skin and subcutaneous tissue disorders" },
  { pt: "Fever",        soc: "General disorders"              },
  { pt: "Vomiting",     soc: "Gastrointestinal disorders"     },
  { pt: "Anaphylaxis",  soc: "Immune system disorders"        },
  { pt: "Dizziness",    soc: "Nervous system disorders"       },
  { pt: "Dyspnoea",     soc: "Respiratory disorders"          },
  { pt: "Pruritus",     soc: "Skin and subcutaneous tissue disorders" },
  { pt: "Fatigue",      soc: "General disorders"              }
];

const STAGES = [
  { name: "Triage",     step: 1 },
  { name: "Data Entry", step: 2 },
  { name: "Medical",    step: 3 },
  { name: "Quality",    step: 4 },
  { name: "Approved",   step: 5 }
];

/* ================= HELPERS ================= */
const field = (label, el) => (
  <div className="flex flex-col gap-1 mb-3">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
    {el}
  </div>
);

const inp = (props) => (
  <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" {...props} />
);

const sel = (options, props) => (
  <select className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" {...props}>
    <option value="">— Select —</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const chk = (label, checked, onChange) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <input type="checkbox" checked={!!checked} onChange={onChange} className="w-4 h-4 accent-indigo-600" />
    {label}
  </label>
);

/* ================= APP ================= */
export default function App() {

  const [user,         setUser]         = useState(null);
  const [cases,        setCases]        = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [form,         setForm]         = useState({});
  const [login,        setLogin]        = useState({ username: "", password: "" });
  const [tab,          setTab]          = useState("general");
  const [meddraQuery,  setMeddraQuery]  = useState("");
  const [meddraResults,setMeddraResults]= useState([]);
  const [msg,          setMsg]          = useState("");

  useEffect(() => { if (user) fetchCases(); }, [user]);

  const fetchCases = async () => {
    try {
      const res = await axios.get(API + "/cases");
      setCases(res.data || []);
    } catch {
      flash("Could not load cases — check backend connection.", "error");
    }
  };

  const flash = (text, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(""), 3500);
  };

  /* -------- LOGIN -------- */
  const doLogin = () => {
    const found = USERS.find(u => u.username === login.username && u.password === login.password);
    if (found) { setUser(found); setLogin({ username: "", password: "" }); }
    else alert("Invalid credentials");
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-200">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-80">
        <div className="text-center mb-6">
          <div className="text-3xl mb-1">🛡️</div>
          <h2 className="text-xl font-bold text-gray-800">SkyVigilance</h2>
          <p className="text-xs text-gray-400 mt-1">PV Training Platform</p>
        </div>
        <input
          placeholder="Username"
          className="border border-gray-300 rounded px-3 py-2 w-full mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={login.username}
          onChange={e => setLogin({ ...login, username: e.target.value })}
          onKeyDown={e => e.key === "Enter" && doLogin()}
        />
        <input
          type="password"
          placeholder="Password"
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={login.password}
          onChange={e => setLogin({ ...login, password: e.target.value })}
          onKeyDown={e => e.key === "Enter" && doLogin()}
        />
        <button
          onClick={doLogin}
          className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-2 rounded-lg font-semibold transition"
        >
          Login
        </button>
        <div className="mt-4 text-xs text-gray-400 text-center">
          All passwords: <code>train123</code>
        </div>
      </div>
    </div>
  );

  /* -------- HELPERS -------- */
  const setNested = (section, key, value) =>
    setForm(f => ({ ...f, [section]: { ...(f[section] || {}), [key]: value } }));

  const isMyCase = (c) => c.currentStep === user.step;

  /* -------- DUPLICATE CHECK -------- */
  const detectDuplicate = () => {
    const triage  = form.triage   || {};
    const drug    = (form.products || [])[0]?.name  || "";
    const event   = (form.events   || [])[0]?.term  || "";
    const dup = cases.find(c =>
      c.triage?.patientInitials === triage.patientInitials &&
      (c.products || [])[0]?.name === drug &&
      (c.events   || [])[0]?.term === event
    );
    if (dup) { alert("⚠️ Possible duplicate: " + dup.caseNumber); return true; }
    return false;
  };

  /* -------- CREATE (Triage) -------- */
  const createCase = async () => {
    if (detectDuplicate()) return;
    try {
      await axios.post(API + "/cases", {
        triage:   form.triage   || {},
        general:  form.general  || {},
        patient:  form.patient  || {},
        products: form.products || [],
        events:   form.events   || []
      });
      setForm({});
      fetchCases();
      flash("✅ Case created successfully.");
    } catch { flash("❌ Could not create case.", "error"); }
  };

  /* -------- UPDATE (role-gated) -------- */
  const updateCase = async () => {
    // Access control: only allow if it's the user's step
    if (!isMyCase(selected)) {
      alert("⛔ You can only submit cases assigned to your role step.");
      return;
    }
    try {
      await axios.put(API + "/cases/" + selected.id, form);
      setSelected(null);
      setForm({});
      fetchCases();
      flash("✅ Case updated successfully.");
    } catch { flash("❌ Update failed.", "error"); }
  };

  /* -------- MEDDRA SEARCH -------- */
  const searchMeddra = (q) => {
    setMeddraQuery(q);
    setMeddraResults(q.length > 1 ? MEDDRA_DB.filter(m => m.pt.toLowerCase().includes(q.toLowerCase())) : []);
  };

  const pickMeddra = (m) => {
    const events = [...(form.events || [{}])];
    events[0] = { ...events[0], pt: m.pt, soc: m.soc, term: m.pt };
    setForm(f => ({ ...f, events }));
    setMeddraQuery(m.pt);
    setMeddraResults([]);
  };

  /* -------- AUTO SERIOUS CHECK -------- */
  const autoSerious = () => {
    const term      = (form.events || [])[0]?.pt || "";
    const seriousnessObj = form.general?.seriousness || {};
    const imeMatch  = IME_TERMS.some(t => t.toLowerCase() === term.toLowerCase());
    const chkSer    = Object.values(seriousnessObj).some(v => v === true);
    return imeMatch || chkSer;
  };

  /* -------- WHO-UMC CAUSALITY -------- */
  const runWHOUMC = () => {
    const m = form.medical || {};
    let result = "Unassessable";
    if (m.rechallenge)                            result = "Certain";
    else if (m.temporal && m.dechallenge && !m.alternative) result = "Probable";
    else if (m.temporal && !m.alternative)        result = "Possible";
    else if (m.temporal)                          result = "Unlikely";
    setForm(f => ({ ...f, medical: { ...m, causality: result } }));
  };

  /* -------- NARRATIVE GENERATION -------- */
  const generateNarrative = () => {
    const p = form.patient  || {};
    const d = (form.products || [{}])[0];
    const e = (form.events   || [{}])[0];
    const g = form.general   || {};
    const text =
      `A ${p.age || "[age]"}-year-old ${p.sex || "[sex]"} with a history of ${p.medHistory || "no relevant history"} ` +
      `received ${d.name || "[drug]"} ${d.dose || ""} ${d.route || ""}. ` +
      `On ${e.onsetDate || "[onset date]"}, the patient developed ${e.pt || e.term || "[event]"}. ` +
      `The event was ${g.serious ? "serious" : "non-serious"}. ` +
      `${m => m.causality ? "Causality assessed as " + m.causality + "." : ""}`.replace(/\[object Object\].*$/, "").trim() +
      ` The case is reported by a ${form.triage?.qualification || "reporter"} from ${form.triage?.country || "[country]"}.`;
    setForm(f => ({ ...f, narrative: text }));
  };

  /* -------- CIOMS PDF -------- */
  const exportCIOMS = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("CIOMS I - Individual Case Safety Report", 10, 15);
    doc.setFontSize(10);
    doc.text(`Case Number: ${selected.caseNumber}`, 10, 28);
    doc.text(`Status: ${selected.status}`, 10, 35);
    doc.text(`Patient: ${form.patient?.age || "?"} y/o ${form.patient?.sex || "?"}`, 10, 42);
    doc.text(`Suspect Drug: ${(form.products || [{}])[0]?.name || "?"}`, 10, 49);
    doc.text(`Event (PT): ${(form.events || [{}])[0]?.pt || (form.events || [{}])[0]?.term || "?"}`, 10, 56);
    doc.text(`Serious: ${form.general?.serious ? "Yes" : "No"}`, 10, 63);
    doc.text(`Causality: ${form.medical?.causality || "?"}`, 10, 70);
    doc.setFontSize(9);
    const narrative = doc.splitTextToSize(form.narrative || "No narrative generated.", 185);
    doc.text("Narrative:", 10, 80);
    doc.text(narrative, 10, 87);
    doc.save(`CIOMS_${selected.caseNumber}.pdf`);
  };

  /* -------- DASHBOARD -------- */
  const chartData = STAGES.map(s => ({
    name: s.name,
    value: cases.filter(c => c.currentStep === s.step).length
  }));

  /* ======================================================
     STEP FORMS
  ====================================================== */

  /* ---- TRIAGE FORM (Step 1) ---- */
  const TriageForm = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
      <h3 className="font-bold text-blue-800 mb-4 text-sm uppercase tracking-widest">New Case Intake</h3>
      <div className="grid grid-cols-2 gap-3">
        {field("Receipt Date",
          <input type="date" className="border border-gray-300 rounded px-3 py-2 text-sm"
            onChange={e => setNested("triage", "receiptDate", e.target.value)} />
        )}
        {field("Country",
          inp({ placeholder: "e.g. United States", onChange: e => setNested("triage", "country", e.target.value) })
        )}
        {field("Patient Initials",
          inp({ placeholder: "e.g. J.D.", onChange: e => setNested("triage", "patientInitials", e.target.value) })
        )}
        {field("Reporter Name",
          inp({ placeholder: "Reporter full name", onChange: e => setNested("triage", "reporter", e.target.value) })
        )}
        {field("Reporter Qualification",
          sel(["Physician", "Pharmacist", "Nurse", "Consumer", "Lawyer", "Other HCP"],
            { onChange: e => setNested("triage", "qualification", e.target.value) })
        )}
        {field("Suspect Drug",
          inp({ placeholder: "Drug name", onChange: e => setForm(f => ({ ...f, products: [{ name: e.target.value }] })) })
        )}
      </div>
      {field("Event Description",
        <textarea
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full h-20 resize-none"
          placeholder="Describe the adverse event..."
          onChange={e => setForm(f => ({ ...f, events: [{ term: e.target.value }] }))}
        />
      )}
      <button onClick={createCase}
        className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition">
        + Create Case
      </button>
    </div>
  );

  /* ---- DATA ENTRY FORM (Step 2) ---- */
  const DataEntryForm = () => {
    const tabs = ["general", "patient", "products", "events"];
    return (
      <div>
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {tabs.map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded-t border-b-2 transition
                ${tab === t ? "border-indigo-600 text-indigo-600 bg-indigo-50" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="grid grid-cols-2 gap-3">
            {field("Source Type",
              sel(["Spontaneous", "Literature", "Clinical Study", "Regulatory"],
                { value: form.general?.sourceType || "",
                  onChange: e => setNested("general", "sourceType", e.target.value) })
            )}
            {field("Report Type",
              sel(["Initial", "Follow-up", "Final"],
                { value: form.general?.reportType || "",
                  onChange: e => setNested("general", "reportType", e.target.value) })
            )}
            <div className="col-span-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Seriousness Criteria</div>
              <div className="grid grid-cols-2 gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                {[
                  ["Death", "death"],
                  ["Life-threatening", "lifeThreatening"],
                  ["Hospitalisation", "hospitalisation"],
                  ["Disability", "disability"],
                  ["Congenital anomaly", "congenital"],
                  ["Medically significant", "medSignificant"]
                ].map(([label, key]) =>
                  chk(label,
                    form.general?.seriousness?.[key],
                    e => setForm(f => ({
                      ...f,
                      general: {
                        ...f.general,
                        seriousness: { ...(f.general?.seriousness || {}), [key]: e.target.checked },
                        serious: e.target.checked || Object.values(f.general?.seriousness || {}).some(v => v)
                      }
                    }))
                  )
                )}
              </div>
              {autoSerious() && (
                <div className="mt-2 bg-red-100 border border-red-300 text-red-700 text-xs px-3 py-2 rounded-lg font-semibold">
                  ⚠️ IME term detected — case must be classified as SERIOUS
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "patient" && (
          <div className="grid grid-cols-2 gap-3">
            {field("Age",
              inp({ type: "number", placeholder: "Years", value: form.patient?.age || "",
                onChange: e => setNested("patient", "age", e.target.value) })
            )}
            {field("Sex",
              sel(["Male", "Female", "Unknown"],
                { value: form.patient?.sex || "",
                  onChange: e => setNested("patient", "sex", e.target.value) })
            )}
            {field("Weight (kg)",
              inp({ type: "number", placeholder: "kg", value: form.patient?.weight || "",
                onChange: e => setNested("patient", "weight", e.target.value) })
            )}
            {field("Ethnicity",
              inp({ placeholder: "Optional", value: form.patient?.ethnicity || "",
                onChange: e => setNested("patient", "ethnicity", e.target.value) })
            )}
            {field("Medical History",
              <textarea className="border border-gray-300 rounded px-3 py-2 text-sm w-full h-20 resize-none"
                placeholder="Relevant past medical history..."
                value={form.patient?.medHistory || ""}
                onChange={e => setNested("patient", "medHistory", e.target.value)} />
            )}
            {field("Concomitant Medications",
              <textarea className="border border-gray-300 rounded px-3 py-2 text-sm w-full h-20 resize-none"
                placeholder="List co-medications..."
                value={form.patient?.concomitant || ""}
                onChange={e => setNested("patient", "concomitant", e.target.value)} />
            )}
          </div>
        )}

        {tab === "products" && (() => {
          const products = form.products?.length ? form.products : [{}];
          const setProduct = (idx, key, val) => {
            const arr = [...products];
            arr[idx] = { ...arr[idx], [key]: val };
            setForm(f => ({ ...f, products: arr }));
          };
          return (
            <div>
              {products.map((p, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-3">Product {i + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {field("Drug Name",      inp({ placeholder: "Generic or brand", value: p.name    || "", onChange: e => setProduct(i, "name",    e.target.value) }))}
                    {field("Batch / Lot No", inp({ placeholder: "LOT-XXXXX",        value: p.batch   || "", onChange: e => setProduct(i, "batch",   e.target.value) }))}
                    {field("Dose",           inp({ placeholder: "e.g. 10 mg",       value: p.dose    || "", onChange: e => setProduct(i, "dose",    e.target.value) }))}
                    {field("Route",          sel(["Oral", "Intravenous", "Subcutaneous", "Intramuscular", "Topical", "Inhalation"],
                                               { value: p.route   || "", onChange: e => setProduct(i, "route",   e.target.value) }))}
                    {field("Indication",     inp({ placeholder: "Why prescribed",   value: p.indication || "", onChange: e => setProduct(i, "indication", e.target.value) }))}
                    {field("Role",           sel(["Suspect", "Concomitant", "Interacting"],
                                               { value: p.role    || "", onChange: e => setProduct(i, "role",    e.target.value) }))}
                    {field("Start Date",     <input type="date" className="border border-gray-300 rounded px-3 py-2 text-sm" value={p.startDate || ""} onChange={e => setProduct(i, "startDate", e.target.value)} />)}
                    {field("Stop Date",      <input type="date" className="border border-gray-300 rounded px-3 py-2 text-sm" value={p.stopDate  || ""} onChange={e => setProduct(i, "stopDate",  e.target.value)} />)}
                  </div>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, products: [...(f.products || [{}]), {}] }))}
                className="text-indigo-600 text-sm font-semibold hover:underline">+ Add another product</button>
            </div>
          );
        })()}

        {tab === "events" && (() => {
          const events = form.events?.length ? form.events : [{}];
          const setEvent = (idx, key, val) => {
            const arr = [...events];
            arr[idx] = { ...arr[idx], [key]: val };
            setForm(f => ({ ...f, events: arr }));
          };
          return (
            <div>
              {events.map((e, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-3">Event {i + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {field("Verbatim Term",
                      <input className="border border-gray-300 rounded px-3 py-2 text-sm w-full" placeholder="As reported by sender"
                        value={e.term || ""} onChange={ev => setEvent(i, "term", ev.target.value)} />
                    )}
                    {field("Onset Date",
                      <input type="date" className="border border-gray-300 rounded px-3 py-2 text-sm"
                        value={e.onsetDate || ""} onChange={ev => setEvent(i, "onsetDate", ev.target.value)} />
                    )}
                    {field("Outcome",
                      sel(["Recovered", "Recovering", "Not recovered", "Recovered with sequelae", "Fatal", "Unknown"],
                        { value: e.outcome || "", onChange: ev => setEvent(i, "outcome", ev.target.value) })
                    )}
                  </div>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, events: [...(f.events || [{}]), {}] }))}
                className="text-indigo-600 text-sm font-semibold hover:underline">+ Add another event</button>
            </div>
          );
        })()}
      </div>
    );
  };

  /* ---- MEDICAL FORM (Step 3) ---- */
  const MedicalForm = () => {
    const m = form.medical || {};
    return (
      <div className="space-y-5">

        {/* MedDRA coding */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">MedDRA PT Coding</div>
          <div className="relative">
            <input
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Search Preferred Term..."
              value={meddraQuery}
              onChange={e => searchMeddra(e.target.value)}
            />
            {meddraResults.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {meddraResults.map(m => (
                  <div key={m.pt} onClick={() => pickMeddra(m)}
                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex justify-between items-center">
                    <span className="font-medium">{m.pt}</span>
                    <span className="text-xs text-gray-400">{m.soc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(form.events || [])[0]?.pt && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
              ✅ Coded PT: <strong>{(form.events)[0].pt}</strong> → SOC: {(form.events)[0].soc}
              {IME_TERMS.includes((form.events)[0].pt) && (
                <span className="ml-2 bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">IME</span>
              )}
            </div>
          )}
        </div>

        {/* WHO-UMC Causality */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-3">WHO-UMC Causality Assessment</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {chk("Temporal association", m.temporal,   e => setNested("medical", "temporal",    e.target.checked))}
            {chk("Dechallenge positive", m.dechallenge, e => setNested("medical", "dechallenge", e.target.checked))}
            {chk("Rechallenge positive", m.rechallenge, e => setNested("medical", "rechallenge", e.target.checked))}
            {chk("Alternative cause",   m.alternative, e => setNested("medical", "alternative", e.target.checked))}
          </div>
          <button onClick={runWHOUMC}
            className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-4 py-1.5 rounded-lg font-semibold transition">
            Run Algorithm
          </button>
          {m.causality && (
            <div className="mt-2 inline-block ml-3 bg-white border border-yellow-400 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
              Result: {m.causality}
            </div>
          )}
        </div>

        {/* Additional medical fields */}
        <div className="grid grid-cols-2 gap-3">
          {field("Listedness",
            sel(["Listed", "Unlisted", "Unknown"],
              { value: m.listedness || "", onChange: e => setNested("medical", "listedness", e.target.value) })
          )}
          {field("Comments",
            <textarea className="border border-gray-300 rounded px-3 py-2 text-sm w-full h-16 resize-none"
              value={m.comments || ""}
              onChange={e => setNested("medical", "comments", e.target.value)} />
          )}
        </div>

        {/* Narrative */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Case Narrative</div>
            <button onClick={generateNarrative}
              className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded-lg font-semibold transition">
              ⚡ Auto-generate
            </button>
          </div>
          <textarea
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full h-28 resize-none"
            placeholder="Write or auto-generate the case narrative..."
            value={form.narrative || ""}
            onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))}
          />
        </div>
      </div>
    );
  };

  /* ---- QUALITY FORM (Step 4) ---- */
  const QualityForm = () => {
    const q = form.quality || {};
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Case Summary</div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Patient</span>
            <span>{form.patient?.age || "?"} y/o {form.patient?.sex || "?"}</span>
            <span className="text-gray-500">Drug</span>
            <span>{(form.products || [{}])[0]?.name || "?"}</span>
            <span className="text-gray-500">PT</span>
            <span>{(form.events || [{}])[0]?.pt || (form.events || [{}])[0]?.term || "?"}</span>
            <span className="text-gray-500">Serious</span>
            <span>{form.general?.serious ? "🔴 Yes" : "🟢 No"}</span>
            <span className="text-gray-500">Causality</span>
            <span>{form.medical?.causality || "Not assessed"}</span>
          </div>
        </div>

        {field("Quality Review Comments",
          <textarea className="border border-gray-300 rounded px-3 py-2 text-sm w-full h-24 resize-none"
            placeholder="Enter your QC review comments..."
            value={q.comments || ""}
            onChange={e => setForm(f => ({ ...f, quality: { ...f.quality, comments: e.target.value } }))} />
        )}

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Final Decision</div>
          <div className="flex gap-3">
            {[["approved", "✅ Approve", "bg-green-500 hover:bg-green-600"],
              ["returned", "↩️ Return to Medical", "bg-orange-500 hover:bg-orange-600"]
            ].map(([val, label, cls]) => (
              <button key={val} onClick={() => setForm(f => ({ ...f, quality: { ...f.quality, finalStatus: val } }))}
                className={`${cls} text-white px-4 py-2 rounded-lg text-sm font-semibold transition
                  ${q.finalStatus === val ? "ring-4 ring-offset-1 ring-gray-400" : ""}`}>
                {label}
              </button>
            ))}
          </div>
          {q.finalStatus && (
            <div className={`mt-3 text-xs font-bold px-3 py-2 rounded-lg inline-block
              ${q.finalStatus === "approved" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              Decision set: {q.finalStatus.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ---- READ ONLY SUMMARY ---- */
  const ReadOnlySummary = () => (
    <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2 text-gray-700">
      <div className="font-semibold text-gray-500 text-xs uppercase tracking-wide mb-2">Case Details (Read Only)</div>
      <div><strong>Status:</strong> {selected.status}</div>
      <div><strong>Patient:</strong> {form.patient?.age || "?"} y/o {form.patient?.sex || "?"}</div>
      <div><strong>Drug:</strong> {(form.products || [{}])[0]?.name || "?"}</div>
      <div><strong>Event:</strong> {(form.events || [{}])[0]?.pt || (form.events || [{}])[0]?.term || "?"}</div>
      <div><strong>Serious:</strong> {form.general?.serious ? "Yes" : "No"}</div>
      <div><strong>Causality:</strong> {form.medical?.causality || "Pending"}</div>
      {form.narrative && <div className="mt-2 bg-white border border-gray-200 rounded p-3 text-xs">{form.narrative}</div>}
    </div>
  );

  /* ================= MODAL CONTENT ================= */
  const renderModalForm = () => {
    if (!selected) return null;
    const canEdit = isMyCase(selected);
    return (
      <div>
        {!canEdit && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg mb-3 font-medium">
            👁️ View only — this case is at step {selected.currentStep} ({selected.status}).
            Your role handles step {user.step} ({user.role}).
          </div>
        )}
        {!canEdit && <ReadOnlySummary />}
        {canEdit && selected.currentStep === 2 && <DataEntryForm />}
        {canEdit && selected.currentStep === 3 && <MedicalForm />}
        {canEdit && selected.currentStep === 4 && <QualityForm />}
        {canEdit && selected.currentStep === 5 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 font-semibold">
            ✅ Case approved and closed.
          </div>
        )}
      </div>
    );
  };

  /* ================= MAIN RENDER ================= */
  return (
    <div className="min-h-screen bg-gray-100 font-sans">

      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-gray-800">SkyVigilance Training</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
              ${user.step === 1 ? "bg-blue-100 text-blue-700" :
                user.step === 2 ? "bg-teal-100 text-teal-700" :
                user.step === 3 ? "bg-purple-100 text-purple-700" :
                "bg-orange-100 text-orange-700"}`}>
              {user.role}
            </span>
            {" "}<span className="text-gray-500 text-xs">({user.username})</span>
          </span>
          <button onClick={() => setUser(null)}
            className="text-xs text-gray-400 hover:text-red-500 transition">Logout</button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold transition
          ${msg.type === "error" ? "bg-red-100 text-red-700 border border-red-200" : "bg-green-100 text-green-700 border border-green-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Dashboard Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Workflow Dashboard</h3>
          <div style={{ height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Triage intake form */}
        {user.step === 1 && <TriageForm />}

        {/* Kanban board */}
        <div className="grid grid-cols-5 gap-4">
          {STAGES.map(stage => {
            const stageCases = cases.filter(c => c.currentStep === stage.step);
            return (
              <div key={stage.step}
                className={`rounded-xl p-4 border
                  ${stage.step === user.step
                    ? "bg-indigo-50 border-indigo-200"
                    : "bg-white border-gray-200"}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-gray-600">{stage.name}</h4>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    {stageCases.length}
                  </span>
                </div>
                {stageCases.map(c => (
                  <div key={c.id}
                    onClick={() => { setSelected(c); setForm(c); setTab("general"); setMeddraQuery(""); setMeddraResults([]); }}
                    className={`p-2 rounded-lg mb-2 cursor-pointer border text-xs font-mono transition
                      ${isMyCase(c)
                        ? "bg-indigo-100 border-indigo-300 hover:bg-indigo-200 text-indigo-800"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-500"}`}>
                    <div className="font-semibold">{c.caseNumber}</div>
                    {isMyCase(c) && (
                      <div className="text-indigo-500 text-xs mt-0.5">▶ Your queue</div>
                    )}
                  </div>
                ))}
                {stageCases.length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-4">No cases</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-start pt-10 pb-10 z-40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[720px] shadow-2xl flex flex-col mx-4">

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <div className="font-bold text-gray-800">{selected.caseNumber}</div>
                <div className="text-xs text-gray-400 mt-0.5">Step {selected.currentStep} · {selected.status}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCIOMS}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
                  📄 CIOMS PDF
                </button>
                {isMyCase(selected) && selected.currentStep < 5 && (
                  <button onClick={updateCase}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-1.5 rounded-lg font-semibold transition">
                    Submit →
                  </button>
                )}
                <button onClick={() => { setSelected(null); setMeddraQuery(""); setMeddraResults([]); }}
                  className="text-gray-400 hover:text-red-500 text-xl leading-none ml-1 transition">✕</button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {renderModalForm()}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
