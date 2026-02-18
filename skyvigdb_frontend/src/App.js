import React, { useState, useEffect } from "react";
import axios from "axios";

const API =
  process.env.REACT_APP_API_URL ||
  "https://skyvigdb-backend.onrender.com/api";

const USERS = [
  { role: "Triage", step: 1 },
  { role: "Data Entry", step: 2 },
  { role: "Medical Review", step: 3 },
  { role: "Quality", step: 4 }
];

export default function App() {

  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [tab, setTab] = useState("patient");
  const [meddra, setMeddra] = useState([]);

  // ================= FETCH =================

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const fetchCases = async () => {
    try {
      const res = await axios.get(API + "/cases");
      setCases(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= LOGIN =================

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>SkyVigilance Training Login</h2>

        {USERS.map(u => (
          <button
            key={u.role}
            onClick={() => setUser(u)}
            style={{ margin: 10 }}
          >
            {u.role}
          </button>
        ))}
      </div>
    );
  }

  // ================= QUEUE =================

  const queue = cases.filter(c => c.currentStep === user.step);

  // ================= OPEN CASE =================

  const openCase = (c) => {

    setSelected(c);

    if (user.step === 2) setForm(c.dataEntry || {});
    if (user.step === 3) setForm(c.medical || {});
    if (user.step === 4) setForm(c.quality || {});
  };

  // ================= NEW CASE =================

  const newCase = () => {
    setSelected(null);
    setForm({});
  };

  // ================= SUBMIT =================

  const submit = async () => {

    try {

      if (user.step === 1) {
        await axios.post(API + "/cases", form);
      } else {

        if (!selected) {
          alert("No case selected");
          return;
        }

        await axios.put(
          API + "/cases/" + selected.id,
          form
        );
      }

      await fetchCases();

      setSelected(null);
      setForm({});

    } catch (err) {
      console.error(err);
      alert("Submission failed");
    }
  };

  // ================= MEDDRA =================

  const searchMedDRA = async (q) => {

    if (!q) return;

    try {
      const res = await axios.get(API + "/meddra?q=" + q);
      setMeddra(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= MAIN UI =================

  return (
    <div style={{ padding: 20 }}>

      <h2>{user.role}</h2>

      <button onClick={() => setUser(null)}>Logout</button>

      <h3>Queue ({queue.length})</h3>

      {user.step === 1 && (
        <button onClick={newCase}>New Case</button>
      )}

      {queue.map(c => (
        <div key={c.id} style={{ marginBottom: 10 }}>
          {c.caseNumber}
          <button onClick={() => openCase(c)} style={{ marginLeft: 10 }}>
            Open
          </button>
        </div>
      ))}

      {(selected || user.step === 1) && (

        <div style={{ marginTop: 30 }}>

          {/* TABS */}

          <div style={{ marginBottom: 20 }}>
            <button onClick={()=>setTab("patient")}>Patient</button>
            <button onClick={()=>setTab("products")}>Products</button>
            <button onClick={()=>setTab("events")}>Events</button>
            <button onClick={()=>setTab("medical")}>Medical</button>
          </div>

          {/* PATIENT */}

          {tab === "patient" && (
            <div>

              <input
                placeholder="Initials"
                value={form?.patient?.initials || ""}
                onChange={e =>
                  setForm({
                    ...form,
                    patient:{
                      ...form.patient,
                      initials:e.target.value
                    }
                  })
                }
              />

              <input
                placeholder="Age"
                value={form?.patient?.age || ""}
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
                value={form?.patient?.gender || ""}
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
              >
                Add Product
              </button>

              {(form.products||[]).map((p,i)=>(
                <div key={i}>

                  <input
                    placeholder="Product"
                    value={p.name || ""}
                    onChange={e=>{
                      const arr=[...(form.products||[])];
                      arr[i].name=e.target.value;
                      setForm({...form,products:arr});
                    }}
                  />

                  <input
                    placeholder="Dose"
                    value={p.dose || ""}
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
              >
                Add Event
              </button>

              {(form.events||[]).map((ev,i)=>(
                <div key={i}>

                  <input
                    placeholder="Event Term"
                    value={ev.term || ""}
                    onChange={e=>{
                      const arr=[...(form.events||[])];
                      arr[i].term=e.target.value;
                      setForm({...form,events:arr});
                      searchMedDRA(e.target.value);
                    }}
                  />

                  <label style={{ marginLeft: 10 }}>
                    Serious
                    <input
                      type="checkbox"
                      checked={ev.serious || false}
                      onChange={e=>{
                        const arr=[...(form.events||[])];
                        arr[i].serious=e.target.checked;
                        setForm({...form,events:arr});
                      }}
                    />
                  </label>

                </div>
              ))}

              {meddra.map((m,i)=>(
                <div key={i} style={{ fontSize: 12 }}>
                  {m.pt} — {m.soc}
                </div>
              ))}

            </div>
          )}

          {/* MEDICAL */}

          {tab === "medical" && (
            <div>

              <button
                onClick={async ()=>{
                  const res = await axios.post(
                    API + "/causality",
                    form.medical || {}
                  );

                  setForm({
                    ...form,
                    medical:{
                      ...form.medical,
                      causality:res.data.result
                    }
                  });
                }}
              >
                Run Causality
              </button>

              <div>
                Result: {form?.medical?.causality}
              </div>

            </div>
          )}

          {/* QUALITY */}

          {user.step === 4 && (
            <div style={{ marginTop: 20 }}>
              <select
                onChange={e =>
                  setForm({
                    ...form,
                    finalStatus:e.target.value
                  })
                }
              >
                <option value="">Select</option>
                <option value="approved">Approve</option>
                <option value="reject">Return</option>
              </select>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <button onClick={submit}>
              Submit
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
