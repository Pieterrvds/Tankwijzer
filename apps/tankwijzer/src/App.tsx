import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router";
import { api, ApiError, type Me } from "./api.ts";
import { ErrorBox, Loading } from "./components/ui.tsx";
import { LoginPage } from "./pages/Login.tsx";
import { OnboardingPage } from "./pages/Onboarding.tsx";
import { TankListPage } from "./pages/TankList.tsx";
import { TankNewPage } from "./pages/TankNew.tsx";
import { TankDetailPage } from "./pages/TankDetail.tsx";
import { PlanningPage } from "./pages/Planning.tsx";
import { DocumentsPage } from "./pages/Documents.tsx";
import { AskPage } from "./pages/Ask.tsx";
import { BookingPage } from "./pages/Booking.tsx";
import { SettingsPage } from "./pages/Settings.tsx";

interface MeContextValue {
  me: Me;
  refresh: () => Promise<void>;
}

const MeContext = createContext<MeContextValue | null>(null);

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe outside provider");
  return ctx;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/me"));
      setState("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setState("anon");
      else {
        setError((e as Error).message);
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (state === "loading") return <Loading />;
  if (state === "error") return <ErrorBox message={error} />;
  if (state === "anon" || !me) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }
  if (!me.company) return <OnboardingPage onDone={refresh} />;

  return (
    <MeContext.Provider value={{ me, refresh }}>
      <div className="shell">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <img src="/icon.svg" alt="" width={28} height={28} />
            <span>Tankwijzer</span>
          </NavLink>
          <span className="company">{me.company.name}</span>
        </header>
        <nav className="nav">
          <NavLink to="/" end>Mijn tanks</NavLink>
          <NavLink to="/planning">Planning</NavLink>
          <NavLink to="/documenten">Documenten</NavLink>
          <NavLink to="/vraag">Vraag het</NavLink>
          <NavLink to="/keuring-aanvragen">Keuring aanvragen</NavLink>
          <NavLink to="/instellingen">Instellingen</NavLink>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/" element={<TankListPage />} />
            <Route path="/tanks/nieuw" element={<TankNewPage />} />
            <Route path="/tanks/:id/*" element={<TankDetailPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/documenten" element={<DocumentsPage />} />
            <Route path="/vraag" element={<AskPage />} />
            <Route path="/keuring-aanvragen" element={<BookingPage />} />
            <Route path="/instellingen" element={<SettingsPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="footer">
          Tankwijzer legt uit en plant. Tankwijzer vervangt geen keuring door een erkend milieudeskundige.
        </footer>
      </div>
    </MeContext.Provider>
  );
}
