import { BarChart3, TrendingUp, Calendar, AlertCircle } from "lucide-react";

interface LandingProps {
  onDemoClick: () => void;
}

export default function Landing({ onDemoClick }: LandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary-500 p-2 text-white">
                <BarChart3 className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold">KLU Attend+</span>
            </div>
            <a
              href="#features"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
            >
              Features
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">
            Your attendance,{" "}
            <span className="text-primary-500">without the headache</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Connect your KLU ERP. Track attendance. Plan your classes. Know
            exactly where you stand.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              onClick={onDemoClick}
              className="btn btn-primary"
            >
              Try Demo
            </button>
            <button className="btn btn-outline">
              <a href="/signin">Sign In</a>
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            No credit card required. Free for all KLU students.
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 py-16 dark:bg-gray-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold">Features</h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Real-time Attendance",
                description: "Sync with your KLU ERP and see live attendance",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Analytics",
                description: "Subject-wise breakdown and historical trends",
              },
              {
                icon: <Calendar className="h-6 w-6" />,
                title: "Bunk Planner",
                description: "Plan classes and simulate attendance scenarios",
              },
            ].map((feature, i) => (
              <div key={i} className="card">
                <div className="text-primary-500">{feature.icon}</div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Notice */}
      <section className="bg-blue-50 py-12 dark:bg-blue-900/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4">
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold">Privacy First</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Your ERP password is never stored. Data is encrypted and only
                accessible by you. KLU Attend+ is an unofficial student utility
                and is not affiliated with or endorsed by KL University.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            © 2024 KLU Attend+. Unofficial student utility.{" "}
            <a href="/privacy" className="text-primary-500 hover:underline">
              Privacy
            </a>{" "}
            ·{" "}
            <a href="/disclaimer" className="text-primary-500 hover:underline">
              Disclaimer
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
