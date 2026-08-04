"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const STATUS_FLOW = ["assigned", "arrived", "loaded", "in_transit", "delivered"];
const STATUS_LABELS = {
  assigned: "Assigned",
  arrived: "Arrived",
  loaded: "Loaded",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loads, setLoads] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [notice, setNotice] = useState("");
  const [newLoad, setNewLoad] = useState({
    loadNumber: "",
    driverId: "",
    pickup: "",
    delivery: "",
    pickupDate: "",
    deliveryDate: "",
    broker: "",
    reference: "",
    pay: "",
  });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setProfiles([]);
      setLoads([]);
      setDocuments([]);
      return;
    }

    loadWorkspace(session.user.id);
  }, [session]);

  const isDispatch =
    profile?.role === "dispatcher" || profile?.role === "admin";

  const activeLoad = loads.find(
    (load) => load.driver_id === session?.user?.id && load.is_active
  );

  const weeklyPay = useMemo(
    () => loads.reduce((sum, load) => sum + Number(load.driver_pay || 0), 0),
    [loads]
  );

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function driverName(driverId) {
    return (
      profiles.find((item) => item.id === driverId)?.full_name ||
      (driverId === session?.user?.id ? profile?.full_name : "") ||
      "Unassigned"
    );
  }

  function documentFor(loadId, type) {
    return documents.find(
      (document) =>
        document.load_id === loadId && document.document_type === type
    );
  }

  async function loadWorkspace(userId = session?.user?.id) {
    if (!userId) return;
    setWorkspaceLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, phone, active")
      .eq("id", userId)
      .single();

    if (profileError) {
      flash(profileError.message);
      setWorkspaceLoading(false);
      return;
    }

    setProfile(profileData);
    const dispatchAccess =
      profileData.role === "dispatcher" || profileData.role === "admin";

    const [loadsResult, documentsResult, profilesResult] = await Promise.all([
      supabase.from("loads").select("*").order("created_at", { ascending: false }),
      supabase
        .from("load_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      dispatchAccess
        ? supabase
            .from("profiles")
            .select("id, full_name, role, phone, active")
            .eq("active", true)
            .order("full_name")
        : Promise.resolve({ data: [profileData], error: null }),
    ]);

    const firstError =
      loadsResult.error || documentsResult.error || profilesResult.error;

    if (firstError) {
      flash(firstError.message);
    } else {
      setLoads(loadsResult.data || []);
      setDocuments(documentsResult.data || []);
      setProfiles(profilesResult.data || []);
      const firstDriver = (profilesResult.data || []).find(
        (item) => item.role === "driver"
      );
      if (firstDriver) {
        setNewLoad((current) =>
          current.driverId
            ? current
            : { ...current, driverId: firstDriver.id }
        );
      }
    }

    setWorkspaceLoading(false);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setAuthLoading(true);

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: authForm.email.trim(),
        password: authForm.password,
        options: {
          data: {
            full_name: authForm.fullName.trim(),
          },
        },
      });

      if (error) {
        flash(error.message);
      } else if (!data.session) {
        flash("Check your email to confirm your account, then sign in.");
        setAuthMode("signin");
      } else {
        flash("Driver account created.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email.trim(),
        password: authForm.password,
      });

      if (error) flash(error.message);
    }

    setAuthLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function createLoad(event) {
    event.preventDefault();
    if (!newLoad.driverId) {
      flash("Select a driver first.");
      return;
    }

    const { error } = await supabase.from("loads").insert({
      load_number:
        newLoad.loadNumber.trim() ||
        `GP-${Math.floor(1000 + Math.random() * 9000)}`,
      driver_id: newLoad.driverId,
      pickup_location: newLoad.pickup.trim(),
      delivery_location: newLoad.delivery.trim(),
      pickup_date: newLoad.pickupDate || null,
      delivery_date: newLoad.deliveryDate || null,
      broker_name: newLoad.broker.trim() || null,
      reference_number: newLoad.reference.trim() || null,
      driver_pay: Number(newLoad.pay || 0),
      status: "assigned",
      is_active: true,
      created_by: session.user.id,
    });

    if (error) {
      flash(error.message);
      return;
    }

    setNewLoad((current) => ({
      loadNumber: "",
      driverId: current.driverId,
      pickup: "",
      delivery: "",
      pickupDate: "",
      deliveryDate: "",
      broker: "",
      reference: "",
      pay: "",
    }));
    flash("Load created and assigned.");
    await loadWorkspace();
  }

  async function updateStatus(load, nextStatus) {
    if (
      nextStatus === "loaded" &&
      !documentFor(load.id, "load_photo")
    ) {
      flash("Upload a clear loaded-freight photo first.");
      document.getElementById("load-photo-input")?.click();
      return;
    }

    if (nextStatus === "delivered" && !documentFor(load.id, "pod")) {
      flash("Upload the POD before marking the load delivered.");
      document.getElementById("pod-input")?.click();
      return;
    }

    const { error } = await supabase
      .from("loads")
      .update({
        status: nextStatus,
        is_active: nextStatus !== "delivered",
      })
      .eq("id", load.id);

    if (error) {
      flash(error.message);
      return;
    }

    flash(`Status changed to ${statusLabel(nextStatus)}.`);
    await loadWorkspace();
  }

  async function uploadDocument(load, type, file) {
    if (!file) return;

    const bucket =
      type === "rate_confirmation"
        ? "rate-confirmations"
        : "pod-documents";
    const path = `${load.id}/${crypto.randomUUID()}-${safeFileName(
      file.name
    )}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      flash(uploadError.message);
      return;
    }

    const { error: documentError } = await supabase
      .from("load_documents")
      .insert({
        load_id: load.id,
        document_type: type,
        storage_path: path,
        original_name: file.name,
        uploaded_by: session.user.id,
      });

    if (documentError) {
      flash(documentError.message);
      return;
    }

    flash(
      type === "load_photo"
        ? "Load photo saved. Delivery location unlocked."
        : `${file.name} uploaded securely.`
    );
    await loadWorkspace();
  }

  if (authLoading) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brandMark">G&amp;P</div>
          <p className="eyebrow">G&amp;P LOGISTICS LLC</p>
          <h1>Driver Connect</h1>
          <p className="lead">Loading secure portal…</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brandMark">G&amp;P</div>
          <p className="eyebrow">G&amp;P LOGISTICS LLC</p>
          <h1>Driver Connect</h1>
          <p className="lead">
            Secure loads, paperwork, delivery status and driver pay.
          </p>
          <div className="roleGrid">
            <div className="roleCard">
              <span className="roleIcon" aria-hidden="true">🚚</span>
              <strong>Driver Portal</strong>
              <small>Assigned loads, status updates and POD</small>
            </div>
            <div className="roleCard">
              <span className="roleIcon" aria-hidden="true">💻</span>
              <strong>Dispatch Portal</strong>
              <small>Loads, paperwork and driver pay</small>
            </div>
          </div>

          {notice && <div className="toast">{notice}</div>}

          <form className="panel" onSubmit={handleAuth}>
            <h3>{authMode === "signin" ? "Sign in" : "Create driver account"}</h3>
            <div className="formGrid">
              {authMode === "signup" && (
                <label>
                  Full name
                  <input
                    required
                    value={authForm.fullName}
                    onChange={(event) =>
                      setAuthForm({
                        ...authForm,
                        fullName: event.target.value,
                      })
                    }
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Email
                <input
                  required
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  required
                  minLength={8}
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                  autoComplete={
                    authMode === "signin"
                      ? "current-password"
                      : "new-password"
                  }
                />
              </label>
            </div>
            <button className="primary full" type="submit">
              {authMode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button
              className="secondary full"
              type="button"
              onClick={() =>
                setAuthMode(authMode === "signin" ? "signup" : "signin")
              }
            >
              {authMode === "signin"
                ? "Create a driver account"
                : "Back to sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (workspaceLoading && !profile) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brandMark">G&amp;P</div>
          <h1>Preparing your account…</h1>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brandMark">G&amp;P</div>
          <h1>Account setup needed</h1>
          <p className="lead">
            Your secure profile is not ready yet. Please contact dispatch.
          </p>
          <button className="secondary" onClick={signOut}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  const currentStatusIndex = activeLoad
    ? STATUS_FLOW.indexOf(activeLoad.status)
    : -1;
  const nextStatus =
    currentStatusIndex >= 0 && currentStatusIndex < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentStatusIndex + 1]
      : null;
  const driverProfiles = profiles.filter((item) => item.role === "driver");

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">G&amp;P LOGISTICS LLC</p>
          <h2>Driver Connect</h2>
        </div>
        <div className="topActions">
          <span className="roleBadge">
            {isDispatch ? "💻 Dispatch" : "🚚 Driver"}
          </span>
          <button className="secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {notice && <div className="toast">{notice}</div>}

      {!isDispatch ? (
        <section className="page">
          <div className="pageIntro">
            <div>
              <p className="eyebrow">
                WELCOME, {profile.full_name.toUpperCase()}
              </p>
              <h1>Current Load</h1>
            </div>
            <span className="online">Secure</span>
          </div>

          {!activeLoad ? (
            <div className="emptyState">
              <h3>No active load</h3>
              <p>Dispatch has not assigned a current load.</p>
            </div>
          ) : (
            <article className="loadCard featured">
              <div className="loadHeader">
                <div>
                  <span className="loadNumber">
                    {activeLoad.load_number}
                  </span>
                  <h3>
                    {activeLoad.pickup_location} to{" "}
                    {activeLoad.delivery_unlocked
                      ? activeLoad.delivery_location
                      : "Delivery locked"}
                  </h3>
                </div>
                <span className="status">
                  {statusLabel(activeLoad.status)}
                </span>
              </div>

              <div className="detailsGrid">
                <div>
                  <small>Pickup date</small>
                  <strong>{activeLoad.pickup_date || "—"}</strong>
                </div>
                <div>
                  <small>Delivery date</small>
                  <strong>
                    {activeLoad.delivery_unlocked
                      ? activeLoad.delivery_date || "—"
                      : "Locked"}
                  </strong>
                </div>
                <div>
                  <small>Load number</small>
                  <strong>{activeLoad.load_number}</strong>
                </div>
              </div>

              <div className="sectionBlock">
                <h4>Update Status</h4>
                {nextStatus ? (
                  <button
                    className="primary"
                    onClick={() => updateStatus(activeLoad, nextStatus)}
                  >
                    Mark {statusLabel(nextStatus)}
                  </button>
                ) : (
                  <span className="status">Load completed</span>
                )}
              </div>

              <div className="sectionBlock">
                <h4>Loaded Freight Photo</h4>
                <p className="requirementText">
                  Delivery stays locked until a clear photo of the loaded and
                  secured freight is uploaded.
                </p>
                <label className="uploadBox">
                  <input
                    id="load-photo-input"
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    onChange={(event) =>
                      uploadDocument(
                        activeLoad,
                        "load_photo",
                        event.target.files?.[0]
                      )
                    }
                  />
                  <span aria-hidden="true">PHOTO</span>
                  <strong>
                    {documentFor(activeLoad.id, "load_photo")?.original_name ||
                      "Take a photo of the loaded freight"}
                  </strong>
                  <small>Stored privately in G&amp;P cloud storage</small>
                </label>
              </div>

              <div className="sectionBlock">
                <h4>Proof of Delivery</h4>
                <label className="uploadBox">
                  <input
                    id="pod-input"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    capture="environment"
                    onChange={(event) =>
                      uploadDocument(
                        activeLoad,
                        "pod",
                        event.target.files?.[0]
                      )
                    }
                  />
                  <span aria-hidden="true">POD</span>
                  <strong>
                    {documentFor(activeLoad.id, "pod")?.original_name ||
                      "Upload POD photo or PDF"}
                  </strong>
                  <small>Required before marking the load delivered</small>
                </label>
              </div>
            </article>
          )}
        </section>
      ) : (
        <section className="page">
          <div className="pageIntro">
            <div>
              <p className="eyebrow">OPERATIONS</p>
              <h1>Dispatch Dashboard</h1>
            </div>
            <div className="summaryActions">
              <div className="summaryCard">
                <small>Weekly driver pay</small>
                <strong>{money(weeklyPay)}</strong>
              </div>
              <button className="secondary" onClick={() => loadWorkspace()}>
                Refresh
              </button>
            </div>
          </div>

          <div className="dashboardGrid">
            <form className="panel" onSubmit={createLoad}>
              <h3>Create &amp; Assign Load</h3>
              {driverProfiles.length === 0 && (
                <p className="requirementText">
                  No active drivers yet. Ask a driver to create an account,
                  then promote or activate that profile as needed.
                </p>
              )}
              <div className="formGrid">
                <label>
                  Load number
                  <input
                    value={newLoad.loadNumber}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        loadNumber: event.target.value,
                      })
                    }
                    placeholder="GP-1049"
                  />
                </label>
                <label>
                  Driver
                  <select
                    required
                    value={newLoad.driverId}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        driverId: event.target.value,
                      })
                    }
                  >
                    <option value="">Select driver</option>
                    {driverProfiles.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Pickup
                  <input
                    required
                    value={newLoad.pickup}
                    onChange={(event) =>
                      setNewLoad({ ...newLoad, pickup: event.target.value })
                    }
                    placeholder="City, State"
                  />
                </label>
                <label>
                  Delivery
                  <input
                    required
                    value={newLoad.delivery}
                    onChange={(event) =>
                      setNewLoad({ ...newLoad, delivery: event.target.value })
                    }
                    placeholder="City, State"
                  />
                </label>
                <label>
                  Pickup date
                  <input
                    type="date"
                    value={newLoad.pickupDate}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        pickupDate: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Delivery date
                  <input
                    type="date"
                    value={newLoad.deliveryDate}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        deliveryDate: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Broker
                  <input
                    value={newLoad.broker}
                    onChange={(event) =>
                      setNewLoad({ ...newLoad, broker: event.target.value })
                    }
                  />
                </label>
                <label>
                  Reference
                  <input
                    value={newLoad.reference}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        reference: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Driver pay
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLoad.pay}
                    onChange={(event) =>
                      setNewLoad({ ...newLoad, pay: event.target.value })
                    }
                    placeholder="425.00"
                  />
                </label>
              </div>
              <button
                className="primary full"
                type="submit"
                disabled={driverProfiles.length === 0}
              >
                Create Load
              </button>
            </form>

            <div className="panel">
              <h3>All Loads</h3>
              <div className="loadList">
                {loads.map((load) => (
                  <article className="loadRow" key={load.id}>
                    <div className="loadRowTop">
                      <div>
                        <strong>{load.load_number}</strong>
                        <p>
                          {load.pickup_location} to {load.delivery_location}
                        </p>
                      </div>
                      <span className="status">
                        {statusLabel(load.status)}
                      </span>
                    </div>
                    <div className="miniGrid">
                      <span>
                        <small>Driver</small>
                        {driverName(load.driver_id)}
                      </span>
                      <span>
                        <small>Broker</small>
                        {load.broker_name || "—"}
                      </span>
                      <span>
                        <small>Pay</small>
                        {money(load.driver_pay)}
                      </span>
                      <span>
                        <small>Loaded freight photo</small>
                        {documentFor(load.id, "load_photo")?.original_name ||
                          "Not uploaded"}
                      </span>
                      <span>
                        <small>POD</small>
                        {documentFor(load.id, "pod")?.original_name ||
                          "Not uploaded"}
                      </span>
                      <span>
                        <small>Rate confirmation</small>
                        {documentFor(load.id, "rate_confirmation")
                          ?.original_name || "Not uploaded"}
                      </span>
                    </div>
                    <label className="smallUpload">
                      Upload rate confirmation
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(event) =>
                          uploadDocument(
                            load,
                            "rate_confirmation",
                            event.target.files?.[0]
                          )
                        }
                      />
                    </label>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <footer>&copy; 2026 G&amp;P LOGISTICS LLC</footer>
    </main>
  );
}
