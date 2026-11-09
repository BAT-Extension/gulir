// Safety stop: no tab/window manipulation, even after a successful save.
// Kept as an inert compatibility export. Never reintroduce close/remove APIs.
export async function closePreviewOnly() {
  return false;
}
