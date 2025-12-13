import { query } from "@/lib/api";

export default function Home() {
  const list = query.get.useQuery();

  return <div>{JSON.stringify(list)}</div>;
}
