// assets/dummyStyles.js
export const navbarStyles = {
  // Outer nav container
  nav: "absolute left-0 right-0 top-0 z-30 px-3 pt-4 sm:px-6 sm:pt-10 lg:pt-12",

  // Inner flex container
  innerContainer:
    "mx-auto flex max-w-[1120px] items-center justify-between gap-3 text-white",

  // Logo link
  logo: "shrink-0 text-sm font-black uppercase tracking-tight sm:text-lg",

  // Desktop navigation wrapper
  desktopNav:
    "hidden items-center gap-8 text-[10px] font-bold uppercase tracking-wider text-white/70 md:flex lg:gap-12",

  // Desktop navigation links
  desktopNavLink: "",

  // Live stream button
  liveButton:
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/80 px-2.5 py-2 text-[9px] font-bold text-white shadow-2xl shadow-black/30 backdrop-blur-sm min-[380px]:gap-2 min-[380px]:px-3 min-[380px]:text-[10px] sm:px-4 sm:py-2.5",

  // Live icon (Circle)
  liveIcon: "fill-red-500 text-red-500",

  // Live text – full version (hidden below 360px)
  liveTextFull: "max-[359px]:hidden",

  // Live text – short version (visible only below 360px)
  liveTextShort: "min-[360px]:hidden",

  // Mobile hamburger button
  hamburgerButton:
    "grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm md:hidden",

  // Mobile menu overlay container
  mobileMenu:
    "absolute left-3 right-3 top-full mt-2 flex flex-col gap-1 rounded-2xl bg-black/90 p-3 backdrop-blur-xl sm:left-4 sm:right-4 sm:p-4 md:hidden",

  // Mobile menu links
  mobileMenuLink:
    "rounded-xl px-4 py-3 text-sm font-bold text-white/80",
};



export const heroStyles = {
  // Section & containers
  section: "min-h-[100svh] bg-red-700",
  innerBg: "relative min-h-[100svh] w-full overflow-hidden bg-red-700",
  heroVideo: "absolute inset-0 size-full object-cover",
  overlayGradient: "absolute inset-0 bg-gradient-to-b from-red-500/10 via-transparent to-black/40",
  gridContainer: "relative z-10 mx-auto grid min-h-[100svh] max-w-[1280px] grid-cols-1 content-end px-4 pb-8 pt-24 min-[380px]:pt-28 sm:px-8 md:grid-cols-[220px_1fr_230px] md:content-stretch md:pb-12 md:pt-32 lg:px-12",

  // Stats aside
  statsAside: "grid w-full grid-cols-3 gap-3 md:mt-20 md:flex md:max-w-[180px] md:flex-col md:gap-7",
  statValue: "text-2xl font-black leading-none text-white drop-shadow-xl min-[380px]:text-3xl sm:text-[42px]",
  statLabel: "mt-1 text-[8px] font-black uppercase tracking-wider text-white/90 min-[380px]:text-[9px] sm:text-[10px]",

  // Heading block
  headingWrapper: "pointer-events-none relative flex min-w-0 items-end md:col-start-1 md:col-end-3 md:row-start-1",
  heading: "display-heading mb-3 max-w-full text-[58px] uppercase leading-[0.84] text-white drop-shadow-[0_14px_28px_rgba(0,0,0,0.35)] min-[380px]:text-[68px] sm:text-[112px] md:text-[136px] lg:text-[146px]",

  // Right panel (matches)
  rightPanel: "relative z-20 mt-5 w-full self-center justify-self-center min-[440px]:max-w-sm md:col-start-3 md:row-start-1 md:mt-0 md:max-w-none",
  featuredMatchCard: "rounded-2xl bg-black p-3 text-white shadow-2xl shadow-black/35 sm:rounded-[26px] sm:p-4",
  featuredMatchHeader: "mb-4 flex items-center justify-between",
  featuredMatchHeaderText: "text-xs font-black leading-tight",
  featuredMatchButton: "grid size-9 place-items-center rounded-full bg-white text-zinc-950",
  emptyState: "rounded-[26px] bg-black p-6 text-center text-sm font-bold text-white/50",

  // "More matches" row
  moreMatchesRow: "mt-4 flex items-center justify-between px-2",
  moreMatchesLabel: "text-[10px] font-black uppercase text-white/70",
  moreMatchesButton: "grid size-8 place-items-center rounded-full bg-white/16 text-white",

  // Remaining matches grid
  remainingMatchesGrid: "mt-4 grid gap-3",

  // RealTeamBadge styles
  badgeBase: "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white text-xs font-black shadow-sm sm:size-12",
  badgeFeatured: "border-zinc-200",
  badgeDefault: "border-red-500/30",
  badgeLogo: "size-full object-contain p-1.5",
  badgeFallbackFeatured: "text-zinc-500",
  badgeFallbackDefault: "text-red-700",

  // MatchRow styles
  matchRowFeatured: "rounded-[28px] bg-white p-3 text-zinc-950",
  matchRowDefault: "rounded-[24px] bg-white/12 p-3 text-white backdrop-blur-sm",
  matchDate: "mb-3 truncate text-xs font-black leading-tight text-white/90",
  teamColumn: "grid w-[40%] justify-items-center gap-1",
  teamNameFeatured: "text-zinc-500",
  teamNameDefault: "text-white/80",
  teamNameBase: "w-full truncate text-center text-[10px] font-bold",
  vsBase: "text-xs font-black uppercase",
  vsFeatured: "text-zinc-950",
  vsDefault: "text-white/80",
  matchButton: "grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-white",
};




export const mainSectionStyles = {
  // Main container & background glows
  mainContainer: "relative bg-[#0a0a0a] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20",
  glowLeft: "pointer-events-none absolute left-1/4 top-0 size-[500px] -translate-x-1/2 rounded-full bg-red-900/15 blur-[120px]",
  glowRight: "pointer-events-none absolute right-1/4 top-1/3 size-[400px] rounded-full bg-blue-900/10 blur-[100px]",
  innerWrapper: "relative mx-auto max-w-7xl",
  errorBanner: "mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-semibold text-red-300 sm:mb-8 sm:text-sm",

  // SectionTitle
  sectionTitleWrapper: "mb-8 flex flex-col items-center gap-3 text-center sm:mb-12",
  sectionTitleLabel: "inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-400 sm:px-4 sm:text-[11px]",
  sectionTitleH2: "text-2xl font-black text-white sm:text-3xl lg:text-4xl",

  // TeamBadge
  teamBadgeBase: "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 font-black text-white",
  teamBadgeImg: "size-full object-contain p-1.5 sm:p-2",
  // sizes (sm, md, lg) - we keep dynamic, but reference base
  teamBadgeSizeSm: "size-10 text-[9px] sm:size-11",
  teamBadgeSizeMd: "size-11 text-[10px] sm:size-14 sm:text-xs",
  teamBadgeSizeLg: "size-14 text-sm sm:size-16",

  // MatchCenter section
  matchCenterSection: "mb-16 sm:mb-20",
  matchCenterGrid: "grid gap-4 sm:gap-5 lg:grid-cols-[1.1fr_.9fr]",
  // Featured card
  featuredCard: "relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 p-5 text-white shadow-[0_20px_60px_rgba(220,38,38,0.3)] sm:rounded-[28px] sm:p-8",
  featuredCardGlow1: "pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-white/5 blur-3xl",
  featuredCardGlow2: "pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-black/20 blur-3xl",
  featuredTopline: "mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6",
  featuredStatus: "inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1",
  featuredViewButton: "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase text-red-700 shadow-lg shadow-black/10",
  featuredLiveDot: "live-dot size-2 rounded-full bg-white",
  featuredStatusText: "text-[10px] font-black uppercase tracking-wider text-white/90 sm:text-xs",
  featuredTeamsGrid: "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6",
  featuredTeamColumn: "grid min-w-0 justify-items-center gap-2 text-center sm:gap-3",
  featuredTeamName: "line-clamp-2 text-xs font-black leading-tight sm:text-lg",
  featuredVs: "rounded-xl bg-white/10 px-2.5 py-2 text-base font-black sm:px-5 sm:py-3 sm:text-2xl",
  featuredScore: "rounded-xl bg-white px-3 py-2 text-base font-black text-red-700 shadow-lg shadow-black/10 sm:px-5 sm:py-3 sm:text-2xl",
  featuredCompetition: "mt-5 rounded-xl bg-white/10 p-3 text-center sm:mt-6 sm:rounded-2xl sm:p-4",
  featuredCompetitionText: "text-xs font-semibold text-white/80 sm:text-sm",
  featuredInsightGrid: "mt-5 grid gap-2 sm:mt-6 sm:grid-cols-3",
  featuredInsightItem: "flex min-w-0 items-center gap-2 rounded-xl bg-white/10 p-3 text-[10px] font-semibold leading-snug text-white/80 sm:text-xs",
  featuredEmpty: "py-8 text-center text-sm font-semibold text-white/60",

  // Side matches list
  sideMatchesGrid: "grid gap-3",
  matchCenterStatsGrid: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2",
  matchCenterStatCard: "glass-card rounded-xl p-3 text-center sm:rounded-2xl",
  matchCenterStatValue: "block text-xl font-black text-white sm:text-2xl",
  matchCenterStatLabel: "mt-1 block text-[9px] font-black uppercase tracking-wider text-white/40",
  sideMatchCard: "glass-card group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:rounded-2xl sm:p-4",
  sideMatchBadges: "flex -space-x-2 sm:-space-x-3",
  sideMatchInfo: "min-w-0",
  sideMatchTitle: "truncate text-xs font-black text-white sm:text-sm",
  sideMatchLeague: "mt-0.5 truncate text-[10px] font-semibold text-white/40 sm:text-xs",
  sideMatchStatus: "col-start-2 max-w-full justify-self-start truncate rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-red-400 sm:col-start-auto sm:px-3 sm:py-1 sm:text-[10px]",
  sideEmpty: "glass-card rounded-2xl p-6 text-center text-sm font-semibold text-white/40",

  // Live section
  liveSection: "mb-16 sm:mb-24",
  liveGrid: "grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3",

  // Standings section
  standingsSection: "mb-16 sm:mb-24",
  standingsCard: "glass-card overflow-hidden rounded-2xl sm:rounded-3xl",
  standingsRow: "group grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-white/5 p-3 last:border-b-0 sm:grid-cols-[48px_1fr_auto] sm:gap-4 sm:p-4",
  standingsRank: "text-center text-lg font-black text-red-500 sm:text-xl",
  standingsTeamInfo: "min-w-0",
  standingsTeamName: "truncate text-sm font-black text-white sm:text-base",
  standingsTeamMeta: "truncate text-[10px] font-medium text-white/40 sm:text-xs",
  standingsTrophy: "text-white/15",

  // Fixtures section
  fixturesSection: "mb-16 sm:mb-24",
  fixturesControls: "mb-8 flex flex-col items-stretch justify-between gap-4 sm:mb-10 sm:items-center lg:flex-row",
  datePills: "grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-sm sm:flex",
  dateButtonBase: "px-2 py-2 text-[9px] font-bold uppercase tracking-wider min-[380px]:text-[10px] sm:px-5 sm:py-2.5 sm:text-xs disabled:opacity-50",
  dateButtonActive: "rounded-full bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg",
  dateButtonInactive: "rounded-full text-white/50",
  searchWrapper: "relative w-full sm:max-w-sm",
  searchIcon: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-white/30",
  searchInput: "w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-white/30 backdrop-blur-sm focus:border-red-500/50 focus:bg-white/10 focus:outline-none sm:text-sm",
  fixturesGrid: "grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3",
  fixtureCard: "glass-card group flex flex-col justify-between rounded-2xl p-5 sm:rounded-3xl sm:p-6",
  fixtureTeamsGrid: "mb-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:mb-6 sm:gap-3",
  fixtureTeamColumn: "flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3",
  fixtureTeamName: "line-clamp-2 text-[10px] font-bold leading-tight text-white/70 sm:text-xs",
  fixtureVs: "rounded-xl bg-white/5 px-2.5 py-2 text-sm font-black text-white/60 sm:px-3 sm:text-lg",
  fixtureScore: "rounded-xl bg-white px-3 py-2 text-sm font-black text-red-600 shadow-lg shadow-black/20 sm:px-4 sm:text-lg",
  fixtureInfo: "mb-4 text-center sm:mb-5",
  fixtureLeague: "text-xs font-bold text-white/70 sm:text-sm",
  fixtureDate: "mt-1 text-[10px] font-semibold text-white/30 sm:text-xs",
  ticketButton: "inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-4 py-2 text-[10px] font-bold text-white shadow-lg shadow-red-500/20 sm:px-5 sm:py-2.5 sm:text-xs",

  // Match details dialog
  matchDialogBackdrop: "fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm",
  matchDialog: "max-h-[88svh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111111] p-5 text-white shadow-2xl sm:rounded-3xl sm:p-6",
  matchDialogHeader: "mb-5 flex items-start justify-between gap-4",
  matchDialogKicker: "text-[10px] font-black uppercase tracking-widest text-red-400",
  matchDialogTitle: "mt-1 text-lg font-black leading-tight sm:text-2xl",
  matchDialogClose: "grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white",
  matchDialogScoreGrid: "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white/5 p-4",
  matchDialogTeam: "grid min-w-0 justify-items-center gap-2 text-center text-xs font-black leading-tight sm:text-sm",
  matchDialogScore: "grid justify-items-center rounded-2xl bg-white px-4 py-3 text-red-600 shadow-lg shadow-black/20",
  matchDialogFacts: "mt-4 grid gap-3",
  matchDialogFact: "flex min-w-0 items-center gap-2 rounded-xl bg-white/5 p-3 text-xs font-semibold text-white/70",

  // Empty helper
  emptyBase: "glass-card rounded-2xl p-6 text-center text-sm font-medium text-white/40",
};


export const liveScoreCardStyles = {
  // TeamLogo
  teamLogoContainer:
    "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-[10px] font-black text-white sm:size-14",
  teamLogoImg: "size-full object-contain p-2",

  // LiveScoreCard article
  card: "group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-5 sm:rounded-3xl sm:p-6",
  glowRed: "pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-red-500/10 blur-3xl",
  glowBlue: "pointer-events-none absolute -bottom-10 -left-10 size-32 rounded-full bg-blue-500/8 blur-3xl",

  // Header
  header: "relative mb-4 flex items-center justify-between sm:mb-5",
  leagueText: "max-w-[60%] truncate text-[10px] font-bold uppercase tracking-wider text-white/50 sm:text-xs",
  liveBadge: "flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 sm:px-3",
  liveDot: "live-dot size-1.5 rounded-full bg-red-500 sm:size-2",
  liveText: "text-[9px] font-black uppercase tracking-wider text-red-400 sm:text-[10px]",

  // Teams + Score grid
  teamsGrid: "relative grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2",
  teamColumn: "flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3",
  teamName: "line-clamp-2 text-[10px] font-bold leading-tight text-white/80 sm:text-xs",
  scoreBox: "rounded-2xl bg-white/5 px-3 py-2.5 sm:px-6 sm:py-3",
  scoreText: "text-center text-xl font-black tracking-tight text-white min-[380px]:text-2xl sm:text-3xl",
  colon: "text-red-500",

  // Footer
  divider: "mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent sm:mt-5",
  footerText: "mt-3 text-center text-[9px] font-semibold uppercase tracking-wider text-white/30 sm:text-[10px]",
};


export const footerStyles = {
  footer: "overflow-hidden bg-[#0a0a0a] px-3 pt-8 pb-0 sm:px-6 sm:pt-10",
  wordmark: "footer-wordmark pointer-events-none block w-full select-none whitespace-nowrap text-center text-[clamp(3rem,18vw,15rem)] uppercase leading-none sm:text-[clamp(4.5rem,16vw,18rem)]",
};