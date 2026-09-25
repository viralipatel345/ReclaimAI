import { QUICK_EXIT_URL } from "./config";
import { localMirror } from "./store";
import { deleteServerCopy } from "./useCase";
import { disconnectGmail } from "./google";

export function quickExit() {
  disconnectGmail(); // revoke the Google token too
  const id = localMirror.load()?.id;
  if (id) deleteServerCopy(id);
  localMirror.clear();
  window.location.replace(QUICK_EXIT_URL);
}
