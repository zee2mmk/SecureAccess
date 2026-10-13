import { type Configuration, LogLevel } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: "a961590f-dccf-4bc4-9e99-cff399aba7e5",
    authority: "https://login.microsoftonline.com/fe5ace84-dc45-420b-933b-9845fbf67805",
    redirectUri: "http://localhost:5173/redirect.html",
  },
  cache: {
    cacheLocation: "sessionStorage"
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
        if (level === LogLevel.Warning) console.warn(message);
      },
    },
  },
};

export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "api://afd5d53b-7697-438a-9f22-a9ea640f904c/access_as_user",
  ],
};
