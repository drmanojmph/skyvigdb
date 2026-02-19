import React, { useState, useEffect } from "react";
import axios from "axios";

const API =
  process.env.REACT_APP_API_URL ||
  "https://skyvigdb-backend.onrender.com/api";

const ROLES = [
  { role: "Triage", step: 1, color: "bg-blue-500" },
  { role: "Data Entry", step: 2, color: "bg-amber-500" },
  { role: "Medical Review", step: 3, color: "bg-purple-500" },
  { role: "Quality", step: 4, color: "bg-emerald-600" }
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

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const fetchCases = async () => {
    const res = await axios.get(API + "/cases");
    setCases(res.data);
  };

  // ================= LOGIN =================

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-200 to-purple-200">

        <div className="bg-white p-10 rounded-xl shadow w-96">

          <h1 className="text-xl font-bold mb-6 text-center">
            SkyVigilance Training
          </h1>

          {ROLES.map(r => (
            <button
              key={r.role}
              onClick={() => setUser(r)}
              className={`w-full text-white p-3 rounded mb-3 ${r.color}`}
            >
              Login as {r.role}
            </button>
          ))}

        </div>
      </div>
    );
  }

  // ================= DASHBOARD =================

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}

      <div className="bg-white shadow p-4 flex justify-between">

        <h2 className="font-semibold">
          {user.role}
        </h2>

        <button
          onClick={() => setUser(null)}
          className="text-red-500"
        >
          Logout
        </button>

      </div>

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
                  onClick={() => setSelected(c)}
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

      {/* CASE MODAL */}

      {selected && (

        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">

          <div className="bg-white p-6 rounded w-96">

            <h3 className="font-semibold mb-4">
              Case {selected.caseNumber}
            </h3>

            <p>Status: {selected.status}</p>
            <p>Step: {selected.currentStep}</p>

            <div className="flex justify-end mt-4">

              <button
                onClick={() => setSelected(null)}
                className="bg-gray-300 px-3 py-1 rounded"
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
