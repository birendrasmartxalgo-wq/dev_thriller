// Owns the ⌘K palette, ? cheat sheet, and global navigation shortcuts (G-H, G-F, G-I).
// Mounted once at the App root.

import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";
import { Shortcuts } from "@/components/Shortcuts";
import { UploadPill } from "@/modules/files/UploadPill";
import { navigate } from "@/router";

export function GlobalOverlays() {
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);

  useEffect(() => {
    let gPending = 0;
    function onKey(e: KeyboardEvent) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "") || (e.target as HTMLElement)?.isContentEditable;

      // ⌘K / Ctrl-K — global palette (works even while typing).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (typing) return;

      // ? — shortcuts cheat sheet.
      if (e.key === "?") {
        e.preventDefault();
        setShortcuts((v) => !v);
        return;
      }
      // / — focus search (go to search page).
      if (e.key === "/") {
        e.preventDefault();
        navigate("/search");
        return;
      }
      // G then H/F/I — navigation sequence.
      if (e.key.toLowerCase() === "g") {
        gPending = Date.now();
        return;
      }
      if (gPending && Date.now() - gPending < 900) {
        if (e.key.toLowerCase() === "h") {
          navigate("/");
          gPending = 0;
          return;
        }
        if (e.key.toLowerCase() === "f") {
          navigate("/files");
          gPending = 0;
          return;
        }
        if (e.key.toLowerCase() === "i") {
          navigate("/inbox");
          gPending = 0;
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {shortcuts && <Shortcuts onClose={() => setShortcuts(false)} />}
      <UploadPill />
    </>
  );
}
