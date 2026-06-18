const API = '';
const API_KEY_STORAGE = 'sangfor_api_key';
let selectedFile = null;

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

function setApiKey(key) {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const key = getApiKey();
  if (key) headers.set('X-API-Key', key);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(API + url, { ...options, headers });
  if (res.status === 401) {
    console.warn('API auth failed — set X-API-Key via API Key button');
  }
  return res;
}

async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function switchTab(tabName, el) {
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  if (el) el.classList.add('active');
  if (tabName === 'autoops') {
    loadDeviceHealth();
    loadApprovals();
  }
}

function openSettingsModal() {
  document.getElementById('apiKeyInput').value = getApiKey();
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function saveApiKey() {
  setApiKey(document.getElementById('apiKeyInput').value.trim());
  closeSettingsModal();
  loadDashboard();
  loadSchedules();
  loadAccessRequests();
  alert('API key saved');
}

async function loadSystemHealth() {
  try {
    const health = await fetch(API + '/api/system/health').then((r) => r.json());
    const badge = document.getElementById('systemBadge');
    badge.textContent = health.status === 'ok' ? 'Healthy' : 'Degraded';
    badge.className = 'badge' + (health.status === 'ok' ? '' : ' error');

    const mcpBadge = document.getElementById('mcpBadge');
    mcpBadge.textContent = health.mcpConnected ? 'MCP OK' : 'MCP Stub';
    mcpBadge.className = 'badge mcp' + (health.mcpConnected ? ' ok' : '');

    const uptimeSec = Math.floor(health.uptime || 0);
    const uptimeMin = Math.floor(uptimeSec / 60);
    document.getElementById('uptime').textContent =
      `Uptime: ${uptimeMin}m | MCP: ${health.mcpConnected ? 'connected' : 'offline'}`;
  } catch {
    document.getElementById('systemBadge').textContent = 'Unreachable';
    document.getElementById('systemBadge').className = 'badge error';
  }
}

async function loadDashboard() {
  try {
    const stats = await fetch(API + '/api/dashboard/stats').then((r) => r.json());
    let workflows = [];
    let templates = [];

    try {
      workflows = await apiJson('/api/workflows');
      templates = await apiJson('/api/templates');
    } catch (error) {
      console.warn('Protected dashboard data unavailable:', error.message);
    }

    document.getElementById('totalWorkflows').textContent = stats.totalWorkflows;
    document.getElementById('completedWorkflows').textContent = stats.completedWorkflows;
    document.getElementById('runningWorkflows').textContent = stats.runningWorkflows;
    document.getElementById('totalSteps').textContent = stats.totalStepsExecuted;

    const list = document.getElementById('workflowList');
    list.innerHTML = workflows.map((w) => `
      <div class="workflow-item" onclick="showDetail('${w.id}')">
        <div class="info">
          <div class="name">${escapeHtml(w.name)}</div>
          <div class="meta">${w.stepsCount || '-'} steps | Progress: ${w.progress}%</div>
        </div>
        <span class="status ${w.status}">${w.status}</span>
      </div>
    `).join('') || '<div style="color:#64748b;text-align:center;padding:20px;">No workflows yet. Create one!</div>';

    const grid = document.getElementById('templateGrid');
    grid.innerHTML = templates.map((t) => `
      <div class="template-card" onclick="createFromTemplate('${t.id}')">
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="desc">${escapeHtml(t.description)}</div>
        <div class="tags">${t.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}

async function showDetail(id) {
  const data = await apiJson('/api/workflows/' + id);
  document.getElementById('detailTitle').textContent = data.workflow.name;

  let html = '<div style="margin-bottom:12px"><strong>Status:</strong> <span class="status ' + data.workflow.status + '">' + data.workflow.status + '</span></div>';
  html += '<div style="margin-bottom:12px"><strong>Customer:</strong> ' + escapeHtml(data.workflow.customerProfile.customerName) + '</div>';
  html += '<div style="margin-bottom:12px"><strong>Products:</strong> ' + escapeHtml(data.workflow.customerProfile.products.join(', ')) + '</div>';

  if (data.workflow.customerProfile.requirements.length > 0) {
    html += '<div style="margin-bottom:12px"><strong>Requirements:</strong><ul style="margin-top:4px;padding-left:20px">';
    data.workflow.customerProfile.requirements.forEach((r) => {
      html += '<li style="font-size:13px;color:#94a3b8;margin-top:2px">' + escapeHtml(r.text) + '</li>';
    });
    html += '</ul></div>';
  }

  html += '<div style="margin-bottom:12px"><strong>Steps:</strong></div><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px">';
  data.workflow.steps.forEach((s) => {
    const icon = s.status === 'completed' ? '✅' : s.status === 'failed' ? '❌' : s.status === 'running' ? '⏳' : '⏸️';
    html += '<div style="font-size:13px;display:flex;gap:8px;align-items:center"><span>' + icon + '</span><span>' + escapeHtml(s.name) + '</span></div>';
  });
  html += '</div>';

  document.getElementById('detailContent').innerHTML = html;

  let actions = '<button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>';
  if (data.workflow.status === 'draft') {
    actions = '<button class="btn btn-success" onclick="approveWorkflow(\'' + id + '\')">Approve</button><button class="btn btn-danger" onclick="rejectWorkflow(\'' + id + '\')">Reject</button>' + actions;
  } else if (data.workflow.status === 'approved') {
    actions = '<button class="btn btn-primary" onclick="executeWorkflow(\'' + id + '\')">Execute</button>' + actions;
  }
  document.getElementById('detailActions').innerHTML = actions;
  document.getElementById('detailModal').classList.add('active');
}

function openGenerateModal() { document.getElementById('generateModal').classList.add('active'); }

function closeModal() {
  document.getElementById('generateModal').classList.remove('active');
  document.getElementById('customerName').value = '';
  document.getElementById('environment').value = 'customer';
  document.querySelectorAll('input[name="products"]').forEach((cb) => { cb.checked = false; });
  document.getElementById('fileName').textContent = '';
  selectedFile = null;
  document.getElementById('requirementList').innerHTML = `
    <div class="requirement-item">
      <input type="text" placeholder="Enter requirement">
      <button class="btn btn-danger" onclick="removeRequirement(this)">✕</button>
    </div>`;
}

function closeDetailModal() { document.getElementById('detailModal').classList.remove('active'); }

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileUpload').classList.add('active');
  }
}

function addRequirement() {
  const list = document.getElementById('requirementList');
  const item = document.createElement('div');
  item.className = 'requirement-item';
  item.innerHTML = `<input type="text" placeholder="Enter requirement"><button class="btn btn-danger" onclick="removeRequirement(this)">✕</button>`;
  list.appendChild(item);
}

function removeRequirement(btn) {
  const list = document.getElementById('requirementList');
  if (list.children.length > 1) btn.parentElement.remove();
}

function getRequirements() {
  return Array.from(document.querySelectorAll('#requirementList input')).map((i) => i.value.trim()).filter(Boolean);
}

function getSelectedProducts() {
  return Array.from(document.querySelectorAll('input[name="products"]:checked')).map((cb) => cb.value);
}

async function generateWorkflow() {
  const name = document.getElementById('customerName').value.trim();
  if (!name) { alert('Customer name is required'); return; }

  let excelFilePath = '';
  if (selectedFile) {
    const formData = new FormData();
    formData.append('excel', selectedFile);
    const upload = await apiFetch('/api/workflows/upload-excel', { method: 'POST', body: formData });
    const uploadData = await upload.json();
    if (!upload.ok) { alert(uploadData.error || 'Excel upload failed'); return; }
    excelFilePath = uploadData.filePath;
  }

  const result = await apiJson('/api/workflows/generate', {
    method: 'POST',
    body: JSON.stringify({
      customerName: name,
      excelFilePath,
      requirements: getRequirements(),
      environment: document.getElementById('environment').value,
      products: getSelectedProducts().length > 0 ? getSelectedProducts() : undefined,
    }),
  });

  closeModal();
  alert('Workflow created: ' + result.name + ' (' + result.steps + ' steps)');
  loadDashboard();
}

async function createFromTemplate(templateId) {
  const name = prompt('Customer name:');
  if (!name) return;
  await apiJson('/api/workflows/from-template', {
    method: 'POST',
    body: JSON.stringify({ templateId, customerName: name, products: [] }),
  });
  loadDashboard();
}

async function approveWorkflow(id) {
  await apiJson('/api/workflows/' + id + '/approve', {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'admin' }),
  });
  closeDetailModal();
  loadDashboard();
}

async function rejectWorkflow(id) {
  const reason = prompt('Rejection reason:');
  if (!reason) return;
  await apiJson('/api/workflows/' + id + '/reject', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  closeDetailModal();
  loadDashboard();
}

async function executeWorkflow(id) {
  if (!confirm('Execute this workflow?')) return;
  const result = await apiJson('/api/workflows/' + id + '/execute', { method: 'POST' });
  closeDetailModal();
  alert('Execution completed: ' + result.stepsSucceeded + '/' + result.stepsExecuted + ' steps succeeded');
  loadDashboard();
}

async function trackCompliance() {
  const fileInput = document.getElementById('complianceExcel');
  const customer = document.getElementById('complianceCustomer').value;
  if (!fileInput.files[0]) { alert('Please upload Excel file'); return; }

  const formData = new FormData();
  formData.append('excel', fileInput.files[0]);
  formData.append('customer', customer);

  const result = await apiJson('/api/compliance/track', { method: 'POST', body: formData });
  showResult('complianceResult', `Compliance: ${result.complianceRate}%\nTotal: ${result.totalItems}\nPassed: ${result.passedItems}\nMissing: ${result.missingItems.length}`);
}

async function getComplianceTrend() {
  const customer = document.getElementById('complianceCustomer').value;
  if (!customer) { alert('Enter customer name'); return; }
  const result = await apiJson('/api/compliance/trend?customer=' + encodeURIComponent(customer));
  showResult('complianceResult', `${result.summary || ''}\nTrend: ${result.trend}\nRecords: ${result.records?.length || 0}`);
}

async function generateRoadmap() {
  const customer = document.getElementById('complianceCustomer').value || document.getElementById('proposalCustomer').value;
  const current = parseInt(document.getElementById('roadmapCurrent').value) || 26;
  const target = parseInt(document.getElementById('roadmapTarget').value) || 87;
  const result = await apiJson('/api/compliance/roadmap', {
    method: 'POST',
    body: JSON.stringify({ customerName: customer, currentCompliance: current, targetCompliance: target }),
  });
  showResult('roadmapResult', `${result.summary || ''}\nPhases: ${result.phases?.length || 0}\nTarget: ${result.estimatedCompliance}%`);
}

async function generateProposal() {
  const customer = document.getElementById('proposalCustomer').value;
  const target = parseInt(document.getElementById('proposalTarget').value) || 87;
  if (!customer) { alert('Enter customer name'); return; }
  const result = await apiJson('/api/compliance/proposal', {
    method: 'POST',
    body: JSON.stringify({ customerName: customer, targetCompliance: target }),
  });
  showResult('proposalResult', result.markdown || `Proposal: ${result.title}\nCost: ${result.totalCost}`);
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const question = input.value.trim();
  if (!question) return;
  const messages = document.getElementById('chatMessages');
  messages.innerHTML += `<div class="chat-message user"><div class="bubble">${escapeHtml(question)}</div></div>`;
  input.value = '';
  const result = await apiJson('/api/manual/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
  messages.innerHTML += `<div class="chat-message assistant"><div class="bubble">${escapeHtml(result.answer || 'No answer found.')}</div></div>`;
  messages.scrollTop = messages.scrollHeight;
}

async function findMenuPath() {
  const product = document.getElementById('menuPathProduct').value;
  const feature = document.getElementById('menuPathFeature').value;
  if (!feature) { alert('Enter feature name'); return; }
  const result = await apiJson('/api/manual/menu-path', {
    method: 'POST',
    body: JSON.stringify({ product, feature }),
  });
  showResult('menuPathResult', `Path: ${result.path}\nVersion: ${result.version}`);
}

async function captureDeviceMenu() {
  const product = document.getElementById('captureMenuProduct').value;
  const port = document.getElementById('captureMenuPort').value;
  const result = await apiJson('/api/device/capture-menu', {
    method: 'POST',
    body: JSON.stringify({ product, cdpPort: parseInt(port) }),
  });
  showResult('captureMenuResult', `Source: ${result.captureSource}\nMenu Items: ${result.menuItems?.length || 0}\nCaptured At: ${result.capturedAt}`);
}

async function compareManualVsDevice() {
  const product = document.getElementById('compareProduct').value;
  const port = document.getElementById('comparePort').value;
  const result = await apiJson('/api/device/compare', {
    method: 'POST',
    body: JSON.stringify({ product, cdpPort: parseInt(port) }),
  });
  showResult('compareResult', `Accuracy: ${result.accuracy}%\nMatched: ${result.matchedItems?.length || 0}\nMissing: ${result.missingInDevice?.length || 0}\nExtra: ${result.extraInDevice?.length || 0}\n\n${result.summary || ''}`);
}

async function generateSettingGuide() {
  const customer = document.getElementById('guideCustomer').value;
  const product = document.getElementById('guideProduct').value;
  const requirements = document.getElementById('guideRequirements').value;
  if (!customer || !requirements) { alert('Enter customer and requirements'); return; }
  const result = await apiJson('/api/guide/generate', {
    method: 'POST',
    body: JSON.stringify({ customerName: customer, product, requirements: requirements.split(',').map((r) => r.trim()) }),
  });
  showResult('guideResult', result.guide || JSON.stringify(result, null, 2));
}

async function compareVendors() {
  const category = document.getElementById('vendorCategory').value;
  const includeSangfor = document.getElementById('vendorIncludeSangfor').checked;
  const result = await apiJson('/api/vendors/compare', {
    method: 'POST',
    body: JSON.stringify({ category, includeSangfor }),
  });
  let text = `${result.summary || ''}\nVendors: ${result.vendors?.length || 0}\nTop: ${result.topVendor || 'N/A'}`;
  (result.vendors || []).forEach((v) => {
    text += `\n\n• ${v.name} ${v.product || ''} (Score: ${v.score})\n  ${(v.features || []).join(', ')}`;
  });
  showResult('vendorCompareResult', text);
}

async function generateReport() {
  const customer = document.getElementById('reportCustomer').value;
  const category = document.getElementById('reportCategory').value;
  if (!customer || !category) { alert('Enter customer and category'); return; }
  const result = await apiJson('/api/vendors/report', {
    method: 'POST',
    body: JSON.stringify({ customerName: customer, category }),
  });
  showResult('reportResult', result.report || JSON.stringify(result, null, 2));
}

async function runLearning(type) {
  const result = await apiJson('/api/learning/run', {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
  showResult('learningResult', `Status: ${result.status}\nVendors: ${result.vendorsProcessed || 0}\nChunks: ${result.chunksIndexed || 0}`);
}

async function createSchedule() {
  const name = prompt('Schedule name:');
  if (!name) return;
  const frequency = prompt('Frequency (daily/weekly/monthly):', 'weekly');
  if (!frequency) return;
  await apiJson('/api/learning/schedules', {
    method: 'POST',
    body: JSON.stringify({ name, frequency, vendors: ['CrowdStrike', 'Microsoft', 'SentinelOne'], enabled: true }),
  });
  loadSchedules();
}

async function loadSchedules() {
  try {
    const result = await apiJson('/api/learning/schedules');
    document.getElementById('scheduleList').innerHTML = result.map((s) => `
      <div class="workflow-item">
        <div class="info">
          <div class="name">${escapeHtml(s.name)}</div>
          <div class="meta">${s.frequency} | Vendors: ${s.vendors?.length || 0}</div>
        </div>
        <span class="status ${s.enabled ? 'completed' : 'rejected'}">${s.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>`).join('') || '<div style="color:#64748b;text-align:center;padding:20px;">No schedules</div>';
  } catch (error) {
    console.warn('Schedules load failed:', error.message);
  }
}

async function createAccessRequest() {
  const customer = document.getElementById('accessCustomer').value;
  const project = document.getElementById('accessProject').value;
  const products = document.getElementById('accessProducts').value;
  if (!customer || !project) { alert('Enter customer and project'); return; }
  const result = await apiJson('/api/access/request', {
    method: 'POST',
    body: JSON.stringify({ customerName: customer, projectName: project, products: products.split(',').map((p) => p.trim()) }),
  });
  showResult('accessRequestResult', `Request ID: ${result.requestId}\nStatus: ${result.status}`);
  document.getElementById('accessRequestId').value = result.requestId;
  loadAccessRequests();
}

async function submitAccessInfo() {
  const requestId = document.getElementById('accessRequestId').value;
  const product = document.getElementById('accessInfoProduct').value;
  const ip = document.getElementById('accessInfoIp').value;
  const port = document.getElementById('accessInfoPort').value;
  const username = document.getElementById('accessInfoUsername').value;
  const password = document.getElementById('accessInfoPassword').value;
  if (!requestId || !ip || !username || !password) { alert('Fill all fields'); return; }
  await apiJson('/api/access/submit', {
    method: 'POST',
    body: JSON.stringify({ requestId, product, ip, port: parseInt(port), username, password }),
  });
  alert('Access info submitted');
  loadAccessRequests();
}

async function loadAccessRequests() {
  try {
    const result = await apiJson('/api/access/requests');
    document.getElementById('accessRequestsList').innerHTML = result.map((r) => `
      <div class="workflow-item">
        <div class="info">
          <div class="name">${escapeHtml(r.customerName)} - ${escapeHtml(r.projectName)}</div>
          <div class="meta">Products: ${(r.products || []).join(', ')} | Status: ${r.status}</div>
        </div>
        <span class="status ${r.status === 'approved' ? 'completed' : 'draft'}">${r.status}</span>
      </div>`).join('') || '<div style="color:#64748b;text-align:center;padding:20px;">No requests</div>';
  } catch (error) {
    console.warn('Access requests load failed:', error.message);
  }
}

async function loadDeviceHealth() {
  try {
    const devices = await apiJson('/api/devices/health');
    document.getElementById('deviceHealthList').innerHTML = devices.map((d) => `
      <div class="workflow-item">
        <div class="info">
          <div class="name">${escapeHtml(d.name || d.id)} (${escapeHtml(d.product || '')})</div>
          <div class="meta">CPU: ${d.cpu?.usage ?? '-'}% | Memory: ${d.memory?.usage ?? '-'}% | Status: ${d.status}</div>
        </div>
        <span class="status ${d.status === 'healthy' ? 'completed' : 'running'}">${d.status}</span>
      </div>`).join('');
  } catch (error) {
    document.getElementById('deviceHealthList').innerHTML = `<div style="color:#64748b">${escapeHtml(error.message)}</div>`;
  }
}

async function loadApprovals() {
  try {
    const approvals = await apiJson('/api/approvals');
    document.getElementById('approvalsList').innerHTML = approvals.length
      ? approvals.map((a) => `
        <div class="workflow-item">
          <div class="info">
            <div class="name">Plan ${escapeHtml(a.planId || '')}</div>
            <div class="meta">Approval ID: ${escapeHtml(a.id)}</div>
          </div>
          <button class="btn btn-success btn-sm" onclick="approvePlan('${a.id}')">Approve</button>
        </div>`).join('')
      : '<div style="color:#64748b;text-align:center;padding:20px;">No pending approvals</div>';
  } catch (error) {
    document.getElementById('approvalsList').innerHTML = `<div style="color:#64748b">${escapeHtml(error.message)}</div>`;
  }
}

async function approvePlan(approvalId) {
  await apiJson('/api/approvals/' + approvalId + '/approve', {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'operator' }),
  });
  loadApprovals();
}

async function runAutoOpsFlow() {
  const product = document.getElementById('autoOpsProduct').value;
  const intent = document.getElementById('autoOpsIntent').value || '정책 상태 확인';
  const snapshot = await apiJson('/api/snapshots/' + product);
  const plan = await apiJson('/api/plan', {
    method: 'POST',
    body: JSON.stringify({ intent, product, dryRun: true, snapshot }),
  });

  let execResult = null;
  if (plan.status === 'approved') {
    execResult = await apiJson('/api/execute/' + plan.id, { method: 'POST' });
  }

  showResult('autoOpsResult', [
    `Snapshot: ${snapshot.id}`,
    `Plan: ${plan.id} (${plan.status})`,
    execResult ? `Execution: ${execResult.status} (${execResult.stepsSucceeded}/${execResult.stepsExecuted})` : 'Execution: skipped (approval required)',
  ].join('\n'));
  loadApprovals();
}

async function requestBreakGlass() {
  const reason = document.getElementById('breakglassReason').value;
  const requestedBy = document.getElementById('breakglassUser').value || 'operator';
  if (!reason) { alert('Enter reason'); return; }
  const result = await apiJson('/api/breakglass/request', {
    method: 'POST',
    body: JSON.stringify({ reason, requestedBy, durationMinutes: 30 }),
  });
  showResult('breakglassStatus', `Break-glass request: ${result.id}\nStatus: ${result.status}`);
}

function showResult(elementId, text) {
  const el = document.getElementById(elementId);
  el.style.display = 'block';
  el.innerHTML = '<pre>' + escapeHtml(text) + '</pre>';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

loadSystemHealth();
loadDashboard();
loadSchedules();
loadAccessRequests();
setInterval(loadDashboard, 5000);
setInterval(loadSystemHealth, 15000);
