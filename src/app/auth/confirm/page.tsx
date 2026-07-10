import { ConfirmClient } from "./confirm-client";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  return <ConfirmClient next={params.next} tokenHash={params.token_hash} type={params.type} />;
}
