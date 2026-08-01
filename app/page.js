"use client";

import { useEffect, useMemo, useState } from "react";

const DRIVERS = [
  { id: "driver-1", name: "Carlos Martinez" },
  { id: "driver-2", name: "Michael Johnson" },
  { id: "driver-3", name: "David Williams" }
];

const INITIAL_LOADS = [
  {
    id: "GP-1048",
    driverId: "driver-1",
    driver: "Carlos Martinez",
    pickup: "Dallas, TX",
    delivery: "Atlanta, GA",
    pickupDate: "2026-08-01",
    deliveryDate: "2026-08-02",
    broker: "Demo Freight Brokerage",
    reference: "RC-78124",
    status: "In Transit",
    pay: 425,
    active: true,
    podName: "",
    loadPhotoName: "",
    rateConName: "GP-1048-rate-confirmation.pdf"
  },
  {
    id: "GP-1047",
    driverId: "driver-1",
    driver: "Carlos Martinez",
    pickup: "Houston, TX",
    delivery: "Memphis, TN",
    pickupDate: "2026-07-28",
    deliveryDate: "2026-07-29",
    broker: "Sample Logistics",
    reference: "RC-77910",
    status: "Delivered",
    pay: 390,
    active: false,
    podName: "GP-1047-POD.jpg",
    loadPhotoName: "GP-1047-loaded-freight.jpg",
    rateConName: "GP-1047-rate-confirmation.pdf"
  }
];

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

export default function Home() {
  const [role, setRole] = useState("");
  const [loads, setLoads] = useState(INITIAL_LOADS);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [newLoad, setNewLoad] = useState({
    id: "",
    driverId: DRIVERS[0].id,
    pickup: "",
    delivery: "",
    pickupDate: "",
    deliveryDate: "",
    broker: "",
    reference: "",
    pay: ""
  });

  useEffect(() => {
    const saved = window.localStorage.getItem("gp-driver-connect-loads");
    if (saved) {
      try {
        setLoads(JSON.parse(saved));
      } catch {
        setLoads(INITIAL_LOADS);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(
        "gp-driver-connect-loads",
        JSON.stringify(loads)
      );
    }
  }, [loads, hydrated]);

  const activeLoad = loads.find(
    (load) => load.driverId === "driver-1" && load.active
  );

  const weeklyPay = useMemo(
    () => loads.reduce((sum, load) => sum + Number(load.pay || 0), 0),
    [loads]
  );

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function updateLoad(id, patch) {
    setLoads((current) =>
      current.map((load) => (load.id === id ? { ...load, ...patch } : load))
    );
  }

  function handleFile(id, field, file) {
    if (!file) return;
    updateLoad(id, { [field]: file.name });
    flash(`${file.name} selected. Cloud upload will be enabled with Supabase.`);
  }

  function createLoad(event) {
    event.preventDefault();

    const driver = DRIVERS.find((item) => item.id === newLoad.driverId);
    const id =
      newLoad.id.trim() ||
      `GP-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = {
      ...newLoad,
      id,
      driver: driver.name,
      pay: Number(newLoad.pay || 0),
      status: "Assigned",
      active: true,
      podName: "",
      loadPhotoName: "",
      rateConName: ""
    };

    setLoads((current) => [
      created,
      ...current.map((load) =>
        load.driverId === newLoad.driverId
          ? { ...load, active: false }
          : load
      )
    ]);

    setNewLoad({
      id: "",
      driverId: DRIVERS[0].id,
      pickup: "",
      delivery: "",
      pickupDate: "",
      deliveryDate: "",
      broker: "",
      reference: "",
      pay: ""
    });

    flash(`${id} assigned to ${driver.name}.`);
  }

  function resetDemo() {
    setLoads(INITIAL_LOADS);
    flash("Demo data restored.");
  }

  if (!role) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brandMark">G&amp;P</div>
          <p className="eyebrow">G&amp;P LOGISTICS LLC</p>
          <h1>Driver Connect</h1>
          <p className="lead">
            Loads, paperwork, delivery status and driver pay in one place.
          </p>

          <div className="roleGrid">
            <button className="roleCard" onClick={() => setRole("driver")}>
              <span className="roleIcon">🚚</span>
              <strong>Driver Portal</strong>
              <small>Current load, status updates and POD</small>
            </button>

            <button className="roleCard" onClick={() => setRole("dispatch")}>
              <span className="roleIcon">🖥️</span>
              <strong>Dispatch Portal</strong>
              <small>Assign loads, paperwork and driver pay</small>
            </button>
          </div>

          <p className="demoNote">
            Working demo mode. Secure accounts and permanent uploads are connected next.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">G&amp;P LOGISTICS LLC</p>
          <h2>Driver Connect</h2>
        </div>

        <div className="topActions">
          <span className="roleBadge">
            {role === "driver" ? "Driver" : "Dispatch"}
          </span>
          <button className="secondary" onClick={() => setRole("")}>
            Sign out
          </button>
        </div>
      </header>

      {notice && <div className="toast">{notice}</div>}

      {role === "driver" ? (
        <section className="page">
          <div className="pageIntro">
            <div>
              <p className="eyebrow">WELCOME, CARLOS</p>
              <h1>Current Load</h1>
            </div>
            <span className="online">● Online</span>
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
                  <span className="loadNumber">{activeLoad.id}</span>
                  <h3>
                    {activeLoad.pickup} → {activeLoad.loadPhotoName && ["Loaded", "In Transit", "Delivered"].includes(activeLoad.status) ? activeLoad.delivery : "Delivery locked"}
                  </h3>
                </div>
                <span className="status">{activeLoad.status}</span>
              </div>

              <div className="detailsGrid">
                <div>
                  <small>Pickup</small>
                  <strong>{activeLoad.pickupDate}</strong>
                </div>
                <div>
                  <small>Delivery</small>
                  <strong>{activeLoad.loadPhotoName && ["Loaded", "In Transit", "Delivered"].includes(activeLoad.status) ? activeLoad.deliveryDate : "Locked"}</strong>
                </div>
                <div>
                  <small>Broker</small>
                  <strong>{activeLoad.broker}</strong>
                </div>
                <div>
                  <small>Reference</small>
                  <strong>{activeLoad.reference}</strong>
                </div>
              </div>

              <div className="sectionBlock">
                <h4>Update Status</h4>
                <div className="statusButtons">
                  {["Arrived", "Loaded", "In Transit", "Delivered"].map(
                    (status) => (
                      <button
                        key={status}
                        className={
                          activeLoad.status === status ? "primary" : "secondary"
                        }
                        onClick={() => {
                          if (status === "Loaded" && !activeLoad.loadPhotoName) {
                            flash("Take a clear photo of the loaded freight first.");
                            document.getElementById("load-photo-input")?.click();
                            return;
                          }

                          if (
                            (status === "In Transit" || status === "Delivered") &&
                            !activeLoad.loadPhotoName
                          ) {
                            flash("The loaded-freight photo is required first.");
                            return;
                          }

                          updateLoad(activeLoad.id, {
                            status,
                            active: status !== "Delivered"
                          });
                          flash(`Status changed to ${status}.`);
                        }}
                      >
                        {status}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="sectionBlock">
                <h4>Loaded Freight Photo</h4>
                <p className="requirementText">
                  The delivery location stays locked until a clear photo of the loaded and secured freight is uploaded.
                </p>
                <label className="uploadBox">
                  <input
                    id="load-photo-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      updateLoad(activeLoad.id, {
                        loadPhotoName: file.name,
                        status: "Loaded"
                      });
                      flash("Load photo saved. Delivery location unlocked.");
                    }}
                  />
                  <span>📸</span>
                  <strong>
                    {activeLoad.loadPhotoName || "Take a photo of the loaded freight"}
                  </strong>
                  <small>Required before the delivery location is shown</small>
                </label>
              </div>

              <div className="sectionBlock">
                <h4>Proof of Delivery</h4>
                <label className="uploadBox">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      handleFile(
                        activeLoad.id,
                        "podName",
                        event.target.files?.[0]
                      )
                    }
                  />
                  <span>📷</span>
                  <strong>
                    {activeLoad.podName || "Upload POD photo or PDF"}
                  </strong>
                  <small>Tap to choose a file from your phone</small>
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
              <button className="secondary" onClick={resetDemo}>
                Reset demo
              </button>
            </div>
          </div>

          <div className="dashboardGrid">
            <form className="panel" onSubmit={createLoad}>
              <h3>Create &amp; Assign Load</h3>

              <div className="formGrid">
                <label>
                  Load number
                  <input
                    value={newLoad.id}
                    onChange={(event) =>
                      setNewLoad({ ...newLoad, id: event.target.value })
                    }
                    placeholder="GP-1049"
                  />
                </label>

                <label>
                  Driver
                  <select
                    value={newLoad.driverId}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        driverId: event.target.value
                      })
                    }
                  >
                    {DRIVERS.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
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
                      setNewLoad({
                        ...newLoad,
                        pickup: event.target.value
                      })
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
                      setNewLoad({
                        ...newLoad,
                        delivery: event.target.value
                      })
                    }
                    placeholder="City, State"
                  />
                </label>

                <label>
                  Pickup date
                  <input
                    type="date"
                    required
                    value={newLoad.pickupDate}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        pickupDate: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Delivery date
                  <input
                    type="date"
                    required
                    value={newLoad.deliveryDate}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        deliveryDate: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Broker
                  <input
                    value={newLoad.broker}
                    onChange={(event) =>
                      setNewLoad({
                        ...newLoad,
                        broker: event.target.value
                      })
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
                        reference: event.target.value
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
                      setNewLoad({
                        ...newLoad,
                        pay: event.target.value
                      })
                    }
                    placeholder="425.00"
                  />
                </label>
              </div>

              <button className="primary full" type="submit">
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
                        <strong>{load.id}</strong>
                        <p>
                          {load.pickup} → {load.delivery}
                        </p>
                      </div>
                      <span className="status">{load.status}</span>
                    </div>

                    <div className="miniGrid">
                      <span>
                        <small>Driver</small>
                        {load.driver}
                      </span>
                      <span>
                        <small>Pay</small>
                        {money(load.pay)}
                      </span>
                      <span>
                        <small>Loaded freight photo</small>
                        {load.loadPhotoName || "Not uploaded"}
                      </span>
                      <span>
                        <small>POD</small>
                        {load.podName || "Not uploaded"}
                      </span>
                      <span>
                        <small>Rate confirmation</small>
                        {load.rateConName || "Not uploaded"}
                      </span>
                    </div>

                    <label className="smallUpload">
                      Upload rate confirmation
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(event) =>
                          handleFile(
                            load.id,
                            "rateConName",
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

      <footer>© 2026 G&amp;P LOGISTICS LLC</footer>
    </main>
  );
}
