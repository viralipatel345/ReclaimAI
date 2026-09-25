import { QUICK_EXIT_URL } from "./config";
import { localMirror } from "./store";
import { deleteServerCopy } from "./useCase";
import { disconnectGmail } from "./google";

export function quickExit() {
  disconnectGmail();
  const id = localMirror.load()?.id;
  if (id) deleteServerCopy(id);
  localMirror.clear();
  window.location.replace("/");
}
