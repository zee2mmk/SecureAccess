
import { useEffect, useState } from "react";
import "./App.css";

type AccessRequest = {
  id: number;
  employee: string;
  application: string;
  role: string;
  status: string;
};

function App() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5001/api/access-requests")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load access requests.");
        }
        return response.json();
      })
      .then((data: AccessRequest[]) => setRequests(data))
      .catch(() => setError("Could not connect to the API. Is it running?"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">IDENTITY GOVERNANCE</p>
          <h1>SecureAccess</h1>
        </div>
        <span className="environment">LOCAL DEVELOPMENT</span>
      </header>

      <section className="welcome">
        <h2>Access Management</h2>
        <p>
          Review identity access requests and monitor their current status.
        </p>
      </section>

      <section className="summary">
        <article className="summary-card">
          <span>Total requests</span>
          <strong>{requests.length}</strong>
        </article>
        <article className="summary-card">
          <span>Pending approval</span>
          <strong>
            {requests.filter((r) => r.status === "Pending").length}
          </strong>
        </article>
        <article className="summary-card">
          <span>Approved</span>
          <strong>
            {requests.filter((r) => r.status === "Approved").length}
          </strong>
        </article>
      </section>

      <section className="requests">
        <h2>Recent Access Requests</h2>

        {loading && <p>Loading requests...</p>}
        {error && <p role="alert">{error}</p>}

        {!loading && !error && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Application</th>
                  <th>Requested role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>#{request.id}</td>
                    <td>{request.employee}</td>
                    <td>{request.application}</td>
                    <td>{request.role}</td>
                    <td>
                      <span
                        className={`status ${request.status.toLowerCase()}`}
                      >
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer>SecureAccess · Portfolio Project · v1.0.0</footer>
    </main>
  );
}

export default App;
