const tokenKey = "methane_token";
let token = localStorage.getItem(tokenKey) || "";
let role = localStorage.getItem("methane_role") || "";
let view = "readings";

const loginBox = document.querySelector("#login");
const appBox = document.querySelector("#app");
const auditsBox = document.querySelector("#audits");
const rows = document.querySelector("#rows");
const auditRows = document.querySelector("#audit-rows");
const auditEmpty = document.querySelector("#audit-empty");
const live = document.querySelector("#live");
const form = document.querySelector("#form");

function paint(list) {
  rows.innerHTML = list
    .map(
      (r) =>
        `<tr><td>${r.site}</td><td>${r.ch4_pct}</td><td class="${r.level === "报警" ? "alarm" : "ok"}">${r.level}</td><td>${r.note}</td></tr>`,
    )
    .join("");
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function paintAudits(list) {
  auditRows.innerHTML = list
    .map(
      (a) =>
        `<tr><td>${a.site}</td><td class="alarm">${a.ch4_pct}</td><td>${fmtTime(a.pushed_at)}</td><td>${a.online_sockets}</td><td>${a.pushed_by}</td></tr>`,
    )
    .join("");
  auditEmpty.textContent = list.length ? "" : "没有匹配的推送审计";
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

async function loadReadings() {
  paint(await api("/api/readings"));
}

async function loadAudits() {
  const site = document.querySelector("#audit-site").value.trim();
  const qs = site ? `?${new URLSearchParams({ site })}` : "";
  paintAudits(await api(`/api/push-audits${qs}`));
}

function showView(next) {
  view = next;
  appBox.hidden = view !== "readings";
  auditsBox.hidden = view !== "audits";
  document.querySelector("#nav-readings").classList.toggle("active", view === "readings");
  document.querySelector("#nav-audits").classList.toggle("active", view === "audits");
  if (view === "readings") loadReadings();
  else loadAudits();
}

function showApp() {
  loginBox.hidden = true;
  document.querySelector("#nav").hidden = false;
  document.querySelector("#who").textContent = role === "writer" ? "检查员" : "查看";
  document.querySelector("#out").hidden = false;
  form.hidden = role !== "writer";
  connect();
  showView("readings");
}

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/alerts`);
  ws.onmessage = (ev) => {
    const row = JSON.parse(ev.data);
    live.textContent = `刚推送：${row.site} ${row.level}`;
    if (view === "readings") loadReadings();
    else if (row.level === "报警") loadAudits();
  };
}

document.querySelector("#nav-readings").onclick = () => showView("readings");
document.querySelector("#nav-audits").onclick = () => showView("audits");

document.querySelector("#audit-filter").onsubmit = (e) => {
  e.preventDefault();
  loadAudits();
};

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

document.querySelector("#out").onclick = () => {
  localStorage.clear();
  location.reload();
};

if (token) showApp();
