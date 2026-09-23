const tokenKey = "methane_token";
let token = localStorage.getItem(tokenKey) || "";
let role = localStorage.getItem("methane_role") || "";
let view = "board";
let auditSite = "";

const loginBox = document.querySelector("#login");
const appBox = document.querySelector("#app");
const rows = document.querySelector("#rows");
const live = document.querySelector("#live");
const form = document.querySelector("#form");
const viewBoard = document.querySelector("#view-board");
const viewAudit = document.querySelector("#view-audit");
const auditRows = document.querySelector("#audit-rows");
const auditEmpty = document.querySelector("#audit-empty");

function fmtTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function paint(list) {
  rows.innerHTML = list
    .map(
      (r) =>
        `<tr><td>${r.site}</td><td>${r.ch4_pct}</td><td class="${r.level === "报警" ? "alarm" : "ok"}">${r.level}</td><td>${r.note}</td></tr>`,
    )
    .join("");
}

function paintAudit(list) {
  auditRows.innerHTML = list
    .map(
      (r) =>
        `<tr><td>${r.site}</td><td>${r.ch4_pct}</td><td class="${r.level === "报警" ? "alarm" : "ok"}">${r.level}</td><td>${fmtTime(r.pushed_at)}</td><td>${r.online_sockets}</td></tr>`,
    )
    .join("");
  auditEmpty.hidden = list.length > 0;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "请求失败");
  return data;
}

function showView(name) {
  view = name;
  viewBoard.hidden = name !== "board";
  viewAudit.hidden = name !== "audit";
  if (name === "audit") loadAudit();
}

function showApp() {
  loginBox.hidden = true;
  appBox.hidden = false;
  document.querySelector("#who").textContent = role === "writer" ? "检查员" : "查看";
  document.querySelector("#out").hidden = false;
  form.hidden = role !== "writer";
  connect();
  load();
  showView("board");
}

async function load() {
  paint(await api("/api/readings"));
}

async function loadAudit() {
  const qs = auditSite ? `?site=${encodeURIComponent(auditSite)}` : "";
  try {
    paintAudit(await api(`/api/push-audits${qs}`));
  } catch (err) {
    live.textContent = err.message;
  }
}

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/alerts`);
  ws.onmessage = (ev) => {
    const row = JSON.parse(ev.data);
    live.textContent = `刚推送：${row.site} ${row.level}`;
    load();
    if (view === "audit") loadAudit();
  };
}

document.querySelector("#go").onclick = async () => {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: document.querySelector("#user").value,
      password: document.querySelector("#pass").value,
    }),
  });
  token = data.access_token;
  role = data.role;
  localStorage.setItem(tokenKey, token);
  localStorage.setItem("methane_role", role);
  showApp();
};

form.onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/readings", {
      method: "POST",
      body: JSON.stringify({
        site: document.querySelector("#site").value,
        ch4_pct: Number(document.querySelector("#ch4").value),
      }),
    });
  } catch (err) {
    live.textContent = err.message;
  }
};

document.querySelector("#audit-filter").onsubmit = (e) => {
  e.preventDefault();
  auditSite = document.querySelector("#audit-site").value.trim();
  loadAudit();
};

document.querySelector("#audit-clear").onclick = () => {
  auditSite = "";
  document.querySelector("#audit-site").value = "";
  loadAudit();
};

document.querySelector("#nav-board").onclick = () => showView("board");
document.querySelector("#nav-audit").onclick = () => showView("audit");

document.querySelector("#out").onclick = () => {
  localStorage.clear();
  location.reload();
};

if (token) showApp();
