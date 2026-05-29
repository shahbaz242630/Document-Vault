import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RecoveryPhraseSessionProvider,
  recoveryPhraseSessionReducer,
  useRecoveryPhraseSession,
  type RecoveryPhraseSessionData,
  type RecoveryPhraseSessionState,
} from "./recovery-phrase-session-context";

const session: RecoveryPhraseSessionData = {
  mek: new Uint8Array([1, 2, 3]),
  words: [
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "about",
  ],
};

describe("recoveryPhraseSessionReducer", () => {
  it("stores words and MEK in memory", () => {
    const state = recoveryPhraseSessionReducer(
      { mek: null, words: null },
      { session, type: "set" },
    );

    expect(state.words).toEqual(session.words);
    expect(state.mek).toEqual(session.mek);
  });

  it("clears words and MEK after confirmation", () => {
    const initialState: RecoveryPhraseSessionState = {
      mek: session.mek,
      words: session.words,
    };

    const state = recoveryPhraseSessionReducer(initialState, { type: "clear" });

    expect(state).toEqual({ mek: null, words: null });
  });
});

describe("useRecoveryPhraseSession", () => {
  it("throws when used outside RecoveryPhraseSessionProvider", () => {
    function Consumer() {
      useRecoveryPhraseSession();
      return null;
    }

    expect(() => renderToString(<Consumer />)).toThrow(
      "useRecoveryPhraseSession must be used inside RecoveryPhraseSessionProvider.",
    );
  });

  it("provides an empty session by default", () => {
    function Consumer() {
      const value = useRecoveryPhraseSession();
      return (
        <span>
          {value.words === null && value.mek === null ? "empty" : "filled"}
        </span>
      );
    }

    expect(
      renderToString(
        <RecoveryPhraseSessionProvider>
          <Consumer />
        </RecoveryPhraseSessionProvider>,
      ),
    ).toContain("empty");
  });
});
