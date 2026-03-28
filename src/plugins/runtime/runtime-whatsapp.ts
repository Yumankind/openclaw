import {
  createRuntimeWhatsAppLoginTool,
  getActiveWebListener,
  getWebAuthAgeMs,
  handleWhatsAppAction,
  logWebSelfId,
  loginWeb,
  logoutWeb,
  monitorWebChannel,
  readWebSelfId,
  sendMessageWhatsApp,
  sendPollWhatsApp,
  startWebLoginWithCode,
  startWebLoginWithQr,
  waitForWebLogin,
  webAuthExists,
} from "./runtime-whatsapp-boundary.js";
import type { PluginRuntime } from "./types.js";

export function createRuntimeWhatsApp(): PluginRuntime["channel"]["whatsapp"] {
  return {
    getActiveWebListener,
    getWebAuthAgeMs,
    logoutWeb,
    logWebSelfId,
    readWebSelfId,
    webAuthExists,
    sendMessageWhatsApp,
    sendPollWhatsApp,
    loginWeb,
    startWebLoginWithQr,
    startWebLoginWithCode,
    waitForWebLogin,
    monitorWebChannel,
    handleWhatsAppAction,
    createLoginTool: createRuntimeWhatsAppLoginTool,
  };
}
