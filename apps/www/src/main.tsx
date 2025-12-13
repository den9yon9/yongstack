import { render } from "preact";
import "./main.css";
import { Suspense } from "preact/compat";
import { Route, Router, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import Fallback from "./components/Fallback";
import { EdenQueryProvider, QueryClient } from "./lib/eden-query";

// 引入页面组件
import Home from "./pages/home";
import Login from "./pages/login"; // <--- 引入 Login

const queryClient = new QueryClient();

function App() {
  return (
    <Router hook={useHashLocation}>
      <ErrorBoundary>
        <Suspense fallback={<Fallback />}>
          <EdenQueryProvider client={queryClient}>
            {/* 使用 Hash 路由，方便本地开发避免配置 Nginx rewrite */}
            <Switch>
              <Route path="/" component={Home} />

              {/* 🔥 添加登录页路由 */}
              <Route path="/login" component={Login} />

              <Route>404 Not Found</Route>
            </Switch>
          </EdenQueryProvider>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}

render(<App />, document.getElementById("app") as HTMLElement);
