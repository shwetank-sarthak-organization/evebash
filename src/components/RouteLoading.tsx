import LoadingScreen from "@/components/LoadingScreen";

// Loading screen for the (main) pages. Each section has its own loading.tsx re-exporting this
// instead of one at (main)/loading.tsx: that one also wrapped the homepage, and React then sent
// the homepage behind this screen on every first load (#29).
export default function RouteLoading() {
  return <LoadingScreen message="Loading your gallery" />;
}
