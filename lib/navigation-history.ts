const HISTORY_KEY = "__hoopcheckNavigation";
type Position = { boundary: string; index: number };

/** Track only entries created in this mounted app; never traverse external history. */
export function trackNavigationHistory(browser: Window) {
  const boundary = browser.crypto.randomUUID();
  const history = browser.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const position = (): Position | undefined => history.state?.[HISTORY_KEY];
  const initial: Position = { boundary, index: 0 };
  originalReplace.call(history, { ...history.state, [HISTORY_KEY]: initial }, "");

  const push: History["pushState"] = function (data, unused, url) {
    const current = position();
    const next = current?.boundary === boundary ? current.index + 1 : 0;
    originalPush.call(history, { ...data, [HISTORY_KEY]: { boundary, index: next } }, unused, url);
  };
  const replace: History["replaceState"] = function (data, unused, url) {
    originalReplace.call(history, { ...data, [HISTORY_KEY]: position() ?? initial }, unused, url);
  };
  history.pushState = push;
  history.replaceState = replace;
  return {
    canGoBack: () => {
      const current = position();
      return current?.boundary === boundary && current.index > 0;
    },
    dispose: () => {
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
    },
  };
}
