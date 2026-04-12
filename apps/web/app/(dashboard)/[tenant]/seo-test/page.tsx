import { SeoTestClient } from "./seo-test-client";

export default async function SeoTestPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  return <SeoTestClient slug={slug} />;
}
