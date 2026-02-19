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

const USERS = [
  { username: "triage1", password: "train123", role: "Triage", step: 1 },
  { username: "dataentry1", password: "train123", role: "Data Entry", step: 2 },
  { username: "medical1", password: "train123", role: "Medical", step: 3 },
  { username: "quality1", password: "train123", role: "Quality", step: 4 }
];

const STAGES = [
  { name: "Triage", step: 1 },
  { name: "Data Entry", step: 2 },
  { name: "Medical", step: 3 },
  { name: "Quality", step: 4 },
  { name: "Approved", step: 5 }
];

const MEDDRA = [
  { pt: "Headache", soc: "Nervous system disorders" },
  { pt: "Nausea", soc: "Gastrointestinal disorders" },
  { pt: "Rash", soc: "Skin disorders" },
  { pt: "Fever", soc: "General disorders" }
];

export default function App() {

  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [login, setLogin] = useState({ username: "", password: "" });
  const [meddraResults, setMeddraResults] = useState([]);

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const fetchCases = async () => {
    try {
      const res = await axios.get(API + "/cases");
      setCases(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= LOGIN =================

  const doLogin = () => {

    const found = USERS.find(
      (u) =>
        u.username === login.username &&
        u.password === login.password
    );

    if (found) {
      setUser(found);
    } else {
      alert("Invalid credentials");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">

        <div className="bg-white p-6 rounded shadow w-80">

          <h2 className="font-bold mb-3">Login</h2>

          <input
            placeholder="Username"
            className="border p-2 w-full mb-2"
            onChange={(e) =>
              setLogin({ ...login, username: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-2 w-full mb-2"
            onChange={(e) =>
              setLogin({ ...login, password: e.target.value })
            }
          />

          <button
            onClick={doLogin}
            className="bg-blue-600 text-white w-full p-2"
          >
            Login
          </button>

        </div>
      </div>
    );
  }

  // ================= DASHBOARD =================

  const chartData = STAGES.map((s) => ({
    name: s.name,
    value: cases.filter((c) => c.currentStep === s.step).length
  }));

  // ================= CREATE CASE =================

  const createCase = async () => {

    try {

      const payload = {
        receiptDate: form.receiptDate || "",
        triage: form
      };

      await axios.post(API + "/cases", payload);

      setForm({});
      fetchCases();

    } catch (err) {
      console.error(err);
    }
  };

  // ================= UPDATE =================

  const updateCase = async () => {

    if (!selected) return;

    try {

      await axios.put(API + "/cases/" + selected.id, form);

      setSelected(null);
      setForm({});
      fetchCases();

    } catch (err) {
      console.error(err);
    }
  };

  // ================= MEDDRA =================

  const searchMeddra = (q) => {

    const res = MEDDRA.filter((m) =>
      m.pt.toLowerCase().includes(q.toLowerCase())
    );

    setMeddraResults(res);
  };

  // ================= NARRATIVE =================

  const generateNarrative = () => {

    const text =
      "Patient experienced adverse event after suspect drug.";

    setForm({ ...form, narrative: text });
  };

  // ================= CIOMS =================

  const exportCIOMS = () => {

    const doc = new jsPDF();

    doc.text("CIOMS I Report", 10, 10);
    doc.text("Case: " + (selected?.caseNumber || ""), 10, 20);
    doc.text(form.narrative || "", 10, 30);

    doc.save("CIOMS.pdf");
  };

  // ================= MAIN UI =================

  return (
    <div className="p-4">

      <div className="flex justify-between mb-4">
        <div>{user.role}</div>
        <button onClick={() => setUser(null)}>Logout</button>
      </div>

      {/* DASHBOARD */}

      <div style={{ width: 400, height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TRIAGE */}

      {user.step === 1 && (
        <div className="border p-3 mb-4">

          <h3>New Case</h3>

          <input
            type="date"
            className="border p-2 mr-2"
            onChange={(e) =>
              setForm({ ...form, receiptDate: e.target.value })
            }
          />

          <button
            onClick={createCase}
            className="bg-green-600 text-white px-3"
          >
            Create
          </button>

        </div>
      )}

      {/* WORKFLOW */}

      <div className="grid grid-cols-5 gap-4">

        {STAGES.map((stage) => (

          <div key={stage.step} className="bg-gray-200 p-2">

            <h4>{stage.name}</h4>

            {cases
              .filter((c) => c.currentStep === stage.step)
              .map((c) => (

                <div
                  key={c.id}
                  className="bg-white p-2 m-1 cursor-pointer"
                  onClick={() => {
                    setSelected(c);
                    setForm({});
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

          <div className="bg-white p-4 w-96">

            <h3>{selected.caseNumber}</h3>

            <input
              placeholder="Event"
              className="border p-2 w-full mb-2"
              onChange={(e) => {
                const term = e.target.value;
                setForm({ ...form, event: term });
                searchMeddra(term);
              }}
            />

            {meddraResults.map((m, i) => (
              <div key={i}>
                {m.pt} — {m.soc}
              </div>
            ))}

            <textarea
              className="border w-full mt-2"
              value={form.narrative || ""}
              onChange={(e) =>
                setForm({ ...form, narrative: e.target.value })
              }
            />

            <div className="flex justify-between mt-3">

              <button
                onClick={generateNarrative}
                className="bg-blue-600 text-white px-2"
              >
                Generate
              </button>

              <button
                onClick={exportCIOMS}
                className="bg-purple-600 text-white px-2"
              >
                CIOMS
              </button>

              <button
                onClick={updateCase}
                className="bg-green-600 text-white px-2"
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
