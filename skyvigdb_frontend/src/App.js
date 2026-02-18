import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL || "https://skyvigdb-backend.onrender.com/api";

const TRAINING_ACCOUNTS = [
  { username: "triage1", password: "train123", role: "Triage", step: 1 },
  { username: "dataentry1", password: "train123", role: "Data Entry", step: 2 },
  { username: "medical1", password: "train123", role: "Medical Review", step: 3 },
  { username: "quality1", password: "train123", role: "Quality Review", step: 4 },
];

// Format date → DD-MMM-YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [view, setView] = useState("queue");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(false);

  const [triageData, setTriageData] = useState({
    receiptDate: "",
    reporterName: "",
    reporterContact: "",
    reporterCountry: "",
    productName: "",
    eventDescription: "",
  });

  const [formData, setFormData] = useState({});

  useEffect(() => {
    const savedUser = localStorage.getItem("skyvigdb_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      fetchCases();
    }
  }, []);

  const fetchCases = async () => {
    try {
      const res = await axios.get(API_URL + "/cases");
      setCases(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const login = (e) => {
    e.preventDefault();
    const account = TRAINING_ACCOUNTS.find(
      (a) => a.username === username && a.password === password
    );
    if (account) {
      const userData = {
        username: account.username,
        role: account.role,
        step: account.step,
      };
      setUser(userData);
      localStorage.setItem("skyvigdb_user", JSON.stringify(userData));
      fetchCases();
    }
  };

  const logout = () => {
    setUser(null);
    setCases([]);
    localStorage.removeItem("skyvigdb_user");
  };

  const getCasesForRole = () => {
    if (!user) return [];
    return cases.filter((c) => c.currentStep === user.step);
  };

  const handleSubmit = async () => {
    if (!selectedCase) return;

    setLoading(true);

    try {
      await axios.put(API_URL + "/cases/" + selectedCase.id, formData);
      setSelectedCase(null);
      setFormData({});
      fetchCases();
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const container = {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#1e3c72",
  };

  const card = {
    background: "white",
    padding: 40,
    borderRadius: 10,
    width: 500,
  };

  const btn = {
    padding: "10px 20px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
  };

  const input = {
    width: "100%",
    padding: 10,
    margin: "10px 0",
    border: "1px solid #ddd",
    borderRadius: 5,
  };

  const dashboard = { maxWidth: 1200, margin: "0 auto", padding: 20 };
  const header = {
    display: "flex",
    justifyContent: "space-between",
    background: "white",
    padding: 20,
    marginBottom: 20,
  };

  const section = {
    background: "white",
    padding: 20,
    borderRadius: 5,
  };

  // ================= LOGIN =================

  if (!user) {
    return (
      <div style={container}>
        <div style={card}>
          <h2>SkyVigilance Training Login</h2>

          <div style={{ marginBottom: 20 }}>
            {TRAINING_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                style={{ ...btn, marginRight: 10, marginBottom: 10 }}
                onClick={() => {
                  setUsername(acc.username);
                  setPassword(acc.password);
                }}
              >
                {acc.role}
              </button>
            ))}
          </div>

          <form onSubmit={login}>
            <input
              style={input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <input
              style={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button style={{ ...btn, width: "100%" }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  // ================= TRIAGE =================

  if (user.role === "Triage" && view === "new") {
    const submitTriage = async (e) => {
      e.preventDefault();

      const payload = {
        ...triageData,
        receiptDate: formatDate(triageData.receiptDate),
      };

      await axios.post(API_URL + "/cases", payload);

      setTriageData({
        receiptDate: "",
        reporterName: "",
        reporterContact: "",
        reporterCountry: "",
        productName: "",
        eventDescription: "",
      });

      fetchCases();
      setView("queue");
    };

    return (
      <div style={dashboard}>
        <div style={header}>
          <h1>SkyVigilance — Triage</h1>
          <button style={btn} onClick={logout}>
            Logout
          </button>
        </div>

        <div style={section}>
          <h2>New Case</h2>

          <form onSubmit={submitTriage}>
            <label>Receipt Date</label>
            <input
              type="date"
              name="receiptDate"
              value={triageData.receiptDate}
              onChange={(e) =>
                setTriageData({ ...triageData, receiptDate: e.target.value })
              }
              style={input}
              required
            />

            <input
              style={input}
              placeholder="Reporter Name"
              value={triageData.reporterName}
              onChange={(e) =>
                setTriageData({ ...triageData, reporterName: e.target.value })
              }
            />

            <input
              style={input}
              placeholder="Reporter Contact"
              value={triageData.reporterContact}
              onChange={(e) =>
                setTriageData({ ...triageData, reporterContact: e.target.value })
              }
            />

            <input
              style={input}
              placeholder="Reporter Country"
              value={triageData.reporterCountry}
              onChange={(e) =>
                setTriageData({ ...triageData, reporterCountry: e.target.value })
              }
            />

            <input
              style={input}
              placeholder="Product Name"
              value={triageData.productName}
              onChange={(e) =>
                setTriageData({ ...triageData, productName: e.target.value })
              }
            />

            <textarea
              style={{ ...input, height: 100 }}
              placeholder="Event Description"
              value={triageData.eventDescription}
              onChange={(e) =>
                setTriageData({
                  ...triageData,
                  eventDescription: e.target.value,
                })
              }
            />

            <button style={btn}>Create Case</button>
          </form>
        </div>
      </div>
    );
  }

  // ================= DASHBOARD =================

  return (
    <div style={dashboard}>
      <div style={header}>
        <h1>SkyVigilance — {user.role}</h1>
        <button style={btn} onClick={logout}>
          Logout
        </button>
      </div>

      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Queue ({getCasesForRole().length})</h2>

          {user.role === "Triage" && (
            <button style={btn} onClick={() => setView("new")}>
              + New Case
            </button>
          )}
        </div>

        {getCasesForRole().map((c) => (
          <div
            key={c.id}
            style={{
              border: "1px solid #ddd",
              padding: 15,
              marginBottom: 10,
              borderRadius: 5,
            }}
          >
            <strong>{c.caseNumber}</strong> — {c.productName}

            <button
              style={{ ...btn, marginLeft: 10 }}
              onClick={() => {
                setSelectedCase(c);
                setFormData({});
              }}
            >
              Open
            </button>
          </div>
        ))}
      </div>

      {selectedCase && (
        <div style={{ ...section, marginTop: 20 }}>
          <h3>Case: {selectedCase.caseNumber}</h3>

          {user.role === "Data Entry" && (
            <>
              <input
                style={input}
                placeholder="Patient Initials"
                onChange={(e) =>
                  setFormData({ ...formData, patientInitials: e.target.value })
                }
              />
              <input
                style={input}
                placeholder="Age"
                onChange={(e) =>
                  setFormData({ ...formData, patientAge: e.target.value })
                }
              />
              <input
                style={input}
                placeholder="Gender"
                onChange={(e) =>
                  setFormData({ ...formData, patientGender: e.target.value })
                }
              />
            </>
          )}

          {user.role === "Medical Review" && (
            <>
              <input
                style={input}
                placeholder="Causality"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    causalityAssessment: e.target.value,
                  })
                }
              />
              <input
                style={input}
                placeholder="Listedness"
                onChange={(e) =>
                  setFormData({ ...formData, listedness: e.target.value })
                }
              />
              <textarea
                style={input}
                placeholder="Medical Comments"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalComments: e.target.value,
                  })
                }
              />
            </>
          )}

          {user.role === "Quality Review" && (
            <>
              <select
                style={input}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    finalStatus: e.target.value,
                  })
                }
              >
                <option value="">Select Decision</option>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </>
          )}

          <button
            style={{ ...btn, marginTop: 10 }}
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "Saving..." : "Complete Step"}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
