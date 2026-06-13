# Football Cave

**Football Cave** is a clean, ultra-responsive dashboard built for fans and analysts who want real-time sports data without the typical ad-heavy, cluttered sports layout.

Designed with a strict mobile-first philosophy, it transforms raw data streams into sharp, structured visuals—built specifically to handle massive multi-group events like the 48-team 2026 World Cup stage alongside standard domestic leagues.

## The Goal

The goal was to take messy, deeply nested sports API data and turn it into a beautiful, organized intelligence layer. By pulling data into a custom backend system, I gained complete control over the user experience. This allowed me to create automated background updates, custom group stage logic, and smooth interactive elements that make the entire dashboard feel alive and responsive.

## Process

1. **Design & Motion First:** Built with a desktop-first philosophy. Every transition—from expanding match modules to switching live tables—was prototyped to feel tactile and immediate.
2. **Type-Safe Analytics:** Built entirely with **TypeScript**, creating strict type definitions for fixtures, statistics, and live match events fetching from the Football API.
3. **Data Hydration & State:** Leveraged server-side rendering for historical league data, combined with aggressive client-side polling to inject live match events seamlessly without causing UI layout shifts.
4. **Optimization:** Implemented strict memoization on complex sorting algorithms (e.g., live goal differentials and form guides) to prevent unnecessary re-renders during peak match windows.

## Tech Stack

- **Next.js (App Router)** — Architecture for server-rendered stats and optimized client routing.
- **API-Football / Football Data API** — The core RESTful data engine powering live fixtures and historical metrics.
- **TypeScript** — Ensuring rigorous type safety across complex nested sports data structures.
- **Tailwind CSS** — Utility-first styling optimized for an expansive, desktop-first dashboard grid.
- **Supabase** — Modern PostgreSQL database storage used for robust row caching and unique constraints mapping.
- **Vercel** — Production-grade hosting with real-time edge caching for API responses.

## Key Features

- **Complete World Cup Tracking:** Handles advanced tournament formats, mapping out all 12 group phases dynamically and building accurate knock-out trees.
- **Real-Time Data Pipeline:** Automated polling mechanisms that fetch, normalize, and render live match data with zero perceived latency.
- **Advanced Match Filtering:** A bespoke desktop layout allowing users to instantly filter live matches by league, status, or statistical variance.
- **Mobile-First Architecture:** A robust, mobile-screen dashboard layout that maximizes data density while gracefully adapting to bigger breakpoints.

## License

This project is licensed under the MIT License - see the MIT License file for details.

## Live Demo

https://football-cave.com/
