/* ─── NIRA LLC Chatbot ───────────────────────────────────── */
const CHATBOT_DATA = {
  greeting: "Hi! I'm the NIRA LLC virtual assistant. How can I help you today?",
  quickReplies: [
    "What services do you offer?",
    "Tell me about SOX compliance",
    "What is Oracle Redwood migration?",
    "Which Oracle modules do you cover?",
    "How do I get started?",
    "Who are your consultants?"
  ],
  responses: [
    {
      patterns: ["service", "offer", "what do you do", "help with"],
      answer: "NIRA LLC offers six core services:<br><br>1. <strong>Oracle Consulting</strong> — Implementation & development across Fusion Cloud and EBS<br>2. <strong>SOX Compliance & Audit</strong> — Internal controls, SoD analysis, audit readiness<br>3. <strong>Oracle Redwood Migration</strong> — UI migration before the Nov 2026 deadline<br>4. <strong>Education Services</strong> — Oracle training & knowledge transfer<br>5. <strong>Support Services</strong> — Post-deployment support & maintenance<br>6. <strong>Managed Services</strong> — Ongoing Oracle administration & BPO<br><br>Which area would you like to know more about?"
    },
    {
      patterns: ["sox", "sarbanes", "compliance", "audit", "internal control", "segregation", "sod"],
      answer: "NIRA LLC provides end-to-end <strong>SOX compliance support on Oracle ERP</strong>, including:<br><br>• <strong>Section 404</strong> internal control assessments<br>• <strong>Segregation of Duties (SoD)</strong> analysis & conflict remediation<br>• Audit trail configuration & monitoring<br>• <strong>Oracle Risk Management Cloud</strong> setup<br>• Sensitive access monitoring<br>• External auditor review preparation<br><br>We help you design secure roles and establish sustainable controls over financial reporting. <a href='#contact' onclick='closeChatbot()'>Contact us</a> to discuss your compliance needs."
    },
    {
      patterns: ["redwood", "ui migration", "classic ui", "new ui", "fusion ui"],
      answer: "<strong>Oracle Redwood</strong> is Oracle's next-generation UI replacing the Classic interface.<br><br>⚠️ <strong>Important deadlines:</strong><br>• Classic UI deprecated: <strong>November 2026 (Update 26D)</strong><br>• Full decommission: <strong>February 2027 (Update 27A)</strong><br><br>NIRA LLC guides your migration across Financials, HCM, SCM, and Projects — including:<br>• Impact assessment<br>• Personalization re-implementation<br>• AI-assisted workflow enablement<br>• Guided journey setup<br>• User adoption training<br><br>Act now to migrate on your timeline. <a href='#contact' onclick='closeChatbot()'>Get in touch</a> today."
    },
    {
      patterns: ["module", "platform", "product", "oracle fusion", "ebs", "e-business", "financials", "hcm", "scm", "procurement", "epm", "middleware"],
      answer: "NIRA LLC covers the full Oracle applications portfolio:<br><br>☁️ <strong>Oracle Fusion Cloud ERP</strong><br>💰 <strong>Oracle Financials Cloud</strong> — GL, AP, AR, Fixed Assets<br>🛒 <strong>Oracle Procurement Cloud</strong><br>📦 <strong>Oracle SCM Cloud</strong> — Order Mgmt, Inventory, Planning<br>👥 <strong>Oracle HCM Cloud</strong> — HR, Payroll, Talent<br>📊 <strong>Oracle EPM Cloud</strong> — Planning, Budgeting, Consolidation<br>📋 <strong>Oracle Project Management</strong><br>🛡️ <strong>Oracle Risk Management Cloud</strong> — SOX controls<br>🏢 <strong>Oracle E-Business Suite (EBS)</strong><br>🔗 <strong>Oracle Fusion Middleware</strong>"
    },
    {
      patterns: ["get started", "start", "begin", "engage", "hire", "work with", "how do i"],
      answer: "Getting started with NIRA LLC is simple:<br><br>1. <strong>Reach out</strong> — Fill out our <a href='#contact' onclick='closeChatbot()'>contact form</a> with your project details<br>2. <strong>Discovery call</strong> — We discuss your Oracle environment and requirements<br>3. <strong>Proposal</strong> — We provide a transparent scope and resource plan<br>4. <strong>Engagement</strong> — Work begins with senior oversight on every deliverable<br><br>We work on-site and remotely for global clients. <a href='#contact' onclick='closeChatbot()'>Contact us</a> to get started."
    },
    {
      patterns: ["consultant", "team", "yogesh", "dipika", "who", "people", "expert"],
      answer: "NIRA LLC's core team:<br><br>👤 <strong>Yogesh Raja</strong> — Founder & Principal Consultant<br>• 24+ years in Oracle technology & finance<br>• Oracle Financials Cloud Certified (Payables 2020)<br>• Oracle Cloud Infrastructure Certified (2020 & 2025)<br>• Oracle Fusion AI Agent Studio Certified<br>• PMP® | FCA | DISA (ICAI)<br><br>👤 <strong>Dipika Raja</strong> — Oracle Functional Consultant<br>• Oracle EBS & Fusion Cloud specialist<br>• Financials, Procurement, Order Management<br><br>Not a staffing or recruitment agency — all work is performed by our core team."
    },
    {
      patterns: ["price", "cost", "rate", "charge", "fee", "how much"],
      answer: "NIRA LLC operates with full <strong>transparency on pricing</strong> — one of our core values. We share resource costs openly with clients to identify the right talent and reduce expenses.<br><br>Pricing depends on:<br>• Scope and complexity of the engagement<br>• On-site vs. remote delivery<br>• Duration and module coverage<br><br>Please <a href='#contact' onclick='closeChatbot()'>contact us</a> for a tailored quote for your project."
    },
    {
      patterns: ["location", "where", "india", "remote", "onsite", "on-site", "global"],
      answer: "NIRA LLC operates <strong>globally</strong> — we provide both on-site consulting for clients worldwide and remote consulting for design, development, and support engagements.<br><br>Our team is based in India and the United States, giving us the flexibility to serve clients across multiple time zones."
    },
    {
      patterns: ["staffing", "recruitment", "agency", "hire people"],
      answer: "NIRA LLC is <strong>not</strong> a staffing or recruitment agency. We are a dedicated Oracle Applications consulting firm.<br><br>All consulting work is performed by our core team or vetted subcontractors under our direct quality oversight — ensuring consistent, high-quality delivery on every engagement."
    },
    {
      patterns: ["contact", "email", "phone", "reach", "message"],
      answer: "You can reach NIRA LLC through our <a href='#contact' onclick='closeChatbot()'>contact form</a> on this page.<br><br>Fill in your name, email, company, and a brief description of your Oracle project — we'll get back to you promptly."
    }
  ],
  fallback: "Thanks for your question! For detailed information about that topic, please <a href='#contact' onclick='closeChatbot()'>contact our team directly</a> — we'd be happy to discuss your specific Oracle needs."
};

function findResponse(input) {
  const lower = input.toLowerCase();
  for (const item of CHATBOT_DATA.responses) {
    if (item.patterns.some(p => lower.includes(p))) {
      return item.answer;
    }
  }
  return CHATBOT_DATA.fallback;
}

function closeChatbot() {
  document.getElementById('chat-window').classList.remove('open');
}

function buildChatbot() {
  const widget = document.createElement('div');
  widget.id = 'chatbot-widget';
  widget.innerHTML = `
    <button id="chat-toggle" aria-label="Open chat">
      <svg id="chat-icon-open" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <svg id="chat-icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <span id="chat-badge">1</span>
    </button>

    <div id="chat-window">
      <div id="chat-header">
        <div id="chat-header-info">
          <div id="chat-avatar">NL</div>
          <div>
            <div id="chat-name">NIRA LLC Assistant</div>
            <div id="chat-status"><span class="status-dot"></span> Online</div>
          </div>
        </div>
        <button id="chat-close-btn" onclick="closeChatbot()" aria-label="Close chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div id="chat-messages"></div>

      <div id="chat-quick-replies"></div>

      <div id="chat-input-area">
        <input id="chat-input" type="text" placeholder="Ask about our Oracle services..." autocomplete="off" />
        <button id="chat-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  const toggle    = document.getElementById('chat-toggle');
  const window_   = document.getElementById('chat-window');
  const messages  = document.getElementById('chat-messages');
  const input     = document.getElementById('chat-input');
  const sendBtn   = document.getElementById('chat-send');
  const quickDiv  = document.getElementById('chat-quick-replies');
  const badge     = document.getElementById('chat-badge');
  const iconOpen  = document.getElementById('chat-icon-open');
  const iconClose = document.getElementById('chat-icon-close');

  let opened = false;

  function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.innerHTML = `<div class="chat-bubble">${text}</div>`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTyping() {
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.id = 'typing-indicator';
    typing.innerHTML = `<div class="chat-bubble typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    return typing;
  }

  function showQuickReplies(replies) {
    quickDiv.innerHTML = '';
    replies.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'quick-reply-btn';
      btn.textContent = r;
      btn.onclick = () => handleUserMessage(r);
      quickDiv.appendChild(btn);
    });
  }

  function handleUserMessage(text) {
    quickDiv.innerHTML = '';
    addMessage(text, 'user');
    const typing = addTyping();
    setTimeout(() => {
      typing.remove();
      const response = findResponse(text);
      addMessage(response, 'bot');
      showQuickReplies(["Ask another question", "How do I get started?", "Contact NIRA LLC"]);
    }, 700 + Math.random() * 400);
  }

  toggle.addEventListener('click', () => {
    window_.classList.toggle('open');
    const isOpen = window_.classList.contains('open');
    iconOpen.style.display  = isOpen ? 'none'  : 'block';
    iconClose.style.display = isOpen ? 'block' : 'none';
    badge.style.display = 'none';
    if (!opened) {
      opened = true;
      setTimeout(() => {
        addMessage(CHATBOT_DATA.greeting, 'bot');
        showQuickReplies(CHATBOT_DATA.quickReplies);
      }, 300);
    }
  });

  sendBtn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val) { handleUserMessage(val); input.value = ''; }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (val) { handleUserMessage(val); input.value = ''; }
    }
  });

  // Show badge after 4 seconds
  setTimeout(() => {
    if (!opened) badge.style.display = 'flex';
  }, 4000);
}

document.addEventListener('DOMContentLoaded', buildChatbot);
