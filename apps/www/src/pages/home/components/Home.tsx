import { query } from "@/lib/api";

export default function Home() {
  const list = query.get.useSuspenseQuery();

  return <div>{JSON.stringify(list.hello)}</div>;
}
