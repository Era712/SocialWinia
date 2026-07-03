"use client";

import {
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  ExternalLink,
  Filter,
  Gift,
  Lock,
  Mail,
  RefreshCw,
  Search,
  Server,
  Settings,
  User,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type View = "feed" | "profile";
type Status = "all" | "new" | "visited";
type FilterState = {
  maxValue: number;
  minValue: number;
  selectedCategories: string[];
  selectedPlatforms: string[];
  status: Status;
};

const platformOptions = [
  "Instagram",
  "TikTok",
  "X",
  "YouTube",
  "Facebook",
  "Threads",
  "Reddit",
  "Twitch",
  "LinkedIn",
  "Discord",
  "Telegram",
  "Kick",
];

const categoryOptions = [
  "Beauty",
  "Cash Prizes",
  "Crypto & Digital Assets",
  "Education & Courses",
  "Events & Experiences",
  "Fashion",
  "Food & Beverage",
  "Gaming",
  "Health & Wellness",
  "Home & Living",
  "Kids & Family",
  "Sports & Fitness",
  "Tech & Electronics",
  "Travel",
  "Vehicles & Mobility",
  "Other",
];

const demoGiveaways = [
  {
    id: "demo-1",
    title: "Win a PlayStation 5 Slim Bundle",
    value: 699,
    platform: "Instagram",
    organizer: "gamezone_daily",
    ends: "July 2, 2026",
    participants: "18.420",
    category: "Gaming",
    visited: false,
    url: "https://www.instagram.com/explore/tags/giveaway/",
  },
  {
    id: "demo-2",
    title: "iPhone 16 Pro Creator Giveaway",
    value: 1199,
    platform: "TikTok",
    organizer: "creatorhub",
    ends: "July 5, 2026",
    participants: "54.102",
    category: "Tech & Electronics",
    visited: true,
    url: "https://www.tiktok.com/tag/giveaway",
  },
  {
    id: "demo-3",
    title: "$500 Amazon Gift Card Drop",
    value: 500,
    platform: "X",
    organizer: "dealradar",
    ends: "July 3, 2026",
    participants: "7.314",
    category: "Cash Prizes",
    visited: false,
    url: "https://x.com/search?q=%23giveaway",
  },
  {
    id: "demo-4",
    title: "Weekend Trip for Two",
    value: 2400,
    platform: "YouTube",
    organizer: "travelnorth",
    ends: "July 28, 2026",
    participants: "31.889",
    category: "Travel",
    visited: false,
    url: "https://www.youtube.com/results?search_query=giveaway",
  },
  {
    id: "demo-5",
    title: "Gaming Chair and Desk Setup",
    value: 950,
    platform: "Reddit",
    organizer: "battlestation_mods",
    ends: "July 6, 2026",
    participants: "3.870",
    category: "Home & Living",
    visited: true,
    url: "https://www.reddit.com/r/giveaways/",
  },
];

type Giveaway = {
  category: string;
  ends: string;
  id: string;
  organizer: string;
  participants: string;
  platform: string;
  processingMethod?: string;
  title: string;
  url: string;
  value: number;
  visited: boolean;
};

type BackendGiveaway = {
  category?: string | null;
  end_date?: string | null;
  id?: string;
  organizer?: string | null;
  participants?: number | null;
  platform?: string | null;
  processing_method?: string | null;
  prize_value_chf?: number | null;
  title?: string | null;
  url?: string | null;
  visited?: boolean | null;
};

type UserProfile = {
  email: string;
  subscription_status: "trial" | "active" | "canceled" | "past_due";
  trial_ends_at: string;
};

const TEST_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true";
const TEST_LOGIN_STORAGE_KEY = "socialwinia-test-login";
const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
const TEST_USER_EMAIL = "test@socialwinia.com";

type BackendHealth = {
  services: Record<"openai" | "scrapingbee" | "stripe" | "supabase", boolean>;
  status: string;
};

type BackendStats = {
  lastScrapedAt: string | null;
  platformCounts: { count: number; platform: string }[];
  todayGiveaways: number;
  totalGiveaways: number;
};

type ScrapeRunResult = {
  errors: string[];
  fallbackCount: number;
  processedCount: number;
  rawCount: number;
  savedCount: number;
  skippedCount: number;
};

export default function Home() {
  const [view, setView] = useState<View>("feed");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [email, setEmail] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(4 * 60 * 60);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [backendStats, setBackendStats] = useState<BackendStats | null>(null);
  const [isScrapingNow, setIsScrapingNow] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeRunResult | null>(null);
  const [operationsMessage, setOperationsMessage] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    maxValue: 10000,
    minValue: 0,
    selectedCategories: [],
    selectedPlatforms: [],
    status: "all",
  });
  const [draftFilters, setDraftFilters] = useState<FilterState>(appliedFilters);
  const [giveawayItems, setGiveawayItems] = useState<Giveaway[]>(demoGiveaways);
  const [dataSource, setDataSource] = useState<"demo" | "live">("demo");

  useEffect(() => {
    if (TEST_LOGIN_ENABLED && window.localStorage.getItem(TEST_LOGIN_STORAGE_KEY) === "true") {
      setUser(createTestUser());
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setGiveawayItems(demoGiveaways);
      return;
    }

    if (isTestUser(user)) {
      setProfile(createTestProfile());
      return;
    }

    ensureUserProfile(user).then(setProfile).catch((error) => {
      console.warn("Could not load user profile.", error);
    });
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function loadGiveaways() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const response = await fetch(`${apiUrl}/giveaways`);

        if (!response.ok) {
          throw new Error(`Giveaway API returned ${response.status}`);
        }

        const payload = (await response.json()) as { giveaways?: BackendGiveaway[] };

        if (!mounted) {
          return;
        }

        let items = payload.giveaways?.length
          ? payload.giveaways.map(mapBackendGiveaway)
          : demoGiveaways;

        if (payload.giveaways?.length) {
          items = await applyVisitedState(items, user);
        }

        setGiveawayItems(items);
        setDataSource(payload.giveaways?.length ? "live" : "demo");
      } catch (error) {
        console.warn("Using demo giveaways because live data is unavailable.", error);
        setGiveawayItems(demoGiveaways);
        setDataSource("demo");
      }
    }

    loadGiveaways();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!profile) {
      setSecondsRemaining(4 * 60 * 60);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(profile.trial_ends_at).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(remaining);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    if (!user) {
      return;
    }

    loadOperationsData();
  }, [user]);

  const isPremium = profile?.subscription_status === "active";
  const isLocked = Boolean(user && profile && !isPremium && secondsRemaining <= 0);

  async function sendMagicLink() {
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setAuthMessage(error ? error.message : "Magic link sent. Check your email to sign in.");
  }

  function signInAsTestUser() {
    window.localStorage.setItem(TEST_LOGIN_STORAGE_KEY, "true");
    setUser(createTestUser());
    setAuthMessage("");
  }

  async function signOut() {
    window.localStorage.removeItem(TEST_LOGIN_STORAGE_KEY);
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
  }

  async function handleEnter(giveaway: Giveaway) {
    setGiveawayItems((items) =>
      items.map((item) => (item.id === giveaway.id ? { ...item, visited: true } : item))
    );

    if (user && dataSource === "live") {
      await supabase.from("visited_giveaways").upsert({
        giveaway_id: giveaway.id,
        user_id: user.id,
      });
    }

    window.open(giveaway.url, "_blank", "noopener,noreferrer");
  }

  async function startCheckout() {
    if (!user?.email) {
      window.alert("Please sign in before upgrading.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${apiUrl}/billing/checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, userId: user.id }),
    });

    const payload = (await response.json()) as { error?: string; url?: string };

    if (!response.ok || !payload.url) {
      window.alert(payload.error || "Checkout is not available yet.");
      return;
    }

    window.location.href = payload.url;
  }

  async function openBillingPortal() {
    if (!user?.email) {
      window.alert("Please sign in before managing billing.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${apiUrl}/billing/portal-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, userId: user.id }),
    });

    const payload = (await response.json()) as { error?: string; url?: string };

    if (!response.ok || !payload.url) {
      window.alert(payload.error || "Billing portal is not available yet.");
      return;
    }

    window.location.href = payload.url;
  }

  async function loadOperationsData() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    try {
      const [healthResponse, statsResponse] = await Promise.all([
        fetch(`${apiUrl}/health`),
        fetch(`${apiUrl}/stats`),
      ]);

      if (healthResponse.ok) {
        setBackendHealth((await healthResponse.json()) as BackendHealth);
      }

      if (statsResponse.ok) {
        setBackendStats((await statsResponse.json()) as BackendStats);
      }

      setOperationsMessage("");
    } catch (error) {
      setOperationsMessage("Backend is not reachable yet.");
      console.warn("Could not load operations data.", error);
    }
  }

  async function runScrapeNow() {
    setIsScrapingNow(true);
    setOperationsMessage("");

    try {
      const response = await fetch("/api/scrape", { method: "POST" });
      const payload = (await response.json()) as {
        data?: ScrapeRunResult;
        error?: string;
        success?: boolean;
      };

      if (!response.ok || !payload.success || !payload.data) {
        setOperationsMessage(payload.error || payload.data?.errors?.join(", ") || "Scrape run failed.");
        return;
      }

      setScrapeResult(payload.data);
      setOperationsMessage("Scrape run finished.");
      await loadOperationsData();
    } catch (error) {
      setOperationsMessage("Scrape run could not be started.");
      console.warn("Could not run scrape.", error);
    } finally {
      setIsScrapingNow(false);
    }
  }

  const filteredGiveaways = useMemo(() => {
    return giveawayItems.filter((giveaway) => {
      const matchesPlatform =
        appliedFilters.selectedPlatforms.length === 0 ||
        appliedFilters.selectedPlatforms.includes(giveaway.platform);
      const matchesCategory =
        appliedFilters.selectedCategories.length === 0 ||
        appliedFilters.selectedCategories.includes(giveaway.category);
      const matchesValue =
        giveaway.value >= appliedFilters.minValue &&
        (appliedFilters.maxValue >= 10000 || giveaway.value <= appliedFilters.maxValue);
      const matchesStatus =
        appliedFilters.status === "all" ||
        (appliedFilters.status === "new" && !giveaway.visited) ||
        (appliedFilters.status === "visited" && giveaway.visited);

      return matchesPlatform && matchesCategory && matchesValue && matchesStatus;
    });
  }, [appliedFilters, giveawayItems]);

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4 text-[#17202a]">
        <div className="rounded-md border border-[#d7dde5] bg-white p-6 text-center">
          <Gift className="mx-auto mb-3 text-[#0f766e]" size={32} />
          <p className="font-semibold">Loading SocialWinia...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <AuthView
        authMessage={authMessage}
        email={email}
        onEmailChange={setEmail}
        onSubmit={sendMagicLink}
        onTestLogin={TEST_LOGIN_ENABLED ? signInAsTestUser : undefined}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#17202a]">
      <header className="border-b border-[#d7dde5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#0f766e] text-white">
              <Gift size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold">SocialWinia</h1>
              <p className="text-sm text-[#627083]">All Giveaways. One App.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-[#cad2dc] bg-white px-3 py-2 text-sm font-semibold sm:flex">
              {isLocked ? <Lock size={16} /> : <Clock size={16} />}
              {isPremium ? "Premium active" : isLocked ? "Premium required" : `Trial access: ${formatDuration(secondsRemaining)}`}
            </div>
            <button
              onClick={signOut}
              className="rounded-md border border-[#cad2dc] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#eef2f6]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <nav className="mb-5 grid grid-cols-2 gap-2 rounded-md border border-[#d7dde5] bg-white p-1">
          <TabButton active={view === "feed"} icon={<Gift size={17} />} label="Feed" onClick={() => setView("feed")} />
          <TabButton active={view === "profile"} icon={<User size={17} />} label="Profile" onClick={() => setView("profile")} />
        </nav>

        {isLocked ? (
          <PremiumLock onUpgrade={startCheckout} />
        ) : (
          <>
            {view === "feed" && (
              <FeedView
                count={filteredGiveaways.length}
                dataSource={dataSource}
                draftFilters={draftFilters}
                filtersOpen={filtersOpen}
                giveaways={filteredGiveaways}
                onEnter={handleEnter}
                onUpgrade={startCheckout}
                onApplyFilters={() => {
                  setAppliedFilters(draftFilters);
                  setFiltersOpen(false);
                }}
                onResetFilters={() => {
                  const resetFilters: FilterState = {
                    maxValue: 10000,
                    minValue: 0,
                    selectedCategories: [],
                    selectedPlatforms: [],
                    status: "all",
                  };
                  setDraftFilters(resetFilters);
                  setAppliedFilters(resetFilters);
                }}
                setDraftFilters={setDraftFilters}
                setFiltersOpen={setFiltersOpen}
              />
            )}
            {view === "profile" && (
              <ProfileView
                backendHealth={backendHealth}
                backendStats={backendStats}
                isScrapingNow={isScrapingNow}
                onRefreshOperations={loadOperationsData}
                onRunScrape={runScrapeNow}
                onManageBilling={openBillingPortal}
                onUpgrade={startCheckout}
                operationsMessage={operationsMessage}
                profile={profile}
                scrapeResult={scrapeResult}
                user={user}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function mapBackendGiveaway(giveaway: BackendGiveaway): Giveaway {
  return {
    id: giveaway.id || crypto.randomUUID(),
    title: giveaway.title || "Untitled giveaway",
    value: Number(giveaway.prize_value_chf ?? 0),
    platform: formatPlatform(giveaway.platform || "Unknown"),
    organizer: giveaway.organizer || "unknown",
    ends: giveaway.end_date ? formatDate(giveaway.end_date) : "No end date",
    participants: Number(giveaway.participants ?? 0).toLocaleString("en-US"),
    category: giveaway.category || "Other",
    processingMethod: giveaway.processing_method || "openai",
    url: giveaway.url || "#",
    visited: Boolean(giveaway.visited),
  };
}

async function ensureUserProfile(user: SupabaseUser): Promise<UserProfile> {
  const { data: existingProfile, error: selectError } = await supabase
    .from("user_profiles")
    .select("email, subscription_status, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    return existingProfile as UserProfile;
  }

  const referralCode = `SW-${user.id.slice(0, 8).toUpperCase()}`;
  const { data: insertedProfile, error: insertError } = await supabase
    .from("user_profiles")
    .insert({
      email: user.email || "",
      id: user.id,
      referral_code: referralCode,
    })
    .select("email, subscription_status, trial_ends_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedProfile as UserProfile;
}

function createTestProfile(): UserProfile {
  return {
    email: TEST_USER_EMAIL,
    subscription_status: "trial",
    trial_ends_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  };
}

function createTestUser(): SupabaseUser {
  return {
    app_metadata: { provider: "test", providers: ["test"] },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: TEST_USER_EMAIL,
    id: TEST_USER_ID,
    role: "authenticated",
    user_metadata: {},
  } as SupabaseUser;
}

function isTestUser(user: SupabaseUser | null) {
  return user?.id === TEST_USER_ID;
}

async function applyVisitedState(items: Giveaway[], user: SupabaseUser | null) {
  if (!user) {
    return items;
  }

  const { data, error } = await supabase
    .from("visited_giveaways")
    .select("giveaway_id")
    .eq("user_id", user.id);

  if (error || !data?.length) {
    return items;
  }

  const visitedIds = new Set(data.map((item) => item.giveaway_id));

  return items.map((item) => ({
    ...item,
    visited: item.visited || visitedIds.has(item.id),
  }));
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatPlatform(platform: string) {
  const normalized = platform.toLowerCase();
  const platformNames: Record<string, string> = {
    discord: "Discord",
    facebook: "Facebook",
    instagram: "Instagram",
    kick: "Kick",
    linkedin: "LinkedIn",
    reddit: "Reddit",
    telegram: "Telegram",
    threads: "Threads",
    tiktok: "TikTok",
    twitch: "Twitch",
    x: "X",
    youtube: "YouTube",
  };

  return platformNames[normalized] || platform;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold ${
        active ? "bg-[#17202a] text-white" : "text-[#536171] hover:bg-[#eef2f6]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AuthView({
  authMessage,
  email,
  onEmailChange,
  onSubmit,
  onTestLogin,
}: {
  authMessage: string;
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onTestLogin?: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4 text-[#17202a]">
      <section className="w-full max-w-md rounded-md border border-[#d7dde5] bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-[#0f766e] text-white">
            <Gift size={23} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SocialWinia</h1>
            <p className="text-sm text-[#627083]">All Giveaways. One App.</p>
          </div>
        </div>

        <div className="mb-5 rounded-md border border-[#d7dde5] bg-[#f8fafc] p-4">
          <p className="font-bold">Start your 4-hour full access trial</p>
          <p className="mt-1 text-sm text-[#627083]">
            Enter only your email. No password, name, phone number or extra personal data.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#3b4654]">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-[#cad2dc] px-3 py-3"
          />
        </label>

        <button
          onClick={onSubmit}
          disabled={!email.includes("@")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#17202a] px-4 py-3 font-semibold text-white hover:bg-[#2a3746] disabled:cursor-not-allowed disabled:bg-[#9aa5b1]"
        >
          <Mail size={18} />
          Send magic link
        </button>

        {onTestLogin && (
          <button
            onClick={onTestLogin}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#cad2dc] bg-white px-4 py-3 font-semibold text-[#17202a] hover:bg-[#eef2f6]"
          >
            Continue as test user
          </button>
        )}

        {authMessage && (
          <p className="mt-3 rounded-md bg-[#e6f4f1] px-3 py-2 text-sm font-semibold text-[#0f766e]">
            {authMessage}
          </p>
        )}
      </section>
    </main>
  );
}

function FeedView({
  count,
  dataSource,
  draftFilters,
  filtersOpen,
  giveaways,
  onEnter,
  onUpgrade,
  onApplyFilters,
  onResetFilters,
  setDraftFilters,
  setFiltersOpen,
}: {
  count: number;
  dataSource: "demo" | "live";
  draftFilters: FilterState;
  filtersOpen: boolean;
  giveaways: Giveaway[];
  onEnter: (giveaway: Giveaway) => void;
  onUpgrade: () => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  setDraftFilters: (updater: FilterState | ((value: FilterState) => FilterState)) => void;
  setFiltersOpen: (value: boolean | ((value: boolean) => boolean)) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Giveaway Feed</h2>
            <p className="text-sm text-[#627083]">
              {count} matching giveaways found · {dataSource === "live" ? "Live data" : "Demo data"}
            </p>
          </div>
          <button
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex items-center gap-2 rounded-md bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#115e59]"
          >
            <Filter size={16} />
            {filtersOpen ? "Hide filters" : "Filters"}
          </button>
        </div>

        {filtersOpen && (
          <FilterView
            filter={draftFilters}
            onApply={onApplyFilters}
            onReset={onResetFilters}
            setFilter={setDraftFilters}
          />
        )}

        <div className="space-y-3">
          {giveaways.map((giveaway) => (
            <article
              key={giveaway.id}
              className={`rounded-md border p-4 ${
                giveaway.visited
                  ? "border-[#cfd5dd] bg-[#eef1f4] text-[#66717f]"
                  : "border-[#d7dde5] bg-white"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        giveaway.visited
                          ? "bg-[#d8dde4] text-[#66717f]"
                          : "bg-[#e6f4f1] text-[#0f766e]"
                      }`}
                    >
                      {giveaway.platform}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        giveaway.visited
                          ? "bg-[#d8dde4] text-[#66717f]"
                          : "bg-[#fff3d7] text-[#7a5200]"
                      }`}
                    >
                      CHF {giveaway.value.toLocaleString("en-US")}
                    </span>
                    {giveaway.visited && (
                      <span className="flex items-center gap-1 rounded bg-[#dbeafe] px-2 py-1 text-xs font-bold text-[#1d4ed8]">
                        <CheckCircle2 size={13} />
                        Visited
                      </span>
                    )}
                    {giveaway.processingMethod === "heuristic_fallback" && (
                      <span className="rounded bg-[#fff1f1] px-2 py-1 text-xs font-bold text-[#b42318]">
                        AI fallback
                      </span>
                    )}
                  </div>
                  <h3 className={`truncate text-lg font-bold ${giveaway.visited ? "text-[#5b6674]" : ""}`}>
                    {giveaway.title}
                  </h3>
                  <p className={`mt-1 text-sm ${giveaway.visited ? "text-[#7a8491]" : "text-[#627083]"}`}>
                    {giveaway.organizer} · ends {giveaway.ends} · {giveaway.participants} participants
                  </p>
                </div>
                <button
                  onClick={() => onEnter(giveaway)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#17202a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a3746]"
                >
                  Enter
                  <ExternalLink size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-md border border-[#d7dde5] bg-white p-4">
          <h3 className="font-bold">Available Today</h3>
          <p className="mt-2 text-3xl font-bold">547</p>
          <p className="text-sm text-[#627083]">new active giveaways</p>
        </div>
        <div className="rounded-md border border-[#d7dde5] bg-white p-4">
          <h3 className="font-bold">Limited Offer</h3>
          <p className="mt-2 text-sm text-[#627083]">Upgrade within the next 2 hours and get your first month for $2.99.</p>
          <button
            onClick={onUpgrade}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#b45309] px-3 py-2 text-sm font-semibold text-white hover:bg-[#92400e]"
          >
            <CreditCard size={16} />
            Upgrade
          </button>
        </div>
      </aside>
    </section>
  );
}

function FilterView({
  filter,
  onApply,
  onReset,
  setFilter,
}: {
  filter: FilterState;
  onApply: () => void;
  onReset: () => void;
  setFilter: (updater: FilterState | ((value: FilterState) => FilterState)) => void;
}) {
  const toggleValue = (values: string[], value: string) => {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  };

  const updateMinValue = (value: number) => {
    setFilter((current) => ({
      ...current,
      minValue: Math.min(value, current.maxValue),
    }));
  };

  const updateMaxValue = (value: number) => {
    setFilter((current) => ({
      ...current,
      maxValue: Math.max(value, current.minValue),
    }));
  };

  const updateMaxValueFromInput = (value: string) => {
    const parsedValue = Number(value.replace("+", ""));

    if (!Number.isNaN(parsedValue)) {
      updateMaxValue(parsedValue);
    }
  };

  return (
    <section className="rounded-md border border-[#d7dde5] bg-white p-4">
      <div className="mb-5 flex items-center gap-2">
        <Search size={20} />
        <h2 className="text-2xl font-bold">Filters</h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Platform">
          <MultiSelectGrid
            allLabel="All platforms"
            options={platformOptions}
            selectedValues={filter.selectedPlatforms}
            onChange={(selectedPlatforms) =>
              setFilter((current) => ({ ...current, selectedPlatforms }))
            }
            onToggle={(value) =>
              setFilter((current) => ({
                ...current,
                selectedPlatforms: toggleValue(current.selectedPlatforms, value),
              }))
            }
          />
        </Field>
        <Field label="Category">
          <MultiSelectGrid
            allLabel="All categories"
            options={categoryOptions}
            selectedValues={filter.selectedCategories}
            onChange={(selectedCategories) =>
              setFilter((current) => ({ ...current, selectedCategories }))
            }
            onToggle={(value) =>
              setFilter((current) => ({
                ...current,
                selectedCategories: toggleValue(current.selectedCategories, value),
              }))
            }
          />
        </Field>
        <Field
          label={`Prize value: CHF ${filter.minValue.toLocaleString("en-US")} - ${
            filter.maxValue >= 10000 ? "CHF 10,000+" : `CHF ${filter.maxValue.toLocaleString("en-US")}`
          }`}
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#627083]">Minimum CHF</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={filter.minValue}
                  onChange={(event) => updateMinValue(Number(event.target.value))}
                  className="w-full rounded-md border border-[#cad2dc] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#627083]">Maximum CHF</span>
                <input
                  type="text"
                  min={0}
                  max={10000}
                  step={50}
                  inputMode="numeric"
                  value={filter.maxValue >= 10000 ? "10000+" : filter.maxValue}
                  onChange={(event) => updateMaxValueFromInput(event.target.value)}
                  className="w-full rounded-md border border-[#cad2dc] px-3 py-2"
                />
              </label>
            </div>
            <DualRangeSlider
              maxValue={filter.maxValue}
              minValue={filter.minValue}
              onMaxChange={updateMaxValue}
              onMinChange={updateMinValue}
            />
          </div>
        </Field>
        <Field label="Status">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["all", "All"],
              ["new", "New"],
              ["visited", "Visited"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  setFilter((current) => ({ ...current, status: value as Status }))
                }
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  filter.status === value ? "border-[#17202a] bg-[#17202a] text-white" : "border-[#cad2dc] hover:bg-[#eef2f6]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-5 flex flex-col gap-2 border-t border-[#d7dde5] pt-4 sm:flex-row sm:justify-end">
        <button
          onClick={onReset}
          className="rounded-md border border-[#cad2dc] px-4 py-2 text-sm font-semibold hover:bg-[#eef2f6]"
        >
          Reset
        </button>
        <button
          onClick={onApply}
          className="rounded-md bg-[#17202a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a3746]"
        >
          Apply filters
        </button>
      </div>
    </section>
  );
}

function DualRangeSlider({
  maxValue,
  minValue,
  onMaxChange,
  onMinChange,
}: {
  maxValue: number;
  minValue: number;
  onMaxChange: (value: number) => void;
  onMinChange: (value: number) => void;
}) {
  const minPercent = (minValue / 10000) * 100;
  const maxPercent = (maxValue / 10000) * 100;

  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-semibold text-[#627083]">
        <span>CHF {minValue.toLocaleString("en-US")}</span>
        <span>{maxValue >= 10000 ? "CHF 10,000+" : `CHF ${maxValue.toLocaleString("en-US")}`}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#d7dde5]" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#0f766e]"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <input
          aria-label="Minimum prize value"
          type="range"
          min={0}
          max={10000}
          step={100}
          value={minValue}
          onChange={(event) => onMinChange(Number(event.target.value))}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
        <input
          aria-label="Maximum prize value"
          type="range"
          min={0}
          max={10000}
          step={100}
          value={maxValue}
          onChange={(event) => onMaxChange(Number(event.target.value))}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}

function MultiSelectGrid({
  allLabel,
  onChange,
  onToggle,
  options,
  selectedValues,
}: {
  allLabel: string;
  onChange: (value: string[]) => void;
  onToggle: (value: string) => void;
  options: string[];
  selectedValues: string[];
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`w-full rounded-md border px-3 py-2 text-left text-sm font-semibold ${
          selectedValues.length === 0
            ? "border-[#17202a] bg-[#17202a] text-white"
            : "border-[#cad2dc] hover:bg-[#eef2f6]"
        }`}
      >
        {allLabel}
      </button>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {options.map((option) => {
          const selected = selectedValues.includes(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-md border px-3 py-2 text-left text-sm font-semibold ${
                selected
                  ? "border-[#0f766e] bg-[#e6f4f1] text-[#0f766e]"
                  : "border-[#cad2dc] hover:bg-[#eef2f6]"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#3b4654]">{label}</span>
      {children}
    </label>
  );
}

function ProfileView({
  backendHealth,
  backendStats,
  isScrapingNow,
  onRefreshOperations,
  onRunScrape,
  onManageBilling,
  onUpgrade,
  operationsMessage,
  profile,
  scrapeResult,
  user,
}: {
  backendHealth: BackendHealth | null;
  backendStats: BackendStats | null;
  isScrapingNow: boolean;
  onRefreshOperations: () => void;
  onRunScrape: () => void;
  onManageBilling: () => void;
  onUpgrade: () => void;
  operationsMessage: string;
  profile: UserProfile | null;
  scrapeResult: ScrapeRunResult | null;
  user: SupabaseUser;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel icon={<Mail size={19} />} title="Account">
        <p className="text-sm text-[#627083]">{profile?.email || user.email}</p>
        <button className="mt-3 rounded-md border border-[#cad2dc] px-3 py-2 text-sm font-semibold hover:bg-[#eef2f6]">Change email</button>
      </Panel>
      <Panel icon={<Bell size={19} />} title="Notifications">
        <label className="flex items-center justify-between gap-3 text-sm">
          New giveaways
          <input type="checkbox" defaultChecked className="size-5 accent-[#0f766e]" />
        </label>
        <button className="mt-3 rounded-md border border-[#cad2dc] px-3 py-2 text-sm font-semibold hover:bg-[#eef2f6]">Edit preferences</button>
      </Panel>
      <Panel icon={<Gift size={19} />} title="Referral Program">
        <p className="text-sm text-[#627083]">Refer a friend: get +1 Premium day for every successful referral.</p>
      </Panel>
      <Panel icon={<Settings size={19} />} title="Subscription">
        <p className="text-sm text-[#627083]">
          Status: {profile?.subscription_status === "active" ? "Premium active" : "Trial active"}
          {profile?.trial_ends_at ? ` · Trial ends ${formatDate(profile.trial_ends_at)}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onUpgrade}
            className="rounded-md bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#115e59]"
          >
            Upgrade
          </button>
          <button
            onClick={onManageBilling}
            className="rounded-md border border-[#cad2dc] px-3 py-2 text-sm font-semibold hover:bg-[#eef2f6]"
          >
            Payment method
          </button>
          <button
            onClick={onManageBilling}
            className="rounded-md border border-[#cad2dc] px-3 py-2 text-sm font-semibold hover:bg-[#eef2f6]"
          >
            Cancel subscription
          </button>
        </div>
      </Panel>
      <Panel icon={<Server size={19} />} title="Service Status">
        <div className="grid gap-2 sm:grid-cols-2">
          <StatusPill label="Supabase" ok={backendHealth?.services.supabase} />
          <StatusPill label="OpenAI" ok={backendHealth?.services.openai} />
          <StatusPill label="ScrapingBee" ok={backendHealth?.services.scrapingbee} />
          <StatusPill label="Stripe" ok={backendHealth?.services.stripe} />
        </div>
        <button
          onClick={onRefreshOperations}
          className="mt-3 flex items-center gap-2 rounded-md border border-[#cad2dc] px-3 py-2 text-sm font-semibold hover:bg-[#eef2f6]"
        >
          <RefreshCw size={16} />
          Refresh status
        </button>
      </Panel>
      <Panel icon={<Database size={19} />} title="Giveaway Data">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Total giveaways" value={backendStats?.totalGiveaways ?? 0} />
          <Metric label="New today" value={backendStats?.todayGiveaways ?? 0} />
        </div>
        <p className="mt-3 text-sm text-[#627083]">
          Last scrape: {backendStats?.lastScrapedAt ? formatDateTime(backendStats.lastScrapedAt) : "Not available"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(backendStats?.platformCounts ?? []).slice(0, 6).map((item) => (
            <span key={item.platform} className="rounded bg-[#eef2f6] px-2 py-1 text-xs font-bold text-[#536171]">
              {formatPlatform(item.platform)} · {item.count}
            </span>
          ))}
        </div>
      </Panel>
      <Panel icon={<Activity size={19} />} title="Scraping Control">
        <p className="text-sm text-[#627083]">
          Start a manual scrape after Supabase, OpenAI and ScrapingBee are configured.
        </p>
        <button
          onClick={onRunScrape}
          disabled={isScrapingNow}
          className="mt-3 flex items-center gap-2 rounded-md bg-[#17202a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2a3746] disabled:cursor-not-allowed disabled:bg-[#9aa5b1]"
        >
          <RefreshCw size={16} />
          {isScrapingNow ? "Scraping..." : "Run scrape now"}
        </button>
        {operationsMessage && (
          <p className="mt-3 rounded-md bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#536171]">
            {operationsMessage}
          </p>
        )}
        {scrapeResult && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Raw posts" value={scrapeResult.rawCount} />
            <Metric label="Saved" value={scrapeResult.savedCount} />
            <Metric label="Processed" value={scrapeResult.processedCount} />
            <Metric label="Skipped" value={scrapeResult.skippedCount} />
            <Metric label="AI fallback" value={scrapeResult.fallbackCount} />
          </div>
        )}
      </Panel>
    </section>
  );
}

function StatusPill({ label, ok }: { label: string; ok?: boolean }) {
  const unknown = typeof ok === "undefined";

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm font-semibold ${
        unknown
          ? "border-[#cad2dc] bg-[#f8fafc] text-[#627083]"
          : ok
            ? "border-[#b7e4d8] bg-[#e6f4f1] text-[#0f766e]"
            : "border-[#f1c9c9] bg-[#fff1f1] text-[#b42318]"
      }`}
    >
      {label}: {unknown ? "Unknown" : ok ? "Connected" : "Missing"}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#d7dde5] bg-[#f8fafc] p-3">
      <p className="text-xs font-bold uppercase text-[#627083]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString("en-US")}</p>
    </div>
  );
}

function Panel({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-[#d7dde5] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PremiumLock({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section className="mx-auto max-w-md rounded-md border border-[#d7dde5] bg-white p-6 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-[#17202a] text-white">
        <Lock size={24} />
      </div>
      <h2 className="text-2xl font-bold">Premium Required</h2>
      <p className="mt-3 text-sm text-[#627083]">Available today:</p>
      <p className="mt-1 text-3xl font-bold">547 new giveaways</p>
      <button
        onClick={onUpgrade}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#0f766e] px-4 py-3 font-semibold text-white hover:bg-[#115e59]"
      >
        <CreditCard size={18} />
        Upgrade to Premium · $4.99 / month
      </button>
    </section>
  );
}
