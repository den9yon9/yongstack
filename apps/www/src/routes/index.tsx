import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <section className="bg-white rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 border border-gray-100">
          <p className="text-[13px] font-medium text-gray-400 mb-3 tracking-wide">
            TanStack Start Base Template
          </p>
          <h1 className="text-[32px] sm:text-[48px] font-semibold text-gray-900 leading-[1.1] tracking-tight mb-5">
            Start simple, ship quickly.
          </h1>
          <p className="text-[15px] sm:text-[16px] text-gray-500 leading-relaxed max-w-2xl mb-8">
            This base starter intentionally keeps things light: two routes,
            clean structure, and the essentials you need to build from scratch.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/about"
              className="h-11 px-6 flex items-center justify-center bg-gray-900 text-white text-[14px] font-medium rounded-2xl transition-all active:scale-[0.98]"
            >
              About This Starter
            </a>
            <a
              href="https://tanstack.com/router"
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-6 flex items-center justify-center bg-white text-gray-700 text-[14px] font-medium rounded-2xl border border-gray-200 transition-all active:scale-[0.98] hover:border-gray-300"
            >
              Router Guide
            </a>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Type-Safe Routing",
              "Routes and links stay in sync across every page.",
            ],
            [
              "Server Functions",
              "Call server code from your UI without creating API boilerplate.",
            ],
            [
              "Streaming by Default",
              "Ship progressively rendered responses for faster experiences.",
            ],
            [
              "Tailwind Native",
              "Design quickly with utility-first styling and reusable tokens.",
            ],
          ].map(([title, desc]) => (
            <article
              key={title}
              className="bg-white rounded-2xl p-5 border border-gray-100"
            >
              <h2 className="text-[15px] font-semibold text-gray-900 mb-2">
                {title}
              </h2>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                {desc}
              </p>
            </article>
          ))}
        </section>

        {/* Quick Start */}
        <section className="mt-6 bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-[13px] font-medium text-gray-400 mb-4 tracking-wide">
            Quick Start
          </p>
          <ul className="space-y-3 text-[14px] text-gray-600">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0"></span>
              <span>
                Edit{" "}
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[13px] text-gray-700">
                  src/routes/index.tsx
                </code>{" "}
                to customize the home page.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0"></span>
              <span>
                Update{" "}
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[13px] text-gray-700">
                  src/components/Header.tsx
                </code>{" "}
                and{" "}
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[13px] text-gray-700">
                  src/components/Footer.tsx
                </code>{" "}
                for brand links.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0"></span>
              <span>
                Add routes in{" "}
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[13px] text-gray-700">
                  src/routes
                </code>{" "}
                and tweak visual tokens in{" "}
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[13px] text-gray-700">
                  src/styles.css
                </code>
                .
              </span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
