export function isOwnHost(host: string): boolean {
  return (
    host === "jalakarta.com" ||
    host === "www.jalakarta.com" ||
    host === "app.jalakarta.com" ||
    host.endsWith(".jalakarta.com") ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
  );
}
