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
/* Paste all IME PT terms here from your file */

const IME_TERMS = [
  "Anaphylaxis",
  "Stevens-Johnson syndrome",
  "Toxic epidermal necrolysis",
  "Agranulocytosis",
  "Seizure"
];

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

  /* ================= DUPLICATE DETECTION ================= */

  const detectDuplicate = () => {

    const triage = form.triage || {};
    const drug = form.products?.[0]?.name || "";
    const event = form.events?.[0]?.term || "";

    const dup = cases.find(c =>
      c.triage?.patientInitials === triage.patientInitials &&
      c.products?.[0]?.name === drug &&
      c.events?.[0]?.term === event
    );

    if (dup) {
      alert("Possible duplicate: " + dup.caseNumber);
      return true;
    }

    return false;
  };

  /* ================= CREATE ================= */

  const createCase = async () => {

    if (detectDuplicate()) return;

    try {

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

      alert("Case created");

    } catch (err) {

      console.error(err);
      alert("Create failed");

    }

  };

  /* ================= UPDATE ================= */

  const updateCase = async () => {

    await axios.put(API + "/cases/" + selected.id, form);

    setSelected(null);
    setForm({});
    fetchCases();

  };

  /* ================= MEDDRA ================= */

  const searchMeddra = (q) => {

    const res = MEDDRA.filter(m =>
      m.pt.toLowerCase().includes(q.toLowerCase())
    );

    setMeddraResults(res);

  };

  /* ================= SERIOUS AUTO ================= */

  const autoSerious = (term, seriousnessObj) => {

    const imeMatch = IME_TERMS.some(
      t => t.toLowerCase() === term?.toLowerCase()
    );

    const checklistSerious =
      seriousnessObj &&
      Object.values(seriousnessObj).some(v => v === true);

    return imeMatch || checklistSerious;
  };

  /* ================= WHO UMC ================= */

  const runWHOUMC = () => {

    const m = form.medical || {};
    let result = "Unassessable";

    if (!m.temporal) result = "Unlikely";
    if (m.temporal && !m.alternative) result = "Possible";
    if (m.temporal && m.dechallenge && !m.alternative)
      result = "Probable";
    if (m.rechallenge) result = "Certain";

    setForm({
      ...form,
      medical: { ...m, causality: result }
    });

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

  /* ================= CIOMS ================= */

  const exportCIOMS = () => {

    const doc = new jsPDF();

    doc.text("CIOMS I Report", 10, 10);
    doc.text("Case: " + selected.caseNumber, 10, 20);
    doc.text(form.narrative || "", 10, 30);

    doc.save("CIOMS.pdf");

  };

  /* ================= DASHBOARD ================= */

  const chartData = STAGES.map(s => ({
    name: s.name,
    value: cases.filter(c => c.currentStep === s.step).length
  }));

  /* ================= TRIAGE ================= */

  const triageUI = user.step === 1 && (

    <div className="bg-blue-50 p-4 rounded mb-4">

      <h3 className="font-semibold mb-3">
        New Case Intake
      </h3>

      <div className="grid grid-cols-2 gap-2">

        <input
          type="date"
          className="border p-2"
          onChange={e =>
            setForm({
              ...form,
              triage:{
                ...form.triage,
                receiptDate:e.target.value
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
              triage:{
                ...form.triage,
                country:e.target.value
              }
            })
          }
        />

        <input
          placeholder="Patient Initials"
          className="border p-2"
          onChange={e =>
            setForm({
              ...form,
              triage:{
                ...form.triage,
                patientInitials:e.target.value
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
              triage:{
                ...form.triage,
                reporter:e.target.value
              }
            })
          }
        />

        <select
          className="border p-2"
          onChange={e =>
            setForm({
              ...form,
              triage:{
                ...form.triage,
                qualification:e.target.value
              }
            })
          }
        >
          <option>Reporter Qualification</option>
          <option>Physician</option>
          <option>Pharmacist</option>
          <option>Nurse</option>
          <option>Consumer</option>
        </select>

        <input
          placeholder="Suspect Drug"
          className="border p-2"
          onChange={e =>
            setForm({
              ...form,
              products:[{ name:e.target.value }]
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
            events:[{ term:e.target.value }]
          })
        }
      />

      <button
        onClick={createCase}
        className="bg-blue-600 text-white px-4 py-2 rounded mt-3"
      >
        Create Case
      </button>

    </div>

  );

  /* ================= MAIN ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-4">

      <div className="flex justify-between mb-4">
        <div className="font-semibold">{user.role}</div>
        <button onClick={() => setUser(null)}>Logout</button>
      </div>

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

      {triageUI}

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

            <button
              onClick={exportCIOMS}
              className="bg-indigo-600 text-white px-3 py-1 rounded"
            >
              CIOMS
            </button>

            <button
              onClick={updateCase}
              className="bg-green-600 text-white px-3 py-1 rounded ml-2"
            >
              Submit
            </button>

          </div>

        </div>

      )}

    </div>
  );
}
