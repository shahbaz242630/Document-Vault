import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useReducer,
} from "react";

export type RecoveryPhraseSessionData = {
  mek: Uint8Array;
  words: string[];
};

export type RecoveryPhraseSessionState = {
  mek: Uint8Array | null;
  words: string[] | null;
};

type RecoveryPhraseSessionAction =
  | { session: RecoveryPhraseSessionData; type: "set" }
  | { type: "clear" };

type RecoveryPhraseSessionContextValue = RecoveryPhraseSessionState & {
  clearRecoveryPhraseSession: () => void;
  setRecoveryPhraseSession: (session: RecoveryPhraseSessionData) => void;
};

const initialState: RecoveryPhraseSessionState = {
  mek: null,
  words: null,
};

const RecoveryPhraseSessionContext =
  createContext<RecoveryPhraseSessionContextValue | null>(null);

type RecoveryPhraseSessionProviderProps = {
  children: ReactNode;
};

export function recoveryPhraseSessionReducer(
  state: RecoveryPhraseSessionState,
  action: RecoveryPhraseSessionAction,
): RecoveryPhraseSessionState {
  switch (action.type) {
    case "set":
      return {
        mek: new Uint8Array(action.session.mek),
        words: [...action.session.words],
      };
    case "clear":
      return initialState;
  }
}

export function RecoveryPhraseSessionProvider({
  children,
}: RecoveryPhraseSessionProviderProps) {
  const [state, dispatch] = useReducer(recoveryPhraseSessionReducer, initialState);

  const value = useMemo<RecoveryPhraseSessionContextValue>(
    () => ({
      ...state,
      clearRecoveryPhraseSession() {
        dispatch({ type: "clear" });
      },
      setRecoveryPhraseSession(session) {
        dispatch({ session, type: "set" });
      },
    }),
    [state],
  );

  return (
    <RecoveryPhraseSessionContext.Provider value={value}>
      {children}
    </RecoveryPhraseSessionContext.Provider>
  );
}

export function useRecoveryPhraseSession(): RecoveryPhraseSessionContextValue {
  const value = useContext(RecoveryPhraseSessionContext);

  if (!value) {
    throw new Error(
      "useRecoveryPhraseSession must be used inside RecoveryPhraseSessionProvider.",
    );
  }

  return value;
}
