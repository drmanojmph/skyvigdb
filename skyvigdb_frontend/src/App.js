import React, { useState, useEffect } from "react";
import axios from "axios";

const API =
  process.env.REACT_APP_API_URL ||
  "https://skyvigdb-backend.onrender.com/api";

const USERS = [
  { username: "triage1", password: "train123", role: "Triage", step: 1 },
  { username: "dataentry1", password: "train123", role: "Data Entry", step: 2 },
  { username: "medical1", password: "train123", role: "Medical Review", step: 3 },
  { username: "quality1", password: "train123", role: "Quality", step: 4 }
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
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const fetchCases = async () => {
    const res = await axios.get(API + "/cases");
    setCases(res.data);
  };

  // ================= LOGIN =================

  const doLogin = () => {

    const found = USERS.find(
      u =>
        u.username === login.username &&
        u.password === login.password
    );

    if (!found) {
      setError("Invalid credentials");
      return;
    }

    setUser(found);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-200 to-purple-200">

        <div className="bg-white p-8 rounded-xl shadow w-96">

          <h2 className="text-xl font-bold mb-4 text-center">
            SkyVigilance Login
          </h2>

          {error && (
            <div className="text-red-500 mb-2">{error}</div>
          )}

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

          <div className="text-xs mt-4 text-gray-500">
            Training accounts: triage1 / dataentry1 / medical1 / quality1
          </div>

        </div>
      </div>
    );
  }

  // ================= CREATE CASE =================

  const createCase = async () => {

    await axios.post(API + "/cases", form);

    setForm({});
    fetchCases();
  };

  // ================= UPDATE CASE =================

  const updateCase = async () => {

    await axios.put(API + "/cases/" + selected.id, form);

    setSelected(null);
    setForm({});
    fetchCases();
  };

  const queue = cases.filter(c => c.currentStep === user.step);

  // ================= MAIN UI =================

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="bg-white p-4 shadow flex justify-between">

        <div>{user.role}</div>

        <button
          onClick={() => setUser(null)}
          className="text-red-500"
        >
          Logout
        </button>

      </div>

      {/* TRIAGE FORM */}

      {user.step === 1 && (
        <div className="p-4">

          <h3 className="font-semibold mb-2">New Case</h3>

          <input
            placeholder="Reporter Name"
            className="border p-2 mr-2"
            onChange={e =>
              setForm({ ...form, reporterName: e.target.value })
            }
          />

          <input
            placeholder="Product"
            className="border p-2 mr-2"
            onChange={e =>
              setForm({ ...form, productName: e.target.value })
            }
          />

          <button
            onClick={createCase}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            Create
          </button>

        </div>
      )}

      {/* WORKFLOW BOARD */}

      <div className="grid grid-cols-5 gap-4 p-6">

        {STAGES.map(stage => (

          <div key={stage.step} className="bg-gray-200 p-3 rounded">

            <h3 className="font-semibold mb-2">
              {stage.name}
            </h3>

            {cases
              .filter(c => c.currentStep === stage.step)
              .map(c => (

                <div
                  key={c.id}
                  className="bg-white p-3 rounded shadow mb-2 cursor-pointer"
                  onClick={() => {
                    setSelected(c);
                    setForm({});
                  }}
                >
                  <div className="font-semibold">
                    {c.caseNumber}
                  </div>

                  <div className="text-sm text-gray-500">
                    {c.status}
                  </div>

                </div>

              ))}

          </div>

        ))}

      </div>

      {/* CASE EDIT MODAL */}

      {selected && (

        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">

          <div className="bg-white p-6 rounded w-96">

            <h3 className="font-semibold mb-4">
              Case {selected.caseNumber}
            </h3>

            {/* DATA ENTRY */}

            {user.step === 2 && (
              <input
                placeholder="Patient Age"
                className="border p-2 w-full mb-2"
                onChange={e =>
                  setForm({ patientAge: e.target.value })
                }
              />
            )}

            {/* MEDICAL */}

            {user.step === 3 && (
              <input
                placeholder="Causality"
                className="border p-2 w-full mb-2"
                onChange={e =>
                  setForm({ causality: e.target.value })
                }
              />
            )}

            {/* QUALITY */}

            {user.step === 4 && (
              <select
                className="border p-2 w-full mb-2"
                onChange={e =>
                  setForm({ finalStatus: e.target.value })
                }
              >
                <option value="approved">Approve</option>
                <option value="reject">Return</option>
              </select>
            )}

            <div className="flex justify-end gap-2">

              <button
                onClick={() => setSelected(null)}
                className="bg-gray-300 px-3 py-1 rounded"
              >
                Cancel
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
