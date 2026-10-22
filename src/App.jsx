import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, CreditCard, FileText,
  Filter, Hammer, Home, IndianRupee, MapPin, Menu, MessageCircle, Search, ClipboardList,
  Settings2, ShieldCheck, Sparkles, Wallet, Wrench, X, Zap
} from "lucide-react";

function readPreviewState(key, fallback) {
  try { const saved = window.localStorage.getItem(`findvia-provider:${key}`); return saved === null ? fallback : JSON.parse(saved); } catch { return fallback; }
}

function formatProviderJob(row) {
  const category = row.category_name_en || "Service";
  const categoryLower = category.toLowerCase();
  const Icon = categoryLower.includes("electric") ? Zap : categoryLower.includes("carpent") || categoryLower.includes("wood") ? Hammer : Wrench;
  const minimum = row.budget_min == null ? null : Number(row.budget_min);
  const maximum = row.budget_max == null ? null : Number(row.budget_max);
  const budget = minimum != null && maximum != null
    ? `₹${minimum.toLocaleString("en-IN")}–₹${maximum.toLocaleString("en-IN")}`
    : minimum != null ? `From ₹${minimum.toLocaleString("en-IN")}`
    : maximum != null ? `Up to ₹${maximum.toLocaleString("en-IN")}` : "Budget not set";
  return {
    id: row.id,
    reference: row.id ? row.id.slice(0, 8).toUpperCase() : "JOB",
    title: row.title || "Service request",
    category,
    categoryHindi: row.category_name_hi || category,
    area: [row.area_name, row.city].filter(Boolean).join(", "),
    distance: "Service area match",
    date: new Date(row.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    budget,
    icon: Icon,
    tint: categoryLower.includes("electric") ? "amber" : categoryLower.includes("carpent") ? "violet" : "mint",
    detail: "The customer’s exact address and contact details stay private until the job is matched.",
    customer: "Customer details are hidden until selection."
  };
}

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "work", label: "My Work", icon: ClipboardList },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "profile", label: "Profile", icon: Settings2 }
];

function IconButton({ label, children, onClick, className = "" }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} onClick={onClick}>{children}</button>;
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function JobCard({ job, onOpen, onOffer, language }) {
  const Icon = job.icon;
  const hi = language === "Hindi";
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className={`category-icon ${job.tint}`}><Icon size={21} strokeWidth={1.9} /></div>
        <div className="job-main">
          <div className="job-title-row"><h3>{job.title}</h3><span className="job-id">{job.reference || job.id}</span></div>
          <p className="job-category">{hi ? (job.categoryHindi || job.category) : job.category}</p>
        </div>
        <span className="distance"><MapPin size={13} />{job.distance}</span>
      </div>
      <div className="job-meta">
        <span><MapPin size={15} />{job.area}</span>
        <span><CalendarDays size={15} />{job.date}</span>
      </div>
      <div className="job-card-bottom">
        <div><span className="eyebrow">{hi ? "आपका ऑफ़र" : "YOUR OFFER"}</span><strong className="job-budget">{hi ? "अपनी कीमत तय करें" : "Set your price"}</strong></div>
        <div className="job-actions"><button className="button button-secondary" onClick={() => onOpen(job)}>{hi ? "विवरण" : "Details"}</button><button className="button button-primary" onClick={() => onOffer(job)}>{hi ? "ऑफ़र भेजें" : "Send offer"} <ArrowRight size={15} /></button></div>
      </div>
    </article>
  );
}

function App() {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [jobsRefresh, setJobsRefresh] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [providerVerificationStatus, setProviderVerificationStatus] = useState("not_submitted");
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
  const [rechargeUtr, setRechargeUtr] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsRefresh, setNotificationsRefresh] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [profileService, setProfileService] = useState("");
  const [profileSkills, setProfileSkills] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [language, setLanguage] = useState(() => readPreviewState("language", "English"));
  const isHindi = language === "Hindi";
  const [submittedOffers, setSubmittedOffers] = useState([]);
  const [walletRequests, setWalletRequests] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLedger, setWalletLedger] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false);
  const [providerAvailable, setProviderAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthMessage("Could not restore your session. Please sign in again.");
      setAuthSession(data?.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session ?? null);
      setAuthLoading(false);
      if (session?.user) setAuthMessage("");
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => { try { window.localStorage.setItem("findvia-provider:language", JSON.stringify(language)); } catch {} }, [language]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!userId) return;
    let active = true;
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");
      try {
        const [baseResult, providerResult, categoriesResult, areasResult, servicesResult, providerAreasResult] = await Promise.all([
          supabase.from("profiles").select("full_name, preferred_language").eq("id", userId).maybeSingle(),
          supabase.from("provider_profiles").select("service_area_id, verification_status").eq("user_id", userId).maybeSingle(),
          supabase.from("service_categories").select("id, name_en, name_hi").eq("is_active", true).order("name_en"),
          supabase.from("service_areas").select("id, city, area_name, state").eq("is_active", true).order("city").order("area_name"),
          supabase.from("provider_services").select("category_id").eq("provider_id", userId),
          supabase.from("provider_service_areas").select("service_area_id").eq("provider_id", userId)
        ]);
        if (!active) return;
        const coreError = baseResult.error || providerResult.error || categoriesResult.error || areasResult.error;
        if (coreError) setProfileError(coreError.message || "Could not load your profile.");
        setProviderVerificationStatus(providerResult.data?.verification_status || "not_submitted");
        const categories = categoriesResult.data || [];
        const areas = areasResult.data || [];
        setAvailableCategories(categories);
        setAvailableAreas(areas);
        setProfileName(baseResult.data?.full_name || authSession.user.user_metadata?.full_name || authSession.user.email?.split("@")[0] || "");
        const preferred = baseResult.data?.preferred_language;
        if (preferred === "hi" || preferred === "en") setLanguage(preferred === "hi" ? "Hindi" : "English");
        const selectedCategoryIds = (servicesResult.data || []).map(item => item.category_id);
        const selectedCategoryNames = categories.filter(item => selectedCategoryIds.includes(item.id)).map(item => item.name_en);
        setProfileSkills(selectedCategoryNames);
        setProfileService(selectedCategoryNames[0] || categories[0]?.name_en || "");
        const selectedAreaIds = (providerAreasResult.data || []).map(item => item.service_area_id);
        const finalAreaIds = selectedAreaIds.length ? selectedAreaIds : (providerResult.data?.service_area_id ? [providerResult.data.service_area_id] : []);
        setServiceAreas(finalAreaIds.filter(id => areas.some(area => area.id === id)));
      } catch (error) {
        if (active) setProfileError(error?.message || "Could not connect to your profile.");
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [authSession?.user?.id]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!userId) return;
    let active = true;
    const loadProviderData = async () => {
      setJobsLoading(true);
      setJobsError("");
      try {
        const [jobsResult, offersResult, profileResult] = await Promise.all([
          supabase.rpc("provider_available_jobs"),
          supabase.rpc("provider_my_offers"),
          supabase.from("provider_profiles").select("is_available").eq("user_id", userId).maybeSingle()
        ]);
        if (!active) return;
        if (jobsResult.error) {
          setJobs([]);
          setJobsError(jobsResult.error.message || "Could not load available jobs.");
        } else {
          setJobs((jobsResult.data || []).map(formatProviderJob));
        }
        if (offersResult.error) {
          setSubmittedOffers([]);
        } else {
          setSubmittedOffers((offersResult.data || []).map(offer => ({
            jobId: offer.job_id,
            title: offer.job_title || "Job offer",
            price: Number(offer.offered_price),
            note: offer.message || "",
            status: offer.status,
            city: offer.city || "",
            area: offer.area_name || ""
          })));
        }
        if (!profileResult.error && profileResult.data) {
          setProviderAvailable(Boolean(profileResult.data.is_available));
        }
      } catch (error) {
        if (active) {
          setJobs([]);
          setSubmittedOffers([]);
          setJobsError(error?.message || "Could not connect to the provider service.");
        }
      } finally {
        if (active) setJobsLoading(false);
      }
    };
    void loadProviderData();
    return () => { active = false; };
  }, [authSession?.user?.id, jobsRefresh]);

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const text = `${job.title} ${job.category} ${job.area}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (categoryFilter === "All categories" || job.category === categoryFilter) && (jobTab === "Available" || (jobTab === "My offers" && submittedOffers.some(offer => offer.jobId === job.id)));
  }), [jobs, query, categoryFilter, jobTab, submittedOffers]);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const go = (next) => { setPage(next); setSelectedJob(null); setOfferJob(null); setMobileMenu(false); };
  const markNotificationRead = async notificationId => {
    const row = notifications.find(item => item.id === notificationId);
    if (!row || row.read_at) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", notificationId);
    if (error) {
      notify(error.message || "Could not mark notification as read.");
      return;
    }
    setNotifications(current => current.map(item => item.id === notificationId ? { ...item, read_at: readAt } : item));
  };

  const saveProfile = async () => {
    if (!authSession?.user?.id) { notify("Please sign in again."); return; }
    if (profileName.trim().length < 2) { notify(isHindi ? "अपना पूरा नाम लिखें।" : "Enter your full name."); return; }
    setProfileSaving(true);
    try {
      const selectedCategories = availableCategories.filter(item => profileSkills.includes(item.name_en) || item.name_en === profileService).map(item => item.id);
      const { error } = await supabase.rpc("provider_save_profile", {
        p_full_name: profileName.trim(),
        p_preferred_language: language === "Hindi" ? "hi" : "en",
        p_category_ids: selectedCategories,
        p_service_area_ids: serviceAreas
      });
      if (error) throw error;
      notify(isHindi ? "आपकी प्रोफ़ाइल सुरक्षित रूप से सेव हो गई।" : "Your profile was saved securely.");
      setJobsRefresh(value => value + 1);
    } catch (error) {
      notify(error?.message || (isHindi ? "प्रोफ़ाइल सेव नहीं हो सकी।" : "Could not save your profile."));
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!userId) return;
    let active = true;
    const loadNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError("");
      try {
        const { data, error } = await supabase.from("notifications").select("id, title, body, event_type, related_job_id, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
        if (!active) return;
        if (error) {
          setNotificationsError(error.message || "Could not load notifications.");
          setNotifications([]);
        } else {
          setNotifications(data || []);
        }
      } catch (error) {
        if (active) {
          setNotificationsError(error?.message || "Could not connect to notifications.");
          setNotifications([]);
        }
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };
    void loadNotifications();
    return () => { active = false; };
  }, [authSession?.user?.id, notificationsRefresh]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!userId) return;
    let active = true;
    const loadWallet = async () => {
      setWalletLoading(true);
      setWalletError("");
      try {
        const [accountResult, ledgerResult, requestsResult] = await Promise.all([
          supabase.from("wallet_accounts").select("balance, currency, updated_at").eq("provider_id", userId).maybeSingle(),
          supabase.from("wallet_ledger").select("id, amount, entry_type, description, created_at").eq("provider_id", userId).order("created_at", { ascending: false }).limit(50),
          supabase.from("recharge_requests").select("id, amount, utr, status, created_at").eq("provider_id", userId).order("created_at", { ascending: false }).limit(50)
        ]);
        if (!active) return;
        const firstError = accountResult.error || ledgerResult.error || requestsResult.error;
        if (firstError) setWalletError(firstError.message || "Could not load wallet information.");
        if (!accountResult.error) setWalletBalance(Number(accountResult.data?.balance || 0));
        if (!ledgerResult.error) setWalletLedger(ledgerResult.data || []);
        if (!requestsResult.error) setWalletRequests(requestsResult.data || []);
      } catch (error) {
        if (active) setWalletError(error?.message || "Could not connect to the wallet.");
      } finally {
        if (active) setWalletLoading(false);
      }
    };
    void loadWallet();
    return () => { active = false; };
  }, [authSession?.user?.id, walletRefresh]);

  const updateAvailability = async nextValue => {
    const userId = authSession?.user?.id;
    if (!userId) return;
    try {
      const { data, error } = await supabase.from("provider_profiles").update({ is_available: nextValue }).eq("user_id", userId).select("user_id").maybeSingle();
      if (error || !data) { notify(error?.message || "Provider profile is not ready yet. Complete account setup first."); return; }
      setProviderAvailable(nextValue);
      setJobsRefresh(value => value + 1);
    } catch (error) {
      notify(error?.message || "Could not update availability. Check your connection.");
    }
  };
  const submitOffer = async (event) => {
    event.preventDefault();
    if (!offerPrice || Number(offerPrice) <= 0) { notify("Enter a valid offer amount."); return; }
    if (!authSession?.user?.id || !offerJob?.id) { notify("Please sign in again before sending an offer."); return; }
    try {
      const { error } = await supabase.from("job_offers").insert({
        job_id: offerJob.id,
        provider_id: authSession.user.id,
        offered_price: Number(offerPrice),
        message: offerNote.trim() || null,
        status: "pending"
      });
      if (error) {
        if (error.code === "23505") notify("You have already sent an offer for this job.");
        else if (error.code === "42501") notify("Your provider profile must be verified and available before sending offers.");
        else notify(error.message || "Offer could not be sent.");
        return;
      }
    } catch (error) {
      notify(error?.message || "Offer could not be sent. Check your connection.");
      return;
    }
    setSubmittedOffers(current => [{ jobId: offerJob.id, title: offerJob.title, price: Number(offerPrice), note: offerNote, status: "pending", area: offerJob.area || "" }, ...current.filter(item => item.jobId !== offerJob.id)]);
    setJobsRefresh(value => value + 1);
    setOfferJob(null); setOfferPrice(""); setOfferNote("");
    notify("Your offer was sent to the customer.");
  };
  const requestRecharge = async (event) => {
    event.preventDefault();
    if (!Number.isFinite(Number(rechargeAmount)) || Number(rechargeAmount) < 100 || Number(rechargeAmount) > 50000) { notify(isHindi ? "₹100 से ₹50,000 के बीच राशि चुनें।" : "Enter an amount between ₹100 and ₹50,000."); return; }
    const utr = rechargeUtr.trim();
    if (!/^[A-Za-z0-9-]{8,22}$/.test(utr)) { notify(isHindi ? "वैध 8–22 अक्षर का UTR / संदर्भ नंबर जरूरी है।" : "A valid 8–22 character UTR/reference is required."); return; }
    if (!authSession?.user?.id) { notify("Please sign in again."); return; }
    setRechargeSubmitting(true);
    try {
      const { error } = await supabase.from("recharge_requests").insert({
        provider_id: authSession.user.id,
        amount: Number(rechargeAmount),
        utr,
        status: "pending"
      });
      if (error) {
        if (error.code === "23505") notify(isHindi ? "यह UTR पहले इस्तेमाल हो चुका है।" : "This UTR has already been submitted.");
        else notify(error.message || (isHindi ? "रिचार्ज अनुरोध भेजा नहीं जा सका।" : "Could not submit recharge request."));
        return;
      }
      setShowRecharge(false);
      setRechargeUtr("");
      setWalletRefresh(value => value + 1);
      notify(isHindi ? "अनुरोध भेज दिया गया। प्रबंधन भुगतान की जाँच करेगा।" : "Request submitted. Management will verify the payment.");
    } catch (error) {
      notify(error?.message || "Could not submit the recharge request. Check your connection.");
    } finally {
      setRechargeSubmitting(false);
    }
  };

  const offerResults = submittedOffers.length ? <div className="job-list">{submittedOffers.map(offer => <article className="job-card work-offer-card" key={offer.jobId}><div className="job-card-top"><div className="category-icon mint"><BriefcaseBusiness size={21} /></div><div className="job-main"><div className="job-title-row"><h3>{offer.title || (isHindi ? "काम का ऑफ़र" : "Job offer")}</h3><span className="job-id">{String(offer.jobId || "").slice(0,8).toUpperCase()}</span></div><p className="job-category">{[offer.area, offer.city].filter(Boolean).join(", ")}</p></div><StatusPill tone={offer.status === "accepted" ? "success" : offer.status === "rejected" || offer.status === "withdrawn" ? "neutral" : "warning"}>{offer.status || "pending"}</StatusPill></div><div className="work-offer-bottom"><div><span className="eyebrow">{isHindi ? "आपका ऑफ़र" : "YOUR OFFER"}</span><strong className="work-offer-price">₹{Number(offer.price).toLocaleString("en-IN")}</strong></div><div className="work-offer-message">{offer.note || (isHindi ? "कोई संदेश नहीं जोड़ा" : "No message added")}</div></div></article>)}</div> : <div className="empty-state"><ClipboardList size={25} /><strong>{isHindi ? "अभी कोई ऑफ़र नहीं" : "No offers sent yet"}</strong><p>{isHindi ? "उपलब्ध काम देखें और अपनी कीमत भेजें।" : "Browse available jobs and send your price."}</p><button className="button button-secondary" onClick={() => setJobTab("Available")}>{isHindi ? "काम देखें" : "Browse jobs"}</button></div>;
  const jobsResults = jobsLoading ? <div className="empty-state"><Activity size={25} /><strong>{isHindi ? "काम लोड हो रहे हैं…" : "Loading jobs…"}</strong></div> : jobsError ? <div className="empty-state"><CircleHelp size={25} /><strong>{isHindi ? "काम लोड नहीं हो सके" : "Could not load jobs"}</strong><p>{jobsError}</p><button className="button button-secondary" onClick={() => window.location.reload()}>{isHindi ? "फिर कोशिश करें" : "Retry"}</button></div> : filteredJobs.length ? <div className="job-list">{filteredJobs.map(job => <JobCard key={job.id} job={job} onOpen={setSelectedJob} onOffer={setOfferJob} language={language} />)}</div> : <div className="empty-state"><Search size={25} /><strong>{isHindi ? "कोई काम नहीं मिला" : "No jobs found"}</strong><p>{isHindi ? "आपका प्रोफ़ाइल सत्यापित और उपलब्ध होने पर आपके क्षेत्र के काम यहाँ दिखेंगे।" : "Jobs appear here when your provider profile is verified, available and matched to a service area."}</p><button className="button button-secondary" onClick={() => { setQuery(""); setCategoryFilter("All categories"); setJobTab("Available"); }}>{isHindi ? "फ़िल्टर हटाएँ" : "Clear filters"}</button></div>;

  if (authLoading) {
    return <div className="account-loading"><div className="brand-mark"><Activity size={24} /></div><h1>FindVia Provider</h1><p>Restoring your secure session…</p></div>;
  }
  if (!authSession || new URLSearchParams(window.location.search).get("reset-password") === "true") {
    return <AccountAccessPage language={language} authMessage={authMessage} setAuthMessage={setAuthMessage} initialMode={new URLSearchParams(window.location.search).get("reset-password") === "true" ? "reset" : "signin"} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand-lockup"><div className="brand-mark"><Activity size={22} strokeWidth={2.5} /></div><div><strong>FindVia</strong><small>PROVIDER APP</small></div><IconButton label="Close menu" className="sidebar-close" onClick={() => setMobileMenu(false)}><X size={20} /></IconButton></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-link ${page === item.id ? "active" : ""}`} onClick={() => go(item.id)}><Icon size={19} strokeWidth={1.9} /><span>{isHindi ? ({home:"होम",jobs:"काम",work:"मेरे काम",wallet:"वॉलेट",profile:"प्रोफ़ाइल"}[item.id]) : item.label}</span>{item.id === "jobs" && <span className="nav-count">{jobs.length}</span>}</button>; })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><div className="help-icon"><CircleHelp size={19} /></div><strong>Need a hand?</strong><p>We're here to help you get work done.</p><button onClick={() => notify("Support will be connected in a later step.")}>Get support <ArrowRight size={14} /></button></div>
        <div className="sidebar-user"><div className="avatar">{profileName.trim().split(/\s+/).slice(0,2).map(part => part[0] || "").join("").toUpperCase() || "FV"}</div><div className="user-copy"><strong>{profileName}</strong><span>Provider account · Demo</span></div><ChevronDown size={16} /></div>
      </aside>

      {mobileMenu && <button className="scrim" aria-label="Close menu overlay" onClick={() => setMobileMenu(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left"><IconButton label="Open menu" className="menu-toggle" onClick={() => setMobileMenu(true)}><Menu size={21} /></IconButton><div className="breadcrumb">{isHindi ? "प्रदाता कार्यक्षेत्र" : "Provider workspace"} <span>/</span> <strong>{isHindi ? ({home:"होम",jobs:"काम",work:"मेरे काम",wallet:"वॉलेट",profile:"प्रोफ़ाइल",account:"खाता",verification:"सत्यापन",notifications:"सूचनाएँ",support:"सहायता"}[page] || "विवरण") : (navItems.find(item => item.id === page)?.label || "Details")}</strong></div></div>
          <div className="topbar-actions"><button className="language-toggle" type="button" onClick={() => setLanguage(value => value === "English" ? "Hindi" : "English")} aria-label={isHindi ? "Switch app language to English" : "ऐप की भाषा हिंदी करें"}><span className="language-globe">文</span>{isHindi ? "हिंदी" : "English"} <ChevronDown size={13} /></button><div className="demo-indicator"><span /> {isHindi ? "पूर्वावलोकन" : "Preview mode"}</div><IconButton label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19} /><i className="notification-dot" /></IconButton><div className="topbar-avatar">{profileName.trim().split(/\s+/).slice(0,2).map(part => part[0] || "").join("").toUpperCase() || "FV"}</div></div>
        </header>

        {notificationsOpen && <div className="notification-popover"><div className="popover-heading"><strong>{isHindi ? "सूचनाएँ" : "Notifications"}</strong><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={16} /></button></div>{notificationsLoading ? <div className="empty-state compact-empty">{isHindi ? "लोड हो रहा है…" : "Loading…"}</div> : notificationsError ? <div className="empty-state compact-empty">{isHindi ? "सूचनाएँ लोड नहीं हुईं" : "Could not load notifications"}</div> : notifications.length ? notifications.slice(0,4).map(item => <button type="button" className={`notification-item notification-clickable ${item.read_at ? "" : "notification-unread"}`} key={item.id} onClick={() => { void markNotificationRead(item.id); setNotificationsOpen(false); go("notifications"); }}><span className="notification-symbol green"><Bell size={16} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString(isHindi ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></div></button>) : <div className="empty-state compact-empty">{isHindi ? "अभी कोई सूचना नहीं है।" : "No notifications yet."}</div>}<button className="text-button" onClick={() => { setNotificationsOpen(false); go("notifications"); }}>{isHindi ? "सभी सूचनाएँ देखें" : "View all notifications"}</button></div>}

        <div className="page-content">
          {page === "home" && !selectedJob && <HomePage go={go} onOpenJob={setSelectedJob} onOffer={setOfferJob} submittedOffers={submittedOffers} jobs={jobs} jobsLoading={jobsLoading} jobsError={jobsError} available={providerAvailable} setAvailable={updateAvailability} language={language} name={profileName} />}
          {page === "jobs" && !selectedJob && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">FIND YOUR NEXT JOB</span><h1>{isHindi ? "काम के अनुरोध" : "Job requests"}</h1><p>{isHindi ? "अपने कौशल और सेवा क्षेत्र से मेल खाने वाला काम देखें।" : "Explore work that matches your skills and service area."}</p></div><div className="heading-icon"><BriefcaseBusiness size={23} /></div></div><div className="filter-row"><div className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={isHindi ? "काम या क्षेत्र खोजें" : "Search jobs or areas"} aria-label={isHindi ? "काम या क्षेत्र खोजें" : "Search jobs or areas"} /><kbd>/</kbd></div><button className={`button button-secondary filter-button ${filterOpen ? "filter-active" : ""}`} aria-expanded={filterOpen} onClick={() => setFilterOpen(open => !open)}><Filter size={16} /> {isHindi ? "फ़िल्टर" : "Filters"}{categoryFilter !== "All categories" && <span className="filter-dot" />}</button></div>{filterOpen && <div className="filter-panel"><label htmlFor="job-category-filter">{isHindi ? "सेवा श्रेणी" : "Service category"}</label><select id="job-category-filter" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option>All categories</option>{[...new Set(jobs.map(job => job.category))].map(category => <option key={category}>{category}</option>)}</select><button className="text-button" onClick={() => { setCategoryFilter("All categories"); setQuery(""); }}>{isHindi ? "फ़िल्टर हटाएँ" : "Clear filters"}</button></div>}<div className="tabs" role="tablist" aria-label="Job filters">{["Available", "My offers"].map(tab => <button role="tab" aria-selected={jobTab === tab} className={jobTab === tab ? "selected" : ""} key={tab} onClick={() => setJobTab(tab)}>{isHindi ? (tab === "Available" ? "उपलब्ध काम" : "मेरे ऑफ़र") : tab}{tab === "My offers" && submittedOffers.length > 0 && <span className="tab-count">{submittedOffers.length}</span>}</button>)}</div><div className="section-subheading"><strong>{jobTab === "Available" ? (isHindi ? "आपके लिए सुझाव" : "Recommended for you") : (isHindi ? "आपके भेजे ऑफ़र" : "Offers you sent")}</strong><span>{jobTab === "Available" ? filteredJobs.length : submittedOffers.length} {isHindi ? "काम" : (jobTab === "Available" ? (filteredJobs.length === 1 ? "job" : "jobs") : (submittedOffers.length === 1 ? "offer" : "offers"))}</span></div>
          {jobTab === "My offers" ? offerResults : jobsResults}</section>}

          {selectedJob && <JobDetails job={selectedJob} onBack={() => setSelectedJob(null)} onOffer={setOfferJob} language={language} />}
          {page === "work" && !selectedJob && <MyWorkPage offers={submittedOffers} go={go} language={language} notify={notify} />}
          {page === "wallet" && !selectedJob && <WalletPage onRecharge={() => setShowRecharge(true)} requests={walletRequests} balance={walletBalance} ledger={walletLedger} loading={walletLoading} error={walletError} language={language} />}
          {page === "profile" && !selectedJob && <ProfilePage onSignOut={async () => { const { error } = await supabase.auth.signOut(); if (error) notify(error.message); else { setPage("home"); notify("You have signed out."); } }} name={profileName} setName={setProfileName} service={profileService} setService={setProfileService} skills={profileSkills} setSkills={setProfileSkills} areas={serviceAreas} setAreas={setServiceAreas} categories={availableCategories} serviceAreasList={availableAreas} loading={profileLoading} saving={profileSaving} profileError={profileError} verificationStatus={providerVerificationStatus} onSave={saveProfile} language={language} setLanguage={setLanguage} notify={notify} go={go} />}
          {page === "account" && <AccountAccessPage go={go} notify={notify} language={language} />}
          {page === "verification" && <VerificationPage notify={notify} go={go} language={language} />}
          {page === "notifications" && <NotificationsPage go={go} language={language} notifications={notifications} loading={notificationsLoading} error={notificationsError} onRead={markNotificationRead} onRefresh={() => setNotificationsRefresh(value => value + 1)} />}
          {page === "support" && <SupportPage notify={notify} language={language} />}
        </div>

        <footer className="app-footer"><span>© 2026 FindVia</span><span><ShieldCheck size={14} /> Your work. Your growth.</span><span>Preview build · No real transactions</span></footer>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => go(item.id)}><Icon size={20} /><span>{isHindi ? ({home:"होम",jobs:"काम",work:"मेरे काम",wallet:"वॉलेट",profile:"प्रोफ़ाइल"}[item.id]) : item.label}</span></button>; })}</nav>

      {offerJob && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOfferJob(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="offer-title"><div className="modal-heading"><div><span className="eyebrow">JOB OFFER</span><h2 id="offer-title">{isHindi ? "अपना ऑफ़र भेजें" : "Send your offer"}</h2><p>{offerJob.title}</p></div><IconButton label="Close dialog" onClick={() => setOfferJob(null)}><X size={20} /></IconButton></div><div className="preview-notice"><Sparkles size={17} /><span>Offers are sent to the customer only when your provider account is verified and the job is open.</span></div><form onSubmit={submitOffer}><label htmlFor="offer-price">{isHindi ? "आपकी कीमत (₹)" : "Your price (₹)"}</label><div className="price-input"><IndianRupee size={19} /><input id="offer-price" type="number" min="1" step="1" required value={offerPrice} onChange={event => setOfferPrice(event.target.value)} placeholder="Enter your offer amount" /></div><label htmlFor="offer-note">{isHindi ? "छोटा संदेश" : "Short message"} <span className="optional">{isHindi ? "वैकल्पिक" : "Optional"}</span></label><textarea id="offer-note" value={offerNote} onChange={event => setOfferNote(event.target.value)} maxLength="240" placeholder="Tell the customer how you can help…" rows="3" /><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setOfferJob(null)}>{isHindi ? "रद्द करें" : "Cancel"}</button><button type="submit" className="button button-primary">{isHindi ? "ऑफ़र भेजें" : "Send offer"} <ArrowRight size={16} /></button></div></form></section></div>}

      {showRecharge && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowRecharge(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="recharge-title"><div className="modal-heading"><div><span className="eyebrow">WALLET</span><h2 id="recharge-title">{isHindi ? "रिचार्ज अनुरोध" : "Request a recharge"}</h2><p>{isHindi ? "भुगतान करने के बाद UTR भेजें; प्रबंधन जाँच करेगा।" : "Submit the UTR after payment; management will verify it."}</p></div><IconButton label="Close dialog" onClick={() => setShowRecharge(false)}><X size={20} /></IconButton></div><div className="preview-notice"><ShieldCheck size={17} /><span>{isHindi ? "यह फ़ॉर्म भुगतान नहीं करता। गलत UTR देने पर अनुरोध अस्वीकार हो सकता है।" : "This form does not collect payment. An incorrect UTR may be rejected."}</span></div><form onSubmit={requestRecharge}><label htmlFor="recharge-amount">{isHindi ? "रिचार्ज राशि" : "Recharge amount"}</label><div className="amount-options">{["100", "200", "500", "1000", "2000"].map(amount => <button type="button" key={amount} className={rechargeAmount === amount ? "chosen" : ""} onClick={() => setRechargeAmount(amount)}>₹{Number(amount).toLocaleString("en-IN")}</button>)}</div><div className="price-input"><IndianRupee size={19} /><input id="recharge-amount" type="number" min="100" max="50000" step="1" value={rechargeAmount} onChange={event => setRechargeAmount(event.target.value)} required /></div><label htmlFor="recharge-utr">{isHindi ? "UPI UTR / संदर्भ संख्या" : "UPI UTR / reference"}</label><input className="form-control" id="recharge-utr" value={rechargeUtr} onChange={event => setRechargeUtr(event.target.value.slice(0,22))} placeholder={isHindi ? "8–22 अक्षर का UTR" : "Enter 8–22 character UTR"} required minLength="8" maxLength="22" autoComplete="off" /><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowRecharge(false)}>{isHindi ? "रद्द करें" : "Cancel"}</button><button type="submit" className="button button-primary">{rechargeSubmitting ? (isHindi ? "भेज रहे हैं…" : "Submitting…") : (isHindi ? "अनुरोध भेजें" : "Submit request")} <ArrowRight size={16} /></button></div></form></section></div>}

      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function HomePage({ go, onOpenJob, onOffer, submittedOffers, jobs, jobsLoading, jobsError, available, setAvailable, language, name }) {
  const hi = language === "Hindi";
  const now = new Date();
  const dateLabel = now.toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const hour = now.getHours();
  const greeting = hi ? (hour < 12 ? "सुप्रभात" : hour < 17 ? "नमस्ते" : "शुभ संध्या") : (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  return <section className="page-section home-page"><div className="welcome-row"><div><span className="eyebrow">{dateLabel}</span><h1>{greeting}, {name || (hi ? "प्रदाता" : "Provider")} <span className="wave">✳</span></h1><p>{hi ? "आज काम के अच्छे अवसर खोजें।" : "Ready to make today a good workday?"}</p></div><button className={`availability-toggle ${available ? "is-available" : "is-unavailable"}`} onClick={() => setAvailable(!available)} aria-pressed={available}><span className="availability-dot" /><span><strong>{available ? (hi ? "काम के लिए उपलब्ध" : "Available for work") : (hi ? "अभी उपलब्ध नहीं" : "Not available")}</strong><small>{available ? (hi ? "आपको काम के अनुरोध मिल सकते हैं" : "You can receive job requests") : (hi ? "नया काम रुका हुआ है" : "New work is paused")}</small></span><span className="availability-switch"><i /></span></button></div>
    <div className="hero-card"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={14} /> {hi ? "आपका प्रोवाइडर स्पेस" : "YOUR PROVIDER SPACE"}</span><h2>{hi ? <>अच्छे काम के लिए<br />बेहतरीन अवसर।</> : <>Good work deserves<br />great opportunities.</>}</h2><p>{hi ? "अपने कौशल के अनुसार काम खोजें, भरोसे के साथ ऑफ़र भेजें और अपने काम को व्यवस्थित रखें।" : "Find jobs that fit your skills, send offers with confidence, and keep your work organised."}</p><button className="button hero-button" onClick={() => go("jobs")}>{hi ? "काम खोजें" : "Explore jobs"} <ArrowRight size={16} /></button></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-circle"><BriefcaseBusiness size={43} strokeWidth={1.35} /></div><div className="art-chip chip-one"><Zap size={15} />{hi ? "नया काम" : "New work"}</div><div className="art-chip chip-two"><Check size={15} />{hi ? "आपका अगला कदम" : "Your next step"}</div></div></div>
    <div className="metric-grid"><Metric icon={BriefcaseBusiness} label={hi ? "नए अवसर" : "New opportunities"} value={available ? String(jobs.length).padStart(2, "0") : "—"} note={available ? (hi ? "आपके सेवा क्षेत्र में" : "In your service area") : (hi ? "उपलब्धता रुकी हुई है" : "Availability is paused")} tone="mint" /><Metric icon={MessageCircle} label={hi ? "भेजे गए ऑफ़र" : "Offers sent"} value={String(submittedOffers.length).padStart(2, "0")} note={hi ? "आपके खाते के ऑफ़र" : "Offers in your account"} tone="violet" /><Metric icon={Wallet} label={hi ? "वॉलेट बैलेंस" : "Wallet balance"} value="₹0" note={hi ? "खाता जोड़ने पर सक्रिय होगा" : "Connect account to activate"} tone="amber" /></div>
    <div className="content-grid"><div className="content-column"><div className="section-heading"><div><h2>{hi ? "आपके लिए चुने गए काम" : "Jobs picked for you"}</h2><p>{hi ? "आपकी सेवा और क्षेत्र के आधार पर।" : "Based on your service category and area."}</p></div><button className="text-button" onClick={() => go("jobs")}>{hi ? "सभी देखें" : "View all"} <ArrowRight size={15} /></button></div><div className="job-list compact">{jobsLoading ? <div className="empty-state compact-empty">{hi ? "काम लोड हो रहे हैं…" : "Loading jobs…"}</div> : jobsError ? <div className="empty-state compact-empty">{hi ? "काम लोड नहीं हो सके।" : "Could not load jobs."}</div> : jobs.length ? jobs.slice(0, 2).map(job => <JobCard key={job.id} job={job} onOpen={onOpenJob} onOffer={onOffer} language={language} />) : <div className="empty-state compact-empty">{hi ? "अभी कोई सत्यापित काम उपलब्ध नहीं है।" : "No verified jobs are available yet."}</div>}</div></div><aside className="side-column"><div className="tip-card"><div className="tip-icon"><Sparkles size={19} /></div><span className="eyebrow">A SMALL TIP</span><h3>Make your profile stand out</h3><p>Add your skills and experience so the right jobs can find you.</p><button className="text-button" onClick={() => go("profile")}>Update profile <ArrowRight size={15} /></button></div><div className="status-card"><div className="status-card-heading"><span className="status-icon"><ShieldCheck size={18} /></span><strong>Provider checklist</strong></div><div className="checklist-row"><span className="check-circle"><Check size={12} /></span><span>Account preview created</span><StatusPill>Demo</StatusPill></div><div className="checklist-row"><span className="check-circle pending"><Clock3 size={12} /></span><span>Identity verification</span><StatusPill tone="warning">Pending setup</StatusPill></div><div className="checklist-row"><span className="check-circle pending"><Clock3 size={12} /></span><span>Connect secure wallet</span><StatusPill tone="warning">Pending setup</StatusPill></div></div></aside></div>
  </section>;
}

function Metric({ icon: Icon, label, value, note, tone }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></div>;
}

function JobDetails({ job, onBack, onOffer, language }) {
  const hi = language === "Hindi";
  const Icon = job.icon;
  return <section className="page-section">
    <button className="back-link" onClick={onBack}>← {hi ? "काम पर वापस जाएँ" : "Back to jobs"}</button>
    <div className="page-heading"><div><span className="eyebrow">{hi ? "काम का विवरण" : "JOB DETAILS"} · {job.reference || job.id}</span><h1>{job.title}</h1><p>{hi ? "ऑफ़र भेजने से पहले उपलब्ध जानकारी देखें।" : "Review the available details before sending an offer."}</p></div><div className={`category-icon large ${job.tint}`}><Icon size={26} /></div></div>
    <div className="details-layout">
      <div className="panel details-panel">
        <h2>{hi ? "काम की जानकारी" : "About this job"}</h2>
        <p className="details-description">{job.detail}</p>
        <div className="detail-line"><MapPin size={18} /><div><strong>{hi ? "सेवा क्षेत्र" : "Service area"}</strong><span>{job.area}</span><small>{hi ? "सटीक पता और ग्राहक का संपर्क मैच होने तक निजी रहेगा।" : "Exact address and customer contact stay private until matching."}</small></div></div>
        <div className="detail-line"><CalendarDays size={18} /><div><strong>{hi ? "पोस्ट किया गया" : "Posted"}</strong><span>{job.date}</span></div></div>
        <div className="detail-line"><BriefcaseBusiness size={18} /><div><strong>{hi ? "सेवा श्रेणी" : "Service category"}</strong><span>{hi ? (job.categoryHindi || job.category) : job.category}</span></div></div>
        <div className="privacy-note"><ShieldCheck size={18} /><span>{hi ? "ग्राहक की संपर्क जानकारी चयन और मैच होने के बाद ही उपलब्ध होगी।" : "Customer contact details become available only after selection and matching."}</span></div>
      </div>
      <aside className="panel offer-summary"><span className="eyebrow">{hi ? "आपका ऑफ़र" : "YOUR OFFER"}</span><strong className="large-price">{hi ? "अपनी कीमत तय करें" : "Your price"}</strong><p>{hi ? "ग्राहक आपके ऑफ़र की समीक्षा करके प्रदाता चुन सकता है।" : "The customer can review your offer before selecting a provider."}</p><div className="summary-divider" /><div className="summary-detail"><span>{hi ? "काम का संदर्भ" : "Job reference"}</span><strong>{job.reference || job.id}</strong></div><div className="summary-detail"><span>{hi ? "ऑफ़र प्रक्रिया" : "Offer process"}</span><strong>{hi ? "एक आसान चरण" : "One simple step"}</strong></div><button className="button button-primary full-button" onClick={() => onOffer(job)}>{hi ? "ऑफ़र भेजें" : "Send an offer"} <ArrowRight size={16} /></button><p className="fine-print">{hi ? "ऑफ़र भेजने के लिए सत्यापित और उपलब्ध प्रदाता खाता आवश्यक है।" : "A verified, available provider account is required to send an offer."}</p></aside>
    </div>
  </section>;
}

function MyWorkPage({ offers, go, language }) {
  const hi = language === "Hindi";
  const [tab, setTab] = useState("Offers");
  const matchedOffers = offers.filter(offer => offer.status === "accepted");
  const tabs = [
    { label: "Offers", count: offers.filter(offer => offer.status !== "accepted").length },
    { label: "Matched", count: matchedOffers.length },
    { label: "Active", count: 0 },
    { label: "Completed", count: 0 }
  ];
  const visibleOffers = tab === "Matched" ? matchedOffers : offers.filter(offer => offer.status !== "accepted");
  return <section className="page-section">
    <div className="page-heading">
      <div><span className="eyebrow">{hi ? "आपके काम की स्थिति" : "YOUR WORK STATUS"}</span><h1>{hi ? "मेरे काम" : "My work"}</h1><p>{hi ? "अपने भेजे गए ऑफ़र और काम की स्थिति देखें।" : "Track your offers and job progress."}</p></div>
      <div className="heading-icon"><ClipboardList size={24} /></div>
    </div>
    <div className="preview-notice work-notice"><ShieldCheck size={17} /><span>{hi ? "ऑफ़र आपके खाते से लोड होते हैं। मैच, सक्रिय काम और OTP पूरा करने का प्रवाह अभी सर्वर कार्यों से जोड़ा जाना बाकी है।" : "Offers load from your account. Matching, active work and OTP completion still need their secure server workflows."}</span></div>
    <div className="tabs work-tabs" role="tablist" aria-label="Work status">
      {tabs.map(item => <button key={item.label} role="tab" aria-selected={tab === item.label} className={tab === item.label ? "selected" : ""} onClick={() => setTab(item.label)}>{hi ? ({Offers:"ऑफ़र",Matched:"मैच हुए",Active:"जारी",Completed:"पूरे"}[item.label]) : item.label}<span className="tab-count">{item.count}</span></button>)}
    </div>
    {(tab === "Offers" || tab === "Matched") && visibleOffers.length > 0 ? <div className="job-list">{visibleOffers.map(offer => <article className="job-card work-offer-card" key={offer.jobId}>
      <div className="job-card-top"><div className="category-icon mint"><BriefcaseBusiness size={21} /></div><div className="job-main"><div className="job-title-row"><h3>{offer.title || (hi ? "काम का ऑफ़र" : "Job offer")}</h3><span className="job-id">{String(offer.jobId || "").slice(0,8).toUpperCase()}</span></div><p className="job-category">{[offer.area, offer.city].filter(Boolean).join(", ") || (hi ? "क्षेत्र की जानकारी उपलब्ध नहीं" : "Area details unavailable")}</p></div><StatusPill tone={offer.status === "accepted" ? "success" : offer.status === "rejected" || offer.status === "withdrawn" ? "neutral" : "warning"}>{offer.status || "pending"}</StatusPill></div>
      <div className="work-offer-bottom"><div><span className="eyebrow">{hi ? "आपका ऑफ़र" : "YOUR OFFER"}</span><strong className="work-offer-price">₹{Number(offer.price).toLocaleString("en-IN")}</strong></div><div className="work-offer-message">{offer.note || (hi ? "कोई संदेश नहीं जोड़ा" : "No message added")}</div></div>
    </article>)}</div> : <div className="empty-state work-empty"><div className="empty-icon"><ClipboardList size={23} /></div><strong>{tab === "Offers" ? (hi ? "अभी कोई ऑफ़र नहीं" : "No offers sent yet") : tab === "Matched" ? (hi ? "अभी कोई मैच नहीं" : "No matched jobs yet") : tab === "Active" ? (hi ? "अभी कोई सक्रिय काम नहीं" : "No active jobs yet") : (hi ? "अभी कोई पूरा काम नहीं" : "No completed jobs yet")}</strong><p>{tab === "Offers" ? (hi ? "उपलब्ध काम देखें और अपनी कीमत भेजें।" : "Browse available jobs and send your price.") : (hi ? "ग्राहक द्वारा ऑफ़र चुनने और सर्वर पर मैच दर्ज होने के बाद काम यहाँ दिखेगा।" : "Work appears here after the customer selects an offer and the server records the match.")}</p>{tab === "Offers" && <button className="button button-primary" onClick={() => go("jobs")}>{hi ? "काम खोजें" : "Explore jobs"} <ArrowRight size={16} /></button>}</div>}
  </section>;
}

function WalletPage({ onRecharge, requests, balance, ledger, loading, error, language }) {
  const hi = language === "Hindi";
  const commissionPaid = ledger.filter(item => item.entry_type === "commission").reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const totalRecharged = ledger.filter(item => item.entry_type === "recharge").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const statusText = status => ({ pending: hi ? "जाँच बाकी" : "Pending review", approved: hi ? "स्वीकृत" : "Approved", rejected: hi ? "अस्वीकृत" : "Rejected" })[status] || status;
  return <section className="page-section">
    <div className="page-heading"><div><span className="eyebrow">{hi ? "आपके वॉलेट का हिसाब" : "YOUR WALLET LEDGER"}</span><h1>{hi ? "वॉलेट और कमाई" : "Wallet & earnings"}</h1><p>{hi ? "वास्तविक बैलेंस और लेन-देन का सर्वर रिकॉर्ड देखें।" : "View your server-recorded balance and transactions."}</p></div><div className="heading-icon"><Wallet size={24} /></div></div>
    {error && <div className="preview-notice"><CircleHelp size={17} /><span>{hi ? "वॉलेट लोड करने में समस्या: " : "Wallet loading issue: "}{error}</span></div>}
    <div className="wallet-hero"><div className="wallet-topline"><span><Wallet size={16} /> {hi ? "प्रदाता वॉलेट" : "PROVIDER WALLET"}</span><StatusPill tone="success">{hi ? "सर्वर बैलेंस" : "Server balance"}</StatusPill></div><span className="wallet-label">{hi ? "उपलब्ध बैलेंस" : "Available balance"}</span><strong className="wallet-balance">{loading ? "—" : `₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><p>{hi ? "बैलेंस केवल सत्यापित लेन-देन से बदलेगा।" : "Your balance changes only through verified ledger transactions."}</p><button className="button wallet-button" onClick={onRecharge} disabled={loading}><ArrowDownLeft size={16} /> {hi ? "रिचार्ज अनुरोध" : "Request recharge"}</button><div className="wallet-decoration"><div /><div /><div /></div></div>
    <div className="wallet-stats"><div className="wallet-stat"><span><ArrowUpRight size={16} /> {hi ? "कुल कमीशन" : "Commission recorded"}</span><strong>₹{commissionPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>{hi ? "लेजर से" : "From ledger"}</small></div><div className="wallet-stat"><span><IndianRupee size={16} /> {hi ? "कुल रिचार्ज" : "Total recharged"}</span><strong>₹{totalRecharged.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>{hi ? "स्वीकृत लेन-देन" : "Recorded transactions"}</small></div><div className="wallet-stat"><span><CreditCard size={16} /> {hi ? "रिचार्ज अनुरोध" : "Recharge requests"}</span><strong>{requests.length.toString().padStart(2, "0")}</strong><small>{hi ? "सर्वर पर दर्ज" : "Saved to server"}</small></div></div>
    <div className="panel transaction-panel"><div className="section-heading"><div><h2>{hi ? "हाल की गतिविधि" : "Recent activity"}</h2><p>{hi ? "हर प्रविष्टि वॉलेट लेजर से आती है।" : "Every entry is read from the wallet ledger."}</p></div><FileText size={21} className="muted-icon" /></div>
      {loading ? <div className="empty-state compact-empty"><Activity size={20} /> {hi ? "लेन-देन लोड हो रहे हैं…" : "Loading transactions…"}</div> : ledger.length ? ledger.map(item => <div className="transaction-row" key={item.id}><div className="transaction-icon">{Number(item.amount) >= 0 ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div><div className="transaction-copy"><strong>{item.description || item.entry_type}</strong><span>{new Date(item.created_at).toLocaleString(hi ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></div><strong className="transaction-amount">{Number(item.amount) < 0 ? "−" : "+"}₹{Math.abs(Number(item.amount)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><StatusPill tone={Number(item.amount) < 0 ? "warning" : "success"}>{item.entry_type}</StatusPill></div>) : <div className="empty-state compact-empty"><Activity size={22} /><strong>{hi ? "अभी कोई लेन-देन नहीं" : "No transactions yet"}</strong><p>{hi ? "स्वीकृत रिचार्ज या सेवा लेन-देन यहाँ दिखेंगे।" : "Approved recharges and service transactions will appear here."}</p></div>}
    </div>
    <div className="panel transaction-panel"><div className="section-heading"><div><h2>{hi ? "रिचार्ज अनुरोध" : "Recharge requests"}</h2><p>{hi ? "प्रबंधन आपके UTR की जाँच करेगा।" : "Management will review your UTR."}</p></div><CreditCard size={21} className="muted-icon" /></div>
      {requests.length ? requests.map(item => <div className="transaction-row" key={item.id}><div className="transaction-icon"><ArrowDownLeft size={17} /></div><div className="transaction-copy"><strong>{hi ? "रिचार्ज अनुरोध" : "Recharge request"}</strong><span>UTR: {item.utr} · {new Date(item.created_at).toLocaleDateString(hi ? "hi-IN" : "en-IN")}</span></div><strong className="transaction-amount">₹{Number(item.amount).toLocaleString("en-IN")}</strong><StatusPill tone={item.status === "approved" ? "success" : item.status === "rejected" ? "neutral" : "warning"}>{statusText(item.status)}</StatusPill></div>) : <div className="empty-state compact-empty"><strong>{hi ? "कोई रिचार्ज अनुरोध नहीं" : "No recharge requests"}</strong><p>{hi ? "भुगतान के बाद अपना UTR देकर अनुरोध भेजें।" : "Submit a request with your UTR after payment."}</p></div>}
    </div>
    <div className="security-footnote"><ShieldCheck size={17} /><p><strong>{hi ? "सुरक्षा पहले।" : "Security first."}</strong> {hi ? "यह ऐप सीधे बैलेंस नहीं बदल सकता। प्रबंधन भुगतान की पुष्टि करता है और सर्वर लेजर अपडेट करता है।" : "The app cannot change balances directly. Management verifies payments and the server updates the ledger."}</p></div>
  </section>;
}

function ProfilePage({ onSignOut, name, setName, service, setService, skills, setSkills, areas, setAreas, categories, serviceAreasList, loading, saving, profileError, verificationStatus, onSave, language, setLanguage, go }) {
  const hi = language === "Hindi";
  const selectedCategory = categories.find(item => item.name_en === service);
  const statusLabel = ({ not_submitted: hi ? "सत्यापन बाकी" : "Not submitted", pending: hi ? "जाँच जारी" : "Under review", approved: hi ? "सत्यापित" : "Verified", rejected: hi ? "अस्वीकृत" : "Rejected", suspended: hi ? "निलंबित" : "Suspended" })[verificationStatus] || (hi ? "सत्यापन बाकी" : "Not submitted");
  const statusTone = verificationStatus === "approved" ? "success" : verificationStatus === "rejected" || verificationStatus === "suspended" ? "neutral" : "warning";
  return <section className="page-section">
    <div className="page-heading"><div><span className="eyebrow">{hi ? "आपकी पेशेवर पहचान" : "YOUR PROFESSIONAL IDENTITY"}</span><h1>{hi ? "मेरी प्रोफ़ाइल" : "My profile"}</h1><p>{hi ? "अपना नाम, सेवाएँ और सेवा क्षेत्र अपने खाते में सुरक्षित करें।" : "Save your name, services and service areas to your account."}</p></div><div className="heading-icon"><Settings2 size={24} /></div></div>
    {profileError && <div className="preview-notice"><CircleHelp size={17} /><span>{hi ? "प्रोफ़ाइल डेटा लोड करने में समस्या: " : "There was a problem loading profile data: "}{profileError}</span></div>}
    {loading && <div className="empty-state compact-empty"><Activity size={20} /> {hi ? "आपकी प्रोफ़ाइल लोड हो रही है…" : "Loading your profile…"}</div>}
    <div className="profile-layout">
      <div className="panel profile-card"><div className="profile-cover" /><div className="profile-avatar">{(name.trim().split(/\s+/).slice(0,2).map(part => part[0] || "").join("").toUpperCase() || "FV")}</div><div className="profile-intro"><h2>{name || (hi ? "आपका नाम" : "Your name")}</h2><p><ShieldCheck size={14} /> {hi ? "आपके खाते की सत्यापन स्थिति" : "Your account verification status"}</p><StatusPill tone={statusTone}>{statusLabel}</StatusPill></div><div className="profile-progress"><div><span>{hi ? "सेवाएँ चुनी गईं" : "Services selected"}</span><strong>{skills.length}</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, skills.length * 25)}%` }} /></div><small>{hi ? "ग्राहकों से संबंधित काम पाने के लिए अपनी सेवाएँ चुनें।" : "Choose services to receive matching jobs."}</small></div><div className="profile-settings"><button className="settings-row settings-button" onClick={() => go("verification")}><span className="settings-icon"><FileText size={18} /></span><div><strong>{hi ? "सत्यापन दस्तावेज़" : "Verification documents"}</strong><p>{hi ? "अपनी सत्यापन स्थिति देखें" : "Review your verification status"}</p></div><StatusPill tone={statusTone}>{statusLabel}</StatusPill><ArrowRight size={17} /></button><button className="settings-row settings-button" onClick={() => go("notifications")}><span className="settings-icon"><Bell size={18} /></span><div><strong>{hi ? "सूचनाएँ" : "Notifications"}</strong><p>{hi ? "काम और वॉलेट अपडेट" : "Job and wallet updates"}</p></div><ArrowRight size={17} /></button><button className="settings-row settings-button" onClick={() => go("support")}><span className="settings-icon"><CircleHelp size={18} /></span><div><strong>{hi ? "मदद और सहायता" : "Help & support"}</strong><p>{hi ? "सहायता अनुरोध तैयार करें" : "Prepare a support request"}</p></div><ArrowRight size={17} /></button><button className="settings-row settings-button signout-row" onClick={onSignOut}><span className="settings-icon"><ArrowUpRight size={18} /></span><div><strong>{hi ? "लॉगआउट" : "Sign out"}</strong><p>{hi ? "अपने खाते से सुरक्षित रूप से बाहर निकलें" : "Securely sign out of your account"}</p></div><ArrowRight size={17} /></button></div></div>
      <div className="panel profile-form"><div className="section-heading"><div><h2>{hi ? "मूल जानकारी" : "Basic information"}</h2><p>{hi ? "बदलाव सर्वर पर सुरक्षित होंगे।" : "Changes are saved securely to the backend."}</p></div></div>
        <label htmlFor="provider-name">{hi ? "पूरा नाम" : "Full name"}</label><input className="form-control" id="provider-name" value={name} onChange={event => setName(event.target.value)} maxLength="70" minLength="2" autoComplete="name" />
        <label htmlFor="provider-service">{hi ? "मुख्य सेवा" : "Main service"}</label><select className="form-control" id="provider-service" value={service} onChange={event => { setService(event.target.value); setSkills(current => current.includes(event.target.value) ? current : [...current, event.target.value]); }} disabled={!categories.length}><option value="">{hi ? "सेवा चुनें" : "Choose a service"}</option>{categories.map(item => <option key={item.id} value={item.name_en}>{hi ? item.name_hi || item.name_en : item.name_en}</option>)}</select>
        <label>{hi ? "आपकी सेवाएँ" : "Your services"}</label><div className="choice-chip-grid">{categories.map(item => <label className={`choice-chip ${skills.includes(item.name_en) ? "choice-chip-selected" : ""}`} key={item.id}><input type="checkbox" checked={skills.includes(item.name_en)} onChange={event => setSkills(current => event.target.checked ? [...current, item.name_en] : current.filter(value => value !== item.name_en))} /><span>{hi ? item.name_hi || item.name_en : item.name_en}</span></label>)}</div>{!categories.length && <p className="language-help">{hi ? "अभी कोई सक्रिय सेवा उपलब्ध नहीं है। प्रबंधन ऐप से सेवाएँ जोड़नी होंगी।" : "No active services are configured yet. Add services from the Management App."}</p>}
        <label>{hi ? "सेवा क्षेत्र (एक से अधिक चुन सकते हैं)" : "Service areas (select all that apply)"}</label><div className="choice-chip-grid">{serviceAreasList.map(area => { const label = [area.city, area.area_name].filter(Boolean).join(" · "); return <label className={`choice-chip ${areas.includes(area.id) ? "choice-chip-selected" : ""}`} key={area.id}><input type="checkbox" checked={areas.includes(area.id)} onChange={event => setAreas(current => event.target.checked ? [...current, area.id] : current.filter(value => value !== area.id))} /><span>{label}</span></label>; })}</div>{!serviceAreasList.length && <p className="language-help">{hi ? "अभी कोई सक्रिय सेवा क्षेत्र उपलब्ध नहीं है।" : "No active service areas are configured yet."}</p>}
        <label htmlFor="provider-language">{hi ? "ऐप की भाषा" : "App language"}</label><select className="form-control" id="provider-language" value={language} onChange={event => setLanguage(event.target.value)}><option>English</option><option>Hindi</option></select>
        <button className="button button-primary profile-save" onClick={onSave} disabled={loading || saving}>{saving ? (hi ? "सेव हो रहा है…" : "Saving profile…") : (hi ? "प्रोफ़ाइल सेव करें" : "Save profile")} {saving ? <Activity size={16} /> : <Check size={16} />}</button>
        <p className="language-help"><span>文</span> {hi ? "भाषा और प्रोफ़ाइल बदलाव सुरक्षित करने के लिए सेव करें।" : "Press Save profile to store your language and profile changes."}</p>
      </div>
    </div>
  </section>;
}

function AccountAccessPage({ language, authMessage, setAuthMessage = () => {}, initialMode = "signin" }) {
  const hi = language === "Hindi";
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [resetSecondsLeft, setResetSecondsLeft] = useState(0);

  useEffect(() => {
    if (!busy || mode !== "forgot") return;
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setResetSecondsLeft(Math.max(0, 12 - elapsedSeconds));
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [busy, mode]);

  const showResetMessage = text => {
    setMessage(text);
    setAuthMessage("");
  };

  const sendResetLink = async () => {
    if (busy) return;
    setNeedsEmailConfirm(false);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const text = hi ? "पहले अपना ईमेल लिखें।" : "Enter your email address first.";
      showResetMessage(text);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const text = hi ? "ईमेल पता सही लिखें, जैसे name@example.com।" : "Enter a valid email address, for example name@example.com.";
      showResetMessage(text);
      return;
    }

    const waiting = hi ? "Supabase Auth से संपर्क कर रहे हैं…" : "Contacting Supabase Auth…";
    showResetMessage(waiting);
    setBusy(true);
    setResetSecondsLeft(12);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!baseUrl || !publishableKey) {
        throw new Error("Supabase configuration is missing in the deployed app.");
      }
      const redirectTo = window.location.origin + window.location.pathname + "?reset-password=true";
      const response = await fetch(
        baseUrl.replace(/\/$/, "") + "/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectTo),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": publishableKey,
            "Authorization": `Bearer ${publishableKey}`
          },
          body: JSON.stringify({ email: cleanEmail }),
          signal: controller.signal
        }
      );
      const responseText = await response.text();
      let payload = {};
      try { payload = responseText ? JSON.parse(responseText) : {}; } catch { payload = {}; }
      if (!response.ok) {
        const detail = payload.msg || payload.message || payload.error_description || payload.error || ("HTTP " + response.status);
        throw new Error(detail);
      }
      const success = hi
        ? "Supabase ने अनुरोध स्वीकार कर लिया। Inbox और Spam देखें; ईमेल आने में थोड़ा समय लग सकता है।"
        : "Supabase accepted the request. Check Inbox and Spam; the email may take a little time to arrive.";
      showResetMessage(success);
    } catch (error) {
      let failure;
      if (error?.name === "AbortError") {
        failure = hi
          ? "12 सेकंड में Supabase से जवाब नहीं आया। यह नेटवर्क या Supabase Auth कनेक्शन की समस्या है।"
          : "Supabase did not respond within 12 seconds. This points to a network or Supabase Auth connection problem.";
      } else if (error instanceof TypeError) {
        failure = hi
          ? "Supabase तक कनेक्शन नहीं बन पाया। इंटरनेट और Supabase URL की जाँच ज़रूरी है।"
          : "Could not connect to Supabase. The internet connection or Supabase URL needs checking.";
      } else {
        failure = error?.message || (hi ? "रीसेट अनुरोध विफल हुआ।" : "Password reset request failed.");
      }
      showResetMessage(failure);
    } finally {
      window.clearTimeout(timeoutId);
      setBusy(false);
      setResetSecondsLeft(0);
    }
  };

  const submit = async event => {
    event.preventDefault();
    if (mode === "forgot") {
      void sendResetLink();
      return;
    }
    setMessage("");
    setAuthMessage("");
    if (mode === "signup" && !name.trim()) {
      setMessage(hi ? "कृपया अपना पूरा नाम लिखें।" : "Please enter your full name.");
      return;
    }
    if (mode === "signup" && phone && !/^[6-9][0-9]{9}$/.test(phone)) {
      setMessage(hi ? "10 अंकों का सही भारतीय मोबाइल नंबर लिखें।" : "Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setMessage(hi ? "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।" : "Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage(hi ? "पासवर्ड बदल गया। ऐप खोल रहे हैं…" : "Password updated. Opening the app…");
        window.history.replaceState({}, "", window.location.pathname);
        window.location.reload();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: name.trim(), phone: phone || null, app_role: "provider" },
            emailRedirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) throw error;
        if (data.session) {
          setMessage(hi ? "खाता बन गया। आपका कार्यक्षेत्र खुल रहा है…" : "Account created. Opening your workspace…");
        } else {
          setNeedsEmailConfirm(true);
          setMessage(hi ? "खाता बन गया। ईमेल confirmation link खोलें; पुष्टि के बाद FindVia Provider खुलेगा।" : "Signup request received. Open the email confirmation link; after confirmation, FindVia Provider will open.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });
        if (error) throw error;
        setMessage(hi ? "साइन इन सफल। आपका कार्यक्षेत्र खुल रहा है…" : "Signed in. Opening your workspace…");
      }
    } catch (error) {
      const raw = error?.message || "Authentication failed.";
      setMessage(raw);
    } finally {
      setBusy(false);
    }
  };

  return <section className="page-section account-page">
    <div className="account-layout">
      <div className="account-brand">
        <div className="account-brand-icon"><Activity size={30} /></div>
        <span className="eyebrow">FINDVIA PROVIDER</span>
        <h1>{hi ? "आपका काम, अब आसान।" : "Your work, made simpler."}</h1>
        <p>{hi ? "अपने खाते से सुरक्षित रूप से प्रवेश करें और अपने काम को संभालें।" : "Create your secure account to manage your provider profile and work."}</p>
        <div className="account-benefit"><ShieldCheck size={18} /><span>{hi ? "ग्राहक द्वारा चुने जाने तक संपर्क विवरण निजी रहते हैं।" : "Contact details should stay private until a customer selects you."}</span></div>
        <div className="account-benefit"><Wallet size={18} /><span>{hi ? "एक ही खाते से आगे चलकर वॉलेट और काम संभालें।" : "Use one account for your profile, jobs and wallet as features go live."}</span></div>
      </div>
      <div className="panel account-form-panel">
        <div className="account-mode">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); setNeedsEmailConfirm(false); }}>{hi ? "लॉगिन" : "Log in"}</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); setNeedsEmailConfirm(false); }}>{hi ? "नया खाता" : "Sign up"}</button>
        </div>
        <span className="eyebrow">{mode === "signin" ? (hi ? "वापसी पर स्वागत है" : "WELCOME BACK") : mode === "forgot" ? (hi ? "पासवर्ड वापस पाएँ" : "PASSWORD RECOVERY") : mode === "reset" ? (hi ? "नया पासवर्ड सेट करें" : "SET A NEW PASSWORD") : (hi ? "अपना खाता बनाएँ" : "CREATE YOUR ACCOUNT")}</span>
        <h2>{mode === "signin" ? (hi ? "FindVia में लॉगिन करें" : "Log in to FindVia") : mode === "forgot" ? (hi ? "रीसेट लिंक मँगाएँ" : "Reset your password") : mode === "reset" ? (hi ? "नया पासवर्ड लिखें" : "Choose a new password") : (hi ? "Provider अकाउंट बनाएँ" : "Create your provider account")}</h2>
        <p>{mode === "forgot" ? (hi ? "आपके ईमेल पर सुरक्षित reset link भेजेंगे।" : "We’ll email you a secure password reset link.") : mode === "reset" ? (hi ? "कम से कम 8 अक्षरों का नया पासवर्ड चुनें।" : "Choose a new password with at least 8 characters.") : (hi ? "ईमेल और पासवर्ड से सुरक्षित प्रवेश करें।" : "Use your email and password to continue securely.")}</p>
        <div id="auth-reset-status" className={needsEmailConfirm ? "preview-notice account-notice" : "account-auth-message"} role="status" aria-live="polite">{message || authMessage || " "}</div>
        {mode === "forgot" && busy && <div className="account-auth-message" role="timer" aria-live="off" style={{ marginTop: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid #d97706", borderRadius: 10, background: "#fff7ed", color: "#7c2d12", fontWeight: 600 }}><Clock3 size={18} />{hi ? "जवाब का इंतज़ार:" : "Waiting for response:"} <strong style={{ fontSize: 18 }}>{resetSecondsLeft}</strong> {hi ? "सेकंड" : "seconds"}</div>}
        <form onSubmit={submit} noValidate>
          {mode === "signup" && <>
            <label htmlFor="auth-full-name">{hi ? "पूरा नाम" : "Full name"}</label>
            <input className="form-control" id="auth-full-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength="70" required />
            <label htmlFor="auth-phone">{hi ? "मोबाइल नंबर (वैकल्पिक)" : "Mobile number (optional)"}</label>
            <div className="phone-field"><span>+91</span><input id="auth-phone" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder={hi ? "10 अंकों का नंबर" : "10-digit number"} /></div>
          </>}
          <label htmlFor="auth-email">{hi ? "ईमेल" : "Email address"}</label>
          <input className="form-control" id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {mode !== "forgot" && <><label htmlFor="auth-password">{mode === "reset" ? (hi ? "नया पासवर्ड" : "New password") : (hi ? "पासवर्ड" : "Password")}</label><input className="form-control" id="auth-password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength="8" value={password} onChange={e => setPassword(e.target.value)} required /></>}
          <button className="button button-primary full-button" type="button" disabled={busy} onClick={mode === "forgot" ? () => { void sendResetLink(); } : event => { event.preventDefault(); void submit(event); }}>{busy ? (hi ? "कृपया प्रतीक्षा करें…" : "Please wait…") : (mode === "signin" ? (hi ? "लॉगिन करें" : "Log in") : mode === "signup" ? (hi ? "खाता बनाएँ" : "Create account") : mode === "forgot" ? (hi ? "रीसेट लिंक भेजें" : "Send reset link") : (hi ? "पासवर्ड बदलें" : "Update password"))} <ArrowRight size={16} /></button>
        </form>
        <div className="account-mode-links">{mode === "signin" && <button type="button" onClick={() => { setMode("forgot"); setMessage(""); setNeedsEmailConfirm(false); }}>{hi ? "पासवर्ड भूल गए?" : "Forgot password?"}</button>}{mode !== "signin" && <button type="button" onClick={() => { setMode("signin"); setMessage(""); setNeedsEmailConfirm(false); }}>{hi ? "लॉगिन पर वापस जाएँ" : "Back to log in"}</button>}{mode === "signin" && <button type="button" onClick={() => { setMode("signup"); setMessage(""); setNeedsEmailConfirm(false); }}>{hi ? "नया खाता बनाएँ" : "Create an account"}</button>}</div>
        <p className="account-security-note"><ShieldCheck size={15} /> {hi ? "पासवर्ड सुरक्षित रूप से संभाला जाता है।" : "Passwords are handled securely and are never stored in this app."}</p>
      </div>
    </div>
  </section>;
}

function VerificationPage({ notify, go, language }) {
  const hi = language === "Hindi";
  const [documentType, setDocumentType] = useState("Identity proof");
  const [fileName, setFileName] = useState("");
  return <section className="page-section">
    <button className="back-link" onClick={() => go("profile")}>← Back to profile</button>
    <div className="page-heading"><div><span className="eyebrow">ACCOUNT SAFETY</span><h1>{hi ? "प्रदाता सत्यापन" : "Provider verification"}</h1><p>{hi ? "सत्यापन से ग्राहकों को प्रदाता चुनने में भरोसा मिलता है।" : "Verification helps customers feel confident choosing a provider."}</p></div><div className="heading-icon"><ShieldCheck size={24} /></div></div>
    <div className="preview-notice"><ShieldCheck size={17} /><span>{hi ? "दस्तावेज़ अपलोड और समीक्षा अभी जुड़े नहीं हैं। इस डेमो में असली पहचान दस्तावेज़ न दें।" : "Document upload and review are not connected yet. Do not submit real identity documents in this preview."}</span></div>
    <div className="panel verification-panel"><h2>{hi ? "दस्तावेज़ सूची" : "Documents checklist"}</h2><div className="verification-row"><span className="verification-icon"><FileText size={19} /></span><div><strong>{hi ? "पहचान प्रमाण" : "Identity proof"}</strong><p>{hi ? "खाता सत्यापन के लिए सरकारी पहचान पत्र आवश्यक है।" : "Government ID required for account verification."}</p></div><StatusPill tone="warning">Not submitted</StatusPill></div><div className="verification-row"><span className="verification-icon"><BriefcaseBusiness size={19} /></span><div><strong>{hi ? "कौशल या अनुभव प्रमाण" : "Skill or experience proof"}</strong><p>{hi ? "प्रमाणपत्र या काम का प्रमाण वैकल्पिक है।" : "Optional certificates or relevant work proof."}</p></div><StatusPill>Optional</StatusPill></div>
    <label htmlFor="doc-type">{hi ? "दस्तावेज़ का प्रकार" : "Document type"}</label><select className="form-control" id="doc-type" value={documentType} onChange={e => setDocumentType(e.target.value)}><option>Identity proof</option><option>Skill certificate</option><option>Experience proof</option></select><label htmlFor="doc-file">{hi ? "फ़ाइल चुनें (केवल डेमो)" : "Choose a file (preview only)"}</label><input className="form-control file-control" id="doc-file" type="file" accept="image/*,.pdf" onChange={e => setFileName(e.target.files?.[0]?.name || "")} /><p className="file-name">{fileName || "No file selected"}</p><button className="button button-primary" onClick={() => notify(fileName ? (hi ? "डेमो: फ़ाइल चुनी गई, अपलोड नहीं हुई।" : "Preview only: file was selected but not uploaded.") : (hi ? "पहले फ़ाइल चुनें। कोई दस्तावेज़ अपलोड नहीं होता।" : "Choose a file first. No documents are uploaded in preview mode."))}>{hi ? "आगे बढ़ें" : "Continue"} <ArrowRight size={16} /></button></div>
  </section>;
}

function NotificationsPage({ go, language, notifications, loading, error, onRead, onRefresh }) {
  const hi = language === "Hindi";
  return <section className="page-section">
    <div className="page-heading"><div><span className="eyebrow">{hi ? "महत्वपूर्ण अपडेट" : "IMPORTANT UPDATES"}</span><h1>{hi ? "सूचनाएँ" : "Notifications"}</h1><p>{hi ? "आपके खाते से मिली वास्तविक सूचनाएँ।" : "Live notifications associated with your account."}</p></div><div className="heading-icon"><Bell size={24} /></div></div>
    <div className="section-heading"><div><h2>{hi ? "हाल की सूचनाएँ" : "Recent notifications"}</h2><p>{hi ? "सूचना खोलने पर उसे पढ़ा हुआ चिह्नित किया जाएगा।" : "Opening a notification marks it as read."}</p></div><button className="button button-secondary" onClick={onRefresh} disabled={loading}><Activity size={16} /> {hi ? "रीफ़्रेश" : "Refresh"}</button></div>
    {error && <div className="preview-notice"><CircleHelp size={17} /><span>{error}</span></div>}
    {loading ? <div className="empty-state"><Activity size={24} /><strong>{hi ? "सूचनाएँ लोड हो रही हैं…" : "Loading notifications…"}</strong></div> : notifications.length ? <div className="panel notification-page-list">{notifications.map(item => <button type="button" className={`notification-item notification-clickable ${item.read_at ? "" : "notification-unread"}`} key={item.id} onClick={() => { void onRead(item.id); if (item.related_job_id) go("jobs"); }}><span className={`notification-symbol ${item.read_at ? "green" : "yellow"}`}>{item.event_type?.toLowerCase().includes("wallet") ? <Wallet size={16} /> : <BriefcaseBusiness size={16} />}</span><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString(hi ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></div><StatusPill tone={item.read_at ? "neutral" : "warning"}>{item.read_at ? (hi ? "पढ़ी गई" : "Read") : (hi ? "नई" : "New")}</StatusPill></button>)}</div> : <div className="empty-state"><div className="empty-icon"><Bell size={23} /></div><strong>{hi ? "अभी कोई सूचना नहीं" : "No notifications yet"}</strong><p>{hi ? "काम, ऑफ़र और वॉलेट से जुड़े अपडेट यहाँ दिखाई देंगे।" : "Updates about jobs, offers and wallet activity will appear here."}</p><button className="button button-primary" onClick={() => go("jobs")}>{hi ? "काम देखें" : "Explore jobs"} <ArrowRight size={16} /></button></div>}
  </section>;
}

function SupportPage({ notify, language }) {
  const hi = language === "Hindi";
  const [topic, setTopic] = useState("Job or offer");
  const [message, setMessage] = useState("");
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">WE'RE HERE TO HELP</span><h1>{hi ? "मदद और सहायता" : "Help & support"}</h1><p>{hi ? "जवाब पाएँ या सहायता अनुरोध तैयार करें।" : "Find answers or prepare a support request."}</p></div><div className="heading-icon"><CircleHelp size={24} /></div></div><div className="content-grid support-grid"><div className="panel support-faq"><h2>{hi ? "आम सवाल" : "Common questions"}</h2><details><summary>When can I see customer contact details?</summary><p>{hi ? "ग्राहक द्वारा आपका ऑफ़र चुनने और काम मैच होने के बाद ही।" : "Only after the customer selects your offer and the job is matched."}</p></details><details><summary>When is commission deducted?</summary><p>{hi ? "ग्राहक का completion OTP सुरक्षित सर्वर द्वारा सत्यापित होने के बाद।" : "After the customer completion OTP is verified by the secure server."}</p></details><details><summary>Can I recharge the wallet in preview mode?</summary><p>{hi ? "नहीं। डेमो अनुरोध से पैसे नहीं चलते और प्रबंधन तक अनुरोध नहीं पहुँचता।" : "No. Preview requests do not move money or reach management."}</p></details></div><div className="panel support-form"><h2>{hi ? "सहायता अनुरोध" : "Support request"}</h2><p>{hi ? "यह स्थानीय पूर्वावलोकन है; संदेश नहीं भेजा जाएगा।" : "This form is a local preview and will not send a message."}</p><label htmlFor="support-topic">{hi ? "किस विषय में सहायता चाहिए?" : "What do you need help with?"}</label><select className="form-control" id="support-topic" value={topic} onChange={e => setTopic(e.target.value)}><option>Job or offer</option><option>Wallet or commission</option><option>Profile verification</option><option>Account access</option><option>Other</option></select><label htmlFor="support-message">{hi ? "समस्या बताएँ" : "Describe the issue"}</label><textarea className="form-control" id="support-message" rows="4" maxLength="600" value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what happened…" /><button className="button button-primary" onClick={() => notify(message.trim() ? (hi ? "डेमो: सहायता अनुरोध अभी नहीं भेजा गया।" : "Preview only: support request is not sent yet.") : (hi ? "पहले समस्या बताएँ।" : "Please describe your issue first."))}>{hi ? "अनुरोध तैयार करें" : "Prepare request"} <ArrowRight size={16} /></button></div></div></section>;
}

export default App;