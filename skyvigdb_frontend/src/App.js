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

/* ================= USERS ================= */

const USERS = [
  { username: "triage1", password: "train123", role: "Triage", step: 1 },
  { username: "dataentry1", password: "train123", role: "Data Entry", step: 2 },
  { username: "medical1", password: "train123", role: "Medical", step: 3 },
  { username: "quality1", password: "train123", role: "Quality", step: 4 }
];

/* ================= MEDDRA ================= */

const MEDDRA = [
  { pt: "Headache", soc: "Nervous system disorders" },
  { pt: "Nausea", soc: "Gastrointestinal disorders" },
  { pt: "Rash", soc: "Skin disorders" },
  { pt: "Fever", soc: "General disorders" },
  { pt: "Vomiting", soc: "Gastrointestinal disorders" },
  { pt: "Anaphylaxis", soc: "Immune disorders" }
];

const STAGES = [
  { name: "Triage", step: 1 },
  { name: "Data Entry", step: 2 },
  { name: "Medical", step: 3 },
  { name: "Quality", step: 4 },
  { name: "Approved", step: 5 }
];

/* ================= APP ================= */

export default function App() {

  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [login, setLogin] = useState({ username: "", password: "" });
  const [tab, setTab] = useState("general");
  const [meddraResults, setMeddraResults] = useState([]);

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const fetchCases = async () => {
    const res = await axios.get(API + "/cases");
    setCases(res.data || []);
  };

  /* ================= LOGIN ================= */

  const doLogin = () => {
    const found = USERS.find(
      u =>
        u.username === login.username &&
        u.password === login.password
    );

    if (found) setUser(found);
    else alert("Invalid credentials");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-200 to-purple-200">

        <div className="bg-white p-8 rounded-xl shadow w-80">

          <h2 className="text-xl font-bold mb-4 text-center">
            SkyVigilance Training
          </h2>

          <input
            placeholder="Username"
            className="border p-2 w-full mb-2"
            onChange={e =>
              setLogin({ ...login, username: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-2 w-full mb-3"
            onChange={e =>
              setLogin({ ...login, password: e.target.value })
            }
          />

          <button
            onClick={doLogin}
            className="bg-blue-600 text-white w-full p-2 rounded"
          >
            Login
          </button>

        </div>
      </div>
    );
  }

  /* ================= DASHBOARD ================= */

  const chartData = STAGES.map(s => ({
    name: s.name,
    value: cases.filter(c => c.currentStep === s.step).length
  }));

  /* ================= TRIAGE CREATE ================= */

  const createCase = async () => {

    const payload = {
      triage: form.triage || {},
      general: form.general || {},
      patient: form.patient || {},
      products: form.products || [],
      events: form.events || []
    };

    await axios.post(API + "/cases", payload);

    setForm({});
    fetchCases();
  };

  /* ================= UPDATE ================= */

  const updateCase = async () => {

    await axios.put(API + "/cases/" + selected.id, form);

    setSelected(null);
    setForm({});
    fetchCases();
  };

  /* ================= MEDDRA SEARCH ================= */

  const searchMeddra = (q) => {

    const res = MEDDRA.filter(m =>
      m.pt.toLowerCase().includes(q.toLowerCase())
    );

    setMeddraResults(res);
  };

  /* ================= NARRATIVE ================= */

  const generateNarrative = () => {

    const p = form.patient || {};
    const d = form.products?.[0] || {};
    const e = form.events?.[0] || {};

    const text = `A ${p.age || ""} year old ${p.sex || ""} received ${
      d.name || ""
    }. The patient developed ${e.term || ""}.`;

    setForm({ ...form, narrative: text });
  };

  /* ================= WHO UMC ================= */

  const runCausality = () => {

    const m = form.medical || {};

    let result = "Possible";

    if (m.temporal && m.dechallenge && !m.alternative)
      result = "Probable";

    if (m.rechallenge) result = "Certain";

    setForm({
      ...form,
      medical: { ...m, causality: result }
    });
  };

  /* ================= CIOMS EXPORT ================= */

  const exportCIOMS = () => {

    const doc = new jsPDF();

    doc.text("CIOMS I Report", 10, 10);
    doc.text("Case: " + selected.caseNumber, 10, 20);
    doc.text(form.narrative || "", 10, 30);

    doc.save("CIOMS.pdf");
  };

  const queue = cases.filter(c => c.currentStep === user.step);

  return (
    <div className="min-h-screen bg-gray-100 p-4">

      {/* HEADER */}

      <div className="flex justify-between mb-4">
        <div className="font-semibold">{user.role}</div>
        <button onClick={() => setUser(null)}>Logout</button>
      </div>

      {/* DASHBOARD */}

      <div style={{ width: 400, height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TRIAGE SCREEN */}

      {user.step === 1 && (

        <div className="bg-blue-50 p-4 rounded mb-4">

          <h3 className="font-semibold mb-2">New Case Intake</h3>

          <div className="grid grid-cols-2 gap-2">

            <input
              placeholder="Patient Initials"
              className="border p-2"
              onChange={e =>
                setForm({
                  ...form,
                  triage: {
                    ...form.triage,
                    patientInitials: e.target.value
                  }
                })
              }
            />

            <input
              placeholder="Country"
              className="border p-2"
              onChange={e =>
                setForm({
                  ...form,
                  triage: {
                    ...form.triage,
                    country: e.target.value
                  }
                })
              }
            />

            <input
              placeholder="Reporter Name"
              className="border p-2"
              onChange={e =>
                setForm({
                  ...form,
                  triage: {
                    ...form.triage,
                    reporter: e.target.value
                  }
                })
              }
            />

            <input
              placeholder="Drug Name"
              className="border p-2"
              onChange={e =>
                setForm({
                  ...form,
                  products: [{ name: e.target.value }]
                })
              }
            />

          </div>

          <textarea
            placeholder="Event Description"
            className="border p-2 w-full mt-2"
            onChange={e =>
              setForm({
                ...form,
                events: [{ term: e.target.value }]
              })
            }
          />

          <button
            onClick={createCase}
            className="bg-blue-600 text-white px-3 py-1 rounded mt-2"
          >
            Create Case
          </button>

        </div>
      )}

      {/* BOARD */}

      <div className="grid grid-cols-5 gap-4">

        {STAGES.map(stage => (

          <div key={stage.step} className="bg-white p-3 rounded shadow">

            <h4 className="font-semibold mb-2">{stage.name}</h4>

            {cases
              .filter(c => c.currentStep === stage.step)
              .map(c => (

                <div
                  key={c.id}
                  className="bg-indigo-50 p-2 rounded mb-2 cursor-pointer"
                  onClick={() => {
                    setSelected(c);
                    setForm(c);
                  }}
                >
                  {c.caseNumber}
                </div>

              ))}

          </div>

        ))}

      </div>

      {/* MODAL */}

      {selected && (

        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">

          <div className="bg-white p-6 rounded-xl w-[700px]">

            <div className="flex justify-between mb-3">

              <h3 className="font-semibold">
                Case {selected.caseNumber}
              </h3>

              <button
                onClick={() => setSelected(null)}
                className="text-red-600 text-xl"
              >
                ✕
              </button>

            </div>

            {/* TABS */}

            <div className="flex gap-2 flex-wrap mb-3">

              {[
                "general",
                "patient",
                "products",
                "events",
                "medical",
                "narrative",
                "quality",
                "attachments"
              ].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded ${
                    tab === t
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {t}
                </button>
              ))}

            </div>

            {/* EVENTS + SERIOUSNESS */}

            {tab === "events" && (

              <div>

                <input
                  placeholder="Event Term"
                  className="border p-2 w-full"
                  onChange={e => {

                    const term = e.target.value;

                    setForm({
                      ...form,
                      events: [{ term }]
                    });

                    searchMeddra(term);

                  }}
                />

                {meddraResults.map((m, i) => (
                  <div key={i} className="text-sm">
                    {m.pt} — {m.soc}
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2 mt-2">

                  {[
                    "Death",
                    "Life Threatening",
                    "Hospitalization",
                    "Disability",
                    "Congenital",
                    "Medically Important"
                  ].map(s => (

                    <label key={s}>

                      <input type="checkbox" /> {s}

                    </label>

                  ))}

                </div>

              </div>

            )}

            {/* PRODUCTS */}

            {tab === "products" && (

              <div>

                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      products:[...(form.products||[]),{}]
                    })
                  }
                  className="bg-blue-600 text-white px-2 py-1 rounded"
                >
                  Add Drug
                </button>

                {(form.products||[]).map((p,i)=>(

                  <div key={i} className="grid grid-cols-4 gap-2 mt-2">

                    <input
                      placeholder="Drug"
                      className="border p-1"
                      onChange={e=>{
                        const arr=[...form.products];
                        arr[i].name=e.target.value;
                        setForm({...form,products:arr});
                      }}
                    />

                    <input
                      placeholder="Dose"
                      className="border p-1"
                      onChange={e=>{
                        const arr=[...form.products];
                        arr[i].dose=e.target.value;
                        setForm({...form,products:arr});
                      }}
                    />

                    <input
                      placeholder="Route"
                      className="border p-1"
                    />

                    <input
                      type="date"
                      className="border p-1"
                    />

                  </div>

                ))}

              </div>

            )}

            {/* MEDICAL */}

            {tab === "medical" && (

              <div className="space-y-2">

                <label>
                  <input type="checkbox"
                    onChange={e =>
                      setForm({
                        ...form,
                        medical:{
                          ...form.medical,
                          temporal:e.target.checked
                        }
                      })
                    }
                  /> Temporal
                </label>

                <label>
                  <input type="checkbox"
                    onChange={e =>
                      setForm({
                        ...form,
                        medical:{
                          ...form.medical,
                          dechallenge:e.target.checked
                        }
                      })
                    }
                  /> Dechallenge
                </label>

                <button
                  onClick={runCausality}
                  className="bg-purple-600 text-white px-3 py-1 rounded"
                >
                  WHO-UMC
                </button>

                <div>
                  Result: {form.medical?.causality}
                </div>

              </div>

            )}

            {/* NARRATIVE */}

            {tab === "narrative" && (

              <div>

                <button
                  onClick={generateNarrative}
                  className="bg-purple-600 text-white px-3 py-1 rounded"
                >
                  Generate
                </button>

                <textarea
                  className="border w-full mt-2"
                  value={form.narrative || ""}
                  onChange={e =>
                    setForm({ ...form, narrative: e.target.value })
                  }
                />

              </div>

            )}

            {/* ATTACHMENTS */}

            {tab === "attachments" && (

              <div>

                <input
                  type="file"
                  onChange={e =>
                    setForm({
                      ...form,
                      attachments:[
                        ...(form.attachments||[]),
                        e.target.files[0].name
                      ]
                    })
                  }
                />

                {(form.attachments||[]).map((f,i)=>(
                  <div key={i}>{f}</div>
                ))}

              </div>

            )}

            {/* TIMELINE */}

            <div className="mt-4 text-sm">

              <div>Created → Triage</div>
              {selected.currentStep >= 2 && <div>Data Entry Complete</div>}
              {selected.currentStep >= 3 && <div>Medical Review</div>}
              {selected.currentStep >= 4 && <div>Quality Review</div>}
              {selected.currentStep >= 5 && <div>Approved</div>}

            </div>

            {/* ACTIONS */}

            <div className="flex justify-between mt-4">

              <button
                onClick={exportCIOMS}
                className="bg-indigo-600 text-white px-3 py-1 rounded"
              >
                CIOMS
              </button>

              <button
                onClick={updateCase}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Submit
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
