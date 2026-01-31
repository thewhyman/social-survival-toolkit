import { auth, clerkClient } from "@clerk/nextjs/server";

export default async function MePage() {
  const { userId } = await auth();
  if (!userId) return <div>Not signed in</div>;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  return (
    <pre style={{ padding: 24 }}>
      {JSON.stringify(
        {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          publicMetadata: user.publicMetadata,
        },
        null,
        2
      )}
    </pre>
  );
}