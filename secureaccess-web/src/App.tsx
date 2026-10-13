import { useCallback, useEffect, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";
import "./App.css";

const API_URL = "http://localhost:5225";

type Employee = {
  id: number;
  fullName: string;
  employeeNumber: string;
  department: string;
};

type ManagedApplication = {
  id: number;
  name: string;
  description: string | null;
};

type AccessRequest = {
  id: number;
  employee: string;
  application: string;
  role: string;
  status: string;
  requestedAtUtc: string;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
  reviewComments: string | null;
};

type AuditEvent = {
  id: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: number;
  details: string | null;
  occurredAtUtc: string;
};

type RequestForm = {
  employeeId: string;
  managedApplicationId: string;
  requestedRole: string;
  businessJustification: string;
};

const initialForm: RequestForm = {
  employeeId: "",
  managedApplicationId: "",
  requestedRole: "",
  businessJustification: "",
};

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message ?? `Request failed (${response.status})`
    );
  }

  return response.json() as Promise<T>;
}

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const activeAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
  const activeAccountId = activeAccount?.homeAccountId ?? null;
  const [authBusy, setAuthBusy] = useState(false);

  type Workspace = "dashboard" | "new-request" | "approvals" | "audit-history";

  const [activeView, setActiveView] = useState<Workspace>("dashboard");

  const workspaceTitles: Record<Workspace, { title: string; description: string }> = {
    dashboard: {
      title: "Dashboard",
      description: "Monitor access requests and approval activity.",
    },
    "new-request": {
      title: "Create Access Request",
      description: "Request the application access needed for your work.",
    },
    approvals: {
      title: "Access Approvals",
      description: "Review pending requests and record decisions.",
    },
    "audit-history": {
      title: "Audit History",
      description: "Review the recorded history of access requests.",
    },
  };

  const API_SCOPE = loginRequest.scopes[2];

  async function authenticatedFetch(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const account =
      instance.getActiveAccount() ?? accounts[0] ?? null;

    if (!account) {
      throw new Error("Please sign in with Microsoft before using SecureAccess.");
    }

    try {
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: [API_SCOPE],
        account,
      });

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${tokenResponse.accessToken}`);

      return fetch(url, {
        ...init,
        headers,
      });
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const tokenResponse = await instance.acquireTokenPopup({
          scopes: [API_SCOPE],
          account,
        });

        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${tokenResponse.accessToken}`);

        return fetch(url, {
          ...init,
          headers,
        });
      }

      throw error;
    }
  }

  async function handleLogin() {
    setAuthBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await instance.loginPopup(loginRequest);

      if (response.account) {
        instance.setActiveAccount(response.account);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Microsoft sign-in failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    setError("");
    setSuccess("");

    try {
      await instance.logoutRedirect({
        account: activeAccount ?? undefined,
        postLogoutRedirectUri: "http://localhost:5173",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Microsoft sign-out failed."
      );
      setAuthBusy(false);
    }
  }

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [applications, setApplications] = useState<ManagedApplication[]>([]);
  const [form, setForm] = useState<RequestForm>(initialForm);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingReviewId, setProcessingReviewId] = useState<number | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [auditRequestId, setAuditRequestId] = useState<number | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  const loadRequests = useCallback(async () => {
    const response = await authenticatedFetch(`${API_URL}/api/access-requests`);
    setRequests(await readResponse<AccessRequest[]>(response));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeAccountId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError("");

        const [employeeResponse, applicationResponse, requestResponse] =
          await Promise.all([
            authenticatedFetch(`${API_URL}/api/employees`),
            authenticatedFetch(`${API_URL}/api/applications`),
            authenticatedFetch(`${API_URL}/api/access-requests`),
          ]);

        const [employeeData, applicationData, requestData] =
          await Promise.all([
            readResponse<Employee[]>(employeeResponse),
            readResponse<ManagedApplication[]>(applicationResponse),
            readResponse<AccessRequest[]>(requestResponse),
          ]);

        if (!cancelled) {
          setEmployees(employeeData);
          setApplications(applicationData);
          setRequests(requestData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load SecureAccess data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activeAccountId]);

  function updateField(
    field: keyof RequestForm,
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.employeeId ||
      !form.managedApplicationId ||
      !form.requestedRole.trim() ||
      !form.businessJustification.trim()
    ) {
      setError("Please complete all fields before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/access-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          managedApplicationId: Number(form.managedApplicationId),
          requestedRole: form.requestedRole.trim(),
          businessJustification: form.businessJustification.trim(),
        }),
      });

      const created = await readResponse<AccessRequest>(response);

      setForm(initialForm);
      await loadRequests();

      setSuccess(
        `Access request #${created.id} submitted successfully. Status: ${created.status}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit the access request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(
    requestId: number,
    decision: "Approved" | "Rejected"
  ) {
    setError("");
    setSuccess("");

    if (!selectedReviewerId) {
      setError("Please select a reviewer before processing a request.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${decision.toLowerCase()} access request #${requestId}?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingReviewId(requestId);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/api/access-requests/${requestId}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewerEmployeeId: Number(selectedReviewerId),
            decision,
            comments: reviewComments.trim() || null,
          }),
        }
      );

      const result = await readResponse<{
        id: number;
        status: string;
        reviewedBy: string;
      }>(response);

      await loadRequests();
      setReviewComments("");

      setSuccess(
        `Access request #${result.id} was ${result.status.toLowerCase()} successfully by ${result.reviewedBy}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to review the access request."
      );
    } finally {
      setProcessingReviewId(null);
    }
  }

  function formatTimestamp(value: string | null): string {
    if (!value) return "Not reviewed";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Invalid timestamp";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  async function handleViewAudit(requestId: number) {
    setError("");
    setAuditRequestId(requestId);
    setAuditEvents([]);
    setAuditLoading(true);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/api/access-requests/${requestId}/audit-events`
      );

      const events = await readResponse<AuditEvent[]>(response);
      setAuditEvents(events);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load audit history."
      );
      setAuditRequestId(null);
    } finally {
      setAuditLoading(false);
    }
  }

  const pendingCount = requests.filter(
    (request) => request.status.toLowerCase() === "pending"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status.toLowerCase() === "approved"
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status.toLowerCase() === "rejected"
  ).length;

  const filteredRequests = requests.filter((request) => {
    const query = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !query ||
      request.employee.toLowerCase().includes(query) ||
      request.application.toLowerCase().includes(query) ||
      request.role.toLowerCase().includes(query) ||
      String(request.id).includes(query);

    const matchesStatus =
      statusFilter === "All" ||
      request.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / pageSize)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRequests = filteredRequests.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const sidebar = (
    <Sidebar
      activeView={activeView}
      onNavigate={setActiveView}
    />
  );

  return (
    <main className="app-shell">
      <div className="app-layout">
        {sidebar}
        <div className="app-main">
          <header className="topbar">
            <div className="auth-controls">
              {isAuthenticated ? (
                <>
                  <div className="auth-user">
                    <strong>
                      {activeAccount?.name ??
                        activeAccount?.username ??
                        "Signed-in user"}
                    </strong>
                    <span>Authenticated with Microsoft</span>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleLogout()}
                    disabled={authBusy}
                  >
                    {authBusy ? "Please wait..." : "Sign out"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={authBusy}
                >
                  {authBusy ? "Connecting..." : "Sign in with Microsoft"}
                </button>
              )}
            </div>
          </header>
          <div className="workspace-heading">
            <div>
              <h2>{workspaceTitles[activeView].title}</h2>
              <p className="subtitle">
                {workspaceTitles[activeView].description}
              </p>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success" role="status">
              {success}
            </div>
          )}
          {activeView === "dashboard" && (
            <section className="summary-grid" aria-label="Request summary">
              <article className="summary-card">
                <span>Total Requests</span>
                <strong>{requests.length}</strong>
              </article>
              <article className="summary-card">
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </article>
              <article className="summary-card">
                <span>Approved</span>
                <strong>{approvedCount}</strong>
              </article>
              <article className="summary-card">
                <span>Rejected</span>
                <strong>{rejectedCount}</strong>
              </article>
            </section>
          )}

          {activeView === "new-request" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Create Access Request</h2>
                  <p>Request the application access needed for your work.</p>
                </div>
              </div>

              <form className="request-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label>
                    Employee
                    <select
                      value={form.employeeId}
                      onChange={(event) =>
                        updateField("employeeId", event.target.value)
                      }
                      required
                    >
                      <option value="">Select an employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.fullName} — {employee.department}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Application
                    <select
                      value={form.managedApplicationId}
                      onChange={(event) =>
                        updateField("managedApplicationId", event.target.value)
                      }
                      required
                    >
                      <option value="">Select an application</option>
                      {applications.map((application) => (
                        <option key={application.id} value={application.id}>
                          {application.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Requested Role
                    <input
                      type="text"
                      value={form.requestedRole}
                      onChange={(event) =>
                        updateField("requestedRole", event.target.value)
                      }
                      placeholder="e.g. ReadOnly, Developer"
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="full-width">
                    Business Justification
                    <textarea
                      value={form.businessJustification}
                      onChange={(event) =>
                        updateField("businessJustification", event.target.value)
                      }
                      placeholder="Explain why this access is required."
                      maxLength={1000}
                      rows={4}
                      required
                    />
                    <span className="field-hint">
                      Maximum 1,000 characters.
                    </span>
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={submitting || loading}
                  >
                    {submitting ? "Submitting..." : "Submit Access Request"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeView === "approvals" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Access Requests</h2>
                  <p>Requests retrieved from the SecureAccess database.</p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setError("");
                    void loadRequests().catch((err: unknown) => {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Unable to refresh requests."
                      );
                    });
                  }}
                >
                  Refresh
                </button>
              </div>

              <div className="review-controls">
                <label>
                  Reviewer
                  <select
                    value={selectedReviewerId}
                    onChange={(event) => setSelectedReviewerId(event.target.value)}
                    disabled={processingReviewId !== null}
                  >
                    <option value="">Select a reviewer</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} — {employee.department}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Review Comments
                  <textarea
                    value={reviewComments}
                    onChange={(event) => setReviewComments(event.target.value)}
                    placeholder="Enter the reason for approval or rejection."
                    maxLength={1000}
                    rows={3}
                    disabled={processingReviewId !== null}
                  />
                  <span className="field-hint">
                    Optional. Maximum 1,000 characters.
                  </span>
                </label>
              </div>

              <div className="request-filters">
                <label>
                  Search requests
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Employee, application, role, or ID"
                  />
                </label>

                <label>
                  Filter by status
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
              </div>

              <p className="results-count">
                Showing {filteredRequests.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
                {"–"}
                {Math.min(safeCurrentPage * pageSize, filteredRequests.length)}
                {" of "}
                {filteredRequests.length} matching requests
              </p>

              {loading ? (
                <p className="empty-state">Loading access requests...</p>
              ) : filteredRequests.length === 0 ? (
                <p className="empty-state">
                  {requests.length === 0
                    ? "No access requests found. Create your first request above."
                    : "No requests match your current search and filters."}
                </p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Employee</th>
                        <th>Application</th>
                        <th>Requested Role</th>
                        <th>Status</th>
                        <th>Reviewed By</th>
                        <th>Reviewed At</th>
                        <th>Review Comments</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRequests.map((request) => (
                        <tr key={request.id}>
                          <td>#{request.id}</td>
                          <td>{request.employee}</td>
                          <td>{request.application}</td>
                          <td>{request.role}</td>
                          <td>
                            <span
                              className={`status-badge status-${request.status.toLowerCase()}`}
                            >
                              {request.status}
                            </span>
                          </td>
                          <td>{request.reviewedBy ?? "—"}</td>
                          <td>{formatTimestamp(request.reviewedAtUtc)}</td>
                          <td>
                            {request.reviewComments
                              ? request.reviewComments.length > 80
                                ? `${request.reviewComments.slice(0, 80)}…`
                                : request.reviewComments
                              : "—"}
                          </td>
                          <td className="review-actions">
                            {request.status.toLowerCase() === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  className="review-icon-button approve-icon-button"
                                  title="Approve request"
                                  aria-label={`Approve request ${request.id}`}
                                  disabled={processingReviewId !== null}
                                  onClick={() =>
                                    void handleReview(request.id, "Approved")
                                  }
                                >
                                  ✓
                                </button>

                                <button
                                  type="button"
                                  className="review-icon-button reject-icon-button"
                                  title="Reject request"
                                  aria-label={`Reject request ${request.id}`}
                                  disabled={processingReviewId !== null}
                                  onClick={() =>
                                    void handleReview(request.id, "Rejected")
                                  }
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <span className="field-hint">Reviewed</span>
                            )}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredRequests.length > pageSize && (
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  >
                    Previous
                  </button>

                  <span>
                    Page {safeCurrentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          )}

          {activeView === "audit-history" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Audit History</h2>
                  <p>
                    Select an access request to review its chronological audit trail.
                  </p>
                </div>
              </div>

              <div className="audit-request-selector">
                <label htmlFor="auditRequestSelect">
                  Select Access Request
                </label>

                <select
                  id="auditRequestSelect"
                  value={auditRequestId?.toString() ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value) {
                      void handleViewAudit(Number(value));
                    } else {
                      setAuditRequestId(null);
                      setAuditEvents([]);
                    }
                  }}
                >
                  <option value="">Choose a request...</option>

                  {requests.map((request) => (
                    <option key={request.id} value={request.id}>
                      Request #{request.id} — {request.employee}
                    </option>
                  ))}
                </select>
              </div>

              {auditRequestId !== null && (
                <div className="audit-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Request #{auditRequestId}</h3>
                      <p>Chronological record of request events.</p>
                    </div>
                  </div>

                  {auditLoading ? (
                    <p className="empty-state">Loading audit history...</p>
                  ) : auditEvents.length === 0 ? (
                    <p className="empty-state">
                      No audit events were found for this request.
                    </p>
                  ) : (
                    <div className="audit-timeline">
                      {auditEvents.map((event) => (
                        <article className="audit-event" key={event.id}>
                          <div className="audit-event-marker" />

                          <div className="audit-event-content">
                            <h4>{event.action}</h4>

                            <p className="audit-event-meta">
                              {event.actor} · {formatTimestamp(event.occurredAtUtc)}
                            </p>

                            {event.details && <p>{event.details}</p>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <footer className="app-footer">
            SecureAccess · Enterprise IAM Portfolio Project
          </footer>
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  activeView,
  onNavigate,
}: {
  activeView: "dashboard" | "new-request" | "approvals" | "audit-history";
  onNavigate: (
    view: "dashboard" | "new-request" | "approvals" | "audit-history"
  ) => void;
}) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "new-request", label: "New Request", icon: "+" },
    { id: "approvals", label: "Approvals", icon: "✓" },
    { id: "audit-history", label: "Audit History", icon: "◷" },
  ] as const;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">S</div>
        <div>
          <strong>SecureAccess</strong>
          <span>IAM PLATFORM</span>
        </div>
      </div>

      <p className="sidebar-label">WORKSPACE</p>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-item ${
              activeView === item.id ? "active" : ""
            }`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeView === item.id ? "page" : undefined}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="environment-dot" />
        <div>
          <strong>Local Development</strong>
          <span>Development environment</span>
        </div>
      </div>
    </aside>
  );
}

export default App;