import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleHelp, Clock3, CreditCard, FileText,
  Filter, Hammer, Home, IndianRupee, MapPin, Menu, MessageCircle, Search,
  Settings2, ShieldCheck, Sparkles, Wallet, Wrench, X, Zap
} from "lucide-react";

const jobsSeed = [
  { id: "FV-2048", title: "Kitchen sink tap repair", category: "Plumbing", area: "Vaishali Nagar, Jaipur", distance: "2.4 km away", date: "Today, 4:00 PM", budget: "₹600–₹900", icon: Wrench, tint: "mint", detail: "The kitchen tap is leaking near the base. Please bring standard washers and tools.", customer: "Customer details appear after selection." },
  { id: "FV-2047", title: "Ceiling fan installation", category: "Electrical", area: "Mansarovar, Jaipur", distance: "4.1 km away", date: "Today, 5:30 PM", budget: "₹400–₹700", icon: Zap, tint: "amber", detail: "Install one ceiling fan in a bedroom. Existing wiring is available.", customer: "Customer details appear after selection." },
  { id: "FV-2044", title: "Bathroom door adjustment", category: "Carpentry", area: "Jagatpura, Jaipur", distance: "6.8 km away", date: "Tomorrow, 10:00 AM", budget: "₹500–₹800", icon: Hammer, tint: "violet", detail: "The bathroom door is scraping the floor and needs adjustment.", customer: "Customer details appear after selection." }
];

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "profile", label: "Profile", icon: Settings2 }
];

function IconButton({ label, children, onClick, className = "" }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} onClick={onClick}>{children}</button>;
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function JobCard({ job, onOpen, onOffer }) {
  const Icon = job.icon;
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className={`category-icon ${job.tint}`}><Icon size={21} strokeWidth={1.9} /></div>
        <div className="job-main">
          <div className="job-title-row"><h3>{job.title}</h3><span className="job-id">{job.id}</span></div>
          <p className="job-category">{job.category}</p>
        </div>
        <span className="distance"><MapPin size={13} />{job.distance}</span>
      </div>
      <div className="job-meta">
        <span><MapPin size={15} />{job.area}</span>
        <span><CalendarDays size={15} />{job.date}</span>
      </div>
      <div className="job-card-bottom">
        <div><span className="eyebrow">YOUR OFFER</span><strong className="job-budget">Set your price</strong></div>
        <div className="job-actions"><button className="button button-secondary" onClick={() => onOpen(job)}>Details</button><button className="button button-primary" onClick={() => onOffer(job)}>Send offer <ArrowRight size={15} /></button></div>
      </div>
    </article>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [jobTab, setJobTab] = useState("Available");
  const [selectedJob, setSelectedJob] = useState(null);
  const [offerJob, setOfferJob] = useState(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [toast, setToast] = useState("");
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("500");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileName, setProfileName] = useState("Rahul Sharma");
  const [profileService, setProfileService] = useState("Plumbing");
  const [language, setLanguage] = useState("English");
  const [submittedOffers, setSubmittedOffers] = useState([]);
  const [walletRequests, setWalletRequests] = useState([]);

  const filteredJobs = useMemo(() => jobsSeed.filter(job => {
    const text = `${job.title} ${job.category} ${job.area}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (categoryFilter === "All categories" || job.category === categoryFilter) && (jobTab === "Available" || (jobTab === "My offers" && submittedOffers.some(offer => offer.jobId === job.id)));
  }), [query, categoryFilter, jobTab, submittedOffers]);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const go = (next) => { setPage(next); setSelectedJob(null); setOfferJob(null); setMobileMenu(false); };
  const submitOffer = (event) => {
    event.preventDefault();
    if (!offerPrice || Number(offerPrice) <= 0) { notify("Enter a valid offer amount."); return; }
    setSubmittedOffers(current => [...current.filter(item => item.jobId !== offerJob.id), { jobId: offerJob.id, title: offerJob.title, price: Number(offerPrice), note: offerNote }]);
    setOfferJob(null); setOfferPrice(""); setOfferNote("");
    notify("Demo only: offer preview saved on this device.");
  };
  const requestRecharge = (event) => {
    event.preventDefault();
    setWalletRequests(current => [...current, { amount: Number(rechargeAmount), id: Date.now() }]);
    setShowRecharge(false);
    notify("Demo only: recharge request preview saved.");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand-lockup"><div className="brand-mark"><Activity size={22} strokeWidth={2.5} /></div><div><strong>FindVia</strong><small>PROVIDER APP</small></div><IconButton label="Close menu" className="sidebar-close" onClick={() => setMobileMenu(false)}><X size={20} /></IconButton></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-link ${page === item.id ? "active" : ""}`} onClick={() => go(item.id)}><Icon size={19} strokeWidth={1.9} /><span>{item.label}</span>{item.id === "jobs" && <span className="nav-count">3</span>}</button>; })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><div className="help-icon"><CircleHelp size={19} /></div><strong>Need a hand?</strong><p>We're here to help you get work done.</p><button onClick={() => notify("Support will be connected in a later step.")}>Get support <ArrowRight size={14} /></button></div>
        <div className="sidebar-user"><div className="avatar">RS</div><div className="user-copy"><strong>{profileName}</strong><span>Provider account · Demo</span></div><ChevronDown size={16} /></div>
      </aside>

      {mobileMenu && <button className="scrim" aria-label="Close menu overlay" onClick={() => setMobileMenu(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left"><IconButton label="Open menu" className="menu-toggle" onClick={() => setMobileMenu(true)}><Menu size={21} /></IconButton><div className="breadcrumb">Provider workspace <span>/</span> <strong>{navItems.find(item => item.id === page)?.label || "Details"}</strong></div></div>
          <div className="topbar-actions"><div className="demo-indicator"><span /> Preview mode</div><IconButton label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19} /><i className="notification-dot" /></IconButton><div className="topbar-avatar">RS</div></div>
        </header>

        {notificationsOpen && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={16} /></button></div><div className="notification-item"><span className="notification-symbol green"><BriefcaseBusiness size={16} /></span><div><strong>New jobs in your area</strong><p>3 sample job requests are ready to explore.</p><small>Preview · Just now</small></div></div><div className="notification-item"><span className="notification-symbol yellow"><Wallet size={16} /></span><div><strong>Wallet is in preview mode</strong><p>Connect your new account before adding real money.</p><small>Preview · Today</small></div></div></div>}

        <div className="page-content">
          {page === "home" && !selectedJob && <HomePage go={go} onOpenJob={setSelectedJob} onOffer={setOfferJob} submittedOffers={submittedOffers} />}
          {page === "jobs" && !selectedJob && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">FIND YOUR NEXT JOB</span><h1>Job requests</h1><p>Explore work that matches your skills and service area.</p></div><div className="heading-icon"><BriefcaseBusiness size={23} /></div></div><div className="filter-row"><div className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search jobs or areas" aria-label="Search jobs or areas" /><kbd>/</kbd></div><button className={`button button-secondary filter-button ${filterOpen ? "filter-active" : ""}`} aria-expanded={filterOpen} onClick={() => setFilterOpen(open => !open)}><Filter size={16} /> Filters{categoryFilter !== "All categories" && <span className="filter-dot" />}</button></div>{filterOpen && <div className="filter-panel"><label htmlFor="job-category-filter">Service category</label><select id="job-category-filter" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option>All categories</option>{[...new Set(jobsSeed.map(job => job.category))].map(category => <option key={category}>{category}</option>)}</select><button className="text-button" onClick={() => { setCategoryFilter("All categories"); setQuery(""); }}>Clear filters</button></div>}<div className="tabs" role="tablist" aria-label="Job filters">{["Available", "My offers"].map(tab => <button role="tab" aria-selected={jobTab === tab} className={jobTab === tab ? "selected" : ""} key={tab} onClick={() => setJobTab(tab)}>{tab}{tab === "My offers" && submittedOffers.length > 0 && <span className="tab-count">{submittedOffers.length}</span>}</button>)}</div><div className="section-subheading"><strong>{jobTab === "Available" ? "Recommended for you" : "Offers you sent"}</strong><span>{filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}</span></div>{filteredJobs.length ? <div className="job-list">{filteredJobs.map(job => <JobCard key={job.id} job={job} onOpen={setSelectedJob} onOffer={setOfferJob} />)}</div> : <div className="empty-state"><Search size={25} /><strong>No jobs found</strong><p>Try a different search or check available jobs.</p><button className="button button-secondary" onClick={() => { setQuery(""); setCategoryFilter("All categories"); setJobTab("Available"); }}>Clear filters</button></div>}</section>}

          {selectedJob && <JobDetails job={selectedJob} onBack={() => setSelectedJob(null)} onOffer={setOfferJob} />}
          {page === "wallet" && !selectedJob && <WalletPage onRecharge={() => setShowRecharge(true)} requests={walletRequests} />}
          {page === "profile" && !selectedJob && <ProfilePage name={profileName} setName={setProfileName} service={profileService} setService={setProfileService} language={language} setLanguage={setLanguage} notify={notify} />}
        </div>

        <footer className="app-footer"><span>© 2026 FindVia</span><span><ShieldCheck size={14} /> Your work. Your growth.</span><span>Preview build · No real transactions</span></footer>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => go(item.id)}><Icon size={20} /><span>{item.label}</span></button>; })}</nav>

      {offerJob && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOfferJob(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="offer-title"><div className="modal-heading"><div><span className="eyebrow">JOB OFFER</span><h2 id="offer-title">Send your offer</h2><p>{offerJob.title}</p></div><IconButton label="Close dialog" onClick={() => setOfferJob(null)}><X size={20} /></IconButton></div><div className="preview-notice"><Sparkles size={17} /><span>This is a preview. Your offer won't reach a customer until the backend is connected.</span></div><form onSubmit={submitOffer}><label htmlFor="offer-price">Your price (₹)</label><div className="price-input"><IndianRupee size={19} /><input id="offer-price" type="number" min="1" step="1" required value={offerPrice} onChange={event => setOfferPrice(event.target.value)} placeholder="Enter your offer amount" /></div><label htmlFor="offer-note">Short message <span className="optional">Optional</span></label><textarea id="offer-note" value={offerNote} onChange={event => setOfferNote(event.target.value)} maxLength="240" placeholder="Tell the customer how you can help…" rows="3" /><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setOfferJob(null)}>Cancel</button><button type="submit" className="button button-primary">Preview offer <ArrowRight size={16} /></button></div></form></section></div>}

      {showRecharge && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowRecharge(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="recharge-title"><div className="modal-heading"><div><span className="eyebrow">WALLET</span><h2 id="recharge-title">Request a recharge</h2><p>Choose an amount to preview a recharge request.</p></div><IconButton label="Close dialog" onClick={() => setShowRecharge(false)}><X size={20} /></IconButton></div><div className="preview-notice"><ShieldCheck size={17} /><span>No money will be collected in preview mode.</span></div><form onSubmit={requestRecharge}><label htmlFor="recharge-amount">Recharge amount</label><div className="amount-options">{["100", "200", "500", "1000", "2000"].map(amount => <button type="button" key={amount} className={rechargeAmount === amount ? "chosen" : ""} onClick={() => setRechargeAmount(amount)}>₹{Number(amount).toLocaleString("en-IN")}</button>)}</div><div className="price-input"><IndianRupee size={19} /><input id="recharge-amount" type="number" min="100" max="50000" step="1" value={rechargeAmount} onChange={event => setRechargeAmount(event.target.value)} required /></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowRecharge(false)}>Cancel</button><button type="submit" className="button button-primary">Preview request <ArrowRight size={16} /></button></div></form></section></div>}

      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function HomePage({ go, onOpenJob, onOffer, submittedOffers }) {
  return <section className="page-section home-page"><div className="welcome-row"><div><span className="eyebrow">WEDNESDAY, OCTOBER 21</span><h1>Good afternoon, Rahul <span className="wave">✳</span></h1><p>Ready to make today a good workday?</p></div><div className="verified-badge"><ShieldCheck size={17} /><span>Profile preview</span></div></div>
    <div className="hero-card"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={14} /> YOUR PROVIDER SPACE</span><h2>Good work deserves<br />great opportunities.</h2><p>Find jobs that fit your skills, send offers with confidence, and keep your work organised.</p><button className="button hero-button" onClick={() => go("jobs")}>Explore jobs <ArrowRight size={16} /></button></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-circle"><BriefcaseBusiness size={43} strokeWidth={1.35} /></div><div className="art-chip chip-one"><Zap size={15} />New work</div><div className="art-chip chip-two"><Check size={15} />Your next step</div></div></div>
    <div className="metric-grid"><Metric icon={BriefcaseBusiness} label="New opportunities" value="03" note="In your service area" tone="mint" /><Metric icon={MessageCircle} label="Offers sent" value={String(submittedOffers.length).padStart(2, "0")} note="Preview on this device" tone="violet" /><Metric icon={Wallet} label="Wallet balance" value="₹0" note="Connect account to activate" tone="amber" /></div>
    <div className="content-grid"><div className="content-column"><div className="section-heading"><div><h2>Jobs picked for you</h2><p>Based on your service category and area.</p></div><button className="text-button" onClick={() => go("jobs")}>View all <ArrowRight size={15} /></button></div><div className="job-list compact">{jobsSeed.slice(0, 2).map(job => <JobCard key={job.id} job={job} onOpen={onOpenJob} onOffer={onOffer} />)}</div></div><aside className="side-column"><div className="tip-card"><div className="tip-icon"><Sparkles size={19} /></div><span className="eyebrow">A SMALL TIP</span><h3>Make your profile stand out</h3><p>Add your skills and experience so the right jobs can find you.</p><button className="text-button" onClick={() => go("profile")}>Update profile <ArrowRight size={15} /></button></div><div className="status-card"><div className="status-card-heading"><span className="status-icon"><ShieldCheck size={18} /></span><strong>Provider checklist</strong></div><div className="checklist-row"><span className="check-circle"><Check size={12} /></span><span>Account preview created</span><StatusPill>Demo</StatusPill></div><div className="checklist-row"><span className="check-circle pending"><Clock3 size={12} /></span><span>Identity verification</span><StatusPill tone="warning">Pending setup</StatusPill></div><div className="checklist-row"><span className="check-circle pending"><Clock3 size={12} /></span><span>Connect secure wallet</span><StatusPill tone="warning">Pending setup</StatusPill></div></div></aside></div>
  </section>;
}

function Metric({ icon: Icon, label, value, note, tone }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></div>;
}

function JobDetails({ job, onBack, onOffer }) {
  const Icon = job.icon;
  return <section className="page-section"><button className="back-link" onClick={onBack}>← Back to jobs</button><div className="page-heading"><div><span className="eyebrow">JOB DETAILS · {job.id}</span><h1>{job.title}</h1><p>Review the request before deciding whether to send an offer.</p></div><div className={`category-icon large ${job.tint}`}><Icon size={26} /></div></div><div className="details-layout"><div className="panel details-panel"><h2>About this job</h2><p className="details-description">{job.detail}</p><div className="detail-line"><MapPin size={18} /><div><strong>Service area</strong><span>{job.area}</span><small>Exact address and customer contact stay private until you're selected.</small></div></div><div className="detail-line"><CalendarDays size={18} /><div><strong>Preferred time</strong><span>{job.date}</span></div></div><div className="detail-line"><BriefcaseBusiness size={18} /><div><strong>Service category</strong><span>{job.category}</span></div></div><div className="privacy-note"><ShieldCheck size={18} /><span>Customer contact details are protected until a provider is selected.</span></div></div><aside className="panel offer-summary"><span className="eyebrow">YOUR OFFER</span><strong className="large-price">Your price</strong><p>Choose a fair price for the work. The customer will review your offer before selecting a provider.</p><div className="summary-divider" /><div className="summary-detail"><span>Job reference</span><strong>{job.id}</strong></div><div className="summary-detail"><span>Offer process</span><strong>One simple step</strong></div><button className="button button-primary full-button" onClick={() => onOffer(job)}>Send an offer <ArrowRight size={16} /></button><p className="fine-print">Preview only. Offers won't be sent until your account is connected.</p></aside></div></section>;
}

function WalletPage({ onRecharge, requests }) {
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">YOUR MONEY, CLEARLY TRACKED</span><h1>Wallet & earnings</h1><p>See your wallet activity and understand each transaction.</p></div><div className="heading-icon"><Wallet size={24} /></div></div><div className="wallet-hero"><div className="wallet-topline"><span><Wallet size={16} /> PROVIDER WALLET</span><StatusPill tone="warning">Preview mode</StatusPill></div><span className="wallet-label">Available wallet balance</span><strong className="wallet-balance">₹0.00</strong><p>Real balance will appear after secure account connection.</p><button className="button wallet-button" onClick={onRecharge}><ArrowDownLeft size={16} /> Request recharge</button><div className="wallet-decoration"><div /><div /><div /></div></div><div className="wallet-stats"><div className="wallet-stat"><span><ArrowUpRight size={16} /> Commission paid</span><strong>₹0.00</strong><small>Preview only</small></div><div className="wallet-stat"><span><IndianRupee size={16} /> Service earnings</span><strong>₹0.00</strong><small>Jobs completed</small></div><div className="wallet-stat"><span><CreditCard size={16} /> Recharge requests</span><strong>{requests.length.toString().padStart(2, "0")}</strong><small>Saved on this device</small></div></div><div className="panel transaction-panel"><div className="section-heading"><div><h2>Recent activity</h2><p>Your wallet ledger will appear here.</p></div><FileText size={21} className="muted-icon" /></div>{requests.length ? requests.slice().reverse().map(item => <div className="transaction-row" key={item.id}><div className="transaction-icon"><ArrowDownLeft size={17} /></div><div className="transaction-copy"><strong>Recharge request preview</strong><span>Not sent to management · Demo</span></div><strong className="transaction-amount">₹{item.amount.toLocaleString("en-IN")}</strong><StatusPill tone="warning">Preview</StatusPill></div>) : <div className="empty-state compact-empty"><div className="empty-icon"><Activity size={22} /></div><strong>No transactions yet</strong><p>When your account is connected, wallet activity will show up here.</p></div>}</div><div className="security-footnote"><ShieldCheck size={17} /><p><strong>Security first.</strong> Wallet balances and commission records will be calculated on the server. This preview cannot accept or move real money.</p></div></section>;
}

function ProfilePage({ name, setName, service, setService, language, setLanguage, notify }) {
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">YOUR PROFESSIONAL IDENTITY</span><h1>My profile</h1><p>Keep your skills and details ready for the right opportunities.</p></div><div className="heading-icon"><Settings2 size={24} /></div></div><div className="profile-layout"><div className="panel profile-card"><div className="profile-cover" /><div className="profile-avatar">RS</div><div className="profile-intro"><h2>{name || "Your name"}</h2><p><MapPin size={14} /> Jaipur, Rajasthan · Demo profile</p><StatusPill tone="warning">Verification not connected</StatusPill></div><div className="profile-progress"><div><span>Profile completeness</span><strong>Preview</strong></div><div className="progress-track"><span style={{ width: "45%" }} /></div><small>Verification and account details will be enabled after setup.</small></div></div><div className="panel profile-form"><div className="section-heading"><div><h2>Basic information</h2><p>These fields currently update only this preview.</p></div></div><label htmlFor="provider-name">Full name</label><input className="form-control" id="provider-name" value={name} onChange={event => setName(event.target.value)} maxLength="70" /><label htmlFor="provider-service">Main service</label><select className="form-control" id="provider-service" value={service} onChange={event => setService(event.target.value)}><option>Plumbing</option><option>Electrical</option><option>AC repair</option><option>Carpentry</option><option>Painting</option><option>Masonry</option><option>Appliance repair</option><option>Other</option></select><label htmlFor="provider-language">App language</label><select className="form-control" id="provider-language" value={language} onChange={event => setLanguage(event.target.value)}><option>English</option><option>Hindi</option></select><button className="button button-primary profile-save" onClick={() => notify("Preview updated on this device only.")}>Save preview <Check size={16} /></button><div className="profile-info-note"><ShieldCheck size={17} /><span>Personal details and documents will be stored securely after Supabase is configured.</span></div></div></div><div className="panel profile-settings"><div className="settings-row"><span className="settings-icon"><FileText size={18} /></span><div><strong>Verification documents</strong><p>Identity and skill documents</p></div><StatusPill tone="warning">Not connected</StatusPill><ArrowRight size={17} /></div><div className="settings-row"><span className="settings-icon"><Bell size={18} /></span><div><strong>Notifications</strong><p>Job updates and wallet activity</p></div><ArrowRight size={17} /></div><div className="settings-row"><span className="settings-icon"><CircleHelp size={18} /></span><div><strong>Help & support</strong><p>Get help with your provider account</p></div><ArrowRight size={17} /></div></div></section>;
}

export default App;