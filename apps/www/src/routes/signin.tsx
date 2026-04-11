// 补全这个组件，样式使用tailwindcss
import { createFileRoute } from "@tanstack/react-router";
// import { api } from "../libs/api";

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

// 登录接口像这样调用
// api
//   .POST("/auth/login", { body: { username: "", password: "" } })
//   .then((res) =>
//     Promise.reject(res.error ? Promise.reject(res.error) : res.data),
//   );

function RouteComponent() {
  return <div>Hello "/signin"!</div>;
}
