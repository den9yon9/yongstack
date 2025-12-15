import { query } from "../../lib/api";

export default function Home() {
  const mine = query.user.mine.get.useSuspenseQuery();
  return <div>{JSON.stringify(mine)}</div>;
}
