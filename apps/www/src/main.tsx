import { render } from "preact";
import "./main.css";
import { EdenQueryProvider, QueryClient } from "eden-preact-query";
import { Suspense } from "preact/compat";
import { Route, Router, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import Fallback from "./components/Fallback";
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
            <Switch>
              <Route path="/" component={Home} />
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
