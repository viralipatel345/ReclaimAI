import { QUICK_EXIT_URL } from "./config";
import { localMirror } from "./store";
import { deleteServerCopy } from "./useCase";

export function quickExit() {
  const id = localMirror.load()?.id;
  if (id) deleteServerCopy(id);
  localMirror.clear();
  window.location.replace(QUICK_EXIT_URL);
}
