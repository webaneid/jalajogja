import { EditorTestClient } from "./editor-test-client";

export default async function EditorTestPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  return <EditorTestClient slug={slug} />;
}
