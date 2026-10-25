"use strict";

/*
 * FRONTEND DEMO ONLY:
 * Data is stored in this browser's localStorage.
 * Demo administrator: admin / admin123
 */

const STORAGE = {
  users: "ebrs_users_v1",
  equipment: "ebrs_equipment_v1",
  requests: "ebrs_requests_v1",
  session: "ebrs_session_v1"
};

const DEFAULT_EQUIPMENT = [
  {
    id: "eq-laptop",
    name: "Laptop",
    total: 15,
    icon: "fa-laptop",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "eq-projector",
    name: "Projector",
    total: 8,
    icon: "fa-video-projector",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "eq-camera",
    name: "Camera",
    total: 3,
    icon: "fa-camera",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "eq-tripod",
    name: "Tripod",
    total: 10,
    icon: "fa-camera-retro",
    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500&auto=format&fit=crop&q=80"
  }
];

let currentUser = null;
let currentRequestId = null;
let donutChartInstance = null;
let lineChartInstance = null;
let activeUserSection = "dashboard";
let activeAdminSection = "dashboard";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

function safeParse(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error("Storage read failed:", error);
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    toast("Could not save data. Browser storage may be full or disabled.", "error");
    return false;
  }
}

function users() {
  return safeParse(STORAGE.users, []);
}

function equipment() {
  return safeParse(STORAGE.equipment, DEFAULT_EQUIPMENT);
}

function requests() {
  return safeParse(STORAGE.requests, []);
}

function setUsers(value) {
  return save(STORAGE.users, value);
}

function setEquipment(value) {
  return save(STORAGE.equipment, value);
}

function setRequests(value) {
  return save(STORAGE.requests, value);
}

function uid(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2, 8);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function todayISO() {
  const date = new Date();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

function toast(message, type = "success") {
  const region = $("#toastRegion");

  if (!region) {
    alert(message);
    return;
  }

  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;

  region.appendChild(node);

  window.setTimeout(() => node.remove(), 3500);
}

/* INITIAL DATA */


function seedData() {
  if (!localStorage.getItem(STORAGE.equipment)) {
    save(STORAGE.equipment, DEFAULT_EQUIPMENT);
  }

  if (!localStorage.getItem(STORAGE.users)) {
    save(STORAGE.users, [{
      id: "demo-admin",
      name: "Admin Benarao",
      email: "admin",
      password: "admin123",
      role: "admin",
      createdAt: todayISO()
    }]);
  } else {
    const existing = users();

    let admin = existing.find(user =>
      user.role === "admin" &&
      user.email.toLowerCase() === "admin"
    );

    if (!admin) {
      existing.push({
        id: "demo-admin",
        name: "Admin Benarao",
        email: "admin",
        password: "admin123",
        role: "admin",
        createdAt: todayISO()
      });
    } else {
      admin.name = "Admin Benarao";
    }

    setUsers(existing);
  }

  if (!localStorage.getItem(STORAGE.requests)) {
    save(STORAGE.requests, []);
  }
}


function findUserById(id) {
  return users().find(user => user.id === id);
}

function findEquipmentById(id) {
  return equipment().find(item => item.id === id);
}

function borrowedUnits(itemId) {
  return requests().filter(req =>
    req.equipmentId === itemId &&
    req.status === "Approved"
  ).length;
}

function availableUnits(item) {
  return Math.max(0, Number(item.total) - borrowedUnits(item.id));
}

function statusBadge(status) {
  const classes = {
    Pending: "status-pending",
    Approved: "status-approved",
    Rejected: "status-rejected",
    Returned: "status-returned",
    Cancelled: "status-cancelled"
  };

  return `<span class="status-badge ${classes[status] || ""}">${escapeHTML(status)}</span>`;
}

/* VIEW SWITCHING */

function switchView(viewId) {
  if (
    viewId === "userDashView" &&
    (!currentUser || currentUser.role === "admin")
  ) {
    toast("Please log in with a student or faculty account first.", "error");
    viewId = "loginView";
  }

  if (
    viewId === "adminDashView" &&
    (!currentUser || currentUser.role !== "admin")
  ) {
    toast("Administrator access is required. Log in as admin.", "error");
    viewId = "loginView";
  }

  $$(".view-screen").forEach(view => {
    view.classList.toggle("active", view.id === viewId);
  });

  $$(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });

  if (viewId === "userDashView") {
    renderUserDashboard();
  }

  if (viewId === "adminDashView") {
    renderAdminDashboard();
    window.setTimeout(resizeCharts, 60);
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

/* PASSWORD VISIBILITY */

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);

  if (!input) return;

  const show = input.type === "password";

  input.type = show ? "text" : "password";

  button.innerHTML = `<i class="fa-regular ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;

  button.setAttribute(
    "aria-label",
    show ? "Hide password" : "Show password"
  );
}

/* REGISTRATION */

function handleSignup(event) {
  event.preventDefault();

  const name = $("#signupName").value.trim();
  const email = $("#signupEmail").value.trim().toLowerCase();
  const password = $("#signupPassword").value;
  const confirmation = $("#confirmPassword").value;
  const role = $('input[name="accountType"]:checked').value;

  if (name.length < 2) {
    return toast("Please enter your full name.", "error");
  }

  if (password.length < 6) {
    return toast("Password must be at least 6 characters.", "error");
  }

  if (password !== confirmation) {
    return toast("Passwords do not match.", "error");
  }

  if (users().some(user => user.email.toLowerCase() === email)) {
    return toast("An account with that email already exists.", "error");
  }

  const next = [
    ...users(),
    {
      id: uid("user"),
      name,
      email,
      password,
      role,
      createdAt: todayISO()
    }
  ];

  if (!setUsers(next)) return;

  $("#signupForm").reset();
  $("#loginEmail").value = email;
  $('input[name="loginRole"][value="student"]').checked = true;

  toast("Account created. Please log in.");
  switchView("loginView");
}

/* LOGIN */

function handleLogin(event) {
  event.preventDefault();

  const identifier = $("#loginEmail").value.trim().toLowerCase();
  const password = $("#loginPassword").value;
  const selectedRole = $('input[name="loginRole"]:checked').value;

  const user = users().find(entry =>
    (
      entry.email.toLowerCase() === identifier ||
      entry.name.toLowerCase() === identifier
    ) &&
    entry.password === password &&
    entry.role === selectedRole
  );

  if (!user) {
    return toast(
      "Invalid login details or account type. Please try again.",
      "error"
    );
  }

  currentUser = user;

  if ($("#rememberMe").checked) {
    save(STORAGE.session, { userId: user.id });
    sessionStorage.removeItem(STORAGE.session);
  } else {
    localStorage.removeItem(STORAGE.session);
    sessionStorage.setItem(STORAGE.session, user.id);
  }

  $("#loginPassword").value = "";

  toast(`Welcome, ${user.name}!`);

  switchView(
    user.role === "admin" ? "adminDashView" : "userDashView"
  );
}

function restoreSession() {
  const saved = safeParse(STORAGE.session, null);
  const sessionId = saved?.userId || sessionStorage.getItem(STORAGE.session);

  if (!sessionId) return;

  const user = findUserById(sessionId);

  if (!user) {
    localStorage.removeItem(STORAGE.session);
    sessionStorage.removeItem(STORAGE.session);
    return;
  }

  currentUser = user;

  switchView(
    user.role === "admin" ? "adminDashView" : "userDashView"
  );
}

function logout() {
  currentUser = null;
  currentRequestId = null;

  localStorage.removeItem(STORAGE.session);
  sessionStorage.removeItem(STORAGE.session);

  $("#loginForm").reset();

  switchView("loginView");
  toast("You have logged out.");
}

/* USER DASHBOARD */

function renderUserDashboard() {
  if (!currentUser || currentUser.role === "admin") return;

  $("#userHeaderName").textContent = currentUser.name;

  $("#userHeaderRole").textContent =
    currentUser.role === "faculty" ? "Faculty / Staff" : "Student";

  $("#welcomeHeading").textContent =
    `Hello, ${currentUser.name.split(/\s+/)[0]}! 👋`;

  $("#profileName").textContent = currentUser.name;
  $("#profileEmail").textContent = currentUser.email;

  $("#profileRole").textContent =
    currentUser.role === "faculty" ? "Faculty / Staff" : "Student";

  const mine = requests().filter(req => req.userId === currentUser.id);

  $("#userAvailCount").textContent = equipment().reduce(
    (sum, item) => sum + availableUnits(item),
    0
  );

  $("#userActiveCount").textContent = mine.filter(req =>
    ["Pending", "Approved"].includes(req.status)
  ).length;

  $("#userHistoryCount").textContent = mine.filter(req =>
    ["Returned", "Rejected", "Cancelled"].includes(req.status)
  ).length;

  renderEquipment();
  renderMyRequests();
  renderHistory();
  showUserSection(activeUserSection);
}

function renderEquipment() {
  const query = ($("#userSearch")?.value || "").trim().toLowerCase();

  const items = equipment().filter(item =>
    item.name.toLowerCase().includes(query)
  );

  $("#equipmentGrid").innerHTML = items.map(item => {
    const available = availableUnits(item);

    return `
      <article class="equipment-card" data-id="${escapeHTML(item.id)}">
        <div class="equipment-img-container">
          ${
            item.image
              ? `<img src="${escapeHTML(item.image)}"
                  alt="${escapeHTML(item.name)}"
                  loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">`
              : ""
          }
          <div class="equipment-placeholder ${item.image ? "hidden" : ""}">
            <i class="fa-solid ${escapeHTML(item.icon || "fa-box")}"></i>
          </div>
        </div>

        <div class="equipment-details">
          <h4>${escapeHTML(item.name)}</h4>
          <p class="units">${available} available of ${Number(item.total)} units</p>

          <span class="badge ${available ? "badge-available" : "badge-unavailable"}">
            ${available ? "Available" : "Unavailable"}
          </span>

          <button
            class="btn btn-primary btn-block btn-sm"
            data-borrow="${escapeHTML(item.id)}"
            ${available ? "" : "disabled"}>
            ${available ? "Request" : "Unavailable"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  $("#noEquipmentMessage").classList.toggle("hidden", items.length > 0);
}

/* BORROWING REQUEST FORM */

function openBorrowModal(itemId) {
  const item = findEquipmentById(itemId);

  if (!item || availableUnits(item) < 1) {
    return toast("This equipment is not currently available.", "error");
  }

  $("#borrowForm").reset();

  $("#modalEquipmentId").value = item.id;
  $("#modalEquipmentTitle").textContent = `Borrow ${item.name}`;
  $("#modalEquipmentInput").value = item.name;

  $("#borrowDate").min = todayISO();
  $("#borrowDate").value = todayISO();

  $("#returnDate").min = todayISO();
  $("#returnDate").value = todayISO();

  $("#borrowModal").classList.add("open");
}

function submitBorrowRequest(event) {
  event.preventDefault();

  if (!currentUser || currentUser.role === "admin") {
    return toast(
      "Log in as a student or faculty member to request equipment.",
      "error"
    );
  }

  const itemId = $("#modalEquipmentId").value;
  const item = findEquipmentById(itemId);
  const purpose = $("#borrowPurpose").value.trim();
  const borrowDate = $("#borrowDate").value;
  const returnDate = $("#returnDate").value;

  if (!item || availableUnits(item) < 1) {
    return toast("This equipment is no longer available.", "error");
  }

  if (!purpose) {
    return toast("Please state the purpose of borrowing.", "error");
  }

  if (borrowDate < todayISO()) {
    return toast("Borrow date cannot be in the past.", "error");
  }

  if (returnDate < borrowDate) {
    return toast("Return date must be on or after the borrow date.", "error");
  }

  const duplicate = requests().some(req =>
    req.userId === currentUser.id &&
    req.equipmentId === itemId &&
    ["Pending", "Approved"].includes(req.status)
  );

  if (duplicate) {
    return toast(
      "You already have a pending or approved request for this equipment.",
      "error"
    );
  }

  const next = [
    ...requests(),
    {
      id: uid("req"),
      userId: currentUser.id,
      equipmentId: itemId,
      equipmentName: item.name,
      purpose,
      borrowDate,
      returnDate,
      status: "Pending",
      requestDate: todayISO(),
      returnedOn: null
    }
  ];

  if (!setRequests(next)) return;

  closeModal("borrowModal");
  renderUserDashboard();

  toast("Borrowing request submitted. Awaiting admin review.");
  showUserSection("requests");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

/* USER REQUESTS AND HISTORY */

function renderMyRequests() {
  const mine = requests().filter(req =>
    req.userId === currentUser?.id &&
    ["Pending", "Approved"].includes(req.status)
  );

  $("#myRequestsBody").innerHTML = mine.length
    ? mine.map(req => `
        <tr>
          <td>${escapeHTML(req.equipmentName)}</td>
          <td>${formatDate(req.borrowDate)}</td>
          <td>${formatDate(req.returnDate)}</td>
          <td>${escapeHTML(req.purpose)}</td>
          <td>${statusBadge(req.status)}</td>
          <td>
            ${
              req.status === "Pending"
                ? `<button class="action-btn danger" data-cancel="${escapeHTML(req.id)}">Cancel</button>`
                : "—"
            }
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="6">No active requests yet.</td></tr>`;
}

function renderHistory() {
  const mine = requests()
    .filter(req =>
      req.userId === currentUser?.id &&
      ["Returned", "Rejected", "Cancelled"].includes(req.status)
    )
    .sort((a, b) => b.requestDate.localeCompare(a.requestDate));

  $("#historyBody").innerHTML = mine.length
    ? mine.map(req => `
        <tr>
          <td>${escapeHTML(req.equipmentName)}</td>
          <td>${formatDate(req.borrowDate)}</td>
          <td>${formatDate(req.returnDate)}</td>
          <td>${statusBadge(req.status)}</td>
          <td>${formatDate(req.returnedOn)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5">No completed borrowing history yet.</td></tr>`;
}

function cancelRequest(id) {
  const all = requests();

  const req = all.find(item =>
    item.id === id && item.userId === currentUser?.id
  );

  if (!req || req.status !== "Pending") {
    return toast("Only pending requests can be cancelled.", "error");
  }

  req.status = "Cancelled";

  if (setRequests(all)) {
    renderUserDashboard();
    toast("Request cancelled.");
  }
}

function showUserSection(section) {
  activeUserSection = section;

  const map = {
    dashboard: "userDashboardSection",
    equipment: "equipmentSection",
    requests: "requestsSection",
    history: "historySection",
    profile: "profileSection"
  };

  $$(".user-section").forEach(node => {
    node.classList.toggle("hidden", node.id !== map[section]);
  });

  $$("[data-user-section]").forEach(link => {
    link.closest("li").classList.toggle(
      "active",
      link.dataset.userSection === section
    );
  });

  if (section === "equipment") renderEquipment();
}

/* ADMIN DASHBOARD */

function renderAdminDashboard() {
  if (!currentUser || currentUser.role !== "admin") return;

  $("#adminHeaderName").textContent = currentUser.name;

  const items = equipment();
  const all = requests();

  const total = items.reduce(
    (sum, item) => sum + Number(item.total),
    0
  );

  const borrowed = all.filter(req => req.status === "Approved").length;
  const pending = all.filter(req => req.status === "Pending").length;

  const overdue = all.filter(req =>
    req.status === "Approved" &&
    req.returnDate < todayISO()
  ).length;

  $("#totalEquipmentStat").textContent = total;
  $("#borrowedStat").textContent = borrowed;
  $("#pendingStat").textContent = pending;
  $("#overdueStat").textContent = overdue;
  $("#pendingBadge").textContent = pending;

  renderAdminRequests();
  renderAdminEquipment();
  renderReturns();
  renderUsers();

  $("#reportSummary").textContent =
    `${all.length} total requests · ${pending} pending · ` +
    `${all.filter(req => req.status === "Approved").length} approved and not yet returned · ` +
    `${all.filter(req => req.status === "Returned").length} returned · ` +
    `${all.filter(req => req.status === "Rejected").length} rejected.`;

  renderCharts();
  showAdminSection(activeAdminSection);
}

function renderAdminRequests() {
  const query = ($("#adminSearch")?.value || "").trim().toLowerCase();

  const all = requests()
    .filter(req => {
      const user = findUserById(req.userId);

      return `${user?.name || "Unknown"} ${user?.email || ""} ${req.equipmentName} ${req.status}`
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => b.requestDate.localeCompare(a.requestDate));

  $("#requestsTableBody").innerHTML = all.length
    ? all.map(req => {
        const user = findUserById(req.userId);

        return `
          <tr>
            <td>
              ${escapeHTML(user?.name || "Unknown user")}<br>
              <span class="small-muted">${escapeHTML(user?.email || "")}</span>
            </td>
            <td>${escapeHTML(req.equipmentName)}</td>
            <td>${formatDate(req.requestDate)}</td>
            <td>${formatDate(req.borrowDate)}<br>to ${formatDate(req.returnDate)}</td>
            <td>${statusBadge(req.status)}</td>
            <td>
              <button class="action-btn" data-review="${escapeHTML(req.id)}">View</button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="6">No borrowing requests found.</td></tr>`;
}

function renderAdminEquipment() {
  const all = equipment();

  $("#adminEquipmentBody").innerHTML = all.map(item => `
    <tr>
      <td>${escapeHTML(item.name)}</td>
      <td>${Number(item.total)}</td>
      <td>${availableUnits(item)}</td>
      <td>${borrowedUnits(item.id)}</td>
      <td>
        <button class="action-btn danger" data-delete-equipment="${escapeHTML(item.id)}">Delete</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5">No equipment added.</td></tr>`;
}

function renderReturns() {
  const all = requests()
    .filter(req => req.status === "Returned")
    .sort((a, b) => (b.returnedOn || "").localeCompare(a.returnedOn || ""));

  $("#returnsBody").innerHTML = all.length
    ? all.map(req => `
        <tr>
          <td>${escapeHTML(findUserById(req.userId)?.name || "Unknown user")}</td>
          <td>${escapeHTML(req.equipmentName)}</td>
          <td>${formatDate(req.borrowDate)}</td>
          <td>${formatDate(req.returnDate)}</td>
          <td>${formatDate(req.returnedOn)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5">No return records yet.</td></tr>`;
}

function renderUsers() {
  const all = users().filter(user => user.role !== "admin");

  $("#usersBody").innerHTML = all.length
    ? all.map(user => `
        <tr>
          <td>${escapeHTML(user.name)}</td>
          <td>${escapeHTML(user.email)}</td>
          <td>${user.role === "faculty" ? "Faculty / Staff" : "Student"}</td>
          <td>${formatDate(user.createdAt)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4">No registered users yet.</td></tr>`;
}

function showAdminSection(section) {
  activeAdminSection = section;

  const map = {
    dashboard: "adminDashboardSection",
    requests: "adminRequestsSection",
    equipment: "adminEquipmentSection",
    returns: "adminReturnsSection",
    users: "adminUsersSection",
    reports: "adminReportsSection"
  };

  $$(".admin-section").forEach(node => {
    node.classList.toggle("hidden", node.id !== map[section]);
  });

  $$("[data-admin-section]").forEach(link => {
    link.closest("li").classList.toggle(
      "active",
      link.dataset.adminSection === section
    );
  });

  if (section === "requests") renderAdminRequests();
  if (section === "equipment") renderAdminEquipment();
  if (section === "returns") renderReturns();
  if (section === "users") renderUsers();
}

/* ADMIN REQUEST REVIEW */

function reviewRequest(id) {
  const req = requests().find(item => item.id === id);

  if (!req) return;

  currentRequestId = id;

  const user = findUserById(req.userId);

  $("#adminModalUser").textContent = user
    ? `${user.name} (${user.email})`
    : "Unknown user";

  $("#adminModalItem").textContent = req.equipmentName;
  $("#adminModalPurpose").textContent = req.purpose;
  $("#adminModalBorrow").textContent = formatDate(req.borrowDate);
  $("#adminModalReturn").textContent = formatDate(req.returnDate);
  $("#adminModalStatus").textContent = req.status;

  $("#approveBtn").classList.toggle("hidden", req.status !== "Pending");
  $("#rejectBtn").classList.toggle("hidden", req.status !== "Pending");

  $("#markReturnedBtn").classList.toggle(
    "hidden",
    req.status !== "Approved"
  );

  $("#adminModal").classList.add("open");
}

function updateRequestStatus(status) {
  if (!currentRequestId) return;

  const all = requests();
  const req = all.find(item => item.id === currentRequestId);

  if (!req) return closeModal("adminModal");

  if (req.status !== "Pending") {
    return toast("This request has already been reviewed.", "error");
  }

  if (status === "Approved") {
    const item = findEquipmentById(req.equipmentId);

    if (!item || availableUnits(item) < 1) {
      return toast("No available units remain for this item.", "error");
    }
  }

  req.status = status;

  if (setRequests(all)) {
    closeModal("adminModal");
    renderAdminDashboard();
    toast(`Request ${status.toLowerCase()}.`);
  }
}

function markReturned() {
  if (!currentRequestId) return;

  const all = requests();
  const req = all.find(item => item.id === currentRequestId);

  if (!req || req.status !== "Approved") {
    return toast("Only approved requests can be marked returned.", "error");
  }

  req.status = "Returned";
  req.returnedOn = todayISO();

  if (setRequests(all)) {
    closeModal("adminModal");
    renderAdminDashboard();
    toast("Equipment marked as returned.");
  }
}

/* EQUIPMENT MANAGEMENT */

function addEquipment(event) {
  event.preventDefault();

  const name = $("#newEquipmentName").value.trim();
  const total = Number($("#newEquipmentUnits").value);

  if (!name || !Number.isInteger(total) || total < 1) {
    return toast("Enter an equipment name and a valid unit count.", "error");
  }

  if (equipment().some(item =>
    item.name.toLowerCase() === name.toLowerCase()
  )) {
    return toast("That equipment already exists.", "error");
  }

  const all = [
    ...equipment(),
    {
      id: uid("eq"),
      name,
      total,
      icon: "fa-box",
      image: ""
    }
  ];

  if (setEquipment(all)) {
    event.target.reset();
    renderAdminDashboard();
    toast("Equipment added.");
  }
}

function deleteEquipment(id) {
  const item = findEquipmentById(id);

  if (!item) return;

  if (requests().some(req =>
    req.equipmentId === id && req.status === "Approved"
  )) {
    return toast(
      "Cannot delete equipment with an active borrowing. Mark it returned first.",
      "error"
    );
  }

  if (!confirm(`Delete "${item.name}" from the equipment catalog? Past request records will remain.`)) {
    return;
  }

  if (setEquipment(equipment().filter(entry => entry.id !== id))) {
    renderAdminDashboard();
    toast("Equipment deleted.");
  }
}

/* CSV REPORT EXPORT */

function exportRequestsCSV() {
  const rows = [[
    "Request ID",
    "User",
    "Email",
    "Equipment",
    "Purpose",
    "Request Date",
    "Borrow Date",
    "Return Date",
    "Status",
    "Returned On"
  ]];

  requests().forEach(req => {
    const user = findUserById(req.userId);

    rows.push([
      req.id,
      user?.name || "Unknown",
      user?.email || "",
      req.equipmentName,
      req.purpose,
      req.requestDate,
      req.borrowDate,
      req.returnDate,
      req.status,
      req.returnedOn || ""
    ]);
  });

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = "equipment-borrowing-requests.csv";
  link.click();

  URL.revokeObjectURL(url);
}

/* ADMIN CHARTS */

function renderCharts() {
  if (typeof Chart === "undefined") return;

  const items = equipment();

  const statusData = [
    items.reduce((sum, item) => sum + availableUnits(item), 0),
    items.reduce((sum, item) => sum + borrowedUnits(item.id), 0),
    0
  ];

  const all = requests();
  const monthNames = [];
  const monthValues = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    const key =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    monthNames.push(
      date.toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit"
      })
    );

    monthValues.push(
      all.filter(req => req.requestDate?.startsWith(key)).length
    );
  }

  const statusCanvas = $("#statusChart");
  const trendCanvas = $("#trendsChart");

  if (statusCanvas) {
    if (donutChartInstance) donutChartInstance.destroy();

    donutChartInstance = new Chart(statusCanvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Available", "Borrowed", "Other / removed"],
        datasets: [{
          data: statusData,
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"],
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 12,
              font: { size: 11 }
            }
          }
        },
        cutout: "70%"
      }
    });
  }

  if (trendCanvas) {
    if (lineChartInstance) lineChartInstance.destroy();

    lineChartInstance = new Chart(trendCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels: monthNames,
        datasets: [{
          label: "Requests",
          data: monthValues,
          borderColor: "#1d61e7",
          backgroundColor: "rgba(29,97,231,.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }
}

function resizeCharts() {
  if (donutChartInstance) donutChartInstance.resize();
  if (lineChartInstance) lineChartInstance.resize();
}

/* INITIALIZE THE APPLICATION */

document.addEventListener("DOMContentLoaded", () => {
  seedData();

  $("#loginForm").addEventListener("submit", handleLogin);
  $("#signupForm").addEventListener("submit", handleSignup);
  $("#borrowForm").addEventListener("submit", submitBorrowRequest);
  $("#equipmentForm").addEventListener("submit", addEquipment);

  $("#userSearch").addEventListener("input", renderEquipment);
  $("#adminSearch").addEventListener("input", renderAdminRequests);

  $("#userLogout").addEventListener("click", event => {
    event.preventDefault();
    logout();
  });

  $("#adminLogout").addEventListener("click", event => {
    event.preventDefault();
    logout();
  });

  $("#approveBtn").addEventListener("click", () => {
    updateRequestStatus("Approved");
  });

  $("#rejectBtn").addEventListener("click", () => {
    updateRequestStatus("Rejected");
  });

  $("#markReturnedBtn").addEventListener("click", markReturned);
  $("#exportCsvBtn").addEventListener("click", exportRequestsCSV);

  $("#forgotLink").addEventListener("click", event => {
    event.preventDefault();

    toast(
      "Password reset is not implemented in this browser demo.",
      "error"
    );
  });

  $$(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
      switchView(button.dataset.view);
    });
  });

  $$("[data-go]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      switchView(link.dataset.go);
    });
  });

  $$("[data-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      togglePasswordVisibility(button.dataset.toggle, button);
    });
  });

  $$("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal(button.dataset.close);
    });
  });

  $$(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeModal(overlay.id);
    });
  });

  $$("[data-user-section]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      showUserSection(link.dataset.userSection);

      if (window.innerWidth <= 900) {
        $("#userDashView .sidebar").classList.remove("mobile-open");
      }
    });
  });

  $$("[data-admin-section]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      showAdminSection(link.dataset.adminSection);

      if (window.innerWidth <= 900) {
        $("#adminDashView .sidebar").classList.remove("mobile-open");
      }
    });
  });

  document.addEventListener("click", event => {
    const borrow = event.target.closest("[data-borrow]");
    if (borrow) openBorrowModal(borrow.dataset.borrow);

    const cancel = event.target.closest("[data-cancel]");
    if (cancel) cancelRequest(cancel.dataset.cancel);

    const review = event.target.closest("[data-review]");
    if (review) reviewRequest(review.dataset.review);

    const remove = event.target.closest("[data-delete-equipment]");
    if (remove) deleteEquipment(remove.dataset.deleteEquipment);
  });

  $$(".menu-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const sidebar = button.closest(".dashboard-layout").querySelector(".sidebar");
      sidebar.classList.toggle("mobile-open");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$(".modal-overlay.open").forEach(modal => closeModal(modal.id));
    }
  });

  restoreSession();
});
