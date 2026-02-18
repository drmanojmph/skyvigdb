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

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const fetchCases = async () => {
    const res = await axios.get(API + "/cases");
    setCases(res.data);
  };

  const queue = cases.filter(c => c.currentStep === user?.step);

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

  const searchMedDRA = async (q) => {
    const res = await axios.get(API + "/meddra?q=" + q);
    setMeddra(res.data);
  };

  if (!user) {
    return (
      <div>
        <h2>Login</h2>
        {USERS.map(u => (
          <button key={u.role} onClick={() => setUser(u)}>
            {u.role}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>

      <h2>{user.role}</h2>

      <h3>Queue ({queue.length})</h3>

      {queue.map(c => (
        <div key={c.id}>
          {c.caseNumber}
          <button onClick={() => setSelected(c)}>Open</button>
        </div>
      ))}

      {(selected || user.step === 1) && (

        <div>

          <div>
            <button onClick={()=>setTab("patient")}>Patient</button>
            <button onClick={()=>setTab("products")}>Products</button>
            <button onClick={()=>setTab("events")}>Events</button>
            <button onClick={()=>setTab("medical")}>Medical</button>
          </div>

          {tab === "patient" && (
            <div>
              <input placeholder="Initials"
                onChange={e =>
                  setForm({...form,
                    patient:{...form.patient, initials:e.target.value}
                  })}
              />

              <input placeholder="Age"
                onChange={e =>
                  setForm({...form,
                    patient:{...form.patient, age:e.target.value}
                  })}
              />

              <input placeholder="Gender"
                onChange={e =>
                  setForm({...form,
                    patient:{...form.patient, gender:e.target.value}
                  })}
              />
            </div>
          )}

          {tab === "products" && (
            <div>

              <button onClick={() =>
                setForm({...form,
                  products:[...(form.products||[]),{}]
                })
              }>
                Add Product
              </button>

              {(form.products||[]).map((p,i)=>(
                <div key={i}>
                  <input
                    placeholder="Product"
                    onChange={e=>{
                      const arr=[...(form.products||[])];
                      arr[i].name=e.target.value;
                      setForm({...form,products:arr});
                    }}
                  />
                  <input
                    placeholder="Dose"
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

          {tab === "events" && (
            <div>

              <button onClick={() =>
                setForm({...form,
                  events:[...(form.events||[]),{}]
                })
              }>
                Add Event
              </button>

              {(form.events||[]).map((ev,i)=>(
                <div key={i}>

                  <input
                    placeholder="Event Term"
                    onChange={e=>{
                      const arr=[...(form.events||[])];
                      arr[i].term=e.target.value;
                      setForm({...form,events:arr});
                      searchMedDRA(e.target.value);
                    }}
                  />

                  <label>
                    Serious
                    <input type="checkbox"
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
                <div key={i}>
                  {m.pt} — {m.soc}
                </div>
              ))}

            </div>
          )}

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
                Result: {form.medical?.causality}
              </div>

            </div>
          )}

          {user.step === 4 && (
            <select
              onChange={e =>
                setForm({...form,
                  finalStatus:e.target.value
                })
              }
            >
              <option value="approved">Approve</option>
              <option value="reject">Return</option>
            </select>
          )}

          <div style={{marginTop:20}}>
            <button onClick={submit}>Submit</button>
          </div>

        </div>
      )}

    </div>
  );
}
