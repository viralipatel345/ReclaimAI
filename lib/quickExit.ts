import { QUICK_EXIT_URL } from "./config";
import { localMirror } from "./store";

export function quickExit() {
  localMirror.clear();
  window.location.replace(QUICK_EXIT_URL);
}
