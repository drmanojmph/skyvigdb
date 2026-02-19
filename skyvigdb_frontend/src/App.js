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

/* ================= MEDDRA SIM ================= */

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

  /* ================= CIOMS EXPORT ================= */

  const exportCIOMS = () => {

    const doc = new jsPDF();

    doc.text("CIOMS I Report", 10, 10);
    doc.text("Case: " + selected.caseNumber, 10, 20);
    doc.text(form.narrative || "", 10, 30);

    doc.save("CIOMS.pdf");
  };

  /* ================= BOARD ================= */

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

          <input
            type="date"
            className="border p-2 mr-2"
            onChange={e =>
              setForm({
                ...form,
                triage: { receiptDate: e.target.value }
              })
            }
          />

          <button
            onClick={createCase}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            Create Case
          </button>

        </div>
      )}

      {/* WORKFLOW BOARD */}

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

      {/* CASE MODAL */}

      {selected && (

        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">

          <div className="bg-white p-6 rounded-xl w-[600px]">

            <h3 className="font-semibold mb-3">
              Case {selected.caseNumber}
            </h3>

            {/* TABS */}

            <div className="flex gap-2 mb-3 flex-wrap">

              {[
                "general",
                "patient",
                "products",
                "events",
                "medical",
                "narrative",
                "quality"
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

            {/* GENERAL */}

            {tab === "general" && (
              <input
                placeholder="Report Type"
                className="border p-2 w-full"
                onChange={e =>
                  setForm({
                    ...form,
                    general: { reportType: e.target.value }
                  })
                }
              />
            )}

            {/* PATIENT */}

            {tab === "patient" && (
              <div className="grid grid-cols-2 gap-2">

                <input
                  placeholder="Age"
                  className="border p-2"
                  onChange={e =>
                    setForm({
                      ...form,
                      patient: {
                        ...form.patient,
                        age: e.target.value
                      }
                    })
                  }
                />

                <input
                  placeholder="Sex"
                  className="border p-2"
                  onChange={e =>
                    setForm({
                      ...form,
                      patient: {
                        ...form.patient,
                        sex: e.target.value
                      }
                    })
                  }
                />

              </div>
            )}

            {/* PRODUCTS */}

            {tab === "products" && (
              <input
                placeholder="Drug Name"
                className="border p-2 w-full"
                onChange={e =>
                  setForm({
                    ...form,
                    products: [{ name: e.target.value }]
                  })
                }
              />
            )}

            {/* EVENTS + MEDDRA */}

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

              </div>
            )}

            {/* MEDICAL */}

            {tab === "medical" && (
              <input
                placeholder="Causality"
                className="border p-2 w-full"
                onChange={e =>
                  setForm({
                    ...form,
                    medical: { causality: e.target.value }
                  })
                }
              />
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

            {/* QUALITY */}

            {tab === "quality" && (
              <select
                className="border p-2"
                onChange={e =>
                  setForm({
                    ...form,
                    quality: { finalStatus: e.target.value }
                  })
                }
              >
                <option value="approved">Approve</option>
                <option value="reject">Return</option>
              </select>
            )}

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
