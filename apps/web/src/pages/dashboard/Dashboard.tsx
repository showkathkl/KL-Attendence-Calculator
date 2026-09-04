import { useState } from "react";
import {
  BarChart3,
  Book,
  Calendar,
  LogOut,
  Zap,
} from "lucide-react";
import { calculateRiskLevel } from "@engine/calculations";

interface DashboardProps {
  demoMode: boolean;
  onExitDemo: () => void;
}

export default function Dashboard({
  demoMode,
  onExitDemo,
}: DashboardProps) {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [demoData] = useState({
    subjects: [
      { code: "DSA101", name: "Data Structures", attended: 34, conducted: 51 },
      { code: "JAVA101", name: "Java Programming", attended: 40, conducted: 51 },
      { code: "DBMS101", name: "Database Systems", attended: 45, conducted: 50 },
      { code: "MATH101", name: "Mathematics", attended: 43, conducted: 50 },
      { code: "WEB101", name: "Web Technologies", attended: 38, conducted: 48 },
    ],
    target: 85,
  });

  const calculateOverall = () => {
    const total = demoData.subjects.reduce(
      (acc, s) => ({
        attended: acc.attended + s.attended,
        conducted: acc.conducted + s.conducted,
      }),
      { attended: 0, conducted: 0 }
    );
    return ((total.attended / total.conducted) * 100).toFixed(1);
  };

  const getOverallRisk = () => {
    const total = demoData.subjects.reduce(
      (acc, s) => ({
        attended: acc.attended + s.attended,
        conducted: acc.conducted + s.conducted,
      }),
      { attended: 0, conducted: 0 }
    );
    return calculateRiskLevel(
      total.attended,
      total.conducted,
      demoData.target
    );
  };

  const risk = getOverallRisk();
  const overall = calculateOverall();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center gap-2 font-bold">
            <BarChart3 className="h-6 w-6 text-primary-500" />
            <span>Attend+</span>
          </div>
          {demoMode && (
            <div className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Demo Mode
            </div>
          )}
        </div>

        <nav className="space-y-1 p-4">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3 },
            { id: "subjects", label: "Subjects", icon: Book },
            { id: "timetable", label: "Timetable", icon: Calendar },
            { id: "planner", label: "Bunk Planner", icon: Zap },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              className={`w-full rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors ${
                currentPage === id
                  ? "bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="mb-1 inline h-4 w-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 w-64 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          {demoMode && (
            <button
              onClick={onExitDemo}
              className="btn btn-secondary w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Exit Demo
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto pb-20">
        {currentPage === "dashboard" && (
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Last synced: {new Date().toLocaleString()}
              </p>
            </div>

            {/* Overall Attendance */}
            <div className="mb-8 rounded-lg bg-white p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Overall Attendance</h2>
              <div className="mt-4 flex items-center gap-8">
                <div>
                  <div className="text-5xl font-bold text-primary-500">
                    {overall}%
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Target: {demoData.target}%
                  </div>
                </div>
                <div
                  className={`rounded-lg px-4 py-2 font-medium ${
                    risk.level === "safe"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                      : risk.level === "warning"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                  }`}
                >
                  {risk.level === "safe" && "🟢 SAFE"}
                  {risk.level === "warning" && "🟡 WARNING"}
                  {risk.level === "critical" && "🔴 CRITICAL"}
                </div>
              </div>
            </div>

            {/* Subjects Grid */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">Subject Status</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {demoData.subjects.map((subject) => {
                  const percentage = ((subject.attended / subject.conducted) * 100).toFixed(1);
                  const subjectRisk = calculateRiskLevel(
                    subject.attended,
                    subject.conducted,
                    demoData.target
                  );

                  return (
                    <div key={subject.code} className="card">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{subject.name}</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {subject.code}
                          </p>
                        </div>
                        <div
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            subjectRisk.level === "safe"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                              : subjectRisk.level === "warning"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                          }`}
                        >
                          {subjectRisk.level === "safe" && "Safe"}
                          {subjectRisk.level === "warning" && "Warning"}
                          {subjectRisk.level === "critical" && "Critical"}
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="text-2xl font-bold">{percentage}%</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {subject.attended}/{subject.conducted}
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{
                            width: `${Math.min(100, parseFloat(percentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {currentPage === "subjects" && (
          <div className="p-6 sm:p-8">
            <h1 className="mb-8 text-3xl font-bold">Subjects</h1>
            <div className="space-y-4">
              {demoData.subjects.map((subject) => (
                <div key={subject.code} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{subject.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {subject.code}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {(
                          (subject.attended / subject.conducted) *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {subject.attended}/{subject.conducted}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage === "timetable" && (
          <div className="p-6 sm:p-8">
            <h1 className="mb-8 text-3xl font-bold">Timetable</h1>
            <div className="rounded-lg bg-white p-6 dark:bg-gray-900">
              <p className="text-gray-600 dark:text-gray-400">
                Timetable feature coming soon in your ERP sync.
              </p>
            </div>
          </div>
        )}

        {currentPage === "planner" && (
          <div className="p-6 sm:p-8">
            <h1 className="mb-8 text-3xl font-bold">Bunk Planner</h1>
            <div className="rounded-lg bg-white p-6 dark:bg-gray-900">
              <p className="text-gray-600 dark:text-gray-400">
                Plan your attendance scenarios. Coming soon.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
