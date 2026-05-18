import type { Translations } from "./zh";

const en: Translations = {
  // Navigation
  nav: {
    upload:    "Upload",
    dashboard: "Shelf",
    chat:      "Chat",
    quotes:    "Quotes",
    signOut:   "Sign Out",
  },

  // Demo banner
  demo: {
    banner: "Demo Mode · Showing sample data, your Notion is not affected",
  },

  // Upload page
  upload: {
    title:       "Scan & Shelve",
    subtitle:    "Photograph a book cover — AI identifies the title, author & genre, then saves it to Notion",
    dragHint:    "Drag images here, or click to select",
    supportHint: "JPG, PNG, HEIC supported · Batch upload OK",
    processing:  "Recognising…",
    done:        "Done",
    failed:      "Failed",
    viewResults: "View Results",
    selectBtn:   "+ Select Photos",
    waiting:     "Waiting",
  },

  // Result page
  result: {
    title:       "Import Results",
    duplicate:   "Already exists",
    saved:       "Saved",
    failed:      "Recognition failed",
    viewNotion:  "View in Notion",
    uploadMore:  "Upload More",
    noResults:   "No results yet — upload some books first",
    goUpload:    "Go Upload",
    sameGenre:   (n: number, genre: string) => `Your #${n} "${genre}" book`,
    recommend:   "More like this",
  },

  // Dashboard
  dashboard: {
    title:      "My Bookshelf",
    totalBooks: "Total Books",
    books:      "",
    genreChart: "Genre Distribution",
    recentActivity: "Recent Activity",
    noData:     "No data yet",
  },

  // Quotes page
  quotes: {
    title:      "Quote Library",
    tabAll:     "All",
    tabHandwritten: "Handwritten",
    tabBooks:   "From Books",
    tabFavorites: "Favourites",
    addQuote:   "Add Quote",
    makeCard:   "Make Card",
    noQuotes:   "No quotes yet — add one!",
    placeholder: "Write a quote you love…",
    save:       "Save",
    cancel:     "Cancel",
  },

  // Chat page
  chat: {
    title:       "Chat with Your Shelf",
    placeholder: "Ask your bookshelf anything…",
    send:        "Send",
    newChat:     "New Chat",
    dailyQuote:  "Daily Quote",
  },

  // Login page
  login: {
    title:      "Welcome to Lovely Shelf",
    subtitle:   "Your AI-powered personal bookshelf",
    googleBtn:  "Sign in with Google",
    demoBtn:    "Try Demo",
    demoHint:   "No sign-in required · Sample data only",
  },

  // Common
  common: {
    loading:     "Loading…",
    retry:       "Reload",
    error:       "Something went wrong",
    errorHint:   "Don't worry, your bookshelf data is safe.",
    author:      "Author",
    genre:       "Genre",
    unknown:     "Unknown",
    save:        "Save",
    saving:      "Saving…",
    cancel:      "Cancel",
    edit:        "Edit",
    bookDetail:  "Book Detail",
    description: "Description",
    country:     "Country",
    genreLabel:  "Genres",
    subtitleOpt: "Subtitle (optional)",
    openInNotion:"Open in Notion ↗",
  },
};

export default en;
