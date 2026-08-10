import { getChatGPTUser } from "./chatgpt-auth";
import PyHintApp from "./PyHintApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <PyHintApp
      user={{
        name: user?.fullName ?? "學習者",
        email: user?.email ?? "demo@pyhint.local",
      }}
    />
  );
}
