"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const HIDE_KEY = "bankai.saldoHidden";

export type AccountSummary = {
  id: string;
  nome: string | null;
  env: "sandbox" | "production" | string;
  hasAsaasKey: boolean;
};

export type SaldoSummary = {
  valor: number;
  formatado: string;
};

export type MetricSummary = {
  valor: number;
  formatado: string;
  quantidade: number;
};

type AccountSummaryValue = {
  account: AccountSummary | null;
  saldo: SaldoSummary | null;
  aReceberMes: MetricSummary | null;
  vencidas: MetricSummary | null;
  loading: boolean;
  /** Olho do topbar — também mascara cards da home */
  valuesHidden: boolean;
  toggleValuesHidden: () => void;
  refresh: () => Promise<void>;
};

const AccountSummaryContext = createContext<AccountSummaryValue | null>(null);

export function AccountSummaryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [saldo, setSaldo] = useState<SaldoSummary | null>(null);
  const [aReceberMes, setAReceberMes] = useState<MetricSummary | null>(null);
  const [vencidas, setVencidas] = useState<MetricSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [valuesHidden, setValuesHidden] = useState(false);

  useEffect(() => {
    try {
      setValuesHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  const toggleValuesHidden = useCallback(() => {
    setValuesHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/summary");
      if (res.status === 401) {
        setAccount(null);
        setSaldo(null);
        setAReceberMes(null);
        setVencidas(null);
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as {
        account: AccountSummary | null;
        saldo: SaldoSummary | null;
        aReceberMes: MetricSummary | null;
        vencidas: MetricSummary | null;
      };
      setAccount(json.account);
      setSaldo(json.saldo);
      setAReceberMes(json.aReceberMes);
      setVencidas(json.vencidas);
    } catch {
      // topbar silenciosa
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      account,
      saldo,
      aReceberMes,
      vencidas,
      loading,
      valuesHidden,
      toggleValuesHidden,
      refresh,
    }),
    [
      account,
      saldo,
      aReceberMes,
      vencidas,
      loading,
      valuesHidden,
      toggleValuesHidden,
      refresh,
    ],
  );

  return (
    <AccountSummaryContext.Provider value={value}>
      {children}
    </AccountSummaryContext.Provider>
  );
}

export function useAccountSummary() {
  const ctx = useContext(AccountSummaryContext);
  if (!ctx) {
    throw new Error(
      "useAccountSummary deve estar dentro de AccountSummaryProvider",
    );
  }
  return ctx;
}
