"use client";

import {
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Filter,
  Gift,
  Lock,
  Mail,
  RefreshCw,
  Search,
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
    followers: "18,420",
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
    followers: "54,102",
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
    followers: "7,314",
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
    followers: "31,889",
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
    followers: "3,870",
    category: "Home & Living",
    visited: true,
    url: "https://www.reddit.com/r/giveaways/",
  },
];

type Giveaway = {
  category: string;
  ends: string;
  followers: string;
  id: string;
  organizer: string;
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
  followers?: number | null;
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
const SHOW_DEMO_GIVEAWAYS = process.env.NODE_ENV !== "production";
const TRIAL_SECONDS = 4 * 60 * 60;
const LIMITED_OFFER_SECONDS = 60 * 60;

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
  const [secondsRemaining, setSecondsRemaining] = useState(TRIAL_SECONDS);
  const [offerSecondsRemaining, setOfferSecondsRemaining] = useState(LIMITED_OFFER_SECONDS);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isScrapingNow, setIsScrapingNow] = useState(false);
  const [operationsMessage, setOperationsMessage] = useState("");
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [profileMessage, setProfileMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    maxValue: 10000,
    minValue: 0,
    selectedCategories: [],
    selectedPlatforms: [],
    status: "all",
  });
  const [draftFilters, setDraftFilters] = useState<FilterState>(appliedFilters);
  const [giveawayItems, setGiveawayItems] = useState<Giveaway[]>(
    SHOW_DEMO_GIVEAWAYS ? demoGiveaways : []
  );
  const [dataSource, setDataSource] = useState<"demo" | "live">(
    SHOW_DEMO_GIVEAWAYS ? "demo" : "live"
  );

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
      setGiveawayItems(SHOW_DEMO_GIVEAWAYS ? demoGiveaways : []);
      setDataSource(SHOW_DEMO_GIVEAWAYS ? "demo" : "live");
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

        const backendGiveaways = payload.giveaways ?? [];
        let items = backendGiveaways.map(mapBackendGiveaway).filter(isSpecificGiveaway);

        if (items.length) {
          items = await applyVisitedState(items, user);
        }

        if (!items.length && SHOW_DEMO_GIVEAWAYS) {
          setGiveawayItems(demoGiveaways);
          setDataSource("demo");
          return;
        }

        setGiveawayItems(items);
        setDataSource("live");
      } catch (error) {
        console.warn("Could not load live giveaways.", error);
        setGiveawayItems(SHOW_DEMO_GIVEAWAYS ? demoGiveaways : []);
        setDataSource(SHOW_DEMO_GIVEAWAYS ? "demo" : "live");
      }
    }

    loadGiveaways();

    return () => {
      mounted = false;
    };
  }, [user, feedRefreshToken]);

  useEffect(() => {
    if (!profile) {
      setSecondsRemaining(TRIAL_SECONDS);
      setOfferSecondsRemaining(LIMITED_OFFER_SECONDS);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(profile.trial_ends_at).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(remaining);
      setOfferSecondsRemaining(Math.min(LIMITED_OFFER_SECONDS, Math.max(0, remaining - (TRIAL_SECONDS - LIMITED_OFFER_SECONDS))));
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [profile]);

  const isPremium = profile?.subscription_status === "active";
  const isLocked = Boolean(user && profile && !isPremium && secondsRemaining <= 0);

  function showProfileMessage(message: string) {
    setProfileMessage(message);
    window.setTimeout(() => setProfileMessage(""), 4000);
  }

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

    if (isTestUser(user)) {
      window.alert("The billing portal needs a real Stripe customer. Use Upgrade to test checkout.");
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

      setOperationsMessage("");
      setFeedRefreshToken((value) => value + 1);
    } catch (error) {
      setOperationsMessage("Scrape run could not be started.");
      console.warn("Could not run scrape.", error);
    } finally {
      setIsScrapingNow(false);
    }
  }

  const filteredGiveaways = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return giveawayItems.filter((giveaway) => {
      const searchableText = [
        giveaway.title,
        giveaway.organizer,
        giveaway.platform,
        giveaway.category,
        giveaway.ends,
      ]
        .join(" ")
        .toLowerCase();
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
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesPlatform && matchesCategory && matchesValue && matchesStatus && matchesSearch;
    });
  }, [appliedFilters, giveawayItems, searchQuery]);

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_0%,rgba(255,210,63,0.14),transparent_28%),linear-gradient(180deg,#0b2f25_0%,#071713_100%)] px-4 text-[#fff8e7]">
        <div className="rounded-md border border-[#1f6f58] bg-[#12372d] p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.42)]">
          <Gift className="mx-auto mb-3 text-[#ffd23f]" size={32} />
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
    <main className="relative min-h-screen overflow-hidden bg-[#071713] text-[#fff8e7]">
      <BrandBackdrop />
      <header className="relative z-10 border-b border-[#1f6f58] bg-[#0b1117]/95 shadow-[0_12px_40px_rgba(0,0,0,0.38)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/socialwinia-logo.png"
              alt="SocialWinia"
              className="h-12 w-auto max-w-[190px] object-contain sm:h-14 sm:max-w-[230px]"
            />
            <div>
              <p className="text-sm text-[#cbe7d6]">All Giveaways. One App.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <button
                onClick={!isPremium && !isLocked ? startCheckout : undefined}
                className="flex max-w-[220px] items-start gap-2 rounded-md border border-[#2c6f58] bg-[#102f27] px-3 py-2 text-left text-xs font-semibold text-[#fff8e7] hover:bg-[#174638] sm:max-w-none sm:text-sm"
              >
                {isLocked ? <Lock size={16} /> : <Clock size={16} />}
                <span className="flex flex-col leading-tight">
                  <span>
                    {isPremium ? "Premium active" : isLocked ? "Premium required" : `Trial access ends in ${formatDuration(secondsRemaining)}`}
                  </span>
                  {!isPremium && !isLocked && offerSecondsRemaining > 0 && (
                    <span className="mt-1 text-xs font-bold text-[#ff8ac4]">
                      Upgrade in {formatDuration(offerSecondsRemaining)} for your first month at $2.99.
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={signOut}
                className="rounded-md border border-[#2c6f58] bg-[#102f27] px-3 py-2 text-sm font-semibold text-[#fff8e7] hover:bg-[#174638]"
              >
                Sign out
              </button>
            </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-5">
        <nav className="mb-5 grid grid-cols-2 gap-2 rounded-md border border-[#1f6f58] bg-[#12372d] p-1 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
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
                isScrapingNow={isScrapingNow}
                onEnter={handleEnter}
                onRunScrape={runScrapeNow}
                operationsMessage={operationsMessage}
                searchQuery={searchQuery}
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
                setSearchQuery={setSearchQuery}
                setDraftFilters={setDraftFilters}
                setFiltersOpen={setFiltersOpen}
              />
            )}
            {view === "profile" && (
              <ProfileView
                onManageBilling={openBillingPortal}
                onUpgrade={startCheckout}
                onChangeEmail={() => showProfileMessage("Email changes will be available after production email is configured.")}
                profile={profile}
                profileMessage={profileMessage}
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
    followers: Number(giveaway.followers ?? giveaway.participants ?? 0).toLocaleString("en-US"),
    category: giveaway.category || "Other",
    processingMethod: giveaway.processing_method || "openai",
    url: giveaway.url || "#",
    visited: Boolean(giveaway.visited),
  };
}

function isSpecificGiveaway(giveaway: Giveaway) {
  try {
    const parsedUrl = new URL(giveaway.url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    const platform = giveaway.platform.toLowerCase();

    if (hostname === "example.com" || hostname.endsWith(".example.com")) {
      return false;
    }

    switch (platform) {
      case "instagram":
        return pathname.startsWith("/p/") || pathname.startsWith("/reel/") || pathname.startsWith("/tv/");
      case "tiktok":
        return pathname.includes("/video/");
      case "x":
      case "twitter":
        return pathname.includes("/status/");
      case "youtube":
        return (
          hostname === "youtu.be" ||
          (hostname.includes("youtube.com") && (pathname === "/watch" || pathname.startsWith("/shorts/")))
        );
      case "facebook":
        return (
          !pathname.includes("/hashtag/") &&
          (pathname.includes("/posts/") ||
            pathname.includes("/permalink/") ||
            pathname.includes("/videos/") ||
            pathname.includes("/reel/") ||
            parsedUrl.searchParams.has("story_fbid"))
        );
      case "threads":
        return pathname.includes("/post/");
      case "reddit":
        return pathname.includes("/comments/");
      case "linkedin":
        return pathname.includes("/feed/update/");
      case "telegram": {
        const parts = pathname.split("/").filter(Boolean);
        return parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1]);
      }
      case "discord":
      case "kick":
      case "twitch":
        return true;
      default:
        return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
    }
  } catch {
    return false;
  }
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
        active ? "bg-[#ffd23f] text-[#0b1117]" : "text-[#cbe7d6] hover:bg-[#174638] hover:text-[#fff8e7]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function BrandBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src="/socialwinia-background.jpg"
        alt=""
        className="h-full w-full translate-y-24 object-cover object-top opacity-70 saturate-150"
      />
      <div className="absolute inset-0 bg-[#06120f]/52" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,210,63,0.2),transparent_30%),radial-gradient(circle_at_16%_28%,rgba(255,47,143,0.18),transparent_24%),linear-gradient(180deg,rgba(11,47,37,0.22)_0%,rgba(7,23,19,0.66)_100%)]" />
    </div>
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
    <main className="relative grid min-h-screen overflow-hidden place-items-center bg-[#071713] px-4 text-[#fff8e7]">
      <BrandBackdrop />
      <section className="relative z-10 w-full max-w-md rounded-md border border-[#1f6f58] bg-[#12372d]/92 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur">
        <div className="mb-5 flex items-center gap-3">
          <img
            src="/socialwinia-logo.png"
            alt="SocialWinia"
            className="h-16 w-auto max-w-[250px] object-contain"
          />
          <div>
            <p className="text-sm text-[#cbe7d6]">All Giveaways. One App.</p>
          </div>
        </div>

        <div className="mb-5 rounded-md border border-[#2c6f58] bg-[#102f27] p-4">
          <p className="font-bold">Start your 4-hour full access trial</p>
          <p className="mt-1 text-sm text-[#cbe7d6]">
            Enter only your email. No password, name, phone number or extra personal data.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#fff8e7]">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-[#2c6f58] bg-[#071713] px-3 py-3 text-[#fff8e7] outline-none placeholder:text-[#7fb59b] focus:border-[#ffd23f]"
          />
        </label>

        <button
          onClick={onSubmit}
          disabled={!email.includes("@")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#ffd23f] px-4 py-3 font-semibold text-[#0b1117] shadow-[0_0_28px_rgba(255,210,63,0.22)] hover:bg-[#ffe36d] disabled:cursor-not-allowed disabled:bg-[#2c6f58] disabled:text-[#7fb59b]"
        >
          <Mail size={18} />
          Send magic link
        </button>

        {onTestLogin && (
          <button
            onClick={onTestLogin}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#2c6f58] bg-[#102f27] px-4 py-3 font-semibold text-[#fff8e7] hover:bg-[#174638]"
          >
            Continue as test user
          </button>
        )}

        {authMessage && (
          <p className="mt-3 rounded-md border border-[#2f6b5f] bg-[#102d2b] px-3 py-2 text-sm font-semibold text-[#70d6bf]">
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
  isScrapingNow,
  onEnter,
  onRunScrape,
  operationsMessage,
  searchQuery,
  onApplyFilters,
  onResetFilters,
  setSearchQuery,
  setDraftFilters,
  setFiltersOpen,
}: {
  count: number;
  dataSource: "demo" | "live";
  draftFilters: FilterState;
  filtersOpen: boolean;
  giveaways: Giveaway[];
  isScrapingNow: boolean;
  onEnter: (giveaway: Giveaway) => void;
  onRunScrape: () => void;
  operationsMessage: string;
  searchQuery: string;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  setSearchQuery: (value: string) => void;
  setDraftFilters: (updater: FilterState | ((value: FilterState) => FilterState)) => void;
  setFiltersOpen: (value: boolean | ((value: boolean) => boolean)) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Giveaway Feed</h2>
            <p className="text-sm text-[#cbe7d6]">
              {count} matching giveaways found · {dataSource === "live" ? "Live data" : "Demo data"}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={onRunScrape}
              disabled={isScrapingNow}
              className="flex items-center gap-2 rounded-md border border-[#2c6f58] bg-[#102f27] px-3 py-2 text-sm font-semibold text-[#fff8e7] hover:bg-[#174638] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={isScrapingNow ? "animate-spin" : ""} size={16} />
              {isScrapingNow ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex items-center gap-2 rounded-md bg-[#ffd23f] px-3 py-2 text-sm font-semibold text-[#0b1117] hover:bg-[#ffe36d]"
            >
              <Filter size={16} />
              {filtersOpen ? "Hide filters" : "Filters"}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7fb59b]"
            size={17}
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search giveaways, organizers, platforms..."
            className="w-full rounded-md border border-[#2c6f58] bg-[#071713] py-3 pl-10 pr-3 text-sm font-semibold text-[#fff8e7] outline-none placeholder:text-[#7fb59b] focus:border-[#ffd23f]"
          />
        </div>

        {operationsMessage && (
          <div className="rounded-md border border-[#2c6f58] bg-[#102f27] px-4 py-3 text-sm font-semibold text-[#cbe7d6]">
            {operationsMessage}
          </div>
        )}

        {filtersOpen && (
          <FilterView
            filter={draftFilters}
            onApply={onApplyFilters}
            onReset={onResetFilters}
            setFilter={setDraftFilters}
          />
        )}

        {dataSource === "demo" && (
          <div className="rounded-md border border-[#2c6f58] bg-[#102f27] px-4 py-3 text-sm font-semibold text-[#cbe7d6]">
            Demo giveaways use example discovery links. Live scraped giveaways open the exact original post.
          </div>
        )}

        <div className="space-y-3">
          {giveaways.length === 0 && (
            <div className="rounded-md border border-[#1f6f58] bg-[#12372d] p-5 text-sm text-[#cbe7d6] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h3 className="text-lg font-bold text-[#fff8e7]">No exact giveaway links yet</h3>
              <p className="mt-2">
                SocialWinia only shows direct giveaway posts here. Overview pages, hashtag pages, and platform search
                pages are hidden so the Enter button always points to a real giveaway.
              </p>
              <p className="mt-2">Click Refresh to search for new direct giveaway links.</p>
            </div>
          )}

          {giveaways.map((giveaway) => (
            <article
              key={giveaway.id}
              className={`rounded-md border p-4 ${
                giveaway.visited
                  ? "border-[#265244] bg-[#10241f] text-[#8fb7a6]"
                  : "border-[#1f6f58] bg-[#12372d] shadow-[0_10px_30px_rgba(0,0,0,0.24)]"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        giveaway.visited
                          ? "bg-[#18342c] text-[#91c7b0]"
                          : "bg-[#104c3a] text-[#7dffc7]"
                      }`}
                    >
                      {giveaway.platform}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        giveaway.visited
                          ? "bg-[#18342c] text-[#91c7b0]"
                          : "bg-[#4a3a13] text-[#ffe36d]"
                      }`}
                    >
                      CHF {giveaway.value.toLocaleString("en-US")}
                    </span>
                    {giveaway.visited && (
                      <span className="flex items-center gap-1 rounded bg-[#123b55] px-2 py-1 text-xs font-bold text-[#6bd5ff]">
                        <CheckCircle2 size={13} />
                        Visited
                      </span>
                    )}
                    {giveaway.processingMethod === "heuristic_fallback" && (
                      <span className="rounded bg-[#4b1634] px-2 py-1 text-xs font-bold text-[#ff8ac4]">
                        AI fallback
                      </span>
                    )}
                  </div>
                  <h3 className={`truncate text-lg font-bold ${giveaway.visited ? "text-[#8fb7a6]" : "text-[#fff8e7]"}`}>
                    {giveaway.title}
                  </h3>
                  <p className={`mt-1 text-sm ${giveaway.visited ? "text-[#8fb7a6]" : "text-[#cbe7d6]"}`}>
                    {giveaway.organizer} · ends {giveaway.ends} · {giveaway.followers} followers
                  </p>
                </div>
                <button
                  onClick={() => onEnter(giveaway)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#ffd23f] px-4 py-2 text-sm font-semibold text-[#0b1117] hover:bg-[#ffe36d]"
                >
                  Enter
                  <ExternalLink size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

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
    <section className="rounded-md border border-[#1f6f58] bg-[#12372d] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
      <div className="mb-5 flex items-center gap-2">
        <Search className="text-[#ffd23f]" size={20} />
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
                <span className="mb-1 block text-xs font-semibold text-[#cbe7d6]">Minimum CHF</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={filter.minValue}
                  onChange={(event) => updateMinValue(Number(event.target.value))}
                  className="w-full rounded-md border border-[#2c6f58] bg-[#071713] px-3 py-2 text-[#fff8e7] outline-none focus:border-[#ffd23f]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#cbe7d6]">Maximum CHF</span>
                <input
                  type="text"
                  min={0}
                  max={10000}
                  step={50}
                  inputMode="numeric"
                  value={filter.maxValue >= 10000 ? "10000+" : filter.maxValue}
                  onChange={(event) => updateMaxValueFromInput(event.target.value)}
                  className="w-full rounded-md border border-[#2c6f58] bg-[#071713] px-3 py-2 text-[#fff8e7] outline-none focus:border-[#ffd23f]"
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
                  filter.status === value
                    ? "border-[#ffd23f] bg-[#ffd23f] text-[#0b1117]"
                    : "border-[#2c6f58] bg-[#102f27] text-[#fff8e7] hover:bg-[#174638]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-5 flex flex-col gap-2 border-t border-[#1f6f58] pt-4 sm:flex-row sm:justify-end">
        <button
          onClick={onReset}
          className="rounded-md border border-[#2c6f58] bg-[#102f27] px-4 py-2 text-sm font-semibold text-[#fff8e7] hover:bg-[#174638]"
        >
          Reset
        </button>
        <button
          onClick={onApply}
          className="rounded-md bg-[#ffd23f] px-4 py-2 text-sm font-semibold text-[#0b1117] hover:bg-[#ffe36d]"
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
      <div className="mb-2 flex justify-between text-xs font-semibold text-[#cbe7d6]">
        <span>CHF {minValue.toLocaleString("en-US")}</span>
        <span>{maxValue >= 10000 ? "CHF 10,000+" : `CHF ${maxValue.toLocaleString("en-US")}`}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#1f6f58]" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#ffd23f]"
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
            ? "border-[#ffd23f] bg-[#ffd23f] text-[#0b1117]"
            : "border-[#2c6f58] bg-[#102f27] text-[#fff8e7] hover:bg-[#174638]"
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
                  ? "border-[#ffd23f] bg-[#31491d] text-[#ffea75]"
                  : "border-[#2c6f58] bg-[#102f27] text-[#fff8e7] hover:bg-[#174638]"
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
      <span className="mb-2 block text-sm font-bold text-[#fff8e7]">{label}</span>
      {children}
    </label>
  );
}

function ProfileView({
  onManageBilling,
  onChangeEmail,
  onUpgrade,
  profile,
  profileMessage,
  user,
}: {
  onManageBilling: () => void;
  onChangeEmail: () => void;
  onUpgrade: () => void;
  profile: UserProfile | null;
  profileMessage: string;
  user: SupabaseUser;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel icon={<Mail size={19} />} title="Account">
        <p className="text-sm text-[#cbe7d6]">{profile?.email || user.email}</p>
        <button
          onClick={onChangeEmail}
          className="mt-3 rounded-md border border-[#2c6f58] bg-[#102f27] px-3 py-2 text-sm font-semibold text-[#fff8e7] hover:bg-[#174638]"
        >
          Change email
        </button>
        {profileMessage && (
          <p className="mt-3 rounded-md bg-[#104c3a] px-3 py-2 text-sm font-semibold text-[#7dffc7]">
            {profileMessage}
          </p>
        )}
      </Panel>
      <Panel icon={<Settings size={19} />} title="Subscription">
        <p className="text-sm text-[#cbe7d6]">
          Status: {profile?.subscription_status === "active" ? "Premium active" : "Trial active"}
          {profile?.trial_ends_at ? ` · Trial ends ${formatDate(profile.trial_ends_at)}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onUpgrade}
            className="rounded-md bg-[#ffd23f] px-3 py-2 text-sm font-semibold text-[#0b1117] hover:bg-[#ffe36d]"
          >
            Upgrade
          </button>
          <button
            onClick={onManageBilling}
            className="rounded-md border border-[#2c6f58] bg-[#102f27] px-3 py-2 text-sm font-semibold text-[#fff8e7] hover:bg-[#174638]"
          >
            Payment method
          </button>
          <button
            onClick={onManageBilling}
            className="rounded-md border border-[#2c6f58] bg-[#102f27] px-3 py-2 text-sm font-semibold text-[#fff8e7] hover:bg-[#174638]"
          >
            Cancel subscription
          </button>
        </div>
      </Panel>
    </section>
  );
}

function Panel({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-[#1f6f58] bg-[#12372d] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[#ffd23f]">{icon}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PremiumLock({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section className="mx-auto max-w-md rounded-md border border-[#1f6f58] bg-[#12372d] p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.42)]">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-[#ffd23f] text-[#0b1117]">
        <Lock size={24} />
      </div>
      <h2 className="text-2xl font-bold">Premium Required</h2>
      <p className="mt-3 text-sm text-[#cbe7d6]">Available today:</p>
      <p className="mt-1 text-3xl font-bold">547 new giveaways</p>
      <button
        onClick={onUpgrade}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#ffd23f] px-4 py-3 font-semibold text-[#0b1117] hover:bg-[#ffe36d]"
      >
        <CreditCard size={18} />
        Upgrade to Premium · $4.99 / month
      </button>
    </section>
  );
}
