import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";

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
  { name: "Triage", step: 1, color: "bg-blue-100" },
  { name: "Data Entry", step: 2, color: "bg-amber-100" },
  { name: "Medical", step: 3, color: "bg-purple-100" },
  { name: "Quality", step: 4, color: "bg-emerald-100" },
  { name: "Approved", step: 5, color: "bg-green-100" }
];

export default function App() {

  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [tab, setTab] = useState("patient");

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

        <div className="bg-white p-10 rounded-2xl shadow-xl w-96">

          <h1 className="text-2xl font-bold text-center mb-6">
            SkyVigilance Training
          </h1>

          {ROLES.map(r => (
            <button
              key={r.role}
              onClick={() => setUser(r)}
              className={`w-full text-white p-3 rounded-lg mb-3 ${r.color}`}
            >
              {r.role}
            </button>
          ))}

        </div>
      </div>
    );
  }

  // ================= OPEN CASE =================

  const openCase = (c) => {

    setSelected(c);

    if (user.step === 2) setForm(c.dataEntry || {});
    if (user.step === 3) setForm(c.medical || {});
    if (user.step === 4) setForm(c.quality || {});
  };

  // ================= SUBMIT =================

  const submit = async () => {

    if (user.step === 1) {
      await axios.post(API + "/cases", form);
    } else {
      await axios.put(API + "/cases/" + selected.id, form);
    }

    fetchCases();
    setSelected(null);
    setForm({});
  };

  // ================= DASHBOARD =================

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}

      <div className="bg-white shadow p-4 flex justify-between">

        <h2 className="text-xl font-semibold">
          {user.role}
        </h2>

        <button
          onClick={() => setUser(null)}
          className="text-red-500"
        >
          Logout
        </button>

      </div>

      {/* PROGRESS TRACKER */}

      <ProgressTracker step={user.step} />

      {/* KANBAN BOARD */}

      <div className="grid grid-cols-5 gap-4 p-6">

        {STAGES.map(stage => (

          <div key={stage.step} className={`${stage.color} p-3 rounded-lg`}>

            <h3 className="font-semibold mb-2">
              {stage.name}
            </h3>

            {cases
              .filter(c => c.currentStep === stage.step)
              .map(c => (

                <motion.div
                  key={c.id}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white p-3 rounded shadow mb-2 cursor-pointer"
                  onClick={() => openCase(c)}
                >
                  <div className="font-semibold">
                    {c.caseNumber}
                  </div>

                  <div className="text-sm text-gray-500">
                    {c.status}
                  </div>

                </motion.div>

              ))}

          </div>

        ))}

      </div>

      {/* CASE MODAL */}

      {selected && (

        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">

          <div className="bg-white p-6 rounded-xl w-2/3">

            <h3 className="text-lg font-semibold mb-4">
              Case {selected.caseNumber}
            </h3>

            {/* TABS */}

            <div className="flex gap-2 mb-4">

              {["patient","products","events","medical"].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded ${
                    tab === t ? "bg-blue-500 text-white" : "bg-gray-200"
                  }`}
                >
                  {t}
                </button>
              ))}

            </div>

            {/* PATIENT TAB */}

            {tab === "patient" && (
              <div>

                <input
                  placeholder="Age"
                  className="border p-2 mr-2"
                  onChange={e =>
                    setForm({
                      ...form,
                      patient:{
                        ...form.patient,
                        age:e.target.value
                      }
                    })
                  }
                />

                <input
                  placeholder="Gender"
                  className="border p-2"
                  onChange={e =>
                    setForm({
                      ...form,
                      patient:{
                        ...form.patient,
                        gender:e.target.value
                      }
                    })
                  }
                />

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
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Add Product
                </button>

                {(form.products||[]).map((p,i)=>(
                  <div key={i} className="mt-2">

                    <input
                      placeholder="Product"
                      className="border p-2 mr-2"
                      onChange={e=>{
                        const arr=[...(form.products||[])];
                        arr[i].name=e.target.value;
                        setForm({...form,products:arr});
                      }}
                    />

                    <input
                      placeholder="Dose"
                      className="border p-2"
                      onChange={e=>{
                        const arr=[...(form.products||[])];
                        arr[i].dose=e.target.value;
                        setForm({...form,products:arr});
                      }}
                    />

                  </div>
                ))}

              </div>
            )}

            {/* EVENTS */}

            {tab === "events" && (
              <div>

                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      events:[...(form.events||[]),{}]
                    })
                  }
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Add Event
                </button>

                {(form.events||[]).map((ev,i)=>(
                  <div key={i} className="mt-2">

                    <input
                      placeholder="Event"
                      className="border p-2 mr-2"
                      onChange={e=>{
                        const arr=[...(form.events||[])];
                        arr[i].term=e.target.value;
                        setForm({...form,events:arr});
                      }}
                    />

                    <label>
                      Serious
                      <input
                        type="checkbox"
                        className="ml-2"
                        onChange={e=>{
                          const arr=[...(form.events||[])];
                          arr[i].serious=e.target.checked;
                          setForm({...form,events:arr});
                        }}
                      />
                    </label>

                  </div>
                ))}

              </div>
            )}

            {/* MEDICAL */}

            {tab === "medical" && (
              <div>
                Medical review section
              </div>
            )}

            {/* ACTIONS */}

            <div className="flex justify-end gap-2 mt-4">

              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>

              <button
                onClick={submit}
                className="px-4 py-2 bg-green-600 text-white rounded"
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

// ================= PROGRESS TRACKER =================

function ProgressTracker({ step }) {

  const stages = ["Triage","Data Entry","Medical","Quality","Approved"];

  return (
    <div className="flex justify-center gap-4 p-4">

      {stages.map((s,i)=>(
        <motion.div
          key={i}
          className={`px-3 py-1 rounded-full ${
            step >= i+1 ? "bg-green-500 text-white" : "bg-gray-300"
          }`}
          animate={{ scale: step === i+1 ? 1.2 : 1 }}
        >
          {s}
        </motion.div>
      ))}

    </div>
  );
}
